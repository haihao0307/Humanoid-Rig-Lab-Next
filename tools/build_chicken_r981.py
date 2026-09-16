#!/usr/bin/env python3
"""Build Chicken V4.6 R9.8.1 from the bounded R9.8 route.

R9.8.1 keeps the connected head and collapsed legacy bill, but replaces the
chart-projected rosette eye with a small embedded spherical eye, reduces and
embeds the compact bill root, moves the wattles beneath the jaw, and tightens
the lower-neck guard. The frozen R9.1 executable remains untouched.
"""
from __future__ import annotations

from pathlib import Path

import build_chicken_r98 as r98

base = r98.base
base.OUTPUT = base.ROOT / "CHICKEN_V46_R9_8_1_HEAD_EYE_BILL.html"
base.PARAMS = base.ROOT / "data" / "CHICKEN_R981_HEAD_EYE_BILL_PARAMETERS.json"
base.STATIC_QA = base.ROOT / "qa" / "CHICKEN_R981_STATIC_QA.json"
base.BROWSER_QA = base.ROOT / "qa" / "CHICKEN_R981_BROWSER_QA.json"
base.MANIFEST = base.ROOT / "BUILD_MANIFEST_R981.json"
base.REVIEW_BOARD = base.ROOT / "evidence" / "r981" / "R981_REVIEW_BOARD.html"
base.PATCH_MARKER = "CHICKEN_R981_HEAD_EYE_BILL_PATCH"
base.VISIBLE_REPLACEMENTS = {
    "<title>Chicken R9.1 · Final Silhouette & Head Top Gate</title>": "<title>Chicken R9.8.1 · Head, Eye and Bill Refinement</title>",
    "鸡 · R9.1 · 最终轮廓与头顶收敛": "鸡 · R9.8.1 · 头部、眼与短喙收敛候选",
    "冻结 R9 作为前版 · 重塑头顶、单冠连续叶片与面部材质边界 · 继续检查全身轮廓": "从冻结 R9.1 重建 · 保留连续头颈，修复眼球、喙根与下颌软组织",
    "后：R9.1 头顶与轮廓": "后：R9.8.1 头眼喙候选",
    "在 R9 可回退基线上修正头顶与单冠": "在冻结 R9.1 上验证头部、眼与闭合短喙",
    "R9.1 当前候选": "R9.8.1 当前候选",
}


def replace_block(text: str, start: str, end: str, replacement: str) -> str:
    a = text.find(start)
    b = text.find(end, a + len(start))
    if a < 0 or b < 0:
        raise RuntimeError(f"Unable to locate override block: {start!r} .. {end!r}")
    return text[:a] + replacement.rstrip() + "\n" + text[b:]


override = (base.ROOT / "tools" / "chicken_r98_override.js").read_text(encoding="utf-8")
override = override.replace("CHICKEN_R98_HEAD_BILL_PATCH", "CHICKEN_R981_HEAD_EYE_BILL_PATCH", 1)
override = override.replace("__CHICKEN_R98_PATCH__", "__CHICKEN_R981_PATCH__")
override = override.replace("__CHICKEN_R98_LAST_HEAD_AUDIT__", "__CHICKEN_R981_LAST_HEAD_AUDIT__")
override = override.replace("__CHICKEN_R98_PROFILE_AUDIT__", "__CHICKEN_R981_PROFILE_AUDIT__")
override = override.replace("__CHICKEN_R98_BILL_AUDIT__", "__CHICKEN_R981_BILL_AUDIT__")
override = override.replace(
    "V4.6_R9.8_CONNECTED_HEAD_COLLAPSED_LEGACY_BILL_CANDIDATE",
    "V4.6_R9.8_1_HEAD_EYE_BILL_REFINEMENT_CANDIDATE",
)
override = override.replace("// R9.8 keeps the connected dorsal head", "// R9.8.1 keeps the connected dorsal head")
override = override.replace("upper=ss(top-.142,top-.020,oy)", "upper=ss(top-.126,top-.020,oy)")
override = override.replace("(p[q+1]-.930)*.055", "(p[q+1]-.930)*.035")
override = override.replace("(p[q+2]-.09)*.055", "(p[q+2]-.09)*.035")

