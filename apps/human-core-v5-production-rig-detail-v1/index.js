import * as THREE from 'three';

import { createHumanRigCoreV5 } from '../../src/modules/human-core-v5/human-rig-core-v5.js';
import {
  axisBasisMetrics,
  compareRigInvariantSnapshotsV1,
  createCoreRigContractV1,
  createCoreRigLayerV1,
  createInteractionRigLayerV1,
  createPerformanceDeformRigLayerV1,
  createRigDiagnosticGeometryV1,
  createRigInvariantSnapshotV1,
  validateCoreRigContractV1,
} from '../../src/modules/human-core-v5/production-rig-v1/index.js';
import { renderInspector } from './inspector.js';
import {
  TASK17A3_SCENARIO_IDS,
  createTask17A3BodyDNA,
  createTask17A3Scenario,
} from './scenario.js';

const search = new URLSearchParams(location.search);
const consoleErrors = [];
const pageErrors = [];
const originalConsoleError = console.error.bind(console);
console.error = (...values) => {
  consoleErrors.push(values.map(formatError).join(' '));
  originalConsoleError(...values);
};
addEventListener('error', (event) => pageErrors.push(formatError(event.error ?? event.message)));
addEventListener('unhandledrejection', (event) => pageErrors.push(formatError(event.reason)));

const state = {
  pose: validChoice(search.get('pose'), TASK17A3_SCENARIO_IDS, 'reference-t'),
  mode: validChoice(search.get('mode'), ['lite', 'rig', 'interaction', 'deform'], 'rig'),
  closeup: search.get('closeup') || null,
  axes: search.get('axes') === '1',
  limits: search.get('limits') === '1',
  selectedElement: null,
  renderedFrames: 0,
};

const bodyDNA = createTask17A3BodyDNA();
const rigCore = createHumanRigCoreV5({ bodyDNA, rigId: 'human-rig-core-task17a3-production-rig' });
const contract = createCoreRigContractV1({ rigCore, bodyDNA });
const contractValidation = validateCoreRigContractV1(contract, { rigCore, bodyDNA });
const view = createThreeView(document.querySelector('#viewport'));
let build = null;
let currentPublicState = null;
let selectableById = new Map();

initializeControls();
rebuildScenario();
view.renderer.setAnimationLoop(() => {
  view.renderer.render(view.scene, view.camera);
  state.renderedFrames += 1;
  publishState();
  if (state.renderedFrames >= 3) document.querySelector('#loading').classList.add('hidden');
});
addEventListener('resize', () => resizeView(view));

function rebuildScenario() {
  build?.geometry.dispose();
  state.renderedFrames = 0;
  const scenario = createTask17A3Scenario({ poseId: state.pose, rigCore, bodyDNA });
  const before = createRigInvariantSnapshotV1({ rigCore, contract, finalPose: scenario.finalPose });
  const coreLayer = createCoreRigLayerV1({ rigCore, finalPose: scenario.finalPose, bodyDNA, contract });
  const performanceLayer = createPerformanceDeformRigLayerV1({ coreLayer });
  const interactionLayer = createInteractionRigLayerV1({ coreLayer, performanceLayer });
  const geometry = createRigDiagnosticGeometryV1({
    scene: view.scene,
    coreLayer,
    performanceLayer,
    interactionLayer,
    mode: state.mode,
    showAxes: state.axes,
    showLimits: state.limits,
  });
  const after = createRigInvariantSnapshotV1({ rigCore, contract, finalPose: scenario.finalPose });
  const invariants = compareRigInvariantSnapshotsV1(before, after);
  build = { scenario, coreLayer, performanceLayer, interactionLayer, geometry, before, after, invariants };
  selectableById = uniqueSelectableElements(geometry.pickables);
  state.selectedElement = selectableById.get(state.selectedElement?.id)?.userData.rigElement
    ?? selectableById.get('hips')?.userData.rigElement
    ?? null;
  geometry.setMode(state.mode);
  geometry.setAxes(state.axes);
  geometry.setLimits(state.limits);
  updateUI();
  applyCameraPreset(state.closeup, state.selectedElement);
  publishState();
}

