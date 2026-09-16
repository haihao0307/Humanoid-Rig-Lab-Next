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

text, did = replace_once(
    text,
    "out vec3 vN;out float vRim;out float vLid;out float vClosure;void main()",
    "out vec3 vN;out float vRim;out float vLid;out float vClosure;out float vBand;void main()",
    "lid vertex varying",
)
changed |= did

text, did = replace_once(
    text,
    "vec3 radial=normalize(vec3(dir.x/max(aRadius.x,.0001),dir.y/max(aRadius.y,.0001),dir.z/max(aRadius.z,.0001)));vec3 rimNormal=normalize(vec3(.42,0.,-lid*.91));vec3 n=normalize(mix(radial,rimNormal,step(.5,aRim)));",
    "vec3 radial=normalize(vec3(dir.x/max(aRadius.x,.0001),dir.y/max(aRadius.y,.0001),dir.z/max(aRadius.z,.0001)));vec3 orbitNormal=normalize(vec3(.78,ex*.22,ey*.28));radial=normalize(mix(radial,orbitNormal,smoothstep(.45,1.,tt)*.72));vec3 rimNormal=normalize(vec3(.42,0.,-lid*.91));vec3 n=normalize(mix(radial,rimNormal,step(.5,aRim)));",
    "orbital normal blend",
)
changed |= did

text, did = replace_once(
    text,
    "vRim=aRim;vLid=lid;vClosure=close;}`;",
    "vRim=aRim;vLid=lid;vClosure=close;vBand=t;}`;",
    "lid band output",
)
changed |= did

text, did = replace_once(
    text,
    "precision highp float;in vec3 vN;in float vRim;in float vLid;in float vClosure;uniform float uDebug;out vec4 outColor;",
    "precision highp float;in vec3 vN;in float vRim;in float vLid;in float vClosure;in float vBand;uniform float uDebug;out vec4 outColor;",
    "lid fragment varying",
)
changed |= did

text, did = replace_once(
    text,
    "float rim=smoothstep(.15,.85,vRim);base*=mix(1.,.58,rim);base*=1.-.18*rim*smoothstep(.45,.95,vClosure);float soft=",
    "float rim=smoothstep(.15,.85,vRim);float closedGate=smoothstep(.72,.98,vClosure);float seamBand=(1.-smoothstep(.015,.075,vBand))*closedGate;float seamDark=seamBand*step(0.,vLid);base*=mix(1.,.58,rim);base*=1.-.18*rim*smoothstep(.45,.95,vClosure);base*=1.-.56*seamDark;float soft=",
    "closed seam shading",
)
changed |= did

if changed:
    BUILDER.write_text(text, encoding="utf-8")
    print("patched V4.42 closed-lid read: visible upper seam and softer orbital transition")
else:
    print("V4.42 closed-seam patch already complete")
