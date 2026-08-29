import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = resolve(root, 'artifacts/qa/task17a3-p2-finalpose');
const pagePath = 'human-core-v5-production-skeleton-p2-finalpose.html';
const captures = [
  ['reference-t.png', 'pose=reference-t'], ['reference-a.png', 'pose=reference-a'],
  ['locomotion-neutral.png', 'pose=locomotion-neutral'], ['walk-left-support.png', 'pose=walk-left-support'],
  ['walk-right-support.png', 'pose=walk-right-support'], ['turn-mid.png', 'pose=turn-mid'],
  ['reference-t-overlay.png', 'pose=reference-t&overlay=1'], ['reference-a-overlay.png', 'pose=reference-a&overlay=1'],
  ['locomotion-neutral-overlay.png', 'pose=locomotion-neutral&overlay=1'], ['walk-left-support-overlay.png', 'pose=walk-left-support&overlay=1'],
  ['walk-right-support-overlay.png', 'pose=walk-right-support&overlay=1'], ['turn-mid-overlay.png', 'pose=turn-mid&overlay=1'],
  ['shoulder-turn-mid-closeup.png', 'pose=turn-mid&overlay=1&closeup=shoulder'],
  ['pelvis-walk-support-closeup.png', 'pose=walk-left-support&overlay=1&closeup=pelvis'],
  ['hand-walk-support-closeup.png', 'pose=walk-left-support&overlay=1&closeup=hand'],
  ['foot-walk-support-closeup.png', 'pose=walk-left-support&overlay=1&closeup=foot'],
];

let server = null;
let browser = null;
try {
  const baseUrl = await startServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const evidence = [];
  for (const [file, query] of captures) {
    const page = await context.newPage();
    const errors = observeErrors(page);
    await page.goto(`${baseUrl}/${pagePath}?${query}`, { waitUntil: 'domcontentloaded' });
    const state = await waitForReady(page);
    const expectedPoseId = new URLSearchParams(query).get('pose');
    const poseSynchronization = await assertPoseSynchronization(page, expectedPoseId);
    await page.screenshot({ path: resolve(outputDirectory, file) });
    evidence.push({
      file, status: 'captured', webgl2: state.webgl2, poseSynchronization,
      consoleErrors: errors.consoleErrors, pageErrors: errors.pageErrors,
    });
    await page.close();
  }
  await captureContactSheet(context);
  await context.close();
  evidence.push(await captureSequenceVideo(browser, baseUrl));
  updateManifest(evidence);
  console.log(`Captured ${captures.length} stills, contact-sheet.png, and pose-connection-cycle.webm.`);
} finally {
  if (browser) await browser.close();
  if (server && !server.killed) server.kill();
}

