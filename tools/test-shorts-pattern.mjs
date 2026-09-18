import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../clothing/ShortsPattern.js', import.meta.url), 'utf8'), context);
const { createShortsPattern, auditShortsPatternTopology } = context;
// Synthetic measurements exercise the draft; they are not claimed as readings
// from the current Human body or as a physically fitted garment.
const fixture = () => ({ unit: 'm', waistFrontArc: .34, waistBackArc: .36,
  hipFrontArc: .44, hipBackArc: .49, waistTopFrontArc: .333, waistTopBackArc: .351,
  waistToHip: .18, crotchDepth: .255, frontRiseLength: .32, backRiseLength: .37,
  thighCircumference: { left: .54, right: .55 },
  metadata: { source: 'synthetic_pure_function_test', waistY: .956, centerZ: .078,
    bounds: { minZ: -.065, maxZ: .22 } } });
const close = (a, b, tolerance = 1e-11) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const distance = (a, b) => Math.hypot(...a.map((x, k) => x - b[k]));
const piece = (p, id) => p.pieces.find(x => x.id === id);
const actualTape = () => ({ ...fixture(), waistFrontArc: .4492584307967932, waistBackArc: .3352942303720249,
  hipFrontArc: .4668110048081081, hipBackArc: .44402696750885734,
  waistTopFrontArc: .4405409330788456, waistTopBackArc: .3306940005131152,
  waistToHip: .18266596147641334, crotchDepth: .2670595803293285,
  frontRiseLength: .3018266978079144, backRiseLength: .37977043887366446,
  thighCircumference: { left: .5253428479003829, right: .5254492761974193 } });
const actualHem = (p, side) => ['F', 'B'].reduce((sum, prefix) => {
  const q = piece(p, prefix + side), edge = q.boundaries.hem;
  return sum + edge.slice(1).reduce((s, index, i) => s + distance(q.materialCoordinates[index], q.materialCoordinates[edge[i]]), 0);
}, 0);

test('nine original planar pieces have bounded grids and a separate positive-area gusset', () => {
  const p = createShortsPattern(fixture());
  assert.equal(p.unit, 'm');
  assert.equal(p.pieces.length, 9);
  assert.equal(p.pieces.reduce((n, p) => n + p.materialCoordinates.length, 0), 553);
  assert.equal(p.pieces.reduce((n, p) => n + p.triangles.length, 0), 848);
  for (const panel of p.pieces) {
    for (const tri of panel.triangles) {
      assert.equal(new Set(tri).size, 3);
      const [a, b, c] = tri.map(i => panel.materialCoordinates[i]);
      const twiceArea = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      assert.ok(twiceArea > 1e-8, panel.id + ' nonpositive/thin material triangle');
    }
  }
});

test('every declared seam matches actual original length and each stitch interval', () => {
  const p = createShortsPattern(fixture());
  for (const seam of p.seams) {
    const a = piece(p, seam.a.pieceId), b = piece(p, seam.b.pieceId);
    let la = 0, lb = 0;
    for (let i = 1; i < seam.pairs.length; i++) {
      const prev = seam.pairs[i - 1], next = seam.pairs[i];
      const da = distance(a.materialCoordinates[prev.a], a.materialCoordinates[next.a]);
      const db = distance(b.materialCoordinates[prev.b], b.materialCoordinates[next.b]);
      close(da, db); la += da; lb += db;
      assert.ok(next.t > prev.t);
    }
    close(la, seam.restLengthA); close(lb, seam.restLengthB);
    close(seam.pairs[0].t, 0); close(seam.pairs.at(-1).t, 1);
    assert.ok(Number.isInteger(seam.stage));
  }
});

test('redrafted crotch rows eliminate the historical sharp corner and keep positive adjacent cells', () => {
  // Regression from the first actual skin-surface measurement. These raw
  // surface arcs are deliberately not labelled as taut tailoring-tape lengths.
  const m = { ...fixture(), waistFrontArc: .454722792029384, waistBackArc: .3354484012389142,
    hipFrontArc: .5868633615912765, hipBackArc: .463092227033439,
    waistTopFrontArc: .44101173894915463, waistTopBackArc: .33090460700305907,
    waistToHip: .19654468524699642, crotchDepth: .2670595803293285,
    frontRiseLength: .4339737139950245, backRiseLength: .4807218635764344 };
  // Hold this historical raw-surface draft's original opening fixed; changing
  // the current style default must not silently change the regression geometry.
  const p = createShortsPattern(m, { hemCircumference: .9996512896850835, hipEase: .050, frontRiseEase: .014, backRiseEase: .018 }), q = piece(p, 'BR');
  close(q.gussetCut.removedCornerUV[0], -.24351534276898973);
  close(q.gussetCut.removedCornerUV[1], .27905958032932854);
  assert.ok(distance(q.materialCoordinates[64], q.gussetCut.removedCornerUV) > .01);
  for (const t of q.triangles.filter(t => t.some(i => i >= 56 && i <= 79))) {
    const [a, b, c] = t.map(i => q.materialCoordinates[i]);
    const area2 = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
    assert.ok(area2 / Math.max(distance(a, b), distance(b, c), distance(c, a)) > .008);
  }
});

