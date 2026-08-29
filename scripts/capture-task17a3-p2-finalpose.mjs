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
const contactSheetFile = 'contact-sheet.png';
const sequenceVideoFile = 'pose-connection-cycle.webm';
const expectedArtifactFiles = Object.freeze([...captures.map(([file]) => file), contactSheetFile, sequenceVideoFile]);

let server = null;
let browser = null;
const evidence = [];
const runFailures = [];

try {
  const baseUrl = await startServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  for (const [file, query] of captures) evidence.push(await captureStill(context, baseUrl, file, query));
  if (evidence.every(({ status }) => status === 'captured')) evidence.push(await captureContactSheet(context));
  else evidence.push(failedEvidence(contactSheetFile, 'Contact sheet was not regenerated because one or more source captures failed runtime validation.'));
  await context.close();
  evidence.push(await captureSequenceVideo(browser, baseUrl));
} catch (error) {
  runFailures.push(`capture-run: ${formatError(error)}`);
} finally {
  if (browser) await browser.close();
  if (server && !server.killed) server.kill();
}

const manifest = updateManifest(evidence, runFailures);
if (manifest.status === 'captured_pending_user_visual_review') {
  console.log(`Captured ${captures.length} stills, ${contactSheetFile}, and ${sequenceVideoFile}; all runtime validation gates passed.`);
} else {
  console.error(`P2 capture failed closed with status ${manifest.status}.`);
  for (const failure of manifest.validationFailures) console.error(`- ${failure}`);
  process.exitCode = 1;
}

async function captureStill(context, baseUrl, file, query) {
  const page = await context.newPage();
  const observed = observeErrors(page);
  const validationErrors = [];
  let state = null;
  let poseSynchronization = null;
  let overlayValidation = null;
  let screenshotWritten = false;
  try {
    await page.goto(`${baseUrl}/${pagePath}?${query}`, { waitUntil: 'domcontentloaded' });
    try { state = await waitForReady(page); }
    catch (error) { validationErrors.push(`ready: ${formatError(error)}`); }
    if (state) {
      const expectedPoseId = new URLSearchParams(query).get('pose');
      try { poseSynchronization = await assertPoseSynchronization(page, expectedPoseId); }
      catch (error) { validationErrors.push(`pose synchronization: ${formatError(error)}`); }
      if (new URLSearchParams(query).get('overlay') === '1') {
        try { overlayValidation = await assertFiniteOverlayCoordinates(page); }
        catch (error) {
          overlayValidation = error.validation ?? null;
          validationErrors.push(`overlay coordinates: ${formatError(error)}`);
        }
      }
    }
    try {
      await page.screenshot({ path: resolve(outputDirectory, file) });
      screenshotWritten = true;
    } catch (error) {
      validationErrors.push(`screenshot: ${formatError(error)}`);
    }
    try { state = await page.evaluate(() => structuredClone(window.__HRL_PRODUCTION_SKELETON_P2__)); }
    catch (error) { validationErrors.push(`public state: ${formatError(error)}`); }
  } catch (error) {
    validationErrors.push(`navigation: ${formatError(error)}`);
    try {
      await page.screenshot({ path: resolve(outputDirectory, file) });
      screenshotWritten = true;
    } catch (screenshotError) {
      validationErrors.push(`failure screenshot: ${formatError(screenshotError)}`);
    }
  } finally {
    await page.close();
  }

  const consoleErrors = uniqueStrings([...(observed.consoleErrors ?? []), ...(state?.consoleErrors ?? [])]);
  const pageErrors = uniqueStrings([...(observed.pageErrors ?? []), ...(state?.pageErrors ?? [])]);
  if (state?.ready !== true) validationErrors.push('public state ready must be true.');
  if (state?.webgl2 !== true) validationErrors.push('public state webgl2 must be true.');
  if (!screenshotWritten) validationErrors.push('capture file was not written.');
  if (consoleErrors.length) validationErrors.push(`consoleErrors: ${consoleErrors.join(' | ')}`);
  if (pageErrors.length) validationErrors.push(`pageErrors: ${pageErrors.join(' | ')}`);

  return {
    file,
    status: validationErrors.length ? 'failed_runtime_validation' : 'captured',
    webgl2: state?.webgl2 === true,
    poseSynchronization,
    overlayValidation,
    validationErrors,
    consoleErrors,
    pageErrors,
  };
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
  if (state.status !== 'ready' || state.ready !== true || state.webgl2 !== true) {
    throw new Error(`P2 page failed: ${state.pageErrors.join(' | ') || `status=${state.status}, ready=${state.ready}, webgl2=${state.webgl2}`}`);
  }
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
    throw new Error(`Expected ${expectedPoseId}: ${JSON.stringify(synchronization)}`);
  }
  return synchronization;
}

