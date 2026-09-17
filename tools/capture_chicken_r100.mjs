import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root = process.cwd();
const evidenceDir = path.join(root, 'evidence', 'r100');
const qaPath = path.join(root, 'qa', 'CHICKEN_R100_BROWSER_QA.json');
const url = process.env.CHICKEN_R100_URL || 'http://127.0.0.1:8765/CHICKEN_V46_R10_0_SINGLE_AGENT.html';
const executablePath = process.env.CHROME_PATH;
if (!executablePath) throw new Error('CHROME_PATH is required');
fs.mkdirSync(evidenceDir, { recursive: true });
fs.mkdirSync(path.dirname(qaPath), { recursive: true });

const diagnostics = {
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  actionFailures: [],
  captures: [],
  stages: []
};
let fatal = null;
let browser = null;
let page = null;

function stage(name, details = {}) {
  const record = { ...details, name, at: new Date().toISOString() };
  diagnostics.stages.push(record);
  console.log(`[r100-qa] ${name}`, JSON.stringify(details));
}

function writeEmergencyReport(reason) {
  try {
    fs.writeFileSync(qaPath, JSON.stringify({
      schema: 'life_ecosystem/chicken_r100_browser_qa@1.3',
      version: 'V4.6_R10.0_CENTERLINE_SWEEP_V7_1_CANDIDATE',
      passed: false,
      fatal: reason,
      diagnostics,
      truthBoundary: {
        technicalMotionContactTopologyGateOnly: true,
        manualMotionNaturalnessAcceptance: false,
        manualVisualAcceptance: false,
        singleAgentGroundingComplete: false,
        collisionComplete: false,
        groupTestAuthorized: false,
        productionReady: false
      }
    }, null, 2) + '\n');
  } catch (error) {
    console.error('[r100-qa] emergency report failed', error);
  }
}

const watchdog = setTimeout(() => {
  const reason = 'R10.0 browser QA exceeded the 210 second hard limit';
  console.error(reason);
  writeEmergencyReport(reason);
  process.exit(124);
}, 210_000);

async function click(selector, settle = 120) {
  const item = page.locator(selector);
  await item.waitFor({ state: 'visible', timeout: 30_000 });
  await item.click({ timeout: 15_000 });
  await page.waitForTimeout(settle);
}

async function captureCanvas(file) {
  stage('capture-start', { file });
  // Element screenshots wait for a continuously rendered WebGL canvas to become
  // motionless. The workbench intentionally renders every frame, so capture the
  // viewport directly instead of waiting on locator stability.
  await page.screenshot({
    path: path.join(evidenceDir, file),
    fullPage: false,
    animations: 'allow',
    caret: 'hide',
    timeout: 30_000
  });
  stage('capture-complete', { file });
}

async function captureAction(name, file, options = {}) {
  stage('action-start', { name, file, frames: options.frames ?? null });
  try {
    const result = await page.evaluate(({ name, options }) => {
      const api = window.__CHICKEN_PHASE1_MOTION__;
      if (!api?.diagnostics()?.manualStepAvailable) {
        throw new Error('manual stepping API is unavailable');
      }
      let pose;
      if (name === 'stop') {
        api.runAction('run', { frames: 18, dt: 1 / 60, resetFirst: true });
        pose = api.runAction('stop', { frames: 1, dt: 1 / 60, resetFirst: false });
      } else if (name === 'wing') {
        api.runAction('run', { frames: 18, dt: 1 / 60, resetFirst: true });
        pose = api.runAction('wing', { frames: 2, dt: 1 / 60, resetFirst: false });
      } else {
        pose = api.runAction(name, {
          frames: options.frames ?? 1,
          dt: options.dt ?? 1 / 60,
          resetFirst: true
        });
      }
      const runtime = api.diagnostics();
      return {
        requested: name,
        state: pose?.state || null,
        speed: pose?.root?.speed ?? null,
        contacts: pose?.contacts || null,
        wings: pose?.wings || null,
        observedStates: runtime.observedStates || [],
        invariantPassed: runtime.skin?.lastInvariantReport?.passed === true,
        contactPoints: runtime.skin?.lastContactPoints || null,
        weightingRevision: runtime.skin?.weightingRevision || null,
        topologyRevision: runtime.skin?.topologyRevision || null,
        centerlineCurveRevision: runtime.skin?.centerlineCurveRevision || null,
        logicalBoneCount: runtime.skin?.logicalBoneCount ?? runtime.skin?.boneCount ?? null,
        skeletonBoneCount: runtime.skin?.skeletonBoneCount ?? null,
        helperBoneCount: runtime.skin?.helperBoneCount ?? null,
        neckShell: runtime.skin?.neckShell || null,
        torso: runtime.skin?.torso || null,
        frameAudit: runtime.skin?.lastFrameAudit || null,
        meshAudits: runtime.skin?.meshAudits || []
      };
    }, { name, options });
    await page.waitForTimeout(options.settleMs ?? 100);
    await captureCanvas(file);
    diagnostics.captures.push({ ...result, file });
    stage('action-complete', { name, state: result.state });
    return result;
  } catch (error) {
    const failure = { name, file, error: String(error?.stack || error) };
    diagnostics.actionFailures.push(failure);
    stage('action-failed', failure);
    return null;
  }
}

