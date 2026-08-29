import * as THREE from 'three';
import { GLTFLoader } from '../../node_modules/three/examples/jsm/loaders/GLTFLoader.js';

import { createTask17A3BodyDNA, createTask17A3Scenario } from '../human-core-v5-production-rig-detail-v1/scenario.js';
import { createHumanRigCoreV5 } from '../../src/modules/human-core-v5/human-rig-core-v5.js';
import { createProceduralSimulationRigFrameV5 } from '../../src/modules/human-core-v5/procedural-deform/procedural-simulation-rig-fk-v5.js';
import {
  createHybridSkeletonFinalPoseRuntimeV1,
  createHybridSkeletonModuleMapV1,
  createHybridSkeletonPoseMetricsV1,
  interpolateFinalPoseV1,
} from '../../src/modules/human-core-v5/production-skeleton-runtime-v2/index.js';

const ASSET_PATH = 'assets/human/production-skeleton-v2/hybrid-static-v1/hybrid-production-skeleton-static-v1.glb';
const ASSET_URL = `./${ASSET_PATH}`;
const EXPECTED_ASSET_SHA256 = 'ffef1a04df026f576c9b5af5867b1dbd585145578cde465998a0ef56e32fbdcd';
const EXPECTED_GEOMETRY_HASH = 'e3aba47d7a53812713e9ae37b21f2b68f48c6f0c0bb6eacba4f924c7c78f49c2';
const EXPECTED_INDEX_HASH = 'd4d03eed8c5215828d26c310320794bc9cd7469b4aad727c3ca0d2fb461f2239';
const POSE_IDS = Object.freeze(['reference-t', 'reference-a', 'locomotion-neutral', 'walk-left-support', 'walk-right-support', 'turn-mid']);
const SEQUENCE_IDS = Object.freeze([...POSE_IDS, 'locomotion-neutral']);
const POSE_LABELS = Object.freeze({
  'reference-t': 'Reference T', 'reference-a': 'Reference A', 'locomotion-neutral': 'Locomotion Neutral',
  'walk-left-support': 'Walk Left Support', 'walk-right-support': 'Walk Right Support', 'turn-mid': 'Turn Mid',
});
const pageState = window.__HRL_PRODUCTION_SKELETON_P2__;
const consoleErrors = pageState.consoleErrors;
const pageErrors = pageState.pageErrors;
const originalConsoleError = console.error.bind(console);
console.error = (...values) => {
  consoleErrors.push(values.map(formatError).join(' '));
  originalConsoleError(...values);
};
addEventListener('unhandledrejection', (event) => pageErrors.push(formatError(event.reason)));

const search = new URLSearchParams(location.search);
const state = {
  poseId: POSE_IDS.includes(search.get('pose')) ? search.get('pose') : 'reference-t',
  overlay: search.get('overlay') === '1',
  closeup: search.get('closeup') || null,
  sequenceRequested: search.get('sequence') === '1',
  sequencePlaying: false,
  sequenceComplete: false,
  sequenceGeneration: 0,
  renderedFrames: 0,
  currentFrame: null,
  metrics: null,
  maximumFrameToFrameModuleJump: 0,
};
const elements = {
  viewport: document.querySelector('#viewport'), loading: document.querySelector('#loading'),
  ready: document.querySelector('#ready-state'), poseSelect: document.querySelector('#pose-select'),
  sequenceButton: document.querySelector('#sequence-button'), overlayToggle: document.querySelector('#overlay-toggle'),
  copyButton: document.querySelector('#copy-button'), copyStatus: document.querySelector('#copy-status'),
  metrics: document.querySelector('#metrics'), errorPanel: document.querySelector('#error-panel'),
  coreOverlay: document.querySelector('#core-overlay'),
};

let view;
let bodyDNA;
let rigCore;
let fixtures;
let restSimulationFrame;
let moduleMap;
let objectByModuleId;
let identity;
let runtime;
let overlayElements;

initialize().catch(fail);

