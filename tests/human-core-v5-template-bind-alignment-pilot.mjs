import * as THREE from 'three';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  HumanCoreRuntime,
  PROCEDURAL_BODY_DNA_PRESETS_V5,
  ProceduralDeformRuntimeV5,
  V4Adapter,
  createBodyDNA,
  createProceduralDeformValidationPoseV5,
  createProceduralSimulationRigFrameV5,
  findSurfaceSelfIntersectionsV5,
} from '../src/modules/human-core-v5/index.js';
import { createSmplSkinLayer } from '../legacy/v8/src/smpl-skin.js';
import { TemplateBindSpaceRetargetAdapterV5 } from '../apps/human-core-v5-template-bind-alignment-pilot/template-bind-space-retarget-adapter-v5.js';

const OUTPUT_DIRECTORY = resolve('artifacts/qa/task14c-template-bind-alignment-pilot');
const METRICS_PATH = resolve(OUTPUT_DIRECTORY, 'metrics.json');
const BIND_AUDIT_PATH = resolve(OUTPUT_DIRECTORY, 'bind-audit.json');
const ASSET_PATH = resolve('legacy/v8/assets/smpl/smpl-male-surface-skinned.glb');
const ASSET_URL = pathToFileURL(ASSET_PATH).href;
const SCENARIOS = Object.freeze([
  Object.freeze({ scenarioId: 'reference-t', poseId: 't-pose', gate: 'arm-bilateral' }),
  Object.freeze({ scenarioId: 'reference-a', poseId: 'a-pose', gate: 'arm-bilateral' }),
  Object.freeze({ scenarioId: 'shoulder-150', poseId: 'arm-raise-150-left', gate: 'shoulder' }),
  Object.freeze({ scenarioId: 'elbow-140', poseId: 'elbow-bend-140-left', gate: 'elbow' }),
  Object.freeze({ scenarioId: 'hip-flex', poseId: 'hip-flex-left', gate: 'hip' }),
  Object.freeze({ scenarioId: 'knee-bend', poseId: 'knee-bend-left', gate: 'knee' }),
]);
const MAPPED_JOINT_IDS = Object.freeze([
  'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
  'leftShoulder', 'rightShoulder', 'leftUpperArm', 'rightUpperArm',
  'leftLowerArm', 'rightLowerArm', 'leftHand', 'rightHand',
  'leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg',
  'leftFoot', 'rightFoot', 'leftToes', 'rightToes',
]);
const ANCHOR_JOINT_IDS = Object.freeze([
  'leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm',
  'leftHand', 'rightHand', 'leftUpperLeg', 'rightUpperLeg',
  'leftLowerLeg', 'rightLowerLeg', 'leftFoot', 'rightFoot',
]);
const REGION_NAMES = Object.freeze([
  'pelvis', 'lowerTorso', 'upperTorso', 'neck', 'head',
  'leftUpperArm', 'rightUpperArm', 'leftForearm', 'rightForearm',
  'leftPalm', 'rightPalm', 'leftThigh', 'rightThigh',
  'leftCalf', 'rightCalf', 'leftFoot', 'rightFoot',
]);
const JOINT_REGION = Object.freeze({
  hips: 'pelvis', spine: 'lowerTorso', chest: 'upperTorso', upperChest: 'upperTorso', neck: 'neck', head: 'head',
  leftShoulder: 'upperTorso', rightShoulder: 'upperTorso',
  leftUpperArm: 'leftUpperArm', rightUpperArm: 'rightUpperArm',
  leftLowerArm: 'leftForearm', rightLowerArm: 'rightForearm',
  leftHand: 'leftPalm', rightHand: 'rightPalm',
  leftUpperLeg: 'leftThigh', rightUpperLeg: 'rightThigh',
  leftLowerLeg: 'leftCalf', rightLowerLeg: 'rightCalf',
  leftFoot: 'leftFoot', rightFoot: 'rightFoot', leftToes: 'leftFoot', rightToes: 'rightFoot',
});

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, options = {}) => {
  const href = typeof input === 'string' ? input : input?.href ?? input?.url ?? String(input);
  if (href === ASSET_URL) {
    const bytes = await readFile(ASSET_PATH);
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return { ok: true, status: 200, arrayBuffer: async () => arrayBuffer };
  }
  return originalFetch(input, options);
};

