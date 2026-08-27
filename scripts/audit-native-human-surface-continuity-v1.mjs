import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBodyDNA } from '../src/modules/human-core-v5/body-dna-v5.js';
import { HumanCoreRuntime } from '../src/modules/human-core-v5/human-core-runtime.js';
import {
  NativeHumanSurfaceEvaluatorV1,
  NativeHumanSurfaceLandmarksV1,
  auditNativeHumanSurfaceGeometryV1,
  createNativeHumanSurfaceTopologyV1,
  measureNativeHumanSurfaceSymmetryV1,
} from '../src/modules/human-core-v5/native-surface-v1/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(root, 'artifacts', 'qa', 'task16a-native-surface-v1');
const topology = createNativeHumanSurfaceTopologyV1();
const evaluator = new NativeHumanSurfaceEvaluatorV1({ topology });
const landmarkEvaluator = new NativeHumanSurfaceLandmarksV1({ topology });
const parameterPlans = [
  { parameter: 'shoulderWidth', minimum: 0.32, maximum: 0.54, apply: (value) => ({ proportion: { shoulderWidth: value } }) },
  { parameter: 'pelvisWidth', minimum: 0.17, maximum: 0.28, apply: (value) => ({ proportion: { hipWidth: value } }) },
  { parameter: 'height', minimum: 1.50, maximum: 2.05, apply: (value) => ({ proportion: { height: value } }) },
  { parameter: 'muscle', minimum: 0, maximum: 1, apply: (value) => ({ fitnessProfile: { muscle: value } }) },
  { parameter: 'fat', minimum: 0, maximum: 1, apply: (value) => ({ fitnessProfile: { fat: value } }) },
];

const parameterResults = [];
for (const plan of parameterPlans) {
  const samples = [];
  for (let sampleIndex = 0; sampleIndex < 11; sampleIndex += 1) {
    const value = plan.minimum + (plan.maximum - plan.minimum) * sampleIndex / 10;
    const bodyDNA = createBodyDNA({
      ...plan.apply(value),
      bodyDNAId: `native-continuity-${plan.parameter}-${sampleIndex}`,
      identity: { humanId: `native-continuity-${plan.parameter}-${sampleIndex}` },
      proportionRevision: 16,
    });
    const human = new HumanCoreRuntime();
    human.createHuman(bodyDNA, { timestamp: 0 });
    const rigCore = human.getRigCore();
    const evaluation = evaluator.evaluate({ bodyDNA, rigCore });
    const landmarks = landmarkEvaluator.evaluate({ evaluation, bodyDNA, rigCore });
    const { geometryMetrics } = auditNativeHumanSurfaceGeometryV1({
      evaluation, topology, bodyDNA, includeSelfIntersections: false,
    });
    samples.push({
      sampleIndex,
      value,
      bodyDNAId: bodyDNA.bodyDNAId,
      topologyFingerprint: evaluation.topologyFingerprint,
      indexHash: evaluation.indexHash,
      vertexCount: evaluation.vertexCount,
      triangleCount: evaluation.triangleCount,
      connectedComponentCount: geometryMetrics.connectedComponentCount,
      boundaryEdgeCount: geometryMetrics.boundaryEdgeCount,
      nonManifoldEdgeCount: geometryMetrics.nonManifoldEdgeCount,
      triangleWindingConsistency: geometryMetrics.triangleWindingConsistency,
      symmetry: measureNativeHumanSurfaceSymmetryV1(evaluation, topology),
      positions: evaluation.positions,
      landmarkPoints: Object.fromEntries(landmarks.landmarks.map((landmark) => [landmark.landmarkId, landmark.point])),
    });
  }
  parameterResults.push(summarizeParameter(plan, samples));
}

const report = {
  schema: 'humanoid_rig/native_human_surface_parameter_continuity@1.0',
  task: 'Task 16A Native Human Surface V1 parameter continuity',
  generatedBy: 'scripts/audit-native-human-surface-continuity-v1.mjs',
  sampleCountPerParameter: 11,
  topologyFingerprint: topology.topologyFingerprint,
  indexHash: topology.indexHash,
  parameters: parameterResults,
  passed: parameterResults.every((parameter) => parameter.passed),
  requirements: {
    constantVertexCount: true,
    constantIndex: true,
    connectedComponentCount: 1,
    noLocalFlip: true,
    noSuddenJump: true,
    continuousLandmarkTrajectories: true,
    symmetricParametersMirror: true,
  },
};

