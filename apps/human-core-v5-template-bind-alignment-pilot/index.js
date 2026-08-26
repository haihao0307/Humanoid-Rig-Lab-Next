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
import { TemplateBindSpaceRetargetAdapterV5 } from './template-bind-space-retarget-adapter-v5.js';

const METRICS_URL = '../../artifacts/qa/task14c-template-bind-alignment-pilot/metrics.json';
const BIND_AUDIT_URL = '../../artifacts/qa/task14c-template-bind-alignment-pilot/bind-audit.json';
const SCENARIOS = Object.freeze({
  'reference-t': Object.freeze({ poseId: 't-pose', label: 'Reference T Pose' }),
  'reference-a': Object.freeze({ poseId: 'a-pose', label: 'Reference A Pose' }),
  'shoulder-150': Object.freeze({ poseId: 'arm-raise-150-left', label: 'Shoulder Raise 150' }),
  'elbow-140': Object.freeze({ poseId: 'elbow-bend-140-left', label: 'Elbow Bend 140' }),
  'hip-flex': Object.freeze({ poseId: 'hip-flex-left', label: 'Hip Flex 55' }),
  'knee-bend': Object.freeze({ poseId: 'knee-bend-left', label: 'Knee Bend 110' }),
});
const CAMERA = Object.freeze({ target: [0, 0.91, 0], position: [0, 0.91, 3.2], halfHeight: 1.03 });

const search = new URLSearchParams(location.search);
const runtimeErrors = [];
const pageErrors = [];
const pilotProgress = { ready: false, phase: 'boot', error: null };
window.__TASK14C_TEMPLATE_BIND_PILOT__ = Object.freeze({ getState: () => ({ ...pilotProgress, consoleErrors: [...runtimeErrors], pageErrors: [...pageErrors] }) });
const originalConsoleError = console.error.bind(console);
console.error = (...values) => {
  runtimeErrors.push(values.map(formatError).join(' '));
  originalConsoleError(...values);
};
addEventListener('error', (event) => {
  const message = formatError(event.error ?? event.message);
  pageErrors.push(message);
  pilotProgress.phase = 'failed';
  pilotProgress.error = message;
});
addEventListener('unhandledrejection', (event) => {
  const message = formatError(event.reason);
  pageErrors.push(message);
  pilotProgress.phase = 'failed';
  pilotProgress.error = message;
});

const [metrics, bindAudit] = await Promise.all([
  fetch(METRICS_URL).then(readJson),
  fetch(BIND_AUDIT_URL).then(readJson),
]);
pilotProgress.phase = 'evidence-loaded';

if (search.get('contact') === '1') await buildContactSheet();
else await buildComparison();

