#!/usr/bin/env python3
"""Second-generation browser runner for the embedded body workbench.

The body iframe intentionally hides its editor controls in embedded mode. The
first Selenium runner used native element clicks and therefore failed even when
the motion runtime, fallback surface, WebGL2 context and diagnostics were ready.
This wrapper keeps the existing scenario/report implementation, but replaces
only the hidden-control interactions with DOM-dispatched JavaScript actions.
"""
from __future__ import annotations

import time
from typing import Any

from selenium import webdriver

import motion_visual_qa as qa
from visual_qa_core import body_state, switch_body, utc_now, wait_until


def _body_script(driver: webdriver.Chrome, script: str, *args: Any) -> Any:
    switch_body(driver)
    try:
        return driver.execute_script(script, *args)
    finally:
        driver.switch_to.default_content()


def set_body_view(driver: webdriver.Chrome, view: str, follow: bool = False) -> None:
    result = _body_script(
        driver,
        """
        const desiredFollow=!!arguments[0], view=String(arguments[1]);
        const followBox=document.getElementById('follow');
        const bodyView=document.getElementById('bodyView');
        const target=document.getElementById(view);
        if(!followBox||!bodyView||!target)throw new Error(`missing body view controls: ${view}`);
        if(followBox.checked!==desiredFollow)followBox.click();
        bodyView.click();
        target.click();
        return {view,follow:followBox.checked,targetDisabled:target.disabled===true};
        """,
        follow,
        view,
    )
    if result.get("targetDisabled"):
        raise RuntimeError(f"身体视角按钮被禁用：{view}")
    time.sleep(0.9)


def reset_body(driver: webdriver.Chrome) -> dict[str, Any]:
    result = _body_script(
        driver,
        """
        const reset=document.getElementById('reset');
        const pause=document.getElementById('pause');
        const bodyView=document.getElementById('bodyView');
        if(!reset)throw new Error('missing reset control');
        if(reset.disabled)throw new Error('reset control disabled');
        reset.click();
        if(pause&&/继续/.test(pause.textContent||''))pause.click();
        bodyView?.click();
        return {reset:true,pauseText:pause?.textContent?.trim()||null};
        """,
    )
    if not result.get("reset"):
        raise RuntimeError("恢复人物命令没有下发")
    time.sleep(1.4)
    wait_until(
        driver,
        lambda: (lambda value: "站" in (value.get("posture") or "") and value.get("diagnostics", {}).get("activity", {}).get("readyForTask") is True)(body_state(driver)),
        30,
        "重置后没有恢复可执行站姿",
    )
    return body_state(driver)


def send_command(driver: webdriver.Chrome, command: str) -> tuple[int, str]:
    initial_done = qa.get_done_count(driver)
    result = _body_script(
        driver,
        """
        const field=document.getElementById('command');
        const send=document.getElementById('send');
        if(!field||!send)throw new Error('missing command controls');
        if(send.disabled)throw new Error('send control disabled');
        field.value=String(arguments[0]);
        field.dispatchEvent(new Event('input',{bubbles:true}));
        field.dispatchEvent(new Event('change',{bubbles:true}));
        send.click();
        return {value:field.value,disabled:send.disabled};
        """,
        command,
    )
    if result.get("value") != command:
        raise RuntimeError("指令文本没有写入身体工作台")
    return initial_done, utc_now()


qa.set_body_view = set_body_view
qa.reset_body = reset_body
qa.send_command = send_command


if __name__ == "__main__":
    raise SystemExit(qa.main())
