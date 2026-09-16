import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root = process.cwd();
const evidenceDir = path.join(root, 'evidence', 'r93');
const qaPath = path.join(root, 'qa', 'CHICKEN_R93_BROWSER_QA.json');
const candidateUrl = process.env.CHICKEN_R93_URL || 'http://127.0.0.1:8765/CHICKEN_V46_R9_3_HEAD_SHAPE.html';
const baselineUrl = process.env.CHICKEN_R91_URL || 'http://127.0.0.1:8765/CHICKEN_V46_R9_1.html';
const executablePath = process.env.CHROME_PATH;
if (!executablePath) throw new Error('CHROME_PATH is required');
fs.mkdirSync(evidenceDir, { recursive: true });
fs.mkdirSync(path.dirname(qaPath), { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']
});

const diagnostics = { consoleErrors: [], pageErrors: [], failedRequests: [] };
function attachDiagnostics(page, prefix) {
  page.on('console', message => { if (message.type() === 'error') diagnostics.consoleErrors.push(`${prefix}: ${message.text()}`); });
  page.on('pageerror', error => diagnostics.pageErrors.push(`${prefix}: ${String(error?.stack || error)}`));
  page.on('requestfailed', request => diagnostics.failedRequests.push({ page: prefix, url: request.url(), error: request.failure()?.errorText || 'unknown' }));
}
async function click(page, selector, settle = 900) {
  const item = page.locator(selector);
  await item.waitFor({ state: 'visible', timeout: 60000 });
  await item.click();
  await page.waitForTimeout(settle);
}
async function capture(page, fileName) {
  await page.screenshot({ path: path.join(evidenceDir, fileName), fullPage: false, animations: 'disabled' });
}
async function openWorkbench(url, patchName = null) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  attachDiagnostics(page, patchName || 'R91');
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('canvas', { timeout: 60000 });
  await page.waitForFunction(({ patchName }) => {
    const status = document.querySelector('#status');
    const patchReady = !patchName || Boolean(window[patchName]);
    return patchReady && status && status.textContent.trim().length > 0;
  }, { patchName }, { timeout: 120000 });
  await page.waitForTimeout(5000);
  return page;
}
async function setNeutralHead(page) {
  await click(page, 'button[data-mat="neutral"]');
  await click(page, 'button[data-layout="solo"]');
  await click(page, 'button[data-focus="head"]');
}

let runtime = null;
let fatal = null;
try {
  const candidate = await openWorkbench(candidateUrl, '__CHICKEN_R93_PATCH__');
  runtime = await candidate.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const error = document.querySelector('#error');
    return {
      patch: window.__CHICKEN_R93_PATCH__ || null,
      headAudit: window.__CHICKEN_R93_LAST_HEAD_AUDIT__ || null,
      title: document.title,
      statusText: document.querySelector('#status')?.textContent?.trim() || '',
      canvas: canvas ? { width: canvas.width, height: canvas.height } : null,
      errorOverlay: error ? { display: getComputedStyle(error).display, text: error.textContent.trim() } : null
    };
  });
  await setNeutralHead(candidate);
  await click(candidate, 'button[data-view="left"]');
  await capture(candidate, 'R93_HEAD_NEUTRAL_LEFT.png');
  await click(candidate, 'button[data-view="right"]');
  await capture(candidate, 'R93_HEAD_NEUTRAL_RIGHT.png');
  await click(candidate, 'button[data-view="front"]');
  await capture(candidate, 'R93_HEAD_NEUTRAL_FRONT.png');
  await click(candidate, 'button[data-view="top"]');
  await capture(candidate, 'R93_HEAD_NEUTRAL_TOP.png');
  await click(candidate, 'button[data-view="threeQuarter"]');
  await capture(candidate, 'R93_HEAD_NEUTRAL_THREE_QUARTER.png');
  await click(candidate, 'button[data-focus="whole"]');
  await click(candidate, 'button[data-view="threeQuarter"]');
  await capture(candidate, 'R93_WHOLE_NEUTRAL_THREE_QUARTER.png');
  await click(candidate, 'button[data-mat="procedural"]');
  await capture(candidate, 'R93_WHOLE_PROCEDURAL_THREE_QUARTER.png');
  await candidate.close();

  const baseline = await openWorkbench(baselineUrl, null);
  await setNeutralHead(baseline);
  await click(baseline, 'button[data-view="left"]');
  await capture(baseline, 'R91_BASELINE_HEAD_NEUTRAL_LEFT.png');
  await click(baseline, 'button[data-view="threeQuarter"]');
  await capture(baseline, 'R91_BASELINE_HEAD_NEUTRAL_THREE_QUARTER.png');
  await baseline.close();
} catch (error) {
  fatal = String(error?.stack || error);
} finally {
  await browser.close();
}

