#!/usr/bin/env python3
"""Build the second R9.8.4 pass with an isolated procedural head carrier.

The first R9.8.4 browser evidence proved that deforming the inherited head
surface still left a vertical slab. This wrapper keeps the same public version
and rollback, appends one isolated-head pass, culls only the rejected candidate
head triangles, and leaves every non-head system frozen.
"""
from __future__ import annotations

import json
from pathlib import Path

import build_chicken_r984 as r984

base = r984.base
isolation_path = Path(__file__).with_name("chicken_r984_isolated_head.js")
if not isolation_path.exists():
    raise FileNotFoundError(isolation_path)
base.JS_OVERRIDE = (
    base.JS_OVERRIDE.rstrip()
    + "\n"
    + isolation_path.read_text(encoding="utf-8").strip()
).strip()

_old_parameters = base.write_parameters
_old_state = base.write_state_and_handoff
_old_manifest = base.write_manifest


def write_parameters() -> None:
    _old_parameters()
    data = json.loads(base.PARAMS.read_text(encoding="utf-8"))
    data["status"] = "isolated_procedural_head_carrier_candidate"
    data["bounded_changes"].update({
        "carrier_method": "candidate-only legacy-head triangle cull plus independent smooth procedural head loft",
        "carrier_x_domain": [0.210, 0.426],
        "carrier_profile_knots": [
            [0.210,0.825,0.026,0.016,0.023], [0.225,0.838,0.033,0.019,0.027],
            [0.245,0.854,0.042,0.023,0.034], [0.265,0.875,0.054,0.030,0.043],
            [0.290,0.900,0.065,0.039,0.055], [0.320,0.920,0.072,0.047,0.064],
            [0.348,0.925,0.072,0.049,0.068], [0.375,0.921,0.068,0.047,0.065],
            [0.398,0.914,0.058,0.042,0.057], [0.418,0.912,0.044,0.033,0.044],
            [0.426,0.914,0.034,0.026,0.035],
        ],
        "legacy_head_cull": {"centroid_x_gt": 0.218, "centroid_y_gt": 0.775, "candidate_only": True},
        "eye_attachment": "directly evaluated on independent head profile",
        "wattle_attachment": "directly rooted on independent head profile",
        "comb_attachment": "directly evaluated from independent head dorsal profile",
    })
    base.write_json(base.PARAMS, data)


def write_state_and_handoff(browser_ok: bool) -> None:
    _old_state(browser_ok)
    state = json.loads(base.STATE.read_text(encoding="utf-8"))
    state["head_status"].update({
        "independent_procedural_head_built": True,
        "legacy_candidate_head_culled": True,
        "eye_wattle_comb_reprojected_to_new_carrier": True,
    })
    state["next_stage"] = "INDEPENDENT_VISUAL_AUDIT_R984_ISOLATED_HEAD_THEN_BOUNDED_REFINEMENT"
    base.write_json(base.STATE, state)
    text = base.README.read_text(encoding="utf-8")
    note = "\n## Second R9.8.4 correction pass\n\nThe first R9.8.4 browser evidence still showed a slab-like inherited surface. The candidate now culls only that rejected head region and overlays one smooth procedural head loft. The exact rollback and all non-head systems remain unchanged.\n"
    if "## Second R9.8.4 correction pass" not in text:
        text += note
    for path in [base.README, base.HANDOFF, base.FULL_HANDOFF]:
        path.write_text(text, encoding="utf-8")


def write_manifest() -> None:
    _old_manifest()
    data = json.loads(base.MANIFEST.read_text(encoding="utf-8"))
    data["build_pass"] = "isolated_procedural_head_carrier"
    data["source_tools"] = [
        "tools/build_chicken_r984.py",
        "tools/build_chicken_r984_isolated.py",
        "tools/chicken_r984_override.js",
        "tools/chicken_r984_isolated_head.js",
        "tools/capture_chicken_r984.mjs",
        "tools/check_chicken_r984_isolated.mjs",
    ]
    base.write_json(base.MANIFEST, data)


base.write_parameters = write_parameters
base.write_state_and_handoff = write_state_and_handoff
base.write_manifest = write_manifest

if __name__ == "__main__":
    raise SystemExit(base.main())