const failures = [];
let report;
let bindAudit;
try {
  const bodyDNA = createBodyDNA({
    ...structuredClone(PROCEDURAL_BODY_DNA_PRESETS_V5.Reference),
    bodyDNAId: 'task14c-template-bind-pilot-reference',
    identity: { humanId: 'task14c-template-bind-pilot-reference', label: 'Reference' },
    proportionRevision: 14,
  });
  const human = new HumanCoreRuntime();
  human.createHuman(bodyDNA);
  const rigCore = human.getRigCore();
  const adapted = V4Adapter.humanRigCoreToExistingRig(rigCore, { bodyDNA, pose: 'T' });
  const referenceTPose = createProceduralDeformValidationPoseV5({
    poseId: 't-pose', rigCore, bodyDNA, timestamp: 1,
  });
  const sourceBindFrame = createProceduralSimulationRigFrameV5({ finalPose: referenceTPose, rigCore, bodyDNA });

  const procedural = new ProceduralDeformRuntimeV5();
  procedural.compileHuman({ bodyDNA, rigCore });
  await procedural.generateCanonicalSurface({ resolution: 48, worker: false, projectionMode: 'legacy' });

  const templateScene = new THREE.Scene();
  const template = await createSmplSkinLayer(THREE, templateScene, adapted.definition, {
    legacyDiagnosticRuntimeWeights: false,
  });
  if (template.detailPromise) await template.detailPromise;
  if (!template.mesh || !template.weightsReady) throw new Error('Stable template GLB did not load.');
  const adapter = new TemplateBindSpaceRetargetAdapterV5({ THREE, templateLayer: template, rigCore, sourceBindFrame });
  const identityGate = adapter.runIdentityGate();
  if (!identityGate.passed) failures.push('Identity Gate failed.');
  const bindRecords = adapter.createBindAudit();
  const templateIndices = new Uint32Array(template.mesh.geometry.index.array);
  const templateRegionIds = buildTemplateRegionIds(template);

  adapter.restoreBind();
  const bindPositions = template.sampleDeformedPositions();
  const bindIntersections = findSurfaceSelfIntersectionsV5({
    positions: bindPositions,
    indices: templateIndices,
    regionIds: templateRegionIds,
    regionNames: REGION_NAMES,
  });
  const bindPairMap = pairMap(bindIntersections.pairs);

  bindAudit = {
    schema: 'humanoid_rig/task14c_template_bind_audit@5.0',
    task: 'Task 14C Template Bind Space Alignment Pilot C',
    sourcePoseConvention: {
      value: 'bind-relative local delta',
      poseFrameRotationConvention: referenceTPose.rotationConvention,
      proof: [
        'Reference T uses identity local rotations and independent FK reproduces the canonical T bind positions.',
        'Reference A and joint fixtures rotate canonical T bind offsets through finalPose.localRotations.',
        'Production Skin V4 explicitly combines targetBindLocalQuaternion * finalPose local delta.',
      ],
    },
    targetBindConvention: 'original glTF node local TRS plus asset-prebound inverse bind matrices',
    sourceRig: {
      rigId: rigCore.rigId,
      bindPose: sourceBindFrame.bindPose,
      hierarchy: rigCore.topology.relationships,
    },
    targetAsset: {
      path: 'legacy/v8/assets/smpl/smpl-male-surface-skinned.glb',
      jointCount: template.assetJointCount,
      weightSource: 'asset-prebound',
      inverseBindSource: 'asset-prebound',
    },
    adapter: {
      name: 'TemplateBindSpaceRetargetAdapterV5',
      correction: 'targetBindLocal * (C * sourceBindRelativeDelta * inverse(C))',
      correctionSetFingerprint: adapter.correctionSetFingerprint(),
      poseSpecificOffsets: false,
      mutatesTargetLocalPosition: false,
      mutatesTargetScale: false,
      mutatesInverseBindMatrices: false,
      mutatesHumanRigCore: false,
    },
    identityGate,
    joints: bindRecords,
  };

  const scenarios = [];
  for (let index = 0; index < SCENARIOS.length; index += 1) {
    const spec = SCENARIOS[index];
    const finalPose = createProceduralDeformValidationPoseV5({
      poseId: spec.poseId, rigCore, bodyDNA, timestamp: index + 10,
    });
    human.updatePose(finalPose);
    const simulationRig = createProceduralSimulationRigFrameV5({ finalPose, rigCore, bodyDNA });
    const productionFrame = {
      type: 'SimulationRigFrame',
      schema: 'humanoid_rig/simulation_rig_frame@4.0',
      frameId: `${spec.scenarioId}-pilot-c-shared-final-pose`,
      finalPose,
    };
    const proceduralFrame = procedural.update({
      finalPose,
      anatomyState: human.getAnatomyState(),
      timestamp: index + 10,
    });

    template.refresh(adapted.definition, null, { force: true, simulationRigFrame: productionFrame });
    const directPositions = template.sampleDeformedPositions();
    const directSkeleton = captureTemplateSkeleton(template, adapter);
    const directIntersections = findSurfaceSelfIntersectionsV5({
      positions: directPositions,
      indices: templateIndices,
      regionIds: templateRegionIds,
      regionNames: REGION_NAMES,
    });

    const candidateApplication = adapter.apply(finalPose);
    const candidatePositions = template.sampleDeformedPositions();
    const candidateSkeleton = captureTemplateSkeleton(template, adapter);
    const candidateIntersections = findSurfaceSelfIntersectionsV5({
      positions: candidatePositions,
      indices: templateIndices,
      regionIds: templateRegionIds,
      regionNames: REGION_NAMES,
    });

    const sourcePoseMetrics = measurePose(simulationRig.joints);
    const directTemplateMetrics = createTemplateMetrics({
      skeleton: directSkeleton,
      sourceJoints: simulationRig.joints,
      intersections: directIntersections,
      bindPairMap,
    });
    const candidateTemplateMetrics = createTemplateMetrics({
      skeleton: candidateSkeleton,
      sourceJoints: simulationRig.joints,
      intersections: candidateIntersections,
      bindPairMap,
    });
    const poseSemanticMetrics = {
      sourceShoulderElevationDeg: sourcePoseMetrics.sourceShoulderElevationDeg,
      directShoulderElevationDeg: directTemplateMetrics.poseMetrics.sourceShoulderElevationDeg,
      candidateShoulderElevationDeg: candidateTemplateMetrics.poseMetrics.sourceShoulderElevationDeg,
      sourceElbowFlexionDeg: sourcePoseMetrics.sourceElbowFlexionDeg,
      directElbowFlexionDeg: directTemplateMetrics.poseMetrics.sourceElbowFlexionDeg,
      candidateElbowFlexionDeg: candidateTemplateMetrics.poseMetrics.sourceElbowFlexionDeg,
      sourceHipFlexionDeg: sourcePoseMetrics.sourceHipFlexionDeg,
      directHipFlexionDeg: directTemplateMetrics.poseMetrics.sourceHipFlexionDeg,
      candidateHipFlexionDeg: candidateTemplateMetrics.poseMetrics.sourceHipFlexionDeg,
      sourceKneeFlexionDeg: sourcePoseMetrics.sourceKneeFlexionDeg,
      directKneeFlexionDeg: directTemplateMetrics.poseMetrics.sourceKneeFlexionDeg,
      candidateKneeFlexionDeg: candidateTemplateMetrics.poseMetrics.sourceKneeFlexionDeg,
      sourceSegmentDirections: sourcePoseMetrics.segmentDirections,
      directSegmentDirections: directTemplateMetrics.segmentDirections,
      candidateSegmentDirections: candidateTemplateMetrics.segmentDirections,
    };
    const angleGate = evaluateAngleGate(spec, sourcePoseMetrics, candidateTemplateMetrics.poseMetrics);
    const mappedJointGate = candidateTemplateMetrics.maximumMappedJointWorldError <= 0.08
      && candidateTemplateMetrics.meanMappedJointWorldError <= 0.03;
    const rootGate = candidateTemplateMetrics.rootPositionError <= 0.005;
    const symmetryGate = candidateTemplateMetrics.leftRightSymmetryError <= 0.02;
    const scenarioPassed = angleGate.passed && mappedJointGate && rootGate && symmetryGate;
    scenarios.push({
      scenarioId: spec.scenarioId,
      poseId: spec.poseId,
      sharedFinalPoseId: productionFrame.frameId,
      sharedFinalPoseIdentity: productionFrame.finalPose === finalPose,
      sourcePoseMetrics,
      directTemplateMetrics,
      candidateTemplateMetrics,
      poseSemanticMetrics,
      candidateApplication,
      angleGate,
      mappedJointGate,
      rootGate,
      symmetryGate,
      passed: scenarioPassed,
      failureClassification: classifyFailure({
        angleGate,
        candidate: candidateTemplateMetrics,
        bindRecords,
      }),
      proceduralGeometryPresent: proceduralFrame.deformedPositions.length > 0,
      directGeometryPresent: directPositions.length > 0,
      candidateGeometryPresent: candidatePositions.length > 0,
    });
  }

  const allAnglesPass = scenarios.every((scenario) => scenario.angleGate.passed);
  const allMappedJointsPass = scenarios.every((scenario) => scenario.mappedJointGate);
  const anyDirectionPass = scenarios.some((scenario) => scenario.angleGate.passed);
  report = {
    schema: 'humanoid_rig/task14c_template_bind_alignment_pilot@5.0',
    task: 'Task 14C Template Bind Space Alignment Pilot C',
    baseline: '06d7022c309c4887d3a1760712b2833b56a7c71f',
    branch: 'experiment/human-core-v5-template-bind-alignment-pilot',
    sourcePoseConvention: bindAudit.sourcePoseConvention,
    targetBindConvention: bindAudit.targetBindConvention,
    rootCause: [
      'Production Skin V4 directly copies source bind-relative local deltas into target bone local space.',
      'Human Core and template outgoing-bone axes are not uniformly aligned.',
      'No source-to-target bind basis correction exists in the direct mapping path.',
    ],
    identityGate,
    bindPosePenetratingPairs: bindIntersections.pairs,
    bindPosePenetratingPairCount: bindIntersections.penetratingIntersectionCount,
    scenarios,
    gates: {
      allAnglesPass,
      allMappedJointsPass,
      allScenarioGatesPass: scenarios.every((scenario) => scenario.passed),
      sameCorrectionSetForAllScenarios: new Set(scenarios.map((scenario) => scenario.candidateApplication.correctionSetFingerprint)).size === 1,
    },
    browserAuditPending: true,
    browserAudit: {
      workflowCount: null,
      renderer: null,
      consoleErrors: null,
      pageErrors: null,
      glbRequests: null,
      geometryPresent: null,
    },
    visualReview: null,
    preliminaryConclusion: allAnglesPass && allMappedJointsPass
      ? 'BIND_ALIGNMENT_PROMISING'
      : anyDirectionPass ? 'BIND_ALIGNMENT_PARTIAL' : 'TEMPLATE_BINDING_INCOMPATIBLE',
    finalConclusion: null,
    failures,
    visualAcceptance: false,
    productionReady: false,
    userVisualAcceptance: false,
  };
  procedural.dispose();
  template.dispose();
} finally {
  globalThis.fetch = originalFetch;
}

