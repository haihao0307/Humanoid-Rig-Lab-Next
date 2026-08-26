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
import { createBodyShapeProfile } from '../../packages/body-shape/index.js';
import { createSmplSkinLayer } from '../../legacy/v8/src/smpl-skin.js';

const METRICS_URL = '../../artifacts/qa/task14c-template-topology-visual-pilot/metrics.json';
const SCENARIOS = Object.freeze({
  'reference-t': Object.freeze({ preset: 'Reference', poseId: 't-pose', label: 'Reference · T Pose' }),
  'reference-a': Object.freeze({ preset: 'Reference', poseId: 'a-pose', label: 'Reference · A Pose' }),
  'shoulder-150': Object.freeze({ preset: 'Reference', poseId: 'arm-raise-150-left', label: 'Reference · Arm Raise 150' }),
  'elbow-140': Object.freeze({ preset: 'Reference', poseId: 'elbow-bend-140-left', label: 'Reference · Elbow Bend 140' }),
  'hip-flex': Object.freeze({ preset: 'Reference', poseId: 'hip-flex-left', label: 'Reference · Hip Flex' }),
  'knee-bend': Object.freeze({ preset: 'Reference', poseId: 'knee-bend-left', label: 'Reference · Knee Bend' }),
  'muscular-t': Object.freeze({ preset: 'Muscular', poseId: 't-pose', label: 'Muscular · T Pose' }),
  'muscular-a': Object.freeze({ preset: 'Muscular', poseId: 'a-pose', label: 'Muscular · A Pose' }),
});
const CAMERA_VIEWS = Object.freeze({
  front: Object.freeze({ target: [0, 0.91, 0], position: [0, 0.91, 3.2], halfHeight: 1.03 }),
  shoulder: Object.freeze({ target: [-0.34, 1.38, 0], position: [-0.34, 1.38, 3.2], halfHeight: 0.43 }),
  elbow: Object.freeze({ target: [-0.47, 1.25, 0], position: [-0.47, 1.25, 3.2], halfHeight: 0.40 }),
  hip: Object.freeze({ target: [-0.13, 0.80, 0], position: [-0.13, 0.80, 3.2], halfHeight: 0.43 }),
  knee: Object.freeze({ target: [-0.12, 0.44, 0], position: [-0.12, 0.44, 3.2], halfHeight: 0.40 }),
});
const CONTACT_ROWS = Object.freeze([
  Object.freeze({ label: 'Reference T · Front', scenarioId: 'reference-t', file: 'reference-t-front.png' }),
  Object.freeze({ label: 'Reference A · Front', scenarioId: 'reference-a', file: 'reference-a-front.png' }),
  Object.freeze({ label: 'Shoulder 150 · Front', scenarioId: 'shoulder-150', file: 'shoulder-150-front.png' }),
  Object.freeze({ label: 'Shoulder 150 · Closeup', scenarioId: 'shoulder-150', file: 'shoulder-150-closeup.png' }),
  Object.freeze({ label: 'Elbow 140 · Closeup', scenarioId: 'elbow-140', file: 'elbow-140-closeup.png' }),
  Object.freeze({ label: 'Hip Flex · Closeup', scenarioId: 'hip-flex', file: 'hip-flex-closeup.png' }),
  Object.freeze({ label: 'Knee Bend · Closeup', scenarioId: 'knee-bend', file: 'knee-bend-closeup.png' }),
  Object.freeze({ label: 'Muscular T · Front', scenarioId: 'muscular-t', file: 'muscular-t-front.png' }),
  Object.freeze({ label: 'Muscular A · Front', scenarioId: 'muscular-a', file: 'muscular-a-front.png' }),
  Object.freeze({ label: 'Reference T · Rig Overlay', scenarioId: 'reference-t', file: 'reference-t-rig-overlay.png' }),
  Object.freeze({ label: 'Shoulder 150 · Rig Overlay', scenarioId: 'shoulder-150', file: 'shoulder-150-rig-overlay.png' }),
]);
const VISUAL_OBSERVATIONS = Object.freeze({
  'reference-t-front.png': 'Template anatomy, head, hands, feet, and smoothness are markedly better; its arms remain below the shared T-pose carrier.',
  'reference-a-front.png': 'Template silhouette is more human, but its arm angle does not match the shared A-pose semantics as closely as Procedural.',
  'shoulder-150-front.png': 'Procedural follows the requested 150-degree raise; Template stops near horizontal because of bind-space mismatch.',
  'shoulder-150-closeup.png': 'Template shoulder and axilla are smooth, but at the wrong elevation. Procedural follows pose with coarse axilla faceting.',
  'elbow-140-closeup.png': 'Template has a smoother elbow ring and hand, while Procedural is heavily faceted; both show deformation compromises.',
  'hip-flex-closeup.png': 'Template pelvis, groin, thigh root, and flexed-leg volume are substantially more anatomical.',
  'knee-bend-closeup.png': 'Template knee and calf retain a continuous human contour; Procedural remains cylindrical and faceted.',
  'muscular-t-front.png': 'Unsupported: Production Skin V4 requires a rebound skin for Muscular BodyDNA; displayed evidence is marked failed.',
  'muscular-a-front.png': 'Unsupported: shared A pose was correctly blocked by the existing proportion-rebind gate.',
  'reference-t-rig-overlay.png': 'Procedural encloses the shared rig; Template arms sit roughly half a meter below the T-pose arm anchors.',
  'shoulder-150-rig-overlay.png': 'Shared rig confirms the 150-degree target while Template skin remains near horizontal; binding alignment is not carrier-ready.',
});

