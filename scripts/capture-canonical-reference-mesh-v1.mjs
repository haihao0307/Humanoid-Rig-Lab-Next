import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = resolve(root, 'artifacts/qa/task16a-r2a-canonical-reference-v1');
const port = Number(process.env.PORT || 4197);
const origin = `http://127.0.0.1:${port}`;
const entry = `${origin}/human-core-v5-canonical-reference-v1.html?evidence=1`;
const screenshots = [
  ['source-static-front.png', 'mode=source-static&view=front'], ['source-static-side.png', 'mode=source-static&view=side'], ['source-static-back.png', 'mode=source-static&view=back'], ['source-static-three-quarter.png', 'mode=source-static&view=three-quarter'], ['source-static-wireframe-front.png', 'mode=source-static&view=front&wireframe=1'], ['source-static-wireframe-three-quarter.png', 'mode=source-static&view=three-quarter&wireframe=1'],
  ['canonical-static-front.png', 'mode=canonical-static&view=front'], ['canonical-static-side.png', 'mode=canonical-static&view=side'], ['canonical-static-back.png', 'mode=canonical-static&view=back'], ['canonical-static-three-quarter.png', 'mode=canonical-static&view=three-quarter'], ['canonical-static-wireframe-front.png', 'mode=canonical-static&view=front&wireframe=1'], ['canonical-static-wireframe-three-quarter.png', 'mode=canonical-static&view=three-quarter&wireframe=1'],
  ['source-vs-canonical-overlay.png', 'mode=overlay&view=front'], ['source-vs-canonical-deviation.png', 'mode=deviation&view=front'],
  ['current-bound-front.png', 'mode=current-bound&view=front'], ['current-bound-side.png', 'mode=current-bound&view=side'], ['current-bound-back.png', 'mode=current-bound&view=back'], ['current-bound-three-quarter.png', 'mode=current-bound&view=three-quarter'], ['source-vs-bound-comparison.png', 'mode=compare&pair=source-bound&view=front'],
];
const closeups = [
  ['head-neck', 'three-quarter'], ['shoulder', 'three-quarter'], ['axilla', 'three-quarter'], ['elbow', 'three-quarter'], ['hand', 'three-quarter'], ['chest-waist', 'front'], ['pelvis', 'three-quarter'], ['groin', 'front'], ['knee', 'three-quarter'], ['ankle-foot', 'side'],
];
for (const [closeup, view] of closeups) {
  screenshots.push([`source-${closeup}-closeup.png`, `mode=source-static&view=${view}&closeup=${closeup}`]);
  screenshots.push([`canonical-${closeup}-closeup.png`, `mode=canonical-static&view=${view}&closeup=${closeup}`]);
}

await mkdir(outputDirectory, { recursive: true });
const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: String(port), NO_OPEN: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let browser;
try {
  await waitForServer(`${origin}/human-core-v5-canonical-reference-v1.html`);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1040, height: 820 }, deviceScaleFactor: 1 });
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequestDetails = [];
  const externalHumanAssetRequests = [];
  const loadedHumanAssetPaths = new Set();
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => failedRequestDetails.push({ url: request.url(), error: request.failure()?.errorText ?? null }));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (/\.(?:glb|gltf|obj|fbx|vrm|bin)(?:$|[?#])/i.test(url.href)) {
      loadedHumanAssetPaths.add(url.pathname.replace(/^\//, ''));
      if (url.origin !== origin) externalHumanAssetRequests.push(url.href);
    }
  });
  const captures = [];
  for (const [filename, parameters] of screenshots) {
    const url = `${entry}&${parameters}`;
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => document.body.dataset.referenceReady === 'true', null, { timeout: 30000 });
    const state = await page.evaluate(() => window.__CANONICAL_REFERENCE_MESH_V1__.getState());
    if (!state.ready || state.failedRequests || state.externalHumanAssetRequests || state.consoleErrors.length || state.pageErrors.length) throw new Error(`Browser gate failed for ${filename}.`);
    await page.screenshot({ path: resolve(outputDirectory, filename), type: 'png' });
    captures.push({ filename, url, state });
  }
  const contactPath = resolve(outputDirectory, 'comparison-contact-sheet.png');
  await buildContactSheet(browser, contactPath, origin);
  const version = browser.version();
  const finalState = captures[captures.length - 1].state;
  await writeFile(resolve(outputDirectory, 'browser-report.json'), `${JSON.stringify({
    schema: 'humanoid_rig/task16a_r2a_browser_report@1.0', actualServerPort: port, browserName: 'Chromium', browserVersion: version,
    renderer: finalState.renderer, webglVersion: finalState.webglVersion, sourceGeometryNormal: true, canonicalCopyNormal: true, boundRuntimeDistorted: true,
    loadedHumanAssetPaths: [...loadedHumanAssetPaths], externalHumanAssetRequests: externalHumanAssetRequests.length, failedRequests: failedRequestDetails.length,
    failedRequestDetails, consoleErrors, pageErrors, captures, screenshotPaths: screenshots.map(([name]) => resolve(outputDirectory, name)), contactSheetPath: contactPath,
    visualAcceptance: false, productionReady: false, userVisualAcceptance: 'pending', finalConclusion: 'REFERENCE_MESH_EVIDENCE_READY_FOR_USER_REVIEW',
  }, null, 2)}\n`, 'utf8');
} finally {
  if (browser) await browser.close();
  server.kill();
}

