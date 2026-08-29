import * as THREE from 'three';
import { GLTFLoader } from '../../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from '../../node_modules/three/examples/jsm/controls/OrbitControls.js';

import { createTask17A3BodyDNA, createTask17A3Scenario } from '../human-core-v5-production-rig-detail-v1/scenario.js';
import { createHumanRigCoreV5 } from '../../src/modules/human-core-v5/human-rig-core-v5.js';
import { createProceduralSimulationRigFrameV5 } from '../../src/modules/human-core-v5/procedural-deform/procedural-simulation-rig-fk-v5.js';
import {
  createHybridSkeletonFinalPoseRuntimeV1,
  createHybridSkeletonModuleMapV1,
  createHybridSkeletonPoseMetricsV1,
  interpolateFinalPoseV1,
} from '../../src/modules/human-core-v5/production-skeleton-runtime-v2/index.js';
import {
  P2_FIXED_POSE_IDS,
  P2_SEQUENCE_POSE_ID,
  buildP2ReviewUrl,
  createP2PoseSynchronizationSnapshot,
  isP2SequenceRequest,
  normalizeP2ReviewPoseId,
} from './p2-review-state-v1.js';
import { projectWorldPositionToViewportV1 } from './overlay-projection-v1.js';

const ASSET_PATH = 'assets/human/production-skeleton-v2/hybrid-static-v1/hybrid-production-skeleton-static-v1.glb';
const ASSET_URL = `./${ASSET_PATH}`;
const EXPECTED_ASSET_SHA256 = 'ffef1a04df026f576c9b5af5867b1dbd585145578cde465998a0ef56e32fbdcd';
const EXPECTED_GEOMETRY_HASH = 'e3aba47d7a53812713e9ae37b21f2b68f48c6f0c0bb6eacba4f924c7c78f49c2';
const EXPECTED_INDEX_HASH = 'd4d03eed8c5215828d26c310320794bc9cd7469b4aad727c3ca0d2fb461f2239';
const POSE_IDS = P2_FIXED_POSE_IDS;
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
const requestedSequence = isP2SequenceRequest(search);
const requestedPoseId = POSE_IDS.includes(search.get('pose')) ? search.get('pose') : 'reference-t';
const state = {
  poseId: requestedSequence ? P2_SEQUENCE_POSE_ID : requestedPoseId,
  actualPoseId: requestedSequence ? 'reference-t' : requestedPoseId,
  overlay: search.get('overlay') === '1',
  closeup: search.get('closeup') || null,
  sequenceRequested: requestedSequence,
  sequencePlaying: false,
  sequenceComplete: false,
  sequenceStatus: null,
  sequenceGeneration: 0,
  renderedFrames: 0,
  currentFrame: null,
  metrics: null,
  maximumFrameToFrameModuleJump: 0,
  summaryPoseId: requestedSequence ? P2_SEQUENCE_POSE_ID : requestedPoseId,
  reviewCameraInitialized: false,
  overlayProjectionReady: false,
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
  applyPose(state.actualPoseId, fixtures[state.actualPoseId], { synchronize: !state.sequenceRequested, updateUrl: true });
  resize({ preserveReview: false });
  resetDefaultReviewCamera();
  if (state.closeup) applyCloseupCameraPreset(state.closeup);
  if (!activateOverlayProjection()) throw new Error('Overlay projection could not enter its ready state.');
  clearTimeout(window.__HRL_P2_BOOT_TIMEOUT__);
  pageState.status = 'ready';
  pageState.ready = true;
  pageState.webgl2 = true;
  elements.ready.textContent = 'READY · WEBGL2 · FINALPOSE READ-ONLY';
  elements.ready.className = 'ready';
  elements.loading.classList.add('hidden');
  view.renderer.setAnimationLoop(render);
  publish();
  if (state.sequenceRequested) playSequence();
}

