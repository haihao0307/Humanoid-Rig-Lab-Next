#!/usr/bin/env python3
"""Build Chicken V4.6 R9.8.4 natural head/face candidate.

R9.8.3 passed deterministic and browser gates but failed independent visual
review: the carrier read as a blunt slab, the eye as a floating sphere and the
bill as a spear. R9.8.4 keeps the exact rollback and all non-head systems, then
adds one final override that rebuilds the connected head/face domain.
"""
from __future__ import annotations

import json
from pathlib import Path

import build_chicken_r983 as r983

base = r983.base
base.OUTPUT = base.ROOT / "CHICKEN_V46_R9_8_4_NATURAL_FACE.html"
base.PARAMS = base.ROOT / "data" / "CHICKEN_R984_NATURAL_FACE_PARAMETERS.json"
base.STATIC_QA = base.ROOT / "qa" / "CHICKEN_R984_STATIC_QA.json"
base.BROWSER_QA = base.ROOT / "qa" / "CHICKEN_R984_BROWSER_QA.json"
base.MANIFEST = base.ROOT / "BUILD_MANIFEST_R984.json"
base.REVIEW_BOARD = base.ROOT / "evidence" / "r984" / "R984_REVIEW_BOARD.html"
base.PATCH_MARKER = "CHICKEN_R984_NATURAL_HEAD_PATCH"
base.VISIBLE_REPLACEMENTS = {
    "<title>Chicken R9.1 · Final Silhouette & Head Top Gate</title>": "<title>Chicken R9.8.4 · Natural Head and Face Candidate</title>",
    "鸡 · R9.1 · 最终轮廓与头顶收敛": "鸡 · R9.8.4 · 连续自然头面候选",
    "冻结 R9 作为前版 · 重塑头顶、单冠连续叶片与面部材质边界 · 继续检查全身轮廓": "从冻结 R9.1 重建 · 完整头面遮罩、贴附式眼部、内嵌短喙与连续低冠",
    "后：R9.1 头顶与轮廓": "后：R9.8.4 连续自然头面",
    "在 R9 可回退基线上修正头顶与单冠": "在冻结 R9.1 上验证连续头壳、眼眶、短喙与下颌",
    "R9.1 当前候选": "R9.8.4 当前候选",
}

patch_path = Path(__file__).with_name("chicken_r984_override.js")
if not patch_path.exists():
    raise FileNotFoundError(patch_path)
base.JS_OVERRIDE = (base.JS_OVERRIDE.rstrip() + "\n" + patch_path.read_text(encoding="utf-8").strip()).strip()

_old_params = base.write_parameters
_old_static = base.write_static_qa
_old_state = base.write_state_and_handoff


def write_parameters() -> None:
    _old_params()
    data = json.loads(base.PARAMS.read_text(encoding="utf-8"))
    data.update({
        "schema": "life_ecosystem/chicken_natural_face_candidate@1.0",
        "version": "V4.6_R9.8.4",
        "status": "natural_connected_head_face_candidate",
        "truth_boundary": {
            "visual_construction_candidate": True,
            "measured_anatomy_claimed": False,
            "breed_identity_claimed": False,
            "manual_visual_acceptance": False,
            "rig_authorized": False,
            "motion_authorized": False,
        },
    })
    data.setdefault("source", {})["predecessor"] = "V4.6_R9.8_3_CLEAN_FACE_EMBEDDED_BILL_CANDIDATE"
    data["bounded_changes"] = {
        "carrier_method": "smooth full head-mask refit over exact R9.1 base carrier",
        "carrier_x_domain": [0.228, 0.428],
        "protected_lower_neck_y": 0.78,
        "profile_knots": [
            [0.245,0.854,0.035,0.015,0.028], [0.260,0.870,0.045,0.021,0.035],
            [0.278,0.889,0.057,0.028,0.045], [0.298,0.907,0.065,0.037,0.055],
            [0.320,0.920,0.070,0.044,0.063], [0.344,0.925,0.071,0.047,0.067],
            [0.368,0.923,0.069,0.046,0.066], [0.390,0.917,0.062,0.043,0.060],
            [0.407,0.913,0.053,0.038,0.051], [0.422,0.915,0.041,0.030,0.041],
        ],
        "compact_bill": {"root_x": 0.405, "tip_x": 0.468, "root_lateral_radius": 0.0108, "root_cap": False, "embedded_root": True},
        "eyes": {"geometry": "surface_attached_dome_plus_continuous_lid", "center_xy": [0.3835, 0.9460], "radius_xy": [0.0102, 0.0090], "patches": 4},
        "nostrils": {"center_xy": [0.4325, 0.9258], "paired": True},
        "wattles": {"root_xy": [0.401, 0.884], "length": 0.034, "attached": True},
        "comb": {"x_domain": [0.288, 0.417], "lobes": 5, "lowered": True, "continuous_blade": True},
        "legacy_parts_excluded": [1, 2, 3, 4, 5, 6],
        "frozen_systems": ["body", "plumage", "wing", "tail", "feet", "materials", "controls"],
    }
    base.write_json(base.PARAMS, data)


