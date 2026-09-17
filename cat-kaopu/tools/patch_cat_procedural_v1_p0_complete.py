from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CORE = ROOT / "cat-kaopu/procedural-cat-v1/src/cat-procedural-core.mjs"
PAGE = ROOT / "cat-kaopu/procedural-cat-v1/index.html"


def replace_once(text: str, old: str, new: str, label: str) -> tuple[str, bool]:
    if new in text:
        print(f"{label}: already present")
        return text, False
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one marker, found {count}")
    print(f"{label}: patched")
    return text.replace(old, new, 1), True


core = CORE.read_text(encoding="utf-8")
page = PAGE.read_text(encoding="utf-8")
changed = False

core, did = replace_once(
    core,
    "function smin(a, b, k) {\n  const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1);\n  return mix(b, a, h) - k * h * (1 - h);\n}",
    "function smin(a, b, k) {\n  if (!Number.isFinite(a)) return b;\n  if (!Number.isFinite(b)) return a;\n  const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1);\n  return mix(b, a, h) - k * h * (1 - h);\n}",
    "finite smooth union",
)
changed |= did

core, did = replace_once(
    core,
    "  const k0 = Math.hypot(px / rx, py / ry, pz / rz);\n  const k1 = Math.hypot(px / (rx * rx), py / (ry * ry), pz / (rz * rz));\n  return k0 * (k0 - 1) / (k1 || 1);",
    "  const k0 = Math.hypot(px / rx, py / ry, pz / rz);\n  if (k0 < 1e-9) return -Math.min(rx, ry, rz);\n  const k1 = Math.hypot(px / (rx * rx), py / (ry * ry), pz / (rz * rz));\n  return k0 * (k0 - 1) / (k1 || 1);",
    "ellipsoid center sign",
)
changed |= did

core, did = replace_once(
    core,
    "{ x: anchors.lumbar[0] - dna.torso.lumbarLength * 0.28, z: zLumbar - dna.torso.abdomenTuck * 0.10, ry: dna.torso.lumbarWidth * 0.50 * bulk, rz: dna.torso.lumbarDepth * 0.50 * bulk },\n    { x: anchors.lumbar[0] + dna.torso.lumbarLength * 0.30, z: zLumbar + dna.torso.dorsalArc * 0.18, ry: dna.torso.lumbarWidth * 0.54 * bulk, rz: dna.torso.lumbarDepth * 0.48 * bulk },",
    "{ x: anchors.lumbar[0] - dna.torso.lumbarLength * 0.28, z: zLumbar - dna.torso.abdomenTuck * 0.10 - dna.torso.ventralSag * 0.30, ry: dna.torso.lumbarWidth * 0.50 * bulk, rz: (dna.torso.lumbarDepth + dna.torso.ventralSag * 0.35) * 0.50 * bulk },\n    { x: anchors.lumbar[0] + dna.torso.lumbarLength * 0.30, z: zLumbar + dna.torso.dorsalArc * 0.18 - dna.torso.ventralSag * 0.42, ry: dna.torso.lumbarWidth * 0.54 * bulk, rz: (dna.torso.lumbarDepth + dna.torso.ventralSag * 0.42) * 0.48 * bulk },",
    "ventral surface parameter",
)
changed |= did

core, did = replace_once(
    core,
    "[dna.paws.foreLength * 0.50, dna.paws.foreWidth * 0.50, dna.paws.height * 0.50]",
    "[dna.paws.foreLength * 0.50, (dna.paws.foreWidth + dna.paws.toeSplay) * 0.50, dna.paws.height * 0.50]",
    "forepaw toe splay",
)
changed |= did

core, did = replace_once(
    core,
    "[dna.paws.hindLength * 0.50, dna.paws.hindWidth * 0.50, dna.paws.height * 0.50]",
    "[dna.paws.hindLength * 0.50, (dna.paws.hindWidth + dna.paws.toeSplay) * 0.50, dna.paws.height * 0.50]",
    "hindpaw toe splay",
)
changed |= did

core, did = replace_once(
    core,
    "    return d;\n  };\n}\n\nfunction hexToRgb",
    "    const hairNoise = (hashNoise(x * dna.material.shortHairFrequency, y * dna.material.shortHairFrequency, z * dna.material.shortHairFrequency, dna.meta.seed) - 0.5) * 2;\n    return d - hairNoise * dna.material.shortHairAmplitude;\n  };\n}\n\nfunction hexToRgb",
    "short-hair geometric micro field",
)
changed |= did

core, did = replace_once(
    core,
    "  const stripeAmount = smooth01((stripeSignal - 0.18) / 0.72) * dna.coat.stripeContrast;",
    "  const stripeThreshold = mix(0.08, 0.28, dna.material.rimSoftness);\n  const stripeWidth = mix(0.86, 0.58, dna.material.rimSoftness);\n  const stripeAmount = smooth01((stripeSignal - stripeThreshold) / stripeWidth) * dna.coat.stripeContrast;",
    "stripe edge softness",
)
changed |= did

page, did = replace_once(
    page,
    "function updateFeatures(){clearGroup(featureGroup);const {anchors}=deriveCatSkeleton(dna),h=dna.head;",
    "function updateFeatures(){clearGroup(featureGroup);eyeMat.roughness=dna.material.eyeRoughness;noseMat.roughness=dna.material.noseRoughness;eyeMat.needsUpdate=true;noseMat.needsUpdate=true;const {anchors}=deriveCatSkeleton(dna),h=dna.head;",
    "eye and nose roughness parameters",
)
changed |= did

if changed:
    CORE.write_text(core, encoding="utf-8")
    PAGE.write_text(page, encoding="utf-8")
    print("connected all P0 CatDNA fields and repaired the procedural SDF")
else:
    print("P0 CatDNA output wiring and SDF repair already complete")
