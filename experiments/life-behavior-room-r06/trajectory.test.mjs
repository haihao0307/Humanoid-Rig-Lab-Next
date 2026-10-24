import assert from 'node:assert/strict';
import {
  LIFE_MOTION_REVISION, quintic01, quinticVelocity01, quinticAcceleration01,
  sampleHermite3, sampleQuintic3, limitVectorStep, canAdvanceLifePhase
} from './trajectory.mjs';

assert.equal(LIFE_MOTION_REVISION, 'life-behavior-room-r06');
assert.equal(quintic01(0), 0);
assert.equal(quintic01(1), 1);
assert.equal(quinticVelocity01(0), 0);
assert.equal(quinticVelocity01(1), 0);
assert.equal(quinticAcceleration01(0), 0);
assert.equal(quinticAcceleration01(1), 0);
assert.equal(quintic01(-2), 0);
assert.equal(quintic01(2), 1);

const start = [0, 0, 0], end = [1, 0.4, -2];
assert.deepEqual(sampleQuintic3(start, end, 0), start);
assert.deepEqual(sampleQuintic3(start, end, 1), end);
const hermiteStart = sampleHermite3(start, end, [0.1, 0, 0], [0, 0, 0], 2, 0);
const hermiteEnd = sampleHermite3(start, end, [0.1, 0, 0], [0, 0, 0], 2, 1);
assert.deepEqual(hermiteStart, start);
assert.deepEqual(hermiteEnd, end);

const limited = limitVectorStep([0, 0, 0], [3, 4, 0], 0.1);
assert.ok(Math.abs(Math.hypot(...limited) - 0.1) < 1e-12);
assert.deepEqual(limitVectorStep([0, 0, 0], [0.02, 0, 0], 0.1), [0.02, 0, 0]);

const allValid = {
  stableSupport: true, jointLimitsValid: true, bodyClearanceValid: true,
  contactValid: true, objectStateValid: true
};
assert.equal(canAdvanceLifePhase(allValid).ok, true);
for (const gate of Object.keys(allValid)) {
  assert.equal(canAdvanceLifePhase({ ...allValid, [gate]: false }).ok, false, gate);
}
assert.equal(canAdvanceLifePhase(null).ok, false);

console.log(JSON.stringify({
  suite: 'life-behavior-room-r06-trajectory',
  passed: 20,
  failed: 0,
  browserExecuted: false,
  physicsValidated: false,
  visualAcceptance: false
}));
