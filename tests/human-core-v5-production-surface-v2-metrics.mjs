import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import fs from 'node:fs';
import path from 'node:path';
import {
  HumanCoreRuntime,
  PROCEDURAL_BODY_DNA_PRESETS_V5,
  createBodyDNA,
  createProceduralDeformValidationPoseV5,
  createProceduralSimulationRigFrameV5,
  findSurfaceSelfIntersectionsV5,
} from '../src/modules/human-core-v5/index.js';
import { SurfaceCarrierV2 } from '../src/modules/human-core-v5/surface-v2/index.js';

const ROOT = path.resolve('.');
const QA_DIR = path.join(ROOT, 'artifacts/qa/task15a-production-surface-v2');
const ASSET_DIR = path.join(ROOT, 'assets/human/production-surface-v2/candidate-a');
const METRICS_PATH = path.join(QA_DIR, 'metrics.json');
const PENETRATION_PATH = path.join(QA_DIR, 'penetration-audit.json');
const LEGACY_METRICS_PATH = path.join(ROOT, 'artifacts/qa/task14c-template-reference-pose-retarget-pilot/metrics.json');
const SCENARIOS = Object.freeze([
  { scenarioId: 'reference-t', poseId: 't-pose', gate: 'all', threshold: 5, penetrationLimit: 5 },
  { scenarioId: 'reference-a', poseId: 'a-pose', gate: 'all', threshold: 8, penetrationLimit: 10 },
  { scenarioId: 'shoulder-150', poseId: 'arm-raise-150-left', gate: 'shoulder', threshold: 8, penetrationLimit: 25 },
  { scenarioId: 'elbow-140', poseId: 'elbow-bend-140-left', gate: 'elbow', threshold: 8, penetrationLimit: 50 },
  { scenarioId: 'hip-flex', poseId: 'hip-flex-left', gate: 'hip', threshold: 8, penetrationLimit: 25 },
  { scenarioId: 'knee-bend', poseId: 'knee-bend-left', gate: 'knee', threshold: 8, penetrationLimit: 10 },
]);
const MAPPED_JOINT_IDS = Object.freeze([
  'hips','spine','chest','upperChest','neck','head','leftShoulder','rightShoulder','leftUpperArm','rightUpperArm',
  'leftLowerArm','rightLowerArm','leftHand','rightHand','leftUpperLeg','rightUpperLeg','leftLowerLeg','rightLowerLeg',
  'leftFoot','rightFoot','leftToes','rightToes',
]);
const REGION_NAMES = Object.freeze(['pelvis','lowerTorso','upperTorso','neck','head','leftUpperArm','rightUpperArm','leftForearm','rightForearm','leftPalm','rightPalm','leftThigh','rightThigh','leftCalf','rightCalf','leftFoot','rightFoot']);

const receipt = readJson(path.join(ASSET_DIR, 'ASSET_RECEIPT.json'));
const legacyReport = readJson(LEGACY_METRICS_PATH);
const glbBuffer = fs.readFileSync(path.join(ASSET_DIR, 'neutral-body-candidate-a.glb'));
const glbArrayBuffer = glbBuffer.buffer.slice(glbBuffer.byteOffset, glbBuffer.byteOffset + glbBuffer.byteLength);
const bodyDNA = createBodyDNA({
  ...structuredClone(PROCEDURAL_BODY_DNA_PRESETS_V5.Reference),
  bodyDNAId: 'task15a-production-surface-v2-reference',
  identity: { humanId: 'task15a-production-surface-v2-reference', label: 'Task 15A shared reference' },
  proportionRevision: 15,
});
const human = new HumanCoreRuntime();
human.createHuman(bodyDNA);
const rigCore = human.getRigCore();
const referenceTPose = createProceduralDeformValidationPoseV5({ poseId: 't-pose', rigCore, bodyDNA, timestamp: 0 });
const sourceReferenceFrame = createProceduralSimulationRigFrameV5({ finalPose: referenceTPose, rigCore, bodyDNA });
const carrier = new SurfaceCarrierV2({ THREE, GLTFLoader, scene: new THREE.Scene(), rigCore, sourceReferenceFrame });
await carrier.load({ arrayBuffer: glbArrayBuffer, receipt });
const assetRestoreGate = carrier.retargetRuntime.runAssetRestoreGate();
const fullBasisGate = carrier.retargetRuntime.getFullBasisGate();
const referenceAudit = carrier.retargetRuntime.getReferenceAudit();
const fullBasisAudit = carrier.retargetRuntime.getFullBasisAudit();
const indices = new Uint32Array(carrier.getMesh().geometry.index.array);
const regionIds = buildCandidateRegionIds(carrier.getMesh(), carrier.getSkeleton());

