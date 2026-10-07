import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileWeaveDraft } from '../open-kernel/weave-draft-compiler.mjs';
import { makeHerringbone12x12Fixture } from '../open-kernel/herringbone-fixture.mjs';

function parseArgs(argv) {
  const result = { out: 'native-reference-input.json', repeatsX: 3, repeatsY: 3 };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out') result.out = argv[++i];
    else if (argv[i] === '--repeats-x') result.repeatsX = Number(argv[++i]);
    else if (argv[i] === '--repeats-y') result.repeatsY = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  for (const key of ['repeatsX', 'repeatsY']) {
    if (!Number.isSafeInteger(result[key]) || result[key] < 1 || result[key] > 8) {
      throw new Error(`${key} must be an integer from 1 to 8`);
    }
  }
  return result;
}

function repeatDraft(source, repeatsX, repeatsY) {
  const width = source.width * repeatsX;
  const height = source.height * repeatsY;
  const cells = new Uint8Array(width * height);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      cells[row * width + column] = source.cells[(row % source.height) * source.width + (column % source.width)];
    }
  }
  return {
    width,
    height,
    cells,
    sourceId: `${source.sourceId}_repeat_${repeatsX}x${repeatsY}`,
    authority: source.authority,
  };
}

function macroDrape(x, y, width, height) {
  const nx = x / width;
  const ny = y / height;
  return 0.0024 * Math.sin(Math.PI * nx) * Math.sin(Math.PI * ny) +
    0.0008 * Math.sin(2 * Math.PI * nx + 0.4) * Math.sin(Math.PI * ny);
}

function serialiseCurve(curve, width, height) {
  const points = new Array(curve.pointCount);
  const tangents = new Array(curve.pointCount);
  for (let i = 0; i < curve.pointCount; i += 1) {
    const offset = i * 3;
    const x = curve.points[offset];
    const y = curve.points[offset + 1];
    const z = curve.points[offset + 2] + macroDrape(x, y, width, height);
    points[i] = [x, y, z];
    tangents[i] = [curve.tangents[offset], curve.tangents[offset + 1], curve.tangents[offset + 2]];
  }
  return {
    id: curve.id,
    family: curve.family,
    index: curve.index,
    radiusM: curve.radiusM,
    points,
    tangents,
    crossingStates: Array.from(curve.crossingStates),
  };
}

const args = parseArgs(process.argv.slice(2));
const fixture = makeHerringbone12x12Fixture();
const draft = repeatDraft(fixture, args.repeatsX, args.repeatsY);
const compiled = compileWeaveDraft(draft, {
  cellWidthM: 0.0012,
  cellHeightM: 0.0011,
  warpRadiusM: 0.00018,
  weftRadiusM: 0.00020,
  crossingClearanceM: 0.00006,
  samplesPerCell: 8,
});
const [widthM, heightM] = compiled.tileSizeM;
const payload = {
  schema: 'kaopu/native_yarn_reference_input@0.1',
  units: 'meter',
  authority: 'algorithm_fixture_not_official_fibric_target',
  visualAcceptance: false,
  sourcePatternStatus: 'SOURCE_ENTRY_REQUIRED',
  tileSizeM: compiled.tileSizeM,
  centerlineSeparationM: compiled.separationM,
  curveCount: compiled.curveCount,
  pointCount: compiled.pointCount,
  renderRecipe: {
    plyCount: 3,
    plyRadiusM: 0.000055,
    plyOrbitRadiusM: 0.000095,
    twistPitchM: 0.0065,
    fuzzCount: 240,
    fuzzRadiusM: 0.000012,
    seed: 24071944,
  },
  curves: compiled.curves.map((curve) => serialiseCurve(curve, widthM, heightM)),
};
const target = path.resolve(args.out);
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `${JSON.stringify(payload)}\n`);
console.log(JSON.stringify({ out: target, curves: payload.curveCount, points: payload.pointCount, tileSizeM: payload.tileSizeM }));
