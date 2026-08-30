import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const HRLBONE_MAGIC = 'HRLBONE1';
export const HRLBONE_VERSION = Object.freeze({ major: 1, minor: 0 });
export const HRLBONE_FIXED_HEADER_BYTES = 128;
export const HRLBONE_CHUNK_RECORD_BYTES = 24;
export const HRLBONE_COORDINATE_CODE = 0x595a5801;

export const HRLBONE_CHUNK_TYPES = Object.freeze({
  primitiveGroups: 1,
  positions: 2,
  normals: 3,
  indices: 4,
  semanticGroupIds: 5,
  jointMarkers: 6,
  landmarks: 7,
});

const PRIMITIVE_CODES = Object.freeze({ TRIANGLES: 1, LINES: 2, POINTS: 3 });
const SIDE_CODES = Object.freeze({ center: 0, left: 1, right: 2 });

export function encodeHrlBone(input) {
  const normalized = normalizeGeometry(input);
  const chunks = createChunks(normalized);
  const chunkTableBytes = chunks.length * HRLBONE_CHUNK_RECORD_BYTES;
  const headerByteLength = align4(HRLBONE_FIXED_HEADER_BYTES + chunkTableBytes);
  let cursor = headerByteLength;
  for (const chunk of chunks) {
    chunk.byteOffset = cursor;
    cursor = align4(cursor + chunk.bytes.byteLength);
  }
  if (cursor > 0xffffffff) throw new Error('HRL Bone Binary V1 cannot exceed 4 GiB.');

  const output = new Uint8Array(cursor);
  const view = new DataView(output.buffer);
  writeAscii(output, 0, HRLBONE_MAGIC);
  view.setUint16(8, HRLBONE_VERSION.major, true);
  view.setUint16(10, HRLBONE_VERSION.minor, true);
  view.setUint32(12, 0, true);
  view.setUint32(16, headerByteLength, true);
  view.setUint32(20, chunks.length, true);
  view.setUint32(24, normalized.primitiveGroups.length, true);
  view.setUint32(28, normalized.positions.length / 3, true);
  view.setUint32(32, normalized.indices.length, true);
  view.setUint32(36, normalized.jointMarkers.length, true);
  view.setUint32(40, normalized.landmarks.length, true);
  view.setUint32(44, 0, true);
  normalized.aabb.minimum.forEach((value, index) => view.setFloat32(48 + index * 4, value, true));
  normalized.aabb.maximum.forEach((value, index) => view.setFloat32(60 + index * 4, value, true));
  view.setUint32(104, HRLBONE_FIXED_HEADER_BYTES, true);
  view.setUint32(108, HRLBONE_CHUNK_RECORD_BYTES, true);
  view.setUint32(112, output.byteLength, true);
  view.setUint32(116, HRLBONE_COORDINATE_CODE, true);
  view.setUint32(120, 0, true);
  view.setUint32(124, 0, true);

  chunks.forEach((chunk, index) => {
    const offset = HRLBONE_FIXED_HEADER_BYTES + index * HRLBONE_CHUNK_RECORD_BYTES;
    view.setUint32(offset, chunk.type, true);
    view.setUint32(offset + 4, chunk.componentType, true);
    view.setUint32(offset + 8, chunk.elementCount, true);
    view.setUint32(offset + 12, chunk.byteOffset, true);
    view.setUint32(offset + 16, chunk.bytes.byteLength, true);
    view.setUint32(offset + 20, chunk.stride, true);
    output.set(chunk.bytes, chunk.byteOffset);
  });

  const contentChecksum = sha256Hex(output.subarray(HRLBONE_FIXED_HEADER_BYTES));
  output.set(Buffer.from(contentChecksum, 'hex'), 72);
  const sha256 = sha256Hex(output);
  return {
    bytes: output,
    sha256,
    contentChecksum,
    byteLength: output.byteLength,
    headerByteLength,
    chunks: chunks.map(({ bytes, ...chunk }) => ({ ...chunk, byteLength: bytes.byteLength })),
    aabb: normalized.aabb,
  };
}

export async function writeHrlBoneFile(filePath, input) {
  const encoded = encodeHrlBone(input);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, encoded.bytes);
  return encoded;
}