carrier.restoreAssetBind();
const originalBindSkeleton = captureSkeleton(carrier);
const originalBindPositions = carrier.sampleDeformedPositions();
const originalBindIntersections = intersectionsFor(originalBindPositions, indices, regionIds);
const originalPairMap = pairMap(originalBindIntersections.pairs);

carrier.restoreReferencePose();
const targetReferenceSkeleton = captureSkeleton(carrier);
const targetReferencePositions = carrier.sampleDeformedPositions();
const targetReferenceIntersections = intersectionsFor(targetReferencePositions, indices, regionIds);
const referencePairMap = pairMap(targetReferenceIntersections.pairs);
const sourceReferenceMetrics = measurePose(sourceReferenceFrame.joints);
const targetReferenceMetrics = createCandidateMetrics(targetReferenceSkeleton, sourceReferenceFrame.joints, targetReferenceIntersections, originalPairMap, referencePairMap);
const referenceErrors = allAngleErrors(sourceReferenceMetrics, targetReferenceMetrics.poseMetrics);
const referencePoseGate = {
  passed: referenceErrors.every((value) => value <= 5)
    && targetReferenceMetrics.maximumMappedJointWorldError <= 0.05
    && targetReferenceMetrics.meanMappedJointWorldError <= 0.02
    && targetReferenceMetrics.wristEndpointError.maximum <= 0.04
    && targetReferenceMetrics.ankleEndpointError.maximum <= 0.02
    && targetReferenceMetrics.rootPositionError <= 0.002,
  angleErrorsDegrees: referenceErrors,
  maximumAngleErrorDegrees: Math.max(...referenceErrors),
  maximumMappedJointWorldError: targetReferenceMetrics.maximumMappedJointWorldError,
  meanMappedJointWorldError: targetReferenceMetrics.meanMappedJointWorldError,
  wristEndpointError: targetReferenceMetrics.wristEndpointError,
  ankleEndpointError: targetReferenceMetrics.ankleEndpointError,
  rootPositionError: targetReferenceMetrics.rootPositionError,
  thresholds: { angleDegrees: 5, maximumMappedJointWorldError: 0.05, meanMappedJointWorldError: 0.02, wristEndpointError: 0.04, ankleEndpointError: 0.02, rootPositionError: 0.002 },
};

