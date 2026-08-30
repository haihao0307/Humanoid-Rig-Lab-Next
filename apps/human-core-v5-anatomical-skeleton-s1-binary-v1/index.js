import * as THREE from '../../node_modules/three/build/three.module.js';
import { OrbitControls } from '../../node_modules/three/examples/jsm/controls/OrbitControls.js';
import { HrlBoneBinaryLoaderV1 } from '../../src/core/human-core-v5/hrlBoneBinaryLoaderV1.js';

const ASSET_ROOT = '../../assets/human/anatomical-skeleton-s1/';
const QA_STATUS_URL = '../../artifacts/qa/anatomical-skeleton-s1/TASK_S1A_FINAL_STATUS.json';
const container = document.querySelector('#viewport');
const labelsRoot = document.querySelector('#labels');
const inspector = document.querySelector('#inspector-content');

const publicState = window.__HRL_ANATOMICAL_SKELETON_S1_BINARY_V1__ = {
  ready: false,
  policyId: 'human_system/procedural_originality_policy@1.0.0',
  policyAccepted: true,
  proceduralGenerationOnly: true,
  externalGeometrySourceCount: 0,
  loadedExternalHumanModelCount: 0,
  generatedGlbCount: 0,
  glbLoaderUseCount: 0,
  runtimeBoneScaleCount: 0,
  bodyDnaHash: null,
  skeletalDnaHash: null,
  anatomicalGraphHash: null,
  generatorRegistryHash: null,
  anatomicalProfileHash: null,
  jointBasisHash: null,
  landmarkSetHash: null,
  binaryGeometrySha256: null,
  deterministicReplayPassed: false,
  authorityWriteViolationCount: 0,
  firstFrameRendered: false,
  consoleErrors: [],
  pageErrors: [],
  startupErrors: [],
  failedRequests: [],
  visualAcceptance: false,
  productionReady: false,
  userVisualAcceptance: 'pending',
};

const originalConsoleError = console.error.bind(console);
console.error = (...args) => {
  publicState.consoleErrors.push(args.map(String).join(' '));
  originalConsoleError(...args);
};
window.addEventListener('error', (event) => publicState.pageErrors.push(event.message));
window.addEventListener('unhandledrejection', (event) => publicState.pageErrors.push(String(event.reason)));

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.append(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 20);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 0.35;
controls.maxDistance = 8;

scene.add(new THREE.HemisphereLight(0xd9f3ff, 0x15212b, 1.35));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
keyLight.position.set(2.5, 3.2, 3.8);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x64b9ff, 1.25);
rimLight.position.set(-3, 1.5, -2.5);
scene.add(rimLight);
const floor = new THREE.GridHelper(3.2, 32, 0x294c5c, 0x19313e);
floor.position.y = 0.07;
scene.add(floor);

const displayRoot = new THREE.Group();
const axesRoot = new THREE.Group();
scene.add(displayRoot, axesRoot);

const state = {
  variantId: 'baseline', lod: 0, isolateFemur: false, showAxes: true, showLabels: true, showSymmetry: true,
  tab: 'summary', registry: null, generatorRegistry: null, graph: null, receipts: null, qa: null,
  dna: null, profile: null, mapping: null, manifest: null, binary: null, labelRecords: [],
};

const loader = new HrlBoneBinaryLoaderV1();

start().catch((error) => {
  publicState.startupErrors.push(error.message);
  document.querySelector('#ready-status').textContent = 'startup failed';
  console.error(error);
});

async function start() {
  [state.registry, state.generatorRegistry, state.graph, state.receipts, state.qa] = await Promise.all([
    fetchJson(`${ASSET_ROOT}VARIANT_REGISTRY_S1.json`),
    fetchJson(`${ASSET_ROOT}GENERATOR_REGISTRY_S1.json`),
    fetchJson(`${ASSET_ROOT}ANATOMICAL_GRAPH_S1.json`),
    fetchJson(`${ASSET_ROOT}ANATOMICAL_REFERENCE_RECEIPTS.json`),
    fetchJson(QA_STATUS_URL, { optional: true }),
  ]);
  const variantSelect = document.querySelector('#variant-select');
  for (const variant of state.registry.variants) variantSelect.add(new Option(variant.label, variant.variantId));
  bindUi();
  await loadVariant('baseline');
  resetCamera();
  onResize();
  window.addEventListener('resize', onResize);
  publicState.ready = true;
  const badge = document.querySelector('#ready-status');
  badge.textContent = 'ready';
  badge.classList.add('ready');
  animate();
}

