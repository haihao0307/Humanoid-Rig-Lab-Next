export const PHOTO_FIT_SCHEMA = 'humanoid_rig/photo_fit_profile@0.1';
export const PHOTO_FIT_VERSION = '0.1.0-r0';

export const MORPH_LIMITS = Object.freeze({
  shoulderWidth: Object.freeze([0.80, 1.18]),
  chestWidth: Object.freeze([0.82, 1.18]),
  waistWidth: Object.freeze([0.78, 1.20]),
  hipWidth: Object.freeze([0.86, 1.25]),
  neckWidth: Object.freeze([0.82, 1.14]),
  limbVolume: Object.freeze([0.78, 1.22]),
  softness: Object.freeze([0.65, 1.45]),
  breastProjectionM: Object.freeze([0, 0.10]),
  faceWidth: Object.freeze([0.90, 1.08])
});

export const FIT_STAGES = Object.freeze({
  rig: Object.freeze({
    id: 'rig',
    label: '绑定宽度',
    description: '肩宽与髋宽会改变绑定结构，当前工作台可能重新载入身体。',
    keys: Object.freeze(['shoulderWidth', 'hipWidth']),
    mayReload: true
  }),
  torso: Object.freeze({
    id: 'torso',
    label: '躯干轮廓',
    description: '胸宽、腰宽与颈宽，只写入当前人物的外形参数。',
    keys: Object.freeze(['chestWidth', 'waistWidth', 'neckWidth']),
    mayReload: false
  }),
  face: Object.freeze({
    id: 'face',
    label: '面部大形',
    description: '当前母体只承接脸宽；眼、鼻、下颌深度仍标记为未知。',
    keys: Object.freeze(['faceWidth']),
    mayReload: false
  }),
  volume: Object.freeze({
    id: 'volume',
    label: '体积人工校正',
    description: '单张正面图不能可靠恢复身体厚度，肢体体积与软组织只采用人工确认值。',
    keys: Object.freeze(['limbVolume', 'softness']),
    mayReload: false
  })
});

export const LANDMARK_DEFINITIONS = Object.freeze({
  headTop: Object.freeze({label: '头顶', group: 'face'}),
  chin: Object.freeze({label: '下巴', group: 'face'}),
  imageLeftTemple: Object.freeze({label: '图左太阳穴', group: 'face'}),
  imageRightTemple: Object.freeze({label: '图右太阳穴', group: 'face'}),
  imageLeftJaw: Object.freeze({label: '图左下颌', group: 'face'}),
  imageRightJaw: Object.freeze({label: '图右下颌', group: 'face'}),
  imageLeftNeck: Object.freeze({label: '图左颈根', group: 'body'}),
  imageRightNeck: Object.freeze({label: '图右颈根', group: 'body'}),
  imageLeftShoulder: Object.freeze({label: '图左肩峰', group: 'body'}),
  imageRightShoulder: Object.freeze({label: '图右肩峰', group: 'body'}),
  imageLeftChest: Object.freeze({label: '图左胸侧', group: 'body'}),
  imageRightChest: Object.freeze({label: '图右胸侧', group: 'body'}),
  imageLeftWaist: Object.freeze({label: '图左腰侧', group: 'body'}),
  imageRightWaist: Object.freeze({label: '图右腰侧', group: 'body'}),
  imageLeftHip: Object.freeze({label: '图左髋侧', group: 'body'}),
  imageRightHip: Object.freeze({label: '图右髋侧', group: 'body'}),
  imageLeftElbow: Object.freeze({label: '图左肘', group: 'limb'}),
  imageRightElbow: Object.freeze({label: '图右肘', group: 'limb'}),
  imageLeftWrist: Object.freeze({label: '图左腕', group: 'limb'}),
  imageRightWrist: Object.freeze({label: '图右腕', group: 'limb'}),
  imageLeftKnee: Object.freeze({label: '图左膝', group: 'limb'}),
  imageRightKnee: Object.freeze({label: '图右膝', group: 'limb'}),
  imageLeftAnkle: Object.freeze({label: '图左踝', group: 'limb'}),
  imageRightAnkle: Object.freeze({label: '图右踝', group: 'limb'})
});