const scenarioRecords = [];
for (const spec of SCENARIOS) {
  const finalPose = createProceduralDeformValidationPoseV5({ poseId: spec.poseId, rigCore, bodyDNA, timestamp: scenarioRecords.length + 1 });
  const sourceFrame = createProceduralSimulationRigFrameV5({ finalPose, rigCore, bodyDNA });
  const authorityBefore = poseFingerprint(finalPose);
  carrier.applyFinalPose(finalPose);
  if (authorityBefore !== poseFingerprint(finalPose)) throw new Error(`Candidate mutated finalPose for ${spec.scenarioId}.`);
  const skeleton = captureSkeleton(carrier);
  const positions = carrier.sampleDeformedPositions();
  const intersections = intersectionsFor(positions, indices, regionIds);
  const candidateMetrics = createCandidateMetrics(skeleton, sourceFrame.joints, intersections, originalPairMap, referencePairMap);
  const sourceMetrics = measurePose(sourceFrame.joints);
  const angleGate = evaluateAngleGate(spec, sourceMetrics, candidateMetrics.poseMetrics);
  const mappedJointGate = candidateMetrics.maximumMappedJointWorldError <= 0.05 && candidateMetrics.meanMappedJointWorldError <= 0.02;
  const endpointGate = candidateMetrics.wristEndpointError.maximum <= 0.04 && candidateMetrics.ankleEndpointError.maximum <= 0.02;
  const rootGate = candidateMetrics.rootPositionError <= 0.002;
  const penetrationGate = candidateMetrics.poseIntroducedPairCount <= spec.penetrationLimit;
  const legacy = legacyReport.scenarios.find((entry) => entry.scenarioId === spec.scenarioId);
  scenarioRecords.push({
    scenarioId: spec.scenarioId,
    poseId: spec.poseId,
    sharedFinalPoseId: finalPose.frameId ?? finalPose.poseId,
    sharedFinalPoseIdentity: true,
    sourceMetrics,
    directMetrics: {
      measuredAngles: legacy.measuredAngles,
      introducedPairCount: legacy.directMetrics.poseIntroducedPairCount,
    },
    legacyMetrics: {
      poseMetrics: legacy.pilotDMetrics.poseMetrics,
      maximumMappedJointWorldError: legacy.pilotDMetrics.maximumMappedJointWorldError,
      meanMappedJointWorldError: legacy.pilotDMetrics.meanMappedJointWorldError,
      wristEndpointError: legacy.pilotDMetrics.wristEndpointError,
      ankleEndpointError: legacy.pilotDMetrics.ankleEndpointError,
      rootPositionError: legacy.pilotDMetrics.rootPositionError,
      introducedPairCount: legacy.pilotDMetrics.poseIntroducedPairCount,
    },
    candidateMetrics,
    measuredAngles: combineAngles(sourceMetrics, legacy.pilotDMetrics.poseMetrics, candidateMetrics.poseMetrics),
    angleGate,
    mappedJointGate,
    endpointGate,
    rootGate,
    penetrationGate: { passed: penetrationGate, introducedPairCount: candidateMetrics.poseIntroducedPairCount, limit: spec.penetrationLimit },
    finiteGate: positions.every(Number.isFinite),
    geometryPresent: positions.length > 0,
    passed: referencePoseGate.passed && fullBasisGate.passed && angleGate.passed && mappedJointGate && endpointGate && rootGate,
  });
}

const skeletonGatesPassed = assetRestoreGate.passed && referencePoseGate.passed && fullBasisGate.passed && scenarioRecords.every((entry) => entry.passed);
const penetrationGatesPassed = scenarioRecords.every((entry) => entry.penetrationGate.passed);
const preliminaryConclusion = !referencePoseGate.passed
  ? 'CANDIDATE_A_RIG_INCOMPATIBLE'
  : skeletonGatesPassed && !penetrationGatesPassed
    ? 'CANDIDATE_A_SKELETON_PASS_SKIN_FAIL'
    : skeletonGatesPassed && penetrationGatesPassed
      ? 'NEW_SURFACE_CANDIDATE_A_PROMISING'
      : 'CANDIDATE_A_RIG_INCOMPATIBLE';