override = replace_block(
    override,
    "function __r98BuildBill(ctrl){",
    "const __r98OldEyes=buildSurfaceEyesR9;",
    r'''function __r98BuildBill(ctrl){
 const P=[],I=[],UV=[],n=32,na=36,x0=.428,x1=.481;
 for(let i=0;i<n;i++){const s=i/n,x=x0+(x1-x0)*s,e=Math.pow(1-s,.80),cy=.932-.0052*s,top=.0138*e+.00065,bottom=.0104*e+.00065,rz=.0168*e+.00065;for(let j=0;j<na;j++){const th=2*Math.PI*j/na,c=Math.cos(th),sn=Math.sin(th),y=cy+(c>=0?top*Math.pow(c,.88):-bottom*Math.pow(-c,.84));P.push(x,y,.09+rz*sn);UV.push(s,j/na);}}
 for(let i=0;i<n-1;i++)for(let j=0;j<na;j++){const a=i*na+j,b=(i+1)*na+j,c=(i+1)*na+(j+1)%na,d=i*na+(j+1)%na;I.push(a,d,b,b,d,c);}const tip=P.length/3;P.push(x1,.9268,.09);UV.push(1,.5);const last=(n-1)*na;for(let j=0;j<na;j++){const a=last+j,b=last+(j+1)%na;I.push(a,b,tip);}
 let deg=0;for(let k=0;k<I.length;k+=3){const a=I[k]*3,b=I[k+1]*3,c=I[k+2]*3,ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],vx=P[c]-P[a],vy=P[c+1]-P[a+1],vz=P[c+2]-P[a+2],cx=uy*vz-uz*vy,cy=uz*vx-ux*vz,cz=ux*vy-uy*vx;if(cx*cx+cy*cy+cz*cz<1e-18)deg++;}const audit={vertices:P.length/3,triangles:I.length/3,finite:P.every(Number.isFinite),degenerateTriangles:deg,rootEmbedded:true,rootX:x0,tipX:x1};window.__CHICKEN_R981_BILL_AUDIT__=audit;return{positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2}},audit};
}''',
)

override = replace_block(
    override,
    "const __r98OldEyes=buildSurfaceEyesR9;",
    "const __r98OldEars=buildEarLobesR9;",
    r'''const __r98OldEyes=buildSurfaceEyesR9;
buildSurfaceEyesR9=function(chart,ctrl,amount){
 if(!__r98CandidatePhase)return __r98OldEyes(chart,ctrl,amount);
 const out=[],nLat=18,nLon=32;
 for(const side of[-1,1]){
  const anchor=chart.at(.386,.940,side,0);if(!anchor)continue;
  const r=.00645*ctrl.head_scale*ctrl.eye_scale,cx=anchor.p.x,cy=anchor.p.y,cz=anchor.p.z+side*r*.42,P=[],I=[],UV=[];
  const north=0;P.push(cx,cy+r,cz);UV.push(0,1);
  for(let i=1;i<nLat;i++){const phi=Math.PI*i/nLat,sp=Math.sin(phi),cp=Math.cos(phi);for(let j=0;j<nLon;j++){const th=2*Math.PI*j/nLon,dx=r*sp*Math.cos(th),dy=r*cp,dz=r*sp*Math.sin(th);P.push(cx+dx,cy+dy,cz+dz);UV.push(dx/r,dy/r);}}
  const south=P.length/3;P.push(cx,cy-r,cz);UV.push(0,-1);const first=1;
  for(let j=0;j<nLon;j++){const a=first+j,b=first+(j+1)%nLon;I.push(north,b,a);}
  for(let i=0;i<nLat-2;i++)for(let j=0;j<nLon;j++){const a=first+i*nLon+j,b=first+(i+1)*nLon+j,c=first+(i+1)*nLon+(j+1)%nLon,d=first+i*nLon+(j+1)%nLon;I.push(a,d,b,b,d,c);}
  const last=first+(nLat-2)*nLon;for(let j=0;j<nLon;j++){const a=last+j,b=last+(j+1)%nLon;I.push(a,b,south);}
  out.push({positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2}},kind:'iris'});
 }
 window.__CHICKEN_R981_EYE_AUDIT__={patches:out.length,geometry:'embedded_sphere',radius:.00645};
 return out;
};''',
)

