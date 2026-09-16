#!/usr/bin/env python3
"""Build Chicken V4.6 R9.8.3.

R9.8.3 removes the remaining legacy ear-lobe parts (object IDs 3 and 4) from
the candidate parts mesh and embeds the compact bill root farther inside the
face. No body, lower-neck, wing, tail or foot system is reopened.
"""
from __future__ import annotations

import json

import build_chicken_r982 as r982

base = r982.base
base.OUTPUT = base.ROOT / "CHICKEN_V46_R9_8_3_CLEAN_FACE.html"
base.PARAMS = base.ROOT / "data" / "CHICKEN_R983_CLEAN_FACE_PARAMETERS.json"
base.STATIC_QA = base.ROOT / "qa" / "CHICKEN_R983_STATIC_QA.json"
base.BROWSER_QA = base.ROOT / "qa" / "CHICKEN_R983_BROWSER_QA.json"
base.MANIFEST = base.ROOT / "BUILD_MANIFEST_R983.json"
base.REVIEW_BOARD = base.ROOT / "evidence" / "r983" / "R983_REVIEW_BOARD.html"
base.PATCH_MARKER = "CHICKEN_R983_CLEAN_FACE_PATCH"
base.VISIBLE_REPLACEMENTS = {
    "<title>Chicken R9.1 · Final Silhouette & Head Top Gate</title>": "<title>Chicken R9.8.3 · Clean Face and Embedded Bill Root</title>",
    "鸡 · R9.1 · 最终轮廓与头顶收敛": "鸡 · R9.8.3 · 清洁脸部与内嵌短喙",
    "冻结 R9 作为前版 · 重塑头顶、单冠连续叶片与面部材质边界 · 继续检查全身轮廓": "从冻结 R9.1 重建 · 移除旧耳叶零件并加深短喙根部重叠",
    "后：R9.1 头顶与轮廓": "后：R9.8.3 清洁脸部候选",
    "在 R9 可回退基线上修正头顶与单冠": "在冻结 R9.1 上验证清洁脸部与内嵌短喙",
    "R9.1 当前候选": "R9.8.3 当前候选",
}

override = base.JS_OVERRIDE
override = override.replace("CHICKEN_R982_HEAD_EYE_BILL_PATCH", "CHICKEN_R983_CLEAN_FACE_PATCH", 1)
override = override.replace("__CHICKEN_R982_", "__CHICKEN_R983_")
override = override.replace(
    "V4.6_R9.8_2_LEGACY_EYE_REMOVAL_BILL_REFINEMENT_CANDIDATE",
    "V4.6_R9.8_3_CLEAN_FACE_EMBEDDED_BILL_CANDIDATE",
)
override = override.replace("R9.8.2 · 旧眼移除与短喙候选", "R9.8.3 · 清洁脸部与内嵌短喙")
override = override.replace("x0=.430,x1=.480", "x0=.424,x1=.480")
override = override.replace("rz=.0135*e+.00060", "rz=.0140*e+.00060")
override = override.replace("billRoot:.426,billTip:.484", "billRoot:.424,billTip:.480")
override = override.replace(
    "R9.8.2 明确移除 parts 网格中的旧眼零件：每侧生成一枚嵌入式球眼和一条紧凑上眼睑，使候选眼片总数达到四片；眼位上移前移，短喙根部进一步缩小并埋入面部。",
    "R9.8.3 在旧眼零件已移除的基础上，继续从候选 parts 网格排除旧耳叶对象 3、4；短喙根部前移到 x=0.424 并埋入面部，消除侧视根部裂缝。",
)
override += r'''
const __r983OldFilterPartTriangles=filterPartTriangles;
filterPartTriangles=function(exclude){
 const local=new Set(exclude);
 if(__r98CandidatePhase){local.add(3);local.add(4);window.__CHICKEN_R983_PART_AUDIT__={legacyEyePartsExcluded:local.has(1)&&local.has(2),legacyEarLobesExcluded:true,excluded:[...local].sort((a,b)=>a-b)};}
 return __r983OldFilterPartTriangles(local);
};
'''
base.JS_OVERRIDE = override.strip()

_old_params = r982.write_parameters
_old_static = r982.write_static_qa
_old_state = r982.write_state_and_handoff
_old_manifest = r982.write_manifest


def write_parameters() -> None:
    _old_params()
    data=json.loads(base.PARAMS.read_text(encoding="utf-8"));data["version"]="V4.6_R9.8.3";data["status"]="clean_face_embedded_bill_candidate";data["source"]["predecessor"]="V4.6_R9.8.2_LEGACY_EYE_REMOVAL_BILL_REFINEMENT_CANDIDATE";data["bounded_changes"]["compact_bill"].update({"root_x":0.424,"tip_x":0.480,"root_lateral_radius":0.0140});data["bounded_changes"]["legacy_parts_excluded"]=[1,2,3,4,5,6];base.write_json(base.PARAMS,data)


def write_static_qa(build: dict) -> None:
    _old_static(build);data=json.loads(base.STATIC_QA.read_text(encoding="utf-8"));data["schema"]="life_ecosystem/chicken_r983_static_qa@1.0";data["version"]="V4.6_R9.8_3_CLEAN_FACE_EMBEDDED_BILL_CANDIDATE";base.write_json(base.STATIC_QA,data)


