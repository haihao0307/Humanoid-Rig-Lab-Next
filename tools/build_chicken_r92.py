#!/usr/bin/env python3
"""Build the Chicken V4.6 R9.2 low-frequency head-shape candidate.

The frozen R9.1 executable is never edited.  This builder verifies its exact
SHA-256, injects one bounded object-space deformation override into a copy,
and writes candidate metadata/QA files.  Browser captures are produced by the
companion GitHub Actions workflow and are folded into the final review board
when this script is run with --finalize.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "CHICKEN_V46_R9_1.html"
OUTPUT = ROOT / "CHICKEN_V46_R9_2_HEAD_SHAPE.html"
PARAMS = ROOT / "data" / "CHICKEN_R92_HEAD_SHAPE_PARAMETERS.json"
STATIC_QA = ROOT / "qa" / "CHICKEN_R92_STATIC_QA.json"
BROWSER_QA = ROOT / "qa" / "CHICKEN_R92_BROWSER_QA.json"
MANIFEST = ROOT / "BUILD_MANIFEST_R92.json"
STATE = ROOT / "01_CURRENT_STATE.json"
README = ROOT / "README.md"
HANDOFF = ROOT / "CURRENT_HANDOFF.md"
FULL_HANDOFF = ROOT / "CURRENT_FULL_HANDOFF.md"
NEXT_PLAN = ROOT / "06_NEXT_STAGE_PLAN.md"
REVIEW_BOARD = ROOT / "evidence" / "r92" / "R92_REVIEW_BOARD.html"

EXPECTED_SOURCE_SHA256 = "336dc9d32304f916a8f15e120ebf4b9d2429b54dd2719be1af8aca12df33a4e3"
ANCHOR = "const scene=new T.Scene();"
PATCH_MARKER = "CHICKEN_R92_HEAD_SHAPE_PATCH"

# This intentionally overrides the later-used R9.1 function name rather than
# altering the frozen source implementation.  The existing rollback toggle,
# comb generator, eyes, nostrils, wattles, materials and all non-head systems
# continue to use the original workbench paths.
JS_OVERRIDE = r'''
// CHICKEN_R92_HEAD_SHAPE_PATCH
// Low-frequency carrier restore derived from the approved visual construction
// reference.  This is a bounded surface candidate, not measured skull anatomy.
window.__CHICKEN_R92_PATCH__=Object.freeze({
 version:'V4.6_R9.2_HEAD_SHAPE_RESTORE_CANDIDATE',
 source:'CHICKEN_V46_R9_1.html',
 domain:[.258,.486],
 preserves:['R9 frozen rollback','R9/R9.1 local eye/nostril/wattle/comb/material modules','body','wing','tail','feet'],
 manualVisualAcceptance:false
});
function applyHeadTopR91(input,amount,ctrl){
 const p=input.slice(),a=clamp(amount,0,1),zc=.09,rows=72,cols=96;
 const knots=[
  [.268,.960],[.282,.975],[.300,.990],[.322,1.002],
  [.346,1.008],[.370,1.007],[.394,1.001],[.418,.990],
  [.440,.978],[.458,.967],[.474,.959]
 ];
 const target=x=>{
  if(x<=knots[0][0])return knots[0][1];
  if(x>=knots[knots.length-1][0])return knots[knots.length-1][1];
  let k=1;while(k<knots.length&&x>knots[k][0])k++;
  const A=knots[k-1],B=knots[k],t=(x-A[0])/(B[0]-A[0]),q=t*t*(3-2*t);
  return A[1]*(1-q)+B[1]*q;
 };
 const band=(x,a0,a1,b0,b1)=>ss(a0,a1,x)*(1-ss(b0,b1,x));
 for(let r=0;r<rows;r++){
  const start=r*cols*3,x=p[start];
  if(x<.252||x>.492)continue;
  let top=-Infinity,bottom=Infinity,zlo=Infinity,zhi=-Infinity;
  for(let j=0;j<cols;j++){
   const q=start+j*3,y=p[q+1],z=p[q+2];
   if(y>top)top=y;if(y<bottom)bottom=y;if(z<zlo)zlo=z;if(z>zhi)zhi=z;
  }
  const spanY=Math.max(top-bottom,.0001),halfZ=Math.max((zhi-zlo)*.5,.0001);
  const domain=band(x,.258,.286,.466,.486),m=a*domain;
  if(m<=0)continue;
  const posterior=band(x,.262,.292,.382,.420);
  const vault=band(x,.288,.318,.414,.450);
  const cheek=band(x,.360,.390,.444,.470);
  const throat=band(x,.292,.326,.410,.446);
  const billRoot=band(x,.410,.434,.462,.484);
  const topDelta=(target(x)-top)*m;
  const widthGain=m*(.135*posterior+.086*vault+.076*cheek+.032*billRoot);
  const verticalGain=m*(.046*posterior+.030*vault+.018*cheek);
  for(let j=0;j<cols;j++){
   const q=start+j*3;
   let y=p[q+1],z=p[q+2];
   const ny=clamp((y-bottom)/spanY,0,1);
   const upper=ss(.48,.92,ny),lower=1-ss(.30,.60,ny);
   const middle=Math.sin(Math.PI*ny);
   const midline=Math.exp(-Math.pow((z-zc)/(.078+.012*cheek),2));
   y+=topDelta*(.22+.78*upper)*(.82+.18*midline);
   const cy=bottom+spanY*(.535-.018*throat);
   y+=(y-cy)*verticalGain*(.24+.76*middle);
   y-=m*throat*lower*(.0066+.0022*(1-midline));
   let sideScale=1+widthGain*(.28+.72*middle)+m*throat*lower*.078;
   z=zc+(z-zc)*sideScale;
   const side=z>=zc?1:-1;
   z+=side*m*cheek*Math.exp(-Math.pow((y-.922)/.050,2))*.0028;
   p[q+1]=y;p[q+2]=z;
  }
 }
 return p;
}
'''.strip()

VISIBLE_REPLACEMENTS = {
    "<title>Chicken R9.1 · Final Silhouette & Head Top Gate</title>":
        "<title>Chicken R9.2 · Head Shape Restore Candidate</title>",
    "鸡 · R9.1 · 最终轮廓与头顶收敛":
        "鸡 · R9.2 · 头部低频形体恢复候选",
    "冻结 R9 作为前版 · 重塑头顶、单冠连续叶片与面部材质边界 · 继续检查全身轮廓":
        "冻结 R9/R9.1 作为回退 · 恢复后脑、颅顶、脸颊、下颌与喙根连续关系",
    "后：R9.1 头顶与轮廓": "后：R9.2 头部形体候选",
    "在 R9 可回退基线上修正头顶与单冠":
        "在 R9.1 可回退基线上重建头部低频体积",
    "R9.1 当前候选": "R9.2 当前候选",
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
        raise RuntimeError(
            f"Frozen R9.1 source hash mismatch: {source_hash} != {EXPECTED_SOURCE_SHA256}"
        )
    source = SOURCE.read_text(encoding="utf-8")
    if source.count(ANCHOR) != 1:
        raise RuntimeError(f"Expected one scene anchor, found {source.count(ANCHOR)}")
    if PATCH_MARKER in source:
        raise RuntimeError("Frozen R9.1 source is already patched")

    patched = source.replace(ANCHOR, JS_OVERRIDE + "\n" + ANCHOR, 1)
    replacement_status: dict[str, bool] = {}
    for old, new in VISIBLE_REPLACEMENTS.items():
        present = old in patched
        replacement_status[old] = present
        if present:
            patched = patched.replace(old, new, 1)

    # Add a visible truth-boundary pill without touching the rendering system.
    pill = '<span class="pill">R9.2：仅头部低频形体候选 · 尚未视觉验收</span>'
    close_header = "</header>"
    if close_header not in patched:
        raise RuntimeError("Header anchor missing")
    patched = patched.replace(close_header, pill + close_header, 1)

    OUTPUT.write_text(patched, encoding="utf-8")
    output_hash = sha256(OUTPUT)
    return {
        "source_sha256": source_hash,
        "output_sha256": output_hash,
        "source_bytes": SOURCE.stat().st_size,
        "output_bytes": OUTPUT.stat().st_size,
        "byte_delta": OUTPUT.stat().st_size - SOURCE.stat().st_size,
        "anchor_count": source.count(ANCHOR),
        "patch_marker_count": patched.count(PATCH_MARKER),
        "replacement_status": replacement_status,
        "source_preserved": sha256(SOURCE) == EXPECTED_SOURCE_SHA256,
    }


def write_parameters() -> None:
    write_json(
        PARAMS,
        {
            "schema": "life_ecosystem/chicken_head_shape_candidate@1.0",
            "version": "V4.6_R9.2",
            "status": "bounded_visual_candidate_not_anatomical_truth",
            "units": "normalized_source_units_not_meters",
            "coordinate_frame": {
                "cranial_axis": "+X",
                "dorsal_axis": "+Y",
                "right_lateral_axis": "+Z",
                "head_midline_z": 0.09,
            },
            "source": {
                "frozen_executable": "CHICKEN_V46_R9_1.html",
                "sha256": EXPECTED_SOURCE_SHA256,
                "approved_visual_reference": "reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png",
            },
            "deformation": {
                "method": "bounded ring-wise low-frequency carrier restoration",
                "x_domain": [0.252, 0.492],
                "active_blend_domain": [0.258, 0.486],
                "head_roof_knots_xy": [
                    [0.268, 0.960], [0.282, 0.975], [0.300, 0.990],
                    [0.322, 1.002], [0.346, 1.008], [0.370, 1.007],
                    [0.394, 1.001], [0.418, 0.990], [0.440, 0.978],
                    [0.458, 0.967], [0.474, 0.959],
                ],
                "posterior_width_gain": 0.135,
                "vault_width_gain": 0.086,
                "cheek_width_gain": 0.076,
                "bill_root_width_gain": 0.032,
                "throat_lower_support_gain": 0.078,
                "preserves_tip_beyond_x": 0.492,
            },
            "preserved_modules": [
                "R9 frozen rollback",
                "R9/R9.1 eyes and eyelids",
                "R9/R9.1 paired nostrils",
                "R9/R9.1 wattles and ear-lobe candidates",
                "R9.1 continuous comb generator",
                "body, plumage, wings, tail and feet",
            ],
            "truth_boundary": {
                "does_not_claim": [
                    "measured skull anatomy",
                    "breed-specific morphology",
                    "sex-specific morphology",
                    "individual identity",
                    "manual visual acceptance",
                ],
                "rig_authorized": False,
                "motion_authorized": False,
            },
        },
    )


def write_static_qa(build: dict[str, Any]) -> None:
    checks = {
        "frozen_source_hash_matches": build["source_sha256"] == EXPECTED_SOURCE_SHA256,
        "frozen_source_preserved": build["source_preserved"],
        "single_scene_anchor": build["anchor_count"] == 1,
        "single_patch_injection": build["patch_marker_count"] == 2,
        "output_created": OUTPUT.exists(),
        "output_larger_than_source": build["output_bytes"] > build["source_bytes"],
        "all_visible_replacement_anchors_found": all(build["replacement_status"].values()),
        "rollback_source_still_present": SOURCE.exists(),
    }
    write_json(
        STATIC_QA,
        {
            "schema": "life_ecosystem/chicken_r92_static_qa@1.0",
            "version": "V4.6_R9.2_HEAD_SHAPE_RESTORE_CANDIDATE",
            "checks": checks,
            "passed": all(checks.values()),
            "build": build,
            "scope": "static source and patch-integrity checks; browser and visual gates are separate",
        },
    )
    if not all(checks.values()):
        failed = [name for name, passed in checks.items() if not passed]
        raise RuntimeError(f"Static QA failed: {failed}")


def write_review_board() -> None:
    REVIEW_BOARD.parent.mkdir(parents=True, exist_ok=True)
    captures = [
        ("批准的视觉构形参考", "../../reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png"),
        ("R9.1 被否决头部截图", "../../reference/head/previous_user_review/01_CURRENT_R9_1_REJECTED_HEAD_SCREENSHOT.png"),
        ("R9.2 中性灰侧面", "R92_HEAD_NEUTRAL_LEFT.png"),
        ("R9.2 中性灰正面", "R92_HEAD_NEUTRAL_FRONT.png"),
        ("R9.2 中性灰顶部", "R92_HEAD_NEUTRAL_TOP.png"),
        ("R9.2 中性灰三分之四", "R92_HEAD_NEUTRAL_THREE_QUARTER.png"),
        ("R9 与 R9.2 同镜头并排", "R92_COMPARE_NEUTRAL_LEFT.png"),
        ("R9.2 全身检查", "R92_WHOLE_NEUTRAL_THREE_QUARTER.png"),
    ]
    cards = "\n".join(
        f'<figure><img src="{src}" alt="{title}"><figcaption>{title}</figcaption></figure>'
        for title, src in captures
    )
    REVIEW_BOARD.write_text(
        f"""<!doctype html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Chicken R9.2 头部形体审查板</title><style>*{{box-sizing:border-box}}body{{margin:0;background:#151b20;color:#e9eeee;font:14px/1.55 system-ui,-apple-system,Segoe UI,Microsoft Yahei,sans-serif}}header{{padding:24px 28px;border-bottom:1px solid #344047;position:sticky;top:0;background:#151b20ee;backdrop-filter:blur(8px);z-index:2}}h1{{margin:0 0 8px;font-size:22px}}p{{margin:4px 0;color:#aebdbd}}main{{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;padding:18px}}figure{{margin:0;border:1px solid #344047;background:#0f171c;border-radius:9px;overflow:hidden}}img{{width:100%;height:420px;display:block;object-fit:contain;background:#11181d}}figcaption{{padding:10px 12px;border-top:1px solid #344047}}.gate{{color:#d8bb82}}code{{color:#cddfda}}</style></head><body><header><h1>Chicken V4.6 R9.2 · 头部低频形体恢复候选</h1><p>只检查后脑、颅顶—额部—喙根连续坡度、脸颊、下颌和喉部支撑。鸡冠、眼、鼻孔、肉垂和材质仍是可复用局部候选，不得代替整体形体验收。</p><p class=\"gate\">manualVisualAcceptance=false · rigAuthorized=false · motionAuthorized=false</p><p>运行入口：<code>../../CHICKEN_V46_R9_2_HEAD_SHAPE.html</code></p></header><main>{cards}</main></body></html>""",
        encoding="utf-8",
    )


def update_project_docs(browser_ok: bool) -> None:
    state = {
        "schema": "life_ecosystem/chicken_module_state@1.0",
        "version": "V4.6_R9.2_HEAD_SHAPE_RESTORE_CANDIDATE",
        "date": "2026-09-15",
        "identity": {
            "species_scope": "domestic chicken surface candidate",
            "sex": "unknown",
            "breed": "unknown",
            "age": "unknown",
            "real_world_scale": "unknown",
        },
        "active_entry": OUTPUT.name,
        "frozen_r9_1_baseline": SOURCE.name,
        "frozen_r9_baseline": "history/CHICKEN_V46_R9_FROZEN.html",
        "approved_head_reference": "reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png",
        "candidate_parameters": str(PARAMS.relative_to(ROOT)),
        "review_board": str(REVIEW_BOARD.relative_to(ROOT)),
        "head_status": {
            "r9_1_whole_head_silhouette_accepted": False,
            "r9_2_low_frequency_candidate_built": True,
            "browser_qa_passed": browser_ok,
            "manual_visual_acceptance": False,
            "required_review": [
                "cranium and back-of-head fullness",
                "crown-forehead-bill-root continuity",
                "cheek and lower-jaw support",
                "throat-to-neck transition",
                "comb reattachment without skull distortion",
            ],
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
        "next_stage": "USER_VISUAL_REVIEW_R9_2_THEN_BOUNDED_REFINEMENT",
    }
    write_json(STATE, state)

    doc = f"""# Chicken V4.6 R9.2 — Head Shape Restore Candidate

## Active executable

`{OUTPUT.name}`

## Frozen rollback

- exact R9.1 executable: `{SOURCE.name}`
- exact R9 executable: `history/CHICKEN_V46_R9_FROZEN.html`

Neither frozen file is modified by the R9.2 build.

## What changed

R9.2 replaces the rejected thin/wedge-like whole-head envelope with one bounded, low-frequency carrier deformation. The edited domain restores posterior cranium width, crown volume, a continuous crown–forehead–bill-root slope, cheek width, lower-jaw support and throat continuity. Existing eye/eyelid, nostril, wattle, ear-lobe, continuous-comb and material modules are reattached through the existing surface chart.

## Evidence and QA

- parameters: `data/CHICKEN_R92_HEAD_SHAPE_PARAMETERS.json`
- static QA: `qa/CHICKEN_R92_STATIC_QA.json`
- browser QA: `qa/CHICKEN_R92_BROWSER_QA.json`
- visual review board: `evidence/r92/R92_REVIEW_BOARD.html`
- candidate manifest: `BUILD_MANIFEST_R92.json`

Browser QA passed: `{str(browser_ok).lower()}`.

## Truth boundary and gates

This remains a visual construction candidate. It is not measured skull anatomy and does not establish breed, sex, age or individual identity.

```text
r9_2LowFrequencyCandidateBuilt=true
browserQAPassed={str(browser_ok).lower()}
manualVisualAcceptance=false
wholeVisualGatePassed=false
canonicalChickenSurfaceComplete=false
rigAuthorized=false
motionImplemented=false
productionReady=false
```

## Next action

Review R9.2 in neutral gray from left, front, top and three-quarter views. Only after the whole-head silhouette is accepted may the head be frozen and the project proceed to static rig planning.
"""
    for path in (README, HANDOFF, FULL_HANDOFF):
        path.write_text(doc, encoding="utf-8")

    NEXT_PLAN.write_text(
        """# Next Stage — R9.2 Visual Gate and Bounded Refinement

1. Review the R9.2 head carrier in neutral gray from left, front, top and three-quarter views.
2. Compare directly with the approved construction reference and the rejected R9.1 screenshot.
3. If needed, alter only the named low-frequency bands: posterior cranium, vault, cheek, lower jaw/throat or bill-root blend.
4. Do not polish color, feathers, eyes, comb or wattles as a substitute for silhouette acceptance.
5. After user acceptance, freeze an exact R9.2 visual baseline and begin static rig planning.

Blocked until acceptance: Chicken DNA freeze, rig, skin weights, animation, behavior and production release.
""",
        encoding="utf-8",
    )


def write_manifest() -> None:
    paths = [
        OUTPUT,
        SOURCE,
        PARAMS,
        STATIC_QA,
        BROWSER_QA,
        STATE,
        README,
        HANDOFF,
        FULL_HANDOFF,
        NEXT_PLAN,
        REVIEW_BOARD,
        ROOT / "reference" / "head" / "APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png",
        ROOT / "reference" / "head" / "previous_user_review" / "01_CURRENT_R9_1_REJECTED_HEAD_SCREENSHOT.png",
    ]
    paths.extend(sorted((ROOT / "evidence" / "r92").glob("*.png")))
    files = []
    for path in paths:
        if path.exists() and path.is_file():
            files.append(
                {
                    "path": str(path.relative_to(ROOT)).replace("\\", "/"),
                    "bytes": path.stat().st_size,
                    "sha256": sha256(path),
                }
            )
    write_json(
        MANIFEST,
        {
            "schema": "life_ecosystem/build_manifest@1.0",
            "package": "CHICKEN_V4_6_R9_2_HEAD_SHAPE_RESTORE_CANDIDATE_2026-09-15",
            "active_entry": OUTPUT.name,
            "frozen_source": SOURCE.name,
            "frozen_source_sha256": EXPECTED_SOURCE_SHA256,
            "manual_visual_acceptance": False,
            "files": files,
        },
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--finalize", action="store_true")
    args = parser.parse_args()

    build = build_html()
    write_parameters()
    write_static_qa(build)

    browser_ok = False
    if BROWSER_QA.exists():
        try:
            browser_ok = bool(json.loads(BROWSER_QA.read_text(encoding="utf-8")).get("passed"))
        except (OSError, json.JSONDecodeError):
            browser_ok = False

    if args.finalize:
        write_review_board()
        update_project_docs(browser_ok)
        write_manifest()

    print(json.dumps({"built": str(OUTPUT), "sha256": build["output_sha256"], "browser_ok": browser_ok}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
