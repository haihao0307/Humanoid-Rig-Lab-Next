import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  HumanCoreRuntime,
  PROCEDURAL_BODY_DNA_PRESETS_V5,
  ProceduralDeformRuntimeV5,
  createBodyDNA,
  createProceduralDeformValidationPoseV5,
} from '../src/modules/human-core-v5/index.js';

const ASSERT_MODE = process.argv.includes('--assert');
const BASELINE_PATH = resolve('artifacts/qa/task14c-geometry-v1/stage2/joint-surface-baseline-649ab94.json');
const OUTPUT_PATH = ASSERT_MODE
  ? resolve('artifacts/qa/task14c-geometry-v1/stage2/joint-surface-metrics.json')
  : BASELINE_PATH;
const STATIONS = Object.freeze([0.10, 0.25, 0.40, 0.55, 0.70, 0.85, 0.95]);
const MINIMUM_SELECTED_VERTICES = 40;
const PRESET_POSES = Object.freeze({
  Reference: ['t-pose', 'arm-raise-150-left', 'forearm-twist-180-left', 'elbow-bend-140-left', 'hip-flex-left', 'knee-bend-left'],
  Muscular: ['arm-raise-150-left', 'forearm-twist-180-left', 'elbow-bend-140-left'],
  Heavy: ['arm-raise-150-left', 'hip-flex-left', 'knee-bend-left'],
  Short: ['hip-flex-left', 'knee-bend-left'],
  Asymmetric: [
    'arm-raise-150-left', 'arm-raise-150-right',
    'forearm-twist-180-left', 'forearm-twist-180-right',
    'elbow-bend-140-left', 'elbow-bend-140-right',
    'hip-flex-left', 'hip-flex-right',
    'knee-bend-left', 'knee-bend-right',
  ],
});

const baseline = ASSERT_MODE ? JSON.parse(await readFile(BASELINE_PATH, 'utf8')) : null;
const report = {
  schema: 'humanoid_rig/procedural_joint_surface_diagnostic@5.0',
  task: 'Task 14C-1B Stage 2',
  mode: ASSERT_MODE ? 'assert' : 'baseline',
  poseAuthority: 'finalPose.localRotations',
  coordinatePolicy: 'canonical-layout-landmarks-plus-HumanRigCore-axisReference-local-frames',
  selectionPolicy: 'surface-regionIds-plus-regionBlendWeights-plus-regionAxialU',
  minimumSelectedVertexCount: MINIMUM_SELECTED_VERTICES,
  presets: {},
  summary: { measurementCount: 0, passedCount: 0, failedCount: 0, allPassed: false },
};

for (const [preset, poseIds] of Object.entries(PRESET_POSES)) {
  const bodyDNA = createBodyDNA({
    ...PROCEDURAL_BODY_DNA_PRESETS_V5[preset],
    bodyDNAId: `task14c-stage2-${preset.toLowerCase()}`,
    identity: { humanId: `task14c-stage2-${preset.toLowerCase()}`, label: preset },
    proportionRevision: 14,
  });
  const human = new HumanCoreRuntime();
  human.createHuman(bodyDNA);
  const rigCore = human.getRigCore();
  const runtime = new ProceduralDeformRuntimeV5();
  const definition = runtime.compileHuman({ bodyDNA, rigCore });
  await runtime.generateCanonicalSurface({ resolution: 36, worker: false });
  const neutralPose = createProceduralDeformValidationPoseV5({ poseId: 't-pose', rigCore, bodyDNA, timestamp: 1 });
  human.updatePose(neutralPose);
  const neutralFrame = runtime.update({ finalPose: neutralPose, anatomyState: human.getAnatomyState(), timestamp: 1 });
  const neutral = captureState({ runtime, frame: neutralFrame, pose: neutralPose, definition, rigCore });
  const presetReport = {
    bodyDNAFingerprint: bodyDNA.bodyDNAFingerprint,
    topologyFingerprint: neutralFrame.topologyFingerprint,
    scenarios: [],
  };

  for (const poseId of poseIds) {
    const side = poseId.endsWith('-right') ? 'right' : 'left';
    const sourcePoseId = poseId.replace('-right', '-left');
    let pose = createProceduralDeformValidationPoseV5({ poseId: sourcePoseId, rigCore, bodyDNA, timestamp: 2 });
    if (side === 'right') pose = mirrorValidationPose(pose, poseId);
    human.updatePose(pose);
    const frame = runtime.update({ finalPose: pose, anatomyState: human.getAnatomyState(), timestamp: 2 });
    assert.equal(frame.poseAuthority, 'finalPose.localRotations');
    const state = captureState({ runtime, frame, pose, definition, rigCore });
    const scenario = measureScenario({ preset, poseId, side, neutral, state, baseline });
    presetReport.scenarios.push(scenario);
    for (const measurement of scenario.measurements) {
      report.summary.measurementCount += 1;
      if (measurement.passed) report.summary.passedCount += 1;
      else report.summary.failedCount += 1;
    }
  }
  report.presets[preset] = presetReport;
  runtime.dispose();
}

