import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import {
  WeaveDraftError,
  compileWeaveDraft,
  crossingSampleIndex,
  draftCell,
  pointAt,
  validateWeaveDraft,
} from './weave-draft-compiler.mjs';
import { makeHerringbone12x12Fixture } from './herringbone-fixture.mjs';

const OPTIONS = Object.freeze({
  cellWidthM: 0.0012,
  cellHeightM: 0.0011,
  warpRadiusM: 0.00018,
  weftRadiusM: 0.0002,
  crossingClearanceM: 0.00006,
  samplesPerCell: 8,
});

function compile() {
  return compileWeaveDraft(makeHerringbone12x12Fixture(), OPTIONS);
}

function curveDigest(result) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify({
    schema: result.schema,
    units: result.units,
    tileSizeM: result.tileSizeM,
    separationM: result.separationM,
    options: result.options,
    sourceId: result.draft.sourceId,
  }));
  hash.update(result.draft.cells);
  for (const curve of result.curves) {
    hash.update(curve.id);
    hash.update(curve.family);
    hash.update(Buffer.from(curve.points.buffer, curve.points.byteOffset, curve.points.byteLength));
    hash.update(Buffer.from(curve.tangents.buffer, curve.tangents.byteOffset, curve.tangents.byteLength));
    hash.update(curve.crossingStates);
  }
  return hash.digest('hex');
}

function almostEqual(a, b, tolerance = 1e-12) {
  return Math.abs(a - b) <= tolerance;
}

test('rejects non-binary and dimension-mismatched drafts', () => {
  assert.throws(
    () => validateWeaveDraft({ width: 2, height: 2, cells: [0, 1, 2, 0] }),
    (error) => error instanceof WeaveDraftError && error.code === 'NON_BINARY_DRAFT',
  );
  assert.throws(
    () => validateWeaveDraft({ width: 2, height: 2, cells: [0, 1] }),
    (error) => error instanceof WeaveDraftError && error.code === 'DRAFT_SIZE_MISMATCH',
  );
});

test('compiles one stable curve per warp and weft yarn in meters', () => {
  const result = compile();
  assert.equal(result.units, 'meter');
  assert.deepEqual(result.tileSizeM, [0.0144, 0.0132]);
  assert.equal(result.curveCount, 24);
  assert.equal(result.curves.filter((curve) => curve.family === 'warp').length, 12);
  assert.equal(result.curves.filter((curve) => curve.family === 'weft').length, 12);
  assert.equal(result.curves[0].id, 'warp:0000');
  assert.equal(result.curves[11].id, 'warp:0011');
  assert.equal(result.curves[12].id, 'weft:0000');
  assert.equal(result.curves[23].id, 'weft:0011');
  assert.equal(result.pointCount, 24 * 97);
  assert.equal(new Set(result.curves.map((curve) => curve.id)).size, result.curveCount);
});

test('crossing centers preserve every draft over-under decision and clearance', () => {
  const result = compile();
  const separation = OPTIONS.warpRadiusM + OPTIONS.weftRadiusM + OPTIONS.crossingClearanceM;
  assert.ok(almostEqual(result.separationM, separation));
  for (let row = 0; row < result.draft.height; row += 1) {
    const weft = result.curves.find((curve) => curve.id === `weft:${String(row).padStart(4, '0')}`);
    for (let column = 0; column < result.draft.width; column += 1) {
      const warp = result.curves.find((curve) => curve.id === `warp:${String(column).padStart(4, '0')}`);
      const warpPoint = pointAt(warp, crossingSampleIndex(row, OPTIONS.samplesPerCell));
      const weftPoint = pointAt(weft, crossingSampleIndex(column, OPTIONS.samplesPerCell));
      assert.ok(almostEqual(warpPoint[0], weftPoint[0]));
      assert.ok(almostEqual(warpPoint[1], weftPoint[1]));
      const warpOver = draftCell(result.draft, row, column) === 1;
      assert.equal(warpPoint[2] > weftPoint[2], warpOver, `crossing ${row},${column}`);
      assert.ok(almostEqual(Math.abs(warpPoint[2] - weftPoint[2]), separation));
      assert.equal(warp.crossingStates[row], warpOver ? 1 : 0);
      assert.equal(weft.crossingStates[column], warpOver ? 0 : 1);
    }
  }
});

test('periodic tile seams close in height and tangent without connecting different yarns', () => {
  const result = compile();
  for (const curve of result.curves) {
    const first = pointAt(curve, 0);
    const last = pointAt(curve, curve.pointCount - 1);
    assert.ok(almostEqual(first[2], last[2]));
    const firstTangent = Array.from(curve.tangents.slice(0, 3));
    const lastTangent = Array.from(curve.tangents.slice(-3));
    firstTangent.forEach((value, axis) => assert.ok(almostEqual(value, lastTangent[axis])));
    if (curve.family === 'warp') {
      assert.ok(almostEqual(first[0], last[0]));
      assert.ok(almostEqual(last[1] - first[1], result.tileSizeM[1]));
    } else {
      assert.ok(almostEqual(first[1], last[1]));
      assert.ok(almostEqual(last[0] - first[0], result.tileSizeM[0]));
    }
  }
});

test('all generated points and tangents are finite and all local segments are nonzero', () => {
  const result = compile();
  for (const curve of result.curves) {
    assert.ok(Array.from(curve.points).every(Number.isFinite));
    assert.ok(Array.from(curve.tangents).every(Number.isFinite));
    for (let point = 1; point < curve.pointCount; point += 1) {
      const a = pointAt(curve, point - 1);
      const b = pointAt(curve, point);
      assert.ok(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) > 1e-12);
    }
    for (let point = 0; point < curve.pointCount; point += 1) {
      const offset = point * 3;
      const length = Math.hypot(
        curve.tangents[offset],
        curve.tangents[offset + 1],
        curve.tangents[offset + 2],
      );
      assert.ok(almostEqual(length, 1, 1e-10));
    }
  }
});

test('parallel yarn spacing cannot silently overlap', () => {
  assert.throws(
    () => compileWeaveDraft(makeHerringbone12x12Fixture(), { ...OPTIONS, warpRadiusM: 0.00061 }),
    (error) => error instanceof WeaveDraftError && error.code === 'WARP_SPACING_COLLISION',
  );
  assert.throws(
    () => compileWeaveDraft(makeHerringbone12x12Fixture(), { ...OPTIONS, weftRadiusM: 0.00056 }),
    (error) => error instanceof WeaveDraftError && error.code === 'WEFT_SPACING_COLLISION',
  );
});

test('crossing centers must be explicit samples', () => {
  assert.throws(
    () => compileWeaveDraft(makeHerringbone12x12Fixture(), { ...OPTIONS, samplesPerCell: 7 }),
    (error) => error instanceof WeaveDraftError && error.code === 'CROSSING_SAMPLE_ALIGNMENT',
  );
});

test('same draft and metric options produce identical binary centerlines', () => {
  const first = compile();
  const second = compile();
  assert.equal(curveDigest(first), curveDigest(second));
});

test('the fixture is explicitly barred from being represented as the official target', () => {
  const result = compile();
  assert.equal(result.draft.authority, 'algorithm_test_only_not_official_target');
  assert.equal(result.targetPatternStatus, 'SOURCE_ENTRY_REQUIRED');
  assert.equal(result.generatedFromOfficialFibricPattern, false);
});