function normalizeGeometry(input = {}) {
  const positions = Float32Array.from(input.positions ?? []);
  const normals = Float32Array.from(input.normals ?? []);
  const indices = Uint32Array.from(input.indices ?? []);
  const semanticGroupIds = Uint32Array.from(input.semanticGroupIds ?? []);
  if (positions.length === 0 || positions.length % 3 !== 0) throw new Error('positions must contain Float32 xyz triples.');
  if (normals.length !== positions.length) throw new Error('normals must match positions.');
  if (semanticGroupIds.length !== positions.length / 3) throw new Error('semanticGroupIds must contain one value per vertex.');
  if ([...indices].some((index) => index >= positions.length / 3)) throw new Error('index is outside the vertex range.');
  const primitiveGroups = (input.primitiveGroups ?? []).map((group, ordinal) => {
    if (!(group.primitive in PRIMITIVE_CODES)) throw new Error(`Unsupported primitive ${group.primitive}.`);
    const indexOffset = toUint32(group.indexOffset);
    const indexCount = toUint32(group.indexCount);
    if (indexOffset + indexCount > indices.length) throw new Error(`Primitive group ${group.groupId ?? ordinal} exceeds the index buffer.`);
    return {
      ...structuredClone(group),
      groupId: String(group.groupId ?? `group-${ordinal}`),
      semanticGroupId: toUint32(group.semanticGroupId),
      lod: group.lod == null ? null : Math.min(2, toUint32(group.lod)),
      side: group.side in SIDE_CODES ? group.side : 'center',
      ordinal,
    };
  });
  if (!primitiveGroups.length) throw new Error('At least one primitive group is required.');
  const jointMarkers = normalizeMarkers(input.jointMarkers);
  const landmarks = normalizeMarkers(input.landmarks);
  return {
    positions, normals, indices, semanticGroupIds, primitiveGroups, jointMarkers, landmarks,
    aabb: computeAabb(positions),
  };
}

function createChunks(value) {
  return [
    chunk(HRLBONE_CHUNK_TYPES.primitiveGroups, 3, value.primitiveGroups.length, 32, encodePrimitiveGroups(value.primitiveGroups)),
    chunk(HRLBONE_CHUNK_TYPES.positions, 1, value.positions.length / 3, 12, encodeFloat32(value.positions)),
    chunk(HRLBONE_CHUNK_TYPES.normals, 1, value.normals.length / 3, 12, encodeFloat32(value.normals)),
    chunk(HRLBONE_CHUNK_TYPES.indices, 2, value.indices.length, 4, encodeUint32(value.indices)),
    chunk(HRLBONE_CHUNK_TYPES.semanticGroupIds, 2, value.semanticGroupIds.length, 4, encodeUint32(value.semanticGroupIds)),
    chunk(HRLBONE_CHUNK_TYPES.jointMarkers, 3, value.jointMarkers.length, 16, encodeMarkers(value.jointMarkers)),
    chunk(HRLBONE_CHUNK_TYPES.landmarks, 3, value.landmarks.length, 16, encodeMarkers(value.landmarks)),
  ];
}

function chunk(type, componentType, elementCount, stride, bytes) {
  return { type, componentType, elementCount, stride, bytes, byteOffset: 0 };
}

function encodePrimitiveGroups(groups) {
  const bytes = new Uint8Array(groups.length * 32);
  const view = new DataView(bytes.buffer);
  groups.forEach((group, index) => {
    const offset = index * 32;
    view.setUint32(offset, PRIMITIVE_CODES[group.primitive], true);
    view.setUint32(offset + 4, group.indexOffset, true);
    view.setUint32(offset + 8, group.indexCount, true);
    view.setUint32(offset + 12, group.semanticGroupId, true);
    view.setUint32(offset + 16, group.lod == null ? 0 : group.lod + 1, true);
    view.setUint32(offset + 20, SIDE_CODES[group.side], true);
    view.setUint32(offset + 24, group.ordinal, true);
    view.setUint32(offset + 28, 0, true);
  });
  return bytes;
}

function encodeFloat32(values) {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setFloat32(index * 4, value, true));
  return bytes;
}

function encodeUint32(values) {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setUint32(index * 4, value, true));
  return bytes;
}

function encodeMarkers(markers) {
  const bytes = new Uint8Array(markers.length * 16);
  const view = new DataView(bytes.buffer);
  markers.forEach((marker, index) => {
    const offset = index * 16;
    view.setUint32(offset, marker.semanticGroupId, true);
    marker.position.forEach((value, component) => view.setFloat32(offset + 4 + component * 4, value, true));
  });
  return bytes;
}

function normalizeMarkers(markers = []) {
  return markers.map((marker) => ({
    semanticGroupId: toUint32(marker.semanticGroupId),
    position: [0, 1, 2].map((index) => toFinite(marker.position?.[index])),
  }));
}

function computeAabb(positions) {
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < positions.length; index += 3) {
    for (let component = 0; component < 3; component += 1) {
      minimum[component] = Math.min(minimum[component], positions[index + component]);
      maximum[component] = Math.max(maximum[component], positions[index + component]);
    }
  }
  return { minimum: minimum.map(Math.fround), maximum: maximum.map(Math.fround) };
}

function sha256Hex(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function align4(value) { return (value + 3) & ~3; }
function toFinite(value) { const number = Number(value); if (!Number.isFinite(number)) throw new Error('Geometry contains a non-finite value.'); return Math.fround(number); }
function toUint32(value) { const number = Number(value); if (!Number.isInteger(number) || number < 0 || number > 0xffffffff) throw new Error(`Expected uint32, received ${value}.`); return number; }
function writeAscii(target, offset, value) { for (let index = 0; index < value.length; index += 1) target[offset + index] = value.charCodeAt(index); }