async function startServer() {
  server = spawn(process.execPath, ['server.mjs'], {
    cwd: root,
    env: { ...process.env, PORT: '43173', NO_OPEN: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  return new Promise((resolvePromise, rejectPromise) => {
    const timeout = setTimeout(() => rejectPromise(new Error('Local review server did not start within 10 seconds.')), 10000);
    const inspect = (chunk) => {
      const output = chunk.toString();
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (!match) return;
      clearTimeout(timeout);
      resolvePromise(match[0]);
    };
    server.stdout.on('data', inspect);
    server.stderr.on('data', inspect);
    server.once('exit', (code) => {
      clearTimeout(timeout);
      rejectPromise(new Error(`Local review server exited with code ${code}.`));
    });
  });
}

function observeErrors(page) {
  const result = { consoleErrors: [], pageErrors: [] };
  page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => result.pageErrors.push(error.stack || error.message));
  return result;
}

async function waitForReady(page) {
  await page.waitForFunction(() => ['ready', 'error'].includes(window.__HRL_PRODUCTION_SKELETON_P2__?.status), null, { timeout: 10000 });
  let state = await page.evaluate(() => structuredClone(window.__HRL_PRODUCTION_SKELETON_P2__));
  if (state.status !== 'ready') throw new Error(`P2 page failed: ${state.pageErrors.join(' | ')}`);
  await page.waitForFunction(() => window.__HRL_PRODUCTION_SKELETON_P2__.renderedFrames >= 3, null, { timeout: 5000 });
  state = await page.evaluate(() => structuredClone(window.__HRL_PRODUCTION_SKELETON_P2__));
  return state;
}

async function assertPoseSynchronization(page, expectedPoseId) {
  const synchronization = await page.evaluate(() => ({
    urlPoseId: new URL(location.href).searchParams.get('pose'),
    selectPoseId: document.querySelector('#pose-select').value,
    summaryPoseId: document.querySelector('[data-metric="pose-id"]')?.textContent,
    publicPoseId: window.__HRL_PRODUCTION_SKELETON_P2__.poseId,
    publicSnapshot: window.__HRL_PRODUCTION_SKELETON_P2__.poseSynchronization,
  }));
  const values = [synchronization.urlPoseId, synchronization.selectPoseId, synchronization.summaryPoseId, synchronization.publicPoseId];
  if (values.some((value) => value !== expectedPoseId) || synchronization.publicSnapshot?.consistent !== true) {
    throw new Error(`Pose synchronization failed for ${expectedPoseId}: ${JSON.stringify(synchronization)}`);
  }
  return synchronization;
}

async function captureSequenceVideo(activeBrowser, baseUrl) {
  const videoDirectory = resolve(outputDirectory, '.video-staging');
  const context = await activeBrowser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: { dir: videoDirectory, size: { width: 1920, height: 1080 } },
  });
  const page = await context.newPage();
  const errors = observeErrors(page);
  await page.goto(`${baseUrl}/${pagePath}?sequence=1`, { waitUntil: 'domcontentloaded' });
  await waitForReady(page);
  await page.waitForFunction(() => window.__HRL_PRODUCTION_SKELETON_P2__.sequencePlaying
    && window.__HRL_PRODUCTION_SKELETON_P2__.poseId === 'sequence', null, { timeout: 5000 });
  const sequenceSynchronization = await assertPoseSynchronization(page, 'sequence');
  await page.waitForFunction(() => window.__HRL_PRODUCTION_SKELETON_P2__.sequenceComplete === true, null, { timeout: 30000 });
  const state = await page.evaluate(() => structuredClone(window.__HRL_PRODUCTION_SKELETON_P2__));
  const finalSynchronization = await assertPoseSynchronization(page, 'locomotion-neutral');
  const video = page.video();
  await page.close();
  await video.saveAs(resolve(outputDirectory, 'pose-connection-cycle.webm'));
  await context.close();
  return {
    file: 'pose-connection-cycle.webm', status: 'captured', webgl2: state.webgl2,
    sequenceSynchronization, finalSynchronization,
    consoleErrors: errors.consoleErrors, pageErrors: errors.pageErrors,
  };
}

async function captureContactSheet(context) {
  const page = await context.newPage();
  const cards = captures.map(([file]) => {
    const data = readFileSync(resolve(outputDirectory, file)).toString('base64');
    return `<figure><img src="data:image/png;base64,${data}"><figcaption>${file}</figcaption></figure>`;
  }).join('');
  await page.setViewportSize({ width: 2048, height: 1152 });
  await page.setContent(`<!doctype html><style>
    html,body{margin:0;background:#06111a;color:#d7e8f4;font:15px system-ui}main{padding:22px;display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
    figure{margin:0;padding:8px;background:#0b1b27;border:1px solid #21435a;border-radius:6px}img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}figcaption{padding:7px 2px 0;color:#9ec1d7;font-size:12px}
  </style><main>${cards}</main>`);
  await page.screenshot({ path: resolve(outputDirectory, 'contact-sheet.png'), fullPage: true });
  await page.close();
}

function updateManifest(evidence) {
  const manifestPath = resolve(outputDirectory, 'browser-capture-manifest.json');
  const current = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const byFile = new Map(evidence.map((item) => [item.file, item]));
  byFile.set('contact-sheet.png', { file: 'contact-sheet.png', status: 'captured', webgl2: true, consoleErrors: [], pageErrors: [] });
  const requiredArtifacts = current.requiredArtifacts.map(({ file }) => byFile.get(file) ?? { file, status: 'missing' });
  const consoleErrors = requiredArtifacts.flatMap((item) => item.consoleErrors ?? []);
  const pageErrors = requiredArtifacts.flatMap((item) => item.pageErrors ?? []);
  writeFileSync(manifestPath, `${JSON.stringify({
    ...current,
    status: requiredArtifacts.every(({ status }) => status === 'captured') ? 'captured_pending_user_visual_review' : 'incomplete',
    requiredArtifacts,
    webgl2: requiredArtifacts.every((item) => item.webgl2 !== false),
    consoleErrors,
    pageErrors,
  }, null, 2)}\n`);
}