report.summary.allPassed = report.summary.failedCount === 0;
await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output: OUTPUT_PATH, ...report.summary }));
if (ASSERT_MODE) assert.equal(report.summary.allPassed, true, `${report.summary.failedCount} anatomical joint-surface measurements failed; see ${OUTPUT_PATH}`);

function captureState({ runtime, frame, pose, definition, rigCore }) {
  const quality = runtime.analyzeCurrentDeformationQuality();
  return {
    frame,
    pose,
    definition,
    rigCore,
    surface: runtime.surface,
    quality,
  };
}

function measureScenario({ preset, poseId, side, neutral, state, baseline: baselineReport }) {
  const measurements = [];
  if (poseId === 't-pose') addGlobalMeasurements(measurements, { preset, poseId, side, neutral, state });
  if (poseId.startsWith('arm-raise-150')) addShoulderMeasurements(measurements, { preset, poseId, side, neutral, state, baselineReport });
  if (poseId.startsWith('forearm-twist-180')) addTwistMeasurements(measurements, { preset, poseId, side, neutral, state });
  if (poseId.startsWith('elbow-bend-140')) addHingeMeasurements(measurements, { preset, poseId, side, neutral, state, joint: 'elbow' });
  if (poseId.startsWith('hip-flex')) addHipMeasurements(measurements, { preset, poseId, side, neutral, state });
  if (poseId.startsWith('knee-bend')) addHingeMeasurements(measurements, { preset, poseId, side, neutral, state, joint: 'knee' });
  addGlobalMeasurements(measurements, { preset, poseId, side, neutral, state });
  return {
    preset,
    poseId,
    side,
    passed: measurements.every((entry) => entry.passed),
    measurements,
  };
}

function addShoulderMeasurements(output, context) {
  const { preset, poseId, side, neutral, state, baselineReport } = context;
  const region = `${side}UpperArm`;
  const indices = selectVertices(state.surface, [{ region, minimumWeight: 0.12, maximumAxialU: 0.32 }]);
  const frame0 = anatomicalFrame(neutral, `${side}UpperArm`, side, 'shoulder');
  const frame1 = anatomicalFrame(state, `${side}UpperArm`, side, 'shoulder');
  const p0 = localPoints(neutral.frame.deformedPositions, indices, frame0);
  const p1 = localPoints(state.frame.deformedPositions, indices, frame1);
  ensureSelection(indices, preset, poseId, 'shoulder');
  const radius0 = quantile(p0.map(radialRadius), 0.80);
  const radius1 = quantile(p1.map(radialRadius), 0.80);
  const underside0 = p0.filter((point) => point[2] < 0);
  const underside1 = p1.filter((point) => point[2] < 0);
  const notch0 = Math.max(0, quantile(underside0.map(radialRadius), 0.75) - quantile(underside0.map(radialRadius), 0.10));
  const notch1 = Math.max(0, quantile(underside1.map(radialRadius), 0.75) - quantile(underside1.map(radialRadius), 0.10));
  const bridge0 = 2 * quantile(p0.map(radialRadius), 0.10);
  const bridge1 = 2 * quantile(p1.map(radialRadius), 0.10);
  const baselineNotch = lookupBaselineValue(baselineReport, preset, poseId, side, 'axillaryNotchDepthMeters') ?? notch0;
  metric(output, context, indices.length, frame1, 'axillaryNotchDepthMeters', notch0, notch1, {
    operator: '<=', value: 0.55, normalization: 'shoulderRadius', normalizedValue: safeRatio(notch1, radius1),
    baselineOperator: '<=', baselineRatio: 0.70, baselineValue: baselineNotch,
  }, safeRatio(notch1, radius1) <= 0.55 && (!ASSERT_MODE || safeRatio(notch1, baselineNotch) <= 0.70));
  metric(output, context, indices.length, frame1, 'shoulderBridgeThicknessMeters', bridge0, bridge1, {
    operator: '>=', value: 0.35, normalization: 'shoulderDiameter', normalizedValue: safeRatio(bridge1, 2 * radius1),
  }, safeRatio(bridge1, 2 * radius1) >= 0.35);
  const normalP95 = normalDeviationP95(neutral, state, indices, frame0, frame1);
  metric(output, context, indices.length, frame1, 'normalDeviationP95Degrees', 0, normalP95, { operator: '<=', value: 75 }, normalP95 <= 75);
  const volumeRatio = covarianceVolumeRatio(p0, p1);
  metric(output, context, indices.length, frame1, 'deltoidVolumeRatio', 1, volumeRatio, { operator: 'between', minimum: 0.80, maximum: 1.25 }, between(volumeRatio, 0.80, 1.25));
}

