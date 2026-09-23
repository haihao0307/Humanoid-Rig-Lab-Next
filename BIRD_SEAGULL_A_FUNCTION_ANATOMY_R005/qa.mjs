import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const url = process.env.BIRD_R005_QA_URL || 'http://127.0.0.1:4173/index.html?qa=local';
const root = path.resolve(process.env.BIRD_R005_QA_ROOT || 'artifacts/bird-seagull-r005-pages-live');
await fs.mkdir(root, { recursive: true });

async function audit(browser, label, contextOptions) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const pageErrors = [];
  const failedRequests = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(error.stack || error.message));
  page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText || '' }));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });

  let response = null;
  let state = null;
  let lastError = null;
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      response = await page.goto(`${url}${url.includes('?') ? '&' : '?'}attempt=${attempt}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => document.body.dataset.ready === 'true' || Boolean(document.body.dataset.error), null, { timeout: 30000 });
      await page.waitForTimeout(1000);
      state = await page.evaluate(() => {
        const canvas = document.getElementById('c');
        const gl = canvas?.getContext('webgl');
        let changedSamples = -1;
        if (gl && window.__BIRD_QA?.ready) {
          const pixel = new Uint8Array(4);
          changedSamples = 0;
          for (let yi = 1; yi < 30; yi++) for (let xi = 1; xi < 46; xi++) {
            const x = Math.min(canvas.width - 1, Math.floor((xi / 46) * canvas.width));
            const y = Math.min(canvas.height - 1, Math.floor((yi / 30) * canvas.height));
            gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
            if (Math.abs(pixel[0] - 7) + Math.abs(pixel[1] - 14) + Math.abs(pixel[2] - 18) > 28) changedSamples++;
          }
        }
        return {
          ready: document.body.dataset.ready,
          error: document.body.dataset.error,
          status: document.getElementById('status')?.textContent || '',
          qa: window.__BIRD_QA || null,
          hasWebGL: Boolean(gl),
          changedSamples,
          scrollWidth: document.documentElement.scrollWidth,
          canvas: canvas ? { width: canvas.width, height: canvas.height, clientWidth: canvas.clientWidth, clientHeight: canvas.clientHeight } : null
        };
      });
      if (response?.status() === 200 && state.ready === 'true' && state.qa?.ready && state.changedSamples >= 20) {
        lastError = null;
        break;
      }
      lastError = new Error(`attempt ${attempt} incomplete: ${JSON.stringify({ status: response?.status(), state })}`);
    } catch (error) {
      lastError = error;
    }
    await page.waitForTimeout(5000);
  }
  if (lastError) throw lastError;

  assert.match(state.status, /函数解剖载入完成/);
  assert.equal(state.qa.version, 'R0.05');
  assert.equal(state.qa.vertexCount, 4416);
  assert.equal(state.qa.triangleCount, 5624);
  assert.equal(state.qa.indexCount, 16872);
  assert.equal(state.qa.regionCount, 13);
  assert.equal(state.qa.jointCount, 21);
  assert.equal(state.qa.profileSampleCount, 64);
  assert.equal(state.qa.connectedComponents, 147);
  assert.equal(state.qa.payloadChars, 39900);
  assert(state.hasWebGL);
  assert(state.changedSamples >= 20);
  if (label === 'mobile') assert(state.scrollWidth <= 390, `mobile overflow: ${state.scrollWidth}`);

  await page.screenshot({ path: path.join(root, `${label}-initial.png`), fullPage: true });

  for (const view of ['top', 'bottom', 'front', 'back', 'side', 'persp']) {
    const active = await page.evaluate(selected => {
      const button = document.querySelector(`button[data-view="${selected}"]`);
      button?.click();
      return button?.classList.contains('active') || false;
    }, view);
    assert(active, `${label}: view failed ${view}`);
  }

  await page.evaluate(() => {
    document.querySelector('[data-mode="anatomy"]')?.click();
    document.querySelector('[data-region="4"]')?.click();
    for (const id of ['skeleton', 'measure', 'symmetry', 'wire']) document.getElementById(id)?.click();
    const slider = document.getElementById('sectionSlider');
    slider.value = '20';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-view="top"]')?.click();
  });
  await page.waitForTimeout(500);
  const interaction = await page.evaluate(() => ({
    qa: window.__BIRD_QA,
    currentRegion: document.getElementById('currentRegion')?.textContent || '',
    skeleton: document.getElementById('skeleton')?.textContent || '',
    measure: document.getElementById('measure')?.textContent || '',
    symmetry: document.getElementById('symmetry')?.textContent || '',
    wire: document.getElementById('wire')?.textContent || '',
    activeView: document.querySelector('[data-view].active')?.dataset.view || ''
  }));
  assert.equal(interaction.qa.mode, 'anatomy');
  assert.equal(interaction.qa.selectedRegion, 4);
  assert.equal(interaction.qa.activeView, 'top');
  assert.equal(interaction.qa.currentSection.index, 20);
  assert(interaction.qa.skeleton && interaction.qa.measurements && interaction.qa.symmetry && interaction.qa.wireframe);
  assert.match(interaction.currentRegion, /左翼外段/);
  await page.screenshot({ path: path.join(root, `${label}-anatomy-top.png`), fullPage: true });

  let leftBox = null;
  let rightBox = null;
  if (label === 'mobile') {
    await page.evaluate(() => document.getElementById('leftMenu')?.click());
    await page.waitForTimeout(300);
    leftBox = await page.locator('#controls').boundingBox();
    assert(leftBox && leftBox.x >= 0 && leftBox.x + leftBox.width <= 390, `left drawer outside viewport: ${JSON.stringify(leftBox)}`);
    await page.screenshot({ path: path.join(root, 'mobile-controls.png'), fullPage: true });
    await page.evaluate(() => { document.getElementById('leftMenu')?.click(); document.getElementById('rightMenu')?.click(); });
    await page.waitForTimeout(300);
    rightBox = await page.locator('#analysis').boundingBox();
    assert(rightBox && rightBox.x >= 0 && rightBox.x + rightBox.width <= 390, `right drawer outside viewport: ${JSON.stringify(rightBox)}`);
    await page.screenshot({ path: path.join(root, 'mobile-analysis.png'), fullPage: true });
  }

  assert.equal(pageErrors.length, 0, `${label} page errors: ${pageErrors.join('\n')}`);
  assert.equal(failedRequests.length, 0, `${label} request failures: ${JSON.stringify(failedRequests)}`);
  assert.equal(consoleErrors.length, 0, `${label} console errors: ${consoleErrors.join('\n')}`);
  await context.close();
  return { label, responseStatus: response.status(), state, interaction, leftBox, rightBox, pageErrors, failedRequests, consoleErrors };
}

const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
let output;
try {
  const desktop = await audit(browser, 'desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const mobile = await audit(browser, 'mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  output = { generatedAt: new Date().toISOString(), url, desktop, mobile, error: null };
} catch (error) {
  output = { generatedAt: new Date().toISOString(), url, desktop: null, mobile: null, error: error.stack || error.message };
} finally {
  await browser.close();
}
await fs.writeFile(path.join(root, 'qa-report.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
if (output.error) throw new Error(output.error);
