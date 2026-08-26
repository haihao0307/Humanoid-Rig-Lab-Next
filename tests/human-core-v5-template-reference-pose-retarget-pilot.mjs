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
import { TemplateCanonicalReferencePoseCalibratorV5 } from '../apps/human-core-v5-template-reference-pose-retarget-pilot/template-canonical-reference-pose-calibrator-v5.js';

const OUTPUT_DIRECTORY = resolve('artifacts/qa/task14c-template-reference-pose-retarget-pilot');
const REFERENCE_AUDIT_PATH = resolve(OUTPUT_DIRECTORY, 'reference-pose-audit.json');
const BASIS_AUDIT_PATH = resolve(OUTPUT_DIRECTORY, 'full-basis-audit.json');
const METRICS_PATH = resolve(OUTPUT_DIRECTORY, 'metrics.json');
const ASSET_PATH = resolve('legacy/v8/assets/smpl/smpl-male-surface-skinned.glb');
const ASSET_URL = pathToFileURL(ASSET_PATH).href;
const SCENARIOS = Object.freeze([
  Object.freeze({ scenarioId: 'reference-t', poseId: 't-pose', gate: 'reference', threshold: 5 }),
  Object.freeze({ scenarioId: 'reference-a', poseId: 'a-pose', gate: 'all', threshold: 8 }),
  Object.freeze({ scenarioId: 'shoulder-150', poseId: 'arm-raise-150-left', gate: 'shoulder', threshold: 8 }),
  Object.freeze({ scenarioId: 'elbow-140', poseId: 'elbow-bend-140-left', gate: 'elbow', threshold: 8 }),
  Object.freeze({ scenarioId: 'hip-flex', poseId: 'hip-flex-left', gate: 'hip', threshold: 8 }),
  Object.freeze({ scenarioId: 'knee-bend', poseId: 'knee-bend-left', gate: 'knee', threshold: 8 }),
]);
const MAPPED_JOINT_IDS = Object.freeze([
  'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
  'leftShoulder', 'rightShoulder', 'leftUpperArm', 'rightUpperArm',
  'leftLowerArm', 'rightLowerArm', 'leftHand', 'rightHand',
  'leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg',
  'leftFoot', 'rightFoot', 'leftToes', 'rightToes',
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
let referencePoseAudit = null;
let fullBasisAudit = null;
let report = null;

try {
  const bodyDNA = createBodyDNA({
    ...structuredClone(PROCEDURAL_BODY_DNA_PRESETS_V5.Reference),
    bodyDNAId: 'task14c-template-reference-pose-pilot-reference',
    identity: { humanId: 'task14c-template-reference-pose-pilot-reference', label: 'Reference' },
    proportionRevision: 14,
  });
  const human = new HumanCoreRuntime();
  human.createHuman(bodyDNA);
  const rigCore = human.getRigCore();
  const adapted = V4Adapter.humanRigCoreToExistingRig(rigCore, { bodyDNA, pose: 'T' });
  const referenceTPose = createProceduralDeformValidationPoseV5({ poseId: 't-pose', rigCore, bodyDNA, timestamp: 1 });
  const sourceReferenceFrame = createProceduralSimulationRigFrameV5({ finalPose: referenceTPose, rigCore, bodyDNA });

  const procedural = new ProceduralDeformRuntimeV5();
  procedural.compileHuman({ bodyDNA, rigCore });
  await procedural.generateCanonicalSurface({ resolution: 48, worker: false, projectionMode: 'legacy' });

  const templateScene = new THREE.Scene();
  const template = await createSmplSkinLayer(THREE, templateScene, adapted.definition, {
    legacyDiagnosticRuntimeWeights: false,
  });
  if (template.detailPromise) await template.detailPromise;
  if (!template.mesh || !template.weightsReady) throw new Error('Stable template GLB did not load.');

  const pilotC = new TemplateBindSpaceRetargetAdapterV5({
    THREE, templateLayer: template, rigCore, sourceBindFrame: sourceReferenceFrame,
  });
  const pilotD = new TemplateCanonicalReferencePoseCalibratorV5({
    THREE, templateLayer: template, rigCore, sourceReferenceFrame,
  });
  pilotD.applyReferencePose();
  const assetRestoreGate = pilotD.runAssetRestoreGate();
  if (!assetRestoreGate.passed) failures.push('Asset Restore Gate failed.');
  const fullBasisGate = pilotD.fullBasisGate;
  if (!fullBasisGate.passed) failures.push('Full Basis probe gate failed.');

  const templateIndices = new Uint32Array(template.mesh.geometry.index.array);
  const templateRegionIds = buildTemplateRegionIds(template);
  pilotD.restoreAsset();
  const originalBindSkeleton = captureTemplateSkeleton(template, pilotD);
  const originalBindPositions = template.sampleDeformedPositions();
  const originalBindIntersections = intersectionsFor(originalBindPositions, templateIndices, templateRegionIds);
  const originalBindPairMap = pairMap(originalBindIntersections.pairs);

  pilotD.applyReferencePose();
  const targetReferenceSkeleton = captureTemplateSkeleton(template, pilotD);
  const targetReferencePositions = template.sampleDeformedPositions();
  const targetReferenceIntersections = intersectionsFor(targetReferencePositions, templateIndices, templateRegionIds);
  const targetReferencePairMap = pairMap(targetReferenceIntersections.pairs);
  const targetReferenceMetrics = createTemplateMetrics({
    skeleton: targetReferenceSkeleton,
    sourceJoints: sourceReferenceFrame.joints,
    intersections: targetReferenceIntersections,
    originalBindPairMap,
    targetReferencePairMap,
  });
  const sourceReferenceMetrics = measurePose(sourceReferenceFrame.joints);
  const referenceAngleErrors = allAngleErrors(sourceReferenceMetrics, targetReferenceMetrics.poseMetrics);
  const referencePoseGate = {
    passed: referenceAngleErrors.every((value) => value <= 5)
      && targetReferenceMetrics.maximumMappedJointWorldError <= 0.08
      && targetReferenceMetrics.meanMappedJointWorldError <= 0.03
      && targetReferenceMetrics.wristEndpointError.maximum <= 0.05
      && targetReferenceMetrics.ankleEndpointError.maximum <= 0.02
      && targetReferenceMetrics.rootPositionError <= 0.002,
    angleErrorsDegrees: referenceAngleErrors,
    maximumAngleErrorDegrees: Math.max(...referenceAngleErrors),
    maximumMappedJointWorldError: targetReferenceMetrics.maximumMappedJointWorldError,
    meanMappedJointWorldError: targetReferenceMetrics.meanMappedJointWorldError,
    wristEndpointError: targetReferenceMetrics.wristEndpointError,
    ankleEndpointError: targetReferenceMetrics.ankleEndpointError,
    rootPositionError: targetReferenceMetrics.rootPositionError,
    thresholds: {
      angleDegrees: 5,
      maximumMappedJointWorldError: 0.08,
      meanMappedJointWorldError: 0.03,
      wristEndpointError: 0.05,
      ankleEndpointError: 0.02,
      rootPositionError: 0.002,
    },
  };

  const referenceJointAudit = pilotD.createReferencePoseAudit();
  const basisJointAudit = pilotD.createFullBasisAudit();
  referencePoseAudit = {
    schema: 'humanoid_rig/task14c_template_reference_pose_audit@5.0',
    task: 'Task 14C Template Canonical Reference Pose and Full Joint Basis Retarget Pilot D',
    sourceReferencePose: {
      poseId: referenceTPose.poseId,
      rotationConvention: 'bind-relative local delta',
      identityDelta: true,
      hipsWorldPosition: [...sourceReferenceFrame.joints.hips.worldPosition],
    },
    targetOriginalBindPose: {
      convention: 'original glTF node-local TRS plus asset-prebound inverse bind matrices',
      hipsWorldPosition: originalBindSkeleton.hips.worldPosition,
      inverseBindMatricesPreserved: true,
      skinWeightsPreserved: true,
    },
    targetCalibratedReferencePose: {
      runtimeOnly: true,
      referenceFingerprint: pilotD.referenceFingerprintValue,
      localPositionsModified: false,
      localScalesModified: false,
      inverseBindMatricesModified: false,
      skinWeightsModified: false,
    },
    rootCalibration: {
      originalTargetHipsWorld: originalBindSkeleton.hips.worldPosition,
      sourceReferenceHipsWorld: [...sourceReferenceFrame.joints.hips.worldPosition],
      referenceCarrierOffset: pilotD.referenceCarrierOffset.toArray(),
      dynamicRootDeltaForReference: [0, 0, 0],
      rootApplicationCount: 1,
    },
    assetRestoreGate,
    referencePoseGate,
    originalBindPenetratingPairCount: originalBindIntersections.penetratingIntersectionCount,
    targetReferencePenetratingPairCount: targetReferenceIntersections.penetratingIntersectionCount,
    joints: referenceJointAudit,
  };
  fullBasisAudit = {
    schema: 'humanoid_rig/task14c_template_full_basis_audit@5.0',
    task: 'Task 14C Template Canonical Reference Pose and Full Joint Basis Retarget Pilot D',
    formula: 'targetReferenceLocal * (M_source_to_target * sourceBindRelativeDelta * inverse(M_source_to_target))',
    branchSolver: 'deterministic multi-vector Wahba pure-rotation fit; quaternion determinant +1',
    primaryChildPolicy: 'explicit semantic mapping only',
    fullBasisGate,
    joints: basisJointAudit,
  };

  const referenceLengthByJoint = new Map(referenceJointAudit.map((entry) => [entry.targetJointId, entry]));
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
      frameId: `${spec.scenarioId}-pilot-d-shared-final-pose`,
      finalPose,
    };
    const proceduralFrame = procedural.update({
      finalPose, anatomyState: human.getAnatomyState(), timestamp: index + 10,
    });

    pilotD.restoreAsset();
    template.refresh(adapted.definition, null, { force: true, simulationRigFrame: productionFrame });
    const directPositions = template.sampleDeformedPositions();
    const directSkeleton = captureTemplateSkeleton(template, pilotD);
    const directIntersections = intersectionsFor(directPositions, templateIndices, templateRegionIds);

    const pilotCApplication = pilotC.apply(finalPose);
    const pilotCPositions = template.sampleDeformedPositions();
    const pilotCSkeleton = captureTemplateSkeleton(template, pilotD);
    const pilotCIntersections = intersectionsFor(pilotCPositions, templateIndices, templateRegionIds);

    const pilotDApplication = pilotD.apply(finalPose);
    const pilotDPositions = template.sampleDeformedPositions();
    const pilotDSkeleton = captureTemplateSkeleton(template, pilotD);
    const pilotDIntersections = intersectionsFor(pilotDPositions, templateIndices, templateRegionIds);

    const sourceMetrics = measurePose(simulationRig.joints);
    const directMetrics = createTemplateMetrics({
      skeleton: directSkeleton, sourceJoints: simulationRig.joints, intersections: directIntersections,
      originalBindPairMap, targetReferencePairMap,
    });
    const pilotCMetrics = createTemplateMetrics({
      skeleton: pilotCSkeleton, sourceJoints: simulationRig.joints, intersections: pilotCIntersections,
      originalBindPairMap, targetReferencePairMap,
    });
    const pilotDMetrics = createTemplateMetrics({
      skeleton: pilotDSkeleton, sourceJoints: simulationRig.joints, intersections: pilotDIntersections,
      originalBindPairMap, targetReferencePairMap,
    });
    pilotDMetrics.boneLengthErrorDecomposition = createEndpointDecomposition({
      scenarioMetrics: pilotDMetrics,
      referenceMetrics: targetReferenceMetrics,
      lengthByJoint: referenceLengthByJoint,
    });
    const angleGate = evaluateAngleGate(spec, sourceMetrics, pilotDMetrics.poseMetrics);
    const mappedJointGate = pilotDMetrics.maximumMappedJointWorldError <= 0.08
      && pilotDMetrics.meanMappedJointWorldError <= 0.03;
    const endpointGate = pilotDMetrics.wristEndpointError.maximum <= 0.05
      && pilotDMetrics.ankleEndpointError.maximum <= 0.02;
    const rootGate = pilotDMetrics.rootPositionError <= 0.002;
    const finiteGate = geometryFinite(pilotDPositions) && skeletonFinite(pilotDSkeleton);
    const scenarioPassed = referencePoseGate.passed && fullBasisGate.passed
      && angleGate.passed && mappedJointGate && endpointGate && rootGate && finiteGate;
    scenarios.push({
      scenarioId: spec.scenarioId,
      poseId: spec.poseId,
      sharedFinalPoseId: productionFrame.frameId,
      sharedFinalPoseIdentity: productionFrame.finalPose === finalPose,
      sourceMetrics,
      directMetrics,
      pilotCMetrics,
      pilotDMetrics,
      measuredAngles: combineAngles(sourceMetrics, directMetrics.poseMetrics, pilotCMetrics.poseMetrics, pilotDMetrics.poseMetrics),
      pilotCApplication,
      pilotDApplication,
      assetRestoreGate,
      referencePoseGate,
      fullBasisGate,
      angleGate,
      mappedJointGate,
      endpointGate,
      rootGate,
      finiteGate,
      passed: scenarioPassed,
      failureClassification: classifyScenarioFailure({
        referencePoseGate, fullBasisGate, angleGate, mappedJointGate, endpointGate, rootGate,
        decomposition: pilotDMetrics.boneLengthErrorDecomposition,
      }),
      penetration: {
        originalBindPenetratingPairs: originalBindIntersections.pairs,
        directPoseIntroducedPairs: directMetrics.poseIntroducedPairs,
        pilotCPoseIntroducedPairs: pilotCMetrics.poseIntroducedPairs,
        pilotDPoseIntroducedPairs: pilotDMetrics.poseIntroducedPairs,
        persistentBindPairs: pilotDMetrics.persistentBindPairs,
        referencePoseIntroducedPairs: pilotDMetrics.referencePoseIntroducedPairs,
        dynamicPoseIntroducedPairs: pilotDMetrics.dynamicPoseIntroducedPairs,
        resolvedPairs: pilotDMetrics.poseResolvedPairs,
        criticalPairs: pilotDMetrics.poseIntroducedPairs.filter((pair) => pair.critical),
        totalPairs: pilotDMetrics.totalPenetratingPairs,
      },
      geometryPresent: {
        procedural: proceduralFrame.deformedPositions.length > 0,
        direct: directPositions.length > 0,
        pilotC: pilotCPositions.length > 0,
        pilotD: pilotDPositions.length > 0,
      },
    });
  }

  const referenceA = scenarios.find((scenario) => scenario.scenarioId === 'reference-a');
  const skeletonGatesPass = assetRestoreGate.passed && referencePoseGate.passed && fullBasisGate.passed
    && scenarios.every((scenario) => scenario.angleGate.passed && scenario.mappedJointGate && scenario.endpointGate && scenario.rootGate);
  const referenceASurfacePass = referenceA.pilotDMetrics.poseIntroducedPairCount < 100;
  const preliminaryConclusion = !referencePoseGate.passed
    ? 'REFERENCE_POSE_CALIBRATION_FAILED'
    : !scenarios.every((scenario) => scenario.angleGate.passed && scenario.mappedJointGate && scenario.endpointGate && scenario.rootGate)
      ? 'REFERENCE_POSE_PASS_DYNAMIC_PARTIAL'
      : skeletonGatesPass && !referenceASurfacePass
        ? 'REFERENCE_RETARGET_SKELETON_PASS_SKIN_BLOCKED'
        : 'REFERENCE_RETARGET_PROMISING';

  report = {
    schema: 'humanoid_rig/task14c_template_reference_pose_retarget_pilot@5.0',
    task: 'Task 14C Template Canonical Reference Pose and Full Joint Basis Retarget Pilot D',
    baseline: '10d2e68b9a7724cab395c2cdf9491fb482063f29',
    branch: 'experiment/human-core-v5-template-reference-pose-retarget-pilot',
    sourcePoseConvention: 'bind-relative local delta',
    targetReferencePolicy: 'runtime-only calibrated Reference T; asset local positions/scales/IBM/weights unchanged',
    assetRestoreGate,
    referencePoseGate,
    fullBasisGate,
    upperLimbLengthComparison: selectUpperLimbLengths(referenceJointAudit),
    rootCalibration: referencePoseAudit.rootCalibration,
    originalBindPenetratingPairCount: originalBindIntersections.penetratingIntersectionCount,
    originalBindPenetratingPairs: originalBindIntersections.pairs,
    targetReferencePenetratingPairCount: targetReferenceIntersections.penetratingIntersectionCount,
    targetReferenceIntroducedPairs: targetReferenceMetrics.poseIntroducedPairs,
    scenarios,
    referenceARegionSummary: {
      direct: summarizeRegions(referenceA.directMetrics.poseIntroducedPairs),
      pilotC: summarizeRegions(referenceA.pilotCMetrics.poseIntroducedPairs),
      pilotD: summarizeRegions(referenceA.pilotDMetrics.poseIntroducedPairs),
    },
    gates: {
      skeletonGatesPass,
      referenceASurfacePass,
      allScenariosPass: scenarios.every((scenario) => scenario.passed),
      sameTargetReferenceForAllScenarios: new Set(scenarios.map((scenario) => scenario.pilotDApplication.referenceFingerprint)).size === 1,
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
    preliminaryConclusion,
    finalConclusion: null,
    failures,
    visualAcceptance: false,
    productionReady: false,
    userVisualAcceptance: 'pending',
  };
  procedural.dispose();
  template.dispose();
} catch (error) {
  failures.push(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  throw error;
} finally {
  globalThis.fetch = originalFetch;
}

await mkdir(dirname(METRICS_PATH), { recursive: true });
await writeFile(REFERENCE_AUDIT_PATH, `${JSON.stringify(referencePoseAudit, null, 2)}\n`, 'utf8');
await writeFile(BASIS_AUDIT_PATH, `${JSON.stringify(fullBasisAudit, null, 2)}\n`, 'utf8');
await writeFile(METRICS_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  referencePoseAudit: REFERENCE_AUDIT_PATH,
  fullBasisAudit: BASIS_AUDIT_PATH,
  metrics: METRICS_PATH,
  assetRestoreGate: report.assetRestoreGate.passed,
  referencePoseGate: report.referencePoseGate.passed,
  fullBasisGate: report.fullBasisGate.passed,
  scenarioCount: report.scenarios.length,
  preliminaryConclusion: report.preliminaryConclusion,
  failures,
}, null, 2));

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

