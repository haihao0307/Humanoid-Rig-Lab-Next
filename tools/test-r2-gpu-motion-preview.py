#!/usr/bin/env python3
import argparse
import json
import time
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

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
    options.add_argument("--allow-file-access-from-files")
    options.add_argument("--window-size=1680,1050")
    options.set_capability("goog:loggingPrefs", {"browser": "ALL"})

    driver = webdriver.Chrome(options=options)
    report = {
        "html": str(html_path),
        "environment": "headless Chrome / SwiftShader",
        "performanceRepresentative": False,
        "status": "running",
        "actions": [],
        "browserErrors": []
    }
    try:
        driver.get(html_path.as_uri())
        wait = WebDriverWait(driver, 240)
        wait.until(lambda d: d.execute_script(
            "return window.__R2PreviewStatus && "
            "(window.__R2PreviewStatus.state === 'ready' || window.__R2PreviewStatus.state === 'error')"
        ))
        status = driver.execute_script("return window.__R2PreviewStatus")
        report["initialStatus"] = status
        if status.get("state") != "ready":
            raise RuntimeError("R2 standalone startup failed: " + str(status.get("error")))
        if status.get("patch") != "patched":
            raise RuntimeError("Standalone Worker/asset patch did not complete.")

        for action in ["wave", "sit", "stand", "salute"]:
            button = driver.find_element(By.CSS_SELECTOR, '[data-action="' + action + '"]')
            button.click()
            wait.until(lambda d, expected=action: d.execute_script(
                "return window.__R2PreviewStatus && "
                "window.__R2PreviewStatus.lastAction === arguments[0] && "
                "window.__R2PreviewStatus.lastActionState !== 'submitting'",
                expected
            ))
            action_status = driver.execute_script("return window.__R2PreviewStatus")
            if action_status.get("lastActionState") == "error":
                raise RuntimeError("Action command failed: " + action + " / " + str(action_status.get("lastActionError")))
            report["actions"].append({
                "id": action,
                "state": action_status.get("lastActionState"),
                "result": action_status.get("lastActionResult")
            })
            time.sleep(1.0)
            if driver.execute_script("return window.__R2PreviewStatus.state") != "ready":
                raise RuntimeError("R2 runtime left ready state after action: " + action)

        report["metrics"] = driver.execute_script("return window.__R2PreviewStatus.metrics")
        report["finalStatus"] = driver.execute_script("return window.__R2PreviewStatus")
        report["status"] = "passed"
    except Exception as error:
        report["status"] = "failed"
        report["error"] = str(error)
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