test('actual triangle quotient has one waist and two leg boundary loops, including waistband', () => {
  const p = createShortsPattern(fixture());
  for (const includeBand of [false, true]) {
    const t = auditShortsPatternTopology(p, includeBand);
    assert.equal(t.eulerCharacteristic, -1);
    assert.equal(t.boundaryLoops, 3);
    assert.equal(t.nonManifoldEdges, 0);
    assert.equal(t.valid, true);
  }
  const missingInseam = { ...p, seams: p.seams.filter(s => s.id !== 'inseam-right') };
  assert.equal(auditShortsPatternTopology(missingInseam, false).valid, false);
});

test('four three-piece gusset junctions replace the old four-way crotch without extra welds', () => {
  const p = createShortsPattern(fixture());
  assert.equal(p.junctions.length, 4);
  for (const j of p.junctions) {
    assert.equal(j.members.length, 3);
    assert.equal(j.extraWeld, false);
    assert.equal(new Set(j.members.map(x => x.pieceId + ':' + x.index)).size, 3);
    for (const member of j.members) {
      const actual = piece(p, member.pieceId).materialCoordinates[member.index];
      close(distance(actual, member.uv), 0);
      assert.equal(j.sewnBy.filter(id => {
        const s = p.seams.find(x => x.id === id);
        return s.pairs.some(pair => (s.a.pieceId === member.pieceId && pair.a === member.index) || (s.b.pieceId === member.pieceId && pair.b === member.index));
      }).length, 2);
    }
  }
});

test('fitted waist retains a real side opening to at least the measured hip line', () => {
  const m = fixture(), p = createShortsPattern(m);
  assert.ok(p.opening.closedWaistLength < p.opening.hipLength);
  assert.ok(p.opening.sourceDepth >= m.waistToHip);
  assert.equal(p.opening.donningClearanceValidated, false);
  const closures = p.seams.filter(x => x.kind === 'closure');
  assert.equal(closures.length, 2);
  for (const c of closures) { assert.equal(c.stage, 5); assert.equal(c.initiallyActive, false); }
  const lower = p.seams.find(x => x.id === 'outseam-left'), upper = p.seams.find(x => x.id === 'side-opening-left');
  assert.equal(upper.a.indices.at(-1), lower.a.indices[0]);
  assert.equal(upper.b.indices.at(-1), lower.b.indices[0]);
  assert.equal(new Set([...upper.a.indices, ...lower.a.indices]).size, piece(p, 'FL').boundaries.outseam.length);
});

test('waist and waistband top are measured net lengths with explicit ease', () => {
  const m = fixture(), p = createShortsPattern(m);
  close(p.draft.waistLength, m.waistFrontArc + m.waistBackArc + p.options.waistEase);
  close(p.draft.waistTopLength, m.waistTopFrontArc + m.waistTopBackArc + p.options.waistEase);
  for (const q of p.pieces.filter(x => x.kind === 'waistband')) {
    const length = edge => edge.slice(1).reduce((sum, i, k) => sum + distance(q.materialCoordinates[edge[k]], q.materialCoordinates[i]), 0);
    close(length(q.boundaries.lower), q.sourceContour.lowerLength);
    close(length(q.boundaries.upper), q.sourceContour.upperLength);
    for (let c = 0; c <= p.options.columns; c++)
      close(distance(q.materialCoordinates[q.boundaries.lower[c]], q.materialCoordinates[q.boundaries.upper[c]]), p.options.waistbandHeight);
  }
});