override = replace_block(
    override,
    "const __r98OldSoft=buildSoftTissueR9;",
    "buildCombR91=function(chart,ctrl,amount=1){",
    r'''const __r98OldSoft=buildSoftTissueR9;
buildSoftTissueR9=function(ctrl,chart,amount){
 if(!__r98CandidatePhase)return __r98OldSoft(ctrl,chart,amount);
 const out=[];for(const side of[-1,1]){const ns=30,na=24,P=[],I=[],root=chart.at(.414,.884,side,.00010);if(!root)continue;for(let i=0;i<ns;i++){const s=i/(ns-1),shape=.05+.95*Math.pow(Math.sin(Math.PI*s),.68),x=.414-.008*s-.0025*Math.sin(Math.PI*s),y=.884-.041*s-.0025*Math.sin(Math.PI*s),outward=ss(.02,.28,s),zz=root.p.z*(1-outward)+(.09+side*(.047-.003*s))*outward,rx=.0076*shape*ctrl.soft_tissue_scale,rz=.0040*shape*ctrl.soft_tissue_scale;for(let j=0;j<na;j++){const aa=2*Math.PI*j/na;P.push(x+rx*Math.cos(aa),y,zz+side*rz*Math.sin(aa));}}for(let i=0;i<ns-1;i++)for(let j=0;j<na;j++){const a=i*na+j,b=i*na+(j+1)%na,c=(i+1)*na+(j+1)%na,d=(i+1)*na+j;if(side>0)I.push(a,d,b,b,d,c);else I.push(a,b,d,b,c,d);}out.push({positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{},kind:'lid'});}return out;
};''',
)

override = override.replace(
    "R9.8 · 连续头部与内收旧喙候选",
    "R9.8.1 · 头部、眼与短喙候选",
)
override = override.replace(
    "R9.8 不再裁切旧喙三角形，而是把旧喙完整内收到新喙根内部，消除切口尖刺；头部变形只作用于上颅和侧颊/下颌，不移动下颈或身体。新喙更短、更窄并在根部和尖端闭合。",
    "R9.8.1 保留连续头颈与旧喙内收路线；眼部改为小型嵌入式球面，短喙根部进一步缩小并埋入面部，下颌肉垂移到喙下，头部下边界保护进一步收紧。",
)
base.JS_OVERRIDE = override.strip()


def write_parameters() -> None:
    base.write_json(base.PARAMS, {
        "schema": "life_ecosystem/chicken_head_shape_candidate@1.0",
        "version": "V4.6_R9.8.1",
        "status": "connected_head_eye_bill_refinement_candidate_not_anatomical_truth",
        "units": "normalized_source_units_not_meters",
        "source": {
            "frozen_executable": base.SOURCE.name,
            "sha256": base.EXPECTED_SOURCE_SHA256,
            "approved_visual_reference": "reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png",
            "predecessor": "V4.6_R9.8_CONNECTED_HEAD_COLLAPSED_LEGACY_BILL_CANDIDATE",
        },
        "bounded_changes": {
            "dorsal_lower_guard": "ring_top-0.126",
            "legacy_bill_radial_collapse": 0.035,
            "compact_bill": {"root_x": 0.428, "tip_x": 0.481, "root_cap": False, "embedded_root": True, "root_vertical_radii": [0.0138, 0.0104], "root_lateral_radius": 0.0168},
            "eyes": {"geometry": "embedded_sphere", "radius": 0.00645, "outward_center_fraction": 0.42, "eyelid_patch": False},
            "wattles": {"root_xy": [0.414, 0.884], "length": 0.041, "maximum_width": 0.0076},
        },
        "preserved": ["R9/R9.1 rollback", "lower neck", "body", "plumage", "wings", "tail", "feet", "materials", "existing controls"],
        "truth_boundary": {"manual_visual_acceptance": False, "whole_visual_gate_passed": False, "rig_authorized": False, "motion_authorized": False, "anatomical_truth_claimed": False},
    })