function addTwistMeasurements(output, context) {
  const { preset, poseId, side, neutral, state } = context;
  const region = `${side}Forearm`;
  const frame0 = anatomicalFrame(neutral, `${side}LowerArm`, side, 'elbow');
  const frame1 = anatomicalFrame(state, `${side}LowerArm`, side, 'elbow');
  const stationRecords = [];
  for (const station of STATIONS) {
    const indices = selectVertices(state.surface, [{ region, minimumWeight: 0.15, axialCenter: station, axialHalfWidth: 0.10 }]);
    ensureSelection(indices, preset, poseId, `forearm-${station}`);
    const p0 = localPoints(neutral.frame.deformedPositions, indices, frame0);
    const p1 = localPoints(state.frame.deformedPositions, indices, frame1);
    const section0 = sectionStatistics(p0);
    const section1 = sectionStatistics(p1);
    stationRecords.push({ station, angle: section1.angle });
    const rmsRatio = safeRatio(section1.rmsRadius, section0.rmsRadius);
    const minimumRadiusRatio = safeRatio(section1.minimumRadius, section0.minimumRadius);
    const maximumRadiusRatio = safeRatio(section1.maximumRadius, section0.maximumRadius);
    const areaRatio = safeRatio(section1.area, section0.area);
    metric(output, context, indices.length, frame1, `forearmStation${station.toFixed(2)}RmsRadiusRatio`, 1, rmsRatio, { operator: '>=', value: 0.90 }, rmsRatio >= 0.90);
    metric(output, context, indices.length, frame1, `forearmStation${station.toFixed(2)}MinimumRadiusRatio`, 1, minimumRadiusRatio, { operator: '>=', value: 0.88 }, minimumRadiusRatio >= 0.88);
    metric(output, context, indices.length, frame1, `forearmStation${station.toFixed(2)}MaximumRadiusRatio`, 1, maximumRadiusRatio, { operator: '<=', value: 1.15 }, maximumRadiusRatio <= 1.15);
    metric(output, context, indices.length, frame1, `forearmStation${station.toFixed(2)}AreaRatio`, 1, areaRatio, { operator: 'between', minimum: 0.78, maximum: 1.22 }, between(areaRatio, 0.78, 1.22));
  }
  const stationAngles = unwrapAngles(stationRecords.map((record) => record.angle));
  for (let index = 1; index < stationAngles.length; index += 1) {
    const delta = Math.abs(toDegrees(stationAngles[index] - stationAngles[index - 1]));
    metric(output, context, MINIMUM_SELECTED_VERTICES, frame1, `adjacentTwistDelta${STATIONS[index - 1].toFixed(2)}-${STATIONS[index].toFixed(2)}Degrees`, 0, delta, { operator: '<=', value: 55 }, delta <= 55);
  }
  const all = selectVertices(state.surface, [{ region, minimumWeight: 0.15, minimumAxialU: 0.05, maximumAxialU: 0.99 }]);
  const radii = STATIONS.map((station) => {
    const indices = selectVertices(state.surface, [{ region, minimumWeight: 0.15, axialCenter: station, axialHalfWidth: 0.10 }]);
    return sectionStatistics(localPoints(state.frame.deformedPositions, indices, frame1)).rmsRadius;
  });
  const radiusCV = standardDeviation(radii) / mean(radii);
  metric(output, context, all.length, frame1, 'forearmRadiusCoefficientOfVariation', 0, radiusCV, { operator: '<=', value: 0.24 }, radiusCV <= 0.24);
}