function initializeControls() {
  elements.poseSelect.innerHTML = [
    ...POSE_IDS.map((poseId) => `<option value="${poseId}">${POSE_LABELS[poseId]}</option>`),
    `<option value="${P2_SEQUENCE_POSE_ID}" disabled>Sequence</option>`,
  ].join('');
  elements.poseSelect.value = state.poseId;
  elements.overlayToggle.checked = state.overlay;
  updateSequenceOption();
  updateUrlFromState();
  publish();
  elements.poseSelect.addEventListener('change', () => {
    stopSequence({ synchronizeToActual: false });
    const poseId = elements.poseSelect.value;
    state.closeup = null;
    applyPose(poseId, fixtures[poseId], { synchronize: true, updateUrl: true });
  });
  elements.overlayToggle.addEventListener('change', () => {
    state.overlay = elements.overlayToggle.checked;
    updateOverlay(); updateUrlFromState(); publish();
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
  elements.viewport.addEventListener('dblclick', () => focusPerson());
  elements.viewport.addEventListener('contextmenu', (event) => event.preventDefault());
  addEventListener('keydown', handleReviewKeydown);
  addEventListener('resize', () => resize({ preserveReview: true }));
  addEventListener('popstate', synchronizeFromLocation);
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
  const controls = new OrbitControls(camera, canvas);
  controls.enableRotate = true;
  controls.enableZoom = true;
  controls.enablePan = true;
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.rotateSpeed = 0.72;
  controls.zoomSpeed = 0.9;
  controls.panSpeed = 0.78;
  controls.screenSpacePanning = true;
  controls.minDistance = 0.38;
  controls.maxDistance = 7.5;
  controls.minPolarAngle = 0.08;
  controls.maxPolarAngle = Math.PI - 0.08;
  controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
  controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
  controls.addEventListener('change', () => {
    updateOverlay();
    publish();
  });
  return { renderer, scene, camera, controls };
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

function applyPose(poseId, finalPose = fixtures[poseId], { synchronize = true, updateUrl = true } = {}) {
  if (!runtime) return;
  if (!POSE_IDS.includes(poseId) || !finalPose) throw new Error(`Unknown fixed P2 pose ${poseId}.`);
  const frame = runtime.update(finalPose);
  const metrics = createHybridSkeletonPoseMetricsV1({
    poseId, moduleMap, runtimeFrame: frame, restSimulationFrame,
    geometryHash: identity.geometryHash, indexHash: identity.indexHash,
    loadedModuleIds: [...objectByModuleId.keys()], maximumFrameToFrameModuleJump: 0,
  });
  state.actualPoseId = poseId;
  state.currentFrame = frame;
  state.metrics = metrics;
  if (synchronize) synchronizePoseState(poseId, { updateUrl });
  else { updateMetrics(); updateOverlay(); publish(); }
}

async function playSequence() {
  if (!runtime || state.sequencePlaying) return;
  const generation = ++state.sequenceGeneration;
  state.sequencePlaying = true;
  state.sequenceComplete = false;
  state.sequenceRequested = false;
  state.maximumFrameToFrameModuleJump = 0;
  let previousSequenceTransforms = null;
  elements.sequenceButton.textContent = '停止诊断序列';
  elements.poseSelect.disabled = true;
  applyPose(SEQUENCE_IDS[0], fixtures[SEQUENCE_IDS[0]], { synchronize: false });
  state.sequenceStatus = { fromPoseId: SEQUENCE_IDS[0], toPoseId: SEQUENCE_IDS[0], alpha: 1 };
  synchronizePoseState(P2_SEQUENCE_POSE_ID, { updateUrl: true });
  for (let index = 0; index < SEQUENCE_IDS.length - 1; index += 1) {
    if (generation !== state.sequenceGeneration) return;
    await wait(350);
    const fromPoseId = SEQUENCE_IDS[index];
    const toPoseId = SEQUENCE_IDS[index + 1];
    state.sequenceStatus = { fromPoseId, toPoseId, alpha: 0 };
    updateSequencePresentation();
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
      state.actualPoseId = alpha >= 1 ? toPoseId : null;
      state.sequenceStatus = { fromPoseId, toPoseId, alpha };
      state.currentFrame = frame;
      updateSequencePresentation();
      updateOverlay();
      if (alpha >= 1) break;
      await nextFrame();
    }
    if (generation !== state.sequenceGeneration) return;
    applyPose(toPoseId, fixtures[toPoseId], { synchronize: false });
    state.sequenceStatus = { fromPoseId, toPoseId, alpha: 1 };
    updateSequencePresentation();
  }
  await wait(500);
  if (generation !== state.sequenceGeneration) return;
  state.sequencePlaying = false;
  state.sequenceComplete = true;
  state.sequenceRequested = false;
  state.sequenceStatus = null;
  state.metrics = { ...state.metrics, maximumFrameToFrameModuleJump: state.maximumFrameToFrameModuleJump };
  elements.sequenceButton.textContent = '播放诊断序列';
  elements.poseSelect.disabled = false;
  synchronizePoseState('locomotion-neutral', { updateUrl: true });
}

function stopSequence({ synchronizeToActual = true } = {}) {
  const status = state.sequenceStatus;
  const poseId = POSE_IDS.includes(state.actualPoseId)
    ? state.actualPoseId
    : status?.alpha >= 0.5 ? status?.toPoseId : status?.fromPoseId;
  state.sequenceGeneration += 1;
  state.sequencePlaying = false;
  state.sequenceRequested = false;
  state.sequenceComplete = false;
  state.sequenceStatus = null;
  elements.sequenceButton.textContent = '播放诊断序列';
  elements.poseSelect.disabled = false;
  if (synchronizeToActual && runtime && POSE_IDS.includes(poseId)) {
    applyPose(poseId, fixtures[poseId], { synchronize: true, updateUrl: true });
  } else if (synchronizeToActual) {
    publish();
  }
}

function createCoreOverlay(frame) {
  const coreIds = new Set(rigCore.coreJointIds);
  const segments = frame.segments.filter(({ parentId, jointId }) => coreIds.has(parentId) && coreIds.has(jointId));
  const lines = segments.map(({ parentId, jointId }) => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    element.dataset.parentId = parentId; element.dataset.jointId = jointId;
    setOverlayElementVisible(element, false);
    elements.coreOverlay.append(element);
    return element;
  });
  const points = [...coreIds].map((jointId) => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    element.setAttribute('r', '3.2'); element.dataset.jointId = jointId;
    setOverlayElementVisible(element, false);
    elements.coreOverlay.append(element);
    return element;
  });
  return { lines, points };
}