test('rectangular and reversed-contour waistband limits remain finite and true to source length', () => {
  for (const delta of [0, .015, -.015]) {
    const m = fixture(); m.waistTopFrontArc = m.waistFrontArc + delta; m.waistTopBackArc = m.waistBackArc + delta;
    const p = createShortsPattern(m);
    assert.ok(p.checks.seamLengthsMatched);
    for (const q of p.pieces) for (const uv of q.materialCoordinates) assert.ok(uv.every(Number.isFinite));
    assert.ok(auditShortsPatternTopology(p).valid);
  }
});

test('body support references exist only on the original upper waistband edge and use correct front/back t', () => {
  const p = createShortsPattern(fixture());
  for (const q of p.pieces) {
    if (q.kind !== 'waistband') { assert.equal(q.waistSupports, undefined); continue; }
    assert.equal(q.waistSupports.length, p.options.columns + 1);
    for (const s of q.waistSupports) { assert.ok(q.boundaries.upper.includes(s.index)); assert.ok(s.t >= 0 && s.t <= 1); }
    const reverse = ['WFL', 'WBR'].includes(q.id);
    assert.equal(q.waistSupports[0].t, reverse ? 1 : 0);
    assert.equal(q.waistSupports.at(-1).t, reverse ? 0 : 1);
  }
});

test('initial placements are rigid and preserve each actual material edge length', () => {
  const p = createShortsPattern(fixture());
  for (const q of p.pieces) {
    const { origin, basisU, basisV } = q.placement;
    const world = uv => origin.map((x, k) => x + basisU[k] * uv[0] + basisV[k] * uv[1]);
    for (const tri of q.triangles) for (let k = 0; k < 3; k++) {
      const a = q.materialCoordinates[tri[k]], b = q.materialCoordinates[tri[(k + 1) % 3]];
      close(distance(world(a), world(b)), distance(a, b));
    }
  }
});

test('actual tape-size waistband strips follow parent waist direction and all nine flat pieces are disjoint', () => {
  const m = { ...fixture(), waistFrontArc: .4492584307967932, waistBackArc: .3352942303720249,
    hipFrontArc: .4668110048081081, hipBackArc: .44402696750885734,
    waistTopFrontArc: .4405409330788456, waistTopBackArc: .3306940005131152,
    waistToHip: .18266596147641334, crotchDepth: .2670595803293285,
    frontRiseLength: .3018266978079144, backRiseLength: .37977043887366446,
    thighCircumference: { left: .5253428479003829, right: .5254492761974193 } };
  const p = createShortsPattern(m), boxes = p.pieces.map(q => {
    const positions = q.materialCoordinates.map(uv => q.placement.origin.map((x, k) => x + q.placement.basisU[k] * uv[0] + q.placement.basisV[k] * uv[1]));
    return { id: q.id, min: [0, 1, 2].map(k => Math.min(...positions.map(x => x[k]))), max: [0, 1, 2].map(k => Math.max(...positions.map(x => x[k]))) };
  });
  for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
    const x = boxes[a], y = boxes[b];
    const gap = Math.max(...[0, 1, 2].map(k => Math.max(x.min[k] - y.max[k], y.min[k] - x.max[k])));
    assert.ok(gap > .005, `${x.id}/${y.id} initial flat cloth overlap or inadequate gap: ${gap}`);
  }
  for (const id of ['WBR', 'WBL']) assert.ok(piece(p, id).placement.basisU[0] < -.99, id + ' must traverse right-to-left');
  for (const id of ['WFL', 'WFR']) assert.ok(piece(p, id).placement.basisU[0] > .99, id + ' must traverse left-to-right');
  assert.ok(p.checks.seamLengthsMatched);
  assert.ok(auditShortsPatternTopology(p).valid);
});

test('draft is deterministic, does not mutate measurements, and deep-copies provenance', () => {
  const m = fixture(), before = JSON.stringify(m), a = createShortsPattern(m), b = createShortsPattern(m);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(JSON.stringify(m), before);
  a.measurements.metadata.source = 'changed';
  assert.equal(m.metadata.source, 'synthetic_pure_function_test');
});

test('size changes regenerate original paper while preserving seam topology and truthful fit status', () => {
  for (const k of [.9, 1, 1.12]) {
    const m = fixture();
    for (const key of Object.keys(m)) if (typeof m[key] === 'number') m[key] *= k;
    m.thighCircumference.left *= k; m.thighCircumference.right *= k;
    const p = createShortsPattern(m);
    assert.ok(p.checks.seamLengthsMatched);
    assert.ok(auditShortsPatternTopology(p).valid);
    assert.equal(p.checks.garmentAccepted, false);
    assert.equal(p.checks.bodyFitValidated, false);
  }
});