def write_review_board() -> None:
    base.REVIEW_BOARD.parent.mkdir(parents=True,exist_ok=True);items=[("批准的视觉构形参考","../../reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png"),("R9.1 冻结侧面","R91_BASELINE_HEAD_NEUTRAL_LEFT.png"),("R9.8.3 左侧","R983_HEAD_NEUTRAL_LEFT.png"),("R9.8.3 右侧","R983_HEAD_NEUTRAL_RIGHT.png"),("R9.8.3 正面","R983_HEAD_NEUTRAL_FRONT.png"),("R9.8.3 顶部","R983_HEAD_NEUTRAL_TOP.png"),("R9.8.3 三分之四","R983_HEAD_NEUTRAL_THREE_QUARTER.png"),("R9.8.3 左侧线框","R983_HEAD_WIRE_LEFT.png"),("R9.8.3 全身中性灰","R983_WHOLE_NEUTRAL_THREE_QUARTER.png"),("R9.8.3 全身程序材质","R983_WHOLE_PROCEDURAL_THREE_QUARTER.png")];cards="\n".join(f'<figure><img src="{src}" alt="{title}"><figcaption>{title}</figcaption></figure>' for title,src in items);base.REVIEW_BOARD.write_text(f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chicken R9.8.3 视觉审查板</title><style>*{{box-sizing:border-box}}body{{margin:0;background:#171f25;color:#edf1f1;font:14px/1.55 system-ui,-apple-system,Segoe UI,Microsoft Yahei,sans-serif}}header{{padding:24px 28px;border-bottom:1px solid #344149}}h1{{margin:0 0 7px;font-size:22px}}p{{margin:5px 0;color:#b9c6c6}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;padding:20px}}figure{{margin:0;background:#10171c;border:1px solid #35434a;border-radius:8px;overflow:hidden}}img{{display:block;width:100%;height:360px;object-fit:contain;background:#182027}}figcaption{{padding:10px 12px;color:#d9e2e1}}.gate{{margin:0 20px 24px;padding:15px;border-left:4px solid #c59c61;background:#222a2f}}</style></head><body><header><h1>Chicken V4.6 R9.8.3 · 清洁脸部与内嵌短喙</h1><p>旧眼、旧耳叶和旧肉垂零件从候选 parts 网格排除；参考图仅作为视觉构形锚点。</p></header><main class="grid">{cards}</main><section class="gate"><b>当前门槛：</b>技术检查与视觉检查分离；独立视觉审查通过前，Rig 与 Motion 保持关闭。</section></body></html>''',encoding="utf-8")


def write_state_and_handoff(browser_ok: bool) -> None:
    _old_state(browser_ok);state=json.loads(base.STATE.read_text(encoding="utf-8"));state["version"]="V4.6_R9.8_3_CLEAN_FACE_EMBEDDED_BILL_CANDIDATE";state["head_status"]={"r9_2_through_r9_8_2_visual_gate_passed":False,"r9_8_3_candidate_built":True,"r9_8_3_browser_qa_passed":browser_ok,"legacy_eye_and_ear_parts_excluded":True,"manual_visual_acceptance":False};state["next_stage"]="INDEPENDENT_VISUAL_AUDIT_R983_THEN_BOUNDED_REFINEMENT";base.write_json(base.STATE,state)
    text=f'''# Chicken V4.6 R9.8.3 — Clean Face and Embedded Bill Candidate

## Active executable

`{base.OUTPUT.name}`

## What changed

The remaining angular patch behind the new eye was traced to legacy `PART_CATALOG` ear-lobe objects 3 and 4. R9.8.3 excludes those objects only in the candidate path, while retaining the existing rollback. The short bill root is moved deeper into the face to close the side seam.

## QA and truth boundary

Browser QA passed: `{str(browser_ok).lower()}`. Manual visual acceptance, whole-surface freeze, Rig and Motion remain closed.
'''
    for path in [base.README,base.HANDOFF,base.FULL_HANDOFF]:path.write_text(text,encoding="utf-8")
    base.NEXT_PLAN.write_text("""# Next Stage — Chicken R9.8.3 Independent Visual Audit

1. Confirm the old eye and ear-lobe artifacts are absent from neutral and procedural views.
2. Check bill-root overlap, posterior cranium, eye placement, jaw/wattle attachment and comb root.
3. Continue only bounded local corrections; body, wing, tail and feet remain frozen.
4. Keep Rig and Motion blocked until the whole-head visual gate passes.
""",encoding="utf-8")


def write_manifest() -> None:
    _old_manifest();data=json.loads(base.MANIFEST.read_text(encoding="utf-8"));data["package"]="CHICKEN_V4_6_R9_8_3_CLEAN_FACE_EMBEDDED_BILL_2026-09-16";data["active_entry"]=base.OUTPUT.name;base.write_json(base.MANIFEST,data)

base.write_parameters=write_parameters;base.write_static_qa=write_static_qa;base.write_review_board=write_review_board;base.write_state_and_handoff=write_state_and_handoff;base.write_manifest=write_manifest
if __name__=="__main__":raise SystemExit(base.main())
