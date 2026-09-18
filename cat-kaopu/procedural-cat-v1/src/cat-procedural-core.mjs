export const CAT_DNA_SCHEMA = 'cat_kaopu/cat_dna@1.0';

const DEG = Math.PI / 180;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth01 = (t) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};
const deepClone = (value) => JSON.parse(JSON.stringify(value));

export const DEFAULT_CAT_DNA = Object.freeze({
  schema: CAT_DNA_SCHEMA,
  meta: {
    id: 'grey-tabby-a',
    label: 'Grey Tabby A',
    revision: 1,
    seed: 240917,
    units: 'meter',
    coordinateSystem: { forward: '+X', left: '+Y', up: '+Z' }
  },
  global: {
    bodyLength: 0.58,
    shoulderHeight: 0.260,
    hipHeight: 0.270,
    frontStanceWidth: 0.095,
    hindStanceWidth: 0.105,
    overallBulk: 1.0
  },
  torso: {
    pelvisLength: 0.145,
    lumbarLength: 0.125,
    thoraxLength: 0.215,
    pelvisWidth: 0.135,
    lumbarWidth: 0.105,
    thoraxWidth: 0.155,
    pelvisDepth: 0.145,
    lumbarDepth: 0.125,
    thoraxDepth: 0.185,
    abdomenTuck: 0.026,
    dorsalArc: 0.012,
    ventralSag: 0.008
  },
  neck: {
    length: 0.105,
    baseWidth: 0.105,
    headWidth: 0.092,
    baseDepth: 0.125,
    headDepth: 0.098,
    pitchDeg: 24
  },
  head: {
    cranialLength: 0.105,
    width: 0.115,
    height: 0.105,
    muzzleLength: 0.034,
    muzzleWidth: 0.064,
    muzzleHeight: 0.045,
    jawDepth: 0.032,
    eyeSpacing: 0.058,
    eyeHeight: 0.024,
    earHeight: 0.075,
    earWidth: 0.045,
    earTiltDeg: 10
  },
  forelimb: {
    shoulderLongitudinal: 0.120,
    scapulaLength: 0.105,
    humerusLength: 0.1006,
    radiusLength: 0.0974,
    metacarpalLength: 0.055,
    upperRadius: 0.025,
    lowerRadius: 0.018,
    wristRadius: 0.012,
    humerusBackDeg: 18,
    radiusForwardDeg: 7,
    metacarpalForwardDeg: 18
  },
  hindlimb: {
    hipLongitudinal: -0.140,
    femurLength: 0.1081,
    tibiaLength: 0.1138,
    tarsusLength: 0.078,
    upperRadius: 0.034,
    lowerRadius: 0.022,
    hockRadius: 0.014,
    femurForwardDeg: 42,
    tibiaBackDeg: 48,
    tarsusForwardDeg: 30
  },
  paws: {
    foreLength: 0.055,
    foreWidth: 0.036,
    hindLength: 0.062,
    hindWidth: 0.040,
    height: 0.018,
    toeSplay: 0.006
  },
  tail: {
    length: 0.30,
    baseRadius: 0.024,
    tipRadius: 0.006,
    lift: 0.030,
    curl: 0.08,
    lateral: 0.015,
    segments: 12
  },
  coat: {
    baseColor: '#62666b',
    stripeColor: '#1d2024',
    bellyColor: '#aaa79f',
    warmColor: '#74665d',
    stripeFrequency: 12.0,
    stripeContrast: 0.68,
    dorsalDarkness: 0.42,
    legBands: 7.0,
    tailBands: 10.0,
    roughness: 0.82
  },
  material: {
    shortHairAmplitude: 0.00020,
    shortHairFrequency: 46.0,
    rimSoftness: 0.35,
    noseRoughness: 0.55,
    eyeRoughness: 0.24
  }
});