function intersectionsFor(positions, indices, regionIds) {
  return findSurfaceSelfIntersectionsV5({ positions, indices, regionIds, regionNames: REGION_NAMES });
}

function captureTemplateSkeleton(template, pilotD) {
  template.group.updateMatrixWorld(true);
  return Object.fromEntries(template.orderedJointIds.map((jointId) => {
    const bone = template.bonesById.get(jointId);
    const original = pilotD.original.get(jointId);
    return [jointId, {
      jointId,
      parentId: template.parentIdById.get(jointId) ?? null,
      bindWorldPosition: original.worldPosition.toArray(),
      bindLocalPosition: original.localPosition.toArray(),
      localPosition: bone.position.toArray(),
      localQuaternion: bone.quaternion.toArray(),
      localScale: bone.scale.toArray(),
      worldPosition: bone.getWorldPosition(new THREE.Vector3()).toArray(),
      worldRotation: bone.getWorldQuaternion(new THREE.Quaternion()).toArray(),
    }];
  }));
}

function createTemplateMetrics({ skeleton, sourceJoints, intersections, originalBindPairMap, targetReferencePairMap }) {
  const poseMetrics = measurePose(skeleton);
  const mappedJointWorldErrors = {};
  for (const jointId of MAPPED_JOINT_IDS) {
    if (!sourceJoints[jointId] || !skeleton[jointId]) continue;
    mappedJointWorldErrors[jointId] = distance(sourceJoints[jointId].worldPosition, skeleton[jointId].worldPosition);
  }
  const errorValues = Object.values(mappedJointWorldErrors);
  const currentPairMap = pairMap(intersections.pairs);
  const persistentBindPairs = [...currentPairMap].filter(([key]) => originalBindPairMap.has(key)).map(([, value]) => value);
  const poseIntroducedPairs = [...currentPairMap].filter(([key]) => !originalBindPairMap.has(key)).map(([, value]) => value);
  const poseResolvedPairs = [...originalBindPairMap].filter(([key]) => !currentPairMap.has(key)).map(([, value]) => value);
  const referencePoseIntroducedPairs = [...currentPairMap]
    .filter(([key]) => !originalBindPairMap.has(key) && targetReferencePairMap.has(key))
    .map(([, value]) => value);
  const dynamicPoseIntroducedPairs = [...currentPairMap]
    .filter(([key]) => !originalBindPairMap.has(key) && !targetReferencePairMap.has(key))
    .map(([, value]) => value);
  return {
    poseMetrics,
    mappedJointWorldErrors,
    maximumMappedJointWorldError: Math.max(0, ...errorValues),
    meanMappedJointWorldError: mean(errorValues),
    wristEndpointError: endpointErrors(mappedJointWorldErrors, 'Hand'),
    ankleEndpointError: endpointErrors(mappedJointWorldErrors, 'Foot'),
    rootPositionError: mappedJointWorldErrors.hips ?? Number.POSITIVE_INFINITY,
    leftRightSymmetryError: symmetryError(mappedJointWorldErrors),
    persistentBindPairs,
    poseIntroducedPairs,
    poseResolvedPairs,
    referencePoseIntroducedPairs,
    dynamicPoseIntroducedPairs,
    totalPenetratingPairs: intersections.pairs,
    persistentBindPairCount: persistentBindPairs.length,
    poseIntroducedPairCount: poseIntroducedPairs.length,
    poseResolvedPairCount: poseResolvedPairs.length,
    referencePoseIntroducedPairCount: referencePoseIntroducedPairs.length,
    dynamicPoseIntroducedPairCount: dynamicPoseIntroducedPairs.length,
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
      rightForearm: direction(joints.rightLowerArm, joints.rightHand),
      leftThigh: direction(joints.leftUpperLeg, joints.leftLowerLeg),
      leftCalf: direction(joints.leftLowerLeg, joints.leftFoot),
    },
  };
}

