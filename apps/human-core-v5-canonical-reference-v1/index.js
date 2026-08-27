import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  HumanCoreRuntime,
  PROCEDURAL_BODY_DNA_PRESETS_V5,
  V4Adapter,
  createBodyDNA,
  createProceduralDeformValidationPoseV5,
  createProceduralSimulationRigFrameV5,
} from '../../src/modules/human-core-v5/index.js';
import { SurfaceCarrierV2 } from '../../src/modules/human-core-v5/surface-v2/index.js';
import {
  calculateCanonicalReferenceDeviationV1,
  compareCanonicalReferenceFidelityV1,
  createCanonicalReferenceStaticCarrierV1,
  extractCanonicalReferenceStaticDataV1,
  findCanonicalReferenceBodyV1,
  hashBytesSha256V1,
  loadCanonicalReferenceGlbV1,
} from '../../src/modules/human-core-v5/canonical-reference-v1/index.js';

const SOURCE_ASSET_PATH = './assets/human/production-surface-v2/candidate-a/neutral-body-candidate-a.glb';
const SOURCE_RECEIPT_PATH = './assets/human/production-surface-v2/candidate-a/ASSET_RECEIPT.json';
const CANONICAL_ASSET_PATH = './assets/human/canonical-reference-v1/makehuman-reference-neutral-static-v1.glb';
const SOURCE_ASSET_SHA256 = '8E62AE9FBDCDF40F0B3B294ACC8DE1FE0360A838B4E9351604114AFAED94D38E';
const SOURCE_ASSET_BYTES = 974268;
const CANONICAL_ASSET_SHA256 = 'DFB79A337DB0B6CE36BF3A94C7703A35D710331311026AD3C33BBBAB751EF257';
const SOURCE_COMMIT = '437dd513888a92399d1d3200d2e80859fae55abc';
const SOURCE_LICENSE = 'CC0-1.0';
const SINGLE_VIEWPORT = Object.freeze({ width: 1040, height: 820 });
const query = new URLSearchParams(location.search);
const mode = query.get('mode') ?? 'source-static';
const viewId = query.get('view') ?? 'front';
const pair = query.get('pair') ?? null;
const evidenceMode = query.get('evidence') === '1';
const allowedModes = ['source-static', 'canonical-static', 'overlay', 'deviation', 'current-bound', 'compare'];
const allowedViews = ['front', 'side', 'back', 'three-quarter'];
if (!allowedModes.includes(mode)) throw new Error(`Unknown canonical reference mode: ${mode}.`);
if (!allowedViews.includes(viewId)) throw new Error(`Unknown canonical reference view: ${viewId}.`);
if (evidenceMode) document.body.classList.add('evidence-page');
if (mode === 'compare') document.body.classList.add('compare-mode');

const consoleErrors = [];
const pageErrors = [];
const failedRequestDetails = [];
const loadedHumanAssetPaths = [];
const requestAudit = [];
const nativeFetch = globalThis.fetch.bind(globalThis);
const nativeConsoleError = console.error.bind(console);
console.error = (...values) => {
  consoleErrors.push(values.map(formatError).join(' '));
  nativeConsoleError(...values);
};
addEventListener('error', (event) => pageErrors.push(formatError(event.error ?? event.message)));
addEventListener('unhandledrejection', (event) => pageErrors.push(formatError(event.reason)));
globalThis.fetch = auditedFetch;
publish(createPendingState());

