from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CORE = ROOT / "cat-kaopu/procedural-cat-v1/src/cat-procedural-core.mjs"
SCHEMA = ROOT / "cat-kaopu/procedural-cat-v1/CAT_DNA_SCHEMA.json"

core = CORE.read_text(encoding="utf-8")
declaration = "export const CAT_CALIBRATION_PROFILE_ID = 'cat-procedural-body-v1-p1-calibration-20260918';\n"
count = core.count(declaration)
if count == 0:
    marker = "export const CAT_DNA_SCHEMA = 'cat_kaopu/cat_dna@1.0';\n"
    if marker not in core:
        raise SystemExit("CatDNA schema declaration marker missing")
    core = core.replace(marker, marker + "\n" + declaration, 1)
    print("calibration profile declaration: inserted")
elif count > 1:
    first = core.index(declaration)
    tail = core[first + len(declaration):].replace(declaration, "")
    core = core[:first + len(declaration)] + tail
    print(f"calibration profile declaration: collapsed {count} copies to one")
else:
    print("calibration profile declaration: already singular")

old_range = "'hindlimb.tibiaBackDeg': { group: '后肢', label: '小腿后摆', min: 5, max: 38, step: 1 }"
new_range = "'hindlimb.tibiaBackDeg': { group: '后肢', label: '小腿后摆', min: 5, max: 55, step: 1 }"
if old_range in core:
    core = core.replace(old_range, new_range, 1)
    print("hindlimb tibia-back range: widened for feline zig-zag stance")
elif new_range in core:
    print("hindlimb tibia-back range: already widened")
else:
    raise SystemExit("hindlimb tibia-back range marker missing")

CORE.write_text(core, encoding="utf-8")

schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
node = schema["properties"]["hindlimb"]["properties"]["tibiaBackDeg"]
node["minimum"] = 5
node["maximum"] = 55
SCHEMA.write_text(json.dumps(schema, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("P1 rerun idempotence and P1.1 hindlimb range repaired")
