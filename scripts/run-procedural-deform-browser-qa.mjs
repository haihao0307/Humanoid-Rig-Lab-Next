import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { buildProceduralDeformQAGallery } from './build-procedural-deform-qa-gallery.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const defaultArtifactRoot = join(root, 'artifacts', 'qa', 'human-core-v5-procedural-deform');
const defaultLogRoot = join(root, 'artifacts', 'logs', 'procedural-deform-browser-qa');
const MINIMUM_NODE_MAJOR = 22;

const WEBGPU_SHOTS = Object.freeze([
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
]);
const WEBGL2_SHOTS = Object.freeze([
  ['reference-front.png', 'Reference', 'a-pose', 'Front'],
  ['reference-back.png', 'Reference', 'a-pose', 'Back'],
  ['t-pose-front.png', 'Reference', 't-pose', 'Front'],
  ['arm-raise-90-front.png', 'Reference', 'arm-raise-90-left', 'Front'],
  ['arm-raise-150-front.png', 'Reference', 'arm-raise-150-left', 'Front'],
  ['forearm-twist-closeup.png', 'Reference', 'forearm-twist-180-left', 'Perspective', 'leftLowerArm'],
  ['elbow-bend-closeup.png', 'Reference', 'elbow-bend-140-left', 'Perspective', 'leftLowerArm'],
  ['hip-flex-side.png', 'Reference', 'hip-flex-left', 'Right'],
  ['knee-bend-side.png', 'Reference', 'knee-bend-left', 'Right'],
  ['squat-front.png', 'Reference', 'squat', 'Front'],
  ['squat-side.png', 'Reference', 'squat', 'Right'],
  ['lunge-front.png', 'Reference', 'lunge-left', 'Front'],
  ['lean-front.png', 'Lean', 'a-pose', 'Front'],
  ['muscular-front.png', 'Muscular', 'a-pose', 'Front'],
  ['heavy-front.png', 'Heavy', 'a-pose', 'Front'],
  ['tall-front.png', 'Tall', 'a-pose', 'Front'],
  ['short-front.png', 'Short', 'a-pose', 'Front'],
  ['asymmetric-front.png', 'Asymmetric', 'a-pose', 'Front'],
]);
const SHOTS_BY_BACKEND = Object.freeze({ webgpu: WEBGPU_SHOTS, webgl2: WEBGL2_SHOTS });
const ALL_BUTTON_GROUPS = Object.freeze({
  preset: ['Reference', 'Lean', 'Muscular', 'Heavy', 'Tall', 'Short', 'Asymmetric'],
  pose: ['A Pose', 'T Pose', 'Arm Raise 90', 'Arm Raise 150', 'Forearm Twist 180', 'Elbow Bend 140', 'Hip Flex', 'Knee Bend', 'Squat', 'Lunge'],
  display: ['Procedural Surface', 'Skeleton', 'Surface + Skeleton', 'Wireframe', 'Region Ownership', 'Field Primitives'],
  camera: ['Front', 'Left', 'Right', 'Back', 'Perspective', 'Fit', 'Reset'],
});

export function assertBrowserQANodeVersion(version = process.versions.node) {
  const major = Number(String(version).split('.')[0]);
  if (!Number.isInteger(major) || major < MINIMUM_NODE_MAJOR) {
    throw new Error([
      `Human Core V5 browser QA requires Node ${MINIMUM_NODE_MAJOR} or newer.`,
      `Current Node version: ${version}.`,
      'Upgrade example on Windows: winget install OpenJS.NodeJS.LTS',
      'The QA runner stopped before launching a browser.',
    ].join('\n'));
  }
  return { current: version, requiredMajor: MINIMUM_NODE_MAJOR };
}

export function parseBrowserQAArguments(argv = process.argv.slice(2)) {
  const options = {
    backends: ['webgpu', 'webgl2'],
    headless: process.platform !== 'win32',
    browserChannel: null,
    browserPath: null,
    artifactRoot: defaultArtifactRoot,
    logRoot: defaultLogRoot,
    continueOnWebGPUFailure: false,
    verifyArtifacts: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--backend') options.backends = [requiredValue(argv, ++index, argument)];
    else if (argument === '--all-backends') options.backends = ['webgpu', 'webgl2'];
    else if (argument === '--headed') options.headless = false;
    else if (argument === '--headless') options.headless = true;
    else if (argument === '--browser-channel') options.browserChannel = requiredValue(argv, ++index, argument);
    else if (argument === '--browser-path') options.browserPath = resolve(requiredValue(argv, ++index, argument));
    else if (argument === '--output') options.artifactRoot = resolve(requiredValue(argv, ++index, argument));
    else if (argument === '--verify-artifacts') options.verifyArtifacts = true;
    else if (argument === '--continue-on-webgpu-failure') options.continueOnWebGPUFailure = true;
    else throw new Error(`Unknown browser QA argument: ${argument}`);
  }
  for (const backend of options.backends) if (!['webgpu', 'webgl2'].includes(backend)) throw new Error(`Unsupported backend ${backend}.`);
  if (options.browserChannel && !['chrome', 'msedge', 'chromium'].includes(options.browserChannel)) throw new Error(`Unsupported browser channel ${options.browserChannel}.`);
  return options;
}