try {
  const sourceParsed = await loadAndVerifyGlb(SOURCE_ASSET_PATH, SOURCE_ASSET_SHA256, SOURCE_ASSET_BYTES);
  const sourceData = await extractCanonicalReferenceStaticDataV1(sourceParsed, findCanonicalReferenceBodyV1(sourceParsed));
  const canonicalParsed = await loadAndVerifyGlb(CANONICAL_ASSET_PATH, CANONICAL_ASSET_SHA256);
  const canonicalData = await extractCanonicalReferenceStaticDataV1(canonicalParsed, findCanonicalReferenceBodyV1(canonicalParsed));
  const fidelity = compareCanonicalReferenceFidelityV1(sourceData, canonicalData);
  if (!fidelity.passed) throw new Error('REFERENCE_GEOMETRY_COPY_MISMATCH');
  const deviation = calculateCanonicalReferenceDeviationV1(sourceData, canonicalData);
  const sourceBounds = boundsFromWorldPositions(sourceData.worldPositions);
  const build = await buildMode({ sourceData, canonicalData, fidelity, deviation, sourceBounds });
  await renderStable(build.views);
  const resourceAudit = collectResourceAudit();
  const allScenes = build.views.map((entry) => entry.scene);
  const actualVisibleMeshCount = countVisibleMeshes(allScenes);
  const rendererInfo = readRendererInfo(build.views[0].context);
  const state = {
    ...createPendingState(),
    ready: true,
    sourceAssetSha256: SOURCE_ASSET_SHA256,
    sourceAssetBytes: SOURCE_ASSET_BYTES,
    sourceVertexCount: sourceData.vertexCount,
    sourceTriangleCount: sourceData.triangleCount,
    sourcePrimitiveCount: sourceData.primitiveCount,
    sourceNodeName: sourceData.nodeName,
    sourceMeshName: sourceData.meshName,
    sourceNodeMatrix: [...sourceData.sourceNodeMatrix],
    sourceWorldMatrix: [...sourceData.sourceWorldMatrix],
    sourcePositionHash: sourceData.positionHash,
    sourceIndexHash: sourceData.indexHash,
    sourceNormalHash: sourceData.normalHash,
    sourceWorldPositionHash: sourceData.worldSpacePositionHash,
    sourceWorldNormalHash: sourceData.worldSpaceNormalHash,
    canonicalAssetSha256: CANONICAL_ASSET_SHA256,
    canonicalAssetBytes: canonicalParsed.byteLength,
    canonicalVertexCount: canonicalData.vertexCount,
    canonicalTriangleCount: canonicalData.triangleCount,
    canonicalPositionHash: canonicalData.positionHash,
    canonicalIndexHash: canonicalData.indexHash,
    canonicalNormalHash: canonicalData.normalHash,
    canonicalWorldPositionHash: canonicalData.worldSpacePositionHash,
    canonicalWorldNormalHash: canonicalData.worldSpaceNormalHash,
    maximumWorldPositionDelta: fidelity.maximumWorldPositionDelta,
    meanWorldPositionDelta: fidelity.meanWorldPositionDelta,
    maximumWorldNormalDelta: fidelity.maximumWorldNormalDelta,
    sourceStaticGeometryPresent: build.sourceStaticGeometryPresent,
    canonicalStaticGeometryPresent: build.canonicalStaticGeometryPresent,
    currentBoundGeometryPresent: build.currentBoundGeometryPresent,
    geometryPresent: actualVisibleMeshCount > 0,
    materialSide: 'FrontSide',
    visibleMeshCount: actualVisibleMeshCount,
    humanSurfaceCount: build.humanSurfaceCount,
    currentBoundUsesSkinning: build.currentBoundGeometryPresent,
    currentBoundRuntimeMetrics: build.currentBoundRuntimeMetrics,
    renderer: rendererInfo.renderer,
    webglVersion: rendererInfo.webglVersion,
    browserUserAgent: navigator.userAgent,
    browserBrands: navigator.userAgentData?.brands ? structuredClone(navigator.userAgentData.brands) : [],
    loadedHumanAssetPaths: resourceAudit.loadedHumanAssetPaths,
    externalHumanAssetRequests: resourceAudit.externalHumanAssetRequests,
    failedRequests: failedRequestDetails.length,
    failedRequestDetails: [...failedRequestDetails],
    requestAudit: requestAudit.map((entry) => ({ ...entry })),
    consoleErrors: [...consoleErrors],
    pageErrors: [...pageErrors],
  };
  populateSummary(state, fidelity, build);
  document.body.dataset.referenceReady = 'true';
  document.querySelector('#loading').classList.add('hidden');
  publish(state);
} catch (error) {
  const message = formatError(error);
  pageErrors.push(message);
  const fatal = document.querySelector('#fatal');
  fatal.textContent = message;
  fatal.classList.remove('hidden');
  document.querySelector('#loading').classList.add('hidden');
  publish({ ...createPendingState(), failedRequests: failedRequestDetails.length, failedRequestDetails: [...failedRequestDetails], loadedHumanAssetPaths: [...loadedHumanAssetPaths], externalHumanAssetRequests: countExternalHumanAssetRequests(), consoleErrors: [...consoleErrors], pageErrors: [...pageErrors] });
  throw error;
}

