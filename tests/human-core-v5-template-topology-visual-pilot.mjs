import * as THREE from 'three';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  HumanCoreRuntime,
  PROCEDURAL_BODY_DNA_PRESETS_V5,
  ProceduralDeformRuntimeV5,
  V4Adapter,
  analyzeSurfaceGeometryV5,
  compareProceduralRigSurfaceAnchorsV5,
  createBodyDNA,
  createProceduralDeformValidationPoseV5,
  createProceduralSimulationRigFrameV5,
  findSurfaceSelfIntersectionsV5,
} from '../src/modules/human-core-v5/index.js';
import { createBodyShapeProfile } from '../packages/body-shape/index.js';
import { createSmplSkinLayer } from '../legacy/v8/src/smpl-skin.js';

const OUTPUT_PATH = resolve('artifacts/qa/task14c-template-topology-visual-pilot/metrics.json');
const ASSET_PATH = resolve('legacy/v8/assets/smpl/smpl-male-surface-skinned.glb');
const ASSET_URL = pathToFileURL(ASSET_PATH).href;
const ASSET_SHA256 = '736cb39c828203eae72f5e5d094f1623c0a4465a31b484737a6e8df02a7ec899';
const SCENARIOS = Object.freeze([
  Object.freeze({ scenarioId: 'reference-t', preset: 'Reference', poseId: 't-pose' }),
  Object.freeze({ scenarioId: 'reference-a', preset: 'Reference', poseId: 'a-pose' }),
  Object.freeze({ scenarioId: 'shoulder-150', preset: 'Reference', poseId: 'arm-raise-150-left' }),
  Object.freeze({ scenarioId: 'elbow-140', preset: 'Reference', poseId: 'elbow-bend-140-left' }),
  Object.freeze({ scenarioId: 'hip-flex', preset: 'Reference', poseId: 'hip-flex-left' }),
  Object.freeze({ scenarioId: 'knee-bend', preset: 'Reference', poseId: 'knee-bend-left' }),
  Object.freeze({ scenarioId: 'muscular-t', preset: 'Muscular', poseId: 't-pose' }),
  Object.freeze({ scenarioId: 'muscular-a', preset: 'Muscular', poseId: 'a-pose' }),
]);
const TEMPLATE_REGION_NAMES = Object.freeze([
  'pelvis', 'lowerTorso', 'upperTorso', 'neck', 'head',
  'leftUpperArm', 'rightUpperArm', 'leftForearm', 'rightForearm',
  'leftPalm', 'rightPalm', 'leftThigh', 'rightThigh',
  'leftCalf', 'rightCalf', 'leftFoot', 'rightFoot',
]);
const TEMPLATE_JOINT_REGION = Object.freeze({
  hips: 'pelvis', spine: 'lowerTorso', chest: 'upperTorso', upperChest: 'upperTorso', neck: 'neck', head: 'head',
  leftShoulder: 'upperTorso', rightShoulder: 'upperTorso',
  leftUpperArm: 'leftUpperArm', rightUpperArm: 'rightUpperArm',
  leftLowerArm: 'leftForearm', rightLowerArm: 'rightForearm',
  leftHand: 'leftPalm', rightHand: 'rightPalm', leftHandEnd: 'leftPalm', rightHandEnd: 'rightPalm',
  leftUpperLeg: 'leftThigh', rightUpperLeg: 'rightThigh',
  leftLowerLeg: 'leftCalf', rightLowerLeg: 'rightCalf',
  leftFoot: 'leftFoot', rightFoot: 'rightFoot', leftToes: 'leftFoot', rightToes: 'rightFoot',
});
const ANCHOR_JOINT_IDS = Object.freeze([
  'leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm', 'leftHand', 'rightHand',
  'leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg', 'leftFoot', 'rightFoot',
]);

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

