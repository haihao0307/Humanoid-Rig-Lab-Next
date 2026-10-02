import * as THREE from 'three';

export { THREE };
export const VERSION = 'K5.0.0';
export const CONTRACT = Object.freeze({
  domain: 'digitigrade-mammal',
  units: 'metre',
  upAxis: 'Y',
  forwardAxis: '+Z',
  requiredSections: ['M', 'G', 'B', 'N', 'C', 'F', 'H', 'P'],
  optionalSections: ['T', 'E', 'S', 'D', 'A', 'R', 'W'],
  identityPresets: 0,
  sharedOperators: Object.freeze([
    'fixed-length-ik',
    'continuous-torso-field',
    'elliptic-limb-carrier',
    'paw-toe-fan',
    'pinna-sheet',
    'head-muzzle-field',
    'coat-pattern-field',
    'vibrissa-curves',
  ]),
});

const MAX_SCORE_LENGTH = 16384;
const MAX_MATERIALS = 10;
const MAX_DETAILS = 32;
const MAX_EARS = 4;
const MAX_WHISKERS = 24;
const MAX_GRID_POINTS = 720000;
const MIN_SURFACE_STEP = 0.006;
const MAX_SURFACE_STEP = 0.024;
const encoder = new TextEncoder();
const DEG = Math.PI / 180;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mix = (a, b, t) => a + (b - a) * t;
const smooth01 = (value) => {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
};

function finite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} 必须是有限数字`);
  return number;
}

function inRange(value, min, max, label) {
  if (value < min || value > max) throw new Error(`${label} 必须在 ${min} 到 ${max} 之间`);
  return value;
}

function positive(value, label, minimum = 0.0005) {
  if (value < minimum) throw new Error(`${label} 必须大于 ${minimum}`);
  return value;
}

function integer(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label} 必须是 ${min} 到 ${max} 的整数`);
  return value;
}

function numbers(raw, width, label) {
  if (!raw) throw new Error(`${label} 不能为空`);
  const values = raw.split(',').map((value, index) => finite(value, `${label}[${index}]`));
  if (values.length !== width) throw new Error(`${label} 必须有 ${width} 个数字`);
  return values;
}

function records(raw, width, label) {
  if (!raw) return [];
  return raw.split('/').map((part, recordIndex) => {
    const values = part.split(',').map((value, valueIndex) => finite(value, `${label}[${recordIndex}][${valueIndex}]`));
    if (values.length !== width) throw new Error(`${label} 每条记录必须有 ${width} 个数字`);
    return values;
  });
}

function parseMaterials(raw) {
  if (!raw) throw new Error('M 材质段不能为空');
  const materials = raw.split('/').map((part, index) => {
    const values = part.split(',');
    if (values.length < 1 || values.length > 3) throw new Error(`M[${index}] 需要 1 到 3 个字段`);
    const color = values[0];
    if (!/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) throw new Error(`M[${index}] 颜色格式错误`);
    const roughness = values[1] === undefined ? 0.9 : inRange(finite(values[1], `M[${index}] 粗糙度`), 0, 1, `M[${index}] 粗糙度`);
    const metalness = values[2] === undefined ? 0 : inRange(finite(values[2], `M[${index}] 金属度`), 0, 1, `M[${index}] 金属度`);
    return { color: `#${color}`, roughness, metalness };
  });
  if (materials.length < 1 || materials.length > MAX_MATERIALS) throw new Error(`材质数量必须在 1 到 ${MAX_MATERIALS} 之间`);
  return materials;
}

function parseDetails(raw, label, materialCount) {
  const result = records(raw, 10, label).map((values) => {
    const [x, y, z, sx, sy, sz, rx, ry, rz, material] = values;
    positive(Math.abs(sx), `${label} X 半径`);
    positive(Math.abs(sy), `${label} Y 半径`);
    positive(Math.abs(sz), `${label} Z 半径`);
    integer(material, 0, materialCount - 1, `${label} 材质索引`);
    return { center: [x, y, z], radius: [sx, sy, sz], rotation: [rx, ry, rz], material };
  });
  if (result.length > MAX_DETAILS) throw new Error(`${label} 最多允许 ${MAX_DETAILS} 条记录`);
  return result;
}

