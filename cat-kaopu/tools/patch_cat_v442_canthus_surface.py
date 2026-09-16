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

# The inner lid edge now closes at hx ±0.52, but the original strip still
# retained full width all the way to hx ±1.  That made the closed lid read as a
# rectangular shelf.  Use the bounded-aperture arc itself as a canthus taper.
text, did = replace_once(
    text,
    "float tt=smoothstep(0.,1.,t);vec3 closeNormal=",
    "float tt=smoothstep(0.,1.,t),canthusBlend=smoothstep(.02,.24,apq),bandBulge=4.*tt*(1.-tt)*canthusBlend;vec3 closeNormal=",
    "canthus taper fields",
)
changed |= did

text, did = replace_once(
    text,
    "p=mix(innerP,outerP,tt);vec3 sphereLocal=",
    "p=mix(innerP,outerP,tt);p=mix(outerP,p,canthusBlend);vec3 sphereLocal=",
    "surface canthus collapse",
)
changed |= did

text, did = replace_once(
    text,
    "p.x+=close*(lid>0.?uThicknessM*.34:uThicknessM*.18)*(1.-tt);n=normalize(mix(innerN,outerN,tt));",
    "p.x+=close*(lid>0.?uThicknessM*.34:uThicknessM*.18)*(1.-tt)*canthusBlend;p.x+=close*bandBulge*aRadius.x*(lid>0.?.055:.025);n=normalize(mix(innerN,outerN,tt));n=normalize(mix(outerN,n,canthusBlend));",
    "curved surface and canthus normals",
)
changed |= did

text, did = replace_once(
    text,
    "p=aCenter+aRadius*innerDir*shell;p.x+=close*(lid>0.?uThicknessM*.34:uThicknessM*.18);vec3 rimNormal=normalize(vec3(.42,0.,-lid*.91));n=normalize(mix(innerN,rimNormal,step(.5,aRim)));",
    "p=aCenter+aRadius*innerDir*shell;p=mix(aOuterPos,p,canthusBlend);p.x+=close*(lid>0.?uThicknessM*.34:uThicknessM*.18)*canthusBlend;vec3 rimNormal=normalize(vec3(.42,0.,-lid*.91));n=normalize(mix(innerN,rimNormal,step(.5,aRim)));n=normalize(mix(aOuterNor,n,canthusBlend));",
    "rim canthus collapse",
)
changed |= did

if changed:
    BUILDER.write_text(text, encoding="utf-8")
    print(
        "patched V4.42 eyelids: tapered both lid sheets into anatomical "
        "canthi and added a bounded convex closed-lid profile"
    )
else:
    print("V4.42 canthus and curved-surface patch already complete")