const records = [];
const failures = [];
const limitations = [];
let templateMuscularSupported = true;
try {
  for (const preset of ['Reference', 'Muscular']) {
    const bodyDNA = createBodyDNA({
      ...structuredClone(PROCEDURAL_BODY_DNA_PRESETS_V5[preset]),
      bodyDNAId: `task14c-template-pilot-${preset.toLowerCase()}`,
      identity: { humanId: `task14c-template-pilot-${preset.toLowerCase()}`, label: preset },
      proportionRevision: 14,
    });
    const human = new HumanCoreRuntime();
    human.createHuman(bodyDNA);
    const rigCore = human.getRigCore();
    const adapted = V4Adapter.humanRigCoreToExistingRig(rigCore, { bodyDNA, pose: 'T' });
    const templateRequiresRebind = Boolean(adapted.definition.profilePreview?.requiresSkinRebind);
    if (preset === 'Muscular' && templateRequiresRebind) {
      templateMuscularSupported = false;
      limitations.push('Muscular BodyDNA requires a rebound template skin; existing Production Skin V4 correctly blocks pose application.');
    }

    const procedural = new ProceduralDeformRuntimeV5();
    procedural.compileHuman({ bodyDNA, rigCore });
    let started = performance.now();
    await procedural.generateCanonicalSurface({ resolution: 48, worker: false, projectionMode: 'legacy' });
    const proceduralGenerationMs = performance.now() - started;

    const templateScene = new THREE.Scene();
    started = performance.now();
    const template = await createSmplSkinLayer(THREE, templateScene, adapted.definition, {
      legacyDiagnosticRuntimeWeights: false,
    });
    const pendingLoad = template.detailPromise;
    if (pendingLoad) await pendingLoad;
    if (!template.mesh || !template.weightsReady) throw new Error(`Stable template failed to load for ${preset}.`);
    const bodyShape = createTemplateBodyShape(bodyDNA, preset);
    template.setBodyShape(bodyShape);
    const templateLoadMs = performance.now() - started;
    const templateIndices = new Uint32Array(template.mesh.geometry.index.array);
    const templateRegionIds = buildTemplateRegionIds(template);

    for (const spec of SCENARIOS.filter((entry) => entry.preset === preset)) {
      const finalPose = createProceduralDeformValidationPoseV5({
        poseId: spec.poseId,
        rigCore,
        bodyDNA,
        timestamp: 1,
      });
      human.updatePose(finalPose);
      const simulationRig = createProceduralSimulationRigFrameV5({ finalPose, rigCore, bodyDNA });
      const productionSimulationRig = {
        type: 'SimulationRigFrame',
        schema: 'humanoid_rig/simulation_rig_frame@4.0',
        frameId: `${spec.scenarioId}-shared-final-pose`,
        finalPose,
      };

      started = performance.now();
      const proceduralFrame = procedural.update({
        finalPose,
        anatomyState: human.getAnatomyState(),
        timestamp: 1,
      });
      const proceduralPoseMs = performance.now() - started;
      const proceduralTopology = analyzeSurfaceGeometryV5(proceduralFrame.deformedPositions, proceduralFrame.indices);
      const proceduralIntersections = findSurfaceSelfIntersectionsV5({
        positions: proceduralFrame.deformedPositions,
        indices: proceduralFrame.indices,
        regionIds: proceduralFrame.regionIds,
        regionNames: procedural.surface.regionNames,
      });
      const proceduralAnchors = compareProceduralRigSurfaceAnchorsV5(simulationRig, proceduralFrame.regionDiagnostics);
      records.push(createRecord({
        spec,
        surfaceType: 'procedural-r48',
        positions: proceduralFrame.deformedPositions,
        indices: proceduralFrame.indices,
        topology: proceduralTopology,
        intersections: proceduralIntersections,
        anchors: proceduralAnchors,
        generationOrLoadTimeMs: proceduralGenerationMs,
        poseUpdateTimeMs: proceduralPoseMs,
        skinRuntime: 'ProceduralDeformRuntimeV5 resolution=48 projectionMode=legacy',
        bodyShape,
        glbRequests: 0,
        sharedFinalPose: true,
      }));

      started = performance.now();
      template.refresh(adapted.definition, null, { force: true, simulationRigFrame: productionSimulationRig });
      const templatePositions = template.sampleDeformedPositions();
      const templatePoseMs = performance.now() - started;
      const templateTopology = analyzeSurfaceGeometryV5(templatePositions, templateIndices);
      const templateIntersections = findSurfaceSelfIntersectionsV5({
        positions: templatePositions,
        indices: templateIndices,
        regionIds: templateRegionIds,
        regionNames: TEMPLATE_REGION_NAMES,
      });
      const templateAnchors = compareTemplateRigAnchors(template, simulationRig);
      const templateDiagnostics = template.getDiagnostics();
      const templatePoseApplied = templateDiagnostics.productionSkinDiagnostics?.poseAuthority === 'finalPose.localRotations';
      records.push(createRecord({
        spec,
        surfaceType: 'stable-template',
        positions: templatePositions,
        indices: templateIndices,
        topology: templateTopology,
        intersections: templateIntersections,
        anchors: templateAnchors,
        generationOrLoadTimeMs: templateLoadMs,
        poseUpdateTimeMs: templatePoseMs,
        skinRuntime: `${templateDiagnostics.skinVersion} / native Three.js SkinnedMesh GPU LBS / ${templateDiagnostics.bindingVersion}`,
        bodyShape,
        glbRequests: 1,
        sharedFinalPose: productionSimulationRig.finalPose === finalPose && templatePoseApplied,
        templateDiagnostics: {
          assetClass: templateDiagnostics.assetClass,
          productionReady: templateDiagnostics.productionReady,
          poseAuthority: templateDiagnostics.productionSkinDiagnostics?.poseAuthority,
          weightSource: templateDiagnostics.weightSource,
          inverseBindSource: templateDiagnostics.inverseBindSource,
          runtimeWeightGeneration: templateDiagnostics.runtimeWeightGeneration,
          bodyShapeMethod: templateDiagnostics.bodyShape?.method,
          poseApplied: templatePoseApplied,
          requiresSkinRebind: templateRequiresRebind,
        },
      }));
    }

    template.dispose();
    procedural.dispose();
  }
} finally {
  globalThis.fetch = originalFetch;
}

