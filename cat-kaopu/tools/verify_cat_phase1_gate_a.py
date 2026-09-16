from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "cat-kaopu/workbench/CAT_KAOPU_CURRENT.html"
PHASE1 = ROOT / "cat-kaopu/phase1"
WORKBENCH = PHASE1 / "CAT_KAOPU_PHASE1_GATE_A_SINGLE_NPC_2026-09-16.html"
INDEX = PHASE1 / "index.html"
CONTRACT = PHASE1 / "PHASE1_NPC_CONTRACT.json"
MANIFEST = PHASE1 / "PHASE1_GATE_A_MANIFEST.json"
REPORT = ROOT / "cat-kaopu/docs/CAT_KAOPU_PHASE1_GATE_A_EXECUTION_REPORT_2026-09-16.md"
BROWSER_QA = ROOT / "cat-kaopu/qa/CAT_KAOPU_PHASE1_GATE_A_BROWSER_QA_2026-09-16.json"
BUILD_ID = "cat-kaopu-phase1-gate-a-single-npc-20260916"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"Phase 1 Gate A verification failed: {message}")


def load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        raise SystemExit(f"unable to parse {path.relative_to(ROOT)}: {exc}") from exc


parser = argparse.ArgumentParser()
parser.add_argument("--require-browser", action="store_true")
args = parser.parse_args()

for path in (SOURCE, WORKBENCH, INDEX, CONTRACT, MANIFEST, REPORT):
    require(path.is_file(), f"missing {path.relative_to(ROOT)}")

html = WORKBENCH.read_text(encoding="utf-8")
index_html = INDEX.read_text(encoding="utf-8")
contract = load_json(CONTRACT)
manifest = load_json(MANIFEST)

require(html == index_html, "phase1 index is not byte-identical to the fixed workbench")
require("CAT KAOPU Phase 1 Gate A · 单体环境 NPC" in html, "phase1 page title missing")
require("Phase 1 · Gate A 单体基础" in html, "phase1 gate panel missing")
require("PHASE1_COLLISION_PROFILE" in html, "collision profile missing")
require("applyPhase1Collision" in html and "finalizePhase1Collision" in html, "collision solve stages missing")
require("drawPhase1Collision" in html, "collision visualization missing")
require("__CAT_PHASE1_READY__" in html, "phase1 ready flag missing")
require("__CAT_PHASE1_GET_STATE__" in html, "phase1 state API missing")
require("__CAT_PHASE1_SET_OBSTACLE__" in html, "phase1 obstacle API missing")
require("groupRuntime:false" in html and "variationRuntime:false" in html, "group/variation gates are not locked")
require("blinkLayerEnabled=false" in html, "secondary eye-region carrier must be disabled in the Phase 1 default")
require("secondaryFaceCarrierDefault:false" in html, "secondary presentation boundary missing")
require("fullMeshCollision" not in html, "full-mesh collision leaked into browser runtime")

require(contract.get("schema") == "cat_kaopu/environment_npc_phase1_contract@1.0", "contract schema mismatch")
require(contract.get("buildId") == BUILD_ID, "contract build id mismatch")
require(contract.get("singleNpcGate", {}).get("status") == "active", "single NPC gate not active")
require(contract.get("singleNpcGate", {}).get("requiredViews") == ["front", "left", "top", "quarter"], "view gate mismatch")
require(contract.get("singleNpcGate", {}).get("requiredActions") == ["stand", "walk_forward", "turn_left", "turn_right"], "action gate mismatch")
require(contract.get("collision", {}).get("proxies") == ["pelvis", "chest", "head"], "collision proxy contract mismatch")
require(contract.get("collision", {}).get("fullMeshCollision") is False, "full mesh collision must remain disabled")
require(contract.get("deferred", {}).get("groupRuntime") is False, "group runtime prematurely enabled")
require(contract.get("deferred", {}).get("variationRuntime") is False, "variation runtime prematurely enabled")
require(contract.get("deferred", {}).get("localAvoidance") is False, "avoidance prematurely enabled")
require(contract.get("productionReady") is False, "phase1 gate must not claim production readiness")

require(manifest.get("schema") == "cat_kaopu/phase1_gate_build@1.0", "manifest schema mismatch")
require(manifest.get("buildId") == BUILD_ID, "manifest build id mismatch")
require(manifest.get("sourceSha256") == sha256(SOURCE), "source hash mismatch")
require(manifest.get("technicalReady") is True, "technical-ready flag missing")
require(manifest.get("secondaryFaceCarrierDefault") is False, "secondary face carrier default mismatch")
require(manifest.get("wholeBodySilhouetteUnobstructed") is True, "whole-body silhouette guard missing")
require(manifest.get("visualAcceptance") is False, "visual acceptance must remain false")
require(manifest.get("productionReady") is False, "production readiness must remain false")

outputs = {entry["path"]: entry for entry in manifest.get("outputs", [])}
for path in (WORKBENCH, INDEX, CONTRACT, REPORT):
    rel = str(path.relative_to(ROOT))
    require(rel in outputs, f"manifest omits {rel}")
    require(outputs[rel].get("bytes") == path.stat().st_size, f"byte count mismatch for {rel}")
    require(outputs[rel].get("sha256") == sha256(path), f"hash mismatch for {rel}")

if args.require_browser:
    require(BROWSER_QA.is_file(), f"missing {BROWSER_QA.relative_to(ROOT)}")
    browser = load_json(BROWSER_QA)
    require(browser.get("schema") == "cat_kaopu/phase1_gate_a_browser_qa@1.0", "browser QA schema mismatch")
    require(browser.get("buildId") == BUILD_ID, "browser QA build id mismatch")
    require(browser.get("ready") == "gate-a-webgl2", "browser did not enter Gate A WebGL2 mode")
    require(not browser.get("pageErrors"), f"page errors: {browser.get('pageErrors')}")
    require(not browser.get("consoleErrors"), f"console errors: {browser.get('consoleErrors')}")
    failed = [key for key, value in browser.get("assertions", {}).items() if value is not True]
    require(not failed, f"browser assertions failed: {failed}")
    stand_front = browser.get("samples", {}).get("standFront", {})
    expression = stand_front.get("metrics", {}).get("expression", {})
    presentation = browser.get("audit", {}).get("presentation", {})
    require(expression.get("blinkLayerEnabled") is False, "secondary carrier rendered in whole-body browser evidence")
    require(presentation.get("secondaryFaceCarrierDefault") is False, "browser audit presentation boundary missing")
    require(browser.get("visualAcceptance") is False, "browser QA must not claim visual acceptance")
    require(browser.get("productionReady") is False, "browser QA must not claim production readiness")

print(
    json.dumps(
        {
            "buildId": BUILD_ID,
            "workbenchBytes": WORKBENCH.stat().st_size,
            "sourceSha256": sha256(SOURCE),
            "browserVerified": args.require_browser,
            "secondaryFaceCarrierDefault": False,
            "productionReady": False,
        },
        ensure_ascii=False,
        indent=2,
    )
)
