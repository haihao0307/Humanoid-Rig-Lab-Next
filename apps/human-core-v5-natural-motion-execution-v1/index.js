import * as THREE from 'three';

import { createBodyDNA } from '../../src/modules/human-core-v5/body-dna-v5.js';
import { createHumanRigCoreV5 } from '../../src/modules/human-core-v5/human-rig-core-v5.js';
import { createProceduralSimulationRigFrameV5 } from '../../src/modules/human-core-v5/procedural-deform/procedural-simulation-rig-fk-v5.js';
import {
  InstructionInterpreterAdapterV1,
  NaturalLocomotionRuntimeV1,
} from '../../src/modules/human-core-v5/motion-execution-v1/index.js';

const METRICS_URL = '../../artifacts/qa/task17a-natural-motion/metrics.json';
const FRAME_BASE_URL = '../../artifacts/qa/task17a-natural-motion/frames';
const DEFAULT_SCENARIO = 'instruction-command-a';
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

const specialView = search.get('view');
if (specialView) {
  await buildEvidenceView(specialView);
} else {
  await buildMotionApplication();
}

async function buildMotionApplication() {
  const bodyDNA = createBodyDNA({
    bodyDNAId: 'task17a-natural-motion-browser-reference',
    identity: { humanId: 'task17a-natural-motion-browser-reference', label: 'Task 17A Browser Reference' },
    proportionRevision: 17,
  });
  const rigCore = createHumanRigCoreV5({ bodyDNA });
  let runtime = new NaturalLocomotionRuntimeV1({ bodyDNA, sampleRate: 60 });
  let scenarioId = search.get('scenario') || DEFAULT_SCENARIO;
  let execution = runtime.loadScenario(scenarioId);
  let playing = search.get('autoplay') !== '0';
  let playbackTime = clamp(Number(search.get('time')) || 0, 0, execution.duration);
  let previousTimestamp = performance.now();

  const view = createThreeView(document.querySelector('#viewport'));
  const rigVisual = createRigVisual(view.scene, rigCore.topology.jointCount);
  const overlays = createMotionOverlays(view.scene);
  rebuildStaticOverlays(execution, overlays);
  document.querySelector('#scenario-label').textContent = scenarioId;
  document.querySelector('#timeline').max = String(execution.duration);
  document.querySelector('#timeline').value = String(playbackTime);
  document.querySelector('#command-input').value = execution.command?.text || document.querySelector('#command-input').value;

  document.querySelector('#execute-command').addEventListener('click', () => {
    try {
      const text = document.querySelector('#command-input').value;
      const interpreted = new InstructionInterpreterAdapterV1().interpret(text, {
        commandId: 'task17a-browser-command',
        actorId: 'task17a-natural-motion-browser-reference',
        startPosition: [0, 0, 0],
        startFacing: 0,
      });
      runtime = new NaturalLocomotionRuntimeV1({ bodyDNA, sampleRate: 60 });
      execution = runtime.loadBehaviorPlan(interpreted.behaviorPlan, {
        scenarioId: 'browser-development-command',
        command: interpreted.command,
      });
      scenarioId = 'browser-development-command';
      playbackTime = 0;
      playing = true;
      previousTimestamp = performance.now();
      document.querySelector('#timeline').max = String(execution.duration);
      document.querySelector('#scenario-label').textContent = scenarioId;
      rebuildStaticOverlays(execution, overlays);
    } catch (error) {
      pageErrors.push(formatError(error));
      document.querySelector('#command-diagnostics').textContent = error.message;
    }
  });
  document.querySelector('#restart').addEventListener('click', () => {
    playbackTime = 0;
    playing = true;
    previousTimestamp = performance.now();
  });
  document.querySelector('#pause').addEventListener('click', (event) => {
    playing = !playing;
    event.currentTarget.textContent = playing ? 'Pause' : 'Play';
    previousTimestamp = performance.now();
  });
  document.querySelector('#timeline').addEventListener('input', (event) => {
    playbackTime = Number(event.currentTarget.value);
    playing = false;
    document.querySelector('#pause').textContent = 'Play';
  });

  let renderedFrames = 0;
  const animate = (timestamp) => {
    const dt = Math.min(1 / 15, Math.max(0, (timestamp - previousTimestamp) / 1000));
    previousTimestamp = timestamp;
    if (playing) playbackTime = Math.min(execution.duration, playbackTime + dt);
    if (playbackTime >= execution.duration) playing = false;
    const frame = runtime.sample(playbackTime);
    const simulationRig = createProceduralSimulationRigFrameV5({ finalPose: frame.finalPose, rigCore, bodyDNA });
    updateRigVisual(rigVisual, simulationRig);
    updateMotionOverlays(overlays, frame, execution);
    followCharacter(view.camera, frame.finalPose.rootPosition);
    view.renderer.render(view.scene, view.camera);
    updatePanels(frame, execution, view.webgl2);
    document.querySelector('#timeline').value = String(playbackTime);
    document.querySelector('#time-output').textContent = `${playbackTime.toFixed(2)} s`;
    publishState(frame, execution, view, renderedFrames);
    renderedFrames += 1;
    if (renderedFrames >= 3) document.querySelector('#loading').classList.add('hidden');
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
  addEventListener('resize', () => resizeView(view));
}

function createThreeView(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x071019, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x071019, 8, 18);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 50);
  camera.position.set(3.2, 2.4, 4.2);
  const ambient = new THREE.HemisphereLight(0xbfe8ff, 0x24313a, 2.0);
  scene.add(ambient);
  const ground = new THREE.GridHelper(18, 36, 0x315168, 0x173144);
  ground.position.y = 0;
  scene.add(ground);
  resizeView({ renderer, camera, container });
  const context = renderer.getContext();
  return {
    renderer, scene, camera, container,
    webgl2: Boolean(context && String(context.getParameter(context.VERSION)).includes('WebGL 2')),
  };
}

