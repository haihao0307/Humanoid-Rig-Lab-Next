#!/usr/bin/env python3
"""Build Chicken V4.6 R9.6 connected-head refinement from frozen R9.1."""
from __future__ import annotations

import json
from pathlib import Path

import build_chicken_r95 as base

base.OUTPUT = base.ROOT / "CHICKEN_V46_R9_6_HEAD_REFINEMENT.html"
base.PARAMS = base.ROOT / "data" / "CHICKEN_R96_HEAD_REFINEMENT_PARAMETERS.json"
base.STATIC_QA = base.ROOT / "qa" / "CHICKEN_R96_STATIC_QA.json"
base.BROWSER_QA = base.ROOT / "qa" / "CHICKEN_R96_BROWSER_QA.json"
base.MANIFEST = base.ROOT / "BUILD_MANIFEST_R96.json"
base.REVIEW_BOARD = base.ROOT / "evidence" / "r96" / "R96_REVIEW_BOARD.html"
base.PATCH_MARKER = "CHICKEN_R96_HEAD_REFINEMENT_PATCH"
base.JS_OVERRIDE = (Path(__file__).with_name("chicken_r96_override.js")).read_text(encoding="utf-8").strip()
base.VISIBLE_REPLACEMENTS = {
    "<title>Chicken R9.1 · Final Silhouette & Head Top Gate</title>": "<title>Chicken R9.6 · Connected Head Refinement Candidate</title>",
    "鸡 · R9.1 · 最终轮廓与头顶收敛": "鸡 · R9.6 · 连续头部形体候选",
    "冻结 R9 作为前版 · 重塑头顶、单冠连续叶片与面部材质边界 · 继续检查全身轮廓": "从冻结 R9.1 重建 · 连续曲面分区调整后脑、颅顶、脸颊、下颌与短喙",
    "后：R9.1 头顶与轮廓": "后：R9.6 连续头部候选",
    "在 R9 可回退基线上修正头顶与单冠": "在冻结 R9.1 上验证连续鸡头形体",
    "R9.1 当前候选": "R9.6 当前候选",
}