export function parseScore(text) {
  if (typeof text !== 'string') throw new Error('谱子必须是文本');
  const score = text.trim();
  if (!score.startsWith('K5|')) throw new Error('当前哺乳四足乐器只接受 K5 谱');
  if (score.length > MAX_SCORE_LENGTH) throw new Error(`谱子不得超过 ${MAX_SCORE_LENGTH} 个字符`);
  const segments = score.split('|');
  if (segments[0] !== 'K5') throw new Error('谱头必须为 K5');
  const sections = new Map();
  for (let index = 1; index < segments.length; index += 1) {
    const segment = segments[index];
    if (!segment) throw new Error('谱子中不能出现空段');
    const tag = segment[0];
    if (!CONTRACT.requiredSections.includes(tag) && !CONTRACT.optionalSections.includes(tag)) throw new Error(`未知谱段 ${tag}`);
    if (sections.has(tag)) throw new Error(`谱段 ${tag} 不能重复`);
    sections.set(tag, segment.slice(1));
  }
  for (const tag of CONTRACT.requiredSections) if (!sections.has(tag)) throw new Error(`缺少必需谱段 ${tag}`);

  const materials = parseMaterials(sections.get('M'));
  const [bodyLength, shoulderHeight, hipHeight, frontStanceWidth, hindStanceWidth, overallBulk] = numbers(sections.get('G'), 6, 'G');
  inRange(bodyLength, 0.16, 2.2, '身体长度');
  inRange(shoulderHeight, 0.08, 1.45, '肩高');
  inRange(hipHeight, 0.08, 1.45, '髋高');
  inRange(frontStanceWidth, 0.025, 0.85, '前足站距');
  inRange(hindStanceWidth, 0.025, 0.85, '后足站距');
  inRange(overallBulk, 0.55, 1.8, '整体体量');

  const torsoValues = numbers(sections.get('B'), 12, 'B');
  torsoValues.slice(0, 9).forEach((value, index) => positive(value, `B[${index}]`));
  inRange(torsoValues[9], 0, 0.25, '腹线收束');
  inRange(torsoValues[10], -0.12, 0.18, '背线弧度');
  inRange(torsoValues[11], 0, 0.16, '胸腹下缘');
  const [pelvisLength, lumbarLength, thoraxLength, pelvisWidth, lumbarWidth, thoraxWidth, pelvisDepth, lumbarDepth, thoraxDepth, abdomenTuck, dorsalArc, ventralSag] = torsoValues;

  const neckValues = numbers(sections.get('N'), 6, 'N');
  neckValues.slice(0, 5).forEach((value, index) => positive(value, `N[${index}]`));
  inRange(neckValues[5], -15, 75, '颈部抬角');
  const [neckLength, neckBaseWidth, neckHeadWidth, neckBaseDepth, neckHeadDepth, neckPitchDeg] = neckValues;

  const headValues = numbers(sections.get('C'), 10, 'C');
  headValues.forEach((value, index) => positive(value, `C[${index}]`));
  const [cranialLength, headWidth, headHeight, muzzleLength, muzzleWidth, muzzleHeight, jawDepth, eyeSpacing, eyeRadius, cheekDepth] = headValues;

  const foreValues = numbers(sections.get('F'), 15, 'F');
  const [shoulderLongitudinal, scapulaLength, humerusLength, radiusLength, metacarpalLength, foreUpperLateral, foreUpperSagittal, foreLowerLateral, foreLowerSagittal, wristLateral, wristSagittal, humerusBackDeg, radiusForwardDeg, metacarpalForwardDeg, shoulderDrop] = foreValues;
  [scapulaLength, humerusLength, radiusLength, metacarpalLength, foreUpperLateral, foreUpperSagittal, foreLowerLateral, foreLowerSagittal, wristLateral, wristSagittal].forEach((value, index) => positive(value, `F 长度/半径[${index}]`));
  [humerusBackDeg, radiusForwardDeg, metacarpalForwardDeg].forEach((value, index) => inRange(value, -35, 70, `F 角度[${index}]`));
  inRange(shoulderDrop, -0.15, 0.20, '肩关节下沉');

  const hindValues = numbers(sections.get('H'), 14, 'H');
  const [hipLongitudinal, femurLength, tibiaLength, tarsusLength, hindUpperLateral, hindUpperSagittal, hindLowerLateral, hindLowerSagittal, hockLateral, hockSagittal, femurForwardDeg, tibiaBackDeg, tarsusForwardDeg, hipDrop] = hindValues;
  [femurLength, tibiaLength, tarsusLength, hindUpperLateral, hindUpperSagittal, hindLowerLateral, hindLowerSagittal, hockLateral, hockSagittal].forEach((value, index) => positive(value, `H 长度/半径[${index}]`));
  [femurForwardDeg, tibiaBackDeg, tarsusForwardDeg].forEach((value, index) => inRange(value, -15, 85, `H 角度[${index}]`));
  inRange(hipDrop, -0.15, 0.20, '髋关节下沉');

  const pawValues = numbers(sections.get('P'), 10, 'P');
  const [forePawLength, forePawWidth, hindPawLength, hindPawWidth, pawHeight, toeSplay, toeCount, clawLength, padMaterial, clawMaterial] = pawValues;
  [forePawLength, forePawWidth, hindPawLength, hindPawWidth, pawHeight].forEach((value, index) => positive(value, `P 尺寸[${index}]`));
  inRange(toeSplay, 0, 0.12, '趾展');
  integer(toeCount, 3, 5, '趾数量');
  inRange(clawLength, 0, 0.08, '爪长');
  integer(padMaterial, 0, materials.length - 1, '足垫材质');
  integer(clawMaterial, 0, materials.length - 1, '爪材质');

  let tail = null;
  if (sections.has('T')) {
    const values = numbers(sections.get('T'), 7, 'T');
    const [length, baseRadius, tipRadius, lift, curl, lateral, segmentsCount] = values;
    positive(length, '尾长'); positive(baseRadius, '尾根半径'); positive(tipRadius, '尾端半径');
    inRange(lift, -0.7, 0.7, '尾部抬升'); inRange(curl, -0.8, 0.8, '尾部弯曲'); inRange(lateral, -0.5, 0.5, '尾部侧摆');
    integer(segmentsCount, 6, 64, '尾段数');
    tail = { length, baseRadius, tipRadius, lift, curl, lateral, segments: segmentsCount };
  }

  const ears = records(sections.get('E') ?? '', 12, 'E').map((values) => {
    const [x, y, z, width, height, depth, yaw, pitch, roll, outerMaterial, innerMaterial, curve] = values;
    if (x < 0) throw new Error('E 的 X 必须为非负值，另一侧由乐器镜像');
    [width, height, depth].forEach((value, index) => positive(value, `E 尺寸[${index}]`));
    [yaw, pitch, roll].forEach((value, index) => inRange(value, -90, 90, `E 角度[${index}]`));
    integer(outerMaterial, 0, materials.length - 1, 'E 外层材质'); integer(innerMaterial, 0, materials.length - 1, 'E 内层材质');
    inRange(curve, -1, 1, 'E 弯曲');
    return { center: [x, y, z], width, height, depth, rotation: [pitch, yaw, roll], outerMaterial, innerMaterial, curve };
  });
  if (ears.length > MAX_EARS) throw new Error(`E 最多允许 ${MAX_EARS} 条记录`);

  const symmetricDetails = parseDetails(sections.get('S') ?? '', 'S', materials.length);
  const centralDetails = parseDetails(sections.get('D') ?? '', 'D', materials.length);

  let coat = { mode: 0, baseMaterial: 0, dorsalMaterial: 0, ventralMaterial: 0, accentMaterial: 0, frequency: 4, contrast: 0, dorsalStrength: 0, legBands: 4, tailBands: 6, seed: 1 };
  if (sections.has('A')) {
    const values = numbers(sections.get('A'), 11, 'A');
    const [mode, baseMaterial, dorsalMaterial, ventralMaterial, accentMaterial, frequency, contrast, dorsalStrength, legBands, tailBands, seed] = values;
    integer(mode, 0, 3, 'A 图案模式');
    for (const [value, label] of [[baseMaterial, '基础'], [dorsalMaterial, '背部'], [ventralMaterial, '腹部'], [accentMaterial, '强调']]) integer(value, 0, materials.length - 1, `A ${label}材质`);
    inRange(frequency, 0, 24, 'A 频率'); inRange(contrast, 0, 1, 'A 对比'); inRange(dorsalStrength, 0, 1, 'A 背部深度');
    inRange(legBands, 0, 20, 'A 肢带频率'); inRange(tailBands, 0, 28, 'A 尾带频率'); integer(seed, 0, 1000000, 'A 种子');
    coat = { mode, baseMaterial, dorsalMaterial, ventralMaterial, accentMaterial, frequency, contrast, dorsalStrength, legBands, tailBands, seed };
  }

  let relief = { amplitude: 0, frequency: 50, seed: 1 };
  if (sections.has('R')) {
    const values = numbers(sections.get('R'), 3, 'R');
    inRange(values[0], 0, 0.008, 'R 表面微形态幅度'); inRange(values[1], 1, 220, 'R 表面微形态频率'); integer(values[2], 0, 1000000, 'R 种子');
    relief = { amplitude: values[0], frequency: values[1], seed: values[2] };
  }

  let whiskers = null;
  if (sections.has('W')) {
    const values = numbers(sections.get('W'), 6, 'W');
    const [count, length, splay, curve, material, seed] = values;
    integer(count, 0, MAX_WHISKERS, 'W 每侧数量'); inRange(length, 0.01, 0.32, 'W 长度'); inRange(splay, 0, 1.4, 'W 展开'); inRange(curve, -1, 1, 'W 弯曲');
    integer(material, 0, materials.length - 1, 'W 材质'); integer(seed, 0, 1000000, 'W 种子');
    whiskers = { count, length, splay, curve, material, seed };
  }

  return {
    version: 'K5', text: score, materials,
    global: { bodyLength, shoulderHeight, hipHeight, frontStanceWidth, hindStanceWidth, overallBulk },
    torso: { pelvisLength, lumbarLength, thoraxLength, pelvisWidth, lumbarWidth, thoraxWidth, pelvisDepth, lumbarDepth, thoraxDepth, abdomenTuck, dorsalArc, ventralSag },
    neck: { length: neckLength, baseWidth: neckBaseWidth, headWidth: neckHeadWidth, baseDepth: neckBaseDepth, headDepth: neckHeadDepth, pitchDeg: neckPitchDeg },
    head: { cranialLength, width: headWidth, height: headHeight, muzzleLength, muzzleWidth, muzzleHeight, jawDepth, eyeSpacing, eyeRadius, cheekDepth },
    forelimb: { shoulderLongitudinal, scapulaLength, humerusLength, radiusLength, metacarpalLength, upperLateral: foreUpperLateral, upperSagittal: foreUpperSagittal, lowerLateral: foreLowerLateral, lowerSagittal: foreLowerSagittal, wristLateral, wristSagittal, humerusBackDeg, radiusForwardDeg, metacarpalForwardDeg, jointDrop: shoulderDrop },
    hindlimb: { hipLongitudinal, femurLength, tibiaLength, tarsusLength, upperLateral: hindUpperLateral, upperSagittal: hindUpperSagittal, lowerLateral: hindLowerLateral, lowerSagittal: hindLowerSagittal, hockLateral, hockSagittal, femurForwardDeg, tibiaBackDeg, tarsusForwardDeg, jointDrop: hipDrop },
    paws: { foreLength: forePawLength, foreWidth: forePawWidth, hindLength: hindPawLength, hindWidth: hindPawWidth, height: pawHeight, toeSplay, toeCount, clawLength, padMaterial, clawMaterial },
    tail, ears, symmetricDetails, centralDetails, coat, relief, whiskers,
  };
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hashNoise(x, y, z, seed) {
  const value = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 0.013) * 43758.5453;
  return value - Math.floor(value);
}

