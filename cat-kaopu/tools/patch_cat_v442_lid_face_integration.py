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
    "p.x+=close*(lid>0.?uThicknessM*.25:-uThicknessM*.10)*(1.-tt);",
    "p.x+=close*(lid>0.?uThicknessM*.46:-uThicknessM*.16)*(1.-tt);",
    "upper/lower depth ordering",
)
changed |= did

text, did = replace_once(
    text,
    "float rim=smoothstep(.15,.85,vRim);float closedGate=smoothstep(.72,.98,vClosure);float seamBand=(1.-smoothstep(.015,.075,vBand))*closedGate;float seamDark=seamBand*step(0.,vLid);base*=mix(1.,.58,rim);base*=1.-.18*rim*smoothstep(.45,.95,vClosure);base*=1.-.56*seamDark;float soft=",
    "float rim=smoothstep(.15,.85,vRim);float closedGate=smoothstep(.72,.98,vClosure);float seamBand=(1.-smoothstep(.012,.090,vBand))*closedGate;float seamDark=seamBand*step(0.,vLid);float foldBand=(smoothstep(.09,.15,vBand)-smoothstep(.18,.27,vBand))*closedGate*step(0.,vLid);float edgeAlpha=1.-smoothstep(.76,1.,vBand);base*=vLid>0.?.975:1.015;base*=mix(1.,.60,rim);base*=1.-.15*rim*smoothstep(.45,.95,vClosure);base*=1.-.62*seamDark;base*=1.-.14*foldBand;float soft=",
    "crease, fold and orbital fade",
)
changed |= did

text, did = replace_once(
    text,
    "outColor=vec4(pow(max(col,vec3(0.)),vec3(1./2.2)),1.);}`;",
    "outColor=vec4(pow(max(col,vec3(0.)),vec3(1./2.2)),uDebug>.5?1.:edgeAlpha);}`;",
    "lid alpha output",
)
changed |= did

text, did = replace_once(
    text,
    "gl.disable(gl.CULL_FACE);gl.drawElements(gl.TRIANGLES,lidMesh.idx.length,gl.UNSIGNED_SHORT,0);gl.enable(gl.CULL_FACE);",
    "gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.drawElements(gl.TRIANGLES,lidMesh.idx.length,gl.UNSIGNED_SHORT,0);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);",
    "lid alpha blending",
)
changed |= did

if changed:
    BUILDER.write_text(text, encoding="utf-8")
    print("patched V4.42 lids: real upper/lower depth order, closure crease, upper fold and alpha orbital integration")
else:
    print("V4.42 lid-face integration patch already complete")
