#!/usr/bin/env python3
"""Capture the WebGL canvas in the same browser task as HumanLab.render().

Selenium element screenshots can observe an already-cleared default WebGL
framebuffer when preserveDrawingBuffer is false.  This helper renders, calls
``gl.finish()``, copies the canvas into a temporary 2D canvas, and returns that
PNG before the browser is allowed to clear the frame.
"""
from __future__ import annotations

import base64
import math
from pathlib import Path
from typing import Any

from PIL import Image


def capture_canvas(proof, driver, out_dir: Path, stem: str, label: str,
                   names: list[str], subtitle: str, completed: bool = True,
                   error: str | None = None) -> dict[str, Any]:
    state = proof.compact_state(driver)
    out_dir.mkdir(parents=True, exist_ok=True)
    raw = out_dir / f"{stem}--raw.png"

    payload = proof.body_js(
        driver,
        """
        const lab=HumanLab,canvas=lab.renderer?.canvas||document.getElementById('view');
        if(!canvas)throw Error('缺少 WebGL 画布');
        lab.render();
        const gl=lab.renderer?.gl||canvas.getContext('webgl2');gl?.finish?.();
        const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;
        const ctx=copy.getContext('2d',{alpha:false});ctx.drawImage(canvas,0,0);
        const dataUrl=copy.toDataURL('image/png');
        return{dataUrl,width:copy.width,height:copy.height,drawCalls:lab.renderer?.drawCalls??null,
          shadowDrawCalls:lab.renderer?.shadowDrawCalls??null,compactVisible:lab.compact?.visible===true,
          compactChunks:lab.compact?.chunks?.length||0};
        """,
    )
    data_url = payload.get("dataUrl") or ""
    if not data_url.startswith("data:image/png;base64,"):
        raise RuntimeError("浏览器未返回有效 WebGL PNG")
    raw.write_bytes(base64.b64decode(data_url.split(",", 1)[1], validate=True))

    image = Image.open(raw).convert("RGB")
    if image.width < 500 or image.height < 300:
        image.close(); raise RuntimeError(f"WebGL PNG 尺寸异常：{image.width}x{image.height}")
    c = state.get("canvas", {})
    sx = image.width / max(1, float(c.get("clientWidth") or image.width))
    sy = image.height / max(1, float(c.get("clientHeight") or image.height))
    pts: list[tuple[float, float]] = []
    for name in names:
        p = proof.xy(state, name)
        if p and math.isfinite(p[0]) and math.isfinite(p[1]): pts.append((p[0] * sx, p[1] * sy))
    if pts:
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        mx, my = 180, 170
        box = [max(0, int(min(xs) - mx)), max(0, int(min(ys) - my)),
               min(image.width, int(max(xs) + mx)), min(image.height, int(max(ys) + my))]
        if box[2] - box[0] < 460:
            cx = (box[0] + box[2]) // 2; box[0], box[2] = max(0, cx - 230), min(image.width, cx + 230)
        if box[3] - box[1] < 390:
            cy = (box[1] + box[3]) // 2; box[1], box[3] = max(0, cy - 195), min(image.height, cy + 195)
        close = image.crop(tuple(box))
    else:
        w, h = image.size; close = image.crop((int(w * .18), int(h * .06), int(w * .82), int(h * .9)))

    status = subtitle if completed else f"未完成｜{error or subtitle}"
    full_img = proof.title_bar(image, label, status)
    hand_img = proof.title_bar(close, label + "｜手部近景", status)
    full = out_dir / f"{stem}--full.png"; hand = out_dir / f"{stem}--hand.png"
    full_img.save(full); hand_img.save(hand)
    image.close(); close.close(); full_img.close(); hand_img.close()
    return {"id":stem,"label":label,"subtitle":status,"completed":completed,"error":error,
      "full":full.name,"hand":hand.name,"raw":raw.name,"state":state,
      "framebuffer":{k:v for k,v in payload.items() if k!="dataUrl"},"capturedAt":proof.now()}