async function buildMode(context) {
  const root = document.querySelector('#mode-root');
  root.replaceChildren();
  const common = { views: [], sourceStaticGeometryPresent: false, canonicalStaticGeometryPresent: false, currentBoundGeometryPresent: false, humanSurfaceCount: 0, currentBoundRuntimeMetrics: null };
  if (mode === 'compare') return buildComparison(root, context, common);
  const host = createViewportHost(root, 'single-viewport');
  const view = createView(host, SINGLE_VIEWPORT);
  common.views.push(view);
  if (mode === 'source-static') {
    addStaticSurface(view, context.sourceData, sourceMaterial(), { wireframe: query.get('wireframe') === '1' });
    common.sourceStaticGeometryPresent = true; common.humanSurfaceCount = 1;
    addStamp(root, 'SOURCE STATIC TRUTH', 'MAKEHUMAN MPFB2 BODY', 'NO SKINNING · NO RIG · NO DEFORMATION');
  } else if (mode === 'canonical-static') {
    addStaticSurface(view, context.canonicalData, canonicalMaterial(), { wireframe: query.get('wireframe') === '1' });
    common.canonicalStaticGeometryPresent = true; common.humanSurfaceCount = 1;
    addStamp(root, 'CANONICAL STATIC COPY V1', 'EXACT SOURCE GEOMETRY · A-POSE-LIKE REST', 'NO SHAPE EDIT · NO SKINNING · PENDING USER APPROVAL');
  } else if (mode === 'overlay') {
    const source = addStaticSurface(view, context.sourceData, sourceMaterial());
    addWireframeOverlay(view.scene, context.canonicalData, 0x57e7ff, 0.9);
    source.mesh.material.polygonOffset = true; source.mesh.material.polygonOffsetFactor = 1; source.mesh.material.polygonOffsetUnits = 1;
    common.sourceStaticGeometryPresent = true; common.canonicalStaticGeometryPresent = true; common.humanSurfaceCount = 2;
    addStamp(root, 'SOURCE VS CANONICAL OVERLAY', 'SOURCE SOLID · CANONICAL WIREFRAME', `MAX WORLD POSITION DELTA ${scientific(context.fidelity.maximumWorldPositionDelta)} m`);
  } else if (mode === 'deviation') {
    addDeviationSurface(view, context.canonicalData, context.deviation);
    common.sourceStaticGeometryPresent = true; common.canonicalStaticGeometryPresent = true; common.humanSurfaceCount = 2;
    addStamp(root, 'SOURCE VS CANONICAL DEVIATION', 'WORLD-SPACE PER-VERTEX DISTANCE', `MAX ${scientific(context.deviation.maximum)} m · RED > 1e-7 m`);
  } else if (mode === 'current-bound') {
    const bound = await addCurrentBoundSurface(view);
    common.currentBoundGeometryPresent = true; common.humanSurfaceCount = 1; common.currentBoundRuntimeMetrics = bound.runtimeMetrics;
    addStamp(root, 'CURRENT TASK 15A BOUND RESULT', 'BINDING DIAGNOSTIC ONLY · NOT CANONICAL', 'UNMODIFIED WEIGHTS · UNMODIFIED BIND MATRICES');
  }
  configureView(view, context.sourceBounds, viewId, query.get('closeup'));
  return common;
}