for (const record of records) {
  if (!record.geometryPresent) failures.push(`${record.scenarioId}/${record.surfaceType}: geometry missing`);
  if (!record.sharedFinalPose && record.preset !== 'Muscular') failures.push(`${record.scenarioId}/${record.surfaceType}: finalPose not shared`);
  if (record.surfaceType === 'stable-template' && record.templateDiagnostics?.poseAuthority !== 'finalPose.localRotations') {
    if (record.preset !== 'Muscular') failures.push(`${record.scenarioId}/stable-template: Production Skin pose authority missing`);
  }
}

const report = {
  schema: 'humanoid_rig/task14c_template_topology_visual_pilot@5.0',
  task: 'Task 14C Template Topology Visual Pilot B',
  baseline: 'f3bc99f0f88bf5eadd946ae022ed9a0b79e53d35',
  experimental: true,
  compatibilityTemplate: true,
  notProductionApproved: true,
  notHumanCoreAuthority: true,
  templateAsset: {
    path: 'legacy/v8/assets/smpl/smpl-male-surface-skinned.glb',
    sha256: ASSET_SHA256,
    classification: 'compatibility template / experimental topology carrier',
  },
  templateMuscularSupported,
  templateMuscularMethod: templateMuscularSupported
    ? 'Existing BodyShape regional-radial-displacement-v1 using direct muscle and fat parameters only.'
    : 'Unsupported without a template skin rebind; no new fitting or rebind algorithm was introduced.',
  browserAuditPending: true,
  records,
  failures,
  limitations: [...new Set(limitations)],
  visualAcceptance: false,
  productionReady: false,
};

await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ output: OUTPUT_PATH, recordCount: records.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;

function createTemplateBodyShape(bodyDNA, preset) {
  return createBodyShapeProfile({
    body_shape_id: `task14c-template-${preset.toLowerCase()}`,
    name: `${preset} direct BodyDNA fitness compatibility shape`,
    version: 1,
    muscle: bodyDNA.fitnessProfile.muscle,
    fat: bodyDNA.fitnessProfile.fat,
  });
}

function buildTemplateRegionIds(template) {
  const vertexCount = template.restPositions.length / 3;
  const result = new Uint16Array(vertexCount * 4);
  const regionIndex = new Map(TEMPLATE_REGION_NAMES.map((name, index) => [name, index]));
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    let dominantSlot = 0;
    for (let slot = 1; slot < 4; slot += 1) {
      if (template.skinWeights[vertex * 4 + slot] > template.skinWeights[vertex * 4 + dominantSlot]) dominantSlot = slot;
    }
    const jointIndex = template.skinIndices[vertex * 4 + dominantSlot];
    const jointId = template.jointIds[jointIndex];
    const id = regionIndex.get(TEMPLATE_JOINT_REGION[jointId] ?? 'upperTorso') ?? 2;
    result.fill(id, vertex * 4, vertex * 4 + 4);
  }
  return result;
}