function evaluateAngleGate(spec, source, target) {
  let errors;
  if (spec.gate === 'reference' || spec.gate === 'all') errors = allAngleErrors(source, target);
  else if (spec.gate === 'shoulder') errors = [Math.abs(source.sourceShoulderElevationDeg - target.sourceShoulderElevationDeg)];
  else if (spec.gate === 'elbow') errors = [Math.abs(source.sourceElbowFlexionDeg - target.sourceElbowFlexionDeg)];
  else if (spec.gate === 'hip') errors = [Math.abs(source.sourceHipFlexionDeg - target.sourceHipFlexionDeg)];
  else errors = [Math.abs(source.sourceKneeFlexionDeg - target.sourceKneeFlexionDeg)];
  return {
    errorsDegrees: errors,
    maximumErrorDegrees: Math.max(...errors),
    thresholdDegrees: spec.threshold,
    passed: errors.every((value) => value <= spec.threshold),
  };
}

function allAngleErrors(source, target) {
  return [
    Math.abs(source.sourceShoulderElevationDeg - target.sourceShoulderElevationDeg),
    Math.abs(source.sourceElbowFlexionDeg - target.sourceElbowFlexionDeg),
    Math.abs(source.sourceHipFlexionDeg - target.sourceHipFlexionDeg),
    Math.abs(source.sourceKneeFlexionDeg - target.sourceKneeFlexionDeg),
  ];
}

