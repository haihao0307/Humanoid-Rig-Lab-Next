import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  BodyFieldCompilerV5, ProceduralDeformRuntimeV5, createBodyDNA, createHumanRigCoreV5,
  createProceduralSurfaceCacheKeyV5, extractStableProceduralSurfaceV5,
} from '../src/modules/human-core-v5/index.js';

const root = new URL('..', import.meta.url).pathname.replace(/^\/(.:)/, '$1');
const coreDir = join(root, 'src/modules/human-core-v5/procedural-deform');
const coreFiles = (await readdir(coreDir)).filter((name) => name.endsWith('.js'));
for (const name of coreFiles) {
  const source = await readFile(join(coreDir, name), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]three(?:\/|['"])/i, `${name} imports Three.js.`);
  assert.doesNotMatch(source, /assets\/.*\.glb|smpl-male-surface-skinned\.glb/i, `${name} references a fixed human GLB.`);
  assert.doesNotMatch(source, /import\s+.*project-hub|new\s+ProjectState|projectState\.apply/i, `${name} attempts to store derived surface data in ProjectState.`);
}

const humanCoreState = await readFile(join(root, 'src/modules/human-core-v5/human-core-state-v5.js'), 'utf8');
for (const forbidden of ['BufferGeometry', 'GPUBuffer', 'deformedPositions', 'regionBlendWeights']) assert.equal(humanCoreState.includes(forbidden), false);

const dna = createBodyDNA({ bodyDNAId:'body-dna-contract', identity:{humanId:'contract-human'}, proportionRevision:7 });
const rigCore = createHumanRigCoreV5({ bodyDNA:dna });
const fieldA = new BodyFieldCompilerV5().compile({ bodyDNA:dna, rigCore });
const fieldB = new BodyFieldCompilerV5().compile({ bodyDNA:dna, rigCore });
assert.equal(fieldA.fingerprint, fieldB.fingerprint);
assert.deepEqual(fieldA.definition.subtractions.map((entry) => entry.subtractionId), [
  'left-axilla-relief', 'left-groin-relief', 'right-axilla-relief', 'right-groin-relief', 'central-groin-separator',
]);
assert.deepEqual(fieldA.definition.subtractions.map((entry) => entry.targetJunction), ['shoulder', 'hip', 'shoulder', 'hip', 'hip']);
assert.equal(createProceduralSurfaceCacheKeyV5(fieldA.definition, 24), createProceduralSurfaceCacheKeyV5(fieldB.definition, 24));
const surfaceA = extractStableProceduralSurfaceV5(fieldA, { resolution:24 });
const surfaceB = extractStableProceduralSurfaceV5(fieldB, { resolution:24 });
assert.equal(surfaceA.metadata.topologyFingerprint, surfaceB.metadata.topologyFingerprint);
assert.deepEqual(surfaceA.positions, surfaceB.positions);

const differentDNA = createBodyDNA({
  bodyDNAId:'body-dna-contract-tall', identity:{humanId:'contract-human-tall'}, proportionRevision:8,
  proportion:{height:2.02,shoulderWidth:.50,hipWidth:.23,limbLengths:{upperArm:.35,forearm:.31,handControl:.09,thigh:.52,lowerLeg:.49}},
});
const differentRig = createHumanRigCoreV5({ bodyDNA:differentDNA });
const differentField = new BodyFieldCompilerV5().compile({ bodyDNA:differentDNA, rigCore:differentRig });
const differentSurface = extractStableProceduralSurfaceV5(differentField, { resolution:24 });
assert.notEqual(differentField.fingerprint, fieldA.fingerprint);
assert.notEqual(differentSurface.metadata.topologyFingerprint, surfaceA.metadata.topologyFingerprint);

const runtime = new ProceduralDeformRuntimeV5();
runtime.compileHuman({ bodyDNA:dna, rigCore });
assert.equal(runtime.getDiagnostics().glbDependency, false);
assert.equal(runtime.getDiagnostics().rendererDependency, false);
assert.equal(rigCore.diagnostics.projectionOnly, true, 'Procedural Deform must retain HumanRigCore as a projection of the only Rig.');

console.log('Human Core V5 Procedural Deform contract: renderer independence, no GLB path, stable field/cache fingerprints, and no second state/Rig passed.');