export const CAT_PARAMETER_DEFINITIONS = Object.freeze({
  'global.bodyLength': { group: '整体', label: '身体长度', min: 0.48, max: 0.72, step: 0.005 },
  'global.shoulderHeight': { group: '整体', label: '肩高', min: 0.22, max: 0.34, step: 0.002 },
  'global.hipHeight': { group: '整体', label: '髋高', min: 0.23, max: 0.35, step: 0.002 },
  'global.frontStanceWidth': { group: '整体', label: '前足站距', min: 0.070, max: 0.135, step: 0.001 },
  'global.hindStanceWidth': { group: '整体', label: '后足站距', min: 0.080, max: 0.150, step: 0.001 },
  'global.overallBulk': { group: '整体', label: '整体体量', min: 0.78, max: 1.28, step: 0.01 },

  'torso.pelvisLength': { group: '躯干', label: '骨盆长度', min: 0.105, max: 0.185, step: 0.002 },
  'torso.lumbarLength': { group: '躯干', label: '腰段长度', min: 0.090, max: 0.170, step: 0.002 },
  'torso.thoraxLength': { group: '躯干', label: '胸廓长度', min: 0.165, max: 0.275, step: 0.002 },
  'torso.pelvisWidth': { group: '躯干', label: '骨盆宽度', min: 0.100, max: 0.175, step: 0.001 },
  'torso.lumbarWidth': { group: '躯干', label: '腰部宽度', min: 0.075, max: 0.135, step: 0.001 },
  'torso.thoraxWidth': { group: '躯干', label: '胸廓宽度', min: 0.115, max: 0.195, step: 0.001 },
  'torso.pelvisDepth': { group: '躯干', label: '骨盆深度', min: 0.105, max: 0.185, step: 0.001 },
  'torso.lumbarDepth': { group: '躯干', label: '腰部深度', min: 0.090, max: 0.155, step: 0.001 },
  'torso.thoraxDepth': { group: '躯干', label: '胸廓深度', min: 0.140, max: 0.225, step: 0.001 },
  'torso.abdomenTuck': { group: '躯干', label: '腹线收束', min: 0.0, max: 0.075, step: 0.001 },
  'torso.dorsalArc': { group: '躯干', label: '背线弧度', min: -0.015, max: 0.045, step: 0.001 },
  'torso.ventralSag': { group: '躯干', label: '胸腹下缘', min: 0.0, max: 0.035, step: 0.001 },

  'neck.length': { group: '颈部', label: '颈部长度', min: 0.075, max: 0.145, step: 0.001 },
  'neck.baseWidth': { group: '颈部', label: '颈根宽度', min: 0.080, max: 0.135, step: 0.001 },
  'neck.headWidth': { group: '颈部', label: '头侧宽度', min: 0.070, max: 0.115, step: 0.001 },
  'neck.baseDepth': { group: '颈部', label: '颈根深度', min: 0.095, max: 0.155, step: 0.001 },
  'neck.headDepth': { group: '颈部', label: '头侧深度', min: 0.075, max: 0.125, step: 0.001 },
  'neck.pitchDeg': { group: '颈部', label: '颈部抬角', min: 5, max: 35, step: 1 },

  'head.cranialLength': { group: '头部', label: '颅部长度', min: 0.085, max: 0.135, step: 0.001 },
  'head.width': { group: '头部', label: '头部宽度', min: 0.090, max: 0.145, step: 0.001 },
  'head.height': { group: '头部', label: '头部高度', min: 0.085, max: 0.135, step: 0.001 },
  'head.muzzleLength': { group: '头部', label: '口鼻长度', min: 0.022, max: 0.050, step: 0.001 },
  'head.muzzleWidth': { group: '头部', label: '口鼻宽度', min: 0.050, max: 0.080, step: 0.001 },
  'head.muzzleHeight': { group: '头部', label: '口鼻高度', min: 0.035, max: 0.060, step: 0.001 },
  'head.jawDepth': { group: '头部', label: '下颌深度', min: 0.022, max: 0.045, step: 0.001 },
  'head.eyeSpacing': { group: '头部', label: '双眼间距', min: 0.044, max: 0.075, step: 0.001 },
  'head.eyeHeight': { group: '头部', label: '眼球尺度', min: 0.017, max: 0.032, step: 0.001 },
  'head.earHeight': { group: '头部', label: '耳高', min: 0.055, max: 0.100, step: 0.001 },
  'head.earWidth': { group: '头部', label: '耳宽', min: 0.035, max: 0.060, step: 0.001 },
  'head.earTiltDeg': { group: '头部', label: '耳外倾角', min: -5, max: 24, step: 1 },

  'forelimb.scapulaLength': { group: '前肢', label: '肩胛长度', min: 0.080, max: 0.130, step: 0.001 },
  'forelimb.humerusLength': { group: '前肢', label: '上臂长度', min: 0.080, max: 0.125, step: 0.001 },
  'forelimb.radiusLength': { group: '前肢', label: '前臂长度', min: 0.078, max: 0.122, step: 0.001 },
  'forelimb.metacarpalLength': { group: '前肢', label: '掌骨长度', min: 0.040, max: 0.070, step: 0.001 },
  'forelimb.upperRadius': { group: '前肢', label: '上臂体积', min: 0.019, max: 0.032, step: 0.001 },
  'forelimb.lowerRadius': { group: '前肢', label: '前臂体积', min: 0.014, max: 0.024, step: 0.001 },
  'forelimb.wristRadius': { group: '前肢', label: '腕部体积', min: 0.009, max: 0.016, step: 0.001 },
  'forelimb.humerusBackDeg': { group: '前肢', label: '上臂后摆', min: 2, max: 28, step: 1 },
  'forelimb.radiusForwardDeg': { group: '前肢', label: '前臂前摆', min: 0, max: 24, step: 1 },
  'forelimb.metacarpalForwardDeg': { group: '前肢', label: '前掌前倾', min: 18, max: 48, step: 1 },

  'hindlimb.femurLength': { group: '后肢', label: '股骨长度', min: 0.085, max: 0.135, step: 0.001 },
  'hindlimb.tibiaLength': { group: '后肢', label: '胫骨长度', min: 0.090, max: 0.140, step: 0.001 },
  'hindlimb.tarsusLength': { group: '后肢', label: '跖部长度', min: 0.060, max: 0.095, step: 0.001 },
  'hindlimb.upperRadius': { group: '后肢', label: '大腿体积', min: 0.026, max: 0.043, step: 0.001 },
  'hindlimb.lowerRadius': { group: '后肢', label: '小腿体积', min: 0.017, max: 0.029, step: 0.001 },
  'hindlimb.hockRadius': { group: '后肢', label: '飞节体积', min: 0.010, max: 0.019, step: 0.001 },
  'hindlimb.femurForwardDeg': { group: '后肢', label: '大腿前摆', min: 18, max: 50, step: 1 },
  'hindlimb.tibiaBackDeg': { group: '后肢', label: '小腿后摆', min: 26, max: 60, step: 1 },
  'hindlimb.tarsusForwardDeg': { group: '后肢', label: '跖部前倾', min: 18, max: 44, step: 1 },

  'paws.foreLength': { group: '足掌', label: '前掌长度', min: 0.040, max: 0.072, step: 0.001 },
  'paws.foreWidth': { group: '足掌', label: '前掌宽度', min: 0.028, max: 0.048, step: 0.001 },
  'paws.hindLength': { group: '足掌', label: '后掌长度', min: 0.048, max: 0.078, step: 0.001 },
  'paws.hindWidth': { group: '足掌', label: '后掌宽度', min: 0.030, max: 0.052, step: 0.001 },
  'paws.height': { group: '足掌', label: '掌垫高度', min: 0.012, max: 0.024, step: 0.001 },
  'paws.toeSplay': { group: '足掌', label: '趾端展开', min: 0.0, max: 0.025, step: 0.001 },

  'tail.length': { group: '尾部', label: '尾巴长度', min: 0.22, max: 0.42, step: 0.005 },
  'tail.baseRadius': { group: '尾部', label: '尾根体积', min: 0.017, max: 0.032, step: 0.001 },
  'tail.tipRadius': { group: '尾部', label: '尾尖体积', min: 0.004, max: 0.010, step: 0.001 },
  'tail.lift': { group: '尾部', label: '尾巴抬高', min: -0.03, max: 0.10, step: 0.005 },
  'tail.curl': { group: '尾部', label: '尾巴弯曲', min: -0.20, max: 0.35, step: 0.01 },
  'tail.lateral': { group: '尾部', label: '尾巴侧摆', min: -0.12, max: 0.12, step: 0.005 },

  'coat.stripeFrequency': { group: '毛色', label: '虎斑频率', min: 5, max: 20, step: 0.5 },
  'coat.stripeContrast': { group: '毛色', label: '虎斑对比', min: 0.15, max: 0.95, step: 0.01 },
  'coat.dorsalDarkness': { group: '毛色', label: '背部深色', min: 0.05, max: 0.80, step: 0.01 },
  'coat.legBands': { group: '毛色', label: '腿部环纹', min: 3, max: 12, step: 0.5 },
  'coat.tailBands': { group: '毛色', label: '尾部环纹', min: 5, max: 18, step: 0.5 },
  'coat.roughness': { group: '毛色', label: '表面粗糙度', min: 0.55, max: 0.98, step: 0.01 },
  'material.shortHairAmplitude': { group: '表面', label: '短毛起伏', min: 0.0, max: 0.002, step: 0.0001 },
  'material.shortHairFrequency': { group: '表面', label: '短毛频率', min: 18, max: 90, step: 1 }
});

