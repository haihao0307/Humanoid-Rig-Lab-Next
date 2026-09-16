import { chromium } from 'playwright';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const moduleRoot = path.resolve(here, '..');
const qaDir = path.join(moduleRoot, 'qa');
const url = process.env.CAT_V442_URL ?? 'http://127.0.0.1:4173/cat-kaopu/workbench/CAT_KAOPU_CURRENT.html';
fs.mkdirSync(qaDir, { recursive: true });

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const waitFrames = async (page, count = 8) => {
  await page.evaluate(async (frames) => {
    for (let i = 0; i < frames; i += 1) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }
  }, count);
};

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--disable-gpu-sandbox',
  ],
});

const report = {
  schema: 'cat_kaopu/v442_browser_qa@1.0',
  version: 'V4.42',
  url,
  ready: null,
  pageErrors: [],
  consoleErrors: [],
  screenshots: {},
  metrics: {},
  geometry: null,
  assertions: {},
  mobile: {},
  visualAcceptance: false,
  productionReady: false,
};

let failure = null;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.pageErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
  });

  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForFunction(() => window.__CAT_V442_READY__ !== undefined, null, { timeout: 30_000 });
  report.ready = await page.evaluate(() => window.__CAT_V442_READY__);
  if (report.ready !== 'webgl2') {
    throw new Error(`V4.42 did not enter WebGL2 mode: ${report.ready}`);
  }

  report.geometry = await page.evaluate(() => window.__CAT_V442_EYELID_GEOMETRY__);
  const stage = page.locator('#stage');

  const captureStage = async (key, filename) => {
    await waitFrames(page, 10);
    const outputPath = path.join(qaDir, filename);
    const buffer = await stage.screenshot({ path: outputPath });
    report.metrics[key] = await page.evaluate(() => window.__CAT_V442_GET_METRICS__());
    report.screenshots[key] = {
      path: path.relative(moduleRoot, outputPath),
      bytes: buffer.length,
      sha256: sha256(buffer),
    };
  };

  const setView = async (view) => {
    await page.click(`[data-view="${view}"]`);
    await page.evaluate((zoom) => window.__CAT_V442_SET_CAMERA_TARGET__(0.214, 0, 0.205, zoom), view === 'front' ? 0.34 : 0.20);
    await waitFrames(page, 8);
  };

  const setBlink = async (blink, extra = {}) => {
    await page.evaluate(
      ({ value, options }) => window.__CAT_V442_SET_EXPRESSION__({
        auto: false,
        autoBlink: false,
        blink: value,
        gazeYaw: 0,
        gazePitch: 0,
        earLeft: 0,
        earRight: 0,
        lidThickness: 0.00042,
        lidDebug: false,
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

  await page.evaluate(() => window.__CAT_V442_SET_SAMPLE__('blink_check', 0.45));

  await setView('front');
  await setBlink(0);
  await captureStage('openFront', 'CAT_KAOPU_V442_EYE_OPEN_FRONT_2026-09-16.png');

  await setBlink(0.55);
  await captureStage('halfFront', 'CAT_KAOPU_V442_EYE_HALF_BLINK_FRONT_2026-09-16.png');

  await setBlink(1);
  await captureStage('closedFront', 'CAT_KAOPU_V442_EYE_CLOSED_FRONT_2026-09-16.png');

  await setView('quarter');
  await setBlink(0);
  await captureStage('openQuarter', 'CAT_KAOPU_V442_EYE_OPEN_QUARTER_2026-09-16.png');

  await setBlink(0.55);
  await captureStage('halfQuarter', 'CAT_KAOPU_V442_EYE_HALF_BLINK_QUARTER_2026-09-16.png');

  await setBlink(1);
  await captureStage('closedQuarter', 'CAT_KAOPU_V442_EYE_CLOSED_QUARTER_2026-09-16.png');

  await setView('left');
  await captureStage('closedLeft', 'CAT_KAOPU_V442_EYE_CLOSED_LEFT_2026-09-16.png');

  await setView('front');
  await setBlink(0.55, { lidDebug: true });
  await captureStage('debugFront', 'CAT_KAOPU_V442_EYELID_GEOMETRY_DEBUG_FRONT_2026-09-16.png');

  await setBlink(0.55, { lidThickness: 0.00015 });
  await captureStage('thinFront', 'CAT_KAOPU_V442_EYELID_THIN_FRONT_2026-09-16.png');

  await setBlink(0.55, { lidThickness: 0.00075 });
  await captureStage('thickFront', 'CAT_KAOPU_V442_EYELID_THICK_FRONT_2026-09-16.png');

  await page.evaluate(() => {
    window.__CAT_V442_SET_EXPRESSION__({ autoBlink: true, blink: 0, lidDebug: false, lidThickness: 0.00042 });
    window.__CAT_V442_SET_SAMPLE__('blink_check', 0.86);
  });
  await waitFrames(page, 10);
  report.metrics.automaticPeak = await page.evaluate(() => window.__CAT_V442_GET_METRICS__());

  const geom = report.geometry ?? {};
  report.assertions.webgl2 = report.ready === 'webgl2';
  report.assertions.noPageErrors = report.pageErrors.length === 0;
  report.assertions.noConsoleErrors = report.consoleErrors.length === 0;
  report.assertions.geometryPieces = geom.pieces === 4;
  report.assertions.geometryVertices = Number.isFinite(geom.vertices) && geom.vertices >= 1200;
  report.assertions.geometryTriangles = Number.isFinite(geom.triangles) && geom.triangles >= 1800;
  report.assertions.geometryHeadDriven = Number.isInteger(geom.headBoneIndex) && geom.headBoneIndex >= 0;
  report.assertions.openMetric = (report.metrics.openFront?.expression?.blink ?? 1) < 0.05;
  report.assertions.halfMetric = Math.abs((report.metrics.halfFront?.expression?.blink ?? -1) - 0.55) < 0.08;
  report.assertions.closedMetric = (report.metrics.closedFront?.expression?.blink ?? 0) > 0.95;
  report.assertions.quarterClosedMetric = (report.metrics.closedQuarter?.expression?.blink ?? 0) > 0.95;
  report.assertions.sideClosedMetric = (report.metrics.closedLeft?.expression?.blink ?? 0) > 0.95;
  report.assertions.autoBlinkPeak = (report.metrics.automaticPeak?.expression?.blink ?? 0) > 0.9;
  report.assertions.geometryMetrics = (report.metrics.halfFront?.eyelidGeometry?.vertices ?? 0) === geom.vertices
    && (report.metrics.halfFront?.eyelidGeometry?.triangles ?? 0) === geom.triangles;
  report.assertions.defaultThickness = Math.abs((report.metrics.halfFront?.eyelidGeometry?.thicknessM ?? 0) - 0.00042) < 1e-8;
  report.assertions.minThickness = Math.abs((report.metrics.thinFront?.eyelidGeometry?.thicknessM ?? 0) - 0.00015) < 1e-8;
  report.assertions.maxThickness = Math.abs((report.metrics.thickFront?.eyelidGeometry?.thicknessM ?? 0) - 0.00075) < 1e-8;
  report.assertions.payloadInvariant = await page.evaluate(() => window.__CAT_V442_BASELINE__?.payload === 'CATV440');
  report.assertions.boneCount = await page.evaluate(() => window.__CAT_V442_STATS__?.bones === 34);
  report.assertions.geometricLayer = await page.evaluate(() => window.__CAT_V442_STATS__?.geometricEyelidVolume === true && window.__CAT_V442_STATS__?.proceduralEyelid === false);
  report.assertions.openHalfPixelsDiffer = report.screenshots.openFront.sha256 !== report.screenshots.halfFront.sha256;
  report.assertions.halfClosedPixelsDiffer = report.screenshots.halfFront.sha256 !== report.screenshots.closedFront.sha256;
  report.assertions.frontQuarterPixelsDiffer = report.screenshots.closedFront.sha256 !== report.screenshots.closedQuarter.sha256;
  report.assertions.frontSidePixelsDiffer = report.screenshots.closedFront.sha256 !== report.screenshots.closedLeft.sha256;
  report.assertions.debugPixelsDiffer = report.screenshots.halfFront.sha256 !== report.screenshots.debugFront.sha256;

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  mobile.on('pageerror', (error) => report.pageErrors.push(`mobile: ${String(error)}`));
  mobile.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(`mobile: ${message.text()}`);
  });
  await mobile.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await mobile.waitForFunction(() => window.__CAT_V442_READY__ === 'webgl2', null, { timeout: 30_000 });
  await mobile.evaluate(() => {
    window.__CAT_V442_SET_SAMPLE__('blink_check', 0.45);
    window.__CAT_V442_SET_EXPRESSION__({
      auto: false,
      autoBlink: false,
      blink: 0.55,
      lidThickness: 0.00042,
      lidDebug: false,
      cornea: 0.82,
      pupilAdapt: 0.42,
    });
  });
  await waitFrames(mobile, 8);
  const mobilePath = path.join(qaDir, 'CAT_KAOPU_V442_MOBILE_390x844_2026-09-16.png');
  const mobileBuffer = await mobile.screenshot({ path: mobilePath, fullPage: false });
  report.mobile = {
    screenshot: {
      path: path.relative(moduleRoot, mobilePath),
      bytes: mobileBuffer.length,
      sha256: sha256(mobileBuffer),
    },
    overflowPx: await mobile.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth)),
    ready: await mobile.evaluate(() => window.__CAT_V442_READY__),
    geometry: await mobile.evaluate(() => window.__CAT_V442_EYELID_GEOMETRY__),
  };
  report.assertions.mobileNoHorizontalOverflow = report.mobile.overflowPx === 0;
  report.assertions.mobileWebgl2 = report.mobile.ready === 'webgl2';
  report.assertions.mobileGeometryPieces = report.mobile.geometry?.pieces === 4;

  const failedAssertions = Object.entries(report.assertions).filter(([, value]) => value !== true);
  if (failedAssertions.length) {
    throw new Error(`browser assertions failed: ${failedAssertions.map(([key]) => key).join(', ')}`);
  }
  if (report.pageErrors.length || report.consoleErrors.length) {
    throw new Error('browser emitted page or console errors');
  }
} catch (error) {
  failure = error;
  report.failure = String(error?.stack ?? error);
} finally {
  await browser.close();
  const reportPath = path.join(qaDir, 'CAT_KAOPU_V442_BROWSER_RUNTIME_QA_2026-09-16.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

if (failure) throw failure;
console.log(JSON.stringify({ version: report.version, ready: report.ready, geometry: report.geometry, assertions: report.assertions }, null, 2));