function smoothMin(a, b, k) {
  if (!Number.isFinite(a)) return b;
  if (!Number.isFinite(b)) return a;
  const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1);
  return mix(b, a, h) - k * h * (1 - h);
}

function ellipsoidSdf(x, y, z, center, radii) {
  const px = x - center[0];
  const py = y - center[1];
  const pz = z - center[2];
  const [rx, ry, rz] = radii;
  const k0 = Math.hypot(px / rx, py / ry, pz / rz);
  if (k0 < 1e-9) return -Math.min(rx, ry, rz);
  const k1 = Math.hypot(px / (rx * rx), py / (ry * ry), pz / (rz * rz));
  return k0 * (k0 - 1) / Math.max(k1, 1e-9);
}

function taperedCapsuleSdf(x, y, z, a, b, r0, r1) {
  const ax = a[0]; const ay = a[1]; const az = a[2];
  const bx = b[0]; const by = b[1]; const bz = b[2];
  const abx = bx - ax; const aby = by - ay; const abz = bz - az;
  const apx = x - ax; const apy = y - ay; const apz = z - az;
  const lengthSq = abx * abx + aby * aby + abz * abz;
  const h = lengthSq > 1e-12 ? clamp((apx * abx + apy * aby + apz * abz) / lengthSq, 0, 1) : 0;
  const cx = ax + abx * h; const cy = ay + aby * h; const cz = az + abz * h;
  return Math.hypot(x - cx, y - cy, z - cz) - mix(r0, r1, h);
}

function taperedEllipticCapsuleSdf(x, y, z, a, b, lateral0, lateral1, sagittal0, sagittal1) {
  const ax = a[0]; const ay = a[1]; const az = a[2];
  const bx = b[0]; const by = b[1]; const bz = b[2];
  const abz = bz - az; const aby = by - ay;
  const lengthSq = abz * abz + aby * aby;
  const apz = z - az; const apy = y - ay;
  const h = lengthSq > 1e-12 ? clamp((apz * abz + apy * aby) / lengthSq, 0, 1) : 0;
  const cy = ay + aby * h; const cz = az + abz * h;
  const qx = x - mix(ax, bx, h); const qy = y - cy; const qz = z - cz;
  const length = Math.sqrt(lengthSq) || 1;
  const uy = aby / length; const uz = abz / length;
  const vy = -uz; const vz = uy;
  const lateral = Math.max(1e-5, mix(lateral0, lateral1, h));
  const sagittal = Math.max(1e-5, mix(sagittal0, sagittal1, h));
  const cap = Math.min(lateral, sagittal);
  const qLat = qx;
  const qSag = qy * vy + qz * vz;
  const qAx = qy * uy + qz * uz;
  return (Math.hypot(qLat / lateral, qSag / sagittal, qAx / cap) - 1) * cap;
}

function solvePlanarTwoBone(root, end, length1, length2, bendSign) {
  const dz = end[2] - root[2];
  const dy = end[1] - root[1];
  const distance = Math.max(1e-8, Math.hypot(dz, dy));
  const clamped = clamp(distance, Math.abs(length1 - length2) + 1e-6, length1 + length2 - 1e-6);
  const uz = dz / distance; const uy = dy / distance;
  const projectedEnd = [root[0], root[1] + uy * clamped, root[2] + uz * clamped];
  const along = (length1 * length1 - length2 * length2 + clamped * clamped) / (2 * clamped);
  const height = Math.sqrt(Math.max(0, length1 * length1 - along * along));
  const py = -uz; const pz = uy;
  return {
    middle: [root[0], root[1] + uy * along + py * height * bendSign, root[2] + uz * along + pz * height * bendSign],
    end: projectedEnd,
    reachCorrection: Math.abs(distance - clamped),
  };
}