await mkdir(dirname(METRICS_PATH), { recursive: true });
await writeFile(BIND_AUDIT_PATH, `${JSON.stringify(bindAudit, null, 2)}\n`, 'utf8');
await writeFile(METRICS_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  bindAudit: BIND_AUDIT_PATH,
  metrics: METRICS_PATH,
  identityGate: report.identityGate.passed,
  scenarioCount: report.scenarios.length,
  preliminaryConclusion: report.preliminaryConclusion,
  failures,
}, null, 2));
if (failures.length) process.exitCode = 1;

function buildTemplateRegionIds(template) {
  const vertexCount = template.restPositions.length / 3;
  const result = new Uint16Array(vertexCount * 4);
  const regionIndex = new Map(REGION_NAMES.map((name, index) => [name, index]));
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    let dominantSlot = 0;
    for (let slot = 1; slot < 4; slot += 1) {
      if (template.skinWeights[vertex * 4 + slot] > template.skinWeights[vertex * 4 + dominantSlot]) dominantSlot = slot;
    }
    const jointId = template.jointIds[template.skinIndices[vertex * 4 + dominantSlot]];
    const id = regionIndex.get(JOINT_REGION[jointId] ?? 'upperTorso') ?? 2;
    result.fill(id, vertex * 4, vertex * 4 + 4);
  }
  return result;
}

