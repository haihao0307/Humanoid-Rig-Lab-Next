import * as THREE from 'three';
import {
  HumanCoreRuntime,
  PROCEDURAL_BODY_DNA_PRESETS_V5,
  ProceduralDeformRuntimeV5,
  V4Adapter,
  createBodyDNA,
  createProceduralDeformValidationPoseV5,
  createProceduralSimulationRigFrameV5,
} from '../../src/modules/human-core-v5/index.js';
import { createSmplSkinLayer } from '../../legacy/v8/src/smpl-skin.js';
import { TemplateBindSpaceRetargetAdapterV5 } from '../human-core-v5-template-bind-alignment-pilot/template-bind-space-retarget-adapter-v5.js';
import { TemplateCanonicalReferencePoseCalibratorV5 } from './template-canonical-reference-pose-calibrator-v5.js';

const OUTPUT_URL = '../../artifacts/qa/task14c-template-reference-pose-retarget-pilot';
const METRICS_URL = `${OUTPUT_URL}/metrics.json`;
const REFERENCE_AUDIT_URL = `${OUTPUT_URL}/reference-pose-audit.json`;
const BASIS_AUDIT_URL = `${OUTPUT_URL}/full-basis-audit.json`;
const SCENARIOS = Object.freeze({
  'reference-t': Object.freeze({ poseId: 't-pose', label: 'Reference T' }),
  'reference-a': Object.freeze({ poseId: 'a-pose', label: 'Reference A' }),
  'shoulder-150': Object.freeze({ poseId: 'arm-raise-150-left', label: 'Shoulder Raise fixture' }),
  'elbow-140': Object.freeze({ poseId: 'elbow-bend-140-left', label: 'Elbow Bend 140' }),
  'hip-flex': Object.freeze({ poseId: 'hip-flex-left', label: 'Hip Flex 55' }),
  'knee-bend': Object.freeze({ poseId: 'knee-bend-left', label: 'Knee Bend 110' }),
});
const CAMERA = Object.freeze({ target: [0, 0.91, 0], position: [0, 0.91, 3.2], halfHeight: 1.03 });

const search = new URLSearchParams(location.search);
const consoleErrors = [];
const pageErrors = [];
const progress = { ready: false, phase: 'boot', error: null };
publishWindowState({
  ...progress,
  scenario: null,
  sharedFinalPoseId: null,
  sourceMetrics: null,
  directMetrics: null,
  pilotCMetrics: null,
  pilotDMetrics: null,
  assetRestoreGate: null,
  referencePoseGate: null,
  fullBasisGate: null,
  consoleErrors,
  pageErrors,
  glbRequests: [],
  geometryPresent: null,
});
const originalConsoleError = console.error.bind(console);
console.error = (...values) => {
  consoleErrors.push(values.map(formatError).join(' '));
  originalConsoleError(...values);
};
addEventListener('error', (event) => recordPageError(event.error ?? event.message));
addEventListener('unhandledrejection', (event) => recordPageError(event.reason));

const [metrics, referenceAudit, basisAudit] = await Promise.all([
  fetch(METRICS_URL).then(readJson),
  fetch(REFERENCE_AUDIT_URL).then(readJson),
  fetch(BASIS_AUDIT_URL).then(readJson),
]);
progress.phase = 'evidence-loaded';

if (search.get('contact') === '1') await buildContactSheet();
else await buildComparison();

