'use strict';
// Compare the delivered R33 pose surface with the R34 skin-preview surface
// at identical poses and cameras, by reading depth rather than saving images.
const fs = require('fs');
const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const startedUTC = new Date().toISOString();
const cases = [
  { pose: 'bend', views: [['front', 0], ['side', Math.PI / 2], ['back', Math.PI]] },
  { pose: 'arms', views: [['front', 0], ['oblique', .7]] }
];
const ready = page => page.waitForFunction(() => window.bodyImplicitR02?.report().ready && !bodyImplicitR02.report().busy, null, { timeout: 180000 });

async function capture(page, version) {
  const output = {};
  const url = version === 'R33' ? 'http://127.0.0.1:8914/人物身体_R33_实时轮廓.html' : 'http://127.0.0.1:8914/workbench';
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await ready(page);
  for (const c of cases) {
    await page.evaluate(pose => bodyImplicitR02.motion(pose), c.pose);
    await ready(page);
    const surface = await page.evaluate(() => bodyImplicitR02.report().renderer.activeSurface);
    const expected = version === 'R33' ? 'pose-functions' : 'dynamic-body-p1';
    if (surface !== expected) throw Error(version + ' ' + c.pose + ' unexpectedly uses ' + surface);
    const id = version === 'R33' ? 'body-pose-embedded-r29' : 'body-dynamic-embedded-p1';
    const api = version === 'R33' ? 'bodyPoseFunctionsR29' : 'torsoStudyP1';
    const canvas = page.frameLocator('#' + id).locator('#body-view');
    for (const [view, yaw] of c.views) {
      await page.evaluate(y => bodyImplicitR02.setCamera({ yaw: y, pitch: .04, distance: 2.9, target: [0, -.16, 0] }), yaw);
      await page.waitForFunction(({ id, api }) => {
        const p = document.querySelector('#' + id)?.contentWindow?.[api]?.renderer.precisionReport();
        if (p?.lastError) throw Error(p.lastError);
        return p?.ready;
      }, { id, api }, { timeout: 180000 });
      const sample = await canvas.evaluate((element, api) => {
        const result = window[api].renderer.probeFrame('depth');
        const chunks = [];
        for (let i = 0; i < result.pixels.length; i += 32768) chunks.push(String.fromCharCode(...result.pixels.subarray(i, i + 32768)));
        return { width: result.width, height: result.height, depthRange: result.depthRange, base64: btoa(chunks.join('')) };
      }, api);
      output[c.pose + '/' + view] = { ...sample, bytes: Buffer.from(sample.base64, 'base64') };
      delete output[c.pose + '/' + view].base64;
    }
  }
  return output;
}

function compare(a, b) {
  if (a.width !== b.width || a.height !== b.height || a.depthRange !== b.depthRange) throw Error('Frame dimensions or depth encoding differ');
  let union = 0, overlap = 0, maskDifferences = 0, aHits = 0, bHits = 0;
  const distances = [];
  const depth = (pixels, i) => (pixels[i] * 65536 + pixels[i + 1] * 256 + pixels[i + 2]) / 16777215 * a.depthRange * 1000;
  for (let i = 0; i < a.bytes.length; i += 4) {
    // The edge display pass can force opaque alpha even for a zero-depth
    // background; the encoded depth itself identifies a visible body hit.
    const hitA = (a.bytes[i] | a.bytes[i + 1] | a.bytes[i + 2]) !== 0;
    const hitB = (b.bytes[i] | b.bytes[i + 1] | b.bytes[i + 2]) !== 0;
    if (hitA) aHits++;
    if (hitB) bHits++;
    if (hitA || hitB) union++;
    if (hitA !== hitB) maskDifferences++;
    if (hitA && hitB) { overlap++; distances.push(Math.abs(depth(a.bytes, i) - depth(b.bytes, i))); }
  }
  distances.sort((x, y) => x - y);
  const at = q => distances[Math.min(distances.length - 1, Math.floor(q * distances.length))] ?? null;
  return { width: a.width, height: a.height, oldHitPixels: aHits, newHitPixels: bHits, unionPixels: union, overlapPixels: overlap, changedSilhouettePixels: maskDifferences, silhouetteDifferencePercent: union ? 100 * maskDifferences / union : null, depthDifferenceMM: { median: at(.5), p95: at(.95), p99: at(.99), maximum: at(1) } };
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-gpu', '--enable-unsafe-swiftshader'] });
  const errors = [];
  let comparisons = {};
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
    page.on('pageerror', e => errors.push(e.message));
    const before = await capture(page, 'R33');
    const after = await capture(page, 'R34');
    for (const key of Object.keys(before)) comparisons[key] = compare(before[key], after[key]);
  } catch (e) { errors.push(e.stack); }
  finally {
    await browser.close();
    const result = { startedUTC, finishedUTC: new Date().toISOString(), scope: 'same pose and camera, old and new displayed function surfaces, per-pixel depth; no screenshot files', comparisons, errors, completed: errors.length === 0 && Object.keys(comparisons).length === 5 && Object.values(comparisons).every(x => x.overlapPixels > 1000 && x.overlapPixels < x.width * x.height) };
    fs.mkdirSync('qa/platform-r34', { recursive: true });
    fs.writeFileSync('qa/platform-r34/pose-depth-comparison.json', JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result));
    if (!result.completed) process.exitCode = 1;
  }
})();
