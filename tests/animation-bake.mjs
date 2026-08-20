import assert from 'node:assert/strict';
import {
  importMotionClip,
  normalizeAnimationState,
  setAnimationLayer,
  validateAnimationClip,
} from '../src/modules/animation/model.js';
import { bakeAnimationSession, bakeAnimationSessionToMotionClip } from '../src/modules/animation/bake.js';
import { exportAnimationSkeletonGlb, parseGlbHeader } from '../src/modules/animation/glb.js';

let animation = normalizeAnimationState({ activeClipId: 'walk-forward' }, {
  compatibleRig: 'rig@0.4.0',
  targetProportionRevision: 12,
});
animation.activeClipId = 'walk-forward';
animation = setAnimationLayer(animation, 'upper-body', {
  enabled: true,
  clipId: 'wave',
  weight: 0.7,
});
animation = setAnimationLayer(animation, 'breathing-additive', {
  enabled: true,
  clipId: 'idle-breathe',
  weight: 0.25,
});

const profile = {
  height: 1.92,
  shoulderWidth: 0.48,
  hipWidth: 0.21,
  upperArmLength: 0.34,
  forearmLength: 0.30,
  thighLength: 0.42,
  lowerLegLength: 0.39,
};

const baked = bakeAnimationSession(animation, profile, {
  source: 'final_pose',
  sampleRate: 30,
  targetRig: 'rig@0.4.0',
  targetProportionRevision: 12,
  quaternionToleranceDegrees: 0.35,
  positionToleranceMeters: 0.001,
});
assert.equal(baked.report.valid, true, baked.report.errors.join(', '));
assert.equal(validateAnimationClip(baked.clip).valid, true);
assert.equal(baked.clip.sourceProportionRevision, 12);
assert.equal(baked.clip.rootMotionMode, 'root_motion');
assert.ok(baked.clip.tracks.some((track) => track.jointId === 'hips' && track.channel === 'position'));
assert.ok(baked.clip.tracks.some((track) => track.jointId === 'rightUpperArm' && track.channel === 'rotation'));
assert.ok(baked.stats.sourceFrames >= 37);
assert.ok(baked.stats.outputKeyframes > 30);
assert.ok(baked.stats.maxBoneLengthError < 1e-9);
assert.ok(baked.stats.maxContactError < 0.02);
assert.ok(Number.isFinite(baked.stats.maxJointAngularVelocity));

const assetResult = bakeAnimationSessionToMotionClip(animation, profile, {
  source: 'desired_pose',
  sampleRate: 24,
  targetRig: 'rig@0.4.0',
  targetProportionRevision: 12,
  projectId: 'test-project',
  subjectId: 'test-character',
});
assert.equal(assetResult.asset.schema, 'humanoid_rig/motion_clip@1.0');
assert.equal(assetResult.asset.project_id, 'test-project');
assert.equal(assetResult.asset.subject_id, 'test-character');
assert.equal(validateAnimationClip(importMotionClip(assetResult.asset)).valid, true);

const glbResult = exportAnimationSkeletonGlb(baked.clip, profile, {
  rigVersion: 'rig@0.4.0',
});
const parsed = parseGlbHeader(glbResult.glb);
assert.equal(parsed.version, 2);
assert.equal(parsed.length, glbResult.glb.byteLength);
assert.equal(parsed.json.asset.version, '2.0');
assert.equal(parsed.json.nodes.length, 28);
assert.equal(parsed.json.scenes[0].nodes.length, 1);
assert.equal(parsed.json.animations.length, 1);
assert.equal(parsed.json.animations[0].channels.length, baked.clip.tracks.length);
assert.equal(parsed.json.animations[0].extras.clip_id, baked.clip.clipId);
assert.equal(parsed.json.animations[0].extras.root_motion_mode, 'root_motion');
assert.equal(parsed.json.extras.humanoid_rig_lab.mesh_included, false);
assert.equal(glbResult.report.meshIncluded, false);
assert.ok(glbResult.glb.byteLength > 5000);

console.log('PASS finalPose and desiredPose baking, compression, MotionClip export, and standard glTF 2.0 skeleton animation GLB generation');