def write_static_qa(build: dict) -> None:
    output_text = base.OUTPUT.read_text(encoding="utf-8") if base.OUTPUT.exists() else ""
    checks = {
        "frozen_source_hash_matches": build["source_sha256"] == base.EXPECTED_SOURCE_SHA256,
        "frozen_source_preserved": build["source_preserved"],
        "single_scene_anchor": build["anchor_count"] == 1,
        "single_patch_marker": build["patch_marker_count"] == 1,
        "output_created": base.OUTPUT.exists(),
        "output_larger_than_source": build["output_bytes"] > build["source_bytes"],
        "all_visible_replacement_anchors_found": all(build["visible_replacements"].values()),
        "patch_node_syntax": build["patch_node_syntax"],
        "no_rejected_patch_implementation": all(marker not in output_text for marker in [
            "CHICKEN_R92_HEAD_SHAPE_PATCH", "CHICKEN_R93_HEAD_SHAPE_PATCH",
            "CHICKEN_R94_INTEGRATED_HEAD_CARRIER_PATCH", "CHICKEN_R95_HEAD_CARRIER_PATCH",
            "CHICKEN_R96_HEAD_REFINEMENT_PATCH", "CHICKEN_R97_HEAD_BILL_PATCH",
            "CHICKEN_R98_HEAD_BILL_PATCH",
        ]),
    }
    base.write_json(base.STATIC_QA, {
        "schema": "life_ecosystem/chicken_r981_static_qa@1.0",
        "version": "V4.6_R9.8_1_HEAD_EYE_BILL_REFINEMENT_CANDIDATE",
        "checks": checks,
        "passed": all(checks.values()),
        "build": build,
        "scope": "source integrity and patch syntax; browser geometry and visual gates are separate",
    })
    if not all(checks.values()):
        raise RuntimeError(f"Static QA failed: {[k for k,v in checks.items() if not v]}")


