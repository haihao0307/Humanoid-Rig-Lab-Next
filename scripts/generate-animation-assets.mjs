import { mkdir, writeFile } from 'node:fs/promises';
import { normalizeAnimationState, serializeMotionClip } from '../src/modules/animation/model.js';

const outputDirectory = new URL('../assets/animations/', import.meta.url);
const assetNames = new Map([
  ['idle-breathe', 'idle-breathe.motion.json'],
  ['wave', 'wave-right.motion.json'],
  ['head-nod', 'head-nod.motion.json'],
  ['squat', 'squat.motion.json'],
  ['walk-in-place', 'walk-in-place.motion.json'],
  ['walk-forward', 'walk-forward.motion.json'],
]);

const animation = normalizeAnimationState({});
await mkdir(outputDirectory, { recursive: true });
await writeJson(new URL('basic-animation-session.json', outputDirectory), animation);

for (const [clipId, fileName] of assetNames) {
  const clip = animation.clips.find((item) => item.clipId === clipId);
  if (!clip) throw new Error(`Missing built-in animation clip ${clipId}.`);
  await writeJson(new URL(fileName, outputDirectory), serializeMotionClip(clip));
}

console.log(`Generated ${assetNames.size} MotionClip assets and one animation session.`);

async function writeJson(url, value) {
  await writeFile(url, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
