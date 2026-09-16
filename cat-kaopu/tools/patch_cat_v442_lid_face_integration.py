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
    "float seamCenter=(-.018+.030*medial)*q;",
    "float seamCenter=(-.135+.060*medial+.025*(1.-q))*q;",
    "upper-dominant anatomical closure line",
)
changed |= did

text, did = replace_once(
    text,
    "float outer=(lid>0.?.82:-.72)*q;",
    "float outer=(lid>0.?.96:-.90)*q;",
    "periorbital transition reach",
)
changed |= did

text, did = replace_once(
    text,
    "float surfaceScale=mix(frontScale,1.001,tt);",
    "float surfaceScale=mix(frontScale,1.014,tt);",
    "outer orbital overlap",
)
changed |= did

text, did = replace_once(
    text,
    "p.x+=close*(lid>0.?uThicknessM*.25:-uThicknessM*.10)*(1.-tt);",
    "p.x+=close*(lid>0.?uThicknessM*.46:-uThicknessM*.16)*(1.-tt);",
    "upper/lower depth ordering",
)
changed |= did

text, did = replace_once(
    text,
    "radial=normalize(mix(radial,orbitNormal,smoothstep(.45,1.,tt)*.72));vec3 rimNormal=",
    "radial=normalize(mix(radial,orbitNormal,smoothstep(.45,1.,tt)*.72));vec3 closeNormal=normalize(vec3(1.,ex*.10,ey*.08));radial=normalize(mix(radial,closeNormal,close*(1.-tt)*.58));vec3 rimNormal=",
    "closed-lid normal flattening",
)
changed |= did

text, did = replace_once(
    text,
    "float d=.25+.64*max(dot(n,l1),0.)+.16*max(dot(n,l2),0.);vec3 base=vec3(.69,.655,.59);",
    "float d=max(dot(n,l1),0.)*.70+max(dot(n,l2),0.)*.24+.19;vec3 base=vec3(.69,.655,.59);",
    "body-matched lid lighting",
)
changed |= did

text, did = replace_once(
    text,
    "float rim=smoothstep(.15,.85,vRim);float closedGate=smoothstep(.72,.98,vClosure);float seamBand=(1.-smoothstep(.015,.075,vBand))*closedGate;float seamDark=seamBand*step(0.,vLid);base*=mix(1.,.58,rim);base*=1.-.18*rim*smoothstep(.45,.95,vClosure);base*=1.-.56*seamDark;float soft=",
    "float rim=smoothstep(.15,.85,vRim);float closedGate=smoothstep(.72,.98,vClosure);float seamBand=(1.-smoothstep(.012,.100,vBand))*closedGate;float seamDark=seamBand*step(0.,vLid);float foldBand=(smoothstep(.10,.17,vBand)-smoothstep(.20,.30,vBand))*closedGate*step(0.,vLid);float edgeAlpha=1.-smoothstep(.60,1.,vBand);base*=vLid>0.?.975:1.015;base*=mix(1.,.60,rim);base*=1.-.14*rim*smoothstep(.45,.95,vClosure);base*=1.-.64*seamDark;base*=1.-.13*foldBand;float soft=",
    "crease, fold and broad orbital fade",
)
changed |= did

text, did = replace_once(
    text,
    "vec3 col=base*d+vec3(.018,.024,.026)*soft;",
    "vec3 col=base*d+vec3(.025,.04,.045)*soft;",
    "body-matched grazing response",
)
changed |= did

text, did = replace_once(
    text,
    "if(uDebug>.5)col=mix(vec3(.08,.52,.92),vec3(1.,.30,.07),step(0.,vLid))*(.55+.45*max(dot(n,l1),0.));outColor=vec4(pow(max(col,vec3(0.)),vec3(1./2.2)),1.);}`;",
    "if(uDebug>.5)col=mix(vec3(.08,.52,.92),vec3(1.,.30,.07),step(0.,vLid))*(.55+.45*max(dot(n,l1),0.));outColor=vec4(pow(max(col,vec3(0.)),vec3(1./2.2)),uDebug>.5?1.:edgeAlpha);}`;",
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
    print("patched V4.42 lids: upper-dominant closure, orbital overlap, body-matched lighting and broad face integration")
else:
    print("V4.42 lid-face integration patch already complete")
