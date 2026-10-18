/**
 * Rest-surface material coordinates (material mm / 100).
 *
 * A positive marginal arc-density warp allocates chart resolution according to
 * measured physical derivatives. A small tensor cubic B-spline field then fits
 * unit polar gradients in four bounded local/global passes. U density varies
 * smoothly along V, so a wide toe does not stretch a narrower upper shaft.
 * All welded patches
 * in a panel use this one continuous field, including patches around holes.
 * It introduces no chart cuts or per-patch texture phases.
 *
 * This appearance fit is NOT manufacturing unfolding or an isometry claim.
 * The report measures every final surface triangle, including tail distortion.
 * Conformal background: Levy et al., SIGGRAPH 2002, section 2:
 * https://www.cs.jhu.edu/~misha/Fall09/Levy02.pdf
 * Local/global rotation principle: Liu et al., CGF 27(5), 2008:
 * https://doi.org/10.1111/j.1467-8659.2008.01290.x
 * The small C2 spline subspace and C2 prefit are original implementation choices,
 * not the papers' full piecewise-linear parameterization algorithms.
 */

const UV_MM = 100;
const ACTIVE_ROLES = new Set(['leather', 'canvas', 'elastic', 'webbing', 'lining']);
const now = () => globalThis.performance?.now?.() ?? Date.now();
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/** points: Vector3[] or number[3][]; triangles: flat indices; seedUV: number[2][] */
export function restSurfaceCoordinates(points, triangles, seedUV, options = {}) {
  const start = now(), source = seedUV.map(v => [Number(v[0]), Number(v[1])]);
  const report = {
    method: 'smooth-rest-polar-fit-v6', units: 'surface mm per material mm',
    manufacturingPattern: false, isometryClaim: false, role: options.role ?? null,
    skipped: false, finite: true, vertices: points.length,
    triangles: triangles.length / 3, elapsedMs: 0
  };
  const finish = (uv, extra = {}) => {
    Object.assign(report, extra);
    report.finite = uv.length === points.length && uv.every(p => p.every(Number.isFinite));
    report.elapsedMs = now() - start;
    return {uv, report};
  };
  if (points.length !== source.length || !source.every(p => p.every(Number.isFinite))) {
    throw new Error('Rest material coordinates require one finite seed UV per point');
  }
  if (options.skip || options.closed || options.periodic || options.kind === 'binding' ||
      (options.role && !ACTIVE_ROLES.has(options.role))) {
    return finish(source, {skipped: true, reason: 'role-or-closed-chart', iterations: 0});
  }
  const data = physicalTriangles(points, triangles, source), before = measure(data, source);
  report.stretchBeforeAfter = {before, after: before};
  if (data.length < 2 || before.invalidUVTriangles || before.invalidSurfaceTriangles) {
    return finish(source, {skipped: true, reason: 'degenerate-chart', iterations: 0});
  }
  const range = bounds(source);
  if (range.du < 1e-8 || range.dv < 1e-8) {
    return finish(source, {skipped: true, reason: 'one-dimensional-chart', iterations: 0});
  }
  // Angular charts can squeeze a wide toe into a very narrow U interval.
  // Monotone pre-equalization addresses this sampling root cause before fitting.
  const warp = metricWarps(data, source, range, before.u.p95 > before.u.median * 4);
  const aspect = clamp(warp.u.span / warp.v.span, .25, 4);
  const nx = Math.round(clamp(options.grid?.[0] ?? 7 * Math.sqrt(aspect), 5, 11));
  const ny = Math.round(clamp(options.grid?.[1] ?? 7 / Math.sqrt(aspect), 5, 11));
  const count = nx * ny;
  const controlsU = new Float64Array(count), controlsV = new Float64Array(count);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    controlsU[j * nx + i] = ((i - 1) / (nx - 3) - .5) * warp.u.span;
    controlsV[j * nx + i] = ((j - 1) / (ny - 3) - .5) * warp.v.span;
  }
  const vertexBasis = source.map(([u, v]) => basis2(warp.u.at((u - range.u0) / range.du, (v - range.v0) / range.dv).value,
    warp.v.at((v - range.v0) / range.dv).value, nx, ny));
  // Area-stratified quadrature avoids giving dense eyelet patches undue weight.
  const cap = Math.round(clamp(options.maxSamples ?? 900, 64, 1600));
  // Fit the actual triangle interpolant, not a centroid derivative of the
  // nonlinear prefit: those differ on coarse triangles near the toe boundary.
  const samples = sampleTriangles(data, cap).map(({t, weight}) => ({...triangleBasis(t, vertexBasis), weight}));
  const matrix = new Float64Array(count * count);
  for (const s of samples) for (let i = 0; i < s.ids.length; i++) for (let j = 0; j <= i; j++) {
    const a = Math.max(s.ids[i], s.ids[j]), b = Math.min(s.ids[i], s.ids[j]);
    matrix[a * count + b] += s.weight * (s.dx[i] * s.dx[j] + s.dy[i] * s.dy[j]);
  }
  let trace = 0;
  for (let i = 0; i < count; i++) trace += matrix[i * count + i];
  // A tiny seed prior fixes the translation nullspace and controls outside the
  // material outline; it does not substitute metadata for scale measurements.
  const regularization = trace / count * 1e-6;
  for (let i = 0; i < count; i++) matrix[i * count + i] += regularization;
  const factor = cholesky(matrix, count);
  if (!factor) return finish(source, {skipped: true, reason: 'singular-fit', iterations: 0});
  let currentU = controlsU, currentV = controlsV, result = source, best = before;
  let iterations = 0, acceptedSteps = 0, localConstraints = null;
  const limit = clamp(options.iterations ?? 4, 1, 6);
  for (; iterations < limit; iterations++) {
    const rhsU = Float64Array.from(controlsU, x => x * regularization);
    const rhsV = Float64Array.from(controlsV, x => x * regularization);
    for (const s of samples) {
      let a = 0, b = 0, c = 0, d = 0;
      for (let i = 0; i < s.ids.length; i++) {
        const q = s.ids[i];
        a += currentU[q] * s.dx[i]; b += currentU[q] * s.dy[i];
        c += currentV[q] * s.dx[i]; d += currentV[q] * s.dy[i];
      }
      const target = polar(a, b, c, d);
      for (let i = 0; i < s.ids.length; i++) {
        const q = s.ids[i];
        rhsU[q] += s.weight * (s.dx[i] * target[0] + s.dy[i] * target[1]);
        rhsV[q] += s.weight * (s.dx[i] * target[2] + s.dy[i] * target[3]);
      }
    }
    const nextU = solve(factor, rhsU, count), nextV = solve(factor, rhsV, count);
    let accepted = false;
    for (const mix of [1, .5, .25, .125]) {
      const U = currentU.map((x, i) => x + (nextU[i] - x) * mix);
      const V = currentV.map((x, i) => x + (nextV[i] - x) * mix);
      let candidate = vertexBasis.map(b => [evaluate(b, U) / UV_MM, evaluate(b, V) / UV_MM]);
      let measured = measure(data, candidate, source, true, before), constraints = null;
      // A tiny boundary triangle can require a sharper derivative than the
      // bounded global field supports. Preserve that local seed gradient with
      // a C2 compact correction; never accept its error as a hidden outlier.
      if (!measured.tailProtectionPassed && !measured.invalidUVTriangles && !measured.orientationChanges &&
          measured.logStretchRms < best.logStretchRms) {
        const protectedField = protectLocalExtrema(data, source, candidate, before);
        if (protectedField) {candidate = protectedField.uv; measured = protectedField.measured; constraints = protectedField.report;}
      }
      if (!measured.invalidUVTriangles && !measured.orientationChanges && measured.tailProtectionPassed &&
          measured.logStretchRms < best.logStretchRms - 1e-6) {
        currentU = U; currentV = V; result = candidate; best = measured;
        localConstraints = constraints;
        accepted = true; acceptedSteps++;
        break;
      }
    }
    if (!accepted) break;
  }
  if (acceptedSteps) {
    const outputBounds = bounds(result);
    const tu = range.u0 + range.du / 2 - outputBounds.u0 - outputBounds.du / 2;
    const tv = range.v0 + range.dv / 2 - outputBounds.v0 - outputBounds.dv / 2;
    result = result.map(([u, v]) => [u + tu, v + tv]);
    best = measure(data, result, source);
  }
  return finish(result, {
    iterations: Math.min(iterations + 1, limit), acceptedSteps,
    controlGrid: [nx, ny], quadratureSamples: samples.length,
    metricPrefit: {method: warp.conditional ? 'C2 conditional U arc-density warp' : 'C3 marginal arc-density warp',
      monotoneUAndV: true, bins: warp.bins, rows: warp.rows,
      measuredMarginalSpansMm: [warp.u.span, warp.v.span]},
    stretchBeforeAfter: {before, after: best}, skipped: acceptedSteps === 0,
    reason: acceptedSteps ? 'measured-improvement' : 'no-safe-improvement',
    continuousField: 'C2 monotone warp + tensor-cubic-B-spline-C2; whole seed chart',
    tailProtection: 'p05/p95 scale and p95 anisotropy; no new extreme away from unit scale beyond 2% slack',
    localConstraints,
    residualIsIntrinsicAndApproximation: true
  });
}

