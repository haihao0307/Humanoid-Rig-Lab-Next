#!/usr/bin/env python3
from __future__ import annotations

import argparse
import contextlib
import dataclasses
import re
import time
from pathlib import Path
from typing import Any

from selenium import webdriver
from selenium.webdriver.common.by import By

from visual_qa_core import body_state, create_driver, fetch_ready_url, parent_state, reset_body, run_preflight, send_command, set_body_view, set_parent_anatomy, start_video, stop_video, utc_now, wait_for_completion
from visual_qa_report import build_review_html, capture_canvas, json_dump, make_contact_sheet, make_crops


@dataclasses.dataclass(frozen=True)
class Step:
    command: str
    sample_after_s: float
    timeout_s: float
    expected_posture: str | None = None


@dataclasses.dataclass(frozen=True)
class Scenario:
    id: str
    title: str
    steps: tuple[Step,...]
    views: tuple[str,...]
    video_view: str | None = None
    follow: bool = False
    note: str = ""


SCENARIOS=(
 Scenario("walk-stop","直线行走并停止",(Step("向前走1米",1.05,36),),("front","side","back"),"side",True),
 Scenario("turn-left-90","原地左转 90°",(Step("向左转90度",.95,34),),("front","side","back"),"front"),
 Scenario("turn-right-180","原地右转 180°",(Step("向右转180度",1.45,46),),("front","side"),"front"),
 Scenario("sit-stand","坐下、稳定坐姿并起身",(Step("坐下",.95,42,"坐"),Step("起身",.90,42,"站")),("front","side","back"),"side"),
 Scenario("wave","挥手",(Step("挥手",.78,28),),("front","side","back"),"front"),
 Scenario("salute","敬礼",(Step("敬礼",.92,30),),("front","side","back"),"front"),
 Scenario("carry-a-zone1","搬运 A 到一区",(Step("把A搬到一区",3.2,95),),("front","side"),"side",True,"物体、手掌和脚部接触共同检查。"),
 Scenario("push-b-zone2","推动 B 到二区",(Step("把B推到二区",3.1,95),),("front","side"),"side",True,"若 B 不允许推动，保留明确失败证据，不伪造完成。"),
)
AB=(
 Scenario("walk-stop-balance-off","A/B：关闭 R25 后直线行走",(Step("向前走1米",1.05,36),),("side",),"side",True),
 Scenario("turn-left-90-balance-off","A/B：关闭 R25 后左转 90°",(Step("向左转90度",.95,34),),("front",),"front"),
)


def capture_baseline(driver: webdriver.Chrome, root: Path, manifest: list[dict[str,Any]]) -> list[dict[str,Any]]:
    reset_body(driver); result=[]
    for anatomy in ("skin","clay","skeleton"):
        set_parent_anatomy(driver,anatomy)
        for view in ("front","side","back"):
            set_body_view(driver,view)
            path=root/"screenshots"/"baseline"/f"baseline--{anatomy}--{view}.png"
            result.append(capture_canvas(driver,path,{"scenario":"baseline","stage":"stable","anatomy":anatomy,"view":view,"state":body_state(driver)},manifest,root))
    set_parent_anatomy(driver,"skin"); return result


def run_scenario(driver: webdriver.Chrome, scenario: Scenario, root: Path, manifest: list[dict[str,Any]], balance: bool) -> dict[str,Any]:
    result={"id":scenario.id,"title":scenario.title,"note":scenario.note,"balanceEnabled":balance,"views":[],"startedAt":utc_now(),"completed":True,"visualAcceptance":False}
    for view in scenario.views:
        reset_body(driver); set_parent_anatomy(driver,"skin"); set_body_view(driver,view,scenario.follow)
        video=None; process=None
        if scenario.video_view==view:
            path=root/"videos"/f"{scenario.id}--{view}.mp4"; process=start_video(path)
            if process: video=path.relative_to(root).as_posix(); time.sleep(.4)
        view_result={"view":view,"steps":[],"video":video,"completed":True}
        try:
            for index,step in enumerate(scenario.steps,1):
                initial,sent=send_command(driver,step.command); time.sleep(step.sample_after_s)
                mid=root/"screenshots"/scenario.id/f"{scenario.id}--{view}--step{index}--mid.png"
                mid_entry=capture_canvas(driver,mid,{"scenario":scenario.id,"stage":f"step{index}-mid","command":step.command,"anatomy":"skin","view":view,"state":body_state(driver)},manifest,root)
                crops=make_crops(mid,manifest,{"scenario":scenario.id,"stage":f"step{index}-mid","command":step.command,"anatomy":"skin","view":view},root)
                completion=wait_for_completion(driver,initial,step.timeout_s,step.expected_posture)
                end=root/"screenshots"/scenario.id/f"{scenario.id}--{view}--step{index}--end.png"
                end_entry=capture_canvas(driver,end,{"scenario":scenario.id,"stage":f"step{index}-end","command":step.command,"anatomy":"skin","view":view,"state":body_state(driver)},manifest,root)
                view_result["steps"].append({"index":index,"command":step.command,"sentAt":sent,"mid":mid_entry,"midCrops":crops,"end":end_entry,"completion":completion})
                if not completion.get("completed"):
                    view_result["completed"]=False; result["completed"]=False; break
        except Exception as exc:
            view_result["completed"]=False; result["completed"]=False; view_result["error"]=f"{type(exc).__name__}: {exc}"
            with contextlib.suppress(Exception):
                path=root/"screenshots"/scenario.id/f"{scenario.id}--{view}--exception.png"
                capture_canvas(driver,path,{"scenario":scenario.id,"stage":"exception","view":view,"state":body_state(driver)},manifest,root)
        finally:
            stop_video(process)
        result["views"].append(view_result)
    result["finishedAt"]=utc_now(); return result


