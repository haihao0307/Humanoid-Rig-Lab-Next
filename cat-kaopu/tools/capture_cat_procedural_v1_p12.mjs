import { chromium } from 'playwright';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const moduleRoot = path.resolve(here, '..');
const qaDir = path.join(moduleRoot, 'qa', 'procedural-cat-v1-p1-2');
const url = process.env.CAT_PROCEDURAL_P12_URL ?? 'http://127.0.0.1:4173/cat-kaopu/procedural-cat-v1/index.html';
fs.mkdirSync(qaDir, { recursive: true });

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const waitFrames = async (page, count = 8) => {
  await page.evaluate(async (frames) => {
    for (let i = 0; i < frames; i += 1) await new Promise((resolve) => requestAnimationFrame(resolve));
  }, count);
};

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox']
});

const report = {
  schema: 'cat_kaopu/procedural_cat_p1_2_browser_qa@1.0',
  buildId: 'cat-procedural-body-v1-p1-2-silhouette-20260918',
  url,
  ready: null,
  pageErrors: [],
  consoleErrors: [],
  screenshots: {},
  assertions: {},
  baselineMetrics: null,
  variantMetrics: null,
  baselineDna: null,
  mobile: {},
  visualAcceptance: false,
  stableTopology: false,
  bindAcceptance: false,
  motionAcceptance: false,
  productionReady: false
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
  await page.waitForFunction(() => window.__CAT_PROCEDURAL_READY__ !== undefined, null, { timeout: 180_000 });
  report.ready = await page.evaluate(() => window.__CAT_PROCEDURAL_READY__);
  report.calibrationProfile = await page.evaluate(() => window.__CAT_PROCEDURAL_CALIBRATION__ ?? null);
  report.morphologyProfile = await page.evaluate(() => window.__CAT_PROCEDURAL_MORPHOLOGY__ ?? null);
  report.silhouetteProfile = await page.evaluate(() => window.__CAT_PROCEDURAL_SILHOUETTE__ ?? null);
  if (report.ready !== 'webgl2') throw new Error(`procedural cat did not enter WebGL2 mode: ${report.ready}`);
  report.baselineMetrics = await page.evaluate(() => window.__CAT_PROCEDURAL_METRICS__);
  report.baselineDna = await page.evaluate(() => window.__CAT_PROCEDURAL_GET_DNA__());

  if (!(await page.locator('#panel').evaluate((node) => node.classList.contains('hidden')))) await page.click('#panelBtn');
  const stage = page.locator('#stage');
  const capture = async (view, suffix = view) => {
    await page.evaluate((name) => window.__CAT_PROCEDURAL_SET_VIEW__(name), view);
    await waitFrames(page, 8);
    const filename = `CAT_PROCEDURAL_V1_P1_2_${suffix.toUpperCase().replaceAll('-', '_')}_2026-09-18.png`;
    const output = path.join(qaDir, filename);
    const buffer = await stage.screenshot({ path: output });
    report.screenshots[suffix] = {
      path: path.relative(moduleRoot, output),
      bytes: buffer.length,
      sha256: sha256(buffer)
    };
  };

  for (const view of ['front', 'left', 'right', 'top', 'quarter-front', 'quarter-rear']) await capture(view);

  await page.click('#skeletonBtn');
  await capture('quarter-front', 'quarter-front-skeleton');
  await page.click('#skeletonBtn');

  await page.click('#coatBtn');
  await capture('quarter-front', 'quarter-front-neutral');
  await capture('left', 'left-neutral');
  await page.click('#coatBtn');

  const variantDna = structuredClone(report.baselineDna);
  variantDna.meta.id = 'grey-tabby-a-p1-2-qa-variant';
  variantDna.meta.revision += 1;
  variantDna.global.overallBulk *= 1.035;
  variantDna.torso.thoraxWidth *= 1.025;
  variantDna.torso.lumbarWidth *= 0.985;
  variantDna.head.earTiltDeg += 3;
  variantDna.tail.lateral += 0.016;
  await page.evaluate(async (dna) => window.__CAT_PROCEDURAL_SET_DNA__(dna), variantDna);
  await waitFrames(page, 8);
  report.variantMetrics = await page.evaluate(() => window.__CAT_PROCEDURAL_METRICS__);
  await capture('quarter-front', 'variant');

  const validation = await page.evaluate(() => window.__CAT_PROCEDURAL_VALIDATE__());
  const dna = report.baselineDna;
  const seg = report.baselineMetrics.actualSegmentLengthsM;
  const close = (actual, expected, tolerance = 1e-7) => Math.abs(actual - expected) <= tolerance;

  report.assertions.webgl2 = report.ready === 'webgl2';
  report.assertions.noPageErrors = report.pageErrors.length === 0;
  report.assertions.noConsoleErrors = report.consoleErrors.length === 0;
  report.assertions.calibrationProfile = report.calibrationProfile === 'cat-procedural-body-v1-p1-calibration-20260918';
  report.assertions.morphologyProfile = report.morphologyProfile === 'cat-procedural-body-v1-p1-1-morphology-20260918';
  report.assertions.silhouetteProfile = report.silhouetteProfile === 'cat-procedural-body-v1-p1-2-silhouette-20260918';
  report.assertions.dnaValid = validation.valid === true;
  report.assertions.parameterCount = report.baselineMetrics.parameterCount >= 75;
  report.assertions.bodyLengthPreserved = close(dna.global.bodyLength, 0.475, 0.0006);
  report.assertions.shoulderHeightPreserved = close(dna.global.shoulderHeight, 0.2525, 0.0006);
  report.assertions.humerusLengthPreserved = close(seg.humerus, dna.forelimb.humerusLength);
  report.assertions.radiusLengthPreserved = close(seg.radius, dna.forelimb.radiusLength);
  report.assertions.metacarpalLengthPreserved = close(seg.metacarpal, dna.forelimb.metacarpalLength);
  report.assertions.femurLengthPreserved = close(seg.femur, dna.hindlimb.femurLength);
  report.assertions.tibiaLengthPreserved = close(seg.tibia, dna.hindlimb.tibiaLength);
  report.assertions.tarsusLengthPreserved = close(seg.tarsus, dna.hindlimb.tarsusLength);
  report.assertions.noExternalAnimalMeshes = report.baselineMetrics.externalAnimalMeshes === 0;
  report.assertions.noExternalImageTextures = report.baselineMetrics.externalImageTextures === 0;
  report.assertions.proceduralGeometry = report.baselineMetrics.proceduralGeometry === true;
  report.assertions.proceduralMaterial = report.baselineMetrics.proceduralMaterial === true;
  report.assertions.fourPawsGrounded = Object.values(report.baselineMetrics.pawGroundZ).every((value) => Math.abs(value) < 1e-6);
  report.assertions.authoringResolutionMaintained = report.baselineMetrics.resolution >= 112;
  report.assertions.tailSamplingRaised = dna.tail.segments >= 20;
  report.assertions.neckRatioBounded = dna.neck.length / dna.global.bodyLength < 0.18;
  report.assertions.earRatioBounded = dna.head.earHeight / dna.head.height < 0.50;
  report.assertions.variantHashChanged = report.baselineMetrics.dnaHash !== report.variantMetrics.dnaHash;
  report.assertions.variantPixelsChanged = report.screenshots['quarter-front'].sha256 !== report.screenshots.variant.sha256;
  report.assertions.fixedViewsDistinct = new Set(['front', 'left', 'right', 'top', 'quarter-front', 'quarter-rear'].map((view) => report.screenshots[view].sha256)).size >= 5;
  report.assertions.skeletonEvidenceCaptured = report.screenshots['quarter-front-skeleton'].bytes > 10_000;
  report.assertions.neutralSurfaceCaptured = report.screenshots['quarter-front-neutral'].bytes > 10_000 && report.screenshots['left-neutral'].bytes > 10_000;

  const mobile = await context.newPage();
  mobile.on('pageerror', (error) => report.pageErrors.push(`mobile: ${String(error)}`));
  mobile.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(`mobile: ${message.text()}`);
  });
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await mobile.waitForFunction(() => window.__CAT_PROCEDURAL_READY__ === 'webgl2', null, { timeout: 180_000 });
  const mobilePath = path.join(qaDir, 'CAT_PROCEDURAL_V1_P1_2_MOBILE_390x844_2026-09-18.png');
  const mobileBuffer = await mobile.screenshot({ path: mobilePath, fullPage: false });
  report.mobile = {
    ready: await mobile.evaluate(() => window.__CAT_PROCEDURAL_READY__),
    overflowPx: await mobile.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth)),
    screenshot: { path: path.relative(moduleRoot, mobilePath), bytes: mobileBuffer.length, sha256: sha256(mobileBuffer) }
  };
  report.assertions.mobileWebgl2 = report.mobile.ready === 'webgl2';
  report.assertions.mobileNoHorizontalOverflow = report.mobile.overflowPx === 0;

  const failed = Object.entries(report.assertions).filter(([, value]) => value !== true);
  if (failed.length) throw new Error(`browser assertions failed: ${failed.map(([key]) => key).join(', ')}`);
  if (report.pageErrors.length || report.consoleErrors.length) throw new Error('browser emitted page or console errors');
} catch (error) {
  failure = error;
  report.failure = String(error?.stack ?? error);
} finally {
  await browser.close();
  fs.writeFileSync(path.join(qaDir, 'CAT_PROCEDURAL_V1_P1_2_BROWSER_QA_2026-09-18.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

if (failure) throw failure;
console.log(JSON.stringify({ buildId: report.buildId, ready: report.ready, assertions: report.assertions }, null, 2));
