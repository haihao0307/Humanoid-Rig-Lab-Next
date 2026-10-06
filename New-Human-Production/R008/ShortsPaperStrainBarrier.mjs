// Static authoring barrier in the ORIGINAL two-dimensional paper metric.
// log-det derivatives: Vandenberghe/Boyd, Semidefinite Programming, eqs. 43-44.
// https://web.stanford.edu/~boyd/papers/pdf/semidef_prog.pdf
// No positions are applied, no rest is inferred from XYZ, and no physical law is calibrated.
export const PAPER_STRAIN_BARRIER_LIMITS = Object.freeze({
 sigmaLower: .95, sigmaUpper: 1.05, lambdaLower: .95 ** 2, lambdaUpper: 1.05 ** 2
});
const L = PAPER_STRAIN_BARRIER_LIMITS.lambdaLower, U = PAPER_STRAIN_BARRIER_LIMITS.lambdaUpper;
const lowerRest = 1 - L, upperRest = U - 1;
const restSlope = -1 / lowerRest + 1 / upperRest;
const finiteVector = (v, n) => (Array.isArray(v) || ArrayBuffer.isView(v)) && v.length === n && Array.from(v).every(Number.isFinite);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const basis = [[[1, 0], [0, 0]], [[0, 0], [0, 1]], [[0, 1], [1, 0]]];
const multiply2 = (a, b) => a.map(row => [0, 1].map(j => row[0] * b[0][j] + row[1] * b[1][j]));
const trace2 = a => a[0][0] + a[1][1];
// -log(1+z)+z, with its exact analytic series near zero. This avoids loss of
// the positive quadratic energy at rest; it never clamps or changes the domain.
function centeredLog(z) {
 if (Math.abs(z) >= 1e-4) return -Math.log1p(z) + z;
 let power = z * z, sum = power / 2;
 for (let n = 3; n <= 10; n++) { power *= -z; sum += power / n; }
 return sum;
}
const hold = (reason, extra = {}) => ({
 status: 'HOLD', reason, ...extra, domainCertified: false, energyM2: Infinity,
 gradC: null, hessianC: null, physicalCalibrated: false, wearingAccepted: false
});
function validateScale(areaM2, mu) {
 if (!Number.isFinite(areaM2) || areaM2 <= 0 || !Number.isFinite(mu) || mu <= 0)
  throw Error('Barrier needs explicit positive finite original source areaM2 and authoring mu');
}

// C and its differential use packed [Cuu, Cvv, Cuv]. Cuv changes BOTH symmetric entries.
// gradC[2] therefore contains the off-diagonal factor TWO; H is the exact packed Hessian.
export function evaluatePaperStrainBarrier(C, { areaM2, mu } = {}) {
 validateScale(areaM2, mu);
 if (!finiteVector(C, 3)) return hold('Non-finite or malformed current paper metric');
 const [uu, vv, uv] = C, discriminant = Math.hypot(uu - vv, 2 * uv);
 const lambdaMin = (uu + vv - discriminant) / 2, lambdaMax = (uu + vv + discriminant) / 2;
 const gaps = { lower: lambdaMin - L, upper: U - lambdaMax };
 if (![lambdaMin, lambdaMax, gaps.lower, gaps.upper].every(Number.isFinite) || !(gaps.lower > 0 && gaps.upper > 0))
  return hold('Current metric is outside the STRICT open 5% principal-strain domain', { lambdaMin, lambdaMax, gaps });
 const dl = (uu - L) * (vv - L) - uv * uv, du = (U - uu) * (U - vv) - uv * uv;
 const scale = mu * areaM2;
 if (!(dl > 0 && du > 0) || !Number.isFinite(scale) || !Number.isFinite(dl) || !Number.isFinite(du))
  return hold('Unrepresentable positive-definite barrier matrices', { lambdaMin, lambdaMax, gaps });
 const li = [[(vv - L) / dl, -uv / dl], [-uv / dl, (uu - L) / dl]];
 const ui = [[(U - vv) / du, uv / du], [uv / du, (U - uu) / du]];
 // Bregman centering subtracts the barrier value and tangent at I, not its Hessian.
 // log1p preserves small metric changes without subtracting large log determinants.
 const center = t => centeredLog(t / lowerRest) + centeredLog(-t / upperRest);
 const traceDelta = (uu - 1) + (vv - 1);
 const energyM2 = scale * (center((traceDelta - discriminant) / 2) + center((traceDelta + discriminant) / 2));
 const gradC = [scale * (-li[0][0] + ui[0][0] - restSlope), scale * (-li[1][1] + ui[1][1] - restSlope), 2 * scale * (-li[0][1] + ui[0][1])];
 const hessianC = basis.map(a => basis.map(b => scale * (
  trace2(multiply2(multiply2(multiply2(li, a), li), b)) +
  trace2(multiply2(multiply2(multiply2(ui, a), ui), b))
 )));
 if (![energyM2, ...gradC, ...hessianC.flat()].every(Number.isFinite))
  return hold('Non-finite derived barrier energy or derivatives', { lambdaMin, lambdaMax, gaps });
 return {
  status: 'BARRIER_DEFINED_ONLY', domainCertified: true, energyM2, gradC, hessianC,
  lambdaMin, lambdaMax, sigmaMin: Math.sqrt(lambdaMin), sigmaMax: Math.sqrt(lambdaMax), gaps,
  strictLimits: PAPER_STRAIN_BARRIER_LIMITS,
  parameters: { areaM2, mu, muUnits: 'dimensionless numerical authoring weight', energyUnits: 'm^2 authoring objective; not joules' },
  packedOrder: ['uu', 'vv', 'uv'], hessianAuthority: 'exact SPD in packed C coordinates, not necessarily in XYZ',
  restGradientZero: true, sourceRestFromXYZ: false, physicalCalibrated: false, wearingAccepted: false
 };
}

