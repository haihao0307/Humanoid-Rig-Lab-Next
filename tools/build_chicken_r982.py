#!/usr/bin/env python3
"""Build Chicken V4.6 R9.8.2.

This pass fixes the actual source of the neutral-gray eye rosette: the legacy
parts mesh is only excluded when the candidate supplies four eye/eyelid
patches. R9.8.2 supplies two embedded spherical eyes plus two compact upper
lids, relocates the eyes upward/forward, and further embeds/narrows the bill.
"""
from __future__ import annotations

import json
from pathlib import Path

import build_chicken_r981 as r981

base = r981.base
base.OUTPUT = base.ROOT / "CHICKEN_V46_R9_8_2_HEAD_EYE_BILL.html"
base.PARAMS = base.ROOT / "data" / "CHICKEN_R982_HEAD_EYE_BILL_PARAMETERS.json"
base.STATIC_QA = base.ROOT / "qa" / "CHICKEN_R982_STATIC_QA.json"
base.BROWSER_QA = base.ROOT / "qa" / "CHICKEN_R982_BROWSER_QA.json"
base.MANIFEST = base.ROOT / "BUILD_MANIFEST_R982.json"
base.REVIEW_BOARD = base.ROOT / "evidence" / "r982" / "R982_REVIEW_BOARD.html"
base.PATCH_MARKER = "CHICKEN_R982_HEAD_EYE_BILL_PATCH"
base.VISIBLE_REPLACEMENTS = {
    "<title>Chicken R9.1 · Final Silhouette & Head Top Gate</title>": "<title>Chicken R9.8.2 · Legacy Eye Removal and Bill Refinement</title>",
    "鸡 · R9.1 · 最终轮廓与头顶收敛": "鸡 · R9.8.2 · 旧眼移除与短喙收敛",
    "冻结 R9 作为前版 · 重塑头顶、单冠连续叶片与面部材质边界 · 继续检查全身轮廓": "从冻结 R9.1 重建 · 四片眼/眼睑候选替换旧眼零件，短喙进一步内嵌",
    "后：R9.1 头顶与轮廓": "后：R9.8.2 头眼喙候选",
    "在 R9 可回退基线上修正头顶与单冠": "在冻结 R9.1 上验证旧眼移除、真实眼球与短喙",
    "R9.1 当前候选": "R9.8.2 当前候选",
}


def replace_block(text: str, start: str, end: str, replacement: str) -> str:
    a = text.find(start)
    b = text.find(end, a + len(start))
    if a < 0 or b < 0:
        raise RuntimeError(f"Unable to locate override block: {start!r} .. {end!r}")
    return text[:a] + replacement.rstrip() + "\n" + text[b:]


override = base.JS_OVERRIDE
override = override.replace("CHICKEN_R981_HEAD_EYE_BILL_PATCH", "CHICKEN_R982_HEAD_EYE_BILL_PATCH", 1)
override = override.replace("__CHICKEN_R981_", "__CHICKEN_R982_")
override = override.replace(
    "V4.6_R9.8_1_HEAD_EYE_BILL_REFINEMENT_CANDIDATE",
    "V4.6_R9.8_2_LEGACY_EYE_REMOVAL_BILL_REFINEMENT_CANDIDATE",
)
override = override.replace("R9.8.1 · 头部、眼与短喙候选", "R9.8.2 · 旧眼移除与短喙候选")
override = override.replace(
    "R9.8.1 保留连续头颈与旧喙内收路线；眼部改为小型嵌入式球面，短喙根部进一步缩小并埋入面部，下颌肉垂移到喙下，头部下边界保护进一步收紧。",
    "R9.8.2 明确移除 parts 网格中的旧眼零件：每侧生成一枚嵌入式球眼和一条紧凑上眼睑，使候选眼片总数达到四片；眼位上移前移，短喙根部进一步缩小并埋入面部。",
)