export function deriveSkeleton(specOrText) {
  const spec = typeof specOrText === 'string' ? parseScore(specOrText) : specOrText;
  const g = spec.global; const t = spec.torso; const n = spec.neck; const h = spec.head; const f = spec.forelimb; const hind = spec.hindlimb; const p = spec.paws;
  const pawY = p.height * 0.5;
  const pelvisZ = -g.bodyLength * 0.22;
  const lumbarZ = -g.bodyLength * 0.035;
  const thoraxZ = g.bodyLength * 0.16;
  const pelvisY = g.hipHeight - t.pelvisDepth * 0.49;
  const thoraxY = g.shoulderHeight - t.thoraxDepth * 0.48;
  const shoulderJointY = thoraxY + t.thoraxDepth * 0.12 - f.jointDrop;
  const hipJointY = pelvisY + t.pelvisDepth * 0.10 - hind.jointDrop;
  const pitch = n.pitchDeg * DEG;
  const neckBase = [0, thoraxY + t.thoraxDepth * 0.42, thoraxZ + t.thoraxLength * 0.62];
  const neckTip = [0, neckBase[1] + Math.sin(pitch) * n.length, neckBase[2] + Math.cos(pitch) * n.length];
  const head = [0, neckTip[1] + h.height * 0.03, neckTip[2] + h.cranialLength * 0.02];
  const muzzle = [0, head[1] - h.height * 0.10, head[2] + h.cranialLength * 0.38 + h.muzzleLength * 0.42];
  const anchors = {
    pelvis: [0, pelvisY, pelvisZ],
    lumbar: [0, mix(pelvisY, thoraxY, 0.48) + t.dorsalArc, lumbarZ],
    thorax: [0, thoraxY, thoraxZ],
    neckBase, neckTip, head, muzzle,
    tailRoot: [0, pelvisY + t.pelvisDepth * 0.16, pelvisZ - t.pelvisLength * 0.49],
  };

  for (const side of [-1, 1]) {
    const foreLengths = [f.humerusLength, f.radiusLength, f.metacarpalLength];
    const foreOffset = -Math.sin(f.humerusBackDeg * DEG) * foreLengths[0] + Math.sin(f.radiusForwardDeg * DEG) * foreLengths[1] + Math.sin(f.metacarpalForwardDeg * DEG) * foreLengths[2];
    const shoulder = [side * g.frontStanceWidth * 0.5, shoulderJointY, f.shoulderLongitudinal];
    const forePaw = [shoulder[0], pawY, shoulder[2] + foreOffset];
    const metaAngle = f.metacarpalForwardDeg * DEG;
    const wristTarget = [shoulder[0], forePaw[1] + Math.cos(metaAngle) * foreLengths[2], forePaw[2] - Math.sin(metaAngle) * foreLengths[2]];
    const foreSolve = solvePlanarTwoBone(shoulder, wristTarget, foreLengths[0], foreLengths[1], -1);

    const hindLengths = [hind.femurLength, hind.tibiaLength, hind.tarsusLength];
    const hindOffset = Math.sin(hind.femurForwardDeg * DEG) * hindLengths[0] - Math.sin(hind.tibiaBackDeg * DEG) * hindLengths[1] + Math.sin(hind.tarsusForwardDeg * DEG) * hindLengths[2];
    const hip = [side * g.hindStanceWidth * 0.5, hipJointY, hind.hipLongitudinal];
    const hindPaw = [hip[0], pawY, hip[2] + hindOffset];
    const tarsusAngle = hind.tarsusForwardDeg * DEG;
    const hockTarget = [hip[0], hindPaw[1] + Math.cos(tarsusAngle) * hindLengths[2], hindPaw[2] - Math.sin(tarsusAngle) * hindLengths[2]];
    const hindSolve = solvePlanarTwoBone(hip, hockTarget, hindLengths[0], hindLengths[1], 1);

    anchors[`shoulder${side}`] = shoulder;
    anchors[`elbow${side}`] = foreSolve.middle;
    anchors[`wrist${side}`] = foreSolve.end;
    anchors[`forePaw${side}`] = forePaw;
    anchors[`hip${side}`] = hip;
    anchors[`stifle${side}`] = hindSolve.middle;
    anchors[`hock${side}`] = hindSolve.end;
    anchors[`hindPaw${side}`] = hindPaw;
    anchors[`foreReachCorrection${side}`] = foreSolve.reachCorrection;
    anchors[`hindReachCorrection${side}`] = hindSolve.reachCorrection;
  }
  return { spec, anchors };
}

function deriveTorsoSections(spec, anchors) {
  const g = spec.global; const t = spec.torso; const n = spec.neck;
  const bulk = g.overallBulk;
  const pelvisZ = anchors.pelvis[2]; const thoraxZ = anchors.thorax[2];
  const yPelvis = anchors.pelvis[1] + t.dorsalArc * 0.20;
  const yThorax = anchors.thorax[1] + t.dorsalArc;
  const yLumbar = anchors.lumbar[1] + t.dorsalArc * 0.65;
  return [
    { z: pelvisZ - t.pelvisLength * 0.50, y: yPelvis - 0.004, rx: t.pelvisWidth * 0.34 * bulk, ry: t.pelvisDepth * 0.36 * bulk },
    { z: pelvisZ - t.pelvisLength * 0.24, y: yPelvis - 0.001, rx: t.pelvisWidth * 0.47 * bulk, ry: t.pelvisDepth * 0.48 * bulk },
    { z: pelvisZ, y: yPelvis, rx: t.pelvisWidth * 0.50 * bulk, ry: t.pelvisDepth * 0.50 * bulk },
    { z: mix(pelvisZ, anchors.lumbar[2], 0.58), y: mix(yPelvis, yLumbar, 0.58), rx: mix(t.pelvisWidth * 0.48, t.lumbarWidth * 0.50, 0.64) * bulk, ry: mix(t.pelvisDepth * 0.46, t.lumbarDepth * 0.50, 0.64) * bulk },
    { z: anchors.lumbar[2], y: yLumbar - t.abdomenTuck * 0.08, rx: t.lumbarWidth * 0.50 * bulk, ry: (t.lumbarDepth + t.ventralSag * 0.28) * 0.50 * bulk },
    { z: mix(anchors.lumbar[2], thoraxZ, 0.46), y: mix(yLumbar, yThorax, 0.46), rx: mix(t.lumbarWidth * 0.52, t.thoraxWidth * 0.48, 0.58) * bulk, ry: mix(t.lumbarDepth * 0.49, t.thoraxDepth * 0.48, 0.58) * bulk },
    { z: thoraxZ - t.thoraxLength * 0.18, y: yThorax, rx: t.thoraxWidth * 0.48 * bulk, ry: t.thoraxDepth * 0.48 * bulk },
    { z: thoraxZ + t.thoraxLength * 0.16, y: yThorax + t.dorsalArc * 0.08, rx: t.thoraxWidth * 0.46 * bulk, ry: t.thoraxDepth * 0.46 * bulk },
    { z: thoraxZ + t.thoraxLength * 0.38, y: yThorax + t.dorsalArc * 0.11, rx: n.baseWidth * 0.43 * bulk, ry: n.baseDepth * 0.42 * bulk },
    { z: anchors.neckBase[2], y: anchors.neckBase[1] - n.baseDepth * 0.12, rx: n.baseWidth * 0.39 * bulk, ry: n.baseDepth * 0.38 * bulk },
  ];
}

function continuousTorsoSdf(x, y, z, sections) {
  const first = sections[0]; const last = sections.at(-1);
  const clampedZ = clamp(z, first.z, last.z);
  let a = first; let b = sections[1];
  for (let index = 0; index < sections.length - 1; index += 1) {
    if (clampedZ >= sections[index].z && clampedZ <= sections[index + 1].z) { a = sections[index]; b = sections[index + 1]; break; }
  }
  const span = Math.max(1e-6, b.z - a.z);
  const t = smooth01((clampedZ - a.z) / span);
  const centerY = mix(a.y, b.y, t);
  const rx = mix(a.rx, b.rx, t);
  const ry = mix(a.ry, b.ry, t);
  const capRadius = z < first.z ? Math.max(first.rx, first.ry) * 0.8 : z > last.z ? Math.max(last.rx, last.ry) * 0.82 : 1e6;
  const dz = z - clampedZ;
  const localRy = y >= centerY ? ry * 0.91 : ry * 1.09;
  const lateral = Math.abs(x / rx);
  const vertical = Math.abs((y - centerY) / localRy);
  const q = Math.pow(Math.pow(lateral, 2.15) + Math.pow(vertical, 2.15) + Math.pow(Math.abs(dz / capRadius), 2.15), 1 / 2.15) - 1;
  return q * Math.min(rx, localRy, capRadius);
}

function cubicBezier(a, b, c, d, t) {
  const u = 1 - t; const w0 = u * u * u; const w1 = 3 * u * u * t; const w2 = 3 * u * t * t; const w3 = t * t * t;
  return [a[0] * w0 + b[0] * w1 + c[0] * w2 + d[0] * w3, a[1] * w0 + b[1] * w1 + c[1] * w2 + d[1] * w3, a[2] * w0 + b[2] * w1 + c[2] * w2 + d[2] * w3];
}

