from __future__ import annotations

from pathlib import Path

BUILDER = Path(__file__).resolve().parent / "build_cat_v442_geometric_eyelid.py"


def replace_once(text: str, old: str, new: str, label: str) -> tuple[str, bool]:
    if new in text:
        print(f"{label}: already present")
        return text, False
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one marker, found {count}")
    print(f"{label}: patched")
    return text.replace(old, new, 1), True


text = BUILDER.read_text(encoding="utf-8")
changed = False

# The frozen CATV440 eye spheres protrude beyond the coarse orbital opening.
# Geometry alone therefore cannot merge into the face without the globe
# depth-testing through the lower transition band.  This is not a painted lid
# mask: it only discards globe fragments that lie behind the independently
# rendered four-piece eyelid volume.
text, did = replace_once(
    text,
    "uniform float uEyeEnabled;uniform float uCornea;",
    "uniform float uEyeEnabled;uniform float uBlink;uniform float uCornea;",
    "eye-globe blink uniform",
)
changed |= did

old_eye_basis = (
    "vec3 e=normalize(vEyeDir);"
    "float ex=dot(e,r),ey=dot(e,u),ef=dot(e,g);"
)
new_eye_basis = (
    "vec3 e=normalize(vEyeDir);"
    "float ex=dot(e,r),ey=dot(e,u),ef=dot(e,g);"
    "float hx=clamp(vEyeDir.y/.995,-1.,1.),"
    "q=sqrt(max(0.,1.-hx*hx)),"
    "apx=hx/.52,apq=sqrt(max(0.,1.-apx*apx)),"
    "side=sign(vBindP.y),lateral=hx*side,"
    "medial=clamp((-lateral-.2)/.8,0.,1.);"
    "medial=medial*medial*(3.-2.*medial);"
    "float arc=pow(apq,mix(.82,1.08,medial)),"
    "corner=-.025+.070*lateral+.012*(1.-q),"
    "close=smoothstep(0.,1.,clamp(uBlink,0.,1.)),"
    "seam=corner-(.035-.010*lateral)*arc,"
    "upper=mix(corner+(.34-.02*lateral)*arc,seam,close),"
    "lower=mix(corner-(.28+.01*lateral)*arc,seam,pow(close,1.22));"
    "if(apq<.001||vEyeDir.z>upper+.018||vEyeDir.z<lower-.018||close>.995)discard;"
)
text, did = replace_once(
    text,
    old_eye_basis,
    new_eye_basis,
    "geometric-aperture globe clipping",
)
changed |= did

text, did = replace_once(
    text,
    "eye:gl.getUniformLocation(pr,'uEyeEnabled'),cornea:gl.getUniformLocation(pr,'uCornea')",
    "eye:gl.getUniformLocation(pr,'uEyeEnabled'),blink:gl.getUniformLocation(pr,'uBlink'),cornea:gl.getUniformLocation(pr,'uCornea')",
    "eye-globe blink uniform location",
)
changed |= did

text, did = replace_once(
    text,
    "gl.uniform1f(U.eye,eyeLayerEnabled?1:0);gl.uniform1f(U.cornea,corneaLayerEnabled?corneaResponse:0);",
    "gl.uniform1f(U.eye,eyeLayerEnabled?1:0);gl.uniform1f(U.blink,expressionState.blink);gl.uniform1f(U.cornea,corneaLayerEnabled?corneaResponse:0);",
    "eye-globe blink upload",
)
changed |= did

if changed:
    BUILDER.write_text(text, encoding="utf-8")
    print(
        "patched V4.42 eye globe: discard only outside the geometric "
        "palpebral aperture so the frozen sphere cannot bleed through lids"
    )
else:
    print("V4.42 geometric-aperture globe clipping already complete")
