import assert from 'node:assert/strict';
import {
  browserFailureSummary,
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
  assert.equal(webgl2?.passed, true, `WebGL2 browser QA failed: ${JSON.stringify(browserFailureSummary(report))}`);
  assert.equal(webgl2.screenshotContentGates.every((gate) => gate.passed), true, 'Every WebGL2 screenshot must pass the foreground content gate.');
  assert.equal(webgl2.screenshotDistinctness.passed, true, 'Distinct WebGL2 poses must not produce duplicate screenshot evidence.');
}
if (options.backends.includes('webgpu')) {
  assert.ok(webgpu, 'WebGPU attempt record is required.');
  assert.match(webgpu.classification, /^webgpu-ci-(?:pass-software|pass-hardware|unsupported|fail)$/);
  if (!options.continueOnWebGPUFailure) {
    assert.equal(webgpu.activeBackend, 'WebGPU', 'WebGPU must pass independently; a WebGL2 fallback is not a WebGPU pass.');
    assert.equal(webgpu.passed, true, `WebGPU browser QA failed: ${JSON.stringify(browserFailureSummary(report))}`);
    assert.equal(webgpu.screenshotContentGates.every((gate) => gate.passed), true, 'Every WebGPU screenshot must pass the foreground content gate.');
    assert.equal(webgpu.screenshotDistinctness.passed, true, 'Distinct WebGPU poses must not produce duplicate screenshot evidence.');
  }
}
if (options.backends.includes('webgl2') && options.backends.includes('webgpu')) {
  assert.ok(report.crossBackendSilhouetteComparisons.length > 0, 'Cross-backend silhouette evidence is required.');
  assert.equal(report.crossBackendSilhouetteComparisons.every((entry) => entry.passed && entry.silhouetteIoU >= 0.97), true);
}
assert.equal(report.visualAcceptance, false);
assert.equal(report.productionReady, false);
assert.equal(report.commandPassed, true);
console.log(`Human Core V5 Procedural Deform browser QA: ${report.runs.map((run) => `${run.requestedBackend}=${run.classification}`).join(', ')}; user visual acceptance remains pending.`);
