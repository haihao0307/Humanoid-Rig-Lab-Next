import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Independent diagnostic, separate from the retained geometry acceptance groups.
// Run after the production source is frozen. No production or retained R13/R12 files change.
// A temporary source copy disables only the UV fit to reconstruct each current
// panel's seed chart. Positions, normals and indices must remain byte identical.
// All measurements below use final Float32 buffers, not producer statistics.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceFiles = ['deformation.mjs', 'kernel.mjs', 'model.mjs', 'penny-chelsea.mjs', 'monk-canvas.mjs', 'soles.mjs', 'surface-coordinates.mjs'];
const sha256 = text => createHash('sha256').update(text).digest('hex');
const sources = new Map(sourceFiles.map(name => [name, fs.readFileSync(path.join(root, 'src', name), 'utf8')]));
const sourceHashes = [...sources].map(([name, text]) => ({ path: 'src/' + name, sha256: sha256(text) }));
const seedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shoe-r14-seed-uv-'));
const threeURL = import.meta.resolve('three');
const outputPath = process.argv[2] || '/tmp/shoe-r14-uv-audit.json';
const cases = [['default', {}], ['all-low', { length: .9, width: .88, instep: -5, thickness: .9 }], ['all-high', { length: 1.1, width: 1.15, instep: 8, thickness: 2.1 }]];
const results = [];
const acceptanceCriteria = { invalidTriangles: 0, newOrientationChanges: 0, maximumLogStretchIncrease: .0001,
  maximumProducerReportRelativeDifference: .01, maximumComparativeTailAreaFraction: .050001,
  maximumExtremeScaleOrAnisotropyRatio: 1.0201, minimumExtremeScaleRatio: 1 / 1.0201,
  note: 'Tail comparison uses each same-surface seed chart. The 0.01% extrema allowance accounts for final Float32 rounding; it does not assert low absolute distortion.' };

