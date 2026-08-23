import assert from 'node:assert/strict';

import { LocomotionController } from '../src/human-motion/controllers/locomotion-controller.js';
import { FootstepPlanner, sampleFootTrajectory } from '../src/human-motion/controllers/footstep-planner.js';
import { WholeBodyMotionSolver } from '../src/human-motion/solver/whole-body-motion-solver.js';
import { createBuiltInAnimationClips } from '../src/modules/animation/presets.js';
import { quaternionAngularDistance } from '../src/modules/animation/quaternion.js';

const idle = new LocomotionController();
let idleOutput;
for (let index = 0; index < 180; index += 1) idleOutput = idle.update({ desiredVelocity: [0, 0, 0], speed: 0 }, 1 / 60);
assert.equal(idleOutput.mode, 'idle');
assert.ok(Math.hypot(...idleOutput.goal.root.targetPosition) < 1e-9);
assert.equal(idleOutput.goal.metadata.locomotion.stepFrequency, 0);

const controller = new LocomotionController();
const outputs = [];
const swingEntries = { left: [], right: [] };
const gaitPhases = { left: new Set(), right: new Set() };
const stanceAnchors = { left: null, right: null };
const supportDrift = { left: 0, right: 0 };
let previousSwing = { left: false, right: false };
for (let index = 0; index < 480; index += 1) {
  const output = controller.update({
    desiredVelocity: [0, 0, 0.8],
    desiredFacing: [0, 0, 1],
    speed: 0.8,
    strideScale: 1,
    stepWidth: 0.19,
    style: { energy: 0.65, amplitude: 0.65, tempo: 1 },
  }, 1 / 60);
  outputs.push(output);
  for (const side of ['left', 'right']) {
    const foot = output.feet[side];
    gaitPhases[side].add(foot.gaitPhase);
    if (foot.swinging && !previousSwing[side]) {
      swingEntries[side].push(horizontalDistance(foot.takeoffPosition, foot.landingPosition));
      stanceAnchors[side] = null;
    }
    const contact = output.goal.contacts.find((item) => item.jointId === `${side}Foot`);
    if (contact) {
      if (!stanceAnchors[side]) stanceAnchors[side] = [...contact.targetPosition];
      supportDrift[side] = Math.max(supportDrift[side], horizontalDistance(stanceAnchors[side], contact.targetPosition));
    } else {
      stanceAnchors[side] = null;
    }
    previousSwing[side] = foot.swinging;
  }
}

assert.equal(outputs[0].mode, 'start');
assert.ok(outputs.some((output) => output.mode === 'walk'));
for (const side of ['left', 'right']) {
  assert.ok(outputs.some((output) => output.feet[side].swinging), `${side} has no swing phase`);
  assert.ok(outputs.some((output) => !output.feet[side].swinging), `${side} has no support phase`);
  assert.ok(outputs.some((output) => output.feet[side].kneeFlexPreference > 0.35), `${side} knee did not flex`);
  assert.ok(outputs.at(-1).goal.metadata.locomotion[`${side}SwingClearance`] >= 0.035);
  assert.ok(outputs.at(-1).goal.metadata.locomotion[`${side}SwingClearance`] <= 0.1);
  assert.ok(supportDrift[side] < 0.015, `${side} support foot drifted`);
  assert.ok(gaitPhases[side].size >= 7, `${side} did not cover the gait phases`);
  assert.ok(swingEntries[side].length >= 4, `${side} did not take enough steps`);
}
const leftStride = average(swingEntries.left.slice(1));
const rightStride = average(swingEntries.right.slice(1));
assert.ok(leftStride / rightStride >= 0.9 && leftStride / rightStride <= 1.1, 'left/right stride ratio is asymmetric');
assert.ok(outputs.at(-1).goal.root.targetPosition[2] > 4, 'Walk Forward did not move along +Z');
assert.equal(outputs.at(-1).goal.metadata.locomotion.rootForwardAxis, '+Z');
assert.ok(outputs.at(-1).goal.metadata.locomotion.pelvisLateralRange > 0.02);
assert.ok(outputs.at(-1).goal.metadata.locomotion.pelvisVerticalRange > 0.01);
assert.ok(outputs.at(-1).goal.metadata.locomotion.pelvisYawRange > 0.05);
assert.ok(outputs.some((output) => output.goal.metadata.locomotion.pelvisYaw * output.goal.metadata.locomotion.torsoCounterRotation < 0));
assert.ok(outputs.some((output) => output.goal.metadata.locomotion.leftArmSwing * output.goal.metadata.locomotion.leftLegSwing < 0));

const inPlace = new LocomotionController();
let inPlaceOutput;
for (let index = 0; index < 240; index += 1) {
  inPlaceOutput = inPlace.update({ desiredVelocity: [0, 0, 0.8], desiredFacing: [0, 0, 1], speed: 0.8, inPlace: true }, 1 / 60);
}
assert.ok(Math.abs(inPlaceOutput.goal.root.targetPosition[2]) < 1e-9, 'Walk In Place advanced the root');