async function buildComparison(root, context, common) {
  const entries = pair === 'source-bound'
    ? [
      { id: 'source', label: 'SOURCE STATIC TRUTH', sublabel: 'NO SKINNING' },
      { id: 'bound', label: 'CURRENT TASK 15A BOUND RESULT', sublabel: 'FAILED BINDING DIAGNOSTIC ONLY' },
    ]
    : [
      { id: 'source', label: 'SOURCE STATIC TRUTH', sublabel: 'NO SKINNING' },
      { id: 'canonical', label: 'CANONICAL STATIC COPY', sublabel: 'EXACT SOURCE GEOMETRY' },
      { id: 'bound', label: 'CURRENT TASK 15A BOUND DIAGNOSTIC', sublabel: 'NOT CANONICAL · NOT APPROVED' },
    ];
  root.classList.add(entries.length === 2 ? 'comparison-pair' : 'comparison-triple');
  const width = entries.length === 2 ? 520 : Math.floor(SINGLE_VIEWPORT.width / 3);
  for (const entry of entries) {
    const card = document.createElement('article'); card.className = `comparison-card ${entry.id}`;
    const label = document.createElement('div'); label.className = 'comparison-label'; label.innerHTML = `<b>${entry.label}</b><span>${entry.sublabel}</span>`;
    const host = createViewportHost(card, 'comparison-viewport'); card.append(label); root.append(card);
    const view = createView(host, { width, height: 750 }); common.views.push(view);
    if (entry.id === 'source') { addStaticSurface(view, context.sourceData, sourceMaterial()); common.sourceStaticGeometryPresent = true; }
    if (entry.id === 'canonical') { addStaticSurface(view, context.canonicalData, canonicalMaterial()); common.canonicalStaticGeometryPresent = true; }
    if (entry.id === 'bound') { const bound = await addCurrentBoundSurface(view); common.currentBoundGeometryPresent = true; common.currentBoundRuntimeMetrics = bound.runtimeMetrics; }
    configureView(view, context.sourceBounds, viewId, query.get('closeup'));
  }
  common.humanSurfaceCount = entries.length;
  return common;
}

function addStaticSurface(view, staticData, material, { wireframe = false } = {}) {
  const carrier = createCanonicalReferenceStaticCarrierV1({ THREE, staticData, material });
  view.scene.add(carrier.mesh);
  if (wireframe) addWireframeOverlay(view.scene, staticData, 0x182733, 0.7);
  return carrier;
}

function addWireframeOverlay(scene, staticData, color, opacity) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(staticData.positions), 3));
  geometry.setIndex(new THREE.BufferAttribute(new staticData.indices.constructor(staticData.indices), 1));
  const lines = new THREE.LineSegments(new THREE.WireframeGeometry(geometry), new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: true }));
  lines.matrixAutoUpdate = false; lines.matrix.fromArray(staticData.sourceWorldMatrix); lines.updateMatrixWorld(true); lines.renderOrder = 3;
  scene.add(lines);
  return lines;
}

function addDeviationSurface(view, staticData, deviation) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(staticData.positions), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(staticData.normals), 3));
  geometry.setIndex(new THREE.BufferAttribute(new staticData.indices.constructor(staticData.indices), 1));
  const colors = new Float32Array(staticData.vertexCount * 3);
  for (let index = 0; index < staticData.vertexCount; index += 1) {
    const exceeded = deviation.distances[index] > 1e-7;
    colors[index * 3] = exceeded ? 1 : 0.08; colors[index * 3 + 1] = exceeded ? 0.03 : 0.72; colors[index * 3 + 2] = exceeded ? 0.03 : 0.78;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0, side: THREE.FrontSide });
  const mesh = new THREE.Mesh(geometry, material); mesh.matrixAutoUpdate = false; mesh.matrix.fromArray(staticData.sourceWorldMatrix); mesh.updateMatrixWorld(true); view.scene.add(mesh);
  return mesh;
}

