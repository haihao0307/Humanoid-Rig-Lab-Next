import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const artifactRoot = join(root, 'artifacts', 'qa', 'human-core-v5-procedural-deform');
const WEBGPU_SHOTS = [
  ['reference-front.png', 'Reference', 'a-pose', 'Front'],
  ['reference-side.png', 'Reference', 'a-pose', 'Right'],
  ['t-pose-front.png', 'Reference', 't-pose', 'Front'],
  ['arm-raise-90-front.png', 'Reference', 'arm-raise-90-left', 'Front'],
  ['arm-raise-150-front.png', 'Reference', 'arm-raise-150-left', 'Front'],
  ['forearm-twist-closeup.png', 'Reference', 'forearm-twist-180-left', 'Perspective', 'leftLowerArm'],
  ['elbow-bend-closeup.png', 'Reference', 'elbow-bend-140-left', 'Perspective', 'leftLowerArm'],
  ['squat-front.png', 'Reference', 'squat', 'Front'],
  ['squat-side.png', 'Reference', 'squat', 'Right'],
  ['lunge-front.png', 'Reference', 'lunge-left', 'Front'],
  ['asymmetric-front.png', 'Asymmetric', 'a-pose', 'Front'],
];
const WEBGL2_SHOTS = [
  ['reference-front.png', 'Reference', 'a-pose', 'Front'],
  ['arm-raise-150-front.png', 'Reference', 'arm-raise-150-left', 'Front'],
  ['forearm-twist-closeup.png', 'Reference', 'forearm-twist-180-left', 'Perspective', 'leftLowerArm'],
  ['squat-front.png', 'Reference', 'squat', 'Front'],
];
const ALL_BUTTON_GROUPS = Object.freeze({
  preset: ['Reference', 'Lean', 'Muscular', 'Heavy', 'Tall', 'Short', 'Asymmetric'],
  pose: ['A Pose', 'T Pose', 'Arm Raise 90', 'Arm Raise 150', 'Forearm Twist 180', 'Elbow Bend 140', 'Hip Flex', 'Knee Bend', 'Squat', 'Lunge'],
  display: ['Procedural Surface', 'Skeleton', 'Surface + Skeleton', 'Wireframe', 'Region Ownership', 'Field Primitives'],
  camera: ['Front', 'Left', 'Right', 'Back', 'Perspective', 'Fit', 'Reset'],
});

