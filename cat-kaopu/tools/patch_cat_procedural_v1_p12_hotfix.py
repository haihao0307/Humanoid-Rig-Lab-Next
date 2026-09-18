import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CORE = ROOT / "cat-kaopu/procedural-cat-v1/src/cat-procedural-core.mjs"
SCHEMA = ROOT / "cat-kaopu/procedural-cat-v1/CAT_DNA_SCHEMA.json"

text = CORE.read_text(encoding="utf-8")
old = "{ x: neckBase[0], z: neckBase[2] - dna.neck.baseDepth * 0.12, ry: dna.neck.baseWidth * 0.39 * bulk, rz: dna.neck.baseDepth * 0.38 * bulk }"
new = "{ x: anchors.neckBase[0], z: anchors.neckBase[2] - dna.neck.baseDepth * 0.12, ry: dna.neck.baseWidth * 0.39 * bulk, rz: dna.neck.baseDepth * 0.38 * bulk }"
if new in text:
    print("P1.2 neck-base section reference already repaired")
elif text.count(old) == 1:
    text = text.replace(old, new, 1)
    print("P1.2 neck-base section reference repaired")
else:
    raise SystemExit(f"expected one P1.2 neck-base marker, found {text.count(old)}")

old_range = "'head.earHeight': { group: '头部', label: '耳高', min: 0.05, max: 0.105, step: 0.002 }"
new_range = "'head.earHeight': { group: '头部', label: '耳高', min: 0.04, max: 0.105, step: 0.001 }"
if new_range in text:
    print("P1.2 pinna range already repaired")
elif text.count(old_range) == 1:
    text = text.replace(old_range, new_range, 1)
    print("P1.2 pinna range repaired")
else:
    raise SystemExit(f"expected one P1.2 pinna-range marker, found {text.count(old_range)}")
CORE.write_text(text, encoding="utf-8")

schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
node = schema["properties"]["head"]["properties"]["earHeight"]
node["minimum"] = 0.04
node["maximum"] = 0.105
SCHEMA.write_text(json.dumps(schema, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("P1.2 neck-base and pinna bounds repaired")
