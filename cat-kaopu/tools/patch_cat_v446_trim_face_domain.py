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
    "if(bestP)return{p:bestP,n:bestN};let bd=1e9,bv=null;for(const v of headVerts){const dy=v.p[1]-y,dz=v.p[2]-z,d=dy*dy+dz*dz;if(d<bd){bd=d;bv=v}}if(bv)return{p:[bv.p[0],y,z],n:bv.n.slice()};return{p:[.19,y,z],n:[1,0,0]}",
    "if(bestP)return{p:bestP,n:bestN,valid:1};let bd=1e9,bv=null;for(const v of headVerts){const dy=v.p[1]-y,dz=v.p[2]-z,d=dy*dy+dz*dz;if(d<bd){bd=d;bv=v}}if(bv)return{p:[bv.p[0],y,z],n:bv.n.slice(),valid:0};return{p:[.19,y,z],n:[1,0,0],valid:0}",
    "raw-face validity",
)
replace_once(
    "raw[at(i,j)]={p:r.p.slice(),n:r.n.slice()};smooth[at(i,j)]={p:r.p.slice(),n:r.n.slice()}",
    "raw[at(i,j)]={p:r.p.slice(),n:r.n.slice(),valid:r.valid};smooth[at(i,j)]={p:r.p.slice(),n:r.n.slice()}",
    "grid validity storage",
)
replace_once(
    "out vec3 vN;out vec3 vLocal;out vec2 vEyeCoord;out vec3 vCurves;out float vNearEye;out float vBoundary;out float vBlink;out float vUpperField;",
    "out vec3 vN;out vec3 vLocal;out vec2 vEyeCoord;out vec3 vCurves;out float vNearEye;out float vBoundary;out float vBlink;out float vUpperField;out float vDomain;",
    "vertex domain output",
)
replace_once(
    "float edge=aParam.z,boundary=1.-smoother(edge/.135),field=(1.-boundary)*uPatchStrength;",
    "float edge=aParam.z,domain=aParam.w;if(domain<.34){gl_Position=vec4(2.,2.,2.,1.);vN=vec3(1.,0.,0.);vLocal=aRawPos;vEyeCoord=vec2(9.);vCurves=vec3(0.);vNearEye=0.;vBoundary=1.;vBlink=uBlink;vUpperField=0.;vDomain=0.;return;}float boundary=1.-smoother(edge/.135),field=(1.-boundary)*uPatchStrength;",
    "vertex domain cull",
)
replace_once(
    "vBoundary=boundary;vBlink=blink;vUpperField=upperField;}`;",
    "vBoundary=boundary;vBlink=blink;vUpperField=upperField;vDomain=domain;}`;",
    "vertex domain assignment",
)
replace_once(
    "in float vNearEye;in float vBoundary;in float vBlink;in float vUpperField;uniform float uPatchStrength;",
    "in float vNearEye;in float vBoundary;in float vBlink;in float vUpperField;in float vDomain;uniform float uPatchStrength;",
    "fragment domain input",
)
replace_once(
    "void main(){float hx=vEyeCoord.x,vz=vEyeCoord.y,lower=vCurves.x,upper=vCurves.y,seam=vCurves.z;bool inAperture=",
    "void main(){if(vDomain<.34)discard;float hx=vEyeCoord.x,vz=vEyeCoord.y,lower=vCurves.x,upper=vCurves.y,seam=vCurves.z;bool inAperture=",
    "fragment domain discard",
)
replace_once(
    "eyeR=sqrt(pow(hy/.95,2.)+pow((vz-.03)/1.35,2.)),nearEye=1.-smoothstep(.72,2.30,eyeR)",
    "eyeR=sqrt(pow(hy/.95,2.)+pow((vz-.03)/1.28,2.)),nearEye=1.-smoothstep(.72,1.62,eyeR)",
    "local eye support",
)
replace_once(
    "function buildWideEyeRegionCarrier(mesh,eyeSpecs){\nconst headVerts=[];",
    "function buildWideEyeRegionCarrier(mesh,eyeSpecs){\nfunction max0(x){return x>0?x:0}\nconst headVerts=[];",
    "domain helper",
)
replace_once(
    "const u=i/cols,v=j/rows,edge=Math.min(u,1-u,v,1-v),id=at(i,j);param.push(u,v,edge,0);",
    "const u=i/cols,v=j/rows,id=at(i,j),xn=(u-.5)/.5,zn=(v-.50)/.50,lower=max0(-zn),upperZ=max0(zn),width=.92-.23*lower*lower-.10*upperZ*upperZ,metric=Math.pow(Math.abs(xn)/Math.max(.35,width),3.2)+Math.pow(Math.abs(zn),3.0),domain=(1-Math.min(1,Math.max(0,(metric-.82)/.18)))*(raw[id].valid?1:0),edge=.16*Math.max(0,1-metric);param.push(u,v,edge,domain);",
    "analytic face domain",
)

BUILDER.write_text(text, encoding="utf-8")
print("patched V4.46 carrier: valid projected face domain and localized eye closure support")
