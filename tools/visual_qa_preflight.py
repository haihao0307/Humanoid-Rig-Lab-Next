from __future__ import annotations

import time
from typing import Any

from selenium import webdriver

from visual_qa_core import body_state, parent_state, switch_body, utc_now, wait_until


def body_boot_state(driver: webdriver.Chrome) -> dict[str, Any]:
    """Read the operational motion state without requesting the GL context."""
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
    activity = value.get("activity") or {}
    canvas = value.get("canvas") or {}
    return bool(
        value.get("humanLab")
        and value.get("readyState") == "complete"
        and activity.get("readyForTask") is True
        and canvas.get("width", 0) > 500
        and canvas.get("height", 0) > 300
    )


def prepare_body_for_review(driver: webdriver.Chrome) -> None:
    """Expose the task-ready body and reduce avoidable software-render cost."""
    driver.switch_to.default_content()
    driver.execute_script(
        """
        const cover=document.getElementById('loadingCover');
        if(cover){cover.classList.add('hidden');cover.style.display='none';}
        """
    )
    switch_body(driver)
    driver.execute_script(
        """
        globalThis.__lifeAgentLifecycle?.setMode?.('active');
        const loading=document.getElementById('loading');
        if(loading)loading.hidden=true;
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

    # Motion QA is intentionally decoupled from the costly final R2 surface
    # refinement. HumanLab exposes a task-ready fixed-bone runtime and a visible
    # fallback body before the reconstruction worker completes. Starting the
    # motion run at that point prevents software WebGL from losing its context
    # during a multi-minute high-density upload. The resulting pictures are
    # valid for motion/contact review but explicitly provisional for skin.
    boot = wait_until(
        driver,
        lambda: (lambda value: value if body_is_operational(value) else False)(body_boot_state(driver)),
        120,
        "身体动作接口未在限定时间内就绪",
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
        warnings.append(f"父页面仍记录启动状态：{p.get('startupError') or p.get('bodyStatus')}；身体动作接口已独立就绪。")
    if p.get("bodyStatus") not in {"CONNECTED", "BODY READY"}:
        warnings.append(f"父页面身体状态仍为 {p.get('bodyStatus')}；动作审查直接使用 task-ready 的身体 iframe。")
    elif p.get("bodyStatus") == "BODY READY":
        warnings.append("可选认知/语音握手未完成；本轮仅执行身体 iframe 动作视觉 QA。")
    if compact.get("state") != "ready" or startup.get("status") != "ready":
        warnings.append(
            "高精度 R2 曲面仍在后台增量细化；本轮截图用于动作、脚锚、接触与镜头检查，"
            "不能作为肩腋、头发或皮肤细节的最终批准。"
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
