const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const ARTIFACT_DIR = path.resolve('artifacts/bird-r0122-browser-qa');
const URL = 'http://127.0.0.1:4173/Bird-Reconstruction-Lab/original-bird/workbench/original-bird-feather-alpha-r0122.html';

function parsePercent(value) {
  const match = String(value || '').match(/([0-9]+(?:\.[0-9]+)?)%/);
  return match ? Number(match[1]) : NaN;
}

async function readRuntime(page) {
  return page.evaluate(() => ({
    readyState: document.querySelector('#readyState')?.textContent?.trim() || '',
    applyState: document.querySelector('#applyState')?.textContent?.trim() || '',
    status: document.querySelector('#status')?.textContent?.trim() || '',
    diffValue: document.querySelector('#diffValue')?.textContent?.trim() || '',
    alphaSource: document.querySelector('#alphaSource')?.textContent?.trim() || '',
    textureSize: document.querySelector('#textureSize')?.textContent?.trim() || '',
    selected: document.querySelector('#selected')?.textContent?.trim() || '',
    raw: document.querySelector('#raw')?.textContent?.trim() || '',
  }));
}

test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });

test('R0.12.2 loads both viewers, extracts source-atlas alpha, and creates a visible difference', async ({ page }) => {
  test.setTimeout(240_000);
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

  const consoleEvents = [];
  page.on('console', (message) => {
    consoleEvents.push({ type: message.type(), text: message.text() });
  });
  page.on('pageerror', (error) => {
    consoleEvents.push({ type: 'pageerror', text: error.message });
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await expect(page.locator('header')).toContainText('Original Bird R0.12.2');

  await page.waitForFunction(
    () => document.querySelector('#readyState')?.textContent?.includes('2/2'),
    null,
    { timeout: 150_000 },
  );

  await page.waitForFunction(
    () => {
      const diff = document.querySelector('#diffValue')?.textContent || '';
      const status = document.querySelector('#status')?.textContent || '';
      return /%/.test(diff) || /失败|failed/i.test(status);
    },
    null,
    { timeout: 150_000 },
  );

  await page.waitForTimeout(2_500);
  const initial = await readRuntime(page);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'r0122-initial-full.png'),
    fullPage: true,
  });

  await page.locator('[data-bg="sky"]').click();
  await page.locator('[data-view="wingtip"]').click();
  await page.waitForTimeout(1_800);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'r0122-sky-wingtip.png'),
    fullPage: true,
  });

  await page.locator('[data-bg="warm"]').click();
  await page.locator('[data-view="trailing"]').click();
  await page.waitForTimeout(1_800);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'r0122-warm-trailing-edge.png'),
    fullPage: true,
  });

  const finalRuntime = await readRuntime(page);
  const report = {
    url: URL,
    capturedAt: new Date().toISOString(),
    initial,
    final: finalRuntime,
    parsed: {
      visibleDifferencePercent: parsePercent(finalRuntime.diffValue),
      sourceAtlasPathUsed: ['RGBA', 'CHROMA'].includes(finalRuntime.alphaSource),
      forcedProbeUsed: finalRuntime.alphaSource === 'PROBE',
    },
    consoleEvents,
  };
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'r0122-browser-runtime.json'),
    JSON.stringify(report, null, 2),
  );

  expect(finalRuntime.readyState).toContain('2/2');
  expect(finalRuntime.applyState).not.toBe('pending');
  expect(finalRuntime.status).not.toMatch(/Viewer 启动失败|差异检测失败/i);
  expect(report.parsed.sourceAtlasPathUsed).toBe(true);
  expect(report.parsed.forcedProbeUsed).toBe(false);
  expect(report.parsed.visibleDifferencePercent).toBeGreaterThan(1);
});