function addHingeMeasurements(output, context) {
  const { preset, poseId, side, neutral, state, joint } = context;
  const isElbow = joint === 'elbow';
  const proximalRegion = `${side}${isElbow ? 'UpperArm' : 'Thigh'}`;
  const distalRegion = `${side}${isElbow ? 'Forearm' : 'Calf'}`;
  const sourceJoint = `${side}${isElbow ? 'LowerArm' : 'LowerLeg'}`;
  const indices = selectVertices(state.surface, [
    { region: proximalRegion, minimumWeight: 0.10, minimumAxialU: 0.70 },
    { region: distalRegion, minimumWeight: 0.10, maximumAxialU: 0.28 },
  ]);
  ensureSelection(indices, preset, poseId, joint);
  const frame0 = anatomicalFrame(neutral, sourceJoint, side, joint);
  const frame1 = anatomicalFrame(state, sourceJoint, side, joint);
  const p0 = localPoints(neutral.frame.deformedPositions, indices, frame0);
  const p1 = localPoints(state.frame.deformedPositions, indices, frame1);
  const inner0 = p0.filter((point) => point[2] < 0).map(radialRadius);
  const inner1 = p1.filter((point) => point[2] < 0).map(radialRadius);
  const outer0 = p0.filter((point) => point[2] >= 0).map(radialRadius);
  const outer1 = p1.filter((point) => point[2] >= 0).map(radialRadius);
  const compression = safeRatio(quantile(inner1, 0.50), quantile(inner0, 0.50));
  const outerRetention = safeRatio(quantile(outer1, 0.75), quantile(outer0, 0.75));
  const thickness = safeRatio(quantile(p1.map(radialRadius), 0.08), quantile(p0.map(radialRadius), 0.08));
  const volumeRatio = covarianceVolumeRatio(p0, p1);
  const normalP95 = normalDeviationP95(neutral, state, indices, frame0, frame1);
  metric(output, context, indices.length, frame1, `${joint}InnerCompressionRatio`, 1, compression, { operator: 'between', minimum: isElbow ? 0.40 : 0.35, maximum: 0.82 }, between(compression, isElbow ? 0.40 : 0.35, 0.82));
  metric(output, context, indices.length, frame1, `${joint}${isElbow ? 'OuterArc' : 'Anterior'}RetentionRatio`, 1, outerRetention, { operator: '>=', value: 0.88 }, outerRetention >= 0.88);
  metric(output, context, indices.length, frame1, `${joint}MinimumThicknessRatio`, 1, thickness, { operator: '>=', value: 0.40 }, thickness >= 0.40);
  metric(output, context, indices.length, frame1, 'normalDeviationP95Degrees', 0, normalP95, { operator: '<=', value: 80 }, normalP95 <= 80);
  metric(output, context, indices.length, frame1, `${joint}VolumeRatio`, 1, volumeRatio, { operator: 'between', minimum: 0.75, maximum: 1.25 }, between(volumeRatio, 0.75, 1.25));
}

