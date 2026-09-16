from __future__ import annotations

from pathlib import Path

FINALIZER = Path(__file__).resolve().parent / "finalize_cat_v444_continuous_periorbital.py"

old = (
    '"legacyEyelidDataPreserved": "buildGeometricEyelids" in output_text '
    'and "lidMesh.idx.length" in output_text,'
)
new = (
    '"legacyEyelidDataPreserved": "buildGeometricEyelids" in output_text '
    'and "lidVao=gl.createVertexArray()" in output_text,'
)

text = FINALIZER.read_text(encoding="utf-8")
if new in text:
    print("V4.44 validation marker already corrected")
elif text.count(old) != 1:
    raise SystemExit(f"expected one legacy eyelid marker, found {text.count(old)}")
else:
    FINALIZER.write_text(text.replace(old, new, 1), encoding="utf-8")
    print("corrected V4.44 validation marker: legacy eyelid data/VAO retained while draw is disabled")
