export const LONG_BONE_GENERATOR_V1_ID = 'LongBoneGeneratorV1@1.0.0';

export const FEMUR_LOD_SPECS_V1 = Object.freeze({
  0: Object.freeze({ longitudinalSegments: 72, radialSegments: 32 }),
  1: Object.freeze({ longitudinalSegments: 40, radialSegments: 20 }),
  2: Object.freeze({ longitudinalSegments: 24, radialSegments: 12 }),
});

const REQUIRED_PARAMETERS = Object.freeze([
  'femurLength', 'shaftCenterlineKnots', 'shaftAnteriorBow', 'shaftMedialLateralBow',
  'shaftCrossSectionMajor', 'shaftCrossSectionMinor', 'headRadius', 'neckLength',
  'neckShaftAngle', 'femoralAnteversion', 'greaterTrochanterSize', 'lesserTrochanterSize',
  'distalCondyleWidth', 'distalCondyleDepth', 'intercondylarNotchWidth',
  'corticalThickness', 'surfaceDetail', 'leftRightAsymmetry',
]);

/**
 * Generates one closed femur component from parameters. Left and right are
 * evaluated independently; no vertex mirroring, transform scale, or negative
 * scale is used. The returned arrays are already normalized to Float32/Uint32.
 */
export function generateFemurV1(parameters, { side, lod = 0, hipJointCenter = [0, 0, 0] } = {}) {
  validateParameters(parameters, side, lod, hipJointCenter);
  const spec = FEMUR_LOD_SPECS_V1[lod];
  const longitudinalSegments = Math.max(spec.longitudinalSegments, spec.longitudinalSegments + Math.round(parameters.surfaceDetail * (lod === 0 ? 4 : 0)));
  const radialSegments = spec.radialSegments;
  const positions = [];
  const indices = [];
  const ringStarts = [];

  positions.push(...centerlinePoint(parameters, side, 0, hipJointCenter));
  for (let ring = 1; ring < longitudinalSegments; ring += 1) {
    const t = ring / longitudinalSegments;
    ringStarts.push(positions.length / 3);
    const center = centerlinePoint(parameters, side, t, hipJointCenter);
    const frame = crossSectionAt(parameters, side, t);
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const theta = radial / radialSegments * Math.PI * 2;
      const point = crossSectionPoint(parameters, side, t, theta, center, frame);
      positions.push(...point);
    }
  }
  const topPole = positions.length / 3;
  positions.push(...centerlinePoint(parameters, side, 1, hipJointCenter));

  const firstRing = ringStarts[0];
  for (let radial = 0; radial < radialSegments; radial += 1) {
    const next = (radial + 1) % radialSegments;
    indices.push(0, firstRing + radial, firstRing + next);
  }
  for (let ring = 0; ring < ringStarts.length - 1; ring += 1) {
    const lower = ringStarts[ring];
    const upper = ringStarts[ring + 1];
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const next = (radial + 1) % radialSegments;
      indices.push(lower + radial, upper + radial, upper + next);
      indices.push(lower + radial, upper + next, lower + next);
    }
  }
  const lastRing = ringStarts.at(-1);
  for (let radial = 0; radial < radialSegments; radial += 1) {
    const next = (radial + 1) % radialSegments;
    indices.push(lastRing + radial, topPole, lastRing + next);
  }

  const floatPositions = Float32Array.from(positions, Math.fround);
  const uintIndices = Uint32Array.from(indices);
  const normals = computeVertexNormals(floatPositions, uintIndices);
  return Object.freeze({
    generatorId: LONG_BONE_GENERATOR_V1_ID,
    boneId: `${side}_femur`,
    side,
    lod,
    positions: floatPositions,
    normals,
    indices: uintIndices,
    vertexCount: floatPositions.length / 3,
    triangleCount: uintIndices.length / 3,
    closedComponentExpected: true,
    negativeScaleUsed: false,
    runtimeBoneScaleUsed: false,
    parameterSnapshot: structuredClone(parameters),
  });
}

export function getFemurLandmarksV1(parameters, { side, hipJointCenter = [0, 0, 0] } = {}) {
  validateParameters(parameters, side, 0, hipJointCenter);
  const medial = side === 'left' ? 1 : -1;
  const lateral = -medial;
  const samples = {
    head_center: centerlinePoint(parameters, side, 0.965, hipJointCenter),
    neck_center: centerlinePoint(parameters, side, 0.895, hipJointCenter),
    greater_trochanter: centerlinePoint(parameters, side, 0.82, hipJointCenter),
    lesser_trochanter: centerlinePoint(parameters, side, 0.74, hipJointCenter),
    medial_condyle: centerlinePoint(parameters, side, 0.035, hipJointCenter),
    lateral_condyle: centerlinePoint(parameters, side, 0.035, hipJointCenter),
    intercondylar_notch: centerlinePoint(parameters, side, 0.025, hipJointCenter),
  };
  samples.greater_trochanter[0] += lateral * parameters.greaterTrochanterSize;
  samples.lesser_trochanter[0] += medial * parameters.lesserTrochanterSize * 0.55;
  samples.lesser_trochanter[2] -= parameters.lesserTrochanterSize * 0.7;
  samples.medial_condyle[0] += medial * parameters.distalCondyleWidth * 0.48;
  samples.lateral_condyle[0] += lateral * parameters.distalCondyleWidth * 0.48;
  samples.intercondylar_notch[2] -= parameters.distalCondyleDepth * 0.48;
  return Object.fromEntries(Object.entries(samples).map(([id, position]) => [`${side}_femur_${id}`, position.map(Math.fround)]));
}

