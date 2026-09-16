from __future__ import annotations

import base64
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASELINE = ROOT / "baselines/v4.45/CAT_KAOPU_V445_MLS_PERIORBITAL_WORKBENCH_2026-09-16.html"
FALLBACK_BASELINE = ROOT / "build/v4.45/CAT_KAOPU_V445_MLS_PERIORBITAL_WORKBENCH_2026-09-16.html"
CURRENT = ROOT / "workbench/CAT_KAOPU_CURRENT.html"
TECH_QA = ROOT / "qa/CAT_KAOPU_V446_TECHNICAL_QA_2026-09-16.json"


def payload(text: str) -> bytes:
    match = re.search(r"const CAT_B64='([^']+)'", text)
    if not match:
        raise SystemExit("CAT payload marker missing")
    return base64.b64decode(match.group(1))


def rig(text: str) -> object:
    marker = "const RIG="
    start = text.find(marker)
    if start < 0:
        raise SystemExit("RIG marker missing")
    obj, _ = json.JSONDecoder().raw_decode(text[start + len(marker):])
    return obj


def main() -> None:
    source_path = BASELINE if BASELINE.exists() else FALLBACK_BASELINE
    if not source_path.exists() or not CURRENT.exists():
        raise SystemExit("V4.45 source or V4.46 workbench missing")
    source = source_path.read_text(encoding="utf-8")
    current = CURRENT.read_text(encoding="utf-8")
    source_payload = payload(source)
    current_payload = payload(current)
    source_rig = rig(source)
    current_rig = rig(current)
    checks = {
        "payloadByteIdentical": source_payload == current_payload,
        "rigJsonIdentical": source_rig == current_rig,
        "boneCount": len(current_rig.get("bones", [])) == 34,
        "readyApi": "__CAT_V446_READY__" in current,
        "singleCarrierGeometry": "function buildWideEyeRegionCarrier" in current,
        "dualAperture": "bool inAperture" in current,
        "browNoseCheekControls": all(x in current for x in ('id="browStrength"', 'id="noseStrength"', 'id="cheekStrength"')),
        "frozenBoundary": "boundary=1.-smoother(edge/.135)" in current,
        "opaquePolygonOffsetDraw": "gl.enable(gl.POLYGON_OFFSET_FILL)" in current,
        "onePieceGeometry": "pieces:1" in current,
        "legacyApiRemoved": "__CAT_V445_READY__" not in current,
        "externalModel": False,
        "externalTexture": False,
        "externalAnimation": False,
    }
    absent_dependencies = ("externalModel", "externalTexture", "externalAnimation")
    positive_checks = {key: value for key, value in checks.items() if key not in absent_dependencies}
    if not all(value is True for value in positive_checks.values()) or not all(checks[key] is False for key in absent_dependencies):
        raise SystemExit(f"V4.46 verification failed: {checks}")
    if TECH_QA.exists():
        report = json.loads(TECH_QA.read_text(encoding="utf-8"))
        if report.get("version") != "V4.46" or not report.get("payloadByteIdentical"):
            raise SystemExit("V4.46 technical QA report mismatch")
        if report.get("addedGeometry", {}).get("pieces") != 1:
            raise SystemExit("V4.46 technical QA geometry mismatch")
    print(json.dumps({"version": "V4.46", "checks": checks}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