function createRigVisual(scene) {
  const lines = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0xd6ecff, transparent: true, opacity: 0.94 }),
  );
  const points = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.032, sizeAttenuation: true }),
  );
  scene.add(lines, points);
  return { lines, points };
}

function updateRigVisual(visual, frame) {
  const segmentPositions = new Float32Array(frame.segments.length * 6);
  frame.segments.forEach(({ parentId, jointId }, index) => {
    segmentPositions.set(frame.joints[parentId].worldPosition, index * 6);
    segmentPositions.set(frame.joints[jointId].worldPosition, index * 6 + 3);
  });
  visual.lines.geometry.dispose();
  visual.lines.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(segmentPositions, 3));
  const joints = Object.values(frame.joints);
  const jointPositions = new Float32Array(joints.length * 3);
  joints.forEach((joint, index) => jointPositions.set(joint.worldPosition, index * 3));
  visual.points.geometry.dispose();
  visual.points.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(jointPositions, 3));
}

function createMotionOverlays(scene) {
  const rootPath = line(scene, 0xff8d5a, false);
  const leftTrace = line(scene, 0x50c8ff, false);
  const rightTrace = line(scene, 0xf06f9f, false);
  const support = line(scene, 0x72ffa0, true);
  const com = marker(scene, 0x7effa2, 0.055);
  const target = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.012, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd439, transparent: true, opacity: 0.85 }),
  );
  target.position.y = 0.008;
  scene.add(target);
  const heelLeft = marker(scene, 0x50c8ff, 0.035);
  const heelRight = marker(scene, 0xf06f9f, 0.035);
  const toeLeft = marker(scene, 0xa2e6ff, 0.028);
  const toeRight = marker(scene, 0xffa9c7, 0.028);
  return { rootPath, leftTrace, rightTrace, support, com, target, heelLeft, heelRight, toeLeft, toeRight };
}

function rebuildStaticOverlays(execution, overlays) {
  const root = [[0, 0.018, 0]];
  const left = [];
  const right = [];
  for (const segment of execution.segments) {
    root.push([segment.plan.targetPosition[0], 0.018, segment.plan.targetPosition[2]]);
    for (const step of segment.plan.steps) {
      const target = [step.endPosition[0], 0.012, step.endPosition[2]];
      (step.side === 'left' ? left : right).push(target);
    }
  }
  updateLine(overlays.rootPath, root);
  updateLine(overlays.leftTrace, left);
  updateLine(overlays.rightTrace, right);
  const target = execution.segments.at(-1).plan.targetPosition;
  overlays.target.position.set(target[0], 0.008, target[2]);
}

function updateMotionOverlays(overlays, frame) {
  overlays.com.position.fromArray(frame.balanceState.centerOfMass);
  const polygon = [...frame.balanceState.supportPolygon, frame.balanceState.supportPolygon[0]].filter(Boolean);
  updateLine(overlays.support, polygon.map((point) => [point[0], 0.015, point[2]]));
  const left = frame.balanceState.contacts.find((contact) => contact.side === 'left');
  const right = frame.balanceState.contacts.find((contact) => contact.side === 'right');
  overlays.heelLeft.position.fromArray(left.heelPosition);
  overlays.heelRight.position.fromArray(right.heelPosition);
  overlays.toeLeft.position.fromArray(left.toePosition);
  overlays.toeRight.position.fromArray(right.toePosition);
}