export async function runProceduralDeformBrowserQA(options = {}) {
  const node = assertBrowserQANodeVersion();
  const settings = { ...parseBrowserQAArguments([]), ...options };
  settings.backends = [...new Set(settings.backends ?? ['webgpu', 'webgl2'])];
  const browserTarget = await resolveBrowserTarget(settings);
  await Promise.all([mkdir(settings.artifactRoot, { recursive: true }), mkdir(settings.logRoot, { recursive: true })]);
  const commit = await runGit(['rev-parse', 'HEAD']);
  const report = await loadOrCreateReport(settings.artifactRoot, commit, node);
  const server = await startProjectServer(settings.logRoot);
  try {
    for (const backend of settings.backends) {
      report.runs = report.runs.filter((run) => run.requestedBackend !== backend);
      report.screenshots = report.screenshots.filter((entry) => entry.backend !== backend);
      const run = await runBackend({
        backend,
        url: `${server.url}/human-core-v5-procedural-deform.html${backend === 'webgl2' ? '?forceWebGL=1' : ''}`,
        screenshots: SHOTS_BY_BACKEND[backend],
        commit,
        report,
        artifactRoot: settings.artifactRoot,
        browserTarget,
        headless: settings.headless,
      });
      report.runs.push(run);
    }
  } finally {
    await server.stop();
  }
  const failedWebGL2 = report.runs.some((run) => run.requestedBackend === 'webgl2' && !run.passed);
  const failedWebGPU = report.runs.some((run) => run.requestedBackend === 'webgpu' && !run.passed);
  report.commandPassed = !failedWebGL2 && (!failedWebGPU || settings.continueOnWebGPUFailure);
  await finalizeEvidence({ report, artifactRoot: settings.artifactRoot, logRoot: settings.logRoot });
  return report;
}

export async function verifyProceduralDeformQAArtifacts({ artifactRoot = defaultArtifactRoot } = {}) {
  assertBrowserQANodeVersion();
  const evidenceRoot = resolve(artifactRoot);
  const reportPath = join(evidenceRoot, 'browser-qa-report.json');
  const manifestPath = join(evidenceRoot, 'qa-manifest.json');
  const [report, manifest, currentCommit] = await Promise.all([
    readJSON(reportPath), readJSON(manifestPath), runGit(['rev-parse', 'HEAD']),
  ]);
  if (report.commit !== currentCommit || manifest.commit !== currentCommit) throw new Error(`QA evidence commit mismatch. HEAD=${currentCommit}, report=${report.commit}, manifest=${manifest.commit}.`);
  for (const required of ['metrics.json', 'browser-qa-report.json', 'renderer-diagnostics.json', 'visual-review-gallery.html']) {
    if (!manifest.files.some((entry) => entry.path === required)) throw new Error(`qa-manifest.json is missing ${required}.`);
  }
  for (const entry of manifest.files) {
    const path = resolve(evidenceRoot, entry.path);
    if (!path.startsWith(`${evidenceRoot}${sep}`)) throw new Error(`Manifest path escapes artifact root: ${entry.path}`);
    const info = await stat(path);
    if (!info.isFile() || info.size !== entry.size) throw new Error(`Artifact size mismatch for ${entry.path}.`);
    if (await sha256(path) !== entry.sha256) throw new Error(`Artifact SHA256 mismatch for ${entry.path}.`);
  }
  const webgl2 = report.runs.find((run) => run.requestedBackend === 'webgl2');
  if (!webgl2?.passed || webgl2.activeBackend !== 'WebGL2') throw new Error('Forced WebGL2 browser contract has not passed.');
  assertScreenshotSet(report, 'webgl2', WEBGL2_SHOTS, true);
  const webgpu = report.runs.find((run) => run.requestedBackend === 'webgpu');
  if (webgpu?.passed) assertScreenshotSet(report, 'webgpu', WEBGPU_SHOTS, true);
  else if (webgpu && !String(webgpu.classification).startsWith('webgpu-ci-')) throw new Error('WebGPU attempt is missing a CI classification.');
  for (const evidence of report.screenshots) {
    if (evidence.commit !== currentCommit) throw new Error(`Screenshot ${evidence.artifactPath} belongs to ${evidence.commit}.`);
    if (!String(evidence.artifactPath).startsWith(`${evidence.backend}/`)) throw new Error(`Screenshot backend/path mismatch for ${evidence.artifactPath}.`);
    const expected = SHOTS_BY_BACKEND[evidence.backend]?.find(([fileName]) => fileName === evidence.artifactPath.split('/').at(-1));
    if (!expected || expected[2] !== evidence.poseId) throw new Error(`Screenshot pose/file mismatch for ${evidence.artifactPath}.`);
  }
  if (report.visualAcceptance !== false || report.productionReady !== false) throw new Error('Browser evidence cannot promote release flags before user acceptance.');
  const runSummaries = Object.fromEntries(report.runs.map((run) => [run.requestedBackend, verifiedRunSummary(run)]));
  return {
    commit: currentCommit,
    manifestFileCount: manifest.files.length,
    screenshotCount: report.screenshots.length,
    webgl2: webgl2.classification,
    webgpu: webgpu?.classification ?? 'not-run',
    runs: runSummaries,
    totals: {
      consoleErrors: report.runs.reduce((total, run) => total + run.consoleErrors.length, 0),
      pageErrors: report.runs.reduce((total, run) => total + run.pageErrors.length, 0),
      glbRequests: report.runs.reduce((total, run) => total + run.glbRequests.length, 0),
      screenshots: report.screenshots.length,
    },
    sha256: 'pass',
  };
}