try {
  stage('browser-launch');
  browser = await chromium.launch({
    headless: true,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--ignore-gpu-blocklist',
      '--enable-webgl',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader'
    ]
  });
  page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(120_000);
  page.on('console', (message) => {
    if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => diagnostics.pageErrors.push(String(error?.stack || error)));
  page.on('requestfailed', (request) => diagnostics.failedRequests.push({
    url: request.url(),
    error: request.failure()?.errorText || 'unknown'
  }));

  stage('page-open', { url });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForSelector('canvas', { timeout: 60_000 });
  await page.waitForFunction(() => {
    const api = window.__CHICKEN_PHASE1_MOTION__;
    return Boolean(
      window.__CHICKEN_R100_PATCH__
      && window.__CHICKEN_R100_MANUAL_STEP__
      && window.__CHICKEN_R100_PECK_ADAPTER__?.installed === true
      && window.__CHICKEN_R100_CENTERLINE_SWEEP__?.installed === true
      && api?.ready
      && api.diagnostics()?.manualStepAvailable
      && api.diagnostics()?.skin?.peckKinematicsRevision === 'six-link-sector-gated-s-curve-v4'
      && api.diagnostics()?.skin?.weightingRevision === 'anatomical-neck-root-preserving-centerline-sweep-v7.1'
      && api.diagnostics()?.skin?.topologyRevision === 'torso-preserving-neck-root-split-v7.1'
      && api.diagnostics()?.skin?.centerlineCurveRevision === 'rotation-minimizing-frame-centerline-v2'
    );
  }, null, { timeout: 120_000 });
  stage('runtime-ready');

  await page.evaluate(() => {
    const api = window.__CHICKEN_PHASE1_MOTION__;
    api.setAuto(false);
    api.pauseRealtime(true);
    api.reset({ clearObserved: true });
  });

  await click('button[data-layout="solo"]');
  await click('button[data-focus="whole"]');
  await click('button[data-view="threeQuarter"]');
  await click('button[data-mat="procedural"]');

  await captureAction('idle', 'R100_IDLE.png', { frames: 1 });
  await captureAction('look', 'R100_LOOK.png', { frames: 12 });
  await captureAction('peck', 'R100_PECK.png', { frames: 28 });
  await click('button[data-view="left"]');
  await captureCanvas('R100_PECK_SIDE_CONTACT.png');
  await click('button[data-view="threeQuarter"]');
  await captureAction('walk', 'R100_WALK.png', { frames: 18 });
  await captureAction('turn', 'R100_TURN.png', { frames: 2 });
  await captureAction('run', 'R100_RUN.png', { frames: 18 });
  await captureAction('stop', 'R100_STOP.png');
  await captureAction('wing', 'R100_WING_BALANCE.png');
  stage('capture-sequence-complete');
} catch (error) {
  fatal = String(error?.stack || error);
  stage('fatal', { fatal });
}

let runtime = { evaluationError: 'page unavailable' };
if (page) {
  runtime = await page.evaluate(() => ({
    patch: window.__CHICKEN_R100_PATCH__ || null,
    manualPatch: window.__CHICKEN_R100_MANUAL_STEP__ || null,
    peckAdapter: window.__CHICKEN_R100_PECK_ADAPTER__ || null,
    centerlineSweep: window.__CHICKEN_R100_CENTERLINE_SWEEP__ || null,
    motion: window.__CHICKEN_PHASE1_MOTION__?.diagnostics() || null,
    errorOverlay: (() => {
      const node = document.querySelector('#error');
      return node ? { display: getComputedStyle(node).display, text: node.textContent.trim() } : null;
    })(),
    canvas: (() => {
      const node = document.querySelector('canvas');
      return node ? { width: node.width, height: node.height } : null;
    })()
  })).catch((error) => ({ evaluationError: String(error?.stack || error) }));
}
if (browser) {
  await Promise.race([
    browser.close(),
    new Promise((resolve) => setTimeout(resolve, 10_000))
  ]);
}

