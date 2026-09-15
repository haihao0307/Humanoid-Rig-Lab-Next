from __future__ import annotations

from pathlib import Path

BUILDER = Path(__file__).resolve().parent / "build_cat_v441_eyelid_cornea.py"

APERTURE_OLD = (
    "float aperture=uLidEnabled>.5?"
    "smoothstep(-halfOpen-.022,-halfOpen+.010,ey)*"
    "(1.-smoothstep(halfOpen-.010,halfOpen+.022,ey)):1.;"
    "float edge="
)
APERTURE_NEW = (
    "float aperture=uLidEnabled>.5?"
    "smoothstep(-halfOpen-.022,-halfOpen+.010,ey)*"
    "(1.-smoothstep(halfOpen-.010,halfOpen+.022,ey)):1.;"
    "aperture*=1.-smoothstep(.96,.995,blink);"
    "float edge="
)

LID_OLD = (
    "float lidLight=.33+.48*max(dot(n,l1),0.)+.12*max(dot(n,l2),0.);"
    "vec3 lidCol=vec3(.45,.42,.38)*lidLight;"
    "lidCol-=vec3(.055,.045,.04)*edge;"
    "vec3 eyeOut=mix(lidCol,eyeCol,aperture);"
)
LID_NEW = (
    "float lidLight=.44+.55*max(dot(n,l1),0.)+.10*max(dot(n,l2),0.);"
    "vec3 lidCol=vec3(.69,.655,.59)*lidLight;"
    "float seam=(1.-smoothstep(.010,.030,abs(ey)))*smoothstep(.10,.40,lateral)*smoothstep(.45,.98,blink);"
    "lidCol*=1.-.22*seam;"
    "lidCol-=vec3(.045,.036,.03)*edge;"
    "vec3 eyeOut=mix(lidCol,eyeCol,aperture);"
)

text = BUILDER.read_text(encoding="utf-8")
changed = False

if APERTURE_NEW in text:
    print("V4.41 full-close clamp already present")
elif text.count(APERTURE_OLD) == 1:
    text = text.replace(APERTURE_OLD, APERTURE_NEW, 1)
    changed = True
    print("patched V4.41 builder: blink=1 forces zero eye aperture")
else:
    raise SystemExit(f"expected one eyelid aperture marker, found {text.count(APERTURE_OLD)}")

if LID_NEW in text:
    print("V4.41 fur-matched eyelid and closed-eye seam already present")
elif text.count(LID_OLD) == 1:
    text = text.replace(LID_OLD, LID_NEW, 1)
    changed = True
    print("patched V4.41 builder: eyelid now matches face surface and gains a closed-eye seam")
else:
    raise SystemExit(f"expected one eyelid material marker, found {text.count(LID_OLD)}")

if changed:
    BUILDER.write_text(text, encoding="utf-8")
