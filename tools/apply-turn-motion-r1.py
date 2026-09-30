#!/usr/bin/env python3
"""Idempotently wire the isolated R1 turn module into the pure-code build."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def patch_runtime() -> bool:
    path = ROOT / "source/runtime.template.js"
    text = path.read_text(encoding="utf-8")
    marker = "/*__SOURCE:body/NaturalLocomotion.js__*/"
    insertion = marker + "\n/*__SOURCE:body/TurnMotion.js__*/"
    if "/*__SOURCE:body/TurnMotion.js__*/" in text:
        return False
    if text.count(marker) != 1:
        raise SystemExit(f"runtime marker count is {text.count(marker)}, expected 1")
    path.write_text(text.replace(marker, insertion, 1), encoding="utf-8")
    return True


def patch_manifest() -> bool:
    path = ROOT / "source/assembly.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    changed = False
    modules = data["modules"]
    module = "body/TurnMotion.js"
    if module not in modules:
        at = modules.index("body/NaturalLocomotion.js") + 1
        modules.insert(at, module)
        changed = True
    tokens = data["jsonTokens"]
    if tokens.get("TURN_MOTION") != "../reconstruction/turn-reference":
        tokens["TURN_MOTION"] = "../reconstruction/turn-reference"
        changed = True
    if changed:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return changed


def patch_visual_workflow() -> bool:
    path = ROOT / ".github/workflows/motion-visual-qa-v2.yml"
    text = path.read_text(encoding="utf-8")
    branch = "      - feature/human-turn-motion-r1-20260930"
    if branch in text:
        return False
    marker = "      - feature/human-motion-workbench-adjustment-v1"
    if text.count(marker) != 1:
        raise SystemExit(f"visual workflow branch marker count is {text.count(marker)}, expected 1")
    path.write_text(text.replace(marker, marker + "\n" + branch, 1), encoding="utf-8")
    return True


def main() -> int:
    changed = {
        "runtime": patch_runtime(),
        "manifest": patch_manifest(),
        "visualWorkflow": patch_visual_workflow(),
    }
    print(json.dumps({"schema": "human/turn_motion_patch@1", "changed": changed}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