function centerlinePoint(parameters, side, t, origin) {
  const medial = side === 'left' ? 1 : -1;
  const length = parameters.femurLength;
  const neckInclination = (180 - parameters.neckShaftAngle) * Math.PI / 180;
  const neckOffset = parameters.neckLength * Math.sin(neckInclination);
  const neckProgress = smoothstep(0.77, 0.98, t);
  const knotOffset = sampleCenterlineKnots(parameters.shaftCenterlineKnots, t);
  const asymmetry = side === 'left' ? parameters.leftRightAsymmetry : -parameters.leftRightAsymmetry;
  const x = medial * (
    -neckOffset * (1 - neckProgress)
    + parameters.shaftMedialLateralBow * Math.sin(Math.PI * t)
    + knotOffset.medialLateralOffset
    + asymmetry * length * 0.0025 * Math.sin(Math.PI * t)
  );
  const y = -length * (1 - t);
  const z = parameters.shaftAnteriorBow * Math.sin(Math.PI * t) + knotOffset.anteriorOffset;
  return [Math.fround(origin[0] + x), Math.fround(origin[1] + y), Math.fround(origin[2] + z)];
}

function crossSectionAt(parameters, side, t) {
  const length = parameters.femurLength;
  const shaftMajor = parameters.shaftCrossSectionMajor;
  const shaftMinor = parameters.shaftCrossSectionMinor;
  const keyframes = [
    [0, 0, 0],
    [0.018, parameters.distalCondyleWidth * 0.49, parameters.distalCondyleDepth * 0.49],
    [0.07, parameters.distalCondyleWidth * 0.43, parameters.distalCondyleDepth * 0.44],
    [0.14, shaftMajor * 1.35, shaftMinor * 1.3],
    [0.28, shaftMajor, shaftMinor],
    [0.62, shaftMajor * 0.94, shaftMinor * 0.96],
    [0.74, shaftMajor * 1.2, shaftMinor * 1.18],
    [0.82, shaftMajor + parameters.greaterTrochanterSize * 0.55, shaftMinor + parameters.greaterTrochanterSize * 0.3],
    [0.88, Math.max(shaftMajor * 0.95, parameters.corticalThickness * 3.5), Math.max(shaftMinor * 0.95, parameters.corticalThickness * 3.2)],
    [0.945, parameters.headRadius * 0.92, parameters.headRadius * 0.92],
    [0.975, parameters.headRadius, parameters.headRadius],
    [1, 0, 0],
  ];
  const [rx, rz] = samplePairKeyframes(keyframes, t);
  const sideAngle = (side === 'left' ? 1 : -1) * parameters.femoralAnteversion * Math.PI / 180 * smoothstep(0.3, 0.94, t);
  return { rx: Math.max(length * 1e-5, rx), rz: Math.max(length * 1e-5, rz), twist: sideAngle };
}

function crossSectionPoint(parameters, side, t, theta, center, frame) {
  const medial = side === 'left' ? 1 : -1;
  const lateral = -medial;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const lateralWeight = Math.max(0, lateral * cos) ** 4;
  const medialPosteriorWeight = Math.max(0, medial * cos) ** 3 * Math.max(0, -sin) ** 2;
  const trochanterBump = gaussian(t, 0.815, 0.045) * parameters.greaterTrochanterSize * lateralWeight;
  const lesserBump = gaussian(t, 0.735, 0.035) * parameters.lesserTrochanterSize * medialPosteriorWeight;
  const notchAngular = gaussianAngle(theta, -Math.PI / 2, 0.42);
  const notchDepth = gaussian(t, 0.035, 0.035) * Math.min(0.42, parameters.intercondylarNotchWidth / parameters.distalCondyleWidth) * notchAngular;
  const detail = parameters.surfaceDetail * 0.00022 * Math.sin(theta * 5 + t * 31) * Math.sin(Math.PI * t) ** 2;
  const localX = (frame.rx + trochanterBump + lesserBump + detail) * cos;
  const localZ = (frame.rz + trochanterBump * 0.28 + lesserBump * 0.45 + detail) * sin * (1 - notchDepth);
  const twistCos = Math.cos(frame.twist);
  const twistSin = Math.sin(frame.twist);
  return [
    Math.fround(center[0] + localX * twistCos - localZ * twistSin),
    Math.fround(center[1]),
    Math.fround(center[2] + localX * twistSin + localZ * twistCos),
  ];
}