function deriveTailPoints(spec, anchors) {
  if (!spec.tail) return [];
  const root = anchors.tailRoot; const tail = spec.tail; const length = tail.length;
  const p1 = [tail.lateral * 0.24, root[1] - 0.024 + tail.lift * 0.18, root[2] - length * 0.22];
  const p2 = [tail.lateral * 0.70, root[1] - 0.036 + tail.lift * 0.62 + tail.curl * 0.14, root[2] - length * 0.64];
  const p3 = [tail.lateral, root[1] + tail.lift + tail.curl * 0.24, root[2] - length];
  const points = [];
  for (let index = 0; index <= tail.segments; index += 1) points.push(cubicBezier(root, p1, p2, p3, index / tail.segments));
  return points;
}

function createMammalSdf(spec, anchors) {
  const sections = deriveTorsoSections(spec, anchors);
  const tailPoints = deriveTailPoints(spec, anchors);
  const g = spec.global; const t = spec.torso; const n = spec.neck; const head = spec.head; const f = spec.forelimb; const h = spec.hindlimb; const p = spec.paws;
  const blendBase = clamp(g.bodyLength * 0.018, 0.004, 0.025);
  return (x, y, z) => {
    let d = continuousTorsoSdf(x, y, z, sections);
    d = smoothMin(d, taperedEllipticCapsuleSdf(x, y, z, anchors.neckBase, anchors.neckTip, n.baseWidth * 0.29, n.headWidth * 0.27, n.baseDepth * 0.32, n.headDepth * 0.29), blendBase * 0.8);
    const braincase = [0, anchors.head[1] + head.height * 0.035, anchors.head[2] - head.cranialLength * 0.045];
    const facialCenter = [0, anchors.head[1] - head.height * 0.035, anchors.head[2] + head.cranialLength * 0.24];
    d = smoothMin(d, ellipsoidSdf(x, y, z, braincase, [head.width * 0.46, head.height * 0.40, head.cranialLength * 0.42]), blendBase * 0.85);
    d = smoothMin(d, ellipsoidSdf(x, y, z, facialCenter, [head.width * 0.36, head.height * 0.29, head.cranialLength * 0.25]), blendBase * 0.56);
    d = smoothMin(d, ellipsoidSdf(x, y, z, anchors.muzzle, [head.muzzleWidth * 0.44, head.muzzleHeight * 0.41, head.muzzleLength * 0.76]), blendBase * 0.42);
    d = smoothMin(d, ellipsoidSdf(x, y, z, [0, anchors.muzzle[1] - head.jawDepth * 0.36, anchors.muzzle[2] - head.muzzleLength * 0.10], [head.muzzleWidth * 0.36, head.jawDepth * 0.40, head.muzzleLength * 0.58]), blendBase * 0.36);

    for (const side of [-1, 1]) {
      const cheek = [side * head.width * 0.21, anchors.head[1] - head.height * 0.09, anchors.head[2] + head.cranialLength * 0.19];
      d = smoothMin(d, ellipsoidSdf(x, y, z, cheek, [head.cheekDepth * 0.68, head.height * 0.17, head.cranialLength * 0.18]), blendBase * 0.32);

      const shoulder = anchors[`shoulder${side}`]; const elbow = anchors[`elbow${side}`]; const wrist = anchors[`wrist${side}`]; const forePaw = anchors[`forePaw${side}`];
      const scapulaOrigin = [side * t.thoraxWidth * 0.24, anchors.thorax[1] + t.thoraxDepth * 0.25, anchors.thorax[2] - f.scapulaLength * 0.38];
      d = smoothMin(d, taperedEllipticCapsuleSdf(x, y, z, scapulaOrigin, shoulder, f.upperLateral * 0.66, f.upperLateral * 0.70, f.upperSagittal * 0.88, f.upperSagittal * 0.82), blendBase * 0.34);
      d = smoothMin(d, taperedEllipticCapsuleSdf(x, y, z, shoulder, elbow, f.upperLateral * 0.82, f.lowerLateral * 0.76, f.upperSagittal * 1.04, f.lowerSagittal * 0.96), blendBase * 0.50);
      d = smoothMin(d, ellipsoidSdf(x, y, z, elbow, [f.lowerLateral * 0.82, f.lowerSagittal * 0.88, f.lowerSagittal * 0.74]), blendBase * 0.18);
      d = smoothMin(d, taperedEllipticCapsuleSdf(x, y, z, elbow, wrist, f.lowerLateral * 0.72, f.wristLateral * 0.76, f.lowerSagittal * 0.96, f.wristSagittal * 0.92), blendBase * 0.34);
      d = smoothMin(d, taperedEllipticCapsuleSdf(x, y, z, wrist, forePaw, f.wristLateral * 0.70, f.wristLateral * 0.54, f.wristSagittal * 0.84, f.wristSagittal * 0.58), blendBase * 0.24);
      const forePawCenter = [forePaw[0], p.height * 0.43, forePaw[2] + p.foreLength * 0.19];
      d = smoothMin(d, ellipsoidSdf(x, y, z, forePawCenter, [(p.foreWidth + p.toeSplay) * 0.45, p.height * 0.37, p.foreLength * 0.43]), blendBase * 0.22);
      for (let toeIndex = 0; toeIndex < p.toeCount; toeIndex += 1) {
        const offset = toeIndex - (p.toeCount - 1) / 2;
        const toeCenter = [forePaw[0] + offset * (p.foreWidth + p.toeSplay) * 0.185, p.height * 0.36, forePaw[2] + p.foreLength * (0.55 - Math.abs(offset) * 0.010)];
        d = smoothMin(d, ellipsoidSdf(x, y, z, toeCenter, [p.foreWidth * 0.105, p.height * 0.22, p.foreLength * 0.15]), blendBase * 0.055);
      }

      const hip = anchors[`hip${side}`]; const stifle = anchors[`stifle${side}`]; const hock = anchors[`hock${side}`]; const hindPaw = anchors[`hindPaw${side}`];
      const gluteal = [hip[0], anchors.pelvis[1] + t.pelvisDepth * 0.08, anchors.pelvis[2] - t.pelvisLength * 0.035];
      d = smoothMin(d, ellipsoidSdf(x, y, z, gluteal, [h.upperLateral * 0.78, h.upperSagittal * 0.62, h.femurLength * 0.12]), blendBase * 0.34);
      d = smoothMin(d, taperedEllipticCapsuleSdf(x, y, z, hip, stifle, h.upperLateral * 0.88, h.lowerLateral * 0.78, h.upperSagittal * 1.16, h.lowerSagittal * 1.06), blendBase * 0.50);
      d = smoothMin(d, ellipsoidSdf(x, y, z, stifle, [h.lowerLateral * 0.90, h.lowerSagittal * 0.96, h.lowerSagittal * 0.76]), blendBase * 0.20);
      d = smoothMin(d, taperedEllipticCapsuleSdf(x, y, z, stifle, hock, h.lowerLateral * 0.78, h.hockLateral * 0.78, h.lowerSagittal * 1.04, h.hockSagittal * 0.92), blendBase * 0.34);
      d = smoothMin(d, taperedEllipticCapsuleSdf(x, y, z, hock, hindPaw, h.hockLateral * 0.70, h.hockLateral * 0.54, h.hockSagittal * 0.92, h.hockSagittal * 0.60), blendBase * 0.24);
      const hindPawCenter = [hindPaw[0], p.height * 0.43, hindPaw[2] + p.hindLength * 0.20];
      d = smoothMin(d, ellipsoidSdf(x, y, z, hindPawCenter, [(p.hindWidth + p.toeSplay) * 0.45, p.height * 0.37, p.hindLength * 0.44]), blendBase * 0.22);
      for (let toeIndex = 0; toeIndex < p.toeCount; toeIndex += 1) {
        const offset = toeIndex - (p.toeCount - 1) / 2;
        const toeCenter = [hindPaw[0] + offset * (p.hindWidth + p.toeSplay) * 0.185, p.height * 0.36, hindPaw[2] + p.hindLength * (0.56 - Math.abs(offset) * 0.010)];
        d = smoothMin(d, ellipsoidSdf(x, y, z, toeCenter, [p.hindWidth * 0.105, p.height * 0.22, p.hindLength * 0.15]), blendBase * 0.055);
      }
    }

    if (tailPoints.length > 1) {
      for (let index = 0; index < tailPoints.length - 1; index += 1) {
        const t0 = index / (tailPoints.length - 1); const t1 = (index + 1) / (tailPoints.length - 1);
        d = smoothMin(d, taperedCapsuleSdf(x, y, z, tailPoints[index], tailPoints[index + 1], mix(spec.tail.baseRadius, spec.tail.tipRadius, t0), mix(spec.tail.baseRadius, spec.tail.tipRadius, t1)), blendBase * (index < 3 ? 0.60 : 0.44));
      }
    }
    if (spec.relief.amplitude > 0) {
      const frequency = spec.relief.frequency;
      const micro = (hashNoise(x * frequency, y * frequency, z * frequency, spec.relief.seed) - 0.5) * 2;
      d -= micro * spec.relief.amplitude;
    }
    return d;
  };
}

