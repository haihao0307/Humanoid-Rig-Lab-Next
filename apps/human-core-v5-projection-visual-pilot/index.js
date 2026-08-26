import * as THREE from 'three';
import {
  HumanCoreRuntime,
  PROCEDURAL_BODY_DNA_PRESETS_V5,
  ProceduralDeformRuntimeV5,
  createBodyDNA,
  createProceduralDeformValidationPoseV5,
} from '../../src/modules/human-core-v5/index.js';

const METRICS_URL = '../../artifacts/qa/task14c-projection-visual-pilot/metrics.json';
const search = new URLSearchParams(location.search);
const isContactSheet = search.get('contact') === '1';
const runtimeErrors = [];
const pageErrors = [];
const originalConsoleError = console.error.bind(console);
console.error = (...values) => {
  runtimeErrors.push(values.map(formatError).join(' '));
  originalConsoleError(...values);
};
addEventListener('error', (event) => pageErrors.push(formatError(event.error ?? event.message)));
addEventListener('unhandledrejection', (event) => pageErrors.push(formatError(event.reason)));

const metricsReport = await fetch(METRICS_URL).then((response) => {
  if (!response.ok) throw new Error(`Pilot metrics unavailable: HTTP ${response.status}.`);
  return response.json();
});

if (isContactSheet) {
  await buildContactSheet();
} else {
  await buildVisualPilot();
}

