import { chromium } from 'playwright';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const moduleRoot = path.resolve(here, '..');
const qaDir = path.join(moduleRoot, 'qa', 'recovery-r1');
const baseUrl = process.env.CAT_RECOVERY_R1_BASE_URL ?? 'http://127.0.0.1:4173';
fs.mkdirSync(qaDir, { recursive: true });

const candidates = [
  {
    id: 'v439',
    label: 'V4.39 historical posture baseline',
    path: '/cat-kaopu/recovery-r1/baselines/CAT_KAOPU_V439_REGIONAL_NORMAL_WORKBENCH_2026-09-15.html',
    readyGlobal: '__CAT_V439_READY__',
    readyValue: 'webgl2',
    apiPrefix: '__CAT_V439_',
  },
  {
    id: 'v440',
    label: 'V4.40 frozen eye-ear-short-fur baseline',
    path: '/cat-kaopu/baselines/v4.40/CAT_KAOPU_V440_EYE_EAR_SHORT_FUR_WORKBENCH_2026-09-15.html',
    readyGlobal: '__CAT_V440_READY__',
    readyValue: 'webgl2',
    apiPrefix: '__CAT_V440_',
  },
  {
    id: 'gateA',
    label: 'Phase 1 Gate A single NPC',
    path: '/cat-kaopu/phase1/index.html',
    readyGlobal: '__CAT_PHASE1_READY__',
    readyValue: 'gate-a-webgl2',
    apiPrefix: '__CAT_V446_',
  },
  {
    id: 'gateB',
    label: 'Phase 1 Gate B torso morphology',
    path: '/cat-kaopu/phase1-gate-b/index.html',
    readyGlobal: '__CAT_PHASE1_READY__',
    readyValue: 'gate-b-webgl2',
    apiPrefix: '__CAT_V446_',
  },
];

const requiredViews = ['front', 'left', 'right', 'top', 'quarter'];
const requiredCoreActions = ['stand', 'idle', 'walk_forward', 'turn_left', 'turn_right'];
const walkPhases = [0.35, 1.05, 1.75, 2.45, 5.25];
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const safeName = (value) => String(value).replace(/[^a-zA-Z0-9_-]+/g, '_');