function computeBounds(spec, anchors) {
  const box = new THREE.Box3();
  const include = (center, radius) => {
    box.expandByPoint(V3(center[0] - radius[0], center[1] - radius[1], center[2] - radius[2]));
    box.expandByPoint(V3(center[0] + radius[0], center[1] + radius[1], center[2] + radius[2]));
  };
  const t = spec.torso; const n = spec.neck; const h = spec.head; const f = spec.forelimb; const hind = spec.hindlimb; const p = spec.paws;
  include(anchors.pelvis, [t.pelvisWidth, t.pelvisDepth, t.pelvisLength]);
  include(anchors.thorax, [t.thoraxWidth, t.thoraxDepth, t.thoraxLength]);
  include(anchors.head, [h.width, h.height, h.cranialLength + h.muzzleLength]);
  include(anchors.neckBase, [n.baseWidth, n.baseDepth, n.length]);
  for (const side of [-1, 1]) {
    for (const key of ['shoulder', 'elbow', 'wrist']) include(anchors[`${key}${side}`], [f.upperLateral * 1.5, f.upperSagittal * 1.5, f.upperSagittal * 1.5]);
    include(anchors[`forePaw${side}`], [p.foreWidth, p.height, p.foreLength]);
    for (const key of ['hip', 'stifle', 'hock']) include(anchors[`${key}${side}`], [hind.upperLateral * 1.5, hind.upperSagittal * 1.5, hind.upperSagittal * 1.5]);
    include(anchors[`hindPaw${side}`], [p.hindWidth, p.height, p.hindLength]);
  }
  for (const point of deriveTailPoints(spec, anchors)) include(point, [spec.tail.baseRadius, spec.tail.baseRadius, spec.tail.baseRadius]);
  box.expandByScalar(Math.max(0.04, spec.global.bodyLength * 0.04));
  return box;
}

function makeGeometry(positions, indices = null, normals = null, colors = null) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (indices) geometry.setIndex(indices);
  if (normals) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); else geometry.computeVertexNormals();
  if (colors) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

function polygonize(spec, anchors) {
  const sdf = createMammalSdf(spec, anchors);
  const bounds = computeBounds(spec, anchors);
  const size = bounds.getSize(new THREE.Vector3());
  let step = clamp(Math.max(size.x, size.y, size.z) / 104, MIN_SURFACE_STEP, MAX_SURFACE_STEP);
  let nx = Math.ceil(size.x / step) + 1; let ny = Math.ceil(size.y / step) + 1; let nz = Math.ceil(size.z / step) + 1;
  while (nx * ny * nz > MAX_GRID_POINTS) {
    step *= 1.08;
    nx = Math.ceil(size.x / step) + 1; ny = Math.ceil(size.y / step) + 1; nz = Math.ceil(size.z / step) + 1;
  }
  const sx = size.x / (nx - 1); const sy = size.y / (ny - 1); const sz = size.z / (nz - 1);
  const total = nx * ny * nz;
  const field = new Float32Array(total); const gradient = new Float32Array(total * 3); const min = bounds.min;
  for (let z = 0; z < nz; z += 1) for (let y = 0; y < ny; y += 1) for (let x = 0; x < nx; x += 1) field[x + nx * (y + ny * z)] = sdf(min.x + x * sx, min.y + y * sy, min.z + z * sz);
  for (let z = 1; z < nz - 1; z += 1) for (let y = 1; y < ny - 1; y += 1) for (let x = 1; x < nx - 1; x += 1) {
    const index = x + nx * (y + ny * z);
    gradient[index * 3] = (field[index + 1] - field[index - 1]) / (2 * sx);
    gradient[index * 3 + 1] = (field[index + nx] - field[index - nx]) / (2 * sy);
    gradient[index * 3 + 2] = (field[index + nx * ny] - field[index - nx * ny]) / (2 * sz);
  }
  const offsets = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
  const tetrahedra = [[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
  const positions = []; const normals = [];
  const interpolate = (a, b) => {
    const da = field[a[0]]; const db = field[b[0]]; const t = da / (da - db);
    const p = [a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2]), a[3] + t * (b[3] - a[3])];
    const g = [gradient[a[0] * 3] + t * (gradient[b[0] * 3] - gradient[a[0] * 3]), gradient[a[0] * 3 + 1] + t * (gradient[b[0] * 3 + 1] - gradient[a[0] * 3 + 1]), gradient[a[0] * 3 + 2] + t * (gradient[b[0] * 3 + 2] - gradient[a[0] * 3 + 2])];
    const length = Math.hypot(...g) || 1;
    return [p, g.map((value) => value / length)];
  };
  const emit = (a, b, c) => {
    const ab = [b[0][0] - a[0][0], b[0][1] - a[0][1], b[0][2] - a[0][2]];
    const ac = [c[0][0] - a[0][0], c[0][1] - a[0][1], c[0][2] - a[0][2]];
    const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    if (cross[0] * a[1][0] + cross[1] * a[1][1] + cross[2] * a[1][2] < 0) [b, c] = [c, b];
    for (const vertex of [a, b, c]) { positions.push(...vertex[0]); normals.push(...vertex[1]); }
  };
  for (let z = 0; z < nz - 1; z += 1) for (let y = 0; y < ny - 1; y += 1) for (let x = 0; x < nx - 1; x += 1) {
    const cube = offsets.map(([ox, oy, oz]) => [x + ox + nx * (y + oy + ny * (z + oz)), min.x + (x + ox) * sx, min.y + (y + oy) * sy, min.z + (z + oz) * sz]);
    let insideCount = 0; for (const corner of cube) if (field[corner[0]] < 0) insideCount += 1;
    if (insideCount === 0 || insideCount === 8) continue;
    for (const tetrahedron of tetrahedra) {
      const inside = []; const outside = [];
      for (const cornerIndex of tetrahedron) (field[cube[cornerIndex][0]] < 0 ? inside : outside).push(cube[cornerIndex]);
      if (!inside.length || !outside.length) continue;
      if (inside.length === 1) emit(...outside.map((corner) => interpolate(inside[0], corner)));
      else if (outside.length === 1) emit(...inside.map((corner) => interpolate(corner, outside[0])));
      else {
        const a = interpolate(inside[0], outside[0]); const b = interpolate(inside[0], outside[1]); const c = interpolate(inside[1], outside[0]); const d = interpolate(inside[1], outside[1]);
        emit(a, b, c); emit(b, d, c);
      }
    }
  }
  if (!positions.length) throw new Error('谱子没有生成可见的连续哺乳四足表面');
  const geometry = makeGeometry(positions, null, normals);
  geometry.userData.grid = { nx, ny, nz, step };
  return geometry;
}