function addHipMeasurements(output, context) {
  const { preset, poseId, side, neutral, state } = context;
  const region = `${side}Thigh`;
  const indices = selectVertices(state.surface, [
    { region, minimumWeight: 0.10, maximumAxialU: 0.30 },
    { region: 'pelvis', minimumWeight: 0.12 },
  ]).filter((vertex) => nearHipLandmark(state, vertex, side));
  ensureSelection(indices, preset, poseId, 'hip');
  const frame0 = anatomicalFrame(neutral, `${side}UpperLeg`, side, 'hip');
  const frame1 = anatomicalFrame(state, `${side}UpperLeg`, side, 'hip');
  const p0 = localPoints(neutral.frame.deformedPositions, indices, frame0);
  const p1 = localPoints(state.frame.deformedPositions, indices, frame1);
  const radius0 = quantile(p0.map(radialRadius), 0.80);
  const radius1 = quantile(p1.map(radialRadius), 0.80);
  const medial0 = p0.filter((point) => point[1] < 0).map((point) => Math.abs(point[1]));
  const medial1 = p1.filter((point) => point[1] < 0).map((point) => Math.abs(point[1]));
  const separation0 = 2 * quantile(medial0, 0.08);
  const separation1 = 2 * quantile(medial1, 0.08);
  const bridge0 = 2 * quantile(p0.map(radialRadius), 0.10);
  const bridge1 = 2 * quantile(p1.map(radialRadius), 0.10);
  const normalP95 = normalDeviationP95(neutral, state, indices, frame0, frame1);
  const volumeRatio = covarianceVolumeRatio(p0, p1);
  metric(output, context, indices.length, frame1, 'groinSeparationMeters', separation0, separation1, {
    operator: 'all', minimumMeters: 0.006, minimumRadiusRatio: 0.10, normalizedValue: safeRatio(separation1, radius1),
  }, separation1 >= 0.006 && safeRatio(separation1, radius1) >= 0.10);
  metric(output, context, indices.length, frame1, 'hipBridgeThicknessRatio', safeRatio(bridge0, 2 * radius0), safeRatio(bridge1, 2 * radius1), { operator: '>=', value: 0.40 }, safeRatio(bridge1, 2 * radius1) >= 0.40);
  metric(output, context, indices.length, frame1, 'normalDeviationP95Degrees', 0, normalP95, { operator: '<=', value: 80 }, normalP95 <= 80);
  metric(output, context, indices.length, frame1, 'hipVolumeRatio', 1, volumeRatio, { operator: 'between', minimum: 0.75, maximum: 1.25 }, between(volumeRatio, 0.75, 1.25));
}

function addGlobalMeasurements(output, context) {
  const { state } = context;
  const quality = state.quality;
  const selectedVertexCount = state.frame.deformedPositions.length / 3;
  const frame = { id: 'whole-surface', origin: [0, 0, 0], axes: { axial: [1, 0, 0], radialA: [0, 1, 0], radialB: [0, 0, 1] } };
  for (const [name, value] of [
    ['triangleFlipCount', quality.triangleFlipCount],
    ['localFoldoverCount', quality.localFoldoverCount],
    ['criticalRegionSelfIntersectionCount', quality.criticalRegionSelfIntersectionCount],
  ]) metric(output, context, selectedVertexCount, frame, name, 0, value, { operator: '===', value: 0 }, value === 0);
  metric(output, context, selectedVertexCount, frame, 'triangleAreaRatioMinimum', 1, quality.triangleAreaRatioMinimum, { operator: '>=', value: 0.15 }, quality.triangleAreaRatioMinimum >= 0.15);
  metric(output, context, selectedVertexCount, frame, 'triangleAreaRatioMaximum', 1, quality.triangleAreaRatioMaximum, { operator: '<=', value: 6.0 }, quality.triangleAreaRatioMaximum <= 6.0);
}

function metric(output, context, selectedVertexCount, frame, metricName, neutralValue, posedValue, threshold, passed) {
  const { preset, poseId, side } = context;
  output.push({
    preset,
    poseId,
    side,
    metric: metricName,
    selectedVertexCount,
    localFrame: {
      id: frame.id,
      origin: roundVector(frame.origin),
      axes: Object.fromEntries(Object.entries(frame.axes).map(([key, value]) => [key, roundVector(value)])),
      sources: frame.sources ?? ['canonicalLayout.rigLandmarks', 'HumanRigCore.axisReference'],
    },
    neutralValue: round(neutralValue),
    posedValue: round(posedValue),
    ratio: round(safeRatio(posedValue, neutralValue)),
    threshold,
    passed: Boolean(passed) && selectedVertexCount >= MINIMUM_SELECTED_VERTICES,
  });
}