const penetrationAudit = {
  schema: 'humanoid_rig/task15a_penetration_audit@1.0',
  detectorPolicy: 'unchanged Human Core V5 detector thresholds',
  originalBindPairCount: originalBindIntersections.penetratingIntersectionCount,
  targetReferencePairCount: targetReferenceIntersections.penetratingIntersectionCount,
  targetReferenceIntroducedPairCount: [...referencePairMap.keys()].filter((key) => !originalPairMap.has(key)).length,
  scenarios: scenarioRecords.map((entry) => ({
    scenarioId: entry.scenarioId,
    persistentBindPairs: entry.candidateMetrics.persistentBindPairCount,
    referencePoseIntroducedPairs: entry.candidateMetrics.referencePoseIntroducedPairCount,
    dynamicPoseIntroducedPairs: entry.candidateMetrics.dynamicPoseIntroducedPairCount,
    criticalPairs: entry.candidateMetrics.criticalPoseIntroducedPairCount,
    totalPairs: entry.candidateMetrics.totalPenetratingPairCount,
    introducedPairs: entry.candidateMetrics.poseIntroducedPairCount,
    introducedRegions: entry.candidateMetrics.introducedRegionSummary,
    gate: entry.penetrationGate,
  })),
};
const runtimeMetrics = carrier.getRuntimeMetrics();
const metrics = {
  schema: 'humanoid_rig/task15a_production_surface_v2_metrics@1.0',
  task: 'Task 15A Production Surface V2 Foundation',
  branch: 'experiment/human-core-v5-production-surface-v2-neutral-body-a',
  authorityChain: ['BodyDNA','HumanRigCore','finalPose','PerformanceDeformRigV2','SurfaceCarrierV2','Skinning','Renderer'],
  authorityPreserved: true,
  assetReceipt: receipt,
  assetRestoreGate,
  referencePoseGate,
  fullBasisGate,
  referenceAudit,
  fullBasisAudit,
  geometryMetrics: carrier.getGeometryMetrics(),
  runtimeMetrics: {
    ...runtimeMetrics,
    coldLoadTimeMs: runtimeMetrics.loadTimeMs,
    warmLoadTimeMs: null,
    warmLoadPolicy: 'not repeated; GLB request count must remain one',
  },
  scenarios: scenarioRecords,
  penetrationAudit,
  unsupportedCapabilities: carrier.performanceRig.getUnsupportedCapabilities(),
  browserAuditPending: true,
  browserAudit: null,
  visualReview: null,
  preliminaryConclusion,
  finalConclusion: preliminaryConclusion,
  visualAcceptance: false,
  productionReady: false,
  userVisualAcceptance: 'pending',
};
writeJson(PENETRATION_PATH, penetrationAudit);
writeJson(METRICS_PATH, metrics);
console.log(JSON.stringify({
  assetRestoreGate: assetRestoreGate.passed,
  referencePoseGate,
  fullBasisGate: fullBasisGate.passed,
  scenarios: scenarioRecords.map((entry) => ({ id: entry.scenarioId, angles: entry.measuredAngles, max: entry.candidateMetrics.maximumMappedJointWorldError, mean: entry.candidateMetrics.meanMappedJointWorldError, wrist: entry.candidateMetrics.wristEndpointError.maximum, ankle: entry.candidateMetrics.ankleEndpointError.maximum, introduced: entry.candidateMetrics.poseIntroducedPairCount, passed: entry.passed })),
  runtimeMetrics: metrics.runtimeMetrics,
  preliminaryConclusion,
}, null, 2));
carrier.dispose();

