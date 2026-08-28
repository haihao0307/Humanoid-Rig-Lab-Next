import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBodyDNA, createHumanRigCoreV5, adaptHumanRigCoreToExistingRig } from '../src/modules/human-core-v5/index.js';
import { parseHrlSurfaceV1 } from '../src/modules/human-core-v5/production-surface-v1/hrlsurface-format-v1.js';
import { parseSkinWeightsV1 } from '../src/modules/human-core-v5/natural-skinning-v1/skin-weight-generator-v1.js';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const surfaceRelativePath = 'assets/human/production-surface-v1/humanoid-rig-production-neutral-v1.hrlsurface';
export const naturalAssetDirectory = resolve(root, 'assets/human/natural-skinning-v1');
export const qaDirectory = resolve(root, 'artifacts/qa/task16b-natural-skinning-v1');

export async function loadAuthorityV1() {
  const surfaceBytes = await readFile(resolve(root, surfaceRelativePath));
  const surface = parseHrlSurfaceV1(surfaceBytes);
  const bodyDNA = createBodyDNA();
  const rigCore = createHumanRigCoreV5({ bodyDNA, rigId: 'hrl-natural-skinning-core-v1' });
  const adapted = adaptHumanRigCoreToExistingRig(rigCore, { bodyDNA, pose: 'A' });
  return { surfaceBytes, surface, bodyDNA, rigCore, adapted };
}

export async function loadGeneratedV1() {
  const authority = await loadAuthorityV1();
  const [calibration, performanceRig, bindProfile, weightsBytes] = await Promise.all([
    readJson(resolve(naturalAssetDirectory, 'REFERENCE_POSE_CALIBRATION_V1.json')),
    readJson(resolve(naturalAssetDirectory, 'PERFORMANCE_DEFORM_RIG_V1.json')),
    readJson(resolve(naturalAssetDirectory, 'SKIN_BIND_PROFILE_V1.json')),
    readFile(resolve(naturalAssetDirectory, 'skin-weights-v1.bin')),
  ]);
  const weights = parseSkinWeightsV1(weightsBytes).data;
  return { ...authority, calibration, performanceRig, bindProfile, weights, weightsBytes };
}

export function sha256(value) { return createHash('sha256').update(value).digest('hex').toUpperCase(); }
export function shaJson(value) { return sha256(Buffer.from(JSON.stringify(value))); }
export function json(value) { return `${JSON.stringify(value, null, 2)}\n`; }
export async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }
export function maximumArrayDifference(left,right){let maximum=0;for(let index=0;index<left.length;index+=1)maximum=Math.max(maximum,Math.abs(left[index]-right[index]));return maximum;}
export function deterministicRandomFromHex(hex){let state=Number.parseInt(hex.slice(0,8),16)>>>0;if(state===0)state=0x9e3779b9;return()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};}
