#!/usr/bin/env python3
"""Build Chicken V4.6 R9.9 conservative gameplay-distance head candidate.

This candidate restarts from the frozen R9.1 carrier rather than inheriting the
rejected R9.8.3/R9.8.4 replacement heads.  It preserves the connected R9.1
head/neck surface, compresses the existing bill in-place, and replaces only the
floating facial appendages with surface-attached patches.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "CHICKEN_V46_R9_1.html"
OUTPUT = ROOT / "CHICKEN_V46_R9_9_GAMEPLAY_HEAD.html"
PARAMS = ROOT / "data" / "CHICKEN_R99_GAMEPLAY_HEAD_PARAMETERS.json"
STATIC_QA = ROOT / "qa" / "CHICKEN_R99_STATIC_QA.json"
BROWSER_QA = ROOT / "qa" / "CHICKEN_R99_BROWSER_QA.json"
MANIFEST = ROOT / "BUILD_MANIFEST_R99.json"
REVIEW_BOARD = ROOT / "evidence" / "r99" / "R99_REVIEW_BOARD.html"
EXPECTED_SOURCE_SHA256 = "336dc9d32304f916a8f15e120ebf4b9d2429b54dd2719be1af8aca12df33a4e3"
ANCHOR = "const scene=new T.Scene();"
PATCH_MARKER = "CHICKEN_R99_GAMEPLAY_HEAD_PATCH"

JS_OVERRIDE = r'''
// CHICKEN_R99_GAMEPLAY_HEAD_PATCH
// Conservative Phase-1 candidate: retain the connected R9.1 carrier, compress
// its bill in-place, and replace floating facial pieces with attached patches.
window.__CHICKEN_R99_PATCH__=Object.freeze({
 version:'V4.6_R9.9_GAMEPLAY_DISTANCE_HEAD_CANDIDATE',
 source:'CHICKEN_V46_R9_1.html',
 method:'connected R9.1 carrier + in-place compact bill + attached eye/lid/nostril/wattle',
 preserves:['body','lower neck','plumage','wing','tail','feet','materials','controls','R9.1 rollback'],
 manualVisualAcceptance:false,wholeVisualGatePassed:false,rigAuthorized:false,motionAuthorized:false
});

const __r99BaseHead=applyHeadTopR91;
applyHeadTopR91=function(input,amount,ctrl){
 const base=__r99BaseHead(input,amount,ctrl),p=base.slice(),a=clamp(amount,0,1),rows=72,cols=96,zc=.09;
 const xRoot=.425,xSourceTip=.523116,xTargetTip=.486;
 let moved=0,maxDisplacement=0,nonFinite=0,nonHeadMoved=0,previous=-Infinity,monotonic=true;
 for(let r=0;r<rows;r++){
  const start=r*cols*3,x=base[start];
  let top=-Infinity,bottom=Infinity,zlo=Infinity,zhi=-Infinity;
  for(let j=0;j<cols;j++){
   const q=start+j*3;top=Math.max(top,base[q+1]);bottom=Math.min(bottom,base[q+1]);zlo=Math.min(zlo,base[q+2]);zhi=Math.max(zhi,base[q+2]);
  }
  const cy=.5*(top+bottom),halfY=Math.max(.5*(top-bottom),.0001),halfZ=Math.max(.5*(zhi-zlo),.0001);
  if(x>=xRoot){
   const u=clamp((x-xRoot)/(xSourceTip-xRoot)),ease=u*u*(3-2*u),tx=xRoot+(xTargetTip-xRoot)*u;
   const yScale=1-.48*ease,zScale=1-.58*ease,down=.0060*u*u;
   for(let j=0;j<cols;j++){
    const q=start+j*3,ox=p[q],oy=p[q+1],oz=p[q+2];
    p[q]+=(tx-p[q])*a;
    p[q+1]+=(cy+(oy-cy)*yScale-down-p[q+1])*a;
    p[q+2]+=(zc+(oz-zc)*zScale-p[q+2])*a;
    const d=Math.hypot(p[q]-ox,p[q+1]-oy,p[q+2]-oz);if(d>1e-8){moved++;maxDisplacement=Math.max(maxDisplacement,d);}if(!Number.isFinite(p[q])||!Number.isFinite(p[q+1])||!Number.isFinite(p[q+2]))nonFinite++;
   }
  }else if(x>.330&&x<xRoot){
   const face=ss(.330,.365,x)*(1-ss(.408,xRoot,x));
   for(let j=0;j<cols;j++){
    const q=start+j*3,ox=p[q],oy=p[q+1],oz=p[q+2],side=(oz>=zc?1:-1),sideFrac=Math.abs(oz-zc)/halfZ;
    const cheek=Math.exp(-Math.pow((oy-.930)/.035,2))*ss(.52,.90,sideFrac)*face*a;
    const jaw=Math.exp(-Math.pow((oy-.902)/.028,2))*ss(.44,.86,sideFrac)*face*a;
    p[q+2]+=side*(.00115*cheek+.00075*jaw);p[q+1]-=.00065*jaw;
    const d=Math.hypot(p[q]-ox,p[q+1]-oy,p[q+2]-oz);if(d>1e-8){moved++;maxDisplacement=Math.max(maxDisplacement,d);if(oy<.78)nonHeadMoved++;}
   }
  }
  const sx=p[start];if(sx<=previous)monotonic=false;previous=sx;
 }
 for(let q=rows*cols*3;q<p.length;q+=3){
  if(p[q]>=xRoot){
   const u=clamp((p[q]-xRoot)/(xSourceTip-xRoot)),ease=u*u*(3-2*u),ox=p[q],oy=p[q+1],oz=p[q+2];
   p[q]=xRoot+(xTargetTip-xRoot)*u;p[q+1]-=.0060*u*u;p[q+2]=zc+(p[q+2]-zc)*(1-.58*ease);
   const d=Math.hypot(p[q]-ox,p[q+1]-oy,p[q+2]-oz);if(d>1e-8){moved++;maxDisplacement=Math.max(maxDisplacement,d);}
  }
 }
 const audit={amount:a,movedVertices:moved,maxDisplacement,nonFinite,nonHeadMoved,stationXMonotonic:monotonic,billRoot:xRoot,sourceTip:xSourceTip,targetTip:xTargetTip,connectedCarrier:true,separateBillMesh:false};
 window.__CHICKEN_R99_HEAD_AUDIT__=audit;
 return p;
};

function __r99SurfacePatch(chart,side,cx,cy,rx,ry,centerBump,edgeBump,kind){
 const P=[],I=[],UV=[],na=48,nr=7,center=chart.at(cx,cy,side,centerBump);if(!center)return null;
 P.push(...center.p.toArray());UV.push(0,0);
 for(let r=1;r<=nr;r++){
  const rr=r/nr;
  for(let j=0;j<na;j++){
   const aa=2*Math.PI*j/na,x=cx+Math.cos(aa)*rx*rr,y=cy+Math.sin(aa)*ry*rr,b=edgeBump+(centerBump-edgeBump)*(1-rr*rr),q=chart.at(x,y,side,b);if(!q)return null;P.push(...q.p.toArray());UV.push(Math.cos(aa)*rr,Math.sin(aa)*rr);
  }
 }
 for(let j=0;j<na;j++){const b=1+j,d=1+(j+1)%na;if(side>0)I.push(0,d,b);else I.push(0,b,d);}
 for(let r=1;r<nr;r++)for(let j=0;j<na;j++){const aa=1+(r-1)*na+j,b=1+(r-1)*na+(j+1)%na,d=1+r*na+j,e=1+r*na+(j+1)%na;if(side>0)I.push(aa,d,b,b,d,e);else I.push(aa,b,d,b,e,d);}
 return{positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2}},kind};
}

buildSurfaceEyesR9=function(chart,ctrl,amount){
 const out=[],cx=.3980,cy=.9570,rx=.0094*ctrl.head_scale*ctrl.eye_scale,ry=.0084*ctrl.head_scale*ctrl.eye_scale;
 for(const side of[-1,1]){
  const iris=__r99SurfacePatch(chart,side,cx,cy,rx,ry,.00155*amount,.00010*amount,'iris');if(iris)out.push(iris);
  const LP=[],LI=[],LUV=[],segments=44,a0=.05*Math.PI,a1=.95*Math.PI;
  for(let k=0;k<=segments;k++){
   const t=k/segments,aa=a0+(a1-a0)*t,taper=.18+.82*Math.pow(Math.sin(Math.PI*t),.70);
   for(const rr of[1.00,1.00+.15*taper]){const x=cx+Math.cos(aa)*rx*rr,y=cy+Math.sin(aa)*ry*rr,q=chart.at(x,y,side,(.00018+.00058*taper)*amount);if(!q){LP.length=0;break;}LP.push(...q.p.toArray());LUV.push(Math.cos(aa)*rr,Math.sin(aa)*rr);}if(!LP.length)break;
  }
  if(LP.length){for(let k=0;k<segments;k++){const aa=k*2,b=aa+1,c=aa+2,d=aa+3;if(side>0)LI.push(aa,c,b,b,c,d);else LI.push(aa,b,c,b,d,c);}out.push({positions:new Float32Array(LP),indices:new Uint32Array(LI),attrs:{uv:{array:new Float32Array(LUV),size:2}},kind:'lid'});}
 }
 window.__CHICKEN_R99_EYE_AUDIT__={patches:out.length,expected:4,geometry:'surface_attached_dome_plus_upper_lid',center:[cx,cy],radius:[rx,ry]};
 return out;
};

buildEarLobesR9=function(){return[];};

buildNostrilsR9=function(chart,ctrl,amount){
 const out=[],cx=.4540,cy=.9470,rx=.0030*ctrl.head_scale,ry=.00135*ctrl.head_scale;
 for(const side of[-1,1]){const patch=__r99SurfacePatch(chart,side,cx,cy,rx,ry,.00018*amount,.00005*amount,'nostril');if(patch)out.push(patch);}
 window.__CHICKEN_R99_NOSTRIL_AUDIT__={patches:out.length,center:[cx,cy],radius:[rx,ry]};return out;
};

buildSoftTissueR9=function(ctrl,chart,amount){
 const out=[];for(const side of[-1,1]){
  const root=chart.at(.410,.910,side,.00018*amount);if(!root)continue;const P=[],I=[],ns=28,na=24;
  for(let i=0;i<ns;i++){
   const s=i/(ns-1),shape=Math.pow(Math.sin(Math.PI*s),.72),x=.410-.010*s-.002*Math.sin(Math.PI*s),y=.910-.034*s-.0015*Math.sin(Math.PI*s),outward=ss(.02,.34,s),z=root.p.z*(1-outward)+(.09+side*(.044-.003*s))*outward,rx=.0076*shape*ctrl.soft_tissue_scale,rz=.0042*shape*ctrl.soft_tissue_scale;
   for(let j=0;j<na;j++){const aa=2*Math.PI*j/na;P.push(x+rx*Math.cos(aa),y,z+side*rz*Math.sin(aa));}
  }
  for(let i=0;i<ns-1;i++)for(let j=0;j<na;j++){const aa=i*na+j,b=i*na+(j+1)%na,c=(i+1)*na+(j+1)%na,d=(i+1)*na+j;if(side>0)I.push(aa,d,b,b,d,c);else I.push(aa,b,d,b,c,d);}
  out.push({positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{},kind:'lid'});
 }
 window.__CHICKEN_R99_WATTLE_AUDIT__={patches:out.length,attached:true,root:[.410,.910],length:.034};return out;
};

const __r99FilterPartTriangles=filterPartTriangles;
filterPartTriangles=function(exclude){const local=new Set(exclude);local.add(3);local.add(4);window.__CHICKEN_R99_PART_AUDIT__={legacyEyesExcluded:local.has(1)&&local.has(2),legacyEarLobesExcluded:true,legacyNostrilsExcluded:local.has(5)&&local.has(6),excluded:[...local].sort((a,b)=>a-b)};return __r99FilterPartTriangles(local);};

const __r99BaseUpdateState=updateState;
updateState=function(){__r99BaseUpdateState();if($('status'))$('status').textContent=`R9.9 · R9.1 连续头颈 + 原位短喙 + 贴附眼部 · ${stats?.eyePatches||0} 个眼部片`;if($('notes'))$('notes').innerHTML='R9.9 从冻结 R9.1 重新开始：不再叠加板状或球状替代头壳，只在原连续载体内压缩喙长，并替换悬浮眼、旧耳叶、鼻孔与肉垂。<br>本候选只用于 3–5 米场景形态门；视觉通过前，Rig、Motion 与群体测试保持关闭。';};
'''.strip()

VISIBLE_REPLACEMENTS = {
    "<title>Chicken R9.1 · Final Silhouette & Head Top Gate</title>": "<title>Chicken R9.9 · Conservative Gameplay Head Candidate</title>",
    "鸡 · R9.1 · 最终轮廓与头顶收敛": "鸡 · R9.9 · 场景距离头面候选",
    "冻结 R9 作为前版 · 重塑头顶、单冠连续叶片与面部材质边界 · 继续检查全身轮廓": "从冻结 R9.1 重新开始 · 保留连续头颈，仅原位压缩喙并替换悬浮面部零件",
    "后：R9.1 头顶与轮廓": "后：R9.9 场景距离头面",
    "在 R9 可回退基线上修正头顶与单冠": "在冻结 R9.1 连续载体上做有界头面修正",
    "R9.1 当前候选": "R9.9 当前候选",
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
    if sha256(SOURCE) != EXPECTED_SOURCE_SHA256:
        raise RuntimeError("Frozen R9.1 source hash mismatch")
    source = SOURCE.read_text(encoding="utf-8")
    if source.count(ANCHOR) != 1:
        raise RuntimeError("Scene anchor must occur exactly once")
    if PATCH_MARKER in source:
        raise RuntimeError("Frozen R9.1 source is already patched")
    patched = source.replace(ANCHOR, JS_OVERRIDE + "\n" + ANCHOR, 1)
    replacements = {}
    for old, new in VISIBLE_REPLACEMENTS.items():
        replacements[old] = old in patched
        if old in patched:
            patched = patched.replace(old, new, 1)
    pill = '<span class="pill">R9.9：R9.1 连续载体保守修正 · 尚未视觉验收</span>'
    patched = patched.replace("</header>", pill + "</header>", 1)
    OUTPUT.write_text(patched, encoding="utf-8")
    return {
        "source_sha256": sha256(SOURCE),
        "output_sha256": sha256(OUTPUT),
        "source_bytes": SOURCE.stat().st_size,
        "output_bytes": OUTPUT.stat().st_size,
        "patch_marker_count": patched.count(PATCH_MARKER),
        "replacement_status": replacements,
    }


def write_parameters() -> None:
    write_json(PARAMS, {
        "schema": "life_ecosystem/chicken_gameplay_head_candidate@1.0",
        "version": "V4.6_R9.9",
        "source": {"frozen_executable": SOURCE.name, "sha256": EXPECTED_SOURCE_SHA256, "approved_visual_reference": "reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png"},
        "strategy": "conservative_connected_carrier",
        "changes": {
            "carrier": "exact R9.1 connected head/neck carrier retained",
            "bill": {"method": "in-place longitudinal compression", "root_x": 0.425, "source_tip_x": 0.523116, "target_tip_x": 0.486, "separate_mesh": False},
            "eyes": {"method": "surface attached dome and upper lid", "center_xy": [0.398, 0.957], "radius_xy": [0.0094, 0.0084], "patches": 4},
            "nostrils": {"center_xy": [0.454, 0.947], "paired": True},
            "wattles": {"root_xy": [0.410, 0.910], "length": 0.034, "attached": True},
            "legacy_parts_excluded": [1,2,3,4,5,6],
            "frozen_systems": ["body", "lower neck", "plumage", "wing", "tail", "feet", "materials", "controls"]
        },
        "truth_boundary": {"manual_visual_acceptance": False, "whole_visual_gate_passed": False, "rig_authorized": False, "motion_authorized": False, "anatomical_truth_claimed": False}
    })


def write_static_qa(build: dict[str, Any]) -> None:
    checks = {
        "frozen_source_hash_matches": build["source_sha256"] == EXPECTED_SOURCE_SHA256,
        "single_patch_injection": build["patch_marker_count"] == 1,
        "output_created": OUTPUT.exists(),
        "output_larger_than_source": build["output_bytes"] > build["source_bytes"],
        "visible_anchors_found": all(build["replacement_status"].values()),
    }
    write_json(STATIC_QA, {"schema": "life_ecosystem/chicken_r99_static_qa@1.0", "version": "V4.6_R9.9_GAMEPLAY_DISTANCE_HEAD_CANDIDATE", "checks": checks, "passed": all(checks.values()), "build": build, "scope": "source and patch integrity only"})
    if not all(checks.values()):
        raise RuntimeError(f"Static QA failed: {[k for k,v in checks.items() if not v]}")


def write_review_board() -> None:
    REVIEW_BOARD.parent.mkdir(parents=True, exist_ok=True)
    items = [
        ("批准的视觉构形参考", "../../reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png"),
        ("R9.1 冻结左侧", "R91_BASELINE_HEAD_NEUTRAL_LEFT.png"),
        ("R9.9 左侧", "R99_HEAD_NEUTRAL_LEFT.png"),
        ("R9.9 右侧", "R99_HEAD_NEUTRAL_RIGHT.png"),
        ("R9.9 正面", "R99_HEAD_NEUTRAL_FRONT.png"),
        ("R9.9 顶部", "R99_HEAD_NEUTRAL_TOP.png"),
        ("R9.9 三分之四", "R99_HEAD_NEUTRAL_THREE_QUARTER.png"),
        ("R9.9 左侧线框", "R99_HEAD_WIRE_LEFT.png"),
        ("R9.9 全身中性灰", "R99_WHOLE_NEUTRAL_THREE_QUARTER.png"),
        ("R9.9 全身程序材质", "R99_WHOLE_PROCEDURAL_THREE_QUARTER.png"),
    ]
    cards = "\n".join(f'<figure><img src="{src}" alt="{title}"><figcaption>{title}</figcaption></figure>' for title,src in items)
    REVIEW_BOARD.write_text(f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chicken R9.9 视觉审查板</title><style>*{{box-sizing:border-box}}body{{margin:0;background:#171f25;color:#edf1f1;font:14px/1.55 system-ui,-apple-system,Segoe UI,Microsoft Yahei,sans-serif}}header{{padding:24px 28px;border-bottom:1px solid #344149}}h1{{margin:0 0 7px;font-size:22px}}p{{margin:5px 0;color:#b9c6c6}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;padding:20px}}figure{{margin:0;background:#10171c;border:1px solid #35434a;border-radius:8px;overflow:hidden}}img{{display:block;width:100%;height:360px;object-fit:contain;background:#182027}}figcaption{{padding:10px 12px;color:#d9e2e1}}.gate{{margin:0 20px 24px;padding:15px;border-left:4px solid #c59c61;background:#222a2f}}</style></head><body><header><h1>Chicken V4.6 R9.9 · 场景距离头面候选</h1><p>不继承 R9.8.3 板状头或 R9.8.4 球状替代头。候选从冻结 R9.1 连续载体重启，只做原位短喙和贴附面部零件。</p></header><main class="grid">{cards}</main><section class="gate"><b>门槛：</b>3–5 米等效观察距离下，左右、正面、顶部与三分之四视图均不得出现板面、球头、悬浮眼、喙根裂缝、肉垂脱离或头颈断裂。</section></body></html>''', encoding="utf-8")


def write_manifest() -> None:
    paths=[SOURCE,OUTPUT,PARAMS,STATIC_QA,BROWSER_QA,REVIEW_BOARD,ROOT/"reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png"]
    paths.extend(sorted(REVIEW_BOARD.parent.glob("*.png")))
    files=[]
    for path in paths:
        if path.exists(): files.append({"path":str(path.relative_to(ROOT)),"bytes":path.stat().st_size,"sha256":sha256(path)})
    write_json(MANIFEST,{"schema":"life_ecosystem/build_manifest@1.0","package":"CHICKEN_V4_6_R9_9_GAMEPLAY_HEAD_CANDIDATE","active_entry":OUTPUT.name,"frozen_source":SOURCE.name,"manual_visual_acceptance":False,"files":files})


def main() -> int:
    build=build_html();write_parameters();write_static_qa(build);write_review_board();write_manifest();print(json.dumps({"output":str(OUTPUT),"build":build},indent=2));return 0


if __name__ == "__main__":
    raise SystemExit(main())
