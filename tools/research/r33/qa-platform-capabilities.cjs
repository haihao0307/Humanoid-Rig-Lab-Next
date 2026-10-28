'use strict';
// Product audit of the delivered workbench. Runs in a hidden browser and does
// not write screenshots or change a user's existing browser/session.
const fs = require('fs');
const crypto = require('crypto');
const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const checks = [];
const errors = [];
const snapshots = {};
const startedUTC = new Date().toISOString();
const version = process.env.BODY_QA_VERSION || 'R33';
if (!['R33', 'R34'].includes(version)) throw Error('Unsupported audit version');
const targetURL = version === 'R33' ? 'http://127.0.0.1:8914/人物身体_R33_实时轮廓.html' : 'http://127.0.0.1:8914/workbench';
const ready = page => page.waitForFunction(() => {
  const r = window.bodyImplicitR02?.report();
  return r?.ready && !r.busy;
}, null, { timeout: 180000 });

async function snapshot(page) {
  return page.evaluate(() => {
    const report = bodyImplicitR02.report();
    const r = report.renderer;
    const state = bodyImplicitR02.state();
    const controls = bodyControlR17.describe();
    const groups = {};
    for (const c of controls.controls) groups[c.group] = (groups[c.group] || 0) + 1;
    return {
      ready: report.ready, busy: report.busy, lastError: report.lastError,
      sourceStatus: document.querySelector('#surface-status-r25')?.textContent,
      operationStatus: document.querySelector('#body-operation-status')?.textContent,
      rig: state.owners.rig, phenotypes: state.anny.phenotypes,
      skinControls: [...document.querySelectorAll('[data-appearance]')].map(e => ({ id: e.dataset.appearance, disabled: e.disabled })),
      surface: {
        mode: r.activeSurface, materialMode: r.sourceMaterialMode,
        sourceSkinInspection: r.sourceBodySkinInspection ?? null,
        activeInspectionMode: r.activeInspectionMode ?? null,
        dynamicOriginalShadows: r.dynamicOriginalShadows ?? null,
        originalDiffusion: r.originalDiffusion ?? null,
        fullOriginalOptics: r.fullOriginalOptics ?? null,
        originalActiveSkin: r.originalActiveSkin ?? null,
        characterTriangleFaces: r.characterTriangleFaces, webglError: r.webglError ?? null
      },
      catalogCount: report.catalogCount, bodyCatalogCount: report.bodyParameters,
      controlGroups: groups,
      personKeys: Object.keys(bodyImplicitR02.archive().person).sort(),
      motionButtons: [...document.querySelectorAll('[data-motion]')].map(e => ({ id: e.dataset.motion, disabled: e.disabled }))
    };
  });
}