function initializeControls() {
  const poseSelect = document.querySelector('#pose-select');
  poseSelect.innerHTML = TASK17A3_SCENARIO_IDS.map((poseId) => `<option value="${poseId}">${poseId}</option>`).join('');
  poseSelect.value = state.pose;
  poseSelect.addEventListener('change', () => {
    state.pose = poseSelect.value;
    state.closeup = null;
    updateQuery();
    rebuildScenario();
  });
  document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
  document.querySelector('#axes-toggle').checked = state.axes;
  document.querySelector('#limits-toggle').checked = state.limits;
  document.querySelector('#axes-toggle').addEventListener('change', (event) => {
    state.axes = event.currentTarget.checked;
    build.geometry.setAxes(state.axes);
    updateQuery(); publishState(); updateUI();
  });
  document.querySelector('#limits-toggle').addEventListener('change', (event) => {
    state.limits = event.currentTarget.checked;
    build.geometry.setLimits(state.limits);
    updateQuery(); publishState(); updateUI();
  });
  document.querySelectorAll('[data-collapse]').forEach((button) => button.addEventListener('click', () => {
    document.body.classList.add(`${button.dataset.collapse}-collapsed`);
    resizeView(view);
  }));
  document.querySelector('#restore-left').addEventListener('click', () => { document.body.classList.remove('left-collapsed'); resizeView(view); });
  document.querySelector('#restore-right').addEventListener('click', () => { document.body.classList.remove('right-collapsed'); resizeView(view); });
  document.querySelector('#viewport').addEventListener('pointerdown', pickElement);
  addEventListener('keydown', (event) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    if (/^[1-4]$/.test(event.key)) setMode(['lite', 'rig', 'interaction', 'deform'][Number(event.key) - 1]);
    if (event.key.toLowerCase() === 'a') document.querySelector('#axes-toggle').click();
    if (event.key.toLowerCase() === 'l') document.querySelector('#limits-toggle').click();
    if (event.key.toLowerCase() === 'f') applyCameraPreset(null, state.selectedElement);
  });
}

function setMode(mode) {
  state.mode = mode;
  build.geometry.setMode(mode);
  build.geometry.setAxes(state.axes);
  build.geometry.setLimits(state.limits);
  updateQuery(); updateUI(); publishState();
}

function updateUI() {
  document.querySelector('#pose-label').textContent = state.pose;
  document.querySelector('#mode-label').textContent = state.mode;
  document.querySelector('#contract-label').textContent = contractValidation.valid ? 'Core Rig Contract · PASS' : 'Core Rig Contract · FAIL CLOSED';
  document.querySelectorAll('[data-mode]').forEach((button) => button.classList.toggle('active', button.dataset.mode === state.mode));
  renderRigTree();
  renderInspector(document.querySelector('#inspector'), state.selectedElement);
  const axisMetrics = measureAxes();
  const gateRows = [
    ['Core contract', contractValidation.valid],
    ['Core invariants', build.invariants.passed],
    ['finalPose read-only', build.invariants.finalPoseReadOnlyPassed],
    ['Axis orthogonality', axisMetrics.maximumAxisOrthogonalityError <= 1e-6],
    ['Axis determinant', Math.abs(axisMetrics.minimumBasisDeterminant - 1) <= 1e-6],
    ['Segment length', build.geometry.segmentMetrics.maximumSegmentLengthError <= 1e-8],
    ['Performance nodes', build.performanceLayer.metrics.passed],
    ['Interaction anchors', build.interactionLayer.metrics.passed],
    ['Visual acceptance', 'pending'],
  ];
  document.querySelector('#quality-gates').innerHTML = gateRows.map(([label, result]) => {
    const status = result === true ? 'pass' : result === 'pending' ? 'partial' : 'fail';
    return `<div class="gate"><span>${label}</span><b class="${status}">${result === true ? 'PASS' : result === 'pending' ? 'PENDING USER' : 'FAIL'}</b></div>`;
  }).join('');
}

function renderRigTree() {
  const groups = new Map();
  for (const object of selectableById.values()) {
    const element = object.userData.rigElement;
    if (!groups.has(element.layer)) groups.set(element.layer, []);
    groups.get(element.layer).push(element);
  }
  document.querySelector('#rig-tree').innerHTML = [...groups].map(([layer, elements]) => (
    `<details open><summary>${escapeHTML(layer)} · ${elements.length}</summary>${elements
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((element) => `<button type="button" data-element-id="${escapeHTML(element.id)}" class="${state.selectedElement?.id === element.id ? 'selected' : ''}">${escapeHTML(element.id)}</button>`).join('')}</details>`
  )).join('');
  document.querySelectorAll('[data-element-id]').forEach((button) => button.addEventListener('click', () => selectElement(button.dataset.elementId)));
}

function pickElement(event) {
  const bounds = view.renderer.domElement.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.params.Line.threshold = 0.025;
  raycaster.setFromCamera(pointer, view.camera);
  const hit = raycaster.intersectObjects(build.geometry.pickables, true)
    .find((entry) => findElementObject(entry.object));
  if (hit) selectElement(findElementObject(hit.object).userData.rigElement.id);
}

function selectElement(elementId) {
  const object = selectableById.get(elementId);
  if (!object) return;
  state.selectedElement = object.userData.rigElement;
  updateUI(); publishState();
}

function findElementObject(object) {
  let current = object;
  while (current && !current.userData.rigElement) current = current.parent;
  return current;
}

function uniqueSelectableElements(objects) {
  const result = new Map();
  for (const object of objects) {
    const elementObject = findElementObject(object);
    const id = elementObject?.userData?.rigElement?.id;
    if (id && !result.has(id)) result.set(id, elementObject);
  }
  return result;
}

