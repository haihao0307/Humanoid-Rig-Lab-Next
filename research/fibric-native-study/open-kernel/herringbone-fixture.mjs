// Algorithm-test fixture only. This is NOT the missing official Fibric
// herringbone_12x12.exr and must never be promoted as the visual target.

function mod(value, period) {
  return ((value % period) + period) % period;
}

export function makeHerringbone12x12Fixture() {
  const width = 12;
  const height = 12;
  const cells = new Uint8Array(width * height);
  // A deterministic 2/2 twill whose phase reverses every four ends.
  // It exercises long floats, reversals and periodic seams in the compiler.
  const phase = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1];
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      cells[row * width + column] = mod(row - phase[column], 4) < 2 ? 1 : 0;
    }
  }
  return {
    width,
    height,
    cells,
    sourceId: 'canonical_herringbone_12x12_algorithm_fixture_v1',
    authority: 'algorithm_test_only_not_official_target',
  };
}
