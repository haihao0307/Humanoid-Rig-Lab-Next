import assert from 'node:assert/strict';
import { runProceduralDeformBrowserQA } from '../../scripts/run-procedural-deform-browser-qa.mjs';

const report = await runProceduralDeformBrowserQA({ browserPath: process.env.HRL_BROWSER_PATH || null });
const webgpu = report.runs.find((run) => run.requestedBackend === 'webgpu');
const webgl2 = report.runs.find((run) => run.requestedBackend === 'webgl2');

assert.equal(webgpu?.activeBackend, 'WebGPU', 'WebGPU must pass independently; a WebGL2 fallback is not a WebGPU pass.');
assert.equal(webgpu?.passed, true, `WebGPU browser QA failed: ${webgpu?.failure ?? 'unknown failure'}`);
assert.equal(webgl2?.activeBackend, 'WebGL2', 'The forced WebGL route must create a real WebGL2 context.');
assert.equal(webgl2?.passed, true, `WebGL2 browser QA failed: ${webgl2?.failure ?? 'unknown failure'}`);
assert.equal(report.visualAcceptance, false);
assert.equal(report.productionReady, false);
console.log('Human Core V5 Procedural Deform browser QA: independent WebGPU and WebGL2 runs, all controls, canvas screenshots, and runtime diagnostics passed; user visual acceptance remains pending.');