/** Independent final-mesh Jacobian measurement for geometry QA. */
export function measureSurfaceCoordinates(points, triangles, uv, referenceUV = null) {
  return measure(physicalTriangles(points, triangles, uv), uv, referenceUV);
}

function physicalTriangles(points, triangles, uv) {
  const xyz = p => Array.isArray(p) || ArrayBuffer.isView(p) ? p : [p.x, p.y, p.z];
  const out = [];
  for (let i = 0; i < triangles.length; i += 3) {
    const ids = [triangles[i], triangles[i + 1], triangles[i + 2]];
    if (ids.some(k => k < 0 || k >= points.length || !uv[k])) throw new Error('Invalid surface triangle index');
    const A = xyz(points[ids[0]]), B = xyz(points[ids[1]]), C = xyz(points[ids[2]]);
    const ab = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
    const ac = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const length = Math.hypot(...ab), x = (ab[0] * ac[0] + ab[1] * ac[1] + ab[2] * ac[2]) / length;
    const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const y = Math.hypot(...cross) / length;
    out.push({ids, length, x, y, area: length * y / 2});
  }
  return out;
}
function derivative(t, uv, multiplier = UV_MM) {
  const A = uv[t.ids[0]], B = uv[t.ids[1]], C = uv[t.ids[2]];
  const a = (B[0] - A[0]) * multiplier / t.length, c = (B[1] - A[1]) * multiplier / t.length;
  return [a, ((C[0] - A[0]) * multiplier - a * t.x) / t.y,
    c, ((C[1] - A[1]) * multiplier - c * t.x) / t.y];
}
function polar(a, b, c, d) {
  if (a * d - b * c >= 0) {
    const x = a + d, y = c - b, n = Math.hypot(x, y) || 1;
    return [x / n, -y / n, y / n, x / n];
  }
  const x = a - d, y = b + c, n = Math.hypot(x, y) || 1;
  return [x / n, y / n, y / n, -x / n];
}
function basis1(value, n) {
  const s = clamp(value, 0, 1) * (n - 3), i = Math.min(n - 4, Math.floor(s)), t = s - i;
  return {i,
    b: [(1 - t) ** 3 / 6, (3 * t ** 3 - 6 * t * t + 4) / 6, (-3 * t ** 3 + 3 * t * t + 3 * t + 1) / 6, t ** 3 / 6],
    d: [-.5 * (1 - t) ** 2, 1.5 * t * t - 2 * t, -1.5 * t * t + t + .5, .5 * t * t].map(x => x * (n - 3))};
}
function basis2(u, v, nx, ny) {
  const U = basis1(u, nx), V = basis1(v, ny), ids = [], b = [], du = [], dv = [];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    ids.push((V.i + j) * nx + U.i + i);
    b.push(U.b[i] * V.b[j]); du.push(U.d[i] * V.b[j]); dv.push(U.b[i] * V.d[j]);
  }
  return {ids, b, du, dv};
}
function triangleBasis(t, vertexBasis) {
  const values = new Map();
  for (let corner = 0; corner < 3; corner++) {
    const b = vertexBasis[t.ids[corner]];
    for (let k = 0; k < 16; k++) {
      if (!values.has(b.ids[k])) values.set(b.ids[k], [0, 0, 0]);
      values.get(b.ids[k])[corner] = b.b[k];
    }
  }
  const ids = [], dx = [], dy = [];
  for (const [id, v] of values) {
    const x = (v[1] - v[0]) / t.length;
    ids.push(id); dx.push(x); dy.push((v[2] - v[0] - x * t.x) / t.y);
  }
  return {ids, dx, dy};
}
function evaluate(b, control) {let x = 0; for (let k = 0; k < 16; k++) x += b.b[k] * control[b.ids[k]]; return x;}
function bounds(uv) {
  let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
  for (const p of uv) {u0 = Math.min(u0, p[0]); v0 = Math.min(v0, p[1]); u1 = Math.max(u1, p[0]); v1 = Math.max(v1, p[1]);}
  return {u0, v0, du: u1 - u0, dv: v1 - v0};
}