async function buildComparison() {
  const scenarioId = search.get('scenario') ?? 'reference-t';
  const spec = SCENARIOS[scenarioId];
  if (!spec) throw new Error(`Unknown Pilot D scenario ${scenarioId}.`);
  const showRig = search.get('rig') === '1';
  applyFocusLayout(search.get('focus'));
  const record = metrics.scenarios.find((entry) => entry.scenarioId === scenarioId);
  if (!record) throw new Error(`Missing Pilot D metrics for ${scenarioId}.`);

  progress.phase = 'building-shared-authority';
  const bodyDNA = createBodyDNA({
    ...structuredClone(PROCEDURAL_BODY_DNA_PRESETS_V5.Reference),
    bodyDNAId: 'task14c-template-reference-pose-pilot-reference',
    identity: { humanId: 'task14c-template-reference-pose-pilot-reference', label: 'Reference' },
    proportionRevision: 14,
  });
  const human = new HumanCoreRuntime();
  human.createHuman(bodyDNA);
  const rigCore = human.getRigCore();
  const finalPose = createProceduralDeformValidationPoseV5({ poseId: spec.poseId, rigCore, bodyDNA, timestamp: 1 });
  const referenceTPose = createProceduralDeformValidationPoseV5({ poseId: 't-pose', rigCore, bodyDNA, timestamp: 0 });
  human.updatePose(finalPose);
  const simulationRig = createProceduralSimulationRigFrameV5({ finalPose, rigCore, bodyDNA });
  const sourceReferenceFrame = createProceduralSimulationRigFrameV5({ finalPose: referenceTPose, rigCore, bodyDNA });
  const adapted = V4Adapter.humanRigCoreToExistingRig(rigCore, { bodyDNA, pose: 'T' });
  const productionFrame = {
    type: 'SimulationRigFrame',
    schema: 'humanoid_rig/simulation_rig_frame@4.0',
    frameId: record.sharedFinalPoseId,
    finalPose,
  };

  const proceduralView = createView(document.querySelector('#procedural-viewport'), 0xc8aa92);
  const directView = createView(document.querySelector('#direct-viewport'), 0xc8cdd1);
  const pilotCView = createView(document.querySelector('#pilot-c-viewport'), 0xd4ad8b);
  const pilotDView = createView(document.querySelector('#pilot-d-viewport'), 0xaedbc6);
  const procedural = new ProceduralDeformRuntimeV5();
  procedural.compileHuman({ bodyDNA, rigCore });
  const template = await createSmplSkinLayer(THREE, pilotDView.scene, adapted.definition, {
    legacyDiagnosticRuntimeWeights: false,
  });
  progress.phase = 'generating-procedural-r48';
  await procedural.generateCanonicalSurface({ resolution: 48, worker: false, projectionMode: 'legacy' });
  if (template.detailPromise) await template.detailPromise;
  if (!template.mesh || !template.weightsReady) throw new Error('Stable template GLB failed to load.');

  const proceduralFrame = procedural.update({ finalPose, anatomyState: human.getAnatomyState(), timestamp: 1 });
  const proceduralGeometry = geometryFromPositions(
    proceduralFrame.deformedPositions,
    proceduralFrame.indices,
    proceduralFrame.deformedNormals,
  );
  proceduralView.scene.add(new THREE.Mesh(proceduralGeometry, proceduralView.material));

  const pilotC = new TemplateBindSpaceRetargetAdapterV5({
    THREE, templateLayer: template, rigCore, sourceBindFrame: sourceReferenceFrame,
  });
  const pilotD = new TemplateCanonicalReferencePoseCalibratorV5({
    THREE, templateLayer: template, rigCore, sourceReferenceFrame,
  });
  pilotD.restoreAsset();
  template.refresh(adapted.definition, null, { force: true, simulationRigFrame: productionFrame });
  const templateIndices = new Uint32Array(template.mesh.geometry.index.array);
  const directGeometry = geometryFromPositions(template.sampleDeformedPositions(), templateIndices);
  directView.scene.add(new THREE.Mesh(directGeometry, directView.material));

  pilotC.apply(finalPose);
  const pilotCGeometry = geometryFromPositions(template.sampleDeformedPositions(), templateIndices);
  pilotCView.scene.add(new THREE.Mesh(pilotCGeometry, pilotCView.material));

  pilotD.apply(finalPose);
  const oldMaterial = template.mesh.material;
  template.material = pilotDView.material;
  template.mesh.material = pilotDView.material;
  if (oldMaterial !== pilotDView.material) oldMaterial?.dispose?.();

  if (showRig) pilotDView.scene.add(createRigOverlay(simulationRig));
  for (const view of [proceduralView, directView, pilotCView, pilotDView]) renderView(view);
  await nextFrames(3);
  for (const view of [proceduralView, directView, pilotCView, pilotDView]) renderView(view);

  document.querySelector('#scenario-title').textContent = `${spec.label}${showRig ? ' · Rig Overlay' : ''}`;
  document.querySelector('#procedural-caption').textContent = `${spec.label} · SHARED POSE TRUTH`;
  document.querySelector('#direct-caption').textContent = `${spec.label} · DIRECT`;
  document.querySelector('#pilot-c-caption').textContent = `${spec.label} · PILOT C`;
  document.querySelector('#pilot-d-caption').textContent = `${spec.label} · SAME REFERENCE + FULL BASIS`;
  if (!record.passed) {
    const badge = document.querySelector('#pilot-d-card .template-badge');
    badge.innerHTML = 'EXPERIMENTAL · GATE PARTIAL<br>NOT FOR ACCEPTANCE';
  }
  populateMetrics(record);
  document.querySelector('#loading').classList.add('hidden');
  document.body.dataset.pilotReady = 'true';
  progress.ready = true;
  progress.phase = 'ready';

  const glbRequests = performance.getEntriesByType('resource')
    .filter((entry) => /smpl-male-surface-skinned\.glb(?:$|[?#])/i.test(entry.name))
    .map((entry) => entry.name);
  const publicState = {
    ready: true,
    scenario: scenarioId,
    sharedFinalPoseId: record.sharedFinalPoseId,
    sourceMetrics: record.sourceMetrics,
    directMetrics: publicTemplateMetrics(record.directMetrics),
    pilotCMetrics: publicTemplateMetrics(record.pilotCMetrics),
    pilotDMetrics: publicTemplateMetrics(record.pilotDMetrics),
    assetRestoreGate: metrics.assetRestoreGate,
    referencePoseGate: metrics.referencePoseGate,
    fullBasisGate: metrics.fullBasisGate,
    consoleErrors: [...consoleErrors],
    pageErrors: [...pageErrors],
    glbRequests,
    geometryPresent: {
      procedural: proceduralGeometry.getAttribute('position').count > 0,
      direct: directGeometry.getAttribute('position').count > 0,
      pilotC: pilotCGeometry.getAttribute('position').count > 0,
      pilotD: template.mesh.geometry.getAttribute('position').count > 0,
    },
  };
  publishWindowState(publicState);
  publishState(publicState);
}

function populateMetrics(record) {
  const angles = record.measuredAngles;
  document.querySelector('#authority-summary').innerHTML = `<div class="authority-box">`
    + `<b>Authority:</b> identical finalPose.localRotations<br>`
    + `<b>Reference:</b> runtime-only calibrated Target T<br>`
    + `<b>Dynamic:</b> targetReference × (M × Δsource × M⁻¹)<br>`
    + `<b>Asset Restore:</b> ${metrics.assetRestoreGate.passed}<br>`
    + `<b>Reference Gate:</b> ${metrics.referencePoseGate.passed}<br>`
    + `<b>Full Basis Gate:</b> ${metrics.fullBasisGate.passed}</div>`;
  const rows = [
    ['Shoulder deg', ...angles.shoulderElevationDeg],
    ['Elbow deg', ...angles.elbowFlexionDeg],
    ['Hip deg', ...angles.hipFlexionDeg],
    ['Knee deg', ...angles.kneeFlexionDeg],
    ['Joint max m', 0, record.directMetrics.maximumMappedJointWorldError, record.pilotCMetrics.maximumMappedJointWorldError, record.pilotDMetrics.maximumMappedJointWorldError],
    ['Joint mean m', 0, record.directMetrics.meanMappedJointWorldError, record.pilotCMetrics.meanMappedJointWorldError, record.pilotDMetrics.meanMappedJointWorldError],
    ['Wrist max m', 0, record.directMetrics.wristEndpointError.maximum, record.pilotCMetrics.wristEndpointError.maximum, record.pilotDMetrics.wristEndpointError.maximum],
    ['Ankle max m', 0, record.directMetrics.ankleEndpointError.maximum, record.pilotCMetrics.ankleEndpointError.maximum, record.pilotDMetrics.ankleEndpointError.maximum],
    ['Introduced pairs', 0, record.directMetrics.poseIntroducedPairCount, record.pilotCMetrics.poseIntroducedPairCount, record.pilotDMetrics.poseIntroducedPairCount],
  ];
  document.querySelector('#metrics-table').innerHTML = `<div class="metric-group"><h3>Measured FK / actual bone world transforms</h3><div class="metric-grid">`
    + `<div class="label">Metric</div><div>Source</div><div>Direct</div><div>Pilot C</div><div>Pilot D</div>`
    + rows.map(([label, ...values]) => `<div class="label">${escapeHTML(label)}</div>${values.map((value) => `<div>${metric(value)}</div>`).join('')}`).join('')
    + `</div></div>`;
  document.querySelector('#audit-checklist').innerHTML = `<div class="checklist"><b>Scenario gates</b><br>`
    + `angle: ${metric(record.angleGate.maximumErrorDegrees)}° / ${record.angleGate.thresholdDegrees}° · ${record.angleGate.passed ? 'PASS' : 'FAIL'}<br>`
    + `mapped joints: ${record.mappedJointGate ? 'PASS' : 'FAIL'} · endpoints: ${record.endpointGate ? 'PASS' : 'FAIL'} · root: ${record.rootGate ? 'PASS' : 'FAIL'}<br>`
    + `classification: ${escapeHTML(record.failureClassification)}<br>`
    + `preliminary conclusion: ${escapeHTML(metrics.preliminaryConclusion)}</div>`;
}

async function buildContactSheet() {
  document.querySelector('#comparison-page').classList.add('hidden');
  const sheet = document.querySelector('#contact-sheet');
  sheet.classList.remove('hidden');
  const rows = metrics.scenarios.flatMap((record) => {
    const angles = record.measuredAngles;
    const observation = record.passed
      ? 'Pilot D passes the numeric scenario gates.'
      : `Pilot D remains ${record.failureClassification}; evidence is experimental.`;
    return [
      imageCell('procedural', record.scenarioId),
      imageCell('template-direct', record.scenarioId),
      imageCell('template-pilot-c', record.scenarioId),
      imageCell('template-pilot-d', record.scenarioId),
      `<div class="contact-cell contact-summary"><b>${record.scenarioId}</b><br>`
        + `shoulder S/D/C/D: <code>${angles.shoulderElevationDeg.map(metric).join('/')}</code><br>`
        + `elbow S/D/C/D: <code>${angles.elbowFlexionDeg.map(metric).join('/')}</code><br>`
        + `joint max/mean: <code>${metric(record.pilotDMetrics.maximumMappedJointWorldError)}/${metric(record.pilotDMetrics.meanMappedJointWorldError)} m</code><br>`
        + `wrist/ankle: <code>${metric(record.pilotDMetrics.wristEndpointError.maximum)}/${metric(record.pilotDMetrics.ankleEndpointError.maximum)} m</code><br>`
        + `introduced D/C: <code>${record.pilotDMetrics.poseIntroducedPairCount}/${record.pilotCMetrics.poseIntroducedPairCount}</code></div>`,
      `<div class="contact-cell contact-observation"><b>Visual observation</b><br>${escapeHTML(observation)}<br><br>`
        + `Asset Restore=${metrics.assetRestoreGate.passed}<br>Reference=${metrics.referencePoseGate.passed}<br>Full Basis=${metrics.fullBasisGate.passed}<br><br>`
        + `EXPERIMENTAL · NOT FOR ACCEPTANCE</div>`,
    ];
  });
  sheet.innerHTML = `<h1 class="contact-heading">Task 14C Template Reference Pose Retarget Pilot D</h1>`
    + `<p class="contact-subtitle">Procedural Truth vs Direct vs Pilot C vs Pilot D · visualAcceptance=false · productionReady=false · userVisualAcceptance=pending</p>`
    + `<div class="contact-grid"><div class="contact-title">Procedural Truth</div><div class="contact-title">Direct</div><div class="contact-title">Pilot C</div><div class="contact-title">Pilot D</div><div class="contact-title">Angles / errors / penetration</div><div class="contact-title">Visual observation</div>${rows.join('')}</div>`;
  await Promise.all([...sheet.querySelectorAll('img')].map((image) => image.decode()));
  document.body.dataset.pilotReady = 'true';
  const publicState = {
    ready: true,
    scenario: 'contact-sheet',
    sharedFinalPoseId: null,
    sourceMetrics: null,
    directMetrics: null,
    pilotCMetrics: null,
    pilotDMetrics: null,
    assetRestoreGate: metrics.assetRestoreGate,
    referencePoseGate: metrics.referencePoseGate,
    fullBasisGate: metrics.fullBasisGate,
    consoleErrors: [...consoleErrors],
    pageErrors: [...pageErrors],
    glbRequests: [],
    geometryPresent: { procedural: true, direct: true, pilotC: true, pilotD: true },
  };
  publishWindowState(publicState);
  publishState(publicState);
}

function createView(host, color) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true });
  if (!context) throw new Error('Task 14C Pilot D requires WebGL2.');
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: false });
  renderer.setPixelRatio(1);
  renderer.setSize(598, 718, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.append(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060b12);
  scene.fog = new THREE.Fog(0x060b12, 3.8, 7.4);
  scene.add(new THREE.HemisphereLight(0xcfe3f5, 0x24170f, 2.15));
  const key = new THREE.DirectionalLight(0xfff1df, 3.3);
  key.position.set(2.8, 4.2, 3.6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x68b8ff, 1.4);
  rim.position.set(-3.1, 2.3, -2.8);
  scene.add(rim);
  const ground = new THREE.GridHelper(5, 30, 0x244b68, 0x102638);
  ground.position.y = -0.015;
  scene.add(ground);
  const aspect = 598 / 718;
  const camera = new THREE.OrthographicCamera(-CAMERA.halfHeight * aspect, CAMERA.halfHeight * aspect, CAMERA.halfHeight, -CAMERA.halfHeight, 0.01, 20);
  camera.position.fromArray(CAMERA.position);
  camera.lookAt(new THREE.Vector3().fromArray(CAMERA.target));
  camera.updateProjectionMatrix();
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.64, metalness: 0.01, side: THREE.FrontSide });
  return { canvas, renderer, scene, camera, material };
}