function updateOverlay() {
  if (!overlayElements) return;
  elements.coreOverlay.hidden = !state.overlay || !state.overlayProjectionReady;
  if (!state.overlay || !state.overlayProjectionReady || !state.currentFrame) return;
  const rect = elements.viewport.getBoundingClientRect();
  if (!isFinitePositiveViewportRect(rect) || !prepareCameraForOverlay(rect)) {
    elements.coreOverlay.hidden = true;
    hideAllOverlayElements();
    return;
  }
  elements.coreOverlay.hidden = false;
  elements.coreOverlay.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
  const joints = state.currentFrame.simulationRigFrame.joints;
  for (const line of overlayElements.lines) {
    const a = project(joints[line.dataset.parentId].worldPosition, rect);
    const b = project(joints[line.dataset.jointId].worldPosition, rect);
    if (!a || !b) { setOverlayElementVisible(line, false); continue; }
    line.setAttribute('x1', a[0]); line.setAttribute('y1', a[1]); line.setAttribute('x2', b[0]); line.setAttribute('y2', b[1]);
    setOverlayElementVisible(line, true);
  }
  for (const point of overlayElements.points) {
    const projected = project(joints[point.dataset.jointId].worldPosition, rect);
    if (!projected) { setOverlayElementVisible(point, false); continue; }
    point.setAttribute('cx', projected[0]); point.setAttribute('cy', projected[1]);
    setOverlayElementVisible(point, true);
  }
}

function project(position, rect) {
  if (!view?.camera || !isFinitePosition(position) || !isFinitePositiveViewportRect(rect)) return null;
  return projectWorldPositionToViewportV1({
    position,
    viewportWidth: rect.width,
    viewportHeight: rect.height,
    matrixWorldInverse: view.camera.matrixWorldInverse.elements,
    projectionMatrix: view.camera.projectionMatrix.elements,
  });
}

function activateOverlayProjection() {
  const rect = elements.viewport.getBoundingClientRect();
  state.overlayProjectionReady = Boolean(
    view
    && state.currentFrame
    && state.reviewCameraInitialized
    && isFinitePositiveViewportRect(rect)
    && prepareCameraForOverlay(rect)
  );
  if (!state.overlayProjectionReady) {
    elements.coreOverlay.hidden = true;
    hideAllOverlayElements();
    return false;
  }
  updateOverlay();
  return true;
}

