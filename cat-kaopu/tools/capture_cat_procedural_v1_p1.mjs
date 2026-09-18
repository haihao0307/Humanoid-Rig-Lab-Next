import { chromium } from 'playwright';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const moduleRoot = path.resolve(here, '..');
const qaDir = path.join(moduleRoot, 'qa', 'procedural-cat-v1-p1');
const url = process.env.CAT_PROCEDURAL_URL ?? 'http://127.0.0.1:4173/cat-kaopu/procedural-cat-v1/index.html';
fs.mkdirSync(qaDir, { recursive: true });
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const waitFrames = async (page, count = 8) => page.evaluate(async (frames) => { for (let i = 0; i < frames; i += 1) await new Promise((resolve) => requestAnimationFrame(resolve)); }, count);

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'] });
const report = {
  schema: 'cat_kaopu/procedural_cat_p1_browser_qa@1.0',
  buildId: 'cat-procedural-body-v1-p1-authority-20260917',
  url,
  ready: null,
  pageErrors: [],
  consoleErrors: [],
  screenshots: {},
  assertions: {},
  baselineMetrics: null,
  variantMetrics: null,
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
  page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForFunction(() => window.__CAT_PROCEDURAL_READY__ !== undefined, null, { timeout: 150_000 });
  report.ready = await page.evaluate(() => window.__CAT_PROCEDURAL_READY__);
  if (report.ready !== 'webgl2') throw new Error(`procedural cat did not enter WebGL2 mode: ${report.ready}`);
  report.baselineMetrics = await page.evaluate(() => window.__CAT_PROCEDURAL_METRICS__);
  const stage = page.locator('#stage');
  const capture = async (view, suffix = '') => {
    await page.evaluate((name) => window.__CAT_PROCEDURAL_SET_VIEW__(name), view);
    await waitFrames(page, 8);
    const label = `${view.toUpperCase().replaceAll('-', '_')}${suffix}`;
    const filename = `CAT_PROCEDURAL_V1_P1_${label}_2026-09-17.png`;
    const output = path.join(qaDir, filename);
    const buffer = await stage.screenshot({ path: output });
    report.screenshots[`${view}${suffix.toLowerCase()}`] = { path: path.relative(moduleRoot, output), bytes: buffer.length, sha256: sha256(buffer) };
  };
  for (const view of ['front','left','right','top','quarter-front','quarter-rear']) await capture(view);
  await page.locator('#coatBtn').click();
  await waitFrames(page, 5);
  await capture('quarter-front', '_NEUTRAL');
  await page.locator('#coatBtn').click();
  await waitFrames(page, 5);

  const baselineDna = await page.evaluate(() => window.__CAT_PROCEDURAL_GET_DNA__());
  const variantDna = structuredClone(baselineDna);
  variantDna.meta.id = 'p1-qa-compact-variant';
  variantDna.meta.revision += 1;
  variantDna.global.shoulderHeight *= 1.04;
  variantDna.global.hipHeight *= 1.03;
  variantDna.torso.lumbarWidth *= 0.96;
  variantDna.head.earHeight *= 1.05;
  variantDna.tail.length *= 1.06;
  await page.evaluate(async (dna) => window.__CAT_PROCEDURAL_SET_DNA__(dna), variantDna);
  await waitFrames(page, 8);
  report.variantMetrics = await page.evaluate(() => window.__CAT_PROCEDURAL_METRICS__);
  const variantPath = path.join(qaDir, 'CAT_PROCEDURAL_V1_P1_VARIANT_2026-09-17.png');
  const variantBuffer = await stage.screenshot({ path: variantPath });
  report.screenshots.variant = { path: path.relative(moduleRoot, variantPath), bytes: variantBuffer.length, sha256: sha256(variantBuffer) };

  const validation = await page.evaluate(() => window.__CAT_PROCEDURAL_VALIDATE__());
  const authority = report.baselineMetrics.authorityCalibration ?? {};
  report.assertions.webgl2 = report.ready === 'webgl2';
  report.assertions.noPageErrors = report.pageErrors.length === 0;
  report.assertions.noConsoleErrors = report.consoleErrors.length === 0;
  report.assertions.dnaValid = validation.valid === true;
  report.assertions.parameterCount = report.baselineMetrics.parameterCount >= 70;
  report.assertions.noExternalAnimalMeshes = report.baselineMetrics.externalAnimalMeshes === 0;
  report.assertions.noExternalImageTextures = report.baselineMetrics.externalImageTextures === 0;
  report.assertions.proceduralGeometry = report.baselineMetrics.proceduralGeometry === true;
  report.assertions.proceduralMaterial = report.baselineMetrics.proceduralMaterial === true;
  report.assertions.fourPawsGrounded = Object.values(report.baselineMetrics.pawGroundZ).every((value) => Math.abs(value) < 1e-6);
  report.assertions.authorityProfile = authority.profile === 'european-shorthair-p1';
  report.assertions.shoulderAuthority = Math.abs(authority.shoulderHeightDeltaM) <= 0.001;
  report.assertions.longBoneAuthority = ['humerusDeltaM','radiusDeltaM','femurDeltaM','tibiaDeltaM'].every((key) => Math.abs(authority[key]) <= 1e-9);
  report.assertions.variantHashChanged = report.baselineMetrics.dnaHash !== report.variantMetrics.dnaHash;
  report.assertions.variantPixelsChanged = report.screenshots['quarter-front'].sha256 !== report.screenshots.variant.sha256;
  const fixed = ['front','left','right','top','quarter-front','quarter-rear'].map((key) => report.screenshots[key].sha256);
  report.assertions.fixedViewsDistinct = new Set(fixed).size >= 5;

  const mobile = await context.newPage();
  mobile.on('pageerror', (error) => report.pageErrors.push(`mobile: ${String(error)}`));
  mobile.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(`mobile: ${message.text()}`); });
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await mobile.waitForFunction(() => window.__CAT_PROCEDURAL_READY__ === 'webgl2', null, { timeout: 150_000 });
  const mobilePath = path.join(qaDir, 'CAT_PROCEDURAL_V1_P1_MOBILE_390x844_2026-09-17.png');
  const mobileBuffer = await mobile.screenshot({ path: mobilePath, fullPage: false });
  report.mobile = { ready: await mobile.evaluate(() => window.__CAT_PROCEDURAL_READY__), overflowPx: await mobile.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth)), screenshot: { path: path.relative(moduleRoot, mobilePath), bytes: mobileBuffer.length, sha256: sha256(mobileBuffer) } };
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
  fs.writeFileSync(path.join(qaDir, 'CAT_PROCEDURAL_V1_P1_BROWSER_QA_2026-09-17.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
if (failure) throw failure;
console.log(JSON.stringify({ buildId: report.buildId, ready: report.ready, assertions: report.assertions }, null, 2));