function applyFocusLayout(focus) {
  if (!['procedural', 'direct', 'pilot-c', 'pilot-d'].includes(focus)) return;
  const targetId = `${focus}-card`;
  document.querySelector('#comparison-page').style.width = '636px';
  document.querySelector('.comparison-grid').style.gridTemplateColumns = '600px';
  for (const card of document.querySelectorAll('.surface-card')) if (card.id !== targetId) card.classList.add('hidden');
  document.querySelector('#metrics-panel').classList.add('hidden');
}

function geometryFromPositions(positions, indices, normals = null) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
  if (normals) geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
  else geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createRigOverlay(simulationRig) {
  const group = new THREE.Group();
  const segments = [];
  for (const segment of simulationRig.segments) {
    const parent = simulationRig.joints[segment.parentId]?.worldPosition;
    const child = simulationRig.joints[segment.jointId]?.worldPosition;
    if (parent && child) segments.push(...parent, ...child);
  }
  const lines = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(segments, 3)),
    new THREE.LineBasicMaterial({ color: 0x36d6ff, depthTest: false, transparent: true, opacity: 0.95 }),
  );
  lines.renderOrder = 30;
  group.add(lines);
  const points = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(Object.values(simulationRig.joints).flatMap((joint) => joint.worldPosition), 3)),
    new THREE.PointsMaterial({ color: 0xffca57, size: 0.025, sizeAttenuation: true, depthTest: false }),
  );
  points.renderOrder = 31;
  group.add(points);
  return group;
}

