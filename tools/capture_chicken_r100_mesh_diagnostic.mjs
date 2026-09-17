import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root = process.cwd();
const evidenceDir = path.join(root, 'evidence', 'r100');
const url = process.env.CHICKEN_R100_URL || 'http://127.0.0.1:8765/CHICKEN_V46_R10_0_SINGLE_AGENT.html';
const executablePath = process.env.CHROME_PATH;
if (!executablePath) throw new Error('CHROME_PATH is required');
fs.mkdirSync(evidenceDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader'
  ]
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(30_000);
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
await page.waitForSelector('canvas', { timeout: 60_000 });
await page.waitForFunction(() => {
  const api = window.__CHICKEN_PHASE1_MOTION__;
  const skin = api?.diagnostics()?.skin;
  return Boolean(
    api?.ready
    && api.diagnostics()?.manualStepAvailable
    && window.__CHICKEN_R100_CENTERLINE_SWEEP__?.installed === true
    && skin?.peckKinematicsRevision === 'six-link-sector-gated-s-curve-v4'
    && skin?.weightingRevision === 'anatomical-topology-split-and-centerline-sweep-v7'
    && skin?.topologyRevision === 'anatomical-torso-neck-split-v7'
    && skin?.centerlineCurveRevision === 'bone-centerline-pchip-volume-preserving-v1'
    && window.__CHICKEN_R100_MESH_DEBUG__
  );
}, null, { timeout: 120_000 });
await page.evaluate(() => {
  const api = window.__CHICKEN_PHASE1_MOTION__;
  api.setAuto(false);
  api.pauseRealtime(true);
  api.reset({ clearObserved: true });
  api.runAction('peck', { frames: 28, dt: 1 / 60, resetFirst: true });
});
for (const selector of [
  'button[data-layout="solo"]',
  'button[data-focus="whole"]',
  'button[data-view="left"]',
  'button[data-mat="procedural"]'
]) {
  await page.locator(selector).click();
  await page.waitForTimeout(100);
}

const diagnostic = await page.evaluate(() => ({
  inventory: window.__CHICKEN_R100_MESH_DEBUG__.inventory(),
  skin: window.__CHICKEN_PHASE1_MOTION__?.diagnostics()?.skin || null,
  centerlineSweep: window.__CHICKEN_R100_CENTERLINE_SWEEP__ || null
}));
const inventory = diagnostic.inventory;
fs.writeFileSync(
  path.join(evidenceDir, 'R100_PECK_MESH_INVENTORY.json'),
  JSON.stringify(diagnostic, null, 2) + '\n'
);

async function capture(name, visible) {
  await page.evaluate((indices) => window.__CHICKEN_R100_MESH_DEBUG__.setVisible(indices), visible);
  await page.waitForTimeout(120);
  await page.screenshot({
    path: path.join(evidenceDir, name),
    fullPage: false,
    animations: 'allow',
    caret: 'hide',
    timeout: 30_000
  });
}

const all = inventory.map((item) => item.index);
const body = inventory.filter((item) => item.kind === 'body').map((item) => item.index);
const centerlineNeck = inventory
  .filter((item) => item.component === 'anatomical_neck_centerline_shell_v7')
  .map((item) => item.index);
const torso = body.filter((index) => !centerlineNeck.includes(index));
const coat = inventory.filter((item) => item.kind === 'coat').map((item) => item.index);
if (centerlineNeck.length !== 1) {
  throw new Error(`expected one centerline neck shell, found ${centerlineNeck.length}`);
}
if (torso.length < 1) throw new Error('torso mesh was not detected');

await capture('R100_CENTERLINE_TORSO_ONLY.png', torso);
await capture('R100_CENTERLINE_NECK_ONLY.png', centerlineNeck);
await capture('R100_CENTERLINE_BODY_AND_NECK.png', [...torso, ...centerlineNeck]);
await capture('R100_PECK_ISO_COAT.png', coat);
await capture('R100_PECK_NO_BODY.png', all.filter((index) => !body.includes(index)));
await capture('R100_PECK_NO_COAT.png', all.filter((index) => !coat.includes(index)));
await capture('R100_PECK_BODY_AND_COAT.png', [...body, ...coat]);
await capture('R100_PECK_ALL_RESTORED.png', all);
await page.evaluate(() => window.__CHICKEN_R100_MESH_DEBUG__.restore());
await browser.close();
console.log(JSON.stringify({
  revisions: {
    weightingRevision: diagnostic.skin?.weightingRevision,
    topologyRevision: diagnostic.skin?.topologyRevision,
    centerlineCurveRevision: diagnostic.skin?.centerlineCurveRevision
  },
  inventory,
  captures: 8
}, null, 2));