function selectVertices(surface, selectors) {
  const result = new Set();
  for (let vertex = 0; vertex < surface.positions.length / 3; vertex += 1) {
    for (const selector of selectors) {
      const regionIndex = surface.regionNames.indexOf(selector.region);
      for (let influence = 0; influence < 4; influence += 1) {
        const offset = vertex * 4 + influence;
        if (surface.regionIds[offset] !== regionIndex) continue;
        if (surface.regionBlendWeights[offset] < (selector.minimumWeight ?? 0)) continue;
        const axialU = surface.regionAxialU[offset];
        if (axialU < (selector.minimumAxialU ?? 0) || axialU > (selector.maximumAxialU ?? 1)) continue;
        if (selector.axialCenter != null && Math.abs(axialU - selector.axialCenter) > selector.axialHalfWidth) continue;
        result.add(vertex);
      }
    }
  }
  return [...result];
}

function nearHipLandmark(state, vertex, side) {
  const point = readVector(state.surface.positions, vertex);
  const hip = state.definition.canonicalLayout.rigLandmarks[side].hip;
  const other = state.definition.canonicalLayout.rigLandmarks[side === 'left' ? 'right' : 'left'].hip;
  const hipSpan = distance(hip, other);
  return distance(point, hip) <= hipSpan * 1.65;
}

function anatomicalFrame(state, sourceJointId, side, landmark) {
  const semantic = state.rigCore.joints.find((joint) => joint.jointId === sourceJointId);
  assert.ok(semantic?.axisReference, `Missing HumanRigCore axisReference for ${sourceJointId}`);
  const layoutLandmark = state.definition.canonicalLayout.rigLandmarks[side][landmark];
  assert.ok(layoutLandmark, `Missing canonicalLayout.rigLandmarks.${side}.${landmark}`);
  const regionName = sourceJointId.replace('LowerArm', 'Forearm').replace('UpperLeg', 'Thigh').replace('LowerLeg', 'Calf');
  const diagnostic = state.frame.regionDiagnostics[regionName];
  const q = diagnostic?.rotation ?? [0, 0, 0, 1];
  const origin = diagnostic?.posedAnchor ?? layoutLandmark;
  const axial = normalize(rotate(q, semantic.axisReference.twistAxisLocal));
  const radialA = normalize(rotate(q, semantic.axisReference.sideAxisLocal));
  const radialB = normalize(cross(axial, radialA));
  return {
    id: `${sourceJointId}-${landmark}-anatomical-local`,
    origin,
    axes: { axial, radialA, radialB },
    sources: [`canonicalLayout.rigLandmarks.${side}.${landmark}`, `${sourceJointId}.axisReference`],
  };
}

function localPoints(positions, indices, frame) {
  return indices.map((vertex) => {
    const delta = subtract(readVector(positions, vertex), frame.origin);
    return [dot(delta, frame.axes.axial), dot(delta, frame.axes.radialA), dot(delta, frame.axes.radialB)];
  });
}

function normalDeviationP95(neutral, state, indices, frame0, frame1) {
  const values = indices.map((vertex) => {
    const normal0 = readVector(neutral.frame.deformedNormals, vertex);
    const local = [dot(normal0, frame0.axes.axial), dot(normal0, frame0.axes.radialA), dot(normal0, frame0.axes.radialB)];
    const expected = normalize(add(add(scale(frame1.axes.axial, local[0]), scale(frame1.axes.radialA, local[1])), scale(frame1.axes.radialB, local[2])));
    const actual = normalize(readVector(state.frame.deformedNormals, vertex));
    return toDegrees(Math.acos(clamp(dot(expected, actual), -1, 1)));
  });
  return quantile(values, 0.95);
}

function sectionStatistics(points) {
  const ys = points.map((point) => point[1]);
  const zs = points.map((point) => point[2]);
  const cy = mean(ys); const cz = mean(zs);
  const centered = points.map((point) => [point[1] - cy, point[2] - cz]);
  const radii = centered.map(([y, z]) => Math.hypot(y, z));
  const yy = mean(centered.map(([y]) => y * y));
  const zz = mean(centered.map(([, z]) => z * z));
  const yz = mean(centered.map(([y, z]) => y * z));
  const trace = yy + zz;
  const disc = Math.sqrt(Math.max(0, (yy - zz) ** 2 + 4 * yz ** 2));
  const major = Math.sqrt(Math.max(1e-12, (trace + disc) / 2));
  const minor = Math.sqrt(Math.max(1e-12, (trace - disc) / 2));
  return {
    rmsRadius: Math.sqrt(mean(radii.map((value) => value * value))),
    minimumRadius: quantile(radii, 0.08),
    maximumRadius: quantile(radii, 0.92),
    area: Math.PI * major * minor,
    angle: 0.5 * Math.atan2(2 * yz, yy - zz),
  };
}