const expectedFiles = [
  'R100_IDLE.png',
  'R100_LOOK.png',
  'R100_PECK.png',
  'R100_PECK_SIDE_CONTACT.png',
  'R100_WALK.png',
  'R100_TURN.png',
  'R100_RUN.png',
  'R100_WING_BALANCE.png',
  'R100_STOP.png'
];
const expectedActionCount = 8;
const observed = new Set(runtime.motion?.observedStates || []);
const requiredStates = ['idle_stand', 'look', 'peck', 'walk', 'stop', 'turn', 'short_run'];
const byRequest = Object.fromEntries(diagnostics.captures.map((item) => [item.requested, item]));
const groundWindow = (value, min = -0.06, max = 0.10) => (
  Number.isFinite(value) && value >= min && value <= max
);
const footContactsGrounded = diagnostics.captures.every((item) => {
  const points = item.contactPoints;
  if (!points) return false;
  if (item.contacts?.leftFoot && !groundWindow(points.leftFootGroundError)) return false;
  if (item.contacts?.rightFoot && !groundWindow(points.rightFootGroundError)) return false;
  return true;
});
const meshAudits = runtime.motion?.skin?.meshAudits || [];
const generatedFootAudits = meshAudits.filter((item) => item.generatedFootMesh === true);
const bodyAudits = meshAudits.filter((item) => item.materialKind === 'body');
const forbiddenBodyBones = [
  'hip_l', 'knee_l', 'ankle_l', 'toe_l',
  'hip_r', 'knee_r', 'ankle_r', 'toe_r'
];
const skin = runtime.motion?.skin || {};
const neckShell = skin.neckShell || null;
const torso = skin.torso || null;
const peckFrameAudit = byRequest.peck?.frameAudit || null;
const ringAreaRetained = Number.isFinite(peckFrameAudit?.ringAreaRatioMin)
  && Number.isFinite(peckFrameAudit?.ringAreaRatioMax)
  && peckFrameAudit.ringAreaRatioMin >= 0.70
  && peckFrameAudit.ringAreaRatioMax <= 1.35;
const curveLengthRatioStable = Number.isFinite(peckFrameAudit?.curveLengthRatio)
  && peckFrameAudit.curveLengthRatio >= 0.90
  && peckFrameAudit.curveLengthRatio <= 1.10;
const longitudinalStrainBounded = Number.isFinite(peckFrameAudit?.longitudinalRatioP95)
  && Number.isFinite(peckFrameAudit?.longitudinalRatioMax)
  && peckFrameAudit.longitudinalRatioP95 < 2.25
  && peckFrameAudit.longitudinalRatioMax < 3.50;
const neckShellValid = neckShell?.ringCount >= 18
  && neckShell?.ringSize === 32
  && neckShell?.vertexCount === neckShell.ringCount * neckShell.ringSize
  && neckShell?.triangleCount === (neckShell.ringCount - 1) * neckShell.ringSize * 2;
const torsoSplitValid = Number.isFinite(torso?.originalTriangleCount)
  && Number.isFinite(torso?.retainedTriangleCount)
  && torso.retainedTriangleCount > torso.originalTriangleCount * 0.75
  && torso.retainedTriangleCount < torso.originalTriangleCount * 0.93;
