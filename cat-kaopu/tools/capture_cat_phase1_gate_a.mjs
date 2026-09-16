import { chromium } from 'playwright';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const moduleRoot = path.resolve(here, '..');
const qaDir = path.join(moduleRoot, 'qa');
const url = process.env.CAT_PHASE1_URL ?? 'http://127.0.0.1:4173/cat-kaopu/phase1/index.html';
const buildId = 'cat-kaopu-phase1-gate-a-single-npc-20260916';
fs.mkdirSync(qaDir, { recursive: true });

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const waitFrames = async (page, count = 12) => {
  await page.evaluate(async (frames) => {
    for (let i = 0; i < frames; i += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, count);
};

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
});

const report = {
  schema: 'cat_kaopu/phase1_gate_a_browser_qa@1.0',
  buildId,
  url,
  ready: null,
  pageErrors: [],
  consoleErrors: [],
  audit: null,
  profile: null,
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
  if (report.ready !== 'gate-a-webgl2') throw new Error(`Phase 1 Gate A did not enter WebGL2: ${report.ready}`);

  report.audit = await page.evaluate(() => window.__CAT_PHASE1_AUDIT__);
  report.profile = await page.evaluate(() => window.__CAT_PHASE1_PROFILE__);
  const stage = page.locator('#stage');

  await page.evaluate(() => {
    window.__CAT_PHASE1_SET_OBSTACLE__('wall_A', [0.42, -0.19, 0], [0.44, 0.19, 0.245]);
    window.__CAT_PHASE1_SET_COLLISION__(true);
    window.__CAT_PHASE1_SET_PROXY_VIS__(false);
    const contacts = document.querySelector('#contacts');
    if (contacts?.classList.contains('active')) contacts.click();
  });
  await waitFrames(page, 8);

  const setView = async (view) => {
    await page.click(`[data-view="${view}"]`);
    await page.click('#resetCam');
    await waitFrames(page, 8);
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
  await setView('front');
  await capture('standFront', 'CAT_KAOPU_PHASE1_GATE_A_STAND_FRONT_2026-09-16.png');
  await setView('left');
  await capture('standLeft', 'CAT_KAOPU_PHASE1_GATE_A_STAND_LEFT_2026-09-16.png');
  await setView('top');
  await capture('standTop', 'CAT_KAOPU_PHASE1_GATE_A_STAND_TOP_2026-09-16.png');
  await setView('quarter');
  await capture('standQuarter', 'CAT_KAOPU_PHASE1_GATE_A_STAND_QUARTER_2026-09-16.png');

  await setSample('walk_forward', 2.15);
  await setView('quarter');
  await capture('walkMid', 'CAT_KAOPU_PHASE1_GATE_A_WALK_MID_2026-09-16.png');

  await setSample('turn_left', 2.8);
  await setView('top');
  await capture('turnLeftTop', 'CAT_KAOPU_PHASE1_GATE_A_TURN_LEFT_TOP_2026-09-16.png');
  await setSample('turn_right', 2.8);
  await capture('turnRightTop', 'CAT_KAOPU_PHASE1_GATE_A_TURN_RIGHT_TOP_2026-09-16.png');

  await page.evaluate(() => {
    window.__CAT_PHASE1_SET_PROXY_VIS__(true);
    const contacts = document.querySelector('#contacts');
    if (contacts && !contacts.classList.contains('active')) contacts.click();
  });
  await setView('left');
  const collisionEnabled = await setSample('walk_forward', 5.25);
  await capture('collisionBlocked', 'CAT_KAOPU_PHASE1_GATE_A_COLLISION_BLOCKED_2026-09-16.png');

  await page.evaluate(() => window.__CAT_PHASE1_SET_COLLISION__(false));
  const collisionDisabled = await setSample('walk_forward', 5.25);
  report.samples.collisionDisabled = collisionDisabled;
  await page.evaluate(() => window.__CAT_PHASE1_SET_COLLISION__(true));
  await setSample('walk_forward', 5.25);

  report.assertions.webgl2 = report.ready === 'gate-a-webgl2';
  report.assertions.noPageErrors = report.pageErrors.length === 0;
  report.assertions.noConsoleErrors = report.consoleErrors.length === 0;
  report.assertions.gateA = report.audit?.gates?.singleNpc === 'active';
  report.assertions.groupLocked = report.audit?.gates?.group === 'locked'
    && report.audit?.gates?.variation === 'locked'
    && report.audit?.gates?.avoidance === 'next';
  report.assertions.requiredViews = JSON.stringify(report.audit?.morphologyViews) === JSON.stringify(['front', 'left', 'top', 'quarter']);
  report.assertions.requiredActions = JSON.stringify(report.audit?.coreActions) === JSON.stringify(['stand', 'walk_forward', 'turn_left', 'turn_right']);
  report.assertions.proxyContract = report.profile?.proxies?.length === 3
    && report.profile?.proxies?.map((item) => item.id).join(',') === 'pelvis,chest,head';
  report.assertions.collisionBlocked = collisionEnabled?.collision?.blocked === true
    && collisionEnabled?.collision?.obstacle === 'wall_A';
  report.assertions.collisionDetectedPenetration = (collisionEnabled?.collision?.maxPenetrationM ?? 0) > 0.001;
  report.assertions.collisionResolved = (collisionEnabled?.collision?.minClearanceM ?? -1) >= -0.001;
  report.assertions.collisionBrake = (collisionEnabled?.collision?.brake ?? 1) < 0.95;
  report.assertions.collisionLimitsTravel = (collisionDisabled?.metrics?.rootPosition?.[0] ?? 0)
    - (collisionEnabled?.metrics?.rootPosition?.[0] ?? 0) > 0.012;
  report.assertions.noGroupRuntime = collisionEnabled?.groupRuntime === false
    && collisionEnabled?.variationRuntime === false
    && collisionEnabled?.shapeMutation === false;
  report.assertions.viewEvidenceUnique = new Set([
    report.screenshots.standFront.sha256,
    report.screenshots.standLeft.sha256,
    report.screenshots.standTop.sha256,
    report.screenshots.standQuarter.sha256,
  ]).size === 4;
  report.assertions.motionEvidenceUnique = report.screenshots.walkMid.sha256 !== report.screenshots.standQuarter.sha256
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
    window.__CAT_V446_SET_SAMPLE__('stand', 0.2);
    document.querySelector('[data-view="quarter"]')?.click();
    document.querySelector('#resetCam')?.click();
  });
  await waitFrames(mobile, 12);
  const mobilePath = path.join(qaDir, 'CAT_KAOPU_PHASE1_GATE_A_MOBILE_390x844_2026-09-16.png');
  const mobileBuffer = await mobile.screenshot({ path: mobilePath, fullPage: false });
  report.mobile = {
    ready: await mobile.evaluate(() => window.__CAT_PHASE1_READY__),
    overflowPx: await mobile.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth)),
    screenshot: {
      path: path.relative(moduleRoot, mobilePath),
      bytes: mobileBuffer.length,
      sha256: sha256(mobileBuffer),
    },
  };
  report.assertions.mobileWebgl2 = report.mobile.ready === 'gate-a-webgl2';
  report.assertions.mobileNoHorizontalOverflow = report.mobile.overflowPx === 0;

  const failed = Object.entries(report.assertions).filter(([, value]) => value !== true);
  if (failed.length) throw new Error(`Phase 1 browser assertions failed: ${failed.map(([key]) => key).join(', ')}`);
  if (report.pageErrors.length || report.consoleErrors.length) throw new Error('browser emitted page or console errors');
} catch (error) {
  failure = error;
  report.failure = String(error?.stack ?? error);
} finally {
  await browser.close();
  const reportPath = path.join(qaDir, 'CAT_KAOPU_PHASE1_GATE_A_BROWSER_QA_2026-09-16.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

if (failure) throw failure;
console.log(JSON.stringify({ buildId, ready: report.ready, assertions: report.assertions }, null, 2));
