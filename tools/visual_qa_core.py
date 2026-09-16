from __future__ import annotations

import contextlib
import os
import re
import shutil
import signal
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from selenium import webdriver
from selenium.common.exceptions import JavascriptException, NoSuchElementException, TimeoutException, WebDriverException
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys

VIEWPORT = (1720, 980)
DISPLAY_SIZE = (1920, 1080)
POLL_S = 0.20


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def find_chrome_binary() -> str | None:
    explicit = os.environ.get("CHROME_BINARY")
    if explicit and Path(explicit).exists():
        return explicit
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
        path = shutil.which(name)
        if path:
            return path
    return None


def fetch_ready_url(url: str, timeout_s: float = 150) -> dict[str, Any]:
    deadline = time.time() + timeout_s
    last_error = ""
    attempts = 0
    while time.time() < deadline:
        attempts += 1
        try:
            response = requests.get(url, timeout=25, headers={"Cache-Control": "no-cache"})
            if response.status_code == 200 and "<!DOCTYPE HTML" in response.text[:500].upper():
                return {
                    "url": url,
                    "status": response.status_code,
                    "contentType": response.headers.get("content-type"),
                    "bytes": len(response.content),
                    "attempts": attempts,
                }
            last_error = f"HTTP {response.status_code}; {response.text[:120]!r}"
        except Exception as exc:
            last_error = f"{type(exc).__name__}: {exc}"
        time.sleep(min(8, 1 + attempts * 0.7))
    raise RuntimeError(f"固定 HTTPS 预览在 {timeout_s:.0f}s 内未就绪：{last_error}")


def create_driver() -> webdriver.Chrome:
    options = webdriver.ChromeOptions()
    binary = find_chrome_binary()
    if binary:
        options.binary_location = binary
    for arg in (
        f"--window-size={VIEWPORT[0]},{VIEWPORT[1]}",
        "--window-position=0,0",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--disable-backgrounding-occluded-windows",
        "--enable-webgl",
        "--ignore-gpu-blocklist",
        "--use-gl=angle",
        "--use-angle=swiftshader-webgl",
        "--enable-unsafe-swiftshader",
        "--force-device-scale-factor=1",
        "--lang=zh-CN",
        "--autoplay-policy=no-user-gesture-required",
    ):
        options.add_argument(arg)
    options.set_capability("goog:loggingPrefs", {"browser": "ALL"})
    driver = webdriver.Chrome(options=options)
    driver.set_window_size(*VIEWPORT)
    driver.set_page_load_timeout(180)
    return driver


def wait_until(driver: webdriver.Chrome, predicate, timeout_s: float, message: str) -> Any:
    deadline = time.time() + timeout_s
    last: Any = None
    while time.time() < deadline:
        try:
            last = predicate()
            if last:
                return last
        except (JavascriptException, NoSuchElementException, WebDriverException):
            pass
        time.sleep(POLL_S)
    raise TimeoutError(f"{message}; last={last!r}")


def switch_body(driver: webdriver.Chrome) -> None:
    driver.switch_to.default_content()
    frame = wait_until(driver, lambda: driver.find_element(By.ID, "bodyFrame"), 30, "未找到身体 iframe")
    driver.switch_to.frame(frame)


def body_state(driver: webdriver.Chrome) -> dict[str, Any]:
    switch_body(driver)
    result = driver.execute_script(
        """
        const text=id=>document.getElementById(id)?.textContent?.trim()||null;
        const loading=document.getElementById('loading');
        const canvas=document.getElementById('view');
        let gl=null,glError=null;
        try{gl=canvas?.getContext('webgl2');}catch(error){glError=String(error);}
        const lab=globalThis.lab||globalThis.__HUMAN_LAB__||globalThis.HumanLab||null;
        let locomotion=null,diagnostics=null;
        try{locomotion=lab?.agent?.locomotion?.report?.()||null;}catch(error){locomotion={error:String(error)};}
        try{diagnostics=lab?.agent?.diagnostics?.()||lab?.agent?.report?.()||null;}catch(error){diagnostics={error:String(error)};}
        return {
          readyState:document.readyState,startup:globalThis.__humanStartup||null,
          compact:globalThis.__compactLoading||null,lifecycle:globalThis.__lifeAgentLifecycle?.mode||null,
          loadingHidden:loading?.hidden===true,phase:text('phase'),posture:text('posture'),held:text('held'),done:text('done'),
          boneError:text('boneError'),gripError:text('gripError'),footError:text('footError'),plan:text('plan'),log:text('log'),
          canvas:{width:canvas?.width||0,height:canvas?.height||0,clientWidth:canvas?.clientWidth||0,clientHeight:canvas?.clientHeight||0},
          webgl2:!!gl,contextLost:gl?.isContextLost?.()??null,renderer:gl?gl.getParameter(gl.RENDERER):null,
          vendor:gl?gl.getParameter(gl.VENDOR):null,glVersion:gl?gl.getParameter(gl.VERSION):null,glError,
          locomotion,diagnostics,globals:{lab:!!globalThis.lab,humanLab:!!globalThis.__HUMAN_LAB__}
        };
        """
     )
    driver.switch_to.default_content()
    return result


