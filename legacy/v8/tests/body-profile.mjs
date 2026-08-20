import assert from 'node:assert/strict';
import {
  createStandardHumanoidPreset,
  normalizeSkeletonDefinition,
  summarizeRigDefinition,
} from '../src/skeleton-presets.js';
import {
  applyBodyProfileToDefinition,
  bodyProfileKey,
  bodyProfileRequiresSkinRebind,
  measureBodyProfile,
  normalizeBodyProfile,
  REFERENCE_BODY_PROFILE,
} from '../src/body-profile.js';
import { calculateRigHeight, computeRestWorldPositions, getBoneLength } from '../src/skeleton-model.js';

function assertMetric(actual, expected, label, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected}`);
}

const base = normalizeSkeletonDefinition(createStandardHumanoidPreset('A'));
const baseBind = JSON.stringify(base.joints.map((joint) => [joint.id, joint.parentId, joint.localPosition]));
const baseTopology = base.joints.map((joint) => [joint.id, joint.parentId]);
const baseRest = computeRestWorldPositions(base);

const reference = applyBodyProfileToDefinition(base, REFERENCE_BODY_PROFILE, { preservePose: false });
const referenceMetrics = measureBodyProfile(reference);
for (const [key, value] of Object.entries(REFERENCE_BODY_PROFILE)) {
  if (typeof value === 'number') assertMetric(referenceMetrics[key], value, `reference ${key}`);
}
assertMetric(calculateRigHeight(reference), REFERENCE_BODY_PROFILE.height, 'reference rig height');
assert.equal(reference.schemaVersion, 7);
assert.equal(reference.profilePreview.requiresSkinRebind, false);
assert.equal(reference.joints.find((joint) => joint.id === 'leftShoulder').visualJoint, false);
assert.equal(reference.joints.find((joint) => joint.id === 'rightShoulder').visualJoint, false);
assert.equal(reference.joints.find((joint) => joint.id === 'leftUpperArm').visualJoint, true);
assert.equal(reference.joints.find((joint) => joint.id === 'rightUpperArm').visualJoint, true);
assert.equal(reference.joints.find((joint) => joint.id === 'headTop').visualJoint, false);
assert.equal(reference.joints.find((joint) => joint.id === 'headTop').visualBone, false);
assert.equal(reference.joints.find((joint) => joint.id === 'leftToesEnd').visualJoint, false);
assert.equal(reference.joints.find((joint) => joint.id === 'rightToesEnd').visualJoint, false);
const referenceRigSummary = summarizeRigDefinition(reference);
assert.equal(referenceRigSummary.countMatchesProfile, true);
assert.equal(referenceRigSummary.axisAudit.complete, true);
assert.equal(referenceRigSummary.axisAudit.orthonormal, true);
assert.equal(referenceRigSummary.counts.visibleJoints, 83);
assert.equal(JSON.stringify(base.joints.map((joint) => [joint.id, joint.parentId, joint.localPosition])), baseBind, 'Profile application mutated the source definition.');

assert.deepEqual(reference.joints.map((joint) => [joint.id, joint.parentId]), baseTopology, 'Reference rebuild changed fixed joint IDs or parent topology.');
const referenceRestAfterRebuild = computeRestWorldPositions(reference);
let maximumReferenceWorldDrift = 0;
for (const baseJoint of base.joints) {
  const rebuiltJoint = reference.joints.find((joint) => joint.id === baseJoint.id);
  assert.ok(rebuiltJoint, `Reference rebuild lost joint ${baseJoint.id}.`);
  assert.deepEqual(rebuiltJoint.localPosition, baseJoint.localPosition, `Reference rebuild changed ${baseJoint.id} bind position.`);
  assert.deepEqual(rebuiltJoint.controlOffset, baseJoint.controlOffset, `Reference rebuild changed ${baseJoint.id} control offset.`);
  assert.equal(rebuiltJoint.jointRadius, baseJoint.jointRadius, `Reference rebuild changed ${baseJoint.id} joint radius.`);
  assert.equal(rebuiltJoint.boneRadius, baseJoint.boneRadius, `Reference rebuild changed ${baseJoint.id} bone radius.`);

  const before = baseRest.get(baseJoint.id);
  const after = referenceRestAfterRebuild.get(baseJoint.id);
  const drift = Math.hypot(before.x - after.x, before.y - after.y, before.z - after.z);
  maximumReferenceWorldDrift = Math.max(maximumReferenceWorldDrift, drift);
}
assertMetric(maximumReferenceWorldDrift, 0, 'reference maximum world drift', 1e-12);
assert.equal(bodyProfileRequiresSkinRebind({ ...REFERENCE_BODY_PROFILE, preset: 'custom', requiresRebind: true }), false);
assert.equal(bodyProfileRequiresSkinRebind({ ...REFERENCE_BODY_PROFILE, shoulderWidth: REFERENCE_BODY_PROFILE.shoulderWidth + 0.002, requiresRebind: false }), true);

const customProfile = normalizeBodyProfile({
  preset: 'test-custom',
  height: 1.93,
  shoulderWidth: 0.455,
  hipWidth: 0.218,
  upperArmLength: 0.306,
  forearmLength: 0.264,
  handControlLength: 0.077,
  thighLength: 0.472,
  lowerLegLength: 0.438,
});
const custom = applyBodyProfileToDefinition(reference, customProfile, { preservePose: false });
const metrics = measureBodyProfile(custom);
for (const [key, value] of Object.entries(customProfile)) {
  if (typeof value === 'number' && key !== 'draftRevision') assertMetric(metrics[key], value, `custom ${key}`);
}
assertMetric(getBoneLength(custom, 'leftLowerArm'), customProfile.upperArmLength, 'left upper arm');
assertMetric(getBoneLength(custom, 'rightLowerArm'), customProfile.upperArmLength, 'right upper arm');
assertMetric(getBoneLength(custom, 'leftHand'), customProfile.forearmLength, 'left forearm');
assertMetric(getBoneLength(custom, 'rightHand'), customProfile.forearmLength, 'right forearm');
assertMetric(getBoneLength(custom, 'leftLowerLeg'), customProfile.thighLength, 'left thigh');
assertMetric(getBoneLength(custom, 'rightLowerLeg'), customProfile.thighLength, 'right thigh');
assertMetric(getBoneLength(custom, 'leftFoot'), customProfile.lowerLegLength, 'left shank');
assertMetric(getBoneLength(custom, 'rightFoot'), customProfile.lowerLegLength, 'right shank');
assert.equal(custom.profilePreview.requiresSkinRebind, true);
const customRigSummary = summarizeRigDefinition(custom);
assert.equal(customRigSummary.axisAudit.complete, true);
assert.equal(customRigSummary.axisAudit.orthonormal, true);
assert.equal(custom.jointAxes.schema, 'humanoid_rig/joint_axes@1.0');
assert.notDeepEqual(
  custom.jointAxes.entries.leftShoulder.twistAxisLocal,
  reference.jointAxes.entries.leftShoulder.twistAxisLocal,
  'Shoulder-width changes must regenerate the bind-axis direction contract.',
);
assert.notEqual(bodyProfileKey(customProfile), bodyProfileKey(REFERENCE_BODY_PROFILE));

const clamped = normalizeBodyProfile({ height: 99, shoulderWidth: 0, lowerLegLength: -1 });
assert.equal(clamped.height, 2.15);
assert.equal(clamped.shoulderWidth, 0.28);
assert.equal(clamped.lowerLegLength, 0.30);
assert.equal(clamped.requiresRebind, true);

const ranges = {
  height: [1.40, 2.15],
  shoulderWidth: [0.28, 0.58],
  hipWidth: [0.14, 0.38],
  upperArmLength: [0.20, 0.40],
  forearmLength: [0.18, 0.36],
  handControlLength: [0.04, 0.12],
  thighLength: [0.30, 0.56],
  lowerLegLength: [0.30, 0.54],
};
const dimensionKeys = Object.keys(ranges);
const mirroredPairs = [
  ['leftShoulder', 'rightShoulder'],
  ['leftUpperArm', 'rightUpperArm'],
  ['leftLowerArm', 'rightLowerArm'],
  ['leftHand', 'rightHand'],
  ['leftHandEnd', 'rightHandEnd'],
  ['leftUpperLeg', 'rightUpperLeg'],
  ['leftLowerLeg', 'rightLowerLeg'],
  ['leftFoot', 'rightFoot'],
  ['leftToes', 'rightToes'],
  ['leftToesEnd', 'rightToesEnd'],
];
const endpointIds = ['leftFoot', 'leftToes', 'leftToesEnd', 'rightFoot', 'rightToes', 'rightToesEnd'];
const referenceRest = baseRest;
const referenceFootClearance = Math.min(...endpointIds.map((id) => referenceRest.get(id).y));

function validateGeneratedProfile(rawProfile, label) {
  const profile = normalizeBodyProfile(rawProfile);
  const generated = applyBodyProfileToDefinition(base, profile, { preservePose: false });
  assert.deepEqual(generated.joints.map((joint) => [joint.id, joint.parentId]), baseTopology, `${label} changed fixed joint IDs or parent topology.`);
  assert.equal(generated.joints.find((joint) => joint.id === 'leftShoulder')?.visualJoint, false, `${label} exposed the left clavicle control.`);
  assert.equal(generated.joints.find((joint) => joint.id === 'rightShoulder')?.visualJoint, false, `${label} exposed the right clavicle control.`);
  assert.equal(generated.joints.find((joint) => joint.id === 'leftUpperArm')?.visualJoint, true, `${label} hid the left visible shoulder joint.`);
  assert.equal(generated.joints.find((joint) => joint.id === 'rightUpperArm')?.visualJoint, true, `${label} hid the right visible shoulder joint.`);
  assert.equal(generated.joints.find((joint) => joint.id === 'headTop')?.visualJoint, false, `${label} exposed the head measurement marker.`);
  assert.equal(generated.joints.find((joint) => joint.id === 'leftToesEnd')?.visualJoint, false, `${label} exposed the left toe measurement marker.`);
  assert.equal(generated.joints.find((joint) => joint.id === 'rightToesEnd')?.visualJoint, false, `${label} exposed the right toe measurement marker.`);
  const rigSummary = summarizeRigDefinition(generated);
  assert.equal(rigSummary.countMatchesProfile, true, `${label} changed the rig role counts.`);
  assert.equal(rigSummary.axisAudit.complete, true, `${label} has missing joint-axis entries.`);
  assert.equal(rigSummary.axisAudit.orthonormal, true, `${label} has invalid joint axes.`);
  const measured = measureBodyProfile(generated);
  for (const key of dimensionKeys) assertMetric(measured[key], profile[key], `${label} ${key}`);

  const rest = computeRestWorldPositions(generated);
  const endpointMinimum = Math.min(...endpointIds.map((id) => rest.get(id).y));
  assertMetric(endpointMinimum, referenceFootClearance * (profile.height / REFERENCE_BODY_PROFILE.height), `${label} foot clearance`, 1e-8);

  for (const [leftId, rightId] of mirroredPairs) {
    const left = rest.get(leftId);
    const right = rest.get(rightId);
    assertMetric(left.x, -right.x, `${label} ${leftId}/${rightId} mirrored X`, 1e-8);
    assertMetric(left.y, right.y, `${label} ${leftId}/${rightId} mirrored Y`, 1e-8);
    assertMetric(left.z, right.z, `${label} ${leftId}/${rightId} mirrored Z`, 1e-8);
  }

  const verticalChain = ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head', 'headTop'];
  for (let index = 1; index < verticalChain.length; index += 1) {
    const lower = rest.get(verticalChain[index - 1]);
    const upper = rest.get(verticalChain[index]);
    assert.ok(upper.y > lower.y, `${label} central chain inverted at ${verticalChain[index]}.`);
  }
}

for (let mask = 0; mask < 2 ** dimensionKeys.length; mask += 1) {
  const profile = { preset: `corner-${mask}` };
  dimensionKeys.forEach((key, index) => {
    profile[key] = ranges[key][(mask >> index) & 1];
  });
  validateGeneratedProfile(profile, `corner ${mask}`);
}

let randomState = 0x5eeda11;
const random = () => {
  randomState = (1664525 * randomState + 1013904223) >>> 0;
  return randomState / 0x100000000;
};
for (let index = 0; index < 64; index += 1) {
  const profile = { preset: `random-${index}` };
  for (const key of dimensionKeys) {
    const [min, max] = ranges[key];
    profile[key] = min + (max - min) * random();
  }
  validateGeneratedProfile(profile, `random ${index}`);
}

assert.equal(JSON.stringify(base.joints.map((joint) => [joint.id, joint.parentId, joint.localPosition])), baseBind, 'Profile regression tests mutated the immutable source definition.');
console.log('V8.5 live 3D body-profile rebuild, immutable reference bind with zero world drift, fixed 89-node topology and role counts, 89-entry bind-axis regeneration, 256 boundary profiles, 64 deterministic mixed profiles, hidden helper markers, and rebind checks passed.');
