from __future__ import annotations

from pathlib import Path

BUILDER = Path(__file__).resolve().parent / "build_cat_v446_wide_eye_region.py"
text = BUILDER.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if new in text:
        print(f"{label}: already present")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one marker, found {count}")
    text = text.replace(old, new, 1)
    print(f"{label}: patched")


replace_once(
    "vec3 p=mix(aRawPos,aSmoothPos,uSmoothStrength*(1.-boundary)),n=normalize(mix(aRawNor,aSmoothNor,uSmoothStrength*(1.-boundary)));",
    "vec3 p=mix(aRawPos,aSmoothPos,uSmoothStrength*(1.-boundary)),n=normalize(mix(aRawNor,aSmoothNor,uSmoothStrength*(1.-boundary)));p.x+=field*.00042;",
    "carrier physical depth separation",
)
replace_once(
    "gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-1.,-1.);",
    "gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-3.,-6.);",
    "stronger polygon depth bias",
)

BUILDER.write_text(text, encoding="utf-8")
print("patched V4.46 carrier: bounded physical and raster depth separation")