const expectedCaptures = [
  'R93_HEAD_NEUTRAL_LEFT.png','R93_HEAD_NEUTRAL_RIGHT.png','R93_HEAD_NEUTRAL_FRONT.png',
  'R93_HEAD_NEUTRAL_TOP.png','R93_HEAD_NEUTRAL_THREE_QUARTER.png',
  'R93_WHOLE_NEUTRAL_THREE_QUARTER.png','R93_WHOLE_PROCEDURAL_THREE_QUARTER.png',
  'R91_BASELINE_HEAD_NEUTRAL_LEFT.png','R91_BASELINE_HEAD_NEUTRAL_THREE_QUARTER.png'
];
const audit = runtime?.headAudit;
const checks = {
  noFatalException: fatal === null,
  patchLoaded: runtime?.patch?.version === 'V4.6_R9.3_LOCAL_HEAD_RESTORE_CANDIDATE',
  correctTitle: runtime?.title?.includes('R9.3') === true,
  statusProduced: (runtime?.statusText?.length || 0) > 0,
  canvasAllocated: (runtime?.canvas?.width || 0) > 0 && (runtime?.canvas?.height || 0) > 0,
  errorOverlayHidden: runtime?.errorOverlay?.display === 'none',
  shapeAuditProduced: audit !== null && audit !== undefined,
  shapeFinite: audit?.nonFinite === 0,
  lowerNeckGuardHeld: audit?.nonHeadMoved === 0,
  stationXMonotonic: audit?.stationXMonotonic === true,
  boundedDisplacement: typeof audit?.maxDisplacement === 'number' && audit.maxDisplacement > 0 && audit.maxDisplacement < 0.03,
  boundedRoof: typeof audit?.bounds?.max?.[1] === 'number' && audit.bounds.max[1] < 1.01,
  shortenedBill: typeof audit?.bounds?.max?.[0] === 'number' && audit.bounds.max[0] < 0.51,
  noPageErrors: diagnostics.pageErrors.length === 0,
  noConsoleErrors: diagnostics.consoleErrors.length === 0,
  noFailedRequests: diagnostics.failedRequests.length === 0,
  expectedCapturesWritten: expectedCaptures.every(name => fs.existsSync(path.join(evidenceDir, name)))
};
const report = {
  schema: 'life_ecosystem/chicken_r93_browser_qa@1.0',
  version: 'V4.6_R9.3_LOCAL_HEAD_RESTORE_CANDIDATE',
  environment: { browser: 'Chrome headless via Playwright Core', executablePath, candidateUrl, baselineUrl, viewport: [1440,1000], rendererRequest: 'SwiftShader/ANGLE correctness path' },
  checks,
  passed: Object.values(checks).every(Boolean),
  runtime,
  fatal,
  ...diagnostics,
  expectedCaptures,
  truthBoundary: { manualVisualAcceptance: false, visualGatePassed: false, anatomicalTruthClaimed: false, rigAuthorized: false, motionAuthorized: false }
};
fs.writeFileSync(qaPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exit(1);