function computeVertexNormals(positions, indices) {
  const normals = new Float64Array(positions.length);
  for (let index = 0; index < indices.length; index += 3) {
    const ia = indices[index] * 3;
    const ib = indices[index + 1] * 3;
    const ic = indices[index + 2] * 3;
    const ab = [positions[ib] - positions[ia], positions[ib + 1] - positions[ia + 1], positions[ib + 2] - positions[ia + 2]];
    const ac = [positions[ic] - positions[ia], positions[ic + 1] - positions[ia + 1], positions[ic + 2] - positions[ia + 2]];
    const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    for (const vertex of [ia, ib, ic]) for (let component = 0; component < 3; component += 1) normals[vertex + component] += cross[component];
  }
  const output = new Float32Array(normals.length);
  for (let index = 0; index < normals.length; index += 3) {
    const length = Math.hypot(normals[index], normals[index + 1], normals[index + 2]);
    if (!(length > 1e-16)) throw new Error(`LongBoneGeneratorV1 produced an undefined normal at vertex ${index / 3}.`);
    output[index] = Math.fround(normals[index] / length);
    output[index + 1] = Math.fround(normals[index + 1] / length);
    output[index + 2] = Math.fround(normals[index + 2] / length);
  }
  return output;
}

function sampleCenterlineKnots(knots, t) {
  const normalized = knots.map((knot) => ({ t: Number(knot.t), anteriorOffset: Number(knot.anteriorOffset), medialLateralOffset: Number(knot.medialLateralOffset) })).sort((a, b) => a.t - b.t);
  if (t <= normalized[0].t) return normalized[0];
  if (t >= normalized.at(-1).t) return normalized.at(-1);
  const upperIndex = normalized.findIndex((knot) => knot.t >= t);
  const lower = normalized[upperIndex - 1];
  const upper = normalized[upperIndex];
  const alpha = (t - lower.t) / (upper.t - lower.t);
  return { anteriorOffset: lerp(lower.anteriorOffset, upper.anteriorOffset, alpha), medialLateralOffset: lerp(lower.medialLateralOffset, upper.medialLateralOffset, alpha) };
}

function samplePairKeyframes(keyframes, t) {
  const upperIndex = keyframes.findIndex(([key]) => key >= t);
  if (upperIndex <= 0) return keyframes[0].slice(1);
  const lower = keyframes[upperIndex - 1];
  const upper = keyframes[upperIndex];
  const alpha = smoothstep(lower[0], upper[0], t);
  return [lerp(lower[1], upper[1], alpha), lerp(lower[2], upper[2], alpha)];
}

function validateParameters(parameters, side, lod, origin) {
  if (!parameters || typeof parameters !== 'object') throw new Error('LongBoneGeneratorV1 requires parameters.');
  for (const key of REQUIRED_PARAMETERS) if (!(key in parameters)) throw new Error(`LongBoneGeneratorV1 is missing ${key}.`);
  for (const key of REQUIRED_PARAMETERS.filter((key) => key !== 'shaftCenterlineKnots')) if (!Number.isFinite(Number(parameters[key]))) throw new Error(`${key} must be finite.`);
  if (!Array.isArray(parameters.shaftCenterlineKnots) || parameters.shaftCenterlineKnots.length < 2) throw new Error('shaftCenterlineKnots requires at least two records.');
  if (!['left', 'right'].includes(side)) throw new Error('Femur side must be left or right.');
  if (!(lod in FEMUR_LOD_SPECS_V1)) throw new Error(`Unsupported femur LOD ${lod}.`);
  if (!Array.isArray(origin) || origin.length !== 3 || origin.some((value) => !Number.isFinite(Number(value)))) throw new Error('hipJointCenter must contain three finite values.');
  for (const key of ['femurLength', 'shaftCrossSectionMajor', 'shaftCrossSectionMinor', 'headRadius', 'neckLength', 'greaterTrochanterSize', 'lesserTrochanterSize', 'distalCondyleWidth', 'distalCondyleDepth', 'intercondylarNotchWidth', 'corticalThickness']) {
    if (!(parameters[key] > 0)) throw new Error(`${key} must be positive.`);
  }
}

function smoothstep(minimum, maximum, value) { const t = Math.min(1, Math.max(0, (value - minimum) / (maximum - minimum))); return t * t * (3 - 2 * t); }
function gaussian(value, center, width) { const x = (value - center) / width; return Math.exp(-0.5 * x * x); }
function gaussianAngle(value, center, width) { const delta = Math.atan2(Math.sin(value - center), Math.cos(value - center)); return Math.exp(-0.5 * (delta / width) ** 2); }
function lerp(left, right, alpha) { return left + (right - left) * alpha; }
