import assert from 'node:assert/strict';
import {
  parseBrowserQAArguments,
  runProceduralDeformBrowserQA,
} from '../../scripts/run-procedural-deform-browser-qa.mjs';

const options = parseBrowserQAArguments(process.argv.slice(2));
if (!options.browserPath && process.env.HRL_BROWSER_PATH) options.browserPath = process.env.HRL_BROWSER_PATH;
const report = await runProceduralDeformBrowserQA(options);
const webgpu = report.runs.find((run) => run.requestedBackend === 'webgpu');
const webgl2 = report.runs.find((run) => run.requestedBackend === 'webgl2');

if (options.backends.includes('webgl2')) {
  assert.equal(webgl2?.activeBackend, 'WebGL2', 'The forced WebGL route must create a real WebGL2 context.');
  assert.equal(webgl2?.passed, true, `WebGL2 browser QA failed: ${webgl2?.failure ?? 'unknown failure'}`);
}
if (options.backends.includes('webgpu')) {
  assert.ok(webgpu, 'WebGPU attempt record is required.');
  assert.match(webgpu.classification, /^webgpu-ci-(?:pass-software|pass-hardware|unsupported|fail)$/);
  if (!options.continueOnWebGPUFailure) {
    assert.equal(webgpu.activeBackend, 'WebGPU', 'WebGPU must pass independently; a WebGL2 fallback is not a WebGPU pass.');
    assert.equal(webgpu.passed, true, `WebGPU browser QA failed: ${webgpu.failure ?? 'unknown failure'}`);
  }
}
assert.equal(report.visualAcceptance, false);
assert.equal(report.productionReady, false);
assert.equal(report.commandPassed, true);
console.log(`Human Core V5 Procedural Deform browser QA: ${report.runs.map((run) => `${run.requestedBackend}=${run.classification}`).join(', ')}; user visual acceptance remains pending.`);