function verifiedRunSummary(run) {
  return {
    classification: run.classification,
    passed: run.passed,
    activeBackend: run.activeBackend,
    consoleErrors: run.consoleErrors.length,
    pageErrors: run.pageErrors.length,
    glbRequests: run.glbRequests.length,
    screenshots: run.screenshotCount,
  };
}

async function runBackend({ backend, url, screenshots, commit, report, artifactRoot, browserTarget, headless }) {
  const run = createRunRecord({ backend, url, browserTarget, headless });
  let browserServer;
  let browser;
  let context;
  try {
    recordProgress(run, 'browser-launch-start');
    browserServer = await chromium.launchServer({
      executablePath: browserTarget.executablePath,
      headless,
      args: launchArguments(backend),
    });
    browser = await chromium.connect(browserServer.wsEndpoint());
    run.browserVersion = browser.version();
    recordProgress(run, 'browser-launch-complete');
    context = await browser.newContext({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 });
    await context.addInitScript(() => {
      globalThis.__HRL_BROWSER_QA_EVENTS__ = { unhandledRejections: [], windowErrors: [], contextLosses: [] };
      addEventListener('unhandledrejection', (event) => globalThis.__HRL_BROWSER_QA_EVENTS__.unhandledRejections.push(String(event.reason?.stack ?? event.reason ?? 'unhandled rejection')));
      addEventListener('error', (event) => globalThis.__HRL_BROWSER_QA_EVENTS__.windowErrors.push(String(event.error?.stack ?? event.message ?? 'window error')));
    });
    const page = await context.newPage();
    attachPageObservers(page, run);
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    run.httpStatus = response?.status() ?? null;
    await waitForRuntimeReady(page);
    recordProgress(run, 'runtime-ready');
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      canvas?.addEventListener('webglcontextlost', (event) => {
        globalThis.__HRL_BROWSER_QA_EVENTS__.contextLosses.push({ type: 'webglcontextlost', statusMessage: event.statusMessage ?? '', timestamp: new Date().toISOString() });
      });
    });
    const initial = await getPageState(page);
    run.activeBackend = initial.current.renderer.activeBackend;
    run.initial = compactState(initial.current);
    run.rendererDiagnostics = collectRendererDiagnostics(initial.current, run);
    run.initialContract = evaluatePageContract(initial.current, run, backend);
    for (const [kind, names] of Object.entries(ALL_BUTTON_GROUPS)) {
      let prior = await getPageState(page);
      for (const name of names) {
        await clickQAButton(page, kind, name);
        const current = await getPageState(page);
        run.buttonChecks.push(validateButtonTransition(kind, name, prior.current, current.current));
        prior = current;
      }
      recordProgress(run, `button-group-complete:${kind}`);
    }
    if (run.activeBackend === expectedBackend(backend)) {
      for (const [fileName, preset, poseId, camera, focusJoint] of screenshots) {
        await configureView(page, { preset, poseId, camera, displayMode: 'Procedural Surface' });
        if (focusJoint) await page.evaluate((jointId) => window.__HRL_PROCEDURAL_DEFORM_QA__.focusJoint(jointId), focusJoint);
        const state = await getPageState(page);
        const destination = join(artifactRoot, backend, fileName);
        await mkdir(join(artifactRoot, backend), { recursive: true });
        await page.locator('canvas').screenshot({ path: destination, type: 'png' });
        report.screenshots.push(createScreenshotEvidence({
          fileName, backend, commit, preset, poseId, state: state.current, run, artifactRoot,
        }));
        run.screenshotCount += 1;
        recordProgress(run, `screenshot:${run.screenshotCount}/${screenshots.length}:${fileName}`);
      }
    }
    run.final = compactState((await getPageState(page)).current);
    const browserEvents = await page.evaluate(() => structuredClone(globalThis.__HRL_BROWSER_QA_EVENTS__));
    run.unhandledRejections.push(...browserEvents.unhandledRejections);
    run.windowErrors.push(...browserEvents.windowErrors);
    run.contextLosses.push(...browserEvents.contextLosses);
    run.deviceLost = run.final.renderer.webgpu?.deviceLost ?? null;
    run.passed = run.httpStatus === 200
      && run.initialContract.passed
      && run.buttonChecks.every((check) => check.passed)
      && totalErrorCount(run) === 0
      && run.glbRequests.length === 0
      && run.screenshotCount === screenshots.length;
    run.classification = classifyRun(run);
    if (!run.passed) run.failure = explainRunFailure(run);
    recordProgress(run, 'browser-contract-complete');
  } catch (error) {
    run.failure = formatError(error);
    run.classification = classifyRun(run);
  } finally {
    await closeBrowserResources({ run, context, browser, browserServer });
  }
  run.completedAt = new Date().toISOString();
  return run;
}

