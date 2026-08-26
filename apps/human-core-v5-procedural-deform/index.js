import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  HumanCoreRuntime,
  ProceduralDeformRuntimeV5,
  PROCEDURAL_BODY_DNA_PRESETS_V5,
  PROCEDURAL_DEFORM_VALIDATION_POSE_IDS_V5,
  PROCEDURAL_DEFORM_VALIDATION_POSE_LABELS_V5,
  compareProceduralRigSurfaceAnchorsV5,
  createBodyDNA,
  createMirroredProceduralDeformValidationPoseV5,
  createProceduralDeformValidationPoseV5,
  createProceduralSimulationRigFrameV5,
  resolveProceduralSimulationRigJointV5,
  StaticValidationPoseCompilerV5,
  createRendererAdapterInputV5,
  measureProceduralDeformValidationPoseV5,
} from '../../src/modules/human-core-v5/index.js';
import {
  ChunkedProceduralHumanAdapterV5,
  ThreeProceduralHumanAdapterV5,
  shouldUseChunkedProceduralHumanAdapterV5,
} from '../../src/renderers/three/three-procedural-human-adapter-v5.js';
import {
  PROCEDURAL_CAMERA_DIRECTIONS_V5,
  frameDeformedBoundsV5,
  selectJointLocalDeformedPositionsV5,
} from './procedural-camera-fit-v5.js';

const container = document.querySelector('#viewport');
const loading = document.querySelector('#loading');
const searchParameters = new URLSearchParams(location.search);
const forceWebGL = searchParameters.get('forceWebGL') === '1';
const forceChunkedUpload = searchParameters.get('forceChunkedUpload') === '1';
const runtimeErrors = [];
const originalConsoleError = console.error.bind(console);
console.error = (...values) => {
  runtimeErrors.push(values.map(formatError).join(' '));
  originalConsoleError(...values);
};
addEventListener('error', (event) => runtimeErrors.push(formatError(event.error ?? event.message)));
addEventListener('unhandledrejection', (event) => runtimeErrors.push(formatError(event.reason)));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x01040a);
const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
camera.position.set(2.7, 1.45, 3.1);
const rendererState = await createRenderer();
const { renderer } = rendererState;
container.append(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.95, 0);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xbad8ff, 0x24180e, 2.1));
const key = new THREE.DirectionalLight(0xffffff, 2.8);
key.position.set(2, 4, 3);
scene.add(key);
const rim = new THREE.DirectionalLight(0x61bfff, 1.2);
rim.position.set(-3, 2, -3);
scene.add(rim);
scene.add(new THREE.GridHelper(8, 40, 0x1f5d8a, 0x10243a));

const useChunkedUpload = rendererState.activeBackend === 'WebGPU'
  && shouldUseChunkedProceduralHumanAdapterV5(rendererState.webgpu.adapterInfo, { force: forceChunkedUpload });
const adapter = useChunkedUpload
  ? new ChunkedProceduralHumanAdapterV5()
  : new ThreeProceduralHumanAdapterV5();
rendererState.webgpu.rendererAdapter = adapter.getDiagnostics().adapter;
rendererState.webgpu.uploadMode = adapter.getDiagnostics().uploadMode;
scene.add(adapter.getObject3D());
const simulationRigGroup = new THREE.Group();
simulationRigGroup.name = 'IndependentSimulationRigFK';
scene.add(simulationRigGroup);
const proceduralAnchorGroup = new THREE.Group();
proceduralAnchorGroup.name = 'ProceduralRegionAnchors';
scene.add(proceduralAnchorGroup);
const primitiveGroup = new THREE.Group();
primitiveGroup.name = 'ProceduralFieldPrimitives';
scene.add(primitiveGroup);

const AUXILIARY_PREVIEW_CAPACITIES = Object.freeze({
  simulationSegmentVertices: 256,
  simulationJointVertices: 128,
  proceduralAnchorVertices: 128,
  primitiveMeshes: 256,
});
const simulationRigLinePreview = createDynamicPositionPreview({
  capacity: AUXILIARY_PREVIEW_CAPACITIES.simulationSegmentVertices,
  material: new THREE.LineBasicMaterial({ color: 0x45e3ff }),
  type: 'line-segments',
});
const simulationRigJointPreview = createDynamicPositionPreview({
  capacity: AUXILIARY_PREVIEW_CAPACITIES.simulationJointVertices,
  material: new THREE.PointsMaterial({ color: 0xb4f5ff, size: 0.024 }),
  type: 'points',
});
simulationRigGroup.add(simulationRigLinePreview.object, simulationRigJointPreview.object);
const proceduralAnchorPreview = createDynamicPositionPreview({
  capacity: AUXILIARY_PREVIEW_CAPACITIES.proceduralAnchorVertices,
  material: new THREE.PointsMaterial({ color: 0xff4fd2, size: 0.032 }),
  type: 'points',
});
proceduralAnchorGroup.add(proceduralAnchorPreview.object);
const primitivePreviewGeometry = new THREE.SphereGeometry(1, 12, 8);
const primitivePreviewMaterials = Object.freeze({
  subtraction: createPrimitivePreviewMaterial(0xff5f57),
  left: createPrimitivePreviewMaterial(0x36bff5),
  right: createPrimitivePreviewMaterial(0xf27ab8),
  center: createPrimitivePreviewMaterial(0xf5c76b),
});
const primitivePreviewPool = [];
let primitivePreviewActiveCount = 0;

const coreRuntime = new HumanCoreRuntime();
const deformRuntime = new ProceduralDeformRuntimeV5();
let dna = null;
let activePreset = 'Reference';
let activePoseId = 'a-pose';
let displayMode = 'Procedural Surface';
let activeCamera = 'Perspective';
let manualDNA = {};
let rebuildChain = Promise.resolve();
let rebuildTimer = null;
let lastPose = null;
let lastFrame = null;
let lastSimulationRigFrame = null;
let lastAnchorAudit = null;
let lastAngleMeasurements = null;
let lastMirroredAngleMeasurements = null;
let lastGeometryQuality = null;
let lastCameraFrame = null;
let lastQASnapshot = null;
let qaRunning = false;
const qaRecords = [];

const PRESETS = PROCEDURAL_BODY_DNA_PRESETS_V5;
const DISPLAYS = ['Procedural Surface', 'Skeleton', 'Surface + Skeleton', 'Wireframe', 'Region Ownership', 'Field Primitives'];
const CAMERAS = ['Perspective', 'Front', 'Left', 'Right', 'Back', 'Fit', 'Reset'];
const POSE_LABEL_TO_ID = new Map(PROCEDURAL_DEFORM_VALIDATION_POSE_IDS_V5
  .map((poseId) => [PROCEDURAL_DEFORM_VALIDATION_POSE_LABELS_V5[poseId], poseId]));