override = replace_block(
    override,
    "function __r98BuildBill(ctrl){",
    "const __r98OldEyes=buildSurfaceEyesR9;",
    r'''function __r98BuildBill(ctrl){
 const P=[],I=[],UV=[],n=32,na=36,x0=.430,x1=.480;
 for(let i=0;i<n;i++){const s=i/n,x=x0+(x1-x0)*s,e=Math.pow(1-s,.82),cy=.933-.0058*s,top=.0120*e+.00060,bottom=.0088*e+.00060,rz=.0135*e+.00060;for(let j=0;j<na;j++){const th=2*Math.PI*j/na,c=Math.cos(th),sn=Math.sin(th),y=cy+(c>=0?top*Math.pow(c,.88):-bottom*Math.pow(-c,.84));P.push(x,y,.09+rz*sn);UV.push(s,j/na);}}
 for(let i=0;i<n-1;i++)for(let j=0;j<na;j++){const a=i*na+j,b=(i+1)*na+j,c=(i+1)*na+(j+1)%na,d=i*na+(j+1)%na;I.push(a,d,b,b,d,c);}const tip=P.length/3;P.push(x1,.9265,.09);UV.push(1,.5);const last=(n-1)*na;for(let j=0;j<na;j++){const a=last+j,b=last+(j+1)%na;I.push(a,b,tip);}
 let deg=0;for(let k=0;k<I.length;k+=3){const a=I[k]*3,b=I[k+1]*3,c=I[k+2]*3,ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],vx=P[c]-P[a],vy=P[c+1]-P[a+1],vz=P[c+2]-P[a+2],cx=uy*vz-uz*vy,cy=uz*vx-ux*vz,cz=ux*vy-uy*vx;if(cx*cx+cy*cy+cz*cz<1e-18)deg++;}const audit={vertices:P.length/3,triangles:I.length/3,finite:P.every(Number.isFinite),degenerateTriangles:deg,rootEmbedded:true,rootX:x0,tipX:x1};window.__CHICKEN_R982_BILL_AUDIT__=audit;return{positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2}},audit};
}''',
)

override = replace_block(
    override,
    "const __r98OldEyes=buildSurfaceEyesR9;",
    "const __r98OldEars=buildEarLobesR9;",
    r'''const __r98OldEyes=buildSurfaceEyesR9;
buildSurfaceEyesR9=function(chart,ctrl,amount){
 if(!__r98CandidatePhase)return __r98OldEyes(chart,ctrl,amount);
 const out=[],nLat=18,nLon=32,cx=.399,cy=.949;
 for(const side of[-1,1]){
  const anchor=chart.at(cx,cy,side,0);if(!anchor)continue;
  const r=.0070*ctrl.head_scale*ctrl.eye_scale,px=anchor.p.x,py=anchor.p.y,pz=anchor.p.z+side*r*.45,P=[],I=[],UV=[];
  const north=0;P.push(px,py+r,pz);UV.push(0,1);
  for(let i=1;i<nLat;i++){const phi=Math.PI*i/nLat,sp=Math.sin(phi),cp=Math.cos(phi);for(let j=0;j<nLon;j++){const th=2*Math.PI*j/nLon,dx=r*sp*Math.cos(th),dy=r*cp,dz=r*sp*Math.sin(th);P.push(px+dx,py+dy,pz+dz);UV.push(dx/r,dy/r);}}
  const south=P.length/3;P.push(px,py-r,pz);UV.push(0,-1);const first=1;
  for(let j=0;j<nLon;j++){const a=first+j,b=first+(j+1)%nLon;I.push(north,b,a);}for(let i=0;i<nLat-2;i++)for(let j=0;j<nLon;j++){const a=first+i*nLon+j,b=first+(i+1)*nLon+j,c=first+(i+1)*nLon+(j+1)%nLon,d=first+i*nLon+(j+1)%nLon;I.push(a,d,b,b,d,c);}const last=first+(nLat-2)*nLon;for(let j=0;j<nLon;j++){const a=last+j,b=last+(j+1)%nLon;I.push(a,b,south);}
  out.push({positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2}},kind:'iris'});
  const LP=[],LI=[],LUV=[],segments=36,a0=.12*Math.PI,a1=.88*Math.PI;
  for(let k=0;k<=segments;k++){const t=k/segments,aa=a0+(a1-a0)*t,taper=.05+.95*Math.pow(Math.sin(Math.PI*t),.82);for(const rr of[1.04,1.04+.10*taper]){const x=cx+r*rr*Math.cos(aa),y=cy+r*.88*rr*Math.sin(aa),q=chart.at(x,y,side,.00042+.00040*taper);if(!q){LP.length=0;break;}LP.push(...q.p.toArray());LUV.push(Math.cos(aa)*rr,Math.sin(aa)*rr);}if(!LP.length)break;}
  if(LP.length){for(let k=0;k<segments;k++){const a=2*k,b=a+1,c=a+2,d=a+3;if(side>0)LI.push(a,c,b,b,c,d);else LI.push(a,b,c,b,d,c);}out.push({positions:new Float32Array(LP),indices:new Uint32Array(LI),attrs:{uv:{array:new Float32Array(LUV),size:2}},kind:'lid'});}
 }
 window.__CHICKEN_R982_EYE_AUDIT__={patches:out.length,spheres:out.filter(v=>v.kind==='iris').length,lids:out.filter(v=>v.kind==='lid').length,geometry:'embedded_sphere_plus_upper_lid',radius:.0070,legacyPartsExcluded:out.length===4};
 return out.length===4?out:[];
};''',
)
base.JS_OVERRIDE = override.strip()

