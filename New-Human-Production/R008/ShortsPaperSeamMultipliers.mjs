// Source-pair augmented Lagrangian for static authoring ONLY.
// Boyd et al., section 2.3: https://web.stanford.edu/~boyd/papers/pdf/admm_distr_stats.pdf
// r=Xa-Xb; L=E0+lambda.r+.5*rho*|r|^2. Original paper/rest/graph never changes.
const vector3 = v => (Array.isArray(v) || ArrayBuffer.isView(v)) && v.length === 3 && Array.from(v).every(Number.isFinite);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const law = Object.freeze({
 name: 'static source-seam augmented Lagrangian; not calibrated thread/cloth physics',
 constraint: 'Xa-Xb=0 in current actual q coordinates',
 energyUnits: 'm^2 numerical authoring objective; not joules',
 multiplierUnits: 'metres in the numerical authoring objective; not newtons',
 penaltyWeightUnits: 'dimensionless numerical authoring rho',
 sourceRestFromXYZ: false, physicalCalibrated: false, nativeSteps: 0, wearingAccepted: false
});
function validate(positions, seamSprings) {
 if (!Array.isArray(positions) || !positions.length || positions.some(p => !vector3(p)) || !Array.isArray(seamSprings)) throw Error('Finite current q positions and original source seam array required');
 for (const s of seamSprings) {
  if (!s || !Number.isInteger(s.a) || !Number.isInteger(s.b) || s.a < 0 || s.b < 0 || s.a >= positions.length || s.b >= positions.length || s.a === s.b || !(Number.isFinite(s.weight) && s.weight > 0)) throw Error('Invalid finite original source seam pair/penalty');
  if (s.multiplier !== undefined && s.multiplier !== null && !vector3(s.multiplier)) throw Error('Source seam multiplier must be a finite optional vector3');
 }
}

// Null/absent multipliers take the original arithmetic path exactly.
// Energy may legitimately be negative; lambda.r is not a squared physical energy.
export function evaluateFiniteSeamConstraint(positions, seamSprings, { withGradients = true } = {}) {
 if (typeof withGradients !== 'boolean') throw Error('withGradients must be boolean');
 validate(positions, seamSprings);
 const gradients = withGradients ? positions.map(() => [0, 0, 0]) : null;
 let energyM2 = 0, maximumSoftGapM = 0, multiplierRows = 0;
 for (const s of seamSprings) {
  const d = Array.from(positions[s.a], (v, k) => v - positions[s.b][k]);
  if (!d.every(Number.isFinite)) throw Error('Non-finite derived source seam residual');
  maximumSoftGapM = Math.max(maximumSoftGapM, Math.hypot(...d));
  energyM2 += .5 * s.weight * dot(d, d);
  if (s.multiplier !== undefined && s.multiplier !== null) {
   multiplierRows++; energyM2 += dot(Array.from(s.multiplier), d);
  }
  if (withGradients) for (let k = 0; k < 3; k++) {
   // Keep the original default multiplication/addition order for null lambda.
   const value = s.weight * d[k]; gradients[s.a][k] += value; gradients[s.b][k] -= value;
   if (s.multiplier !== undefined && s.multiplier !== null) { gradients[s.a][k] += s.multiplier[k]; gradients[s.b][k] -= s.multiplier[k]; }
  }
 }
 if (!Number.isFinite(energyM2) || !Number.isFinite(maximumSoftGapM) || gradients?.some(g => !g.every(Number.isFinite))) throw Error('Non-finite derived seam augmented-Lagrangian terms; no clamping');
 return { energyM2, maximumSoftGapM, gradients, sourcePairs: seamSprings.length, multiplierRows, law };
}

// Gate is caller evidence, not a stationarity test performed by this module.
// Hold lambda fixed within an inner solve; update only between verified solves.
export function updateSourceSeamMultipliers(seamSprings, positions, { innerStationarityVerified } = {}) {
 if (innerStationarityVerified !== true) throw Error('Source seam dual update requires explicit verified inner stationarity');
 validate(positions, seamSprings);
 const updated = seamSprings.map(s => {
  const multiplier = [0, 1, 2].map(k => (s.multiplier?.[k] ?? 0) + s.weight * (positions[s.a][k] - positions[s.b][k]));
  if (!multiplier.every(Number.isFinite)) throw Error('Non-finite source seam dual update; no overflow clamping');
  return { ...s, multiplier };
 });
 return updated;
}