async function addCurrentBoundSurface(view) {
  const bodyDNA = createBodyDNA({
    ...structuredClone(PROCEDURAL_BODY_DNA_PRESETS_V5.Reference),
    bodyDNAId: 'task16a-r2a-current-task15a-bound-diagnostic',
    identity: { humanId: 'task16a-r2a-current-task15a-bound-diagnostic', label: 'Task 16A R2A current Task15A bound diagnostic' },
    proportionRevision: 16,
  });
  const human = new HumanCoreRuntime(); human.createHuman(bodyDNA);
  const rigCore = human.getRigCore();
  const finalPose = createProceduralDeformValidationPoseV5({ poseId: 't-pose', rigCore, bodyDNA, timestamp: 1 });
  const referencePose = createProceduralDeformValidationPoseV5({ poseId: 't-pose', rigCore, bodyDNA, timestamp: 0 });
  human.updatePose(finalPose);
  createProceduralSimulationRigFrameV5({ finalPose, rigCore, bodyDNA });
  const referenceFrame = createProceduralSimulationRigFrameV5({ finalPose: referencePose, rigCore, bodyDNA });
  V4Adapter.humanRigCoreToExistingRig(rigCore, { bodyDNA, pose: 'T' });
  const carrier = new SurfaceCarrierV2({ THREE, GLTFLoader, scene: view.scene, rigCore, sourceReferenceFrame: referenceFrame });
  await carrier.load({ url: SOURCE_ASSET_PATH, receiptUrl: SOURCE_RECEIPT_PATH });
  carrier.applyFinalPose(finalPose);
  carrier.getMesh().material = diagnosticMaterial(); carrier.getMesh().material.side = THREE.FrontSide; carrier.getMesh().updateMatrixWorld(true);
  return { carrier, runtimeMetrics: carrier.getRuntimeMetrics() };
}

function createViewportHost(parent, className) { const host = document.createElement('div'); host.className = className; parent.append(host); return host; }
function createView(host, dimensions) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', { antialias: true, alpha: false, preserveDrawingBuffer: true });
  if (!context) throw new Error('BROWSER_EVIDENCE_INCONCLUSIVE: WebGL2 is required.');
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
  renderer.setPixelRatio(1); renderer.setSize(dimensions.width, dimensions.height, false); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping; renderer.shadowMap.enabled = false; host.append(canvas);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b1118); scene.add(new THREE.HemisphereLight(0xf0f4f5, 0x38424a, 2.15));
  const key = new THREE.DirectionalLight(0xfff2e8, 2.35); key.position.set(2.4, 3.5, 4.2); scene.add(key);
  const fill = new THREE.DirectionalLight(0xc8dfeb, 1.15); fill.position.set(-3.4, 2.2, 2.1); scene.add(fill);
  return { renderer, scene, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 40), context, dimensions };
}

function configureView(view, bounds, requestedView, closeup) {
  addGround(view.scene, bounds);
  const size = bounds.size; const center = bounds.center; const radius = Math.max(size.x, size.y, size.z) * 3; const aspect = view.dimensions.width / view.dimensions.height;
  const closeupConfig = closeup ? getCloseup(closeup, bounds) : null; const target = closeupConfig?.target ?? center;
  const halfHeight = closeupConfig?.halfHeight ?? Math.max(size.y * 0.56, size.x / aspect * 0.57);
  view.camera.left = -halfHeight * aspect; view.camera.right = halfHeight * aspect; view.camera.top = halfHeight; view.camera.bottom = -halfHeight;
  const direction = { front: new THREE.Vector3(0, 0, 1), side: new THREE.Vector3(1, 0, 0), back: new THREE.Vector3(0, 0, -1), 'three-quarter': new THREE.Vector3(0.72, 0, 1).normalize() }[requestedView];
  view.camera.position.copy(target).addScaledVector(direction, radius); view.camera.lookAt(target); view.camera.updateProjectionMatrix(); view.camera.updateMatrixWorld(true);
}

function addGround(scene, bounds) { const size = Math.max(bounds.size.x * 2.8, 3.2); const grid = new THREE.GridHelper(size, 28, 0x35546a, 0x1d2c37); grid.position.y = bounds.min.y - 0.002; scene.add(grid); }
function getCloseup(id, bounds) {
  const size = bounds.size; const min = bounds.min; const center = bounds.center; const point = (x, y, z = 0) => new THREE.Vector3(min.x + size.x * x, min.y + size.y * y, center.z + size.z * z);
  const configs = { 'head-neck': [point(.5, .91), .17], shoulder: [point(.30, .80), .17], axilla: [point(.28, .73), .15], elbow: [point(.10, .63), .15], hand: [point(.035, .47), .16], 'chest-waist': [point(.5, .65), .22], pelvis: [point(.5, .50), .18], groin: [point(.5, .43), .16], knee: [point(.39, .25), .14], 'ankle-foot': [point(.40, .055, .12), .15] };
  const config = configs[id]; if (!config) throw new Error(`Unknown canonical reference closeup: ${id}.`); return { target: config[0], halfHeight: size.y * config[1] };
}

