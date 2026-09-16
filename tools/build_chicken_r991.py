#!/usr/bin/env python3
"""Build Chicken V4.6 R9.9.1 continuous in-place head/neck ring-refit candidate."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "CHICKEN_V46_R9_1.html"
OVERRIDE = ROOT / "tools" / "chicken_r991_override.js"
OUTPUT = ROOT / "CHICKEN_V46_R9_9_1_GAMEPLAY_HEAD.html"
PARAMS = ROOT / "data" / "CHICKEN_R991_GAMEPLAY_HEAD_PARAMETERS.json"
STATIC_QA = ROOT / "qa" / "CHICKEN_R991_STATIC_QA.json"
BROWSER_QA = ROOT / "qa" / "CHICKEN_R991_BROWSER_QA.json"
MANIFEST = ROOT / "BUILD_MANIFEST_R991.json"
REVIEW_BOARD = ROOT / "evidence" / "r991" / "R991_REVIEW_BOARD.html"
REFERENCE = ROOT / "reference" / "head" / "APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png"
EXPECTED_SOURCE_SHA256 = "336dc9d32304f916a8f15e120ebf4b9d2429b54dd2719be1af8aca12df33a4e3"
ANCHOR = "const scene=new T.Scene();"
PATCH_MARKER = "CHICKEN_R991_GAMEPLAY_HEAD_PATCH"

VISIBLE_REPLACEMENTS = {
    "<title>Chicken R9.1 · Final Silhouette & Head Top Gate</title>": "<title>Chicken R9.9.1 · Continuous Ring Refit Candidate</title>",
    "鸡 · R9.1 · 最终轮廓与头顶收敛": "鸡 · R9.9.1 · 连续头颈环带候选",
    "冻结 R9 作为前版 · 重塑头顶、单冠连续叶片与面部材质边界 · 继续检查全身轮廓": "从冻结 R9.1 重新开始 · 连续环带收窄颈头、抬起下颌并保留原位短喙",
    "后：R9.1 头顶与轮廓": "后：R9.9.1 连续环带头面",
    "在 R9 可回退基线上修正头顶与单冠": "在冻结 R9.1 连续载体上重排头颈环带",
    "R9.1 当前候选": "R9.9.1 当前候选",
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
    if not OVERRIDE.exists() or PATCH_MARKER not in OVERRIDE.read_text(encoding="utf-8"):
        raise RuntimeError("R9.9.1 override is missing or invalid")
    source = SOURCE.read_text(encoding="utf-8")
    if source.count(ANCHOR) != 1:
        raise RuntimeError("Scene anchor must occur exactly once")
    override = OVERRIDE.read_text(encoding="utf-8").strip()
    patched = source.replace(ANCHOR, override + "\n" + ANCHOR, 1)
    replacement_status = {}
    for old, new in VISIBLE_REPLACEMENTS.items():
        replacement_status[old] = old in patched
        if old in patched:
            patched = patched.replace(old, new, 1)
    patched = patched.replace("</header>", '<span class="pill">R9.9.1：连续环带重排 · 尚未视觉验收</span></header>', 1)
    OUTPUT.write_text(patched, encoding="utf-8")
    return {
        "source_sha256": sha256(SOURCE),
        "override_sha256": sha256(OVERRIDE),
        "output_sha256": sha256(OUTPUT),
        "source_bytes": SOURCE.stat().st_size,
        "override_bytes": OVERRIDE.stat().st_size,
        "output_bytes": OUTPUT.stat().st_size,
        "patch_marker_count": patched.count(PATCH_MARKER),
        "replacement_status": replacement_status,
    }


def write_parameters() -> None:
    write_json(PARAMS, {
        "schema": "life_ecosystem/chicken_gameplay_head_candidate@1.0",
        "version": "V4.6_R9.9.1",
        "source": {
            "frozen_executable": SOURCE.name,
            "sha256": EXPECTED_SOURCE_SHA256,
            "approved_visual_reference": str(REFERENCE.relative_to(ROOT)),
        },
        "strategy": "continuous_in_place_ring_refit",
        "changes": {
            "carrier": "existing R9.1 72x96 carrier rings refit in place from upper neck through integral bill",
            "head_profile": {
                "posterior_blend_x": [0.245, 0.285],
                "cranial_domain_x": [0.255, 0.435],
                "underjaw_raised": True,
                "detached_head_mesh": False,
            },
            "bill": {"method": "integral ring refit", "root_x": 0.435, "source_tip_x": 0.523116, "target_tip_x": 0.486, "separate_mesh": False},
            "eyes": {"method": "shallow surface dome and upper lid", "center_xy": [0.392, 0.951], "radius_xy": [0.0103, 0.0091], "patches": 4},
            "nostrils": {"center_xy": [0.456, 0.936], "paired": True},
            "wattles": {"root_xy": [0.414, 0.899], "length": 0.052, "attached": True},
            "legacy_parts_excluded": [1, 2, 3, 4, 5, 6],
            "frozen_systems": ["body", "lower neck", "plumage", "wing", "tail", "feet", "materials", "controls"],
        },
        "truth_boundary": {
            "manual_visual_acceptance": False,
            "whole_visual_gate_passed": False,
            "rig_authorized": False,
            "motion_authorized": False,
            "anatomical_truth_claimed": False,
        },
    })


def write_static_qa(build: dict[str, Any]) -> None:
    checks = {
        "frozen_source_hash_matches": build["source_sha256"] == EXPECTED_SOURCE_SHA256,
        "single_patch_injection": build["patch_marker_count"] == 1,
        "override_nonempty": build["override_bytes"] > 5000,
        "output_created": OUTPUT.exists(),
        "output_larger_than_source": build["output_bytes"] > build["source_bytes"],
        "visible_anchors_found": all(build["replacement_status"].values()),
    }
    write_json(STATIC_QA, {
        "schema": "life_ecosystem/chicken_r991_static_qa@1.0",
        "version": "V4.6_R9.9.1_CONTINUOUS_RING_REFIT_CANDIDATE",
        "checks": checks,
        "passed": all(checks.values()),
        "build": build,
        "scope": "source, override and patch integrity only",
    })
    if not all(checks.values()):
        raise RuntimeError(f"Static QA failed: {[key for key, value in checks.items() if not value]}")


def write_review_board() -> None:
    REVIEW_BOARD.parent.mkdir(parents=True, exist_ok=True)
    items = [
        ("批准的视觉构形参考", "../../reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png"),
        ("R9.1 冻结左侧", "R91_BASELINE_HEAD_NEUTRAL_LEFT.png"),
        ("R9.9.1 左侧", "R991_HEAD_NEUTRAL_LEFT.png"),
        ("R9.9.1 右侧", "R991_HEAD_NEUTRAL_RIGHT.png"),
        ("R9.9.1 正面", "R991_HEAD_NEUTRAL_FRONT.png"),
        ("R9.9.1 顶部", "R991_HEAD_NEUTRAL_TOP.png"),
        ("R9.9.1 三分之四", "R991_HEAD_NEUTRAL_THREE_QUARTER.png"),
        ("R9.9.1 左侧线框", "R991_HEAD_WIRE_LEFT.png"),
        ("R9.9.1 全身中性灰", "R991_WHOLE_NEUTRAL_THREE_QUARTER.png"),
        ("R9.9.1 全身程序材质", "R991_WHOLE_PROCEDURAL_THREE_QUARTER.png"),
    ]
    cards = "\n".join(f'<figure><img src="{src}" alt="{title}"><figcaption>{title}</figcaption></figure>' for title, src in items)
    REVIEW_BOARD.write_text(f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chicken R9.9.1 视觉审查板</title><style>*{{box-sizing:border-box}}body{{margin:0;background:#171f25;color:#edf1f1;font:14px/1.55 system-ui,-apple-system,Segoe UI,Microsoft Yahei,sans-serif}}header{{padding:24px 28px;border-bottom:1px solid #344149}}h1{{margin:0 0 7px;font-size:22px}}p{{margin:5px 0;color:#b9c6c6}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;padding:20px}}figure{{margin:0;background:#10171c;border:1px solid #35434a;border-radius:8px;overflow:hidden}}img{{display:block;width:100%;height:360px;object-fit:contain;background:#182027}}figcaption{{padding:10px 12px;color:#d9e2e1}}.gate{{margin:0 20px 24px;padding:15px;border-left:4px solid #c59c61;background:#222a2f}}</style></head><body><header><h1>Chicken V4.6 R9.9.1 · 连续头颈环带候选</h1><p>直接重排冻结 R9.1 的现有环带，不叠加板状或球状替代头。重点检查颈头过渡、下颌线、短喙和贴附面部零件。</p></header><main class="grid">{cards}</main><section class="gate"><b>门槛：</b>3–5 米等效观察距离下，轮廓应立即读作家鸡；近景不得出现悬浮眼、喙根断裂、头颈裂缝或肉垂脱离。自动检查不替代视觉审批。</section></body></html>''', encoding="utf-8")


def write_manifest() -> None:
    paths = [SOURCE, OVERRIDE, OUTPUT, PARAMS, STATIC_QA, BROWSER_QA, REVIEW_BOARD, REFERENCE]
    paths.extend(sorted(REVIEW_BOARD.parent.glob("*.png")))
    files = []
    for path in paths:
        if path.exists():
            files.append({"path": str(path.relative_to(ROOT)), "bytes": path.stat().st_size, "sha256": sha256(path)})
    write_json(MANIFEST, {
        "schema": "life_ecosystem/build_manifest@1.0",
        "package": "CHICKEN_V4_6_R9_9_1_CONTINUOUS_RING_REFIT_CANDIDATE",
        "active_entry": OUTPUT.name,
        "frozen_source": SOURCE.name,
        "manual_visual_acceptance": False,
        "files": files,
    })


def main() -> int:
    build = build_html()
    write_parameters()
    write_static_qa(build)
    write_review_board()
    write_manifest()
    print(json.dumps({"output": str(OUTPUT), "build": build}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