def write_review_board() -> None:
    base.REVIEW_BOARD.parent.mkdir(parents=True, exist_ok=True)
    items = [
        ("批准的视觉构形参考", "../../reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png"),
        ("R9.1 冻结侧面", "R91_BASELINE_HEAD_NEUTRAL_LEFT.png"),
        ("R9.8.1 左侧", "R981_HEAD_NEUTRAL_LEFT.png"),
        ("R9.8.1 右侧", "R981_HEAD_NEUTRAL_RIGHT.png"),
        ("R9.8.1 正面", "R981_HEAD_NEUTRAL_FRONT.png"),
        ("R9.8.1 顶部", "R981_HEAD_NEUTRAL_TOP.png"),
        ("R9.8.1 三分之四", "R981_HEAD_NEUTRAL_THREE_QUARTER.png"),
        ("R9.8.1 左侧线框", "R981_HEAD_WIRE_LEFT.png"),
        ("R9.8.1 全身中性灰", "R981_WHOLE_NEUTRAL_THREE_QUARTER.png"),
        ("R9.8.1 全身程序材质", "R981_WHOLE_PROCEDURAL_THREE_QUARTER.png"),
    ]
    cards = "\n".join(f'<figure><img src="{src}" alt="{title}"><figcaption>{title}</figcaption></figure>' for title,src in items)
    base.REVIEW_BOARD.write_text(f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chicken R9.8.1 视觉审查板</title><style>*{{box-sizing:border-box}}body{{margin:0;background:#171f25;color:#edf1f1;font:14px/1.55 system-ui,-apple-system,Segoe UI,Microsoft Yahei,sans-serif}}header{{padding:24px 28px;border-bottom:1px solid #344149}}h1{{margin:0 0 7px;font-size:22px}}p{{margin:5px 0;color:#b9c6c6}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;padding:20px}}figure{{margin:0;background:#10171c;border:1px solid #35434a;border-radius:8px;overflow:hidden}}img{{display:block;width:100%;height:360px;object-fit:contain;background:#182027}}figcaption{{padding:10px 12px;color:#d9e2e1}}.gate{{margin:0 20px 24px;padding:15px;border-left:4px solid #c59c61;background:#222a2f}}</style></head><body><header><h1>Chicken V4.6 R9.8.1 · 头部、眼与短喙收敛候选</h1><p>参考图只作为视觉构形锚点，不代表测量解剖、品种、性别、年龄或个体真值。</p></header><main class="grid">{cards}</main><section class="gate"><b>当前门槛：</b>技术检查与视觉检查分离；独立视觉审查通过前，Rig 与 Motion 保持关闭。</section></body></html>''', encoding="utf-8")


def write_state_and_handoff(browser_ok: bool) -> None:
    base.write_json(base.STATE, {
        "schema": "life_ecosystem/chicken_module_state@1.0",
        "version": "V4.6_R9.8_1_HEAD_EYE_BILL_REFINEMENT_CANDIDATE",
        "date": "2026-09-16",
        "identity": {"species_scope": "domestic chicken surface candidate", "sex": "unknown", "breed": "unknown", "age": "unknown", "real_world_scale": "unknown"},
        "active_entry": base.OUTPUT.name,
        "frozen_r9_1_baseline": base.SOURCE.name,
        "approved_head_reference": "reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png",
        "candidate_parameters": str(base.PARAMS.relative_to(base.ROOT)),
        "review_board": str(base.REVIEW_BOARD.relative_to(base.ROOT)),
        "head_status": {"r9_2_through_r9_7_visual_gate_passed": False, "r9_8_visual_gate_passed": False, "r9_8_1_candidate_built": True, "r9_8_1_browser_qa_passed": browser_ok, "manual_visual_acceptance": False},
        "qa": {"technical_gate_passed": browser_ok, "current_executable_reproducible": True, "whole_visual_gate_passed": False, "canonical_chicken_surface_complete": False, "rig_authorized": False, "motion_implemented": False, "production_ready": False, "public_https_published": True},
        "next_stage": "INDEPENDENT_VISUAL_AUDIT_R981_THEN_BOUNDED_REFINEMENT",
    })
    text = f'''# Chicken V4.6 R9.8.1 — Head, Eye and Bill Refinement Candidate

## Active executable

`{base.OUTPUT.name}`

## Frozen rollback

- exact R9.1 executable: `{base.SOURCE.name}`
- exact R9 executable: `history/CHICKEN_V46_R9_FROZEN.html`

## What changed

R9.8.1 retains R9.8's connected carrier and hidden legacy-bill strategy. The lower carrier guard is tightened, the replacement bill is smaller and rooted inside the face, the chart-projected rosette eye is replaced by a small embedded spherical eye, and the wattles are moved beneath the jaw.

## Evidence and QA

- parameters: `{base.PARAMS.relative_to(base.ROOT)}`
- static QA: `{base.STATIC_QA.relative_to(base.ROOT)}`
- browser QA: `{base.BROWSER_QA.relative_to(base.ROOT)}`
- visual review board: `{base.REVIEW_BOARD.relative_to(base.ROOT)}`
- manifest: `{base.MANIFEST.name}`

Browser QA passed: `{str(browser_ok).lower()}`.

## Truth boundary

This remains a visual construction candidate. It does not establish measured skull anatomy, breed, sex, age or individual identity. Manual visual acceptance, whole-surface freeze, Rig and Motion remain closed.
'''
    for path in [base.README, base.HANDOFF, base.FULL_HANDOFF]:
        path.write_text(text, encoding="utf-8")
    base.NEXT_PLAN.write_text("""# Next Stage — Chicken R9.8.1 Independent Visual Audit

1. Compare neutral left/right/front/top/three-quarter views with the approved construction reference.
2. Check the embedded spherical eye, short-bill face root, posterior cranium, cheek/jaw support and attached wattles.
3. Verify the tightened lower-head boundary did not alter the lower neck or body.
4. Apply only bounded local corrections; do not reopen body, wing, tail or feet.
5. Keep Rig, skin binding and motion blocked until the whole-head silhouette is accepted.
""", encoding="utf-8")


def write_manifest() -> None:
    files = [base.OUTPUT, base.SOURCE, base.PARAMS, base.STATIC_QA, base.BROWSER_QA, base.STATE, base.README, base.HANDOFF, base.FULL_HANDOFF, base.NEXT_PLAN, base.REVIEW_BOARD]
    files.extend(sorted(base.REVIEW_BOARD.parent.glob("*.png")))
    entries = []
    for path in files:
        if path.exists():
            entries.append({"path": str(path.relative_to(base.ROOT)), "bytes": path.stat().st_size, "sha256": base.sha256(path)})
    base.write_json(base.MANIFEST, {"schema": "life_ecosystem/build_manifest@1.0", "package": "CHICKEN_V4_6_R9_8_1_HEAD_EYE_BILL_REFINEMENT_CANDIDATE_2026-09-16", "active_entry": base.OUTPUT.name, "frozen_source": base.SOURCE.name, "frozen_source_sha256": base.EXPECTED_SOURCE_SHA256, "manual_visual_acceptance": False, "files": entries})


base.write_parameters = write_parameters
base.write_static_qa = write_static_qa
base.write_review_board = write_review_board
base.write_state_and_handoff = write_state_and_handoff
base.write_manifest = write_manifest

if __name__ == "__main__":
    raise SystemExit(base.main())
