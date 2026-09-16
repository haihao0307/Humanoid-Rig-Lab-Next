import { chromium } from 'playwright';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const qaDir = path.join(root, 'qa');
const url = process.env.CAT_V445_URL ?? 'http://127.0.0.1:4173/cat-kaopu/workbench/CAT_KAOPU_CURRENT.html';
fs.mkdirSync(qaDir, { recursive: true });
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const waitFrames = async (page, n = 10) => page.evaluate(async (count) => {
  for (let i = 0; i < count; i += 1) await new Promise((resolve) => requestAnimationFrame(resolve));
}, n);

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
});
const report = {
  schema: 'cat_kaopu/v445_browser_qa@1.0',
  version: 'V4.45', url, ready: null,
  pageErrors: [], consoleErrors: [], screenshots: {}, metrics: {}, geometry: null,
  assertions: {}, mobile: {}, visualAcceptance: false, productionReady: false,
};
let failure = null;
try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => report.pageErrors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForFunction(() => window.__CAT_V445_READY__ !== undefined, null, { timeout: 30_000 });
  report.ready = await page.evaluate(() => window.__CAT_V445_READY__);
  if (report.ready !== 'webgl2') throw new Error(`V4.45 not WebGL2: ${report.ready}`);
  report.geometry = await page.evaluate(() => window.__CAT_V445_PERIORBITAL_GEOMETRY__);
  const stage = page.locator('#stage');

  const capture = async (key, filename) => {
    await waitFrames(page, 12);
    const out = path.join(qaDir, filename);
    const buffer = await stage.screenshot({ path: out });
    report.screenshots[key] = { path: path.relative(root, out), bytes: buffer.length, sha256: sha256(buffer) };
    report.metrics[key] = await page.evaluate(() => window.__CAT_V445_GET_METRICS__());
  };
  const view = async (name, zoom = 0.20) => {
    await page.click(`[data-view="${name}"]`);
    await page.evaluate(({ z }) => window.__CAT_V445_SET_CAMERA_TARGET__(0.214, 0, 0.205, z), { z: zoom });
    await waitFrames(page, 10);
  };
  const expression = async (blink, extra = {}) => page.evaluate(({ blinkValue, options }) => {
    window.__CAT_V445_SET_SAMPLE__('blink_check', 0.45);
    return window.__CAT_V445_SET_EXPRESSION__({
      auto: false, autoBlink: false, blink: blinkValue,
      gazeYaw: 0, gazePitch: 0, earLeft: 0, earRight: 0,
      lidThickness: 0.00042, patchStrength: 0.78, smoothStrength: 0.92,
      arcStrength: 0.78, creaseStrength: 0.58, lidDebug: false,
      cornea: 0.86, pupilAdapt: 0.42, eyeEnabled: true,
      blinkEnabled: true, corneaEnabled: true, furEnabled: true,
      ...options,
    });
  }, { blinkValue: blink, options: extra });

  await view('front', 0.205);
  await expression(0); await capture('openFront', 'CAT_KAOPU_V445_OPEN_FRONT_2026-09-16.png');
  await expression(0.55); await capture('halfFront', 'CAT_KAOPU_V445_HALF_FRONT_2026-09-16.png');
  await expression(1); await capture('closedFront', 'CAT_KAOPU_V445_CLOSED_FRONT_2026-09-16.png');

  await expression(0, { smoothStrength: 0 }); await capture('smoothZeroFront', 'CAT_KAOPU_V445_SMOOTH_ZERO_FRONT_2026-09-16.png');
  await expression(0, { smoothStrength: 1 }); await capture('smoothMaxFront', 'CAT_KAOPU_V445_SMOOTH_MAX_FRONT_2026-09-16.png');
  await expression(1, { arcStrength: 0 }); await capture('arcZeroClosed', 'CAT_KAOPU_V445_ARC_ZERO_CLOSED_FRONT_2026-09-16.png');
  await expression(1, { arcStrength: 1 }); await capture('arcMaxClosed', 'CAT_KAOPU_V445_ARC_MAX_CLOSED_FRONT_2026-09-16.png');
  await expression(0.55, { lidDebug: true }); await capture('debugFront', 'CAT_KAOPU_V445_MLS_DEBUG_FRONT_2026-09-16.png');

  await view('quarter', 0.16);
  await expression(0); await capture('openQuarter', 'CAT_KAOPU_V445_OPEN_QUARTER_2026-09-16.png');
  await expression(0.55); await capture('halfQuarter', 'CAT_KAOPU_V445_HALF_QUARTER_2026-09-16.png');
  await expression(1); await capture('closedQuarter', 'CAT_KAOPU_V445_CLOSED_QUARTER_2026-09-16.png');

  await view('left', 0.14);
  await expression(1); await capture('closedLeft', 'CAT_KAOPU_V445_CLOSED_LEFT_2026-09-16.png');

  await view('front', 0.205);
  await page.evaluate(() => {
    window.__CAT_V445_SET_EXPRESSION__({ autoBlink: true, blink: 0, lidDebug: false, smoothStrength: 0.92, arcStrength: 0.78 });
    window.__CAT_V445_SET_SAMPLE__('blink_check', 0.86);
  });
  await waitFrames(page, 12);
  report.metrics.automaticPeak = await page.evaluate(() => window.__CAT_V445_GET_METRICS__());

  const geom = report.geometry ?? {};
  const stats = await page.evaluate(() => window.__CAT_V445_STATS__);
  Object.assign(report.assertions, {
    webgl2: report.ready === 'webgl2',
    noPageErrors: report.pageErrors.length === 0,
    noConsoleErrors: report.consoleErrors.length === 0,
    geometryPieces: geom.pieces === 2,
    geometryVertices: geom.vertices === 2910,
    geometryTriangles: geom.triangles === 5376,
    geometrySegments: geom.segments === 96,
    geometryRings: geom.rings === 14,
    mlsFitMode: geom.fitMode === 'quadratic_mls_lowpass_c1_frozen_boundary',
    headDriven: Number.isInteger(geom.headBoneIndex) && geom.headBoneIndex >= 0,
    openMetric: (report.metrics.openFront?.expression?.blink ?? 1) < 0.05,
    halfMetric: Math.abs((report.metrics.halfFront?.expression?.blink ?? -1) - 0.55) < 0.08,
    closedMetric: (report.metrics.closedFront?.expression?.blink ?? 0) > 0.95,
    autoBlinkPeak: (report.metrics.automaticPeak?.expression?.blink ?? 0) > 0.9,
    payloadInvariant: await page.evaluate(() => window.__CAT_V445_BASELINE__?.payload === 'CATV440'),
    boneCount: stats?.bones === 34,
    mlsFlag: stats?.mlsSmoothedPeriorbital === true,
    c1BoundaryFlag: stats?.c1FrozenBoundary === true,
    upperLidFlag: stats?.upperLidDominantClosure === true,
    openHalfPixelsDiffer: report.screenshots.openFront.sha256 !== report.screenshots.halfFront.sha256,
    halfClosedPixelsDiffer: report.screenshots.halfFront.sha256 !== report.screenshots.closedFront.sha256,
    smoothPixelsDiffer: report.screenshots.smoothZeroFront.sha256 !== report.screenshots.smoothMaxFront.sha256,
    arcPixelsDiffer: report.screenshots.arcZeroClosed.sha256 !== report.screenshots.arcMaxClosed.sha256,
    frontQuarterPixelsDiffer: report.screenshots.closedFront.sha256 !== report.screenshots.closedQuarter.sha256,
    frontSidePixelsDiffer: report.screenshots.closedFront.sha256 !== report.screenshots.closedLeft.sha256,
    debugPixelsDiffer: report.screenshots.halfFront.sha256 !== report.screenshots.debugFront.sha256,
  });

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  mobile.on('pageerror', (e) => report.pageErrors.push(`mobile: ${String(e)}`));
  mobile.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push(`mobile: ${m.text()}`); });
  await mobile.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await mobile.waitForFunction(() => window.__CAT_V445_READY__ === 'webgl2', null, { timeout: 30_000 });
  await mobile.evaluate(() => {
    window.__CAT_V445_SET_SAMPLE__('blink_check', 0.45);
    window.__CAT_V445_SET_EXPRESSION__({ auto: false, autoBlink: false, blink: 0.55, smoothStrength: 0.92, arcStrength: 0.78 });
  });
  await waitFrames(mobile, 10);
  const mobilePath = path.join(qaDir, 'CAT_KAOPU_V445_MOBILE_390x844_2026-09-16.png');
  const mobileBuffer = await mobile.screenshot({ path: mobilePath, fullPage: false });
  report.mobile = {
    screenshot: { path: path.relative(root, mobilePath), bytes: mobileBuffer.length, sha256: sha256(mobileBuffer) },
    overflowPx: await mobile.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth)),
    ready: await mobile.evaluate(() => window.__CAT_V445_READY__),
    geometry: await mobile.evaluate(() => window.__CAT_V445_PERIORBITAL_GEOMETRY__),
  };
  report.assertions.mobileWebgl2 = report.mobile.ready === 'webgl2';
  report.assertions.mobileNoHorizontalOverflow = report.mobile.overflowPx === 0;
  report.assertions.mobileGeometry = report.mobile.geometry?.vertices === 2910;

  const failed = Object.entries(report.assertions).filter(([, v]) => v !== true);
  if (failed.length) throw new Error(`browser assertions failed: ${failed.map(([k]) => k).join(', ')}`);
  if (report.pageErrors.length || report.consoleErrors.length) throw new Error('browser emitted errors');
} catch (error) {
  failure = error;
  report.failure = String(error?.stack ?? error);
} finally {
  await browser.close();
  fs.writeFileSync(path.join(qaDir, 'CAT_KAOPU_V445_BROWSER_RUNTIME_QA_2026-09-16.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
if (failure) throw failure;
console.log(JSON.stringify({ version: report.version, ready: report.ready, geometry: report.geometry, assertions: report.assertions }, null, 2));
