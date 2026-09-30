#!/usr/bin/env python3
"""Derive body-relative turn scores from official CMU subject 69 ASF/AMC.

The output stores only motion parameters and source locks. Pelvis world yaw and
foot contacts remain runtime responsibilities; captured local body motion is
expressed in a pelvis-facing frame so it can be safely retargeted.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
from typing import Any

import numpy as np

SAMPLE_HZ = 120.0
MAX_SAMPLES = 241


def load_base_module():
    path = Path(__file__).with_name("derive-motion-reference.py")
    spec = importlib.util.spec_from_file_location("derive_motion_reference_base", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load derive-motion-reference.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


BASE = load_base_module()


def yaw_from_rotation(matrix: np.ndarray) -> float:
    forward = matrix @ np.array([0.0, 0.0, 1.0])
    return float(math.atan2(forward[0], forward[2]))


def unwrapped_yaws(rows: list[dict[str, Any]], node: str) -> np.ndarray:
    return np.unwrap(np.array([yaw_from_rotation(row["R"][node]) for row in rows], dtype=float))


def signed_onset(values: np.ndarray, direction: float, threshold_rad: float) -> int:
    relative = direction * (values - values[0])
    hits = np.flatnonzero(relative >= threshold_rad)
    return int(hits[0]) if len(hits) else 0


def find_turn_window(trial: dict[str, Any]) -> dict[str, Any]:
    rows = trial["pose"]
    if len(rows) < 60:
        raise ValueError(f"{trial['subject']}_{trial['trial']}: too few frames")
    pelvis = unwrapped_yaws(rows, "root")
    thorax = unwrapped_yaws(rows, "thorax")
    head = unwrapped_yaws(rows, "head")
    edge = min(20, max(5, len(rows) // 10))
    raw_angle = float(np.median(pelvis[-edge:]) - np.median(pelvis[:edge]))
    if abs(raw_angle) < math.radians(30):
        raise ValueError(f"{trial['subject']}_{trial['trial']}: net pelvis turn below 30 degrees")
    direction = 1.0 if raw_angle >= 0 else -1.0
    threshold = max(math.radians(2.0), abs(raw_angle) * 0.035)
    initial = np.array([pelvis[0], thorax[0], head[0]])
    final = np.array([pelvis[-1], thorax[-1], head[-1]])
    stack = np.column_stack([pelvis, thorax, head])
    start_activity = np.max(np.abs(stack - initial), axis=1)
    end_activity = np.max(np.abs(stack - final), axis=1)
    start_hits = np.flatnonzero(start_activity >= threshold)
    end_hits = np.flatnonzero(end_activity >= threshold)
    start = max(0, int(start_hits[0]) - 18) if len(start_hits) else 0
    end = min(len(rows) - 1, int(end_hits[-1]) + 18) if len(end_hits) else len(rows) - 1
    if end - start + 1 < 60:
        pad = (60 - (end - start + 1) + 1) // 2
        start = max(0, start - pad)
        end = min(len(rows) - 1, end + pad)
    local_pelvis = pelvis[start : end + 1]
    runtime_yaw = -(local_pelvis - local_pelvis[0])
    source_angle = float(runtime_yaw[-1])
    if abs(source_angle) < math.radians(25):
        raise ValueError(f"{trial['subject']}_{trial['trial']}: extracted turn below 25 degrees")
    runtime_direction = 1.0 if source_angle >= 0 else -1.0
    signed = runtime_direction * runtime_yaw
    monotone = np.maximum.accumulate(signed)
    final_progress = max(float(monotone[-1]), math.radians(1.0))
    yaw_progress = np.clip(monotone / final_progress, 0.0, 1.0)
    onset_threshold = max(math.radians(2.0), abs(raw_angle) * 0.05)
    pelvis_onset = signed_onset(pelvis[start : end + 1], direction, onset_threshold)
    thorax_onset = signed_onset(thorax[start : end + 1], direction, onset_threshold)
    head_onset = signed_onset(head[start : end + 1], direction, onset_threshold)
    return {
        "start": start,
        "end": end,
        "pelvis_yaw": pelvis,
        "runtime_yaw": runtime_yaw,
        "yaw_progress": yaw_progress,
        "source_angle": source_angle,
        "sequence": {
            "pelvisOnsetFrame": pelvis_onset,
            "thoraxOnsetFrame": thorax_onset,
            "headOnsetFrame": head_onset,
            "headLeadS": round((pelvis_onset - head_onset) / SAMPLE_HZ, 6),
            "thoraxLeadS": round((pelvis_onset - thorax_onset) / SAMPLE_HZ, 6),
            "onsetThresholdDegrees": round(math.degrees(onset_threshold), 6),
            "expectedOrder": "head-thorax-pelvis",
        },
    }


def turn_record(
    pose: dict[str, Any],
    trial: dict[str, Any],
    pelvis_yaw: float,
    initial_yaw: float,
    origin: np.ndarray,
    floor: float,
    leg_length: float,
    standing_height: float,
    yaw_progress: float,
) -> dict[str, Any]:
    reflect = np.diag([-1.0, 1.0, 1.0])
    current_align = reflect @ BASE.rotation([0.0, -math.degrees(pelvis_yaw), 0.0])
    initial_align = reflect @ BASE.rotation([0.0, -math.degrees(initial_yaw), 0.0])

    def local_quaternion(parent: str, child: str) -> list[float]:
        return BASE.quaternion(reflect @ pose["R"][parent].T @ pose["R"][child] @ reflect).tolist()

    record: dict[str, Any] = {
        "rootOffset": (initial_align @ (pose["hip"] - origin) / leg_length).tolist(),
        "rootHeightRatio": float((pose["hip"][1] - floor) / standing_height),
        "rootQ": BASE.quaternion(current_align @ pose["R"]["root"] @ reflect).tolist(),
        "lumbarQ": local_quaternion("root", "lowerback"),
        "thoraxQ": local_quaternion("lowerback", "thorax"),
        "cervicalQ": local_quaternion("thorax", "upperneck"),
        "headQ": local_quaternion("upperneck", "head"),
        "yawProgress": float(yaw_progress),
    }
    for short, side in (("l", "left"), ("r", "right")):
        starts, ends = pose["starts"], pose["ends"]
        for name, parent, child in (
            ("UpperArm", "humerus", "radius"),
            ("Forearm", "radius", "hand"),
            ("Thigh", "femur", "tibia"),
            ("Shank", "tibia", "foot"),
        ):
            record[side + name] = BASE.unit(current_align @ (starts[short + child] - starts[short + parent])).tolist()
            y_axis = -BASE.unit(trial["bones"][short + parent]["direction"])
            z_axis = BASE.unit(np.array([0.0, 0.0, 1.0]) - y_axis * y_axis[2])
            x_axis = BASE.unit(np.cross(y_axis, z_axis))
            z_axis = BASE.unit(np.cross(x_axis, y_axis))
            record[side + name + "Q"] = BASE.quaternion(
                current_align @ pose["R"][short + parent] @ np.column_stack([x_axis, y_axis, z_axis]) @ reflect
            ).tolist()
        y_axis = -BASE.unit(trial["bones"][short + "hand"]["direction"])
        z_axis = BASE.unit(np.array([0.0, 0.0, 1.0]) - y_axis * y_axis[2])
        x_axis = BASE.unit(np.cross(y_axis, z_axis))
        z_axis = BASE.unit(np.cross(x_axis, y_axis))
        record[side + "HandQ"] = BASE.quaternion(
            current_align @ pose["R"][short + "hand"] @ np.column_stack([x_axis, y_axis, z_axis]) @ reflect
        ).tolist()
        foot_forward = BASE.unit(current_align @ (ends[short + "toes"] - starts[short + "foot"]))
        foot_x = -current_align @ pose["R"][short + "foot"] @ np.array([1.0, 0.0, 0.0])
        foot_x = BASE.unit(foot_x - foot_forward * np.dot(foot_x, foot_forward))
        foot_y = BASE.unit(np.cross(foot_forward, foot_x))
        foot_x = BASE.unit(np.cross(foot_y, foot_forward))
        record[side + "FootQ"] = BASE.quaternion(np.column_stack([foot_x, foot_y, foot_forward])).tolist()
        record[side + "ClavicleQ"] = local_quaternion("thorax", short + "clavicle")
        record[side + "AnkleHeightRatio"] = float((starts[short + "foot"][1] - floor) / leg_length)
    return record


def sample_indices(count: int, sequence: dict[str, Any]) -> np.ndarray:
    if count <= MAX_SAMPLES:
        indices = np.arange(count, dtype=int)
    else:
        indices = np.unique(np.rint(np.linspace(0, count - 1, MAX_SAMPLES)).astype(int))
    events = [0, count - 1]
    for key in ("headOnsetFrame", "thoraxOnsetFrame", "pelvisOnsetFrame"):
        event = int(sequence[key])
        events.extend([max(0, event - 1), event, min(count - 1, event + 1)])
    return np.unique(np.r_[indices, events])


def round_record(record: dict[str, Any], t: float) -> dict[str, Any]:
    output: dict[str, Any] = {"t": round(float(t), 9)}
    for key, value in record.items():
        if isinstance(value, list):
            output[key] = [round(float(component), 7) for component in value]
        else:
            output[key] = round(float(value), 7)
    return output


def interpolation_error(records: list[dict[str, Any]], indices: np.ndarray) -> dict[str, float]:
    maximum = {"yawProgress": 0.0, "quaternionDegrees": 0.0, "directionDegrees": 0.0, "rootOffsetLegLengths": 0.0}
    for i, actual_record in enumerate(records):
        position = int(np.searchsorted(indices, i, side="right")) - 1
        position = max(0, min(len(indices) - 2, position))
        a_index, b_index = int(indices[position]), int(indices[position + 1])
        weight = 0.0 if b_index == a_index else (i - a_index) / (b_index - a_index)
        for key, actual_value in actual_record.items():
            a = np.asarray(records[a_index][key], dtype=float)
            b = np.asarray(records[b_index][key], dtype=float)
            actual = np.asarray(actual_value, dtype=float)
            if key.endswith("Q") and np.dot(a, b) < 0:
                b = -b
            estimate = a + (b - a) * weight
            if key.endswith("Q"):
                estimate = BASE.unit(estimate)
                error = math.degrees(2.0 * math.acos(float(np.clip(abs(np.dot(estimate, actual)), -1.0, 1.0))))
                maximum["quaternionDegrees"] = max(maximum["quaternionDegrees"], error)
            elif key == "rootOffset":
                maximum["rootOffsetLegLengths"] = max(maximum["rootOffsetLegLengths"], float(np.linalg.norm(estimate - actual)))
            elif key == "yawProgress":
                maximum["yawProgress"] = max(maximum["yawProgress"], abs(float(estimate - actual)))
            elif np.ndim(actual) == 1:
                error = math.degrees(math.acos(float(np.clip(np.dot(BASE.unit(estimate), actual), -1.0, 1.0))))
                maximum["directionDegrees"] = max(maximum["directionDegrees"], error)
    return {key: round(value, 7) for key, value in maximum.items()}


def make_clip(trial: dict[str, Any], kind: str, description: str) -> dict[str, Any]:
    window = find_turn_window(trial)
    start, end = window["start"], window["end"]
    rows = trial["pose"][start : end + 1]
    bones = trial["bones"]
    initial_yaw = float(window["pelvis_yaw"][start])
    leg_length = float(np.mean([bones[side + "femur"]["length"] + bones[side + "tibia"]["length"] for side in ("l", "r")]))
    toes = [pose["ends"][side + "toes"][1] for pose in rows for side in ("l", "r")]
    floor = float(np.median(toes))
    standing_height = float(np.median([pose["hip"][1] - floor for pose in rows]))
    origin = rows[0]["hip"]
    records = [
        turn_record(
            pose,
            trial,
            float(window["pelvis_yaw"][start + i]),
            initial_yaw,
            origin,
            floor,
            leg_length,
            standing_height,
            float(window["yaw_progress"][i]),
        )
        for i, pose in enumerate(rows)
    ]
    indices = sample_indices(len(records), window["sequence"])
    samples = [round_record(records[int(index)], int(index) / max(1, len(records) - 1)) for index in indices]
    source_translation = rows[-1]["hip"] - rows[0]["hip"]
    return {
        "id": "pending",
        "kind": kind,
        "description": description,
        "sourceTrial": f"{trial['subject']}_{trial['trial']}",
        "sourceFrameStart": start + 1,
        "sourceFrameEnd": end + 1,
        "sourceSampleRateHz": SAMPLE_HZ,
        "durationS": round((len(rows) - 1) / SAMPLE_HZ, 7),
        "sourceTurnAngleRad": round(float(window["source_angle"]), 9),
        "sourceTurnAngleDegrees": round(math.degrees(float(window["source_angle"])), 6),
        "sourceTranslationM": [round(float(value), 7) for value in source_translation],
        "sourceLegLengthM": round(leg_length, 9),
        "sourceStandingHipHeightM": round(standing_height, 9),
        "sourceFloorEstimateM": round(floor, 9),
        "sequence": window["sequence"],
        "pelvisYawRuntimeOwner": True,
        "footContactsRuntimeOwner": True,
        "capturedCoordinateFrame": "body-relative with per-frame pelvis yaw removed after R2 X reflection",
        "yawProfileMethod": "monotone envelope of captured pelvis yaw",
        "sampleBlocks": [samples[index : index + 96] for index in range(0, len(samples), 96)],
        "sampleCount": len(samples),
        "parameterInterpolationError": interpolation_error(records, indices),
        "posedSurfaceError": None,
        "runtimeVerified": False,
        "visualAcceptance": False,
    }


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def derive(directory: Path, output: Path) -> dict[str, Any]:
    trials = {trial_id: BASE.read_trial(directory, "69", trial_id) for trial_id in ("16", "18", "20")}
    in_place = [
        make_clip(trials["16"], "in-place", "captured turn in place"),
        make_clip(trials["18"], "in-place", "captured opposite-direction turn in place"),
    ]
    signs = {1 if clip["sourceTurnAngleRad"] > 0 else -1 for clip in in_place}
    if signs != {-1, 1}:
        raise ValueError(f"subject 69 in-place trials did not produce opposite runtime signs: {signs}")
    clips: dict[str, Any] = {}
    for clip in in_place:
        clip_id = "turnPositive" if clip["sourceTurnAngleRad"] > 0 else "turnNegative"
        clip["id"] = clip_id
        clips[clip_id] = clip
    walk_turn = make_clip(trials["20"], "walking", "captured forward walk with approximately 90-degree turn")
    walk_turn["id"] = "walkTurn90"
    clips[walk_turn["id"]] = walk_turn
    files = [directory / "69.asf", *(directory / f"69_{trial}.amc" for trial in ("16", "18", "20"))]
    document = {
        "schema": "human/turn_motion_reference@1",
        "revision": "cmu69-turn-r1",
        "source": {
            "organization": "Carnegie Mellon University Graphics Lab",
            "databaseURL": "https://mocap.cs.cmu.edu/",
            "subjectURL": "https://mocap.cs.cmu.edu/search.php?subjectnumber=69",
            "formatDocumentation": "https://mocap.cs.cmu.edu/info.php",
            "subject": "69",
            "captureRateHz": SAMPLE_HZ,
            "attribution": "The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.",
            "locks": [
                {
                    "url": f"https://mocap.cs.cmu.edu/subjects/69/{path.name}",
                    "sha256": sha256(path),
                    "bytes": path.stat().st_size,
                }
                for path in files
            ],
        },
        "clips": clips,
        "reconstruction": {
            "script": "tools/derive-turn-reference.py",
            "externalMeshesStored": False,
            "capturedWorldYawStoredAsRuntimeTarget": False,
            "bodyRelativeResiduals": True,
            "generatedGeometryIncluded": False,
        },
        "runtimeVerified": False,
        "visualAcceptance": False,
        "productionReady": False,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(document, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return document


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    document = derive(args.directory, args.output)
    print(
        json.dumps(
            {
                "schema": document["schema"],
                "revision": document["revision"],
                "clips": {
                    clip_id: {
                        "trial": clip["sourceTrial"],
                        "angleDegrees": clip["sourceTurnAngleDegrees"],
                        "durationS": clip["durationS"],
                        "samples": clip["sampleCount"],
                        "sequence": clip["sequence"],
                    }
                    for clip_id, clip in document["clips"].items()
                },
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