function getPath(object, path) {
  return path.split('.').reduce((node, key) => node?.[key], object);
}

function setPath(object, path, value) {
  const keys = path.split('.');
  let node = object;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (!node[key] || typeof node[key] !== 'object') node[key] = {};
    node = node[key];
  }
  node[keys.at(-1)] = value;
}

function mergeKnown(target, source) {
  if (!source || typeof source !== 'object') return target;
  for (const [key, value] of Object.entries(source)) {
    if (!(key in target)) continue;
    if (target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      mergeKnown(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

function normalizeHex(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(value || '') ? value.toLowerCase() : fallback;
}

export function normalizeCatDNA(input = {}) {
  const dna = mergeKnown(deepClone(DEFAULT_CAT_DNA), input);
  dna.schema = CAT_DNA_SCHEMA;
  for (const [path, def] of Object.entries(CAT_PARAMETER_DEFINITIONS)) {
    const raw = Number(getPath(dna, path));
    setPath(dna, path, clamp(Number.isFinite(raw) ? raw : getPath(DEFAULT_CAT_DNA, path), def.min, def.max));
  }

  const minBodyFromTorso = (dna.torso.pelvisLength + dna.torso.lumbarLength + dna.torso.thoraxLength) * 0.90;
  dna.global.bodyLength = Math.max(dna.global.bodyLength, minBodyFromTorso);
  dna.torso.lumbarWidth = Math.min(dna.torso.lumbarWidth, dna.torso.thoraxWidth * 0.86, dna.torso.pelvisWidth * 0.90);
  dna.torso.lumbarDepth = Math.min(dna.torso.lumbarDepth, dna.torso.thoraxDepth * 0.88, dna.torso.pelvisDepth * 0.94);
  dna.neck.headWidth = Math.min(dna.neck.headWidth, dna.head.width * 0.92);
  dna.neck.headDepth = Math.min(dna.neck.headDepth, dna.head.height * 0.90);
  dna.head.muzzleWidth = Math.min(dna.head.muzzleWidth, dna.head.width * 0.82);
  dna.head.muzzleHeight = Math.min(dna.head.muzzleHeight, dna.head.height * 0.64);
  dna.head.eyeSpacing = Math.min(dna.head.eyeSpacing, dna.head.width * 0.66);
  dna.tail.tipRadius = Math.min(dna.tail.tipRadius, dna.tail.baseRadius * 0.55);
  dna.global.frontStanceWidth = Math.max(dna.global.frontStanceWidth, dna.torso.thoraxWidth * 0.54);
  dna.global.hindStanceWidth = Math.max(dna.global.hindStanceWidth, dna.torso.pelvisWidth * 0.58);

  dna.coat.baseColor = normalizeHex(dna.coat.baseColor, DEFAULT_CAT_DNA.coat.baseColor);
  dna.coat.stripeColor = normalizeHex(dna.coat.stripeColor, DEFAULT_CAT_DNA.coat.stripeColor);
  dna.coat.bellyColor = normalizeHex(dna.coat.bellyColor, DEFAULT_CAT_DNA.coat.bellyColor);
  dna.coat.warmColor = normalizeHex(dna.coat.warmColor, DEFAULT_CAT_DNA.coat.warmColor);
  dna.meta.revision = Math.max(1, Math.floor(Number(dna.meta.revision) || 1));
  dna.meta.seed = Math.floor(Number(dna.meta.seed) || DEFAULT_CAT_DNA.meta.seed);
  return dna;
}

function chainScale(availableHeight, lengths, anglesDeg) {
  const vertical = lengths.reduce((sum, length, index) => sum + length * Math.cos(anglesDeg[index] * DEG), 0);
  return vertical > 1e-6 ? availableHeight / vertical : 1;
}

function addSegment(point, length, angleDeg, forwardSign = 1) {
  const angle = angleDeg * DEG;
  return [point[0] + Math.sin(angle) * length * forwardSign, point[1], point[2] - Math.cos(angle) * length];
}

export function deriveCatSkeleton(input = DEFAULT_CAT_DNA) {
  const dna = normalizeCatDNA(input);
  const pawZ = dna.paws.height * 0.5;
  const pelvisX = -dna.global.bodyLength * 0.20;
  const lumbarX = -dna.global.bodyLength * 0.02;
  const thoraxX = dna.global.bodyLength * 0.18;
  const shoulderX = dna.forelimb.shoulderLongitudinal;
  const hipX = dna.hindlimb.hipLongitudinal;
  const pelvisZ = dna.global.hipHeight;
  const thoraxZ = dna.global.shoulderHeight + dna.torso.thoraxDepth * 0.04;
  const neckPitch = dna.neck.pitchDeg * DEG;
  const neckBase = [thoraxX + dna.torso.thoraxLength * 0.34, 0, thoraxZ + dna.torso.thoraxDepth * 0.24];
  const neckTip = [
    neckBase[0] + Math.cos(neckPitch) * dna.neck.length,
    0,
    neckBase[2] + Math.sin(neckPitch) * dna.neck.length
  ];
  const head = [
    neckTip[0] + dna.head.cranialLength * 0.12,
    0,
    neckTip[2] + dna.head.height * 0.05
  ];
  const muzzle = [head[0] + dna.head.cranialLength * 0.34 + dna.head.muzzleLength * 0.30, 0, head[2] - dna.head.height * 0.16];

  const anchors = {
    pelvis: [pelvisX, 0, pelvisZ],
    lumbar: [lumbarX, 0, mix(pelvisZ, thoraxZ, 0.48) + dna.torso.dorsalArc],
    thorax: [thoraxX, 0, thoraxZ],
    neckBase,
    neckTip,
    head,
    muzzle,
    tailRoot: [pelvisX - dna.torso.pelvisLength * 0.48, 0, pelvisZ + dna.torso.pelvisDepth * 0.04]
  };

  for (const side of [-1, 1]) {
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

    anchors[`shoulder${side}`] = shoulder;
    anchors[`elbow${side}`] = elbow;
    anchors[`wrist${side}`] = wrist;
    anchors[`forePaw${side}`] = forePaw;
    anchors[`hip${side}`] = hip;
    anchors[`stifle${side}`] = stifle;
    anchors[`hock${side}`] = hock;
    anchors[`hindPaw${side}`] = hindPaw;
  }

  return { dna, anchors };
}

export function deriveCatSections(input = DEFAULT_CAT_DNA) {
  const dna = normalizeCatDNA(input);
  const { anchors } = deriveCatSkeleton(dna);
  const bulk = dna.global.overallBulk;
  const pelvisX = anchors.pelvis[0];
  const thoraxX = anchors.thorax[0];
  const zPelvis = anchors.pelvis[2] + dna.torso.dorsalArc * 0.20;
  const zThorax = anchors.thorax[2] + dna.torso.dorsalArc;
  const zLumbar = anchors.lumbar[2] + dna.torso.dorsalArc * 0.65;
  const sections = [
    { x: pelvisX - dna.torso.pelvisLength * 0.50, z: zPelvis - 0.005, ry: dna.torso.pelvisWidth * 0.34 * bulk, rz: dna.torso.pelvisDepth * 0.38 * bulk },
    { x: pelvisX, z: zPelvis, ry: dna.torso.pelvisWidth * 0.50 * bulk, rz: dna.torso.pelvisDepth * 0.50 * bulk },
    { x: anchors.lumbar[0] - dna.torso.lumbarLength * 0.28, z: zLumbar - dna.torso.abdomenTuck * 0.10 - dna.torso.ventralSag * 0.30, ry: dna.torso.lumbarWidth * 0.50 * bulk, rz: (dna.torso.lumbarDepth + dna.torso.ventralSag * 0.35) * 0.50 * bulk },
    { x: anchors.lumbar[0] + dna.torso.lumbarLength * 0.30, z: zLumbar + dna.torso.dorsalArc * 0.18 - dna.torso.ventralSag * 0.42, ry: dna.torso.lumbarWidth * 0.54 * bulk, rz: (dna.torso.lumbarDepth + dna.torso.ventralSag * 0.42) * 0.48 * bulk },
    { x: thoraxX - dna.torso.thoraxLength * 0.24, z: zThorax, ry: dna.torso.thoraxWidth * 0.50 * bulk, rz: dna.torso.thoraxDepth * 0.50 * bulk },
    { x: thoraxX + dna.torso.thoraxLength * 0.24, z: zThorax + dna.torso.dorsalArc * 0.12, ry: dna.torso.thoraxWidth * 0.44 * bulk, rz: dna.torso.thoraxDepth * 0.46 * bulk },
    { x: thoraxX + dna.torso.thoraxLength * 0.46, z: zThorax + dna.torso.dorsalArc * 0.15, ry: dna.neck.baseWidth * 0.48 * bulk, rz: dna.neck.baseDepth * 0.46 * bulk }
  ];
  return { dna, anchors, sections };
}

function smin(a, b, k) {
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
  return k0 * (k0 - 1) / (k1 || 1);
}

function taperedCapsuleSdf(x, y, z, a, b, r0, r1) {
  const bax = b[0] - a[0];
  const bay = b[1] - a[1];
  const baz = b[2] - a[2];
  const pax = x - a[0];
  const pay = y - a[1];
  const paz = z - a[2];
  const den = bax * bax + bay * bay + baz * baz || 1;
  const h = clamp((pax * bax + pay * bay + paz * baz) / den, 0, 1);
  const qx = pax - bax * h;
  const qy = pay - bay * h;
  const qz = paz - baz * h;
  return Math.hypot(qx, qy, qz) - mix(r0, r1, h);
}

function ellipticalSweepSegmentSdf(x, y, z, a, b, ry0, rz0, ry1, rz1) {
  const vx = b[0] - a[0];
  const vz = b[2] - a[2];
  const length = Math.hypot(vx, vz) || 1;
  const ux = vx / length;
  const uz = vz / length;
  const alongRaw = (x - a[0]) * ux + (z - a[2]) * uz;
  const along = clamp(alongRaw, 0, length);
  const t = along / length;
  const cx = a[0] + ux * along;
  const cz = a[2] + uz * along;
  const nx = -uz;
  const nz = ux;
  const perpendicular = (x - cx) * nx + (z - cz) * nz;
  const ry = mix(ry0, ry1, t);
  const rz = mix(rz0, rz1, t);
  const radial = (Math.hypot(y / ry, perpendicular / rz) - 1) * Math.min(ry, rz);
  const outside = Math.max(-alongRaw, alongRaw - length, 0);
  if (outside <= 0) return radial;
  return Math.hypot(Math.max(radial, 0), outside) + Math.min(radial, 0);
}

function cubicBezier(a, b, c, d, t) {
  const u = 1 - t;
  const w0 = u * u * u;
  const w1 = 3 * u * u * t;
  const w2 = 3 * u * t * t;
  const w3 = t * t * t;
  return [
    a[0] * w0 + b[0] * w1 + c[0] * w2 + d[0] * w3,
    a[1] * w0 + b[1] * w1 + c[1] * w2 + d[1] * w3,
    a[2] * w0 + b[2] * w1 + c[2] * w2 + d[2] * w3
  ];
}

export function deriveTailPoints(input = DEFAULT_CAT_DNA) {
  const { dna, anchors } = deriveCatSkeleton(input);
  const root = anchors.tailRoot;
  const length = dna.tail.length;
  const p1 = [root[0] - length * 0.28, dna.tail.lateral * 0.30, root[2] - 0.03 + dna.tail.lift * 0.20];
  const p2 = [root[0] - length * 0.72, dna.tail.lateral * 0.75, root[2] + dna.tail.lift * 0.55 + dna.tail.curl * 0.12];
  const p3 = [root[0] - length, dna.tail.lateral, root[2] + dna.tail.lift + dna.tail.curl * 0.24];
  const points = [];
  const count = Math.max(6, Math.round(dna.tail.segments));
  for (let i = 0; i <= count; i += 1) points.push(cubicBezier(root, p1, p2, p3, i / count));
  return { dna, points };
}

export function createCatSdf(input = DEFAULT_CAT_DNA) {
  const { dna, anchors, sections } = deriveCatSections(input);
  const { points: tailPoints } = deriveTailPoints(dna);
  const bulk = dna.global.overallBulk;
  const bodySmooth = 0.010 * bulk;

  return function catSdf(x, y, z) {
    const first = sections[0];
    const last = sections.at(-1);
    let d = ellipsoidSdf(x, y, z, [first.x, 0, first.z], [0.060, first.ry, first.rz]);
    for (let i = 0; i < sections.length - 1; i += 1) {
      const a = sections[i];
      const b = sections[i + 1];
      d = smin(d, ellipticalSweepSegmentSdf(x, y, z, [a.x, 0, a.z], [b.x, 0, b.z], a.ry, a.rz, b.ry, b.rz), bodySmooth);
    }
    d = smin(d, ellipsoidSdf(x, y, z, [last.x, 0, last.z], [0.055, last.ry, last.rz]), bodySmooth);

    d = smin(d, taperedCapsuleSdf(x, y, z, anchors.neckBase, anchors.neckTip, dna.neck.baseWidth * 0.46, dna.neck.headWidth * 0.46), 0.012);
    d = smin(d, ellipsoidSdf(x, y, z, anchors.head, [dna.head.cranialLength * 0.50, dna.head.width * 0.50, dna.head.height * 0.50]), 0.012);
    d = smin(d, ellipsoidSdf(x, y, z, [anchors.head[0] + dna.head.cranialLength * 0.28, 0, anchors.head[2] - dna.head.height * 0.01], [dna.head.cranialLength * 0.30, dna.head.width * 0.36, dna.head.height * 0.32]), 0.009);
    for (const side of [-1, 1]) {
      const cheek = [anchors.muzzle[0] - dna.head.muzzleLength * 0.12, side * dna.head.muzzleWidth * 0.18, anchors.muzzle[2] - dna.head.muzzleHeight * 0.02];
      d = smin(d, ellipsoidSdf(x, y, z, cheek, [dna.head.muzzleLength * 0.52, dna.head.muzzleWidth * 0.34, dna.head.muzzleHeight * 0.48]), 0.007);
    }
    d = smin(d, ellipsoidSdf(x, y, z, [anchors.muzzle[0] - dna.head.muzzleLength * 0.16, 0, anchors.muzzle[2] - dna.head.jawDepth * 0.38], [dna.head.muzzleLength * 0.48, dna.head.muzzleWidth * 0.40, dna.head.jawDepth * 0.50]), 0.008);

    for (const side of [-1, 1]) {
      const tilt = dna.head.earTiltDeg * DEG;
      const earTip = [
        anchors.head[0] - dna.head.earHeight * 0.08,
        side * (dna.head.width * 0.35 + Math.sin(tilt) * dna.head.earHeight * 0.55),
        anchors.head[2] + dna.head.height * 0.36 + Math.cos(tilt) * dna.head.earHeight
      ];
      const earRoots = [
        [anchors.head[0] - dna.head.cranialLength * 0.20, side * dna.head.width * 0.30, anchors.head[2] + dna.head.height * 0.31],
        [anchors.head[0] + dna.head.cranialLength * 0.08, side * dna.head.width * 0.30, anchors.head[2] + dna.head.height * 0.30],
        [anchors.head[0] - dna.head.cranialLength * 0.04, side * (dna.head.width * 0.34 + dna.head.earWidth * 0.18), anchors.head[2] + dna.head.height * 0.27]
      ];
      for (const root of earRoots) d = smin(d, taperedCapsuleSdf(x, y, z, root, earTip, dna.head.earWidth * 0.25, 0.0025), 0.005);

      const shoulder = anchors[`shoulder${side}`];
      const elbow = anchors[`elbow${side}`];
      const wrist = anchors[`wrist${side}`];
      const forePaw = anchors[`forePaw${side}`];
      const scapulaCenter = [shoulder[0] - dna.forelimb.scapulaLength * 0.20, shoulder[1] * 0.78, shoulder[2] + dna.forelimb.scapulaLength * 0.20];
      d = smin(d, ellipsoidSdf(x, y, z, scapulaCenter, [dna.forelimb.scapulaLength * 0.50, dna.forelimb.upperRadius * 1.15, dna.forelimb.upperRadius * 1.55]), 0.010);
      d = smin(d, taperedCapsuleSdf(x, y, z, shoulder, elbow, dna.forelimb.upperRadius, dna.forelimb.lowerRadius * 1.08), 0.007);
      d = smin(d, ellipsoidSdf(x, y, z, elbow, [dna.forelimb.lowerRadius * 1.10, dna.forelimb.lowerRadius * 0.95, dna.forelimb.lowerRadius * 1.05]), 0.005);
      d = smin(d, taperedCapsuleSdf(x, y, z, elbow, wrist, dna.forelimb.lowerRadius, dna.forelimb.wristRadius), 0.006);
      d = smin(d, taperedCapsuleSdf(x, y, z, wrist, forePaw, dna.forelimb.wristRadius, dna.forelimb.wristRadius * 0.80), 0.004);
      const forePad = [forePaw[0] + dna.paws.foreLength * 0.22, forePaw[1], dna.paws.height * 0.52];
      d = smin(d, ellipsoidSdf(x, y, z, forePad, [dna.paws.foreLength * 0.46, dna.paws.foreWidth * 0.46, dna.paws.height * 0.50]), 0.005);
      for (const toe of [-1, 0, 1]) {
        const toeCenter = [forePaw[0] + dna.paws.foreLength * 0.54, forePaw[1] + toe * dna.paws.toeSplay * 0.55, dna.paws.height * 0.54];
        d = smin(d, ellipsoidSdf(x, y, z, toeCenter, [dna.paws.foreLength * 0.17, dna.paws.foreWidth * 0.14, dna.paws.height * 0.34]), 0.003);
      }

      const hip = anchors[`hip${side}`];
      const stifle = anchors[`stifle${side}`];
      const hock = anchors[`hock${side}`];
      const hindPaw = anchors[`hindPaw${side}`];
      const glutealCenter = [hip[0] - dna.hindlimb.femurLength * 0.12, hip[1] * 0.78, hip[2] + dna.hindlimb.upperRadius * 0.25];
      d = smin(d, ellipsoidSdf(x, y, z, glutealCenter, [dna.hindlimb.femurLength * 0.56, dna.hindlimb.upperRadius * 1.20, dna.hindlimb.upperRadius * 1.52]), 0.011);
      d = smin(d, taperedCapsuleSdf(x, y, z, hip, stifle, dna.hindlimb.upperRadius, dna.hindlimb.lowerRadius * 1.10), 0.008);
      d = smin(d, ellipsoidSdf(x, y, z, stifle, [dna.hindlimb.lowerRadius * 1.15, dna.hindlimb.lowerRadius, dna.hindlimb.lowerRadius * 1.12]), 0.005);
      d = smin(d, taperedCapsuleSdf(x, y, z, stifle, hock, dna.hindlimb.lowerRadius, dna.hindlimb.hockRadius), 0.006);
      d = smin(d, ellipsoidSdf(x, y, z, hock, [dna.hindlimb.hockRadius * 1.12, dna.hindlimb.hockRadius * 0.95, dna.hindlimb.hockRadius * 1.12]), 0.004);
      d = smin(d, taperedCapsuleSdf(x, y, z, hock, hindPaw, dna.hindlimb.hockRadius, dna.hindlimb.hockRadius * 0.78), 0.004);
      const hindPad = [hindPaw[0] + dna.paws.hindLength * 0.22, hindPaw[1], dna.paws.height * 0.52];
      d = smin(d, ellipsoidSdf(x, y, z, hindPad, [dna.paws.hindLength * 0.46, dna.paws.hindWidth * 0.46, dna.paws.height * 0.50]), 0.005);
      for (const toe of [-1, 0, 1]) {
        const toeCenter = [hindPaw[0] + dna.paws.hindLength * 0.54, hindPaw[1] + toe * dna.paws.toeSplay * 0.58, dna.paws.height * 0.54];
        d = smin(d, ellipsoidSdf(x, y, z, toeCenter, [dna.paws.hindLength * 0.17, dna.paws.hindWidth * 0.14, dna.paws.height * 0.34]), 0.003);
      }
    }

    for (let i = 0; i < tailPoints.length - 1; i += 1) {
      const t0 = i / (tailPoints.length - 1);
      const t1 = (i + 1) / (tailPoints.length - 1);
      d = smin(d, taperedCapsuleSdf(x, y, z, tailPoints[i], tailPoints[i + 1], mix(dna.tail.baseRadius, dna.tail.tipRadius, t0), mix(dna.tail.baseRadius, dna.tail.tipRadius, t1)), 0.009);
    }
    const hairNoise = (hashNoise(x * dna.material.shortHairFrequency, y * dna.material.shortHairFrequency, z * dna.material.shortHairFrequency, dna.meta.seed) - 0.5) * 2;
    return d - hairNoise * dna.material.shortHairAmplitude;
  };
}

function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16 & 255) / 255, (value >> 8 & 255) / 255, (value & 255) / 255];
}

function rgbMix(a, b, t) {
  return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
}

function hashNoise(x, y, z, seed) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 0.013) * 43758.5453;
  return s - Math.floor(s);
}

