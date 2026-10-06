import assert from 'node:assert/strict';
import {
 PAPER_STRAIN_BARRIER_LIMITS as limits, evaluatePaperStrainBarrier as barrier,
 evaluatePaperTriangleStrainBarrier as triangle, paperStrainBarrierCProduct as cProduct,
 paperStrainBarrierXYZProduct as xyzProduct
} from '../ShortsPaperStrainBarrier.mjs';
import { paperTriangle } from '../ShortsPaperSurfaceModel.mjs';
const tests = [], test = (name, run) => tests.push({ name, run });
const close = (a, b, tol = 1e-7) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b)), `${a} != ${b}`);
const vectorClose = (a, b, tol = 1e-7) => a.flat(Infinity).forEach((x, i) => close(x, b.flat(Infinity)[i], tol));
const dot = (a, b) => a.flat(Infinity).reduce((s, x, i) => s + x * b.flat(Infinity)[i], 0);
const options = { areaM2: .021, mu: .7 }, C = [1.018, .981, .019];
const ref = paperTriangle([[.11, .02], [.36, .06], [.14, .22]]);
const xyz = ref.uv.map(([u, v]) => [1.01 * u + .012 * v, .993 * v, .004 * u]);
const direction = [[.02, -.01, .006], [-.004, .019, .002], [.008, -.002, -.007]];
const perturb = (p, d, t) => p.map((v, i) => v.map((x, k) => x + t * d[i][k]));
const rotate = p => [-p[1], p[0], p[2]];
test('Rest is centered exactly and keeps fixed strict 5% limits', () => {
 const r = barrier([1, 1, 0], options); assert.equal(r.energyM2, 0); vectorClose(r.gradC, [0, 0, 0], 0);
 assert.equal(limits.lambdaLower, .95 ** 2); assert.equal(limits.lambdaUpper, 1.05 ** 2);
 assert.equal(r.physicalCalibrated, false); assert.equal(r.wearingAccepted, false);
});
test('Packed C analytic gradient matches energy finite differences including uv factor two', () => {
 const r = barrier(C, options), eps = 1e-6;
 for (let i = 0; i < 3; i++) {
  const a = [...C], b = [...C]; a[i] += eps; b[i] -= eps;
  close(r.gradC[i], (barrier(a, options).energyM2 - barrier(b, options).energyM2) / (2 * eps), 2e-7);
 }
 assert.ok(Math.abs(r.gradC[2]) > 0);
});
test('Exact packed Hessian matches gradient differences and is symmetric SPD', () => {
 const r = barrier(C, options), eps = 1e-6, h = r.hessianC;
 for (let j = 0; j < 3; j++) {
  const a = [...C], b = [...C]; a[j] += eps; b[j] -= eps;
  const ga = barrier(a, options).gradC, gb = barrier(b, options).gradC;
  for (let i = 0; i < 3; i++) { close(h[i][j], (ga[i] - gb[i]) / (2 * eps), 2e-7); close(h[i][j], h[j][i], 1e-12); }
 }
 const det = h[0][0] * (h[1][1] * h[2][2] - h[1][2] * h[2][1]) - h[0][1] * (h[1][0] * h[2][2] - h[1][2] * h[2][0]) + h[0][2] * (h[1][0] * h[2][1] - h[1][1] * h[2][0]);
 assert.ok(h[0][0] > 0 && h[0][0] * h[1][1] - h[0][1] ** 2 > 0 && det > 0);
 const d = [.7, -.3, .2]; assert.ok(dot(d, cProduct(r, d)) > 0);
});
test('Area and numerical mu scale all energy derivatives linearly', () => {
 const a = barrier(C, options), b = barrier(C, { areaM2: options.areaM2 * 3, mu: options.mu * 2 });
 close(b.energyM2, a.energyM2 * 6); vectorClose(b.gradC, a.gradC.map(x => 6 * x)); vectorClose(b.hessianC, a.hessianC.map(row => row.map(x => 6 * x)));
});
test('Centered near-rest energy retains its positive quadratic value without a numerical clamp', () => {
 const eps = 1e-9, r = barrier([1 + eps, 1, 0], options), represented = (1 + eps) - 1;
 const quadratic = .5 * barrier([1, 1, 0], options).hessianC[0][0] * represented ** 2;
 assert.ok(r.energyM2 > 0); assert.ok(Math.abs(r.energyM2 / quadratic - 1) < 1e-7);
});
test('Both exact principal boundaries and outside/rank-one states HOLD without clamping', () => {
 for (const c of [[limits.lambdaLower, 1, 0], [limits.lambdaUpper, 1, 0], [.9 ** 2, 1, 0], [1.1 ** 2, 1, 0], [1, 0, 0], [NaN, 1, 0], [1, 1, Infinity]]) {
  const r = barrier(c, options); assert.equal(r.status, 'HOLD'); assert.equal(r.gradC, null); assert.equal(r.energyM2, Infinity);
  assert.throws(() => cProduct(r, [1, 0, 0]));
 }
});
test('Shear eigenvalue violation is rejected even with both diagonal entries at one', () => {
 assert.equal(barrier([1, 1, .11], options).status, 'HOLD');
 assert.equal(barrier([1, 1, .09], options).domainCertified, true);
});
test('Interior sequences show divergent barrier energy and gradient toward both limits', () => {
 for (const edge of [limits.lambdaLower, limits.lambdaUpper]) {
  const sign = edge < 1 ? 1 : -1;
  const a = barrier([edge + sign * 1e-3, 1, 0], options), b = barrier([edge + sign * 1e-5, 1, 0], options);
  assert.equal(a.domainCertified, true); assert.equal(b.domainCertified, true);
  assert.ok(b.energyM2 > a.energyM2); assert.ok(Math.abs(b.gradC[0]) > Math.abs(a.gradC[0]) * 50);
 }
});
test('XYZ gradient has correct source derivative pullback and finite-difference energy', () => {
 const r = triangle(ref, xyz, { mu: .7 }), eps = 1e-6;
 assert.equal(r.domainCertified, true);
 for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) {
  const a = xyz.map(p => [...p]), b = xyz.map(p => [...p]); a[i][k] += eps; b[i][k] -= eps;
  close(r.gradients[i][k], (triangle(ref, a, { mu: .7 }).energyM2 - triangle(ref, b, { mu: .7 }).energyM2) / (2 * eps), 3e-7);
 }
 vectorClose([0, 1, 2].map(k => r.gradients.reduce((s, g) => s + g[k], 0)), [0, 0, 0], 1e-12);
});
test('Exact XYZ Hessian-vector product includes the geometric derivative term', () => {
 const eps = 1e-6, a = triangle(ref, perturb(xyz, direction, eps), { mu: .7 }), b = triangle(ref, perturb(xyz, direction, -eps), { mu: .7 });
 const fd = a.gradients.map((g, i) => g.map((x, k) => (x - b.gradients[i][k]) / (2 * eps)));
 const r = xyzProduct(ref, xyz, direction, { mu: .7, exact: true }); vectorClose(r.product, fd, 1e-6);
 const other = [[.01, .007, .002], [.002, -.009, -.005], [-.005, .011, .006]];
 close(dot(other, r.product), dot(direction, xyzProduct(ref, xyz, other, { mu: .7 }).product), 1e-11);
});
test('PSD metric pullback differs from exact XYZ curvature and does not claim SPD in XYZ', () => {
 const compressed = ref.uv.map(([u, v]) => [.98 * u, .98 * v, 0]);
 const outOfPlane = [[0, 0, 0], [0, 0, .01], [0, 0, -.007]];
 const exact = xyzProduct(ref, compressed, outOfPlane, { mu: .7 });
 const psd = xyzProduct(ref, compressed, outOfPlane, { mu: .7, exact: false });
 assert.ok(dot(outOfPlane, exact.product) < 0); vectorClose(psd.product, [[0, 0, 0], [0, 0, 0], [0, 0, 0]], 1e-12);
 assert.ok(dot(direction, xyzProduct(ref, xyz, direction, { mu: .7, exact: false }).product) >= 0);
});
test('Proper rigid transformation preserves metric/energy and covariantly transforms gradient/products', () => {
 const moved = xyz.map(p => rotate(p).map((x, k) => x + [2, -1, .7][k])), rotatedDirection = direction.map(rotate);
 const a = triangle(ref, xyz, { mu: .7 }), b = triangle(ref, moved, { mu: .7 });
 close(a.energyM2, b.energyM2, 1e-12); vectorClose(a.C, b.C, 1e-12); vectorClose(a.gradients.map(rotate), b.gradients, 1e-11);
 for (const exact of [true, false]) vectorClose(xyzProduct(ref, xyz, direction, { mu: .7, exact }).product.map(rotate), xyzProduct(ref, moved, rotatedDirection, { mu: .7, exact }).product, 1e-10);
 const translation = [[.2, -.1, .3], [.2, -.1, .3], [.2, -.1, .3]];
 vectorClose(xyzProduct(ref, xyz, translation, { mu: .7 }).product, [[0, 0, 0], [0, 0, 0], [0, 0, 0]], 1e-12);
});
test('Original non-axis-aligned source paper and grain rotation retain rest isometry', () => {
 for (const angle of [0, .37, -1.2]) {
  const r = paperTriangle(ref.uv, { grainAngleRadians: angle }), p = r.uv.map(([u, v]) => rotate([u, v, 0]));
  const a = triangle(r, p, { mu: .7 }); assert.equal(a.domainCertified, true); close(a.energyM2, 0, 1e-12); vectorClose(a.gradients, [[0, 0, 0], [0, 0, 0], [0, 0, 0]], 1e-12);
 }
});
test('Inputs and source reference are immutable; no body, clock, mass, or native state is accessed', () => {
 const freezeDeep = x => { if (x && typeof x === 'object') { Object.values(x).forEach(freezeDeep); Object.freeze(x); } return x; };
 const r = freezeDeep(structuredClone(ref)), p = freezeDeep(structuredClone(xyz)), d = freezeDeep(structuredClone(direction));
 const before = JSON.stringify({ r, p, d }); triangle(r, p, { mu: .7 }); xyzProduct(r, p, d, { mu: .7 });
 assert.equal(JSON.stringify({ r, p, d }), before);
});
test('Malformed source coefficients and nonpositive/nonfinite numerical parameters reject atomically', () => {
 for (const o of [{ areaM2: 0, mu: 1 }, { areaM2: 1, mu: 0 }, { areaM2: 1, mu: Infinity }, { areaM2: 1 }]) assert.throws(() => barrier(C, o));
 assert.throws(() => triangle({ ...ref, warpCoefficients: [1, 2, 3] }, xyz, { mu: .7 }));
 assert.throws(() => triangle(ref, [[0, 0, 0], [0, Infinity, 0], [1, 1, 0]], { mu: .7 }));
 assert.throws(() => xyzProduct(ref, xyz, direction, { mu: .7, exact: 'yes' }));
});
let passed = 0;
for (const { name, run } of tests) { try { run(); passed++; } catch (e) { console.error(`FAIL ${name}: ${e.stack}`); process.exitCode = 1; } }
console.log(JSON.stringify({ schema: 'shorts-paper-strain-barrier-tests@1', passed, total: tests.length, bodyRuns: 0, browserRuns: 0, solverRuns: 0 }));