export function paperStrainBarrierCProduct(evaluation, deltaC) {
 if (evaluation?.status !== 'BARRIER_DEFINED_ONLY') throw Error('No derivative product outside the barrier domain');
 if (!finiteVector(deltaC, 3)) throw Error('Invalid packed C differential');
 const product = evaluation.hessianC.map(row => dot(row, deltaC));
 if (!product.every(Number.isFinite)) throw Error('Non-finite barrier C product');
 return product;
}

function columns(reference, positions) {
 const w = reference?.warpCoefficients, v = reference?.weftCoefficients, count = positions?.length;
 if (!Number.isInteger(count) || count < 3 || !finiteVector(w, count) || !finiteVector(v, count) || positions.some(p => !finiteVector(p, 3)))
  throw Error('Need original paper derivative coefficients and current finite XYZ');
 for (const c of [w, v]) {
  const sum = Array.from(c).reduce((a, x) => a + x, 0), magnitude = Array.from(c).reduce((a, x) => a + Math.abs(x), 0);
  if (!(magnitude > 0) || Math.abs(sum) > 1e-12 * magnitude) throw Error('Paper derivative coefficients must annihilate translations');
 }
 return [w, v].map(c => [0, 1, 2].map(axis => positions.reduce((s, p, i) => s + c[i] * p[axis], 0)));
}
function pullback(reference, u, v) {
 return Array.from(reference.warpCoefficients, (w, i) => [0, 1, 2].map(k => w * u[k] + reference.weftCoefficients[i] * v[k]));
}
export function evaluatePaperTriangleStrainBarrier(reference, positions, { mu } = {}) {
 const [fu, fv] = columns(reference, positions), C = [dot(fu, fu), dot(fv, fv), dot(fu, fv)];
 const result = evaluatePaperStrainBarrier(C, { areaM2: reference.areaM2, mu });
 if (!result.domainCertified) return { ...result, C, deformationColumns: [fu, fv], gradients: null };
 const g = result.gradC;
 const gu = fu.map((x, k) => 2 * g[0] * x + g[2] * fv[k]);
 const gv = fv.map((x, k) => 2 * g[1] * x + g[2] * fu[k]);
 const gradients = pullback(reference, gu, gv);
 if (gradients.some(p => !p.every(Number.isFinite))) return hold('Non-finite XYZ barrier gradient');
 return { ...result, C, deformationColumns: [fu, fv], gradients, gradientUnits: 'm in the area-weighted authoring objective' };
}

// exact=false: PSD J_C^T H_C J_C local metric approximation.
// exact=true: also gradC : d^2C; exact XYZ Hessian can be indefinite away from rest.
// Caller must aggregate duplicate sewn DOF gradients/products; this function never applies XYZ.
export function paperStrainBarrierXYZProduct(reference, positions, direction, { mu, exact = true } = {}) {
 if (typeof exact !== 'boolean') throw Error('Product exact selector must be boolean');
 if (direction?.length !== positions.length || direction.some(p => !finiteVector(p, 3))) throw Error('Invalid XYZ direction');
 const evaluation = evaluatePaperTriangleStrainBarrier(reference, positions, { mu });
 if (!evaluation.domainCertified) return { ...evaluation, product: null };
 const [fu, fv] = evaluation.deformationColumns;
 const [du, dv] = columns(reference, direction);
 const deltaC = [2 * dot(fu, du), 2 * dot(fv, dv), dot(fv, du) + dot(fu, dv)];
 const dg = paperStrainBarrierCProduct(evaluation, deltaC), g = evaluation.gradC;
 const gu = fu.map((x, k) => 2 * dg[0] * x + dg[2] * fv[k] + (exact ? 2 * g[0] * du[k] + g[2] * dv[k] : 0));
 const gv = fv.map((x, k) => 2 * dg[1] * x + dg[2] * fu[k] + (exact ? 2 * g[1] * dv[k] + g[2] * du[k] : 0));
 const product = pullback(reference, gu, gv);
 if (product.some(p => !p.every(Number.isFinite))) return hold('Non-finite XYZ barrier Hessian product');
 return { status: evaluation.status, domainCertified: true, product, deltaC,
  productAuthority: exact ? 'exact XYZ Hessian, not guaranteed SPD' : 'PSD metric pullback J_C^T H_C J_C',
  physicalCalibrated: false, wearingAccepted: false };
}
