import assert from 'node:assert/strict';
import { createDefaultState } from '../src/default-state.js';
import {
  ACTION_PLAN_SCHEMA,
  createActionPlan,
  createDefaultMotionSkillRegistry,
  DEMO_MOTION_COMMANDS,
  parseMotionText,
  previewTextMotion,
  validateActionPlan,
  validateMotionIntent,
} from '../src/modules/animation/text-motion/index.js';
import {
  importMotionClip,
  normalizeAnimationState,
  sampleAnimationClip,
  serializeMotionClip,
  validateAnimationClip,
} from '../src/modules/animation/model.js';
import { sampleAnimationRuntime } from '../src/modules/animation/runtime.js';
import { commitTextMotion } from '../src/modules/animation/text-motion/executor.js';

const registry = createDefaultMotionSkillRegistry();
assert.equal(registry.validate().valid, true);
assert.equal(DEMO_MOTION_COMMANDS.length, 5);
const registeredSkillIds = registry.list().map((skill) => skill.skillId);
for (const skillId of [
  'idle', 'walk', 'walk_backward', 'stop', 'turn', 'look', 'reach', 'point',
  'wave', 'salute', 'squat', 'crouch', 'bend', 'inspect', 'sit', 'stand_up',
  'salute_right', 'salute_left', 'look_at', 'turn_to', 'recover',
]) {
  assert.ok(registeredSkillIds.includes(skillId), `registry should retain ${skillId}`);
}

const chinese = parseMotionText('向前走三步后敬礼');
assert.equal(chinese.schema, 'humanoid_rig/motion_intent@1.0');
assert.equal(chinese.status, 'ready');
assert.equal(validateMotionIntent(chinese).valid, true);
assert.deepEqual(chinese.actions.map((action) => action.skillId), ['walk', 'salute']);
assert.equal(chinese.actions[0].direction, 'forward');
assert.equal(chinese.actions[0].stepCount, 3);
assert.equal(chinese.sequenceRelations.length, 1);
assert.equal(chinese.sequenceRelations[0].afterActionId, chinese.actions[1].actionId);

const english = parseMotionText('Walk three steps then salute with the right hand');
assert.equal(english.language, 'en');
assert.deepEqual(english.actions.map((action) => action.skillId), ['walk', 'salute']);
assert.equal(english.actions[1].side, 'right');
assert.equal(english.actions[0].stepCount, 3);

const parallelIntent = parseMotionText('慢慢向前走并向右观察');
assert.deepEqual(parallelIntent.actions.map((action) => action.skillId), ['walk', 'look']);
assert.equal(parallelIntent.actions[0].speed, 'slow');
assert.equal(parallelIntent.actions[1].direction, 'right');
assert.equal(parallelIntent.parallelRelations.length, 1);

const targetIntent = parseMotionText('弯腰检查左前方的发动机');
assert.deepEqual(targetIntent.actions.map((action) => action.skillId), ['bend', 'inspect']);
assert.equal(targetIntent.actions[1].target, '发动机');
assert.equal(targetIntent.actions[1].direction, 'left_forward');

const unsupported = parseMotionText('后空翻三圈');
assert.equal(unsupported.status, 'unsupported');
assert.ok(unsupported.missingSkills.includes('backflip'));
assert.ok(unsupported.warnings.includes('UNSUPPORTED_ACTION:backflip'));

const deterministicA = parseMotionText('向前走三步后敬礼');
const deterministicB = parseMotionText('向前走三步后敬礼');
assert.deepEqual(deterministicA, deterministicB, 'same text must produce the same intent');

const state = createDefaultState();
const generated = previewTextMotion('向前走三步后用右手敬礼', {
  state,
  registry,
});
assert.equal(generated.status, 'ready');
assert.equal(generated.plan.schema, ACTION_PLAN_SCHEMA);
assert.equal(validateActionPlan(generated.plan).valid, true);
assert.deepEqual(generated.plan.requiredSkills, ['salute', 'walk']);
assert.equal(generated.plan.steps[0].parameters.stepCount, 3);
assert.ok(generated.plan.steps[1].startAfter.includes(generated.plan.steps[0].stepId));
assert.ok(generated.clip, 'supported text must compile into an AnimationClip');
assert.equal(validateAnimationClip(generated.clip).valid, true);
assert.ok(generated.clip.metadata.sourceText.includes('向前走三步'));
assert.equal(generated.clip.metadata.actionPlanId, generated.plan.planId);
assert.equal(generated.clip.rootMotionMode, 'root_motion');
assert.ok(generated.clip.tracks.some((track) => track.jointId === 'rightUpperArm'));
assert.ok(generated.clip.tracks.some((track) => track.jointId === 'hips' && track.channel === 'position'));
assert.ok(generated.clip.tracks.every((track) => track.channel !== 'scale'));
assert.ok(generated.clip.tracks.filter((track) => track.channel === 'position').every((track) => ['root', 'hips', 'pelvis'].includes(track.jointId)));
assert.ok(generated.clip.tracks.filter((track) => track.channel === 'rotation').every((track) => track.keyframes.every((key) => Math.abs(Math.hypot(...key.value) - 1) < 1e-8)));

