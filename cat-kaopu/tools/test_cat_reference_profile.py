from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
EXTRACTOR = HERE / "extract_cat_reference_profile.py"


def make_ellipsoid_obj(path: Path, rings: int = 10, segments: int = 20) -> None:
    vertices = []
    faces = []
    for ring in range(rings + 1):
        v = ring / rings
        phi = -0.5 * 3.141592653589793 + v * 3.141592653589793
        import math
        for segment in range(segments):
            theta = 2 * 3.141592653589793 * segment / segments
            vertices.append((0.50 * math.cos(phi) * math.cos(theta), 0.16 * math.cos(phi) * math.sin(theta), 0.22 * math.sin(phi)))
    for ring in range(rings):
        for segment in range(segments):
            a = ring * segments + segment
            b = ring * segments + (segment + 1) % segments
            c = (ring + 1) * segments + (segment + 1) % segments
            d = (ring + 1) * segments + segment
            faces.append((a + 1, b + 1, c + 1))
            faces.append((a + 1, c + 1, d + 1))
    lines = [*(f"v {x:.9f} {y:.9f} {z:.9f}" for x, y, z in vertices), *(f"f {a} {b} {c}" for a, b, c in faces)]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        mesh = root / "synthetic_reference.obj"
        output = root / "profile.json"
        make_ellipsoid_obj(mesh)
        subprocess.run(
            [sys.executable, str(EXTRACTOR), str(mesh), str(output), "--section-count", "17"],
            check=True,
        )
        profile = json.loads(output.read_text(encoding="utf-8"))
        geometry = profile["geometry"]
        assert profile["schema"] == "cat_kaopu/body_reference_profile@1.0"
        assert geometry["vertexCount"] == 220
        assert geometry["triangleCount"] == 400
        assert geometry["finite"] is True
        assert geometry["boundingBox"]["extent"][0] > geometry["boundingBox"]["extent"][2] > geometry["boundingBox"]["extent"][1]
        assert geometry["topology"]["connectedComponents"] == 1
        assert len(profile["sections"]) == 17
        assert profile["coordinateMapping"]["axisConfirmationRequired"] is True
        assert profile["decisionBoundary"]["mayShipRawReference"] is False
        assert profile["visualAcceptance"] is False
        print(json.dumps({
            "schema": profile["schema"],
            "vertexCount": geometry["vertexCount"],
            "triangleCount": geometry["triangleCount"],
            "sectionCount": len(profile["sections"]),
            "status": "pass",
        }, indent=2))


if __name__ == "__main__":
    main()
