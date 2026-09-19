#!/usr/bin/env python3
"""Apply the minimal R1 motion assembly delta on the clean main baseline.

This script registers BoxHandling and the filtered candidate-support query used
by the motion solver. It must not import PR #7's generated entrypoint or its
clothing module graph. Running it repeatedly is idempotent.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSEMBLY = ROOT / "source" / "assembly.json"
RUNTIME = ROOT / "source" / "runtime.template.js"
BOX_MODULE = "body/BoxHandling.js"
AFTER_MODULE = "body/MotionLabActions.js"
RUNTIME_MARKER = "/*__SOURCE:body/MotionLabActions.js__*/"
BOX_MARKER = "/*__SOURCE:body/BoxHandling.js__*/"
OLD_SUPPORT_HEAD = (
    "minimumBoneY(frames=null){let min=Infinity,id=null;for(const b of this.bones){"
    "const f=frames?frames.get(b.joint.id):b.joint.world"
)
NEW_SUPPORT_HEAD = (
    "minimumBoneY(frames=null,jointIds=null){let min=Infinity,id=null;for(const b of this.bones){"
    "if(jointIds&&!jointIds.has(b.joint.id))continue;const f=frames?frames.get(b.joint.id):b.joint.world"
)
OLD_SUPPORT_SKIN = "this.tissue?.minimumSupportY(frames);"
NEW_SUPPORT_SKIN = "this.tissue?.minimumSupportY(frames,jointIds);"


def update_assembly() -> bool:
    data = json.loads(ASSEMBLY.read_text(encoding="utf-8"))
    modules = data.get("modules")
    if not isinstance(modules, list):
        raise SystemExit("source/assembly.json: modules must be an array")
    if any(str(path).startswith("clothing/") for path in modules):
        raise SystemExit("clean motion branch must not register clothing/ modules")
    if AFTER_MODULE not in modules:
        raise SystemExit(f"source/assembly.json: missing {AFTER_MODULE}")
    if modules.count(BOX_MODULE) > 1:
        raise SystemExit(f"source/assembly.json: duplicated {BOX_MODULE}")
    if BOX_MODULE in modules:
        if modules.index(BOX_MODULE) != modules.index(AFTER_MODULE) + 1:
            raise SystemExit("BoxHandling must load immediately after MotionLabActions")
        return False
    modules.insert(modules.index(AFTER_MODULE) + 1, BOX_MODULE)
    ASSEMBLY.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return True


def update_runtime_module() -> bool:
    text = RUNTIME.read_text(encoding="utf-8")
    if text.count(RUNTIME_MARKER) != 1:
        raise SystemExit(
            f"source/runtime.template.js: expected one MotionLabActions marker, "
            f"found {text.count(RUNTIME_MARKER)}"
        )
    if text.count(BOX_MARKER) > 1:
        raise SystemExit("source/runtime.template.js: duplicated BoxHandling marker")
    expected = RUNTIME_MARKER + "\n" + BOX_MARKER
    if BOX_MARKER in text:
        if expected not in text:
            raise SystemExit("BoxHandling marker is in the wrong assembly position")
        return False
    RUNTIME.write_text(text.replace(RUNTIME_MARKER, expected, 1), encoding="utf-8")
    return True


def update_support_query() -> bool:
    text = RUNTIME.read_text(encoding="utf-8")
    old_head_count = text.count(OLD_SUPPORT_HEAD)
    new_head_count = text.count(NEW_SUPPORT_HEAD)
    old_skin_count = text.count(OLD_SUPPORT_SKIN)
    new_skin_count = text.count(NEW_SUPPORT_SKIN)

    if new_head_count == 1 and new_skin_count == 1:
        if old_head_count or old_skin_count:
            raise SystemExit("source/runtime.template.js: mixed old/new support-query contract")
        return False
    if old_head_count != 1 or old_skin_count != 1 or new_head_count or new_skin_count:
        raise SystemExit(
            "source/runtime.template.js: expected exactly one clean-baseline support query"
        )

    text = text.replace(OLD_SUPPORT_HEAD, NEW_SUPPORT_HEAD, 1)
    text = text.replace(OLD_SUPPORT_SKIN, NEW_SUPPORT_SKIN, 1)
    RUNTIME.write_text(text, encoding="utf-8")
    return True


def main() -> None:
    changed = {
        "assembly": update_assembly(),
        "runtime_module": update_runtime_module(),
        "support_query": update_support_query(),
    }
    print(json.dumps({"schema": "human/motion-convergence-assembly@1", **changed}))


if __name__ == "__main__":
    main()