_old_params = r981.write_parameters
_old_static = r981.write_static_qa
_old_state = r981.write_state_and_handoff
_old_manifest = r981.write_manifest


def write_parameters() -> None:
    _old_params()
    data = json.loads(base.PARAMS.read_text(encoding="utf-8"))
    data["version"] = "V4.6_R9.8.2"
    data["status"] = "legacy_eye_removed_embedded_eye_bill_refinement_candidate"
    data["source"]["predecessor"] = "V4.6_R9.8.1_HEAD_EYE_BILL_REFINEMENT_CANDIDATE"
    data["bounded_changes"]["compact_bill"] = {"root_x": 0.430, "tip_x": 0.480, "root_cap": False, "embedded_root": True, "root_vertical_radii": [0.0120,0.0088], "root_lateral_radius": 0.0135}
    data["bounded_changes"]["eyes"] = {"geometry": "embedded_sphere_plus_upper_lid", "center_xy": [0.399,0.949], "radius": 0.0070, "patches": 4, "legacy_parts_excluded": True}
    base.write_json(base.PARAMS, data)


def write_static_qa(build: dict) -> None:
    _old_static(build)
    data = json.loads(base.STATIC_QA.read_text(encoding="utf-8"))
    data["schema"] = "life_ecosystem/chicken_r982_static_qa@1.0"
    data["version"] = "V4.6_R9.8_2_LEGACY_EYE_REMOVAL_BILL_REFINEMENT_CANDIDATE"
    base.write_json(base.STATIC_QA, data)


