import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve('artifacts/bird-seagull-a-r004-browser-qa');
await fs.mkdir(root, { recursive: true });
const url = process.env.BIRD_SEAGULL_A_R004_QA_URL || 'http://127.0.0.1:4173/BIRD_SEAGULL_A_DIRECT_OPEN_R004/index.html?qa=1';
const consoleEntries = [];
const pageErrors = [];

async function auditPage(page, label) {
  page.on('console', message => consoleEntries.push({ label, type: message.type(), text: message.text() }));
  page.on('pageerror', error => pageErrors.push({ label, message: error.message, stack: error.stack || '' }));
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  assert(response && response.ok(), `${label}: page response was not OK`);
  await page.waitForFunction(() => document.body.dataset.ready === 'true', null, { timeout: 45000 });
  const qa = await page.evaluate(() => window.__BIRD_QA);
  assert(qa?.ready === true, `${label}: QA state not ready`);
  assert.equal(qa.vertexCount, 4416, `${label}: unexpected vertex count`);
  assert.equal(qa.triangleCount, 5624, `${label}: unexpected triangle count`);
  assert(qa.visiblePixels > 250, `${label}: model has too few visible pixels`);
  assert(qa.visibleCoverage > 0.0005, `${label}: model coverage is too small`);
  const status = await page.locator('#status').innerText();
  assert.match(status, /已显示/, `${label}: success status missing`);
  await page.screenshot({ path: path.join(root, `${label}-three-quarter.png`), fullPage: true });
  await page.locator('button[data-v="top"]').click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(root, `${label}-top.png`), fullPage: true });
  await page.locator('button[data-v="side"]').click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(root, `${label}-side.png`), fullPage: true });
  return { label, url, qa, status };
}

const browser = await chromium.launch({ headless: true });
try {
  const desktopContext = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const desktopPage = await desktopContext.newPage();
  const desktop = await auditPage(desktopPage, 'desktop');
  await desktopContext.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const mobilePage = await mobileContext.newPage();
  const mobile = await auditPage(mobilePage, 'mobile');
  await mobilePage.locator('#menu').click();
  await mobilePage.waitForTimeout(150);
  await mobilePage.screenshot({ path: path.join(root, 'mobile-panel-open.png'), fullPage: true });
  await mobileContext.close();

  assert.equal(pageErrors.length, 0, `browser page errors: ${JSON.stringify(pageErrors)}`);
  const unexpectedConsoleErrors = consoleEntries.filter(entry => entry.type === 'error');
  assert.equal(unexpectedConsoleErrors.length, 0, `console errors: ${JSON.stringify(unexpectedConsoleErrors)}`);

  const report = {
    generatedAt: new Date().toISOString(),
    desktop,
    mobile,
    pageErrors,
    consoleEntries
  };
  await fs.writeFile(path.join(root, 'qa-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
