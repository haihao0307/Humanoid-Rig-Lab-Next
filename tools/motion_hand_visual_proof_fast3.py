#!/usr/bin/env python3
"""Readiness adapter for real-browser hand proofs.

The production renderer already owns the canvas context. Asking the canvas for
a second, specifically WebGL2 context can return null even while the live
renderer is healthy. This adapter reads HumanLab.renderer.gl and accepts the
actual renderer backend without weakening the requirement for a live canvas.
"""
from __future__ import annotations

from typing import Any

from selenium.common.exceptions import TimeoutException

import motion_hand_visual_proof_fast2  # installs batched fixed-step advancement
import motion_hand_visual_proof_fast as impl


def load(driver, url: str) -> dict[str, Any]:
    try:
        driver.get(url)
    except TimeoutException:
        # A heavy exact single-file page can continue initializing after the
        # navigation timeout. Readiness below remains authoritative.
        pass
    impl.wait_until(
        lambda: driver.execute_script("return document.readyState==='interactive'||document.readyState==='complete'"),
        45,
        "页面 DOM 未进入可交互状态",
        .1,
    )

    def ready() -> dict[str, Any] | None:
        value = driver.execute_script(
            """
            const f=document.querySelector('#bodyFrame');const w=f?.contentWindow||window;
            const lab=w.HumanLab,canvas=w.document?.querySelector('#view');
            const gl=lab?.renderer?.gl||lab?.renderer?.context||null;
            let lost=false;try{lost=!!gl?.isContextLost?.()}catch(error){lost=true}
            return {ready:!!lab?.agent&&!!lab?.renderer&&!!canvas&&canvas.width>500&&canvas.height>300&&!!gl&&!lost,
              startup:w.__humanStartup||null,startupError:w.__startupError||null,
              rendererContext:gl?.constructor?.name||null,
              population:lab?.population?.list?.().length||0,canvas:[canvas?.width||0,canvas?.height||0]};
            """
        )
        if value.get("startupError"):
            raise RuntimeError(value["startupError"])
        return value if value.get("ready") else None

    state = impl.wait_until(ready, 180, "人物运行时未完成首帧", .15)
    impl.body_js(driver, "HumanLab.setAuto(false);HumanLab.inspectBody('front');HumanLab.render();")
    return state


impl.load = load