function boundsFromWorldPositions(positions) {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity); const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity); const point = new THREE.Vector3();
  for (let offset = 0; offset < positions.length; offset += 3) { point.set(positions[offset], positions[offset + 1], positions[offset + 2]); min.min(point); max.max(point); }
  return { min, max, size: max.clone().sub(min), center: min.clone().add(max).multiplyScalar(0.5) };
}

async function renderStable(views) { for (const view of views) view.renderer.render(view.scene, view.camera); await nextFrames(3); for (const view of views) view.renderer.render(view.scene, view.camera); }
function nextFrames(count) { return new Promise((resolve) => { const step = () => count-- <= 0 ? resolve() : requestAnimationFrame(step); requestAnimationFrame(step); }); }
function sourceMaterial() { return new THREE.MeshStandardMaterial({ color: 0xb9a28f, roughness: 0.82, metalness: 0, side: THREE.FrontSide }); }
function canonicalMaterial() { return new THREE.MeshStandardMaterial({ color: 0xa7c5c1, roughness: 0.82, metalness: 0, side: THREE.FrontSide }); }
function diagnosticMaterial() { return new THREE.MeshStandardMaterial({ color: 0xd18d7e, roughness: 0.82, metalness: 0, side: THREE.FrontSide }); }
function addStamp(root, title, subtitle, detail) { const stamp = document.createElement('div'); stamp.className = 'truth-stamp'; stamp.innerHTML = `<b>${title}</b><span>${subtitle}</span><span>${detail}</span>`; root.append(stamp); }

async function loadAndVerifyGlb(path, expectedSha256, expectedBytes = null) {
  const parsed = await loadCanonicalReferenceGlbV1(path, { fetchImpl: auditedFetch }); const measuredSha256 = await hashBytesSha256V1(parsed.bytes);
  if (measuredSha256 !== expectedSha256 || (expectedBytes != null && parsed.byteLength !== expectedBytes)) throw new Error(`Asset integrity failed for ${path}.`); return parsed;
}