function metricWarps(data, uv, range, conditional) {
  const bins = 64, rows = 12, sumU = new Float64Array(bins), sumV = new Float64Array(bins);
  const weightU = new Float64Array(bins), weightV = new Float64Array(bins);
  const rowSum = Array.from({length: rows}, () => new Float64Array(bins));
  const rowWeight = Array.from({length: rows}, () => new Float64Array(bins));
  for (const t of data) {
    const [a, b, c, d] = derivative(t, uv, 1), det = a * d - b * c;
    const u = t.ids.reduce((s, i) => s + uv[i][0], 0) / 3;
    const v = t.ids.reduce((s, i) => s + uv[i][1], 0) / 3;
    const i = clamp(Math.floor((u - range.u0) / range.du * bins), 0, bins - 1);
    const j = clamp(Math.floor((v - range.v0) / range.dv * bins), 0, bins - 1);
    const weight = Math.abs(det) * t.area / (range.du * range.dv);
    const speedU = Math.hypot(d, c) / Math.abs(det) * range.du;
    sumU[i] += speedU * weight; weightU[i] += weight;
    sumV[j] += Math.hypot(b, a) / Math.abs(det) * range.dv * weight; weightV[j] += weight;
    const row = clamp(Math.floor((v - range.v0) / range.dv * rows), 0, rows - 1);
    rowSum[row][i] += speedU * weight; rowWeight[row][i] += weight;
  }
  const density = (sum, weight, fallback = null) => {
    const values = Array.from(sum, (x, i) => weight[i] > 0 ? x / weight[i] : null);
    const known = values.map((x, i) => x === null ? -1 : i).filter(x => x >= 0);
    if (!known.length) return [...fallback];
    for (let i = 0; i < bins; i++) if (values[i] === null) {
      const left = known.findLast(k => k < i) ?? known[0], right = known.find(k => k > i) ?? known.at(-1);
      values[i] = left === right ? values[left] : values[left] + (values[right] - values[left]) * (i - left) / (right - left);
    }
    return values;
  };
  const globalU = density(sumU, weightU), marginalU = smoothIntegral(globalU);
  if (!conditional) return {u: {span: marginalU.span, at: s => ({...marginalU.at(s), acrossDerivative: 0})},
    v: smoothIntegral(density(sumV, weightV)), bins, rows: 0, conditional: false};
  const rowWarp = rowSum.map((sum, i) => smoothIntegral(density(sum, rowWeight[i], globalU)));
  const u = {span: marginalU.span, at: (s, t) => {
    const y = clamp(t, 0, 1) * rows - .5, cell = Math.floor(y), B = basis1(y - cell, 4);
    let value = 0, derivative = 0, acrossDerivative = 0;
    for (let k = 0; k < 4; k++) {
      const q = rowWarp[clamp(cell - 1 + k, 0, rows - 1)].at(s);
      value += B.b[k] * q.value; derivative += B.b[k] * q.derivative;
      acrossDerivative += B.d[k] * rows * q.value;
    }
    return {value, derivative, acrossDerivative};
  }};
  return {u, v: smoothIntegral(density(sumV, weightV)), bins, rows, conditional: true};
}
// Exact C3 integral of positive cubic B-spline kernels. Ghost samples preserve
// constant density at chart boundaries. Evaluation touches at most four kernels.
function smoothIntegral(density) {
  const bins = density.length, h = 1 / bins;
  const values = [density[0], density[0], ...density, density.at(-1), density.at(-1)], prefix = [0];
  for (const v of values) prefix.push(prefix.at(-1) + v * h);
  const integral = s => {
    const complete = clamp(Math.floor(s / h - 2.5) + 3, 0, values.length);
    let value = prefix[complete], derivative = 0;
    for (let i = complete; i < values.length; i++) {
      const z = s / h - (i - 1.5); if (z <= -2) break;
      const q = Math.abs(z);
      const K = q < 1 ? 2 / 3 - q * q + q ** 3 / 2 : (2 - q) ** 3 / 6;
      const F = q < 1 ? .5 + 2 * q / 3 - q ** 3 / 3 + q ** 4 / 8 : 1 - (2 - q) ** 4 / 24;
      value += values[i] * h * (z < 0 ? 1 - F : F); derivative += values[i] * K;
    }
    return {value, derivative};
  };
  const origin = integral(0).value, span = integral(1).value - origin;
  return {span, at: s => {const q = integral(clamp(s, 0, 1));
    return {value: clamp((q.value - origin) / span, 0, 1), derivative: q.derivative / span};}};
}
function sampleTriangles(data, cap) {
  if (data.length <= cap) return data.map(t => ({t, weight: t.area}));
  const total = data.reduce((sum, t) => sum + t.area, 0), step = total / cap, out = [];
  let at = 0, end = data[0].area;
  for (let i = 0; i < cap; i++) {
    const target = (i + .5) * step;
    while (end < target && at < data.length - 1) end += data[++at].area;
    out.push({t: data[at], weight: step});
  }
  return out;
}
function cholesky(A, n) {
  const L = new Float64Array(A.length);
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let value = A[i * n + j];
    for (let k = 0; k < j; k++) value -= L[i * n + k] * L[j * n + k];
    if (i === j) {if (!(value > 0) || !Number.isFinite(value)) return null; L[i * n + j] = Math.sqrt(value);}
    else L[i * n + j] = value / L[j * n + j];
  }
  return L;
}
function solve(L, b, n) {
  const x = new Float64Array(b);
  for (let i = 0; i < n; i++) {for (let j = 0; j < i; j++) x[i] -= L[i * n + j] * x[j]; x[i] /= L[i * n + i];}
  for (let i = n - 1; i >= 0; i--) {for (let j = i + 1; j < n; j++) x[i] -= L[j * n + i] * x[j]; x[i] /= L[i * n + i];}
  return x;
}

