from __future__ import annotations

import time
from typing import Any

from selenium import webdriver

from visual_qa_core import body_state, parent_state, switch_body, utc_now, wait_until


def body_boot_state(driver: webdriver.Chrome) -> dict[str, Any]:
    """Read the operational body state without repeatedly requesting WebGL."""
    switch_body(driver)
    result = driver.execute_script(
        """
        const text=id=>document.getElementById(id)?.textContent?.trim()||null;
        const loading=document.getElementById('loading');
        const canvas=document.getElementById('view');
        const lab=globalThis.HumanLab||globalThis.__HUMAN_LAB__||globalThis.lab||null;
        let activity=null;
        try{activity=lab?.activity?.()||lab?.agent?.diagnostics?.()?.activity||null;}catch(error){activity={error:String(error)};}
        return {
          readyState:document.readyState,
          humanLab:!!lab,
          startup:globalThis.__humanStartup||null,
          compact:globalThis.__compactLoading||null,
          loadingHidden:loading?.hidden===true,
          phase:text('phase'),
          posture:text('posture'),
          activity,
          canvas:{
            width:canvas?.width||0,
            height:canvas?.height||0,
            clientWidth:canvas?.clientWidth||0,
            clientHeight:canvas?.clientHeight||0
          }
        };
        """
    )
    driver.switch_to.default_content()
    return result


def body_is_operational(value: dict[str, Any]) -> bool:
    compact = value.get("compact") or {}
    activity = value.get("activity") or {}
    canvas = value.get("canvas") or {}
    geometry_ready = (
        compact.get("state") == "ready"
        or (compact.get("canonicalVertices") or 0) >= 30000
        or (compact.get("triangles") or 0) >= 50000
    )
    return bool(
        value.get("humanLab")
        and value.get("readyState") == "complete"
        and activity.get("readyForTask") is True
        and value.get("phase") not in {None, "生成 R2"}
        and canvas.get("width", 0) > 500
        and canvas.get("height", 0) > 300
        and geometry_ready
    )


def prepare_body_for_review(driver: webdriver.Chrome) -> None:
    """Reduce avoidable render cost after the motion runtime is operational."""
    switch_body(driver)
    driver.execute_script(
        """
        globalThis.__lifeAgentLifecycle?.setMode?.('active');
        const quality=document.getElementById('quality');
        if(quality&&quality.value!=='fast'){
          quality.value='fast';
          quality.dispatchEvent(new Event('change',{bubbles:true}));
        }
        const lab=globalThis.HumanLab||globalThis.__HUMAN_LAB__||globalThis.lab||null;
        lab?.setCameraFollow?.(false);
        lab?.focus?.('body');
        lab?.render?.();
        """
    )
    driver.switch_to.default_content()
    time.sleep(0.8)


def run_preflight(driver: webdriver.Chrome, url: str, source_sha: str) -> dict[str, Any]:
    driver.get(url)
    wait_until(driver, lambda: driver.execute_script("return document.readyState==='complete'"), 80, "主文档未完成载入")

    # The action system becomes operational before the expensive R2 surface
    # refinement has traversed every domain on software WebGL. Requiring the
    # final reconstruction flag made CI wait until the graphics context died.
    # For motion QA, accept the real HumanLab authority once it is task-ready
    # and has a substantial generated surface. Record unfinished refinement as
    # a warning so these captures are never mislabelled as final skin approval.
    boot = wait_until(
        driver,
        lambda: (lambda value: value if body_is_operational(value) else False)(body_boot_state(driver)),
        360,
        "身体动作接口与可用曲面未在限定时间内就绪",
    )

    prepare_body_for_review(driver)
    wait_until(
        driver,
        lambda: (
            lambda value: value
            if value.get("webgl2")
            and value.get("canvas", {}).get("width", 0) > 500
            and value.get("canvas", {}).get("height", 0) > 300
            and not value.get("contextLost")
            else False
        )(body_state(driver)),
        45,
        "身体 iframe 未获得稳定的 WebGL2 画布",
    )

    p, b = parent_state(driver), body_state(driver)
    failures: list[str] = []
    warnings: list[str] = []
    compact = b.get("compact") or {}
    startup = b.get("startup") or {}
    if not p.get("secureContext"):
        failures.append("页面不是安全上下文")
    if p.get("loadingFailed") or p.get("startupError"):
        failures.append(f"启动错误：{p.get('startupError')}")
    if p.get("bodyStatus") not in {"CONNECTED", "BODY READY"}:
        warnings.append(f"父页面身体状态仍为 {p.get('bodyStatus')}；动作审查直接使用已经 task-ready 的身体 iframe。")
    elif p.get("bodyStatus") == "BODY READY":
        warnings.append("可选认知/语音握手未完成；本轮仅执行身体 iframe 动作视觉 QA。")
    if compact.get("state") != "ready" or startup.get("status") != "ready":
        warnings.append(
            "软件 WebGL 环境中的高精度 R2 曲面仍在增量细化；动作、脚锚和姿势截图有效，"
            "但皮肤表面细节只能作为预览，不能用于最终肩腋或材质批准。"
        )
    if not b.get("webgl2") or b.get("contextLost"):
        failures.append("WebGL2 不可用或上下文已丢失")
    canvas = b.get("canvas", {})
    if canvas.get("width", 0) < 500 or canvas.get("height", 0) < 300:
        failures.append(f"画布尺寸异常：{canvas}")
    if b.get("lifecycle") not in {None, "active"}:
        failures.append(f"身体生命周期不是 active：{b.get('lifecycle')}")

    logs = driver.get_log("browser")
    allowed_network = ("favicon", "ERR_BLOCKED_BY_CLIENT", "/api/voice/status")
    severe = [
        row for row in logs
        if row.get("level") == "SEVERE"
        and not any(key in row.get("message", "") for key in allowed_network)
    ]
    if severe:
        failures.append(f"浏览器有 {len(severe)} 条 SEVERE 日志")

    return {
        "passed": not failures,
        "checkedAt": utc_now(),
        "sourceSHA": source_sha,
        "url": url,
        "bodyAuthority": "HumanLab iframe",
        "surfaceReviewScope": "final" if compact.get("state") == "ready" else "motion-preview",
        "boot": boot,
        "parent": p,
        "body": b,
        "browser": {"capabilities": driver.capabilities, "logs": logs},
        "warnings": warnings,
        "failures": failures,
    }