function combineAngles(source, direct, pilotC, pilotD) {
  return {
    shoulderElevationDeg: [source.sourceShoulderElevationDeg, direct.sourceShoulderElevationDeg, pilotC.sourceShoulderElevationDeg, pilotD.sourceShoulderElevationDeg],
    elbowFlexionDeg: [source.sourceElbowFlexionDeg, direct.sourceElbowFlexionDeg, pilotC.sourceElbowFlexionDeg, pilotD.sourceElbowFlexionDeg],
    hipFlexionDeg: [source.sourceHipFlexionDeg, direct.sourceHipFlexionDeg, pilotC.sourceHipFlexionDeg, pilotD.sourceHipFlexionDeg],
    kneeFlexionDeg: [source.sourceKneeFlexionDeg, direct.sourceKneeFlexionDeg, pilotC.sourceKneeFlexionDeg, pilotD.sourceKneeFlexionDeg],
  };
}

function createEndpointDecomposition({ scenarioMetrics, referenceMetrics, lengthByJoint }) {
  const definitions = {
    leftWrist: { value: scenarioMetrics.wristEndpointError.left, reference: referenceMetrics.wristEndpointError.left, chain: ['leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand'] },
    rightWrist: { value: scenarioMetrics.wristEndpointError.right, reference: referenceMetrics.wristEndpointError.right, chain: ['rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand'] },
    leftAnkle: { value: scenarioMetrics.ankleEndpointError.left, reference: referenceMetrics.ankleEndpointError.left, chain: ['leftUpperLeg', 'leftLowerLeg', 'leftFoot'] },
    rightAnkle: { value: scenarioMetrics.ankleEndpointError.right, reference: referenceMetrics.ankleEndpointError.right, chain: ['rightUpperLeg', 'rightLowerLeg', 'rightFoot'] },
  };
  return Object.fromEntries(Object.entries(definitions).map(([endpoint, entry]) => {
    const segments = entry.chain.map((jointId) => lengthByJoint.get(jointId)).filter(Boolean);
    const boneLengthComponent = segments.reduce((sum, segment) => sum + segment.absoluteLengthDelta, 0);
    const rootOffsetComponent = scenarioMetrics.rootPositionError;
    const referenceDirectionComponent = entry.reference ?? 0;
    const dynamicRotationComponent = Math.max(0, (entry.value ?? 0) - rootOffsetComponent - referenceDirectionComponent - boneLengthComponent);
    const hasLengthIncompatibility = segments.some((segment) => segment.absoluteLengthDelta > 0.005);
    const classification = hasLengthIncompatibility
      ? 'bone-length incompatibility'
      : referenceDirectionComponent > 0.005
        ? 'reference-direction mismatch'
        : dynamicRotationComponent > 0.005
          ? 'dynamic rotation mismatch'
          : 'none';
    return [endpoint, {
      endpointError: entry.value,
      rootOffsetComponent,
      referenceDirectionComponent,
      boneLengthComponent,
      dynamicRotationComponent,
      classification,
      segmentLengthDeltas: Object.fromEntries(segments.map((segment) => [segment.targetJointId, segment.absoluteLengthDelta])),
    }];
  }));
}

