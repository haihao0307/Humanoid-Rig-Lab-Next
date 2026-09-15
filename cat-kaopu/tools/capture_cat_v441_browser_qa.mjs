import { chromium } from 'playwright';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const moduleRoot = path.resolve(here, '..');
const qaDir = path.join(moduleRoot, 'qa');
const url = process.env.CAT_V441_URL ?? 'http://127.0.0.1:4173/cat-kaopu/workbench/CAT_KAOPU_CURRENT.html';
fs.mkdirSync(qaDir, { recursive: true });

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const waitFrames = async (page, count = 4) => {
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
  schema: 'cat_kaopu/v441_browser_qa@1.1',
  version: 'V4.41',
  url,
  ready: null,
  pageErrors: [],
  consoleErrors: [],
  screenshots: {},
  metrics: {},
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
  await page.waitForFunction(() => window.__CAT_V441_READY__ !== undefined, null, { timeout: 30_000 });
  report.ready = await page.evaluate(() => window.__CAT_V441_READY__);
  if (report.ready !== 'webgl2') {
    throw new Error(`V4.41 did not enter WebGL2 mode: ${report.ready}`);
  }

  const stage = page.locator('#stage');
  const captureStage = async (key, filename) => {
    await waitFrames(page, 8);
    const outputPath = path.join(qaDir, filename);
    const buffer = await stage.screenshot({ path: outputPath });
    report.metrics[key] = await page.evaluate(() => window.__CAT_V441_GET_METRICS__());
    report.screenshots[key] = {
      path: path.relative(moduleRoot, outputPath),
      bytes: buffer.length,
      sha256: sha256(buffer),
    };
  };
  const setView = async (view) => {
    await page.click(`[data-view="${view}"]`);
    await page.evaluate(() => window.__CAT_V441_SET_CAMERA_TARGET__(0.214, 0, 0.205, 0.34));
    await waitFrames(page, 8);
  };

  await setView('front');
  await page.evaluate(() => {
    window.__CAT_V441_SET_SAMPLE__('blink_check', 0.45);
    window.__CAT_V441_SET_CAMERA_TARGET__(0.214, 0, 0.205, 0.34);
    window.__CAT_V441_SET_EXPRESSION__({
      auto: false,
      autoBlink: false,
      blink: 0,
      gazeYaw: 0,
      gazePitch: 0,
      earLeft: 0,
      earRight: 0,
      cornea: 0.86,
      pupilAdapt: 0.42,
      eyeEnabled: true,
      blinkEnabled: true,
      corneaEnabled: true,
      furEnabled: true,
    });
  });
  await captureStage('open', 'CAT_KAOPU_V441_EYE_OPEN_FRONT_2026-09-15.png');

  await page.evaluate(() => window.__CAT_V441_SET_EXPRESSION__({ autoBlink: false, blink: 0.55 }));
  await captureStage('half', 'CAT_KAOPU_V441_EYE_HALF_BLINK_FRONT_2026-09-15.png');

  await setView('quarter');
  await captureStage('halfQuarter', 'CAT_KAOPU_V441_EYE_HALF_BLINK_QUARTER_2026-09-15.png');

  await setView('front');
  await page.evaluate(() => window.__CAT_V441_SET_EXPRESSION__({ autoBlink: false, blink: 1 }));
  await captureStage('closed', 'CAT_KAOPU_V441_EYE_CLOSED_FRONT_2026-09-15.png');

  await setView('quarter');
  await captureStage('closedQuarter', 'CAT_KAOPU_V441_EYE_CLOSED_QUARTER_2026-09-15.png');

  await setView('left');
  await captureStage('closedLeft', 'CAT_KAOPU_V441_EYE_CLOSED_LEFT_2026-09-15.png');

  await setView('front');
  await page.evaluate(() => {
    window.__CAT_V441_SET_EXPRESSION__({ autoBlink: true, blink: 0, cornea: 0.82, pupilAdapt: 0.42 });
    window.__CAT_V441_SET_SAMPLE__('blink_check', 0.86);
  });
  await waitFrames(page, 8);
  report.metrics.automaticPeak = await page.evaluate(() => window.__CAT_V441_GET_METRICS__());

  report.assertions.webgl2 = report.ready === 'webgl2';
  report.assertions.noPageErrors = report.pageErrors.length === 0;
  report.assertions.noConsoleErrors = report.consoleErrors.length === 0;
  report.assertions.openMetric = (report.metrics.open?.expression?.blink ?? 1) < 0.05;
  report.assertions.halfMetric = Math.abs((report.metrics.half?.expression?.blink ?? -1) - 0.55) < 0.08;
  report.assertions.halfQuarterMetric = Math.abs((report.metrics.halfQuarter?.expression?.blink ?? -1) - 0.55) < 0.08;
  report.assertions.closedMetric = (report.metrics.closed?.expression?.blink ?? 0) > 0.95;
  report.assertions.closedQuarterMetric = (report.metrics.closedQuarter?.expression?.blink ?? 0) > 0.95;
  report.assertions.closedLeftMetric = (report.metrics.closedLeft?.expression?.blink ?? 0) > 0.95;
  report.assertions.autoBlinkPeak = (report.metrics.automaticPeak?.expression?.blink ?? 0) > 0.9;
  report.assertions.openClosedPixelsDiffer = report.screenshots.open.sha256 !== report.screenshots.closed.sha256;
  report.assertions.openHalfPixelsDiffer = report.screenshots.open.sha256 !== report.screenshots.half.sha256;
  report.assertions.halfClosedPixelsDiffer = report.screenshots.half.sha256 !== report.screenshots.closed.sha256;
  report.assertions.frontQuarterPixelsDiffer = report.screenshots.closed.sha256 !== report.screenshots.closedQuarter.sha256;
  report.assertions.frontLeftPixelsDiffer = report.screenshots.closed.sha256 !== report.screenshots.closedLeft.sha256;
  report.assertions.payloadInvariant = await page.evaluate(() => window.__CAT_V441_BASELINE__?.payload === 'CATV440');
  report.assertions.boneCount = await page.evaluate(() => window.__CAT_V441_STATS__?.bones === 34);

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  mobile.on('pageerror', (error) => report.pageErrors.push(`mobile: ${String(error)}`));
  mobile.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(`mobile: ${message.text()}`);
  });
  await mobile.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await mobile.waitForFunction(() => window.__CAT_V441_READY__ === 'webgl2', null, { timeout: 30_000 });
  await mobile.evaluate(() => {
    window.__CAT_V441_SET_SAMPLE__('blink_check', 0.45);
    window.__CAT_V441_SET_EXPRESSION__({ auto: false, autoBlink: false, blink: 0.55, cornea: 0.82, pupilAdapt: 0.42 });
  });
  await waitFrames(mobile, 6);
  const mobilePath = path.join(qaDir, 'CAT_KAOPU_V441_MOBILE_390x844_2026-09-15.png');
  const mobileBuffer = await mobile.screenshot({ path: mobilePath, fullPage: false });
  report.mobile = {
    screenshot: { path: path.relative(moduleRoot, mobilePath), bytes: mobileBuffer.length, sha256: sha256(mobileBuffer) },
    overflowPx: await mobile.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth)),
    ready: await mobile.evaluate(() => window.__CAT_V441_READY__),
  };
  report.assertions.mobileNoHorizontalOverflow = report.mobile.overflowPx === 0;
  report.assertions.mobileWebgl2 = report.mobile.ready === 'webgl2';

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
  const reportPath = path.join(qaDir, 'CAT_KAOPU_V441_BROWSER_RUNTIME_QA_2026-09-15.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

if (failure) throw failure;
console.log(JSON.stringify({ version: report.version, ready: report.ready, assertions: report.assertions }, null, 2));
