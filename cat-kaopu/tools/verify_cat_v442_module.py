from __future__ import annotations

import base64
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

MODULE_ROOT = Path(__file__).resolve().parent.parent
BASELINE = MODULE_ROOT / "baselines/v4.41/CAT_KAOPU_V441_EYELID_CORNEA_WORKBENCH_2026-09-15.html"
CURRENT_HTML = MODULE_ROOT / "workbench/CAT_KAOPU_CURRENT.html"
CURRENT_JSON = MODULE_ROOT / "CURRENT.json"
MANIFEST = MODULE_ROOT / "BUILD_MANIFEST.json"
TECHNICAL_QA = MODULE_ROOT / "qa/CAT_KAOPU_V442_TECHNICAL_QA_2026-09-16.json"
BROWSER_QA = MODULE_ROOT / "qa/CAT_KAOPU_V442_BROWSER_RUNTIME_QA_2026-09-16.json"


def fail(message: str) -> None:
    raise RuntimeError(message)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def embedded_payload(text: str) -> bytes:
    match = re.search(r"const CAT_B64='([^']+)'", text)
    if not match:
        fail("CAT_B64 not found")
    return base64.b64decode(match.group(1))


def extract_json_constant(text: str, name: str, next_name: str) -> dict[str, Any]:
    start = f"const {name}="
    end = f";\nconst {next_name}="
    i = text.find(start)
    if i < 0:
        fail(f"{name} constant missing")
    i += len(start)
    j = text.find(end, i)
    if j < 0:
        fail(f"{name} terminator missing")
    return json.loads(text[i:j])


def load_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        fail(f"required file missing: {path.relative_to(MODULE_ROOT)}")
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    for path in (BASELINE, CURRENT_HTML, CURRENT_JSON, MANIFEST, TECHNICAL_QA):
        if not path.is_file():
            fail(f"required file missing: {path}")

    source = BASELINE.read_text(encoding="utf-8")
    current = CURRENT_HTML.read_text(encoding="utf-8")
    source_payload = embedded_payload(source)
    current_payload = embedded_payload(current)
    source_rig = extract_json_constant(source, "RIG", "LIB")
    current_rig = extract_json_constant(current, "RIG", "LIB")

    checks: dict[str, bool] = {
        "versionApi": "__CAT_V442_READY__" in current,
        "renderState": "bounded-geometric-eyelid-volume" in current,
        "geometryApi": "__CAT_V442_EYELID_GEOMETRY__" in current,
        "geometryBuilder": "function buildGeometricEyelids" in current,
        "geometryDraw": "gl.drawElements(gl.TRIANGLES,lidMesh.idx.length" in current,
        "lidThicknessControl": 'id="lidThickness"' in current,
        "debugControl": 'id="lidDebugToggle"' in current,
        "oldShaderMaskRemoved": "uLidEnabled" not in current and "float aperture" not in current,
        "payloadByteIdentical": source_payload == current_payload,
        "rigJsonIdentical": source_rig == current_rig,
        "boneCount34": len(current_rig.get("bones", [])) == 34,
    }

    state = load_json(CURRENT_JSON)
    manifest = load_json(MANIFEST)
    technical = load_json(TECHNICAL_QA)
    checks.update(
        {
            "currentVersion": state.get("currentVersion") == "V4.42",
            "currentEntry": state.get("currentEntry") == "workbench/CAT_KAOPU_CURRENT.html",
            "stateNotAccepted": state.get("acceptance", {}).get("visualAcceptance") is False,
            "stateNotProduction": state.get("acceptance", {}).get("productionReady") is False,
            "manifestVersion": manifest.get("version") == "V4.42",
            "manifestNotAccepted": manifest.get("visualAcceptance") is False,
            "manifestNotProduction": manifest.get("productionReady") is False,
            "technicalPayload": technical.get("payloadByteIdentical") is True,
            "technicalRig": technical.get("rigJsonIdentical") is True,
            "technicalMarkers": all(technical.get("requiredMarkers", {}).values()),
            "technicalNotAccepted": technical.get("visualAcceptance") is False,
            "technicalNotProduction": technical.get("productionReady") is False,
        }
    )

    browser_summary: dict[str, Any] | None = None
    if BROWSER_QA.is_file():
        browser_summary = load_json(BROWSER_QA)
        assertions = browser_summary.get("assertions", {})
        checks.update(
            {
                "browserWebgl2": browser_summary.get("ready") == "webgl2",
                "browserAssertions": bool(assertions) and all(value is True for value in assertions.values()),
                "browserNoPageErrors": not browser_summary.get("pageErrors"),
                "browserNoConsoleErrors": not browser_summary.get("consoleErrors"),
                "browserNotAccepted": browser_summary.get("visualAcceptance") is False,
                "browserNotProduction": browser_summary.get("productionReady") is False,
            }
        )

    failed = [name for name, passed in checks.items() if not passed]
    if failed:
        for name in failed:
            print(f"FAIL {name}", file=sys.stderr)
        fail("V4.42 module verification failed")

    print("PASS")
    print("version: V4.42")
    print(f"html sha256: {sha256(current.encode('utf-8'))}")
    print(f"payload sha256: {sha256(current_payload)}")
    print(f"v441 payload preserved: {source_payload == current_payload}")
    print(f"v441 rig preserved: {source_rig == current_rig}")
    print("eyelid geometry: 4 bounded head-bone-driven shell volumes")
    print(f"browser qa present: {browser_summary is not None}")


if __name__ == "__main__":
    main()