async function loadVariant(variantId) {
  const record = state.registry.variants.find((variant) => variant.variantId === variantId);
  if (!record) throw new Error(`Unknown variant ${variantId}.`);
  state.variantId = variantId;
  [state.dna, state.profile, state.mapping, state.manifest, state.binary] = await Promise.all([
    fetchJson(`${ASSET_ROOT}${record.skeletalDnaPath}`),
    fetchJson(`${ASSET_ROOT}${record.anatomicalProfilePath}`),
    fetchJson(`${ASSET_ROOT}${record.mappingPath}`),
    fetchJson(`${ASSET_ROOT}${record.manifestPath}`),
    loader.load(`${ASSET_ROOT}${record.binaryPath}`).catch((error) => { publicState.failedRequests.push(record.binaryPath); throw error; }),
  ]);
  publicState.bodyDnaHash = await sha256Stable({
    bodyHeight: state.dna.bodyHeight, shoulderWidth: state.dna.shoulderWidth, pelvisWidth: state.dna.pelvisWidth,
    upperArmLength: state.dna.upperArmLength, forearmLength: state.dna.forearmLength, thighLength: state.dna.thighLength, calfLength: state.dna.calfLength,
  });
  publicState.skeletalDnaHash = record.skeletalDnaHash;
  publicState.anatomicalGraphHash = await sha256Stable(state.graph);
  publicState.generatorRegistryHash = state.generatorRegistry.generatorRegistryHash;
  publicState.anatomicalProfileHash = state.profile.anatomyProfileHash;
  publicState.jointBasisHash = state.profile.jointBasisHash;
  publicState.landmarkSetHash = state.profile.landmarkSetHash;
  publicState.binaryGeometrySha256 = record.sha256;
  publicState.deterministicReplayPassed = state.qa?.deterministicReplayPassed === true;
  publicState.authorityWriteViolationCount = state.qa?.authorityWriteViolationCount ?? 0;
  rebuildDisplay();
  renderInspector();
}

function rebuildDisplay() {
  disposeChildren(displayRoot);
  disposeChildren(axesRoot);
  labelsRoot.replaceChildren();
  state.labelRecords = [];
  const positionAttribute = new THREE.BufferAttribute(state.binary.positions, 3);
  const normalAttribute = new THREE.BufferAttribute(state.binary.normals, 3);
  state.binary.primitiveGroups.forEach((binaryGroup, ordinal) => {
    const manifestGroup = state.manifest.primitiveGroups[ordinal];
    const rightHidden = !state.showSymmetry && manifestGroup.side === 'right';
    const femur = manifestGroup.boneId?.endsWith('_femur');
    if (rightHidden || (femur && binaryGroup.lod !== state.lod) || (state.isolateFemur && !femur) || (!state.isolateFemur && femur && binaryGroup.lod !== state.lod)) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', positionAttribute.clone());
    geometry.setIndex(new THREE.BufferAttribute(state.binary.indices.slice(binaryGroup.indexOffset, binaryGroup.indexOffset + binaryGroup.indexCount), 1));
    let object;
    if (binaryGroup.primitive === 'TRIANGLES') {
      geometry.setAttribute('normal', normalAttribute.clone());
      const color = manifestGroup.side === 'left' ? 0x59c9ff : 0xff9b72;
      object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.57, metalness: 0.08, side: THREE.FrontSide }));
    } else if (binaryGroup.primitive === 'LINES') {
      object = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xc9eaf1, transparent: true, opacity: 0.76 }));
    } else {
      object = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xf1cb86, size: 0.012, sizeAttenuation: true }));
    }
    object.name = manifestGroup.groupId;
    object.userData = { ...manifestGroup, runtimeScaleUsed: false };
    displayRoot.add(object);
  });
  buildAxesAndLabels();
}

