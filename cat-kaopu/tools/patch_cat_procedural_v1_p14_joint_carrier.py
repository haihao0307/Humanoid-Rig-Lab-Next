from __future__ import annotations

import json
import re
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "cat-kaopu/procedural-cat-v1"
CORE = MODULE / "src/cat-procedural-core.mjs"
PAGE = MODULE / "index.html"
DEFAULT_DNA = MODULE / "DEFAULT_GREY_TABBY_A.catdna.json"
CONTRACT = MODULE / "CAT_PROCEDURAL_CAT_V1_CONTRACT.json"
README = MODULE / "README.md"
CANDIDATE = MODULE / "P1_4_JOINT_CARRIER_CANDIDATE.json"


def deep_merge(target: dict, source: dict) -> dict:
    for key, value in source.items():
        if isinstance(value, dict) and isinstance(target.get(key), dict):
            deep_merge(target[key], value)
        else:
            target[key] = deepcopy(value)
    return target


def replace_regex(text: str, pattern: str, replacement: str, label: str) -> str:
    if replacement in text:
        print(f"{label}: already present")
        return text
    result, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{label}: expected one marker, found {count}")
    print(f"{label}: patched")
    return result


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        print(f"{label}: already present")
        return text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one marker, found {count}")
    print(f"{label}: patched")
    return text.replace(old, new, 1)


