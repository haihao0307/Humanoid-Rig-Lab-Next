import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root = process.cwd();
const evidenceDir = path.join(root, 'evidence', 'r92');
const qaPath = path.join(root, 'qa', 'CHICKEN_R92_BROWSER_QA.json');
const url = process.env.CHICKEN_R92_URL || 'http://127.0.0.1:8765/CHICKEN_V46_R9_2_HEAD_SHAPE.html';
const executablePath = process.env.CHROME_PATH;

if (!executablePath) throw new Error('CHROME_PATH is required');
fs.mkdirSync(evidenceDir, { recursive: true });
fs.mkdirSync(path.dirname(qaPath), { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader'
  ]
});

const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1
});

const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
page.on('console', message => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));
page.on('requestfailed', request => failedRequests.push({
  url: request.url(),
  error: request.failure()?.errorText || 'unknown'
}));

async function click(selector) {
  const item = page.locator(selector);
  await item.waitFor({ state: 'visible', timeout: 30000 });
  await item.click();
  await page.waitForTimeout(900);
}

async function capture(fileName) {
  await page.screenshot({
    path: path.join(evidenceDir, fileName),
    fullPage: false,
    animations: 'disabled'
  });
}

let runtime = null;
let fatal = null;
try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('canvas', { timeout: 60000 });
  await page.waitForFunction(() => {
    const status = document.querySelector('#status');
    return Boolean(window.__CHICKEN_R92_PATCH__ && status && status.textContent.trim().length > 0);
  }, { timeout: 120000 });
  await page.waitForTimeout(5000);

  runtime = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const error = document.querySelector('#error');
    const result = {
      patch: window.__CHICKEN_R92_PATCH__ || null,
      title: document.title,
      statusText: document.querySelector('#status')?.textContent?.trim() || '',
      canvas: canvas ? { width: canvas.width, height: canvas.height } : null,
      errorOverlay: error ? {
        display: getComputedStyle(error).display,
        text: error.textContent.trim()
      } : null,
      candidateMeshCount: null,
      geometry: null,
      stats: null,
      lexicalProbeError: null
    };
    try {
      if (typeof candidateMeshes !== 'undefined') {
        result.candidateMeshCount = candidateMeshes.length;
        let vertices = 0;
        let triangles = 0;
        let finite = true;
        let indexed = true;
        for (const mesh of candidateMeshes) {
          const geometry = mesh.geometry;
          const position = geometry?.getAttribute?.('position');
          const index = geometry?.getIndex?.();
          if (!position) { finite = false; continue; }
          vertices += position.count;
          if (index) triangles += index.count / 3;
          else { indexed = false; triangles += position.count / 3; }
          const array = position.array;
          for (let i = 0; i < array.length; i += Math.max(1, Math.floor(array.length / 4096))) {
            if (!Number.isFinite(array[i])) { finite = false; break; }
          }
        }
        result.geometry = { vertices, triangles, finite, indexed };
      }
      if (typeof stats !== 'undefined') result.stats = JSON.parse(JSON.stringify(stats));
    } catch (error) {
      result.lexicalProbeError = String(error?.stack || error);
    }
    return result;
  });

  await click('button[data-mat="neutral"]');
  await click('button[data-focus="head"]');

  await click('button[data-view="left"]');
  await capture('R92_HEAD_NEUTRAL_LEFT.png');

  await click('button[data-view="front"]');
  await capture('R92_HEAD_NEUTRAL_FRONT.png');

  await click('button[data-view="top"]');
  await capture('R92_HEAD_NEUTRAL_TOP.png');

  await click('button[data-view="threeQuarter"]');
  await capture('R92_HEAD_NEUTRAL_THREE_QUARTER.png');

  await click('button[data-view="left"]');
  await click('button[data-layout="compare"]');
  await capture('R92_COMPARE_NEUTRAL_LEFT.png');

  await click('button[data-layout="solo"]');
  await click('button[data-focus="whole"]');
  await click('button[data-view="threeQuarter"]');
  await capture('R92_WHOLE_NEUTRAL_THREE_QUARTER.png');
} catch (error) {
  fatal = String(error?.stack || error);
  try {
    await capture('R92_BROWSER_FAILURE.png');
  } catch {
    // Keep the original failure as the authoritative diagnostic.
  }
} finally {
  await browser.close();
}

const checks = {
  noFatalException: fatal === null,
  patchLoaded: runtime?.patch?.version === 'V4.6_R9.2_HEAD_SHAPE_RESTORE_CANDIDATE',
  correctTitle: runtime?.title?.includes('R9.2') === true,
  statusProduced: (runtime?.statusText?.length || 0) > 0,
  canvasAllocated: (runtime?.canvas?.width || 0) > 0 && (runtime?.canvas?.height || 0) > 0,
  errorOverlayHidden: runtime?.errorOverlay?.display === 'none',
  noPageErrors: pageErrors.length === 0,
  noConsoleErrors: consoleErrors.length === 0,
  noFailedRequests: failedRequests.length === 0,
  candidateMeshesPresent: runtime?.candidateMeshCount == null || runtime.candidateMeshCount > 0,
  sampledGeometryFinite: runtime?.geometry == null || runtime.geometry.finite === true,
  expectedCapturesWritten: [
    'R92_HEAD_NEUTRAL_LEFT.png',
    'R92_HEAD_NEUTRAL_FRONT.png',
    'R92_HEAD_NEUTRAL_TOP.png',
    'R92_HEAD_NEUTRAL_THREE_QUARTER.png',
    'R92_COMPARE_NEUTRAL_LEFT.png',
    'R92_WHOLE_NEUTRAL_THREE_QUARTER.png'
  ].every(name => fs.existsSync(path.join(evidenceDir, name)))
};

const report = {
  schema: 'life_ecosystem/chicken_r92_browser_qa@1.0',
  version: 'V4.6_R9.2_HEAD_SHAPE_RESTORE_CANDIDATE',
  environment: {
    browser: 'Chrome headless via Playwright Core',
    executablePath,
    url,
    viewport: [1440, 1000],
    rendererRequest: 'SwiftShader/ANGLE correctness path'
  },
  checks,
  passed: Object.values(checks).every(Boolean),
  runtime,
  fatal,
  consoleErrors,
  pageErrors,
  failedRequests,
  truthBoundary: {
    manualVisualAcceptance: false,
    anatomicalTruthClaimed: false,
    rigAuthorized: false,
    motionAuthorized: false
  }
};

fs.writeFileSync(qaPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exit(1);