function publicTemplateMetrics(value) {
  return {
    poseMetrics: value.poseMetrics,
    mappedJointWorldErrors: value.mappedJointWorldErrors,
    maximumMappedJointWorldError: value.maximumMappedJointWorldError,
    meanMappedJointWorldError: value.meanMappedJointWorldError,
    wristEndpointError: value.wristEndpointError,
    ankleEndpointError: value.ankleEndpointError,
    rootPositionError: value.rootPositionError,
    leftRightSymmetryError: value.leftRightSymmetryError,
    persistentBindPairCount: value.persistentBindPairCount,
    poseIntroducedPairCount: value.poseIntroducedPairCount,
    referencePoseIntroducedPairCount: value.referencePoseIntroducedPairCount,
    dynamicPoseIntroducedPairCount: value.dynamicPoseIntroducedPairCount,
    totalPenetratingPairCount: value.totalPenetratingPairCount,
    boneLengthErrorDecomposition: value.boneLengthErrorDecomposition ?? null,
  };
}

function imageCell(directory, scenarioId) {
  return `<div class="contact-cell"><img src="${OUTPUT_URL}/${directory}/${scenarioId}.png" alt="${scenarioId} ${directory}"></div>`;
}

function publishWindowState(value) {
  const snapshot = structuredClone(value);
  window.__TASK14C_TEMPLATE_REFERENCE_RETARGET_PILOT__ = Object.freeze({
    ...snapshot,
    getState: () => structuredClone(snapshot),
    waitForIdle: async () => structuredClone(snapshot),
  });
}

function recordPageError(error) {
  const message = formatError(error);
  pageErrors.push(message);
  progress.phase = 'failed';
  progress.error = message;
}

function renderView(view) { view.renderer.render(view.scene, view.camera); }
function publishState(value) { document.querySelector('#pilot-state').textContent = JSON.stringify(value); }
function nextFrames(count) { return new Promise((resolve) => { const step = () => count-- <= 0 ? resolve() : requestAnimationFrame(step); requestAnimationFrame(step); }); }
async function readJson(response) { if (!response.ok) throw new Error(`Pilot D evidence unavailable: HTTP ${response.status}.`); return response.json(); }
function metric(value) { return Number.isFinite(value) ? Number(value).toFixed(3) : 'n/a'; }
function formatError(error) { return error instanceof Error ? `${error.name}: ${error.message}` : String(error); }
function escapeHTML(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