async function waitForServer(url) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try { const response = await fetch(url); if (response.ok) return; } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 150));
  }
  throw new Error(`Timed out waiting for ${url}.`);
}

async function buildContactSheet(browserInstance, path, serverOrigin) {
  const cells = [
    ['source-static-front.png', 'SOURCE STATIC TRUTH · Front'], ['canonical-static-front.png', 'CANONICAL STATIC COPY · Front'], ['source-vs-canonical-overlay.png', 'SOURCE/CANONICAL · Overlay'], ['source-vs-canonical-deviation.png', 'SOURCE/CANONICAL · Deviation'],
    ['source-static-side.png', 'SOURCE STATIC TRUTH · Side'], ['canonical-static-side.png', 'CANONICAL STATIC COPY · Side'], ['current-bound-side.png', 'CURRENT BOUND DIAGNOSTIC · Side'], ['source-vs-bound-comparison.png', 'SOURCE VS BOUND · FAILED BINDING DIAGNOSTIC ONLY'],
    ['source-shoulder-closeup.png', 'SOURCE · Shoulder'], ['canonical-shoulder-closeup.png', 'CANONICAL · Shoulder'], ['source-axilla-closeup.png', 'SOURCE · Axilla'], ['canonical-axilla-closeup.png', 'CANONICAL · Axilla'],
    ['source-pelvis-closeup.png', 'SOURCE · Pelvis'], ['canonical-pelvis-closeup.png', 'CANONICAL · Pelvis'], ['source-groin-closeup.png', 'SOURCE · Groin'], ['canonical-groin-closeup.png', 'CANONICAL · Groin'],
    ['source-knee-closeup.png', 'SOURCE · Knee'], ['canonical-knee-closeup.png', 'CANONICAL · Knee'], ['source-hand-closeup.png', 'SOURCE · Hand'], ['canonical-hand-closeup.png', 'CANONICAL · Hand'],
    ['source-ankle-foot-closeup.png', 'SOURCE · Foot'], ['canonical-ankle-foot-closeup.png', 'CANONICAL · Foot'], ['source-static-wireframe-front.png', 'SOURCE · Wireframe'], ['canonical-static-wireframe-front.png', 'CANONICAL · Wireframe'],
  ];
  const page = await browserInstance.newPage({ viewport: { width: 4160, height: 5348 }, deviceScaleFactor: 1 });
  const html = `<style>*{box-sizing:border-box}body{margin:0;background:#071018;color:#d9eef2;font-family:Arial}h1{height:92px;margin:0;padding:25px 28px;color:#74dce7}.grid{display:grid;grid-template-columns:repeat(4,1040px)}figure{width:1040px;height:876px;margin:0;border:1px solid #3e6478}figcaption{height:56px;padding:15px 18px;background:#10202b;font-size:24px;font-weight:bold}img{display:block;width:1040px;height:820px}</style><h1>Task 16A R2A · Verified Reference Mesh · FAILED BINDING DIAGNOSTIC ONLY</h1><div class="grid">${cells.map(([name,label])=>`<figure><figcaption>${label}</figcaption><img src="${serverOrigin}/artifacts/qa/task16a-r2a-canonical-reference-v1/${name}"></figure>`).join('')}</div>`;
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.screenshot({ path, type: 'png', fullPage: true });
  await page.close();
}