async function buildComparison() {
  pilotProgress.phase = 'building-authority';
  const scenarioId = search.get('scenario') ?? 'reference-t';
  const spec = SCENARIOS[scenarioId];
  if (!spec) throw new Error(`Unknown bind pilot scenario ${scenarioId}.`);
  const showRig = search.get('rig') === '1';
  applyFocusLayout(search.get('focus'));
  const record = metrics.scenarios.find((entry) => entry.scenarioId === scenarioId);
  if (!record) throw new Error(`Missing bind pilot metrics for ${scenarioId}.`);

  const bodyDNA = createBodyDNA({
    ...structuredClone(PROCEDURAL_BODY_DNA_PRESETS_V5.Reference),
    bodyDNAId: 'task14c-template-bind-page-reference',
    identity: { humanId: 'task14c-template-bind-page-reference', label: 'Reference' },
    proportionRevision: 14,
  });
  const human = new HumanCoreRuntime();
  human.createHuman(bodyDNA);
  const rigCore = human.getRigCore();
  const finalPose = createProceduralDeformValidationPoseV5({ poseId: spec.poseId, rigCore, bodyDNA, timestamp: 1 });
  const sourceBindPose = createProceduralDeformValidationPoseV5({ poseId: 't-pose', rigCore, bodyDNA, timestamp: 0 });
  human.updatePose(finalPose);
  const simulationRig = createProceduralSimulationRigFrameV5({ finalPose, rigCore, bodyDNA });
  const sourceBindFrame = createProceduralSimulationRigFrameV5({ finalPose: sourceBindPose, rigCore, bodyDNA });
  const productionFrame = {
    type: 'SimulationRigFrame',
    schema: 'humanoid_rig/simulation_rig_frame@4.0',
    frameId: record.sharedFinalPoseId,
    finalPose,
  };

  const proceduralView = createView(document.querySelector('#procedural-viewport'), 0xc8aa92);
  const directView = createView(document.querySelector('#direct-viewport'), 0xc8cdd1);
  const candidateView = createView(document.querySelector('#candidate-viewport'), 0xb8d8ca);
  const procedural = new ProceduralDeformRuntimeV5();
  procedural.compileHuman({ bodyDNA, rigCore });
  const adapted = V4Adapter.humanRigCoreToExistingRig(rigCore, { bodyDNA, pose: 'T' });
  const template = await createSmplSkinLayer(THREE, candidateView.scene, adapted.definition, {
    legacyDiagnosticRuntimeWeights: false,
  });
  pilotProgress.phase = 'generating-procedural-r48';
  await procedural.generateCanonicalSurface({ resolution: 48, worker: false, projectionMode: 'legacy' });
  pilotProgress.phase = 'awaiting-template';
  if (template.detailPromise) await template.detailPromise;
  if (!template.mesh || !template.weightsReady) throw new Error('Compatibility template geometry failed to load.');

  const proceduralFrame = procedural.update({ finalPose, anatomyState: human.getAnatomyState(), timestamp: 1 });
  pilotProgress.phase = 'building-three-surfaces';
  const proceduralGeometry = geometryFromPositions(
    proceduralFrame.deformedPositions,
    proceduralFrame.indices,
    proceduralFrame.deformedNormals,
  );
  proceduralView.scene.add(new THREE.Mesh(proceduralGeometry, proceduralView.material));

  template.refresh(adapted.definition, null, { force: true, simulationRigFrame: productionFrame });
  const directPositions = template.sampleDeformedPositions();
  const templateIndices = new Uint32Array(template.mesh.geometry.index.array);
  const directGeometry = geometryFromPositions(directPositions, templateIndices);
  directView.scene.add(new THREE.Mesh(directGeometry, directView.material));

  const adapter = new TemplateBindSpaceRetargetAdapterV5({ THREE, templateLayer: template, rigCore, sourceBindFrame });
  adapter.apply(finalPose);
  pilotProgress.phase = 'rendering-webgl2';
  const oldMaterial = template.mesh.material;
  template.material = candidateView.material;
  template.mesh.material = candidateView.material;
  if (oldMaterial !== candidateView.material) oldMaterial?.dispose?.();

  if (showRig) {
    proceduralView.scene.add(createRigOverlay(simulationRig));
    directView.scene.add(createRigOverlay(simulationRig));
    candidateView.scene.add(createRigOverlay(simulationRig));
  }
  renderView(proceduralView);
  renderView(directView);
  renderView(candidateView);
  await nextFrames(3);
  renderView(proceduralView);
  renderView(directView);
  renderView(candidateView);

  document.querySelector('#scenario-title').textContent = `${spec.label}${showRig ? ' · Rig Overlay' : ''}`;
  document.querySelector('#procedural-caption').textContent = `${spec.label} · SHARED POSE TRUTH`;
  document.querySelector('#direct-caption').textContent = `${spec.label} · DIRECT BASELINE`;
  document.querySelector('#candidate-caption').textContent = `${spec.label} · SAME CORRECTION SET`;
  if (!record.passed) {
    const badge = document.querySelector('#candidate-card .template-badge');
    badge.classList.add('failed');
    badge.innerHTML = 'EXPERIMENTAL · FAILED<br>NUMERIC GATE NOT MET<br>NOT FOR ACCEPTANCE';
  }
  populateMetrics(record);
  document.querySelector('#loading').classList.add('hidden');
  document.body.dataset.pilotReady = 'true';

  const state = () => {
    const glbRequests = performance.getEntriesByType('resource')
      .filter((entry) => /smpl-male-surface-skinned\.glb(?:$|[?#])/i.test(entry.name));
    return {
      ready: true,
      scenario: scenarioId,
      sharedFinalPoseId: record.sharedFinalPoseId,
      sourcePoseMetrics: record.sourcePoseMetrics,
      directTemplateMetrics: publicTemplateMetrics(record.directTemplateMetrics),
      candidateTemplateMetrics: publicTemplateMetrics(record.candidateTemplateMetrics),
      bindAuditSummary: {
        jointCount: bindAudit.joints.length,
        sourcePoseConvention: bindAudit.sourcePoseConvention.value,
        identityGate: bindAudit.identityGate,
        correctionSetFingerprint: bindAudit.adapter.correctionSetFingerprint,
      },
      consoleErrors: [...runtimeErrors],
      pageErrors: [...pageErrors],
      glbRequests: glbRequests.map((entry) => entry.name),
      geometryPresent: {
        procedural: proceduralGeometry.getAttribute('position').count > 0,
        direct: directGeometry.getAttribute('position').count > 0,
        candidate: template.mesh.geometry.getAttribute('position').count > 0,
      },
    };
  };
  window.__TASK14C_TEMPLATE_BIND_PILOT__ = Object.freeze({ getState: state, waitForIdle: async () => state() });
  publishState(state());
}

function populateMetrics(record) {
  const semantic = record.poseSemanticMetrics;
  document.querySelector('#authority-summary').innerHTML = `<div class="authority-box">`
    + `<b>Authority:</b> identical Human Core finalPose.localRotations<br>`
    + `<b>Convention:</b> bind-relative local delta<br>`
    + `<b>Adapter:</b> targetBind × (C × Δsource × C⁻¹)<br>`
    + `<b>Identity Gate:</b> ${metrics.identityGate.passed}<br>`
    + `<b>Pose-specific offsets:</b> false</div>`;
  const rows = [
    ['Shoulder elevation', semantic.sourceShoulderElevationDeg, semantic.directShoulderElevationDeg, semantic.candidateShoulderElevationDeg],
    ['Elbow flexion', semantic.sourceElbowFlexionDeg, semantic.directElbowFlexionDeg, semantic.candidateElbowFlexionDeg],
    ['Hip flexion', semantic.sourceHipFlexionDeg, semantic.directHipFlexionDeg, semantic.candidateHipFlexionDeg],
    ['Knee flexion', semantic.sourceKneeFlexionDeg, semantic.directKneeFlexionDeg, semantic.candidateKneeFlexionDeg],
    ['Max joint error m', 0, record.directTemplateMetrics.maximumMappedJointWorldError, record.candidateTemplateMetrics.maximumMappedJointWorldError],
    ['Mean joint error m', 0, record.directTemplateMetrics.meanMappedJointWorldError, record.candidateTemplateMetrics.meanMappedJointWorldError],
    ['Root error m', 0, record.directTemplateMetrics.rootPositionError, record.candidateTemplateMetrics.rootPositionError],
    ['Penetrating pairs', metrics.bindPosePenetratingPairCount, record.directTemplateMetrics.totalPenetratingPairCount, record.candidateTemplateMetrics.totalPenetratingPairCount],
    ['Pose-introduced pairs', 0, record.directTemplateMetrics.poseIntroducedPairCount, record.candidateTemplateMetrics.poseIntroducedPairCount],
  ];
  document.querySelector('#metrics-table').innerHTML = `<div class="metric-group"><h3>Measured from FK / actual bone world transforms</h3><div class="metric-grid">`
    + `<div class="label">Metric</div><div>Source</div><div>Direct</div><div>Candidate</div>`
    + rows.map(([label, source, direct, candidate]) => `<div class="label">${escapeHTML(label)}</div><div>${metric(source)}</div><div>${metric(direct)}</div><div>${metric(candidate)}</div>`).join('')
    + `</div></div>`;
  document.querySelector('#audit-checklist').innerHTML = `<div class="checklist"><b>Gate</b><br>`
    + `angle error: ${metric(record.angleGate.maximumErrorDegrees)}° / 8° · ${record.angleGate.passed ? 'PASS' : 'FAIL'}<br>`
    + `mapped joints: ${record.mappedJointGate ? 'PASS' : 'FAIL'} · root: ${record.rootGate ? 'PASS' : 'FAIL'} · symmetry: ${record.symmetryGate ? 'PASS' : 'FAIL'}<br>`
    + `classification: ${escapeHTML(record.failureClassification)}</div>`;
}

async function buildContactSheet() {
  document.querySelector('#comparison-page').classList.add('hidden');
  const sheet = document.querySelector('#contact-sheet');
  sheet.classList.remove('hidden');
  const rows = metrics.scenarios.flatMap((record) => {
    const semantic = record.poseSemanticMetrics;
    const observation = record.passed
      ? 'Candidate passes all numeric gates with the shared correction set.'
      : `Candidate gate failed: ${record.failureClassification}. Evidence remains experimental and not for acceptance.`;
    return [
      `<div class="contact-cell"><img src="../../artifacts/qa/task14c-template-bind-alignment-pilot/procedural/${record.scenarioId}.png" alt="${record.scenarioId} procedural"></div>`,
      `<div class="contact-cell"><img src="../../artifacts/qa/task14c-template-bind-alignment-pilot/template-direct/${record.scenarioId}.png" alt="${record.scenarioId} direct"></div>`,
      `<div class="contact-cell"><img src="../../artifacts/qa/task14c-template-bind-alignment-pilot/template-candidate/${record.scenarioId}.png" alt="${record.scenarioId} candidate"></div>`,
      `<div class="contact-cell contact-summary"><b>${record.scenarioId}</b><br>`
        + `shoulder S/D/C: <code>${metric(semantic.sourceShoulderElevationDeg)}/${metric(semantic.directShoulderElevationDeg)}/${metric(semantic.candidateShoulderElevationDeg)}</code><br>`
        + `angle error: <code>${metric(record.angleGate.maximumErrorDegrees)}°</code><br>`
        + `joint max/mean: <code>${metric(record.candidateTemplateMetrics.maximumMappedJointWorldError)}/${metric(record.candidateTemplateMetrics.meanMappedJointWorldError)} m</code><br>`
        + `penetration bind/direct/candidate: <code>${metrics.bindPosePenetratingPairCount}/${record.directTemplateMetrics.totalPenetratingPairCount}/${record.candidateTemplateMetrics.totalPenetratingPairCount}</code></div>`,
      `<div class="contact-cell contact-observation"><b>Visual observation</b><br>${escapeHTML(observation)}<br><br>EXPERIMENTAL · ${record.passed ? 'PILOT PASS' : 'FAILED'} · NOT FOR ACCEPTANCE</div>`,
    ];
  });
  sheet.innerHTML = `<h1 class="contact-heading">Task 14C Template Bind Space Alignment Pilot C</h1>`
    + `<p class="contact-subtitle">Procedural pose truth vs direct template vs deterministic bind-basis candidate · visualAcceptance=false · productionReady=false</p>`
    + `<div class="contact-grid"><div class="contact-title">Procedural Pose Truth</div><div class="contact-title">Template Direct</div><div class="contact-title">Template Candidate</div><div class="contact-title">Angle / joint / penetration</div><div class="contact-title">Visual observation</div>${rows.join('')}</div>`;
  await Promise.all([...sheet.querySelectorAll('img')].map((image) => image.decode()));
  document.body.dataset.pilotReady = 'true';
  const state = () => ({
    ready: true,
    scenario: 'contact-sheet',
    sharedFinalPoseId: null,
    sourcePoseMetrics: null,
    directTemplateMetrics: null,
    candidateTemplateMetrics: null,
    bindAuditSummary: { identityGate: bindAudit.identityGate, jointCount: bindAudit.joints.length },
    consoleErrors: [...runtimeErrors],
    pageErrors: [...pageErrors],
    glbRequests: [],
    geometryPresent: { procedural: true, direct: true, candidate: true },
  });
  window.__TASK14C_TEMPLATE_BIND_PILOT__ = Object.freeze({ getState: state, waitForIdle: async () => state() });
  publishState(state());
}

function createView(host, color) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true });
  if (!context) throw new Error('Task 14C Template Bind Pilot requires WebGL2.');
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
  if (!['procedural', 'direct', 'candidate'].includes(focus)) return;
  const targetId = `${focus}-card`;
  document.querySelector('#comparison-page').style.width = '636px';
  document.querySelector('.comparison-grid').style.gridTemplateColumns = '600px';
  for (const card of document.querySelectorAll('.surface-card')) {
    if (card.id !== targetId) card.classList.add('hidden');
  }
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
  const segmentPositions = [];
  for (const segment of simulationRig.segments) {
    const parent = simulationRig.joints[segment.parentId]?.worldPosition;
    const child = simulationRig.joints[segment.jointId]?.worldPosition;
    if (parent && child) segmentPositions.push(...parent, ...child);
  }
  const lines = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(segmentPositions, 3)),
    new THREE.LineBasicMaterial({ color: 0x36d6ff, depthTest: false, transparent: true, opacity: 0.95 }),
  );
  lines.renderOrder = 30;
  group.add(lines);
  const jointPositions = Object.values(simulationRig.joints).flatMap((joint) => joint.worldPosition);
  const points = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(jointPositions, 3)),
    new THREE.PointsMaterial({ color: 0xffca57, size: 0.025, sizeAttenuation: true, depthTest: false }),
  );
  points.renderOrder = 31;
  group.add(points);
  return group;
}