function buildAxesAndLabels() {
  const axisPositions = [];
  const axisColors = [];
  const colorByAxis = [[1, .2, .3], [.25, 1, .5], [.25, .55, 1]];
  for (const joint of state.graph.joints) {
    if (!state.showSymmetry && joint.jointId.startsWith('right_')) continue;
    const profileJoint = state.profile.joints.find((candidate) => candidate.jointId === joint.jointId);
    const center = profileJoint?.jointCenter ?? joint.jointCenter;
    for (let axis = 0; axis < 3; axis += 1) {
      const direction = profileJoint.jointBasis[['x', 'y', 'z'][axis]];
      axisPositions.push(...center, center[0] + direction[0] * .035, center[1] + direction[1] * .035, center[2] + direction[2] * .035);
      axisColors.push(...colorByAxis[axis], ...colorByAxis[axis]);
    }
    const label = document.createElement('span');
    label.className = 'joint-label';
    label.textContent = joint.jointId;
    labelsRoot.append(label);
    state.labelRecords.push({ element: label, position: new THREE.Vector3(...center), jointId: joint.jointId });
  }
  const graphJointById = new Map(state.graph.joints.map((joint) => [joint.jointId, joint]));
  for (const bone of state.graph.bones) {
    if (bone.boneId === 'pelvis' || (!state.showSymmetry && bone.boneId.startsWith('right_'))) continue;
    const start = graphJointById.get(bone.proximalJointId)?.jointCenter;
    const end = graphJointById.get(bone.distalJointId)?.jointCenter;
    if (!start || !end) continue;
    const label = document.createElement('span');
    label.className = 'joint-label';
    label.textContent = `${bone.boneId} · bone`;
    labelsRoot.append(label);
    state.labelRecords.push({ element: label, position: new THREE.Vector3().fromArray(start).add(new THREE.Vector3().fromArray(end)).multiplyScalar(.5), jointId: bone.boneId });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(axisPositions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(axisColors, 3));
  axesRoot.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .88 })));
  axesRoot.visible = state.showAxes;
  labelsRoot.hidden = !state.showLabels;
}

function renderInspector() {
  document.querySelectorAll('[data-tab]').forEach((button) => button.classList.toggle('active', button.dataset.tab === state.tab));
  if (state.tab === 'summary') {
    const record = state.registry.variants.find((variant) => variant.variantId === state.variantId);
    const lodMeshes = record.meshes.filter((mesh) => mesh.lod === state.lod);
    inspector.innerHTML = `<div class="metric-grid">
      ${metric('Variant', record.label)}${metric('DNA revision', record.revision)}
      ${metric('Binary', formatBytes(record.byteLength))}${metric('SHA256', record.sha256)}
      ${metric('LOD vertices', lodMeshes.reduce((sum, mesh) => sum + mesh.vertexCount, 0))}${metric('LOD triangles', lodMeshes.reduce((sum, mesh) => sum + mesh.triangleCount, 0))}
      ${metric('Joint centers', state.graph.joints.length)}${metric('Graph bones', state.graph.bones.length)}
    </div><pre>${escapeHtml(JSON.stringify({
      policyId: publicState.policyId, proceduralGenerationOnly: true, externalGeometrySourceCount: 0,
      loadedExternalHumanModelCount: 0, generatedGlbCount: 0, runtimeBoneScaleCount: 0,
      deterministicReplayPassed: publicState.deterministicReplayPassed,
      visualAcceptance: false, productionReady: false, userVisualAcceptance: 'pending',
    }, null, 2))}</pre>`;
  } else if (state.tab === 'parameters') {
    const femora = state.dna.boneParameters.filter(({ boneId }) => boneId.endsWith('_femur')).map(({ boneId, generatorType, generatorParameters, parameterRanges, sourceReceiptIds, confidence }) => ({ boneId, generatorType, generatorParameters, parameterRanges, sourceReceiptIds, confidence }));
    inspector.innerHTML = `<pre>${escapeHtml(JSON.stringify(femora, null, 2))}</pre>`;
  } else if (state.tab === 'mapping') {
    inspector.innerHTML = `<table><thead><tr><th>Anatomical ID</th><th>HumanRigCore</th><th>Status</th></tr></thead><tbody>${state.mapping.records.map((record) => `<tr title="${escapeHtml(record.difference ?? '')}"><td>${record.anatomicalJointId}</td><td>${record.humanRigCoreJointId ?? '—'}</td><td>${record.status}</td></tr>`).join('')}</tbody></table>`;
  } else {
    inspector.innerHTML = state.receipts.references.map((source) => `<article class="source"><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.title)}</a><p>${escapeHtml(source.publisher)} · ${escapeHtml(source.license)} · confidence ${source.confidence}</p><p>${escapeHtml(String(source.derivation))}</p></article>`).join('');
  }
}

