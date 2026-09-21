const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const url = process.env.BIRD_R017_QA_URL || 'http://127.0.0.1:4173/Bird-Reconstruction-Lab/original-bird/workbench/original-bird-gull-form-r0171.html?qa=1';
const out = path.resolve('artifacts/bird-r0171-browser-qa');

test.setTimeout(180000);

function safeName(name) {
  return name.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
}

test('R0.17.1 static form and basic flap render without page errors', async ({ page }) => {
  fs.mkdirSync(out, { recursive: true });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__BIRD_R017_READY__ === true, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.fonts.ready);

  const metrics = await page.evaluate(() => window.__BIRD_R017_METRICS__);
  expect(metrics).toBeTruthy();
  expect(metrics.revision).toBe('R0.17.1');
  expect(metrics.vertices).toBeGreaterThan(2500);
  expect(metrics.triangles).toBeGreaterThan(3000);
  expect(metrics.bodyCarrierContinuous).toBe(true);
  expect(metrics.leftWingContinuousSkinnedSurface).toBe(true);
  expect(metrics.rightWingContinuousSkinnedSurface).toBe(true);
  expect(metrics.mirroredWingNormalsCorrected).toBe(true);
  expect(metrics.webbedFeetPresent).toBe(true);
  expect(metrics.basicFlapDeformationAvailable).toBe(true);
  expect(metrics.advancedFlightAvailable).toBe(false);

  const canvasInfo = await page.evaluate(() => {
    const canvas = document.querySelector('#canvasWrap canvas');
    if (!canvas) return null;
    const box = canvas.getBoundingClientRect();
    return {
      width: canvas.width,
      height: canvas.height,
      cssWidth: box.width,
      cssHeight: box.height,
      dataLength: canvas.toDataURL('image/png').length,
    };
  });
  expect(canvasInfo).toBeTruthy();
  expect(canvasInfo.width).toBeGreaterThan(600);
  expect(canvasInfo.height).toBeGreaterThan(400);
  expect(canvasInfo.dataLength).toBeGreaterThan(10000);

  const candidate = page.locator('#candidate');
  const views = ['side', 'front', 'top', 'three', 'underside'];
  for (const view of views) {
    await page.click(`[data-view="${view}"]`);
    await page.waitForTimeout(320);
    await candidate.screenshot({
      path: path.join(out, `static-${safeName(view)}.png`),
      animations: 'disabled',
      timeout: 30000,
    });
  }

  await page.click('#flapBtn');
  await expect(page.locator('#modeState')).toContainText('basic flap');
  await page.waitForTimeout(900);
  await candidate.screenshot({ path: path.join(out, 'basic-flap-running.png'), animations: 'disabled', timeout: 30000 });

  await page.click('#staticBtn');
  await expect(page.locator('#modeState')).toContainText('static form');
  await page.locator('#phase').evaluate((node) => {
    node.disabled = false;
    node.value = '0.25';
    node.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(320);
  await candidate.screenshot({ path: path.join(out, 'basic-flap-phase-025.png'), animations: 'disabled', timeout: 30000 });

  const report = {
    url,
    metrics,
    canvasInfo,
    mode: await page.locator('#modeState').textContent(),
    view: await page.locator('#viewState').textContent(),
    fps: await page.locator('#fpsState').textContent(),
    consoleErrors,
    pageErrors,
    capturedViews: views,
  };
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
