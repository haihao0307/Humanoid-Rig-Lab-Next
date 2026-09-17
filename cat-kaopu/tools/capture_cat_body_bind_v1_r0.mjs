import { chromium } from 'playwright';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const moduleRoot = path.resolve(here, '..');
const qaDir = path.join(moduleRoot, 'qa', 'body-bind-v1-r0');
const url = process.env.CAT_BODY_BIND_V1_URL ?? 'http://127.0.0.1:4173/cat-kaopu/body-bind-v1/index.html';
fs.mkdirSync(qaDir, { recursive: true });

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const waitFrames = async (page, count = 8) => {
  await page.evaluate(async (frames) => {
    for (let index = 0; index < frames; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, count);
};

const report = {
  schema: 'cat_kaopu/cat_body_bind_v1_r0_browser_qa@1.0',
  buildId: 'cat-body-bind-v1-r0-20260917',
  url,
  generatedAt: new Date().toISOString(),
  ready: null,
  title: null,
  pageErrors: [],
  consoleErrors: [],
  stats: null,
  screenshots: {},
  parameterSamples: {},
  assertions: {},
  mobile: {},
  visualAcceptance: false,
  bindAcceptance: false,
  motionAcceptance: false,
  productionReady: false,
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

let failure = null;
try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1050 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.pageErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
  });

  await page.goto(url, { waitUntil: 'load', timeout: 90_000 });
  await page.waitForFunction(() => window.__CAT_BODY_BIND_V1_READY__ !== undefined, null, { timeout: 120_000 });
  report.ready = await page.evaluate(() => window.__CAT_BODY_BIND_V1_READY__);
  report.title = await page.title();
  if (report.ready !== 'webgl2') {
    throw new Error(`Cat Body Bind V1 did not enter WebGL2 mode: ${report.ready}`);
  }

  report.stats = await page.evaluate(() => window.__CAT_BODY_BIND_V1_GET_METRICS__());
  const stage = page.locator('#stage');
  const capture = async (key, filename) => {
    await waitFrames(page, 10);
    const outputPath = path.join(qaDir, filename);
    const buffer = await stage.screenshot({ path: outputPath });
    report.screenshots[key] = {
      path: path.relative(moduleRoot, outputPath),
      bytes: buffer.length,
      sha256: sha256(buffer),
    };
  };

  for (const view of ['front', 'left', 'right', 'top', 'quarter-front', 'quarter-rear']) {
    await page.evaluate((name) => window.__CAT_BODY_BIND_V1_SET_VIEW__(name), view);
    await capture(view, `CAT_BODY_BIND_V1_R0_${view.toUpperCase().replaceAll('-', '_')}_2026-09-17.png`);
  }

  await page.evaluate(() => document.querySelector('#skeletonBtn')?.click());
  await page.evaluate(() => window.__CAT_BODY_BIND_V1_SET_VIEW__('quarter-front'));
  await capture('skeletonQuarter', 'CAT_BODY_BIND_V1_R0_SKELETON_QUARTER_2026-09-17.png');
  await page.evaluate(() => document.querySelector('#skeletonBtn')?.click());

  report.parameterSamples.default = await page.evaluate(() => window.__CAT_BODY_BIND_V1_GET_METRICS__());
  await page.evaluate(() => window.__CAT_BODY_BIND_V1_SET_PARAMS__({ thorax: 1.12, abdomen: 0.9, pelvis: 1.08, head: 1.06, muzzle: 1.08, limbs: 1.04, paws: 1.08, ears: 1.05 }));
  await page.waitForFunction(() => window.__CAT_BODY_BIND_V1_GET_METRICS__()?.params?.thorax === 1.12, null, { timeout: 120_000 });
  report.parameterSamples.strong = await page.evaluate(() => window.__CAT_BODY_BIND_V1_GET_METRICS__());
  await page.evaluate(() => window.__CAT_BODY_BIND_V1_SET_VIEW__('quarter-front'));
  await capture('strongQuarter', 'CAT_BODY_BIND_V1_R0_STRONG_PROFILE_QUARTER_2026-09-17.png');

  await page.evaluate(() => window.__CAT_BODY_BIND_V1_SET_PARAMS__({ thorax: 1, abdomen: 1, pelvis: 1, head: 1, muzzle: 1, limbs: 1, paws: 1, ears: 1 }));
  await page.waitForFunction(() => window.__CAT_BODY_BIND_V1_GET_METRICS__()?.params?.thorax === 1, null, { timeout: 120_000 });
  report.parameterSamples.restored = await page.evaluate(() => window.__CAT_BODY_BIND_V1_GET_METRICS__());

  report.assertions.webgl2 = report.ready === 'webgl2';
  report.assertions.noPageErrors = report.pageErrors.length === 0;
  report.assertions.noConsoleErrors = report.consoleErrors.length === 0;
  report.assertions.singleContinuousBodyObject = report.stats?.continuousBodyObjects === 1;
  report.assertions.noExternalAnimalMesh = report.stats?.externalAnimalMeshes === 0;
  report.assertions.noExternalImageTexture = report.stats?.externalImageTextures === 0;
  report.assertions.authoringResolution = (report.stats?.resolution ?? 0) >= 80;
  report.assertions.substantialSurface = (report.stats?.triangles ?? 0) >= 20_000
    && (report.stats?.triangles ?? Number.MAX_SAFE_INTEGER) <= 180_000;
  report.assertions.finiteBuildTime = Number.isFinite(report.stats?.buildMs)
    && report.stats.buildMs > 0
    && report.stats.buildMs < 90_000;
  report.assertions.notPrematurelySkinned = report.stats?.skinned === false;
  report.assertions.notPrematurelyApproved = report.stats?.visualAcceptance === false
    && report.stats?.bindAcceptance === false
    && report.stats?.motionAcceptance === false
    && report.stats?.productionReady === false;
  report.assertions.fixedViewsUnique = new Set([
    report.screenshots.front.sha256,
    report.screenshots.left.sha256,
    report.screenshots.right.sha256,
    report.screenshots.top.sha256,
    report.screenshots['quarter-front'].sha256,
    report.screenshots['quarter-rear'].sha256,
  ]).size === 6;
  report.assertions.skeletonChangesPixels = report.screenshots.skeletonQuarter.sha256 !== report.screenshots['quarter-front'].sha256;
  report.assertions.parametersRegenerateSurface = report.screenshots.strongQuarter.sha256 !== report.screenshots['quarter-front'].sha256
    && report.parameterSamples.strong?.params?.thorax === 1.12;
  report.assertions.defaultRestored = report.parameterSamples.restored?.params?.thorax === 1
    && report.parameterSamples.restored?.params?.abdomen === 1
    && report.parameterSamples.restored?.params?.pelvis === 1;

  const mobile = await context.newPage();
  mobile.on('pageerror', (error) => report.pageErrors.push(`mobile: ${String(error)}`));
  mobile.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(`mobile: ${message.text()}`);
  });
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(url, { waitUntil: 'load', timeout: 90_000 });
  await mobile.waitForFunction(() => window.__CAT_BODY_BIND_V1_READY__ === 'webgl2', null, { timeout: 120_000 });
  await mobile.evaluate(() => {
    document.querySelector('#panel')?.classList.add('hidden');
    window.__CAT_BODY_BIND_V1_SET_VIEW__('quarter-front');
  });
  await waitFrames(mobile, 12);
  const mobilePath = path.join(qaDir, 'CAT_BODY_BIND_V1_R0_MOBILE_390x844_2026-09-17.png');
  const mobileBuffer = await mobile.screenshot({ path: mobilePath, fullPage: false });
  report.mobile = {
    ready: await mobile.evaluate(() => window.__CAT_BODY_BIND_V1_READY__),
    overflowPx: await mobile.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth)),
    screenshot: {
      path: path.relative(moduleRoot, mobilePath),
      bytes: mobileBuffer.length,
      sha256: sha256(mobileBuffer),
    },
  };
  report.assertions.mobileWebgl2 = report.mobile.ready === 'webgl2';
  report.assertions.mobileNoHorizontalOverflow = report.mobile.overflowPx === 0;

  const failed = Object.entries(report.assertions).filter(([, value]) => value !== true);
  if (failed.length) throw new Error(`Cat Body Bind V1 R0 assertions failed: ${failed.map(([key]) => key).join(', ')}`);
  if (report.pageErrors.length || report.consoleErrors.length) throw new Error('browser emitted page or console errors');
} catch (error) {
  failure = error;
  report.failure = String(error?.stack ?? error);
} finally {
  await browser.close();
  const reportPath = path.join(qaDir, 'CAT_BODY_BIND_V1_R0_BROWSER_QA_2026-09-17.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

if (failure) throw failure;
console.log(JSON.stringify({
  buildId: report.buildId,
  ready: report.ready,
  triangles: report.stats?.triangles,
  buildMs: report.stats?.buildMs,
  assertions: report.assertions,
}, null, 2));
