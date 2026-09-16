#!/usr/bin/env python3
"""Build Chicken V4.6 R9.3 from the exact frozen R9.1 executable.

R9.2 passed static/browser execution but failed the independent silhouette review:
its full-ring deformation inflated the neck/head carrier into a long wedge. R9.3
therefore starts again from frozen R9.1, keeps every non-head system intact, and
uses only upper-head-local fields plus a station-safe bill shortening.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "CHICKEN_V46_R9_1.html"
OUTPUT = ROOT / "CHICKEN_V46_R9_3_HEAD_SHAPE.html"
PARAMS = ROOT / "data" / "CHICKEN_R93_HEAD_SHAPE_PARAMETERS.json"
STATIC_QA = ROOT / "qa" / "CHICKEN_R93_STATIC_QA.json"
BROWSER_QA = ROOT / "qa" / "CHICKEN_R93_BROWSER_QA.json"
MANIFEST = ROOT / "BUILD_MANIFEST_R93.json"
STATE = ROOT / "01_CURRENT_STATE.json"
README = ROOT / "README.md"
HANDOFF = ROOT / "CURRENT_HANDOFF.md"
FULL_HANDOFF = ROOT / "CURRENT_FULL_HANDOFF.md"
NEXT_PLAN = ROOT / "06_NEXT_STAGE_PLAN.md"
REVIEW_BOARD = ROOT / "evidence" / "r93" / "R93_REVIEW_BOARD.html"

EXPECTED_SOURCE_SHA256 = "336dc9d32304f916a8f15e120ebf4b9d2429b54dd2719be1af8aca12df33a4e3"
ANCHOR = "const scene=new T.Scene();"
PATCH_MARKER = "CHICKEN_R93_HEAD_SHAPE_PATCH"

JS_OVERRIDE = r'''
// CHICKEN_R93_HEAD_SHAPE_PATCH
// R9.2 visual audit: rejected. The full-ring field enlarged neck sections that
// share each longitudinal station. R9.3 begins with exact R9.1 and moves only
// upper cranium/face bands; station X stays constant except bill-only uniform
// shortening, preserving the regular sweep chart assumptions.
window.__CHICKEN_R93_PATCH__=Object.freeze({
 version:'V4.6_R9.3_LOCAL_HEAD_RESTORE_CANDIDATE',
 source:'CHICKEN_V46_R9_1.html',
 rejectedPredecessor:'V4.6_R9.2_HEAD_SHAPE_RESTORE_CANDIDATE',
 method:'R9.1 dorsal baseline + localized upper-cranium/cheek/jaw fields + station-safe bill shortening',
 domain:[.262,.523116],
 preserves:['R9 frozen rollback','R9.1 frozen executable','body','plumage','wing','tail','feet','continuous comb','materials'],
 manualVisualAcceptance:false
});
const __applyHeadTopR91_R93Base=applyHeadTopR91;
applyHeadTopR91=function(input,amount,ctrl){
 const original=__applyHeadTopR91_R93Base(input,amount,ctrl),p=original.slice();
 const a=clamp(amount,0,1),zc=.09,rows=72,cols=96;
 const knots=[
  [.272,.951],[.286,.965],[.302,.981],[.322,.993],
  [.344,.999],[.366,.998],[.390,.992],[.414,.981],
  [.436,.968],[.454,.958],[.470,.953]
 ];
 const target=x=>{
  if(x<=knots[0][0])return knots[0][1];
  if(x>=knots[knots.length-1][0])return knots[knots.length-1][1];
  let k=1;while(k<knots.length&&x>knots[k][0])k++;
  const A=knots[k-1],B=knots[k],t=(x-A[0])/(B[0]-A[0]),q=t*t*(3-2*t);
  return A[1]*(1-q)+B[1]*q;
 };
 const band=(x,a0,a1,b0,b1)=>ss(a0,a1,x)*(1-ss(b0,b1,x));
 let moved=0,maxDisplacement=0,nonFinite=0,nonHeadMoved=0;
 for(let r=0;r<rows;r++){
  const start=r*cols*3,x=p[start];
  if(x<.262||x>.482)continue;
  let top=-Infinity;
  for(let j=0;j<cols;j++)top=Math.max(top,p[start+j*3+1]);
  const domain=band(x,.264,.292,.454,.480)*a;
  if(domain<=0)continue;
  const roofDelta=(target(x)-top)*domain;
  const posterior=Math.exp(-Math.pow((x-.316)/.045,2));
  const vault=Math.exp(-Math.pow((x-.366)/.056,2));
  const cheekX=Math.exp(-Math.pow((x-.399)/.043,2));
  for(let j=0;j<cols;j++){
   const q=start+j*3,ox=p[q],oy=p[q+1],oz=p[q+2];
   let y=oy,z=oz;
   const dorsal=ss(top-.100,top-.012,y);
   const mid=Math.exp(-Math.pow((z-zc)/.075,2));
   y+=roofDelta*dorsal*(.72+.28*mid);
   // Width is restricted to the upper head band. Lower neck vertices in the
   // same sweep station are untouched, preventing the R9.2 inflation failure.
   const upper=ss(top-.145,top-.055,y)*(1-ss(top-.006,top+.002,y));
   const width=domain*(.058*posterior+.038*vault+.027*cheekX)*upper;
   z=zc+(z-zc)*(1+width);
   const side=z>=zc?1:-1;
   const cheek=domain*cheekX*Math.exp(-Math.pow((y-.922)/.036,2));
   const jaw=domain*Math.exp(-Math.pow((x-.418)/.034,2)-Math.pow((y-.895)/.030,2));
   z+=side*(.0027*cheek+.0020*jaw);
   y-=.0020*jaw;
   p[q+1]=y;p[q+2]=z;
   const d=Math.hypot(p[q]-ox,p[q+1]-oy,p[q+2]-oz);
   if(d>1e-8){moved++;maxDisplacement=Math.max(maxDisplacement,d);if(oy<.78)nonHeadMoved++;}
   if(!Number.isFinite(p[q])||!Number.isFinite(p[q+1])||!Number.isFinite(p[q+2]))nonFinite++;
  }
 }
 // Uniform X movement per bill station preserves constant-X rings and chart
 // monotonicity. The root stays attached while the tip becomes shorter/deeper.
 let previousX=-Infinity,monotonic=true;
 for(let r=0;r<rows;r++){
  const start=r*cols*3,x=p[start];
  if(x>.448){
   const u=clamp((x-.448)/(.523116-.448)),blend=ss(.448,.462,x);
   const newX=.448+(x-.448)*(.86-.02*u),stationX=x+(newX-x)*blend;
   for(let j=0;j<cols;j++){
    const q=start+j*3,ox=p[q],oy=p[q+1],oz=p[q+2],y=p[q+1];
    p[q]=stationX;
    const cy=.944-.008*u-.003*ss(.65,1,u);
    const upper=Math.exp(-Math.pow((y-(cy+.010*(1-u)))/.018,2));
    const lower=Math.exp(-Math.pow((y-(cy-.010*(1-u)))/.014,2));
    p[q+1]+=blend*(.0010*(1-u)*upper-.0018*u*lower-.0014*ss(.70,1,u));
    const rootGain=.05*(1-u)*blend;
    p[q+2]=zc+(p[q+2]-zc)*(1+rootGain);
    const d=Math.hypot(p[q]-ox,p[q+1]-oy,p[q+2]-oz);
    if(d>1e-8){moved++;maxDisplacement=Math.max(maxDisplacement,d);}
    if(!Number.isFinite(p[q])||!Number.isFinite(p[q+1])||!Number.isFinite(p[q+2]))nonFinite++;
   }
  }
  const sx=p[start];if(sx<=previousX)monotonic=false;previousX=sx;
 }
 // The source sweep has two cap vertices after the 72x96 rings. Process the
 // anterior cap as part of the bill; otherwise the visual tip remains at R9.1.
 for(let q=rows*cols*3;q<p.length;q+=3){
  const x=p[q];if(x<=.448)continue;
  const ox=p[q],oy=p[q+1],oz=p[q+2],u=clamp((x-.448)/(.523116-.448)),blend=ss(.448,.462,x)*a;
  // Keep the keratin cap inside the same smooth station field while shortening
  // enough to clear the R9.3 bill-length gate without flattening the root.
  const newX=.448+(x-.448)*(.84-.02*u);
  p[q]=x+(newX-x)*blend;
  p[q+1]-=.0014*ss(.70,1,u)*blend;
  const d=Math.hypot(p[q]-ox,p[q+1]-oy,p[q+2]-oz);
  if(d>1e-8){moved++;maxDisplacement=Math.max(maxDisplacement,d);}
  if(!Number.isFinite(p[q])||!Number.isFinite(p[q+1])||!Number.isFinite(p[q+2]))nonFinite++;
 }
 let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
 for(let i=0;i<p.length;i+=3){minX=Math.min(minX,p[i]);minY=Math.min(minY,p[i+1]);minZ=Math.min(minZ,p[i+2]);maxX=Math.max(maxX,p[i]);maxY=Math.max(maxY,p[i+1]);maxZ=Math.max(maxZ,p[i+2]);}
 const audit={amount:a,movedVertices:moved,maxDisplacement,nonFinite,nonHeadMoved,stationXMonotonic:monotonic,bounds:{min:[minX,minY,minZ],max:[maxX,maxY,maxZ]}};
 // Preserve the active candidate audit; rollback builds must not overwrite it.
 if(a>.5)window.__CHICKEN_R93_LAST_HEAD_AUDIT__=audit;
 else window.__CHICKEN_R93_LAST_ROLLBACK_AUDIT__=audit;
 return p;
};
// Eye is enlarged and moved down slightly to restore the approved head's
// eye-to-cranium relationship; topology and surface-chart attachment stay the same.
buildSurfaceEyesR9=function(chart,ctrl,amount){
 const out=[];for(const side of [-1,1]){const cx=.3990,cy=.9500,rx=.0138*ctrl.head_scale*ctrl.eye_scale,ry=.0104*ctrl.head_scale*ctrl.eye_scale,tilt=-.060;
  const map=(a,r,bump)=>{const taper=.94+.06*Math.cos(a),dx=Math.cos(a)*rx*r*taper,dy=Math.sin(a)*ry*r,x=cx+dx*Math.cos(tilt)-dy*Math.sin(tilt),y=cy+dx*Math.sin(tilt)+dy*Math.cos(tilt);return chart.at(x,y,side,bump*amount)};
  const P=[],I=[],UV=[],na=56,nr=7,c=map(0,0,.00142);if(!c)continue;P.push(...c.p.toArray());UV.push(0,0);
  for(let r=1;r<=nr;r++){const rr=r/nr;for(let j=0;j<na;j++){const aa=2*Math.PI*j/na,q=map(aa,rr,.00064+.00102*(1-rr*rr));if(!q){P.length=0;break;}P.push(...q.p.toArray());UV.push(Math.cos(aa)*rr,Math.sin(aa)*rr);}if(!P.length)break;}if(!P.length)continue;
  for(let j=0;j<na;j++){const b=1+j,d=1+(j+1)%na;if(side>0)I.push(0,d,b);else I.push(0,b,d);}for(let r=1;r<nr;r++)for(let j=0;j<na;j++){const a0=1+(r-1)*na+j,b=1+(r-1)*na+(j+1)%na,d=1+r*na+j,e=1+r*na+(j+1)%na;if(side>0)I.push(a0,d,b,b,d,e);else I.push(a0,b,d,b,e,d);}out.push({positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2}},kind:'iris'});
  const LP=[],LI=[],LUV=[];let off=0;
  function arc(a0,a1,outer,upper){const n=38,start=off;for(let i=0;i<=n;i++){const t=i/n,aa=a0+(a1-a0)*t,taper=Math.pow(Math.sin(Math.PI*t),.72),ri=.975,ro=1+outer*taper;for(const r of [ri,ro]){const q=map(aa,r,(upper?.00102:.00072)+.00056*taper);if(!q)return false;LP.push(...q.p.toArray());LUV.push(Math.cos(aa)*r,Math.sin(aa)*r);off++;}}for(let i=0;i<n;i++){let a=start+i*2,b=a+1,c=a+2,d=a+3;if(side>0)LI.push(a,c,b,b,c,d);else LI.push(a,b,c,b,d,c);}return true;}
  if(arc(.075*Math.PI,.925*Math.PI,.150,true)&&arc(1.11*Math.PI,1.89*Math.PI,.090,false))out.push({positions:new Float32Array(LP),indices:new Uint32Array(LI),attrs:{uv:{array:new Float32Array(LUV),size:2}},kind:'lid'});
 }
 return out.length===4?out:[];
};
// The R9/R9.1 ear-lobe patch read as a second eye in neutral gray. Keep the
// module but make it smaller, lower and less circular.
buildEarLobesR9=function(chart,ctrl,amount){const out=[];for(const side of [-1,1]){const cx=.367,cy=.916,rx=.0060*ctrl.head_scale*ctrl.soft_tissue_scale,ry=.0088*ctrl.head_scale*ctrl.soft_tissue_scale,tilt=-.20,na=44,nr=6,P=[],I=[],UV=[];const center=chart.at(cx,cy,side,.00052*amount);if(!center)continue;P.push(...center.p.toArray());UV.push(0,0);for(let r=1;r<=nr;r++){const rr=r/nr;for(let j=0;j<na;j++){const aa=2*Math.PI*j/na,dx=Math.cos(aa)*rx*rr,dy=Math.sin(aa)*ry*rr,x=cx+dx*Math.cos(tilt)-dy*Math.sin(tilt),y=cy+dx*Math.sin(tilt)+dy*Math.cos(tilt),q=chart.at(x,y,side,(.00016+.00040*(1-rr*rr))*amount);if(!q){P.length=0;break;}P.push(...q.p.toArray());UV.push(Math.cos(aa)*rr,Math.sin(aa)*rr);}if(!P.length)break;}if(!P.length)continue;for(let j=0;j<na;j++){const b=1+j,d=1+(j+1)%na;if(side>0)I.push(0,d,b);else I.push(0,b,d);}for(let r=1;r<nr;r++)for(let j=0;j<na;j++){const aa=1+(r-1)*na+j,b=1+(r-1)*na+(j+1)%na,d=1+r*na+j,e=1+r*na+(j+1)%na;if(side>0)I.push(aa,d,b,b,d,e);else I.push(aa,b,d,b,e,d);}out.push({positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2}},kind:'lid'});}return out;};
// Keep paired nostrils but move them with the shorter bill root.
buildNostrilsR9=function(chart,ctrl,amount){const out=[];for(const side of [-1,1]){const cx=.4628+(ctrl.beak_length-1)*.008,cy=.9468,rx=.00385*ctrl.head_scale,ry=.00175*ctrl.head_scale,tilt=-.13,na=36,nr=4,P=[],I=[],UV=[];const center=chart.at(cx,cy,side,.00011*amount);if(!center)continue;P.push(...center.p.toArray());UV.push(0,0);for(let r=1;r<=nr;r++){const rr=r/nr;for(let j=0;j<na;j++){const aa=2*Math.PI*j/na,dx=Math.cos(aa)*rx*rr,dy=Math.sin(aa)*ry*rr,x=cx+dx*Math.cos(tilt)-dy*Math.sin(tilt),y=cy+dx*Math.sin(tilt)+dy*Math.cos(tilt),q=chart.at(x,y,side,.00013*amount);if(!q){P.length=0;break;}P.push(...q.p.toArray());UV.push(Math.cos(aa)*rr,Math.sin(aa)*rr);}if(!P.length)break;}if(!P.length)continue;for(let j=0;j<na;j++){const b=1+j,d=1+(j+1)%na;if(side>0)I.push(0,d,b);else I.push(0,b,d);}for(let r=1;r<nr;r++)for(let j=0;j<na;j++){const aa=1+(r-1)*na+j,b=1+(r-1)*na+(j+1)%na,d=1+r*na+j,e=1+r*na+(j+1)%na;if(side>0)I.push(aa,d,b,b,d,e);else I.push(aa,b,d,b,e,d);}out.push({positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2}},kind:'nostril'});}return out;};
'''.strip()

VISIBLE_REPLACEMENTS = {
    "<title>Chicken R9.1 · Final Silhouette & Head Top Gate</title>":
        "<title>Chicken R9.3 · Local Head Restore Candidate</title>",
    "鸡 · R9.1 · 最终轮廓与头顶收敛":
        "鸡 · R9.3 · 头部局部承载形体恢复候选",
    "冻结 R9 作为前版 · 重塑头顶、单冠连续叶片与面部材质边界 · 继续检查全身轮廓":
        "从冻结 R9.1 重建 · R9.2 已因全环膨胀造成楔形头而否决 · 本版仅改头部局部带与喙",
    "后：R9.1 头顶与轮廓": "后：R9.3 局部头部候选",
    "在 R9 可回退基线上修正头顶与单冠":
        "在冻结 R9.1 上修复头部局部承载形体",
    "R9.1 当前候选": "R9.3 当前候选",
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


def build_html() -> dict[str, Any]:
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)
    source_hash = sha256(SOURCE)
    if source_hash != EXPECTED_SOURCE_SHA256:
        raise RuntimeError(f"Frozen R9.1 hash mismatch: {source_hash}")
    source = SOURCE.read_text(encoding="utf-8")
    if source.count(ANCHOR) != 1:
        raise RuntimeError(f"Expected one scene anchor, found {source.count(ANCHOR)}")
    for marker in ("CHICKEN_R92_HEAD_SHAPE_PATCH", PATCH_MARKER):
        if marker in source:
            raise RuntimeError(f"Frozen source unexpectedly contains {marker}")
    patched = source.replace(ANCHOR, JS_OVERRIDE + "\n" + ANCHOR, 1)
    replacement_status = {}
    for old, new in VISIBLE_REPLACEMENTS.items():
        replacement_status[old] = old in patched
        if old in patched:
            patched = patched.replace(old, new, 1)
    pill = '<span class="pill">R9.3：局部头部候选 · R9.2 视觉否决 · 尚未人工验收</span>'
    if "</header>" not in patched:
        raise RuntimeError("Header anchor missing")
    patched = patched.replace("</header>", pill + "</header>", 1)
    OUTPUT.write_text(patched, encoding="utf-8")
    return {
        "source_sha256": source_hash,
        "output_sha256": sha256(OUTPUT),
        "source_bytes": SOURCE.stat().st_size,
        "output_bytes": OUTPUT.stat().st_size,
        "byte_delta": OUTPUT.stat().st_size - SOURCE.stat().st_size,
        "anchor_count": source.count(ANCHOR),
        "patch_marker_count": patched.count(PATCH_MARKER),
        "r92_marker_count": patched.count("CHICKEN_R92_HEAD_SHAPE_PATCH"),
        "replacement_status": replacement_status,
        "source_preserved": sha256(SOURCE) == EXPECTED_SOURCE_SHA256,
    }


def write_parameters() -> None:
    write_json(PARAMS, {
        "schema": "life_ecosystem/chicken_head_shape_candidate@1.0",
        "version": "V4.6_R9.3",
        "status": "bounded_visual_candidate_not_anatomical_truth",
        "units": "normalized_source_units_not_meters",
        "source": {
            "frozen_executable": SOURCE.name,
            "sha256": EXPECTED_SOURCE_SHA256,
            "approved_visual_reference": "reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png",
            "rejected_predecessor": "CHICKEN_V46_R9_2_HEAD_SHAPE.html",
        },
        "failure_corrected": {
            "r9_2_problem": "full-ring vertical/lateral scaling altered long neck sections sharing the same stations",
            "r9_3_rule": "only upper-head local bands may change; bill X changes are uniform per station",
        },
        "deformation": {
            "method": "R9.1 dorsal baseline with localized upper-cranium, cheek, lower-jaw and bill fields",
            "head_x_domain": [0.262, 0.482],
            "bill_x_domain": [0.448, 0.523116],
            "roof_max_target_y": 0.999,
            "posterior_upper_width_gain": 0.058,
            "vault_upper_width_gain": 0.038,
            "cheek_upper_width_gain": 0.027,
            "bill_station_length_factor_root_to_tip": [0.86, 0.84],
            "non_head_band_guard_y": 0.78,
        },
        "local_modules": {
            "eye_center_xy": [0.3990, 0.9500],
            "eye_radius_xy": [0.0138, 0.0104],
            "ear_lobe_center_xy": [0.367, 0.916],
            "ear_lobe_radius_xy": [0.0060, 0.0088],
            "nostril_center_xy": [0.4628, 0.9468],
        },
        "preserved": ["body", "body plumage", "wings", "tail", "feet", "continuous comb", "materials", "R9 and R9.1 rollback"],
        "truth_boundary": {"manual_visual_acceptance": False, "rig_authorized": False, "motion_authorized": False, "anatomical_truth_claimed": False},
    })


def write_static_qa(build: dict[str, Any]) -> None:
    checks = {
        "frozen_source_hash_matches": build["source_sha256"] == EXPECTED_SOURCE_SHA256,
        "frozen_source_preserved": build["source_preserved"],
        "single_scene_anchor": build["anchor_count"] == 1,
        "single_r93_patch_injection": build["patch_marker_count"] == 1,
        "no_r92_patch_in_candidate": build["r92_marker_count"] == 0,
        "output_created": OUTPUT.exists(),
        "output_larger_than_source": build["output_bytes"] > build["source_bytes"],
        "all_visible_replacement_anchors_found": all(build["replacement_status"].values()),
        "rollback_source_still_present": SOURCE.exists(),
    }
    write_json(STATIC_QA, {
        "schema": "life_ecosystem/chicken_r93_static_qa@1.0",
        "version": "V4.6_R9.3_LOCAL_HEAD_RESTORE_CANDIDATE",
        "checks": checks,
        "passed": all(checks.values()),
        "build": build,
        "scope": "source integrity and patch injection only; browser and visual gates are separate",
    })
    if not all(checks.values()):
        raise RuntimeError(f"Static QA failed: {[k for k,v in checks.items() if not v]}")


def write_review_board() -> None:
    REVIEW_BOARD.parent.mkdir(parents=True, exist_ok=True)
    captures = [
        ("批准的视觉构形参考", "../../reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png"),
        ("R9.1 被否决头部截图", "../../reference/head/previous_user_review/01_CURRENT_R9_1_REJECTED_HEAD_SCREENSHOT.png"),
        ("较早侧面参考", "../../reference/head/previous_user_review/02_EARLIER_HEAD_SIDE_REFERENCE.png"),
        ("R9.1 中性灰侧面基线", "R91_BASELINE_HEAD_NEUTRAL_LEFT.png"),
        ("R9.3 中性灰侧面", "R93_HEAD_NEUTRAL_LEFT.png"),
        ("R9.3 中性灰前斜视", "R93_HEAD_NEUTRAL_FRONT_OBLIQUE.png"),
        ("R9.3 中性灰顶部", "R93_HEAD_NEUTRAL_TOP.png"),
        ("R9.3 中性灰三分之四", "R93_HEAD_NEUTRAL_THREE_QUARTER.png"),
        ("R9.3 全身检查", "R93_WHOLE_NEUTRAL_THREE_QUARTER.png"),
    ]
    cards = "\n".join(f'<figure><img src="{src}" alt="{title}"><figcaption>{title}</figcaption></figure>' for title,src in captures)
    REVIEW_BOARD.write_text(f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chicken R9.3 头部审查板</title><style>*{{box-sizing:border-box}}body{{margin:0;background:#151b20;color:#e9eeee;font:14px/1.55 system-ui,-apple-system,Segoe UI,Microsoft Yahei,sans-serif}}header{{padding:24px 28px;border-bottom:1px solid #344047;position:sticky;top:0;background:#151b20ee;backdrop-filter:blur(8px);z-index:2}}h1{{margin:0 0 8px;font-size:22px}}p{{margin:4px 0;color:#aebdbd}}main{{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;padding:18px}}figure{{margin:0;border:1px solid #344047;background:#0f171c;border-radius:9px;overflow:hidden}}img{{width:100%;height:420px;display:block;object-fit:contain;background:#11181d}}figcaption{{padding:10px 12px;border-top:1px solid #344047}}.gate{{color:#d8bb82}}code{{color:#cddfda}}</style></head><body><header><h1>Chicken V4.6 R9.3 · 局部头部承载形体候选</h1><p>R9.2 虽通过浏览器技术检查，但因全环膨胀把头颈做成长楔形，视觉门禁判定失败。本版从冻结 R9.1 重建，只允许上部颅体、脸颊、下颌和喙的局部变化。</p><p class="gate">r9_2VisualGate=false · manualVisualAcceptance=false · rigAuthorized=false</p><p>入口：<code>../../CHICKEN_V46_R9_3_HEAD_SHAPE.html</code></p></header><main>{cards}</main></body></html>''', encoding="utf-8")


def update_project_docs(browser_ok: bool) -> None:
    state = {
        "schema": "life_ecosystem/chicken_module_state@1.0",
        "version": "V4.6_R9.3_LOCAL_HEAD_RESTORE_CANDIDATE",
        "date": "2026-09-15",
        "identity": {"species_scope": "domestic chicken surface candidate", "sex": "unknown", "breed": "unknown", "age": "unknown", "real_world_scale": "unknown"},
        "active_entry": OUTPUT.name,
        "frozen_r9_1_baseline": SOURCE.name,
        "frozen_r9_baseline": "history/CHICKEN_V46_R9_FROZEN.html",
        "rejected_r9_2_candidate": "CHICKEN_V46_R9_2_HEAD_SHAPE.html",
        "approved_head_reference": "reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png",
        "candidate_parameters": str(PARAMS.relative_to(ROOT)),
        "review_board": str(REVIEW_BOARD.relative_to(ROOT)),
        "head_status": {
            "r9_1_whole_head_silhouette_accepted": False,
            "r9_2_technical_gate_passed": True,
            "r9_2_visual_gate_passed": False,
            "r9_2_failure": "full-ring deformation inflated head/neck and produced a long wedge",
            "r9_3_local_candidate_built": True,
            "r9_3_browser_qa_passed": browser_ok,
            "manual_visual_acceptance": False,
        },
        "qa": {"technical_gate_passed": browser_ok, "current_executable_reproducible": True, "manual_visual_acceptance": False, "whole_visual_gate_passed": False, "canonical_chicken_surface_complete": False, "rig_authorized": False, "motion_implemented": False, "production_ready": False, "public_https_published": True},
        "next_stage": "INDEPENDENT_VISUAL_AUDIT_R9_3_THEN_BOUNDED_REFINEMENT",
    }
    write_json(STATE, state)
    doc = f'''# Chicken V4.6 R9.3 — Local Head Restore Candidate

## Active executable

`{OUTPUT.name}`

## Rollback and rejected predecessor

- exact frozen R9.1: `{SOURCE.name}`
- exact frozen R9: `history/CHICKEN_V46_R9_FROZEN.html`
- rejected technical-only R9.2 candidate: `CHICKEN_V46_R9_2_HEAD_SHAPE.html`

R9.2 passed static and browser execution but failed visual inspection: its full-ring field altered long neck sections sharing the same longitudinal stations, creating an enlarged wedge/dolphin-like head. Technical success was not treated as visual acceptance.

## R9.3 change

R9.3 starts again from the exact R9.1 file. It reuses the R9.1 dorsal correction, then applies only localized upper-cranium, cheek and lower-jaw fields. Bill shortening keeps a constant X value across every sweep station, so the surface chart remains monotonic. The eye is slightly larger/lower; the ear-lobe patch is smaller/lower; the nostril follows the shortened bill.

Body, plumage, wings, tail, feet, continuous comb and materials are not redesigned.

## Evidence

- parameters: `data/CHICKEN_R93_HEAD_SHAPE_PARAMETERS.json`
- static QA: `qa/CHICKEN_R93_STATIC_QA.json`
- browser QA: `qa/CHICKEN_R93_BROWSER_QA.json`
- review board: `evidence/r93/R93_REVIEW_BOARD.html`
- manifest: `BUILD_MANIFEST_R93.json`

Browser QA passed: `{str(browser_ok).lower()}`.

```text
r9_2VisualGatePassed=false
r9_3LocalCandidateBuilt=true
r9_3BrowserQAPassed={str(browser_ok).lower()}
manualVisualAcceptance=false
wholeVisualGatePassed=false
rigAuthorized=false
motionImplemented=false
productionReady=false
```

R9.3 must be judged from the fixed neutral-gray views before any rig or motion work begins.
'''
    for path in (README, HANDOFF, FULL_HANDOFF):
        path.write_text(doc, encoding="utf-8")
    NEXT_PLAN.write_text('''# Next Stage — R9.3 Independent Visual Gate

1. Inspect the approved reference, R9.1 baseline and R9.3 side view at the same scale.
2. Reject any return of the R9.2 long-wedge/full-ring inflation failure.
3. Check cranium compactness, eye scale/position, cheek and lower-jaw support, bill length/depth, throat transition and comb attachment.
4. If refinement is needed, change one named local field at a time and keep R9.1/R9.2/R9.3 immutable.
5. Only after manual acceptance may a canonical head baseline be frozen.

Blocked: Chicken DNA freeze, rig, skin weights, animation, behavior and production release.
''', encoding="utf-8")


def write_manifest() -> None:
    paths = [OUTPUT, SOURCE, ROOT / "CHICKEN_V46_R9_2_HEAD_SHAPE.html", PARAMS, STATIC_QA, BROWSER_QA, STATE, README, HANDOFF, FULL_HANDOFF, NEXT_PLAN, REVIEW_BOARD, ROOT / "reference" / "head" / "APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png", ROOT / "reference" / "head" / "previous_user_review" / "01_CURRENT_R9_1_REJECTED_HEAD_SCREENSHOT.png", ROOT / "reference" / "head" / "previous_user_review" / "02_EARLIER_HEAD_SIDE_REFERENCE.png"]
    paths.extend(sorted((ROOT / "evidence" / "r93").glob("*.png")))
    files=[]
    for path in paths:
        if path.exists() and path.is_file():
            files.append({"path": str(path.relative_to(ROOT)).replace("\\","/"), "bytes": path.stat().st_size, "sha256": sha256(path)})
    write_json(MANIFEST, {"schema": "life_ecosystem/build_manifest@1.0", "package": "CHICKEN_V4_6_R9_3_LOCAL_HEAD_RESTORE_CANDIDATE_2026-09-15", "active_entry": OUTPUT.name, "frozen_source": SOURCE.name, "frozen_source_sha256": EXPECTED_SOURCE_SHA256, "rejected_predecessor": "CHICKEN_V46_R9_2_HEAD_SHAPE.html", "manual_visual_acceptance": False, "files": files})


def main() -> int:
    parser=argparse.ArgumentParser();parser.add_argument("--finalize",action="store_true");args=parser.parse_args()
    build=build_html();write_parameters();write_static_qa(build)
    browser_ok=False
    if BROWSER_QA.exists():
        try: browser_ok=bool(json.loads(BROWSER_QA.read_text(encoding="utf-8")).get("passed"))
        except (OSError,json.JSONDecodeError): browser_ok=False
    if args.finalize:
        write_review_board();update_project_docs(browser_ok);write_manifest()
    print(json.dumps({"built":str(OUTPUT),"sha256":build["output_sha256"],"browser_ok":browser_ok},indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
