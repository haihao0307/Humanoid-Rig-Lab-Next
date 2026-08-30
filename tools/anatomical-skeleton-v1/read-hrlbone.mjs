import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  HRLBONE_CHUNK_RECORD_BYTES,
  HRLBONE_CHUNK_TYPES,
  HRLBONE_COORDINATE_CODE,
  HRLBONE_FIXED_HEADER_BYTES,
  HRLBONE_MAGIC,
  HRLBONE_VERSION,
} from './write-hrlbone.mjs';

const PRIMITIVES = Object.freeze({ 1: 'TRIANGLES', 2: 'LINES', 3: 'POINTS' });
const SIDES = Object.freeze({ 0: 'center', 1: 'left', 2: 'right' });

export async function readHrlBoneFile(filePath, options) {
  return parseHrlBone(await readFile(filePath), options);
}

export function parseHrlBone(source, { verifyChecksum = true } = {}) {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
  if (bytes.byteLength < HRLBONE_FIXED_HEADER_BYTES) throw new Error('HRL Bone file is shorter than its fixed header.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = readAscii(bytes, 0, 8);
  if (magic !== HRLBONE_MAGIC) throw new Error(`Invalid HRL Bone magic ${magic}.`);
  const major = view.getUint16(8, true);
  const minor = view.getUint16(10, true);
  if (major !== HRLBONE_VERSION.major || minor !== HRLBONE_VERSION.minor) throw new Error(`Unsupported HRL Bone version ${major}.${minor}.`);
  const headerByteLength = view.getUint32(16, true);
  const chunkCount = view.getUint32(20, true);
  const primitiveGroupCount = view.getUint32(24, true);
  const vertexCount = view.getUint32(28, true);
  const indexCount = view.getUint32(32, true);
  const jointMarkerCount = view.getUint32(36, true);
  const landmarkCount = view.getUint32(40, true);
  const aabb = {
    minimum: [0, 1, 2].map((index) => view.getFloat32(48 + index * 4, true)),
    maximum: [0, 1, 2].map((index) => view.getFloat32(60 + index * 4, true)),
  };
  const contentChecksum = Buffer.from(bytes.subarray(72, 104)).toString('hex');
  const chunkTableOffset = view.getUint32(104, true);
  const chunkRecordBytes = view.getUint32(108, true);
  const fileByteLength = view.getUint32(112, true);
  const coordinateCode = view.getUint32(116, true);
  if (chunkTableOffset !== HRLBONE_FIXED_HEADER_BYTES || chunkRecordBytes !== HRLBONE_CHUNK_RECORD_BYTES) throw new Error('Invalid HRL Bone chunk-table contract.');
  if (fileByteLength !== bytes.byteLength) throw new Error('HRL Bone file length does not match its header.');
  if (coordinateCode !== HRLBONE_COORDINATE_CODE) throw new Error('HRL Bone coordinate-system code is invalid.');
  if (headerByteLength < chunkTableOffset + chunkCount * chunkRecordBytes || headerByteLength > bytes.byteLength) throw new Error('HRL Bone header length is invalid.');
  const computedContentChecksum = createHash('sha256').update(bytes.subarray(HRLBONE_FIXED_HEADER_BYTES)).digest('hex');
  if (verifyChecksum && computedContentChecksum !== contentChecksum) throw new Error('HRL Bone content checksum mismatch.');

  const chunks = [];
  const chunksByType = new Map();
  for (let index = 0; index < chunkCount; index += 1) {
    const offset = chunkTableOffset + index * chunkRecordBytes;
    const chunk = {
      type: view.getUint32(offset, true), componentType: view.getUint32(offset + 4, true),
      elementCount: view.getUint32(offset + 8, true), byteOffset: view.getUint32(offset + 12, true),
      byteLength: view.getUint32(offset + 16, true), stride: view.getUint32(offset + 20, true),
    };
    if (chunk.byteOffset < headerByteLength || chunk.byteOffset + chunk.byteLength > bytes.byteLength) throw new Error(`HRL Bone chunk ${index} exceeds file bounds.`);
    if (chunksByType.has(chunk.type)) throw new Error(`Duplicate HRL Bone chunk type ${chunk.type}.`);
    chunks.push(chunk);
    chunksByType.set(chunk.type, chunk);
  }
  for (const type of Object.values(HRLBONE_CHUNK_TYPES)) if (!chunksByType.has(type)) throw new Error(`Missing HRL Bone chunk type ${type}.`);

  const positions = decodeFloat32(bytes, chunksByType.get(HRLBONE_CHUNK_TYPES.positions));
  const normals = decodeFloat32(bytes, chunksByType.get(HRLBONE_CHUNK_TYPES.normals));
  const indices = decodeUint32(bytes, chunksByType.get(HRLBONE_CHUNK_TYPES.indices));
  const semanticGroupIds = decodeUint32(bytes, chunksByType.get(HRLBONE_CHUNK_TYPES.semanticGroupIds));
  const primitiveGroups = decodePrimitiveGroups(bytes, chunksByType.get(HRLBONE_CHUNK_TYPES.primitiveGroups));
  const jointMarkers = decodeMarkers(bytes, chunksByType.get(HRLBONE_CHUNK_TYPES.jointMarkers));
  const landmarks = decodeMarkers(bytes, chunksByType.get(HRLBONE_CHUNK_TYPES.landmarks));
  if (positions.length !== vertexCount * 3 || normals.length !== positions.length || semanticGroupIds.length !== vertexCount) throw new Error('HRL Bone vertex chunk counts are inconsistent.');
  if (indices.length !== indexCount || primitiveGroups.length !== primitiveGroupCount || jointMarkers.length !== jointMarkerCount || landmarks.length !== landmarkCount) throw new Error('HRL Bone header counts are inconsistent.');
  return {
    header: { magic, major, minor, headerByteLength, chunkCount, primitiveGroupCount, vertexCount, indexCount, jointMarkerCount, landmarkCount, aabb, contentChecksum, computedContentChecksum, fileByteLength },
    chunks, primitiveGroups, positions, normals, indices, semanticGroupIds, jointMarkers, landmarks,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

function decodeFloat32(bytes, chunk) {
  if (chunk.byteLength % 4 !== 0) throw new Error('Float32 chunk is misaligned.');
  const view = new DataView(bytes.buffer, bytes.byteOffset + chunk.byteOffset, chunk.byteLength);
  return Float32Array.from({ length: chunk.byteLength / 4 }, (_, index) => view.getFloat32(index * 4, true));
}

function decodeUint32(bytes, chunk) {
  if (chunk.byteLength % 4 !== 0) throw new Error('Uint32 chunk is misaligned.');
  const view = new DataView(bytes.buffer, bytes.byteOffset + chunk.byteOffset, chunk.byteLength);
  return Uint32Array.from({ length: chunk.byteLength / 4 }, (_, index) => view.getUint32(index * 4, true));
}

function decodePrimitiveGroups(bytes, chunk) {
  if (chunk.stride !== 32 || chunk.byteLength !== chunk.elementCount * chunk.stride) throw new Error('Primitive-group chunk layout is invalid.');
  const view = new DataView(bytes.buffer, bytes.byteOffset + chunk.byteOffset, chunk.byteLength);
  return Array.from({ length: chunk.elementCount }, (_, index) => {
    const offset = index * chunk.stride;
    const primitive = PRIMITIVES[view.getUint32(offset, true)];
    const side = SIDES[view.getUint32(offset + 20, true)];
    if (!primitive || !side) throw new Error('Primitive group contains an unknown enum.');
    const encodedLod = view.getUint32(offset + 16, true);
    return {
      primitive, indexOffset: view.getUint32(offset + 4, true), indexCount: view.getUint32(offset + 8, true),
      semanticGroupId: view.getUint32(offset + 12, true), lod: encodedLod === 0 ? null : encodedLod - 1,
      side, ordinal: view.getUint32(offset + 24, true),
    };
  });
}

function decodeMarkers(bytes, chunk) {
  if (chunk.stride !== 16 || chunk.byteLength !== chunk.elementCount * chunk.stride) throw new Error('Marker chunk layout is invalid.');
  const view = new DataView(bytes.buffer, bytes.byteOffset + chunk.byteOffset, chunk.byteLength);
  return Array.from({ length: chunk.elementCount }, (_, index) => {
    const offset = index * chunk.stride;
    return { semanticGroupId: view.getUint32(offset, true), position: [0, 1, 2].map((component) => view.getFloat32(offset + 4 + component * 4, true)) };
  });
}

function readAscii(bytes, offset, length) { return String.fromCharCode(...bytes.subarray(offset, offset + length)); }