function renderView(view) { view.renderer.render(view.scene, view.camera); }
function publicTemplateMetrics(value) {
  return {
    poseMetrics: value.poseMetrics,
    segmentDirections: value.segmentDirections,
    mappedJointWorldErrors: value.mappedJointWorldErrors,
    maximumMappedJointWorldError: value.maximumMappedJointWorldError,
    meanMappedJointWorldError: value.meanMappedJointWorldError,
    wristEndpointError: value.wristEndpointError,
    ankleEndpointError: value.ankleEndpointError,
    rootPositionError: value.rootPositionError,
    leftRightSymmetryError: value.leftRightSymmetryError,
    surfaceAnchorMaximumError: value.surfaceAnchorMaximumError,
    surfaceAnchorMeanError: value.surfaceAnchorMeanError,
    persistentBindPairCount: value.persistentBindPairCount,
    poseIntroducedPairCount: value.poseIntroducedPairCount,
    poseResolvedPairCount: value.poseResolvedPairCount,
    totalPenetratingPairCount: value.totalPenetratingPairCount,
    criticalPoseIntroducedPairCount: value.criticalPoseIntroducedPairCount,
  };
}
function publishState(state) { document.querySelector('#pilot-state').textContent = JSON.stringify(state); }
function nextFrames(count) { return new Promise((resolve) => { const step = () => count-- <= 0 ? resolve() : requestAnimationFrame(step); requestAnimationFrame(step); }); }
async function readJson(response) { if (!response.ok) throw new Error(`Pilot evidence unavailable: HTTP ${response.status}.`); return response.json(); }
function metric(value) { return Number.isFinite(value) ? Number(value).toFixed(3) : 'n/a'; }
function formatError(error) { return error instanceof Error ? `${error.name}: ${error.message}` : String(error); }
function escapeHTML(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
