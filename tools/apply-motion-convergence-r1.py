#!/usr/bin/env python3
"""Apply the minimal R1 motion assembly delta on the clean main baseline.

This script only registers BoxHandling in the existing source assembly and
runtime template. It must not import PR #7's generated entrypoint or clothing
module graph. Running it repeatedly is idempotent.
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


def update_runtime() -> bool:
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


def main() -> None:
    changed = {
        "assembly": update_assembly(),
        "runtime": update_runtime(),
    }
    print(json.dumps({"schema": "human/motion-convergence-assembly@1", **changed}))


if __name__ == "__main__":
    main()
