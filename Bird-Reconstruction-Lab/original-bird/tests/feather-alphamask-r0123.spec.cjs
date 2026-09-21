const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const ARTIFACT_DIR = path.resolve('artifacts/bird-r0123-alphamask-qa');
const URL = 'http://127.0.0.1:4173/Bird-Reconstruction-Lab/original-bird/workbench/original-bird-feather-alphamask-r0123.html';

function mockViewerScript() {
  return String.raw`
(() => {
  const FIXTURE = location.origin + '/Bird-Reconstruction-Lab/original-bird/tests/fixtures/feather-atlas-r0122.svg';
  const clone = (value) => JSON.parse(JSON.stringify(value));
  function makeApi(frame) {
    const isAfter = frame.id === 'afterFrame';
    let cutoutApplied = false;
    let background = [.72, .77, .79];
    let camera = { position: [4.2, -5.4, 3.1], target: [0, 0, .3] };
    let material = {
      stateSetID: 101,
      id: 'Pigeon_mainMat',
      uid: 'Pigeon_mainMat',
      name: 'Pigeon_mainMat',
      channels: {
        AlbedoPBR: { enable: true, factor: 1, texture: { uid: 'fixture-atlas', id: 'fixture-atlas' } },
        RoughnessPBR: { enable: true, factor: .62 },
        MetalnessPBR: { enable: true, factor: 0 },
        Opacity: { enable: true, factor: 1 }
      }
    };
    function rgb() { return background.map((value) => Math.max(0, Math.min(255, Math.round(value * 255)))); }
    function wingMarkup(withCutout) {
      const [r, g, b] = rgb();
      const plate = withCutout ? '' : '<path d="M145 495 Q420 175 795 260 L820 545 Q470 725 145 495Z" fill="#8f969a" opacity=".82"/>';
      const feathers = Array.from({ length: 9 }, (_, index) => {
        const x = 205 + index * 62;
        const y = 330 + Math.abs(index - 4) * 12;
        return '<path d="M0 0 C18 -92 48 -190 78 -255 C111 -177 113 -76 91 5 C62 19 29 18 0 0Z" fill="#202428" transform="translate(' + x + ' ' + y + ') rotate(' + ((index - 4) * 4) + ')"/>';
      }).join('');
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 700" width="100%" height="100%"><rect width="900" height="700" fill="rgb(' + r + ',' + g + ',' + b + ')"/><ellipse cx="250" cy="455" rx="145" ry="165" fill="#24282c"/>' + plate + '<g transform="translate(0 250)">' + feathers + '</g></svg>';
    }
    function renderFrame() {
      frame.srcdoc = '<!doctype html><html><body style="margin:0;overflow:hidden"><div style="width:100vw;height:100vh">' + wingMarkup(isAfter && cutoutApplied) + '</div></body></html>';
    }
    function screenshot() {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 900;
      const context = canvas.getContext('2d');
      const [r, g, b] = rgb();
      context.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
      context.fillRect(0, 0, 900, 900);
      context.fillStyle = '#24282c';
      context.beginPath();
      context.ellipse(235, 545, 135, 170, 0, 0, Math.PI * 2);
      context.fill();
      if (!(isAfter && cutoutApplied)) {
        context.fillStyle = 'rgba(143,150,154,.82)';
        context.beginPath();
        context.moveTo(145, 520);
        context.quadraticCurveTo(420, 180, 795, 265);
        context.lineTo(820, 570);
        context.quadraticCurveTo(470, 735, 145, 520);
        context.fill();
      }
      context.fillStyle = '#202428';
      for (let index = 0; index < 9; index += 1) {
        context.save();
        context.translate(205 + index * 62, 590 + Math.abs(index - 4) * 12);
        context.rotate(((index - 4) * 4 * Math.PI) / 180);
        context.beginPath();
        context.moveTo(0, 0);
        context.bezierCurveTo(18, -92, 48, -190, 78, -255);
        context.bezierCurveTo(111, -177, 113, -76, 91, 5);
        context.bezierCurveTo(62, 19, 29, 18, 0, 0);
        context.fill();
        context.restore();
      }
      return canvas.toDataURL('image/png');
    }
    const api = {
      start() {},
      addEventListener(name, callback) { if (name === 'viewerready') setTimeout(callback, 25); },
      pause(callback) { if (callback) callback(); },
      play(callback) { if (callback) callback(); },
      seekTo(_time, callback) { if (callback) callback(); },
      setCycleMode(_mode, callback) { if (callback) callback(); },
      setTextureQuality(_quality, callback) { if (callback) callback(); },
      setShadingStyle(_style, _options, callback) { if (callback) callback(); },
      setBackground(options, callback) { if (options?.color) background = options.color.slice(); renderFrame(); if (callback) callback(); },
      getEnvironment(callback) { callback(null, { exposure: .25, lightIntensity: 1.2, rotation: .5, shadowEnabled: true }); },
      setEnvironment(_environment, callback) { if (callback) callback(); },
      getCameraLookAt(callback) { callback(null, clone(camera)); },
      setCameraLookAt(position, target, _duration, callback) { camera = { position: position.slice(), target: target.slice() }; if (callback) callback(); },
      focusOnVisibleGeometries(callback) { if (callback) callback(); },
      getAnimations(callback) { callback(null, [['mock-flight', 'Flight', 1]]); },
      setCurrentAnimationByUID(_uid, callback) { if (callback) callback(); },
      getMaterialList(callback) { callback(null, [clone(material)]); },
      getTextureList(callback) { callback(null, [{ uid: 'fixture-atlas', id: 'fixture-atlas', name: 'feather-atlas', url: FIXTURE, images: [{ url: FIXTURE, width: 1024, height: 1024 }] }]); },
      addTexture(_data, callback) { setTimeout(() => callback(null, 'mock-alphamask'), 5); },
      setMaterial(next, callback) {
        material = clone(next);
        cutoutApplied = Boolean(material.channels?.AlphaMask?.enable && material.channels?.AlphaMask?.texture?.uid);
        renderFrame();
        if (callback) setTimeout(callback, 5);
      },
      getScreenShot(_width, _height, _mime, callback) { callback(null, screenshot()); }
    };
    renderFrame();
    return api;
  }
  window.Sketchfab = function Sketchfab(_version, frame) {
    this.init = function init(_uid, options) { const api = makeApi(frame); setTimeout(() => options.success(api), 10); };
  };
})();
`;
}

