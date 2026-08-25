import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html=await readFile(new URL('../../human-core-v5-procedural-deform.html',import.meta.url),'utf8');
const app=await readFile(new URL('../../apps/human-core-v5-procedural-deform/index.js',import.meta.url),'utf8');
const adapter=await readFile(new URL('../../src/renderers/three/three-procedural-human-adapter-v5.js',import.meta.url),'utf8');
const workerClient=await readFile(new URL('../../src/modules/human-core-v5/procedural-deform/procedural-surface-worker-client-v5.js',import.meta.url),'utf8');
assert.match(html,/apps\/human-core-v5-procedural-deform\/index\.js/);
for(const label of ['Reference','Lean','Muscular','Heavy','Tall','Short','Asymmetric','Procedural Surface','Region Ownership','Field Primitives','A Pose','T Pose','Arm Raise 150','Forearm Twist 180','Squat','Lunge','Front','Back','Perspective','Fit'])assert.match(`${html}\n${app}`,new RegExp(label.replace(/[+]/g,'\\+')));
assert.doesNotMatch(`${html}\n${app}`,/\.glb|GLTFLoader|smpl-male-surface/i,'Procedural page must not request a human GLB.');
assert.match(app,/WebGPURenderer/);assert.match(app,/forceWebGL/);assert.match(app,/wholeBodySolverV5:false/);
assert.match(app,/name==='A Pose'/);assert.doesNotMatch(app,/name==='T Pose'\)\s*\{?\s*rotations\./);
assert.match(app,/data-dna-path/);assert.doesNotMatch(app,/input disabled/);
assert.match(adapter,/BufferGeometry/);assert.doesNotMatch(adapter,/createBodyDNA|HumanCoreState|createPoseFrame/);
assert.match(adapter,/setAttribute\('color'/);assert.match(workerClient,/\.\.\/\.\.\/\.\.\/\.\.\/workers\/procedural-surface\.worker\.js/);
console.log('Human Core V5 Procedural Deform page contract: no body GLB, WebGPU/WebGL2 paths, required presets/poses/cameras, and renderer-only adapter passed.');
