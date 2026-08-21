import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { importMotionClip, normalizeAnimationState, validateAnimationClip } from '../src/modules/animation/model.js';

const root = new URL('../assets/animations/', import.meta.url);
const builtIns = normalizeAnimationState({});
const files = (await readdir(root)).filter((name) => name.endsWith('.motion.json')).sort();
const expected = [
  'head-nod.motion.json',
  'idle-breathe.motion.json',
  'squat.motion.json',
  'walk-forward.motion.json',
  'walk-in-place.motion.json',
  'wave-right.motion.json',
];
assert.deepEqual(files, expected);

for (const file of files) {
  const asset = JSON.parse(await readFile(new URL(file, root), 'utf8'));
  assert.equal(asset.schema, 'humanoid_rig/motion_clip@1.0', file);
  const clip = importMotionClip(asset);
  const report = validateAnimationClip(clip);
  assert.equal(report.valid, true, `${file}: ${report.errors.join(', ')}`);
  assert.equal(clip.compatibleRig, 'rig@0.4.0');
  assert.ok(clip.tracks.length > 0);
  assert.ok(clip.tracks.every((track) => track.channel === 'rotation' || track.jointId === clip.rootJointId));
  const builtIn = builtIns.clips.find((item) => item.clipId === clip.clipId);
  assert.ok(builtIn, `${file}: matching built-in clip`);
  assert.deepEqual(clip.tracks, builtIn.tracks, `${file}: reusable asset tracks must match the built-in action`);
  assert.deepEqual(clip.events, builtIn.events, `${file}: reusable asset events must match the built-in action`);
  assert.deepEqual(clip.contacts, builtIn.contacts, `${file}: reusable asset contacts must match the built-in action`);
}

const session = JSON.parse(await readFile(new URL('basic-animation-session.json', root), 'utf8'));
const normalized = normalizeAnimationState(session);
assert.equal(normalized.schema, 'humanoid_rig/animation_session@0.4');
assert.equal(normalized.clips.length, 7);
assert.equal(normalized.layers.length, 3);
assert.equal(normalized.graph.states.length, 4);
assert.equal(normalized.clips.find((clip) => clip.clipId === 'squat').contacts.length, 2);
assert.equal(normalized.clips.find((clip) => clip.clipId === 'walk-forward').rootMotionMode, 'root_motion');
assert.equal(normalized.clips.find((clip) => clip.clipId === 'walk-in-place').rootMotionMode, 'in_place');

const readme = await readFile(new URL('README.md', root), 'utf8');
for (const file of [...expected, 'basic-animation-session.json']) assert.match(readme, new RegExp(file.replaceAll('.', '\\.')));
assert.match(readme, /局部四元数/);
assert.match(readme, /跨人物比例/);

console.log('PASS six reusable MotionClip assets, animation-session asset, contacts, root-motion modes, and asset documentation');