const checks = {
  noFatalException: fatal === null,
  patchLoaded: runtime.patch?.version === 'V4.6_R10.0_SINGLE_AGENT_BEHAVIOR_FOUNDATION',
  manualStepLoaded: runtime.motion?.manualStepAvailable === true && runtime.manualPatch?.version === '1.1',
  peckAdapterLoaded: runtime.peckAdapter?.installed === true
    && skin.peckKinematicsRevision === 'six-link-sector-gated-s-curve-v4',
  centerlineSweepLoaded: runtime.centerlineSweep?.installed === true
    && runtime.centerlineSweep?.version === 'anatomical-neck-root-preserving-centerline-sweep-v7.1',
  realtimePaused: runtime.motion?.realtimePaused === true,
  motionReady: runtime.motion?.ready === true,
  logicalBoneCount: skin.logicalBoneCount === 21 && skin.boneCount === 21,
  helperBoneTruth: skin.skeletonBoneCount === 22 && skin.helperBoneCount === 1,
  distributedCervicalChainPresent: skin.logicalBoneCount === 21,
  skinnedMeshes: (skin.skinnedMeshCount || 0) > 0,
  poseApplied: (skin.applyCount || 0) > 80,
  rigInvariants: skin.lastInvariantReport?.passed === true,
  controllerErrors: (runtime.motion?.errors || []).length === 0,
  actionSequenceCompleted: diagnostics.actionFailures.length === 0
    && diagnostics.captures.length === expectedActionCount,
  requiredStatesObserved: requiredStates.every((state) => observed.has(state)),
  requestedStateMapping:
    byRequest.idle?.state === 'idle_stand'
    && byRequest.look?.state === 'look'
    && byRequest.peck?.state === 'peck'
    && byRequest.walk?.state === 'walk'
    && byRequest.turn?.state === 'turn'
    && byRequest.run?.state === 'short_run'
    && byRequest.stop?.state === 'stop',
  wingBalanceObserved: byRequest.wing?.state === 'wing_balance'
    || Math.max(byRequest.wing?.wings?.leftOpen || 0, byRequest.wing?.wings?.rightOpen || 0) > 0.35,
  peckContactSignal: byRequest.peck?.contacts?.bill === true,
  peckBillGrounded: groundWindow(byRequest.peck?.contactPoints?.billGroundError, -0.04, 0.07),
  footContactsGrounded,
  contactSignalsCaptured: diagnostics.captures.every((item) => (
    typeof item.contacts?.leftFoot === 'boolean'
    && typeof item.contacts?.rightFoot === 'boolean'
    && typeof item.contacts?.bill === 'boolean'
  )),
  generatedFootMeshDetected: generatedFootAudits.length >= 1,
  bodyCarrierFreeOfLegPrimaries: bodyAudits.every((item) => (
    forbiddenBodyBones.every((id) => !item.primaryBoneCounts?.[id])
  )),
  topologyRevision: skin.topologyRevision === 'torso-preserving-neck-root-split-v7.1',
  centerlineCurveRevision: skin.centerlineCurveRevision === 'rotation-minimizing-frame-centerline-v2',
  weightingRevision: skin.weightingRevision === 'anatomical-neck-root-preserving-centerline-sweep-v7.1',
  independentNeckShell: neckShellValid,
  torsoNeckTopologySplit: torsoSplitValid,
  rigidRingAreaRetained: ringAreaRetained,
  centerlineLengthStableDuringPeck: curveLengthRatioStable,
  longitudinalStrainBounded,
  groupTestStillClosed: runtime.patch?.groupTestAuthorized === false
    && runtime.centerlineSweep?.groupTestAuthorized === false,
  errorOverlayHidden: runtime.errorOverlay?.display === 'none',
  canvasAllocated: (runtime.canvas?.width || 0) > 0 && (runtime.canvas?.height || 0) > 0,
  noPageErrors: diagnostics.pageErrors.length === 0,
  noConsoleErrors: diagnostics.consoleErrors.length === 0,
  noFailedRequests: diagnostics.failedRequests.length === 0,
  expectedCapturesWritten: expectedFiles.every((file) => fs.existsSync(path.join(evidenceDir, file)))
};
const report = {
  schema: 'life_ecosystem/chicken_r100_browser_qa@1.3',
  version: 'V4.6_R10.0_CENTERLINE_SWEEP_V7_1_CANDIDATE',
  environment: {
    browser: 'Chrome headless via Playwright Core',
    url,
    viewport: [1280, 900],
    captureMode: 'deterministic manual stepping with V7.1 torso-preserving topology and centerline evidence'
  },
  contactTolerance: {
    bill: [-0.04, 0.07],
    supportFoot: [-0.06, 0.10],
    units: 'workbench world units'
  },
  checks,
  passed: Object.values(checks).every(Boolean),
  runtime,
  fatal,
  ...diagnostics,
  expectedFiles,
  truthBoundary: {
    technicalMotionContactTopologyGateOnly: true,
    manualMotionNaturalnessAcceptance: false,
    manualVisualAcceptance: false,
    singleAgentGroundingComplete: false,
    collisionComplete: false,
    groupTestAuthorized: false,
    productionReady: false
  }
};
fs.writeFileSync(qaPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
clearTimeout(watchdog);
if (!report.passed) process.exit(1);