function createRunRecord({ backend, url, browserTarget, headless }) {
  return {
    requestedBackend: backend,
    url,
    startedAt: new Date().toISOString(),
    browserName: browserTarget.browserName,
    browserVersion: 'unavailable',
    browserChannel: browserTarget.channel,
    browserExecutable: browserTarget.executablePath,
    headless,
    activeBackend: null,
    fallbackReason: null,
    httpStatus: null,
    consoleErrors: [],
    consoleWarnings: [],
    pageErrors: [],
    windowErrors: [],
    unhandledRejections: [],
    requestFailures: [],
    httpFailures: [],
    workerEvents: [],
    workerErrors: [],
    contextLosses: [],
    deviceLost: null,
    glbRequests: [],
    buttonChecks: [],
    screenshotCount: 0,
    progress: [],
    teardownWarnings: [],
    passed: false,
    classification: backend === 'webgpu' ? 'webgpu-ci-fail' : 'webgl2-ci-fail',
  };
}

function attachPageObservers(page, run) {
  page.on('console', (message) => {
    const entry = { text: message.text(), location: message.location(), timestamp: new Date().toISOString() };
    if (message.type() === 'error') {
      run.consoleErrors.push(entry);
      if (/worker/i.test(entry.location?.url ?? '') || /worker/i.test(entry.text)) run.workerErrors.push(entry);
    } else if (message.type() === 'warning') run.consoleWarnings.push(entry);
  });
  page.on('pageerror', (error) => run.pageErrors.push({ message: formatError(error), timestamp: new Date().toISOString() }));
  page.on('requestfailed', (request) => run.requestFailures.push({ url: request.url(), method: request.method(), failure: request.failure(), timestamp: new Date().toISOString() }));
  page.on('response', (response) => {
    const url = response.url();
    if (/\.glb(?:$|[?#])/i.test(url)) run.glbRequests.push(url);
    if (response.status() >= 400) run.httpFailures.push({ url, status: response.status(), statusText: response.statusText(), timestamp: new Date().toISOString() });
  });
  page.on('worker', (worker) => run.workerEvents.push({ url: worker.url(), event: 'created', timestamp: new Date().toISOString() }));
}

async function waitForRuntimeReady(page) {
  await page.waitForFunction(() => document.body.dataset.qaReady === 'true'
    && document.querySelector('#loading')?.classList.contains('hidden')
    && Boolean(window.__HRL_PROCEDURAL_DEFORM_QA__), null, { timeout: 90_000 });
  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas || !(canvas.width > 0 && canvas.height > 0)) throw new Error(`Canvas has invalid dimensions ${JSON.stringify(canvas)}.`);
}

async function clickQAButton(page, kind, name) {
  const clicked = await page.locator(`[data-qa-button="${kind}"]`).evaluateAll((buttons, expectedName) => {
    const button = buttons.find((item) => item.dataset.qaName === expectedName);
    if (!button) return false;
    button.click();
    return true;
  }, name);
  if (!clicked) throw new Error(`Missing QA button ${kind}:${name}.`);
  await withTimeout(
    page.evaluate(() => window.__HRL_PROCEDURAL_DEFORM_QA__.waitForIdle()),
    30_000,
    `QA button ${kind}:${name} idle state`,
  );
  await page.waitForFunction(({ buttonKind, buttonName }) => [...document.querySelectorAll(`[data-qa-button="${buttonKind}"]`)]
    .some((item) => item.dataset.qaName === buttonName && item.classList.contains('active')), { buttonKind: kind, buttonName: name });
  await withTimeout(
    page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)))),
    10_000,
    `QA button ${kind}:${name} render frames`,
  );
}

async function configureView(page, { preset, poseId, camera, displayMode }) {
  const poseLabel = ALL_BUTTON_GROUPS.pose.find((label) => labelToPoseId(label) === poseId);
  await clickQAButton(page, 'preset', preset);
  await clickQAButton(page, 'pose', poseLabel);
  await clickQAButton(page, 'camera', camera);
  await clickQAButton(page, 'display', displayMode);
}

async function getPageState(page) {
  return page.evaluate(() => window.__HRL_PROCEDURAL_DEFORM_QA__.getState());
}

function createScreenshotEvidence({ fileName, backend, commit, preset, poseId, state, run, artifactRoot }) {
  return {
    file: relative(root, join(resolve(artifactRoot), backend, fileName)).replaceAll('\\', '/'),
    artifactPath: `${backend}/${fileName}`,
    commit,
    backend,
    browserName: run.browserName,
    browserVersion: run.browserVersion,
    browserChannel: run.browserChannel,
    preset,
    poseId,
    camera: state.active.camera,
    displayMode: 'Procedural Surface',
    timestamp: new Date().toISOString(),
    vertexCount: state.geometry.vertexCount,
    triangleCount: state.geometry.triangleCount,
    topologyFingerprint: state.geometry.topologyFingerprint,
    consoleErrors: [...run.consoleErrors],
    glbRequests: [...run.glbRequests],
    measuredAngles: state.pose.measuredAngles,
    rigSurfaceErrors: state.rigSurfaceAudit,
    checklistResult: evaluatePageContract(state, run, backend),
  };
}

