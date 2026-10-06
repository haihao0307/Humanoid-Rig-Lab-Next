import assert from 'node:assert/strict';
import { paperFormingSourceStepDomain as bound } from '../ShortsPaperStepDomain.mjs';
import { paperTriangle } from '../ShortsPaperSurfaceModel.mjs';
const tests = [], test = (name, run) => tests.push({ name, run });
const close = (a, b, tol = 1e-10) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b)), `${a} != ${b}`);
const ref = paperTriangle([[.02, -.03], [.27, .01], [.04, .18]]);
const t = { area: ref.areaM2, ids: [0, 1, 2], entries: ref.warpCoefficients.map((g, i) => [i, [g, ref.weftCoefficients[i]]]) };
const x = ref.uv.map(([u, v]) => [u, v, 0]), delta = [0, 0, 0, .4, .1, .03, -.04, .3, -.02];
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const columns = (positions, triangle) => [0, 1].map(a => [0, 1, 2].map(k => triangle.entries.reduce((s, [id, g]) => s + g[a] * positions[id][k], 0)));
// Independent unscaled 2x2 Gram eigenvalue calculation; production uses scaled
// max singular value plus the 3D cross product for the minimum singular value.
const svd = F => { const a = dot(F[0], F[0]), b = dot(F[0], F[1]), c = dot(F[1], F[1]), d = Math.sqrt((a - c) ** 2 + 4 * b * b); return [Math.sqrt((a + c - d) / 2), Math.sqrt((a + c + d) / 2)]; };
const moved = (p, d, alpha) => p.map((v, i) => v.map((s, k) => s + alpha * d[3 * i + k]));
const rotate = p => [-p[1], p[0], p[2]];
test('Weyl bound uses the independent largest singular value of deltaF', () => {
 const r = bound(x, [t], delta), D = columns(moved(x, delta, 1).map((p, i) => p.map((s, k) => s - x[i][k])), t);
 assert.equal(r.status, 'SOURCE_STEP_DOMAIN_BOUND'); close(r.witness.deltaFNorm2, svd(D)[1]);
 close(r.maximumFraction, .99 * Math.min(r.witness.lowerGap, r.witness.upperGap) / svd(D)[1]);
 for (const fraction of [0, .25, .5, .75, 1]) { const [lo, hi] = svd(columns(moved(x, delta, r.maximumFraction * fraction), t)); assert.ok(lo > .95 && hi < 1.05); }
});
test('Near-upper domain starts below the old 2^-20 backtracking floor without relaxing 5%', () => {
 const current = x.map(([u, v]) => [1.049999999 * u, v, 0]), r = bound(current, [t], delta);
 assert.ok(r.maximumFraction > 0 && r.maximumFraction < 2 ** -20);
 assert.equal(r.witness.limitingSide, 'upper');
 const s = svd(columns(moved(current, delta, r.maximumFraction), t)); assert.ok(s[1] < 1.05 && s[0] > .95);
});
test('Near-lower domain is protected during a compression proposal', () => {
 const current = x.map(([u, v]) => [.950000001 * u, v, 0]), compression = x.flatMap(([u]) => [-u, 0, 0]);
 const r = bound(current, [t], compression); assert.equal(r.witness.limitingSide, 'lower');
 const s = svd(columns(moved(current, compression, r.maximumFraction), t)); assert.ok(s[0] > .95 && s[1] < 1.05);
});
test('Actual common translation and zero proposal have no material step restriction', () => {
 for (const d of [Array(9).fill(0), [1, -.7, .3, 1, -.7, .3, 1, -.7, .3]]) {
  const r = bound(x, [t], d); assert.equal(r.maximumFraction, 1); assert.equal(r.witness, null); assert.equal(r.movingTriangles, 0);
 }
});
test('Proper rigid coordinate changes preserve the bound and limiting source identity', () => {
 const current = x.map(p => rotate(p).map((s, k) => s + [4, -3, .7][k]));
 const d = [0, 1, 2].flatMap(i => rotate(delta.slice(3 * i, 3 * i + 3))), a = bound(x, [t], delta), b = bound(current, [t], d);
 close(a.maximumFraction, b.maximumFraction, 1e-11); close(a.witness.deltaFNorm2, b.witness.deltaFNorm2, 1e-11); assert.deepEqual(a.witness.sourceIndices, b.witness.sourceIndices);
});
test('Metre coordinate rescaling with matching source derivatives preserves the dimensionless bound', () => {
 for (const scale of [.001, 1000]) {
  const triangle = { ...t, area: t.area * scale ** 2, entries: t.entries.map(([id, g]) => [id, g.map(s => s / scale)]) };
  close(bound(x.map(p => p.map(s => scale * s)), [triangle], delta.map(s => scale * s)).maximumFraction, bound(x, [t], delta).maximumFraction, 1e-11);
 }
});
test('Direction scale inversely scales a limited fraction; original area does not set the bound', () => {
 const a = bound(x, [t], delta), b = bound(x, [{ ...t, area: 100 * t.area }], delta.map(s => 3 * s));
 close(b.maximumFraction, a.maximumFraction / 3);
});
test('Repeated joined q derivatives aggregate before evaluating deltaF and cancel exactly', () => {
 const duplicated = { ...t, entries: [...t.entries, [1, [7, -3]], [1, [-7, 3]]] };
 const a = bound(x, [t], delta), b = bound(x, [duplicated], delta); close(a.maximumFraction, b.maximumFraction);
 assert.equal(b.witness.qIndices.length, 3);
});
test('Collapsed source-to-q triangle is a current-domain HOLD, not repaired by the limiter', () => {
 const repeated = { ...t, entries: t.entries.map(([, g]) => [0, g]) };
 const r = bound(x, [repeated], delta); assert.equal(r.status, 'HOLD'); assert.equal(r.maximumFraction, 0); assert.equal(r.notAnInfeasibilityCertificate, true);
});
test('Current invalid metrics and exact 5% boundaries HOLD without clamping', () => {
 const unit = { area: .5, entries: [[0, [-1, -1]], [1, [1, 0]], [2, [0, 1]]] };
 for (const s of [.95, 1.05, .94, 1.06]) {
  const r = bound([[0, 0, 0], [s, 0, 0], [0, 1, 0]], [unit], delta); assert.equal(r.status, 'HOLD'); assert.equal(r.maximumFraction, 0);
 }
});
test('First global limiting triangle is selected across the whole original source domain', () => {
 const p = [...x, ...x.map(([u, v]) => [1.04999 * u + 1, v, 0])], second = { ...t, ids: [3, 4, 5], entries: t.entries.map(([id, g]) => [id + 3, g]) };
 const r = bound(p, [t, second], [...delta, ...delta]); assert.equal(r.firstLimitingTriangle, 1); assert.deepEqual(r.witness.sourceIndices, [3, 4, 5]); assert.equal(r.trianglesExamined, 2);
});
test('Linear source deformation derivative agrees with a finite-difference deltaF', () => {
 const r = bound(x, [t], delta), eps = 1e-6, a = columns(moved(x, delta, eps), t), b = columns(moved(x, delta, -eps), t);
 for (let k = 0; k < 2; k++) for (let j = 0; j < 3; j++) close(r.witness.deltaF[k][j], (a[k][j] - b[k][j]) / (2 * eps), 1e-9);
});
test('Weyl restriction is explicitly conservative even for a valid finite rotation endpoint', () => {
 const rotated = x.map(rotate), d = rotated.flatMap((p, i) => p.map((s, k) => s - x[i][k])), r = bound(x, [t], d);
 assert.ok(r.maximumFraction < 1); const endpoint = svd(columns(rotated, t)); close(endpoint[0], 1); close(endpoint[1], 1);
 assert.equal(r.notAnInfeasibilityCertificate, true); assert.equal(r.freshFullMaterialAndContactAuditRequired, true);
});
test('No mutation, no scene access, and invalid inputs reject atomically', () => {
 const saved = JSON.stringify({ x, t, delta }); bound(x, [t], delta); assert.equal(JSON.stringify({ x, t, delta }), saved);
 for (const fraction of [0, 1, 2, NaN]) assert.throws(() => bound(x, [t], delta, { interiorFraction: fraction }));
 assert.throws(() => bound(x, [], delta)); assert.throws(() => bound(x, [t], delta.slice(1)));
 assert.throws(() => bound(x, [{ ...t, area: -1 }], delta));
 assert.throws(() => bound(x, [{ ...t, entries: [[9, [1, 0]]] }], delta));
 assert.throws(() => bound(x, [{ ...t, entries: [[0, [1, 1]], [1, [1, 0]]] }], delta));
 const huge = delta.map(() => Infinity); assert.throws(() => bound(x, [t], huge));
});
let passed = 0;
for (const { name, run } of tests) { try { run(); passed++; } catch (e) { console.error(`FAIL ${name}: ${e.stack}`); process.exitCode = 1; } }
console.log(JSON.stringify({ schema: 'shorts-paper-step-domain-tests@1', passed, total: tests.length, bodyRuns: 0, browserRuns: 0, solverRuns: 0 }));
