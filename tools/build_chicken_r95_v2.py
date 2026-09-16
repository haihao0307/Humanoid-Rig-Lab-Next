#!/usr/bin/env python3
"""Build R9.5.1 with a candidate-only compact head shell."""
from __future__ import annotations

from pathlib import Path

import build_chicken_r95 as base

OVERRIDE = Path(__file__).with_name("chicken_r95_override_v2.js")
base.JS_OVERRIDE = OVERRIDE.read_text(encoding="utf-8").strip()


def write_parameters() -> None:
    base.write_json(base.PARAMS, {
        "schema": "life_ecosystem/chicken_head_shape_candidate@1.0",
        "version": "V4.6_R9.5.1",
        "status": "separate_head_shell_visual_candidate_not_anatomical_truth",
        "units": "normalized_source_units_not_meters",
        "source": {
            "frozen_executable": base.SOURCE.name,
            "sha256": base.EXPECTED_SOURCE_SHA256,
            "approved_visual_reference": "reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png",
            "rejected_predecessors": [
                "R9.2 full-ring inflation",
                "R9.3 long wedge",
                "R9.4 vertical throat / local prototype",
                "R9.5 full-ring head inflation",
            ],
        },
        "carrier": {
            "method": "candidate-only compact head shell with clipped/collapsed legacy head and upper-neck blend",
            "x_domain": [0.292, 0.480],
            "bill_root": 0.434,
            "bill_scale": 0.74,
            "profile_knots": [
                [0.292,0.888,0.056,0.034,0.050], [0.306,0.907,0.068,0.044,0.058],
                [0.326,0.923,0.076,0.052,0.065], [0.350,0.930,0.078,0.056,0.068],
                [0.375,0.930,0.074,0.057,0.068], [0.398,0.926,0.066,0.054,0.063],
                [0.418,0.924,0.055,0.047,0.055], [0.434,0.928,0.042,0.036,0.045],
                [0.448,0.934,0.030,0.026,0.035], [0.460,0.936,0.020,0.017,0.025],
                [0.471,0.934,0.011,0.009,0.015], [0.480,0.931,0.003,0.003,0.004],
            ],
        },
        "local_modules": {
            "comb": "continuous thick four-lobe single comb with embedded root",
            "eyes": "compact shallow iris discs with upper eyelid arcs",
            "ear_lobes": "small lower post-orbital patches",
            "nostrils": "paired patches on shortened bill",
            "wattles": "paired compact teardrops attached at the new jaw",
        },
        "preserved": [
            "R9/R9.1 rollback", "lower neck", "body", "plumage", "wings", "tail", "feet", "materials", "existing controls"
        ],
        "truth_boundary": {
            "manual_visual_acceptance": False,
            "whole_visual_gate_passed": False,
            "rig_authorized": False,
            "motion_authorized": False,
            "anatomical_truth_claimed": False,
        },
    })


def write_state_and_handoff(browser_ok: bool) -> None:
    base.write_json(base.STATE, {
        "schema": "life_ecosystem/chicken_module_state@1.0",
        "version": "V4.6_R9.5_1_SEPARATE_HEAD_SHELL_CANDIDATE",
        "date": "2026-09-16",
        "identity": {"species_scope": "domestic chicken surface candidate", "sex": "unknown", "breed": "unknown", "age": "unknown", "real_world_scale": "unknown"},
        "active_entry": base.OUTPUT.name,
        "frozen_r9_1_baseline": base.SOURCE.name,
        "approved_head_reference": "reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png",
        "candidate_parameters": str(base.PARAMS.relative_to(base.ROOT)),
        "review_board": str(base.REVIEW_BOARD.relative_to(base.ROOT)),
        "head_status": {
            "r9_2_visual_gate_passed": False,
            "r9_3_visual_gate_passed": False,
            "r9_4_visual_gate_passed": False,
            "r9_5_initial_visual_gate_passed": False,
            "r9_5_1_candidate_built": True,
            "r9_5_1_browser_qa_passed": browser_ok,
            "manual_visual_acceptance": False,
        },
        "qa": {
            "technical_gate_passed": browser_ok,
            "current_executable_reproducible": True,
            "whole_visual_gate_passed": False,
            "canonical_chicken_surface_complete": False,
            "rig_authorized": False,
            "motion_implemented": False,
            "production_ready": False,
            "public_https_published": True,
        },
        "next_stage": "INDEPENDENT_VISUAL_AUDIT_R95_1_THEN_BOUNDED_REFINEMENT",
    })
    text = f"""# Chicken V4.6 R9.5.1 — Separate Head Shell Candidate

## Active executable

`{base.OUTPUT.name}`

## Frozen rollback

- exact R9.1 executable: `{base.SOURCE.name}`
- exact R9 executable: `history/CHICKEN_V46_R9_FROZEN.html`

## What changed

R9.5.1 keeps the lower neck and all non-head systems on the frozen R9.1 path. In the candidate path only, the legacy head surface is collapsed/clipped and replaced by a compact posterior-cranium–crown–cheek–jaw–short-bill shell. Eye, eyelid, nostril, ear-lobe, wattle and continuous-comb modules are rebuilt on that shell.

## Evidence and QA

- parameters: `{base.PARAMS.relative_to(base.ROOT)}`
- static QA: `{base.STATIC_QA.relative_to(base.ROOT)}`
- browser QA: `{base.BROWSER_QA.relative_to(base.ROOT)}`
- visual review board: `{base.REVIEW_BOARD.relative_to(base.ROOT)}`
- manifest: `{base.MANIFEST.name}`

Browser QA passed: `{str(browser_ok).lower()}`.

## Truth boundary

This remains a visual construction candidate. It does not establish measured skull anatomy, breed, sex, age or individual identity. Manual visual acceptance, whole-surface freeze, Rig and Motion remain closed.
"""
    for path in [base.README, base.HANDOFF, base.FULL_HANDOFF]:
        path.write_text(text, encoding="utf-8")
    base.NEXT_PLAN.write_text("""# Next Stage — Chicken R9.5.1 Independent Visual Audit

1. Compare neutral left/right/front/top/three-quarter views with the approved visual construction reference.
2. Check compact cranium, upper-neck blend, cheek/jaw support and short-bill closure before local detail polishing.
3. Check eye/eyelid scale, continuous-comb root and attached wattle silhouette.
4. Apply only bounded candidate-shell corrections; do not reopen body, wing, tail or feet.
5. Keep Rig, skin binding and motion blocked until the whole-head silhouette is accepted.
""", encoding="utf-8")


base.write_parameters = write_parameters
base.write_state_and_handoff = write_state_and_handoff

if __name__ == "__main__":
    raise SystemExit(base.main())
