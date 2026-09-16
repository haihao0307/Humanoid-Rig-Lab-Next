from __future__ import annotations

from pathlib import Path

WORKBENCH = Path(__file__).resolve().parent.parent / "workbench/CAT_KAOPU_CURRENT.html"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one marker, found {count}")
    return text.replace(old, new, 1)


text = WORKBENCH.read_text(encoding="utf-8")
if "const orbitVS=`#version 300 es" in text:
    print("V4.43 orbital shaders already present")
    raise SystemExit(0)

shaders = r'''const orbitVS=`#version 300 es
precision highp float;layout(location=0)in vec4 aParam;layout(location=1)in vec3 aInnerPos;layout(location=2)in vec3 aInnerNor;layout(location=3)in vec3 aOuterPos;layout(location=4)in vec3 aOuterNor;uniform mat4 uPV;uniform mat4 uHead;uniform float uBlink;uniform float uStrength;uniform float uCompression;out vec3 vN;out float vBand;out float vLid;out float vBlink;out float vCanthus;float smooth01(float x){x=clamp(x,0.,1.);return x*x*(3.-2.*x);}void main(){float ex=aParam.x,t=aParam.y,lid=aParam.z,hx=clamp(ex/.995,-1.,1.),apx=hx/.52,apq=sqrt(max(0.,1.-apx*apx)),canthus=smoothstep(.02,.22,apq),tt=smooth01(t),blink=smooth01(uBlink),innerW=(1.-tt)*canthus,compress=uCompression*blink*innerW;vec3 n=normalize(mix(aInnerNor,aOuterNor,tt)),p=mix(aInnerPos,aOuterPos,tt);float lift=(.00005+.00022*uStrength)*(1.-tt)*canthus;p+=n*lift;p.x+=compress*(lid>0.?.00042:.00014);p.z+=compress*(lid>0.?-.00016:.00007)*apq;vec3 softN=normalize(vec3(.90,hx*.10,lid>0.?.18:-.10));n=normalize(mix(n,softN,compress*.28));vec4 wp=uHead*vec4(p,1.);gl_Position=uPV*wp;vN=normalize(mat3(uHead)*n);vBand=tt;vLid=lid;vBlink=blink;vCanthus=canthus;}`;
const orbitFS=`#version 300 es
precision highp float;in vec3 vN;in float vBand;in float vLid;in float vBlink;in float vCanthus;uniform float uStrength;uniform float uDebug;out vec4 outColor;void main(){vec3 n=normalize(vN),l1=normalize(vec3(.45,-.55,.82)),l2=normalize(vec3(-.62,.35,.35));float d=max(dot(n,l1),0.)*.70+max(dot(n,l2),0.)*.24+.19;float inner=1.-smoothstep(.05,.42,vBand),compression=inner*vBlink,fold=(smoothstep(.08,.18,vBand)-smoothstep(.22,.34,vBand))*vBlink*step(0.,vLid);vec3 base=vec3(.69,.655,.59);base*=1.-.08*compression-.06*fold;vec3 col=base*d+vec3(.025,.04,.045)*pow(1.-max(dot(n,normalize(vec3(.2,-.4,.9))),0.),2.);if(uDebug>.5)col=mix(vec3(.11,.76,.96),vec3(.98,.34,.12),step(0.,vLid))*(.52+.48*max(dot(n,l1),0.));float alpha=uDebug>.5?1.:clamp(uStrength*(1.-smoothstep(.76,1.,vBand))*vCanthus,0.,.94);outColor=vec4(pow(max(col,vec3(0.)),vec3(1./2.2)),alpha);}`;
'''
text = replace_once(text, "const lidVS=`#version 300 es", shaders + "const lidVS=`#version 300 es", "shader insertion")
text = replace_once(
    text,
    "const pr=program(gl,vs,fs),lpr=program(gl,lineVS,lineFS),lidPr=program(gl,lidVS,lidFS);gl.useProgram(pr);",
    "const pr=program(gl,vs,fs),lpr=program(gl,lineVS,lineFS),orbitPr=program(gl,orbitVS,orbitFS),lidPr=program(gl,lidVS,lidFS);gl.useProgram(pr);",
    "program creation",
)
WORKBENCH.write_text(text, encoding="utf-8")
print("patched V4.43 orbital vertex and fragment shaders")