export async function runProceduralDeformBrowserQA({ browserPath = null } = {}) {
  if (typeof WebSocket !== 'function') throw new Error('Browser QA requires a Node runtime with global WebSocket support (Node 22+ recommended).');
  const executable = browserPath ?? await findBrowserExecutable();
  if (!executable) throw new Error('No Google Chrome, Microsoft Edge, project Chromium, or Playwright Chromium executable was found.');
  await mkdir(artifactRoot, { recursive: true });
  const commit = await runGit(['rev-parse', 'HEAD']);
  const server = await startProjectServer();
  const report = {
    schema: 'humanoid_rig/procedural_deform_browser_qa_report@5.0',
    commit,
    browserExecutable: executable,
    startedAt: new Date().toISOString(),
    runs: [],
    screenshots: [],
    visualAcceptance: false,
    productionReady: false,
  };
  try {
    report.runs.push(await runBackend({
      executable, backend: 'webgpu', url: `${server.url}/human-core-v5-procedural-deform.html`,
      screenshots: WEBGPU_SHOTS, commit, report,
    }));
    report.runs.push(await runBackend({
      executable, backend: 'webgl2', url: `${server.url}/human-core-v5-procedural-deform.html?forceWebGL=1`,
      screenshots: WEBGL2_SHOTS, commit, report,
    }));
  } finally {
    server.stop();
  }
  report.completedAt = new Date().toISOString();
  report.status = report.runs.every((run) => run.passed) ? 'browser-contract-pass-user-visual-pending' : 'browser-qa-fail';
  const metrics = createMetrics(report);
  await writeFile(join(artifactRoot, 'metrics.json'), `${JSON.stringify(metrics, null, 2)}\n`);
  await writeFile(join(artifactRoot, 'browser-qa-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export async function verifyProceduralDeformQAArtifacts() {
  const required = [
    ...WEBGPU_SHOTS.map(([name]) => join(artifactRoot, 'webgpu', name)),
    ...WEBGL2_SHOTS.map(([name]) => join(artifactRoot, 'webgl2', name)),
    join(artifactRoot, 'metrics.json'),
    join(artifactRoot, 'browser-qa-report.json'),
  ];
  const missing = [];
  for (const file of required) {
    try {
      const info = await stat(file);
      if (!info.isFile() || info.size < (file.endsWith('.png') ? 1024 : 10)) missing.push(file);
    } catch { missing.push(file); }
  }
  if (missing.length) throw new Error(`Browser QA evidence is incomplete:\n${missing.join('\n')}`);
  const report = JSON.parse(await readFile(join(artifactRoot, 'browser-qa-report.json'), 'utf8'));
  if (!Array.isArray(report.runs) || report.runs.length !== 2) throw new Error('Browser QA report must contain WebGPU and WebGL2 runs.');
  const webgpu = report.runs.find((run) => run.requestedBackend === 'webgpu');
  const webgl2 = report.runs.find((run) => run.requestedBackend === 'webgl2');
  if (!webgpu?.passed || webgpu.activeBackend !== 'WebGPU') throw new Error('WebGPU evidence is not an independent pass.');
  if (!webgl2?.passed || webgl2.activeBackend !== 'WebGL2') throw new Error('Forced WebGL2 evidence is not an independent pass.');
  if (report.visualAcceptance !== false || report.productionReady !== false) throw new Error('Browser evidence must not promote release flags before user acceptance.');
  return { requiredArtifactCount: required.length, reportStatus: report.status };
}

async function runBackend({ executable, backend, url, screenshots, commit, report }) {
  const port = backend === 'webgpu' ? 9431 : 9432;
  const profile = await mkdtemp(join(tmpdir(), `hrl-${backend}-`));
  const args = [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--window-size=1600,1200', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', 'about:blank',
  ];
  const browser = spawn(executable, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let browserStderr = '';
  browser.stderr.on('data', (chunk) => { browserStderr += String(chunk); });
  const run = {
    requestedBackend: backend,
    url,
    activeBackend: null,
    httpStatus: null,
    consoleErrors: [],
    pageErrors: [],
    glbRequests: [],
    buttonChecks: [],
    screenshotCount: 0,
    passed: false,
  };
  let cdp = null;
  try {
    run.httpStatus = (await fetch(url)).status;
    const target = await waitForPageTarget(port, url);
    cdp = await CDPClient.connect(target.webSocketDebuggerUrl);
    await Promise.all([cdp.send('Page.enable'), cdp.send('Runtime.enable'), cdp.send('Network.enable'), cdp.send('Log.enable')]);
    cdp.on('Runtime.exceptionThrown', (event) => run.pageErrors.push(event.exceptionDetails?.text ?? 'Runtime exception'));
    cdp.on('Log.entryAdded', (event) => { if (event.entry?.level === 'error') run.consoleErrors.push(event.entry.text); });
    cdp.on('Network.requestWillBeSent', (event) => { if (/\.glb(?:$|[?#])/i.test(event.request?.url ?? '')) run.glbRequests.push(event.request.url); });
    await cdp.send('Page.navigate', { url });
    await waitForRuntimeReady(cdp);
    const initial = await getPageState(cdp);
    run.activeBackend = initial.current.renderer.activeBackend;
    run.initial = compactState(initial.current);
    run.initialContract = evaluatePageContract(initial.current, run, backend);
    for (const [kind, names] of Object.entries(ALL_BUTTON_GROUPS)) {
      let prior = await getPageState(cdp);
      for (const name of names) {
        await clickQAButton(cdp, kind, name);
        const current = await getPageState(cdp);
        const check = validateButtonTransition(kind, name, prior.current, current.current);
        run.buttonChecks.push(check);
        prior = current;
      }
    }
    for (const [fileName, preset, poseId, camera, focusJoint] of screenshots) {
      await configureView(cdp, { preset, poseId, camera, displayMode: 'Procedural Surface' });
      if (focusJoint) await evaluate(cdp, `window.__HRL_PROCEDURAL_DEFORM_QA__.focusJoint('${escapeJS(focusJoint)}')`);
      const state = await getPageState(cdp);
      const canvasRect = await evaluate(cdp, `(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()`);
      const png = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, clip: canvasRect });
      const destination = join(artifactRoot, backend, fileName);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, Buffer.from(png.data, 'base64'));
      const evidence = {
        file: destination.slice(root.length + 1).replaceAll('\\', '/'), commit, backend,
        preset, poseId, camera: state.current.active.camera, displayMode: 'Procedural Surface', timestamp: new Date().toISOString(),
        vertexCount: state.current.geometry.vertexCount,
        triangleCount: state.current.geometry.triangleCount,
        topologyFingerprint: state.current.geometry.topologyFingerprint,
        consoleErrors: [...run.consoleErrors],
        measuredAngles: state.current.pose.measuredAngles,
        rigSurfaceErrors: state.current.rigSurfaceAudit,
        checklistResult: evaluatePageContract(state.current, run, backend),
      };
      report.screenshots.push(evidence);
      run.screenshotCount += 1;
    }
    run.final = compactState((await getPageState(cdp)).current);
    run.passed = run.httpStatus === 200
      && run.initialContract.passed
      && run.buttonChecks.every((check) => check.passed)
      && run.consoleErrors.length === 0
      && run.pageErrors.length === 0
      && run.glbRequests.length === 0
      && run.screenshotCount === screenshots.length;
  } catch (error) {
    run.failure = formatError(error);
  } finally {
    cdp?.close();
    browser.kill();
    await onceExit(browser, 2500);
    await rm(profile, { recursive: true, force: true });
  }
  run.browserStderrTail = browserStderr.slice(-2000);
  return run;
}

function evaluatePageContract(current, run, backend) {
  const expectedBackend = backend === 'webgpu' ? 'WebGPU' : 'WebGL2';
  const checks = {
    http200: run.httpStatus === 200,
    rendererExact: current.renderer.activeBackend === expectedBackend,
    geometryPresent: current.geometry.vertexCount > 0 && current.geometry.triangleCount > 0,
    oneSurface: current.geometry.surfaceLayerCount === 1,
    connected: current.geometry.connectedComponentCount === 1,
    closed: current.geometry.boundaryEdgeCount === 0,
    degenerateTriangles: current.geometry.degenerateTriangleRatio < 0.001,
    finite: current.geometry.finite.passed,
    normals: current.geometry.normals.passed,
    localQuaternionAuthority: current.pose.authority === 'finalPose.localRotations',
    worker: current.performance.generatedByWorker === true,
    rigSurface: current.rigSurfaceAudit.passed === true,
    noGLB: current.resources.glbRequestCount === 0 && run.glbRequests.length === 0,
    noErrors: current.errors.length === 0 && run.consoleErrors.length === 0 && run.pageErrors.length === 0,
    flagsRemainFalse: current.visualAcceptance === false && current.productionReady === false,
  };
  return { checks, passed: Object.values(checks).every(Boolean) };
}

function validateButtonTransition(kind, name, before, after) {
  const active = after.active;
  let activeChanged = true;
  if (kind === 'preset') activeChanged = active.preset === name;
  if (kind === 'pose') activeChanged = active.poseLabel === name;
  if (kind === 'display') activeChanged = active.displayMode === name;
  if (kind === 'camera') activeChanged = active.camera === name;
  const cacheRule = kind === 'preset'
    ? after.geometry.surfaceCacheKey !== before.geometry.surfaceCacheKey || name === before.active.preset
    : after.geometry.topologyFingerprint === before.geometry.topologyFingerprint;
  const passed = activeChanged && cacheRule && after.geometry.vertexCount > 0 && after.errors.length === 0;
  return { kind, name, activeChanged, cacheRule, passed };
}

async function configureView(cdp, { preset, poseId, camera, displayMode }) {
  const poseLabel = ALL_BUTTON_GROUPS.pose.find((label) => labelToPoseId(label) === poseId);
  await clickQAButton(cdp, 'preset', preset);
  await clickQAButton(cdp, 'pose', poseLabel);
  await clickQAButton(cdp, 'camera', camera);
  await clickQAButton(cdp, 'display', displayMode);
}

function labelToPoseId(label) {
  return ({
    'A Pose': 'a-pose', 'T Pose': 't-pose', 'Arm Raise 90': 'arm-raise-90-left', 'Arm Raise 150': 'arm-raise-150-left',
    'Forearm Twist 180': 'forearm-twist-180-left', 'Elbow Bend 140': 'elbow-bend-140-left', 'Hip Flex': 'hip-flex-left',
    'Knee Bend': 'knee-bend-left', Squat: 'squat', Lunge: 'lunge-left',
  })[label];
}

async function clickQAButton(cdp, kind, name) {
  const active = await evaluate(cdp, `(async()=>{const b=[...document.querySelectorAll('[data-qa-button="${escapeJS(kind)}"]')].find(x=>x.dataset.qaName==='${escapeJS(name)}');if(!b)throw new Error('Missing button ${escapeJS(kind)}:${escapeJS(name)}');b.click();await window.__HRL_PROCEDURAL_DEFORM_QA__.waitForIdle();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return b.classList.contains('active')})()`);
  if (!active) throw new Error(`Button ${kind}:${name} did not acquire its active state.`);
}

async function waitForRuntimeReady(cdp) {
  await poll(async () => evaluate(cdp, `document.body.dataset.qaReady==='true'&&document.querySelector('#loading')?.classList.contains('hidden')&&Boolean(window.__HRL_PROCEDURAL_DEFORM_QA__)`), 90000, 'QA page initialization');
  const canvas = await evaluate(cdp, `({width:document.querySelector('canvas')?.width??0,height:document.querySelector('canvas')?.height??0})`);
  if (!(canvas.width > 0 && canvas.height > 0)) throw new Error(`Canvas has invalid dimensions ${JSON.stringify(canvas)}.`);
}
async function getPageState(cdp) { return evaluate(cdp, `window.__HRL_PROCEDURAL_DEFORM_QA__.getState()`); }
async function evaluate(cdp, expression) {
  const response = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text ?? 'Runtime.evaluate failed.');
  return response.result.value;
}

class CDPClient {
  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolveConnection, reject) => {
      socket.addEventListener('open', resolveConnection, { once: true });
      socket.addEventListener('error', () => reject(new Error(`Cannot connect to CDP ${url}.`)), { once: true });
    });
    return new CDPClient(socket);
  }
  constructor(socket) {
    this.socket = socket; this.nextId = 1; this.pending = new Map(); this.listeners = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) pending?.reject(new Error(`${message.error.message} (${message.error.code})`));
        else pending?.resolve(message.result ?? {});
      } else for (const handler of this.listeners.get(message.method) ?? []) handler(message.params ?? {});
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolveCall, reject) => {
      this.pending.set(id, { resolve: resolveCall, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, handler) { const handlers = this.listeners.get(method) ?? []; handlers.push(handler); this.listeners.set(method, handlers); }
  close() { this.socket.close(); }
}

async function startProjectServer() {
  const executable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(executable, ['start'], { cwd: root, env: { ...process.env, NO_OPEN: '1', PORT: '4173' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let output = '';
  child.stdout.on('data', (chunk) => { output += String(chunk); });
  child.stderr.on('data', (chunk) => { output += String(chunk); });
  const url = await poll(async () => {
    const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
    if (!match) return null;
    try { return (await fetch(match[0])).ok ? match[0] : null; } catch { return null; }
  }, 30000, 'npm start');
  return { child, url, stop: () => child.kill() };
}

async function waitForPageTarget(port, url) {
  return poll(async () => {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      return targets.find((target) => target.type === 'page' && target.url.startsWith(url.split('?')[0])) ?? targets.find((target) => target.type === 'page');
    } catch { return null; }
  }, 30000, `browser CDP target on port ${port}`);
}

async function findBrowserExecutable() {
  const candidates = process.platform === 'win32' ? [
    join(process.env.PROGRAMFILES ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(process.env['PROGRAMFILES(X86)'] ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(process.env.LOCALAPPDATA ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(process.env.PROGRAMFILES ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    join(process.env['PROGRAMFILES(X86)'] ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ] : ['/usr/bin/google-chrome', '/usr/bin/microsoft-edge', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  for (const candidate of candidates) if (candidate && existsSync(candidate)) return candidate;
  const playwrightRoots = [process.env.PLAYWRIGHT_BROWSERS_PATH, join(process.env.LOCALAPPDATA ?? '', 'ms-playwright'), join(root, 'node_modules', '.cache', 'ms-playwright')].filter(Boolean);
  for (const directory of playwrightRoots) {
    const found = await findRecursively(directory, new Set(['chrome.exe', 'headless_shell.exe', 'chrome', 'headless_shell']), 4);
    if (found) return found;
  }
  return null;
}

async function findRecursively(directory, names, depth) {
  if (depth < 0 || !existsSync(directory)) return null;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isFile() && names.has(entry.name)) return path;
    if (entry.isDirectory()) { const found = await findRecursively(path, names, depth - 1); if (found) return found; }
  }
  return null;
}

async function poll(action, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await action();
    if (value) return value;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`Timed out waiting for ${label}.`);
}
async function onceExit(child, timeoutMs) { if (child.exitCode !== null) return; await Promise.race([new Promise((resolveExit) => child.once('exit', resolveExit)), new Promise((resolveDelay) => setTimeout(resolveDelay, timeoutMs))]); }
async function runGit(args) { const child = spawn('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }); let output = ''; child.stdout.on('data', (chunk) => { output += chunk; }); const code = await new Promise((resolveExit) => child.once('exit', resolveExit)); if (code !== 0) throw new Error(`git ${args.join(' ')} failed.`); return output.trim(); }
function compactState(state) { return { active: state.active, renderer: state.renderer, geometry: state.geometry, performance: state.performance, resources: state.resources, rigSurfaceAudit: state.rigSurfaceAudit, pose: state.pose, errors: state.errors }; }
function createMetrics(report) { return { schema: 'humanoid_rig/procedural_deform_browser_metrics@5.0', commit: report.commit, generatedAt: new Date().toISOString(), runs: report.runs.map((run) => ({ requestedBackend: run.requestedBackend, activeBackend: run.activeBackend, passed: run.passed, httpStatus: run.httpStatus, consoleErrorCount: run.consoleErrors.length, pageErrorCount: run.pageErrors.length, glbRequestCount: run.glbRequests.length, screenshotCount: run.screenshotCount, initial: run.initial })) }; }
function escapeJS(value) { return String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'"); }
function formatError(error) { return error instanceof Error ? `${error.name}: ${error.message}` : String(error); }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes('--verify-artifacts')) console.log(JSON.stringify(await verifyProceduralDeformQAArtifacts()));
    else {
      const report = await runProceduralDeformBrowserQA({ browserPath: process.env.HRL_BROWSER_PATH || null });
      console.log(JSON.stringify({ status: report.status, artifactRoot, runs: report.runs.map((run) => ({ backend: run.requestedBackend, activeBackend: run.activeBackend, passed: run.passed })) }, null, 2));
      if (!report.runs.every((run) => run.passed)) process.exitCode = 1;
    }
  } catch (error) {
    console.error(formatError(error));
    process.exitCode = 1;
  }
}
