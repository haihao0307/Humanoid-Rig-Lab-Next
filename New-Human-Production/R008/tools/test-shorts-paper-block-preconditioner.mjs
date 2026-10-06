import assert from 'node:assert/strict';
import { createShortsPaperBlockPreconditioner as create } from '../ShortsPaperBlockPreconditioner.mjs';
import { paperFormingStrainBarrierProduct } from '../ShortsPaperBarrierTerms.mjs';
import { paperFormingContactProduct } from '../ShortsPaperForming.mjs';
const tests = [], test = (name, run) => tests.push({ name, run });
const close = (a, b, tol = 1e-10) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b)), `${a} != ${b}`);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0), product = (M, x) => M.map(row => dot(row, x));
const flattenClose = (a, b, tol = 1e-10) => Array.from(a).flat(Infinity).forEach((x, i) => close(x, Array.from(b).flat(Infinity)[i], tol));
const n = [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)];
const H = [[4, .3, .1], [.3, 3, -.2], [.1, -.2, 2]], J = [[1, .2, .3], [.1, -.7, .4], [.5, .3, -.2]];
const contactRows = [{ entries: [[0, .3], [0, .2], [1, .5]], normal: n, curvature: 2 }];
const strainRows = [{ entries: [{ id: 0, J }, { id: 1, J: J.map(row => row.map(x => -x)) }], H }];
const bendingRows = [{ entries: [[0, [.2, -.3, .4]], [1, [-.2, .3, -.4]]], coefficient: 7 }];
const base = [2, 3], options = { contactRows, contactWeight: 5, strainRows, bendingRows };
const rotate = p => { const angle = .71, u = n, c = Math.cos(angle), s = Math.sin(angle), d = dot(u, p), cross = [u[1] * p[2] - u[2] * p[1], u[2] * p[0] - u[0] * p[2], u[0] * p[1] - u[1] * p[0]]; return p.map((x, i) => c * x + s * cross[i] + (1 - c) * d * u[i]); };
const rotateJ = m => [0, 1, 2].map(c => rotate(m.map(row => row[c]))).reduce((out, col, c) => { col.forEach((x, i) => out[i][c] = x); return out; }, [[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
test('Absent rows preserve exact scalar Jacobi and do not double-count its diagonal', () => {
 const p = create([2, 4]), rhs = [2, -4, 6, 8, 12, -16]; flattenClose(p.apply(rhs), [1, -2, 3, 2, 3, -4], 0);
 assert.equal(p.report().diagonalJitter, 0); assert.equal(p.report().wearingAccepted, false);
});
test('Blocks equal the same-q principal blocks of the independent actual global products', () => {
 const p = create(base, options), blocks = p.blocks;
 for (let id = 0; id < 2; id++) for (let axis = 0; axis < 3; axis++) {
  const e = Array(6).fill(0); e[id * 3 + axis] = 1;
  const s = paperFormingStrainBarrierProduct(strainRows, e), c = paperFormingContactProduct(contactRows, e, 5);
  for (let k = 0; k < 3; k++) {
   let value = s[id * 3 + k] + c[id * 3 + k] + (k === axis ? base[id] : 0);
   for (const r of bendingRows) { const g = r.entries.find(([q]) => q === id)[1]; value += r.coefficient * g[k] * g[axis]; }
   close(blocks[id][k][axis], value, 1e-12);
  }
 }
});
test('Cholesky application solves each full block with a small independent matrix residual', () => {
 const p = create(base, options), rhs = [1, -2, .3, -.2, 3, 1], x = p.apply(rhs);
 for (let id = 0; id < 2; id++) flattenClose(product(p.blocks[id], Array.from(x.slice(id * 3, id * 3 + 3))), rhs.slice(id * 3, id * 3 + 3), 1e-11);
});
test('Every returned block and its inverse are symmetric positive definite', () => {
 const p = create(base, options);
 for (const M of p.blocks) { for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) close(M[i][j], M[j][i], 0); for (const v of [[1, 2, -3], [.7, -.1, .4], [0, 1, 0]]) assert.ok(dot(v, product(M, v)) > 0); }
 const a = [1, -2, .3, -.2, 3, 1], b = [.3, .4, -.5, .7, .2, -1]; close(dot(a, Array.from(p.apply(b))), dot(b, Array.from(p.apply(a))), 1e-12); assert.ok(dot(a, Array.from(p.apply(a))) > 0);
});
test('q aggregation happens before all three contact/strain/bending outer products', () => {
 const row = { entries: [{ id: 0, J }, { id: 0, J: J.map(r => r.map(x => -x)) }], H };
 const bend = { entries: [[0, [1, 2, 3]], [0, [-1, -2, -3]]], coefficient: 100 };
 const p = create([2], { strainRows: [row], bendingRows: [bend] }); flattenClose(p.blocks[0], [[2, 0, 0], [0, 2, 0], [0, 0, 2]], 1e-12);
 const a = create([1], { contactRows: [{ entries: [[0, .2], [0, .3]], normal: n }], contactWeight: 4 });
 const b = create([1], { contactRows: [{ entries: [[0, .5]], normal: n }], contactWeight: 4 }); flattenClose(a.blocks, b.blocks, 1e-12);
});
test('Full preconditioner and solution transform covariantly under proper rotations', () => {
 const opts = { contactWeight: 5, contactRows: contactRows.map(r => ({ ...r, normal: rotate(r.normal) })), strainRows: strainRows.map(r => ({ ...r, entries: r.entries.map(e => ({ id: e.id, J: rotateJ(e.J) })) })), bendingRows: bendingRows.map(r => ({ ...r, entries: r.entries.map(([id, g]) => [id, rotate(g)]) })) };
 const a = create(base, options), b = create(base, opts), rhs = [1, -2, .3, -.2, 3, 1], rotatedRhs = [0, 1].flatMap(id => rotate(rhs.slice(id * 3, id * 3 + 3))), ax = a.apply(rhs);
 flattenClose(b.apply(rotatedRhs), [0, 1].flatMap(id => rotate(Array.from(ax.slice(id * 3, id * 3 + 3)))), 1e-10);
});
test('Strong near-barrier couplings of order 1e8 remain SPD and give accurate matrix residuals', () => {
 const p = create([1], { contactWeight: 1e8, contactRows: [{ entries: [[0, 1]], normal: n }] }), M = p.blocks[0];
 for (const rhs of [[1, -1, 0], [1, 2, -3], [1, 2, 3]]) {
  const x = Array.from(p.apply(rhs)), residual = product(M, x).map((v, k) => v - rhs[k]);
  assert.ok(Math.hypot(...residual) / Math.hypot(...rhs) < 3e-8);
  const exact = rhs.map((v, k) => v - 1e8 / (1 + 1e8) * n[k] * dot(n, rhs)); flattenClose(x, exact, 3e-8);
 }
 assert.ok(p.report().minimumEquilibratedPivot > 0);
});
test('Strong packed strain couplings and 1e-100/1e100 uniform matrix scaling stay representable', () => {
 const strongH = [[1e8, 0, 0], [0, 1, 0], [0, 0, 2]], strongJ = rotateJ([[1, 0, 0], [0, 1, 0], [0, 0, 1]]), rhs = [1, -2, .3];
 const make = scale => create([scale], { strainRows: [{ H: strongH.map(r => r.map(v => v * scale)), entries: [{ id: 0, J: strongJ }] }] });
 const a = make(1), solved = a.apply(rhs), res = product(a.blocks[0], Array.from(solved)); flattenClose(res, rhs, 5e-8);
 for (const scale of [1e-100, 1e100]) flattenClose(make(scale).apply(rhs.map(v => v * scale)), solved, 5e-8);
});
test('Input arrays remain immutable and returned blocks cannot corrupt the fixed PCG preconditioner', () => {
 const before = JSON.stringify({ base, options }), p = create(base, options), expected = p.apply([1, 2, 3, 4, 5, 6]);
 p.blocks[0][0][0] = 9e99; flattenClose(p.apply([1, 2, 3, 4, 5, 6]), expected, 0); assert.equal(JSON.stringify({ base, options }), before);
});
test('Malformed/non-SPD/nonfinite rows reject without hidden diagonal jitter or overflow clamping', () => {
 for (const d of [[0], [-1], [Infinity]]) assert.throws(() => create(d));
 assert.throws(() => create([1], { strainRows: [{ H: [[1, 2, 0], [2, 1, 0], [0, 0, 1]], entries: [{ id: 0, J }] }] }));
 assert.throws(() => create([1], { strainRows: [{ H: [[1, 1, 0], [0, 1, 0], [0, 0, 1]], entries: [{ id: 0, J }] }] }));
 assert.throws(() => create([1], { contactWeight: -1 })); assert.throws(() => create([1], { contactRows: [{ entries: [[0, 1]], normal: [0, 0, 2] }] }));
 assert.throws(() => create([1], { bendingRows: [{ coefficient: -1, entries: [[0, [1, 0, 0]]] }] }));
 assert.throws(() => create([1], { bendingRows: [{ coefficient: 1e308, entries: [[0, [1e308, 0, 0]]] }] }));
 assert.throws(() => create([1]).apply([1, NaN, 3])); assert.throws(() => create([1]).apply([1, 2]));
});
let passed = 0;
for (const { name, run } of tests) { try { run(); passed++; } catch (e) { console.error(`FAIL ${name}: ${e.stack}`); process.exitCode = 1; } }
console.log(JSON.stringify({ schema: 'shorts-paper-block-preconditioner-tests@1', passed, total: tests.length, bodyRuns: 0, browserRuns: 0, solverRuns: 0 }));
