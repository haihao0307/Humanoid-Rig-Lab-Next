#!/usr/bin/env python3
"""Focused real-browser proof for the R1.2 gait transition.

This is intentionally narrower than the full motion visual matrix. It verifies
that the production browser runtime exposes and executes the four changes made
in R1.2: a bounded double-support preparation, early first-foot release,
terminal step shortening and outside-foot turn preference. Screenshots remain
motion-preview evidence; they do not approve skin quality or full dynamics.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from PIL import Image, ImageOps, ImageDraw
from selenium import webdriver
from selenium.webdriver.common.by import By


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def chrome() -> webdriver.Chrome:
    options = webdriver.ChromeOptions()
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
        binary = shutil.which(name)
        if binary:
            options.binary_location = binary
            break
    for arg in (
        "--window-size=1720,980",
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
    ):
        options.add_argument(arg)
    options.set_capability("goog:loggingPrefs", {"browser": "ALL"})
    driver = webdriver.Chrome(options=options)
    driver.set_window_size(1720, 980)
    driver.set_page_load_timeout(180)
    return driver


def wait(predicate: Callable[[], Any], timeout: float, message: str, interval: float = 0.04) -> Any:
    deadline = time.time() + timeout
    last: Any = None
    while time.time() < deadline:
        try:
            last = predicate()
            if last:
                return last
        except Exception as exc:  # keep the last browser error for diagnostics
            last = f"{type(exc).__name__}: {exc}"
        time.sleep(interval)
    raise TimeoutError(f"{message}; last={last!r}")


def body(driver: webdriver.Chrome) -> None:
    driver.switch_to.default_content()
    frame = wait(lambda: driver.find_element(By.ID, "bodyFrame"), 35, "未找到身体 iframe")
    driver.switch_to.frame(frame)


def state(driver: webdriver.Chrome) -> dict[str, Any]:
    body(driver)
    result = driver.execute_script(
        """
        const text=id=>document.getElementById(id)?.textContent?.trim()||null;
        const lab=globalThis.lab||globalThis.__HUMAN_LAB__||globalThis.HumanLab||null;
        let locomotion=null,activity=null,diagnostics=null;
        try{locomotion=lab?.agent?.locomotion?.report?.()||null;}catch(error){locomotion={error:String(error)};}
        try{activity=lab?.agent?.activity?.()||null;}catch(error){activity={error:String(error)};}
        try{diagnostics=lab?.agent?.diagnostics?.()||null;}catch(error){diagnostics={error:String(error)};}
        return {
          readyState:document.readyState,
          loadingHidden:document.getElementById('loading')?.hidden===true,
          phase:text('phase'),posture:text('posture'),done:text('done'),log:text('log'),plan:text('plan'),
          canvas:{width:document.getElementById('view')?.width||0,height:document.getElementById('view')?.height||0},
          locomotion,activity,diagnostics,
          gait:locomotion?.gaitTransition||null,
          runtime:locomotion?.runtimeState||null,
          readyForTask:activity?.readyForTask===true||diagnostics?.activity?.readyForTask===true
        };
        """
    )
    driver.switch_to.default_content()
    return result


def done_count(value: dict[str, Any]) -> int:
    digits = "".join(ch for ch in str(value.get("done") or "") if ch.isdigit())
    return int(digits or 0)


def body_script(driver: webdriver.Chrome, script: str, *args: Any) -> Any:
    body(driver)
    try:
        return driver.execute_script(script, *args)
    finally:
        driver.switch_to.default_content()


def set_view(driver: webdriver.Chrome, view: str, follow: bool = False) -> None:
    result = body_script(
        driver,
        """
        const follow=document.getElementById('follow');
        const menu=document.getElementById('bodyView');
        const target=document.getElementById(arguments[0]);
        if(!follow||!menu||!target)throw new Error('missing body camera controls');
        if(follow.checked!==arguments[1])follow.click();
        menu.click();target.click();
        return {view:target.id,follow:follow.checked};
        """,
        view,
        follow,
    )
    if result.get("view") != view:
        raise RuntimeError(f"镜头没有切换到 {view}: {result}")
    time.sleep(0.65)


def reset(driver: webdriver.Chrome) -> dict[str, Any]:
    body_script(
        driver,
        """
        const reset=document.getElementById('reset');
        const pause=document.getElementById('pause');
        const bodyView=document.getElementById('bodyView');
        if(!reset)throw new Error('missing reset control');
        reset.click();
        if(pause&&/继续/.test(pause.textContent||''))pause.click();
        bodyView?.click();
        """,
    )
    time.sleep(1.0)
    return wait(
        lambda: (lambda s: s if "站" in (s.get("posture") or "") and s.get("readyForTask") else None)(state(driver)),
        35,
        "重置后没有恢复可执行站姿",
        0.15,
    )


def command(driver: webdriver.Chrome, text: str) -> int:
    before = done_count(state(driver))
    result = body_script(
        driver,
        """
        const field=document.getElementById('command'),send=document.getElementById('send');
        if(!field||!send)throw new Error('missing command controls');
        field.value=String(arguments[0]);
        field.dispatchEvent(new Event('input',{bubbles:true}));
        field.dispatchEvent(new Event('change',{bubbles:true}));
        send.click();return {value:field.value,disabled:send.disabled===true};
        """,
        text,
    )
    if result.get("value") != text:
        raise RuntimeError(f"命令未写入：{result}")
    return before


def capture(driver: webdriver.Chrome, path: Path, meta: dict[str, Any]) -> dict[str, Any]:
    path.parent.mkdir(parents=True, exist_ok=True)
    body(driver)
    canvas = driver.find_element(By.ID, "view")
    canvas.screenshot(str(path))
    driver.switch_to.default_content()
    with Image.open(path) as image:
        size = list(image.size)
    return {"file": path.name, "path": path.as_posix(), "size": size, "capturedAt": now(), "state": meta}


def contact_sheet(root: Path, captures: list[dict[str, Any]]) -> str:
    cards: list[Image.Image] = []
    for item in captures:
        image = Image.open(root / item["file"]).convert("RGB")
        image.thumbnail((760, 430))
        card = Image.new("RGB", (800, 500), "white")
        x = (800 - image.width) // 2
        card.paste(image, (x, 20))
        draw = ImageDraw.Draw(card)
        draw.text((20, 460), item["label"], fill="black")
        cards.append(card)
        image.close()
    sheet = Image.new("RGB", (1600, ((len(cards) + 1) // 2) * 500), "white")
    for index, card in enumerate(cards):
        sheet.paste(card, ((index % 2) * 800, (index // 2) * 500))
    output = root / "contact-sheet.jpg"
    sheet.save(output, quality=90)
    return output.name


def write_html(root: Path, report: dict[str, Any]) -> None:
    cards = []
    for item in report["captures"]:
        cards.append(
            f"<article><h2>{item['label']}</h2><img src='{item['file']}' loading='lazy'>"
            f"<pre>{json.dumps(item['state'].get('gait'),ensure_ascii=False,indent=2)}</pre></article>"
        )
    html = f"""<!doctype html><html lang='zh-CN'><head><meta charset='utf-8'>
