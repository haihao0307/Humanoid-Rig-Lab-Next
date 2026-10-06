import assert from 'node:assert/strict';
import { evaluateFiniteSeamConstraint as evaluate, updateSourceSeamMultipliers as update } from '../ShortsPaperSeamMultipliers.mjs';
import { paperFormingSeamSpringTerms as legacy } from '../ShortsPaperForming.mjs';
const tests = [], test = (name, run) => tests.push({ name, run });
const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b)), `${a} != ${b}`);
const p = [[.2, -.3, .4], [.7, .1, -.2], [-.1, .3, .8]];
const springs = [{ a: 0, b: 1, weight: 2, multiplier: [.3, -.1, .2] }, { a: 1, b: 2, weight: .7, multiplier: [-.2, .4, -.1] }, { a: 2, b: 0, weight: 1.2, multiplier: [.1, .2, .3] }];
const d = [[.3, -.1, .07], [.04, .2, -.03], [-.1, .05, .12]], dot = (a, b) => a.flat(Infinity).reduce((s, x, i) => s + x * b.flat(Infinity)[i], 0);
const move = (points, direction, f) => points.map((x, i) => x.map((v, k) => v + f * direction[i][k]));
const rotate = x => [-x[1], x[0], x[2]];
test('Null and absent multipliers preserve exact original energy/gap/gradient arithmetic', () => {
 for (const rows of [springs.map(({ multiplier, ...s }) => s), springs.map(s => ({ ...s, multiplier: null }))]) {
  const a = legacy(p, rows), b = evaluate(p, rows); assert.equal(a.energyM2, b.energyM2); assert.equal(a.maximumSoftGapM, b.maximumSoftGapM); assert.deepEqual(a.gradients, b.gradients);
  assert.equal(evaluate(p, rows, { withGradients: false }).gradients, null);
 }
});
test('Three-vector augmented Lagrangian gradients match +/- directional finite differences', () => {
 const r = evaluate(p, springs), eps = 1e-6;
 const fd = (evaluate(move(p, d, eps), springs).energyM2 - evaluate(move(p, d, -eps), springs).energyM2) / (2 * eps); close(dot(r.gradients, d), fd);
 for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) {
  const v = p.map(() => [0, 0, 0]); v[i][k] = 1;
  close(r.gradients[i][k], (evaluate(move(p, v, eps), springs).energyM2 - evaluate(move(p, v, -eps), springs).energyM2) / (2 * eps));
 }
});
test('True geometric seam gap is independent of multiplier/shifted residual', () => {
 const rows = [{ a: 0, b: 1, weight: 1, multiplier: p[1].map((v, k) => v - p[0][k]) }], r = evaluate(p, rows);
 assert.ok(r.maximumSoftGapM > .8); assert.ok(r.energyM2 < 0); assert.deepEqual(r.gradients, [[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
 assert.equal(r.law.physicalCalibrated, false); assert.equal(r.law.wearingAccepted, false);
});
test('Verified dual update uses lambda+=rho*r with stable source-pair orientation', () => {
 const rows = update(springs, p, { innerStationarityVerified: true });
 rows.forEach((s, i) => { assert.equal(s.a, springs[i].a); assert.equal(s.b, springs[i].b); assert.equal(s.weight, springs[i].weight); s.multiplier.forEach((v, k) => close(v, springs[i].multiplier[k] + s.weight * (p[s.a][k] - p[s.b][k]))); });
});
test('Reversing source edge and its dual sign preserves energy/gradient and reverses updated lambda', () => {
 const reversed = springs.map(s => ({ ...s, a: s.b, b: s.a, multiplier: s.multiplier.map(v => -v) }));
 const a = evaluate(p, springs), b = evaluate(p, reversed); close(a.energyM2, b.energyM2); a.gradients.flat().forEach((v, i) => close(v, b.gradients.flat()[i]));
 const u = update(springs, p, { innerStationarityVerified: true }), v = update(reversed, p, { innerStationarityVerified: true }); u.forEach((s, i) => s.multiplier.forEach((x, k) => close(x, -v[i].multiplier[k])));
});
test('Cycles/multiway constraints retain every original source edge without far-pair averaging', () => {
 const rows = update(springs, p, { innerStationarityVerified: true }); assert.equal(rows.length, 3); assert.deepEqual(rows.map(s => [s.a, s.b]), springs.map(s => [s.a, s.b]));
 const r = evaluate(p, rows); for (let k = 0; k < 3; k++) close(r.gradients.reduce((s, g) => s + g[k], 0), 0, 1e-12);
});
test('Current positions, multipliers, and source graph remain immutable', () => {
 const before = JSON.stringify({ p, springs }); evaluate(p, springs); const u = update(springs, p, { innerStationarityVerified: true }); u[0].multiplier[0] = 99;
 assert.equal(JSON.stringify({ p, springs }), before);
 const noDual = [{ a: 0, b: 1, weight: 2, multiplier: null }]; update(noDual, p, { innerStationarityVerified: true }); assert.equal(noDual[0].multiplier, null);
});
test('Proper rigid motion is covariant when source multiplier vectors rotate with coordinates', () => {
 const moved = p.map(x => rotate(x).map((v, k) => v + [2, -1, .7][k])), rows = springs.map(s => ({ ...s, multiplier: rotate(s.multiplier) }));
 const a = evaluate(p, springs), b = evaluate(moved, rows); close(a.energyM2, b.energyM2); close(a.maximumSoftGapM, b.maximumSoftGapM);
 a.gradients.map(rotate).flat().forEach((v, i) => close(v, b.gradients.flat()[i]));
 const u = update(springs, p, { innerStationarityVerified: true }), v = update(rows, moved, { innerStationarityVerified: true }); u.forEach((s, i) => rotate(s.multiplier).forEach((x, k) => close(x, v[i].multiplier[k])));
});
test('Unverified, false, and truthy non-boolean gates reject before updating any dual', () => {
 const before = JSON.stringify(springs);
 for (const flag of [undefined, false, 1, 'true', null]) assert.throws(() => update(springs, p, { innerStationarityVerified: flag })); assert.equal(JSON.stringify(springs), before);
});
test('Invalid source IDs/weights/dual values/derived overflow reject atomically without clamps', () => {
 for (const row of [{ a: 0, b: 0, weight: 1 }, { a: 0, b: 9, weight: 1 }, { a: 0, b: 1, weight: 0 }, { a: 0, b: 1, weight: Infinity }, { a: 0, b: 1, weight: 1, multiplier: [0, NaN, 0] }, { a: 0, b: 1, weight: 1, multiplier: [1, 2] }]) {
  assert.throws(() => evaluate(p, [row])); assert.throws(() => update([row], p, { innerStationarityVerified: true }));
 }
 const giant = [[1e308, 0, 0], [-1e308, 0, 0]]; assert.throws(() => evaluate(giant, [{ a: 0, b: 1, weight: 1 }])); assert.throws(() => update([{ a: 0, b: 1, weight: 1 }], giant, { innerStationarityVerified: true }));
 assert.throws(() => evaluate(p, springs, { withGradients: 'yes' }));
});
let passed = 0;
for (const { name, run } of tests) { try { run(); passed++; } catch (e) { console.error(`FAIL ${name}: ${e.stack}`); process.exitCode = 1; } }
console.log(JSON.stringify({ schema: 'shorts-paper-seam-multiplier-tests@1', passed, total: tests.length, bodyRuns: 0, browserRuns: 0, solverRuns: 0 }));