function captureSkeleton(carrier) {
  carrier.group.updateMatrixWorld(true);
  const jointMap = carrier.getJointMap();
  return Object.fromEntries([...jointMap].map(([jointId, bone]) => {
    const original = carrier.retargetRuntime.calibrator.original.get(jointId);
    return [jointId, {
      jointId,
      bindLocalPosition: original.localPosition.toArray(),
      localPosition: bone.position.toArray(),
      localQuaternion: bone.quaternion.toArray(),
      localScale: bone.scale.toArray(),
      worldPosition: bone.getWorldPosition(new THREE.Vector3()).toArray(),
      worldRotation: bone.getWorldQuaternion(new THREE.Quaternion()).toArray(),
    }];
  }));
}
function createCandidateMetrics(skeleton, sourceJoints, intersections, originalPairMap, referencePairMap) {
  const mappedJointWorldErrors = {};
  for (const jointId of MAPPED_JOINT_IDS) if (skeleton[jointId] && sourceJoints[jointId]) mappedJointWorldErrors[jointId] = distance(skeleton[jointId].worldPosition, sourceJoints[jointId].worldPosition);
  const values = Object.values(mappedJointWorldErrors); const current = pairMap(intersections.pairs);
  const persistent = [...current].filter(([key]) => originalPairMap.has(key));
  const introduced = [...current].filter(([key]) => !originalPairMap.has(key));
  const referenceIntroduced = introduced.filter(([key]) => referencePairMap.has(key));
  const dynamicIntroduced = introduced.filter(([key]) => !referencePairMap.has(key));
  return {
    poseMetrics: measurePose(skeleton),
    mappedJointWorldErrors,
    maximumMappedJointWorldError: Math.max(0, ...values),
    meanMappedJointWorldError: mean(values),
    wristEndpointError: endpointErrors(mappedJointWorldErrors, 'Hand'),
    ankleEndpointError: endpointErrors(mappedJointWorldErrors, 'Foot'),
    rootPositionError: mappedJointWorldErrors.hips ?? Infinity,
    leftRightSymmetryError: symmetryError(mappedJointWorldErrors),
    persistentBindPairCount: persistent.length,
    poseIntroducedPairCount: introduced.length,
    referencePoseIntroducedPairCount: referenceIntroduced.length,
    dynamicPoseIntroducedPairCount: dynamicIntroduced.length,
    criticalPoseIntroducedPairCount: introduced.filter(([, pair]) => pair.critical).length,
    totalPenetratingPairCount: intersections.penetratingIntersectionCount,
    introducedRegionSummary: summarizeRegions(introduced.map(([, pair]) => pair)),
  };
}
function buildCandidateRegionIds(mesh, skeleton) {
  const regionIndex = new Map(REGION_NAMES.map((name, index) => [name, index]));
  const skinIndex = mesh.geometry.getAttribute('skinIndex'); const skinWeight = mesh.geometry.getAttribute('skinWeight');
  const result = new Uint16Array(skinIndex.count * 4);
  for (let vertex = 0; vertex < skinIndex.count; vertex += 1) {
    let bestSlot = 0; for (let slot = 1; slot < 4; slot += 1) if (skinWeight.getComponent(vertex, slot) > skinWeight.getComponent(vertex, bestSlot)) bestSlot = slot;
    const boneName = skeleton.bones[skinIndex.getComponent(vertex, bestSlot)]?.name ?? '';
    const region = regionForBone(boneName); result.fill(regionIndex.get(region), vertex * 4, vertex * 4 + 4);
  }
  return result;
}
function regionForBone(name) {
  if (/^(Root|pelvis)$/.test(name)) return 'pelvis'; if (/spine_01/.test(name)) return 'lowerTorso'; if (/spine_0[23]|clavicle/.test(name)) return 'upperTorso';
  if (/neck/.test(name)) return 'neck'; if (/head/.test(name)) return 'head';
  if (/upperarm_l/.test(name)) return 'leftUpperArm'; if (/upperarm_r/.test(name)) return 'rightUpperArm';
  if (/lowerarm_l/.test(name)) return 'leftForearm'; if (/lowerarm_r/.test(name)) return 'rightForearm';
  if (/(hand|thumb|index|middle|ring|pinky).*_l/.test(name)) return 'leftPalm'; if (/(hand|thumb|index|middle|ring|pinky).*_r/.test(name)) return 'rightPalm';
  if (/thigh_l/.test(name)) return 'leftThigh'; if (/thigh_r/.test(name)) return 'rightThigh'; if (/calf_l/.test(name)) return 'leftCalf'; if (/calf_r/.test(name)) return 'rightCalf';
  if (/(foot|ball)_l/.test(name)) return 'leftFoot'; if (/(foot|ball)_r/.test(name)) return 'rightFoot'; return 'upperTorso';
}
function intersectionsFor(positions, indices, regionIds) { return findSurfaceSelfIntersectionsV5({ positions, indices, regionIds, regionNames: REGION_NAMES }); }
function pairMap(pairs) { return new Map(pairs.map((pair) => [`${pair.leftTriangle}:${pair.rightTriangle}`, pair])); }
function measurePose(joints) {
  const leftShoulder = angleFromDown(joints.leftUpperArm, joints.leftLowerArm); const rightShoulder = angleFromDown(joints.rightUpperArm, joints.rightLowerArm);
  return { sourceShoulderElevationDeg: mean([leftShoulder, rightShoulder]), leftShoulderElevationDeg: leftShoulder, rightShoulderElevationDeg: rightShoulder, sourceElbowFlexionDeg: chainBend(joints.leftUpperArm, joints.leftLowerArm, joints.leftHand), sourceHipFlexionDeg: segmentRotationFromBind(joints.leftUpperLeg, joints.leftLowerLeg, joints.hips), sourceKneeFlexionDeg: segmentRotationFromBind(joints.leftLowerLeg, joints.leftFoot, joints.leftUpperLeg) };
}
function evaluateAngleGate(spec, source, target) {
  const all = allAngleErrors(source, target); const index = { shoulder: 0, elbow: 1, hip: 2, knee: 3 }[spec.gate]; const errors = spec.gate === 'all' ? all : [all[index]];
  return { errorsDegrees: errors, maximumErrorDegrees: Math.max(...errors), thresholdDegrees: spec.threshold, passed: errors.every((value) => value <= spec.threshold) };
}
function allAngleErrors(a, b) { return ['sourceShoulderElevationDeg','sourceElbowFlexionDeg','sourceHipFlexionDeg','sourceKneeFlexionDeg'].map((key) => Math.abs(a[key] - b[key])); }
function combineAngles(source, legacy, candidate) { return { shoulderElevationDeg: [source.sourceShoulderElevationDeg, legacy.sourceShoulderElevationDeg, candidate.sourceShoulderElevationDeg], elbowFlexionDeg: [source.sourceElbowFlexionDeg, legacy.sourceElbowFlexionDeg, candidate.sourceElbowFlexionDeg], hipFlexionDeg: [source.sourceHipFlexionDeg, legacy.sourceHipFlexionDeg, candidate.sourceHipFlexionDeg], kneeFlexionDeg: [source.sourceKneeFlexionDeg, legacy.sourceKneeFlexionDeg, candidate.sourceKneeFlexionDeg] }; }
function angleFromDown(start, end) { const vector = direction(start, end); return radiansToDegrees(Math.acos(clamp(dot(vector, [0,-1,0]), -1, 1))); }
function chainBend(parent, joint, child) { return radiansToDegrees(Math.acos(clamp(dot(direction(parent, joint), direction(joint, child)), -1, 1))); }
function segmentRotationFromBind(joint, child, parent) { const world = new THREE.Vector3().fromArray(direction(joint, child)).applyQuaternion(new THREE.Quaternion().fromArray(parent.worldRotation).invert()).normalize().toArray(); return radiansToDegrees(Math.acos(clamp(dot(world, normalize(child.bindLocalPosition)), -1, 1))); }
function direction(a, b) { return normalize(b.worldPosition.map((value, index) => value - a.worldPosition[index])); }
function endpointErrors(errors, suffix) { const left = errors[`left${suffix}`] ?? null; const right = errors[`right${suffix}`] ?? null; return { left, right, maximum: Math.max(left ?? 0, right ?? 0) }; }
function symmetryError(errors) { return Math.max(0, ...['Shoulder','UpperArm','LowerArm','Hand','UpperLeg','LowerLeg','Foot','Toes'].map((suffix) => Math.abs((errors[`left${suffix}`] ?? 0) - (errors[`right${suffix}`] ?? 0)))); }
function summarizeRegions(pairs) { const counts = new Map(); for (const pair of pairs) { const key = [pair.leftRegion,pair.rightRegion].sort().join('+'); counts.set(key, (counts.get(key) ?? 0) + 1); } return [...counts].map(([regions,count]) => ({ regions,count })).sort((a,b) => b.count-a.count); }
function poseFingerprint(pose) { return JSON.stringify({ rootPosition: pose.rootPosition, rootRotation: pose.rootRotation, localRotations: pose.localRotations }); }
function normalize(value) { const length = Math.hypot(...value) || 1; return value.map((component) => component / length); }
function distance(a,b) { return Math.hypot(...a.map((value,index) => value-b[index])); }
function dot(a,b) { return a.reduce((sum,value,index) => sum + value*b[index], 0); }
function mean(values) { return values.length ? values.reduce((sum,value) => sum+value,0)/values.length : 0; }
function clamp(value,min,max) { return Math.min(max,Math.max(min,value)); }
function radiansToDegrees(value) { return value*180/Math.PI; }
function readJson(filename) { return JSON.parse(fs.readFileSync(filename,'utf8')); }
function writeJson(filename,value) { fs.writeFileSync(filename, `${JSON.stringify(value,null,2)}\n`); }