export function sampleCoatColor(position, input = DEFAULT_CAT_DNA) {
  const dna = normalizeCatDNA(input);
  const [x, y, z] = position;
  const base = hexToRgb(dna.coat.baseColor);
  const stripe = hexToRgb(dna.coat.stripeColor);
  const belly = hexToRgb(dna.coat.bellyColor);
  const warm = hexToRgb(dna.coat.warmColor);
  const seed = dna.meta.seed;

  const dorsal = smooth01((z - dna.global.shoulderHeight * 0.58) / (dna.global.shoulderHeight * 0.36));
  const underside = 1 - smooth01((z - dna.paws.height * 1.6) / (dna.global.shoulderHeight * 0.58));
  const centerBelly = 1 - smooth01(Math.abs(y) / Math.max(0.03, dna.torso.lumbarWidth * 0.44));
  const bodyWave = Math.sin((x / dna.global.bodyLength + 0.45) * Math.PI * dna.coat.stripeFrequency + Math.abs(y) * 32);
  const legWave = Math.sin(z * dna.coat.legBands * Math.PI * 2 / Math.max(0.12, dna.global.shoulderHeight));
  const tailWave = Math.sin((-x) * dna.coat.tailBands * Math.PI * 2 / Math.max(0.28, dna.tail.length));
  const bodyMask = smooth01((x + dna.global.bodyLength * 0.35) / 0.08) * (1 - smooth01((x - dna.global.bodyLength * 0.34) / 0.08));
  const legMask = smooth01(Math.abs(y) / Math.max(0.05, dna.global.frontStanceWidth * 0.30)) * underside;
  const tailMask = smooth01((-x - dna.global.bodyLength * 0.25) / 0.10);
  const stripeSignal = Math.max(0, bodyWave * bodyMask, legWave * legMask, tailWave * tailMask);
  const stripeThreshold = mix(0.08, 0.28, dna.material.rimSoftness);
  const stripeWidth = mix(0.86, 0.58, dna.material.rimSoftness);
  const stripeAmount = smooth01((stripeSignal - stripeThreshold) / stripeWidth) * dna.coat.stripeContrast;
  const dorsalAmount = dorsal * dna.coat.dorsalDarkness;
  const bellyAmount = underside * centerBelly * 0.72;
  const warmAmount = smooth01((0.36 - z) / 0.22) * (1 - centerBelly) * 0.18;
  const micro = (hashNoise(x * dna.material.shortHairFrequency, y * dna.material.shortHairFrequency, z * dna.material.shortHairFrequency, seed) - 0.5) * 0.055;

  let color = rgbMix(base, stripe, clamp(stripeAmount + dorsalAmount * 0.30, 0, 0.92));
  color = rgbMix(color, belly, bellyAmount);
  color = rgbMix(color, warm, warmAmount);
  return color.map((channel) => clamp(channel + micro, 0, 1));
}