const search = new URLSearchParams(location.search);
const runtimeErrors = [];
const pageErrors = [];
const originalConsoleError = console.error.bind(console);
console.error = (...values) => {
  runtimeErrors.push(values.map(formatError).join(' '));
  originalConsoleError(...values);
};
addEventListener('error', (event) => pageErrors.push(formatError(event.error ?? event.message)));
addEventListener('unhandledrejection', (event) => pageErrors.push(formatError(event.reason)));

const metrics = await fetch(METRICS_URL).then((response) => {
  if (!response.ok) throw new Error(`Template pilot metrics unavailable: HTTP ${response.status}.`);
  return response.json();
});

if (search.get('contact') === '1') await buildContactSheet();
else await buildComparison();

async function buildComparison() {
  const scenarioId = search.get('scenario') ?? 'reference-t';
  const spec = SCENARIOS[scenarioId];
  if (!spec) throw new Error(`Unknown template pilot scenario ${scenarioId}.`);
  const viewId = search.get('view') ?? 'front';
  const view = CAMERA_VIEWS[viewId];
  if (!view) throw new Error(`Unknown template pilot camera view ${viewId}.`);
  const showRig = search.get('rig') === '1';

  const bodyDNA = createBodyDNA({
    ...structuredClone(PROCEDURAL_BODY_DNA_PRESETS_V5[spec.preset]),
    bodyDNAId: `task14c-template-page-${spec.preset.toLowerCase()}`,
    identity: { humanId: `task14c-template-page-${spec.preset.toLowerCase()}`, label: spec.preset },
    proportionRevision: 14,
  });
  const human = new HumanCoreRuntime();
  human.createHuman(bodyDNA);
  const rigCore = human.getRigCore();
  const finalPose = createProceduralDeformValidationPoseV5({ poseId: spec.poseId, rigCore, bodyDNA, timestamp: 1 });
  human.updatePose(finalPose);
  const simulationRig = createProceduralSimulationRigFrameV5({ finalPose, rigCore, bodyDNA });
  const productionSimulationRig = {
    type: 'SimulationRigFrame',
    schema: 'humanoid_rig/simulation_rig_frame@4.0',
    frameId: `${scenarioId}-shared-final-pose`,
    finalPose,
  };

  const proceduralView = createView(document.querySelector('#procedural-viewport'), 0xc8aa92, view);
  const templateView = createView(document.querySelector('#template-viewport'), 0xc8cdd1, view);

  const proceduralRuntime = new ProceduralDeformRuntimeV5();
  proceduralRuntime.compileHuman({ bodyDNA, rigCore });
  const adapted = V4Adapter.humanRigCoreToExistingRig(rigCore, { bodyDNA, pose: 'T' });
  const templateLoad = createSmplSkinLayer(THREE, templateView.scene, adapted.definition, {
    legacyDiagnosticRuntimeWeights: false,
  });
  await proceduralRuntime.generateCanonicalSurface({ resolution: 48, worker: false, projectionMode: 'legacy' });
  const templateLayer = await templateLoad;
  if (templateLayer.detailPromise) await templateLayer.detailPromise;
  if (!templateLayer.mesh || !templateLayer.weightsReady) throw new Error('Compatibility template geometry failed to load.');

  const bodyShape = createBodyShapeProfile({
    body_shape_id: `task14c-template-${spec.preset.toLowerCase()}`,
    name: `${spec.preset} direct BodyDNA fitness compatibility shape`,
    version: 1,
    muscle: bodyDNA.fitnessProfile.muscle,
    fat: bodyDNA.fitnessProfile.fat,
  });
  templateLayer.setBodyShape(bodyShape);
  templateLayer.refresh(adapted.definition, null, { force: true, simulationRigFrame: productionSimulationRig });
  const oldTemplateMaterial = templateLayer.mesh.material;
  templateLayer.material = templateView.material;
  templateLayer.mesh.material = templateView.material;
  if (oldTemplateMaterial !== templateView.material) oldTemplateMaterial?.dispose?.();

  const proceduralFrame = proceduralRuntime.update({
    finalPose,
    anatomyState: human.getAnatomyState(),
    timestamp: 1,
  });
  const proceduralGeometry = new THREE.BufferGeometry();
  proceduralGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(proceduralFrame.deformedPositions), 3));
  proceduralGeometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(proceduralFrame.deformedNormals), 3));
  proceduralGeometry.setIndex(new THREE.BufferAttribute(new Uint32Array(proceduralFrame.indices), 1));
  proceduralGeometry.computeBoundingSphere();
  const proceduralMesh = new THREE.Mesh(proceduralGeometry, proceduralView.material);
  proceduralMesh.name = 'Task14CProceduralR48ComparisonSurface';
  proceduralView.scene.add(proceduralMesh);

  if (showRig) {
    proceduralView.scene.add(createRigOverlay(simulationRig));
    templateView.scene.add(createRigOverlay(simulationRig));
  }
  renderView(proceduralView);
  renderView(templateView);
  await nextFrames(3);
  renderView(proceduralView);
  renderView(templateView);

  const proceduralRecord = findRecord(scenarioId, 'procedural-r48');
  const templateRecord = findRecord(scenarioId, 'stable-template');
  const templateDiagnostics = templateLayer.getDiagnostics();
  const templatePoseApplied = templateDiagnostics.productionSkinDiagnostics?.poseAuthority === 'finalPose.localRotations';
  const sharedFinalPose = productionSimulationRig.finalPose === finalPose && templatePoseApplied;
  if (!templatePoseApplied) {
    const badge = document.querySelector('.template-badge');
    badge.classList.add('failed');
    badge.innerHTML = 'EXPERIMENTAL · FAILED<br>UNSUPPORTED WITHOUT SKIN REBIND<br>NOT FOR ACCEPTANCE<br>NOT HUMAN CORE AUTHORITY';
  }
  document.querySelector('#scenario-title').textContent = `${spec.label} · ${viewId}${showRig ? ' · Rig Overlay' : ''}`;
  document.querySelector('#procedural-caption').textContent = `${spec.label} · ${viewId.toUpperCase()}${showRig ? ' · SHARED RIG' : ''}`;
  document.querySelector('#template-caption').textContent = `${spec.label} · ${viewId.toUpperCase()}${showRig ? ' · SHARED RIG' : ''}`;
  populateMetrics(proceduralRecord, templateRecord, {
    sharedFinalPose,
    templatePoseAuthority: templateDiagnostics.productionSkinDiagnostics?.poseAuthority,
    bodyShapeMethod: templateDiagnostics.bodyShape?.method,
  });
  document.querySelector('#loading').classList.add('hidden');
  document.body.dataset.pilotReady = 'true';

  const state = () => {
    const glbRequests = performance.getEntriesByType('resource').filter((entry) => /smpl-male-surface-skinned\.glb(?:$|[?#])/i.test(entry.name));
    return {
      ready: document.body.dataset.pilotReady === 'true',
      scenarioId,
      viewId,
      rigOverlay: showRig,
      renderer: 'WebGL2',
      sharedFinalPose,
      poseAuthority: templateDiagnostics.productionSkinDiagnostics?.poseAuthority,
      templateMuscularSupported: metrics.templateMuscularSupported,
      consoleErrors: [...runtimeErrors],
      pageErrors: [...pageErrors],
      glbRequests: glbRequests.map((entry) => entry.name),
      geometryPresent: {
        procedural: proceduralGeometry.getAttribute('position').count > 0 && proceduralGeometry.index.count > 0,
        template: templateLayer.mesh.geometry.getAttribute('position').count > 0 && templateLayer.mesh.geometry.index.count > 0,
      },
    };
  };
  window.__HRL_TEMPLATE_TOPOLOGY_PILOT__ = Object.freeze({ getState: state, waitForIdle: async () => state() });
  publishState(state());
}

function createView(host, color, view) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true });
  if (!context) throw new Error('Task 14C Template Topology Visual Pilot requires WebGL2.');
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: false });
  renderer.setPixelRatio(1);
  renderer.setSize(718, 718, false);
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
  const camera = new THREE.OrthographicCamera(-view.halfHeight, view.halfHeight, view.halfHeight, -view.halfHeight, 0.01, 20);
  camera.position.fromArray(view.position);
  camera.lookAt(new THREE.Vector3().fromArray(view.target));
  camera.updateProjectionMatrix();
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.64, metalness: 0.01, side: THREE.FrontSide });
  return { canvas, renderer, scene, camera, material };
}

