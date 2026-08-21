import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { getActiveClip, normalizeAnimationState, sampleAnimationClip } from '../src/modules/animation/model.js';
import { sampleAnimationRuntime } from '../src/modules/animation/runtime.js';

const animation = normalizeAnimationState({ activeClipId: 'walk-forward' });
animation.activeClipId = 'walk-forward';
const clip = getActiveClip(animation);

const trackIterations = 20_000;
let started = performance.now();
for (let index = 0; index < trackIterations; index += 1) {
  sampleAnimationClip(clip, (index % 1200) / 1000);
}
const trackElapsed = performance.now() - started;
const trackAverageMs = trackElapsed / trackIterations;
assert.ok(trackAverageMs < 0.1, `track sample average ${trackAverageMs.toFixed(4)} ms`);

const runtimeIterations = 1_000;
started = performance.now();
let previous = null;
for (let index = 0; index < runtimeIterations; index += 1) {
  const frame = sampleAnimationRuntime(animation, {
    rawTime: (index % 1200) / 1000,
    bodyProfile: { height: 1.8, shoulderWidth: 0.42, upperArmLength: 0.28, forearmLength: 0.24 },
    previousFinalPose: previous,
    deltaTime: 1 / 60,
  });
  previous = frame.finalPose;
}
const runtimeElapsed = performance.now() - started;
const runtimeAverageMs = runtimeElapsed / runtimeIterations;
const runtimeBudgetMs = process.env.CI ? 12 : 6;
assert.ok(
  runtimeAverageMs < runtimeBudgetMs,
  `runtime frame average ${runtimeAverageMs.toFixed(4)} ms (budget ${runtimeBudgetMs} ms)`,
);

console.log(`PASS performance: ${trackIterations} clip samples ${trackElapsed.toFixed(2)} ms, average ${trackAverageMs.toFixed(4)} ms`);
console.log(`PASS performance: ${runtimeIterations} full runtime frames ${runtimeElapsed.toFixed(2)} ms, average ${runtimeAverageMs.toFixed(4)} ms`);
