const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const ARTIFACT_DIR = path.resolve('artifacts/bird-r0122-browser-qa');
const URL = process.env.BIRD_QA_URL || 'http://127.0.0.1:4173/Bird-Reconstruction-Lab/original-bird/workbench/original-bird-feather-alpha-r0122.html';
const QA_MODE = process.env.BIRD_QA_MODE || 'mock';

function parsePercent(value) {
  const match = String(value || '').match(/([0-9]+(?:\.[0-9]+)?)%/);
  return match ? Number(match[1]) : Number.NaN;
}

function mockViewerScript() {
  return String.raw`
(() => {
  const FIXTURE = location.origin + '/Bird-Reconstruction-Lab/original-bird/tests/fixtures/feather-atlas-r0122.svg';
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function rgb(color) {
    return color.map((value) => Math.max(0, Math.min(255, Math.round(value * 255))));
  }

  function makeApi(frame) {
    const isAfter = frame.id === 'afterFrame';
    let opacityApplied = false;
    let background = [.72, .77, .79];
    let camera = { position: [4.2, -5.4, 3.1], target: [0, 0, .3] };
    let material = {
      stateSetID: 101,
      id: 'Pigeon_mainMat',
      uid: 'Pigeon_mainMat',
      name: 'Pigeon_mainMat',
      channels: {
        AlbedoPBR: {
          enable: true,
          factor: 1,
          texture: { uid: 'fixture-atlas', id: 'fixture-atlas' },
        },
        RoughnessPBR: { enable: true, factor: .62 },
        MetalnessPBR: { enable: true, factor: 0 },
        Opacity: { enable: false, factor: 1 },
      },
    };

    function wingSvg(cutout) {
      const [r, g, b] = rgb(background);
      const plate = cutout ? '' : '<path d="M145 495 Q420 175 795 260 L820 545 Q470 725 145 495Z" fill="#8f969a" opacity=".72"/>';
      const feathers = Array.from({ length: 9 }, (_, index) => {
        const x = 205 + index * 62;
        const y = 330 + Math.abs(index - 4) * 12;
        const rotate = (index - 4) * 4;
        return '<path d="M0 0 C18 -92 48 -190 78 -255 C111 -177 113 -76 91 5 C62 19 29 18 0 0Z" fill="#202428" transform="translate(' + x + ' ' + y + ') rotate(' + rotate + ')"/>';
      }).join('');
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 700" width="100%" height="100%"><rect width="900" height="700" fill="rgb(' + r + ',' + g + ',' + b + ')"/><ellipse cx="250" cy="455" rx="145" ry="165" fill="#24282c"/>' + plate + '<g transform="translate(0 250)">' + feathers + '</g></svg>';
    }

    function renderFrame() {
      frame.srcdoc = '<!doctype html><html><body style="margin:0;overflow:hidden;background:#d2dadd"><div style="width:100vw;height:100vh">' + wingSvg(isAfter && opacityApplied) + '</div></body></html>';
    }

    function screenshot() {
      const canvas = document.createElement('canvas');
      canvas.width = 900;
      canvas.height = 900;
      const context = canvas.getContext('2d');
      const [r, g, b] = rgb(background);
      context.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
      context.fillRect(0, 0, 900, 900);
      context.fillStyle = '#24282c';
      context.beginPath();
      context.ellipse(235, 545, 135, 170, 0, 0, Math.PI * 2);
      context.fill();
      if (!(isAfter && opacityApplied)) {
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
        const x = 205 + index * 62;
        const y = 590 + Math.abs(index - 4) * 12;
        context.translate(x, y);
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
      addEventListener(name, callback) {
        if (name === 'viewerready') setTimeout(callback, 30);
      },
      pause(callback) { if (callback) callback(); },
      play(callback) { if (callback) callback(); },
      seekTo(_time, callback) { if (callback) callback(); },
      setCycleMode(_mode, callback) { if (callback) callback(); },
      setTextureQuality(_quality, callback) { if (callback) callback(); },
      setShadingStyle(_style, _options, callback) { if (callback) callback(); },
      setBackground(options, callback) {
        if (options && Array.isArray(options.color)) background = options.color.slice();
        renderFrame();
        if (callback) callback();
      },
      getEnvironment(callback) {
        callback(null, { exposure: .25, lightIntensity: 1.2, rotation: .5, shadowEnabled: true });
      },
      setEnvironment(_environment, callback) { if (callback) callback(); },
      getCameraLookAt(callback) { callback(null, clone(camera)); },
      setCameraLookAt(position, target, _duration, callback) {
        camera = { position: position.slice(), target: target.slice() };
        if (callback) callback();
      },
      focusOnVisibleGeometries(callback) { if (callback) callback(); },
      getAnimations(callback) { callback(null, [['mock-flight', 'Flight', 1]]); },
      setCurrentAnimationByUID(_uid, callback) { if (callback) callback(); },
      getMaterialList(callback) { callback(null, [clone(material)]); },
      getTextureList(callback) {
        callback(null, [{ uid: 'fixture-atlas', id: 'fixture-atlas', name: 'feather-atlas-r0122', url: FIXTURE, images: [{ url: FIXTURE, width: 1024, height: 1024 }] }]);
      },
      addTexture(_data, callback) { setTimeout(() => callback(null, 'mock-opacity-mask'), 5); },
      setMaterial(next, callback) {
        material = clone(next);
        opacityApplied = Boolean(material.channels && material.channels.Opacity && material.channels.Opacity.enable && material.channels.Opacity.texture);
        renderFrame();
        if (callback) setTimeout(callback, 5);
      },
      getScreenShot(_width, _height, _mimeType, callback) { callback(null, screenshot()); },
    };

    renderFrame();
    return api;
  }

  window.Sketchfab = function Sketchfab(_version, frame) {
    this.init = function init(_uid, options) {
      const api = makeApi(frame);
      setTimeout(() => options.success(api), 10);
    };
  };
})();
`;
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
  await page.screenshot({ path: path.join(ARTIFACT_DIR, `${name}.png`), fullPage: true });
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, `${name}.json`),
    JSON.stringify({ capturedAt: new Date().toISOString(), runtime, consoleEvents, ...extra }, null, 2),
  );
  return runtime;
}