def write_static_qa(build: dict) -> None:
    _old_static(build)
    data = json.loads(base.STATIC_QA.read_text(encoding="utf-8"))
    data["schema"] = "life_ecosystem/chicken_r984_static_qa@1.0"
    data["version"] = "V4.6_R9.8_4_NATURAL_HEAD_FACE_CANDIDATE"
    data["truth_boundary"] = "Static integrity only; browser execution and independent visual acceptance are separate gates."
    base.write_json(base.STATIC_QA, data)


def write_review_board() -> None:
    base.REVIEW_BOARD.parent.mkdir(parents=True, exist_ok=True)
    items = [
        ("批准的视觉构形参考", "../../reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png"),
        ("R9.8.3 被否决侧面", "../r983/R983_HEAD_NEUTRAL_LEFT.png"),
        ("R9.8.4 左侧", "R984_HEAD_NEUTRAL_LEFT.png"),
        ("R9.8.4 右侧", "R984_HEAD_NEUTRAL_RIGHT.png"),
        ("R9.8.4 正面", "R984_HEAD_NEUTRAL_FRONT.png"),
        ("R9.8.4 顶部", "R984_HEAD_NEUTRAL_TOP.png"),
        ("R9.8.4 三分之四", "R984_HEAD_NEUTRAL_THREE_QUARTER.png"),
        ("R9.8.4 左侧线框", "R984_HEAD_WIRE_LEFT.png"),
        ("R9.8.4 全身中性灰", "R984_WHOLE_NEUTRAL_THREE_QUARTER.png"),
        ("R9.8.4 全身程序材质", "R984_WHOLE_PROCEDURAL_THREE_QUARTER.png"),
    ]
    cards = "\n".join(
        f'<figure><img src="{src}" alt="{title}"><figcaption>{title}</figcaption></figure>'
        for title, src in items
    )
    base.REVIEW_BOARD.write_text(
        f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chicken R9.8.4 视觉审查板</title><style>*{{box-sizing:border-box}}body{{margin:0;background:#171f25;color:#edf1f1;font:14px/1.55 system-ui,-apple-system,Segoe UI,Microsoft Yahei,sans-serif}}header{{padding:24px 28px;border-bottom:1px solid #344149}}h1{{margin:0 0 7px;font-size:22px}}p{{margin:5px 0;color:#b9c6c6}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;padding:20px}}figure{{margin:0;background:#10171c;border:1px solid #35434a;border-radius:8px;overflow:hidden}}img{{display:block;width:100%;height:360px;object-fit:contain;background:#182027}}figcaption{{padding:10px 12px;color:#d9e2e1}}.gate{{margin:0 20px 24px;padding:15px;border-left:4px solid #c59c61;background:#222a2f}}</style></head><body><header><h1>Chicken V4.6 R9.8.4 · 连续自然头面候选</h1><p>R9.8.3 板状头、悬浮球眼和长锥喙已被否决。本轮只重建头面承载体与其附着局部，身体、翼、尾和足保持冻结。</p></header><main class="grid">{cards}</main><section class="gate"><b>当前门槛：</b>技术检查与视觉检查分离；独立视觉审查通过前，Rig 与 Motion 保持关闭。</section></body></html>''',
        encoding="utf-8",
    )


def write_state_and_handoff(browser_ok: bool) -> None:
    _old_state(browser_ok)
    state = json.loads(base.STATE.read_text(encoding="utf-8"))
    state.update({
        "version": "V4.6_R9.8_4_NATURAL_HEAD_FACE_CANDIDATE",
        "active_entry": base.OUTPUT.name,
        "candidate_parameters": str(base.PARAMS.relative_to(base.ROOT)),
        "review_board": str(base.REVIEW_BOARD.relative_to(base.ROOT)),
        "head_status": {
            "r9_2_through_r9_8_3_visual_gate_passed": False,
            "r9_8_4_candidate_built": True,
            "r9_8_4_browser_qa_passed": browser_ok,
            "carrier_rebuilt_from_r9_1_base": True,
            "floating_sphere_eye_removed": True,
            "manual_visual_acceptance": False,
        },
        "qa": {
            "technical_gate_passed": browser_ok,
            "current_executable_reproducible": True,
            "manual_visual_acceptance": False,
            "whole_visual_gate_passed": False,
            "canonical_chicken_surface_complete": False,
            "rig_authorized": False,
            "motion_implemented": False,
            "production_ready": False,
            "public_https_published": True,
        },
        "next_stage": "INDEPENDENT_VISUAL_AUDIT_R984_THEN_BOUNDED_REFINEMENT",
    })
    base.write_json(base.STATE, state)
    text = f'''# Chicken V4.6 R9.8.4 — Natural Connected Head/Face Candidate

## Active executable

`{base.OUTPUT.name}`

## What changed

R9.8.3 passed technical checks but failed independent visual review. Its head read as a blunt slab, the eye as a detached sphere and the bill as a spear. R9.8.4 bypasses that partial-band carrier, starts from the exact R9.1 carrier retained in the patch chain, and uses one smooth full head-mask refit. The eye is now a shallow surface-attached dome, the bill is compact and asymmetric with an uncapped embedded root, and the wattle and comb remain attached to the rebuilt carrier.

Body, plumage, wing, tail, feet, materials and controls remain frozen.

## Gates

Browser QA passed: `{str(browser_ok).lower()}`.

```text
manualVisualAcceptance=false
wholeVisualGatePassed=false
rigAuthorized=false
motionImplemented=false
productionReady=false
```
'''
    for path in [base.README, base.HANDOFF, base.FULL_HANDOFF]:
        path.write_text(text, encoding="utf-8")
    base.NEXT_PLAN.write_text(
        """# Next Stage — Chicken R9.8.4 Independent Visual Audit

1. Compare left, right, front, top and three-quarter views against the approved construction reference.
2. Reject any remaining slab face, detached eye, bill-root seam, floating wattle or comb-root break.
3. Continue only bounded local corrections; body, plumage, wing, tail and feet remain frozen.
4. Keep Rig and Motion blocked until the whole-head visual gate passes.
""",
        encoding="utf-8",
    )


def write_manifest() -> None:
    paths = [
        base.OUTPUT, base.SOURCE, base.PARAMS, base.STATIC_QA, base.BROWSER_QA,
        base.STATE, base.README, base.HANDOFF, base.FULL_HANDOFF, base.NEXT_PLAN,
        base.REVIEW_BOARD,
        base.ROOT / "reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png",
    ]
    paths.extend(sorted(base.REVIEW_BOARD.parent.glob("R984_*.png")))
    files = []
    for path in paths:
        if path.exists():
            files.append({
                "path": str(path.relative_to(base.ROOT)),
                "bytes": path.stat().st_size,
                "sha256": base.sha256(path),
            })
    base.write_json(base.MANIFEST, {
        "schema": "life_ecosystem/build_manifest@1.0",
        "package": "CHICKEN_V4_6_R9_8_4_NATURAL_HEAD_FACE_CANDIDATE_2026-09-16",
        "active_entry": base.OUTPUT.name,
        "frozen_source": base.SOURCE.name,
        "frozen_source_sha256": base.EXPECTED_SOURCE_SHA256,
        "manual_visual_acceptance": False,
        "files": files,
    })


base.write_parameters = write_parameters
base.write_static_qa = write_static_qa
base.write_review_board = write_review_board
base.write_state_and_handoff = write_state_and_handoff
base.write_manifest = write_manifest

if __name__ == "__main__":
    raise SystemExit(base.main())
