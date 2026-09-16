#!/usr/bin/env python3
"""Build Chicken V4.6 R9.5 from the exact frozen R9.1 executable.

R9.5 replaces the R9.2/R9.3 patch family and the local R9.4 prototype with a
single monotone head carrier.  Upper neck, posterior cranium, crown, cheek,
jaw, forehead and a shortened bill are expressed by one station-wise envelope.
Body, plumage, wings, tail, feet, materials and existing controls remain on the
frozen R9.1 paths.  This remains a visual construction candidate, not measured
anatomy or a breed/sex/individual claim.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "CHICKEN_V46_R9_1.html"
OUTPUT = ROOT / "CHICKEN_V46_R9_5_HEAD_CARRIER.html"
PARAMS = ROOT / "data" / "CHICKEN_R95_HEAD_CARRIER_PARAMETERS.json"
STATIC_QA = ROOT / "qa" / "CHICKEN_R95_STATIC_QA.json"
BROWSER_QA = ROOT / "qa" / "CHICKEN_R95_BROWSER_QA.json"
MANIFEST = ROOT / "BUILD_MANIFEST_R95.json"
STATE = ROOT / "01_CURRENT_STATE.json"
README = ROOT / "README.md"
HANDOFF = ROOT / "CURRENT_HANDOFF.md"
FULL_HANDOFF = ROOT / "CURRENT_FULL_HANDOFF.md"
NEXT_PLAN = ROOT / "06_NEXT_STAGE_PLAN.md"
REVIEW_BOARD = ROOT / "evidence" / "r95" / "R95_REVIEW_BOARD.html"

EXPECTED_SOURCE_SHA256 = "336dc9d32304f916a8f15e120ebf4b9d2429b54dd2719be1af8aca12df33a4e3"
ANCHOR = "const scene=new T.Scene();"
PATCH_MARKER = "CHICKEN_R95_HEAD_CARRIER_PATCH"

JS_OVERRIDE = r'''
// CHICKEN_R95_HEAD_CARRIER_PATCH
// One monotone station carrier replaces the rejected long-wedge patch family.
// The visual reference guides silhouette only; no measured anatomy is claimed.
window.__CHICKEN_R95_PATCH__=Object.freeze({
 version:'V4.6_R9.5_HEAD_CARRIER_CANDIDATE',
 source:'CHICKEN_V46_R9_1.html',
 rejectedPredecessors:['R9.2 full-ring inflation','R9.3 long wedge','R9.4 local prototype throat/eye/soft-tissue gate'],
 method:'angularly staged upper-neck to cranium to jaw to short-bill carrier',
 domain:[.238,.523116],
 preserves:['R9 frozen rollback','R9.1 frozen executable','body','plumage','wing','tail','feet','materials','existing controls'],
 manualVisualAcceptance:false,
 rigAuthorized:false,
 motionAuthorized:false
});
const __r95K=Object.freeze([
 [.246,.835,.030,.010,.028],[.258,.850,.043,.015,.035],
 [.272,.870,.057,.021,.044],[.288,.892,.069,.030,.055],
 [.306,.912,.078,.042,.068],[.326,.927,.082,.052,.078],
 [.348,.934,.083,.058,.083],[.372,.934,.080,.059,.083],
 [.394,.930,.073,.056,.078],[.414,.925,.063,.050,.070],
 [.431,.924,.051,.041,.060],[.445,.930,.038,.031,.050],
 [.458,.936,.027,.022,.040],[.470,.938,.020,.016,.032],
 [.482,.936,.013,.010,.023],[.493,.933,.007,.005,.014],
 [.503,.930,.002,.002,.004]
]);
function __r95Sample(x,col){
 const xx=clamp(x,__r95K[0][0],__r95K[__r95K.length-1][0]);
 let k=1;while(k<__r95K.length&&xx>__r95K[k][0])k++;
 if(k>=__r95K.length)return __r95K[__r95K.length-1][col];
 const A=__r95K[k-1],B=__r95K[k],t=(xx-A[0])/(B[0]-A[0]),q=t*t*(3-2*t);
 return A[col]*(1-q)+B[col]*q;
}
function __r95Profile(x,ctrl={head_scale:1}){
 const xx=clamp(x,__r95K[0][0],__r95K[__r95K.length-1][0]),hs=ctrl.head_scale||1;
 const headScale=1+(hs-1)*ss(.252,.304,xx)*(1-ss(.432,.490,xx));
 return [__r95Sample(xx,1),__r95Sample(xx,2)*headScale,__r95Sample(xx,3)*headScale,__r95Sample(xx,4)*headScale];
}
function __r95MappedX(x,ctrl={beak_length:1}){
 const root=.432,scale=.62*(ctrl.beak_length||1);
 return x<=root?x:root+(x-root)*scale;
}
function __r95Target(x,j,ctrl){
 const [cy,rt,rb,rz]=__r95Profile(x,ctrl),th=2*Math.PI*j/96,c=Math.cos(th),sn=Math.sin(th);
 let y=cy+(c<0?rt*Math.pow(-c,.92):-rb*Math.pow(c,.88));
 const cheek=Math.exp(-Math.pow((x-.382)/.045,2)-Math.pow((y-.910)/.042,2));
 const jaw=Math.exp(-Math.pow((x-.407)/.034,2)-Math.pow((y-.883)/.027,2));
 const bill=ss(.430,.500,x);
 const lat=rz*(1+.13*cheek+.08*jaw)*(1-.08*bill);
 y-=.0028*jaw;
 return [__r95MappedX(x,ctrl),y,.09-lat*sn];
}
function __r95ShellTop(x,ctrl){const [cy,rt]=__r95Profile(x,ctrl);return cy+rt;}
function __r95ShellZ(x,y,side,ctrl){
 const [cy,rt,rb,rz]=__r95Profile(x,ctrl),rv=y>=cy?rt:rb,q=Math.max(.003,1-Math.pow((y-cy)/Math.max(rv,1e-6),2));
 const cheek=Math.exp(-Math.pow((x-.382)/.045,2)-Math.pow((y-.910)/.042,2));
 const jaw=Math.exp(-Math.pow((x-.407)/.034,2)-Math.pow((y-.883)/.027,2));
 return .09+side*rz*(1+.13*cheek+.08*jaw)*Math.sqrt(q);
}
applyHeadTopR91=function(input,amount,ctrl){
 const p=input.slice(),a=clamp(amount,0,1),rows=72,cols=96;
 let moved=0,maxDisplacement=0,nonFinite=0,nonHeadMoved=0,previous=-Infinity,monotonic=true;
 for(let r=0;r<rows;r++){
  const start=r*cols*3,x=p[start];if(x<.236)continue;
  for(let j=0;j<cols;j++){
   const q=start+j*3,ox=p[q],oy=p[q+1],oz=p[q+2],c=Math.cos(2*Math.PI*j/cols),topness=(1-c)*.5;
   const startX=.238+.055*Math.pow(1-topness,1.35),endX=.284+.061*Math.pow(1-topness,1.28);
   const staged=ss(startX,endX,x),face=ss(.405,.440,x),w=a*(1-(1-staged)*(1-face));
   if(w<=0)continue;
   const t=__r95Target(x,j,ctrl);
   p[q]+=(t[0]-p[q])*w;p[q+1]+=(t[1]-p[q+1])*w;p[q+2]+=(t[2]-p[q+2])*w;
   const d=Math.hypot(p[q]-ox,p[q+1]-oy,p[q+2]-oz);
   if(d>1e-8){moved++;maxDisplacement=Math.max(maxDisplacement,d);if(oy<.76)nonHeadMoved++;}
   if(!Number.isFinite(p[q])||!Number.isFinite(p[q+1])||!Number.isFinite(p[q+2]))nonFinite++;
  }
  const sx=p[start];if(sx<=previous)monotonic=false;previous=sx;
 }
 for(let q=rows*cols*3;q<p.length;q+=3){
  if(p[q]>.40){const ox=p[q],oy=p[q+1],oz=p[q+2],tx=__r95MappedX(.52293766,ctrl);p[q]+=(tx-p[q])*a;p[q+1]+=(.930-p[q+1])*a;p[q+2]+=(.09-p[q+2])*a;const d=Math.hypot(p[q]-ox,p[q+1]-oy,p[q+2]-oz);if(d>1e-8){moved++;maxDisplacement=Math.max(maxDisplacement,d);}}
 }
 let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
 for(let i=0;i<p.length;i+=3){minX=Math.min(minX,p[i]);minY=Math.min(minY,p[i+1]);minZ=Math.min(minZ,p[i+2]);maxX=Math.max(maxX,p[i]);maxY=Math.max(maxY,p[i+1]);maxZ=Math.max(maxZ,p[i+2]);}
 const audit={amount:a,movedVertices:moved,maxDisplacement,nonFinite,nonHeadMoved,stationXMonotonic:monotonic,bounds:{min:[minX,minY,minZ],max:[maxX,maxY,maxZ]}};
 if(a>.5)window.__CHICKEN_R95_LAST_HEAD_AUDIT__=audit;else window.__CHICKEN_R95_LAST_ROLLBACK_AUDIT__=audit;
 window.__CHICKEN_R95_PROFILE_AUDIT__={
  crownTop:__r95ShellTop(.348,ctrl),posteriorWidth:2*__r95Profile(.348,ctrl)[3],
  cheekWidth:2*__r95Profile(.394,ctrl)[3],jawBottom:__r95Profile(.407,ctrl)[0]-__r95Profile(.407,ctrl)[3],
  mappedBillTip:__r95MappedX(.52293766,ctrl),billRoot:.432
 };
 return p;
};
buildCombR91=function(chart,ctrl,amount=1){
 const P=[],I=[],UV=[],SEED=[],ZONE=[],LC=[],nx=160,na=32,x0=.282,x1=.448,a=clamp(amount,0,1);
 const lobes=[[.296,.018,.017],[.329,.060,.025],[.367,.050,.023],[.402,.035,.021],[.432,.020,.018]];
 const height=x=>{let raw=.0042;for(const [px,amp,w] of lobes)raw+=amp*Math.exp(-Math.pow(Math.abs((x-px)/w),2.7));const edge=ss(x0,x0+.012,x)*(1-ss(x1-.012,x1,x));return (.0013+(raw-.0013)*edge)*ctrl.comb_height*a;};
 for(let i=0;i<=nx;i++){const u=i/nx,x=x0+(x1-x0)*u,base=__r95ShellTop(x,ctrl)-.0065,h=height(x),cy=base+.45*h,hy=.58*h,hz=.0084*ctrl.comb_thickness;
  for(let j=0;j<na;j++){const th=2*Math.PI*j/na,c=Math.cos(th),s=Math.sin(th),v=.5+.5*c,lean=.0046*v*Math.min(1,h/.060);P.push(__r95MappedX(x,ctrl)-lean,cy+hy*c,.09+hz*s*(.76+.24*(1-v)));UV.push(u,j/na);SEED.push(.27+.48*u);ZONE.push(20);LC.push(u,c,s);}}
 for(let i=0;i<nx;i++)for(let j=0;j<na;j++){const a0=i*na+j,b=(i+1)*na+j,c=(i+1)*na+(j+1)%na,d=i*na+(j+1)%na;I.push(a0,d,b,b,d,c);}
 let deg=0;for(let k=0;k<I.length;k+=3){const a0=I[k]*3,b=I[k+1]*3,c=I[k+2]*3,ux=P[b]-P[a0],uy=P[b+1]-P[a0+1],uz=P[b+2]-P[a0+2],vx=P[c]-P[a0],vy=P[c+1]-P[a0+1],vz=P[c+2]-P[a0+2],cx=uy*vz-uz*vy,cy=uz*vx-ux*vz,cz=ux*vy-uy*vx;if(cx*cx+cy*cy+cz*cz<1e-18)deg++;}
 return{positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2},seed:{array:new Float32Array(SEED),size:1},zone:{array:new Float32Array(ZONE),size:1},localCoord:{array:new Float32Array(LC),size:3}},audit:{finite:P.every(Number.isFinite),degenerateTriangles:deg,passed:P.every(Number.isFinite)&&deg===0,sections:nx+1,lobes:lobes.length,continuousBlade:true,embeddedRoot:true}};
};
buildSurfaceEyesR9=function(chart,ctrl,amount){
 const out=[];for(const side of [-1,1]){const cx=.3825,cy=.9480,rx=.0153*ctrl.head_scale*ctrl.eye_scale,ry=.0140*ctrl.head_scale*ctrl.eye_scale,tilt=-.035;
  const map=(ang,r,bump)=>{const dx=Math.cos(ang)*rx*r,dy=Math.sin(ang)*ry*r,x=cx+dx*Math.cos(tilt)-dy*Math.sin(tilt),y=cy+dx*Math.sin(tilt)+dy*Math.cos(tilt);return chart.at(x,y,side,bump*amount)};
  const P=[],I=[],UV=[],na=64,nr=8,c=map(0,0,.0032);if(!c)continue;P.push(...c.p.toArray());UV.push(0,0);
  for(let ri=1;ri<=nr;ri++){const rr=ri/nr;for(let j=0;j<na;j++){const aa=2*Math.PI*j/na,q=map(aa,rr,.00040+.00275*(1-rr*rr));if(!q){P.length=0;break;}P.push(...q.p.toArray());UV.push(Math.cos(aa)*rr,Math.sin(aa)*rr);}if(!P.length)break;}if(!P.length)continue;
  for(let j=0;j<na;j++){const b=1+j,d=1+(j+1)%na;if(side>0)I.push(0,d,b);else I.push(0,b,d);}for(let ri=1;ri<nr;ri++)for(let j=0;j<na;j++){const a0=1+(ri-1)*na+j,b=1+(ri-1)*na+(j+1)%na,d=1+ri*na+j,e=1+ri*na+(j+1)%na;if(side>0)I.push(a0,d,b,b,d,e);else I.push(a0,b,d,b,e,d);}out.push({positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2}},kind:'iris'});
  const LP=[],LI=[],LUV=[];let off=0;function arc(a0,a1,outer,upper){const n=44,start=off;for(let k=0;k<=n;k++){const t=k/n,aa=a0+(a1-a0)*t,tap=.04+.96*Math.pow(Math.sin(Math.PI*t),.82);for(const rr of [1.015,1.015+outer*tap]){const q=map(aa,rr,(upper?.00105:.00075)+.00072*tap);if(!q)return false;LP.push(...q.p.toArray());LUV.push(Math.cos(aa)*rr,Math.sin(aa)*rr);off++;}}for(let k=0;k<n;k++){const aa=start+2*k,b=aa+1,c=aa+2,d=aa+3;if(side>0)LI.push(aa,c,b,b,c,d);else LI.push(aa,b,c,b,d,c);}return true;}
  if(arc(.08*Math.PI,.92*Math.PI,.082,true)&&arc(1.10*Math.PI,1.90*Math.PI,.055,false))out.push({positions:new Float32Array(LP),indices:new Uint32Array(LI),attrs:{uv:{array:new Float32Array(LUV),size:2}},kind:'lid'});
 }
 return out.length===4?out:[];
};
buildEarLobesR9=function(chart,ctrl,amount){const out=[];for(const side of [-1,1]){const cx=.350,cy=.912,rx=.0048*ctrl.head_scale*ctrl.soft_tissue_scale,ry=.0072*ctrl.head_scale*ctrl.soft_tissue_scale,tilt=-.18,na=40,nr=5,P=[],I=[],UV=[],center=chart.at(cx,cy,side,.00055*amount);if(!center)continue;P.push(...center.p.toArray());UV.push(0,0);for(let ri=1;ri<=nr;ri++){const rr=ri/nr;for(let j=0;j<na;j++){const aa=2*Math.PI*j/na,dx=Math.cos(aa)*rx*rr,dy=Math.sin(aa)*ry*rr,x=cx+dx*Math.cos(tilt)-dy*Math.sin(tilt),y=cy+dx*Math.sin(tilt)+dy*Math.cos(tilt),q=chart.at(x,y,side,(.00014+.00036*(1-rr*rr))*amount);if(!q){P.length=0;break;}P.push(...q.p.toArray());UV.push(Math.cos(aa)*rr,Math.sin(aa)*rr);}if(!P.length)break;}if(!P.length)continue;for(let j=0;j<na;j++){const b=1+j,d=1+(j+1)%na;if(side>0)I.push(0,d,b);else I.push(0,b,d);}for(let ri=1;ri<nr;ri++)for(let j=0;j<na;j++){const aa=1+(ri-1)*na+j,b=1+(ri-1)*na+(j+1)%na,d=1+ri*na+j,e=1+ri*na+(j+1)%na;if(side>0)I.push(aa,d,b,b,d,e);else I.push(aa,b,d,b,e,d);}out.push({positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2}},kind:'lid'});}return out;};
buildNostrilsR9=function(chart,ctrl,amount){const out=[];for(const side of [-1,1]){const cx=__r95MappedX(.454,ctrl),cy=.9470,rx=.00345*ctrl.head_scale,ry=.00155*ctrl.head_scale,tilt=-.12,na=36,nr=4,P=[],I=[],UV=[],center=chart.at(cx,cy,side,.00017*amount);if(!center)continue;P.push(...center.p.toArray());UV.push(0,0);for(let ri=1;ri<=nr;ri++){const rr=ri/nr;for(let j=0;j<na;j++){const aa=2*Math.PI*j/na,dx=Math.cos(aa)*rx*rr,dy=Math.sin(aa)*ry*rr,x=cx+dx*Math.cos(tilt)-dy*Math.sin(tilt),y=cy+dx*Math.sin(tilt)+dy*Math.cos(tilt),q=chart.at(x,y,side,(.00012+.00020*(1-rr*rr))*amount);if(!q){P.length=0;break;}P.push(...q.p.toArray());UV.push(Math.cos(aa)*rr,Math.sin(aa)*rr);}if(!P.length)break;}if(!P.length)continue;for(let j=0;j<na;j++){const b=1+j,d=1+(j+1)%na;if(side>0)I.push(0,d,b);else I.push(0,b,d);}for(let ri=1;ri<nr;ri++)for(let j=0;j<na;j++){const aa=1+(ri-1)*na+j,b=1+(ri-1)*na+(j+1)%na,d=1+ri*na+j,e=1+ri*na+(j+1)%na;if(side>0)I.push(aa,d,b,b,d,e);else I.push(aa,b,d,b,e,d);}out.push({positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2}},kind:'nostril'});}return out;};
buildSoftTissueR9=function(ctrl,chart,amount){
 const out=[];for(const side of [-1,1]){const ns=42,na=28,P=[],I=[],root=chart.at(.410,.894,side,.00025*amount);if(!root)continue;
  for(let i=0;i<ns;i++){const s=i/(ns-1),shape=.06+.94*Math.pow(Math.sin(Math.PI*s),.66)*( .74+.26*s),outward=ss(.02,.30,s),cx=.410-.017*s-.004*Math.sin(Math.PI*s),cy=.894-.050*s-.006*Math.sin(Math.PI*s),targetZ=.09+side*(.074-.004*s),cz=root.p.z*(1-outward)+targetZ*outward,rx=.0128*shape*ctrl.soft_tissue_scale,rz=.0067*shape*ctrl.soft_tissue_scale;for(let j=0;j<na;j++){const aa=2*Math.PI*j/na;P.push(cx+rx*Math.cos(aa),cy,cz+side*rz*Math.sin(aa));}}
  for(let i=0;i<ns-1;i++)for(let j=0;j<na;j++){const aa=i*na+j,b=i*na+(j+1)%na,c=(i+1)*na+(j+1)%na,d=(i+1)*na+j;if(side>0)I.push(aa,d,b,b,d,c);else I.push(aa,b,d,b,c,d);}out.push({positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{},kind:'lid'});
 }
 return out;
};
const __r95BaseUpdateState=updateState;
updateState=function(){
 __r95BaseUpdateState();
 if($('status'))$('status').textContent=`R9.5 · 一体化头部候选 · ${stats.eyePatches||0} 个眼部片 · ${stats.earPatches||0} 个耳叶片`;
 if($('notes'))$('notes').innerHTML='R9.5 从冻结 R9.1 重新生成：上颈、后脑、颅顶、脸颊、下颌与短喙使用同一单调承载体；眼、鼻孔、耳叶、肉垂和连续单冠重新贴合。<br>当前仍是视觉构形候选，不代表已确认品种、性别、年龄或个体测量；Rig 与 Motion 保持关闭。';
 if(window.__CHICKEN_V46_STATE__){Object.assign(window.__CHICKEN_V46_STATE__,{version:'V4.6_R9_5',visualSelfReviewPassed:false,manualVisualAcceptance:false,wholeVisualGatePassed:false,rigAuthorized:false,productionReady:false,effectReview:'r95_head_carrier_candidate_pending_independent_visual_review'});}
};
'''.strip()

VISIBLE_REPLACEMENTS = {
    "<title>Chicken R9.1 · Final Silhouette & Head Top Gate</title>": "<title>Chicken R9.5 · Integrated Head Carrier Candidate</title>",
    "鸡 · R9.1 · 最终轮廓与头顶收敛": "鸡 · R9.5 · 一体化头部承载体候选",
    "冻结 R9 作为前版 · 重塑头顶、单冠连续叶片与面部材质边界 · 继续检查全身轮廓": "从冻结 R9.1 重建 · 上颈、后脑、颅顶、脸颊、下颌与短喙使用同一承载体",
    "后：R9.1 头顶与轮廓": "后：R9.5 一体化头部候选",
    "在 R9 可回退基线上修正头顶与单冠": "在冻结 R9.1 上验证一体化鸡头承载体",
    "R9.1 当前候选": "R9.5 当前候选",
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def node_syntax_ok(source: str) -> tuple[bool, str]:
    with tempfile.NamedTemporaryFile("w", suffix=".mjs", delete=False, encoding="utf-8") as stream:
        stream.write(source)
        name = stream.name
    try:
        result = subprocess.run(["node", "--check", name], capture_output=True, text=True)
        return result.returncode == 0, result.stderr.strip()
    finally:
        Path(name).unlink(missing_ok=True)


def build_html() -> dict[str, Any]:
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)
    source_hash = sha256(SOURCE)
    if source_hash != EXPECTED_SOURCE_SHA256:
        raise RuntimeError(f"Frozen R9.1 source hash mismatch: {source_hash}")
    source = SOURCE.read_text(encoding="utf-8")
    if source.count(ANCHOR) != 1:
        raise RuntimeError(f"Expected one scene anchor, found {source.count(ANCHOR)}")
    for marker in ["CHICKEN_R92_HEAD_SHAPE_PATCH", "CHICKEN_R93_HEAD_SHAPE_PATCH", "CHICKEN_R94_INTEGRATED_HEAD_CARRIER_PATCH", PATCH_MARKER]:
        if marker in source:
            raise RuntimeError(f"Frozen source already contains {marker}")
    patched = source.replace(ANCHOR, JS_OVERRIDE + "\n" + ANCHOR, 1)
    replacements: dict[str, bool] = {}
    for old, new in VISIBLE_REPLACEMENTS.items():
        replacements[old] = old in patched
        if old in patched:
            patched = patched.replace(old, new, 1)
    pill = '<span class="pill">R9.5：一体化头部候选 · 技术门与视觉门分离</span>'
    patched = patched.replace("</header>", pill + "</header>", 1)
    OUTPUT.write_text(patched, encoding="utf-8")
    syntax_ok, syntax_stderr = node_syntax_ok(JS_OVERRIDE)
    return {
        "source_sha256": source_hash,
        "output_sha256": sha256(OUTPUT),
        "source_bytes": SOURCE.stat().st_size,
        "output_bytes": OUTPUT.stat().st_size,
        "byte_delta": OUTPUT.stat().st_size - SOURCE.stat().st_size,
        "anchor_count": source.count(ANCHOR),
        "patch_marker_count": patched.count(PATCH_MARKER),
        "visible_replacements": replacements,
        "patch_node_syntax": syntax_ok,
        "patch_node_stderr": syntax_stderr,
        "source_preserved": sha256(SOURCE) == EXPECTED_SOURCE_SHA256,
    }


def write_parameters() -> None:
    write_json(PARAMS, {
        "schema": "life_ecosystem/chicken_head_shape_candidate@1.0",
        "version": "V4.6_R9.5",
        "status": "integrated_visual_candidate_not_anatomical_truth",
        "units": "normalized_source_units_not_meters",
        "source": {
            "frozen_executable": SOURCE.name,
            "sha256": EXPECTED_SOURCE_SHA256,
            "approved_visual_reference": "reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png",
            "rejected_predecessors": ["R9.2 full-ring inflation", "R9.3 long wedge", "R9.4 throat/eye/soft-tissue prototype gate"],
        },
        "carrier": {
            "method": "angularly staged monotone station carrier",
            "x_domain": [0.238, 0.523116],
            "bill_root": 0.432,
            "bill_scale": 0.62,
            "upper_blend_start": 0.238,
            "lower_blend_start": 0.293,
            "full_lower_head_by_x": 0.345,
            "profile_knots": [list(row) for row in [
                (.246,.835,.030,.010,.028),(.258,.850,.043,.015,.035),(.272,.870,.057,.021,.044),
                (.288,.892,.069,.030,.055),(.306,.912,.078,.042,.068),(.326,.927,.082,.052,.078),
                (.348,.934,.083,.058,.083),(.372,.934,.080,.059,.083),(.394,.930,.073,.056,.078),
                (.414,.925,.063,.050,.070),(.431,.924,.051,.041,.060),(.445,.930,.038,.031,.050),
                (.458,.936,.027,.022,.040),(.470,.938,.020,.016,.032),(.482,.936,.013,.010,.023),
                (.493,.933,.007,.005,.014),(.503,.930,.002,.002,.004),
            ]],
        },
        "local_modules": {
            "comb": "continuous thick five-lobe single comb with broad embedded root",
            "eyes": "larger shallow eye surface plus asymmetric upper/lower eyelid annuli",
            "ear_lobes": "smaller lower post-orbital patches",
            "nostrils": "paired patches remapped to shortened bill",
            "wattles": "paired attached teardrop tubes rooted at jaw surface",
        },
        "preserved": ["R9 and R9.1 rollback", "body below upper neck", "plumage", "wings", "tail", "feet", "materials", "existing controls"],
        "truth_boundary": {"manual_visual_acceptance": False, "whole_visual_gate_passed": False, "rig_authorized": False, "motion_authorized": False, "anatomical_truth_claimed": False},
    })


def write_static_qa(build: dict[str, Any]) -> None:
    checks = {
        "frozen_source_hash_matches": build["source_sha256"] == EXPECTED_SOURCE_SHA256,
        "frozen_source_preserved": build["source_preserved"],
        "single_scene_anchor": build["anchor_count"] == 1,
        "single_patch_marker": build["patch_marker_count"] == 1,
        "output_created": OUTPUT.exists(),
        "output_larger_than_source": build["output_bytes"] > build["source_bytes"],
        "all_visible_replacement_anchors_found": all(build["visible_replacements"].values()),
        "patch_node_syntax": build["patch_node_syntax"],
        "no_rejected_patch_markers": all(marker not in OUTPUT.read_text(encoding="utf-8") for marker in ["CHICKEN_R92_HEAD_SHAPE_PATCH", "CHICKEN_R93_HEAD_SHAPE_PATCH", "CHICKEN_R94_INTEGRATED_HEAD_CARRIER_PATCH"]),
    }
    write_json(STATIC_QA, {
        "schema": "life_ecosystem/chicken_r95_static_qa@1.0",
        "version": "V4.6_R9.5_HEAD_CARRIER_CANDIDATE",
        "checks": checks,
        "passed": all(checks.values()),
        "build": build,
        "scope": "source integrity and patch syntax; browser geometry and visual gates are separate",
    })
    if not all(checks.values()):
        raise RuntimeError(f"Static QA failed: {[k for k,v in checks.items() if not v]}")


def write_review_board() -> None:
    REVIEW_BOARD.parent.mkdir(parents=True, exist_ok=True)
    items = [
        ("批准的视觉构形参考", "../../reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png"),
        ("R9.1 冻结侧面", "R91_BASELINE_HEAD_NEUTRAL_LEFT.png"),
        ("R9.5 左侧", "R95_HEAD_NEUTRAL_LEFT.png"),
        ("R9.5 右侧", "R95_HEAD_NEUTRAL_RIGHT.png"),
        ("R9.5 正面", "R95_HEAD_NEUTRAL_FRONT.png"),
        ("R9.5 顶部", "R95_HEAD_NEUTRAL_TOP.png"),
        ("R9.5 三分之四", "R95_HEAD_NEUTRAL_THREE_QUARTER.png"),
        ("R9.5 左侧线框", "R95_HEAD_WIRE_LEFT.png"),
        ("R9.5 全身中性灰", "R95_WHOLE_NEUTRAL_THREE_QUARTER.png"),
        ("R9.5 全身程序材质", "R95_WHOLE_PROCEDURAL_THREE_QUARTER.png"),
    ]
    cards = "\n".join(f'<figure><img src="{src}" alt="{title}"><figcaption>{title}</figcaption></figure>' for title,src in items)
    REVIEW_BOARD.write_text(f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chicken R9.5 视觉审查板</title><style>*{{box-sizing:border-box}}body{{margin:0;background:#171f25;color:#edf1f1;font:14px/1.55 system-ui,-apple-system,Segoe UI,Microsoft Yahei,sans-serif}}header{{padding:24px 28px;border-bottom:1px solid #344149}}h1{{margin:0 0 7px;font-size:22px}}p{{margin:5px 0;color:#b9c6c6}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;padding:20px}}figure{{margin:0;background:#10171c;border:1px solid #35434a;border-radius:8px;overflow:hidden}}img{{display:block;width:100%;height:360px;object-fit:contain;background:#182027}}figcaption{{padding:10px 12px;color:#d9e2e1}}.gate{{margin:0 20px 24px;padding:15px;border-left:4px solid #c59c61;background:#222a2f}}</style></head><body><header><h1>Chicken V4.6 R9.5 · 一体化头部承载体候选</h1><p>参考图只作为视觉构形锚点，不代表测量解剖、品种、性别、年龄或个体真值。</p></header><main class="grid">{cards}</main><section class="gate"><b>当前门槛：</b>源码、浏览器和有界几何检查可以自动通过；最终形态仍需独立视觉审查，Rig 与 Motion 保持关闭。</section></body></html>''', encoding="utf-8")


def write_state_and_handoff(browser_ok: bool) -> None:
    write_json(STATE, {
        "schema": "life_ecosystem/chicken_module_state@1.0",
        "version": "V4.6_R9.5_HEAD_CARRIER_CANDIDATE",
        "date": "2026-09-16",
        "identity": {"species_scope": "domestic chicken surface candidate", "sex": "unknown", "breed": "unknown", "age": "unknown", "real_world_scale": "unknown"},
        "active_entry": OUTPUT.name,
        "frozen_r9_1_baseline": SOURCE.name,
        "approved_head_reference": "reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png",
        "candidate_parameters": str(PARAMS.relative_to(ROOT)),
        "review_board": str(REVIEW_BOARD.relative_to(ROOT)),
        "head_status": {"r9_2_visual_gate_passed": False, "r9_3_visual_gate_passed": False, "r9_4_visual_gate_passed": False, "r9_5_candidate_built": True, "r9_5_browser_qa_passed": browser_ok, "manual_visual_acceptance": False},
        "qa": {"technical_gate_passed": browser_ok, "current_executable_reproducible": True, "whole_visual_gate_passed": False, "canonical_chicken_surface_complete": False, "rig_authorized": False, "motion_implemented": False, "production_ready": False, "public_https_published": True},
        "next_stage": "INDEPENDENT_VISUAL_AUDIT_R95_THEN_BOUNDED_REFINEMENT",
    })
    text = f'''# Chicken V4.6 R9.5 — Integrated Head Carrier Candidate

## Active executable

`{OUTPUT.name}`

## Frozen rollback

- exact R9.1 executable: `{SOURCE.name}`
- exact R9 executable: `history/CHICKEN_V46_R9_FROZEN.html`

## What changed

R9.5 uses one angularly staged, monotone carrier from upper neck through posterior cranium, crown, cheek, jaw and a shortened bill. The lower head joins progressively rather than remaining a vertical slab or inflating the full neck ring. Eye, eyelid, nostril, ear-lobe, wattle and continuous-comb modules are reprojected to that carrier.

## Evidence and QA

- parameters: `{PARAMS.relative_to(ROOT)}`
- static QA: `{STATIC_QA.relative_to(ROOT)}`
- browser QA: `{BROWSER_QA.relative_to(ROOT)}`
- visual review board: `{REVIEW_BOARD.relative_to(ROOT)}`
- manifest: `{MANIFEST.name}`

Browser QA passed: `{str(browser_ok).lower()}`.

## Truth boundary

This remains a visual construction candidate. It does not establish measured skull anatomy, breed, sex, age or individual identity. Manual visual acceptance, whole-surface freeze, Rig and Motion remain closed.
'''
    for path in [README, HANDOFF, FULL_HANDOFF]:
        path.write_text(text, encoding="utf-8")
    NEXT_PLAN.write_text("""# Next Stage — Chicken R9.5 Independent Visual Audit