function captureTemplateSkeleton(template, adapter) {
  template.mesh.updateMatrixWorld(true);
  return Object.fromEntries(template.orderedJointIds.map((jointId) => {
    const bone = template.bonesById.get(jointId);
    const bind = adapter.targetBind.get(jointId);
    return [jointId, {
      jointId,
      parentId: template.parentIdById.get(jointId) ?? null,
      bindWorldPosition: bind.worldPosition.toArray(),
      bindLocalPosition: bind.position.toArray(),
      worldPosition: bone.getWorldPosition(new THREE.Vector3()).toArray(),
      worldRotation: bone.getWorldQuaternion(new THREE.Quaternion()).toArray(),
    }];
  }));
}

function createTemplateMetrics({ skeleton, sourceJoints, intersections, bindPairMap }) {
  const poseMetrics = measurePose(skeleton);
  const mappedJointWorldErrors = {};
  for (const jointId of MAPPED_JOINT_IDS) {
    if (!sourceJoints[jointId] || !skeleton[jointId]) continue;
    mappedJointWorldErrors[jointId] = distance(sourceJoints[jointId].worldPosition, skeleton[jointId].worldPosition);
  }
  const errorValues = Object.values(mappedJointWorldErrors);
  const rootPositionError = mappedJointWorldErrors.hips ?? Number.POSITIVE_INFINITY;
  const wristEndpointError = endpointErrors(mappedJointWorldErrors, 'Hand');
  const ankleEndpointError = endpointErrors(mappedJointWorldErrors, 'Foot');
  const anchorValues = ANCHOR_JOINT_IDS.map((jointId) => mappedJointWorldErrors[jointId]).filter(Number.isFinite);
  const currentPairMap = pairMap(intersections.pairs);
  const persistentBindPairs = [...currentPairMap].filter(([key]) => bindPairMap.has(key)).map(([, value]) => value);
  const poseIntroducedPairs = [...currentPairMap].filter(([key]) => !bindPairMap.has(key)).map(([, value]) => value);
  const poseResolvedPairs = [...bindPairMap].filter(([key]) => !currentPairMap.has(key)).map(([, value]) => value);
  return {
    poseMetrics,
    sourceSegmentDirections: null,
    segmentDirections: poseMetrics.segmentDirections,
    mappedJointWorldErrors,
    maximumMappedJointWorldError: Math.max(0, ...errorValues),
    meanMappedJointWorldError: mean(errorValues),
    wristEndpointError,
    ankleEndpointError,
    rootPositionError,
    leftRightSymmetryError: symmetryError(mappedJointWorldErrors),
    surfaceAnchorMaximumError: Math.max(0, ...anchorValues),
    surfaceAnchorMeanError: mean(anchorValues),
    persistentBindPairs,
    poseIntroducedPairs,
    poseResolvedPairs,
    totalPenetratingPairs: intersections.pairs,
    persistentBindPairCount: persistentBindPairs.length,
    poseIntroducedPairCount: poseIntroducedPairs.length,
    poseResolvedPairCount: poseResolvedPairs.length,
    totalPenetratingPairCount: intersections.penetratingIntersectionCount,
    criticalPoseIntroducedPairCount: poseIntroducedPairs.filter((pair) => pair.critical).length,
  };
}

