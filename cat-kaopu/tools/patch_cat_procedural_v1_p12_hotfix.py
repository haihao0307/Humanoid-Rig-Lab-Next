from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CORE = ROOT / "cat-kaopu/procedural-cat-v1/src/cat-procedural-core.mjs"
text = CORE.read_text(encoding="utf-8")
old = "{ x: neckBase[0], z: neckBase[2] - dna.neck.baseDepth * 0.12, ry: dna.neck.baseWidth * 0.39 * bulk, rz: dna.neck.baseDepth * 0.38 * bulk }"
new = "{ x: anchors.neckBase[0], z: anchors.neckBase[2] - dna.neck.baseDepth * 0.12, ry: dna.neck.baseWidth * 0.39 * bulk, rz: dna.neck.baseDepth * 0.38 * bulk }"
if new in text:
    print("P1.2 neck-base section reference already repaired")
elif text.count(old) == 1:
    CORE.write_text(text.replace(old, new, 1), encoding="utf-8")
    print("P1.2 neck-base section reference repaired")
else:
    raise SystemExit(f"expected one P1.2 neck-base marker, found {text.count(old)}")