const backward = new LocomotionController();
let backwardOutput;
for (let index = 0; index < 240; index += 1) {
  backwardOutput = backward.update({ desiredVelocity: [0, 0, -0.7], desiredFacing: [0, 0, 1], speed: 0.7 }, 1 / 60);
}
assert.ok(backwardOutput.goal.root.targetPosition[2] < -2, 'backward locomotion did not travel along -Z while facing +Z');
assert.ok(backwardOutput.goal.orientation.forward[2] > 0.99);

const turnLeft = new LocomotionController();
const turnRight = new LocomotionController();
for (let index = 0; index < 120; index += 1) {
  turnLeft.update({ speed: 0, turnRate: 0.8, inPlace: true }, 1 / 60);
  turnRight.update({ speed: 0, turnRate: -0.8, inPlace: true }, 1 / 60);
}
assert.ok(turnLeft.getState().facingYaw > 1);
assert.ok(turnRight.getState().facingYaw < -1);
assert.equal(turnLeft.getState().mode, 'turn');
assert.equal(turnRight.getState().mode, 'turn');

const stopping = new LocomotionController();
for (let index = 0; index < 120; index += 1) stopping.update({ desiredVelocity: [0, 0, 0.7], speed: 0.7 }, 1 / 60);
const beforeStop = stopping.getState().speed;
const stopSpeeds = [];
for (let index = 0; index < 120; index += 1) {
  stopSpeeds.push(stopping.update({ desiredVelocity: [0, 0, 0], speed: 0 }, 1 / 60).goal.metadata.locomotion.speed);
}
assert.ok(stopSpeeds[0] < beforeStop && stopSpeeds[0] > 0, 'Stop froze in one frame');
assert.ok(stopSpeeds.at(-1) < 0.025);
assert.equal(stopping.getState().mode, 'idle');

for (const height of [1.35, 1.795672, 2.2]) {
  const sized = new LocomotionController({ bodyProfile: { height } });
  let result;
  for (let index = 0; index < 180; index += 1) result = sized.update({ desiredVelocity: [0, 0, 0.65], speed: 0.65 }, 1 / 60);
  assert.ok(JSON.stringify(result).includes('walk'));
  assert.ok(allFinite(result));
}

const solver = new WholeBodyMotionSolver();
const runtimeController = new LocomotionController();
let frame;
for (let index = 0; index < 120; index += 1) {
  const output = runtimeController.update({ desiredVelocity: [0, 0, 0.65], speed: 0.65 }, 1 / 60);
  solver.setGoal(output.goal);
  frame = solver.solve({ deltaTime: 1 / 60, time: index / 60 });
}
assert.ok(frame.diagnostics.maxBoneLengthError < 1e-8);
assert.ok(frame.diagnostics.maxContactError < 0.015);
assert.ok(frame.diagnostics.footForwardDots.left > 0 && frame.diagnostics.footForwardDots.right > 0);
assert.ok(Object.values(frame.jointRotations).every((rotation) => Math.abs(Math.hypot(...rotation) - 1) < 1e-8));

const planner = new FootstepPlanner();
const loopStart = planner.update({ phase: 0, rootPosition: [0, 0, 0], strideLength: 0.4, stepFrequency: 1.2 });
const loopEnd = planner.update({ phase: 1, rootPosition: [0, 0, 0], strideLength: 0.4, stepFrequency: 1.2 });
assert.ok(horizontalDistance(loopStart.left.targetPosition, loopEnd.left.targetPosition) < 0.005);
assert.ok(horizontalDistance(loopStart.right.targetPosition, loopEnd.right.targetPosition) < 0.005);
assert.ok(quaternionAngularDistance(loopStart.left.targetRotation, loopEnd.left.targetRotation) < 0.02);
assert.ok(quaternionAngularDistance(loopStart.right.targetRotation, loopEnd.right.targetRotation) < 0.02);
const curveStart = sampleFootTrajectory([0, 0.1, 0], [0, 0.1, 0.5], 0, 0.06, 0.1);
const curveMiddle = sampleFootTrajectory([0, 0.1, 0], [0, 0.1, 0.5], 0.5, 0.06, 0.1);
const curveEnd = sampleFootTrajectory([0, 0.1, 0], [0, 0.1, 0.5], 1, 0.06, 0.1);
assert.deepEqual(curveStart, [0, 0.1, 0]);
assert.deepEqual(curveEnd, [0, 0.1, 0.5]);
assert.ok(curveMiddle[1] >= 0.135 && curveMiddle[1] <= 0.2);

const clipIds = new Set(createBuiltInAnimationClips().map((clip) => clip.clipId));
assert.equal(clipIds.has('walk-in-place'), true);
assert.equal(clipIds.has('walk-forward'), true);

console.log('PASS parameterized locomotion modes, gait phases, symmetric stride, clearance, contacts, pelvis/torso/arms, +Z, in-place, turn, body sizes, and compatibility clips');

function horizontalDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function allFinite(value) {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(allFinite);
  if (value && typeof value === 'object') return Object.values(value).every(allFinite);
  return true;
}