async function attempt(page, operation) {
  const result = await page.evaluate(op => {
    try {
      if (op.type === 'set') return { applied: true, value: bodyControlR17.apply({ set: op.value, label: '平台功能检查' }) };
      if (op.type === 'motion') return { applied: true, value: bodyImplicitR02.motion(op.value) };
      if (op.type === 'rig') return { applied: true, value: bodyImplicitR02.setOwner(op.value) };
    } catch (e) { return { applied: false, error: e.message }; }
  }, operation);
  await ready(page);
  return result;
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-gpu', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    page.on('pageerror', e => errors.push(e.message));
    const build = JSON.parse(fs.readFileSync('BUILD-' + version + '.json', 'utf8'));
    const response = await page.goto(targetURL, { waitUntil: 'domcontentloaded' });
    const servedHash = crypto.createHash('sha256').update(await response.body()).digest('hex');
    checks.push({ name: 'server delivers the intended workbench build', passed: servedHash === build.sha256, detail: { version, servedHash } });
    await ready(page);
    snapshots.initial = await snapshot(page);
    const original = await page.evaluate(() => bodyImplicitR02.archive());
    checks.push({ name: 'default workbench renders the body', passed: snapshots.initial.surface.mode === 'source' && snapshots.initial.surface.characterTriangleFaces === 0 });

    const canvas = page.frameLocator('#body-source-embedded-r25').locator('#body-view');
    await canvas.evaluate(c => {
      const gl = c.getContext('webgl2');
      gl.finish();
      window.__AUDIT_PIXELS__ = new Uint8Array(c.width * c.height * 4);
      gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, window.__AUDIT_PIXELS__);
    });
    const appearanceResult = await page.evaluate(() => {
      const before = bodyImplicitR02.renderer.report().appearance.originalRoughness;
      bodyImplicitR02.renderer.appearance({ originalRoughness: before < .5 ? .9 : .1 });
      return { before, after: bodyImplicitR02.renderer.report().appearance.originalRoughness, activeSurface: bodyImplicitR02.renderer.report().activeSurface };
    });
    const visualChange = await canvas.evaluate(c => {
      const gl = c.getContext('webgl2');
      gl.finish();
      const after = new Uint8Array(c.width * c.height * 4);
      gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, after);
      let pixelsChanged = 0;
      for (let i = 0; i < after.length; i += 4) if (Math.max(Math.abs(after[i] - window.__AUDIT_PIXELS__[i]), Math.abs(after[i + 1] - window.__AUDIT_PIXELS__[i + 1]), Math.abs(after[i + 2] - window.__AUDIT_PIXELS__[i + 2])) > 2) pixelsChanged++;
      delete window.__AUDIT_PIXELS__;
      return { pixelsChanged, pixels: c.width * c.height, webglError: gl.getError() };
    });
    checks.push({ name: 'default skin setting changes the actual rendered image', passed: appearanceResult.before !== appearanceResult.after && appearanceResult.activeSurface === 'source' && visualChange.pixelsChanged > 100 && visualChange.webglError === 0, detail: { ...appearanceResult, ...visualChange } });
    await page.evaluate(a => bodyImplicitR02.restore(a), original);
    await ready(page);

    const poseResult = await attempt(page, { type: 'motion', value: 'bend' });
    snapshots.bend = await snapshot(page);
    const poseBefore = await page.evaluate(() => JSON.stringify(bodyImplicitR02.state().anny.pose));
    await page.waitForTimeout(1500);
    const poseAfter = await page.evaluate(() => JSON.stringify(bodyImplicitR02.state().anny.pose));
    checks.push({ name: 'body pose preset changes the body state', passed: poseResult.applied && poseResult.value?.changed === true, detail: { result: poseResult, surface: snapshots.bend.surface.mode, automaticallyMovesAfterSelection: poseBefore !== poseAfter } });
    if (version === 'R34') checks.push({ name: 'supported A-rig pose keeps the skin-colour preview', passed: snapshots.bend.surface.mode === 'dynamic-body-p1' && snapshots.bend.surface.activeInspectionMode === 'source-skin' && snapshots.bend.surface.dynamicOriginalShadows === false });

    const shapeResult = await attempt(page, { type: 'set', value: { 'shape.weight': .43, 'shape.muscle': .69, 'local.measure-shoulder-dist-incr': .24 } });
    snapshots.adjustedPose = await snapshot(page);
    const adjustedArchive = await page.evaluate(() => bodyImplicitR02.archive());
    checks.push({ name: 'sample body shape and local controls apply together', passed: shapeResult.applied && adjustedArchive.person.state.anny.phenotypes.weight === .43 && adjustedArchive.person.state.anny.phenotypes.muscle === .69 && adjustedArchive.person.state.anny.localChanges['measure-shoulder-dist-incr'] === .24, detail: { result: shapeResult, surface: snapshots.adjustedPose.surface.mode } });
    const preservedKeys = Object.keys(original.person).filter(k => !['state', 'bodyFunctionSystem', 'proceduralBodySurface', 'restoredLighting'].includes(k));
    checks.push({ name: 'sample complete-person archive retains other person fields', passed: preservedKeys.every(k => JSON.stringify(original.person[k]) === JSON.stringify(adjustedArchive.person[k])), detail: { preservedKeys } });

    const genderBefore = adjustedArchive.person.state.anny.phenotypes.gender;
    snapshots.genderAttempt = await attempt(page, { type: 'set', value: { 'shape.sex': genderBefore < .5 ? .9 : .1 } });
    snapshots.ageAttempt = await attempt(page, { type: 'set', value: { 'shape.age': .19 } });
    snapshots.afterUnsupportedAttempts = await snapshot(page);
    checks.push({ name: 'unsupported sex and age changes leave the person unchanged', passed: !snapshots.genderAttempt.applied && !snapshots.ageAttempt.applied && snapshots.afterUnsupportedAttempts.phenotypes.gender === genderBefore && snapshots.afterUnsupportedAttempts.phenotypes.age === adjustedArchive.person.state.anny.phenotypes.age });

    await page.evaluate(a => bodyImplicitR02.restore(a), original);
    await ready(page);
    const restored = await page.evaluate(() => bodyImplicitR02.archive());
    checks.push({ name: 'restore returns to the original whole-person state', passed: JSON.stringify(restored.person.state) === JSON.stringify(original.person.state) });

    snapshots.rigB = { attempt: await attempt(page, { type: 'rig', value: 'mhr' }) };
    snapshots.rigB.after = await snapshot(page);
    if (snapshots.rigB.attempt.applied && snapshots.rigB.after.rig === 'mhr') {
      snapshots.rigB.bendAttempt = await attempt(page, { type: 'motion', value: 'bend' });
      snapshots.rigB.afterBend = await snapshot(page);
    }
    await page.evaluate(a => bodyImplicitR02.restore(a), original);
    await ready(page);
    checks.push({ name: 'person can be restored after rig check', passed: await page.evaluate(a => JSON.stringify(bodyImplicitR02.state()) === JSON.stringify(a.person.state), original) });
    checks.push({ name: 'no unhandled browser errors', passed: errors.length === 0, detail: errors });
  } catch (e) {
    errors.push(e.stack);
    process.exitCode = 1;
  } finally {
    await browser.close();
    const build = JSON.parse(fs.readFileSync('BUILD-' + version + '.json', 'utf8'));
    const actual = crypto.createHash('sha256').update(fs.readFileSync(build.file)).digest('hex');
    const report = { startedUTC, finishedUTC: new Date().toISOString(), scope: 'current workbench, sample controls, pose presets, material availability and archive; no desktop input or screenshots', artifactSHA256: build.sha256, artifactMatches: actual === build.sha256, checks, snapshots, errors, passed: actual === build.sha256 && checks.length > 0 && checks.every(x => x.passed) && errors.length === 0 };
    const directory = 'qa/platform-' + version.toLowerCase();
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(directory + '/capabilities.json', JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ version, checks, errors, passed: report.passed, output: directory + '/capabilities.json' }));
    if (!report.passed) process.exitCode = 1;
  }
})();
