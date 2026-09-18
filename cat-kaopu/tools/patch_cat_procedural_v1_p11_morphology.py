from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "cat-kaopu/procedural-cat-v1"
CORE = MODULE / "src/cat-procedural-core.mjs"
PAGE = MODULE / "index.html"
DEFAULT_DNA = MODULE / "DEFAULT_GREY_TABBY_A.catdna.json"
CONTRACT = MODULE / "CAT_PROCEDURAL_CAT_V1_CONTRACT.json"
README = MODULE / "README.md"
CANDIDATE = MODULE / "P1_1_MORPHOLOGY_CANDIDATE.json"


def deep_merge(target: dict, source: dict) -> dict:
    for key, value in source.items():
        if isinstance(value, dict) and isinstance(target.get(key), dict):
            deep_merge(target[key], value)
        else:
            target[key] = deepcopy(value)
    return target


def replace_once(text: str, old: str, new: str, label: str) -> tuple[str, bool]:
    if new in text:
        print(f"{label}: already present")
        return text, False
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one marker, found {count}")
    print(f"{label}: patched")
    return text.replace(old, new, 1), True


candidate = json.loads(CANDIDATE.read_text(encoding="utf-8"))
current_dna = json.loads(DEFAULT_DNA.read_text(encoding="utf-8"))
new_dna = deep_merge(deepcopy(current_dna), candidate["overrides"])
DEFAULT_DNA.write_text(json.dumps(new_dna, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("default CatDNA: P1.1 visual candidate applied")

core = CORE.read_text(encoding="utf-8")
page = PAGE.read_text(encoding="utf-8")

# Keep the in-code CatDNA source identical to the exported JSON source.
start = core.index("export const DEFAULT_CAT_DNA = Object.freeze(")
end = core.index("\n\nexport const CAT_PARAMETER_DEFINITIONS", start)
new_default = (
    "export const DEFAULT_CAT_DNA = Object.freeze("
    + json.dumps(new_dna, ensure_ascii=False, indent=2)
    + ");"
)
core = core[:start] + new_default + core[end:]

old_limb_solver = """  for (const side of [-1, 1]) {
    const shoulder = [shoulderX, side * dna.global.frontStanceWidth * 0.5, dna.global.shoulderHeight];
    const foreLengths = [dna.forelimb.humerusLength, dna.forelimb.radiusLength, dna.forelimb.metacarpalLength];
    const foreAngles = [dna.forelimb.humerusBackDeg, dna.forelimb.radiusForwardDeg, dna.forelimb.metacarpalForwardDeg];
    const foreScale = chainScale(shoulder[2] - pawZ, foreLengths, foreAngles);
    const elbow = addSegment(shoulder, foreLengths[0] * foreScale, foreAngles[0], -1);
    const wrist = addSegment(elbow, foreLengths[1] * foreScale, foreAngles[1], 1);
    const forePaw = addSegment(wrist, foreLengths[2] * foreScale, foreAngles[2], 1);
    forePaw[2] = pawZ;

    const hip = [hipX, side * dna.global.hindStanceWidth * 0.5, dna.global.hipHeight];
    const hindLengths = [dna.hindlimb.femurLength, dna.hindlimb.tibiaLength, dna.hindlimb.tarsusLength];
    const hindAngles = [dna.hindlimb.femurForwardDeg, dna.hindlimb.tibiaBackDeg, dna.hindlimb.tarsusForwardDeg];
    const hindScale = chainScale(hip[2] - pawZ, hindLengths, hindAngles);
    const stifle = addSegment(hip, hindLengths[0] * hindScale, hindAngles[0], 1);
    const hock = addSegment(stifle, hindLengths[1] * hindScale, hindAngles[1], -1);
    const hindPaw = addSegment(hock, hindLengths[2] * hindScale, hindAngles[2], 1);
    hindPaw[2] = pawZ;
"""
new_limb_solver = """  for (const side of [-1, 1]) {
    const foreLengths = [dna.forelimb.humerusLength, dna.forelimb.radiusLength, dna.forelimb.metacarpalLength];
    const foreAngles = [dna.forelimb.humerusBackDeg, dna.forelimb.radiusForwardDeg, dna.forelimb.metacarpalForwardDeg];
    const foreVertical = foreLengths.reduce((sum, length, index) => sum + length * Math.cos(foreAngles[index] * DEG), 0);
    const shoulder = [shoulderX, side * dna.global.frontStanceWidth * 0.5, pawZ + foreVertical];
    const elbow = addSegment(shoulder, foreLengths[0], foreAngles[0], -1);
    const wrist = addSegment(elbow, foreLengths[1], foreAngles[1], 1);
    const forePaw = addSegment(wrist, foreLengths[2], foreAngles[2], 1);
    forePaw[2] = pawZ;

    const hindLengths = [dna.hindlimb.femurLength, dna.hindlimb.tibiaLength, dna.hindlimb.tarsusLength];
    const hindAngles = [dna.hindlimb.femurForwardDeg, dna.hindlimb.tibiaBackDeg, dna.hindlimb.tarsusForwardDeg];
    const hindVertical = hindLengths.reduce((sum, length, index) => sum + length * Math.cos(hindAngles[index] * DEG), 0);
    const hip = [hipX, side * dna.global.hindStanceWidth * 0.5, pawZ + hindVertical];
    const stifle = addSegment(hip, hindLengths[0], hindAngles[0], 1);
    const hock = addSegment(stifle, hindLengths[1], hindAngles[1], -1);
    const hindPaw = addSegment(hock, hindLengths[2], hindAngles[2], 1);
    hindPaw[2] = pawZ;
"""
core, _ = replace_once(core, old_limb_solver, new_limb_solver, "preserve measured limb lengths")

pinna_helper = """
function pinnaSdf(x, y, z, base, side, height, width, tiltDeg) {
  const tipZ = base[2] + height;
  const u = clamp((z - base[2]) / Math.max(height, 1e-6), 0, 1);
  const taper = Math.pow(1 - u, 0.72);
  const tilt = tiltDeg * DEG;
  const cx = base[0] - height * 0.09 * u;
  const cy = base[1] + side * Math.sin(tilt) * height * 0.62 * u;
  const halfWidth = Math.max(0.0022, width * (0.52 * taper + 0.045));
  const halfDepth = Math.max(0.0018, width * (0.23 * taper + 0.035));
  const radial = (Math.hypot((x - cx) / halfDepth, (y - cy) / halfWidth) - 1) * Math.min(halfWidth, halfDepth);
  return Math.max(radial, base[2] - z, z - tipZ);
}
"""
if "function pinnaSdf" not in core:
    marker = "\nfunction cubicBezier(a, b, c, d, t) {"
    if marker not in core:
        raise SystemExit("pinna helper insertion marker missing")
    core = core.replace(marker, pinna_helper + marker, 1)
    print("flat triangular pinna field: inserted")
else:
    print("flat triangular pinna field: already present")

old_ear = """      const earBaseA = [anchors.head[0] - dna.head.cranialLength * 0.12, side * dna.head.width * 0.33, anchors.head[2] + dna.head.height * 0.38];
      const earBaseB = [anchors.head[0] + dna.head.cranialLength * 0.10, side * dna.head.width * 0.31, anchors.head[2] + dna.head.height * 0.34];
      const tilt = dna.head.earTiltDeg * DEG;
      const earTip = [
        anchors.head[0] - dna.head.earHeight * 0.12,
        side * (dna.head.width * 0.34 + Math.sin(tilt) * dna.head.earHeight),
        anchors.head[2] + dna.head.height * 0.38 + Math.cos(tilt) * dna.head.earHeight
      ];
      d = smin(d, taperedCapsuleSdf(x, y, z, earBaseA, earTip, dna.head.earWidth * 0.45, 0.004), 0.010);
      d = smin(d, taperedCapsuleSdf(x, y, z, earBaseB, earTip, dna.head.earWidth * 0.36, 0.0035), 0.009);
"""
new_ear = """      const cheekCenter = [anchors.head[0] + dna.head.cranialLength * 0.18, side * dna.head.width * 0.23, anchors.head[2] - dna.head.height * 0.09];
      d = smin(d, ellipsoidSdf(x, y, z, cheekCenter, [dna.head.cranialLength * 0.31, dna.head.width * 0.27, dna.head.height * 0.29]), 0.010);
      const earBase = [anchors.head[0] - dna.head.cranialLength * 0.05, side * dna.head.width * 0.31, anchors.head[2] + dna.head.height * 0.28];
      d = smin(d, pinnaSdf(x, y, z, earBase, side, dna.head.earHeight, dna.head.earWidth, dna.head.earTiltDeg), 0.007);
"""
core, _ = replace_once(core, old_ear, new_ear, "replace conical ears and add feline cheeks")

old_forepaw = """      d = smin(d, taperedCapsuleSdf(x, y, z, wrist, forePaw, dna.forelimb.wristRadius, dna.forelimb.wristRadius * 0.82), 0.006);
      d = smin(d, ellipsoidSdf(x, y, z, [forePaw[0] + dna.paws.foreLength * 0.15, forePaw[1], dna.paws.height * 0.52], [dna.paws.foreLength * 0.50, (dna.paws.foreWidth + dna.paws.toeSplay) * 0.50, dna.paws.height * 0.50]), 0.008);
"""
new_forepaw = """      d = smin(d, taperedCapsuleSdf(x, y, z, wrist, forePaw, dna.forelimb.wristRadius, dna.forelimb.wristRadius * 0.82), 0.006);
      const forePawCenter = [forePaw[0] + dna.paws.foreLength * 0.12, forePaw[1], dna.paws.height * 0.52];
      d = smin(d, ellipsoidSdf(x, y, z, forePawCenter, [dna.paws.foreLength * 0.43, (dna.paws.foreWidth + dna.paws.toeSplay) * 0.46, dna.paws.height * 0.50]), 0.007);
      for (const toe of [-1.5, -0.5, 0.5, 1.5]) {
        const toeCenter = [forePaw[0] + dna.paws.foreLength * (0.42 - Math.abs(toe) * 0.015), forePaw[1] + toe * dna.paws.foreWidth * 0.16, dna.paws.height * 0.48];
        d = smin(d, ellipsoidSdf(x, y, z, toeCenter, [dna.paws.foreLength * 0.18, dna.paws.foreWidth * 0.105, dna.paws.height * 0.33]), 0.0035);
      }
"""
core, _ = replace_once(core, old_forepaw, new_forepaw, "forepaw and toe silhouette")

old_hindpaw = """      d = smin(d, taperedCapsuleSdf(x, y, z, hock, hindPaw, dna.hindlimb.hockRadius, dna.hindlimb.hockRadius * 0.78), 0.006);
      d = smin(d, ellipsoidSdf(x, y, z, [hindPaw[0] + dna.paws.hindLength * 0.15, hindPaw[1], dna.paws.height * 0.52], [dna.paws.hindLength * 0.50, (dna.paws.hindWidth + dna.paws.toeSplay) * 0.50, dna.paws.height * 0.50]), 0.008);
"""
new_hindpaw = """      d = smin(d, taperedCapsuleSdf(x, y, z, hock, hindPaw, dna.hindlimb.hockRadius, dna.hindlimb.hockRadius * 0.78), 0.006);
      const hindPawCenter = [hindPaw[0] + dna.paws.hindLength * 0.12, hindPaw[1], dna.paws.height * 0.52];
      d = smin(d, ellipsoidSdf(x, y, z, hindPawCenter, [dna.paws.hindLength * 0.45, (dna.paws.hindWidth + dna.paws.toeSplay) * 0.46, dna.paws.height * 0.50]), 0.007);
      for (const toe of [-1.5, -0.5, 0.5, 1.5]) {
        const toeCenter = [hindPaw[0] + dna.paws.hindLength * (0.43 - Math.abs(toe) * 0.014), hindPaw[1] + toe * dna.paws.hindWidth * 0.16, dna.paws.height * 0.48];
        d = smin(d, ellipsoidSdf(x, y, z, toeCenter, [dna.paws.hindLength * 0.18, dna.paws.hindWidth * 0.105, dna.paws.height * 0.33]), 0.0035);
      }
"""
core, _ = replace_once(core, old_hindpaw, new_hindpaw, "hindpaw and toe silhouette")

old_shoulder = """      const shoulder = anchors[`shoulder${side}`];
      const elbow = anchors[`elbow${side}`];
      const wrist = anchors[`wrist${side}`];
      const forePaw = anchors[`forePaw${side}`];
      d = smin(d, ellipsoidSdf(x, y, z, shoulder, [dna.forelimb.scapulaLength * 0.48, dna.forelimb.upperRadius * 1.10, dna.forelimb.upperRadius * 1.55]), 0.014);
"""
new_shoulder = """      const shoulder = anchors[`shoulder${side}`];
      const elbow = anchors[`elbow${side}`];
      const wrist = anchors[`wrist${side}`];
      const forePaw = anchors[`forePaw${side}`];
      const scapulaOrigin = [anchors.thorax[0] - dna.forelimb.scapulaLength * 0.22, side * dna.torso.thoraxWidth * 0.24, anchors.thorax[2] + dna.torso.thoraxDepth * 0.23];
      d = smin(d, taperedCapsuleSdf(x, y, z, scapulaOrigin, shoulder, dna.forelimb.upperRadius * 1.18, dna.forelimb.upperRadius * 1.04), 0.012);
      d = smin(d, ellipsoidSdf(x, y, z, shoulder, [dna.forelimb.scapulaLength * 0.40, dna.forelimb.upperRadius * 1.04, dna.forelimb.upperRadius * 1.36]), 0.012);
"""
core, _ = replace_once(core, old_shoulder, new_shoulder, "scapular-thoracic sling")

old_coat = """  const bodyWave = Math.sin((x / dna.global.bodyLength + 0.45) * Math.PI * dna.coat.stripeFrequency + Math.abs(y) * 32);
  const legWave = Math.sin(z * dna.coat.legBands * Math.PI * 2 / Math.max(0.12, dna.global.shoulderHeight));
  const tailWave = Math.sin((-x) * dna.coat.tailBands * Math.PI * 2 / Math.max(0.28, dna.tail.length));
  const bodyMask = smooth01((x + dna.global.bodyLength * 0.35) / 0.08) * (1 - smooth01((x - dna.global.bodyLength * 0.34) / 0.08));
  const legMask = smooth01(Math.abs(y) / Math.max(0.05, dna.global.frontStanceWidth * 0.30)) * underside;
  const tailMask = smooth01((-x - dna.global.bodyLength * 0.25) / 0.10);
  const stripeSignal = Math.max(0, bodyWave * bodyMask, legWave * legMask, tailWave * tailMask);
"""
new_coat = """  const phaseJitter = (hashNoise(x * 4.2, y * 8.0, z * 5.3, seed) - 0.5) * 2.4;
  const bodyWave = Math.sin((x / dna.global.bodyLength + 0.44) * Math.PI * dna.coat.stripeFrequency + Math.abs(y) * 20 + z * 8 + phaseJitter);
  const legWave = Math.sin(z * dna.coat.legBands * Math.PI * 2 / Math.max(0.12, dna.global.shoulderHeight) + phaseJitter * 0.35);
  const tailWave = Math.sin((-x) * dna.coat.tailBands * Math.PI * 2 / Math.max(0.22, dna.tail.length) + phaseJitter * 0.25);
  const bodyMask = smooth01((x + dna.global.bodyLength * 0.35) / 0.07) * (1 - smooth01((x - dna.global.bodyLength * 0.34) / 0.07));
  const flankExposure = smooth01((Math.abs(y) - dna.torso.lumbarWidth * 0.08) / Math.max(0.018, dna.torso.thoraxWidth * 0.34)) * (1 - underside * 0.72);
  const legMask = smooth01(Math.abs(y) / Math.max(0.045, dna.global.frontStanceWidth * 0.32)) * underside;
  const tailMask = smooth01((-x - dna.global.bodyLength * 0.24) / 0.075);
  const stripeSignal = Math.max(0, bodyWave * bodyMask * flankExposure, legWave * legMask, tailWave * tailMask);
"""
core, _ = replace_once(core, old_coat, new_coat, "non-periodic flank tabby field")

# Add actual derived segment lengths to the QA metrics so future animation and
# bind stages cannot silently re-scale measured bones.
metrics_marker = """    headWidthM: dna.head.width,
    pawGroundZ: {
"""
metrics_insert = """    headWidthM: dna.head.width,
    actualSegmentLengthsM: {
      humerus: Math.hypot(...anchors.elbow1.map((value, index) => value - anchors.shoulder1[index])),
      radius: Math.hypot(...anchors.wrist1.map((value, index) => value - anchors.elbow1[index])),
      metacarpal: Math.hypot(...anchors.forePaw1.map((value, index) => value - anchors.wrist1[index])),
      femur: Math.hypot(...anchors.stifle1.map((value, index) => value - anchors.hip1[index])),
      tibia: Math.hypot(...anchors.hock1.map((value, index) => value - anchors.stifle1[index])),
      tarsus: Math.hypot(...anchors.hindPaw1.map((value, index) => value - anchors.hock1[index]))
    },
    pawGroundZ: {
"""
core, _ = replace_once(core, metrics_marker, metrics_insert, "segment-length metrics")

# Workbench presentation: higher authoring resolution and subtle embedded
# facial placeholders. Fixed-view QA will also capture the coat-disabled body.
page_pairs = [
    ("<title>CAT PROCEDURAL BODY V1 · P1 权威测量校准</title>", "<title>CAT PROCEDURAL BODY V1 · P1.1 形态修复</title>"),
    ("<div class=\"brand\"><h1>CAT PROCEDURAL BODY V1 · P1 测量校准</h1><p>身体尺度与肢段比例已接入公开兽医 CT、形态学和步态研究；外部资料只保留数值证据，运行时仍只生成我们自己的 CatDNA 猫。</p></div>", "<div class=\"brand\"><h1>CAT PROCEDURAL BODY V1 · P1.1 形态修复</h1><p>保持权威长度测量，修复长颈、圆锥耳、骨段偷偷缩放、直后腿、无趾足掌和机械环纹；仍由 CatDNA 全程序化生成。</p></div>"),
    ("<div class=\"status\" id=\"status\"><b>P1 权威测量校准：</b>先检查 47.48 cm 头体长、25.25 cm 肩高和真实前后肢段比例；未测量软组织仍明确保持候选状态，稳定拓扑、蒙皮和动作继续锁定。</div>", "<div class=\"status\" id=\"status\"><b>P1.1 形态修复：</b>直接测量长度保持不变；软组织头面、耳廓、颈肩、后肢折线、足掌和虎斑方向作为视觉候选继续复核，稳定拓扑与动作仍锁定。</div>"),
    ("const bounds={minX:-.62,maxX:.52,minY:-.24,maxY:.24,minZ:-.02,maxZ:.48};const resolution=76;", "const bounds={minX:-.62,maxX:.52,minY:-.24,maxY:.24,minZ:-.02,maxZ:.48};const resolution=112;"),
    ("anchors.head[0]+h.cranialLength*.36", "anchors.head[0]+h.cranialLength*.30"),
    ("eye.scale.set(h.eyeHeight*.54,h.eyeHeight*.42,h.eyeHeight*.56)", "eye.scale.set(h.eyeHeight*.46,h.eyeHeight*.36,h.eyeHeight*.48)"),
    ("eye.position.x+h.eyeHeight*.43", "eye.position.x+h.eyeHeight*.37"),
    ("anchors.muzzle[0]+h.muzzleLength*.53", "anchors.muzzle[0]+h.muzzleLength*.42"),
    ("nose.scale.set(h.muzzleLength*.15,h.muzzleWidth*.20,h.muzzleHeight*.16)", "nose.scale.set(h.muzzleLength*.12,h.muzzleWidth*.17,h.muzzleHeight*.14)"),
]
for old, new in page_pairs:
    page, _ = replace_once(page, old, new, old[:54])

if "__CAT_PROCEDURAL_MORPHOLOGY__" not in page:
    page = page.replace(
        "window.__CAT_PROCEDURAL_CALIBRATION__='cat-procedural-body-v1-p1-calibration-20260918';",
        "window.__CAT_PROCEDURAL_CALIBRATION__='cat-procedural-body-v1-p1-calibration-20260918';window.__CAT_PROCEDURAL_MORPHOLOGY__='cat-procedural-body-v1-p1-1-morphology-20260918';",
        1,
    )

CORE.write_text(core, encoding="utf-8")
PAGE.write_text(page, encoding="utf-8")

contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
contract["buildId"] = "cat-procedural-body-v1-p1-1-morphology-20260918"
contract["morphologyCandidate"] = {
    "profile": "P1_1_MORPHOLOGY_CANDIDATE.json",
    "directMeasurementsUnchanged": True,
    "measuredBoneScalingDuringNeutralSolve": False,
    "visualAcceptance": False,
}
CONTRACT.write_text(json.dumps(contract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

readme = README.read_text(encoding="utf-8")
if "## P1.1 形态修复" not in readme:
    readme += """

## P1.1 形态修复

P1 六视图确认尺度收敛，但仍存在长颈、圆锥耳、后腿过直、足掌无趾、骨段在中性求解中被统一缩放，以及规则虎斑造成假环状体积的问题。P1.1 完成：

- 中性骨架以已测量的肱骨、桡骨、腕掌、股骨和胫骨长度直接落地，不再通过统一比例拉长或压短。
- 外部肩高与骨骼肩关节高度分离，避免把皮毛最高点误当成肩关节中心。
- 椭圆截面的扁平三角耳廓替代圆锥胶囊耳。
- 加入受限颊部、肩胛—胸廓吊带、前后足掌与四趾轮廓。
- 恢复猫科后肢膝—飞节—跖部折线。
- 虎斑只在侧腹形成不规则条带，不再完整环绕躯干制造假体节。
- 作者态采样提高到 `112³`，但仍未冻结稳定拓扑。

P1.1 仍是视觉候选，不能跳过固定六视图审查，也不能提前进入蒙皮与动作。
"""
    README.write_text(readme, encoding="utf-8")

print("P1.1 morphology repair applied: measured bone lengths, feline head-neck, pinnae, paws, hindlimb posture and coat direction")