async function buildVisualPilot() {
  const viewport = document.querySelector('#viewport');
  const loading = document.querySelector('#loading');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true });
  if (!context) throw new Error('Task 14C Projection Visual Pilot requires WebGL2.');
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: false });
  renderer.setPixelRatio(1);
  renderer.setSize(960, 960, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewport.append(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060b12);
  scene.fog = new THREE.Fog(0x060b12, 3.7, 7.5);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
  scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x24180f, 2.15));
  const key = new THREE.DirectionalLight(0xfff0df, 3.35);
  key.position.set(2.8, 4.2, 3.6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x69bfff, 1.45);
  rim.position.set(-3.2, 2.4, -2.8);
  scene.add(rim);
  const floor = new THREE.GridHelper(5, 30, 0x244b68, 0x102638);
  floor.position.y = -0.015;
  scene.add(floor);

  const material = new THREE.MeshStandardMaterial({
    color: 0xd6b89f,
    roughness: 0.63,
    metalness: 0.01,
    side: THREE.FrontSide,
  });
  let mesh = null;
  let current = null;
  let renderFrame = 0;
  const cache = new Map();
  let rebuild = Promise.resolve();

  async function setScenario({
    preset = current?.preset ?? 'Muscular',
    poseId = current?.poseId ?? 't-pose',
    mode = current?.mode ?? 'legacy',
    view = current?.view ?? 'full-front',
  } = {}) {
    if (!['Reference', 'Muscular'].includes(preset)) throw new Error(`Unsupported pilot preset ${preset}.`);
    if (!['t-pose', 'a-pose'].includes(poseId)) throw new Error(`Unsupported pilot pose ${poseId}.`);
    if (!['legacy', 'candidate'].includes(mode)) throw new Error(`Unsupported pilot mode ${mode}.`);
    if (!['full-front', 'pelvis-front', 'pelvis-side'].includes(view)) throw new Error(`Unsupported pilot view ${view}.`);
    loading.classList.remove('hidden');
    document.body.dataset.pilotReady = 'false';
    rebuild = rebuild.then(async () => {
      const entry = await getSurface(preset, mode);
      const pose = createProceduralDeformValidationPoseV5({ poseId, rigCore: entry.rigCore, bodyDNA: entry.bodyDNA, timestamp: 1 });
      entry.human.updatePose(pose);
      const frame = entry.runtime.update({ finalPose: pose, anatomyState: entry.human.getAnatomyState(), timestamp: 1 });
      replaceMesh(frame);
      current = { preset, poseId, mode, view };
      applyCamera(view);
      updateOverlay();
      renderer.render(scene, camera);
      await nextAnimationFrames(2);
      renderer.render(scene, camera);
      loading.classList.add('hidden');
      document.body.dataset.pilotReady = 'true';
      renderFrame += 1;
      publishState(getState());
      return getState();
    });
    return rebuild;
  }

  async function getSurface(preset, mode) {
    const keyName = `${preset}/${mode}`;
    if (cache.has(keyName)) return cache.get(keyName);
    const bodyDNA = createBodyDNA({
      ...structuredClone(PROCEDURAL_BODY_DNA_PRESETS_V5[preset]),
      bodyDNAId: `task14c-projection-pilot-page-${preset.toLowerCase()}-${mode}`,
      identity: { humanId: `task14c-projection-pilot-page-${preset.toLowerCase()}-${mode}`, label: preset },
      proportionRevision: 14,
    });
    const human = new HumanCoreRuntime();
    human.createHuman(bodyDNA);
    const rigCore = human.getRigCore();
    const runtime = new ProceduralDeformRuntimeV5();
    runtime.compileHuman({ bodyDNA, rigCore });
    await runtime.generateCanonicalSurface({
      resolution: 48,
      worker: false,
      projectionMode: mode === 'candidate' ? 'collision-aware-pilot' : 'legacy',
    });
    const entry = { bodyDNA, human, rigCore, runtime };
    cache.set(keyName, entry);
    return entry;
  }

  function replaceMesh(frame) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(frame.deformedPositions), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(frame.deformedNormals), 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(frame.indices), 1));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    if (mesh) {
      scene.remove(mesh);
      mesh.geometry.dispose();
    }
    mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'Task14CProjectionVisualPilotSurface';
    scene.add(mesh);
  }

  function applyCamera(view) {
    const full = view === 'full-front';
    const side = view === 'pelvis-side';
    const halfHeight = full ? 1.03 : 0.35;
    camera.left = -halfHeight;
    camera.right = halfHeight;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    const target = new THREE.Vector3(0, full ? 0.9 : 0.88, full ? 0 : -0.045);
    camera.position.set(side ? 3.2 : 0, target.y, side ? target.z : 3.2);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }

  function updateOverlay() {
    const scenario = metricsReport.scenarios.find((entry) => (
      entry.preset === current.preset && entry.poseId === current.poseId && entry.mode === current.mode
    ));
    document.querySelector('#scenario-label').textContent = `${current.preset} · ${current.poseId === 't-pose' ? 'T Pose' : 'A Pose'} · ${capitalize(current.mode)}`;
    document.querySelector('#view-label').textContent = current.view.replace('-', ' · ').replace('-', ' · ').toUpperCase();
    const badge = document.querySelector('#experiment-badge');
    badge.classList.toggle('hidden', current.mode !== 'candidate');
    badge.classList.toggle('failed', metricsReport.status === 'FAILED');
    badge.textContent = metricsReport.status === 'FAILED'
      ? 'EXPERIMENTAL\nFAILED\nNOT FOR ACCEPTANCE'
      : 'EXPERIMENTAL\nNOT FOR ACCEPTANCE';
    const values = {
      'Total penetrating': scenario?.totalPenetratingCount ?? 'n/a',
      'Target Region Pairs': scenario?.targetRegionPairCount ?? 'n/a',
      'Field error': formatNumber(scenario?.maximumAbsoluteFieldError, 6),
      'Components / boundary': `${scenario?.connectedComponentCount ?? 'n/a'} / ${scenario?.boundaryEdgeCount ?? 'n/a'}`,
      'Vertices / triangles': `${scenario?.vertexCount ?? 'n/a'} / ${scenario?.triangleCount ?? 'n/a'}`,
      'Generation': `${formatNumber(scenario?.generationTimeMs, 1)} ms`,
    };
    document.querySelector('#metrics').innerHTML = Object.entries(values)
      .map(([name, value]) => `<dt>${escapeHTML(name)}</dt><dd>${escapeHTML(value)}</dd>`).join('');
  }

  function getState() {
    const glbRequests = performance.getEntriesByType('resource').filter((entry) => /\.glb(?:$|[?#])/i.test(entry.name));
    return {
      ready: document.body.dataset.pilotReady === 'true',
      current: current ? { ...current } : null,
      renderer: 'WebGL2',
      consoleErrors: [...runtimeErrors],
      pageErrors: [...pageErrors],
      glbRequests: glbRequests.map((entry) => entry.name),
      geometryPresent: Boolean(mesh?.geometry?.getAttribute('position')?.count && mesh?.geometry?.index?.count),
      renderFrame,
    };
  }

  window.__HRL_PROJECTION_VISUAL_PILOT__ = Object.freeze({
    setScenario,
    waitForIdle: async () => { await rebuild; return getState(); },
    getState,
  });
  await setScenario({
    preset: search.get('preset') ?? 'Muscular',
    poseId: search.get('pose') ?? 't-pose',
    mode: search.get('mode') ?? 'legacy',
    view: search.get('view') ?? 'full-front',
  });
}

async function buildContactSheet() {
  document.querySelector('#capture-frame').classList.add('hidden');
  const sheet = document.querySelector('#contact-sheet');
  sheet.classList.remove('hidden');
  const rows = [
    ['Muscular T · Front', 'muscular-t-front.png', 'Muscular', 't-pose'],
    ['Muscular T · Pelvis Front', 'muscular-t-pelvis-front.png', 'Muscular', 't-pose'],
    ['Muscular T · Pelvis Side', 'muscular-t-pelvis-side.png', 'Muscular', 't-pose'],
    ['Muscular A · Front', 'muscular-a-front.png', 'Muscular', 'a-pose'],
    ['Muscular A · Pelvis Front', 'muscular-a-pelvis-front.png', 'Muscular', 'a-pose'],
    ['Reference T · Front', 'reference-t-front.png', 'Reference', 't-pose'],
  ];
  const cells = rows.flatMap(([label, fileName, preset, poseId]) => {
    const legacy = metricsReport.scenarios.find((entry) => entry.preset === preset && entry.poseId === poseId && entry.mode === 'legacy');
    const candidate = metricsReport.scenarios.find((entry) => entry.preset === preset && entry.poseId === poseId && entry.mode === 'candidate');
    return [
      `<div class="contact-cell"><img src="../../artifacts/qa/task14c-projection-visual-pilot/legacy/${fileName}" alt="${escapeHTML(label)} Legacy"></div>`,
      `<div class="contact-cell"><img src="../../artifacts/qa/task14c-projection-visual-pilot/candidate/${fileName}" alt="${escapeHTML(label)} Candidate"></div>`,
      `<div class="contact-cell contact-summary"><b>${escapeHTML(label)}</b><br>`
        + `Legacy: total <code>${legacy.totalPenetratingCount}</code>, target <code>${legacy.targetRegionPairCount}</code><br>`
        + `Candidate: total <code>${candidate.totalPenetratingCount}</code>, target <code>${candidate.targetRegionPairCount}</code><br>`
        + `Field error Δ: <code>${formatNumber(candidate.maximumAbsoluteFieldError - legacy.maximumAbsoluteFieldError, 8)}</code><br>`
        + `Height Δ: <code>${formatNumber(candidate.height - legacy.height, 8)} m</code><br>`
        + `Hip width Δ: <code>${formatNumber(candidate.hipWidth - legacy.hipWidth, 8)} m</code></div>`,
    ];
  });
  sheet.innerHTML = `<h1 class="contact-heading">Task 14C Projection Visual Pilot A · Resolution 48</h1>`
    + `<p class="contact-subtitle">EXPERIMENTAL · NOT FOR ACCEPTANCE · visualAcceptance=false · productionReady=false</p>`
    + `<div class="contact-grid"><div class="contact-column-title">Legacy</div><div class="contact-column-title">Candidate</div><div class="contact-column-title">Metrics summary</div>${cells.join('')}</div>`;
  await Promise.all([...sheet.querySelectorAll('img')].map((image) => image.decode()));
  document.body.dataset.pilotReady = 'true';
  publishState(getContactState());
  window.__HRL_PROJECTION_VISUAL_PILOT__ = Object.freeze({
    waitForIdle: async () => getContactState(),
    getState: getContactState,
  });
}

function getContactState() {
  return {
    ready: document.body.dataset.pilotReady === 'true',
    contactSheet: true,
    imageCount: document.querySelectorAll('#contact-sheet img').length,
    consoleErrors: [...runtimeErrors],
    pageErrors: [...pageErrors],
    glbRequests: performance.getEntriesByType('resource').filter((entry) => /\.glb(?:$|[?#])/i.test(entry.name)).map((entry) => entry.name),
    geometryPresent: true,
  };
}

function nextAnimationFrames(count) {
  return new Promise((resolve) => {
    const step = () => count-- <= 0 ? resolve() : requestAnimationFrame(step);
    requestAnimationFrame(step);
  });
}
function publishState(state) {
  document.querySelector('#pilot-state').textContent = JSON.stringify(state);
  document.body.dataset.consoleErrorCount = String(state.consoleErrors.length);
  document.body.dataset.pageErrorCount = String(state.pageErrors.length);
  document.body.dataset.glbRequestCount = String(state.glbRequests.length);
  document.body.dataset.geometryPresent = String(state.geometryPresent);
}
function formatNumber(value, digits) { return Number.isFinite(value) ? Number(value).toFixed(digits) : 'n/a'; }
function capitalize(value) { return `${value[0].toUpperCase()}${value.slice(1)}`; }
function formatError(error) { return error instanceof Error ? `${error.name}: ${error.message}` : String(error); }
function escapeHTML(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
