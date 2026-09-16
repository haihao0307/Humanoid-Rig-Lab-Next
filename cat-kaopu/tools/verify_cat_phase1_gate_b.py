from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "cat-kaopu/phase1/CAT_KAOPU_PHASE1_GATE_A_SINGLE_NPC_2026-09-16.html"
OUT_DIR = ROOT / "cat-kaopu/phase1-gate-b"
WORKBENCH = OUT_DIR / "CAT_KAOPU_PHASE1_GATE_B_MORPHOLOGY_2026-09-16.html"
INDEX = OUT_DIR / "index.html"
PROFILE = OUT_DIR / "PHASE1_MORPHOLOGY_PROFILE.json"
CONTRACT = OUT_DIR / "PHASE1_GATE_B_CONTRACT.json"
MANIFEST = OUT_DIR / "PHASE1_GATE_B_MANIFEST.json"
REPORT = ROOT / "cat-kaopu/docs/CAT_KAOPU_PHASE1_GATE_B_MORPHOLOGY_REPORT_2026-09-16.md"
BROWSER_QA = ROOT / "cat-kaopu/qa/CAT_KAOPU_PHASE1_GATE_B_BROWSER_QA_2026-09-16.json"
BUILD_ID = "cat-kaopu-phase1-gate-b-morphology-20260916"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"Phase 1 Gate B verification failed: {message}")


def load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        raise SystemExit(f"unable to parse {path.relative_to(ROOT)}: {exc}") from exc


def extract(pattern: str, text: str, label: str) -> str:
    match = re.search(pattern, text, re.DOTALL)
    require(match is not None, f"unable to extract {label}")
    return match.group(1)


parser = argparse.ArgumentParser()
parser.add_argument("--require-browser", action="store_true")
args = parser.parse_args()

for path in (SOURCE, WORKBENCH, INDEX, PROFILE, CONTRACT, MANIFEST, REPORT):
    require(path.is_file(), f"missing {path.relative_to(ROOT)}")

source_html = SOURCE.read_text(encoding="utf-8")
html = WORKBENCH.read_text(encoding="utf-8")
index_html = INDEX.read_text(encoding="utf-8")
profile = load_json(PROFILE)
contract = load_json(CONTRACT)
manifest = load_json(MANIFEST)

require(html == index_html, "Gate B index is not byte-identical to the fixed workbench")
require("CAT KAOPU Phase 1 Gate B · 躯干形态修正" in html, "Gate B title missing")
require("Phase 1 · Gate B 躯干形态修正" in html, "Gate B control panel missing")
require("PHASE1_MORPH_DEFAULT" in html, "morphology defaults missing")
require("phase1MorphBindVertex" in html, "CPU morphology path missing")
require("p1morph" in html, "GPU morphology path missing")
require("__CAT_PHASE1_SET_MORPH__" in html, "morphology setter API missing")
require("__CAT_PHASE1_MORPH_AUDIT__" in html, "morphology audit API missing")
require("window.__CAT_PHASE1_READY__='gate-b-webgl2'" in html, "Gate B ready flag missing")
require("blinkLayerEnabled=false" in html, "secondary face carrier must remain disabled by default")
require("groupRuntime:false" in html and "variationRuntime:false" in html, "group or variation runtime leaked into Gate B")
require("shapeMutation:'bounded-bind-space-surface-corrective-layer'" in html, "bounded shape mutation label missing")

source_payload = extract(r"const CAT_B64='([^']+)'", source_html, "Gate A payload")
gate_b_payload = extract(r"const CAT_B64='([^']+)'", html, "Gate B payload")
require(source_payload == gate_b_payload, "CATV440 payload changed")
source_rig = extract(r"const RIG=(.*?);\nconst LIB=", source_html, "Gate A rig")
gate_b_rig = extract(r"const RIG=(.*?);\nconst LIB=", html, "Gate B rig")
require(source_rig == gate_b_rig, "rig hierarchy or bind data changed")
source_collision = extract(
    r"const PHASE1_COLLISION_PROFILE=(\{.*?\});\nlet phase1CollisionEnabled",
    source_html,
    "Gate A collision profile",
)
gate_b_collision = extract(
    r"const PHASE1_COLLISION_PROFILE=(\{.*?\});\nlet phase1CollisionEnabled",
    html,
    "Gate B collision profile",
)
require(source_collision == gate_b_collision, "collision proxy profile changed")

require(profile.get("schema") == "cat_kaopu/bounded_morphology_profile@1.0", "profile schema mismatch")
require(profile.get("buildId") == BUILD_ID, "profile build id mismatch")
require(profile.get("runtimePayload", {}).get("mutation") is False, "runtime payload mutation must remain false")
for key in ("rigHierarchy", "boneLengths", "skinningWeights", "animationTracks", "collisionProfile", "eyeRegionVertices", "bodyLengthAxis", "groundMinimum"):
    require(profile.get("invariants", {}).get(key) is True, f"profile invariant missing: {key}")