function covarianceVolumeRatio(neutralPoints, posedPoints) {
  return safeRatio(covarianceVolume(posedPoints), covarianceVolume(neutralPoints));
}

function covarianceVolume(points) {
  const center = [mean(points.map((p) => p[0])), mean(points.map((p) => p[1])), mean(points.map((p) => p[2]))];
  const variances = [0, 1, 2].map((axis) => mean(points.map((p) => (p[axis] - center[axis]) ** 2)));
  return Math.sqrt(Math.max(1e-18, variances[0] * variances[1] * variances[2]));
}

function mirrorValidationPose(pose, poseId) {
  const localRotations = {};
  for (const [jointId, q] of Object.entries(pose.localRotations)) {
    const mirroredJoint = jointId.startsWith('left') ? `right${jointId.slice(4)}` : jointId.startsWith('right') ? `left${jointId.slice(5)}` : jointId;
    localRotations[mirroredJoint] = [-q[0], q[1], q[2], q[3]];
  }
  return {
    ...pose,
    frameId: `${pose.frameId}-mirrored-right`,
    localRotations,
    constraintState: {
      ...pose.constraintState,
      validationPose: { ...pose.constraintState.validationPose, poseId, fixture: `${poseId}-test-only-mirrored-fixture` },
    },
  };
}

function lookupBaselineValue(baselineReport, preset, poseId, side, metricName) {
  const scenarios = baselineReport?.presets?.[preset]?.scenarios ?? [];
  return scenarios.find((entry) => entry.poseId === poseId && entry.side === side)?.measurements
    ?.find((entry) => entry.metric === metricName)?.posedValue;
}

function ensureSelection(indices, preset, poseId, region) {
  assert.ok(indices.length >= MINIMUM_SELECTED_VERTICES, `${preset}/${poseId}/${region} selected ${indices.length} vertices; expected at least ${MINIMUM_SELECTED_VERTICES}.`);
}

function radialRadius(point) { return Math.hypot(point[1], point[2]); }
function readVector(values, index) { return [values[index * 3], values[index * 3 + 1], values[index * 3 + 2]]; }
function subtract(a, b) { return a.map((value, index) => value - b[index]); }
function add(a, b) { return a.map((value, index) => value + b[index]); }
function scale(a, amount) { return a.map((value) => value * amount); }
function dot(a, b) { return a.reduce((sum, value, index) => sum + value * b[index], 0); }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function distance(a, b) { return Math.hypot(...subtract(a, b)); }
function normalize(a) { const length = Math.hypot(...a) || 1; return a.map((value) => value / length); }
function rotate(q, v) {
  const [x, y, z, w] = q;
  const uv = cross([x, y, z], v);
  const uuv = cross([x, y, z], uv);
  return add(v, add(scale(uv, 2 * w), scale(uuv, 2)));
}
function mean(values) { return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length); }
function standardDeviation(values) { const average = mean(values); return Math.sqrt(mean(values.map((value) => (value - average) ** 2))); }
function quantile(values, fraction) {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index); const upper = Math.ceil(index);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}
function unwrapAngles(values) {
  const result = [values[0]];
  for (let index = 1; index < values.length; index += 1) {
    let value = values[index];
    while (value - result[index - 1] > Math.PI / 2) value -= Math.PI;
    while (value - result[index - 1] < -Math.PI / 2) value += Math.PI;
    result.push(value);
  }
  return result;
}
function safeRatio(value, denominator) { return Math.abs(denominator) > 1e-12 ? value / denominator : value === 0 ? 1 : Number.POSITIVE_INFINITY; }
function between(value, minimum, maximum) { return value >= minimum && value <= maximum; }
function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); }
function toDegrees(radians) { return radians * 180 / Math.PI; }
function round(value) { return Number.isFinite(value) ? Number(value.toFixed(8)) : String(value); }
function roundVector(value) { return value.map(round); }
