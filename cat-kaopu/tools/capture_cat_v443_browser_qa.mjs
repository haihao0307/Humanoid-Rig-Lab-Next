import { chromium } from 'playwright';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const moduleRoot = path.resolve(here, '..');
const qaDir = path.join(moduleRoot, 'qa');
const url = process.env.CAT_V443_URL ?? 'http://127.0.0.1:4173/cat-kaopu/workbench/CAT_KAOPU_CURRENT.html';
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
  schema: 'cat_kaopu/v443_browser_qa@1.0',
  version: 'V4.43',
  url,
  ready: null,
  pageErrors: [],
  consoleErrors: [],
  screenshots: {},
  metrics: {},
  orbitalGeometry: null,
  eyelidGeometry: null,
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
  await page.waitForFunction(() => window.__CAT_V443_READY__ !== undefined, null, { timeout: 30_000 });
  report.ready = await page.evaluate(() => window.__CAT_V443_READY__);
  if (report.ready !== 'webgl2') throw new Error(`V4.43 did not enter WebGL2 mode: ${report.ready}`);

  report.orbitalGeometry = await page.evaluate(() => window.__CAT_V443_ORBITAL_GEOMETRY__);
  report.eyelidGeometry = await page.evaluate(() => window.__CAT_V443_EYELID_GEOMETRY__);
  const stage = page.locator('#stage');

  const captureStage = async (key, filename) => {
    await waitFrames(page, 10);
    const outputPath = path.join(qaDir, filename);
    const buffer = await stage.screenshot({ path: outputPath });
    report.metrics[key] = await page.evaluate(() => window.__CAT_V443_GET_METRICS__());
    report.screenshots[key] = {
      path: path.relative(moduleRoot, outputPath),
      bytes: buffer.length,
      sha256: sha256(buffer),
    };
  };

  const setView = async (view) => {
    await page.click(`[data-view="${view}"]`);
    const zoom = view === 'front' ? 0.28 : 0.20;
    await page.evaluate((value) => window.__CAT_V443_SET_CAMERA_TARGET__(0.214, 0, 0.205, value), zoom);
    await waitFrames(page, 8);
  };

  const setExpression = async (blink, options = {}) => {
    await page.evaluate(
      ({ value, extra }) => window.__CAT_V443_SET_EXPRESSION__({
        auto: false,
        autoBlink: false,
        blink: value,
        gazeYaw: 0,
        gazePitch: 0,
        earLeft: 0,
        earRight: 0,
        lidThickness: 0.00042,
        lidDebug: false,
        orbitEnabled: true,
        orbitDebug: false,
        orbitStrength: 0.78,
        orbitCompression: 0.55,
        cornea: 0.86,
        pupilAdapt: 0.42,
        eyeEnabled: true,
        blinkEnabled: true,
        corneaEnabled: true,
        furEnabled: true,
        ...extra,
      }),
      { value: blink, extra: options },
    );
  };

  await page.evaluate(() => window.__CAT_V443_SET_SAMPLE__('blink_check', 0.45));

  await setView('front');
  await setExpression(0, { orbitEnabled: false });
  await captureStage('openFrontOff', 'CAT_KAOPU_V443_OPEN_FRONT_ORBIT_OFF_2026-09-16.png');
  await setExpression(0);
  await captureStage('openFrontOn', 'CAT_KAOPU_V443_OPEN_FRONT_ORBIT_ON_2026-09-16.png');

  await setExpression(0.55, { orbitEnabled: false });
  await captureStage('halfFrontOff', 'CAT_KAOPU_V443_HALF_FRONT_ORBIT_OFF_2026-09-16.png');
  await setExpression(0.55);
  await captureStage('halfFrontOn', 'CAT_KAOPU_V443_HALF_FRONT_ORBIT_ON_2026-09-16.png');

  await setExpression(1, { orbitEnabled: false });
  await captureStage('closedFrontOff', 'CAT_KAOPU_V443_CLOSED_FRONT_ORBIT_OFF_2026-09-16.png');
  await setExpression(1);
  await captureStage('closedFrontOn', 'CAT_KAOPU_V443_CLOSED_FRONT_ORBIT_ON_2026-09-16.png');

  await setView('quarter');
  await setExpression(0);
  await captureStage('openQuarter', 'CAT_KAOPU_V443_OPEN_QUARTER_2026-09-16.png');
  await setExpression(0.55);
  await captureStage('halfQuarter', 'CAT_KAOPU_V443_HALF_QUARTER_2026-09-16.png');
  await setExpression(1);
  await captureStage('closedQuarter', 'CAT_KAOPU_V443_CLOSED_QUARTER_2026-09-16.png');

  await setView('left');
  await setExpression(1);
  await captureStage('closedLeft', 'CAT_KAOPU_V443_CLOSED_LEFT_2026-09-16.png');

  await setView('front');
  await setExpression(0.55, { orbitDebug: true });
  await captureStage('debugFront', 'CAT_KAOPU_V443_ORBIT_DEBUG_FRONT_2026-09-16.png');
  await setExpression(0.55, { orbitStrength: 0, orbitCompression: 0 });
  await captureStage('zeroFront', 'CAT_KAOPU_V443_ORBIT_ZERO_FRONT_2026-09-16.png');
  await setExpression(0.55, { orbitStrength: 1, orbitCompression: 1 });
  await captureStage('maxFront', 'CAT_KAOPU_V443_ORBIT_MAX_FRONT_2026-09-16.png');

  await page.evaluate(() => {
    window.__CAT_V443_SET_EXPRESSION__({
      autoBlink: true,
      blink: 0,
      orbitEnabled: true,
      orbitDebug: false,
      orbitStrength: 0.78,
      orbitCompression: 0.55,
    });
    window.__CAT_V443_SET_SAMPLE__('blink_check', 0.86);
  });
  await waitFrames(page, 10);
  report.metrics.automaticPeak = await page.evaluate(() => window.__CAT_V443_GET_METRICS__());

  const orbital = report.orbitalGeometry ?? {};
  const eyelid = report.eyelidGeometry ?? {};
  report.assertions.webgl2 = report.ready === 'webgl2';
  report.assertions.noPageErrors = report.pageErrors.length === 0;
  report.assertions.noConsoleErrors = report.consoleErrors.length === 0;
  report.assertions.orbitalPieces = orbital.pieces === 4;
  report.assertions.orbitalVertices = orbital.vertices === 1372;
  report.assertions.orbitalTriangles = orbital.triangles === 2304;
  report.assertions.orbitalHeadDriven = Number.isInteger(orbital.headBoneIndex) && orbital.headBoneIndex >= 0;
  report.assertions.eyelidPiecesPreserved = eyelid.pieces === 4;
  report.assertions.openMetric = (report.metrics.openFrontOn?.expression?.blink ?? 1) < 0.05;
  report.assertions.halfMetric = Math.abs((report.metrics.halfFrontOn?.expression?.blink ?? -1) - 0.55) < 0.08;
  report.assertions.closedMetric = (report.metrics.closedFrontOn?.expression?.blink ?? 0) > 0.95;
  report.assertions.quarterClosedMetric = (report.metrics.closedQuarter?.expression?.blink ?? 0) > 0.95;
  report.assertions.sideClosedMetric = (report.metrics.closedLeft?.expression?.blink ?? 0) > 0.95;
  report.assertions.autoBlinkPeak = (report.metrics.automaticPeak?.expression?.blink ?? 0) > 0.9;
  report.assertions.orbitalMetrics = (report.metrics.halfFrontOn?.orbitalTissue?.vertices ?? 0) === 1372
    && (report.metrics.halfFrontOn?.orbitalTissue?.triangles ?? 0) === 2304
    && (report.metrics.halfFrontOn?.orbitalTissue?.pieces ?? 0) === 4;
  report.assertions.defaultStrength = Math.abs((report.metrics.halfFrontOn?.orbitalTissue?.strength ?? 0) - 0.78) < 1e-8;
  report.assertions.defaultCompression = Math.abs((report.metrics.halfFrontOn?.orbitalTissue?.compression ?? 0) - 0.55) < 1e-8;
  report.assertions.payloadInvariant = await page.evaluate(() => window.__CAT_V443_BASELINE__?.payload === 'CATV440');
  report.assertions.boneCount = await page.evaluate(() => window.__CAT_V443_STATS__?.bones === 34);
  report.assertions.orbitalFeature = await page.evaluate(() => window.__CAT_V443_STATS__?.orbitalSoftTissueTransition === true);
  report.assertions.openOnOffPixelsDiffer = report.screenshots.openFrontOff.sha256 !== report.screenshots.openFrontOn.sha256;
  report.assertions.halfOnOffPixelsDiffer = report.screenshots.halfFrontOff.sha256 !== report.screenshots.halfFrontOn.sha256;
  report.assertions.closedOnOffPixelsDiffer = report.screenshots.closedFrontOff.sha256 !== report.screenshots.closedFrontOn.sha256;
  report.assertions.zeroMaxPixelsDiffer = report.screenshots.zeroFront.sha256 !== report.screenshots.maxFront.sha256;
  report.assertions.debugPixelsDiffer = report.screenshots.halfFrontOn.sha256 !== report.screenshots.debugFront.sha256;
  report.assertions.frontQuarterPixelsDiffer = report.screenshots.closedFrontOn.sha256 !== report.screenshots.closedQuarter.sha256;
  report.assertions.frontSidePixelsDiffer = report.screenshots.closedFrontOn.sha256 !== report.screenshots.closedLeft.sha256;

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  mobile.on('pageerror', (error) => report.pageErrors.push(`mobile: ${String(error)}`));
  mobile.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(`mobile: ${message.text()}`);
  });
  await mobile.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await mobile.waitForFunction(() => window.__CAT_V443_READY__ === 'webgl2', null, { timeout: 30_000 });
  await mobile.evaluate(() => {
    window.__CAT_V443_SET_SAMPLE__('blink_check', 0.45);
    window.__CAT_V443_SET_EXPRESSION__({
      auto: false,
      autoBlink: false,
      blink: 0.55,
      lidThickness: 0.00042,
      orbitEnabled: true,
      orbitDebug: false,
      orbitStrength: 0.78,
      orbitCompression: 0.55,
    });
  });
  await waitFrames(mobile, 8);
  const mobilePath = path.join(qaDir, 'CAT_KAOPU_V443_MOBILE_390x844_2026-09-16.png');
  const mobileBuffer = await mobile.screenshot({ path: mobilePath, fullPage: false });
  report.mobile = {
    screenshot: {
      path: path.relative(moduleRoot, mobilePath),
      bytes: mobileBuffer.length,
      sha256: sha256(mobileBuffer),
    },
    overflowPx: await mobile.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth)),
    ready: await mobile.evaluate(() => window.__CAT_V443_READY__),
    orbitalGeometry: await mobile.evaluate(() => window.__CAT_V443_ORBITAL_GEOMETRY__),
  };
  report.assertions.mobileNoHorizontalOverflow = report.mobile.overflowPx === 0;
  report.assertions.mobileWebgl2 = report.mobile.ready === 'webgl2';
  report.assertions.mobileOrbitalPieces = report.mobile.orbitalGeometry?.pieces === 4;

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
  const reportPath = path.join(qaDir, 'CAT_KAOPU_V443_BROWSER_RUNTIME_QA_2026-09-16.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

if (failure) throw failure;
console.log(JSON.stringify({ version: report.version, ready: report.ready, orbitalGeometry: report.orbitalGeometry, assertions: report.assertions }, null, 2));
