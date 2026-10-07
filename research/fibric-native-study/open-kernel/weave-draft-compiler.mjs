// Deterministic metric weave-draft compiler.
//
// This is an independently authored geometry kernel. It does not contain or
// execute Fibric or LYNX code. A draft cell value of 1 means warp-over-weft.
// Output is explicit periodic yarn centerlines in meters with stable IDs.

const EPSILON = 1e-12;

export class WeaveDraftError extends Error {
  constructor(message, code = 'INVALID_WEAVE_DRAFT') {
    super(message);
    this.name = 'WeaveDraftError';
    this.code = code;
  }
}

function assertFinitePositive(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new WeaveDraftError(`${label} must be finite and > 0`);
  }
  return value;
}

function assertInteger(value, label, minimum = 1) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new WeaveDraftError(`${label} must be an integer >= ${minimum}`);
  }
  return value;
}

function mod(value, period) {
  return ((value % period) + period) % period;
}

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

function catmullRomDerivative(p0, p1, p2, p3, t) {
  const t2 = t * t;
  return 0.5 * (
    (-p0 + p2) +
    2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * t +
    3 * (-p0 + 3 * p1 - 3 * p2 + p3) * t2
  );
}

function samplePeriodicKnots(knots, coordinateInCells) {
  const count = knots.length;
  // Crossing knots live at i + 0.5. Shift the coordinate so integer values
  // address the exact crossings, then evaluate a periodic Catmull-Rom spline.
  const u = coordinateInCells - 0.5;
  const i = Math.floor(u);
  const t = u - i;
  const p0 = knots[mod(i - 1, count)];
  const p1 = knots[mod(i, count)];
  const p2 = knots[mod(i + 1, count)];
  const p3 = knots[mod(i + 2, count)];
  return {
    value: catmullRom(p0, p1, p2, p3, t),
    derivativePerCell: catmullRomDerivative(p0, p1, p2, p3, t),
  };
}

function normalize3(x, y, z) {
  const length = Math.hypot(x, y, z);
  if (!Number.isFinite(length) || length <= EPSILON) {
    throw new WeaveDraftError('Degenerate tangent generated', 'DEGENERATE_TANGENT');
  }
  return [x / length, y / length, z / length];
}

export function validateWeaveDraft(input) {
  if (!input || typeof input !== 'object') {
    throw new WeaveDraftError('draft must be an object');
  }
  const width = assertInteger(input.width, 'draft.width');
  const height = assertInteger(input.height, 'draft.height');
  if (!Array.isArray(input.cells) && !ArrayBuffer.isView(input.cells)) {
    throw new WeaveDraftError('draft.cells must be an array or typed array');
  }
  if (input.cells.length !== width * height) {
    throw new WeaveDraftError(
      `draft.cells length ${input.cells.length} does not match ${width}x${height}`,
      'DRAFT_SIZE_MISMATCH',
    );
  }
  const cells = new Uint8Array(input.cells.length);
  for (let i = 0; i < input.cells.length; i += 1) {
    const value = Number(input.cells[i]);
    if (value !== 0 && value !== 1) {
      throw new WeaveDraftError(`draft.cells[${i}] must be 0 or 1`, 'NON_BINARY_DRAFT');
    }
    cells[i] = value;
  }
  return Object.freeze({
    width,
    height,
    cells,
    sourceId: String(input.sourceId || 'unspecified'),
    authority: String(input.authority || 'unknown'),
  });
}

export function draftCell(draft, row, column) {
  return draft.cells[mod(row, draft.height) * draft.width + mod(column, draft.width)];
}

function freezeCurve(curve) {
  Object.freeze(curve.points);
  Object.freeze(curve.tangents);
  Object.freeze(curve.crossingStates);
  return Object.freeze(curve);
}

function compileWarp(draft, column, options, separation) {
  const { cellWidthM, cellHeightM, samplesPerCell, warpRadiusM } = options;
  const crossingStates = new Uint8Array(draft.height);
  const knots = new Float64Array(draft.height);
  for (let row = 0; row < draft.height; row += 1) {
    const warpOver = draftCell(draft, row, column);
    crossingStates[row] = warpOver;
    knots[row] = warpOver ? separation * 0.5 : -separation * 0.5;
  }

  const pointCount = draft.height * samplesPerCell + 1;
  const points = new Float64Array(pointCount * 3);
  const tangents = new Float64Array(pointCount * 3);
  const x = (column + 0.5) * cellWidthM;
  for (let sample = 0; sample < pointCount; sample += 1) {
    const cellCoordinate = sample / samplesPerCell;
    const { value: z, derivativePerCell } = samplePeriodicKnots(knots, cellCoordinate);
    const y = cellCoordinate * cellHeightM;
    const [tx, ty, tz] = normalize3(0, cellHeightM, derivativePerCell);
    const offset = sample * 3;
    points[offset] = x;
    points[offset + 1] = y;
    points[offset + 2] = z;
    tangents[offset] = tx;
    tangents[offset + 1] = ty;
    tangents[offset + 2] = tz;
  }
  return freezeCurve({
    id: `warp:${String(column).padStart(4, '0')}`,
    family: 'warp',
    index: column,
    radiusM: warpRadiusM,
    pointCount,
    points,
    tangents,
    crossingStates,
    periodicAxis: 'y',
  });
}