function measurePose(joints) {
  const leftShoulderElevationDeg = angleFromDown(joints.leftUpperArm, joints.leftLowerArm);
  const rightShoulderElevationDeg = angleFromDown(joints.rightUpperArm, joints.rightLowerArm);
  return {
    sourceShoulderElevationDeg: mean([leftShoulderElevationDeg, rightShoulderElevationDeg]),
    leftShoulderElevationDeg,
    rightShoulderElevationDeg,
    sourceElbowFlexionDeg: chainBend(joints.leftUpperArm, joints.leftLowerArm, joints.leftHand),
    sourceHipFlexionDeg: segmentRotationFromBind(joints.leftUpperLeg, joints.leftLowerLeg, joints.hips),
    sourceKneeFlexionDeg: segmentRotationFromBind(joints.leftLowerLeg, joints.leftFoot, joints.leftUpperLeg),
    segmentDirections: {
      leftUpperArm: direction(joints.leftUpperArm, joints.leftLowerArm),
      rightUpperArm: direction(joints.rightUpperArm, joints.rightLowerArm),
      leftForearm: direction(joints.leftLowerArm, joints.leftHand),
      leftThigh: direction(joints.leftUpperLeg, joints.leftLowerLeg),
      leftCalf: direction(joints.leftLowerLeg, joints.leftFoot),
    },
  };
}

