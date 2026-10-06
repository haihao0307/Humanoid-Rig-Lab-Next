// Numerical 3x3 q-level block Jacobi; changes neither objective nor global matrix.
// https://www.netlib.org/utk/cs_dept/research/jones/blocksolve/manual/section3_3.html
// Each block uses diagonal equilibration and Cholesky, without jitter/regularisation.
const vec = (v, n) => (Array.isArray(v) || ArrayBuffer.isView(v)) && v.length === n && Array.from(v).every(Number.isFinite);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const matrix = m => Array.isArray(m) && m.length === 3 && m.every(r => vec(r, 3));
function symmetricCopy(m, label) {
 if (!matrix(m)) throw Error(label + ': finite 3x3 matrix required');
 const scale = Math.max(...m.flatMap(row => Array.from(row)).map(Math.abs));
 for (let i = 0; i < 3; i++) for (let j = 0; j < i; j++) if (Math.abs(m[i][j] - m[j][i]) > 1e-12 * scale) throw Error(label + ': symmetry unresolved');
 return m.map((row, i) => Array.from(row, (x, j) => .5 * x + .5 * m[j][i]));
}
function cholesky(m, label) {
 const scale = [0, 1, 2].map(i => Math.sqrt(m[i][i]));
 if (scale.some(s => !(s > 0 && Number.isFinite(s)))) throw Error(label + ': positive finite block diagonal required');
 const L = Array.from({ length: 3 }, () => [0, 0, 0]);
 let minimumPivot = Infinity;
 for (let i = 0; i < 3; i++) for (let j = 0; j <= i; j++) {
  let value = m[i][j] / scale[i] / scale[j];
  for (let k = 0; k < j; k++) value -= L[i][k] * L[j][k];
  if (i === j) {
   if (!(value > 0 && Number.isFinite(value))) throw Error(label + ': SPD Cholesky unresolved; no diagonal jitter applied');
   minimumPivot = Math.min(minimumPivot, value); L[i][j] = Math.sqrt(value);
  } else { L[i][j] = value / L[j][j]; if (!Number.isFinite(L[i][j])) throw Error(label + ': non-finite factor'); }
 }
 return { L, scale, minimumPivot, diagonal: m[0][1] === 0 && m[0][2] === 0 && m[1][2] === 0 ? [m[0][0], m[1][1], m[2][2]] : null };
}
function solve(f, rhs) {
 if (f.diagonal) return rhs.map((x, i) => x / f.diagonal[i]);
 const y = [0, 0, 0], z = [0, 0, 0];
 for (let i = 0; i < 3; i++) { let s = rhs[i] / f.scale[i]; for (let j = 0; j < i; j++) s -= f.L[i][j] * y[j]; y[i] = s / f.L[i][i]; }
 for (let i = 2; i >= 0; i--) { let s = y[i]; for (let j = i + 1; j < 3; j++) s -= f.L[j][i] * z[j]; z[i] = s / f.L[i][i]; }
 return z.map((x, i) => x / f.scale[i]);
}
function outerAdd(block, g, coefficient) {
 for (let i = 0; i < 3; i++) for (let j = i; j < 3; j++) {
  const value = coefficient * g[i] * g[j]; block[i][j] += value; if (i !== j) block[j][i] += value;
 }
}
// baseDiag[q] includes SOURCE/gauge/spring/guide scalar diagonal once, NOT the
// contact/strain/bending scalar diagonals (these complete blocks are added here).
export function createShortsPaperBlockPreconditioner(baseDiag, {
 contactRows = [], contactWeight = 0, strainRows = [], bendingRows = []
} = {}) {
 if (!(Array.isArray(baseDiag) || ArrayBuffer.isView(baseDiag)) || !baseDiag.length || Array.from(baseDiag).some(v => !(Number.isFinite(v) && v > 0))) throw Error('Positive finite q base diagonal required');
 if (![contactRows, strainRows, bendingRows].every(Array.isArray) || !Number.isFinite(contactWeight) || contactWeight < 0) throw Error('Invalid numerical block row arrays/weight');
 const count = baseDiag.length, blocks = Array.from(baseDiag, v => [[v, 0, 0], [0, v, 0], [0, 0, v]]);
 const validId = id => Number.isInteger(id) && id >= 0 && id < count;
 for (const row of contactRows) {
  const curvature = row?.curvature ?? 1;
  if (!row || !Array.isArray(row.entries) || !vec(row.normal, 3) || Math.abs(Math.hypot(...row.normal) - 1) > 1e-7 || !Number.isFinite(curvature) || curvature < 0) throw Error('Invalid contact block row');
  const combined = new Map();
  for (const e of row.entries) { if (!Array.isArray(e) || e.length !== 2 || !validId(e[0]) || !(Number.isFinite(e[1]) && e[1] > 0)) throw Error('Invalid contact q weight'); combined.set(e[0], (combined.get(e[0]) ?? 0) + e[1]); }
  for (const [id, w] of combined) outerAdd(blocks[id], row.normal, contactWeight * curvature * w * w);
 }
 for (const row of strainRows) {
  if (!row || !Array.isArray(row.entries)) throw Error('Invalid source strain block row');
  const H = symmetricCopy(row.H, 'Source packed-C Hessian'); cholesky(H, 'Source packed-C Hessian');
  const combined = new Map();
  for (const e of row.entries) {
   if (!e || !validId(e.id) || !matrix(e.J)) throw Error('Invalid source strain q Jacobian');
   const J = combined.get(e.id) ?? [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
   for (let axis = 0; axis < 3; axis++) for (let c = 0; c < 3; c++) J[axis][c] += e.J[axis][c]; combined.set(e.id, J);
  }
  for (const [id, J] of combined) for (let i = 0; i < 3; i++) for (let j = i; j < 3; j++) {
   const value = dot(J[i], H.map(r => dot(r, J[j]))); blocks[id][i][j] += value; if (i !== j) blocks[id][j][i] += value;
  }
 }
 for (const row of bendingRows) {
  if (!row || !Array.isArray(row.entries) || !Number.isFinite(row.coefficient) || row.coefficient < 0) throw Error('Invalid bending block row/coefficient');
  const combined = new Map();
  for (const e of row.entries) {
   if (!Array.isArray(e) || e.length !== 2 || !validId(e[0]) || !vec(e[1], 3)) throw Error('Invalid bending q gradient');
   const old = combined.get(e[0]) ?? [0, 0, 0]; combined.set(e[0], old.map((x, i) => x + e[1][i]));
  }
  for (const [id, g] of combined) outerAdd(blocks[id], g, row.coefficient);
 }
 if (blocks.some(b => !b.flat().every(Number.isFinite))) throw Error('Non-finite derived numerical block; no overflow clamping');
 const factors = blocks.map((b, id) => cholesky(b, 'q block ' + id));
 const rowCounts = { contactRows: contactRows.length, strainRows: strainRows.length, bendingRows: bendingRows.length };
 return {
  status: 'BLOCK_JACOBI_READY',
  apply(rhs) {
   if (!vec(rhs, count * 3)) throw Error('Finite same-size flat block rhs required');
   const out = new Float64Array(count * 3);
   for (let id = 0; id < count; id++) {
    const x = solve(factors[id], Array.from(rhs.slice(id * 3, id * 3 + 3)));
    if (!x.every(Number.isFinite)) throw Error('Numerical block solve unresolved'); out.set(x, id * 3);
   }
   return out;
  },
  get blocks() { return blocks.map(b => b.map(r => r.slice())); },
  report() { return { schema: 'shorts-paper-block-jacobi@1', blocks: count,
   ...rowCounts,
   minimumEquilibratedPivot: Math.min(...factors.map(f => f.minimumPivot)),
   pivotIsNotAConditionNumberCertificate: true, diagonalJitter: 0,
   scope: 'fixed per-proposal SPD numerical preconditioner; not modified global stiffness/energy',
   convergenceCertified: false, sourceRestMassChanged: false, bodyValidated: false, wearingAccepted: false }; }
 };
}