async function waitFrames(page, count = 10) {
  await page.evaluate(async (frames) => {
    for (let index = 0; index < frames; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, count);
}

async function setView(page, view) {
  const exists = await page.evaluate((name) => {
    const button = document.querySelector(`[data-view="${name}"]`);
    if (!button) return false;
    button.click();
    document.querySelector('#resetCam')?.click();
    return true;
  }, view);
  if (!exists) throw new Error(`view unavailable: ${view}`);
  await waitFrames(page, 10);
}

async function setSample(page, candidate, action, time) {
  const result = await page.evaluate(({ prefix, actionName, sampleTime }) => {
    const setter = window[`${prefix}SET_SAMPLE__`];
    if (typeof setter !== 'function') return { ok: false, reason: 'sample_api_missing' };
    setter(actionName, sampleTime);
    return { ok: true };
  }, { prefix: candidate.apiPrefix, actionName: action, sampleTime: time });
  if (!result.ok) throw new Error(`${candidate.id}: ${result.reason}`);
  await waitFrames(page, 14);
}

async function getRuntimeSnapshot(page, candidate) {
  return page.evaluate(({ prefix }) => {
    const getMetrics = window[`${prefix}GET_METRICS__`];
    const stats = window[`${prefix}STATS__`] ?? null;
    const phaseState = typeof window.__CAT_PHASE1_GET_STATE__ === 'function'
      ? window.__CAT_PHASE1_GET_STATE__()
      : null;
    return {
      metrics: typeof getMetrics === 'function' ? getMetrics() : null,
      stats: stats ? JSON.parse(JSON.stringify(stats)) : null,
      phaseState: phaseState ? JSON.parse(JSON.stringify(phaseState)) : null,
    };
  }, { prefix: candidate.apiPrefix });
}

async function getGeometryDiagnostic(page, candidate, action, time) {
  return page.evaluate(({ prefix, actionName, sampleTime }) => {
    const surfaceFn = window[`${prefix}SAMPLE_SURFACE__`];
    const deformFn = window[`${prefix}SAMPLE_DEFORM__`];
    const jointsFn = window[`${prefix}SAMPLE_JOINTS__`];
    const output = { action: actionName, time: sampleTime };
    try {
      if (typeof surfaceFn === 'function') output.surface = surfaceFn(actionName, sampleTime, true);
    } catch (error) {
      output.surfaceError = String(error);
    }
    try {
      if (typeof deformFn === 'function') output.deform = deformFn(actionName, sampleTime, true);
    } catch (error) {
      output.deformError = String(error);
    }
    try {
      if (typeof jointsFn === 'function') output.joints = jointsFn(actionName, sampleTime);
    } catch (error) {
      output.jointsError = String(error);
    }
    return output;
  }, { prefix: candidate.apiPrefix, actionName: action, sampleTime: time });
}

async function prepareCandidate(page, candidate) {
  await page.evaluate(() => {
    for (const id of ['skeleton', 'weights', 'contacts', 'correctiveDebug', 'furDebugToggle']) {
      const button = document.querySelector(`#${id}`);
      if (button?.classList.contains('active')) button.click();
    }
    if (typeof window.__CAT_PHASE1_SET_PROXY_VIS__ === 'function') window.__CAT_PHASE1_SET_PROXY_VIS__(false);
    if (typeof window.__CAT_PHASE1_SET_COLLISION__ === 'function') window.__CAT_PHASE1_SET_COLLISION__(false);
    const toolbar = document.querySelector('.toolbar');
    const status = document.querySelector('#status');
    if (toolbar) toolbar.style.visibility = 'hidden';
    if (status) status.style.visibility = 'hidden';
  });
  await setSample(page, candidate, 'stand', 0.2);
  await setView(page, 'quarter');
}

async function captureStage(page, candidateReport, key, filename) {
  const stage = page.locator('#stage');
  await waitFrames(page, 8);
  const outputPath = path.join(qaDir, filename);
  const buffer = await stage.screenshot({ path: outputPath });
  candidateReport.screenshots[key] = {
    path: path.relative(moduleRoot, outputPath),
    bytes: buffer.length,
    sha256: sha256(buffer),
  };
  candidateReport.samples[key] = await getRuntimeSnapshot(page, candidateReport.config);
}

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--disable-gpu-sandbox',
  ],
});

const report = {
  schema: 'cat_kaopu/body_motion_recovery_browser_evidence@1.0',
  buildId: 'cat-body-motion-recovery-r1-20260917',
  generatedAt: new Date().toISOString(),
  baseUrl,
  purpose: 'fixed evidence only; this report deliberately does not auto-rank or visually approve candidates',
  requiredViews,
  requiredCoreActions,
  candidates: {},
  crossCandidateAssertions: {},
  decision: {
    allowed: ['reuse', 'hybridize', 'rebuild'],
    selected: null,
    reason: 'pending manual screenshot and frame-by-frame review',
  },
  visualAcceptance: false,
  productionReady: false,
};