const FULL_REQUIRED = Object.freeze([
  'headTop', 'chin',
  'imageLeftTemple', 'imageRightTemple',
  'imageLeftNeck', 'imageRightNeck',
  'imageLeftShoulder', 'imageRightShoulder',
  'imageLeftChest', 'imageRightChest',
  'imageLeftWaist', 'imageRightWaist',
  'imageLeftHip', 'imageRightHip',
  'imageLeftElbow', 'imageRightElbow',
  'imageLeftWrist', 'imageRightWrist',
  'imageLeftKnee', 'imageRightKnee',
  'imageLeftAnkle', 'imageRightAnkle'
]);

const HEAD_REQUIRED = Object.freeze([
  'headTop', 'chin',
  'imageLeftTemple', 'imageRightTemple',
  'imageLeftJaw', 'imageRightJaw',
  'imageLeftNeck', 'imageRightNeck'
]);

// Engineering mapping references for the current procedural mother body.
// They are not population averages and must not be reported as anatomical truth.
const ENGINEERING_ANCHORS = Object.freeze({
  shoulderWidthByHeight: 0.245,
  chestWidthByHeight: 0.205,
  waistWidthByHeight: 0.165,
  hipWidthByHeight: 0.205,
  neckWidthByHeight: 0.082,
  faceWidthByFaceHeight: 0.720
});

const DEFAULT_FULL = Object.freeze({
  headTop: [0.50, 0.055], chin: [0.50, 0.155],
  imageLeftTemple: [0.465, 0.095], imageRightTemple: [0.535, 0.095],
  imageLeftJaw: [0.472, 0.137], imageRightJaw: [0.528, 0.137],
  imageLeftNeck: [0.477, 0.172], imageRightNeck: [0.523, 0.172],
  imageLeftShoulder: [0.395, 0.205], imageRightShoulder: [0.605, 0.205],
  imageLeftChest: [0.415, 0.285], imageRightChest: [0.585, 0.285],
  imageLeftWaist: [0.438, 0.405], imageRightWaist: [0.562, 0.405],
  imageLeftHip: [0.414, 0.485], imageRightHip: [0.586, 0.485],
  imageLeftElbow: [0.345, 0.365], imageRightElbow: [0.655, 0.365],
  imageLeftWrist: [0.325, 0.520], imageRightWrist: [0.675, 0.520],
  imageLeftKnee: [0.445, 0.715], imageRightKnee: [0.555, 0.715],
  imageLeftAnkle: [0.462, 0.940], imageRightAnkle: [0.538, 0.940]
});