async function assertFiniteOverlayCoordinates(page) {
  const validation = await page.evaluate(() => {
    const svg = document.querySelector('#core-overlay');
    const failures = [];
    if (!svg) return { passed: false, failures: ['#core-overlay is missing.'], visibleLineCount: 0, visiblePointCount: 0 };
    const state = window.__HRL_PRODUCTION_SKELETON_P2__;
    if (state?.ready !== true) failures.push('public state ready is not true.');
    if (state?.webgl2 !== true) failures.push('public state webgl2 is not true.');
    if (state?.overlayProjectionReady !== true) failures.push('public state overlayProjectionReady is not true.');

    const svgStyle = getComputedStyle(svg);
    const svgVisible = !svg.hidden && svgStyle.display !== 'none' && svgStyle.visibility !== 'hidden';
    if (!svgVisible) failures.push('#core-overlay is not visible.');

    const viewBox = svg.getAttribute('viewBox') ?? '';
    const viewBoxValues = viewBox.trim().split(/\s+/).map(Number);
    if (/NaN|Infinity/i.test(viewBox)
      || viewBoxValues.length !== 4
      || !viewBoxValues.every(Number.isFinite)
      || !(viewBoxValues[2] > 0)
      || !(viewBoxValues[3] > 0)) failures.push(`invalid viewBox=${JSON.stringify(viewBox)}`);

    const isVisible = (element) => svgVisible
      && element.style.display !== 'none'
      && !element.hidden
      && getComputedStyle(element).display !== 'none'
      && getComputedStyle(element).visibility !== 'hidden';
    const coordinateIsFinite = (element, attribute) => {
      const value = element.getAttribute(attribute);
      if (value === null || value.trim() === '' || /NaN|Infinity/i.test(value) || !Number.isFinite(Number(value))) {
        failures.push(`${element.tagName.toLowerCase()}[data-joint-id="${element.dataset.jointId ?? ''}"][data-parent-id="${element.dataset.parentId ?? ''}"] ${attribute}=${JSON.stringify(value)}`);
        return false;
      }
      return true;
    };
    const forbiddenAttributeText = (element, attributes) => {
      for (const attribute of attributes) {
        const value = element.getAttribute(attribute);
        if (value !== null && /NaN|Infinity/i.test(value)) failures.push(`${element.tagName.toLowerCase()} ${attribute} contains ${JSON.stringify(value)}`);
      }
    };

    const lines = [...svg.querySelectorAll('line')];
    const points = [...svg.querySelectorAll('circle')];
    for (const line of lines) forbiddenAttributeText(line, ['x1', 'y1', 'x2', 'y2']);
    for (const point of points) forbiddenAttributeText(point, ['cx', 'cy']);
    const visibleLines = lines.filter(isVisible);
    const visiblePoints = points.filter(isVisible);
    for (const line of visibleLines) for (const attribute of ['x1', 'y1', 'x2', 'y2']) coordinateIsFinite(line, attribute);
    for (const point of visiblePoints) for (const attribute of ['cx', 'cy']) coordinateIsFinite(point, attribute);
    if (!visibleLines.length) failures.push('Overlay has no valid visible line.');
    if (!visiblePoints.length) failures.push('Overlay has no valid visible point.');
    return {
      passed: failures.length === 0,
      failures,
      viewBox,
      visibleLineCount: visibleLines.length,
      visiblePointCount: visiblePoints.length,
    };
  });
  if (!validation.passed) {
    const error = new Error(validation.failures.join(' | '));
    error.validation = validation;
    throw error;
  }
  return validation;
}

