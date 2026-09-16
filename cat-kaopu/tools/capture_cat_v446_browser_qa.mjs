import { chromium } from 'playwright';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const moduleRoot = path.resolve(here, '..');
const qaDir = path.join(moduleRoot, 'qa');
const url = process.env.CAT_V446_URL ?? 'http://127.0.0.1:4173/cat-kaopu/workbench/CAT_KAOPU_CURRENT.html';
fs.mkdirSync(qaDir, { recursive: true });

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const waitFrames = async (page, count = 10) => {
  await page.evaluate(async (frames) => {
    for (let i = 0; i < frames; i += 1) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }
  }, count);
};

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
});

const report = {
  schema: 'cat_kaopu/v446_browser_qa@1.0',
  version: 'V4.46',
  url,
  ready: null,
  pageErrors: [],
  consoleErrors: [],
  geometry: null,
  stats: null,
  screenshots: {},
  metrics: {},
  assertions: {},
  regression: {},
  mobile: {},
  visualAcceptance: false,
  productionReady: false,
};

let failure = null;
try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.pageErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
  });

  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForFunction(() => window.__CAT_V446_READY__ !== undefined, null, { timeout: 40_000 });
  report.ready = await page.evaluate(() => window.__CAT_V446_READY__);
  if (report.ready !== 'webgl2') throw new Error(`V4.46 did not enter WebGL2 mode: ${report.ready}`);

  report.geometry = await page.evaluate(() => window.__CAT_V446_EYE_REGION_GEOMETRY__);
  report.stats = await page.evaluate(() => window.__CAT_V446_STATS__);
  const stage = page.locator('#stage');

  const capture = async (key, filename) => {
    await waitFrames(page, 12);
    const outputPath = path.join(qaDir, filename);
    const buffer = await stage.screenshot({ path: outputPath });
    report.metrics[key] = await page.evaluate(() => window.__CAT_V446_GET_METRICS__());
    report.screenshots[key] = {
      path: path.relative(moduleRoot, outputPath),
      bytes: buffer.length,
      sha256: sha256(buffer),
    };
  };

  const setView = async (view, zoom = null) => {
    await page.click(`[data-view="${view}"]`);
    await page.evaluate(
      ({ z }) => window.__CAT_V446_SET_CAMERA_TARGET__(0.214, 0, 0.205, z),
      { z: zoom ?? (view === 'front' ? 0.14 : 0.105) },
    );
    await waitFrames(page, 10);
  };

  const setExpression = async (blink, extra = {}) => {
    await page.evaluate(
      ({ value, options }) => window.__CAT_V446_SET_EXPRESSION__({
        auto: false,
        autoBlink: false,
        blink: value,
        gazeYaw: 0,
        gazePitch: 0,
        earLeft: 0,
        earRight: 0,
        lidThickness: 0.00042,
        lidDebug: false,
        patchStrength: 0.88,
        smoothStrength: 0.94,
        browStrength: 0.72,
        noseStrength: 0.64,
        cheekStrength: 0.58,
        arcStrength: 0.86,
        creaseStrength: 0.54,
        cornea: 0.86,
        pupilAdapt: 0.42,
        eyeEnabled: true,
        blinkEnabled: true,
        corneaEnabled: true,
        furEnabled: true,
        ...options,
      }),
      { value: blink, options: extra },
    );
  };

  await page.evaluate(() => window.__CAT_V446_SET_SAMPLE__('blink_check', 0.45));

  await setView('front');
  await setExpression(0, { blinkEnabled: false });
  await capture('carrierOffFront', 'CAT_KAOPU_V446_CARRIER_OFF_FRONT_2026-09-16.png');

  await setExpression(0, { blinkEnabled: true });
  await capture('openFront', 'CAT_KAOPU_V446_OPEN_FRONT_2026-09-16.png');

  await setExpression(0.55);
  await capture('halfFront', 'CAT_KAOPU_V446_HALF_FRONT_2026-09-16.png');

  await setExpression(1);
  await capture('closedFront', 'CAT_KAOPU_V446_CLOSED_FRONT_2026-09-16.png');

  await setExpression(0, { smoothStrength: 0 });
  await capture('smoothZeroFront', 'CAT_KAOPU_V446_SMOOTH_ZERO_FRONT_2026-09-16.png');

  await setExpression(0, { smoothStrength: 1 });
  await capture('smoothMaxFront', 'CAT_KAOPU_V446_SMOOTH_MAX_FRONT_2026-09-16.png');

  await setExpression(0, { browStrength: 0, noseStrength: 0, cheekStrength: 0 });
  await capture('featuresZeroFront', 'CAT_KAOPU_V446_FEATURES_ZERO_FRONT_2026-09-16.png');

  await setExpression(0, { browStrength: 1, noseStrength: 1, cheekStrength: 1 });
  await capture('featuresMaxFront', 'CAT_KAOPU_V446_FEATURES_MAX_FRONT_2026-09-16.png');

  await setExpression(0.55, { lidDebug: true });
  await capture('debugFront', 'CAT_KAOPU_V446_FACE_CARRIER_DEBUG_FRONT_2026-09-16.png');

  await setView('quarter');
  await setExpression(0);
  await capture('openQuarter', 'CAT_KAOPU_V446_OPEN_QUARTER_2026-09-16.png');
  await setExpression(0.55);
  await capture('halfQuarter', 'CAT_KAOPU_V446_HALF_QUARTER_2026-09-16.png');
  await setExpression(1);
  await capture('closedQuarter', 'CAT_KAOPU_V446_CLOSED_QUARTER_2026-09-16.png');

  await setView('left', 0.095);
  await setExpression(1);
  await capture('closedLeft', 'CAT_KAOPU_V446_CLOSED_LEFT_2026-09-16.png');

  // Quick runtime regression through the previously frozen action chain.
  for (const [name, time] of [['stand', 0.2], ['sit_hold', 1.0], ['lie_hold', 1.0], ['walk_forward', 0.6], ['turn_left', 0.8]]) {
    report.regression[name] = await page.evaluate(
      ({ action, t }) => {
        window.__CAT_V446_SET_SAMPLE__(action, t);
        return window.__CAT_V446_GET_METRICS__();
      },
      { action: name, t: time },
    );
  }

  report.assertions.webgl2 = report.ready === 'webgl2';
  report.assertions.noPageErrors = report.pageErrors.length === 0;
  report.assertions.noConsoleErrors = report.consoleErrors.length === 0;
  report.assertions.singleCarrier = report.geometry?.pieces === 1;
  report.assertions.geometryVertices = report.geometry?.vertices === 6693;
  report.assertions.geometryTriangles = report.geometry?.triangles === 13056;
  report.assertions.geometryGrid = report.geometry?.cols === 96 && report.geometry?.rows === 68;
  report.assertions.fitMode = report.geometry?.fitMode === 'wide_bilateral_face_field_bilateral_smooth_exact_frozen_boundary';
  report.assertions.headDriven = Number.isInteger(report.geometry?.headBoneIndex) && report.geometry.headBoneIndex >= 0;
  report.assertions.statsBoneCount = report.stats?.bones === 34;
  report.assertions.statsWideCarrier = report.stats?.wideEyeRegionCarrier === true && report.stats?.bilateralFaceField === true;
  report.assertions.payloadInvariant = await page.evaluate(() => window.__CAT_V446_BASELINE__?.payload === 'CATV440');
  report.assertions.openMetric = (report.metrics.openFront?.expression?.blink ?? 1) < 0.05;
  report.assertions.halfMetric = Math.abs((report.metrics.halfFront?.expression?.blink ?? -1) - 0.55) < 0.08;
  report.assertions.closedMetric = (report.metrics.closedFront?.expression?.blink ?? 0) > 0.95;
  report.assertions.carrierToggleChangesPixels = report.screenshots.carrierOffFront.sha256 !== report.screenshots.openFront.sha256;
  report.assertions.openHalfDiffer = report.screenshots.openFront.sha256 !== report.screenshots.halfFront.sha256;
  report.assertions.halfClosedDiffer = report.screenshots.halfFront.sha256 !== report.screenshots.closedFront.sha256;
  report.assertions.smoothSweepChangesPixels = report.screenshots.smoothZeroFront.sha256 !== report.screenshots.smoothMaxFront.sha256;
  report.assertions.featureSweepChangesPixels = report.screenshots.featuresZeroFront.sha256 !== report.screenshots.featuresMaxFront.sha256;
  report.assertions.viewChangesPixels = report.screenshots.closedFront.sha256 !== report.screenshots.closedQuarter.sha256
    && report.screenshots.closedFront.sha256 !== report.screenshots.closedLeft.sha256;
  report.assertions.regressionMetricsExist = Object.values(report.regression).every((value) => value && typeof value === 'object');

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  mobile.on('pageerror', (error) => report.pageErrors.push(`mobile: ${String(error)}`));
  mobile.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(`mobile: ${message.text()}`);
  });
  await mobile.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await mobile.waitForFunction(() => window.__CAT_V446_READY__ === 'webgl2', null, { timeout: 40_000 });
  await mobile.evaluate(() => {
    window.__CAT_V446_SET_SAMPLE__('blink_check', 0.45);
    window.__CAT_V446_SET_CAMERA_TARGET__(0.214, 0, 0.205, 0.16);
    window.__CAT_V446_SET_EXPRESSION__({ auto: false, autoBlink: false, blink: 0.55, blinkEnabled: true });
  });
  await waitFrames(mobile, 10);
  const mobilePath = path.join(qaDir, 'CAT_KAOPU_V446_MOBILE_390x844_2026-09-16.png');
  const mobileBuffer = await mobile.screenshot({ path: mobilePath, fullPage: false });
  report.mobile = {
    screenshot: { path: path.relative(moduleRoot, mobilePath), bytes: mobileBuffer.length, sha256: sha256(mobileBuffer) },
    overflowPx: await mobile.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth)),
    ready: await mobile.evaluate(() => window.__CAT_V446_READY__),
    geometry: await mobile.evaluate(() => window.__CAT_V446_EYE_REGION_GEOMETRY__),
  };
  report.assertions.mobileWebgl2 = report.mobile.ready === 'webgl2';
  report.assertions.mobileNoHorizontalOverflow = report.mobile.overflowPx === 0;
  report.assertions.mobileSingleCarrier = report.mobile.geometry?.pieces === 1;

  const failedAssertions = Object.entries(report.assertions).filter(([, value]) => value !== true);
  if (failedAssertions.length) throw new Error(`browser assertions failed: ${failedAssertions.map(([key]) => key).join(', ')}`);
  if (report.pageErrors.length || report.consoleErrors.length) throw new Error('browser emitted page or console errors');
} catch (error) {
  failure = error;
  report.failure = String(error?.stack ?? error);
} finally {
  await browser.close();
  const reportPath = path.join(qaDir, 'CAT_KAOPU_V446_BROWSER_RUNTIME_QA_2026-09-16.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

if (failure) throw failure;
console.log(JSON.stringify({ version: report.version, ready: report.ready, geometry: report.geometry, assertions: report.assertions }, null, 2));
