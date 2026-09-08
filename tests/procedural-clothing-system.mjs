import assert from 'node:assert/strict';
import {
  assertProceduralOnly,
  compileGarment,
  createHybridClothState,
  createIdentitySkinMatrices,
  createMaterialDNA,
  createProceduralClothingService,
  createStandardCrewShirtDNA,
  decodeGarmentPayload,
  deformGarment,
  encodeGarmentPayload,
  evaluateMaterialAppearance,
  garmentBounds,
  inspectGarmentBinary,
  normalizeBodyProfile,
  setSkinMatrixTranslation,
  stepHybridCloth,
  validateGarmentPayload,
} from '../packages/procedural-clothing/index.js';

const material = createMaterialDNA('cotton_jersey', { optics: { baseColorLinear: [0.08, 0.22, 0.52] } });
const garment = createStandardCrewShirtDNA({ materialDNA: material });
const body = (id, revision, height, shoulder, chest, waist) => normalizeBodyProfile({
  subject_id: id,
  proportion_revision: revision,
  measurements: {
    body_height: height,
    shoulder_width: shoulder,
    chest_circumference: chest,
    waist_circumference: waist,
    hip_circumference: waist * 1.18,
    neck_circumference: height * 0.21,
    upper_arm_circumference: chest * 0.32,
    torso_length: height * 0.29,
    arm_length: height * 0.34,
    chest_depth: chest * 0.235,
    waist_depth: waist * 0.238,
  },
});
const bodyA = body('person_a', 12, 1.72, 0.405, 0.91, 0.76);
const bodyB = body('person_b', 27, 1.93, 0.485, 1.08, 0.91);
const tests = [];
const test = (name, run) => tests.push([name, run]);
const equalArray = (a, b) => {
  assert.equal(a.constructor, b.constructor);
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i += 1) assert.equal(a[i], b[i]);
};
const nearArray = (a, b, epsilon = 1e-6) => {
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i += 1) assert.ok(Math.abs(a[i] - b[i]) <= epsilon);
};

test('procedural-only DNA', () => {
  assert.equal(assertProceduralOnly(garment), true);
  assert.throws(() => assertProceduralOnly({ asset: 'shirt.glb' }), /policy violation/i);
});
test('TypedArray payload', () => {
  const payload = compileGarment(garment, bodyA);
  assert.equal(validateGarmentPayload(payload), true);
  assert.ok(payload.positions instanceof Float32Array);
  assert.ok(payload.indices instanceof Uint32Array);
  assert.ok(payload.topology.vertexCount > 1000);
  assert.equal(payload.runtimeContract.poseAuthority, 'simulationRig.finalPose');
});
test('deterministic compilation', () => {
  const a = compileGarment(garment, bodyA);
  const b = compileGarment(garment, bodyA);
  assert.equal(a.contentHash, b.contentHash);
  equalArray(a.positions, b.positions);
  equalArray(a.indices, b.indices);
});
test('adaptive regeneration', () => {
  const a = compileGarment(garment, bodyA);
  const b = compileGarment(garment, bodyB);
  assert.equal(a.topologySignature, b.topologySignature);
  assert.equal(a.topology.vertexCount, b.topology.vertexCount);
  assert.ok(garmentBounds(b.positions).size[0] > garmentBounds(a.positions).size[0]);
  assert.equal(b.fitContract.policy.wholeGarmentScaleAllowed, false);
});
test('HRLG round trip', () => {
  const payload = compileGarment(garment, bodyA);
  const binary = encodeGarmentPayload(payload);
  const info = inspectGarmentBinary(binary);
  assert.equal(info.magic, 'HRLG');
  assert.equal(info.sections.length, 13);
  const decoded = decodeGarmentPayload(binary);
  assert.equal(decoded.contentHash, payload.contentHash);
  equalArray(decoded.positions, payload.positions);
});
test('identity final pose', () => {
  const payload = compileGarment(garment, bodyA);
  nearArray(deformGarment(payload, createIdentitySkinMatrices(payload.jointTable.length)).positions, payload.positions);
});
test('simulationRig deformation', () => {
  const payload = compileGarment(garment, bodyA);
  const matrices = createIdentitySkinMatrices(payload.jointTable.length);
  setSkinMatrixTranslation(matrices, payload.jointTable.indexOf('right_upper_arm'), 0.08, 0.025, -0.015);
  const positions = deformGarment(payload, matrices).positions;
  assert.ok(positions.some((value, index) => Math.abs(value - payload.positions[index]) > 1e-5));
});
test('analytic material', () => {
  const sample = evaluateMaterialAppearance(material, [0.124, 0.341]);
  assert.deepEqual(sample, evaluateMaterialAppearance(material, [0.124, 0.341]));
  sample.colorLinear.forEach((channel) => assert.ok(channel >= 0 && channel <= 1));
});
test('hybrid cloth finite', () => {
  const payload = compileGarment(garment, bodyA);
  const matrices = createIdentitySkinMatrices(payload.jointTable.length);
  setSkinMatrixTranslation(matrices, payload.jointTable.indexOf('right_shoulder'), 0.015, 0.01, 0);
  const state = createHybridClothState(payload);
  stepHybridCloth(payload, state, matrices, 1 / 60, { iterations: 3 });
  assert.equal(state.frame, 1);
  for (const value of state.positions) assert.ok(Number.isFinite(value));
});
test('service cache and wear', () => {
  const service = createProceduralClothingService();
  service.registerGarment(garment);
  const payload = service.compileForBody(garment.garmentId, bodyA);
  assert.equal(service.compileForBody(garment.garmentId, bodyA), payload);
  const instance = service.createInstance(payload);
  nearArray(service.updateInstance(instance.instanceId, createIdentitySkinMatrices(payload.jointTable.length)).positions, payload.positions);
  assert.equal(service.invalidateSubject('person_a', 12), 1);
});

let failed = 0;
for (const [name, run] of tests) {
  try { await run(); console.log(`PASS ${name}`); }
  catch (error) { failed += 1; console.error(`FAIL ${name}\n${error?.stack ?? error}`); }
}
console.log(`\n${tests.length - failed}/${tests.length} tests passed`);
if (failed) process.exitCode = 1;