candidate = json.loads(CANDIDATE.read_text(encoding="utf-8"))
current_dna = json.loads(DEFAULT_DNA.read_text(encoding="utf-8"))
new_dna = deep_merge(deepcopy(current_dna), candidate["overrides"])
DEFAULT_DNA.write_text(json.dumps(new_dna, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("default CatDNA: P1.4 joint-carrier candidate applied")

core = CORE.read_text(encoding="utf-8")
page = PAGE.read_text(encoding="utf-8")

start = core.index("export const DEFAULT_CAT_DNA = Object.freeze(")
end = core.index("\n\nexport const CAT_PARAMETER_DEFINITIONS", start)
core = core[:start] + "export const DEFAULT_CAT_DNA = Object.freeze(" + json.dumps(new_dna, ensure_ascii=False, indent=2) + ");" + core[end:]

new_skeleton = r'''export function deriveCatSkeleton(input = DEFAULT_CAT_DNA) {
  const dna = normalizeCatDNA(input);
  const pawZ = dna.paws.height * 0.5;
  const pelvisX = -dna.global.bodyLength * 0.22;
  const lumbarX = -dna.global.bodyLength * 0.035;
  const thoraxX = dna.global.bodyLength * 0.16;
  const shoulderX = dna.forelimb.shoulderLongitudinal;
  const hipX = dna.hindlimb.hipLongitudinal;
  const pelvisZ = dna.global.hipHeight - dna.torso.pelvisDepth * 0.49;
  const thoraxZ = dna.global.shoulderHeight - dna.torso.thoraxDepth * 0.48;
  const shoulderJointZ = thoraxZ + dna.torso.thoraxDepth * 0.05;
  const hipJointZ = pelvisZ + dna.torso.pelvisDepth * 0.04;
  const neckPitch = dna.neck.pitchDeg * DEG;
  const neckBase = [thoraxX + dna.torso.thoraxLength * 0.67, 0, thoraxZ + dna.torso.thoraxDepth * 0.39];
  const neckTip = [
    neckBase[0] + Math.cos(neckPitch) * dna.neck.length,
    0,
    neckBase[2] + Math.sin(neckPitch) * dna.neck.length
  ];
  const head = [
    neckTip[0] + dna.head.cranialLength * 0.05,
    0,
    neckTip[2] + dna.head.height * 0.01
  ];
  const muzzle = [head[0] + dna.head.cranialLength * 0.43 + dna.head.muzzleLength * 0.38, 0, head[2] - dna.head.height * 0.08];

  const anchors = {
    pelvis: [pelvisX, 0, pelvisZ],
    lumbar: [lumbarX, 0, mix(pelvisZ, thoraxZ, 0.48) + dna.torso.dorsalArc],
    thorax: [thoraxX, 0, thoraxZ],
    neckBase,
    neckTip,
    head,
    muzzle,
    tailRoot: [pelvisX - dna.torso.pelvisLength * 0.52, 0, pelvisZ + dna.torso.pelvisDepth * 0.22]
  };

  const solvePlanarTwoBone = (root, end, l1, l2, bendSign) => {
    const dx = end[0] - root[0];
    const dz = end[2] - root[2];
    const distance = Math.max(1e-8, Math.hypot(dx, dz));
    const d = clamp(distance, Math.abs(l1 - l2) + 1e-6, l1 + l2 - 1e-6);
    const ux = dx / distance;
    const uz = dz / distance;
    const projectedEnd = [root[0] + ux * d, root[1], root[2] + uz * d];
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const px = -uz;
    const pz = ux;
    return {
      middle: [root[0] + ux * a + px * h * bendSign, root[1], root[2] + uz * a + pz * h * bendSign],
      end: projectedEnd,
      reachCorrection: Math.abs(distance - d)
    };
  };

  for (const side of [-1, 1]) {
    const foreLengths = [dna.forelimb.humerusLength, dna.forelimb.radiusLength, dna.forelimb.metacarpalLength];
    const foreAngles = [dna.forelimb.humerusBackDeg, dna.forelimb.radiusForwardDeg, dna.forelimb.metacarpalForwardDeg];
    const foreOffset = -Math.sin(foreAngles[0] * DEG) * foreLengths[0]
      + Math.sin(foreAngles[1] * DEG) * foreLengths[1]
      + Math.sin(foreAngles[2] * DEG) * foreLengths[2];
    const shoulder = [shoulderX, side * dna.global.frontStanceWidth * 0.5, shoulderJointZ];
    const forePaw = [shoulderX + foreOffset, shoulder[1], pawZ];
    const metacarpalAngle = foreAngles[2] * DEG;
    const wristTarget = [
      forePaw[0] - Math.sin(metacarpalAngle) * foreLengths[2],
      forePaw[1],
      forePaw[2] + Math.cos(metacarpalAngle) * foreLengths[2]
    ];
    const foreSolve = solvePlanarTwoBone(shoulder, wristTarget, foreLengths[0], foreLengths[1], -1);
    const elbow = foreSolve.middle;
    const wrist = foreSolve.end;

    const hindLengths = [dna.hindlimb.femurLength, dna.hindlimb.tibiaLength, dna.hindlimb.tarsusLength];
    const hindAngles = [dna.hindlimb.femurForwardDeg, dna.hindlimb.tibiaBackDeg, dna.hindlimb.tarsusForwardDeg];
    const hindOffset = Math.sin(hindAngles[0] * DEG) * hindLengths[0]
      - Math.sin(hindAngles[1] * DEG) * hindLengths[1]
      + Math.sin(hindAngles[2] * DEG) * hindLengths[2];
    const hip = [hipX, side * dna.global.hindStanceWidth * 0.5, hipJointZ];
    const hindPaw = [hipX + hindOffset, hip[1], pawZ];
    const tarsusAngle = hindAngles[2] * DEG;
    const hockTarget = [
      hindPaw[0] - Math.sin(tarsusAngle) * hindLengths[2],
      hindPaw[1],
      hindPaw[2] + Math.cos(tarsusAngle) * hindLengths[2]
    ];
    const hindSolve = solvePlanarTwoBone(hip, hockTarget, hindLengths[0], hindLengths[1], 1);
    const stifle = hindSolve.middle;
    const hock = hindSolve.end;

    anchors[`shoulder${side}`] = shoulder;
    anchors[`elbow${side}`] = elbow;
    anchors[`wrist${side}`] = wrist;
    anchors[`forePaw${side}`] = forePaw;
    anchors[`hip${side}`] = hip;
    anchors[`stifle${side}`] = stifle;
    anchors[`hock${side}`] = hock;
    anchors[`hindPaw${side}`] = hindPaw;
    anchors[`foreReachCorrection${side}`] = [foreSolve.reachCorrection, 0, 0];
    anchors[`hindReachCorrection${side}`] = [hindSolve.reachCorrection, 0, 0];
  }

  return { dna, anchors };
}'''
core = replace_regex(
    core,
    r"export function deriveCatSkeleton\(input = DEFAULT_CAT_DNA\) \{.*?\n\}\n\nexport function deriveCatSections",
    new_skeleton + "\n\nexport function deriveCatSections",
    "carrier-aligned fixed-length skeleton",
)

new_pinna = r'''function pinnaSdf(x, y, z, base, side, height, width, tiltDeg) {
  const u = clamp((z - base[2]) / Math.max(height, 1e-6), 0, 1);
  const tilt = tiltDeg * DEG;
  const cx = base[0] - height * (0.04 + 0.06 * u) * u;
  const cy = base[1] + side * Math.sin(tilt) * height * 0.42 * u;
  const taper = Math.pow(1 - u, 0.92);
  const halfWidth = Math.max(0.0010, width * (0.50 * taper + 0.018));
  const halfDepth = Math.max(0.0010, width * (0.14 * taper + 0.022));
  const localX = Math.abs(x - cx) - halfDepth;
  const localY = Math.abs(y - cy) - halfWidth;
  const vertical = Math.max(base[2] - z, z - (base[2] + height));
  return Math.max(localX, localY, vertical);
}'''
core = replace_regex(
    core,
    r"function pinnaSdf\(x, y, z, base, side, height, width, tiltDeg\) \{.*?\n\}",
    new_pinna,
    "thin triangular pinna field",
)

new_sdf = r'''export function createCatSdf(input = DEFAULT_CAT_DNA) {
  const { dna, anchors, sections } = deriveCatSections(input);
  const { points: tailPoints } = deriveTailPoints(dna);

  return function catSdf(x, y, z) {
    let d = continuousTorsoSdf(x, y, z, sections);

    d = smin(d, taperedCapsuleSdf(x, y, z, anchors.neckBase, anchors.neckTip, dna.neck.baseWidth * 0.34, dna.neck.headWidth * 0.34), 0.010);
    const braincase = [anchors.head[0] - dna.head.cranialLength * 0.03, 0, anchors.head[2] + dna.head.height * 0.03];
    const facialCenter = [anchors.head[0] + dna.head.cranialLength * 0.25, 0, anchors.head[2] - dna.head.height * 0.025];
    d = smin(d, ellipsoidSdf(x, y, z, braincase, [dna.head.cranialLength * 0.45, dna.head.width * 0.48, dna.head.height * 0.44]), 0.014);
    d = smin(d, ellipsoidSdf(x, y, z, facialCenter, [dna.head.cranialLength * 0.27, dna.head.width * 0.40, dna.head.height * 0.33]), 0.010);
    d = smin(d, ellipsoidSdf(x, y, z, anchors.muzzle, [dna.head.muzzleLength * 0.70, dna.head.muzzleWidth * 0.46, dna.head.muzzleHeight * 0.45]), 0.008);
    d = smin(d, ellipsoidSdf(x, y, z, [anchors.muzzle[0] - dna.head.muzzleLength * 0.12, 0, anchors.muzzle[2] - dna.head.jawDepth * 0.34], [dna.head.muzzleLength * 0.55, dna.head.muzzleWidth * 0.40, dna.head.jawDepth * 0.46]), 0.007);

    for (const side of [-1, 1]) {
      const cheekCenter = [anchors.head[0] + dna.head.cranialLength * 0.20, side * dna.head.width * 0.22, anchors.head[2] - dna.head.height * 0.08];
      d = smin(d, ellipsoidSdf(x, y, z, cheekCenter, [dna.head.cranialLength * 0.22, dna.head.width * 0.22, dna.head.height * 0.20]), 0.006);
      const earBase = [anchors.head[0] - dna.head.cranialLength * 0.08, side * dna.head.width * 0.29, anchors.head[2] + dna.head.height * 0.31];
      d = smin(d, pinnaSdf(x, y, z, earBase, side, dna.head.earHeight, dna.head.earWidth, dna.head.earTiltDeg), 0.005);

      const shoulder = anchors[`shoulder${side}`];
      const elbow = anchors[`elbow${side}`];
      const wrist = anchors[`wrist${side}`];
      const forePaw = anchors[`forePaw${side}`];
      const scapulaOrigin = [anchors.thorax[0] - dna.forelimb.scapulaLength * 0.40, side * dna.torso.thoraxWidth * 0.27, anchors.thorax[2] + dna.torso.thoraxDepth * 0.27];
      d = smin(d, taperedCapsuleSdf(x, y, z, scapulaOrigin, shoulder, dna.forelimb.upperRadius * 0.72, dna.forelimb.upperRadius * 0.78), 0.006);
      d = smin(d, taperedCapsuleSdf(x, y, z, shoulder, elbow, dna.forelimb.upperRadius, dna.forelimb.lowerRadius * 1.08), 0.008);
      d = smin(d, taperedCapsuleSdf(x, y, z, elbow, wrist, dna.forelimb.lowerRadius, dna.forelimb.wristRadius), 0.006);
      d = smin(d, taperedCapsuleSdf(x, y, z, wrist, forePaw, dna.forelimb.wristRadius, dna.forelimb.wristRadius * 0.74), 0.0045);
      const forePawCenter = [forePaw[0] + dna.paws.foreLength * 0.17, forePaw[1], dna.paws.height * 0.48];
      d = smin(d, ellipsoidSdf(x, y, z, forePawCenter, [dna.paws.foreLength * 0.42, (dna.paws.foreWidth + dna.paws.toeSplay) * 0.43, dna.paws.height * 0.44]), 0.0035);
      for (const toe of [-1.5, -0.5, 0.5, 1.5]) {
        const toeCenter = [forePaw[0] + dna.paws.foreLength * (0.53 - Math.abs(toe) * 0.010), forePaw[1] + toe * (dna.paws.foreWidth + dna.paws.toeSplay) * 0.18, dna.paws.height * 0.42];
        d = smin(d, ellipsoidSdf(x, y, z, toeCenter, [dna.paws.foreLength * 0.14, dna.paws.foreWidth * 0.10, dna.paws.height * 0.27]), 0.0012);
      }

      const hip = anchors[`hip${side}`];
      const stifle = anchors[`stifle${side}`];
      const hock = anchors[`hock${side}`];
      const hindPaw = anchors[`hindPaw${side}`];
      const glutealCenter = [anchors.pelvis[0] - dna.torso.pelvisLength * 0.05, hip[1], anchors.pelvis[2] + dna.torso.pelvisDepth * 0.10];
      d = smin(d, ellipsoidSdf(x, y, z, glutealCenter, [dna.hindlimb.femurLength * 0.13, dna.hindlimb.upperRadius * 0.58, dna.hindlimb.upperRadius * 0.65]), 0.005);
      d = smin(d, taperedCapsuleSdf(x, y, z, hip, stifle, dna.hindlimb.upperRadius, dna.hindlimb.lowerRadius * 1.06), 0.008);
      d = smin(d, taperedCapsuleSdf(x, y, z, stifle, hock, dna.hindlimb.lowerRadius, dna.hindlimb.hockRadius), 0.006);
      d = smin(d, taperedCapsuleSdf(x, y, z, hock, hindPaw, dna.hindlimb.hockRadius, dna.hindlimb.hockRadius * 0.72), 0.0045);
      const hindPawCenter = [hindPaw[0] + dna.paws.hindLength * 0.18, hindPaw[1], dna.paws.height * 0.48];
      d = smin(d, ellipsoidSdf(x, y, z, hindPawCenter, [dna.paws.hindLength * 0.43, (dna.paws.hindWidth + dna.paws.toeSplay) * 0.43, dna.paws.height * 0.44]), 0.0035);
      for (const toe of [-1.5, -0.5, 0.5, 1.5]) {
        const toeCenter = [hindPaw[0] + dna.paws.hindLength * (0.54 - Math.abs(toe) * 0.010), hindPaw[1] + toe * (dna.paws.hindWidth + dna.paws.toeSplay) * 0.18, dna.paws.height * 0.42];
        d = smin(d, ellipsoidSdf(x, y, z, toeCenter, [dna.paws.hindLength * 0.14, dna.paws.hindWidth * 0.10, dna.paws.height * 0.27]), 0.0012);
      }
    }

    for (let i = 0; i < tailPoints.length - 1; i += 1) {
      const t0 = i / (tailPoints.length - 1);
      const t1 = (i + 1) / (tailPoints.length - 1);
      const blend = i < 3 ? 0.009 : 0.007;
      d = smin(d, taperedCapsuleSdf(x, y, z, tailPoints[i], tailPoints[i + 1], mix(dna.tail.baseRadius, dna.tail.tipRadius, t0), mix(dna.tail.baseRadius, dna.tail.tipRadius, t1)), blend);
    }
    const hairNoise = (hashNoise(x * dna.material.shortHairFrequency, y * dna.material.shortHairFrequency, z * dna.material.shortHairFrequency, dna.meta.seed) - 0.5) * 2;
    return d - hairNoise * dna.material.shortHairAmplitude;
  };
}'''
core = replace_regex(
    core,
    r"export function createCatSdf\(input = DEFAULT_CAT_DNA\) \{.*?\n\}\n\nfunction hexToRgb",
    new_sdf + "\n\nfunction hexToRgb",
    "compact head and carrier-integrated appendages",
)

core = replace_once(
    core,
    "    headWidthM: dna.head.width,\n    actualSegmentLengthsM:",
    "    headWidthM: dna.head.width,\n    shoulderJointHeightM: anchors.shoulder1[2],\n    hipJointHeightM: anchors.hip1[2],\n    foreReachCorrectionM: anchors.foreReachCorrection1[0],\n    hindReachCorrectionM: anchors.hindReachCorrection1[0],\n    actualSegmentLengthsM:",
    "joint carrier metrics",
)

page = replace_once(page, "<title>CAT PROCEDURAL BODY V1 · P1.3 体量分配</title>", "<title>CAT PROCEDURAL BODY V1 · P1.4 关节载体对齐</title>", "page title")
page = replace_once(
    page,
    "<div class=\"brand\"><h1>CAT PROCEDURAL BODY V1 · P1.3 体量分配</h1><p>保留测量尺度，移除肩髋辅助球、补足连续躯干体量、缩短可见颈段并提高足掌与趾端可读性；仍由 CatDNA 全程序化生成。</p></div>",
    "<div class=\"brand\"><h1>CAT PROCEDURAL BODY V1 · P1.4 关节载体对齐</h1><p>肩髋根节点进入连续身体载体，实测骨段以固定长度 IK 落到四足；同时收敛头颈、耳廓、眼位、肢端与尾根，仍由 CatDNA 全程序化生成。</p></div>",
    "page brand",
)
page = replace_once(
    page,
    "<div class=\"status\" id=\"status\"><b>P1.3 体量分配：</b>直接测量长度保持不变；优先检查肩胸、腰腹、骨盆、大腿、短颈和足掌是否形成连续家猫轮廓，稳定拓扑与动作仍锁定。</div>",
    "<div class=\"status\" id=\"status\"><b>P1.4 关节载体对齐：</b>实测骨段长度不变，肩髋根节点不再漂浮于背线；优先检查中性站姿、头颈、肩胸、骨盆、膝飞节与四足接地，稳定拓扑与动作仍锁定。</div>",
    "page status",
)
page = replace_regex(
    page,
    r"function updateFeatures\(\)\{.*?\}\nfunction updateSkeleton",
    "function updateFeatures(){clearGroup(featureGroup);eyeMat.roughness=dna.material.eyeRoughness;noseMat.roughness=dna.material.noseRoughness;eyeMat.needsUpdate=true;noseMat.needsUpdate=true;const {anchors}=deriveCatSkeleton(dna),h=dna.head;for(const side of [-1,1]){const eye=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),eyeMat);eye.position.set(anchors.head[0]+h.cranialLength*.405,side*h.eyeSpacing*.5,anchors.head[2]+h.height*.07);eye.scale.set(h.eyeHeight*.34,h.eyeHeight*.30,h.eyeHeight*.38);featureGroup.add(eye);const pupil=new THREE.Mesh(new THREE.SphereGeometry(1,18,12),pupilMat);pupil.position.set(eye.position.x+h.eyeHeight*.275,eye.position.y,eye.position.z);pupil.scale.set(h.eyeHeight*.12,h.eyeHeight*.10,h.eyeHeight*.34);featureGroup.add(pupil)}const nose=new THREE.Mesh(new THREE.SphereGeometry(1,22,14),noseMat);nose.position.set(anchors.muzzle[0]+h.muzzleLength*.52,0,anchors.muzzle[2]-h.muzzleHeight*.03);nose.scale.set(h.muzzleLength*.14,h.muzzleWidth*.13,h.muzzleHeight*.11);featureGroup.add(nose)}\nfunction updateSkeleton",
    "surface eye and nose placement",
)
page = replace_once(page, "controls.target.set(.000,0,.165);", "controls.target.set(.005,0,.160);", "camera target")
if "__CAT_PROCEDURAL_JOINT_CARRIER__" not in page:
    page = page.replace(
        "window.__CAT_PROCEDURAL_MASS__='cat-procedural-body-v1-p1-3-mass-20260918';",
        "window.__CAT_PROCEDURAL_MASS__='cat-procedural-body-v1-p1-3-mass-20260918';window.__CAT_PROCEDURAL_JOINT_CARRIER__='cat-procedural-body-v1-p1-4-joint-carrier-20260918';",
        1,
    )

CORE.write_text(core, encoding="utf-8")
PAGE.write_text(page, encoding="utf-8")

contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
contract["buildId"] = "cat-procedural-body-v1-p1-4-joint-carrier-20260918"
contract["jointCarrierCandidate"] = {
    "profile": "P1_4_JOINT_CARRIER_CANDIDATE.json",
    "directMeasurementsUnchanged": True,
    "fixedLengthIk": True,
    "shoulderHipCarrierAligned": True,
    "stableTopology": False,
    "visualAcceptance": False,
}
CONTRACT.write_text(json.dumps(contract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

readme = README.read_text(encoding="utf-8")
section = """

## P1.4 关节载体对齐

P1.3 减少了肩髋辅助球，但固定六视图仍显示肩关节和髋关节由足端反推高度，导致根节点漂浮于连续躯干载体上方；头颈并集仍偏球形，眼位埋入表面，后肢和足掌也因此显得僵硬。P1.4 完成：

- 肩关节和髋关节高度改由胸廓与骨盆载体派生，不再由足端骨段垂直和反推。
- 保留实测肱骨、桡骨、腕掌、股骨、胫骨和跖段长度，以平面双骨 IK 将四足精确落地。
- CatDNA 中的中性骨段角继续决定足端纵向位置，不被丢弃。
- 头部由紧凑脑颅、额面、短口鼻和下颌连续场组成，缩小球形头颈并集。
- 眼球与瞳孔移到生成表面，耳廓改为薄三角楔形，避免埋眼和角状厚耳。
- 肩胛、上臂、大腿、飞节和四趾足掌继续使用程序化体积，但根部不再形成背线孤立球团。
- 尾根提高连续融合，虎斑与短毛起伏继续服从轮廓检查。

P1.4 仍是稳定拓扑之前的作者态候选。固定六视图未通过前，Surface Carrier、正式绑定和动作生产继续锁定。
"""
if "## P1.4 关节载体对齐" not in readme:
    readme += section
README.write_text(readme, encoding="utf-8")

print("P1.4 joint-carrier candidate patched")
