#!/usr/bin/env python3
"""Deterministic real-Chrome hand-action evidence for Humanoid Rig Lab Next.

The exact generated workbench runs in Chrome. HumanLab is stepped explicitly,
so screenshots represent the real task/motion/IK runtime rather than a drawn
mock-up. The visualTest surface is a lightweight motion-review fallback and is
not skin approval, full dynamics proof, or proof of temporal naturalness from
one still frame.
"""
from __future__ import annotations

import argparse
import contextlib
import json
import math
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from PIL import Image, ImageDraw, ImageFont
from selenium import webdriver
from selenium.webdriver.common.by import By


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def driver_new() -> webdriver.Chrome:
    options = webdriver.ChromeOptions()
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
        binary = shutil.which(name)
        if binary:
            options.binary_location = binary
            break
    for arg in (
        "--window-size=1720,980", "--window-position=0,0", "--no-sandbox",
        "--disable-dev-shm-usage", "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
        "--enable-webgl", "--ignore-gpu-blocklist", "--use-gl=angle",
        "--use-angle=swiftshader-webgl", "--enable-unsafe-swiftshader",
        "--force-device-scale-factor=1", "--lang=zh-CN",
    ):
        options.add_argument(arg)
    options.set_capability("goog:loggingPrefs", {"browser": "ALL"})
    driver = webdriver.Chrome(options=options)
    driver.set_window_size(1720, 980)
    driver.set_page_load_timeout(120)
    return driver


def wait_until(fn: Callable[[], Any], timeout: float, message: str, delay: float = .1) -> Any:
    end = time.time() + timeout
    last: Any = None
    while time.time() < end:
        try:
            last = fn()
            if last:
                return last
        except Exception as exc:
            last = f"{type(exc).__name__}: {exc}"
        time.sleep(delay)
    raise TimeoutError(f"{message}; last={last!r}")


def body_window(driver: webdriver.Chrome) -> str:
    driver.switch_to.default_content()
    frames = driver.find_elements(By.ID, "bodyFrame")
    if frames:
        driver.switch_to.frame(frames[0])
        return "iframe"
    if driver.find_elements(By.ID, "view"):
        return "direct"
    raise RuntimeError("未找到人物运行画布")


def body_js(driver: webdriver.Chrome, script: str, *args: Any) -> Any:
    body_window(driver)
    try:
        return driver.execute_script(script, *args)
    finally:
        driver.switch_to.default_content()


def load(driver: webdriver.Chrome, url: str) -> dict[str, Any]:
    driver.get(url)
    wait_until(lambda: driver.execute_script("return document.readyState==='complete'"), 60, "页面未完成加载")

    def ready() -> dict[str, Any] | None:
        value = driver.execute_script(
            """
            const f=document.querySelector('#bodyFrame');const w=f?.contentWindow||window;
            const lab=w.HumanLab,canvas=w.document?.querySelector('#view'),gl=canvas?.getContext?.('webgl2');
            return {ready:!!lab?.agent&&!!lab?.renderer&&!!canvas&&canvas.width>500&&!!gl&&!gl.isContextLost(),
              startup:w.__humanStartup||null,startupError:w.__startupError||null,
              population:lab?.population?.list?.().length||0,canvas:[canvas?.width||0,canvas?.height||0]};
            """
        )
        if value.get("startupError"):
            raise RuntimeError(value["startupError"])
        return value if value.get("ready") else None

    state = wait_until(ready, 210, "人物运行时未完成首帧", .2)
    body_js(driver, "HumanLab.setAuto(false);HumanLab.inspectBody('front');HumanLab.render();")
    return state