def write_review_board() -> None:
    base.REVIEW_BOARD.parent.mkdir(parents=True, exist_ok=True)
    items=[("批准的视觉构形参考","../../reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png"),("R9.1 冻结侧面","R91_BASELINE_HEAD_NEUTRAL_LEFT.png"),("R9.8.2 左侧","R982_HEAD_NEUTRAL_LEFT.png"),("R9.8.2 右侧","R982_HEAD_NEUTRAL_RIGHT.png"),("R9.8.2 正面","R982_HEAD_NEUTRAL_FRONT.png"),("R9.8.2 顶部","R982_HEAD_NEUTRAL_TOP.png"),("R9.8.2 三分之四","R982_HEAD_NEUTRAL_THREE_QUARTER.png"),("R9.8.2 左侧线框","R982_HEAD_WIRE_LEFT.png"),("R9.8.2 全身中性灰","R982_WHOLE_NEUTRAL_THREE_QUARTER.png"),("R9.8.2 全身程序材质","R982_WHOLE_PROCEDURAL_THREE_QUARTER.png")]
    cards="\n".join(f'<figure><img src="{src}" alt="{title}"><figcaption>{title}</figcaption></figure>' for title,src in items)
    base.REVIEW_BOARD.write_text(f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chicken R9.8.2 视觉审查板</title><style>*{{box-sizing:border-box}}body{{margin:0;background:#171f25;color:#edf1f1;font:14px/1.55 system-ui,-apple-system,Segoe UI,Microsoft Yahei,sans-serif}}header{{padding:24px 28px;border-bottom:1px solid #344149}}h1{{margin:0 0 7px;font-size:22px}}p{{margin:5px 0;color:#b9c6c6}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;padding:20px}}figure{{margin:0;background:#10171c;border:1px solid #35434a;border-radius:8px;overflow:hidden}}img{{display:block;width:100%;height:360px;object-fit:contain;background:#182027}}figcaption{{padding:10px 12px;color:#d9e2e1}}.gate{{margin:0 20px 24px;padding:15px;border-left:4px solid #c59c61;background:#222a2f}}</style></head><body><header><h1>Chicken V4.6 R9.8.2 · 旧眼移除与短喙收敛</h1><p>四片眼/眼睑候选替换 parts 网格中的旧眼零件；参考图仅作为视觉构形锚点。</p></header><main class="grid">{cards}</main><section class="gate"><b>当前门槛：</b>技术检查与视觉检查分离；独立视觉审查通过前，Rig 与 Motion 保持关闭。</section></body></html>''',encoding="utf-8")


def write_state_and_handoff(browser_ok: bool) -> None:
    _old_state(browser_ok)
    state=json.loads(base.STATE.read_text(encoding="utf-8"));state["version"]="V4.6_R9.8_2_LEGACY_EYE_REMOVAL_BILL_REFINEMENT_CANDIDATE";state["head_status"]={"r9_2_through_r9_8_1_visual_gate_passed":False,"r9_8_2_candidate_built":True,"r9_8_2_browser_qa_passed":browser_ok,"legacy_eye_parts_excluded":True,"manual_visual_acceptance":False};state["next_stage"]="INDEPENDENT_VISUAL_AUDIT_R982_THEN_BOUNDED_REFINEMENT";base.write_json(base.STATE,state)
    text=f'''# Chicken V4.6 R9.8.2 — Legacy Eye Removal and Bill Refinement Candidate

## Active executable

`{base.OUTPUT.name}`

## Frozen rollback

- exact R9.1 executable: `{base.SOURCE.name}`
- exact R9 executable: `history/CHICKEN_V46_R9_FROZEN.html`

## What changed

The persistent neutral-gray rosette was traced to legacy eye parts in the `parts` mesh, not to the replacement iris module. R9.8.2 supplies exactly four eye patches—two embedded spherical eyes and two compact upper lids—so the existing exclusion rule removes legacy part IDs 1 and 2. The eyes are shifted upward/forward and the short bill is further narrowed and embedded.

## Evidence and QA

- parameters: `{base.PARAMS.relative_to(base.ROOT)}`
- static QA: `{base.STATIC_QA.relative_to(base.ROOT)}`
- browser QA: `{base.BROWSER_QA.relative_to(base.ROOT)}`
- visual review board: `{base.REVIEW_BOARD.relative_to(base.ROOT)}`
- manifest: `{base.MANIFEST.name}`

Browser QA passed: `{str(browser_ok).lower()}`.

## Truth boundary

This remains a visual construction candidate. Manual visual acceptance, whole-surface freeze, Rig and Motion remain closed.
'''
    for path in [base.README,base.HANDOFF,base.FULL_HANDOFF]:path.write_text(text,encoding="utf-8")
    base.NEXT_PLAN.write_text("""# Next Stage — Chicken R9.8.2 Independent Visual Audit

1. Verify that the neutral-gray legacy eye rosettes are gone in left, right and front views.
2. Check the new spherical eye and upper-lid relationship, short-bill root, cheek/jaw support and attached wattles.
3. Verify lower-neck and full-body invariants remain unchanged.
4. Apply only bounded local corrections; do not reopen body, wing, tail or feet.
5. Keep Rig and Motion blocked until the whole-head visual gate passes.
""",encoding="utf-8")


def write_manifest() -> None:
    _old_manifest();data=json.loads(base.MANIFEST.read_text(encoding="utf-8"));data["package"]="CHICKEN_V4_6_R9_8_2_LEGACY_EYE_REMOVAL_BILL_REFINEMENT_2026-09-16";data["active_entry"]=base.OUTPUT.name;base.write_json(base.MANIFEST,data)

base.write_parameters=write_parameters
base.write_static_qa=write_static_qa
base.write_review_board=write_review_board
base.write_state_and_handoff=write_state_and_handoff
base.write_manifest=write_manifest

if __name__=="__main__":raise SystemExit(base.main())
