'use strict';
// Exercise the visible workbench controls and actual JSON download/upload in
// an off-screen browser, with all files kept in memory.
const fs = require('fs');
const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ready = page => page.waitForFunction(() => window.bodyImplicitR02?.report().ready && !bodyImplicitR02.report().busy, null, { timeout: 180000 });
(async () => {
  const startedUTC = new Date().toISOString();
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-gpu', '--enable-unsafe-swiftshader'] });
  const checks = [], errors = [];
  const check = (name, passed, detail) => { checks.push({ name, passed: !!passed, detail }); if (!passed) throw Error(name); };
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:8914/workbench', { waitUntil: 'domcontentloaded' });
    await ready(page);
    const original = await page.evaluate(() => bodyImplicitR02.archive());
    await page.locator('[data-motion="bend"]').click();
    await ready(page);
    const pose = await page.evaluate(() => ({ surface: bodyImplicitR02.report().renderer.activeSurface, mode: bodyImplicitR02.report().renderer.activeInspectionMode, skinDisabled: document.querySelector('[data-appearance="originalRoughness"]').disabled, note: document.querySelector('#surface-status-r25').textContent }));
    check('visible pose button renders skin preview and explains its limit', pose.surface === 'dynamic-body-p1' && pose.mode === 'source-skin' && pose.skinDisabled && pose.note.includes('尚未接入'), pose);
    await page.locator('[data-body-variable="weight"]').fill('0.43');
    await page.locator('[data-body-variable="muscle"]').fill('0.69');
    await page.locator('[data-body-local="measure-shoulder-dist-incr"]').fill('0.24');
    await page.locator('#apply-body-variables').click();
    await ready(page);
    const changed = await page.evaluate(() => ({ state: bodyImplicitR02.state(), surface: bodyImplicitR02.report().renderer.activeSurface }));
    check('visible batch controls update body and pose', changed.state.anny.phenotypes.weight === .43 && changed.state.anny.phenotypes.muscle === .69 && changed.state.anny.localChanges['measure-shoulder-dist-incr'] === .24 && changed.state.anny.pose['lowerleg01.L'][0] === 65 && changed.surface === 'dynamic-body-p1');
    const pendingDownload = page.waitForEvent('download');
    await page.locator('#save').click();
    const download = await pendingDownload;
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const savedBytes = Buffer.concat(chunks);
    const saved = JSON.parse(savedBytes.toString('utf8'));
    check('visible save exports the adjusted whole-person archive', saved.person.state.anny.phenotypes.weight === .43 && saved.person.state.anny.pose['lowerleg01.L'][0] === 65 && JSON.stringify(saved.person.headMorphology) === JSON.stringify(original.person.headMorphology), { bytes: savedBytes.length });
    await page.locator('[data-calibration="original"]').click();
    await ready(page);
    await page.locator('#archive-file').setInputFiles({ name: 'person.json', mimeType: 'application/json', buffer: savedBytes });
    await page.waitForFunction(() => bodyImplicitR02.report().busy || bodyImplicitR02.state().anny.phenotypes.weight === .43, null, { timeout: 30000 });
    await ready(page);
    const loaded = await page.evaluate(() => bodyImplicitR02.archive());
    check('visible load restores the exported body and head data', loaded.person.state.anny.phenotypes.weight === .43 && loaded.person.state.anny.pose['lowerleg01.L'][0] === 65 && JSON.stringify(loaded.person.headMorphology) === JSON.stringify(saved.person.headMorphology));
    check('no unhandled browser errors', errors.length === 0, errors);
  } catch (e) { errors.push(e.stack); }
  finally {
    await browser.close();
    const result = { startedUTC, finishedUTC: new Date().toISOString(), scope: 'actual visible workbench controls and in-memory JSON download/upload; no desktop interaction or screenshots', checks, errors, passed: errors.length === 0 && checks.length === 5 && checks.every(x => x.passed) };
    fs.mkdirSync('qa/platform-r34', { recursive: true });
    fs.writeFileSync('qa/platform-r34/ui-roundtrip.json', JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result));
    if (!result.passed) process.exitCode = 1;
  }
})();
