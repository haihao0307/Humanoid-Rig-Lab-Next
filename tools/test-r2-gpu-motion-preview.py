#!/usr/bin/env python3
import argparse
import json
import time
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.common.exceptions import TimeoutException

def snapshot(driver):
    return driver.execute_script("""
      const frame=document.querySelector('#app-frame');
      const app=frame?.contentWindow,doc=frame?.contentDocument;
      const bodyFrame=doc?.getElementById('bodyFrame'),body=bodyFrame?.contentWindow;
      const lab=body?.HumanLab,api=app?.JarvisEmbodimentLab;
      const actors=lab?.population?[...lab.population.values()]:null;
      return {
        preview:window.__R2PreviewStatus||null,
        apiReady:api?.ready??null,
        bodyReady:api?.state?.bodyReady??null,
        brainReady:api?.state?.brainReady??null,
        startupFailure:api?.state?.startupFailure??null,
        bodyStartup:body?.__humanStartup??null,
        populationCount:actors?.length??null,
        actorLabels:actors?.map(actor=>actor.label)??null,
        renderer:lab?.renderer?{frames:lab.renderer.frames,drawCalls:lab.renderer.drawCalls,triangles:lab.renderer.count}:null,
        diagnostic:doc?.querySelector('#bodyStartupDiagnostics pre')?.textContent||null
      };
    """)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--html", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    html_path = Path(args.html).resolve()
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)

    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--enable-webgl")
    options.add_argument("--ignore-gpu-blocklist")
    options.add_argument("--use-gl=angle")
    options.add_argument("--use-angle=swiftshader")
    options.add_argument("--enable-unsafe-swiftshader")
    options.add_argument("--disable-background-timer-throttling")
    options.add_argument("--disable-renderer-backgrounding")
    options.add_argument("--allow-file-access-from-files")
    options.add_argument("--window-size=1680,1050")
    options.set_capability("goog:loggingPrefs", {"browser": "ALL"})

    driver = webdriver.Chrome(options=options)
    report = {
        "html": str(html_path),
        "environment": "headless Chrome / SwiftShader",
        "performanceRepresentative": False,
        "previewMode": "single actor; hair retained; comparison NPCs skipped",
        "status": "running",
        "actions": [],
        "browserErrors": []
    }
    try:
        driver.get(html_path.as_uri())
        wait = WebDriverWait(driver, 240, poll_frequency=0.5)
        try:
            wait.until(lambda d: (
                (lambda s: s["preview"] and s["preview"].get("state") in ("ready", "error"))(snapshot(d))
            ))
        except TimeoutException:
            report["timeoutSnapshot"] = snapshot(driver)
            raise RuntimeError("Timed out waiting for R2 readiness: " + json.dumps(report["timeoutSnapshot"], ensure_ascii=False))

        initial = snapshot(driver)
        report["initialStatus"] = initial
        preview = initial.get("preview") or {}
        if preview.get("state") != "ready":
            raise RuntimeError("R2 standalone startup failed: " + str(preview.get("error") or initial.get("startupFailure")))
        if preview.get("patch") != "patched":
            raise RuntimeError("Standalone Worker/asset patch did not complete.")
        if initial.get("populationCount") != 1:
            raise RuntimeError("Single-actor preview expected exactly one population actor: " + str(initial.get("populationCount")))
        if not initial.get("bodyReady") or not initial.get("brainReady"):
            raise RuntimeError("Formal R2 brain/body binding is not ready.")
        if not initial.get("renderer") or initial["renderer"].get("frames", 0) < 1:
            raise RuntimeError("Formal R2 renderer has not produced a frame.")

        driver.save_screenshot(str(output / "r2-ready.png"))
        for action in ["wave", "sit", "stand", "salute"]:
            button = driver.find_element(By.CSS_SELECTOR, '[data-action="' + action + '"]')
            driver.execute_script("arguments[0].click()", button)
            wait.until(lambda d, expected=action: d.execute_script(
                "return window.__R2PreviewStatus && "
                "window.__R2PreviewStatus.lastAction === arguments[0] && "
                "window.__R2PreviewStatus.lastActionState !== 'submitting'",
                expected
            ))
            action_status = driver.execute_script("return window.__R2PreviewStatus")
            result = action_status.get("lastActionResult") or {}
            if action_status.get("lastActionState") != "dispatched" or not result.get("taskId"):
                raise RuntimeError("Action was not dispatched: " + action + " / " + json.dumps(action_status, ensure_ascii=False))
            task_id = result["taskId"]
            wait.until(lambda d, tid=task_id: d.execute_script("""
              const app=document.querySelector('#app-frame')?.contentWindow;
              const tasks=app?.JarvisEmbodimentLab?.language?.state?.tasks||[];
              const task=tasks.find(item=>item.id===arguments[0]);
              return task && ['completed','failed','cancelled','failed_replanned'].includes(task.status)
                ? {status:task.status,finished:task.finished,total:task.plan?.nodes?.length||0,error:task.error||null}
                : false;
            """, tid))
            task_result = driver.execute_script("""
              const app=document.querySelector('#app-frame')?.contentWindow;
              const tasks=app?.JarvisEmbodimentLab?.language?.state?.tasks||[];
              const task=tasks.find(item=>item.id===arguments[0]);
              return task?{status:task.status,finished:task.finished,total:task.plan?.nodes?.length||0,error:task.error||null}:null;
            """, task_id)
            report["actions"].append({"id":action,"taskId":task_id,"task":task_result})
            if not task_result or task_result["status"] != "completed":
                raise RuntimeError("R2 action did not complete: " + action + " / " + json.dumps(task_result, ensure_ascii=False))
            driver.save_screenshot(str(output / (action + "-completed.png")))
            time.sleep(0.5)

        report["metrics"] = driver.execute_script("return window.__R2PreviewStatus.metrics")
        report["finalStatus"] = snapshot(driver)
        report["status"] = "passed"
    except Exception as error:
        report["status"] = "failed"
        report["error"] = str(error)
        try:
            report["failureSnapshot"] = snapshot(driver)
        except Exception as snapshot_error:
            report["snapshotError"] = str(snapshot_error)
    finally:
        try:
            report["browserErrors"] = [
                item for item in driver.get_log("browser")
                if item.get("level") == "SEVERE"
            ]
            driver.save_screenshot(str(output / "r2-gpu-motion-preview.png"))
        except Exception as error:
            report["screenshotError"] = str(error)
        driver.quit()
        (output / "browser-report.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    if report["status"] != "passed":
        raise SystemExit(1)

if __name__ == "__main__":
    main()
