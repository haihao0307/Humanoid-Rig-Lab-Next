export const COMPUTATIONAL_HUMAN_FIELD_SCHEMA_V1 = 'humanoid_rig/computational_human_field@1.0';
export const FIELD_BINARY_MAGIC_V1 = 'HRLCF01\0';
export const FIELD_BRICK_MAGIC_V1 = 'HRLBRK1\0';
export const FIELD_REGION_MAGIC_V1 = 'HRLREG1\0';

const HEADER_BYTES = 16;

export function encodeFieldBinaryV1(magic, header, payload) {
  if (typeof magic !== 'string' || new TextEncoder().encode(magic).byteLength !== 8) {
    throw new Error('Field binary magic must occupy exactly eight UTF-8 bytes.');
  }
  const source = toUint8Array(payload);
  const normalizedHeader = { ...structuredClone(header), littleEndian: true, payloadBytes: source.byteLength };
  const json = new TextEncoder().encode(JSON.stringify(normalizedHeader));
  const payloadOffset = align(HEADER_BYTES + json.byteLength, 16);
  const output = new Uint8Array(payloadOffset + source.byteLength);
  output.set(new TextEncoder().encode(magic), 0);
  const view = new DataView(output.buffer);
  view.setUint32(8, json.byteLength, true);
  view.setUint32(12, payloadOffset, true);
  output.set(json, HEADER_BYTES);
  output.set(source, payloadOffset);
  return output;
}

export function parseFieldBinaryV1(input, expectedMagic) {
  const bytes = toUint8Array(input);
  if (bytes.byteLength < HEADER_BYTES) throw new Error('Field binary is truncated.');
  const magic = new TextDecoder().decode(bytes.subarray(0, 8));
  if (expectedMagic && magic !== expectedMagic) throw new Error(`Unexpected field binary magic ${magic}.`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const jsonBytes = view.getUint32(8, true);
  const payloadOffset = view.getUint32(12, true);
  if (HEADER_BYTES + jsonBytes > payloadOffset || payloadOffset > bytes.byteLength) throw new Error('Field binary header bounds are invalid.');
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(HEADER_BYTES, HEADER_BYTES + jsonBytes)));
  const payload = bytes.slice(payloadOffset);
  if (header.payloadBytes !== payload.byteLength) throw new Error('Field binary payload size does not match its header.');
  return { magic, header, payload, bytes, payloadOffset };
}

export function reconstructDenseFieldV1({ metadata, coarsePayload, brickPayload, regionPayload = null }) {
  const dimensions = metadata.grid.dimensions;
  const coarseDimensions = metadata.globalCoarseField.dimensions;
  const coarse = int16View(coarsePayload);
  const brickValues = int16View(brickPayload);
  const regions = regionPayload ? toUint8Array(regionPayload) : null;
  const voxelCount = dimensions[0] * dimensions[1] * dimensions[2];
  const dense = new Float32Array(voxelCount);
  const denseRegions = new Uint8Array(voxelCount);
  denseRegions.fill(metadata.regionAtlas.noneRegionId ?? 255);
  const scale = metadata.quantization.metersPerUnit;

  for (let z = 0; z < dimensions[2]; z += 1) {
    const wz = z / Math.max(1, dimensions[2] - 1);
    for (let y = 0; y < dimensions[1]; y += 1) {
      const wy = y / Math.max(1, dimensions[1] - 1);
      for (let x = 0; x < dimensions[0]; x += 1) {
        const wx = x / Math.max(1, dimensions[0] - 1);
        dense[index3(x, y, z, dimensions)] = sampleQuantizedGrid(coarse, coarseDimensions, wx, wy, wz, scale);
      }
    }
  }

  const brickSize = metadata.sparseSurfaceBricks.brickSize;
  const valuesPerBrick = brickSize ** 3;
  metadata.sparseSurfaceBricks.bricks.forEach((brick, brickIndex) => {
    const base = brickIndex * valuesPerBrick;
    for (let lz = 0; lz < brickSize; lz += 1) for (let ly = 0; ly < brickSize; ly += 1) for (let lx = 0; lx < brickSize; lx += 1) {
      const x = brick.coord[0] * brickSize + lx;
      const y = brick.coord[1] * brickSize + ly;
      const z = brick.coord[2] * brickSize + lz;
      const local = lx + brickSize * (ly + brickSize * lz);
      const target = index3(x, y, z, dimensions);
      dense[target] = brickValues[base + local] * scale;
      if (regions) denseRegions[target] = regions[base + local];
    }
  });
  return { values: dense, regions: denseRegions, dimensions, bounds: metadata.grid.bounds };
}

