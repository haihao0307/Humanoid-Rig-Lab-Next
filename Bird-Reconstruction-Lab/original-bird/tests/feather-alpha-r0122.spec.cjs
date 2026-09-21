const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const ARTIFACT_DIR = path.resolve('artifacts/bird-r0122-browser-qa');
const URL = process.env.BIRD_QA_URL || 'http://127.0.0.1:4173/Bird-Reconstruction-Lab/original-bird/workbench/original-bird-feather-alpha-r0122.html';

function parsePercent(value) {
  const match = String(value || '').match(/([0-9]+(?:\.[0-9]+)?)%/);
  return match ? Number(match[1]) : NaN;
}

async function readRuntime(page) {
  return page.evaluate(() => ({
    href: location.href,
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

async function persistEvidence(page, consoleEvents, name, extra = {}) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const runtime = await readRuntime(page);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, `${name}.png`),
    fullPage: true,
  });
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, `${name}.json`),
    JSON.stringify({
      capturedAt: new Date().toISOString(),
      runtime,
      consoleEvents,
      ...extra,
    }, null, 2),
  );
  return runtime;
}

test.describe.configure({ mode: 'serial' });
test.use({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  channel: 'chrome',
  headless: false,
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
  launchOptions: {
    args: [
      '--disable-blink-features=AutomationControlled',
      '--use-gl=swiftshader',
      '--enable-webgl',
    ],
  },
});

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
  page.on('requestfailed', (request) => {
    consoleEvents.push({
      type: 'requestfailed',
      text: `${request.url()} :: ${request.failure()?.errorText || 'UNKNOWN'}`,
    });
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.locator('header')).toContainText('Original Bird R0.12.2');

  await page.waitForFunction(
    () => {
      const ready = document.querySelector('#readyState')?.textContent || '';
      const status = document.querySelector('#status')?.textContent || '';
      return ready.includes('2/2') || /Viewer 启动失败|viewer init failed/i.test(status);
    },
    null,
    { timeout: 120_000 },
  );

  const startup = await persistEvidence(page, consoleEvents, 'r0122-startup', { requestedUrl: URL });
  expect(startup.status).not.toMatch(/Viewer 启动失败|viewer init failed/i);
  expect(startup.readyState).toContain('2/2');

  await page.waitForFunction(
    () => {
      const diff = document.querySelector('#diffValue')?.textContent || '';
      const status = document.querySelector('#status')?.textContent || '';
      return /%/.test(diff) || /失败|failed/i.test(status);
    },
    null,
    { timeout: 120_000 },
  );

  await page.waitForTimeout(2_500);
  const initial = await persistEvidence(page, consoleEvents, 'r0122-initial-full', { requestedUrl: URL });

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

  expect(finalRuntime.applyState).not.toBe('pending');
  expect(finalRuntime.status).not.toMatch(/Viewer 启动失败|差异检测失败/i);
  expect(report.parsed.sourceAtlasPathUsed).toBe(true);
  expect(report.parsed.forcedProbeUsed).toBe(false);
  expect(report.parsed.visibleDifferencePercent).toBeGreaterThan(1);
});
