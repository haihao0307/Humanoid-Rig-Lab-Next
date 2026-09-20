#!/usr/bin/env python3
"""Direct, synchronous WebGL capture for human hand-action QA.

The public HumanLab.render() helper schedules/redraws the workbench.  For proof
images we call the authoritative Renderer.render(items, lines) method directly,
then export the preserved WebGL buffer before any later UI frame can replace it.
"""
from __future__ import annotations

import base64
import math
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageStat


def capture_direct(proof, driver, out_dir: Path, stem: str, label: str,
                   names: list[str], subtitle: str, completed: bool = True,
                   error: str | None = None) -> dict[str, Any]:
    state = proof.compact_state(driver)
    out_dir.mkdir(parents=True, exist_ok=True)
    raw = out_dir / f"{stem}--raw.png"

    payload = proof.body_js(
        driver,
        """
        const lab=HumanLab,r=lab.renderer,w=lab.world;
        if(!r?.render||!r?.canvas||!r?.gl)throw Error('缺少主 Renderer.render 或 WebGL2');
        const actors=lab.population?Array.from(lab.population.values()):[];
        const actorItems=actors.flatMap(actor=>{
          const h=actor?.human;
          return h?[...(h.bones||[]),...(h.cartilage||[]),...(h.tissue?.items||[])]:[];
        });
        const sceneItems=[...(w?.scenery||[]),...(w?.showRoofs?w?.roofItems||[]:[]),...(w?.objects||[])];
        const items=[...sceneItems,...actorItems].filter(item=>item&&item.visible!==false);
        const active=lab.population?.active||null;
        const compact=active?.compact||lab.compact||r.compact||null;
        if(!compact)throw Error('缺少当前人物 CompactSurfaceRenderer');
        compact.enabled=true;
        r.compacts=r.compacts||[];
        if(!r.compacts.includes(compact))r.compacts.push(compact);
        const before={frames:r.frames||0,drawCalls:r.drawCalls||0,canvasWidth:r.canvas.width,canvasHeight:r.canvas.height};
        r.render(items,[]);
        r.gl.finish();
        const glError=r.gl.getError();
        const dataUrl=r.canvas.toDataURL('image/png');
        const after={frames:r.frames||0,drawCalls:r.drawCalls||0,shadowDrawCalls:r.shadowDrawCalls||0,
          canvasWidth:r.canvas.width,canvasHeight:r.canvas.height};
        return{dataUrl,before,after,glError,itemCount:items.length,actorItemCount:actorItems.length,
          visibleSceneItemCount:sceneItems.filter(item=>item&&item.visible!==false).length,
          activeId:active?.id||null,activeCompacts:r.activeCompacts?.().length??null,
          compact:{enabled:compact.enabled!==false,visible:compact.visible===true,disposed:!!compact.disposed,
            chunks:compact.chunks?.length||0,triangles:compact.report?.triangles||0,
            boundToActive:compact.boundHuman===lab.human,view:compact.view||null}};
        """,
    )

    data_url = payload.get("dataUrl") or ""
    if not data_url.startswith("data:image/png;base64,"):
        raise RuntimeError("主渲染器没有返回有效 PNG")
    raw.write_bytes(base64.b64decode(data_url.split(",", 1)[1], validate=True))

    image = Image.open(raw).convert("RGB")
    if image.width < 500 or image.height < 300:
        image.close()
        raise RuntimeError(f"渲染图尺寸异常：{image.width}x{image.height}")
    before = payload.get("before") or {}
    after = payload.get("after") or {}
    if int(after.get("frames") or 0) <= int(before.get("frames") or 0):
        image.close()
        raise RuntimeError(f"主渲染器帧计数没有推进：{before} -> {after}")
    if int(after.get("drawCalls") or 0) <= 0 or int(payload.get("activeCompacts") or 0) <= 0:
        image.close()
        raise RuntimeError(f"主渲染器没有提交人物绘制：{payload}")

    stats = ImageStat.Stat(image)
    background = Image.new("RGB", image.size, image.getpixel((2, 2)))
    difference = ImageChops.difference(image, background)
    content_box = difference.getbbox()
    spread = sum(stats.stddev)
    background.close()
    if content_box is None or spread < 6.0:
        image.close()
        raise RuntimeError(f"PNG 仍接近纯背景：spread={spread:.3f}, box={content_box}, render={payload}")

    c = state.get("canvas", {})
    sx = image.width / max(1, float(c.get("clientWidth") or image.width))
    sy = image.height / max(1, float(c.get("clientHeight") or image.height))
    pts: list[tuple[float, float]] = []
    for name in names:
        p = proof.xy(state, name)
        if p and math.isfinite(p[0]) and math.isfinite(p[1]):
            pts.append((p[0] * sx, p[1] * sy))
    if pts:
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        mx, my = 200, 185
        box = [max(0, int(min(xs) - mx)), max(0, int(min(ys) - my)),
               min(image.width, int(max(xs) + mx)), min(image.height, int(max(ys) + my))]
        if box[2] - box[0] < 520:
            cx = (box[0] + box[2]) // 2
            box[0], box[2] = max(0, cx - 260), min(image.width, cx + 260)
        if box[3] - box[1] < 430:
            cy = (box[1] + box[3]) // 2
            box[1], box[3] = max(0, cy - 215), min(image.height, cy + 215)
        close = image.crop(tuple(box))
    else:
        close = image.crop(content_box)

    status = subtitle if completed else f"未完成｜{error or subtitle}"
    full_img = proof.title_bar(image, label, status)
    hand_img = proof.title_bar(close, label + "｜手部近景", status)
    full = out_dir / f"{stem}--full.png"
    hand = out_dir / f"{stem}--hand.png"
    full_img.save(full)
    hand_img.save(hand)
    image.close(); close.close(); full_img.close(); hand_img.close()
    return {
        "id": stem, "label": label, "subtitle": status, "completed": completed,
        "error": error, "full": full.name, "hand": hand.name, "raw": raw.name,
        "state": state, "directRenderer": {k: v for k, v in payload.items() if k != "dataUrl"},
        "imageAudit": {"spread": spread, "contentBox": content_box},
        "capturedAt": proof.now(),
    }