function percent(value) {
  const match = String(value || '').match(/([0-9]+(?:\.[0-9]+)?)%/);
  return match ? Number(match[1]) : Number.NaN;
}

test.use({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });

test('R0.12.3 uses AlphaMask, preserves Opacity, and removes the backing in the rendered comparison', async ({ page }) => {
  test.setTimeout(90_000);
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const consoleEvents = [];
  page.on('console', (message) => consoleEvents.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => consoleEvents.push({ type: 'pageerror', text: error.message }));
  await page.route('**/api/sketchfab-viewer-1.12.1.js', (route) => route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: mockViewerScript() }));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('header')).toContainText('Original Bird R0.12.3');
  await page.waitForFunction(() => document.querySelector('#readyState')?.textContent?.includes('2/2'), null, { timeout: 30_000 });
  await page.waitForFunction(() => /%/.test(document.querySelector('#diffValue')?.textContent || ''), null, { timeout: 30_000 });
  await page.waitForTimeout(750);

  const runtime = await page.evaluate(() => ({
    ready: document.querySelector('#readyState')?.textContent || '',
    apply: document.querySelector('#applyState')?.textContent || '',
    status: document.querySelector('#status')?.textContent || '',
    diff: document.querySelector('#diffValue')?.textContent || '',
    channel: document.querySelector('#channelValue')?.textContent || '',
    alphaSource: document.querySelector('#alphaSource')?.textContent || '',
    selected: document.querySelector('#selected')?.textContent || '',
    raw: document.querySelector('#raw')?.textContent || ''
  }));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'r0123-bright-gray.png'), fullPage: true });
  await page.locator('[data-bg="sky"]').click();
  await page.locator('[data-view="wingtip"]').click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'r0123-sky-wingtip.png'), fullPage: true });
  await page.locator('[data-bg="warm"]').click();
  await page.locator('[data-view="trailing"]').click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'r0123-warm-trailing.png'), fullPage: true });

  const report = { capturedAt: new Date().toISOString(), url: URL, runtime, visibleDifferencePercent: percent(runtime.diff), consoleEvents };
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'r0123-runtime.json'), JSON.stringify(report, null, 2));

  expect(runtime.ready).toContain('2/2');
  expect(runtime.channel).toBe('AlphaMask');
  expect(runtime.raw).toContain('"AlphaMask"');
  expect(runtime.raw).toContain('"Opacity"');
  expect(runtime.selected).toContain('AlphaMask: ON');
  expect(runtime.selected).toContain('Opacity: ON');
  expect(runtime.apply).toContain('AlphaMask');
  expect(runtime.status).toContain('AlphaMask 已产生可见变化');
  expect(report.visibleDifferencePercent).toBeGreaterThan(1);
});