<meta name='viewport' content='width=device-width,initial-scale=1'><title>R1.2 步态浏览器证据</title>
<style>body{{margin:0;background:#111;color:#eee;font:15px/1.55 system-ui;padding:24px}}a{{color:#8cc8ff}}.summary,article{{background:#1b1b1b;border:1px solid #333;border-radius:14px;padding:18px;margin:0 0 20px}}img{{display:block;max-width:100%;height:auto;background:#222}}pre{{white-space:pre-wrap;overflow:auto;color:#cfe7ff}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(440px,1fr));gap:20px}}</style></head><body>
<h1>人物动作收敛 R1.2｜真实浏览器步态证据</h1>
<section class='summary'><p>源提交：<code>{report['sourceSHA']}</code></p><p>状态：<strong>{report['status']}</strong></p>
<p>范围：起步双支撑准备、首步释放、终点收步、原地转身。此页使用运动预览表面，不代表皮肤质量或完整动力学验收。</p>
<p><a href='{report['interactiveURL']}'>打开精确提交三维工作台</a></p><pre>{json.dumps(report['checks'],ensure_ascii=False,indent=2)}</pre></section>
<p><img src='{report['contactSheet']}' alt='接触表'></p><div class='grid'>{''.join(cards)}</div></body></html>"""
    (root / "visual-review.html").write_text(html, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--source-sha", required=True)
    parser.add_argument("--interactive-url", required=True)
    parser.add_argument("--output", default="gait-proof")
    args = parser.parse_args()
    root = Path(args.output).resolve()
    root.mkdir(parents=True, exist_ok=True)
    report: dict[str, Any] = {
        "schema": "human/motion_gait_browser_proof@1",
        "sourceSHA": args.source_sha,
        "testedURL": args.url,
        "interactiveURL": args.interactive_url,
        "startedAt": now(),
        "status": "INCONCLUSIVE",
        "captures": [],
        "checks": {},
        "surfaceReviewScope": "motion-preview-lightweight-fallback",
        "skinApproval": False,
        "fullDynamics": False,
        "visualAcceptance": False,
        "userVisualAcceptance": "pending",
    }
    driver: webdriver.Chrome | None = None
    try:
        driver = chrome()
        driver.get(args.url)
        wait(lambda: driver.execute_script("return document.readyState==='complete'"), 90, "主页面没有完成加载", 0.15)
        wait(
            lambda: (lambda s: s if s.get("loadingHidden") and s.get("canvas", {}).get("width", 0) > 500 and s.get("locomotion") else None)(state(driver)),
            180,
            "人物运动运行时没有完成首帧",
            0.2,
        )

        set_view(driver, "front", False)
        start = reset(driver)
        item = capture(driver, root / "01-start-front.png", start)
        item["label"] = "01｜站立起点（正面）"
        report["captures"].append(item)

        before = command(driver, "向前走1米")
        prep = wait(
            lambda: (lambda s: s if (s.get("gait") or {}).get("maximumPoseOffsetM", 0) >= 0.006 else None)(state(driver)),
            15,
            "没有观察到起步支撑侧转移",
            0.025,
        )
        item = capture(driver, root / "02-start-preparation-front.png", prep)
        item["label"] = "02｜起步双支撑准备（正面）"
        report["captures"].append(item)

        first = wait(
            lambda: (lambda s: s if (s.get("gait") or {}).get("firstSwingRootTravelM") is not None else None)(state(driver)),
            18,
            "没有观察到首步释放",
            0.035,
        )
        item = capture(driver, root / "03-first-swing-front.png", first)
        item["label"] = "03｜首步释放（正面）"
        report["captures"].append(item)

        terminal = wait(
            lambda: (lambda s: s if (s.get("gait") or {}).get("minimumObservedTerminalScale", 1) < 0.8 else None)(state(driver)),
            38,
            "没有观察到终点步幅收短",
            0.08,
        )
        set_view(driver, "side", True)
        item = capture(driver, root / "04-terminal-step-side.png", terminal)
        item["label"] = "04｜终点收步（侧面）"
        report["captures"].append(item)

        completed = wait(
            lambda: (lambda s: s if done_count(s) > before and s.get("readyForTask") and (s.get("gait") or {}).get("phase") == "completed" else None)(state(driver)),
            30,
            "直线行走没有稳定完成",
            0.12,
        )
        item = capture(driver, root / "05-walk-completed-side.png", completed)
        item["label"] = "05｜行走完成与双脚稳定（侧面）"
        report["captures"].append(item)

        set_view(driver, "front", False)
        reset(driver)
        turn_before = command(driver, "向左转90度")
        turn = wait(
            lambda: (lambda s: s if (s.get("gait") or {}).get("turnOutsideFoot") == "left" and (s.get("locomotion") or {}).get("state") not in (None, "idle") else None)(state(driver)),
            18,
            "没有观察到左转外侧脚优先",
            0.04,
        )
        item = capture(driver, root / "06-turn-outside-foot-front.png", turn)
        item["label"] = "06｜左转 90° 外侧脚优先（正面）"
        report["captures"].append(item)
        turn_done = wait(
            lambda: (lambda s: s if done_count(s) > turn_before and s.get("readyForTask") else None)(state(driver)),
            38,
            "原地转身没有稳定完成",
            0.12,
        )
        item = capture(driver, root / "07-turn-completed-front.png", turn_done)
        item["label"] = "07｜转身完成（正面）"
        report["captures"].append(item)

        gait = completed.get("gait") or {}
        checks = {
            "browserRuntimeExecuted": True,
            "startPreparationObserved": (prep.get("gait") or {}).get("maximumPoseOffsetM", 0) >= 0.006,
            "maximumPelvisPoseShiftM": (prep.get("gait") or {}).get("maximumPoseOffsetM"),
            "firstSwingRootTravelM": gait.get("firstSwingRootTravelM"),
            "firstFootReleasedBefore65mm": isinstance(gait.get("firstSwingRootTravelM"), (int, float)) and gait["firstSwingRootTravelM"] < 0.065,
            "minimumTerminalScale": gait.get("minimumObservedTerminalScale"),
            "terminalStepShortened": isinstance(gait.get("minimumObservedTerminalScale"), (int, float)) and 0.279 <= gait["minimumObservedTerminalScale"] < 0.8,
            "walkCompleted": completed.get("readyForTask") is True and gait.get("phase") == "completed",
            "turnOutsideFoot": (turn.get("gait") or {}).get("turnOutsideFoot"),
            "turnOutsideFootVerified": (turn.get("gait") or {}).get("turnOutsideFoot") == "left",
            "turnCompleted": turn_done.get("readyForTask") is True,
            "skinApproval": False,
            "fullDynamics": False,
            "visualAcceptance": False,
        }
        report["checks"] = checks
        required = (
            checks["startPreparationObserved"],
            checks["firstFootReleasedBefore65mm"],
            checks["terminalStepShortened"],
            checks["walkCompleted"],
            checks["turnOutsideFootVerified"],
            checks["turnCompleted"],
        )
        report["status"] = "CAPTURED" if all(required) else "CAPTURED_WITH_FAILURES"
        report["contactSheet"] = contact_sheet(root, report["captures"])
        report["finishedAt"] = now()
        write_html(root, report)
        (root / "browser-run-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        return 0 if all(required) else 2
    except Exception as exc:
        report["runnerError"] = {"type": type(exc).__name__, "message": str(exc)}
        report["finishedAt"] = now()
        if driver:
            try:
                driver.switch_to.default_content()
                driver.save_screenshot(str(root / "failure-window.png"))
                report["failureState"] = state(driver)
                report["browserLogs"] = driver.get_log("browser")
            except Exception as diagnostic:
                report["diagnosticError"] = f"{type(diagnostic).__name__}: {diagnostic}"
        (root / "browser-run-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        return 1
    finally:
        if driver:
            try:
                driver.quit()
            except Exception:
                pass


if __name__ == "__main__":
    raise SystemExit(main())