function compareTemplateRigAnchors(template, simulationRig) {
  const samples = [];
  template.mesh.updateMatrixWorld(true);
  for (const jointId of ANCHOR_JOINT_IDS) {
    const rigPosition = simulationRig.joints[jointId]?.worldPosition;
    const bone = template.bonesById.get(jointId);
    if (!rigPosition || !bone) continue;
    const point = bone.getWorldPosition(new THREE.Vector3()).toArray();
    samples.push({ jointId, rigPosition: [...rigPosition], surfaceSkinAnchor: point, errorMeters: distance(rigPosition, point) });
  }
  return {
    sampleCount: samples.length,
    maximumErrorMeters: Math.max(0, ...samples.map((sample) => sample.errorMeters)),
    meanErrorMeters: samples.length ? samples.reduce((sum, sample) => sum + sample.errorMeters, 0) / samples.length : null,
    samples,
    source: 'Production Skin V4 asset bone anchors compared with shared Human Core simulationRig FK',
  };
}

function createRecord({
  spec, surfaceType, positions, indices, topology, intersections, anchors,
  generationOrLoadTimeMs, poseUpdateTimeMs, skinRuntime, bodyShape, glbRequests,
  sharedFinalPose, templateDiagnostics = null,
}) {
  const measurements = measureSurface(positions);
  return {
    scenarioId: spec.scenarioId,
    surfaceType,
    preset: spec.preset,
    poseId: spec.poseId,
    vertexCount: positions.length / 3,
    triangleCount: indices.length / 3,
    connectedComponentCount: topology.connectedComponentCount,
    boundaryEdgeCount: topology.boundaryEdgeCount,
    nonManifoldEdgeCount: topology.nonManifoldEdgeCount,
    penetratingIntersectionCount: intersections.penetratingIntersectionCount,
    criticalPenetratingCount: intersections.criticalPenetratingCount,
    maximumRigSurfaceAnchorError: anchors.maximumErrorMeters,
    meanRigSurfaceAnchorError: anchors.meanErrorMeters,
    height: measurements.height,
    shoulderWidth: measurements.shoulderWidth,
    hipWidth: measurements.hipWidth,
    generationOrLoadTimeMs,
    poseUpdateTimeMs,
    consoleErrors: null,
    pageErrors: null,
    glbRequests,
    geometryPresent: positions.length > 0 && indices.length > 0,
    sharedFinalPose,
    skinRuntime,
    bodyShape: structuredClone(bodyShape),
    templateDiagnostics,
  };
}

function measureSurface(positions) {
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (let offset = 0; offset < positions.length; offset += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      bounds.min[axis] = Math.min(bounds.min[axis], positions[offset + axis]);
      bounds.max[axis] = Math.max(bounds.max[axis], positions[offset + axis]);
    }
  }
  const height = bounds.max[1] - bounds.min[1];
  return {
    height,
    shoulderWidth: sliceWidth(positions, bounds, 0.74, 0.84, height * 0.24),
    hipWidth: sliceWidth(positions, bounds, 0.42, 0.51, height * 0.19),
  };
}

function sliceWidth(positions, bounds, start, end, centralLimit) {
  const height = bounds.max[1] - bounds.min[1];
  const centerX = (bounds.min[0] + bounds.max[0]) * 0.5;
  let min = Infinity;
  let max = -Infinity;
  for (let offset = 0; offset < positions.length; offset += 3) {
    const x = positions[offset];
    const normalizedY = (positions[offset + 1] - bounds.min[1]) / Math.max(1e-9, height);
    if (normalizedY < start || normalizedY > end || Math.abs(x - centerX) > centralLimit) continue;
    min = Math.min(min, x);
    max = Math.max(max, x);
  }
  return Number.isFinite(min) && Number.isFinite(max) ? max - min : 0;
}

function distance(a, b) {
  return Math.hypot(...[0, 1, 2].map((axis) => Number(a[axis]) - Number(b[axis])));
}
