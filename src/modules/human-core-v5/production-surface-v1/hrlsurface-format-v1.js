export const HRL_SURFACE_V1_SCHEMA = 'humanoid_rig/hrlsurface@1.0';
export const HRL_SURFACE_V1_MAGIC = 'HRLSURF1';

const FIXED_HEADER_BYTES = 16;
const TYPE_INFO = Object.freeze({
  float32: { constructor: Float32Array, bytes: 4 },
  float64: { constructor: Float64Array, bytes: 8 },
  uint8: { constructor: Uint8Array, bytes: 1 },
  uint16: { constructor: Uint16Array, bytes: 2 },
  uint32: { constructor: Uint32Array, bytes: 4 },
  int32: { constructor: Int32Array, bytes: 4 },
});

export function encodeHrlSurfaceV1({ header, chunks }) {
  if (!header || typeof header !== 'object') throw new Error('HRLSurface header is required.');
  if (!chunks || typeof chunks !== 'object') throw new Error('HRLSurface chunks are required.');

  const descriptors = {};
  let dataByteLength = 0;
  const entries = [];
  for (const [name, input] of Object.entries(chunks)) {
    const array = normalizeTypedArray(input);
    const type = typeNameFor(array);
    dataByteLength = align(dataByteLength, Math.min(array.BYTES_PER_ELEMENT, 8));
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    descriptors[name] = {
      type,
      count: array.length,
      byteOffset: dataByteLength,
      byteLength: bytes.byteLength,
    };
    entries.push({ name, bytes, byteOffset: dataByteLength });
    dataByteLength += bytes.byteLength;
  }

  const normalizedHeader = {
    ...structuredClone(header),
    schema: HRL_SURFACE_V1_SCHEMA,
    format: {
      magic: HRL_SURFACE_V1_MAGIC,
      majorVersion: 1,
      littleEndian: true,
      chunkOffsetsRelativeToDataSection: true,
    },
    chunks: descriptors,
  };
  const jsonBytes = new TextEncoder().encode(JSON.stringify(normalizedHeader));
  const dataOffset = align(FIXED_HEADER_BYTES + jsonBytes.byteLength, 16);
  const output = new Uint8Array(dataOffset + dataByteLength);
  output.set(new TextEncoder().encode(HRL_SURFACE_V1_MAGIC), 0);
  const view = new DataView(output.buffer);
  view.setUint32(8, jsonBytes.byteLength, true);
  view.setUint32(12, dataOffset, true);
  output.set(jsonBytes, FIXED_HEADER_BYTES);
  for (const entry of entries) output.set(entry.bytes, dataOffset + entry.byteOffset);
  return output;
}

export function parseHrlSurfaceV1(input) {
  const bytes = toUint8Array(input);
  if (bytes.byteLength < FIXED_HEADER_BYTES) throw new Error('HRLSurface container is truncated.');
  const magic = new TextDecoder().decode(bytes.subarray(0, 8));
  if (magic !== HRL_SURFACE_V1_MAGIC) throw new Error(`Unexpected HRLSurface magic: ${magic}`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const jsonByteLength = view.getUint32(8, true);
  const dataOffset = view.getUint32(12, true);
  if (FIXED_HEADER_BYTES + jsonByteLength > dataOffset || dataOffset > bytes.byteLength) {
    throw new Error('HRLSurface header bounds are invalid.');
  }
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(FIXED_HEADER_BYTES, FIXED_HEADER_BYTES + jsonByteLength)));
  if (header.schema !== HRL_SURFACE_V1_SCHEMA || header.format?.majorVersion !== 1) {
    throw new Error(`Unsupported HRLSurface schema: ${header.schema ?? 'missing'}`);
  }

  const chunks = {};
  for (const [name, descriptor] of Object.entries(header.chunks ?? {})) {
    const info = TYPE_INFO[descriptor.type];
    if (!info) throw new Error(`Unsupported HRLSurface chunk type ${descriptor.type}.`);
    if (descriptor.byteLength !== descriptor.count * info.bytes) throw new Error(`Chunk ${name} has inconsistent size metadata.`);
    const start = dataOffset + descriptor.byteOffset;
    const end = start + descriptor.byteLength;
    if (start < dataOffset || end > bytes.byteLength) throw new Error(`Chunk ${name} exceeds the container.`);
    const copied = bytes.slice(start, end);
    chunks[name] = new info.constructor(copied.buffer, copied.byteOffset, descriptor.count);
  }
  return { schema: HRL_SURFACE_V1_SCHEMA, header, chunks, bytes, byteLength: bytes.byteLength, dataOffset };
}

export async function loadHrlSurfaceV1(url, { fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('HRLSurface loading requires fetch().');
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`HRLSurface request failed: ${response.status} ${url}`);
  return parseHrlSurfaceV1(await response.arrayBuffer());
}

function normalizeTypedArray(value) {
  if (!ArrayBuffer.isView(value) || value instanceof DataView) throw new Error('HRLSurface chunks must be typed arrays.');
  return value;
}

function typeNameFor(array) {
  for (const [name, info] of Object.entries(TYPE_INFO)) if (array instanceof info.constructor) return name;
  throw new Error(`Unsupported HRLSurface typed array ${array.constructor?.name ?? 'unknown'}.`);
}

function align(value, alignment) {
  return Math.ceil(value / alignment) * alignment;
}

function toUint8Array(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  throw new Error('Expected an ArrayBuffer or typed array.');
}
