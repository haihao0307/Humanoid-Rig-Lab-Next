import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve('artifacts/bird-seagull-a-r004-browser-qa');
await fs.mkdir(root, { recursive: true });
const url = process.env.BIRD_SEAGULL_A_R004_QA_URL || 'http://127.0.0.1:4173/BIRD_SEAGULL_A_DIRECT_OPEN_R004/index.html?qa=1';
const consoleEntries = [];
const pageErrors = [];
const networkFailures = [];

async function captureState(page, label) {
  const state = await page.evaluate(() => ({
    ready: document.body.dataset.ready || '',
    error: document.body.dataset.error || '',
    status: document.getElementById('status')?.textContent || '',
    fatalHidden: document.getElementById('fatal')?.hidden,
    fatalText: document.getElementById('fatal')?.textContent || '',
    payloadType: typeof window.__BIRD_FORM,
    payloadLength: typeof window.__BIRD_FORM === 'string' ? window.__BIRD_FORM.length : null,
    qa: window.__BIRD_QA || null,
    canvas: (() => {
      const c = document.getElementById('c');
      return c ? { width: c.width, height: c.height, clientWidth: c.clientWidth, clientHeight: c.clientHeight } : null;
    })()
  }));
  await page.screenshot({ path: path.join(root, `${label}-diagnostic.png`), fullPage: true });
  await fs.writeFile(path.join(root, `${label}-state.json`), JSON.stringify(state, null, 2));
  return state;
}

async function auditPage(page, label) {
  page.on('console', message => consoleEntries.push({ label, type: message.type(), text: message.text() }));
  page.on('pageerror', error => pageErrors.push({ label, message: error.message, stack: error.stack || '' }));
  page.on('requestfailed', request => networkFailures.push({ label, url: request.url(), failure: request.failure()?.errorText || '' }));

  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  assert(response && response.ok(), `${label}: page response was not OK`);

  await page.waitForFunction(() => {
    return document.body.dataset.ready === 'true' || Boolean(document.body.dataset.error);
  }, null, { timeout: 20000 }).catch(() => {});

  const initialState = await captureState(page, label);
  if (initialState.ready !== 'true') {
    throw new Error(`${label}: workbench not ready; state=${JSON.stringify(initialState)}; console=${JSON.stringify(consoleEntries)}; pageErrors=${JSON.stringify(pageErrors)}; networkFailures=${JSON.stringify(networkFailures)}`);
  }

  const qa = initialState.qa;
  assert(qa?.ready === true, `${label}: QA state not ready`);
  assert.equal(qa.vertexCount, 4416, `${label}: unexpected vertex count`);
  assert.equal(qa.triangleCount, 5624, `${label}: unexpected triangle count`);
  assert(qa.visiblePixels > 250, `${label}: model has too few visible pixels`);
  assert(qa.visibleCoverage > 0.0005, `${label}: model coverage is too small`);
  assert.match(initialState.status, /已显示/, `${label}: success status missing`);

  await page.screenshot({ path: path.join(root, `${label}-three-quarter.png`), fullPage: true });
  await page.locator('button[data-v="top"]').click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(root, `${label}-top.png`), fullPage: true });
  await page.locator('button[data-v="side"]').click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(root, `${label}-side.png`), fullPage: true });
  return { label, url, qa, status: initialState.status };
}

const browser = await chromium.launch({ headless: true });
let desktop = null;
let mobile = null;
let caughtError = null;
try {
  const desktopContext = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const desktopPage = await desktopContext.newPage();
  desktop = await auditPage(desktopPage, 'desktop');
  await desktopContext.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const mobilePage = await mobileContext.newPage();
  mobile = await auditPage(mobilePage, 'mobile');
  await mobilePage.locator('#menu').click();
  await mobilePage.waitForTimeout(150);
  await mobilePage.screenshot({ path: path.join(root, 'mobile-panel-open.png'), fullPage: true });
  await mobileContext.close();

  assert.equal(pageErrors.length, 0, `browser page errors: ${JSON.stringify(pageErrors)}`);
  const unexpectedConsoleErrors = consoleEntries.filter(entry => entry.type === 'error');
  assert.equal(unexpectedConsoleErrors.length, 0, `console errors: ${JSON.stringify(unexpectedConsoleErrors)}`);
  assert.equal(networkFailures.length, 0, `network failures: ${JSON.stringify(networkFailures)}`);
} catch (error) {
  caughtError = error;
} finally {
  await browser.close();
}

const report = {
  generatedAt: new Date().toISOString(),
  desktop,
  mobile,
  pageErrors,
  networkFailures,
  consoleEntries,
  error: caughtError ? { message: caughtError.message, stack: caughtError.stack || '' } : null
};
await fs.writeFile(path.join(root, 'qa-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (caughtError) throw caughtError;
