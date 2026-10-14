/** CPU oracle for KAOPU's newly authored integer seed field. Not a security RNG. */
const buffer = new ArrayBuffer(4);
const bits = new DataView(buffer);
function word(value) {
  if (!Number.isFinite(value)) throw new TypeError('Seed-field inputs must be finite');
  bits.setFloat32(0, value + 0, true);
  const rounded = bits.getFloat32(0, true);
  if (!Number.isFinite(rounded)) throw new RangeError('Seed-field inputs must fit Float32');
  return bits.getUint32(0, true);
}
const rotate = (value, amount) => ((value << amount) | (value >>> (32 - amount))) >>> 0;
export function seedWord(x, y, seed) {
  let left = (word(x) ^ 0x4b414f50) >>> 0;
  let right = (word(y) ^ word(seed) ^ 0x554c4541) >>> 0;
  for (let round = 0; round < 4; round++) {
    left = (left + rotate(right, 5) + 2039 * (round + 1)) >>> 0;
    right = (right ^ rotate(left, 17)) >>> 0;
    left = Math.imul(left, 12289) >>> 0;
    right = (right + rotate(left, 11) + 4093) >>> 0;
    const nextLeft = right;
    right = (left ^ rotate(right, 23)) >>> 0;
    left = nextLeft;
  }
  return (left ^ rotate(right, 13)) >>> 0;
}
export const seedSample = (x, y, seed) => (seedWord(x, y, seed) >>> 8) / 16777216;