async function auditedFetch(input, init) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href); const assetLike = /\.(?:glb|gltf|obj|fbx|vrm|bin)(?:$|[?#])/i.test(url.href); const external = url.origin !== location.origin;
  const record = { url: url.href, assetLike, external, status: null, ok: false }; requestAudit.push(record);
  try {
    const response = await nativeFetch(input, init); record.status = response.status; record.ok = response.ok;
    if (assetLike) { const path = url.pathname.replace(/^\//, ''); if (!loadedHumanAssetPaths.includes(path)) loadedHumanAssetPaths.push(path); }
    if (!response.ok) failedRequestDetails.push({ url: url.href, status: response.status }); return response;
  } catch (error) { failedRequestDetails.push({ url: url.href, status: null, error: formatError(error) }); throw error; }
}

function collectResourceAudit() {
  for (const entry of performance.getEntriesByType('resource')) { const url = new URL(entry.name, location.href); if (/\.(?:glb|gltf|obj|fbx|vrm|bin)(?:$|[?#])/i.test(url.href)) { const path = url.pathname.replace(/^\//, ''); if (!loadedHumanAssetPaths.includes(path)) loadedHumanAssetPaths.push(path); } }
  return { loadedHumanAssetPaths: [...loadedHumanAssetPaths], externalHumanAssetRequests: countExternalHumanAssetRequests() };
}
function countExternalHumanAssetRequests() { return requestAudit.filter((entry) => entry.assetLike && entry.external).length; }
function countVisibleMeshes(scenes) { let count = 0; for (const scene of scenes) scene.traverse((object) => { if (object.isMesh && object.visible) count += 1; }); return count; }
function readRendererInfo(context) { const debug = context.getExtension('WEBGL_debug_renderer_info'); return { renderer: String(debug ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER)), webglVersion: String(context.getParameter(context.VERSION)) }; }

function populateSummary(state, fidelity, build) {
  document.querySelector('#page-title').textContent = modeLabel(mode); document.querySelector('#page-subtitle').textContent = mode === 'current-bound' || mode === 'compare' ? 'Current Task 15A binding is shown unmodified for error-source isolation.' : 'Locked source and exact static-copy evidence; no shape editing or deformation.';
  const facts = [['Mode', modeLabel(mode)], ['Source vertices', state.sourceVertexCount], ['Canonical vertices', state.canonicalVertexCount], ['Triangles', state.sourceTriangleCount], ['Index exact', fidelity.indexOrderIdentical], ['Vertex exact', fidelity.vertexOrderIdentical], ['Max position delta', scientific(fidelity.maximumWorldPositionDelta)], ['Mean position delta', scientific(fidelity.meanWorldPositionDelta)], ['Max normal delta', scientific(fidelity.maximumWorldNormalDelta)], ['Visible Mesh', state.visibleMeshCount], ['Human surfaces', state.humanSurfaceCount], ['Current bound', build.currentBoundGeometryPresent], ['External assets', state.externalHumanAssetRequests]];
  document.querySelector('#truth-facts').innerHTML = facts.map(([key, value]) => `<dt>${key}</dt><dd>${value}</dd>`).join(''); document.querySelector('#source-node-matrix').textContent = formatMatrix(state.sourceNodeMatrix); document.querySelector('#source-world-matrix').textContent = formatMatrix(state.sourceWorldMatrix);
}

function createPendingState() {
  return { ready: false, mode, view: viewId, pair, sourceAssetPath: SOURCE_ASSET_PATH, sourceAssetSha256: null, sourceAssetBytes: null, sourceCommit: SOURCE_COMMIT, sourceLicense: SOURCE_LICENSE, sourceReferencePose: 'makehuman-source-rest-reference', sourceReferencePoseClass: 'a-pose-like', sourceReferencePoseModified: false, sourceVertexCount: null, sourceTriangleCount: null, sourcePrimitiveCount: null, sourceNodeMatrix: null, sourceWorldMatrix: null, sourcePositionHash: null, sourceIndexHash: null, sourceNormalHash: null, sourceWorldPositionHash: null, canonicalAssetPath: CANONICAL_ASSET_PATH, canonicalAssetSha256: null, canonicalVertexCount: null, canonicalTriangleCount: null, canonicalPositionHash: null, canonicalIndexHash: null, canonicalNormalHash: null, canonicalWorldPositionHash: null, maximumWorldPositionDelta: null, meanWorldPositionDelta: null, maximumWorldNormalDelta: null, sourceStaticGeometryPresent: false, canonicalStaticGeometryPresent: false, currentBoundGeometryPresent: false, sourceUsesSkinning: false, canonicalUsesSkinning: false, externalHumanAssetRequests: null, failedRequests: null, failedRequestDetails: [], loadedHumanAssetPaths: [], consoleErrors: [...consoleErrors], pageErrors: [...pageErrors], universalNeutralShapeApproved: false, canonicalTopologyFoundationApproved: true, dynamicSkinningApproved: false, bodyDNAApproved: false, imageFittingApproved: false, visualAcceptance: false, productionReady: false, userVisualAcceptance: 'pending' };
}

function publish(value) { const snapshot = structuredClone(value); window.__CANONICAL_REFERENCE_MESH_V1__ = Object.freeze({ ...snapshot, getState: () => structuredClone(snapshot), waitForIdle: async () => structuredClone(snapshot) }); document.querySelector('#reference-state').textContent = JSON.stringify(snapshot, null, 2); }
function modeLabel(value) { return ({ 'source-static': 'Source Static Truth', 'canonical-static': 'Canonical Static Copy V1', overlay: 'Source vs Canonical Overlay', deviation: 'World-Space Deviation', 'current-bound': 'Current Task 15A Bound Diagnostic', compare: 'Source · Canonical · Current Bound Compare' })[value]; }
function formatMatrix(matrix) { const rows = []; for (let row = 0; row < 4; row += 1) rows.push(`[ ${[0, 1, 2, 3].map((column) => Number(matrix[column * 4 + row]).toFixed(6)).join('  ')} ]`); return rows.join('\n'); }
function scientific(value) { return Number(value).toExponential(6); }
function formatError(value) { return value instanceof Error ? `${value.name}: ${value.message}` : String(value); }