function evaluatePageContract(current, run, backend) {
  const checks = {
    http200: run.httpStatus === 200,
    rendererExact: current.renderer.activeBackend === expectedBackend(backend),
    webgl2Forced: backend !== 'webgl2' || (current.renderer.forceWebGL === true && current.renderer.webgpu.status === 'skipped-force-webgl2'),
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
    noErrors: current.errors.length === 0 && totalErrorCount(run) === 0,
    flagsRemainFalse: current.visualAcceptance === false && current.productionReady === false,
  };
  return { checks, passed: Object.values(checks).every(Boolean) };
}

function validateButtonTransition(kind, name, before, after) {
  let activeChanged = true;
  if (kind === 'preset') activeChanged = after.active.preset === name;
  if (kind === 'pose') activeChanged = after.active.poseLabel === name;
  if (kind === 'display') activeChanged = after.active.displayMode === name;
  if (kind === 'camera') activeChanged = after.active.camera === name;
  const cacheRule = kind === 'preset'
    ? after.geometry.surfaceCacheKey !== before.geometry.surfaceCacheKey || name === before.active.preset
    : after.geometry.topologyFingerprint === before.geometry.topologyFingerprint;
  return {
    kind,
    name,
    activeChanged,
    cacheRule,
    canvasRenderable: after.geometry.vertexCount > 0,
    passed: activeChanged && cacheRule && after.geometry.vertexCount > 0 && after.errors.length === 0,
  };
}

function collectRendererDiagnostics(current, run) {
  const webgpu = current.renderer.webgpu ?? {};
  run.fallbackReason = current.renderer.fallbackUsed ? (webgpu.error ?? 'unavailable') : null;
  return {
    browserName: run.browserName,
    browserVersion: run.browserVersion,
    browserChannel: run.browserChannel,
    browserExecutable: run.browserExecutable,
    headless: run.headless,
    navigatorGPU: current.renderer.navigatorGPU,
    adapterStatus: webgpu.adapterStatus ?? 'unavailable',
    deviceStatus: webgpu.deviceStatus ?? 'unavailable',
    adapterInfo: normalizeAdapterInfo(webgpu.adapterInfo),
    deviceLost: webgpu.deviceLost ?? null,
    activeRenderer: current.renderer.activeBackend,
    activeBackend: current.renderer.activeBackend,
    fallbackReason: run.fallbackReason,
    webgl2ContextStatus: current.renderer.webgl2?.status ?? 'unavailable',
  };
}

function normalizeAdapterInfo(info) {
  const source = info && typeof info === 'object' ? info : {};
  return Object.fromEntries(['vendor', 'architecture', 'device', 'description', 'isFallbackAdapter'].map((key) => [
    key,
    source[key] === undefined || source[key] === '' ? 'unavailable' : source[key],
  ]));
}

function classifyRun(run) {
  if (run.requestedBackend === 'webgl2') return run.passed ? 'webgl2-ci-pass' : 'webgl2-ci-fail';
  if (run.passed && run.activeBackend === 'WebGPU') {
    return hardwareAdapterClearlyIdentified(run.rendererDiagnostics?.adapterInfo)
      ? 'webgpu-ci-pass-hardware'
      : 'webgpu-ci-pass-software';
  }
  const diagnostics = run.rendererDiagnostics;
  if (diagnostics?.navigatorGPU === false || diagnostics?.adapterStatus === 'unavailable') return 'webgpu-ci-unsupported';
  return 'webgpu-ci-fail';
}

function hardwareAdapterClearlyIdentified(info) {
  if (!info || info.isFallbackAdapter !== false) return false;
  const description = [info.vendor, info.device, info.description].join(' ').toLowerCase();
  return !/swiftshader|llvmpipe|software|fallback/.test(description)
    && [info.vendor, info.device, info.description].some((value) => value && value !== 'unavailable');
}

function totalErrorCount(run) {
  return run.consoleErrors.length + run.pageErrors.length + run.windowErrors.length + run.unhandledRejections.length
    + run.requestFailures.length + run.httpFailures.length + run.workerErrors.length + run.contextLosses.length
    + (run.deviceLost && run.deviceLost.reason !== 'destroyed' ? 1 : 0);
}

function explainRunFailure(run) {
  return `Browser contract failed: backend=${run.requestedBackend}, active=${run.activeBackend ?? 'none'}, HTTP=${run.httpStatus ?? 'none'}, errors=${totalErrorCount(run)}, screenshots=${run.screenshotCount}.`;
}

function compactState(state) {
  return {
    active: state.active,
    renderer: state.renderer,
    geometry: state.geometry,
    performance: state.performance,
    resources: state.resources,
    rigSurfaceAudit: state.rigSurfaceAudit,
    pose: state.pose,
    errors: state.errors,
  };
}