def compact_state(driver: webdriver.Chrome) -> dict[str, Any]:
    result = body_js(
        driver,
        """
        const lab=HumanLab,a=lab.agent,r=lab.renderer;
        const joint=id=>{const j=lab.human.byId?.get?.(id);if(!j)return null;const s=r.screen(j.world.p);return{world:[...j.world.p],screen:s&&Number.isFinite(s.x)&&Number.isFinite(s.y)?{x:s.x,y:s.y,visible:!!s.visible}:null};};
        const object=id=>{const o=lab.world.get?.(id)||lab.world.objects?.find?.(v=>v.id===id);if(!o)return null;const s=r.screen(o.p);return{world:[...o.p],screen:s&&Number.isFinite(s.x)&&Number.isFinite(s.y)?{x:s.x,y:s.y,visible:!!s.visible}:null};};
        let pose=null,locomotion=null,activity=null;
        try{pose=lab.human.motionDriver?.report?.()||null}catch(error){pose={error:String(error)}}
        try{locomotion=a.locomotion?.report?.()||null}catch(error){locomotion={error:String(error)}}
        try{activity=a.activity?.()||null}catch(error){activity={error:String(error)}}
        return {phase:a.phase,phaseT:Number(a.phaseT||0),phaseWallT:Number(a.phaseWallT||0),error:a.error||null,
          completed:Number(a.stats?.completed||0),failed:Number(a.stats?.failed||0),readyForTask:activity?.readyForTask===true,
          posture:a.basic?.posture||null,held:a.held?.id||null,skill:a.skill?{type:a.skill.type,objectId:a.skill.objectId,targetId:a.skill.targetId}:null,
          pose,locomotion,canvas:{width:r.canvas.width,height:r.canvas.height,clientWidth:r.canvas.clientWidth,clientHeight:r.canvas.clientHeight},
          points:{head:joint('head'),hips:joint('hips'),leftUpperArm:joint('left_upperArm'),leftForearm:joint('left_forearm'),leftHand:joint('left_hand'),rightUpperArm:joint('right_upperArm'),rightForearm:joint('right_forearm'),rightHand:joint('right_hand'),A:object('A'),B:object('B')}};
        """
    )
    return result


def inspect(driver: webdriver.Chrome, view: str, follow: bool = False) -> None:
    body_js(
        driver,
        """
        HumanLab.setAuto(false);HumanLab.inspectBody(arguments[0]);
        const follow=document.getElementById('follow');if(follow&&follow.checked!==arguments[1])follow.click();
        HumanLab.render();
        """, view, follow,
    )


def issue(driver: webdriver.Chrome, text: str) -> dict[str, Any]:
    return body_js(
        driver,
        """
        HumanLab.setAuto(false);const a=HumanLab.agent,before=a.stats.completed;
        const result=HumanLab.command(String(arguments[0]));HumanLab.render();
        return{before,result,phase:a.phase,error:a.error||null};
        """, text,
    )


def advance_once(driver: webdriver.Chrome, dt: float = .04) -> dict[str, Any]:
    return body_js(
        driver,
        """
        HumanLab.setAuto(false);HumanLab.advance(arguments[0]);HumanLab.render();
        const a=HumanLab.agent,activity=a.activity();let pose=null;try{pose=HumanLab.human.motionDriver?.report?.()||null}catch(error){pose={error:String(error)}}
        return{phase:a.phase,phaseT:Number(a.phaseT||0),error:a.error||null,completed:Number(a.stats?.completed||0),failed:Number(a.stats?.failed||0),readyForTask:activity.readyForTask===true,posture:a.basic?.posture||null,held:a.held?.id||null,pose};
        """, dt,
    )


def advance_until(driver: webdriver.Chrome, predicate: Callable[[dict[str, Any]], bool], max_steps: int, label: str, dt: float = .04) -> dict[str, Any]:
    last: dict[str, Any] = {}
    for _ in range(max_steps):
        last = advance_once(driver, dt)
        if last.get("error"):
            return last
        if predicate(last):
            return last
        time.sleep(.004)
    raise TimeoutError(f"{label}未到达；最后状态={last}")