function bytesEqual(a, b) {
  return a.constructor === b.constructor && a.byteLength === b.byteLength &&
    Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(Buffer.from(b.buffer, b.byteOffset, b.byteLength));
}
function freezeSnapshot(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeSnapshot(child);
    Object.freeze(value);
  }
  return value;
}
function quantiles(values) {
  values.sort((a, b) => a[0] - b[0]);
  const total = values.reduce((s, x) => s + x[1], 0);
  const at = q => { let area = 0; for (const x of values) { area += x[1]; if (area >= q * total) return x[0]; } return values.at(-1)[0]; };
  return { min: values[0][0], p05: at(.05), median: at(.5), p95: at(.95), max: values.at(-1)[0] };
}
function triangleMetrics(g, referenceUV) {
  const pos = g.attributes.position, uv = g.attributes.uv, ids = g.index.array;
  const outer = g.groups.find(group => group.materialIndex === 0);
  assert.ok(outer && outer.count > 0, 'UV audit requires the real exterior triangle group');
  const values = [], e1 = [], e2 = [];
  let invalidUVTriangles = 0, invalidSurfaceTriangles = 0, orientationChanges = 0;
  for (let k = outer.start; k < outer.start + outer.count; k += 3) {
    const a = ids[k], b = ids[k + 1], c = ids[k + 2];
    for (let d = 0; d < 3; d++) { e1[d] = pos.array[b * 3 + d] - pos.array[a * 3 + d]; e2[d] = pos.array[c * 3 + d] - pos.array[a * 3 + d]; }
    const cross = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const twiceArea = Math.hypot(...cross);
    if (!(twiceArea > 2e-12) || !Number.isFinite(twiceArea)) { invalidSurfaceTriangles++; continue; }
    const du1 = (uv.getX(b) - uv.getX(a)) * 100, dv1 = (uv.getY(b) - uv.getY(a)) * 100;
    const du2 = (uv.getX(c) - uv.getX(a)) * 100, dv2 = (uv.getY(c) - uv.getY(a)) * 100;
    const det = du1 * dv2 - dv1 * du2;
    if (!Number.isFinite(det) || Math.abs(det / twiceArea) < 1e-10) { invalidUVTriangles++; continue; }
    if (referenceUV) {
      const determinant = (referenceUV.getX(b) - referenceUV.getX(a)) * (referenceUV.getY(c) - referenceUV.getY(a)) -
        (referenceUV.getY(b) - referenceUV.getY(a)) * (referenceUV.getX(c) - referenceUV.getX(a));
      if (det * determinant <= 0) orientationChanges++;
    }
    // F is the 3x2 Jacobian from material millimetres into actual world space.
    // Compute its singular values from the Gram matrix; obtain the smaller
    // value from the area ratio to avoid cancellation at distorted tiny tips.
    const U = e1.map((x, d) => (x * dv2 - e2[d] * dv1) / det);
    const V = e1.map((x, d) => (e2[d] * du1 - x * du2) / det);
    const uu = U.reduce((s, x) => s + x * x, 0), vv = V.reduce((s, x) => s + x * x, 0), dot = U.reduce((s, x, d) => s + x * V[d], 0);
    const hi = Math.sqrt((uu + vv + Math.hypot(uu - vv, 2 * dot)) / 2);
    const lo = twiceArea / Math.abs(det) / hi;
    assert.ok(Number.isFinite(lo) && lo > 0 && Number.isFinite(hi), 'non-finite final UV scale');
    const centreMm = [0, 1, 2].map(d => (pos.array[a * 3 + d] + pos.array[b * 3 + d] + pos.array[c * 3 + d]) / 3);
    values.push({ area: twiceArea / 2, lo, hi, anisotropy: hi / lo, u: Math.sqrt(uu), v: Math.sqrt(vv), triangle: k / 3, centreMm });
  }
  assert.ok(values.length > 0, 'no measurable outer material triangles');
  const area = values.reduce((s, v) => s + v.area, 0);
  const summary = { weighting: 'actual final Float32 3D triangle area', units: 'surface mm per material mm', surfaceAreaMm2: area,
    validTriangles: values.length, invalidUVTriangles, invalidSurfaceTriangles, orientationChanges,
    logStretchRms: Math.sqrt(values.reduce((s, v) => s + v.area * (Math.log(v.lo) ** 2 + Math.log(v.hi) ** 2) / 2, 0) / area) };
  for (const [name, key] of [['sigmaMin', 'lo'], ['sigmaMax', 'hi'], ['anisotropy', 'anisotropy'], ['u', 'u'], ['v', 'v']]) summary[name] = quantiles(values.map(v => [v[key], v.area]));
  return { values, summary };
}
function compareReport(actual, claimed, identity) {
  if (!claimed) return { identity, present: false };
  const relative = (a, b) => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-12);
  let maximumRelativeDifference = relative(actual.logStretchRms, claimed.logStretchRms);
  let maximumDifference = { field: 'logStretchRms', actual: actual.logStretchRms, claimed: claimed.logStretchRms, relativeDifference: maximumRelativeDifference };
  // An otherwise plausible per-panel report can contain an area copied from a
  // different panel. Compare this existing scalar under the same 1% gate.
  const areaDifference = Number.isFinite(actual.surfaceAreaMm2) && Number.isFinite(claimed.surfaceAreaMm2)
    ? relative(actual.surfaceAreaMm2, claimed.surfaceAreaMm2) : Infinity;
  maximumRelativeDifference = Math.max(maximumRelativeDifference, areaDifference);
  if (areaDifference > maximumDifference.relativeDifference) maximumDifference = {
    field: 'surfaceAreaMm2', actual: actual.surfaceAreaMm2, claimed: claimed.surfaceAreaMm2, relativeDifference: areaDifference
  };
  for (const field of ['sigmaMin', 'sigmaMax', 'anisotropy', 'u', 'v']) for (const q of ['min', 'p05', 'median', 'p95', 'max']) {
    const difference = relative(actual[field][q], claimed[field][q]);
    maximumRelativeDifference = Math.max(maximumRelativeDifference, difference);
    if (difference > maximumDifference.relativeDifference) maximumDifference = {
      field: field + '.' + q, actual: actual[field][q], claimed: claimed[field][q], relativeDifference: difference
    };
  }
  return { identity, present: true, maximumRelativeDifference, invalidCountsAgree: actual.invalidUVTriangles === claimed.invalidUVTriangles && actual.invalidSurfaceTriangles === claimed.invalidSurfaceTriangles,
    validTrianglesAgree: actual.validTriangles === claimed.validTriangles,
    maximumDifference,
    note: 'Producer measures pre-Float32 doubles; this diagnostic measures the buffers submitted for rendering.' };
}

