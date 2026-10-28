'use strict';
// Check whether an actual historical R20 character's authored body options
// are used, while retaining the archive and without interacting with a desktop.
const fs = require('fs');
const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const startedUTC = new Date().toISOString();
  const legacy = JSON.parse(fs.readFileSync('qa/anatomy-r20/final-person.json', 'utf8'));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-gpu', '--enable-unsafe-swiftshader'] });
  const errors = [];
  let result = null;
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:8914/workbench', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => bodyImplicitR02?.report().ready && !bodyImplicitR02.report().busy, null, { timeout: 180000 });
    const restoreResult = await page.evaluate(archive => {
      try { bodyImplicitR02.restore(archive); return { accepted: true }; }
      catch (e) { return { accepted: false, error: e.message }; }
    }, legacy);
    await page.waitForFunction(() => !bodyImplicitR02.report().busy, null, { timeout: 240000 });
    result = await page.evaluate(() => {
      const r = bodyImplicitR02.report(), archive = bodyImplicitR02.archive();
      return { activeSurface: r.renderer.activeSurface, lastError: r.lastError, bodyCalibration: archive.person.state.bodyCalibration, ignoredResearchCalibration: archive.person.bodyFunctionSystem.ignoredResearchCalibration, status: document.querySelector('#body-status').textContent, originalBodyFunctions: archive.person.bodyFunctionSystem.representation, characterTriangleFaces: r.renderer.characterTriangleFaces };
    });
    result.restoreResult = restoreResult;
    result.bodyCalibrationPreserved = JSON.stringify(result.bodyCalibration) === JSON.stringify(legacy.person.state.bodyCalibration);
  } catch (e) { errors.push(e.stack); }
  finally {
    await browser.close();
    const output = { startedUTC, finishedUTC: new Date().toISOString(), scope: 'load and save an existing R20 character in the current workbench without altering the original archive', result, errors, completed: errors.length === 0 && result?.restoreResult.accepted === true && result.bodyCalibrationPreserved === true };
    fs.mkdirSync('qa/platform-r34', { recursive: true });
    fs.writeFileSync('qa/platform-r34/legacy-r20.json', JSON.stringify(output, null, 2) + '\n');
    console.log(JSON.stringify(output));
    if (!output.completed) process.exitCode = 1;
  }
})();
