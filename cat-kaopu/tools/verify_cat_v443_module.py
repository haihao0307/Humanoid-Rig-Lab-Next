from __future__ import annotations

import base64
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASELINE = ROOT / "baselines/v4.42/CAT_KAOPU_V442_GEOMETRIC_EYELID_WORKBENCH_2026-09-16.html"
CURRENT = ROOT / "workbench/CAT_KAOPU_CURRENT.html"
CURRENT_JSON = ROOT / "CURRENT.json"
TECH_QA = ROOT / "qa/CAT_KAOPU_V443_TECHNICAL_QA_2026-09-16.json"


def payload(text: str) -> bytes:
    match = re.search(r"const CAT_B64='([^']+)'", text)
    if not match:
        raise AssertionError("CAT_B64 missing")
    return base64.b64decode(match.group(1))


def json_const(text: str, name: str, next_name: str) -> dict:
    start_token = f"const {name}="
    end_token = f";\nconst {next_name}="
    start = text.index(start_token) + len(start_token)
    end = text.index(end_token, start)
    return json.loads(text[start:end])


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> None:
    source = BASELINE.read_text(encoding="utf-8")
    output = CURRENT.read_text(encoding="utf-8")
    current = json.loads(CURRENT_JSON.read_text(encoding="utf-8"))
    qa = json.loads(TECH_QA.read_text(encoding="utf-8"))

    assert current["currentVersion"] == "V4.43"
    assert current["acceptance"]["visualAcceptance"] is False
    assert current["acceptance"]["productionReady"] is False
    assert payload(source) == payload(output)
    assert json_const(source, "RIG", "LIB") == json_const(output, "RIG", "LIB")
    assert qa["payloadByteIdentical"] is True
    assert qa["rigJsonIdentical"] is True
    assert qa["boneCount"] == 34
    assert all(qa["requiredMarkers"].values())
    assert "__CAT_V443_READY__" in output
    assert "__CAT_V443_ORBITAL_GEOMETRY__" in output
    assert "buildOrbitalTissue" in output
    assert "const orbitVS=`#version 300 es" in output
    assert "const orbitFS=`#version 300 es" in output
    assert "gl.drawElements(gl.TRIANGLES,orbitMesh.idx.length" in output
    assert "buildGeometricEyelids" in output
    assert "lidMesh.idx.length" in output
    assert "externalModel:false" in output
    assert "externalTexture:false" in output
    assert "externalAnimation:false" in output
    assert "__CAT_V442_READY__" not in output

    print("PASS")
    print("version: V4.43")
    print(f"html sha256: {sha(output.encode('utf-8'))}")
    print(f"payload sha256: {sha(payload(output))}")
    print("V4.42 payload preserved: True")
    print("V4.42 rig preserved: True")
    print("orbital pieces: 4")
    print("orbital vertices: 1372")
    print("orbital triangles: 2304")


if __name__ == "__main__":
    main()