function updatePanels(frame, execution, webgl2) {
  document.querySelector('#behavior-plan').innerHTML = frame.behaviorPlan.steps.map((step, index) => (
    `<li class="${index === frame.currentStep ? 'active' : step.status === 'completed' ? 'completed' : ''}">`
    + `<b>${escapeHTML(step.stepType)}</b><br><span>${escapeHTML(step.status)}</span></li>`
  )).join('');
  document.querySelector('#command-diagnostics').innerHTML = `generalNaturalLanguageSupport = false<br>developmentGrammarOnly = true<br>duration = ${execution.duration.toFixed(2)} s`;
  document.querySelector('#qa-status').innerHTML = `<div class="qa-pass">NUMERIC RUNTIME ACTIVE</div><div class="metric-grid">`
    + metric('WebGL2', webgl2 ? 'PASS' : 'FAIL')
    + metric('finalPose', frame.finalPose.type)
    + metric('Bone lengths', frame.jointMetrics.fixedBoneLengths ? 'FIXED' : 'FAIL')
    + metric('Joint limits', frame.jointMetrics.jointLimitViolationCount)
    + metric('Non-finite', frame.jointMetrics.nonFinitePoseValueCount)
    + metric('Visual QA', '<span class="qa-pending">PENDING USER</span>') + `</div>`;
  document.querySelector('#current-step').innerHTML = `<div class="metric-grid">`
    + metric('Step', frame.behaviorPlan.steps[frame.currentStep]?.stepType || 'complete')
    + metric('Phase', frame.motionPhase)
    + metric('Status', frame.completionStatus) + `</div>`;
  document.querySelector('#contact-status').innerHTML = `<div class="metric-grid">`
    + metric('Support', frame.contactState.supportState)
    + metric('Left foot', frame.contactState.leftFootState)
    + metric('Right foot', frame.contactState.rightFootState)
    + metric('COM inside', frame.balanceState.comInsideSupport)
    + metric('Falls', frame.balanceState.fallDetected) + `</div>`;
  document.querySelector('#root-status').innerHTML = `<div class="metric-grid">`
    + metric('Position', frame.finalPose.rootPosition.map((value) => value.toFixed(3)).join(', '))
    + metric('Speed m/s', frame.rootMetrics.rootSpeed.toFixed(3))
    + metric('Facing deg', (frame.rootMetrics.facing * 180 / Math.PI).toFixed(2))
    + metric('Progress', frame.rootMetrics.pathProgress.toFixed(3)) + `</div>`;
}

function publishState(frame, execution, view, renderedFrames) {
  const publicState = {
    ready: renderedFrames >= 3,
    scenario: frame.scenario,
    command: frame.command,
    behaviorPlan: frame.behaviorPlan,
    currentStep: frame.currentStep,
    finalPose: frame.finalPose,
    motionPhase: frame.motionPhase,
    contactState: frame.contactState,
    balanceState: frame.balanceState,
    rootMetrics: frame.rootMetrics,
    footSlipMetrics: frame.footSlipMetrics,
    jointMetrics: frame.jointMetrics,
    completionStatus: frame.completionStatus,
    consoleErrors: [...consoleErrors],
    pageErrors: [...pageErrors],
    geometryPresent: view.renderer.domElement.width > 0 && view.renderer.domElement.height > 0,
    webgl2: view.webgl2,
    rendererPixelRatio: view.renderer.getPixelRatio(),
    duration: execution.duration,
  };
  window.__HUMAN_CORE_V5_NATURAL_MOTION_V1__ = {
    ...publicState,
    getState: () => structuredClone(publicState),
  };
}