def parent_state(driver: webdriver.Chrome) -> dict[str, Any]:
    driver.switch_to.default_content()
    return driver.execute_script(
        """
        const text=id=>document.getElementById(id)?.textContent?.trim()||null;
        const cover=document.getElementById('loadingCover');
        const detail=document.getElementById('startupErrorDetail');
        return {secureContext:window.isSecureContext,readyState:document.readyState,bodyStatus:text('bodyStatusTop'),
          bindingState:text('bindingState'),connection:text('cleanConnection'),
          loadingHidden:cover?.classList.contains('hidden')||false,loadingFailed:cover?.classList.contains('failed')||false,
          startupError:detail&&!detail.hidden?detail.textContent.trim():null,
          compact:{fps:text('compact-fps'),gpu:text('compact-gpu'),cpu:text('compact-cpu'),draw:text('compact-draw'),
            triangles:text('compact-tri'),memory:text('compact-memory'),heap:text('compact-heap')},url:location.href};
        """
    )


def run_preflight(driver: webdriver.Chrome, url: str, source_sha: str) -> dict[str, Any]:
    driver.get(url)
    wait_until(driver, lambda: driver.execute_script("return document.readyState==='complete'"), 80, "主文档未完成载入")
    # Motion QA operates directly on the body iframe. BODY READY is therefore
    # sufficient even when the optional voice/brain service is unavailable and
    # the parent loading cover remains visible. Requiring CONNECTED + hidden
    # incorrectly deadlocked deterministic local browser runs.
    wait_until(
        driver,
        lambda: driver.find_element(By.ID, "bodyStatusTop").text.strip() in {"CONNECTED", "BODY READY"},
        420,
        "人物身体运行时未完成握手",
    )
    wait_until(
        driver,
        lambda: (lambda value: value.get("webgl2") and value.get("canvas", {}).get("width", 0) > 500 and not value.get("contextLost"))(body_state(driver)),
        300,
        "身体 iframe 未获得有效 WebGL2 画布",
    )
    wait_until(
        driver,
        lambda: (lambda s: s.get("phase") not in {None, "生成 R2"} and s.get("loadingHidden") is True)(body_state(driver)),
        480,
        "人体曲面未完成首帧",
    )
    p, b = parent_state(driver), body_state(driver)
    failures: list[str] = []
    warnings: list[str] = []
    if not p.get("secureContext"):
        failures.append("页面不是安全上下文")
    if p.get("loadingFailed") or p.get("startupError"):
        failures.append(f"启动错误：{p.get('startupError')}")
    if p.get("bodyStatus") not in {"CONNECTED", "BODY READY"}:
        failures.append(f"身体握手状态不可用：{p.get('bodyStatus')}")
    if p.get("bodyStatus") == "BODY READY":
        warnings.append("可选认知/语音握手未完成；本轮仅执行身体 iframe 动作视觉 QA。")
    if not b.get("webgl2") or b.get("contextLost"):
        failures.append("WebGL2 不可用或上下文已丢失")
    canvas = b.get("canvas", {})
    if canvas.get("width", 0) < 500 or canvas.get("height", 0) < 300:
        failures.append(f"画布尺寸异常：{canvas}")
    if b.get("lifecycle") not in {None, "active"}:
        failures.append(f"身体生命周期不是 active：{b.get('lifecycle')}")
    logs = driver.get_log("browser")
    allowed_network = ("favicon", "ERR_BLOCKED_BY_CLIENT", "/api/voice/status")
    severe = [x for x in logs if x.get("level") == "SEVERE" and not any(k in x.get("message", "") for k in allowed_network)]
    if severe:
        failures.append(f"浏览器有 {len(severe)} 条 SEVERE 日志")
    return {"passed": not failures,"checkedAt":utc_now(),"sourceSHA":source_sha,"url":url,
      "parent":p,"body":b,"browser":{"capabilities":driver.capabilities,"logs":logs},"warnings":warnings,"failures":failures}