function bindUi() {
  document.querySelector('#variant-select').addEventListener('change', (event) => loadVariant(event.target.value).catch(reportStartup));
  document.querySelector('#lod-select').addEventListener('change', (event) => { state.lod = Number(event.target.value); rebuildDisplay(); renderInspector(); });
  document.querySelector('#isolate-femur').addEventListener('change', (event) => { state.isolateFemur = event.target.checked; rebuildDisplay(); fitVisible(); });
  document.querySelector('#show-axes').addEventListener('change', (event) => { state.showAxes = event.target.checked; axesRoot.visible = state.showAxes; });
  document.querySelector('#show-labels').addEventListener('change', (event) => { state.showLabels = event.target.checked; labelsRoot.hidden = !state.showLabels; });
  document.querySelector('#show-symmetry').addEventListener('change', (event) => { state.showSymmetry = event.target.checked; rebuildDisplay(); });
  document.querySelector('#fit-view').addEventListener('click', fitVisible);
  document.querySelector('#reset-view').addEventListener('click', resetCamera);
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
  document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => { state.tab = button.dataset.tab; renderInspector(); }));
}

function setView(view) {
  const target = state.isolateFemur ? new THREE.Vector3(0, .75, 0) : new THREE.Vector3(0, .9, 0);
  const directions = { front: [0, 0, 1], side: [1, 0, 0], back: [0, 0, -1], 'three-quarter': [1, .25, 1] };
  const direction = new THREE.Vector3(...directions[view]).normalize();
  camera.position.copy(target).addScaledVector(direction, state.isolateFemur ? 1.45 : 2.8);
  controls.target.copy(target);
  controls.update();
}

function fitVisible() {
  const box = new THREE.Box3().setFromObject(displayRoot);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const distance = Math.max(size.x, size.y, size.z) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.35;
  const direction = camera.position.clone().sub(controls.target).normalize();
  camera.position.copy(center).addScaledVector(direction, Math.max(.35, distance));
  controls.target.copy(center);
  controls.update();
}

function resetCamera() { camera.position.set(2.45, 1.45, 2.75); controls.target.set(0, .91, 0); controls.update(); }

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  updateLabels();
  renderer.render(scene, camera);
  publicState.firstFrameRendered = true;
}

function updateLabels() {
  if (!state.showLabels) return;
  const width = renderer.domElement.clientWidth;
  const height = renderer.domElement.clientHeight;
  for (const record of state.labelRecords) {
    const projected = record.position.clone().project(camera);
    const visible = projected.z > -1 && projected.z < 1 && (!state.isolateFemur || /femur|hip|knee/.test(record.jointId));
    record.element.hidden = !visible;
    if (visible) {
      record.element.style.left = `${(projected.x * .5 + .5) * width}px`;
      record.element.style.top = `${(-projected.y * .5 + .5) * height}px`;
    }
  }
}

function onResize() {
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

async function fetchJson(url, { optional = false } = {}) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } catch (error) {
    if (optional) return null;
    publicState.failedRequests.push(url);
    throw new Error(`Failed to load ${url}: ${error.message}`);
  }
}

function disposeChildren(parent) {
  for (const child of [...parent.children]) {
    parent.remove(child);
    child.geometry?.dispose();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose()); else child.material?.dispose();
  }
}

async function sha256Stable(value) {
  const bytes = new TextEncoder().encode(stableStringify(value));
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...hash].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function stableStringify(value) { if (value === null || typeof value !== 'object') return JSON.stringify(value); if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`; return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`; }
function metric(label, value) { return `<div class="metric"><span>${escapeHtml(String(label))}</span><strong title="${escapeHtml(String(value))}">${escapeHtml(String(value))}</strong></div>`; }
function formatBytes(value) { return `${(value / 1024).toFixed(1)} KiB`; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
function reportStartup(error) { publicState.startupErrors.push(error.message); console.error(error); }
