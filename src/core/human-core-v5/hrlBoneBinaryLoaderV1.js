/**
 * Read-only browser/runtime adapter for HRL Bone Binary Geometry V1.
 * It returns numeric buffers and never creates a Rig, SkinnedMesh, bone scale,
 * HumanRigCore write, or finalPose write.
 */
export const HRL_BONE_BINARY_LOADER_V1_SCHEMA = 'humanoid_rig/hrl_bone_binary_loader@1.0';
export const HRL_BONE_BINARY_MAGIC_V1 = 'HRLBONE1';

const FIXED_HEADER_BYTES = 128;
const CHUNK_RECORD_BYTES = 24;
const COORDINATE_CODE = 0x595a5801;
const CHUNK = Object.freeze({ primitiveGroups: 1, positions: 2, normals: 3, indices: 4, semanticGroupIds: 5, jointMarkers: 6, landmarks: 7 });
const PRIMITIVES = Object.freeze({ 1: 'TRIANGLES', 2: 'LINES', 3: 'POINTS' });
const SIDES = Object.freeze({ 0: 'center', 1: 'left', 2: 'right' });

export class HrlBoneBinaryLoaderV1 {
  constructor({ fetchImpl = globalThis.fetch } = {}) {
    if (typeof fetchImpl !== 'function') throw new Error('HrlBoneBinaryLoaderV1 requires fetch.');
    this.fetchImpl = fetchImpl;
  }

  async load(url, { verifyChecksum = true } = {}) {
    const response = await this.fetchImpl(url);
    if (!response.ok) throw new Error(`Failed to load HRL Bone binary ${url}: HTTP ${response.status}.`);
    return parseHrlBoneBinaryV1(await response.arrayBuffer(), { verifyChecksum });
  }
}