def set_parent_anatomy(driver: webdriver.Chrome, value: str) -> None:
    driver.switch_to.default_content()
    driver.execute_script(
        """
        const select=document.getElementById('anatomyView');
        if(!select)throw new Error('missing anatomyView');
        select.value=arguments[0];select.dispatchEvent(new Event('change',{bubbles:true}));
        """,
        value,
    )
    time.sleep(1.0)


def set_body_view(driver: webdriver.Chrome, view: str, follow: bool = False) -> None:
    switch_body(driver)
    follow_box = driver.find_element(By.ID, "follow")
    if follow_box.is_selected() != follow:
        driver.execute_script("arguments[0].click()", follow_box)
    driver.find_element(By.ID, "bodyView").click()
    time.sleep(0.45)
    driver.find_element(By.ID, view).click()
    time.sleep(0.8)
    driver.switch_to.default_content()


def get_done_count(driver: webdriver.Chrome) -> int:
    switch_body(driver)
    text = driver.find_element(By.ID, "done").text.strip()
    driver.switch_to.default_content()
    match = re.search(r"\d+", text)
    return int(match.group(0)) if match else 0


def reset_body(driver: webdriver.Chrome) -> dict[str, Any]:
    switch_body(driver)
    with contextlib.suppress(Exception):
        driver.find_element(By.ID, "reset").click()
    time.sleep(1.4)
    with contextlib.suppress(Exception):
        pause = driver.find_element(By.ID, "pause")
        if "继续" in pause.text:
            pause.click()
    with contextlib.suppress(Exception):
        driver.find_element(By.ID, "bodyView").click()
    driver.switch_to.default_content()
    wait_until(driver, lambda: "站" in (body_state(driver).get("posture") or ""), 24, "重置后没有恢复站立")
    return body_state(driver)


def send_command(driver: webdriver.Chrome, command: str) -> tuple[int, str]:
    initial_done = get_done_count(driver)
    switch_body(driver)
    field = driver.find_element(By.ID, "command")
    field.click(); field.send_keys(Keys.CONTROL, "a"); field.send_keys(command)
    driver.find_element(By.ID, "send").click()
    driver.switch_to.default_content()
    return initial_done, utc_now()


def wait_for_completion(driver: webdriver.Chrome, initial_done: int, timeout_s: float, expected_posture: str | None = None) -> dict[str, Any]:
    start = time.time(); last = body_state(driver); start_phase = last.get("phase"); started = False
    while time.time() - start < timeout_s:
        state = body_state(driver); last = state
        match = re.search(r"\d+", state.get("done") or "0"); done = int(match.group(0)) if match else 0
        phase, log = state.get("phase") or "", state.get("log") or ""
        if phase != start_phase or done > initial_done or (state.get("plan") or "").strip():
            started = True
        if any(term in log for term in ("失败", "拒绝", "无法继续", "超时")) and started:
            return {"completed":False,"failed":True,"timedOut":False,"durationS":time.time()-start,"state":state,"reason":log[-600:]}
        posture_ok = expected_posture is None or expected_posture in (state.get("posture") or "")
        if done > initial_done and posture_ok:
            time.sleep(0.65)
            return {"completed":True,"failed":False,"timedOut":False,"durationS":time.time()-start,"state":body_state(driver),"reason":None}
        time.sleep(POLL_S)
    return {"completed":False,"failed":False,"timedOut":True,"durationS":time.time()-start,"state":last,"reason":"timeout"}


def start_video(path: Path) -> subprocess.Popen[bytes] | None:
    ffmpeg, display = shutil.which("ffmpeg"), os.environ.get("DISPLAY")
    if not ffmpeg or not display:
        return None
    path.parent.mkdir(parents=True, exist_ok=True)
    command = [ffmpeg,"-hide_banner","-loglevel","error","-y","-f","x11grab","-draw_mouse","0","-framerate","30",
      "-video_size",f"{DISPLAY_SIZE[0]}x{DISPLAY_SIZE[1]}","-i",display,"-c:v","libx264","-preset","veryfast","-crf","24",
      "-pix_fmt","yuv420p","-movflags","+faststart",str(path)]
    return subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def stop_video(process: subprocess.Popen[bytes] | None) -> None:
    if process is None:
        return
    with contextlib.suppress(ProcessLookupError):
        process.send_signal(signal.SIGINT)
    try:
        process.communicate(timeout=12)
    except subprocess.TimeoutExpired:
        process.kill(); process.communicate(timeout=5)