async function finalizeEvidence({ report, artifactRoot, logRoot }) {
  report.completedAt = new Date().toISOString();
  const webgl2 = report.runs.find((run) => run.requestedBackend === 'webgl2');
  const webgpu = report.runs.find((run) => run.requestedBackend === 'webgpu');
  report.status = webgl2?.passed ? 'browser-contract-pass-user-visual-pending' : webgl2 ? 'browser-contract-fail' : 'browser-contract-partial';
  report.implementationStatus = 'complete';
  report.browserAutomation = 'complete';
  report.ciBrowserContract = webgl2?.passed ? 'pass' : webgl2 ? 'fail' : 'pending';
  report.ciWebGPU = webgpu?.classification ?? 'not-run';
  report.localBrowserPackage = 'ready';
  report.userVisualAcceptance = 'pending';
  report.visualAcceptance = false;
  report.productionReady = false;
  const metrics = createMetrics(report);
  const rendererDiagnostics = {
    schema: 'humanoid_rig/procedural_deform_renderer_diagnostics@5.0',
    commit: report.commit,
    generatedAt: new Date().toISOString(),
    runs: report.runs.map((run) => ({ requestedBackend: run.requestedBackend, classification: run.classification, diagnostics: run.rendererDiagnostics ?? null })),
  };
  await Promise.all([
    writeJSON(join(artifactRoot, 'metrics.json'), metrics),
    writeJSON(join(artifactRoot, 'browser-qa-report.json'), report),
    writeJSON(join(artifactRoot, 'renderer-diagnostics.json'), rendererDiagnostics),
    writeFile(join(logRoot, 'console.log'), renderConsoleLog(report)),
    writeFile(join(logRoot, 'network.log'), renderNetworkLog(report)),
  ]);
  await buildProceduralDeformQAGallery({ artifactRoot, report });
  await writeQAManifest({ artifactRoot, report });
}

function createMetrics(report) {
  return {
    schema: 'humanoid_rig/procedural_deform_browser_metrics@5.0',
    commit: report.commit,
    generatedAt: new Date().toISOString(),
    runs: report.runs.map((run) => ({
      requestedBackend: run.requestedBackend,
      activeBackend: run.activeBackend,
      classification: run.classification,
      passed: run.passed,
      httpStatus: run.httpStatus,
      consoleErrorCount: run.consoleErrors.length,
      consoleWarningCount: run.consoleWarnings.length,
      pageErrorCount: run.pageErrors.length,
      unhandledRejectionCount: run.unhandledRejections.length,
      requestFailureCount: run.requestFailures.length,
      httpFailureCount: run.httpFailures.length,
      glbRequestCount: run.glbRequests.length,
      screenshotCount: run.screenshotCount,
      initial: run.initial,
    })),
  };
}

async function writeQAManifest({ artifactRoot, report }) {
  const candidates = (await listFilesRecursively(artifactRoot)).filter((path) => path.endsWith('.png') || [
    'metrics.json', 'browser-qa-report.json', 'renderer-diagnostics.json', 'visual-review-gallery.html',
  ].includes(relative(artifactRoot, path).replaceAll('\\', '/')));
  const files = [];
  for (const path of candidates.sort()) {
    const info = await stat(path);
    const artifactPath = relative(artifactRoot, path).replaceAll('\\', '/');
    const evidence = report.screenshots.find((entry) => entry.artifactPath === artifactPath);
    files.push({
      path: artifactPath,
      size: info.size,
      sha256: await sha256(path),
      ...(evidence ? { commit: evidence.commit, backend: evidence.backend, poseId: evidence.poseId } : {}),
    });
  }
  await writeJSON(join(artifactRoot, 'qa-manifest.json'), {
    schema: 'humanoid_rig/procedural_deform_qa_manifest@5.0',
    commit: report.commit,
    generatedAt: new Date().toISOString(),
    files,
  });
}

async function resolveBrowserTarget(settings) {
  if (settings.browserPath) {
    if (!existsSync(settings.browserPath)) throw new Error(`Browser executable does not exist: ${settings.browserPath}`);
    return { channel: settings.browserChannel ?? 'custom', browserName: settings.browserChannel ?? 'Custom Chromium', executablePath: settings.browserPath };
  }
  const requested = settings.browserChannel;
  const candidates = browserCandidates();
  const order = requested ? [requested] : ['chrome', 'msedge', 'chromium'];
  for (const channel of order) {
    const candidate = candidates.find((entry) => entry.channel === channel && existsSync(entry.executablePath));
    if (candidate) return candidate;
  }
  throw new Error([
    `No browser executable was found for ${requested ?? 'chrome, msedge, or chromium'}.`,
    'Install the pinned Chromium with: npx playwright install chromium --with-deps',
    'Or pass: --browser-path <path>',
  ].join('\n'));
}