async function captureSequenceVideo(activeBrowser, baseUrl) {
  const videoDirectory = resolve(outputDirectory, '.video-staging');
  const context = await activeBrowser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: { dir: videoDirectory, size: { width: 1920, height: 1080 } },
  });
  const page = await context.newPage();
  const observed = observeErrors(page);
  const validationErrors = [];
  let state = null;
  let sequenceSynchronization = null;
  let finalSynchronization = null;
  let videoWritten = false;
  const video = page.video();
  try {
    await page.goto(`${baseUrl}/${pagePath}?sequence=1`, { waitUntil: 'domcontentloaded' });
    state = await waitForReady(page);
    try {
      await page.waitForFunction(() => window.__HRL_PRODUCTION_SKELETON_P2__.sequencePlaying
        && window.__HRL_PRODUCTION_SKELETON_P2__.poseId === 'sequence', null, { timeout: 5000 });
      sequenceSynchronization = await assertPoseSynchronization(page, 'sequence');
    } catch (error) { validationErrors.push(`sequence start: ${formatError(error)}`); }
    try {
      await page.waitForFunction(() => window.__HRL_PRODUCTION_SKELETON_P2__.sequenceComplete === true, null, { timeout: 30000 });
      finalSynchronization = await assertPoseSynchronization(page, 'locomotion-neutral');
    } catch (error) { validationErrors.push(`sequence end: ${formatError(error)}`); }
    state = await page.evaluate(() => structuredClone(window.__HRL_PRODUCTION_SKELETON_P2__));
  } catch (error) {
    validationErrors.push(`sequence runtime: ${formatError(error)}`);
  } finally {
    await page.close();
    try {
      await video.saveAs(resolve(outputDirectory, sequenceVideoFile));
      videoWritten = true;
    } catch (error) { validationErrors.push(`video save: ${formatError(error)}`); }
    await context.close();
  }

  const consoleErrors = uniqueStrings([...(observed.consoleErrors ?? []), ...(state?.consoleErrors ?? [])]);
  const pageErrors = uniqueStrings([...(observed.pageErrors ?? []), ...(state?.pageErrors ?? [])]);
  if (state?.ready !== true) validationErrors.push('sequence public state ready must be true.');
  if (state?.webgl2 !== true) validationErrors.push('sequence public state webgl2 must be true.');
  if (!videoWritten) validationErrors.push('sequence video file was not written.');
  if (consoleErrors.length) validationErrors.push(`consoleErrors: ${consoleErrors.join(' | ')}`);
  if (pageErrors.length) validationErrors.push(`pageErrors: ${pageErrors.join(' | ')}`);
  return {
    file: sequenceVideoFile,
    status: validationErrors.length ? 'failed_runtime_validation' : 'captured',
    webgl2: state?.webgl2 === true,
    sequenceSynchronization,
    finalSynchronization,
    validationErrors,
    consoleErrors,
    pageErrors,
  };
}

async function captureContactSheet(context) {
  const page = await context.newPage();
  const observed = observeErrors(page);
  const validationErrors = [];
  try {
    const cards = captures.map(([file]) => {
      const data = readFileSync(resolve(outputDirectory, file)).toString('base64');
      return `<figure><img src="data:image/png;base64,${data}"><figcaption>${file}</figcaption></figure>`;
    }).join('');
    await page.setViewportSize({ width: 2048, height: 1152 });
    await page.setContent(`<!doctype html><style>
      html,body{margin:0;background:#06111a;color:#d7e8f4;font:15px system-ui}main{padding:22px;display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
      figure{margin:0;padding:8px;background:#0b1b27;border:1px solid #21435a;border-radius:6px}img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}figcaption{padding:7px 2px 0;color:#9ec1d7;font-size:12px}
    </style><main>${cards}</main>`);
    await page.screenshot({ path: resolve(outputDirectory, contactSheetFile), fullPage: true });
  } catch (error) { validationErrors.push(`contact sheet: ${formatError(error)}`); }
  await page.close();
  const consoleErrors = uniqueStrings(observed.consoleErrors);
  const pageErrors = uniqueStrings(observed.pageErrors);
  if (consoleErrors.length) validationErrors.push(`consoleErrors: ${consoleErrors.join(' | ')}`);
  if (pageErrors.length) validationErrors.push(`pageErrors: ${pageErrors.join(' | ')}`);
  return {
    file: contactSheetFile,
    status: validationErrors.length ? 'failed_runtime_validation' : 'captured',
    webgl2: true,
    validationErrors,
    consoleErrors,
    pageErrors,
  };
}