const animationWithGenerated = normalizeAnimationState({
  ...state.character.animation,
  activeClipId: generated.clip.clipId,
  clips: [...normalizeAnimationState(state.character.animation).clips, generated.clip],
}, { compatibleRig: state.activeVersions.rig });
const runtimeFrame = sampleAnimationRuntime(animationWithGenerated, {
  rawTime: generated.clip.duration * 0.5,
  bodyProfile: state.character.bodyProfile,
  rigVersion: state.activeVersions.rig,
});
assert.equal(runtimeFrame.activeClipId, generated.clip.clipId);
assert.equal(runtimeFrame.simulationRig.fk.positions.size, 89);
assert.ok(runtimeFrame.diagnostics.maxBoneLengthError < 1e-8);
assert.ok(runtimeFrame.v8Payload.localRotations);

const parallelGenerated = previewTextMotion('慢慢向前走并向右观察', { state, registry });
assert.equal(parallelGenerated.status, 'ready');
assert.equal(parallelGenerated.plan.parallelGroups.length, 1);
assert.ok(parallelGenerated.clip.tracks.some((track) => ['neck', 'head'].includes(track.jointId)));
assert.ok(parallelGenerated.clip.tracks.some((track) => track.jointId === 'hips' && track.channel === 'position'));
assert.equal(validateAnimationClip(parallelGenerated.clip).valid, true);

const unresolved = previewTextMotion('弯腰检查左前方的发动机', { state, registry });
assert.equal(unresolved.status, 'ready');
assert.deepEqual(unresolved.plan.unresolvedTargets, ['发动机']);
assert.equal(unresolved.clip.metadata.sourceText, '弯腰检查左前方的发动机');

const motionAsset = serializeMotionClip(generated.clip, {
  projectId: state.projectId,
  subjectId: 'character_001',
});
const imported = importMotionClip(motionAsset);
assert.deepEqual(imported.tracks, generated.clip.tracks);
assert.equal(validateAnimationClip(imported).valid, true);
assert.deepEqual(sampleAnimationClip(imported, 0.5), sampleAnimationClip(generated.clip, 0.5));

const unchangedBeforePreview = JSON.stringify(state);
previewTextMotion('向前走三步后敬礼', { state, registry });
assert.equal(JSON.stringify(state), unchangedBeforePreview, 'preview must not create a ProjectState revision');

let transactionCount = 0;
let committedState = structuredClone(state);
const hub = {
  getState: () => structuredClone(committedState),
  transaction(mutator) {
    transactionCount += 1;
    const next = structuredClone(committedState);
    mutator(next);
    next.revision += 1;
    committedState = next;
    return structuredClone(next);
  },
};
const saved = commitTextMotion(hub, '向前走三步后敬礼', { registry });
assert.equal(transactionCount, 1, 'generate and save must commit one AnimationSession revision');
assert.equal(saved.state.character.animation.activeClipId, saved.clip.clipId);
assert.equal(saved.state.character.animation.textMotion.generatedClipId, saved.clip.clipId);
assert.equal(saved.state.characterCore.profiles.character_001.character_id, 'character_001');

const legacyAnimation = normalizeAnimationState({
  schema: 'humanoid_rig/animation_session@0.3',
  clip: 'wave',
  playing: false,
  time: 0.4,
});
assert.equal(legacyAnimation.schema, 'humanoid_rig/animation_session@0.4');
assert.equal(legacyAnimation.activeClipId, 'wave');
assert.equal(legacyAnimation.textMotion, undefined);

const unsupportedPlan = createActionPlan(unsupported, { registry });
assert.equal(unsupportedPlan.status, 'unsupported');
assert.ok(unsupportedPlan.missingSkills.includes('backflip'));

const defaulted = previewTextMotion('走过去', { state, registry });
assert.equal(defaulted.status, 'ready');
assert.ok(defaulted.warnings.includes('DEFAULT_DIRECTION_APPLIED'));
assert.ok(defaulted.warnings.includes('DEFAULT_DISTANCE_APPLIED'));
const defaultSide = previewTextMotion('敬礼', { state, registry });
assert.equal(defaultSide.plan.steps[0].parameters.side, 'right');
assert.ok(defaultSide.warnings.includes('DEFAULT_SIDE_APPLIED'));

console.log('PASS deterministic bilingual MotionIntent, ActionPlan sequencing/parallelism, skill registry, AnimationClip compilation, simulationRig runtime, MotionClip round-trip, ProjectHub transaction boundary, preview isolation, and legacy compatibility');