await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, 'parameter-continuity.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({
  topologyFingerprint: topology.topologyFingerprint,
  parameters: parameterResults.map(({ parameter, passed, maximumStepDisplacement, maximumLandmarkSecondDifference }) => ({
    parameter, passed, maximumStepDisplacement, maximumLandmarkSecondDifference,
  })),
  passed: report.passed,
})}\n`);

function summarizeParameter(plan, rawSamples) {
  const topologyStable = new Set(rawSamples.map((sample) => sample.topologyFingerprint)).size === 1;
  const indexStable = new Set(rawSamples.map((sample) => sample.indexHash)).size === 1;
  const vertexCountStable = new Set(rawSamples.map((sample) => sample.vertexCount)).size === 1;
  const componentsStable = rawSamples.every((sample) => sample.connectedComponentCount === 1
    && sample.boundaryEdgeCount === 0 && sample.nonManifoldEdgeCount === 0);
  const windingStable = rawSamples.every((sample) => sample.triangleWindingConsistency);
  const symmetryStable = rawSamples.every((sample) => sample.symmetry.mirrored);
  const stepDisplacements = [];
  let localFlipCount = 0;
  for (let index = 1; index < rawSamples.length; index += 1) {
    stepDisplacements.push(maximumPositionDelta(rawSamples[index - 1].positions, rawSamples[index].positions));
    localFlipCount += countLocalNormalFlips(rawSamples[index - 1].positions, rawSamples[index].positions, topology.indices);
  }
  const maximumStepDisplacement = Math.max(...stepDisplacements);
  const minimumPositiveStep = Math.min(...stepDisplacements.filter((value) => value > 1e-12));
  const stepRatio = maximumStepDisplacement / Math.max(1e-12, minimumPositiveStep);
  const maximumLandmarkSecondDifference = landmarkSecondDifference(rawSamples);
  const noSuddenJump = stepRatio <= 1.35;
  const landmarkTrajectoriesContinuous = maximumLandmarkSecondDifference <= 0.005;
  const passed = topologyStable && indexStable && vertexCountStable && componentsStable && windingStable
    && localFlipCount === 0 && noSuddenJump && landmarkTrajectoriesContinuous && symmetryStable;
  return {
    parameter: plan.parameter,
    minimum: plan.minimum,
    maximum: plan.maximum,
    sampleCount: rawSamples.length,
    topologyStable,
    indexStable,
    vertexCountStable,
    componentsStable,
    windingStable,
    localFlipCount,
    noSuddenJump,
    maximumStepDisplacement,
    stepDisplacementRatio: stepRatio,
    landmarkTrajectoriesContinuous,
    maximumLandmarkSecondDifference,
    symmetryStable,
    samples: rawSamples.map(({ positions, landmarkPoints, ...sample }) => sample),
    passed,
  };
}

function maximumPositionDelta(left, right) {
  let maximum = 0;
  for (let cursor = 0; cursor < left.length; cursor += 3) {
    maximum = Math.max(maximum, Math.hypot(
      right[cursor] - left[cursor], right[cursor + 1] - left[cursor + 1], right[cursor + 2] - left[cursor + 2],
    ));
  }
  return maximum;
}

function countLocalNormalFlips(left, right, indices) {
  let count = 0;
  for (let cursor = 0; cursor < indices.length; cursor += 3) {
    const leftNormal = triangleNormal(left, indices[cursor], indices[cursor + 1], indices[cursor + 2]);
    const rightNormal = triangleNormal(right, indices[cursor], indices[cursor + 1], indices[cursor + 2]);
    if (leftNormal[0] * rightNormal[0] + leftNormal[1] * rightNormal[1] + leftNormal[2] * rightNormal[2] <= 0) count += 1;
  }
  return count;
}

function triangleNormal(positions, a, b, c) {
  const ax = positions[b * 3] - positions[a * 3];
  const ay = positions[b * 3 + 1] - positions[a * 3 + 1];
  const az = positions[b * 3 + 2] - positions[a * 3 + 2];
  const bx = positions[c * 3] - positions[a * 3];
  const by = positions[c * 3 + 1] - positions[a * 3 + 1];
  const bz = positions[c * 3 + 2] - positions[a * 3 + 2];
  const normal = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
  const length = Math.hypot(...normal);
  return normal.map((value) => value / Math.max(1e-14, length));
}

function landmarkSecondDifference(samples) {
  let maximum = 0;
  for (let index = 1; index < samples.length - 1; index += 1) {
    const previous = samples[index - 1].landmarkPoints;
    const current = samples[index].landmarkPoints;
    const next = samples[index + 1].landmarkPoints;
    for (const landmarkId of Object.keys(current)) {
      maximum = Math.max(maximum, Math.hypot(...[0, 1, 2].map((axis) => next[landmarkId][axis]
        - 2 * current[landmarkId][axis] + previous[landmarkId][axis])));
    }
  }
  return maximum;
}