measured = profile.get("measuredDefault", {})
require(0.004 <= measured.get("maxDeltaM", 0) <= 0.012, "default maximum displacement outside bounded range")
require(800 <= measured.get("affectedVertices", 0) <= 2500, "affected vertex count outside torso-only range")
require(measured.get("eyeRegionMaxDeltaM") == 0, "eye region changed")
require(abs(measured.get("bodyLengthM", 0) - measured.get("bodyLengthBaseM", 1)) < 1e-9, "body length changed")
require(abs(measured.get("bodyMinZM", 0) - measured.get("bodyMinZBaseM", 1)) < 1e-9, "ground minimum changed")
ratios = measured.get("widthRatios", {})
require(1.05 <= ratios.get("chest", 0) <= 1.12, "thorax ratio outside approved Gate B envelope")
require(0.90 <= ratios.get("waist", 0) <= 0.98, "waist ratio outside approved Gate B envelope")
require(0.98 <= ratios.get("pelvis", 0) <= 1.04, "pelvis ratio outside approved Gate B envelope")
require(measured.get("triangleOrientationMinDot", 0) > 0.75, "triangle orientation degraded")
require(measured.get("triangleOrientationP001Dot", 0) > 0.90, "triangle orientation tail degraded")
require(measured.get("edgeRatioP001", 0) > 0.75, "edge compression outside envelope")
require(measured.get("edgeRatioP999", 99) < 1.30, "edge expansion outside envelope")
require(measured.get("lowerContours", {}).get("waist", {}).get("deltaM", 0) > 0.002, "ventral waist line was not raised")
require(measured.get("lowerContours", {}).get("chest", {}).get("deltaM", 0) < -0.001, "thoracic ventral depth was not retained")

require(contract.get("schema") == "cat_kaopu/phase1_gate_b_contract@1.0", "contract schema mismatch")
require(contract.get("buildId") == BUILD_ID, "contract build id mismatch")
require(contract.get("gate") == "B" and contract.get("status") == "active", "Gate B contract not active")
require(contract.get("requiredViews") == ["front", "left", "top", "quarter"], "required views mismatch")
require(contract.get("requiredActions") == ["stand", "walk_forward", "turn_left", "turn_right"], "required actions mismatch")
require(contract.get("deferred", {}).get("groupRuntime") is True, "group runtime must remain deferred")
require(contract.get("deferred", {}).get("variationRuntime") is True, "variation runtime must remain deferred")
require(contract.get("visualAcceptance") is False, "contract must not claim visual acceptance")
require(contract.get("productionReady") is False, "contract must not claim production readiness")

require(manifest.get("schema") == "cat_kaopu/phase1_gate_b_build@1.0", "manifest schema mismatch")
require(manifest.get("buildId") == BUILD_ID, "manifest build id mismatch")
require(manifest.get("sourceGateASha256") == sha256(SOURCE), "Gate A source hash mismatch")
require(manifest.get("runtimePayloadSha256") == profile.get("runtimePayload", {}).get("sha256"), "payload hash mismatch")
require(manifest.get("technicalReady") is True, "technical-ready flag missing")
require(manifest.get("browserEvidenceRequired") is True, "browser evidence gate missing")
require(manifest.get("visualAcceptance") is False, "manifest must not claim visual acceptance")
require(manifest.get("productionReady") is False, "manifest must not claim production readiness")
require(manifest.get("groupRuntime") is False and manifest.get("variationRuntime") is False, "group/variation runtime prematurely enabled")

outputs = {entry["path"]: entry for entry in manifest.get("outputs", [])}
for path in (WORKBENCH, INDEX, PROFILE, CONTRACT, REPORT):
    relative = str(path.relative_to(ROOT))
    require(relative in outputs, f"manifest omits {relative}")
    require(outputs[relative].get("bytes") == path.stat().st_size, f"byte count mismatch for {relative}")
    require(outputs[relative].get("sha256") == sha256(path), f"hash mismatch for {relative}")

if args.require_browser:
    require(BROWSER_QA.is_file(), f"missing {BROWSER_QA.relative_to(ROOT)}")
    browser = load_json(BROWSER_QA)
    require(browser.get("schema") == "cat_kaopu/phase1_gate_b_browser_qa@1.0", "browser QA schema mismatch")
    require(browser.get("buildId") == BUILD_ID, "browser QA build id mismatch")
    require(browser.get("ready") == "gate-b-webgl2", "browser did not enter Gate B WebGL2 mode")
    require(not browser.get("pageErrors"), f"page errors: {browser.get('pageErrors')}")
    require(not browser.get("consoleErrors"), f"console errors: {browser.get('consoleErrors')}")
    failed = [key for key, value in browser.get("assertions", {}).items() if value is not True]
    require(not failed, f"browser assertions failed: {failed}")
    require(browser.get("visualAcceptance") is False, "browser QA must not claim visual acceptance")
    require(browser.get("productionReady") is False, "browser QA must not claim production readiness")

print(
    json.dumps(
        {
            "buildId": BUILD_ID,
            "workbenchBytes": WORKBENCH.stat().st_size,
            "sourceGateASha256": sha256(SOURCE),
            "maxDeltaMm": round(measured["maxDeltaM"] * 1000, 4),
            "widthRatios": ratios,
            "browserVerified": args.require_browser,
            "visualAcceptance": False,
            "productionReady": False,
        },
        ensure_ascii=False,
        indent=2,
    )
)