buildButtons('#preset-list', Object.keys(PRESETS), async (name) => {
  activePreset = name;
  manualDNA = {};
  await queueRebuild();
}, 'preset');
buildButtons('#pose-list', [...POSE_LABEL_TO_ID.keys()], async (label) => {
  activePoseId = POSE_LABEL_TO_ID.get(label);
  updatePose();
}, 'pose');
buildButtons('#display-list', DISPLAYS, async (name) => {
  displayMode = name;
  updateVisibility();
  updateDiagnostics();
}, 'display');
buildButtons('#camera-list', CAMERAS, async (name) => setCamera(name), 'camera');
buildDNAControls();
buildQAActions();
await queueRebuild();
resize();
requestAnimationFrame(render);
addEventListener('resize', resize);
document.body.dataset.qaReady = 'true';

async function rebuildHuman() {
  loading.classList.remove('hidden');
  document.body.dataset.qaReady = 'false';
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const source = mergeDNAInput(PRESETS[activePreset], manualDNA);
  dna = createBodyDNA({
    bodyDNAId: `body-dna-${activePreset.toLowerCase()}`,
    identity: { humanId: 'procedural-preview-human', label: activePreset },
    proportionRevision: 1,
    ...source,
  });
  coreRuntime.createHuman(dna);
  deformRuntime.compileHuman({ bodyDNA: dna, rigCore: coreRuntime.getRigCore() });
  await deformRuntime.generateCanonicalSurface({ resolution: 40, worker: true });
  buildPrimitivePreview();
  updatePose();
  syncDNAControls();
  loading.classList.add('hidden');
  document.body.dataset.qaReady = 'true';
}

function queueRebuild() {
  rebuildChain = rebuildChain.then(rebuildHuman).catch((error) => {
    runtimeErrors.push(formatError(error));
    loading.textContent = `生成失败：${formatError(error)}`;
    updateDiagnostics();
    throw error;
  });
  return rebuildChain;
}

function updatePose() {
  const rigCore = coreRuntime.getRigCore();
  lastPose = createProceduralDeformValidationPoseV5({
    poseId: activePoseId,
    rigCore,
    bodyDNA: dna,
    timestamp: performance.now(),
  });
  coreRuntime.updatePose(lastPose);
  lastFrame = deformRuntime.update({
    finalPose: lastPose,
    anatomyState: coreRuntime.getAnatomyState(),
    deltaTime: 1 / 60,
  });
  if (lastPose.constraintState?.staticValidation?.validationFixtureOnly) {
    const resolvedPose = new StaticValidationPoseCompilerV5().resolveSurfaceContact({
      pose: lastPose,
      surface: deformRuntime.surface,
      deformFrame: lastFrame,
    });
    lastPose = resolvedPose;
    coreRuntime.updatePose(lastPose);
    lastFrame = deformRuntime.update({
      finalPose: lastPose,
      anatomyState: coreRuntime.getAnatomyState(),
      deltaTime: 1 / 60,
    });
  }
  lastSimulationRigFrame = createProceduralSimulationRigFrameV5({
    finalPose: lastPose,
    rigCore,
    bodyDNA: dna,
  });
  lastAnchorAudit = compareProceduralRigSurfaceAnchorsV5(
    lastSimulationRigFrame,
    lastFrame.regionDiagnostics,
  );
  lastAngleMeasurements = measureProceduralDeformValidationPoseV5({
    finalPose: lastPose,
    simulationRigFrame: lastSimulationRigFrame,
  });
  lastMirroredAngleMeasurements = null;
  if (activePoseId === 'hip-flex-left' || activePoseId === 'knee-bend-left') {
    const mirroredPoseId = activePoseId.replace('-left', '-right');
    const mirroredPose = createMirroredProceduralDeformValidationPoseV5(lastPose, mirroredPoseId);
    const mirroredSimulationRig = createProceduralSimulationRigFrameV5({
      finalPose: mirroredPose,
      rigCore,
      bodyDNA: dna,
    });
    lastMirroredAngleMeasurements = measureProceduralDeformValidationPoseV5({
      finalPose: mirroredPose,
      simulationRigFrame: mirroredSimulationRig,
    });
  }
  lastGeometryQuality = deformRuntime.analyzeCurrentDeformationQuality();
  adapter.update(createRendererAdapterInputV5(lastFrame));
  buildSimulationRigPreview(lastSimulationRigFrame);
  buildProceduralAnchorPreview(lastFrame.regionDiagnostics);
  updateVisibility();
  updateDiagnostics();
  document.body.dataset.qaPose = activePoseId;
}

function updateVisibility() {
  adapter.getObject3D().visible = !['Skeleton', 'Field Primitives'].includes(displayMode);
  simulationRigGroup.visible = ['Skeleton', 'Surface + Skeleton'].includes(displayMode);
  proceduralAnchorGroup.visible = displayMode === 'Surface + Skeleton';
  primitiveGroup.visible = displayMode === 'Field Primitives';
  adapter.setDisplayMode(displayMode === 'Wireframe'
    ? 'wireframe'
    : displayMode === 'Region Ownership' ? 'region-ownership' : 'surface');
}

function buildSimulationRigPreview(frame) {
  const segmentPositions = [];
  for (const segment of frame.segments) {
    const parent = frame.joints[segment.parentId];
    const joint = frame.joints[segment.jointId];
    if (parent && joint) segmentPositions.push(...parent.worldPosition, ...joint.worldPosition);
  }
  updateDynamicPositionPreview(simulationRigLinePreview, segmentPositions);
  updateDynamicPositionPreview(
    simulationRigJointPreview,
    Object.values(frame.joints).flatMap((joint) => joint.worldPosition),
  );
}

function buildProceduralAnchorPreview(regionDiagnostics) {
  updateDynamicPositionPreview(
    proceduralAnchorPreview,
    Object.values(regionDiagnostics).flatMap((region) => region.posedAnchor),
  );
}