function renderView(view) {
  view.renderer.render(view.scene, view.camera);
}

function createRigOverlay(simulationRig) {
  const group = new THREE.Group();
  group.name = 'Task14CSharedSimulationRigOverlay';
  const segmentPositions = [];
  for (const segment of simulationRig.segments) {
    const parent = simulationRig.joints[segment.parentId]?.worldPosition;
    const child = simulationRig.joints[segment.jointId]?.worldPosition;
    if (parent && child) segmentPositions.push(...parent, ...child);
  }
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(segmentPositions, 3));
  const lines = new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ color: 0x36d6ff, depthTest: false, transparent: true, opacity: 0.95 }));
  lines.renderOrder = 30;
  group.add(lines);
  const jointPositions = Object.values(simulationRig.joints).flatMap((joint) => joint.worldPosition);
  const pointGeometry = new THREE.BufferGeometry();
  pointGeometry.setAttribute('position', new THREE.Float32BufferAttribute(jointPositions, 3));
  const points = new THREE.Points(pointGeometry, new THREE.PointsMaterial({ color: 0xffca57, size: 0.025, sizeAttenuation: true, depthTest: false }));
  points.renderOrder = 31;
  group.add(points);
  return group;
}

function populateMetrics(procedural, template, audit) {
  document.querySelector('#authority-summary').innerHTML = `<div class="authority-box">`
    + `<b>Shared authority:</b> Human Core BodyDNA + HumanRigCore + identical finalPose.localRotations<br>`
    + `<b>Same finalPose object:</b> ${audit.sharedFinalPose}<br>`
    + `<b>Template consumer:</b> ${escapeHTML(audit.templatePoseAuthority ?? 'missing')}<br>`
    + `<b>BodyShape:</b> ${escapeHTML(audit.bodyShapeMethod ?? 'missing')}<br>`
    + `<b>Authority boundary:</b> Template never writes HumanCoreState or RigCore</div>`;
  const rows = [
    ['Vertices', procedural.vertexCount, template.vertexCount],
    ['Triangles', procedural.triangleCount, template.triangleCount],
    ['Components', procedural.connectedComponentCount, template.connectedComponentCount],
    ['Boundary edges', procedural.boundaryEdgeCount, template.boundaryEdgeCount],
    ['Non-manifold', procedural.nonManifoldEdgeCount, template.nonManifoldEdgeCount],
    ['Penetrations', procedural.penetratingIntersectionCount, template.penetratingIntersectionCount],
    ['Critical penetrations', procedural.criticalPenetratingCount, template.criticalPenetratingCount],
    ['Max rig anchor', metric(procedural.maximumRigSurfaceAnchorError, 4), metric(template.maximumRigSurfaceAnchorError, 4)],
    ['Mean rig anchor', metric(procedural.meanRigSurfaceAnchorError, 4), metric(template.meanRigSurfaceAnchorError, 4)],
    ['Height', metric(procedural.height, 4), metric(template.height, 4)],
    ['Shoulder width', metric(procedural.shoulderWidth, 4), metric(template.shoulderWidth, 4)],
    ['Hip width', metric(procedural.hipWidth, 4), metric(template.hipWidth, 4)],
    ['Pose update ms', metric(procedural.poseUpdateTimeMs, 2), metric(template.poseUpdateTimeMs, 2)],
  ];
  document.querySelector('#metrics-table').innerHTML = `<div class="metric-group"><h3>Scenario metrics</h3><div class="metric-grid">`
    + `<div class="label">Metric</div><div>Procedural</div><div>Template</div>`
    + rows.map(([label, left, right]) => `<div class="label">${escapeHTML(label)}</div><div>${escapeHTML(left)}</div><div>${escapeHTML(right)}</div>`).join('')
    + `</div></div>`;
  document.querySelector('#audit-checklist').innerHTML = `<div class="checklist"><b>Visual audit</b><br>`
    + `proportion · head/neck · shoulder · axilla · arm/chest · elbow loops · waist · pelvis · groin · thigh root · knee front/back · hands/feet · faceting · volume retention</div>`;
}

