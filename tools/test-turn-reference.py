#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any


def norm(values: list[float]) -> float:
    return math.sqrt(sum(value * value for value in values))


def validate_clip(clip: dict[str, Any]) -> dict[str, Any]:
    samples = [sample for block in clip.get("sampleBlocks", []) for sample in block]
    if len(samples) < 12:
        raise AssertionError(f"{clip.get('id')}: too few samples")
    times = [sample["t"] for sample in samples]
    if times != sorted(times) or times[0] != 0 or times[-1] != 1:
        raise AssertionError(f"{clip.get('id')}: invalid normalized sample times")
    progress = [sample["yawProgress"] for sample in samples]
    if any(value < -1e-6 or value > 1 + 1e-6 for value in progress):
        raise AssertionError(f"{clip.get('id')}: yaw progress outside 0..1")
    if any(b + 1e-5 < a for a, b in zip(progress, progress[1:])):
        raise AssertionError(f"{clip.get('id')}: yaw progress is not monotone")
    if progress[0] > 0.03 or progress[-1] < 0.97:
        raise AssertionError(f"{clip.get('id')}: yaw profile does not cover the turn")
    quaternion_keys = [key for key in samples[0] if key.endswith("Q")]
    direction_keys = [
        key
        for key in samples[0]
        if key.endswith(("UpperArm", "Forearm", "Thigh", "Shank")) and not key.endswith("Q")
    ]
    for sample in samples:
        for key in quaternion_keys:
            if abs(norm(sample[key]) - 1) > 2e-3:
                raise AssertionError(f"{clip.get('id')}: non-unit quaternion {key}")
        for key in direction_keys:
            if abs(norm(sample[key]) - 1) > 2e-3:
                raise AssertionError(f"{clip.get('id')}: non-unit direction {key}")
    errors = clip.get("parameterInterpolationError", {})
    if errors.get("quaternionDegrees", 999) > 2.5:
        raise AssertionError(f"{clip.get('id')}: quaternion interpolation too coarse")
    if errors.get("directionDegrees", 999) > 2.5:
        raise AssertionError(f"{clip.get('id')}: direction interpolation too coarse")
    if errors.get("yawProgress", 999) > 0.035:
        raise AssertionError(f"{clip.get('id')}: yaw interpolation too coarse")
    sequence = clip.get("sequence", {})
    if sequence.get("headLeadS", -999) < -0.25:
        raise AssertionError(f"{clip.get('id')}: head starts implausibly late relative to pelvis")
    if clip.get("runtimeVerified") is not False or clip.get("visualAcceptance") is not False:
        raise AssertionError(f"{clip.get('id')}: generated source must remain unaccepted")
    return {
        "trial": clip["sourceTrial"],
        "kind": clip["kind"],
        "angleDegrees": clip["sourceTurnAngleDegrees"],
        "durationS": clip["durationS"],
        "samples": len(samples),
        "headLeadS": sequence.get("headLeadS"),
        "thoraxLeadS": sequence.get("thoraxLeadS"),
        "errors": errors,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=Path)
    args = parser.parse_args()
    document = json.loads(args.path.read_text(encoding="utf-8"))
    if document.get("schema") != "human/turn_motion_reference@1":
        raise AssertionError("turn reference schema mismatch")
    if document.get("revision") != "cmu69-turn-r1":
        raise AssertionError("turn reference revision mismatch")
    clips = document.get("clips", {})
    for required in ("turnPositive", "turnNegative", "walkTurn90"):
        if required not in clips:
            raise AssertionError(f"missing {required}")
    positive = clips["turnPositive"]["sourceTurnAngleRad"]
    negative = clips["turnNegative"]["sourceTurnAngleRad"]
    if positive <= math.radians(25) or negative >= -math.radians(25):
        raise AssertionError("in-place sources do not cover opposite directions")
    if abs(clips["walkTurn90"]["sourceTurnAngleRad"]) < math.radians(45):
        raise AssertionError("walking source does not contain a substantial turn")
    if len(document.get("source", {}).get("locks", [])) != 4:
        raise AssertionError("source lock set must contain the ASF and three AMC files")
    report = {clip_id: validate_clip(clip) for clip_id, clip in clips.items()}
    if document.get("runtimeVerified") is not False or document.get("visualAcceptance") is not False or document.get("productionReady") is not False:
        raise AssertionError("generated reference must remain a candidate")
    print(json.dumps({"schema": "human/turn_motion_reference_validation@1", "clips": report}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