function protectLocalExtrema(data, seed, fitted, before) {
  const bad = [], anchors = new Set();
  const limits = scaleLimits(before);
  let area = 0;
  for (const t of data) {
    const m = triangleMetric(t, fitted);
    if (m.lo < limits.minimum / 1.02 || m.hi > limits.maximum * 1.02 ||
        m.hi / m.lo > before.anisotropy.max * 1.02) {
      bad.push(t); area += t.area; for (const id of t.ids) anchors.add(id);
    }
  }
  // This is a bounded repair of a single small connected boundary region,
  // not permission to hide a globally poor fit or to change the chart topology.
  if (!bad.length || bad.length > 6 || anchors.size > 12 || area > before.surfaceAreaMm2 * .005) return null;
  const connected = new Set(bad[0].ids);
  for (let pass = 0; pass < bad.length; pass++) for (const t of bad)
    if (t.ids.some(i => connected.has(i))) for (const i of t.ids) connected.add(i);
  if (connected.size !== anchors.size) return null;
  const ids = [...anchors], n = ids.length;
  const distance = (a, b) => Math.hypot((a[0] - b[0]) * UV_MM, (a[1] - b[1]) * UV_MM);
  let span = 0;
  for (const a of ids) for (const b of ids) span = Math.max(span, distance(seed[a], seed[b]));
  const range = bounds(seed);
  if (span < 1e-6 || span > Math.min(range.du, range.dv) * UV_MM * .2) return null;
  // Keep the fitted centroid (texture phase), restoring only the original
  // local derivatives. Translating the seed does not change its Jacobian.
  const shift = [0, 1].map(axis => ids.reduce((s, id) => s + fitted[id][axis] - seed[id][axis], 0) / n);
  const targets = [0, 1].map(axis => Float64Array.from(ids,
    id => seed[id][axis] + shift[axis] - fitted[id][axis]));
  const compact = r => r < 1 ? (1 - r) ** 4 * (4 * r + 1) : 0;
  for (const multiple of [1.4, 2, 3]) {
    const radius = span * multiple, matrix = new Float64Array(n * n);
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++)
      matrix[i * n + j] = compact(distance(seed[ids[i]], seed[ids[j]]) / radius) + (i === j ? 1e-10 : 0);
    const L = cholesky(matrix, n);
    if (!L) continue;
    const U = solve(L, targets[0], n), V = solve(L, targets[1], n);
    let affectedVertices = 0;
    const uv = fitted.map((p, index) => {
      let du = 0, dv = 0, active = false;
      for (let j = 0; j < n; j++) {
        const weight = compact(distance(seed[index], seed[ids[j]]) / radius);
        du += weight * U[j]; dv += weight * V[j]; active ||= weight > 0;
      }
      if (active) affectedVertices++;
      return [p[0] + du, p[1] + dv];
    });
    const measured = measure(data, uv, seed, true, before);
    if (!measured.invalidUVTriangles && !measured.orientationChanges && measured.tailProtectionPassed)
      return {uv, measured, report: {method: 'C2 compact local seed-gradient constraint',
        constrainedTriangles: bad.length, anchorVertices: n, constrainedSurfaceAreaMm2: area,
        affectedVertices, supportRadiusInSeedMaterialMm: radius, originalLocalGradientPreserved: true}};
  }
  return null;
}