async function initialize() {
  initializeControls();
  view = createWebGL2View(elements.viewport);
  bodyDNA = createTask17A3BodyDNA();
  rigCore = createHumanRigCoreV5({ bodyDNA, rigId: 'human-rig-core-task17a3-p2-finalpose-page' });
  fixtures = Object.fromEntries(POSE_IDS.map((poseId) => [poseId, createTask17A3Scenario({ poseId, rigCore, bodyDNA }).finalPose]));
  restSimulationFrame = createProceduralSimulationRigFrameV5({ finalPose: fixtures['reference-t'], rigCore, bodyDNA });
  moduleMap = createHybridSkeletonModuleMapV1({ restSimulationFrame });
  const asset = await withDeadline(loadFrozenAsset(), 9000, `GLB 加载超时：${ASSET_PATH}`);
  identity = asset.identity;
  view.scene.add(asset.scene);
  objectByModuleId = new Map(moduleMap.map(({ moduleId }) => [moduleId, asset.scene.getObjectByName(moduleId)]));
  const missing = [...objectByModuleId].filter(([, object]) => !object).map(([moduleId]) => moduleId);
  if (missing.length) throw new Error(`GLB 缺少模块：${missing.join(', ')}。路径：${ASSET_PATH}`);
  for (const object of objectByModuleId.values()) {
    object.matrixAutoUpdate = false;
    object.matrix.identity();
    object.matrixWorldNeedsUpdate = true;
  }
  runtime = createHybridSkeletonFinalPoseRuntimeV1({
    rigCore, bodyDNA, moduleMap,
    applyTransform(moduleId, matrix) {
      const object = objectByModuleId.get(moduleId);
      if (!object) throw new Error(`无法写入缺失模块 ${moduleId}。`);
      object.matrix.fromArray(matrix);
      object.matrixWorldNeedsUpdate = true;
    },
  });
  overlayElements = createCoreOverlay(restSimulationFrame);
  applyPose(state.poseId);
  clearTimeout(window.__HRL_P2_BOOT_TIMEOUT__);
  pageState.status = 'ready';
  pageState.ready = true;
  pageState.webgl2 = true;
  elements.ready.textContent = 'READY · WEBGL2 · FINALPOSE READ-ONLY';
  elements.ready.className = 'ready';
  elements.loading.classList.add('hidden');
  resize();
  view.renderer.setAnimationLoop(render);
  publish();
  if (state.sequenceRequested) playSequence();
}

function initializeControls() {
  elements.poseSelect.innerHTML = POSE_IDS.map((poseId) => `<option value="${poseId}">${POSE_LABELS[poseId]}</option>`).join('');
  elements.poseSelect.value = state.poseId;
  elements.overlayToggle.checked = state.overlay;
  elements.poseSelect.addEventListener('change', () => {
    stopSequence();
    state.poseId = elements.poseSelect.value;
    state.closeup = null;
    applyPose(state.poseId);
    updateQuery();
  });
  elements.overlayToggle.addEventListener('change', () => {
    state.overlay = elements.overlayToggle.checked;
    updateOverlay(); updateQuery(); publish();
  });
  elements.sequenceButton.addEventListener('click', () => state.sequencePlaying ? stopSequence() : playSequence());
  elements.copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(pageState, null, 2));
      elements.copyStatus.textContent = '已复制';
    } catch (error) {
      elements.copyStatus.textContent = '复制失败';
      pageErrors.push(formatError(error));
    }
  });
  addEventListener('resize', resize);
}

function createWebGL2View(container) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
  if (!context) throw new Error('WebGL2 初始化失败；此页面不回退到 WebGL1。');
  container.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06111a);
  scene.add(new THREE.HemisphereLight(0xd7efff, 0x16202a, 2.35));
  const key = new THREE.DirectionalLight(0xffffff, 3.0); key.position.set(-2.4, 3.2, -3.1); scene.add(key);
  const rim = new THREE.DirectionalLight(0x62c8ff, 2.1); rim.position.set(2.8, 2.2, 2.6); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(31, 1, 0.01, 20);
  return { renderer, scene, camera };
}

async function loadFrozenAsset() {
  let response;
  try { response = await fetch(ASSET_URL, { cache: 'no-store' }); }
  catch (error) { throw new Error(`GLB 请求失败：${ASSET_PATH}。${formatError(error)}`); }
  if (!response.ok) throw new Error(`GLB 请求失败：${ASSET_PATH}（HTTP ${response.status}）。`);
  const buffer = await response.arrayBuffer();
  const sha256 = await digestHex([new Uint8Array(buffer)]);
  if (sha256 !== EXPECTED_ASSET_SHA256) throw new Error(`GLB SHA256 不匹配：${ASSET_PATH}；实际 ${sha256}。`);
  const measured = await inspectGlbIdentity(buffer);
  if (measured.vertexCount !== 1863 || measured.triangleCount !== 3418 || measured.moduleIds.length !== 24
    || new Set(measured.moduleIds).size !== 24 || measured.nonIdentityNodeTransformCount !== 0) {
    throw new Error(`GLB 统计或模块 rest transform 不匹配：${ASSET_PATH}。`);
  }
  if (measured.geometryHash !== EXPECTED_GEOMETRY_HASH || measured.indexHash !== EXPECTED_INDEX_HASH) {
    throw new Error(`GLB geometry/index hash 不匹配：${ASSET_PATH}。`);
  }
  const loader = new GLTFLoader();
  const sceneAsset = await new Promise((resolveAsset, rejectAsset) => {
    loader.parse(buffer, './assets/human/production-skeleton-v2/hybrid-static-v1/', resolveAsset, rejectAsset);
  });
  return { scene: sceneAsset.scene, identity: { ...measured, assetSha256: sha256, assetPath: ASSET_PATH } };
}