let failure = null;
try {
  for (const candidate of candidates) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1050 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const candidateReport = {
      config: candidate,
      url: `${baseUrl}${candidate.path}`,
      ready: null,
      title: null,
      pageErrors: [],
      consoleErrors: [],
      availableViews: [],
      availableActions: [],
      missingRequiredViews: [],
      missingRequiredActions: [],
      runtime: null,
      geometryDiagnostics: {},
      screenshots: {},
      samples: {},
      assertions: {},
      manualReview: {
        morphology: 'pending',
        skinIntegrity: 'pending',
        motionNaturalness: 'pending',
        materialAdequacy: 'pending',
      },
    };
    report.candidates[candidate.id] = candidateReport;

    page.on('pageerror', (error) => candidateReport.pageErrors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') candidateReport.consoleErrors.push(message.text());
    });

    try {
      await page.goto(candidateReport.url, { waitUntil: 'load', timeout: 60_000 });
      await page.waitForFunction(({ globalName, expected }) => window[globalName] === expected, {
        globalName: candidate.readyGlobal,
        expected: candidate.readyValue,
      }, { timeout: 40_000 });

      candidateReport.ready = await page.evaluate((name) => window[name], candidate.readyGlobal);
      candidateReport.title = await page.title();
      candidateReport.availableViews = await page.$$eval('[data-view]', (nodes) => [...new Set(nodes.map((node) => node.dataset.view).filter(Boolean))]);
      candidateReport.availableActions = await page.$$eval('[data-action]', (nodes) => [...new Set(nodes.map((node) => node.dataset.action).filter(Boolean))]);
      candidateReport.missingRequiredViews = requiredViews.filter((view) => !candidateReport.availableViews.includes(view));
      candidateReport.missingRequiredActions = requiredCoreActions.filter((action) => !candidateReport.availableActions.includes(action));
      candidateReport.runtime = await getRuntimeSnapshot(page, candidate);

      await prepareCandidate(page, candidate);

      for (const view of requiredViews) {
        if (!candidateReport.availableViews.includes(view)) continue;
        await setView(page, view);
        const key = `stand_${view}`;
        await captureStage(page, candidateReport, key, `CAT_RECOVERY_R1_${candidate.id.toUpperCase()}_STAND_${view.toUpperCase()}_2026-09-17.png`);
      }

      if (candidateReport.availableActions.includes('idle')) {
        await setSample(page, candidate, 'idle', 1.2);
        await setView(page, 'quarter');
        await captureStage(page, candidateReport, 'idle_quarter_t1_20', `CAT_RECOVERY_R1_${candidate.id.toUpperCase()}_IDLE_QUARTER_T1_20_2026-09-17.png`);
        candidateReport.geometryDiagnostics.idle = await getGeometryDiagnostic(page, candidate, 'idle', 1.2);
      }

      if (candidateReport.availableActions.includes('walk_forward')) {
        for (const time of walkPhases) {
          await setSample(page, candidate, 'walk_forward', time);
          await setView(page, 'left');
          const token = time.toFixed(2).replace('.', '_');
          await captureStage(page, candidateReport, `walk_left_t${token}`, `CAT_RECOVERY_R1_${candidate.id.toUpperCase()}_WALK_LEFT_T${token}_2026-09-17.png`);
          if (time === 1.05 || time === 5.25) {
            await setView(page, 'quarter');
            await captureStage(page, candidateReport, `walk_quarter_t${token}`, `CAT_RECOVERY_R1_${candidate.id.toUpperCase()}_WALK_QUARTER_T${token}_2026-09-17.png`);
          }
          candidateReport.geometryDiagnostics[`walk_t${token}`] = await getGeometryDiagnostic(page, candidate, 'walk_forward', time);
        }
      }

      for (const turn of ['turn_left', 'turn_right']) {
        if (!candidateReport.availableActions.includes(turn)) continue;
        for (const time of [1.4, 2.8]) {
          await setSample(page, candidate, turn, time);
          await setView(page, time < 2 ? 'top' : 'quarter');
          const token = time.toFixed(1).replace('.', '_');
          const key = `${turn}_t${token}`;
          await captureStage(page, candidateReport, key, `CAT_RECOVERY_R1_${candidate.id.toUpperCase()}_${turn.toUpperCase()}_T${token}_2026-09-17.png`);
          candidateReport.geometryDiagnostics[key] = await getGeometryDiagnostic(page, candidate, turn, time);
        }
      }

      for (const posture of ['sit_hold', 'lie_hold']) {
        if (!candidateReport.availableActions.includes(posture)) continue;
        await setSample(page, candidate, posture, 0.5);
        await setView(page, 'quarter');
        await captureStage(page, candidateReport, `${posture}_diagnostic`, `CAT_RECOVERY_R1_${candidate.id.toUpperCase()}_${posture.toUpperCase()}_DIAGNOSTIC_2026-09-17.png`);
        candidateReport.geometryDiagnostics[posture] = await getGeometryDiagnostic(page, candidate, posture, 0.5);
      }

      candidateReport.assertions.ready = candidateReport.ready === candidate.readyValue;
      candidateReport.assertions.noPageErrors = candidateReport.pageErrors.length === 0;
      candidateReport.assertions.noConsoleErrors = candidateReport.consoleErrors.length === 0;
      candidateReport.assertions.fixedViewsAvailable = candidateReport.missingRequiredViews.length === 0;
      candidateReport.assertions.coreRuntimeActionsAvailable = ['stand', 'walk_forward', 'turn_left', 'turn_right']
        .every((action) => candidateReport.availableActions.includes(action));
      candidateReport.assertions.standViewsUnique = new Set(requiredViews
        .map((view) => candidateReport.screenshots[`stand_${view}`]?.sha256)
        .filter(Boolean)).size === requiredViews.length;
      candidateReport.assertions.runtimePayloadIsProcedural = candidateReport.runtime?.stats?.externalModel === false;
      candidateReport.assertions.externalTextureAbsent = candidateReport.runtime?.stats?.externalTexture === false;
      candidateReport.assertions.notVisuallyApproved = true;
    } finally {
      await context.close();
    }
  }

  report.crossCandidateAssertions.allCandidatesCaptured = candidates.every((candidate) => {
    const item = report.candidates[candidate.id];
    return item?.ready === candidate.readyValue && Object.keys(item.screenshots).length >= 10;
  });
  report.crossCandidateAssertions.noAutomaticRanking = report.decision.selected === null;
  report.crossCandidateAssertions.visualApprovalStillPending = report.visualAcceptance === false;

  const hardFailures = [];
  for (const [id, item] of Object.entries(report.candidates)) {
    for (const [key, value] of Object.entries(item.assertions)) {
      if (key === 'externalTextureAbsent' || key === 'notVisuallyApproved') continue;
      if (value !== true) hardFailures.push(`${id}.${key}`);
    }
  }
  for (const [key, value] of Object.entries(report.crossCandidateAssertions)) {
    if (value !== true) hardFailures.push(`cross.${key}`);
  }
  if (hardFailures.length) throw new Error(`Recovery R1 capture assertions failed: ${hardFailures.join(', ')}`);
} catch (error) {
  failure = error;
  report.failure = String(error?.stack ?? error);
} finally {
  await browser.close();
  const reportPath = path.join(qaDir, 'CAT_BODY_MOTION_RECOVERY_R1_BROWSER_QA_2026-09-17.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const summaryPath = path.join(qaDir, 'CAT_BODY_MOTION_RECOVERY_R1_EVIDENCE_INDEX_2026-09-17.json');
  const summary = {
    schema: report.schema,
    buildId: report.buildId,
    generatedAt: report.generatedAt,
    decision: report.decision,
    candidates: Object.fromEntries(Object.entries(report.candidates).map(([id, item]) => [id, {
      label: item.config.label,
      ready: item.ready,
      title: item.title,
      availableActions: item.availableActions,
      missingRequiredActions: item.missingRequiredActions,
      screenshotCount: Object.keys(item.screenshots).length,
      pageErrors: item.pageErrors,
      consoleErrors: item.consoleErrors,
      externalTexture: item.runtime?.stats?.externalTexture ?? null,
      neutralSurface: item.runtime?.stats?.neutralSurface ?? null,
      bones: item.runtime?.stats?.bones ?? null,
      manualReview: item.manualReview,
    }])),
    visualAcceptance: false,
    productionReady: false,
  };
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
}

if (failure) throw failure;
console.log(JSON.stringify({
  buildId: report.buildId,
  candidates: Object.fromEntries(Object.entries(report.candidates).map(([id, item]) => [id, Object.keys(item.screenshots).length])),
  decision: report.decision,
}, null, 2));