def capture_failure_diagnostics(driver: webdriver.Chrome, root: Path) -> dict[str,Any]:
    diagnostics: dict[str,Any]={"capturedAt":utc_now()}
    with contextlib.suppress(Exception): diagnostics["currentURL"]=driver.current_url
    with contextlib.suppress(Exception): diagnostics["title"]=driver.title
    with contextlib.suppress(Exception): diagnostics["parent"]=parent_state(driver)
    with contextlib.suppress(Exception): diagnostics["body"]=body_state(driver)
    with contextlib.suppress(Exception):
        logs=driver.get_log("browser"); diagnostics["browserLogs"]=logs; json_dump(root/"browser-console-failure.json",logs)
    with contextlib.suppress(Exception):
        driver.switch_to.default_content(); path=root/"preflight-failure-window.png"; driver.save_screenshot(str(path)); diagnostics["windowScreenshot"]=path.relative_to(root).as_posix()
    with contextlib.suppress(Exception):
        driver.switch_to.default_content(); source=driver.page_source; path=root/"preflight-failure-page.html"; path.write_text(source,encoding="utf-8"); diagnostics["pageSource"]=path.relative_to(root).as_posix(); diagnostics["pageSourceBytes"]=len(source.encode("utf-8"))
    with contextlib.suppress(Exception):
        driver.switch_to.default_content(); frame=driver.find_element(By.ID,"bodyFrame"); driver.switch_to.frame(frame)
        canvas=driver.find_element(By.ID,"view"); path=root/"preflight-failure-body-canvas.png"; canvas.screenshot(str(path)); diagnostics["bodyCanvasScreenshot"]=path.relative_to(root).as_posix()
    with contextlib.suppress(Exception): driver.switch_to.default_content()
    return diagnostics


def main() -> int:
    parser=argparse.ArgumentParser(); parser.add_argument("--url",required=True); parser.add_argument("--source-sha",required=True); parser.add_argument("--output",default="visual-review"); parser.add_argument("--skip-ab",action="store_true"); args=parser.parse_args()
    root=Path(args.output).resolve(); root.mkdir(parents=True,exist_ok=True)
    report={"schema":"human/motion_browser_visual_review@1","sourceSHA":args.source_sha,"requestedURL":args.url,"testedURL":args.url,"startedAt":utc_now(),"preflight":{"passed":False,"failures":["not run"]},"baseline":[],"scenarios":[],"visualAcceptance":False,"productionReady":False,"userVisualAcceptance":"pending","sameBrowserContinuousSession":True,"captureMethod":"headed Chrome + Selenium WebDriver under Xvfb; no static substitute"}
    manifest=[]; driver=None; exit_code=0
    try:
        report["httpsFetch"]=fetch_ready_url(args.url); driver=create_driver(); report["preflight"]=run_preflight(driver,args.url,args.source_sha)
        json_dump(root/"browser-console.json",report["preflight"].get("browser",{}).get("logs",[]))
        if not report["preflight"].get("passed"):
            report["status"]="INCONCLUSIVE"; report["browserQA"]="preflight-failed"; return 2
        report["status"]="CAPTURED"; report["browserQA"]="browser-qa-pending-user-review"; report["baseline"]=capture_baseline(driver,root,manifest)
        for scenario in SCENARIOS: report["scenarios"].append(run_scenario(driver,scenario,root,manifest,True))
        if not args.skip_ab:
            off=args.url+("&" if "?" in args.url else "?")+"balanceOff=1"; report["balanceOffURL"]=off; ab_pre=run_preflight(driver,off,args.source_sha); report["balanceOffPreflight"]=ab_pre
            if ab_pre.get("passed"):
                for scenario in AB: report["scenarios"].append(run_scenario(driver,scenario,root,manifest,False))
            else: report.setdefault("warnings",[]).append("R25 A/B 关闭版预检失败，未生成对照截图。")
        report["contactSheet"]=make_contact_sheet(root,manifest); report["scenarioFailures"]=[s["id"] for s in report["scenarios"] if not s.get("completed")]
        if report["scenarioFailures"]: report["status"]="CAPTURED_WITH_FAILURES"
        with contextlib.suppress(Exception):
            logs=driver.get_log("browser"); json_dump(root/"browser-console-post.json",logs); report["postRunSevereConsoleEntries"]=[x for x in logs if x.get("level")=="SEVERE"]
        return exit_code
    except Exception as exc:
        report["status"]="INCONCLUSIVE"; report["browserQA"]="runner-error"; report["runnerError"]={"type":type(exc).__name__,"message":str(exc)}
        if driver:
            report["failureDiagnostics"]=capture_failure_diagnostics(driver,root)
            diagnostic=report["failureDiagnostics"]
            report["preflight"]={"passed":False,"checkedAt":utc_now(),"sourceSHA":args.source_sha,"url":args.url,
              "parent":diagnostic.get("parent"),"body":diagnostic.get("body"),"browser":{"logs":diagnostic.get("browserLogs",[])},
              "failures":[f"{type(exc).__name__}: {exc}"],"warnings":[]}
        return 1
    finally:
        report["finishedAt"]=utc_now(); json_dump(root/"screenshot-manifest.json",manifest); json_dump(root/"browser-run-report.json",report)
        if report.get("preflight",{}).get("passed"): build_review_html(root,report)
        if driver:
            with contextlib.suppress(Exception): driver.quit()


if __name__=="__main__": raise SystemExit(main())