test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });

test('R0.12.2 deterministically extracts a UV-aligned alpha mask and produces a visible before-after difference', async ({ page }) => {
  test.setTimeout(120_000);
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

  const consoleEvents = [];
  page.on('console', (message) => consoleEvents.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => consoleEvents.push({ type: 'pageerror', text: error.message }));
  page.on('requestfailed', (request) => consoleEvents.push({ type: 'requestfailed', text: `${request.url()} :: ${request.failure()?.errorText || 'UNKNOWN'}` }));

  if (QA_MODE === 'mock') {
    await page.route('**/api/sketchfab-viewer-1.12.1.js', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: mockViewerScript() });
    });
  }

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.locator('header')).toContainText('Original Bird R0.12.2');

  await page.waitForFunction(() => document.querySelector('#readyState')?.textContent?.includes('2/2'), null, { timeout: 45_000 });
  await page.waitForFunction(() => /%/.test(document.querySelector('#diffValue')?.textContent || ''), null, { timeout: 45_000 });
  await page.waitForTimeout(1_000);

  const initial = await persistEvidence(page, consoleEvents, 'r0122-mock-initial', { requestedUrl: URL, qaMode: QA_MODE });

  await page.locator('[data-bg="sky"]').click();
  await page.locator('[data-view="wingtip"]').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'r0122-mock-sky-wingtip.png'), fullPage: true });

  await page.locator('[data-bg="warm"]').click();
  await page.locator('[data-view="trailing"]').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'r0122-mock-warm-trailing-edge.png'), fullPage: true });

  const finalRuntime = await readRuntime(page);
  const report = {
    url: URL,
    qaMode: QA_MODE,
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
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'r0122-browser-runtime.json'), JSON.stringify(report, null, 2));

  expect(finalRuntime.readyState).toContain('2/2');
  expect(finalRuntime.applyState).not.toBe('pending');
  expect(finalRuntime.status).not.toMatch(/Viewer 启动失败|差异检测失败/i);
  expect(report.parsed.sourceAtlasPathUsed).toBe(true);
  expect(report.parsed.forcedProbeUsed).toBe(false);
  expect(report.parsed.visibleDifferencePercent).toBeGreaterThan(1);
});