function prepareCameraForOverlay(rect) {
  const camera = view?.camera;
  const target = view?.controls?.target;
  if (!camera || !target || !isFinitePositiveViewportRect(rect)
    || !isFiniteVector3(camera.position)
    || !isFiniteVector3(target)
    || !Number.isFinite(camera.aspect)
    || camera.aspect <= 0) return false;
  const expectedAspect = rect.width / rect.height;
  if (!Number.isFinite(expectedAspect)
    || Math.abs(camera.aspect - expectedAspect) > Math.max(1, expectedAspect) * 1e-6) return false;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return isFiniteMatrix4(camera.projectionMatrix)
    && isFiniteMatrix4(camera.matrixWorld)
    && isFiniteMatrix4(camera.matrixWorldInverse);
}

function isFinitePositiveViewportRect(rect) {
  return Boolean(rect && Number.isFinite(rect.width) && rect.width > 0
    && Number.isFinite(rect.height) && rect.height > 0);
}

function isFinitePosition(position) {
  return (Array.isArray(position) || ArrayBuffer.isView(position))
    && position.length === 3
    && Array.from(position).every(Number.isFinite);
}

function isFiniteVector3(vector) {
  return vector && [vector.x, vector.y, vector.z].every(Number.isFinite);
}

function isFiniteMatrix4(matrix) {
  return matrix?.elements?.length === 16 && matrix.elements.every(Number.isFinite);
}

function hideAllOverlayElements() {
  if (!overlayElements) return;
  for (const element of [...overlayElements.lines, ...overlayElements.points]) setOverlayElementVisible(element, false);
}

function setOverlayElementVisible(element, visible) {
  element.style.display = visible ? '' : 'none';
}

function resetDefaultReviewCamera() {
  if (!view || !state.currentFrame) return;
  const bounds = getPersonBounds();
  const target = getInitialReviewTarget();
  const distance = THREE.MathUtils.clamp(requiredCameraDistance(bounds, 1.18), view.controls.minDistance, view.controls.maxDistance);
  view.controls.target.copy(target);
  view.camera.position.set(target.x, target.y - 0.06, target.z - distance);
  view.camera.up.set(0, 1, 0);
  view.controls.update();
  state.reviewCameraInitialized = true;
  updateOverlay();
  publish();
}

function framePerson({ preserveDirection = true } = {}) {
  if (!view || !state.currentFrame) return;
  const bounds = getPersonBounds();
  const direction = preserveDirection
    ? view.camera.position.clone().sub(view.controls.target).normalize()
    : new THREE.Vector3(0, -0.018, -1).normalize();
  if (direction.lengthSq() < 1e-10) direction.set(0, 0, -1);
  const distance = THREE.MathUtils.clamp(requiredCameraDistance(bounds, 1.2), view.controls.minDistance, view.controls.maxDistance);
  view.controls.target.copy(bounds.center);
  view.camera.position.copy(bounds.center).addScaledVector(direction, distance);
  view.controls.update();
  updateOverlay();
  publish();
}

function focusPerson() {
  if (!view || !state.currentFrame) return;
  const bounds = getPersonBounds();
  const direction = view.camera.position.clone().sub(view.controls.target).normalize();
  if (direction.lengthSq() < 1e-10) direction.set(0, 0, -1);
  const framedDistance = requiredCameraDistance(bounds, 1.08);
  const distance = THREE.MathUtils.clamp(Math.min(view.controls.getDistance(), framedDistance), view.controls.minDistance, view.controls.maxDistance);
  view.controls.target.copy(bounds.center);
  view.camera.position.copy(bounds.center).addScaledVector(direction, distance);
  view.controls.update();
  updateOverlay();
  publish();
}

function applyCloseupCameraPreset(closeup) {
  if (!view || !state.currentFrame) return;
  const joints = state.currentFrame.simulationRigFrame.joints;
  let target = getInitialReviewTarget();
  let offset = new THREE.Vector3(0, 0, -1.0);
  if (closeup === 'shoulder') target = new THREE.Vector3(...midpoint(joints.leftShoulder.worldPosition, joints.rightShoulder.worldPosition));
  if (closeup === 'pelvis') { target = new THREE.Vector3(...joints.hips.worldPosition); offset.set(0, 0.02, -0.9); }
  if (closeup === 'hand') { target = new THREE.Vector3(...joints.leftHand.worldPosition); offset.set(0, 0, -0.62); }
  if (closeup === 'foot') { target = new THREE.Vector3(...joints.leftFoot.worldPosition); offset.set(-0.72, 0.08, 0); }
  view.controls.target.copy(target);
  view.camera.position.copy(target).add(offset);
  view.controls.update();
  updateOverlay();
}

