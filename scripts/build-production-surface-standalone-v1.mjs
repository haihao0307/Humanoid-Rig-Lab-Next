import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reviewDirectory = resolve(root, 'artifacts/review/task16a-r2b-production-surface-v1');
const outputPath = resolve(reviewDirectory, 'production-surface-review-standalone.html');
const paths = {
  three: resolve(reviewDirectory, 'vendor/three.iife.min.js'),
  runtime: resolve(root, 'apps/human-core-v5-production-surface-v1/runtime.js'),
  styles: resolve(root, 'apps/human-core-v5-production-surface-v1/styles.css'),
  production: resolve(root, 'assets/human/production-surface-v1/humanoid-rig-production-neutral-v1.hrlsurface'),
  reference: resolve(root, 'assets/human/canonical-reference-v1/makehuman-reference-neutral-static-v1.glb'),
};
await mkdir(reviewDirectory, { recursive: true });
const [three, runtime, styles, production, reference] = await Promise.all([
  readFile(paths.three, 'utf8'), readFile(paths.runtime, 'utf8'), readFile(paths.styles, 'utf8'), readFile(paths.production), readFile(paths.reference),
]);
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'"><title>HRLSurface V1 — Portable Production Surface Review</title><style>${styles}</style></head>
<body><div id="app"></div><script>${safeScript(three)}</script><script>globalThis.__HRL_EMBEDDED_ASSETS__={production:${JSON.stringify(production.toString('base64'))},reference:${JSON.stringify(reference.toString('base64'))}};</script><script>${safeScript(runtime)}</script><script>HRLProductionSurfaceApp.start({rootSelector:'#app'});</script></body></html>\n`;
await writeFile(outputPath, html, 'utf8');
await writeFile(resolve(reviewDirectory, 'OPEN_REVIEW.cmd'), '@echo off\r\nstart "" "%~dp0production-surface-review-standalone.html"\r\n', 'utf8');
await writeFile(resolve(reviewDirectory, 'README.txt'), [
  'Humanoid Rig Lab — HRLSurface V1 portable review',
  '',
  'Double-click OPEN_REVIEW.cmd or production-surface-review-standalone.html.',
  'The page contains the editable HRLSurface asset, the locked CC0 reference, Three.js and the editor runtime.',
  'No server, CDN, extension, npm command or network connection is required.',
  '',
  'Controls:',
  '- Drag the viewport to orbit.',
  '- Use the wheel to zoom.',
  '- Use Model/View/Surface controls for comparison and topology inspection.',
  '- Use continuous shape sliders for reversible reshaping.',
  '- Enable Sculpt mode, then click the surface to apply a brush edit.',
  '- Undo, Redo and Reset shape are available in the panel.',
  '',
  'Approval remains pending: visualAcceptance=false, productionReady=false, userVisualAcceptance=pending.',
  '',
].join('\r\n'), 'utf8');
const outputBytes = await readFile(outputPath);
const manifest = {
  schema: 'humanoid_rig/hrlsurface_portable_review@1.0',
  standalonePath: 'artifacts/review/task16a-r2b-production-surface-v1/production-surface-review-standalone.html',
  standaloneSha256: sha256(outputBytes),
  standaloneBytes: outputBytes.byteLength,
  productionAssetSha256: sha256(production),
  referenceAssetSha256: sha256(reference),
  threeBundleRevision: '185',
  sourceType: 'ordinary scripts; no ES module imports',
  embeddedProductionAsset: true,
  embeddedReferenceAsset: true,
  contentSecurityPolicyConnectSrc: 'none',
  externalRequestsExpected: 0,
  fileProtocolCompatible: true,
  visualAcceptance: false,
  productionReady: false,
  userVisualAcceptance: 'pending',
};
await writeFile(resolve(reviewDirectory, 'portable-review-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);

function safeScript(source) { return source.replace(/<\/script/gi, '<\\/script'); }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex').toUpperCase(); }