async function buildContactSheet() {
  document.querySelector('#comparison-page').classList.add('hidden');
  const sheet = document.querySelector('#contact-sheet');
  sheet.classList.remove('hidden');
  const cells = CONTACT_ROWS.flatMap((row) => {
    const procedural = findRecord(row.scenarioId, 'procedural-r48');
    const template = findRecord(row.scenarioId, 'stable-template');
    return [
      `<div class="contact-cell"><img src="../../artifacts/qa/task14c-template-topology-visual-pilot/procedural/${row.file}" alt="${escapeHTML(row.label)} Procedural"></div>`,
      `<div class="contact-cell"><img src="../../artifacts/qa/task14c-template-topology-visual-pilot/template/${row.file}" alt="${escapeHTML(row.label)} Template"></div>`,
      `<div class="contact-cell contact-summary"><b>${escapeHTML(row.label)}</b><br>`
        + `P/T tris: <code>${procedural.triangleCount}/${template.triangleCount}</code><br>`
        + `P/T penetration: <code>${procedural.penetratingIntersectionCount}/${template.penetratingIntersectionCount}</code><br>`
        + `P/T critical: <code>${procedural.criticalPenetratingCount}/${template.criticalPenetratingCount}</code><br>`
        + `P/T max anchor: <code>${metric(procedural.maximumRigSurfaceAnchorError, 3)}/${metric(template.maximumRigSurfaceAnchorError, 3)}</code></div>`,
      `<div class="contact-cell contact-observation"><b>Visual observation</b><br>${escapeHTML(VISUAL_OBSERVATIONS[row.file])}</div>`,
    ];
  });
  sheet.innerHTML = `<h1 class="contact-heading">Task 14C Template Topology Visual Pilot B</h1>`
    + `<p class="contact-subtitle">Procedural R48 vs compatibility template · experimental · not production approved · visualAcceptance=false · productionReady=false</p>`
    + `<div class="contact-grid"><div class="contact-title">Procedural R48</div><div class="contact-title">Stable Template</div><div class="contact-title">Metrics summary</div><div class="contact-title">Visual observation</div>${cells.join('')}</div>`;
  await Promise.all([...sheet.querySelectorAll('img')].map((image) => image.decode()));
  document.body.dataset.pilotReady = 'true';
  const state = () => ({
    ready: true,
    contactSheet: true,
    imageCount: sheet.querySelectorAll('img').length,
    consoleErrors: [...runtimeErrors],
    pageErrors: [...pageErrors],
    glbRequests: [],
    geometryPresent: true,
  });
  window.__HRL_TEMPLATE_TOPOLOGY_PILOT__ = Object.freeze({ getState: state, waitForIdle: async () => state() });
  publishState(state());
}

function findRecord(scenarioId, surfaceType) {
  const record = metrics.records.find((entry) => entry.scenarioId === scenarioId && entry.surfaceType === surfaceType);
  if (!record) throw new Error(`Missing metrics for ${scenarioId}/${surfaceType}.`);
  return record;
}

function publishState(state) {
  document.querySelector('#pilot-state').textContent = JSON.stringify(state);
  document.body.dataset.consoleErrorCount = String(state.consoleErrors.length);
  document.body.dataset.pageErrorCount = String(state.pageErrors.length);
}

function nextFrames(count) {
  return new Promise((resolve) => {
    const step = () => count-- <= 0 ? resolve() : requestAnimationFrame(step);
    requestAnimationFrame(step);
  });
}
function metric(value, digits) { return Number.isFinite(value) ? Number(value).toFixed(digits) : 'n/a'; }
function formatError(error) { return error instanceof Error ? `${error.name}: ${error.message}` : String(error); }
function escapeHTML(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