try {
  for (const [name, source] of sources) {
    const body = name === 'surface-coordinates.mjs'
      ? 'export function restSurfaceCoordinates(points, triangles, seedUV) { return { uv: seedUV, report: { seedOnlyDiagnostic: true } }; }\n'
      : source.replace(/from (['"])three\1/g, 'from ' + JSON.stringify(threeURL));
    fs.writeFileSync(path.join(seedRoot, name), body);
  }
  const { buildStyle } = await import(pathToFileURL(path.join(root, 'src/model.mjs')));
  const { buildStyle: buildSeedStyle } = await import(pathToFileURL(path.join(seedRoot, 'model.mjs')));
  for (const [preset, params] of cases) for (const id of ['penny', 'chelsea', 'monk', 'canvas']) {
    const started = performance.now(), model = buildStyle(id, params);
    assert.equal(new Set(model.parts.map(p => p.id)).size, model.parts.length, 'producer statistics require unique part identities');
    // Freeze each raw report immediately, before the seed model is built or
    // any final-buffer measurement runs. Comparisons use this per-ID snapshot,
    // never a later mutable report reference. All original scalars are retained.
    const producerSnapshots = new Map(model.parts.map(p => [p.id, freezeSnapshot({
      identity: { preset, style: id, partId: p.id },
      statistics: structuredClone(p.geometry.userData.materialCoordinates?.stretchBeforeAfter ?? null)
    })]));
    const unchanged = stage => {
      for (const p of model.parts) assert.deepEqual(p.geometry.userData.materialCoordinates?.stretchBeforeAfter ?? null,
        producerSnapshots.get(p.id).statistics, `${preset}/${id}/${p.id}: producer statistics changed ${stage}`);
    };
    const seed = buildSeedStyle(id, params);
    try {
      unchanged('during seed construction');
      assert.deepEqual(model.parts.map(p => p.id), seed.parts.map(p => p.id), 'diagnostic copy changed panel identity');
      for (let i = 0; i < model.parts.length; i++) {
        const p = model.parts[i], g = p.geometry, seedGeometry = seed.parts[i].geometry;
        for (const attr of ['position', 'normal']) assert.ok(bytesEqual(g.attributes[attr].array, seedGeometry.attributes[attr].array), p.id + ': seed reconstruction changed ' + attr);
        assert.ok(bytesEqual(g.index.array, seedGeometry.index.array), p.id + ': seed reconstruction changed triangle indices');
        // Select real material shells by their geometry and role, not by the
        // producer's claim that a fit happened or its report of a good result.
        if (!g.userData.surfaceVertices || !['leather', 'canvas', 'elastic', 'webbing', 'lining'].includes(p.role) || p.kind === 'binding') continue;
        const before = triangleMetrics(seedGeometry), after = triangleMetrics(g, seedGeometry.attributes.uv), B = before.summary, A = after.summary;
        const snapshot = producerSnapshots.get(p.id), snapshotSha256 = sha256(JSON.stringify(snapshot));
        assert.deepEqual(g.userData.materialCoordinates?.stretchBeforeAfter ?? null, snapshot.statistics,
          `${preset}/${id}/${p.id}: producer statistics changed during final-buffer measurement`);
        const tailArea = { aboveBeforeP95Scale: 0, belowBeforeP05Scale: 0, aboveBeforeP95Anisotropy: 0 };
        for (const t of after.values) {
          if (t.hi > B.sigmaMax.p95 * 1.005) tailArea.aboveBeforeP95Scale += t.area;
          if (t.lo < B.sigmaMin.p05 / 1.005) tailArea.belowBeforeP05Scale += t.area;
          if (t.anisotropy > B.anisotropy.p95 * 1.005) tailArea.aboveBeforeP95Anisotropy += t.area;
        }
        for (const key of Object.keys(tailArea)) tailArea[key] /= A.surfaceAreaMm2;
        results.push({ preset, style: id, part: p.id, role: p.role, sourceGeometryIdentical: true, before: B, after: A,
          logStretchChange: A.logStretchRms - B.logStretchRms, tailAreaFraction: tailArea,
          extremaRatios: { maximumScale: A.sigmaMax.max / B.sigmaMax.max, minimumScale: A.sigmaMin.min / B.sigmaMin.min, maximumAnisotropy: A.anisotropy.max / B.anisotropy.max },
          producerSnapshot: { ...snapshot, sha256: snapshotSha256, capturedBeforeSeedBuild: true, rawStatisticsUnchanged: true },
          reportComparison: {
            before: compareReport(B, snapshot.statistics?.before, { ...snapshot.identity, phase: 'before', snapshotSha256 }),
            after: compareReport(A, snapshot.statistics?.after, { ...snapshot.identity, phase: 'after', snapshotSha256 })
          },
          residualTail: { areaFractionAnisotropyAbove5: after.values.filter(t => t.anisotropy > 5).reduce((s, t) => s + t.area, 0) / A.surfaceAreaMm2,
            areaFractionAnisotropyAbove10: after.values.filter(t => t.anisotropy > 10).reduce((s, t) => s + t.area, 0) / A.surfaceAreaMm2,
            worstFiveTriangles: [...after.values].sort((a, b) => b.anisotropy - a.anisotropy).slice(0, 5).map(t => ({ triangle: t.triangle,
              centreMm: t.centreMm, areaMm2: t.area, areaFraction: t.area / A.surfaceAreaMm2, sigmaMin: t.lo, sigmaMax: t.hi, anisotropy: t.anisotropy })),
            note: 'Localized high distortion remains at small end-cap triangles. Bulk improvement does not establish an isometric or manufacturing chart.' },
          generatorSkipped: g.userData.materialCoordinates?.skipped, generatorReason: g.userData.materialCoordinates?.reason });
      }
      unchanged('during the complete model measurement');
    } finally { model.parts.forEach(p => p.geometry.dispose()); seed.parts.forEach(p => p.geometry.dispose()); }
    console.log(JSON.stringify({ preset, style: id, elapsedMs: performance.now() - started, measuredPanels: results.filter(r => r.preset === preset && r.style === id).length }));
  }
  for (const file of sourceHashes) assert.equal(sha256(fs.readFileSync(path.join(root, file.path))), file.sha256, 'source changed during independent material audit: ' + file.path);
  const issues = results.flatMap(r => {
    const issues = [], label = r.preset + '/' + r.part;
    if (r.after.invalidUVTriangles || r.after.invalidSurfaceTriangles || r.after.orientationChanges) issues.push(label + ': degenerate or newly reversed final UV triangle');
    if (r.logStretchChange > acceptanceCriteria.maximumLogStretchIncrease) issues.push(label + ': final measured log stretch increased');
    for (const phase of ['before', 'after']) if (!r.reportComparison[phase].present || r.reportComparison[phase].maximumRelativeDifference > acceptanceCriteria.maximumProducerReportRelativeDifference || !r.reportComparison[phase].invalidCountsAgree || !r.reportComparison[phase].validTrianglesAgree) issues.push(label + ': producer ' + phase + ' statistics absent or inconsistent with final buffers');
    if (Math.max(...Object.values(r.tailAreaFraction)) > acceptanceCriteria.maximumComparativeTailAreaFraction) issues.push(label + ': more than 5% of physical area exceeds a seed-tail threshold');
    if (r.extremaRatios.maximumScale > acceptanceCriteria.maximumExtremeScaleOrAnisotropyRatio || r.extremaRatios.maximumAnisotropy > acceptanceCriteria.maximumExtremeScaleOrAnisotropyRatio || r.extremaRatios.minimumScale < acceptanceCriteria.minimumExtremeScaleRatio) issues.push(label + ': a final extreme exceeds the protected seed-extrema allowance');
    return issues;
  });
  const report = { suite: 'R14-INDEPENDENT-FINAL-MATERIAL-COORDINATES-DIAGNOSTIC', taskId: 'SHOE-R14-CONSTRUCTION-FLEX-20261018',
    sourceCommit: process.env.GITHUB_SHA || process.env.SOURCE_COMMIT || null, sourceHashes, testSha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
    environment: { node: process.version, v8: process.versions.v8, platform: process.platform, arch: process.arch, execArgv: process.execArgv },
    success: issues.length === 0, measuredPanels: results.length, acceptanceCriteria, numericIssues: issues, results,
    scope: { productionFilesChanged: false, sameSurfaceSeedComparison: true, finalFloat32Triangles: true, independentJacobianImplementation: true,
      producerSnapshotsCapturedBeforeSeedBuild: true, producerStatisticsCheckedUnchanged: true, comparedPartIdentityRecorded: true,
      rendered: false, humanApproval: false, userApproval: false, physicalSolver: false, wearerFit: false, manufacturing: false,
      note: 'Appearance coordinate audit; not an isometry, manufacturing flattening or visual approval. Separate diagnostic; does not add or weaken geometry acceptance groups.' } };
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n');
  if (issues.length) process.exitCode = 1;
  console.log(JSON.stringify({ outputPath, measuredPanels: results.length, numericIssues: issues }));
} finally { fs.rmSync(seedRoot, { recursive: true, force: true }); }