function compileWeft(draft, row, options, separation) {
  const { cellWidthM, cellHeightM, samplesPerCell, weftRadiusM } = options;
  const crossingStates = new Uint8Array(draft.width);
  const knots = new Float64Array(draft.width);
  for (let column = 0; column < draft.width; column += 1) {
    const warpOver = draftCell(draft, row, column);
    crossingStates[column] = warpOver ? 0 : 1;
    knots[column] = warpOver ? -separation * 0.5 : separation * 0.5;
  }

  const pointCount = draft.width * samplesPerCell + 1;
  const points = new Float64Array(pointCount * 3);
  const tangents = new Float64Array(pointCount * 3);
  const y = (row + 0.5) * cellHeightM;
  for (let sample = 0; sample < pointCount; sample += 1) {
    const cellCoordinate = sample / samplesPerCell;
    const { value: z, derivativePerCell } = samplePeriodicKnots(knots, cellCoordinate);
    const x = cellCoordinate * cellWidthM;
    const [tx, ty, tz] = normalize3(cellWidthM, 0, derivativePerCell);
    const offset = sample * 3;
    points[offset] = x;
    points[offset + 1] = y;
    points[offset + 2] = z;
    tangents[offset] = tx;
    tangents[offset + 1] = ty;
    tangents[offset + 2] = tz;
  }
  return freezeCurve({
    id: `weft:${String(row).padStart(4, '0')}`,
    family: 'weft',
    index: row,
    radiusM: weftRadiusM,
    pointCount,
    points,
    tangents,
    crossingStates,
    periodicAxis: 'x',
  });
}

export function compileWeaveDraft(inputDraft, inputOptions = {}) {
  const draft = validateWeaveDraft(inputDraft);
  const options = Object.freeze({
    cellWidthM: assertFinitePositive(inputOptions.cellWidthM ?? 0.001, 'cellWidthM'),
    cellHeightM: assertFinitePositive(inputOptions.cellHeightM ?? 0.001, 'cellHeightM'),
    warpRadiusM: assertFinitePositive(inputOptions.warpRadiusM ?? 0.0002, 'warpRadiusM'),
    weftRadiusM: assertFinitePositive(inputOptions.weftRadiusM ?? 0.0002, 'weftRadiusM'),
    crossingClearanceM: assertFinitePositive(inputOptions.crossingClearanceM ?? 0.00004, 'crossingClearanceM'),
    samplesPerCell: assertInteger(inputOptions.samplesPerCell ?? 8, 'samplesPerCell', 4),
  });

  if (options.samplesPerCell % 2 !== 0) {
    throw new WeaveDraftError(
      'samplesPerCell must be even so every crossing center is represented exactly',
      'CROSSING_SAMPLE_ALIGNMENT',
    );
  }
  if (2 * options.warpRadiusM >= options.cellWidthM) {
    throw new WeaveDraftError('warp yarn diameter must be smaller than cellWidthM', 'WARP_SPACING_COLLISION');
  }
  if (2 * options.weftRadiusM >= options.cellHeightM) {
    throw new WeaveDraftError('weft yarn diameter must be smaller than cellHeightM', 'WEFT_SPACING_COLLISION');
  }

  const separationM = options.warpRadiusM + options.weftRadiusM + options.crossingClearanceM;
  const warp = Array.from({ length: draft.width }, (_, column) =>
    compileWarp(draft, column, options, separationM));
  const weft = Array.from({ length: draft.height }, (_, row) =>
    compileWeft(draft, row, options, separationM));

  return Object.freeze({
    schema: 'kaopu/weave_centerlines@0.1',
    units: 'meter',
    coordinateSystem: Object.freeze({ handedness: 'right', upAxis: 'z', warpAxis: 'y', weftAxis: 'x' }),
    draft,
    options,
    tileSizeM: Object.freeze([
      draft.width * options.cellWidthM,
      draft.height * options.cellHeightM,
    ]),
    separationM,
    curves: Object.freeze([...warp, ...weft]),
    curveCount: warp.length + weft.length,
    pointCount: warp.reduce((sum, curve) => sum + curve.pointCount, 0) +
      weft.reduce((sum, curve) => sum + curve.pointCount, 0),
    targetPatternStatus: 'SOURCE_ENTRY_REQUIRED',
    generatedFromOfficialFibricPattern: false,
  });
}

export function crossingSampleIndex(crossingIndex, samplesPerCell) {
  return crossingIndex * samplesPerCell + samplesPerCell / 2;
}

export function pointAt(curve, index) {
  if (!Number.isSafeInteger(index) || index < 0 || index >= curve.pointCount) {
    throw new WeaveDraftError('curve point index out of range', 'POINT_INDEX_OUT_OF_RANGE');
  }
  const offset = index * 3;
  return [curve.points[offset], curve.points[offset + 1], curve.points[offset + 2]];
}