function classifyScenarioFailure({ referencePoseGate, fullBasisGate, angleGate, mappedJointGate, endpointGate, rootGate, decomposition }) {
  if (!referencePoseGate.passed) return 'reference-direction mismatch';
  if (!fullBasisGate.passed) return 'basis mismatch';
  if (!angleGate.passed) return 'dynamic rotation mismatch';
  if (!mappedJointGate || !endpointGate) {
    if (Object.values(decomposition).some((entry) => entry.classification === 'bone-length incompatibility')) return 'bone-length incompatibility';
    if (Object.values(decomposition).some((entry) => entry.classification === 'reference-direction mismatch')) return 'reference-direction mismatch';
    return 'dynamic rotation mismatch';
  }
  if (!rootGate) return 'root mismatch';
  return 'none';
}

function selectUpperLimbLengths(joints) {
  const ids = ['leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand'];
  return Object.fromEntries(ids.map((id) => {
    const entry = joints.find((joint) => joint.targetJointId === id);
    return [id, {
      sourceLength: entry.sourceLength,
      targetLength: entry.targetLength,
      absoluteLengthDelta: entry.absoluteLengthDelta,
      relativeLengthDelta: entry.relativeLengthDelta,
    }];
  }));
}

function summarizeRegions(pairs) {
  const counts = new Map();
  for (const pair of pairs) {
    const regions = Array.isArray(pair.regions) ? pair.regions : [pair.leftRegion, pair.rightRegion].filter(Boolean);
    const key = [...regions].sort().join('+') || 'unknown';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([regions, count]) => ({ regions, count })).sort((left, right) => right.count - left.count);
}

function geometryFinite(positions) {
  for (const value of positions) if (!Number.isFinite(value)) return false;
  return true;
}

function skeletonFinite(skeleton) {
  return Object.values(skeleton).every((joint) => joint.worldPosition.every(Number.isFinite) && joint.worldRotation.every(Number.isFinite));
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
function mean(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); }
function radiansToDegrees(value) { return value * 180 / Math.PI; }
