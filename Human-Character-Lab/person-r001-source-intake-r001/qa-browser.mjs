import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const baseURL = process.env.HUMAN_R001_URL || 'http://127.0.0.1:8765/';
const output = process.env.HUMAN_R001_QA_OUTPUT || 'human-r001-qa';
fs.mkdirSync(output, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--use-angle=swiftshader',
    '--use-gl=angle'
  ]
});

async function loadAndAssert(page, label) {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('#loadState')?.textContent.includes('READY'), null, { timeout: 120000 });
  assert.equal((await page.locator('#triangles').textContent())?.trim(), '8,606');
  assert.equal((await page.locator('#modeLabel').textContent())?.trim(), '清理后人物');
  assert(await page.locator('#patchToggle').isChecked());

  await page.locator('[data-mode="original"]').click();
  assert.equal((await page.locator('#modeLabel').textContent())?.trim(), '原始短裤对照');
  await page.locator('[data-mode="gap"]').click();
  assert.equal((await page.locator('#modeLabel').textContent())?.trim(), '短裤移除后的源缺口');
  await page.locator('[data-mode="clean"]').click();
  assert.equal((await page.locator('#modeLabel').textContent())?.trim(), '清理后人物');

  await page.locator('[data-view="back"]').click();
  await page.waitForTimeout(250);
  await page.locator('[data-view="front"]').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(output, `${label}-clean-front.png`), fullPage: true });

  await page.locator('[data-mode="original"]').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(output, `${label}-original-shorts.png`), fullPage: true });
  await page.locator('[data-mode="gap"]').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(output, `${label}-source-gap.png`), fullPage: true });

  assert.deepEqual(errors, [], `${label} browser errors:\n${errors.join('\n')}`);
}

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });
  await loadAndAssert(await desktop.newPage(), 'desktop');
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await loadAndAssert(await mobile.newPage(), 'mobile');
  await mobile.close();

  console.log(JSON.stringify({ ok: true, baseURL, screenshots: fs.readdirSync(output).sort() }, null, 2));
} finally {
  await browser.close();
}
