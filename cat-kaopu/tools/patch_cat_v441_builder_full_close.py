from __future__ import annotations

from pathlib import Path

BUILDER = Path(__file__).resolve().parent / "build_cat_v441_eyelid_cornea.py"

OLD = (
    "float aperture=uLidEnabled>.5?"
    "smoothstep(-halfOpen-.022,-halfOpen+.010,ey)*"
    "(1.-smoothstep(halfOpen-.010,halfOpen+.022,ey)):1.;"
    "float edge="
)
NEW = (
    "float aperture=uLidEnabled>.5?"
    "smoothstep(-halfOpen-.022,-halfOpen+.010,ey)*"
    "(1.-smoothstep(halfOpen-.010,halfOpen+.022,ey)):1.;"
    "aperture*=1.-smoothstep(.96,.995,blink);"
    "float edge="
)

text = BUILDER.read_text(encoding="utf-8")
if NEW in text:
    print("V4.41 full-close clamp already present")
elif text.count(OLD) != 1:
    raise SystemExit(f"expected exactly one eyelid aperture marker, found {text.count(OLD)}")
else:
    BUILDER.write_text(text.replace(OLD, NEW, 1), encoding="utf-8")
    print("patched V4.41 builder: blink=1 now forces zero eye aperture")