def write_parameters() -> None:
    base.write_json(base.PARAMS, {
        "schema": "life_ecosystem/chicken_head_shape_candidate@1.0",
        "version": "V4.6_R9.6",
        "status": "connected_visual_candidate_not_anatomical_truth",
        "units": "normalized_source_units_not_meters",
        "source": {
            "frozen_executable": base.SOURCE.name,
            "sha256": base.EXPECTED_SOURCE_SHA256,
            "approved_visual_reference": "reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png",
            "rejected_predecessors": [
                "R9.2 full-ring inflation", "R9.3 long wedge", "R9.4 vertical throat prototype",
                "R9.5 giant full-ring head", "R9.5.1 grafted shell seam"
            ],
        },
        "carrier": {
            "method": "single connected carrier with y-banded cranium, face and jaw blending",
            "x_domain": [0.248, 0.52293766],
            "bill_root": 0.438,
            "bill_scale": 0.61,
            "dorsal_band": "ring_top-0.135 to ring_top-0.018",
            "face_band_y": [0.790, 0.995],
            "full_station_start": 0.430,
            "profile_knots": [
                [0.252,0.858,0.045,0.018,0.034],[0.268,0.875,0.054,0.024,0.040],
                [0.284,0.894,0.063,0.032,0.049],[0.302,0.910,0.070,0.041,0.060],
                [0.323,0.921,0.074,0.048,0.068],[0.347,0.926,0.075,0.052,0.071],
                [0.372,0.925,0.073,0.052,0.072],[0.397,0.922,0.066,0.049,0.068],
                [0.418,0.921,0.055,0.041,0.060],[0.438,0.926,0.040,0.031,0.049],
                [0.452,0.934,0.028,0.022,0.040],[0.466,0.934,0.021,0.016,0.031],
                [0.480,0.932,0.014,0.010,0.022],[0.494,0.929,0.008,0.006,0.013],
                [0.506,0.926,0.004,0.003,0.006],[0.5185,0.924,0.0012,0.0010,0.0012],
            ],
        },
        "local_modules": {
            "comb": "continuous thicker five-lobe single comb with embedded root",
            "eyes": "smaller shallow iris surface with compact eyelid arcs",
            "ear_lobes": "small post-orbital patches",
            "nostrils": "paired patches remapped to short bill",
            "wattles": "compact attached teardrops rooted at jaw surface",
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
            "CHICKEN_R94_INTEGRATED_HEAD_CARRIER_PATCH", "CHICKEN_R95_HEAD_CARRIER_PATCH"
        ]),
    }
    base.write_json(base.STATIC_QA, {
        "schema": "life_ecosystem/chicken_r96_static_qa@1.0",
        "version": "V4.6_R9.6_CONNECTED_HEAD_REFINEMENT_CANDIDATE",
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
        ("R9.6 左侧", "R96_HEAD_NEUTRAL_LEFT.png"),
        ("R9.6 右侧", "R96_HEAD_NEUTRAL_RIGHT.png"),
        ("R9.6 正面", "R96_HEAD_NEUTRAL_FRONT.png"),
        ("R9.6 顶部", "R96_HEAD_NEUTRAL_TOP.png"),
        ("R9.6 三分之四", "R96_HEAD_NEUTRAL_THREE_QUARTER.png"),
        ("R9.6 左侧线框", "R96_HEAD_WIRE_LEFT.png"),
        ("R9.6 全身中性灰", "R96_WHOLE_NEUTRAL_THREE_QUARTER.png"),
        ("R9.6 全身程序材质", "R96_WHOLE_PROCEDURAL_THREE_QUARTER.png"),
    ]
    cards = "\n".join(f'<figure><img src="{src}" alt="{title}"><figcaption>{title}</figcaption></figure>' for title,src in items)
    base.REVIEW_BOARD.write_text(f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chicken R9.6 视觉审查板</title><style>*{{box-sizing:border-box}}body{{margin:0;background:#171f25;color:#edf1f1;font:14px/1.55 system-ui,-apple-system,Segoe UI,Microsoft Yahei,sans-serif}}header{{padding:24px 28px;border-bottom:1px solid #344149}}h1{{margin:0 0 7px;font-size:22px}}p{{margin:5px 0;color:#b9c6c6}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;padding:20px}}figure{{margin:0;background:#10171c;border:1px solid #35434a;border-radius:8px;overflow:hidden}}img{{display:block;width:100%;height:360px;object-fit:contain;background:#182027}}figcaption{{padding:10px 12px;color:#d9e2e1}}.gate{{margin:0 20px 24px;padding:15px;border-left:4px solid #c59c61;background:#222a2f}}</style></head><body><header><h1>Chicken V4.6 R9.6 · 连续头部形体候选</h1><p>参考图只作为视觉构形锚点，不代表测量解剖、品种、性别、年龄或个体真值。</p></header><main class="grid">{cards}</main><section class="gate"><b>当前门槛：</b>源码、浏览器和有界几何检查可以自动通过；最终形态仍需独立视觉审查，Rig 与 Motion 保持关闭。</section></body></html>''', encoding="utf-8")


def write_state_and_handoff(browser_ok: bool) -> None:
    base.write_json(base.STATE, {
        "schema": "life_ecosystem/chicken_module_state@1.0",
        "version": "V4.6_R9.6_CONNECTED_HEAD_REFINEMENT_CANDIDATE",
        "date": "2026-09-16",
        "identity": {"species_scope": "domestic chicken surface candidate", "sex": "unknown", "breed": "unknown", "age": "unknown", "real_world_scale": "unknown"},
        "active_entry": base.OUTPUT.name,
        "frozen_r9_1_baseline": base.SOURCE.name,
        "approved_head_reference": "reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png",
        "candidate_parameters": str(base.PARAMS.relative_to(base.ROOT)),
        "review_board": str(base.REVIEW_BOARD.relative_to(base.ROOT)),
        "head_status": {
            "r9_2_visual_gate_passed": False, "r9_3_visual_gate_passed": False,
            "r9_4_visual_gate_passed": False, "r9_5_visual_gate_passed": False,
            "r9_5_1_visual_gate_passed": False, "r9_6_candidate_built": True,
            "r9_6_browser_qa_passed": browser_ok, "manual_visual_acceptance": False,
        },
        "qa": {"technical_gate_passed": browser_ok, "current_executable_reproducible": True, "whole_visual_gate_passed": False, "canonical_chicken_surface_complete": False, "rig_authorized": False, "motion_implemented": False, "production_ready": False, "public_https_published": True},
        "next_stage": "INDEPENDENT_VISUAL_AUDIT_R96_THEN_BOUNDED_REFINEMENT",
    })
    text = f'''# Chicken V4.6 R9.6 — Connected Head Refinement Candidate

## Active executable

`{base.OUTPUT.name}`

## Frozen rollback

- exact R9.1 executable: `{base.SOURCE.name}`
- exact R9 executable: `history/CHICKEN_V46_R9_FROZEN.html`

## What changed

R9.6 discards the separate-shell and clipping route. It keeps the original connected carrier and applies staged bands to posterior cranium, crown, cheek, jaw and a shortened bill while guarding the lower neck. Eye, eyelid, nostril, ear-lobe, wattle and continuous-comb modules are reduced and reattached to the connected surface.

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
    base.NEXT_PLAN.write_text("""# Next Stage — Chicken R9.6 Independent Visual Audit

1. Compare neutral left/right/front/top/three-quarter views with the approved visual construction reference.
2. Check the connected upper-neck-to-cranium transition, cheek/jaw support and short-bill closure.
3. Check eye/eyelid scale, comb root and attached wattle silhouette.
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
    base.write_json(base.MANIFEST, {"schema": "life_ecosystem/build_manifest@1.0", "package": "CHICKEN_V4_6_R9_6_CONNECTED_HEAD_REFINEMENT_CANDIDATE_2026-09-16", "active_entry": base.OUTPUT.name, "frozen_source": base.SOURCE.name, "frozen_source_sha256": base.EXPECTED_SOURCE_SHA256, "manual_visual_acceptance": False, "files": entries})


base.write_parameters = write_parameters
base.write_static_qa = write_static_qa
base.write_review_board = write_review_board
base.write_state_and_handoff = write_state_and_handoff
base.write_manifest = write_manifest

if __name__ == "__main__":
    raise SystemExit(base.main())