export function deriveCollisionProxies(input = DEFAULT_CAT_DNA) {
  const { dna, anchors } = deriveCatSkeleton(input);
  return [
    { id: 'pelvis', type: 'ellipsoid', center: anchors.pelvis, radii: [dna.torso.pelvisLength * 0.42, dna.torso.pelvisWidth * 0.48, dna.torso.pelvisDepth * 0.46] },
    { id: 'thorax', type: 'ellipsoid', center: anchors.thorax, radii: [dna.torso.thoraxLength * 0.42, dna.torso.thoraxWidth * 0.48, dna.torso.thoraxDepth * 0.47] },
    { id: 'head', type: 'ellipsoid', center: anchors.head, radii: [dna.head.cranialLength * 0.48, dna.head.width * 0.48, dna.head.height * 0.48] }
  ];
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function hashCatDNA(input = DEFAULT_CAT_DNA) {
  const text = canonicalize(normalizeCatDNA(input));
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function deriveCatMetrics(input = DEFAULT_CAT_DNA) {
  const { dna, anchors } = deriveCatSkeleton(input);
  const { points: tailPoints } = deriveTailPoints(dna);
  const noseX = anchors.muzzle[0] + dna.head.muzzleLength * 0.58;
  const tailTip = tailPoints.at(-1);
  return {
    schema: 'cat_kaopu/cat_morphology_metrics@1.0',
    dnaHash: hashCatDNA(dna),
    bodyLengthM: dna.global.bodyLength,
    noseToTailRootM: noseX - anchors.tailRoot[0],
    tailLengthM: dna.tail.length,
    totalNoseToTailTipSpanM: noseX - tailTip[0],
    shoulderHeightM: dna.global.shoulderHeight,
    hipHeightM: dna.global.hipHeight,
    thoraxWidthM: dna.torso.thoraxWidth,
    lumbarWidthM: dna.torso.lumbarWidth,
    pelvisWidthM: dna.torso.pelvisWidth,
    thoraxLumbarRatio: dna.torso.thoraxWidth / dna.torso.lumbarWidth,
    pelvisLumbarRatio: dna.torso.pelvisWidth / dna.torso.lumbarWidth,
    headWidthM: dna.head.width,
    authorityCalibration: {
      profile: 'european-shorthair-p1',
      shoulderHeightTargetM: 0.2598,
      shoulderHeightDeltaM: dna.global.shoulderHeight - 0.2598,
      humerusTargetM: 0.1006,
      humerusDeltaM: dna.forelimb.humerusLength - 0.1006,
      radiusTargetM: 0.0974,
      radiusDeltaM: dna.forelimb.radiusLength - 0.0974,
      femurTargetM: 0.1081,
      femurDeltaM: dna.hindlimb.femurLength - 0.1081,
      tibiaTargetM: 0.1138,
      tibiaDeltaM: dna.hindlimb.tibiaLength - 0.1138,
      skullLengthMeasuredM: 0.0894,
      cranialLengthMeasuredM: 0.0821,
      nasalLengthMeasuredM: 0.0073
    },
    pawGroundZ: {
      foreLeft: anchors.forePaw1[2] - dna.paws.height * 0.5,
      foreRight: anchors['forePaw-1'][2] - dna.paws.height * 0.5,
      hindLeft: anchors.hindPaw1[2] - dna.paws.height * 0.5,
      hindRight: anchors['hindPaw-1'][2] - dna.paws.height * 0.5
    },
    externalAnimalMeshes: 0,
    externalImageTextures: 0,
    proceduralGeometry: true,
    proceduralMaterial: true
  };
}

export function validateCatDNA(input = DEFAULT_CAT_DNA) {
  const dna = normalizeCatDNA(input);
  const errors = [];
  const warnings = [];
  for (const [path, def] of Object.entries(CAT_PARAMETER_DEFINITIONS)) {
    const value = getPath(dna, path);
    if (!Number.isFinite(value)) errors.push(`${path}: not finite`);
    if (value < def.min - 1e-9 || value > def.max + 1e-9) errors.push(`${path}: outside normalized range`);
  }
  const { anchors } = deriveCatSkeleton(dna);
  for (const [id, point] of Object.entries(anchors)) {
    if (!point.every(Number.isFinite)) errors.push(`${id}: non-finite anchor`);
  }
  const ground = [anchors.forePaw1, anchors['forePaw-1'], anchors.hindPaw1, anchors['hindPaw-1']]
    .map((point) => point[2] - dna.paws.height * 0.5);
  if (ground.some((value) => Math.abs(value) > 1e-6)) errors.push(`paws are not grounded: ${ground.join(', ')}`);
  if (dna.torso.lumbarWidth >= dna.torso.thoraxWidth) warnings.push('lumbar width is not narrower than thorax width');
  if (dna.torso.lumbarWidth >= dna.torso.pelvisWidth) warnings.push('lumbar width is not narrower than pelvis width');
  const sdf = createCatSdf(dna);
  const inside = sdf(anchors.pelvis[0], 0, anchors.pelvis[2]);
  const outside = sdf(1.5, 1.5, 1.5);
  if (!(inside < 0)) errors.push('pelvis center is not inside procedural body');
  if (!(outside > 0)) errors.push('far field is not outside procedural body');
  const metrics = deriveCatMetrics(dna);
  return {
    schema: 'cat_kaopu/cat_dna_validation@1.0',
    valid: errors.length === 0,
    errors,
    warnings,
    dna,
    metrics
  };
}

export function createSeededVariant(input = DEFAULT_CAT_DNA, seed = 1, amount = 0.18) {
  const dna = normalizeCatDNA(input);
  let state = (seed >>> 0) || 1;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const variant = deepClone(dna);
  for (const [path, def] of Object.entries(CAT_PARAMETER_DEFINITIONS)) {
    if (path.startsWith('coat.') || path.startsWith('material.')) continue;
    const center = getPath(dna, path);
    const span = (def.max - def.min) * amount;
    setPath(variant, path, center + (random() * 2 - 1) * span * 0.5);
  }
  variant.meta.id = `${dna.meta.id}-seed-${seed}`;
  variant.meta.label = `${dna.meta.label} / ${seed}`;
  variant.meta.seed = seed;
  variant.meta.revision += 1;
  return normalizeCatDNA(variant);
}