test('actual-body default opening has explicit modest ease and no hidden crotch-width floor', () => {
  const m = actualTape(), thigh = Math.max(...Object.values(m.thighCircumference));
  const p = createShortsPattern(m);
  close(actualHem(p, 'L'), .6054492761974193); close(actualHem(p, 'R'), .6054492761974193);
  assert.equal(p.draft.hemTargetSource, 'measured_upper_thigh_plus_design_ease');
  for (const thighEase of [0, .04, .08, .12]) {
    const q = createShortsPattern(m, { thighEase });
    close(actualHem(q, 'L'), thigh + thighEase); close(actualHem(q, 'R'), thigh + thighEase);
    assert.ok(q.checks.seamLengthsMatched); assert.ok(auditShortsPatternTopology(q).valid);
  }
});

test('explicit hem changes original lower paper while preserving waist, hip, rise and true seam pairing', () => {
  const m = actualTape(), base = createShortsPattern(m, { hemCircumference: .62 });
  for (const hemCircumference of [.54, .62, .74]) {
    const p = createShortsPattern(m, { hemCircumference, thighEase: .11 });
    close(actualHem(p, 'L'), hemCircumference); close(actualHem(p, 'R'), hemCircumference);
    assert.equal(p.draft.hemTargetSource, 'explicit_net_leg_opening');
    for (const id of ['FL', 'FR', 'BL', 'BR']) {
      const q = piece(p, id), before = piece(base, id), n = q.grid.columns + 1;
      assert.deepEqual(q.materialCoordinates.slice(0, (p.options.hipRow + 1) * n), before.materialCoordinates.slice(0, (p.options.hipRow + 1) * n));
      for (const index of q.boundaries.rise) assert.deepEqual(q.materialCoordinates[index], before.materialCoordinates[index]);
      for (const index of q.boundaries.inseam) assert.deepEqual(q.materialCoordinates[index], before.materialCoordinates[index]);
      assert.equal(q.waistSupports, undefined);
    }
    for (const seam of p.seams) {
      const a = piece(p, seam.a.pieceId), b = piece(p, seam.b.pieceId);
      for (let i = 1; i < seam.pairs.length; i++) {
        const previous = seam.pairs[i - 1], current = seam.pairs[i];
        close(distance(a.materialCoordinates[previous.a], a.materialCoordinates[current.a]), distance(b.materialCoordinates[previous.b], b.materialCoordinates[current.b]));
      }
    }
    assert.ok(auditShortsPatternTopology(p).valid);
    close(p.seams.find(s => s.id === 'inseam-left').restLengthA, .124);
  }
  const narrow = createShortsPattern(m, { hemCircumference: .54 });
  assert.notDeepEqual(piece(narrow, 'FL').materialCoordinates.at(-1), piece(base, 'FL').materialCoordinates.at(-1));
  assert.notEqual(narrow.seams.find(s => s.id === 'outseam-right').restLengthA, base.seams.find(s => s.id === 'outseam-right').restLengthA);
});

test('actual crotch-row width is measured from the tapered paper and mesh retains positive quality', () => {
  const p = createShortsPattern(actualTape()), n = p.options.columns + 1, r = p.options.crotchRow;
  const width = ['FL', 'BL'].reduce((sum, id) => { const q = piece(p, id); return sum + distance(q.materialCoordinates[r * n], q.materialCoordinates[r * n + n - 1]); }, 0);
  close(p.draft.crotchLineWidth, width);
  for (const q of p.pieces) for (const tri of q.triangles) {
    const [a, b, c] = tri.map(i => q.materialCoordinates[i]);
    const area2 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    assert.ok(area2 / Math.max(distance(a, b), distance(b, c), distance(c, a)) > .012);
  }
});

test('missing, mixed-unit and geometrically impossible measurements fail explicitly', () => {
  assert.throws(() => createShortsPattern({ ...fixture(), unit: 'mm' }), /metres/);
  assert.throws(() => createShortsPattern({ ...fixture(), waistTopFrontArc: undefined }), /waistTopFrontArc/);
  assert.throws(() => createShortsPattern({ ...fixture(), frontRiseLength: .10 }), /rise cannot be drafted/);
  assert.throws(() => createShortsPattern({ ...fixture(), crotchDepth: .1 }), /Hip line/);
  assert.throws(() => createShortsPattern({ ...fixture(), hipFrontArc: 440 }), /metre-sized/);
  assert.throws(() => createShortsPattern(fixture(), { columns: 7.5 }), /integers/);
  for (const hemCircumference of [0, -1, NaN, Infinity]) assert.throws(() => createShortsPattern(fixture(), { hemCircumference }), /hemCircumference/);
  assert.throws(() => createShortsPattern(fixture(), { hemCircumference: .001 }), /folded or zero-width/);
  for (const gussetWidth of [0, -1, NaN, Infinity]) assert.throws(() => createShortsPattern(fixture(), { gussetWidth }), /gussetWidth/);
  assert.throws(() => createShortsPattern(fixture(), { gussetWidth: .5 }), /cannot span/);
});