export function sampleDenseFieldV1(field, point) {
  const { values, dimensions, bounds } = field;
  const nx = normalizedCoordinate(point[0], bounds.min[0], bounds.max[0]);
  const ny = normalizedCoordinate(point[1], bounds.min[1], bounds.max[1]);
  const nz = normalizedCoordinate(point[2], bounds.min[2], bounds.max[2]);
  if (nx.outside || ny.outside || nz.outside) {
    const dx = axisOutsideDistance(point[0], bounds.min[0], bounds.max[0]);
    const dy = axisOutsideDistance(point[1], bounds.min[1], bounds.max[1]);
    const dz = axisOutsideDistance(point[2], bounds.min[2], bounds.max[2]);
    const clamped = [clamp(point[0], bounds.min[0], bounds.max[0]), clamp(point[1], bounds.min[1], bounds.max[1]), clamp(point[2], bounds.min[2], bounds.max[2])];
    return sampleDenseFieldV1(field, clamped) + Math.hypot(dx, dy, dz);
  }
  return sampleFloatGrid(values, dimensions, nx.value, ny.value, nz.value);
}

export function sampleDenseRegionV1(field, point) {
  if (!field.regions) return 255;
  const { dimensions, bounds, regions } = field;
  const x = Math.round(clamp01((point[0] - bounds.min[0]) / (bounds.max[0] - bounds.min[0])) * (dimensions[0] - 1));
  const y = Math.round(clamp01((point[1] - bounds.min[1]) / (bounds.max[1] - bounds.min[1])) * (dimensions[1] - 1));
  const z = Math.round(clamp01((point[2] - bounds.min[2]) / (bounds.max[2] - bounds.min[2])) * (dimensions[2] - 1));
  return regions[index3(x, y, z, dimensions)];
}

export function gradientDenseFieldV1(field, point, epsilon = null) {
  const bounds = field.bounds;
  const dimensions = field.dimensions;
  const h = epsilon ?? Math.min(
    (bounds.max[0] - bounds.min[0]) / (dimensions[0] - 1),
    (bounds.max[1] - bounds.min[1]) / (dimensions[1] - 1),
    (bounds.max[2] - bounds.min[2]) / (dimensions[2] - 1),
  ) * 0.75;
  const x0 = sampleDenseFieldV1(field, [point[0] - h, point[1], point[2]]);
  const x1 = sampleDenseFieldV1(field, [point[0] + h, point[1], point[2]]);
  const y0 = sampleDenseFieldV1(field, [point[0], point[1] - h, point[2]]);
  const y1 = sampleDenseFieldV1(field, [point[0], point[1] + h, point[2]]);
  const z0 = sampleDenseFieldV1(field, [point[0], point[1], point[2] - h]);
  const z1 = sampleDenseFieldV1(field, [point[0], point[1], point[2] + h]);
  return [(x1 - x0) / (2 * h), (y1 - y0) / (2 * h), (z1 - z0) / (2 * h)];
}

function sampleQuantizedGrid(values, dimensions, nx, ny, nz, scale) {
  return sampleFloatGrid(values, dimensions, nx, ny, nz) * scale;
}

function sampleFloatGrid(values, dimensions, nx, ny, nz) {
  const fx = clamp01(nx) * (dimensions[0] - 1);
  const fy = clamp01(ny) * (dimensions[1] - 1);
  const fz = clamp01(nz) * (dimensions[2] - 1);
  const x0 = Math.floor(fx); const y0 = Math.floor(fy); const z0 = Math.floor(fz);
  const x1 = Math.min(x0 + 1, dimensions[0] - 1); const y1 = Math.min(y0 + 1, dimensions[1] - 1); const z1 = Math.min(z0 + 1, dimensions[2] - 1);
  const tx = fx - x0; const ty = fy - y0; const tz = fz - z0;
  const c000 = values[index3(x0, y0, z0, dimensions)]; const c100 = values[index3(x1, y0, z0, dimensions)];
  const c010 = values[index3(x0, y1, z0, dimensions)]; const c110 = values[index3(x1, y1, z0, dimensions)];
  const c001 = values[index3(x0, y0, z1, dimensions)]; const c101 = values[index3(x1, y0, z1, dimensions)];
  const c011 = values[index3(x0, y1, z1, dimensions)]; const c111 = values[index3(x1, y1, z1, dimensions)];
  const c00 = mix(c000, c100, tx); const c10 = mix(c010, c110, tx); const c01 = mix(c001, c101, tx); const c11 = mix(c011, c111, tx);
  return mix(mix(c00, c10, ty), mix(c01, c11, ty), tz);
}

function int16View(payload) {
  const bytes = toUint8Array(payload);
  if (bytes.byteLength % 2 !== 0) throw new Error('Int16 field payload has an odd byte count.');
  const copy = bytes.slice();
  return new Int16Array(copy.buffer, copy.byteOffset, copy.byteLength / 2);
}

function normalizedCoordinate(value, minimum, maximum) {
  return { value: (value - minimum) / (maximum - minimum), outside: value < minimum || value > maximum };
}

function axisOutsideDistance(value, minimum, maximum) { return value < minimum ? minimum - value : value > maximum ? value - maximum : 0; }
function toUint8Array(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  throw new Error('Expected an ArrayBuffer or typed array.');
}
function index3(x, y, z, d) { return x + d[0] * (y + d[1] * z); }
function align(value, alignment) { return Math.ceil(value / alignment) * alignment; }
function mix(a, b, t) { return a + (b - a) * t; }
function clamp01(value) { return Math.max(0, Math.min(1, value)); }
function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