const DEFAULT_HEAD = Object.freeze({
  headTop: [0.50, 0.18], chin: [0.50, 0.82],
  imageLeftTemple: [0.30, 0.38], imageRightTemple: [0.70, 0.38],
  imageLeftJaw: [0.34, 0.68], imageRightJaw: [0.66, 0.68],
  imageLeftNeck: [0.42, 0.86], imageRightNeck: [0.58, 0.86],
  imageLeftShoulder: [0.18, 0.95], imageRightShoulder: [0.82, 0.95]
});

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} 必须是有限数值`);
  return value;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function pointFrom(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`关键点 ${name} 必须是对象`);
  }
  const x = finite(value.x, `${name}.x`);
  const y = finite(value.y, `${name}.y`);
  if (x < 0 || x > 1 || y < 0 || y > 1) {
    throw new RangeError(`关键点 ${name} 必须位于归一化图片范围内`);
  }
  const confidence = value.confidence == null ? 1 : finite(value.confidence, `${name}.confidence`);
  if (confidence < 0 || confidence > 1) throw new RangeError(`${name}.confidence 必须位于 0 到 1`);
  const source = value.source ?? 'manual';
  if (!['manual', 'adapter', 'inferred'].includes(source)) throw new RangeError(`${name}.source 无效`);
  return {x, y, confidence, source};
}

export function createDefaultLandmarks(mode = 'full', imageAspect = 1) {
  if (!['full', 'head'].includes(mode)) throw new RangeError('图片模式必须是 full 或 head');
  finite(imageAspect, 'imageAspect');
  if (imageAspect <= 0) throw new RangeError('imageAspect 必须大于 0');
  const source = mode === 'full' ? DEFAULT_FULL : DEFAULT_HEAD;
  const horizontalScale = clamp(imageAspect, 0.55, 2.4);
  return Object.fromEntries(Object.entries(source).map(([name, [x, y]]) => [
    name,
    {x: clamp(0.5 + (x - 0.5) * horizontalScale, 0.02, 0.98), y, confidence: 1, source: 'manual'}
  ]));
}

export function validateLandmarks(input, mode = 'full') {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('关键点集合必须是对象');
  const required = mode === 'head' ? HEAD_REQUIRED : FULL_REQUIRED;
  const output = {};
  for (const name of required) {
    if (!Object.hasOwn(input, name)) throw new Error(`缺少关键点：${name}`);
    output[name] = pointFrom(input[name], name);
  }
  for (const [name, value] of Object.entries(input)) {
    if (Object.hasOwn(output, name)) continue;
    if (!Object.hasOwn(LANDMARK_DEFINITIONS, name)) throw new Error(`未知关键点：${name}`);
    output[name] = pointFrom(value, name);
  }
  return output;
}

function averageConfidence(points) {
  if (!points.length) return 0;
  return points.reduce((sum, point) => sum + point.confidence, 0) / points.length;
}

function pxPoint(point, width, height) {
  return {x: point.x * width, y: point.y * height, confidence: point.confidence};
}

function widthBetween(points, leftName, rightName, imageWidth, imageHeight) {
  const a = pxPoint(points[leftName], imageWidth, imageHeight);
  const b = pxPoint(points[rightName], imageWidth, imageHeight);
  return {
    valuePx: Math.abs(b.x - a.x),
    confidence: averageConfidence([a, b]),
    sourceLandmarks: [leftName, rightName]
  };
}

function midpoint(points, aName, bName, imageWidth, imageHeight) {
  const a = pxPoint(points[aName], imageWidth, imageHeight);
  const b = pxPoint(points[bName], imageWidth, imageHeight);
  return {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, confidence: averageConfidence([a, b])};
}

function distancePx(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function measurement(value, confidence, sourceLandmarks, status = 'observed') {
  return {value, confidence: clamp(confidence, 0, 1), sourceLandmarks: [...sourceLandmarks], status};
}

function lineTiltDegrees(points, aName, bName, imageWidth, imageHeight) {
  const a = pxPoint(points[aName], imageWidth, imageHeight);
  const b = pxPoint(points[bName], imageWidth, imageHeight);
  return Math.abs(Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI);
}

function addWarning(warnings, code, severity, message) {
  if (!warnings.some(item => item.code === code)) warnings.push({code, severity, message});
}

export function measureLandmarks(input, options = {}) {
  const mode = options.mode ?? 'full';
  if (!['full', 'head'].includes(mode)) throw new RangeError('图片模式必须是 full 或 head');
  const landmarks = validateLandmarks(input, mode);
  const imageWidth = finite(options.imageWidth ?? 1, 'imageWidth');
  const imageHeight = finite(options.imageHeight ?? 1, 'imageHeight');
  if (imageWidth <= 0 || imageHeight <= 0) throw new RangeError('图片宽高必须大于 0');
  const knownHeightM = options.knownHeightM == null || options.knownHeightM === ''
    ? null
    : finite(Number(options.knownHeightM), 'knownHeightM');
  if (knownHeightM != null && (knownHeightM < 0.8 || knownHeightM > 2.5)) {
    throw new RangeError('已知身高必须位于 0.8 到 2.5 米');
  }

  const warnings = [];
  if (options.looseClothing) addWarning(warnings, 'LOOSE_CLOTHING_RISK', 'warning', '宽松服装会把衣物轮廓误当成人体轮廓。');
  if (options.perspectiveWarning) addWarning(warnings, 'PERSPECTIVE_UNCALIBRATED', 'warning', '当前没有相机标定，透视会影响宽度比例。');
  addWarning(warnings, 'SINGLE_VIEW_DEPTH_UNKNOWN', 'info', '单张图片不能唯一恢复身体前后厚度和真实三维侧脸。');

  const headTop = pxPoint(landmarks.headTop, imageWidth, imageHeight);
  const chin = pxPoint(landmarks.chin, imageWidth, imageHeight);
  const faceHeightPx = Math.abs(chin.y - headTop.y);
  if (faceHeightPx < imageHeight * 0.03) throw new Error('头顶与下巴距离过小，无法计算面部比例');
  const faceWidth = widthBetween(landmarks, 'imageLeftTemple', 'imageRightTemple', imageWidth, imageHeight);
  const jawWidth = landmarks.imageLeftJaw && landmarks.imageRightJaw
    ? widthBetween(landmarks, 'imageLeftJaw', 'imageRightJaw', imageWidth, imageHeight)
    : null;
  const neckWidthRaw = widthBetween(landmarks, 'imageLeftNeck', 'imageRightNeck', imageWidth, imageHeight);

  const measurements = {
    faceWidthByFaceHeight: measurement(faceWidth.valuePx / faceHeightPx, faceWidth.confidence, faceWidth.sourceLandmarks),
    jawWidthByFaceHeight: jawWidth
      ? measurement(jawWidth.valuePx / faceHeightPx, jawWidth.confidence, jawWidth.sourceLandmarks)
      : {value: null, confidence: 0, sourceLandmarks: [], status: 'unknown'},
    faceHeightPx: measurement(faceHeightPx, averageConfidence([headTop, chin]), ['headTop', 'chin'])
  };

  let bodyHeightPx = null;
  let pxPerMeter = null;
  if (mode === 'full') {
    const ankleMid = midpoint(landmarks, 'imageLeftAnkle', 'imageRightAnkle', imageWidth, imageHeight);
    bodyHeightPx = ankleMid.y - headTop.y;
    if (bodyHeightPx <= imageHeight * 0.35) throw new Error('头顶到踝部距离过小，无法计算全身比例');
    if (knownHeightM != null) pxPerMeter = bodyHeightPx / knownHeightM;

    const shoulder = widthBetween(landmarks, 'imageLeftShoulder', 'imageRightShoulder', imageWidth, imageHeight);
    const chest = widthBetween(landmarks, 'imageLeftChest', 'imageRightChest', imageWidth, imageHeight);
    const waist = widthBetween(landmarks, 'imageLeftWaist', 'imageRightWaist', imageWidth, imageHeight);
    const hip = widthBetween(landmarks, 'imageLeftHip', 'imageRightHip', imageWidth, imageHeight);
    const neck = neckWidthRaw;
    const shoulderMid = midpoint(landmarks, 'imageLeftShoulder', 'imageRightShoulder', imageWidth, imageHeight);
    const hipMid = midpoint(landmarks, 'imageLeftHip', 'imageRightHip', imageWidth, imageHeight);
    const leftAnkle = pxPoint(landmarks.imageLeftAnkle, imageWidth, imageHeight);
    const rightAnkle = pxPoint(landmarks.imageRightAnkle, imageWidth, imageHeight);
    const leftHip = pxPoint(landmarks.imageLeftHip, imageWidth, imageHeight);
    const rightHip = pxPoint(landmarks.imageRightHip, imageWidth, imageHeight);
    const leftShoulder = pxPoint(landmarks.imageLeftShoulder, imageWidth, imageHeight);
    const rightShoulder = pxPoint(landmarks.imageRightShoulder, imageWidth, imageHeight);
    const leftElbow = pxPoint(landmarks.imageLeftElbow, imageWidth, imageHeight);
    const rightElbow = pxPoint(landmarks.imageRightElbow, imageWidth, imageHeight);
    const leftWrist = pxPoint(landmarks.imageLeftWrist, imageWidth, imageHeight);
    const rightWrist = pxPoint(landmarks.imageRightWrist, imageWidth, imageHeight);

    Object.assign(measurements, {
      bodyHeightPx: measurement(bodyHeightPx, averageConfidence([headTop, ankleMid]), ['headTop', 'imageLeftAnkle', 'imageRightAnkle']),
      bodyHeightM: knownHeightM == null
        ? {value: null, confidence: 0, sourceLandmarks: [], status: 'unknown'}
        : measurement(knownHeightM, 1, ['user:knownHeightM'], 'manual'),
      shoulderWidthByHeight: measurement(shoulder.valuePx / bodyHeightPx, shoulder.confidence, shoulder.sourceLandmarks),
      chestWidthByHeight: measurement(chest.valuePx / bodyHeightPx, chest.confidence, chest.sourceLandmarks),
      waistWidthByHeight: measurement(waist.valuePx / bodyHeightPx, waist.confidence, waist.sourceLandmarks),
      hipWidthByHeight: measurement(hip.valuePx / bodyHeightPx, hip.confidence, hip.sourceLandmarks),
      neckWidthByHeight: measurement(neck.valuePx / bodyHeightPx, neck.confidence, neck.sourceLandmarks),
      torsoLengthByHeight: measurement(distancePx(shoulderMid, hipMid) / bodyHeightPx, averageConfidence([shoulderMid, hipMid]), ['imageLeftShoulder', 'imageRightShoulder', 'imageLeftHip', 'imageRightHip']),
      leftLegLengthByHeight: measurement(distancePx(leftHip, leftAnkle) / bodyHeightPx, averageConfidence([leftHip, leftAnkle]), ['imageLeftHip', 'imageLeftAnkle']),
      rightLegLengthByHeight: measurement(distancePx(rightHip, rightAnkle) / bodyHeightPx, averageConfidence([rightHip, rightAnkle]), ['imageRightHip', 'imageRightAnkle']),
      leftArmLengthByHeight: measurement((distancePx(leftShoulder, leftElbow) + distancePx(leftElbow, leftWrist)) / bodyHeightPx, averageConfidence([leftShoulder, leftElbow, leftWrist]), ['imageLeftShoulder', 'imageLeftElbow', 'imageLeftWrist']),
      rightArmLengthByHeight: measurement((distancePx(rightShoulder, rightElbow) + distancePx(rightElbow, rightWrist)) / bodyHeightPx, averageConfidence([rightShoulder, rightElbow, rightWrist]), ['imageRightShoulder', 'imageRightElbow', 'imageRightWrist'])
    });

    const shoulderTilt = lineTiltDegrees(landmarks, 'imageLeftShoulder', 'imageRightShoulder', imageWidth, imageHeight);
    const hipTilt = lineTiltDegrees(landmarks, 'imageLeftHip', 'imageRightHip', imageWidth, imageHeight);
    if (shoulderTilt > 5 || hipTilt > 5) addWarning(warnings, 'NON_NEUTRAL_POSE', 'warning', '肩线或髋线倾斜较大，站姿会污染静态体型测量。');
    if (headTop.y / imageHeight > 0.08 || ankleMid.y / imageHeight < 0.90) addWarning(warnings, 'BODY_CROP_MARGIN_LOW', 'warning', '人物接近出画或未覆盖足部，身高比例可信度下降。');
    const legAsymmetry = Math.abs(measurements.leftLegLengthByHeight.value - measurements.rightLegLengthByHeight.value);
    const armAsymmetry = Math.abs(measurements.leftArmLengthByHeight.value - measurements.rightArmLengthByHeight.value);
    if (legAsymmetry > 0.025 || armAsymmetry > 0.025) addWarning(warnings, 'POSE_OR_PERSPECTIVE_ASYMMETRY', 'warning', '左右肢体投影差异较大，可能来自姿势、遮挡或透视。');
  } else {
    addWarning(warnings, 'BODY_MEASUREMENTS_UNAVAILABLE', 'info', '头像模式只生成脸宽与颈部参考，不推断肩腰髋。');
  }

  return {
    mode,
    image: {width: imageWidth, height: imageHeight},
    calibration: {
      knownHeightM,
      pxPerMeter,
      heightApplication: 'observation-only-current-rig-fixed-at-1.75m'
    },
    landmarks,
    measurements,
    warnings
  };
}

function validateBaseMorphs(baseMorphs) {
  if (!baseMorphs || typeof baseMorphs !== 'object' || Array.isArray(baseMorphs)) throw new TypeError('基础外形参数必须是对象');
  const output = {};
  for (const [key, limits] of Object.entries(MORPH_LIMITS)) {
    const value = baseMorphs[key];
    if (!Number.isFinite(value)) throw new Error(`基础外形缺少或损坏：${key}`);
    if (value < limits[0] || value > limits[1]) throw new RangeError(`基础外形越界：${key}`);
    output[key] = value;
  }
  return output;
}

function mapRatio(baseValue, measurementValue, anchor, confidence, limits, gain) {
  if (!Number.isFinite(measurementValue) || measurementValue <= 0) return {value: baseValue, used: false, clamped: false};
  const weightedGain = gain * clamp(confidence, 0, 1);
  const raw = baseValue * Math.exp(Math.log(measurementValue / anchor) * weightedGain);
  const value = clamp(raw, limits[0], limits[1]);
  return {value, used: true, clamped: Math.abs(value - raw) > 1e-9, raw};
}

export function buildCandidateMorphs(measurementResult, baseMorphInput, options = {}) {
  if (!measurementResult || typeof measurementResult !== 'object') throw new TypeError('测量结果必须是对象');
  const baseMorphs = validateBaseMorphs(baseMorphInput);
  const gain = options.gain == null ? 0.68 : finite(Number(options.gain), 'gain');
  if (gain < 0 || gain > 1.25) throw new RangeError('拟合增益必须位于 0 到 1.25');
  const manual = options.manualMorphs ?? {};
  if (!manual || typeof manual !== 'object' || Array.isArray(manual)) throw new TypeError('人工外形参数必须是对象');
  for (const key of Object.keys(manual)) if (!Object.hasOwn(MORPH_LIMITS, key)) throw new Error(`未知人工外形参数：${key}`);

  const mappings = [
    ['shoulderWidth', 'shoulderWidthByHeight'],
    ['chestWidth', 'chestWidthByHeight'],
    ['waistWidth', 'waistWidthByHeight'],
    ['hipWidth', 'hipWidthByHeight'],
    ['neckWidth', 'neckWidthByHeight'],
    ['faceWidth', 'faceWidthByFaceHeight']
  ];
  const morphs = {...baseMorphs};
  const evidence = {};
  const warnings = [...(measurementResult.warnings ?? [])];

  for (const [morphKey, measurementKey] of mappings) {
    const observed = measurementResult.measurements?.[measurementKey];
    if (!observed || observed.status === 'unknown' || !Number.isFinite(observed.value)) {
      evidence[morphKey] = {status: 'unknown', sourceMeasurement: measurementKey, baseValue: baseMorphs[morphKey], targetValue: baseMorphs[morphKey]};
      continue;
    }
    const mapped = mapRatio(baseMorphs[morphKey], observed.value, ENGINEERING_ANCHORS[measurementKey], observed.confidence, MORPH_LIMITS[morphKey], gain);
    morphs[morphKey] = mapped.value;
    evidence[morphKey] = {
      status: mapped.used ? 'candidate' : 'unchanged',
      sourceMeasurement: measurementKey,
      observedValue: observed.value,
      confidence: observed.confidence,
      anchorValue: ENGINEERING_ANCHORS[measurementKey],
      baseValue: baseMorphs[morphKey],
      targetValue: mapped.value,
      unclampedValue: mapped.raw ?? mapped.value,
      clamped: mapped.clamped
    };
    if (mapped.clamped) addWarning(warnings, `MORPH_LIMIT_${morphKey.toUpperCase()}`, 'warning', `${morphKey} 已达到当前母体允许范围，照片目标可能超出系统表达能力。`);
  }

  for (const [key, raw] of Object.entries(manual)) {
    const [min, max] = MORPH_LIMITS[key];
    const value = finite(Number(raw), `manualMorphs.${key}`);
    if (value < min || value > max) throw new RangeError(`人工外形参数越界：${key}`);
    morphs[key] = value;
    evidence[key] = {
      status: 'manual',
      sourceMeasurement: `manual:${key}`,
      confidence: 1,
      baseValue: baseMorphs[key],
      targetValue: value,
      clamped: false
    };
  }

  for (const key of ['limbVolume', 'softness', 'breastProjectionM']) {
    if (!evidence[key]) evidence[key] = {status: 'unknown', sourceMeasurement: null, baseValue: baseMorphs[key], targetValue: morphs[key]};
  }

  return {morphs, evidence, warnings, gain, anchors: {...ENGINEERING_ANCHORS}};
}

function stageKeys(stageOrStages) {
  if (stageOrStages === 'all') return Object.keys(MORPH_LIMITS);
  const stages = Array.isArray(stageOrStages) ? stageOrStages : [stageOrStages];
  const keys = [];
  for (const stage of stages) {
    const definition = FIT_STAGES[stage];
    if (!definition) throw new RangeError(`未知拟合阶段：${stage}`);
    for (const key of definition.keys) if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}

export function applyCandidateToPreset(basePresetInput, candidate, stageOrStages = 'all') {
  if (!basePresetInput || typeof basePresetInput !== 'object' || Array.isArray(basePresetInput)) throw new TypeError('基础人物配方必须是对象');
  if (!candidate?.morphs) throw new TypeError('候选外形缺少 morphs');
  const basePreset = clone(basePresetInput);
  if (!basePreset.appearance?.morphs) throw new Error('基础人物配方缺少 appearance.morphs');
  const keys = stageKeys(stageOrStages);
  for (const key of keys) {
    if (!Object.hasOwn(MORPH_LIMITS, key)) throw new Error(`不可写入的外形参数：${key}`);
    const value = candidate.morphs[key];
    const [min, max] = MORPH_LIMITS[key];
    if (!Number.isFinite(value) || value < min || value > max) throw new RangeError(`候选外形参数越界：${key}`);
    basePreset.appearance.morphs[key] = value;
  }
  return basePreset;
}

export function diffMorphs(baseMorphInput, candidateMorphInput) {
  const base = validateBaseMorphs(baseMorphInput);
  const candidate = validateBaseMorphs(candidateMorphInput);
  return Object.fromEntries(Object.keys(MORPH_LIMITS).map(key => [key, {
    before: base[key],
    after: candidate[key],
    delta: candidate[key] - base[key],
    changed: Math.abs(candidate[key] - base[key]) > 1e-6
  }]));
}

function cleanSource(source = {}) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new TypeError('图片来源必须是对象');
  const forbidden = ['data', 'bytes', 'blob', 'dataUrl', 'objectUrl', 'base64', 'pixels'];
  for (const key of forbidden) if (Object.hasOwn(source, key)) throw new Error(`拟合档案禁止保存图片二进制字段：${key}`);
  return {
    imageId: String(source.imageId ?? 'local-photo-001'),
    fileName: String(source.fileName ?? ''),
    mimeType: String(source.mimeType ?? ''),
    width: Number.isFinite(source.width) ? source.width : null,
    height: Number.isFinite(source.height) ? source.height : null,
    sha256: source.sha256 ? String(source.sha256) : null,
    storage: 'local-session-only'
  };
}

export function createPhotoFitProfile({
  projectId = 'local-photo-fit-test',
  subjectId = 'npc-test-001',
  source,
  measurementResult,
  candidate,
  basePreset,
  stageState = []
}) {
  if (!measurementResult?.landmarks || !measurementResult?.measurements) throw new TypeError('缺少完整测量结果');
  if (!candidate?.morphs || !candidate?.evidence) throw new TypeError('缺少候选外形');
  if (!basePreset?.appearance?.morphs) throw new TypeError('缺少基础人物配方');
  const createdAt = new Date().toISOString();
  return {
    schema: PHOTO_FIT_SCHEMA,
    version: PHOTO_FIT_VERSION,
    projectId: String(projectId),
    subjectId: String(subjectId),
    revision: 1,
    createdAt,
    mode: measurementResult.mode,
    coordinateSystem: {image: 'normalized-top-left', rig: 'right-handed-Y-up-Z-forward'},
    policy: {
      sourceImagePersistence: 'not-embedded',
      mapping: 'engineering-anchor-r0',
      automaticIdentityClaim: false,
      depthInference: 'unknown-unless-multiview',
      heightApplication: measurementResult.calibration?.heightApplication ?? 'observation-only'
    },
    sourceImages: [cleanSource(source)],
    calibration: clone(measurementResult.calibration),
    landmarks: clone(measurementResult.landmarks),
    measurements: clone(measurementResult.measurements),
    candidateMorphs: clone(candidate.morphs),
    morphEvidence: clone(candidate.evidence),
    warnings: clone(candidate.warnings ?? measurementResult.warnings ?? []),
    appliedStages: [...stageState],
    base: {
      schema: basePreset.schema ?? null,
      bodyPlanRevision: basePreset.bodyPlanRevision ?? null,
      bodyArchetype: basePreset.bodyArchetype ?? null,
      bodySex: basePreset.bodySex ?? null,
      statureM: basePreset.statureM ?? null,
      morphs: clone(basePreset.appearance.morphs)
    }
  };
}

export function summarizeCandidate(candidate) {
  const rows = Object.entries(candidate.morphs).map(([key, value]) => ({
    key,
    value,
    status: candidate.evidence?.[key]?.status ?? 'unknown',
    confidence: candidate.evidence?.[key]?.confidence ?? null,
    clamped: candidate.evidence?.[key]?.clamped === true
  }));
  return {rows, warningCount: candidate.warnings?.length ?? 0};
}