function browserCandidates() {
  const windows = [
    ['chrome', 'Google Chrome', join(process.env.PROGRAMFILES ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe')],
    ['chrome', 'Google Chrome', join(process.env['PROGRAMFILES(X86)'] ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe')],
    ['chrome', 'Google Chrome', join(process.env.LOCALAPPDATA ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe')],
    ['msedge', 'Microsoft Edge', join(process.env.PROGRAMFILES ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')],
    ['msedge', 'Microsoft Edge', join(process.env['PROGRAMFILES(X86)'] ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')],
  ];
  const unix = [
    ['chrome', 'Google Chrome', '/usr/bin/google-chrome'],
    ['chrome', 'Google Chrome', '/usr/bin/google-chrome-stable'],
    ['msedge', 'Microsoft Edge', '/usr/bin/microsoft-edge'],
    ['chromium', 'System Chromium', '/usr/bin/chromium'],
  ];
  return [...(process.platform === 'win32' ? windows : unix), ['chromium', 'Playwright Chromium', chromium.executablePath()]]
    .map(([channel, browserName, executablePath]) => ({ channel, browserName, executablePath }));
}

function launchArguments(backend) {
  const common = ['--window-size=1600,1200', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--no-sandbox'];
  return backend === 'webgpu'
    ? [...common, '--enable-unsafe-webgpu']
    : [...common, '--enable-webgl', '--use-angle=swiftshader'];
}

async function startProjectServer(logRoot) {
  const child = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, NO_OPEN: '1', PORT: '4173' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let output = '';
  child.stdout.on('data', (chunk) => { output += String(chunk); });
  child.stderr.on('data', (chunk) => { output += String(chunk); });
  const url = await poll(async () => {
    const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
    if (!match) return null;
    try { return (await fetch(match[0])).ok ? match[0] : null; } catch { return null; }
  }, 30_000, 'npm start');
  await writeFile(join(logRoot, 'server.log'), output);
  return {
    url,
    stop: async () => {
      if (child.exitCode === null) child.kill();
      await withTimeout(new Promise((resolveExit) => {
        if (child.exitCode !== null) resolveExit(child.exitCode);
        else child.once('exit', resolveExit);
      }), 5_000, 'project server shutdown').catch(() => {});
      child.stdout.removeAllListeners();
      child.stderr.removeAllListeners();
      child.stdout.destroy();
      child.stderr.destroy();
      await writeFile(join(logRoot, 'server.log'), output);
    },
  };
}

async function closeBrowserResources({ run, context, browser, browserServer }) {
  for (const [label, resource, close] of [
    ['browser context', context, () => context.close()],
    ['browser connection', browser, () => browser.close()],
    ['browser server', browserServer, () => browserServer.close()],
  ]) {
    if (!resource) continue;
    try {
      await withTimeout(close(), 10_000, `${label} shutdown`);
      recordProgress(run, `${label.replaceAll(' ', '-')}-closed`);
    } catch (error) {
      run.teardownWarnings.push(formatError(error));
    }
  }
  if (browserServer?.process()?.exitCode === null) {
    try {
      await withTimeout(browserServer.kill(), 10_000, 'browser server forced shutdown');
      recordProgress(run, 'browser-server-killed');
    } catch (error) {
      run.teardownWarnings.push(formatError(error));
    }
  }
}

function recordProgress(run, stage) {
  const entry = { stage, timestamp: new Date().toISOString() };
  run.progress.push(entry);
  console.log(`BROWSER_QA_PROGRESS backend=${run.requestedBackend} stage=${stage}`);
  return entry;
}

async function loadOrCreateReport(artifactRoot, commit, node) {
  try {
    const report = await readJSON(join(artifactRoot, 'browser-qa-report.json'));
    if (report.commit === commit) return report;
  } catch {}
  return {
    schema: 'humanoid_rig/procedural_deform_browser_qa_report@5.0',
    commit,
    node,
    startedAt: new Date().toISOString(),
    runs: [],
    screenshots: [],
    visualAcceptance: false,
    productionReady: false,
  };
}

function renderConsoleLog(report) {
  return `${report.runs.flatMap((run) => [
    `[${run.requestedBackend}] classification=${run.classification} browser=${run.browserName} ${run.browserVersion}`,
    ...run.consoleErrors.map((entry) => `[ERROR] ${entry.text}`),
    ...run.consoleWarnings.map((entry) => `[WARNING] ${entry.text}`),
    ...run.pageErrors.map((entry) => `[PAGEERROR] ${entry.message}`),
    ...run.unhandledRejections.map((entry) => `[UNHANDLED] ${entry}`),
    ...run.workerErrors.map((entry) => `[WORKER] ${entry.text}`),
    ...run.contextLosses.map((entry) => `[CONTEXT_LOST] ${JSON.stringify(entry)}`),
    ...(run.deviceLost ? [`[DEVICE_LOST] ${JSON.stringify(run.deviceLost)}`] : []),
    ...(run.failure ? [`[FAILURE] ${run.failure}`] : []),
  ]).join('\n')}\n`;
}

function renderNetworkLog(report) {
  return `${report.runs.flatMap((run) => [
    `[${run.requestedBackend}]`,
    ...run.requestFailures.map((entry) => `[REQUEST_FAILED] ${entry.url} ${JSON.stringify(entry.failure)}`),
    ...run.httpFailures.map((entry) => `[HTTP_${entry.status}] ${entry.url}`),
    ...run.glbRequests.map((url) => `[GLB] ${url}`),
  ]).join('\n')}\n`;
}

function assertScreenshotSet(report, backend, definitions, required) {
  const actual = report.screenshots.filter((entry) => entry.backend === backend);
  if (required && actual.length !== definitions.length) throw new Error(`${backend} screenshot count ${actual.length}/${definitions.length}.`);
  for (const [fileName, , poseId] of definitions) {
    const evidence = actual.find((entry) => entry.artifactPath === `${backend}/${fileName}`);
    if (required && (!evidence || evidence.poseId !== poseId)) throw new Error(`${backend}/${fileName} has missing or incorrect pose evidence.`);
  }
}

function labelToPoseId(label) {
  return ({
    'A Pose': 'a-pose', 'T Pose': 't-pose', 'Arm Raise 90': 'arm-raise-90-left', 'Arm Raise 150': 'arm-raise-150-left',
    'Forearm Twist 180': 'forearm-twist-180-left', 'Elbow Bend 140': 'elbow-bend-140-left', 'Hip Flex': 'hip-flex-left',
    'Knee Bend': 'knee-bend-left', Squat: 'squat', Lunge: 'lunge-left',
  })[label];
}

function expectedBackend(backend) { return backend === 'webgpu' ? 'WebGPU' : 'WebGL2'; }
function requiredValue(argv, index, flag) { if (!argv[index]) throw new Error(`${flag} requires a value.`); return argv[index]; }
async function readJSON(path) { return JSON.parse(await readFile(path, 'utf8')); }
async function writeJSON(path, value) { await writeFile(path, `${JSON.stringify(value, null, 2)}\n`); }
async function sha256(path) { return createHash('sha256').update(await readFile(path)).digest('hex'); }
async function listFilesRecursively(directory) { const result = []; for (const entry of await readdir(directory, { withFileTypes: true })) { const path = join(directory, entry.name); if (entry.isDirectory()) result.push(...await listFilesRecursively(path)); else result.push(path); } return result; }
async function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`Timed out waiting for ${label} after ${timeoutMs} ms.`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}
async function poll(action, timeoutMs, label) { const deadline = Date.now() + timeoutMs; while (Date.now() < deadline) { const value = await action(); if (value) return value; await new Promise((resolveDelay) => setTimeout(resolveDelay, 100)); } throw new Error(`Timed out waiting for ${label}.`); }
async function runGit(args) { const child = spawn('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }); let output = ''; let error = ''; child.stdout.on('data', (chunk) => { output += chunk; }); child.stderr.on('data', (chunk) => { error += chunk; }); const code = await new Promise((resolveExit) => child.once('exit', resolveExit)); if (code !== 0) throw new Error(`git ${args.join(' ')} failed: ${error.trim()}`); return output.trim(); }
function formatError(error) { return error instanceof Error ? `${error.name}: ${error.message}` : String(error); }

export function browserFailureSummary(report) {
  return report.runs.filter((run) => !run.passed).map((run) => ({
    backend: run.requestedBackend,
    activeBackend: run.activeBackend,
    classification: run.classification,
    failure: run.failure ?? 'browser contract failed',
    failedInitialChecks: Object.entries(run.initialContract?.checks ?? {}).filter(([, passed]) => !passed).map(([name]) => name),
    failedButtons: run.buttonChecks.filter((check) => !check.passed).slice(0, 12).map(({ kind, name, activeChanged, cacheRule, canvasRenderable }) => ({
      kind, name, activeChanged, cacheRule, canvasRenderable,
    })),
    errorCounts: {
      console: run.consoleErrors.length,
      page: run.pageErrors.length,
      window: run.windowErrors.length,
      unhandledRejections: run.unhandledRejections.length,
      requestFailures: run.requestFailures.length,
      httpFailures: run.httpFailures.length,
      worker: run.workerErrors.length,
      contextLosses: run.contextLosses.length,
    },
    firstErrors: [
      run.consoleErrors[0]?.text,
      run.pageErrors[0]?.message,
      run.windowErrors[0],
      run.unhandledRejections[0],
      run.requestFailures[0] ? JSON.stringify(run.requestFailures[0]) : null,
      run.httpFailures[0] ? JSON.stringify(run.httpFailures[0]) : null,
      run.workerErrors[0]?.text,
      run.contextLosses[0] ? JSON.stringify(run.contextLosses[0]) : null,
    ].filter(Boolean).map((message) => String(message).slice(0, 800)),
    deviceLost: run.deviceLost,
    glbRequests: run.glbRequests.slice(0, 3),
    screenshotCount: run.screenshotCount,
  }));
}

function emitGitHubBrowserFailure(report) {
  const summary = JSON.stringify(browserFailureSummary(report)).slice(0, 6_000);
  console.error(`BROWSER_QA_FAILURE_SUMMARY ${summary}`);
  if (process.env.GITHUB_ACTIONS !== 'true') return;
  const message = summary
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A');
  console.error(`::error file=human-core-v5-procedural-deform.html,line=1,title=Browser contract failure::${message}`);
}

function emitGitHubVerificationNotice(verification) {
  if (process.env.GITHUB_ACTIONS !== 'true') return;
  const message = JSON.stringify(verification)
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A');
  console.log(`::notice title=Browser QA evidence summary::${message}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseBrowserQAArguments();
    if (options.verifyArtifacts) {
      const verification = await verifyProceduralDeformQAArtifacts({ artifactRoot: options.artifactRoot });
      console.log(JSON.stringify(verification, null, 2));
      emitGitHubVerificationNotice(verification);
    }
    else {
      const report = await runProceduralDeformBrowserQA(options);
      console.log(JSON.stringify({ status: report.status, commit: report.commit, runs: report.runs.map((run) => ({ backend: run.requestedBackend, activeBackend: run.activeBackend, classification: run.classification, passed: run.passed })) }, null, 2));
      if (!report.commandPassed) {
        emitGitHubBrowserFailure(report);
        process.exitCode = 1;
      }
    }
  } catch (error) {
    console.error(formatError(error));
    process.exitCode = 1;
  }
}