function colorToArray(material) {
  const color = new THREE.Color(material.color);
  return [color.r, color.g, color.b];
}

function mixColor(a, b, t) {
  return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
}

function coatColor(position, spec, anchors) {
  const [x, y, z] = position; const c = spec.coat; const seed = c.seed; const g = spec.global; const t = spec.torso; const p = spec.paws;
  const base = colorToArray(spec.materials[c.baseMaterial]); const dorsalColor = colorToArray(spec.materials[c.dorsalMaterial]); const ventralColor = colorToArray(spec.materials[c.ventralMaterial]); const accent = colorToArray(spec.materials[c.accentMaterial]);
  const dorsal = smooth01((y - g.shoulderHeight * 0.55) / Math.max(0.04, g.shoulderHeight * 0.38));
  const underside = 1 - smooth01((y - p.height * 1.5) / Math.max(0.05, g.shoulderHeight * 0.60));
  const centerBelly = 1 - smooth01(Math.abs(x) / Math.max(0.03, t.lumbarWidth * 0.46));
  const noise = hashNoise(x * 8.1, y * 8.7, z * 6.4, seed);
  let color = base;
  if (c.mode === 1) {
    const bodyWave = Math.sin((z / g.bodyLength + 0.44) * Math.PI * c.frequency + Math.abs(x) * 20 + y * 8 + (noise - 0.5) * 2.2);
    const legWave = Math.sin(y * c.legBands * Math.PI * 2 / Math.max(0.12, g.shoulderHeight));
    const tailWave = Math.sin((-z) * c.tailBands * Math.PI * 2 / Math.max(0.22, spec.tail?.length ?? g.bodyLength));
    const bodyMask = smooth01((z + g.bodyLength * 0.35) / 0.07) * (1 - smooth01((z - g.bodyLength * 0.42) / 0.08));
    const flank = smooth01((Math.abs(x) - t.lumbarWidth * 0.08) / Math.max(0.018, t.thoraxWidth * 0.34)) * (1 - underside * 0.72);
    const legMask = smooth01(Math.abs(x) / Math.max(0.045, g.frontStanceWidth * 0.32)) * underside;
    const tailMask = smooth01((-z - g.bodyLength * 0.28) / 0.075);
    const signal = Math.max(0, bodyWave * bodyMask * flank, legWave * legMask, tailWave * tailMask);
    const amount = smooth01((signal - 0.08) / 0.72) * c.contrast;
    color = mixColor(color, accent, amount);
  } else if (c.mode === 2) {
    const broad = smooth01((noise - 0.36) / 0.34);
    const chest = smooth01((z - g.bodyLength * 0.20) / Math.max(0.08, g.bodyLength * 0.22)) * underside;
    const face = smooth01((z - anchors.head[2] + spec.head.cranialLength * 0.20) / Math.max(0.03, spec.head.cranialLength * 0.48));
    color = mixColor(color, dorsalColor, dorsal * c.dorsalStrength);
    color = mixColor(color, ventralColor, clamp((underside * centerBelly + chest * 0.75 + face * 0.35) * c.contrast, 0, 1));
    color = mixColor(color, accent, broad * (1 - underside) * c.contrast * 0.32);
  } else if (c.mode === 3) {
    color = mixColor(color, dorsalColor, dorsal * c.dorsalStrength);
    color = mixColor(color, ventralColor, underside * (0.45 + centerBelly * 0.42));
    const agouti = 0.25 + noise * 0.75;
    color = mixColor(color, accent, agouti * c.contrast * (0.32 + dorsal * 0.52));
  } else {
    color = mixColor(color, dorsalColor, dorsal * c.dorsalStrength);
    color = mixColor(color, ventralColor, underside * centerBelly * c.contrast);
  }
  const micro = (hashNoise(x * 78, y * 78, z * 78, seed + 991) - 0.5) * 0.045;
  return color.map((value) => clamp(value + micro, 0, 1));
}

function applyCoatColors(geometry, spec, anchors) {
  const position = geometry.getAttribute('position'); const colors = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index += 1) {
    const color = coatColor([position.getX(index), position.getY(index), position.getZ(index)], spec, anchors);
    colors[index * 3] = color[0]; colors[index * 3 + 1] = color[1]; colors[index * 3 + 2] = color[2];
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function createMaterials(spec) {
  return spec.materials.map((entry) => new THREE.MeshStandardMaterial({ color: entry.color, roughness: entry.roughness, metalness: entry.metalness }));
}

function addEllipsoid(root, detail, materials, mirrored, name) {
  const signs = mirrored && Math.abs(detail.center[0]) > 1e-8 ? [-1, 1] : [1];
  for (const sign of signs) {
    const geometry = new THREE.SphereGeometry(1, 32, 22);
    geometry.scale(detail.radius[0], detail.radius[1], detail.radius[2]);
    geometry.rotateX(detail.rotation[0] * DEG); geometry.rotateY(detail.rotation[1] * DEG * sign); geometry.rotateZ(detail.rotation[2] * DEG * sign);
    geometry.translate(detail.center[0] * sign, detail.center[1], detail.center[2]);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, materials[detail.material]); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh);
  }
}

function buildEarMesh(record, sign, materials) {
  const rows = 14;
  const cols = 8;
  const buildLayer = (depthSign, materialIndex, name) => {
    const positions = [];
    const indices = [];
    for (let row = 0; row <= rows; row += 1) {
      const u = row / rows;
      const taper = Math.pow(1 - u, 0.88);
      const halfWidth = record.width * (0.5 * taper + 0.015);
      for (let col = 0; col <= cols; col += 1) {
        const v = col / cols * 2 - 1;
        const cup = (1 - v * v) * record.curve * record.depth * (0.3 + 0.7 * u);
        positions.push(v * halfWidth, u * record.height, depthSign * record.depth * 0.5 + cup);
      }
    }
    const stride = cols + 1;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const a = row * stride + col;
        const b = a + stride;
        if (depthSign > 0) indices.push(a, b, a + 1, b, b + 1, a + 1);
        else indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const geometry = makeGeometry(positions, indices);
    const material = materials[materialIndex].clone();
    material.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };
  const group = new THREE.Group();
  group.name = 'score-pinna-sheet';
  group.add(buildLayer(1, record.outerMaterial, 'pinna-outer'));
  group.add(buildLayer(-1, record.innerMaterial, 'pinna-inner'));
  group.position.set(record.center[0] * sign, record.center[1], record.center[2]);
  group.rotation.set(record.rotation[0] * DEG, record.rotation[1] * DEG * sign, record.rotation[2] * DEG * sign);
  return group;
}