function getInitialReviewTarget() {
  const joints = state.currentFrame.simulationRigFrame.joints;
  const thoraxCenter = midpoint(joints.chest.worldPosition, joints.upperChest.worldPosition);
  return new THREE.Vector3(...midpoint(joints.hips.worldPosition, thoraxCenter));
}

function getPersonBounds() {
  const joints = state.currentFrame.simulationRigFrame.joints;
  const points = rigCore.coreJointIds.map((jointId) => new THREE.Vector3(...joints[jointId].worldPosition));
  const box = new THREE.Box3().setFromPoints(points);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  return { box, center, size };
}

function requiredCameraDistance(bounds, padding) {
  const verticalFov = THREE.MathUtils.degToRad(view.camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(view.camera.aspect, 1e-6));
  const verticalDistance = bounds.size.y * 0.5 / Math.tan(verticalFov / 2);
  const horizontalDistance = bounds.size.x * 0.5 / Math.tan(horizontalFov / 2);
  return Math.max(verticalDistance, horizontalDistance, bounds.size.z * 1.4, 0.8) * padding;
}

function handleReviewKeydown(event) {
  if (event.defaultPrevented || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (event.key.toLowerCase() === 'f') { event.preventDefault(); framePerson({ preserveDirection: true }); }
  if (event.key.toLowerCase() === 'r') { event.preventDefault(); resetDefaultReviewCamera(); }
}

function updateMetrics() {
  const metrics = state.metrics;
  if (!metrics) return;
  const rows = [
    ['pose-id', '姿势', state.summaryPoseId],
    ['pose-label', '姿势标签', state.poseId === P2_SEQUENCE_POSE_ID ? sequenceDisplayLabel() : POSE_LABELS[state.poseId]],
    ['modules', '模块', `${metrics.moduleCount}/24`],
    ['missing', '缺失模块', metrics.missingModuleCount], ['non-finite', '非有限 transform', metrics.nonFiniteTransformCount],
    ['reflection', '反射', metrics.reflectionCount], ['read-only', 'finalPose read-only', metrics.finalPoseReadOnlyPassed],
    ['joint-center', 'Joint center max', formatMetric(metrics.maximumJointCenterError, 'm')],
    ['segment-axis', 'Segment axis max', formatMetric(metrics.maximumSegmentAxisError, '°')],
    ['segment-length', 'Segment length max', formatMetric(metrics.maximumSegmentLengthError, 'm')],
    ['attachment', 'Attachment max', formatMetric(metrics.maximumModuleAttachmentError, 'm')],
    ['symmetry', 'L/R residual delta', formatMetric(metrics.leftRightSymmetryError, 'm')],
    ['frame-jump', 'Frame jump max', formatMetric(metrics.maximumFrameToFrameModuleJump, 'm')],
    ['geometry-hash', 'Geometry hash', metrics.geometryHash.slice(0, 12)], ['index-hash', 'Index hash', metrics.indexHash.slice(0, 12)],
    ['numeric-gate', '数值门', metrics.passed],
  ];
  elements.metrics.innerHTML = rows.map(([key, label, value]) => `<dt>${label}</dt><dd data-metric="${key}" class="${value === true ? 'pass' : value === false ? 'fail' : ''}">${value}</dd>`).join('');
}

function synchronizePoseState(poseId, { updateUrl = true } = {}) {
  const normalized = normalizeP2ReviewPoseId(poseId);
  state.poseId = normalized;
  state.summaryPoseId = normalized;
  elements.poseSelect.value = normalized;
  updateSequenceOption();
  if (updateUrl) updateUrlFromState();
  updateMetrics();
  updateOverlay();
  publish();
}

function updateSequencePresentation() {
  if (state.poseId !== P2_SEQUENCE_POSE_ID) return;
  state.summaryPoseId = P2_SEQUENCE_POSE_ID;
  elements.poseSelect.value = P2_SEQUENCE_POSE_ID;
  updateSequenceOption();
  updateMetrics();
  publish();
}

function updateSequenceOption() {
  const option = elements.poseSelect.querySelector(`option[value="${P2_SEQUENCE_POSE_ID}"]`);
  if (option) option.textContent = state.poseId === P2_SEQUENCE_POSE_ID ? sequenceDisplayLabel() : 'Sequence';
}

function sequenceDisplayLabel() {
  const status = state.sequenceStatus;
  if (!status) return 'Sequence';
  const percent = Math.round(Number(status.alpha ?? 0) * 100);
  return `Sequence · ${POSE_LABELS[status.fromPoseId]} → ${POSE_LABELS[status.toPoseId]} · ${percent}%`;
}

function render() {
  view.controls.update();
  view.renderer.render(view.scene, view.camera);
  state.renderedFrames += 1;
  if (state.overlay) updateOverlay();
  if (state.renderedFrames < 4 || state.sequencePlaying) publish();
}

function resize({ preserveReview = true } = {}) {
  if (!view) return;
  const rect = elements.viewport.getBoundingClientRect();
  if (!isFinitePositiveViewportRect(rect)) {
    state.overlayProjectionReady = false;
    elements.coreOverlay.hidden = true;
    hideAllOverlayElements();
    return;
  }
  view.renderer.setSize(rect.width, rect.height, false);
  view.camera.aspect = rect.width / rect.height;
  view.camera.updateProjectionMatrix();
  if (preserveReview && state.currentFrame) framePerson({ preserveDirection: true });
  else updateOverlay();
  if (state.reviewCameraInitialized) activateOverlayProjection();
}

function publish() {
  const urlPoseId = new URL(location.href).searchParams.get('pose');
  const selectPoseId = elements.poseSelect.value;
  const synchronization = createP2PoseSynchronizationSnapshot({
    poseId: state.poseId,
    urlPoseId,
    selectPoseId,
    summaryPoseId: state.summaryPoseId,
  });
  Object.assign(pageState, {
    status: pageState.status,
    ready: pageState.ready,
    webgl2: Boolean(view),
    poseId: state.poseId,
    actualPoseId: state.actualPoseId,
    summaryPoseId: state.summaryPoseId,
    poseSynchronization: synchronization,
    overlay: state.overlay,
    overlayProjectionReady: state.overlayProjectionReady,
    closeup: state.closeup,
    sequencePlaying: state.sequencePlaying,
    sequenceComplete: state.sequenceComplete,
    sequenceStatus: state.sequenceStatus ? { ...state.sequenceStatus } : null,
    renderedFrames: state.renderedFrames,
    camera: view ? {
      authority: 'window-only',
      position: view.camera.position.toArray(),
      target: view.controls.target.toArray(),
      distance: view.controls.getDistance(),
      minDistance: view.controls.minDistance,
      maxDistance: view.controls.maxDistance,
      writesHumanRigCore: false,
      writesFinalPose: false,
      writesProjectState: false,
    } : null,
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

function updateUrlFromState() {
  const url = buildP2ReviewUrl(location.href, {
    poseId: state.poseId,
    overlay: state.overlay,
    sequence: state.poseId === P2_SEQUENCE_POSE_ID && (state.sequencePlaying || state.sequenceRequested),
    closeup: state.closeup,
  });
  history.replaceState({ poseId: state.poseId }, '', url);
}

function synchronizeFromLocation() {
  const params = new URLSearchParams(location.search);
  const rawPoseId = params.get('pose');
  state.overlay = params.get('overlay') === '1';
  state.closeup = params.get('closeup') || null;
  elements.overlayToggle.checked = state.overlay;
  if (isP2SequenceRequest(params)) {
    state.sequenceRequested = true;
    state.poseId = P2_SEQUENCE_POSE_ID;
    state.summaryPoseId = P2_SEQUENCE_POSE_ID;
    elements.poseSelect.value = P2_SEQUENCE_POSE_ID;
    updateSequenceOption();
    updateUrlFromState();
    updateMetrics();
    updateOverlay();
    publish();
    if (runtime && !state.sequencePlaying) void playSequence();
    return;
  }
  const poseId = POSE_IDS.includes(rawPoseId) ? rawPoseId : 'reference-t';
  stopSequence({ synchronizeToActual: false });
  state.poseId = poseId;
  state.actualPoseId = poseId;
  state.summaryPoseId = poseId;
  elements.poseSelect.value = poseId;
  if (runtime) applyPose(poseId, fixtures[poseId], { synchronize: true, updateUrl: rawPoseId !== poseId });
  else {
    if (rawPoseId !== poseId) updateUrlFromState();
    updateSequenceOption();
    updateMetrics();
    updateOverlay();
    publish();
  }
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