function buildPrimitivePreview() {
  const regions = deformRuntime.field.definition.regions;
  const cuts = deformRuntime.field.definition.subtractions
    .map((entry) => ({ side: entry.side, primitive: entry.primitive, subtraction: true }));
  const definitions = [...regions, ...cuts];
  ensurePrimitivePreviewPool(definitions.length);
  definitions.forEach((region, index) => {
    const primitive = region.primitive;
    const center = primitive.center ?? primitive.start.map((value, index) => (value + primitive.end[index]) / 2);
    const radii = primitive.radii ?? primitive.startRadii;
    const mesh = primitivePreviewPool[index];
    mesh.material = region.subtraction
      ? primitivePreviewMaterials.subtraction
      : primitivePreviewMaterials[region.side] ?? primitivePreviewMaterials.center;
    mesh.position.fromArray(center);
    mesh.scale.fromArray(radii);
    mesh.visible = true;
  });
  for (let index = definitions.length; index < primitivePreviewPool.length; index += 1) {
    primitivePreviewPool[index].visible = false;
  }
  primitivePreviewActiveCount = definitions.length;
}

function updateDiagnostics() {
  if (!lastFrame) return;
  const surface = deformRuntime.getSurfaceMetadata();
  const deform = deformRuntime.getDiagnostics();
  const adapterDiagnostics = adapter.getDiagnostics();
  const normalAudit = auditNormals(lastFrame.deformedNormals);
  const finiteAudit = auditFiniteGeometry(lastFrame);
  const requestedAngles = lastPose.constraintState.validationPose.requestedAngles;
  const topology = createTopologyGate(surface.generationDiagnostics);
  const alignment = { ...lastAnchorAudit, passed: lastAnchorAudit.passed };
  const jointSurfaceGeometry = createJointSurfaceGeometryGate(lastGeometryQuality);
  const qaGates = {
    topology,
    rigSurfaceAlignment: alignment,
    jointSurfaceGeometry,
    visualAcceptance: { passed: false, status: 'FAIL', reason: 'pending-user-review' },
    productionReady: { passed: false, status: 'FAIL', reason: 'release-flag-locked' },
  };
  const hipDiagnostic = createRequestedAngleDiagnostic(requestedAngles, lastAngleMeasurements, 'leftUpperLeg', 'bend', 'leftHipFlexDegrees');
  const kneeDiagnostic = createRequestedAngleDiagnostic(requestedAngles, lastAngleMeasurements, 'leftLowerLeg', 'bend', 'leftKneeBendDegrees');
  const rightHipDiagnostic = createRequestedAngleDiagnostic(
    lastMirroredAngleMeasurements ? [{ jointId: 'rightUpperLeg', anatomicalChannel: 'bend', requestedAngleDegrees: 55 }] : [],
    lastMirroredAngleMeasurements,
    'rightUpperLeg',
    'bend',
    'rightHipFlexDegrees',
  );
  const rightKneeDiagnostic = createRequestedAngleDiagnostic(
    lastMirroredAngleMeasurements ? [{ jointId: 'rightLowerLeg', anatomicalChannel: 'bend', requestedAngleDegrees: 110 }] : [],
    lastMirroredAngleMeasurements,
    'rightLowerLeg',
    'bend',
    'rightKneeBendDegrees',
  );
  const glbRequests = performance.getEntriesByType('resource')
    .filter((entry) => /\.glb(?:$|[?#])/i.test(entry.name));
  lastQASnapshot = {
    schema: 'humanoid_rig/procedural_deform_browser_qa@5.0',
    timestamp: new Date().toISOString(),
    status: 'runtime-ready-visual-pending',
    active: { preset: activePreset, poseId: activePoseId, poseLabel: PROCEDURAL_DEFORM_VALIDATION_POSE_LABELS_V5[activePoseId], displayMode, camera: activeCamera },
    pose: {
      authority: deform.poseAuthority,
      fixtureSource: 'procedural-deform-validation-poses-v5.js',
      requestedAngles,
      measuredAngles: lastAngleMeasurements,
    },
    rigSurfaceAudit: lastAnchorAudit,
    geometry: {
      bodyDNAFingerprint: surface.bodyDNAFingerprint,
      rigTopologyFingerprint: surface.rigTopologyFingerprint,
      fieldGenerator: surface.generatorVersion,
      surfaceCacheKey: surface.cacheKey,
      topologyFingerprint: surface.topologyFingerprint,
      vertexCount: surface.vertexCount,
      triangleCount: surface.triangleCount,
      connectedComponentCount: surface.generationDiagnostics.connectedComponentCount,
      boundaryEdgeCount: surface.generationDiagnostics.boundaryEdgeCount,
      degenerateTriangleRatio: surface.generationDiagnostics.degenerateTriangleRatio,
      finite: finiteAudit,
      normals: normalAudit,
      deformationQuality: structuredClone(lastGeometryQuality),
      surfaceLayerCount: scene.getObjectsByProperty('name', 'HumanCoreV5ProceduralSurface').length,
    },
    qaGates,
    angleDiagnostics: { hip: hipDiagnostic, knee: kneeDiagnostic, rightHipMirror: rightHipDiagnostic, rightKneeMirror: rightKneeDiagnostic },
    cameraFraming: getCameraFramingState(),
    performance: {
      generatedByWorker: deform.generatedByWorker,
      workerGenerationTimeMs: surface.generationDiagnostics.generationTimeMs,
      medianDeformationMs: deform.medianDeformationMs,
      p95DeformationMs: deform.p95DeformationMs,
      rendererUploadTimeMs: adapterDiagnostics.rendererUploadTimeMs,
    },
    renderer: {
      requestedBackend: rendererState.requestedBackend,
      activeBackend: rendererState.activeBackend,
      fallbackUsed: rendererState.fallbackUsed,
      navigatorGPU: rendererState.navigatorGPU,
      webgpu: structuredClone(rendererState.webgpu),
      webgl2: structuredClone(rendererState.webgl2),
      adapter: adapterDiagnostics,
      auxiliaryPreviews: getAuxiliaryPreviewDiagnostics(),
      forceWebGL,
      forceChunkedUpload,
    },
    resources: { glbDependency: false, glbRequestCount: glbRequests.length, glbRequests: glbRequests.map((entry) => entry.name) },
    errors: [...runtimeErrors],
    visualAcceptance: false,
    productionReady: false,
  };
  const values = {
    'Active preset': activePreset,
    'Active pose': `${PROCEDURAL_DEFORM_VALIDATION_POSE_LABELS_V5[activePoseId]} (${activePoseId})`,
    'Requested angles': requestedAngles.length ? requestedAngles.map((item) => `${item.jointId}.${item.anatomicalChannel}=${item.requestedAngleDegrees}°`).join(', ') : 'canonical identity',
    'Measured angles': formatMeasurements(lastAngleMeasurements),
    'Pose authority': deform.poseAuthority,
    'SimulationRig source': lastSimulationRigFrame.source,
    'Procedural anchors': lastAnchorAudit.proceduralRegionAnchorSource,
    'Anchor max error': `${(lastAnchorAudit.maximumErrorMeters * 1000).toFixed(2)} mm`,
    'Anchor mean error': `${(lastAnchorAudit.meanErrorMeters * 1000).toFixed(2)} mm`,
    'Topology': topology.passed ? 'PASS' : 'FAIL',
    'Rig/Surface Alignment': alignment.passed ? 'PASS' : 'FAIL',
    'Joint Surface Geometry': jointSurfaceGeometry.passed ? 'PASS' : 'FAIL',
    'Visual Acceptance': false,
    'Production Ready': false,
    'Hip Flex requested leftUpperLeg bend': formatAngleDiagnosticValue(hipDiagnostic?.requestedAngleDegrees),
    'Hip Flex measured leftHipFlexDegrees': formatAngleDiagnosticValue(hipDiagnostic?.measuredAngleDegrees),
    'Hip Flex absolute angle error': formatAngleDiagnosticValue(hipDiagnostic?.absoluteErrorDegrees),
    'Hip Flex right mirror measured': formatAngleDiagnosticValue(rightHipDiagnostic?.measuredAngleDegrees),
    'Hip Flex right mirror error': formatAngleDiagnosticValue(rightHipDiagnostic?.absoluteErrorDegrees),
    'Knee Bend requested leftLowerLeg bend': formatAngleDiagnosticValue(kneeDiagnostic?.requestedAngleDegrees),
    'Knee Bend measured leftKneeBendDegrees': formatAngleDiagnosticValue(kneeDiagnostic?.measuredAngleDegrees),
    'Knee Bend absolute angle error': formatAngleDiagnosticValue(kneeDiagnostic?.absoluteErrorDegrees),
    'Knee Bend right mirror measured': formatAngleDiagnosticValue(rightKneeDiagnostic?.measuredAngleDegrees),
    'Knee Bend right mirror error': formatAngleDiagnosticValue(rightKneeDiagnostic?.absoluteErrorDegrees),
    'BodyDNA fingerprint': surface.bodyDNAFingerprint,
    'Rig topology fingerprint': surface.rigTopologyFingerprint,
    'Field generator': surface.generatorVersion,
    'Surface cache key': surface.cacheKey,
    'Vertex count': surface.vertexCount,
    'Triangle count': surface.triangleCount,
    'Connected components': surface.generationDiagnostics.connectedComponentCount,
    'Boundary edges': surface.generationDiagnostics.boundaryEdgeCount,
    'Degenerate triangle ratio': surface.generationDiagnostics.degenerateTriangleRatio.toFixed(8),
    'Finite positions/indices': finiteAudit.passed ? 'PASS' : 'FAIL',
    'Normal length range': `${normalAudit.minimum.toFixed(6)} – ${normalAudit.maximum.toFixed(6)}`,
    'Surface layers': lastQASnapshot.geometry.surfaceLayerCount,
    'Worker generation': deform.generatedByWorker,
    'Worker generation time': `${surface.generationDiagnostics.generationTimeMs.toFixed(2)} ms`,
    'Per-frame deformation': `${(deform.medianDeformationMs ?? 0).toFixed(2)} ms median / ${(deform.p95DeformationMs ?? 0).toFixed(2)} ms p95`,
    'Renderer upload': `${adapterDiagnostics.rendererUploadTimeMs.toFixed(2)} ms`,
    'Requested renderer': rendererState.requestedBackend,
    'Active renderer': rendererState.activeBackend,
    'navigator.gpu': rendererState.navigatorGPU,
    'WebGPU probe': rendererState.webgpu.status,
    'WebGPU adapter': rendererState.webgpu.adapterStatus,
    'WebGPU device': rendererState.webgpu.deviceStatus,
    'Renderer adapter': adapterDiagnostics.adapter,
    'Renderer upload mode': adapterDiagnostics.uploadMode,
    'Renderer chunks': adapterDiagnostics.chunkCount,
    'Largest renderer buffer': `${adapterDiagnostics.maximumBufferByteLength} bytes`,
    'Auxiliary preview buffers': getAuxiliaryPreviewDiagnostics().buffersStable ? 'stable' : 'unstable',
    'Auxiliary runtime geometry disposals': getAuxiliaryPreviewDiagnostics().runtimeGeometryDisposeCount,
    'WebGPU adapter info': JSON.stringify(rendererState.webgpu.adapterInfo ?? 'unavailable'),
    'WebGPU device lost': rendererState.webgpu.deviceLost ? JSON.stringify(rendererState.webgpu.deviceLost) : 'none',
    'WebGL2 fallback': rendererState.webgl2.status,
    'Camera / display': `${activeCamera} / ${displayMode}`,
    'Runtime errors': runtimeErrors.length,
    'GLB requests': glbRequests.length,
  };
  const diagnostics = document.querySelector('#diagnostics');
  diagnostics.innerHTML = Object.entries(values).map(([keyName, value]) => (
    `<dt data-qa-kind="${escapeHTML(keyName)}">${escapeHTML(keyName)}</dt><dd data-qa-value="${escapeHTML(keyName)}">${escapeHTML(value)}</dd>`
  )).join('');
  renderQAGates(qaGates);
}

function buildDNAControls() {
  const definitions = [
    ['Height', 'proportion.height', 1.45, 2.15, 0.01], ['Shoulder width', 'proportion.shoulderWidth', 0.32, 0.56, 0.01],
    ['Hip width', 'proportion.hipWidth', 0.16, 0.32, 0.01], ['Chest thickness', 'proportion.bodyThickness.chest', 0.16, 0.42, 0.01],
    ['Waist thickness', 'proportion.bodyThickness.waist', 0.12, 0.40, 0.01], ['Hip thickness', 'proportion.bodyThickness.hip', 0.16, 0.44, 0.01],
    ['Upper arm', 'proportion.limbLengths.upperArm', 0.22, 0.40, 0.005], ['Forearm', 'proportion.limbLengths.forearm', 0.18, 0.35, 0.005],
    ['Thigh', 'proportion.limbLengths.thigh', 0.34, 0.58, 0.005], ['Lower leg', 'proportion.limbLengths.lowerLeg', 0.32, 0.56, 0.005],
    ['Weight kg', 'mass.weightKg', 45, 130, 1], ['Muscle', 'fitnessProfile.muscle', 0, 1, 0.01], ['Fat', 'fitnessProfile.fat', 0, 1, 0.01],
  ];
  const root = document.querySelector('#dna-controls');
  root.innerHTML = '<h2>BodyDNA 参数</h2>' + definitions.map(([label, path, min, max, step]) => (
    `<label class="control">${label}<output data-output="${path}">-</output><input data-dna-path="${path}" type="range" min="${min}" max="${max}" step="${step}"></label>`
  )).join('');
  for (const input of root.querySelectorAll('[data-dna-path]')) {
    input.addEventListener('input', () => {
      setNested(manualDNA, input.dataset.dnaPath, Number(input.value));
      root.querySelector(`[data-output="${input.dataset.dnaPath}"]`).textContent = Number(input.value).toFixed(Number(input.step) < 1 ? 3 : 0);
      clearTimeout(rebuildTimer);
      rebuildTimer = setTimeout(() => queueRebuild(), 140);
    });
  }
}

function syncDNAControls() {
  for (const input of document.querySelectorAll('[data-dna-path]')) {
    const value = getNested(dna, input.dataset.dnaPath);
    if (!Number.isFinite(value)) continue;
    input.value = String(value);
    document.querySelector(`[data-output="${input.dataset.dnaPath}"]`).textContent = value.toFixed(Number(input.step) < 1 ? 3 : 0);
  }
}

function buildButtons(selector, names, handler, kind) {
  const root = document.querySelector(selector);
  for (const [index, name] of names.entries()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = name;
    button.dataset.qaButton = kind;
    button.dataset.qaName = name;
    button.addEventListener('click', async () => {
      [...root.children].forEach((item) => item.classList.toggle('active', item === button));
      await handler(name);
    });
    root.append(button);
    if (index === 0) button.classList.add('active');
  }
}

function buildQAActions() {
  const actions = {
    'run-full-qa': async () => runFullQA(),
    'capture-current-view': async () => captureCurrentView(),
    'mark-pass': async () => markVisualReview('pass'),
    'mark-fail': async () => markVisualReview('fail'),
    'export-qa-json': async () => exportQAJSON(),
  };
  for (const [id, action] of Object.entries(actions)) {
    document.querySelector(`[data-qa-action="${id}"]`)?.addEventListener('click', action);
  }
}

async function runFullQA() {
  if (qaRunning) return getQAState();
  qaRunning = true;
  qaRecords.length = 0;
  document.body.dataset.qaRunning = 'true';
  setQAOutput('正在执行页面交互矩阵…', 'pending');
  try {
    for (const preset of Object.keys(PRESETS)) {
      await activateButton('preset', preset);
      for (const poseId of PROCEDURAL_DEFORM_VALIDATION_POSE_IDS_V5) {
        await activateButton('pose', PROCEDURAL_DEFORM_VALIDATION_POSE_LABELS_V5[poseId]);
        qaRecords.push(structuredClone(lastQASnapshot));
      }
    }
    const passed = qaRecords.every((record) => record.qaGates.topology.passed
      && record.qaGates.rigSurfaceAlignment.passed
      && record.qaGates.jointSurfaceGeometry.passed
      && record.geometry.finite.passed
      && record.geometry.normals.passed
      && record.geometry.surfaceLayerCount === 1
      && record.resources.glbRequestCount === 0
      && record.errors.length === 0);
    setQAOutput(`${passed ? '文件与运行时诊断 PASS' : '诊断 FAIL'} · ${qaRecords.length} 个组合。视觉验收仍需用户浏览器确认。`, passed ? 'pass' : 'fail');
    return { passed, recordCount: qaRecords.length, records: structuredClone(qaRecords) };
  } finally {
    qaRunning = false;
    document.body.dataset.qaRunning = 'false';
  }
}

async function activateButton(kind, name) {
  const button = [...document.querySelectorAll(`[data-qa-button="${kind}"]`)]
    .find((item) => item.dataset.qaName === name);
  if (!button) throw new Error(`QA button ${kind}:${name} is missing.`);
  button.click();
  if (kind === 'preset') await rebuildChain;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

async function captureCurrentView() {
  const blob = await new Promise((resolve, reject) => renderer.domElement.toBlob(
    (value) => value ? resolve(value) : reject(new Error('Canvas capture returned no PNG.')),
    'image/png',
  ));
  const name = `${rendererState.activeBackend.toLowerCase()}-${activePreset.toLowerCase()}-${activePoseId}.png`;
  downloadBlob(blob, name);
  setQAOutput(`已请求下载 ${name}`, 'pass');
  return name;
}

function markVisualReview(result) {
  const review = {
    result,
    timestamp: new Date().toISOString(),
    preset: activePreset,
    poseId: activePoseId,
    backend: rendererState.activeBackend,
    note: 'Local reviewer mark only. It never changes visualAcceptance or productionReady.',
  };
  localStorage.setItem('hrl.proceduralDeformV5.visualReview', JSON.stringify(review));
  setQAOutput(`已记录本机视觉标记：${result.toUpperCase()}。正式标志仍保持 false。`, result);
  return review;
}

function exportQAJSON() {
  const payload = { ...getQAState(), exportedAt: new Date().toISOString() };
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), 'human-core-v5-procedural-deform-qa.json');
  setQAOutput('已请求导出 QA JSON。', 'pass');
  return payload;
}

function getQAState() {
  return {
    schema: 'humanoid_rig/procedural_deform_browser_qa_session@5.0',
    status: 'runtime-ready-visual-pending',
    current: structuredClone(lastQASnapshot),
    records: structuredClone(qaRecords),
    browserAutomationReady: true,
    subjectiveVisualReview: 'user-reserved',
    visualAcceptance: false,
    productionReady: false,
  };
}

function setQAOutput(message, status) {
  const output = document.querySelector('#qa-output');
  output.textContent = message;
  output.dataset.status = status;
}

async function setCamera(name) {
  if (!lastFrame) return;
  if (name === 'Reset') {
    activePreset = 'Reference';
    activePoseId = 't-pose';
    manualDNA = {};
    setActiveButton('preset', 'Reference');
    setActiveButton('pose', PROCEDURAL_DEFORM_VALIDATION_POSE_LABELS_V5['t-pose']);
    await queueRebuild();
    frameCurrentPose('Perspective', PROCEDURAL_CAMERA_DIRECTIONS_V5.Perspective);
    activeCamera = 'Reset';
    updateDiagnostics();
    return;
  }
  const direction = name === 'Fit'
    ? camera.position.clone().sub(controls.target).toArray()
    : PROCEDURAL_CAMERA_DIRECTIONS_V5[name] ?? PROCEDURAL_CAMERA_DIRECTIONS_V5.Perspective;
  frameCurrentPose(name, direction);
}

function createTopologyGate(generationDiagnostics) {
  const metrics = {
    connectedComponentCount: generationDiagnostics.connectedComponentCount,
    boundaryEdgeCount: generationDiagnostics.boundaryEdgeCount,
    nonManifoldEdgeCount: generationDiagnostics.nonManifoldEdgeCount,
    nonFiniteVertexCount: generationDiagnostics.nonFiniteVertexCount,
    outOfRangeIndexCount: generationDiagnostics.outOfRangeIndexCount,
  };
  return {
    ...metrics,
    passed: metrics.connectedComponentCount === 1
      && metrics.boundaryEdgeCount === 0
      && metrics.nonManifoldEdgeCount === 0
      && metrics.nonFiniteVertexCount === 0
      && metrics.outOfRangeIndexCount === 0,
  };
}

function createJointSurfaceGeometryGate(quality) {
  const metrics = {
    triangleFlipCount: quality.triangleFlipCount,
    localFoldoverCount: quality.localFoldoverCount,
    criticalRegionSelfIntersectionCount: quality.criticalRegionSelfIntersectionCount,
    triangleAreaRatioMinimum: quality.triangleAreaRatioMinimum,
    triangleAreaRatioMaximum: quality.triangleAreaRatioMaximum,
  };
  return {
    ...metrics,
    passed: metrics.triangleFlipCount === 0
      && metrics.localFoldoverCount === 0
      && metrics.criticalRegionSelfIntersectionCount === 0
      && metrics.triangleAreaRatioMinimum >= 0.15
      && metrics.triangleAreaRatioMaximum <= 6,
  };
}

function createRequestedAngleDiagnostic(requestedAngles, measurements, jointId, anatomicalChannel, measurementKey) {
  const requested = requestedAngles?.find((entry) => entry.jointId === jointId && entry.anatomicalChannel === anatomicalChannel);
  const measuredAngleDegrees = measurements?.[measurementKey];
  if (!requested || !Number.isFinite(measuredAngleDegrees)) return null;
  const absoluteErrorDegrees = Math.abs(measuredAngleDegrees - requested.requestedAngleDegrees);
  return {
    jointId,
    anatomicalChannel,
    measurementKey,
    requestedAngleDegrees: requested.requestedAngleDegrees,
    measuredAngleDegrees,
    absoluteErrorDegrees,
    passed: absoluteErrorDegrees <= 1,
    source: 'independent SimulationRig FK',
  };
}

function formatAngleDiagnosticValue(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)}°` : 'n/a';
}

function renderQAGates(gates) {
  const root = document.querySelector('#qa-gates');
  const definitions = [
    ['topology', 'Topology', gates.topology, `components ${gates.topology.connectedComponentCount} · boundary ${gates.topology.boundaryEdgeCount}`],
    ['rig-surface-alignment', 'Rig/Surface Alignment', gates.rigSurfaceAlignment, `max ${(gates.rigSurfaceAlignment.maximumErrorMeters * 1000).toFixed(2)} mm`],
    ['joint-surface-geometry', 'Joint Surface Geometry', gates.jointSurfaceGeometry, `flips ${gates.jointSurfaceGeometry.triangleFlipCount} · foldovers ${gates.jointSurfaceGeometry.localFoldoverCount} · intersections ${gates.jointSurfaceGeometry.criticalRegionSelfIntersectionCount}`],
    ['visual-acceptance', 'Visual Acceptance', gates.visualAcceptance, 'false · user review pending'],
    ['production-ready', 'Production Ready', gates.productionReady, 'false · release locked'],
  ];
  root.innerHTML = definitions.map(([id, label, gate, detail]) => (
    `<div class="gate ${gate.passed ? 'pass' : 'fail'}" data-qa-gate="${id}">${escapeHTML(label)} ${gate.passed ? 'PASS' : 'FAIL'} · ${escapeHTML(detail)}</div>`
  )).join('');
}

function setActiveButton(kind, name) {
  for (const button of document.querySelectorAll(`[data-qa-button="${kind}"]`)) {
    button.classList.toggle('active', button.dataset.qaName === name);
  }
}

function focusJoint(jointId) {
  const resolved = resolveProceduralSimulationRigJointV5(lastSimulationRigFrame, jointId);
  if (!resolved) throw new Error(`Cannot focus missing SimulationRig joint or anatomical region ${jointId}.`);
  const { joint } = resolved;
  const worldPositions = currentWorldDeformedPositions();
  const localPositions = selectJointLocalDeformedPositionsV5({
    positions: worldPositions,
    regionIds: lastFrame.regionIds,
    regionNames: deformRuntime.surface.regionNames,
    jointId,
    jointPosition: joint.worldPosition,
    radius: Math.max(0.16, dna.proportion.height * 0.16),
  });
  const direction = camera.position.clone().sub(controls.target).toArray();
  applyCameraFrame(frameDeformedBoundsV5({
    positions: localPositions,
    direction,
    fovDegrees: camera.getEffectiveFOV(),
    aspect: camera.aspect,
    margin: 0.10,
    target: joint.worldPosition,
  }), {
    kind: 'joint-closeup',
    sourceVertexCount: localPositions.length / 3,
    jointTarget: [...joint.worldPosition],
    jointId,
  });
  activeCamera = `Closeup:${jointId} (${resolved.resolvedJointId})`;
  updateDiagnostics();
  return activeCamera;
}

function frameCurrentPose(name, direction) {
  const worldPositions = currentWorldDeformedPositions();
  applyCameraFrame(frameDeformedBoundsV5({
    positions: worldPositions,
    direction,
    fovDegrees: camera.getEffectiveFOV(),
    aspect: camera.aspect,
    margin: 0.10,
  }), { kind: 'full-body', sourceVertexCount: worldPositions.length / 3 });
  activeCamera = name;
  updateDiagnostics();
}

function applyCameraFrame(frame, metadata) {
  camera.position.fromArray(frame.position);
  camera.up.fromArray(frame.up);
  camera.near = frame.near;
  camera.far = frame.far;
  camera.updateProjectionMatrix();
  controls.target.fromArray(frame.target);
  controls.update();
  camera.updateMatrixWorld(true);
  lastCameraFrame = { ...frame, ...metadata };
}

function currentWorldDeformedPositions() {
  const object = adapter.getObject3D();
  object.updateMatrixWorld(true);
  const matrix = object.matrixWorld;
  const point = new THREE.Vector3();
  const result = new Float32Array(lastFrame.deformedPositions.length);
  for (let offset = 0; offset < lastFrame.deformedPositions.length; offset += 3) {
    point.fromArray(lastFrame.deformedPositions, offset).applyMatrix4(matrix);
    result.set(point.toArray(), offset);
  }
  return result;
}

function getCameraFramingState() {
  if (!lastFrame) return null;
  camera.updateMatrixWorld(true);
  const positions = currentWorldDeformedPositions();
  const point = new THREE.Vector3();
  const ndc = { minimum: [Infinity, Infinity, Infinity], maximum: [-Infinity, -Infinity, -Infinity] };
  let unsafeVertexCount = 0;
  let nearFarClippedCount = 0;
  for (let offset = 0; offset < positions.length; offset += 3) {
    point.fromArray(positions, offset).project(camera);
    for (let axis = 0; axis < 3; axis += 1) {
      ndc.minimum[axis] = Math.min(ndc.minimum[axis], point.getComponent(axis));
      ndc.maximum[axis] = Math.max(ndc.maximum[axis], point.getComponent(axis));
    }
    if (Math.abs(point.x) > 0.900001 || Math.abs(point.y) > 0.900001) unsafeVertexCount += 1;
    if (point.z < -1.000001 || point.z > 1.000001) nearFarClippedCount += 1;
  }
  const target = new THREE.Vector3(...(lastCameraFrame?.jointTarget ?? controls.target.toArray())).project(camera);
  return {
    kind: lastCameraFrame?.kind ?? 'unfitted',
    margin: lastCameraFrame?.margin ?? null,
    source: 'ProceduralDeformFrame.deformedPositions transformed to world space',
    sourceVertexCount: lastCameraFrame?.sourceVertexCount ?? positions.length / 3,
    deformedVertexCount: positions.length / 3,
    ndc,
    unsafeVertexCount,
    nearFarClippedCount,
    allVerticesWithinSafeClip: unsafeVertexCount === 0 && nearFarClippedCount === 0,
    near: camera.near,
    far: camera.far,
    targetNDC: target.toArray(),
    targetWithinCentral60: Math.abs(target.x) <= 0.6 && Math.abs(target.y) <= 0.6,
    jointId: lastCameraFrame?.jointId ?? null,
  };
}

async function createRenderer() {
  const result = {
    requestedBackend: forceWebGL ? 'WebGL2' : 'WebGPU',
    activeBackend: null,
    fallbackUsed: false,
    navigatorGPU: Boolean(navigator.gpu),
    webgpu: {
      status: forceWebGL ? 'skipped-force-webgl2' : 'not-attempted',
      adapterStatus: forceWebGL ? 'skipped' : 'not-attempted',
      deviceStatus: forceWebGL ? 'skipped' : 'not-attempted',
      adapterInfo: null,
      deviceLost: null,
      error: null,
    },
    webgl2: { status: 'not-attempted', error: null },
  };
  if (!forceWebGL && navigator.gpu) {
    try {
      const { WebGPURenderer } = await import('three/webgpu');
      const webgpuRenderer = new WebGPURenderer({ antialias: true });
      await webgpuRenderer.init();
      const rendererDevice = webgpuRenderer.backend?.device ?? null;
      const rendererAdapter = webgpuRenderer.backend?.adapter ?? null;
      result.webgpu.adapterStatus = rendererAdapter ? 'renderer-owned-pass' : 'renderer-owned-unavailable';
      result.webgpu.adapterInfo = normalizeGPUAdapterInfo(rendererAdapter?.info);
      result.webgpu.deviceStatus = rendererDevice ? 'renderer-owned-pass' : 'renderer-owned-unavailable';
      result.webgpu.rendererBackend = webgpuRenderer.backend?.constructor?.name ?? 'WebGPUBackend';
      rendererDevice?.lost?.then((info) => {
        result.webgpu.deviceLost = {
          reason: String(info?.reason ?? 'unknown'),
          message: String(info?.message ?? ''),
          observedAt: new Date().toISOString(),
        };
      });
      result.activeBackend = 'WebGPU';
      result.webgpu.status = 'pass';
      return { renderer: webgpuRenderer, ...result };
    } catch (error) {
      result.webgpu.status = 'fail';
      result.webgpu.error = formatError(error);
      result.fallbackUsed = true;
      console.warn('WebGPU failed; WebGL2 fallback will be tested independently.', error);
    }
  } else if (!forceWebGL) {
    result.webgpu.status = 'unavailable';
    result.webgpu.adapterStatus = 'unavailable';
    result.webgpu.deviceStatus = 'unavailable';
    result.webgpu.error = 'navigator.gpu is absent.';
    result.fallbackUsed = true;
  }
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2', { antialias: true });
    if (!context) throw new Error('A WebGL2 context could not be created.');
    const webglRenderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
    result.activeBackend = 'WebGL2';
    result.webgl2.status = 'pass';
    return { renderer: webglRenderer, ...result };
  } catch (error) {
    result.webgl2 = { status: 'fail', error: formatError(error) };
    throw Object.assign(new Error(`No supported renderer. WebGPU=${result.webgpu.status}; WebGL2=${result.webgl2.status}.`), { cause: error });
  }
}

function auditNormals(normals) {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = 0;
  let invalidCount = 0;
  for (let offset = 0; offset < normals.length; offset += 3) {
    const length = Math.hypot(normals[offset], normals[offset + 1], normals[offset + 2]);
    minimum = Math.min(minimum, length);
    maximum = Math.max(maximum, length);
    if (!Number.isFinite(length) || Math.abs(length - 1) > 0.002) invalidCount += 1;
  }
  return { minimum, maximum, invalidCount, passed: invalidCount === 0 };
}

function auditFiniteGeometry(frame) {
  const nonFinitePositions = [...frame.deformedPositions].filter((value) => !Number.isFinite(value)).length;
  const nonFiniteIndices = [...frame.indices].filter((value) => !Number.isFinite(value)).length;
  const outOfRangeIndices = [...frame.indices].filter((value) => value < 0 || value >= frame.deformedPositions.length / 3).length;
  return { nonFinitePositions, nonFiniteIndices, outOfRangeIndices, passed: nonFinitePositions + nonFiniteIndices + outOfRangeIndices === 0 };
}

function formatMeasurements(measurements) {
  return Object.entries(measurements)
    .filter(([keyName, value]) => keyName !== 'poseId' && Number.isFinite(value))
    .map(([keyName, value]) => `${keyName}=${value.toFixed(2)}°`)
    .join(', ') || 'n/a';
}

function createDynamicPositionPreview({ capacity, material, type }) {
  if (!Number.isInteger(capacity) || capacity <= 0) throw new RangeError('Dynamic preview capacity must be a positive integer.');
  const position = new THREE.BufferAttribute(new Float32Array(capacity * 3), 3);
  position.setUsage(THREE.DynamicDrawUsage);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', position);
  geometry.setDrawRange(0, 0);
  const object = type === 'line-segments'
    ? new THREE.LineSegments(geometry, material)
    : new THREE.Points(geometry, material);
  object.frustumCulled = false;
  return { object, geometry, position, capacity, activeCount: 0 };
}

function updateDynamicPositionPreview(preview, values) {
  if (values.length % 3 !== 0) throw new RangeError('Dynamic preview positions must contain complete XYZ triplets.');
  const count = values.length / 3;
  if (count > preview.capacity) {
    throw new RangeError(`Dynamic preview requires ${count} vertices but fixed capacity is ${preview.capacity}.`);
  }
  preview.position.array.set(values, 0);
  preview.position.clearUpdateRanges();
  if (values.length > 0) preview.position.addUpdateRange(0, values.length);
  preview.position.needsUpdate = true;
  preview.geometry.setDrawRange(0, count);
  preview.activeCount = count;
}

function createPrimitivePreviewMaterial(color) {
  return new THREE.MeshBasicMaterial({
    color,
    wireframe: true,
    transparent: true,
    opacity: 0.45,
  });
}

function ensurePrimitivePreviewPool(count) {
  if (count > AUXILIARY_PREVIEW_CAPACITIES.primitiveMeshes) {
    throw new RangeError(`Primitive preview requires ${count} meshes but fixed capacity is ${AUXILIARY_PREVIEW_CAPACITIES.primitiveMeshes}.`);
  }
  while (primitivePreviewPool.length < count) {
    const mesh = new THREE.Mesh(primitivePreviewGeometry, primitivePreviewMaterials.center);
    mesh.visible = false;
    mesh.frustumCulled = false;
    primitivePreviewPool.push(mesh);
    primitiveGroup.add(mesh);
  }
}

function getAuxiliaryPreviewDiagnostics() {
  const maximumPositionBufferByteLength = Math.max(
    simulationRigLinePreview.position.array.byteLength,
    simulationRigJointPreview.position.array.byteLength,
    proceduralAnchorPreview.position.array.byteLength,
  );
  return {
    buffersStable: true,
    capacityContract: 'semantic-fixed-capacity-no-runtime-reallocation',
    runtimeGeometryDisposeCount: 0,
    maximumPositionBufferByteLength,
    simulationSegments: { active: simulationRigLinePreview.activeCount, capacity: simulationRigLinePreview.capacity },
    simulationJoints: { active: simulationRigJointPreview.activeCount, capacity: simulationRigJointPreview.capacity },
    proceduralAnchors: { active: proceduralAnchorPreview.activeCount, capacity: proceduralAnchorPreview.capacity },
    primitiveMeshes: {
      active: primitivePreviewActiveCount,
      allocated: primitivePreviewPool.length,
      capacity: AUXILIARY_PREVIEW_CAPACITIES.primitiveMeshes,
    },
  };
}

function mergeDNAInput(base, override) {
  const result = structuredClone(base ?? {});
  for (const [keyName, value] of Object.entries(override ?? {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) result[keyName] = mergeDNAInput(result[keyName] ?? {}, value);
    else result[keyName] = value;
  }
  return result;
}

function setNested(target, path, value) {
  const keys = path.split('.');
  let cursor = target;
  for (const keyName of keys.slice(0, -1)) cursor = cursor[keyName] ??= {};
  cursor[keys.at(-1)] = value;
}
function getNested(target, path) { return path.split('.').reduce((value, keyName) => value?.[keyName], target); }
function normalizeGPUAdapterInfo(info) {
  const source = info && typeof info === 'object' ? info : {};
  return Object.fromEntries(['vendor', 'architecture', 'device', 'description', 'isFallbackAdapter'].map((keyName) => [
    keyName,
    source[keyName] === undefined || source[keyName] === '' ? 'unavailable' : source[keyName],
  ]));
}
function formatError(error) { return error instanceof Error ? `${error.name}: ${error.message}` : String(error); }
function escapeHTML(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
function downloadBlob(blob, fileName) { const url = URL.createObjectURL(blob); const link = Object.assign(document.createElement('a'), { href: url, download: fileName }); link.click(); setTimeout(() => URL.revokeObjectURL(url), 0); }
function resize() { const width = container.clientWidth; const height = container.clientHeight; camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(width, height, false); }
function render() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(render); }

async function measureSteadyStatePerformance({ warmupFrames = 20, sampleFrames = 120 } = {}) {
  const warmup = Math.max(1, Math.floor(Number(warmupFrames) || 20));
  const samples = Math.max(1, Math.floor(Number(sampleFrames) || 120));
  const measurements = { deformation: [], normalRebuild: [], rendererUpload: [], frame: [] };
  for (let frameIndex = 0; frameIndex < warmup + samples; frameIndex += 1) {
    const frameStarted = performance.now();
    const deformationStarted = performance.now();
    lastFrame = deformRuntime.update({
      finalPose: lastPose,
      anatomyState: coreRuntime.getAnatomyState(),
      deltaTime: 1 / 60,
    });
    const deformationDuration = performance.now() - deformationStarted;
    adapter.update(createRendererAdapterInputV5(lastFrame));
    const adapterDiagnostics = adapter.getDiagnostics();
    await new Promise((resolveFrame) => requestAnimationFrame(resolveFrame));
    if (frameIndex >= warmup) {
      measurements.deformation.push(deformationDuration);
      measurements.normalRebuild.push(lastFrame.deformationDiagnostics.normalRebuild.durationMs);
      measurements.rendererUpload.push(adapterDiagnostics.rendererUploadTimeMs);
      measurements.frame.push(performance.now() - frameStarted);
    }
  }
  updateDiagnostics();
  return Object.fromEntries(Object.entries(measurements).map(([name, values]) => [name, summarizePerformance(values)]));
}

function summarizePerformance(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const pick = (percentile) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * percentile))] ?? null;
  return { sampleCount: sorted.length, medianMs: pick(0.5), p95Ms: pick(0.95) };
}

window.__HRL_PROCEDURAL_DEFORM_QA__ = Object.freeze({
  getState: getQAState,
  waitForIdle: async () => { await rebuildChain; while (qaRunning) await new Promise((resolve) => setTimeout(resolve, 25)); return getQAState(); },
  runFullQA,
  captureCurrentView,
  markPass: () => markVisualReview('pass'),
  markFail: () => markVisualReview('fail'),
  exportQAJSON,
  setCamera,
  focusJoint,
  getCameraFramingState,
  measureSteadyStatePerformance,
});