function applyPose(poseId, finalPose = fixtures[poseId]) {
  if (!runtime) return;
  const frame = runtime.update(finalPose);
  const metrics = createHybridSkeletonPoseMetricsV1({
    poseId, moduleMap, runtimeFrame: frame, restSimulationFrame,
    geometryHash: identity.geometryHash, indexHash: identity.indexHash,
    loadedModuleIds: [...objectByModuleId.keys()], maximumFrameToFrameModuleJump: 0,
  });
  state.poseId = poseId;
  state.currentFrame = frame;
  state.metrics = metrics;
  elements.poseSelect.value = poseId;
  applyCameraPreset();
  updateMetrics(); updateOverlay(); publish();
}

async function playSequence() {
  if (!runtime || state.sequencePlaying) return;
  const generation = ++state.sequenceGeneration;
  state.sequencePlaying = true;
  state.sequenceComplete = false;
  state.maximumFrameToFrameModuleJump = 0;
  let previousSequenceTransforms = null;
  elements.sequenceButton.textContent = '停止诊断序列';
  elements.poseSelect.disabled = true;
  publish();
  applyPose(SEQUENCE_IDS[0]);
  for (let index = 0; index < SEQUENCE_IDS.length - 1; index += 1) {
    if (generation !== state.sequenceGeneration) return;
    await wait(350);
    const fromPoseId = SEQUENCE_IDS[index];
    const toPoseId = SEQUENCE_IDS[index + 1];
    const startedAt = performance.now();
    while (generation === state.sequenceGeneration) {
      const alpha = Math.min(1, (performance.now() - startedAt) / 1050);
      const finalPose = interpolateFinalPoseV1(fixtures[fromPoseId], fixtures[toPoseId], smoothstep(alpha), performance.now());
      const frame = runtime.update(finalPose);
      if (previousSequenceTransforms) {
        const previousById = new Map(previousSequenceTransforms.map((transform) => [transform.moduleId, transform]));
        for (const transform of frame.transforms) {
          const previous = previousById.get(transform.moduleId);
          state.maximumFrameToFrameModuleJump = Math.max(state.maximumFrameToFrameModuleJump, Math.hypot(
            transform.currentWorldMatrix[12] - previous.currentWorldMatrix[12],
            transform.currentWorldMatrix[13] - previous.currentWorldMatrix[13],
            transform.currentWorldMatrix[14] - previous.currentWorldMatrix[14],
          ));
        }
      }
      previousSequenceTransforms = frame.transforms;
      state.currentFrame = frame;
      updateOverlay();
      if (alpha >= 1) break;
      await nextFrame();
    }
    if (generation !== state.sequenceGeneration) return;
    applyPose(toPoseId);
  }
  await wait(500);
  if (generation !== state.sequenceGeneration) return;
  state.sequencePlaying = false;
  state.sequenceComplete = true;
  state.metrics = { ...state.metrics, maximumFrameToFrameModuleJump: state.maximumFrameToFrameModuleJump };
  elements.sequenceButton.textContent = '播放诊断序列';
  elements.poseSelect.disabled = false;
  updateMetrics();
  publish();
}

function stopSequence() {
  state.sequenceGeneration += 1;
  state.sequencePlaying = false;
  elements.sequenceButton.textContent = '播放诊断序列';
  elements.poseSelect.disabled = false;
  publish();
}

function createCoreOverlay(frame) {
  const coreIds = new Set(rigCore.coreJointIds);
  const segments = frame.segments.filter(({ parentId, jointId }) => coreIds.has(parentId) && coreIds.has(jointId));
  const lines = segments.map(({ parentId, jointId }) => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    element.dataset.parentId = parentId; element.dataset.jointId = jointId;
    elements.coreOverlay.append(element);
    return element;
  });
  const points = [...coreIds].map((jointId) => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    element.setAttribute('r', '3.2'); element.dataset.jointId = jointId;
    elements.coreOverlay.append(element);
    return element;
  });
  return { lines, points };
}

