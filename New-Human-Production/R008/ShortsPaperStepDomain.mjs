// Conservative singular-value fraction-to-boundary for static SOURCE paper steps.
// Mirsky/Weyl spectral perturbation bound, LAPACK Working Note 84, theorem 4.7:
// https://www.netlib.org/lapack/lawnspdf/lawn84.pdf
// |sigma_i(F+alpha D)-sigma_i(F)| <= alpha ||D||_2.
// This is a sufficient local bound, NOT a feasibility/optimality or collision certificate.
import { PAPER_STRAIN_BARRIER_LIMITS } from './ShortsPaperStrainBarrier.mjs';
const lower = PAPER_STRAIN_BARRIER_LIMITS.sigmaLower, upper = PAPER_STRAIN_BARRIER_LIMITS.sigmaUpper;
const vector = (v, n) => (Array.isArray(v) || ArrayBuffer.isView(v)) && v.length === n && Array.from(v).every(Number.isFinite);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
function spectrum(columns) {
 const scale = Math.max(...columns.flat().map(Math.abs));
 if (scale === 0) return { min: 0, max: 0 };
 if (!Number.isFinite(scale)) return { min: NaN, max: NaN };
 const [a, b] = columns.map(c => c.map(x => x / scale));
 const aa = dot(a, a), bb = dot(b, b), ab = dot(a, b);
 const maxScaled = Math.sqrt((aa + bb + Math.hypot(aa - bb, 2 * ab)) / 2);
 const cross = Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]);
 return { min: scale * (cross / maxScaled), max: scale * maxScaled };
}
const scope = {
 authority: 'conservative sufficient Weyl bound for current original paper F plus alpha deltaF',
 strictPrincipalLimit: .05, notAnInfeasibilityCertificate: true,
 freshFullMaterialAndContactAuditRequired: true, bodyValidated: false, wearingAccepted: false,
 sourceRestFromXYZ: false, physicalCalibrated: false
};
const hold = (reason, witness, count) => ({ status: 'HOLD', reason, maximumFraction: 0, witness, trianglesExamined: count, ...scope });

// positions: current q-level nested XYZ metres; deltaXYZ: flat 3*q metre proposal.
// triangles: {entries:[[q,[original dN/du,dN/dv]],...],area:originalAreaM2,ids?}.
// Repeated q entries aggregate BEFORE F/deltaF. No XYZ is changed or applied.
export function paperFormingSourceStepDomain(positions, triangles, deltaXYZ, { interiorFraction = .99 } = {}) {
 if (!Array.isArray(positions) || !positions.length || positions.some(p => !vector(p, 3)) || !vector(deltaXYZ, positions.length * 3))
  throw Error('Source step domain requires finite current q XYZ and same-size flat deltaXYZ');
 if (!Array.isArray(triangles) || !triangles.length || !Number.isFinite(interiorFraction) || !(interiorFraction > 0 && interiorFraction < 1))
  throw Error('Source step domain needs original triangles and strict interiorFraction in (0,1)');
 // Validate all input authority before evaluating any triangle.
 const prepared = triangles.map(t => {
  if (!t || !Array.isArray(t.entries) || !t.entries.length || !Number.isFinite(t.area) || t.area <= 0) throw Error('Invalid original source triangle area/entries');
  const combined = new Map(), originalMagnitude = [0, 0];
  for (const e of t.entries) {
   if (!Array.isArray(e) || e.length !== 2 || !Number.isInteger(e[0]) || e[0] < 0 || e[0] >= positions.length || !vector(e[1], 2)) throw Error('Invalid source derivative DOF entry');
   const old = combined.get(e[0]) ?? [0, 0];
   originalMagnitude[0] += Math.abs(e[1][0]); originalMagnitude[1] += Math.abs(e[1][1]);
   combined.set(e[0], [old[0] + e[1][0], old[1] + e[1][1]]);
  }
  const entries = [...combined];
  for (let axis = 0; axis < 2; axis++) {
   const sum = entries.reduce((s, [, g]) => s + g[axis], 0), size = originalMagnitude[axis];
   if (!Number.isFinite(size) || !Number.isFinite(sum) || Math.abs(sum) > 1e-12 * size) throw Error('Original paper derivatives must annihilate common translation');
  }
  return { entries, sourceIndices: t.ids ? Array.from(t.ids) : null, areaM2: t.area };
 });
 let rawMinimum = Infinity, limiting = null, movingTriangles = 0;
 for (let triangle = 0; triangle < prepared.length; triangle++) {
  const t = prepared[triangle], origin = positions[t.entries[0][0]], dOrigin = Array.from(deltaXYZ.slice(t.entries[0][0] * 3, t.entries[0][0] * 3 + 3));
  // Source derivatives sum to zero. Centering avoids cancellation for translated WORLD frames.
  const F = [0, 1].map(a => [0, 1, 2].map(k => t.entries.reduce((s, [id, g]) => s + g[a] * (positions[id][k] - origin[k]), 0)));
  const D = [0, 1].map(a => [0, 1, 2].map(k => t.entries.reduce((s, [id, g]) => s + g[a] * (deltaXYZ[id * 3 + k] - dOrigin[k]), 0)));
  const current = spectrum(F), proposed = spectrum(D);
  const lowerGap = current.min - lower, upperGap = upper - current.max, gap = Math.min(lowerGap, upperGap);
  const witness = { triangle, sourceIndices: t.sourceIndices, qIndices: t.entries.map(([id]) => id), originalAreaM2: t.areaM2,
   sigmaMin: current.min, sigmaMax: current.max, lowerGap, upperGap, minimumGap: gap,
   limitingSide: lowerGap <= upperGap ? 'lower' : 'upper', deltaFNorm2: proposed.max, F, deltaF: D };
  if (![current.min, current.max, proposed.max, gap].every(Number.isFinite)) return hold('Derived current/source differential spectrum is non-finite', witness, triangle + 1);
  if (!(lowerGap > 0 && upperGap > 0)) return hold('Current source metric is outside the strict open 5% domain', witness, triangle + 1);
  if (proposed.max === 0) continue;
  movingTriangles++;
  const bound = gap / proposed.max;
  if (!(bound > 0)) return hold('Positive sufficient step bound is not numerically representable', witness, triangle + 1);
  if (bound < rawMinimum) { rawMinimum = bound; limiting = { ...witness, openWeylBound: bound }; }
 }
 const maximumFraction = Math.min(1, interiorFraction * rawMinimum);
 if (!(maximumFraction > 0)) return hold('Interior sufficient step underflowed; unresolved, not proven infeasible', limiting, prepared.length);
 return {
  status: 'SOURCE_STEP_DOMAIN_BOUND', maximumFraction, interiorFraction,
  firstLimitingTriangle: limiting?.triangle ?? null, witness: limiting,
  rawOpenWeylBound: Number.isFinite(rawMinimum) ? rawMinimum : null,
  fractionLimited: maximumFraction < 1, movingTriangles, trianglesExamined: prepared.length,
  guaranteedInteriorFraction: interiorFraction, ...scope
 };
}