function triangleMetric(t, uv) {
  const [a, b, c, d] = derivative(t, uv), det = a * d - b * c;
  const ia = d / det, ib = -b / det, ic = -c / det, id = a / det;
  const e = ia * ia + ic * ic, f = ib * ib + id * id, g = ia * ib + ic * id;
  const disc = Math.hypot(e - f, 2 * g);
  return {det, e, f, lo: Math.sqrt(Math.max(1e-16, (e + f - disc) / 2)),
    hi: Math.sqrt(Math.max(1e-16, (e + f + disc) / 2))};
}
function scaleLimits(reference) {
  // Compare error relative to unit scale in both directions. A chart which is
  // entirely stretched must be allowed to reach 1; its old minimum above 1 is
  // not a lower bound on an improved isometric coordinate field.
  const lo = reference.sigmaMin, hi = reference.sigmaMax;
  return {minimum: Math.min(1, lo.min, 1 / lo.max), maximum: Math.max(1, hi.max, 1 / hi.min),
    p05: Math.min(1, lo.p05, 1 / lo.p95), p95: Math.max(1, hi.p95, 1 / hi.p05)};
}
function measure(data, uv, referenceUV = null, summaryOnly = false, tailReference = null) {
  const u = [], v = [], anisotropy = [], minimum = [], maximum = [];
  let area = 0, error = 0, invalidUVTriangles = 0, invalidSurfaceTriangles = 0, orientationChanges = 0;
  let highScaleArea = 0, lowScaleArea = 0, highAnisotropyArea = 0;
  let largestScale = 0, smallestScale = Infinity, largestAnisotropy = 0;
  const limits = tailReference ? scaleLimits(tailReference) : null;
  for (const t of data) {
    if (!(t.area > 1e-12) || !Number.isFinite(t.area)) {invalidSurfaceTriangles++; continue;}
    const {det, e, f, lo, hi} = triangleMetric(t, uv);
    if (!Number.isFinite(det) || Math.abs(det) < 1e-10) {invalidUVTriangles++; continue;}
    if (referenceUV) {const R = derivative(t, referenceUV); if (det * (R[0] * R[3] - R[1] * R[2]) <= 0) orientationChanges++;}
    if (tailReference) {
      if (hi > limits.p95 * 1.005) highScaleArea += t.area;
      if (lo < limits.p05 / 1.005) lowScaleArea += t.area;
      if (hi / lo > tailReference.anisotropy.p95 * 1.005) highAnisotropyArea += t.area;
      largestScale = Math.max(largestScale, hi); smallestScale = Math.min(smallestScale, lo); largestAnisotropy = Math.max(largestAnisotropy, hi / lo);
    }
    if (!summaryOnly) {
      u.push([Math.sqrt(e), t.area]); v.push([Math.sqrt(f), t.area]);
      anisotropy.push([hi / lo, t.area]); minimum.push([lo, t.area]); maximum.push([hi, t.area]);
    }
    area += t.area; error += t.area * (Math.log(lo) ** 2 + Math.log(hi) ** 2) / 2;
  }
  if (summaryOnly) return {invalidUVTriangles, invalidSurfaceTriangles, orientationChanges,
    logStretchRms: area ? Math.sqrt(error / area) : null,
    tailProtectionPassed: !tailReference || (Math.max(highScaleArea, lowScaleArea, highAnisotropyArea) <= area * .05 &&
      largestScale <= limits.maximum * 1.02 && smallestScale >= limits.minimum / 1.02 &&
      largestAnisotropy <= tailReference.anisotropy.max * 1.02)};
  return {weighting: 'actual 3D triangle area', surfaceAreaMm2: area, validTriangles: u.length,
    invalidUVTriangles, invalidSurfaceTriangles, orientationChanges,
    u: quantiles(u), v: quantiles(v), anisotropy: quantiles(anisotropy),
    sigmaMin: quantiles(minimum), sigmaMax: quantiles(maximum), logStretchRms: area ? Math.sqrt(error / area) : null};
}
function quantiles(values) {
  if (!values.length) return {min: null, p05: null, median: null, p95: null, max: null};
  values.sort((a, b) => a[0] - b[0]);
  const total = values.reduce((sum, p) => sum + p[1], 0);
  const q = fraction => {let sum = 0; for (const p of values) {sum += p[1]; if (sum >= fraction * total) return p[0];} return values.at(-1)[0];};
  return {min: values[0][0], p05: q(.05), median: q(.5), p95: q(.95), max: values.at(-1)[0]};
}