def finish(driver: webdriver.Chrome, before: int, label: str, max_steps: int = 1200) -> dict[str, Any]:
    return advance_until(driver, lambda s: s.get("completed", 0) > before and s.get("readyForTask"), max_steps, label)


def font(size: int) -> ImageFont.ImageFont:
    for path in (
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()


def title_bar(image: Image.Image, title: str, subtitle: str) -> Image.Image:
    h = 78
    out = Image.new("RGB", (image.width, image.height + h), "#10161d")
    out.paste(image.convert("RGB"), (0, h))
    draw = ImageDraw.Draw(out)
    draw.text((18, 8), title, fill="#f1f5f7", font=font(26))
    draw.text((18, 43), subtitle, fill="#aac3ce", font=font(15))
    return out


def xy(state: dict[str, Any], name: str) -> tuple[float, float] | None:
    screen = (state.get("points", {}).get(name) or {}).get("screen") or {}
    if screen.get("visible") and math.isfinite(screen.get("x", math.nan)) and math.isfinite(screen.get("y", math.nan)):
        return float(screen["x"]), float(screen["y"])
    return None


def capture(driver: webdriver.Chrome, out_dir: Path, stem: str, label: str, names: list[str], subtitle: str, completed: bool = True, error: str | None = None) -> dict[str, Any]:
    state = compact_state(driver)
    out_dir.mkdir(parents=True, exist_ok=True)
    raw = out_dir / f"{stem}--raw.png"
    body_window(driver)
    driver.find_element(By.ID, "view").screenshot(str(raw))
    driver.switch_to.default_content()
    image = Image.open(raw).convert("RGB")
    c = state.get("canvas", {})
    sx = image.width / max(1, float(c.get("clientWidth") or image.width))
    sy = image.height / max(1, float(c.get("clientHeight") or image.height))
    pts = [(p[0] * sx, p[1] * sy) for n in names if (p := xy(state, n))]
    if pts:
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        mx, my = 180, 170
        box = [max(0, int(min(xs) - mx)), max(0, int(min(ys) - my)), min(image.width, int(max(xs) + mx)), min(image.height, int(max(ys) + my))]
        if box[2] - box[0] < 460:
            cx = (box[0] + box[2]) // 2; box[0] = max(0, cx - 230); box[2] = min(image.width, cx + 230)
        if box[3] - box[1] < 390:
            cy = (box[1] + box[3]) // 2; box[1] = max(0, cy - 195); box[3] = min(image.height, cy + 195)
        close = image.crop(tuple(box))
    else:
        w, h = image.size; close = image.crop((int(w * .18), int(h * .06), int(w * .82), int(h * .9)))
    status = subtitle if completed else f"未完成｜{error or subtitle}"
    full_img = title_bar(image, label, status)
    hand_img = title_bar(close, label + "｜手部近景", status)
    full = out_dir / f"{stem}--full.png"; hand = out_dir / f"{stem}--hand.png"
    full_img.save(full); hand_img.save(hand)
    image.close(); close.close(); full_img.close(); hand_img.close()
    return {"id": stem, "label": label, "subtitle": status, "completed": completed, "error": error, "full": full.name, "hand": hand.name, "raw": raw.name, "state": state, "capturedAt": now()}


def sheet(out_dir: Path, captures: list[dict[str, Any]]) -> str:
    cards = []
    for item in captures:
        with Image.open(out_dir / item["hand"]) as src:
            im = src.convert("RGB"); im.thumbnail((760, 500))
            card = Image.new("RGB", (800, 550), "#111820")
            card.paste(im, ((800 - im.width) // 2, 15))
            draw = ImageDraw.Draw(card)
            draw.text((18, 516), "完成抓取" if item["completed"] else "真实阻断/失败证据", fill="#b9d8cc" if item["completed"] else "#f0b7a8", font=font(18))
            cards.append(card)
    rows = max(1, (len(cards) + 1) // 2)
    result = Image.new("RGB", (1600, rows * 550), "#0b1016")
    for i, card in enumerate(cards):
        result.paste(card, ((i % 2) * 800, (i // 2) * 550))
    path = out_dir / "hand-actions-contact-sheet.jpg"
    result.save(path, quality=93)
    return path.name


def review(out_dir: Path, report: dict[str, Any]) -> None:
    cards = []
    for item in report["captures"]:
        cards.append(f"<article><h2>{item['label']}</h2><p>{item['subtitle']}</p><img src='{item['hand']}'><details><summary>全画面</summary><img src='{item['full']}'></details></article>")
    html = f"""<!doctype html><html lang='zh-CN'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>人物手部动作测试</title><style>body{{margin:0;background:#0b1016;color:#e8eef0;font:15px/1.55 system-ui;padding:24px}}a{{color:#8bc9ff}}section,article{{background:#151d25;border:1px solid #2c3945;border-radius:14px;padding:18px;margin-bottom:20px}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(430px,1fr));gap:20px}}img{{max-width:100%;height:auto;background:#05080b}}</style></head><body><h1>人物动作收敛｜手部动作真实浏览器测试</h1><section><p>源提交：<code>{report['sourceSHA']}</code></p><p>状态：<strong>{report['status']}</strong></p><p>静帧只证明抓取时刻的三维运行姿态，不等于时间连续性、表皮质量或完整动力学通过。</p><p><a href='{report['interactiveURL']}'>打开精确提交三维工作台</a></p><img src='{report['contactSheet']}'></section><div class='grid'>{''.join(cards)}</div></body></html>"""
    (out_dir / "visual-review.html").write_text(html, encoding="utf-8")


def main() -> int:
    p = argparse.ArgumentParser(); p.add_argument("--url", required=True); p.add_argument("--source-sha", required=True); p.add_argument("--interactive-url", required=True); p.add_argument("--output", default="hand-proof"); args = p.parse_args()
    out_dir = Path(args.output).resolve(); out_dir.mkdir(parents=True, exist_ok=True)
    report: dict[str, Any] = {"schema": "human/motion_hand_browser_proof@2", "sourceSHA": args.source_sha, "testedURL": args.url, "interactiveURL": args.interactive_url, "startedAt": now(), "status": "INCONCLUSIVE", "captures": [], "scenarioFailures": [], "surfaceReviewScope": "motion-preview-lightweight-fallback", "skinApproval": False, "fullDynamics": False, "visualAcceptance": False, "userVisualAcceptance": "pending"}
    driver: webdriver.Chrome | None = None
    try:
        driver = driver_new(); report["startup"] = load(driver, args.url)

        for stem, label, command, phase, min_t, names in (
            ("01-wave", "挥手", "挥手", "wave", .45, ["rightUpperArm", "rightForearm", "rightHand", "head"]),
            ("02-salute", "敬礼", "敬礼", "salute", .35, ["rightUpperArm", "rightForearm", "rightHand", "head"]),
            ("03-greet", "打招呼", "打招呼", "greet", .35, ["rightUpperArm", "rightForearm", "rightHand", "leftHand", "head"]),
        ):
            try:
                inspect(driver, "front", False); start = issue(driver, command); before = int(start["before"])
                advance_until(driver, lambda s, ph=phase, t=min_t: s.get("phase") == ph and float(s.get("phaseT") or 0) >= t, 450, label)
                report["captures"].append(capture(driver, out_dir, stem, label, names, "动作中段｜固定正面镜头"))
                finish(driver, before, label)
            except Exception as exc:
                report["scenarioFailures"].append(stem)
                report["captures"].append(capture(driver, out_dir, stem, label, names, "", False, f"{type(exc).__name__}: {exc}"))

        try:
            inspect(driver, "side", False); sit = issue(driver, "坐下"); finish(driver, int(sit["before"]), "坐下")
            stand = issue(driver, "起身")
            advance_until(driver, lambda s: s.get("phase") in {"standPrepare", "standUp"} and (((s.get("pose") or {}).get("floorSupport") or {}).get("active") or float(s.get("phaseT") or 0) >= .35), 700, "坐起撑地")
            report["captures"].append(capture(driver, out_dir, "04-floor-palm-support", "坐起撑地", ["rightUpperArm", "rightForearm", "rightHand", "hips"], "手掌—前臂—骨盆支撑转换候选"))
            finish(driver, int(stand["before"]), "起身")
        except Exception as exc:
            report["scenarioFailures"].append("04-floor-palm-support")
            report["captures"].append(capture(driver, out_dir, "04-floor-palm-support", "坐起撑地", ["rightForearm", "rightHand", "hips"], "", False, f"{type(exc).__name__}: {exc}"))

        try:
            inspect(driver, "side", True); issue(driver, "把A搬到一区")
            advance_until(driver, lambda s: s.get("phase") == "reach" and float(s.get("phaseT") or 0) >= .55, 2000, "搬箱前伸")
            report["captures"].append(capture(driver, out_dir, "05-reach-box", "前伸抓取", ["leftUpperArm", "leftForearm", "leftHand", "rightUpperArm", "rightForearm", "rightHand", "A"], "搬箱流程｜双掌接近箱边"))
            support = advance_until(driver, lambda s: s.get("phase") in {"boxPickup", "lift", "travel"} or bool(s.get("error")), 2400, "箱底承托")
            if support.get("error"):
                raise RuntimeError(support["error"])
            report["captures"].append(capture(driver, out_dir, "06-box-bottom-support", "箱体底托/换手", ["leftForearm", "leftHand", "rightForearm", "rightHand", "A", "hips"], f"实际阶段：{support.get('phase')}｜未放宽腕关节限制"))
        except Exception as exc:
            report["scenarioFailures"].append("05-06-carry")
            report["captures"].append(capture(driver, out_dir, "06-carry-blocked", "搬箱手部阻断", ["leftHand", "rightHand", "A", "hips"], "", False, f"{type(exc).__name__}: {exc}"))

        report["pushReload"] = load(driver, args.url)
        try:
            inspect(driver, "side", True); issue(driver, "把B推到二区")
            push = advance_until(driver, lambda s: s.get("phase") == "pushTravel" and float(s.get("phaseT") or 0) >= .2, 2600, "双掌推动")
            report["captures"].append(capture(driver, out_dir, "07-push-two-palms", "双掌推动", ["leftUpperArm", "leftForearm", "leftHand", "rightUpperArm", "rightForearm", "rightHand", "B"], f"实际阶段：{push.get('phase')}｜双掌接触与身体支撑"))
        except Exception as exc:
            report["scenarioFailures"].append("07-push-two-palms")
            report["captures"].append(capture(driver, out_dir, "07-push-two-palms", "双掌推动", ["leftHand", "rightHand", "B", "hips"], "", False, f"{type(exc).__name__}: {exc}"))

        report["contactSheet"] = sheet(out_dir, report["captures"])
        report["status"] = "CAPTURED_WITH_FAILURES" if report["scenarioFailures"] else "CAPTURED"
        report["finishedAt"] = now(); review(out_dir, report)
        (out_dir / "browser-run-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        (out_dir / "browser-console.json").write_text(json.dumps(driver.get_log("browser"), ensure_ascii=False, indent=2), encoding="utf-8")
        return 0
    except Exception as exc:
        report["runnerError"] = {"type": type(exc).__name__, "message": str(exc)}; report["finishedAt"] = now()
        (out_dir / "browser-run-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        if driver:
            with contextlib.suppress(Exception):
                driver.save_screenshot(str(out_dir / "runner-failure-window.png"))
        return 1
    finally:
        if driver:
            with contextlib.suppress(Exception):
                driver.quit()


if __name__ == "__main__":
    raise SystemExit(main())