function updateManifest(currentEvidence, fatalFailures) {
  const manifestPath = resolve(outputDirectory, 'browser-capture-manifest.json');
  const current = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const byFile = new Map(currentEvidence.map((item) => [item.file, item]));
  const requiredArtifacts = expectedArtifactFiles.map((file) => byFile.get(file) ?? failedEvidence(file, 'Not captured in this run.'));
  const consoleErrors = uniqueStrings(requiredArtifacts.flatMap((item) => item.consoleErrors ?? []));
  const pageErrors = uniqueStrings(requiredArtifacts.flatMap((item) => item.pageErrors ?? []));
  const overlayFiles = new Set(captures.filter(([, query]) => new URLSearchParams(query).get('overlay') === '1').map(([file]) => file));
  const stillFiles = new Set(captures.map(([file]) => file));
  const videoEvidence = byFile.get(sequenceVideoFile);
  const gates = {
    allArtifactsCaptured: requiredArtifacts.every(({ status }) => status === 'captured'),
    webgl2: requiredArtifacts.filter(({ file }) => file !== contactSheetFile).every(({ webgl2 }) => webgl2 === true),
    consoleErrorsEmpty: consoleErrors.length === 0,
    pageErrorsEmpty: pageErrors.length === 0,
    overlaysFinite: requiredArtifacts.filter(({ file }) => overlayFiles.has(file))
      .every(({ overlayValidation }) => overlayValidation?.passed === true),
    poseSynchronization: requiredArtifacts.filter(({ file }) => stillFiles.has(file))
      .every(({ poseSynchronization }) => poseSynchronization?.publicSnapshot?.consistent === true),
    sequenceStartSynchronization: videoEvidence?.sequenceSynchronization?.publicPoseId === 'sequence'
      && videoEvidence?.sequenceSynchronization?.publicSnapshot?.consistent === true,
    sequenceEndSynchronization: videoEvidence?.finalSynchronization?.publicPoseId === 'locomotion-neutral'
      && videoEvidence?.finalSynchronization?.publicSnapshot?.consistent === true,
    noFatalCaptureFailure: fatalFailures.length === 0,
  };
  const passed = Object.values(gates).every(Boolean);
  const validationFailures = uniqueStrings([
    ...fatalFailures,
    ...requiredArtifacts.flatMap(({ file, validationErrors = [] }) => validationErrors.map((message) => `${file}: ${message}`)),
    ...Object.entries(gates).filter(([, value]) => !value).map(([gate]) => `gate failed: ${gate}`),
  ]);
  const manifest = {
    ...current,
    status: passed ? 'captured_pending_user_visual_review' : 'failed_runtime_validation',
    requiredArtifacts,
    webgl2: gates.webgl2,
    consoleErrors,
    pageErrors,
    runtimeValidation: { passed, gates },
    validationFailures,
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function failedEvidence(file, message) {
  return {
    file,
    status: 'failed_runtime_validation',
    webgl2: false,
    validationErrors: [message],
    consoleErrors: [],
    pageErrors: [],
  };
}

function uniqueStrings(values) {
  return [...new Set((values ?? []).filter(Boolean).map(String))];
}

function formatError(value) {
  return value instanceof Error ? value.stack || value.message : String(value);
}