async function buildEvidenceView(viewName) {
  document.querySelector('#motion-app').classList.add('hidden');
  const root = document.querySelector('#evidence-view');
  root.classList.remove('hidden');
  const metrics = await fetch(METRICS_URL, { cache: 'no-store' }).then(readJson);
  if (viewName === 'contact-sheet') {
    const images = [
      ['turn-180-prepare.png', 'Turn · Prepare'], ['turn-180-first-step.png', 'Turn · First Step'],
      ['turn-180-mid.png', 'Turn · Mid'], ['turn-180-final-step.png', 'Turn · Final Step'],
      ['turn-180-settle.png', 'Turn · Settle'], ['walk-start.png', 'Walk · Start'],
      ['walk-left-support.png', 'Walk · Left Support'], ['walk-right-support.png', 'Walk · Right Support'],
      ['walk-final-step.png', 'Walk · Final Step'], ['walk-stop.png', 'Walk · Stop'],
      ['command-plan.png', 'Command · Plan'], ['command-complete.png', 'Command · Complete'],
    ];
    root.innerHTML = `<article class="evidence-sheet"><header><b>Task 17A · Natural Motion Evidence</b><span>VISUAL ACCEPTANCE PENDING USER</span></header>`
      + `<div class="evidence-grid">${images.map(([file, label]) => `<div class="evidence-card"><img src="${FRAME_BASE_URL}/${file}" alt="${label}"><div>${label}</div></div>`).join('')}</div>`
      + `<div class="evidence-summary"><div><b>Command A/B</b><br>${metrics.behaviorPlansEquivalent ? 'Equivalent plan PASS' : 'FAIL'}</div>`
      + `<div><b>Numeric scenes</b><br>${metrics.numericPassedScenarioCount}/${metrics.scenarioCount}</div>`
      + `<div><b>Contact</b><br>See foot-traces view</div><div><b>Conclusion</b><br>${metrics.finalConclusion}</div></div></article>`;
  } else {
    root.innerHTML = `<article class="chart-view"><header><h1>${escapeHTML(viewName)}</h1><p>Task 17A browser-rendered diagnostic chart</p></header><canvas id="evidence-canvas" width="1440" height="720"></canvas></article>`;
    drawEvidenceChart(document.querySelector('#evidence-canvas'), viewName, metrics);
  }
  window.__HUMAN_CORE_V5_NATURAL_MOTION_V1__ = {
    ready: true,
    scenario: viewName,
    command: null,
    behaviorPlan: null,
    currentStep: null,
    finalPose: null,
    motionPhase: 'evidence-view',
    contactState: null,
    balanceState: null,
    rootMetrics: null,
    footSlipMetrics: null,
    jointMetrics: null,
    completionStatus: 'ready',
    consoleErrors,
    pageErrors,
    geometryPresent: Boolean(root.children.length),
    webgl2: viewName === 'contact-sheet' ? null : true,
  };
}

function drawEvidenceChart(canvas, viewName, metrics) {
  const context = canvas.getContext('2d');
  context.fillStyle = '#061019'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#23445a'; context.lineWidth = 1;
  for (let x = 80; x < canvas.width - 40; x += 80) { context.beginPath(); context.moveTo(x, 60); context.lineTo(x, 660); context.stroke(); }
  for (let y = 60; y < 680; y += 60) { context.beginPath(); context.moveTo(60, y); context.lineTo(1380, y); context.stroke(); }
  context.fillStyle = '#dff4ff'; context.font = '22px Segoe UI'; context.fillText(`Task 17A · ${viewName}`, 60, 38);
  const scenarios = metrics.scenarios.filter((item) => item.scenarioId.includes('walk') || item.scenarioId.includes('instruction'));
  const colors = ['#50c8ff', '#f06f9f', '#7effa2', '#ffcf61', '#a88cff'];
  scenarios.slice(0, 5).forEach((item, index) => {
    const value = viewName === 'root-speed' ? item.settle.rootSpeedAfterSettle
      : viewName === 'com-support' ? (item.balance.fallDetected ? 1 : 0)
        : item.supportFootSlip.combined.maximum;
    const y = 130 + index * 100;
    context.fillStyle = colors[index]; context.fillRect(80, y, Math.max(2, value * 10000), 24);
    context.fillStyle = '#d7e8f2'; context.font = '17px Segoe UI';
    context.fillText(`${item.scenarioId} · ${value.toFixed(6)}`, 80, y - 10);
  });
  context.fillStyle = '#7f9caf'; context.font = '15px Segoe UI';
  context.fillText('Browser page chart; capture without post-processing.', 80, 690);
}

function line(scene, color, loop) {
  const object = loop
    ? new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .9 }))
    : new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .8 }));
  scene.add(object); return object;
}
function marker(scene, color, radius) { const object = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 12), new THREE.MeshBasicMaterial({ color })); scene.add(object); return object; }
function updateLine(object, points) { object.geometry.dispose(); object.geometry = new THREE.BufferGeometry().setFromPoints(points.map((point) => new THREE.Vector3(...point))); }
function followCharacter(camera, rootPosition) { camera.position.set(rootPosition[0] + 3.1, rootPosition[1] + 1.55, rootPosition[2] + 4.1); camera.lookAt(rootPosition[0], rootPosition[1] * .78, rootPosition[2]); }
function resizeView(view) { const width = Math.max(1, view.container.clientWidth); const height = Math.max(1, view.container.clientHeight); view.renderer.setSize(width, height, false); view.camera.aspect = width / height; view.camera.updateProjectionMatrix(); }
function metric(label, value) { return `<span>${escapeHTML(label)}</span><b>${typeof value === 'string' && value.startsWith('<') ? value : escapeHTML(value)}</b>`; }
function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
function formatError(value) { return value instanceof Error ? `${value.name}: ${value.message}` : String(value); }
function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, Number(value) || 0)); }
async function readJson(response) { if (!response.ok) throw new Error(`${response.url} returned ${response.status}.`); return response.json(); }