export async function parseHrlBoneBinaryV1(source, { verifyChecksum = true } = {}) {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
  if (bytes.byteLength < FIXED_HEADER_BYTES) throw new Error('HRL Bone binary is shorter than 128 bytes.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = String.fromCharCode(...bytes.subarray(0, 8));
  if (magic !== HRL_BONE_BINARY_MAGIC_V1) throw new Error(`Invalid HRL Bone magic ${magic}.`);
  const major = view.getUint16(8, true);
  const minor = view.getUint16(10, true);
  if (major !== 1 || minor !== 0) throw new Error(`Unsupported HRL Bone version ${major}.${minor}.`);
  const headerByteLength = view.getUint32(16, true);
  const chunkCount = view.getUint32(20, true);
  const counts = {
    primitiveGroups: view.getUint32(24, true), vertices: view.getUint32(28, true), indices: view.getUint32(32, true),
    jointMarkers: view.getUint32(36, true), landmarks: view.getUint32(40, true),
  };
  const aabb = {
    minimum: [0, 1, 2].map((index) => view.getFloat32(48 + index * 4, true)),
    maximum: [0, 1, 2].map((index) => view.getFloat32(60 + index * 4, true)),
  };
  const contentChecksum = toHex(bytes.subarray(72, 104));
  const chunkTableOffset = view.getUint32(104, true);
  const chunkRecordBytes = view.getUint32(108, true);
  const fileByteLength = view.getUint32(112, true);
  if (chunkTableOffset !== FIXED_HEADER_BYTES || chunkRecordBytes !== CHUNK_RECORD_BYTES || fileByteLength !== bytes.byteLength || view.getUint32(116, true) !== COORDINATE_CODE) {
    throw new Error('HRL Bone fixed-header contract is invalid.');
  }
  if (headerByteLength < chunkTableOffset + chunkCount * chunkRecordBytes || headerByteLength > bytes.byteLength) throw new Error('HRL Bone header length is invalid.');
  const computedContentChecksum = await sha256(bytes.subarray(FIXED_HEADER_BYTES));
  if (verifyChecksum && computedContentChecksum !== contentChecksum) throw new Error('HRL Bone content checksum mismatch.');

  const chunks = [];
  const byType = new Map();
  for (let index = 0; index < chunkCount; index += 1) {
    const offset = chunkTableOffset + index * chunkRecordBytes;
    const record = {
      type: view.getUint32(offset, true), componentType: view.getUint32(offset + 4, true), elementCount: view.getUint32(offset + 8, true),
      byteOffset: view.getUint32(offset + 12, true), byteLength: view.getUint32(offset + 16, true), stride: view.getUint32(offset + 20, true),
    };
    if (record.byteOffset < headerByteLength || record.byteOffset + record.byteLength > bytes.byteLength || byType.has(record.type)) throw new Error(`Invalid HRL Bone chunk ${index}.`);
    chunks.push(record);
    byType.set(record.type, record);
  }
  for (const type of Object.values(CHUNK)) if (!byType.has(type)) throw new Error(`Missing HRL Bone chunk ${type}.`);

  const positions = decodeFloat32(bytes, byType.get(CHUNK.positions));
  const normals = decodeFloat32(bytes, byType.get(CHUNK.normals));
  const indices = decodeUint32(bytes, byType.get(CHUNK.indices));
  const semanticGroupIds = decodeUint32(bytes, byType.get(CHUNK.semanticGroupIds));
  const primitiveGroups = decodePrimitiveGroups(bytes, byType.get(CHUNK.primitiveGroups));
  const jointMarkers = decodeMarkers(bytes, byType.get(CHUNK.jointMarkers));
  const landmarks = decodeMarkers(bytes, byType.get(CHUNK.landmarks));
  if (positions.length !== counts.vertices * 3 || normals.length !== positions.length || semanticGroupIds.length !== counts.vertices || indices.length !== counts.indices
    || primitiveGroups.length !== counts.primitiveGroups || jointMarkers.length !== counts.jointMarkers || landmarks.length !== counts.landmarks) {
    throw new Error('HRL Bone chunk counts disagree with the header.');
  }
  return {
    schema: HRL_BONE_BINARY_LOADER_V1_SCHEMA,
    type: 'HrlBoneBinaryGeometry',
    authority: 'compiled-display-cache',
    writesHumanRigCore: false,
    writesFinalPose: false,
    usesSkinnedMesh: false,
    runtimeBoneScaleCount: 0,
    header: { magic, major, minor, headerByteLength, chunkCount, counts, aabb, contentChecksum, computedContentChecksum, fileByteLength },
    chunks, positions, normals, indices, semanticGroupIds, primitiveGroups, jointMarkers, landmarks,
  };
}

function decodeFloat32(bytes, chunk) {
  if (chunk.byteLength % 4) throw new Error('Misaligned Float32 chunk.');
  const view = new DataView(bytes.buffer, bytes.byteOffset + chunk.byteOffset, chunk.byteLength);
  return Float32Array.from({ length: chunk.byteLength / 4 }, (_, index) => view.getFloat32(index * 4, true));
}

function decodeUint32(bytes, chunk) {
  if (chunk.byteLength % 4) throw new Error('Misaligned Uint32 chunk.');
  const view = new DataView(bytes.buffer, bytes.byteOffset + chunk.byteOffset, chunk.byteLength);
  return Uint32Array.from({ length: chunk.byteLength / 4 }, (_, index) => view.getUint32(index * 4, true));
}

function decodePrimitiveGroups(bytes, chunk) {
  if (chunk.stride !== 32 || chunk.byteLength !== chunk.elementCount * 32) throw new Error('Invalid primitive-group chunk.');
  const view = new DataView(bytes.buffer, bytes.byteOffset + chunk.byteOffset, chunk.byteLength);
  return Array.from({ length: chunk.elementCount }, (_, index) => {
    const offset = index * 32;
    const primitive = PRIMITIVES[view.getUint32(offset, true)];
    const side = SIDES[view.getUint32(offset + 20, true)];
    if (!primitive || !side) throw new Error('Unknown primitive-group enum.');
    const lod = view.getUint32(offset + 16, true);
    return { primitive, indexOffset: view.getUint32(offset + 4, true), indexCount: view.getUint32(offset + 8, true), semanticGroupId: view.getUint32(offset + 12, true), lod: lod ? lod - 1 : null, side, ordinal: view.getUint32(offset + 24, true) };
  });
}

function decodeMarkers(bytes, chunk) {
  if (chunk.stride !== 16 || chunk.byteLength !== chunk.elementCount * 16) throw new Error('Invalid marker chunk.');
  const view = new DataView(bytes.buffer, bytes.byteOffset + chunk.byteOffset, chunk.byteLength);
  return Array.from({ length: chunk.elementCount }, (_, index) => {
    const offset = index * 16;
    return { semanticGroupId: view.getUint32(offset, true), position: [0, 1, 2].map((component) => view.getFloat32(offset + 4 + component * 4, true)) };
  });
}

async function sha256(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto SHA256 is unavailable.');
  return toHex(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)));
}
function toHex(bytes) { return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join(''); }