test('actual gusset has exact four source cut edges and removes the old material corners', () => {
  const p = createShortsPattern(actualTape()), g = piece(p, 'G');
  close(g.sourceContour.width, .060);
  close(g.sourceContour.frontEdgeLength, .05738220576031082);
  close(g.sourceContour.backEdgeLength, .0937396388422999);
  close(p.draft.gusset.length, .13772487040737103);
  close(p.draft.gusset.centerRouteAddedLength, .003589783528307175);
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (const q of p.pieces.filter(q => q.kind === 'leg-panel')) {
    const [ia, im, ib] = q.boundaries.gusset, [a, mid, b] = [ia, im, ib].map(i => q.materialCoordinates[i]);
    close(distance(a, mid), distance(mid, b));
    assert.ok(q.materialCoordinates.every(uv => distance(uv, q.gussetCut.removedCornerUV) > .001));
    assert.equal(q.landmarks.crotch, undefined);
    assert.equal(q.boundaries.rise[0], ia); assert.equal(q.boundaries.inseam.at(-1), ib);
    assert.ok(!q.boundaries.rise.includes(im)); assert.ok(!q.boundaries.inseam.includes(im));
    // Independently clip every generated source face against the removed
    // triangle, rather than assuming its infinite half-plane is all waste.
    const cut = [a, b, q.gussetCut.removedCornerUV], orientation = Math.sign(cross(...cut));
    for (const triangle of q.triangles) {
      let polygon = triangle.map(i => q.materialCoordinates[i]);
      for (let k = 0; k < 3 && polygon.length; k++) {
        const x = cut[k], y = cut[(k + 1) % 3], next = [];
        for (let i = 0; i < polygon.length; i++) {
          const p0 = polygon[i], p1 = polygon[(i + 1) % polygon.length];
          const d0 = orientation * cross(x, y, p0), d1 = orientation * cross(x, y, p1);
          if (d0 >= 0) next.push(p0);
          if ((d0 < 0) !== (d1 < 0)) {
            const t = d0 / (d0 - d1); next.push(p0.map((v, j) => v + (p1[j] - v) * t));
          }
        }
        polygon = next;
      }
      const area = Math.abs(polygon.reduce((s, uv, i) => { const next = polygon[(i + 1) % polygon.length]; return s + uv[0] * next[1] - uv[1] * next[0]; }, 0)) / 2;
      assert.ok(area < 1e-14, `${q.id} still contains removed corner material`);
    }
  }
  close(actualHem(p, 'L'), .6054492761974193);
  close(p.draft.waistLength, .7985526611688181);
});

test('omitting the real gusset exposes a fourth boundary instead of leaving an overlapping cap', () => {
  const p = createShortsPattern(fixture());
  const hole = { ...p, pieces: p.pieces.filter(q => q.id !== 'G'), seams: p.seams.filter(s => !s.id.startsWith('gusset-')) };
  const t = auditShortsPatternTopology(hole, false);
  assert.equal(t.eulerCharacteristic, -2); assert.equal(t.boundaryLoops, 4); assert.equal(t.valid, false);
  for (const seam of p.seams.filter(s => s.id.startsWith('gusset-'))) {
    const missing = { ...p, seams: p.seams.filter(s => s !== seam) };
    assert.equal(auditShortsPatternTopology(missing, false).valid, false);
  }
});

test('gusset handling uses only actual stitch-boundary points and waits for closed stitches', () => {
  const p = createShortsPattern(fixture()), g = piece(p, 'G');
  assert.deepEqual([...g.handlingPoints].map(p => p.index), [g.landmarks.front, g.landmarks.back]); assert.equal(g.waistSupports, undefined);
  const edgePoints = new Set(Object.values(g.boundaries).flat());
  for (const h of g.handlingPoints) {
    assert.ok(edgePoints.has(h.index)); assert.equal(h.releaseWhenStitched, true);
    assert.equal(h.releaseOnNeedleOnly, undefined);
    assert.ok(p.seams.some(s => s.b.pieceId === 'G' && s.pairs.some(pair => pair.b === h.index)));
  }
  for (const s of p.seams) {
    const expected = s.kind === 'closure' ? 5 : s.id.startsWith('center-') ? 0 : s.id.startsWith('gusset-') ? 1 : s.id.startsWith('waistband-') ? 3 : s.id.startsWith('waist-') ? 4 : 2;
    assert.equal(s.stage, expected);
  }
});

