from __future__ import annotations

from pathlib import Path

BUILDER = Path(__file__).resolve().parent / "build_cat_v441_eyelid_cornea.py"

APERTURE_V1 = (
    "float halfOpen=mix(.30,.010,smoothstep(0.,1.,blink))*lateral;"
    "float aperture=uLidEnabled>.5?"
    "smoothstep(-halfOpen-.022,-halfOpen+.010,ey)*"
    "(1.-smoothstep(halfOpen-.010,halfOpen+.022,ey)):1.;"
    "float edge=uLidEnabled>.5?(1.-smoothstep(.006,.030,abs(abs(ey)-halfOpen))):0.;"
)
APERTURE_V2 = (
    "float halfOpen=mix(.30,.010,smoothstep(0.,1.,blink))*lateral;"
    "float aperture=uLidEnabled>.5?"
    "smoothstep(-halfOpen-.022,-halfOpen+.010,ey)*"
    "(1.-smoothstep(halfOpen-.010,halfOpen+.022,ey)):1.;"
    "aperture*=1.-smoothstep(.96,.995,blink);"
    "float edge=uLidEnabled>.5?(1.-smoothstep(.006,.030,abs(abs(ey)-halfOpen))):0.;"
)
APERTURE_V3 = (
    "float close=smoothstep(0.,1.,blink);"
    "float lower=mix(-.31*lateral,-.015*lateral,close);"
    "float upper=mix(.36*lateral,-.015*lateral,close);"
    "float seamY=mix(.018*lateral,-.015*lateral,close);"
    "float aperture=uLidEnabled>.5?"
    "smoothstep(lower-.022,lower+.010,ey)*"
    "(1.-smoothstep(upper-.010,upper+.022,ey)):1.;"
    "aperture*=1.-smoothstep(.96,.995,blink);"
    "float edge=uLidEnabled>.5?"
    "(1.-smoothstep(.006,.030,min(abs(ey-lower),abs(ey-upper)))):0.;"
)

LID_V1 = (
    "float lidLight=.33+.48*max(dot(n,l1),0.)+.12*max(dot(n,l2),0.);"
    "vec3 lidCol=vec3(.45,.42,.38)*lidLight;"
    "lidCol-=vec3(.055,.045,.04)*edge;"
    "vec3 eyeOut=mix(lidCol,eyeCol,aperture);"
)
LID_V2 = (
    "float lidLight=.44+.55*max(dot(n,l1),0.)+.10*max(dot(n,l2),0.);"
    "vec3 lidCol=vec3(.69,.655,.59)*lidLight;"
    "float seam=(1.-smoothstep(.010,.030,abs(ey)))*smoothstep(.10,.40,lateral)*smoothstep(.45,.98,blink);"
    "lidCol*=1.-.22*seam;"
    "lidCol-=vec3(.045,.036,.03)*edge;"
    "vec3 eyeOut=mix(lidCol,eyeCol,aperture);"
)
LID_V3 = (
    "float lidLight=.40+.42*max(dot(n,l1),0.)+.08*max(dot(n,l2),0.);"
    "vec3 lidCol=vec3(.69,.655,.59)*lidLight;"
    "float seam=(1.-smoothstep(.009,.028,abs(ey-seamY)))*smoothstep(.10,.40,lateral)*smoothstep(.45,.98,blink);"
    "lidCol*=1.-.28*seam;"
    "lidCol-=vec3(.040,.032,.026)*edge;"
    "vec3 eyeOut=mix(lidCol,eyeCol,aperture);"
)

text = BUILDER.read_text(encoding="utf-8")
changed = False

if APERTURE_V3 in text:
    print("V4.41 asymmetric full-close aperture already present")
elif text.count(APERTURE_V2) == 1:
    text = text.replace(APERTURE_V2, APERTURE_V3, 1)
    changed = True
    print("refined V4.41 builder: upper lid now travels farther than lower lid")
elif text.count(APERTURE_V1) == 1:
    text = text.replace(APERTURE_V1, APERTURE_V3, 1)
    changed = True
    print("patched V4.41 builder: asymmetric blink and complete closure enabled")
else:
    raise SystemExit("eyelid aperture marker is missing or ambiguous")

if LID_V3 in text:
    print("V4.41 restrained fur-matched eyelid and curved seam already present")
elif text.count(LID_V2) == 1:
    text = text.replace(LID_V2, LID_V3, 1)
    changed = True
    print("refined V4.41 builder: reduced lid brightness and aligned the seam to closure")
elif text.count(LID_V1) == 1:
    text = text.replace(LID_V1, LID_V3, 1)
    changed = True
    print("patched V4.41 builder: fur-matched eyelid and curved closed-eye seam enabled")
else:
    raise SystemExit("eyelid material marker is missing or ambiguous")

if changed:
    BUILDER.write_text(text, encoding="utf-8")
