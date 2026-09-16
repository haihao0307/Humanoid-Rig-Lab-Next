import { chromium } from 'playwright';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const moduleRoot = path.resolve(here, '..');
const qaDir = path.join(moduleRoot, 'qa');
const url = process.env.CAT_PHASE1_GATE_B_URL ?? 'http://127.0.0.1:4173/cat-kaopu/phase1-gate-b/index.html';
const buildId = 'cat-kaopu-phase1-gate-b-morphology-20260916';
fs.mkdirSync(qaDir, { recursive: true });

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const waitFrames = async (page, count = 12) => {
  await page.evaluate(async (frames) => {
    for (let index = 0; index < frames; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, count);
};

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
});

const report = {
  schema: 'cat_kaopu/phase1_gate_b_browser_qa@1.0',
  buildId,
  url,
  ready: null,
  pageErrors: [],
  consoleErrors: [],
  audit: null,
  collisionProfile: null,
  morphologyDefault: null,
  stats: null,
  screenshots: {},
  samples: {},
  assertions: {},
  mobile: {},
  visualAcceptance: false,
  productionReady: false,
};

let failure = null;
try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1050 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.pageErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
  });

  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForFunction(() => window.__CAT_PHASE1_READY__ !== undefined, null, { timeout: 40_000 });
  report.ready = await page.evaluate(() => window.__CAT_PHASE1_READY__);
  if (report.ready !== 'gate-b-webgl2') throw new Error(`Phase 1 Gate B did not enter WebGL2: ${report.ready}`);

  report.audit = await page.evaluate(() => window.__CAT_PHASE1_AUDIT__);
  report.collisionProfile = await page.evaluate(() => window.__CAT_PHASE1_PROFILE__);
  report.morphologyDefault = await page.evaluate(() => window.__CAT_PHASE1_MORPH_AUDIT__());
  report.stats = await page.evaluate(() => window.__CAT_V446_STATS__);
  const stage = page.locator('#stage');

  await page.evaluate(() => {
    window.__CAT_PHASE1_SET_OBSTACLE__('wall_A', [0.42, -0.19, 0], [0.44, 0.19, 0.245]);
    window.__CAT_PHASE1_SET_COLLISION__(true);
    window.__CAT_PHASE1_SET_PROXY_VIS__(false);
    window.__CAT_PHASE1_SET_MORPH__({ enabled: true, debug: false });
    const contacts = document.querySelector('#contacts');
    if (contacts?.classList.contains('active')) contacts.click();
  });
  await waitFrames(page, 10);

  const setView = async (view) => {
    await page.click(`[data-view="${view}"]`);
    await page.click('#resetCam');
    await waitFrames(page, 9);
  };

  const setSample = async (action, time) => {
    await page.evaluate(({ actionName, sampleTime }) => {
      window.__CAT_V446_SET_SAMPLE__(actionName, sampleTime);
    }, { actionName: action, sampleTime: time });
    await waitFrames(page, 14);
    return page.evaluate(() => window.__CAT_PHASE1_GET_STATE__());
  };

  const capture = async (key, filename) => {
    await waitFrames(page, 8);
    const outputPath = path.join(qaDir, filename);
    const buffer = await stage.screenshot({ path: outputPath });
    report.screenshots[key] = {
      path: path.relative(moduleRoot, outputPath),
      bytes: buffer.length,
      sha256: sha256(buffer),
    };
    report.samples[key] = await page.evaluate(() => window.__CAT_PHASE1_GET_STATE__());
  };

  await setSample('stand', 0.2);
  await page.evaluate(() => window.__CAT_PHASE1_SET_MORPH__({ enabled: false, debug: false }));
  for (const view of ['front', 'left', 'top', 'quarter']) {
    await setView(view);
    const cap = view[0].toUpperCase() + view.slice(1);
    await capture(`morphOff${cap}`, `CAT_KAOPU_PHASE1_GATE_B_MORPH_OFF_${view.toUpperCase()}_2026-09-16.png`);
  }
  const morphOffState = await page.evaluate(() => window.__CAT_PHASE1_GET_STATE__());

  await page.evaluate(() => window.__CAT_PHASE1_SET_MORPH__({
    enabled: true,
    debug: false,
    chest: 0.82,
    waist: 0.78,
    pelvis: 0.36,
    shoulder: 0.74,
    belly: 0.82,
    neck: 0.68,
    master: 1,
  }));
  for (const view of ['front', 'left', 'top', 'quarter']) {
    await setView(view);
    const cap = view[0].toUpperCase() + view.slice(1);
    await capture(`morphOn${cap}`, `CAT_KAOPU_PHASE1_GATE_B_MORPH_ON_${view.toUpperCase()}_2026-09-16.png`);
  }
  const morphOnState = await page.evaluate(() => window.__CAT_PHASE1_GET_STATE__());

  await page.evaluate(() => window.__CAT_PHASE1_SET_MORPH__({ enabled: true, debug: true }));
  await setView('top');
  await capture('morphDebugTop', 'CAT_KAOPU_PHASE1_GATE_B_MORPH_DEBUG_TOP_2026-09-16.png');
  await page.evaluate(() => window.__CAT_PHASE1_SET_MORPH__({ enabled: true, debug: false }));

  const walkMid = await setSample('walk_forward', 2.15);
  await setView('quarter');
  await capture('walkMid', 'CAT_KAOPU_PHASE1_GATE_B_WALK_MID_2026-09-16.png');

  const turnLeft = await setSample('turn_left', 2.8);
  await setView('top');
  await capture('turnLeftTop', 'CAT_KAOPU_PHASE1_GATE_B_TURN_LEFT_TOP_2026-09-16.png');
  const turnRight = await setSample('turn_right', 2.8);
  await capture('turnRightTop', 'CAT_KAOPU_PHASE1_GATE_B_TURN_RIGHT_TOP_2026-09-16.png');

  await page.evaluate(() => {
    window.__CAT_PHASE1_SET_PROXY_VIS__(true);
    const contacts = document.querySelector('#contacts');
    if (contacts && !contacts.classList.contains('active')) contacts.click();
  });
  await setView('left');
  const collisionEnabled = await setSample('walk_forward', 5.25);
  await capture('collisionBlocked', 'CAT_KAOPU_PHASE1_GATE_B_COLLISION_BLOCKED_2026-09-16.png');

  await page.evaluate(() => window.__CAT_PHASE1_SET_COLLISION__(false));
  const collisionDisabled = await setSample('walk_forward', 5.25);
  report.samples.collisionDisabled = collisionDisabled;
  await page.evaluate(() => window.__CAT_PHASE1_SET_COLLISION__(true));
  await setSample('walk_forward', 5.25);

  const metrics = morphOnState?.morphology ?? {};
  report.assertions.webgl2 = report.ready === 'gate-b-webgl2';
  report.assertions.noPageErrors = report.pageErrors.length === 0;
  report.assertions.noConsoleErrors = report.consoleErrors.length === 0;
  report.assertions.gateB = report.audit?.gates?.singleNpc === 'active'
    && report.audit?.gates?.morphology === 'active';
  report.assertions.groupLocked = report.audit?.gates?.group === 'locked'
    && report.audit?.gates?.variation === 'locked'
    && report.audit?.gates?.avoidance === 'next';
  report.assertions.boundedMorphContract = report.audit?.morphology?.layer === 'bounded-bind-space-surface-corrective'
    && report.audit?.morphology?.payloadMutation === false
    && report.audit?.morphology?.rigMutation === false
    && report.audit?.morphology?.boneLengthMutation === false
    && report.audit?.morphology?.weightMutation === false;
  report.assertions.statsInvariant = report.stats?.phase1Gate === 'B'
    && report.stats?.phase1Morphology === true
    && report.stats?.phase1MorphPayloadInvariant === true
    && report.stats?.phase1MorphRigInvariant === true
    && report.stats?.bones === 34;
  report.assertions.morphToggle = morphOffState?.morphology?.enabled === false
    && morphOnState?.morphology?.enabled === true;
  report.assertions.morphMagnitude = (metrics.maxDeltaM ?? 0) >= 0.004
    && (metrics.maxDeltaM ?? 99) <= 0.012
    && (metrics.affectedVertices ?? 0) >= 800
    && (metrics.affectedVertices ?? 99999) <= 2500;
  report.assertions.lengthInvariant = metrics.lengthInvariant === true
    && Math.abs((metrics.bodyLengthM ?? 0) - (metrics.bodyLengthBaseM ?? 1)) < 1e-7;
  report.assertions.groundInvariant = metrics.groundInvariant === true
    && Math.abs((metrics.bodyMinZM ?? 0) - (metrics.bodyMinZBaseM ?? 1)) < 1e-7;
  report.assertions.eyeRegionInvariant = (metrics.eyeRegionMaxDeltaM ?? 1) < 1e-9;
  report.assertions.sectionRatios = (metrics.widthRatios?.chest ?? 0) >= 1.05
    && (metrics.widthRatios?.chest ?? 99) <= 1.12
    && (metrics.widthRatios?.waist ?? 0) >= 0.90
    && (metrics.widthRatios?.waist ?? 99) <= 0.98
    && (metrics.widthRatios?.pelvis ?? 0) >= 0.98
    && (metrics.widthRatios?.pelvis ?? 99) <= 1.04;
  report.assertions.morphChangesPixels = report.screenshots.morphOffFront.sha256 !== report.screenshots.morphOnFront.sha256
    && report.screenshots.morphOffLeft.sha256 !== report.screenshots.morphOnLeft.sha256
    && report.screenshots.morphOffTop.sha256 !== report.screenshots.morphOnTop.sha256
    && report.screenshots.morphOffQuarter.sha256 !== report.screenshots.morphOnQuarter.sha256;
  report.assertions.morphViewsUnique = new Set([
    report.screenshots.morphOnFront.sha256,
    report.screenshots.morphOnLeft.sha256,
    report.screenshots.morphOnTop.sha256,
    report.screenshots.morphOnQuarter.sha256,
  ]).size === 4;
  report.assertions.debugChangesPixels = report.screenshots.morphDebugTop.sha256 !== report.screenshots.morphOnTop.sha256;
  report.assertions.walkFinite = Number.isFinite(walkMid?.metrics?.rootPosition?.[0])
    && Number.isFinite(walkMid?.metrics?.maxSlipM)
    && Number.isFinite(walkMid?.metrics?.maxPadTiltDeg)
    && (walkMid?.metrics?.maxSlipM ?? 1) < 0.001;
  report.assertions.turnDirections = (turnLeft?.metrics?.turnAngleDeg ?? 0) > 5
    && (turnRight?.metrics?.turnAngleDeg ?? 0) < -5;
  report.assertions.collisionBlocked = collisionEnabled?.collision?.blocked === true
    && collisionEnabled?.collision?.obstacle === 'wall_A';
  report.assertions.collisionFinite = Number.isFinite(collisionEnabled?.collision?.maxPenetrationM)
    && Number.isFinite(collisionEnabled?.collision?.correctionM)
    && Number.isFinite(collisionEnabled?.collision?.brake);
  report.assertions.collisionResolved = (collisionEnabled?.collision?.minClearanceM ?? -1) >= -0.001;
  report.assertions.collisionBrake = (collisionEnabled?.collision?.brake ?? 1) < 0.95;
  report.assertions.collisionLimitsTravel = (collisionDisabled?.metrics?.rootPosition?.[0] ?? 0)
    - (collisionEnabled?.metrics?.rootPosition?.[0] ?? 0) > 0.012;
  report.assertions.noGroupRuntime = collisionEnabled?.groupRuntime === false
    && collisionEnabled?.variationRuntime === false
    && collisionEnabled?.shapeMutation === 'bounded-bind-space-surface-corrective-layer';
  report.assertions.motionEvidenceUnique = report.screenshots.walkMid.sha256 !== report.screenshots.morphOnQuarter.sha256
    && report.screenshots.turnLeftTop.sha256 !== report.screenshots.turnRightTop.sha256;

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  mobile.on('pageerror', (error) => report.pageErrors.push(`mobile: ${String(error)}`));
  mobile.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(`mobile: ${message.text()}`);
  });
  await mobile.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await mobile.waitForFunction(() => window.__CAT_PHASE1_READY__ !== undefined, null, { timeout: 40_000 });
  await mobile.evaluate(() => {
    window.__CAT_PHASE1_SET_PROXY_VIS__(false);
    window.__CAT_PHASE1_SET_MORPH__({ enabled: true, debug: false });
    window.__CAT_V446_SET_SAMPLE__('stand', 0.2);
    document.querySelector('[data-view="quarter"]')?.click();
    document.querySelector('#resetCam')?.click();
  });
  await waitFrames(mobile, 12);
  const mobilePath = path.join(qaDir, 'CAT_KAOPU_PHASE1_GATE_B_MOBILE_390x844_2026-09-16.png');
  const mobileBuffer = await mobile.screenshot({ path: mobilePath, fullPage: false });
  report.mobile = {
    ready: await mobile.evaluate(() => window.__CAT_PHASE1_READY__),
    overflowPx: await mobile.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth)),
    morphology: await mobile.evaluate(() => window.__CAT_PHASE1_MORPH_AUDIT__()),
    screenshot: {
      path: path.relative(moduleRoot, mobilePath),
      bytes: mobileBuffer.length,
      sha256: sha256(mobileBuffer),
    },
  };
  report.assertions.mobileWebgl2 = report.mobile.ready === 'gate-b-webgl2';
  report.assertions.mobileNoHorizontalOverflow = report.mobile.overflowPx === 0;
  report.assertions.mobileMorphology = report.mobile.morphology?.enabled === true
    && report.mobile.morphology?.lengthInvariant === true
    && report.mobile.morphology?.groundInvariant === true;

  const failed = Object.entries(report.assertions).filter(([, value]) => value !== true);
  if (failed.length) throw new Error(`Phase 1 Gate B browser assertions failed: ${failed.map(([key]) => key).join(', ')}`);
  if (report.pageErrors.length || report.consoleErrors.length) throw new Error('browser emitted page or console errors');
} catch (error) {
  failure = error;
  report.failure = String(error?.stack ?? error);
} finally {
  await browser.close();
  const reportPath = path.join(qaDir, 'CAT_KAOPU_PHASE1_GATE_B_BROWSER_QA_2026-09-16.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

if (failure) throw failure;
console.log(JSON.stringify({ buildId, ready: report.ready, assertions: report.assertions }, null, 2));