test('gusset rigid opening identifies left/right and leaves source paper unchanged', () => {
  const m = actualTape(), before = createShortsPattern(m);
  m.waistCenter = [-.000078, .9562635, .0789258];
  m.metadata.crotchY = .6892039196706715;
  const p = createShortsPattern(m), g = piece(p, 'G'), world = uv => g.placement.origin.map((x, k) => x + g.placement.basisU[k] * uv[0] + g.placement.basisV[k] * uv[1]);
  const positions = g.materialCoordinates.map(world);
  close(Math.max(...positions.map(x => x[1])), m.metadata.crotchY - g.placement.topBelowMeasuredCrotchM);
  assert.ok(positions[g.landmarks.left][0] < m.waistCenter[0]);
  assert.ok(positions[g.landmarks.right][0] > m.waistCenter[0]);
  close(Math.hypot(...g.placement.basisU), 1);
  close(g.placement.basisU.reduce((s,v,k) => s + v*g.placement.basisV[k], 0), 0);
  close(g.placement.origin[2], m.waistCenter[2]);
  assert.ok(positions[g.landmarks.front][2] > positions[g.landmarks.back][2]);
  for (const q of p.pieces) {
    assert.deepEqual(q.materialCoordinates, piece(before, q.id).materialCoordinates);
    assert.deepEqual(q.triangles, piece(before, q.id).triangles);
    assert.deepEqual(q.boundaries, piece(before, q.id).boundaries);
  }
  assert.deepEqual(p.seams, before.seams);
});

test('relaxed paper allowance increases original hip and rise room while leaving all waistbands unchanged', () => {
  const m = actualTape(), base = createShortsPattern(m, { hipEase: .050, frontRiseEase: .014, backRiseEase: .018, thighEase: .060 });
  const p = createShortsPattern(m, { hipEase: .100, frontRiseEase: .024, backRiseEase: .038, thighEase: .080 });
  assert.deepEqual(p, createShortsPattern(m));
  close(p.opening.hipLength - base.opening.hipLength, .050);
  close(actualHem(p, 'L') - actualHem(base, 'L'), .020);
  close(p.draft.waistLength, base.draft.waistLength);
  close(p.draft.waistTopLength, base.draft.waistTopLength);
  close(p.draft.originalRiseLengthsBeforeGussetCut.front - base.draft.originalRiseLengthsBeforeGussetCut.front, .010);
  close(p.draft.originalRiseLengthsBeforeGussetCut.back - base.draft.originalRiseLengthsBeforeGussetCut.back, .020);
  close(p.draft.gusset.length, .13772487040737103);
  for (const q of p.pieces) {
    const previous = piece(base, q.id);
    if (q.kind === 'waistband') {
      assert.deepEqual(q.materialCoordinates, previous.materialCoordinates);
      assert.deepEqual(q.triangles, previous.triangles);
    }
    if (q.kind === 'leg-panel') for (const row of [3, 5, 6, 7, 8, 9]) {
      const a = row * (q.grid.columns + 1), b = a + q.grid.columns;
      assert.ok(distance(q.materialCoordinates[a], q.materialCoordinates[b]) > distance(previous.materialCoordinates[a], previous.materialCoordinates[b]));
    }
    for (const triangle of q.triangles) {
      const uv = triangle.map(i => q.materialCoordinates[i]), edges = [distance(uv[0], uv[1]), distance(uv[1], uv[2]), distance(uv[2], uv[0])];
      for (let i = 0; i < 3; i++) {
        const a = edges[i], b = edges[(i + 1) % 3], c = edges[(i + 2) % 3];
        assert.ok(Math.acos((a * a + b * b - c * c) / (2 * a * b)) * 180 / Math.PI > 18);
      }
    }
  }
  assert.ok(p.checks.maximumSeamMismatch < 1e-12);
  assert.ok(auditShortsPatternTopology(p).valid);
  assert.equal(p.checks.garmentAccepted, false);
});