1. Compare left, right, front, top and three-quarter neutral views with the approved construction reference.
2. Check the upper-neck-to-cranium blend, cheek/jaw support and short-bill closure before any local detail polishing.
3. Check the eye/eyelid scale, continuous comb root and attached wattle silhouette.
4. Reject or apply only bounded local corrections; do not reopen body, wing, tail or feet.
5. Keep Rig, skin binding and motion blocked until the whole-head silhouette is accepted.
""", encoding="utf-8")


def write_manifest() -> None:
    files = [OUTPUT, SOURCE, PARAMS, STATIC_QA, BROWSER_QA, STATE, README, HANDOFF, FULL_HANDOFF, NEXT_PLAN, REVIEW_BOARD]
    files.extend(sorted(REVIEW_BOARD.parent.glob("*.png")))
    entries = []
    for path in files:
        if path.exists():
            entries.append({"path": str(path.relative_to(ROOT)), "bytes": path.stat().st_size, "sha256": sha256(path)})
    write_json(MANIFEST, {"schema": "life_ecosystem/build_manifest@1.0", "package": "CHICKEN_V4_6_R9_5_HEAD_CARRIER_CANDIDATE_2026-09-16", "active_entry": OUTPUT.name, "frozen_source": SOURCE.name, "frozen_source_sha256": EXPECTED_SOURCE_SHA256, "manual_visual_acceptance": False, "files": entries})


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--finalize", action="store_true")
    args = parser.parse_args()
    build = build_html()
    write_parameters()
    write_static_qa(build)
    if args.finalize:
        browser_ok = False
        if BROWSER_QA.exists():
            try:
                browser_ok = bool(json.loads(BROWSER_QA.read_text(encoding="utf-8")).get("passed"))
            except Exception:
                browser_ok = False
        write_review_board()
        write_state_and_handoff(browser_ok)
        write_manifest()
    print(json.dumps({"built": str(OUTPUT), "sha256": build["output_sha256"], "browser_ok": BROWSER_QA.exists() and json.loads(BROWSER_QA.read_text(encoding="utf-8")).get("passed", False)}, ensure_ascii=False, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