function updateOverlay() {
  if (!overlayElements || !state.currentFrame) return;
  elements.coreOverlay.hidden = !state.overlay;
  if (!state.overlay) return;
  const rect = elements.viewport.getBoundingClientRect();
  elements.coreOverlay.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
  const joints = state.currentFrame.simulationRigFrame.joints;
  for (const line of overlayElements.lines) {
    const a = project(joints[line.dataset.parentId].worldPosition, rect);
    const b = project(joints[line.dataset.jointId].worldPosition, rect);
    line.setAttribute('x1', a[0]); line.setAttribute('y1', a[1]); line.setAttribute('x2', b[0]); line.setAttribute('y2', b[1]);
  }
  for (const point of overlayElements.points) {
    const projected = project(joints[point.dataset.jointId].worldPosition, rect);
    point.setAttribute('cx', projected[0]); point.setAttribute('cy', projected[1]);
  }
}

function project(position, rect) {
  const point = new THREE.Vector3(...position).project(view.camera);
  return [(point.x * .5 + .5) * rect.width, (-point.y * .5 + .5) * rect.height];
}

function applyCameraPreset() {
  if (!view) return;
  let target = [0, 0.92, 0];
  let position = [0, 0.98, -3.25];
  const joints = state.currentFrame?.simulationRigFrame?.joints;
  if (state.closeup === 'shoulder' && joints) { target = midpoint(joints.leftShoulder.worldPosition, joints.rightShoulder.worldPosition); position = [target[0], target[1], target[2] - 1.0]; }
  if (state.closeup === 'pelvis' && joints) { target = [...joints.hips.worldPosition]; position = [target[0], target[1] + .02, target[2] - .9]; }
  if (state.closeup === 'hand' && joints) { target = [...joints.leftHand.worldPosition]; position = [target[0], target[1], target[2] - .62]; }
  if (state.closeup === 'foot' && joints) { target = [...joints.leftFoot.worldPosition]; position = [target[0] - .72, target[1] + .08, target[2]]; }
  view.camera.position.set(...position);
  view.camera.lookAt(...target);
  view.camera.updateMatrixWorld(true);
}

function updateMetrics() {
  const metrics = state.metrics;
  if (!metrics) return;
  const rows = [
    ['姿势', POSE_LABELS[state.poseId]], ['模块', `${metrics.moduleCount}/24`],
    ['缺失模块', metrics.missingModuleCount], ['非有限 transform', metrics.nonFiniteTransformCount],
    ['反射', metrics.reflectionCount], ['finalPose read-only', metrics.finalPoseReadOnlyPassed],
    ['Joint center max', formatMetric(metrics.maximumJointCenterError, 'm')],
    ['Segment axis max', formatMetric(metrics.maximumSegmentAxisError, '°')],
    ['Segment length max', formatMetric(metrics.maximumSegmentLengthError, 'm')],
    ['Attachment max', formatMetric(metrics.maximumModuleAttachmentError, 'm')],
    ['L/R residual delta', formatMetric(metrics.leftRightSymmetryError, 'm')],
    ['Frame jump max', formatMetric(metrics.maximumFrameToFrameModuleJump, 'm')],
    ['Geometry hash', metrics.geometryHash.slice(0, 12)], ['Index hash', metrics.indexHash.slice(0, 12)],
    ['数值门', metrics.passed],
  ];
  elements.metrics.innerHTML = rows.map(([label, value]) => `<dt>${label}</dt><dd class="${value === true ? 'pass' : value === false ? 'fail' : ''}">${value}</dd>`).join('');
}

function render() {
  view.renderer.render(view.scene, view.camera);
  state.renderedFrames += 1;
  if (state.overlay) updateOverlay();
  if (state.renderedFrames < 4 || state.sequencePlaying) publish();
}

function resize() {
  if (!view) return;
  const rect = elements.viewport.getBoundingClientRect();
  view.renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
  view.camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
  view.camera.updateProjectionMatrix();
  updateOverlay();
}

function publish() {
  Object.assign(pageState, {
    status: pageState.status,
    ready: pageState.ready,
    webgl2: Boolean(view),
    poseId: state.poseId,
    overlay: state.overlay,
    closeup: state.closeup,
    sequencePlaying: state.sequencePlaying,
    sequenceComplete: state.sequenceComplete,
    renderedFrames: state.renderedFrames,
    asset: identity ?? null,
    moduleMap: moduleMap?.map(({ moduleId, moduleClass, sourceJointIds, transformMode, authority, writesHumanRigCore, writesFinalPose }) => ({ moduleId, moduleClass, sourceJointIds, transformMode, authority, writesHumanRigCore, writesFinalPose })) ?? [],
    metrics: state.metrics,
    finalPoseReadOnlyPassed: state.currentFrame?.finalPoseReadOnlyPassed ?? null,
    consoleErrors,
    pageErrors,
  });
}