function evaluateAngleGate(spec, source, candidate) {
  let errors;
  if (spec.gate === 'arm-bilateral') errors = [
    Math.abs(source.leftShoulderElevationDeg - candidate.leftShoulderElevationDeg),
    Math.abs(source.rightShoulderElevationDeg - candidate.rightShoulderElevationDeg),
  ];
  else if (spec.gate === 'shoulder') errors = [Math.abs(source.leftShoulderElevationDeg - candidate.leftShoulderElevationDeg)];
  else if (spec.gate === 'elbow') errors = [Math.abs(source.sourceElbowFlexionDeg - candidate.sourceElbowFlexionDeg)];
  else if (spec.gate === 'hip') errors = [Math.abs(source.sourceHipFlexionDeg - candidate.sourceHipFlexionDeg)];
  else errors = [Math.abs(source.sourceKneeFlexionDeg - candidate.sourceKneeFlexionDeg)];
  return { errorsDegrees: errors, maximumErrorDegrees: Math.max(...errors), thresholdDegrees: 8, passed: errors.every((value) => value <= 8) };
}

function classifyFailure({ angleGate, candidate, bindRecords }) {
  if (angleGate.passed && candidate.maximumMappedJointWorldError > 0.08) {
    const lengthDifferences = bindRecords
      .map((record) => Math.abs(record.sourceBoneLength - record.targetBoneLength))
      .filter(Number.isFinite);
    if (mean(lengthDifferences) > 0.03) return 'bone-length incompatibility';
  }
  if (!angleGate.passed) return 'bind-axis or bind-pose incompatibility';
  if (candidate.maximumMappedJointWorldError > 0.08) return 'mapped-joint world mismatch';
  return 'none';
}

function angleFromDown(start, end) {
  const value = direction(start, end);
  return value ? radiansToDegrees(Math.acos(clamp(dot(value, [0, -1, 0]), -1, 1))) : Number.NaN;
}

function chainBend(parent, joint, child) {
  const incoming = direction(parent, joint);
  const outgoing = direction(joint, child);
  return incoming && outgoing ? radiansToDegrees(Math.acos(clamp(dot(incoming, outgoing), -1, 1))) : Number.NaN;
}

function segmentRotationFromBind(joint, child, parent) {
  if (!joint || !child || !parent) return Number.NaN;
  const worldDirection = direction(joint, child);
  const parentInverse = new THREE.Quaternion().fromArray(parent.worldRotation).invert();
  const localDirection = new THREE.Vector3().fromArray(worldDirection).applyQuaternion(parentInverse).normalize().toArray();
  const bindDirection = normalize(child.bindLocalPosition);
  return radiansToDegrees(Math.acos(clamp(dot(localDirection, bindDirection), -1, 1)));
}

function direction(start, end) {
  if (!start?.worldPosition || !end?.worldPosition) return null;
  return normalize(end.worldPosition.map((value, axis) => value - start.worldPosition[axis]));
}

function endpointErrors(errors, suffix) {
  const left = errors[`left${suffix}`] ?? null;
  const right = errors[`right${suffix}`] ?? null;
  return { left, right, maximum: Math.max(left ?? 0, right ?? 0) };
}

function symmetryError(errors) {
  const values = [];
  for (const suffix of ['Shoulder', 'UpperArm', 'LowerArm', 'Hand', 'UpperLeg', 'LowerLeg', 'Foot', 'Toes']) {
    const left = errors[`left${suffix}`];
    const right = errors[`right${suffix}`];
    if (Number.isFinite(left) && Number.isFinite(right)) values.push(Math.abs(left - right));
  }
  return Math.max(0, ...values);
}

function pairMap(pairs) {
  return new Map(pairs.map((pair) => [`${pair.leftTriangle}:${pair.rightTriangle}`, pair]));
}

function normalize(value) {
  const length = Math.hypot(...value);
  return length > 1e-12 ? value.map((component) => component / length) : [0, 0, 0];
}
function distance(left, right) { return Math.hypot(...left.map((value, index) => value - right[index])); }
function dot(left, right) { return left.reduce((sum, value, index) => sum + value * right[index], 0); }
function mean(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }
function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); }
function radiansToDegrees(value) { return value * 180 / Math.PI; }
