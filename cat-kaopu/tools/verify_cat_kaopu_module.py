from __future__ import annotations

import base64
import hashlib
import json
import re
import struct
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
CURRENT_PATH = ROOT / "CURRENT.json"
HTML = ROOT / "workbench/CAT_KAOPU_CURRENT.html"
BIN = ROOT / "runtime/cat_v440.bin"
V440_BASELINE = ROOT / "baselines/v4.40/CAT_KAOPU_V440_EYE_EAR_SHORT_FUR_WORKBENCH_2026-09-15.html"


def extract_payload(text: str) -> bytes:
    match = re.search(r"const CAT_B64='([^']+)'", text)
    if not match:
        raise ValueError("CAT_B64 not found")
    return base64.b64decode(match.group(1))


def extract_json_constant(text: str, name: str, next_name: str) -> dict[str, Any]:
    start_token = f"const {name}="
    end_token = f";\nconst {next_name}="
    start = text.index(start_token) + len(start_token)
    end = text.index(end_token, start)
    return json.loads(text[start:end])


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


errors: list[str] = []
if not CURRENT_PATH.exists():
    errors.append("CURRENT.json missing")
    current: dict[str, Any] = {}
else:
    current = json.loads(CURRENT_PATH.read_text(encoding="utf-8"))

version = current.get("currentVersion")
if version not in {"V4.40", "V4.41"}:
    errors.append(f"unsupported currentVersion: {version!r}")
if not HTML.exists():
    errors.append("current HTML missing")
if not BIN.exists():
    errors.append("runtime binary missing")

text = HTML.read_text(encoding="utf-8") if HTML.exists() else ""
embedded = b""
if text and BIN.exists():
    try:
        embedded = extract_payload(text)
    except Exception as exc:  # noqa: BLE001
        errors.append(str(exc))
    else:
        external = BIN.read_bytes()
        if embedded != external:
            errors.append("embedded payload differs from runtime/cat_v440.bin")
        if embedded[:7] != b"CATV440":
            errors.append(f"payload magic is {embedded[:7]!r}, expected CATV440")
        if len(embedded) >= 28:
            bone_count = struct.unpack_from("<I", embedded, 24)[0]
            if bone_count != 34:
                errors.append(f"bone count {bone_count}, expected 34")

for forbidden in ["http://", "https://"]:
    if forbidden in text:
        errors.append(f"external URL marker found in HTML: {forbidden}")

if version == "V4.41" and text:
    required = {
        "title": "CAT KAOPU V4.41" in text,
        "ready API": "__CAT_V441_READY__" in text,
        "lid uniform": "uniform float uLidEnabled" in text,
        "blink uniform": "uniform float uBlink" in text,
        "cornea uniform": "uniform float uCornea" in text,
        "pupil uniform": "uniform float uPupilAdapt" in text,
        "blink action": '"id":"blink_check"' in text,
        "manual blink control": 'id="blinkAmount"' in text,
        "cornea control": 'id="corneaResponse"' in text,
        "pupil control": 'id="pupilAdapt"' in text,
    }
    for label, ok in required.items():
        if not ok:
            errors.append(f"V4.41 marker missing: {label}")
    if not V440_BASELINE.exists():
        errors.append("V4.40 frozen baseline missing")
    else:
        baseline_text = V440_BASELINE.read_text(encoding="utf-8")
        try:
            baseline_payload = extract_payload(baseline_text)
            baseline_rig = extract_json_constant(baseline_text, "RIG", "LIB")
            current_rig = extract_json_constant(text, "RIG", "LIB")
        except Exception as exc:  # noqa: BLE001
            errors.append(f"baseline comparison failed: {exc}")
        else:
            if embedded and baseline_payload != embedded:
                errors.append("V4.41 payload differs from frozen V4.40 baseline")
            if baseline_rig != current_rig:
                errors.append("V4.41 RIG differs from frozen V4.40 baseline")

if errors:
    print("FAIL")
    for error in errors:
        print("-", error)
    sys.exit(1)

print("PASS")
print("version:", version)
print("html sha256:", sha256(HTML.read_bytes()))
print("bin sha256:", sha256(BIN.read_bytes()))
if version == "V4.41":
    print("v440 payload preserved:", True)
    print("v440 rig preserved:", True)
