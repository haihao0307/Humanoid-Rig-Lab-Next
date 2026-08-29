import { sampleCorrectiveCurveV1 } from './regional-deformation-profile-v1.js';

export function applyElbowVolumeCorrectiveV1({ positions, coordinates, frame, pose, profile }) {
  const records = [];
  for (const side of ['left', 'right']) {
    const group = coordinates.groups[`${side}Elbow`]; const jointId = `${side}LowerArm`; const degrees = poseChannelDegrees(pose, jointId, 'bend'); const curveWeight = sampleCorrectiveCurveV1(profile.elbow.curve, degrees);
    const center = frame.frames.get(jointId)?.worldPosition; const parent = frame.frames.get(`${side}UpperArmTwist02`)?.worldPosition; if (!center || !parent || curveWeight <= 0) { records.push({ side, degrees, curveWeight, correctedVertexCount: 0 }); continue; }
    const axis = normalize(subtract(center, parent)); const front = frameAxis(frame.frames.get(jointId)?.worldMatrix, 2); let correctedVertexCount = 0; let maximumCorrection = 0;
    for (const vertex of group) {
      const localWeight = coordinates.blendWeight[vertex] * curveWeight; if (localWeight <= 1e-6) continue; const point = read3(positions, vertex); const delta = subtract(point, center); const axial = scale(axis, dot(delta, axis)); const radial = subtract(delta, axial);
      const frontSide = Math.max(0, dot(normalize(radial), front)); const scaleValue = 1 + (profile.elbow.compressionScale - 1) * localWeight; const corrected = add(center, add(axial, add(scale(radial, scaleValue), scale(front, profile.elbow.extensionBulge * localWeight * frontSide))));
      maximumCorrection = Math.max(maximumCorrection, distance(point, corrected)); write3(positions, vertex, corrected); correctedVertexCount += 1;
    }
    records.push({ side, degrees, curveWeight, correctedVertexCount, maximumCorrection });
  }
  return { correctiveId: 'ElbowVolumeCorrectiveV1', curve: profile.elbow.curve, records, returnToZeroExact: records.every((record) => record.degrees !== 0 || record.correctedVertexCount === 0), boneScaleWritten: false };
}

export function applyKneeVolumeCorrectiveV1({ positions, coordinates, frame, pose, profile }) {
  const records = [];
  for (const side of ['left', 'right']) {
    const group = coordinates.groups[`${side}Knee`]; const jointId = `${side}LowerLeg`; const degrees = poseChannelDegrees(pose, jointId, 'bend'); const curveWeight = sampleCorrectiveCurveV1(profile.knee.curve, degrees);
    const center = frame.frames.get(jointId)?.worldPosition; const parent = frame.frames.get(`${side}ThighTwist02`)?.worldPosition; if (!center || !parent || curveWeight <= 0) { records.push({ side, degrees, curveWeight, correctedVertexCount: 0 }); continue; }
    const axis = normalize(subtract(center, parent)); const front = frameAxis(frame.frames.get(jointId)?.worldMatrix, 2); let correctedVertexCount = 0; let maximumCorrection = 0;
    for (const vertex of group) {
      const localWeight = coordinates.blendWeight[vertex] * curveWeight; if (localWeight <= 1e-6) continue; const point = read3(positions, vertex); const delta = subtract(point, center); const axial = scale(axis, dot(delta, axis)); const radial = subtract(delta, axial); const radialUnit = normalize(radial);
      const backSide = Math.max(0, -dot(radialUnit, front)); const frontSide = Math.max(0, dot(radialUnit, front)); const backScale = 1 + (profile.knee.compressionScale - 1) * localWeight * backSide;
      const corrected = add(center, add(axial, add(scale(radial, backScale), scale(front, profile.knee.patellaBulge * localWeight * frontSide))));
      maximumCorrection = Math.max(maximumCorrection, distance(point, corrected)); write3(positions, vertex, corrected); correctedVertexCount += 1;
    }
    records.push({ side, degrees, curveWeight, correctedVertexCount, maximumCorrection });
  }
  return { correctiveId: 'KneeVolumeCorrectiveV1', curve: profile.knee.curve, records, returnToZeroExact: records.every((record) => record.degrees !== 0 || record.correctedVertexCount === 0), boneScaleWritten: false };
}

export function poseChannelDegrees(pose, jointId, channel) {
  const authored = pose.authoredChannels?.find((entry) => entry.jointId === jointId); if (authored && Number.isFinite(authored[channel])) return Number(authored[channel]);
  const regional = pose.regionalAngles?.[jointId]; if (regional && Number.isFinite(regional[channel])) return Number(regional[channel]);
  return 0;
}

function frameAxis(matrix, axis) { if (!matrix) return axis === 2 ? [0, 0, 1] : [1, 0, 0]; const offset = axis * 4; return normalize([matrix[offset], matrix[offset + 1], matrix[offset + 2]]); }
function read3(values, vertex) { const offset = vertex * 3; return [values[offset], values[offset + 1], values[offset + 2]]; }
function write3(values, vertex, point) { const offset = vertex * 3; values[offset] = point[0]; values[offset + 1] = point[1]; values[offset + 2] = point[2]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale(a, value) { return [a[0] * value, a[1] * value, a[2] * value]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function normalize(a) { const length = Math.hypot(...a); return length > 1e-12 ? scale(a, 1 / length) : [0, 0, 1]; }
function distance(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