function applyCameraPreset(closeup, selectedElement) {
  const targetId = closeupJoint(closeup) ?? selectedElement?.id?.split(':')[0] ?? 'hips';
  const target = build.coreLayer.jointTransforms[targetId]?.worldPosition ?? selectedElement?.worldPosition ?? [0, 1, 0];
  const distance = closeup ? 0.72 : selectedElement && selectedElement.id !== 'hips' ? 0.82 : 3.0;
  view.camera.position.set(target[0] + distance * 0.9, target[1] + distance * 0.42, target[2] + distance);
  view.camera.lookAt(...target);
}

function closeupJoint(closeup) {
  return ({
    shoulder: 'rightShoulder', elbow: 'rightLowerArm', hand: 'rightHand', pelvis: 'hips',
    hip: 'rightUpperLeg', knee: 'rightLowerLeg', foot: 'rightFoot', head: 'head',
  })[closeup] ?? null;
}

function createThreeView(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x050b11, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x050b11, 5, 13);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 30);
  scene.add(new THREE.HemisphereLight(0xc8ecff, 0x1a2530, 2.1));
  const light = new THREE.DirectionalLight(0xffffff, 1.8); light.position.set(3, 5, 4); scene.add(light);
  const ground = new THREE.GridHelper(8, 32, 0x28495e, 0x142938); ground.position.y = 0; scene.add(ground);
  resizeView({ renderer, camera, container });
  const context = renderer.getContext();
  return { renderer, scene, camera, container, webgl2: Boolean(context && String(context.getParameter(context.VERSION)).includes('WebGL 2')) };
}

function resizeView(target) {
  const width = Math.max(1, target.container.clientWidth);
  const height = Math.max(1, target.container.clientHeight);
  target.renderer.setSize(width, height, false);
  target.camera.aspect = width / height;
  target.camera.updateProjectionMatrix();
}

function measureAxes() {
  const metrics = rigCore.joints.map((joint) => axisBasisMetrics(joint.axisReference));
  return {
    maximumAxisOrthogonalityError: Math.max(0, ...metrics.map((item) => item.orthogonalityError)),
    minimumBasisDeterminant: Math.min(...metrics.map((item) => item.determinant)),
    maximumBasisDeterminant: Math.max(...metrics.map((item) => item.determinant)),
    nonFiniteAxisCount: metrics.reduce((sum, item) => sum + item.nonFiniteAxisCount, 0),
  };
}

function publishState() {
  if (!build) return;
  const axisMetrics = measureAxes();
  currentPublicState = {
    ready: state.renderedFrames >= 3,
    pose: state.pose,
    mode: state.mode,
    selectedElement: state.selectedElement,
    coreRigFingerprint: contract.topologyFingerprint,
    coreRigContractPassed: contractValidation.valid,
    finalPoseFingerprintBefore: build.before.fingerprints.finalPose,
    finalPoseFingerprintAfter: build.after.fingerprints.finalPose,
    finalPoseReadOnlyPassed: build.invariants.finalPoseReadOnlyPassed,
    coreRigMetrics: {
      jointCount: rigCore.topology.jointCount,
      coreJointCount: rigCore.coreJointIds.length,
      ...build.invariants,
      ...build.geometry.segmentMetrics,
    },
    performanceRigMetrics: build.performanceLayer.metrics,
    interactionRigMetrics: build.interactionLayer.metrics,
    jointAxisMetrics: axisMetrics,
    jointLimitMetrics: build.geometry.limits.metrics,
    handFrameMetrics: build.interactionLayer.metrics.palmFrames,
    footFrameMetrics: build.interactionLayer.metrics.footFrames,
    geometryPresent: build.geometry.root.children.length > 0 && view.renderer.domElement.width > 0,
    webgl2: view.webgl2,
    consoleErrors: [...consoleErrors],
    pageErrors: [...pageErrors],
    authority: {
      core: 'HumanRigCore', pose: 'finalPose', performance: 'derived', interaction: 'derived-targets', diagnostic: 'observer-only',
    },
    acceptanceState: { visualAcceptance: false, productionReady: false, userVisualAcceptance: 'pending' },
    finalConclusion: 'INCONCLUSIVE',
    conclusionReason: 'File implementation is present; AGENTS.md reserves browser screenshots and visual observation for the user.',
  };
  window.__HUMAN_CORE_V5_PRODUCTION_RIG_DETAIL_V1__ = {
    ...currentPublicState,
    getState: () => structuredClone(currentPublicState),
  };
}

function updateQuery() {
  const next = new URLSearchParams(location.search);
  next.set('pose', state.pose); next.set('mode', state.mode);
  if (state.axes) next.set('axes', '1'); else next.delete('axes');
  if (state.limits) next.set('limits', '1'); else next.delete('limits');
  if (state.closeup) next.set('closeup', state.closeup); else next.delete('closeup');
  history.replaceState(null, '', `${location.pathname}?${next}`);
}

function validChoice(value, choices, fallback) { return choices.includes(value) ? value : fallback; }
function formatError(value) { return value instanceof Error ? `${value.name}: ${value.message}` : String(value); }
function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