function fail(error) {
  clearTimeout(window.__HRL_P2_BOOT_TIMEOUT__);
  const message = formatError(error);
  pageErrors.push(message);
  pageState.status = 'error'; pageState.ready = false; pageState.webgl2 = Boolean(view);
  elements.ready.textContent = 'ERROR'; elements.ready.className = 'error';
  elements.loading.textContent = message;
  elements.errorPanel.hidden = false;
  elements.errorPanel.textContent = `${message}\n\nGLB: ${ASSET_PATH}`;
  publish();
}

async function inspectGlbIdentity(buffer) {
  const viewData = new DataView(buffer);
  if (viewData.getUint32(0, true) !== 0x46546c67 || viewData.getUint32(4, true) !== 2) throw new Error(`无效 GLB：${ASSET_PATH}`);
  const jsonLength = viewData.getUint32(12, true);
  const jsonText = new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)).trim();
  const gltf = JSON.parse(jsonText);
  const binaryOffset = 20 + jsonLength + 8;
  const geometryChunks = [];
  const indexChunks = [];
  let vertexCount = 0;
  let indexCount = 0;
  gltf.meshes.forEach((mesh, meshIndex) => mesh.primitives.forEach((primitive, primitiveIndex) => {
    for (const semantic of ['POSITION', 'NORMAL']) {
      const accessorIndex = primitive.attributes[semantic];
      const bytes = accessorBytes(buffer, gltf, binaryOffset, accessorIndex);
      geometryChunks.push(new TextEncoder().encode(`${meshIndex}:${primitiveIndex}:${semantic}:${accessorIndex}:${bytes.length}:`), bytes);
      if (semantic === 'POSITION') vertexCount += gltf.accessors[accessorIndex].count;
    }
    const accessorIndex = primitive.indices;
    const bytes = accessorBytes(buffer, gltf, binaryOffset, accessorIndex);
    indexChunks.push(new TextEncoder().encode(`${meshIndex}:${primitiveIndex}:INDEX:${accessorIndex}:${bytes.length}:`), bytes);
    indexCount += gltf.accessors[accessorIndex].count;
  }));
  return {
    byteSize: buffer.byteLength,
    vertexCount,
    triangleCount: indexCount / 3,
    meshCount: gltf.meshes.length,
    materialCount: gltf.materials.length,
    moduleIds: gltf.nodes.map((node) => node.extras?.moduleId ?? node.name),
    nonIdentityNodeTransformCount: gltf.nodes.filter((node) => node.matrix
      || node.translation || node.rotation || node.scale).length,
    geometryHash: await digestHex(geometryChunks),
    indexHash: await digestHex(indexChunks),
  };
}

function accessorBytes(buffer, gltf, binaryOffset, accessorIndex) {
  const accessor = gltf.accessors[accessorIndex];
  const bufferView = gltf.bufferViews[accessor.bufferView];
  const componentBytes = ({ 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 })[accessor.componentType];
  const components = ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 })[accessor.type];
  const offset = binaryOffset + Number(bufferView.byteOffset ?? 0) + Number(accessor.byteOffset ?? 0);
  return new Uint8Array(buffer, offset, accessor.count * componentBytes * components);
}

async function digestHex(chunks) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const payload = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { payload.set(chunk, offset); offset += chunk.byteLength; }
  const digest = await crypto.subtle.digest('SHA-256', payload);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function updateQuery() {
  const next = new URLSearchParams();
  next.set('pose', state.poseId);
  if (state.overlay) next.set('overlay', '1');
  history.replaceState(null, '', `${location.pathname}?${next}`);
}

function withDeadline(promise, milliseconds, message) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(message)), milliseconds))]);
}
function nextFrame() { return new Promise((resolvePromise) => requestAnimationFrame(resolvePromise)); }
function wait(milliseconds) { return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds)); }
function smoothstep(value) { return value * value * (3 - 2 * value); }
function midpoint(a, b) { return a.map((value, index) => (value + b[index]) * .5); }
function formatMetric(value, unit) { return `${Number(value).toExponential(3)} ${unit}`; }
function formatError(value) { return value instanceof Error ? value.stack || value.message : String(value); }