function buildClaws(spec, anchors, materials) {
  if (spec.paws.clawLength <= 0) return [];
  const meshes = []; const p = spec.paws;
  for (const side of [-1, 1]) for (const [kind, paw, length, width] of [['fore', anchors[`forePaw${side}`], p.foreLength, p.foreWidth], ['hind', anchors[`hindPaw${side}`], p.hindLength, p.hindWidth]]) {
    for (let toeIndex = 0; toeIndex < p.toeCount; toeIndex += 1) {
      const offset = toeIndex - (p.toeCount - 1) / 2;
      const geometry = new THREE.ConeGeometry(Math.max(0.0015, width * 0.035), p.clawLength, 7, 1, false);
      geometry.rotateX(Math.PI * 0.5); geometry.translate(paw[0] + offset * (width + p.toeSplay) * 0.185, p.height * 0.34, paw[2] + length * 0.70 + p.clawLength * 0.35);
      const mesh = new THREE.Mesh(geometry, materials[p.clawMaterial]); mesh.name = `score-${kind}-claw`; mesh.castShadow = true; mesh.receiveShadow = true; meshes.push(mesh);
    }
  }
  return meshes;
}

function buildWhiskers(spec, anchors, materials) {
  if (!spec.whiskers || spec.whiskers.count <= 0) return [];
  const result = []; const w = spec.whiskers; const random = seededRandom(w.seed); const h = spec.head;
  for (const side of [-1, 1]) for (let index = 0; index < w.count; index += 1) {
    const u = w.count === 1 ? 0.5 : index / (w.count - 1);
    const origin = V3(side * h.muzzleWidth * (0.34 + u * 0.10), anchors.muzzle[1] + h.muzzleHeight * (0.10 - u * 0.36), anchors.muzzle[2] + h.muzzleLength * (0.16 + u * 0.08));
    const outward = side * w.length * (0.65 + w.splay * (0.25 + u * 0.45));
    const end = origin.clone().add(V3(outward, w.curve * w.length * (u - 0.45), w.length * (0.65 + random() * 0.22)));
    const middle = origin.clone().lerp(end, 0.52).add(V3(side * w.length * 0.08, w.curve * w.length * 0.22, w.length * 0.08));
    const curve = new THREE.QuadraticBezierCurve3(origin, middle, end);
    const geometry = new THREE.TubeGeometry(curve, 8, Math.max(0.00018, w.length * 0.004), 3, false);
    const mesh = new THREE.Mesh(geometry, materials[w.material]); mesh.name = 'score-vibrissa'; mesh.castShadow = false; result.push(mesh);
  }
  return result;
}

export function buildScore(text) {
  const start = performance.now(); const spec = parseScore(text); const { anchors } = deriveSkeleton(spec); const root = new THREE.Group(); root.name = 'K5_MAMMAL_OUTPUT';
  const materials = createMaterials(spec); let bodyGeometry = null;
  try {
    bodyGeometry = polygonize(spec, anchors); applyCoatColors(bodyGeometry, spec, anchors);
    const bodyMaterial = materials[spec.coat.baseMaterial].clone(); bodyMaterial.color.set('#ffffff'); bodyMaterial.vertexColors = true;
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial); body.name = 'continuous-score-mammal-body'; body.castShadow = true; body.receiveShadow = true; root.add(body);
    for (const detail of spec.symmetricDetails) addEllipsoid(root, detail, materials, true, 'symmetric-score-detail');
    for (const detail of spec.centralDetails) addEllipsoid(root, detail, materials, false, 'central-score-detail');
    for (const ear of spec.ears) { root.add(buildEarMesh(ear, -1, materials)); root.add(buildEarMesh(ear, 1, materials)); }
    for (const claw of buildClaws(spec, anchors, materials)) root.add(claw);
    for (const whisker of buildWhiskers(spec, anchors, materials)) root.add(whisker);
    root.userData = {
      version: VERSION,
      domain: CONTRACT.domain,
      scoreOwnedShapeData: true,
      identityPreset: null,
      sharedOperators: [...CONTRACT.sharedOperators],
      grid: bodyGeometry.userData.grid,
      landmarks: {
        shoulderHeight: spec.global.shoulderHeight,
        hipHeight: spec.global.hipHeight,
        foreReachCorrection: Math.max(anchors.foreReachCorrection1 ?? 0, anchors['foreReachCorrection-1'] ?? 0),
        hindReachCorrection: Math.max(anchors.hindReachCorrection1 ?? 0, anchors['hindReachCorrection-1'] ?? 0),
      },
    };
    root.updateMatrixWorld(true);
    return { root, spec, anchors, score: spec.text, buildMs: performance.now() - start };
  } catch (error) {
    for (const material of materials) material.dispose();
    if (bodyGeometry) bodyGeometry.dispose();
    dispose(root);
    throw error;
  }
}

export function dispose(root) {
  if (!root) return;
  const geometries = new Set(); const materials = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of list) materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose(); for (const material of materials) material.dispose(); root.removeFromParent();
}

export function measure(root, score = '') {
  let meshes = 0; let vertices = 0; let triangles = 0; let geometryBytes = 0;
  root.traverse((object) => {
    if (!object.isMesh) return;
    meshes += 1;
    const geometry = object.geometry; const multiplier = object.isInstancedMesh ? object.count : 1;
    vertices += geometry.getAttribute('position').count * multiplier;
    triangles += (geometry.index ? geometry.index.count : geometry.getAttribute('position').count) / 3 * multiplier;
    for (const attribute of Object.values(geometry.attributes)) geometryBytes += attribute.array.byteLength;
    if (geometry.index) geometryBytes += geometry.index.array.byteLength;
    if (object.instanceMatrix) geometryBytes += object.instanceMatrix.array.byteLength;
    if (object.instanceColor) geometryBytes += object.instanceColor.array.byteLength;
  });
  const box = new THREE.Box3().setFromObject(root);
  return { scoreBytes: encoder.encode(score).length, meshes, vertices: Math.round(vertices), triangles: Math.round(triangles), geometryBytes, bounds: { min: box.min.toArray(), max: box.max.toArray() }, grid: root.userData.grid ?? null };
}

function canonicalMaterial(material) {
  return [material.color?.toArray() ?? null, material.roughness, material.metalness, material.side, material.vertexColors];
}

export function snapshot(root) {
  root.updateMatrixWorld(true);
  const chunks = [];
  root.traverse((object) => {
    if (!object.isMesh) return;
    chunks.push(encoder.encode(object.name));
    for (const key of Object.keys(object.geometry.attributes).sort()) {
      const array = object.geometry.attributes[key].array;
      chunks.push(encoder.encode(key), new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
    }
    if (object.geometry.index) {
      const array = object.geometry.index.array;
      chunks.push(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
    }
    chunks.push(new Uint8Array(new Float64Array(object.matrixWorld.elements).buffer));
    const material = Array.isArray(object.material) ? object.material.map(canonicalMaterial) : canonicalMaterial(object.material);
    chunks.push(encoder.encode(JSON.stringify(material)));
  });
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0); const output = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}

export function fingerprint(root) {
  let hash = 2166136261;
  for (const byte of snapshot(root)) { hash ^= byte; hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

export function verifyReplay(result) {
  const second = buildScore(result.score);
  try {
    const a = snapshot(result.root); const b = snapshot(second.root);
    if (a.length !== b.length) return false;
    for (let index = 0; index < a.length; index += 1) if (a[index] !== b[index]) return false;
    return true;
  } finally { dispose(second.root); }
}

