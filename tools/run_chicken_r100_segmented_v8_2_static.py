#!/usr/bin/env python3
"""Run the reproducible static gate for Chicken R10.0 Segmented Neck V8.2.

The script is intentionally usable both inside the full GitHub branch and in the
stand-alone handoff package. Base controller/skin tests are executed when they
are present; the V8.2-specific checks are mandatory.
"""
from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "qa" / "CHICKEN_R100_SEGMENTED_V8_2_LOCAL_TESTS.json"


def run(name: str, command: list[str], *, required: bool = True) -> dict:
    started = time.perf_counter()
    process = subprocess.run(
        command,
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    elapsed_ms = round((time.perf_counter() - started) * 1000, 3)
    result = {
        "name": name,
        "command": command,
        "required": required,
        "returncode": process.returncode,
        "elapsed_ms": elapsed_ms,
        "passed": process.returncode == 0,
        "output_tail": process.stdout[-6000:],
    }
    if required and process.returncode != 0:
        raise RuntimeError(f"{name} failed with exit code {process.returncode}\n{process.stdout}")
    return result


def main() -> int:
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    steps: list[dict] = []

    mandatory_files = [
        "CHICKEN_V46_R9_9_1_GAMEPLAY_HEAD.html",
        "runtime/chicken_phase1_npc_controller.mjs",
        "runtime/chicken_phase1_articulated_skin.mjs",
        "runtime/chicken_phase1_peck_adapter.mjs",
        "runtime/chicken_phase1_ring_coherent_adapter.mjs",
        "runtime/chicken_phase1_centerline_sweep_adapter.mjs",
        "runtime/chicken_phase1_segmented_neck_adapter.mjs",
        "tests/chicken_phase1_segmented_neck_adapter.test.mjs",
        "tools/chicken_r100_motion_patch.js",
        "tools/chicken_r100_peck_patch.js",
        "tools/chicken_r100_centerline_patch.js",
        "tools/chicken_r100_manual_step_patch.js",
        "tools/capture_chicken_r100.mjs",
        "tools/verify_chicken_r100_segmented_v8_2.mjs",
        "tools/build_chicken_r100.py",
    ]
    missing = [item for item in mandatory_files if not (ROOT / item).is_file()]
    if missing:
        raise RuntimeError(f"missing mandatory V8.2 files: {missing}")

    python_sources = ["tools/build_chicken_r100.py", __file__]
    optional_python = ROOT / "tools" / "build_chicken_r991.py"
    if optional_python.exists():
        python_sources.append(str(optional_python.relative_to(ROOT)))
    steps.append(run("python-syntax", [sys.executable, "-m", "py_compile", *python_sources]))

    node_sources = [
        "tools/chicken_r100_motion_patch.js",
        "tools/chicken_r100_peck_patch.js",
        "tools/chicken_r100_centerline_patch.js",
        "tools/chicken_r100_manual_step_patch.js",
        "tools/capture_chicken_r100.mjs",
        "tools/verify_chicken_r100_segmented_v8_2.mjs",
        "runtime/chicken_phase1_npc_controller.mjs",
        "runtime/chicken_phase1_articulated_skin.mjs",
        "runtime/chicken_phase1_peck_adapter.mjs",
        "runtime/chicken_phase1_ring_coherent_adapter.mjs",
        "runtime/chicken_phase1_centerline_sweep_adapter.mjs",
        "runtime/chicken_phase1_segmented_neck_adapter.mjs",
    ]
    optional_override = ROOT / "tools" / "chicken_r991_override.js"
    if optional_override.exists():
        node_sources.append(str(optional_override.relative_to(ROOT)))
    for path in node_sources:
        steps.append(run(f"node-check:{path}", ["node", "--check", path]))

    optional_tests = [
        "tests/chicken_phase1_npc_controller.test.mjs",
        "tests/chicken_phase1_articulated_skin.test.mjs",
    ]
    for path in optional_tests:
        if (ROOT / path).exists():
            steps.append(run(f"optional-base-test:{path}", ["node", "--test", path]))

    steps.append(run(
        "segmented-neck-unit-test",
        ["node", "--test", "tests/chicken_phase1_segmented_neck_adapter.test.mjs"],
    ))
    steps.append(run(
        "segmented-geometry-audit",
        ["node", "tools/verify_chicken_r100_segmented_v8_2.mjs"],
    ))
    steps.append(run(
        "deterministic-build",
        [sys.executable, "tools/build_chicken_r100.py"],
    ))

    geometry_path = ROOT / "qa" / "CHICKEN_R100_SEGMENTED_V8_2_GEOMETRY_QA.json"
    static_path = ROOT / "qa" / "CHICKEN_R100_STATIC_QA.json"
    output_path = ROOT / "CHICKEN_V46_R10_0_SINGLE_AGENT.html"
    geometry = json.loads(geometry_path.read_text(encoding="utf-8"))
    static = json.loads(static_path.read_text(encoding="utf-8"))
    output_text = output_path.read_text(encoding="utf-8")

    checks = {
        "all_commands_passed": all(step["passed"] for step in steps),
        "geometry_report_passed": geometry.get("passed") is True,
        "static_report_passed": static.get("passed") is True,
        "generated_entry_exists": output_path.is_file() and output_path.stat().st_size > 0,
        "single_segmented_patch": output_text.count("CHICKEN_R100_CENTERLINE_SWEEP_PATCH") == 1,
        "v8_2_adapter_revision_embedded": "segmented-rigid-head-and-buried-root-neck-v8-2" in output_text,
        "peck_profile_hash_matches": geometry.get("peckProfileSha256") == __import__("hashlib").sha256((ROOT / "runtime" / "chicken_phase1_peck_adapter.mjs").read_bytes()).hexdigest(),
        "group_test_not_authorized": "groupTestAuthorized:false" in output_text,
    }
    report = {
        "schema": "life_ecosystem/chicken_segmented_v8_2_local_tests@1.0",
        "version": "V4.6_R10.0_SEGMENTED_NECK_V8_2_CANDIDATE",
        "passed": all(checks.values()),
        "checks": checks,
        "geometry_summary": {
            "torso_triangles": geometry.get("domains", {}).get("torsoTriangles"),
            "rigid_head_triangles": geometry.get("domains", {}).get("headTriangles"),
            "neck_tube_vertices": geometry.get("tube", {}).get("vertices"),
            "neck_tube_triangles": geometry.get("tube", {}).get("triangles"),
            "curve_length_ratio": geometry.get("tube", {}).get("curveLengthRatio"),
            "longitudinal_ratio_p95": geometry.get("tube", {}).get("longitudinalRatioP95"),
            "longitudinal_ratio_max": geometry.get("tube", {}).get("longitudinalRatioMax"),
            "bill_ground_error": geometry.get("contact", {}).get("billGroundError"),
            "root_ring_inside_fraction": geometry.get("seams", {}).get("rootRingInsideSourceFraction"),
            "head_seam_max": geometry.get("seams", {}).get("tubeEndToHead", {}).get("max"),
            "far_arc_clearance_min": geometry.get("tube", {}).get("farArcClearanceMin"),
        },
        "steps": steps,
        "environment_boundary": {
            "browser_render_attempted_locally": True,
            "browser_render_completed_locally": False,
            "local_browser_blocker": "container Chromium could not initialize a usable EGL/ANGLE WebGL display and timed out; GitHub Actions browser QA is required",
        },
        "truthBoundary": {
            "staticSourceAndGeometryGate": True,
            "browserQAPassed": False,
            "manualMotionNaturalnessAcceptance": False,
            "manualVisualAcceptance": False,
            "singleAgentGroundingComplete": False,
            "singleAgentCollisionComplete": False,
            "groupTestAuthorized": False,
            "productionReady": False,
        },
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
