import { BINARY_FORMAT, BINARY_VERSION } from './constants.js';
import { align4, canonicalStringify } from './math.js';
import { validateGarmentPayload } from './garment-compiler.js';

const HEADER_BYTES = 24;
const DESCRIPTOR_BYTES = 24;
const ELEMENT_TYPES = Object.freeze({ Float32Array: 1, Uint32Array: 2, Uint16Array: 3, Uint8Array: 4, Int16Array: 5 });
const TYPE_CONSTRUCTORS = Object.freeze({ 1: Float32Array, 2: Uint32Array, 3: Uint16Array, 4: Uint8Array, 5: Int16Array });
const SECTIONS = Object.freeze([
  { tag: 'POSI', key: 'positions', components: 3 },
  { tag: 'NORM', key: 'normals', components: 3 },
  { tag: 'INDX', key: 'indices', components: 1 },
  { tag: 'JONT', key: 'skinJoints', components: 4 },
  { tag: 'WGHT', key: 'skinWeights', components: 4 },
  { tag: 'MCRD', key: 'materialCoords', components: 2 },
  { tag: 'RGID', key: 'regionIds', components: 1 },
  { tag: 'SEAM', key: 'seamPairs', components: 2 },
  { tag: 'EDGE', key: 'stretchEdges', components: 2 },
  { tag: 'RLEN', key: 'restLengths', components: 1 },
  { tag: 'IVMS', key: 'inverseMass', components: 1 },
  { tag: 'FLWT', key: 'followWeights', components: 1 },
  { tag: 'MUNI', key: 'materialUniforms', components: 1 },
]);

function writeFourCC(view, offset, tag) {
  for (let index = 0; index < 4; index += 1) view.setUint8(offset + index, tag.charCodeAt(index));
}
function readFourCC(view, offset) {
  return String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
}
function copyBytes(targetBuffer, targetOffset, sourceArray) {
  new Uint8Array(targetBuffer, targetOffset, sourceArray.byteLength).set(
    new Uint8Array(sourceArray.buffer, sourceArray.byteOffset, sourceArray.byteLength),
  );
}
function payloadMetadata(payload) {
  return {
    schema: payload.schema,
    formatVersion: payload.formatVersion,
    garmentId: payload.garmentId,
    garmentRevision: payload.garmentRevision,
    garmentHash: payload.garmentHash,
    materialId: payload.materialId,
    materialRevision: payload.materialRevision,
    materialHash: payload.materialHash,
    subjectId: payload.subjectId,
    proportionRevision: payload.proportionRevision,
    bodyHash: payload.bodyHash,
    fitContract: payload.fitContract,
    patternGraphHash: payload.patternGraphHash,
    jointTable: payload.jointTable,
    regionTable: payload.regionTable,
    topology: payload.topology,
    runtimeContract: payload.runtimeContract,
    contentHash: payload.contentHash,
    topologySignature: payload.topologySignature,
    binaryFormat: `${BINARY_FORMAT}@${BINARY_VERSION}`,
  };
}

export function encodeGarmentPayload(payload) {
  validateGarmentPayload(payload);
  const metadataBytes = new TextEncoder().encode(canonicalStringify(payloadMetadata(payload)));
  const sectionCount = SECTIONS.length;
  const descriptorTableEnd = HEADER_BYTES + sectionCount * DESCRIPTOR_BYTES;
  const metadataOffset = align4(descriptorTableEnd);
  const payloadOffset = align4(metadataOffset + metadataBytes.length);
  const descriptors = [];
  let cursor = payloadOffset;
  for (const section of SECTIONS) {
    const array = payload[section.key];
    const elementType = ELEMENT_TYPES[array.constructor.name];
    if (!elementType) throw new TypeError(`Unsupported TypedArray: ${array.constructor.name}`);
    cursor = align4(cursor);
    descriptors.push({ ...section, byteOffset: cursor, byteLength: array.byteLength, elementType, count: array.length });
    cursor += array.byteLength;
  }
  const totalLength = align4(cursor);
  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);
  writeFourCC(view, 0, BINARY_FORMAT);
  view.setUint16(4, BINARY_VERSION, true);
  view.setUint16(6, HEADER_BYTES, true);
  view.setUint16(8, sectionCount, true);
  view.setUint16(10, 1, true);
  view.setUint32(12, metadataBytes.length, true);
  view.setUint32(16, payloadOffset, true);
  view.setUint32(20, totalLength, true);
  for (let index = 0; index < descriptors.length; index += 1) {
    const descriptor = descriptors[index];
    const offset = HEADER_BYTES + index * DESCRIPTOR_BYTES;
    writeFourCC(view, offset, descriptor.tag);
    view.setUint32(offset + 4, descriptor.byteOffset, true);
    view.setUint32(offset + 8, descriptor.byteLength, true);
    view.setUint16(offset + 12, descriptor.elementType, true);
    view.setUint16(offset + 14, descriptor.components, true);
    view.setUint32(offset + 16, descriptor.count, true);
    view.setUint32(offset + 20, 0, true);
  }
  new Uint8Array(buffer, metadataOffset, metadataBytes.length).set(metadataBytes);
  for (const descriptor of descriptors) copyBytes(buffer, descriptor.byteOffset, payload[descriptor.key]);
  return buffer;
}

export function decodeGarmentPayload(bufferLike) {
  const source = bufferLike instanceof ArrayBuffer
    ? bufferLike
    : ArrayBuffer.isView(bufferLike)
      ? bufferLike.buffer.slice(bufferLike.byteOffset, bufferLike.byteOffset + bufferLike.byteLength)
      : null;
  if (!source) throw new TypeError('bufferLike must be an ArrayBuffer or TypedArray');
  if (source.byteLength < HEADER_BYTES) throw new Error('Garment binary is truncated');
  const view = new DataView(source);
  const magic = readFourCC(view, 0);
  if (magic !== BINARY_FORMAT) throw new Error(`Unexpected garment magic: ${magic}`);
  const version = view.getUint16(4, true);
  if (version !== BINARY_VERSION) throw new Error(`Unsupported garment binary version: ${version}`);
  const headerBytes = view.getUint16(6, true);
  const sectionCount = view.getUint16(8, true);
  const flags = view.getUint16(10, true);
  const metadataLength = view.getUint32(12, true);
  const payloadOffset = view.getUint32(16, true);
  const totalLength = view.getUint32(20, true);
  if (headerBytes !== HEADER_BYTES) throw new Error(`Unexpected header size: ${headerBytes}`);
  if ((flags & 1) !== 1) throw new Error('Big-endian garment binaries are unsupported');
  if (totalLength !== source.byteLength) throw new Error('Garment binary length does not match header');
  const descriptorTableEnd = HEADER_BYTES + sectionCount * DESCRIPTOR_BYTES;
  const metadataOffset = align4(descriptorTableEnd);
  if (metadataOffset + metadataLength > source.byteLength || payloadOffset > source.byteLength) {
    throw new Error('Garment binary contains invalid offsets');
  }
  const metadataText = new TextDecoder().decode(new Uint8Array(source, metadataOffset, metadataLength));
  const metadata = JSON.parse(metadataText);
  const arrays = {};
  const descriptorByTag = new Map(SECTIONS.map((section) => [section.tag, section]));
  for (let index = 0; index < sectionCount; index += 1) {
    const offset = HEADER_BYTES + index * DESCRIPTOR_BYTES;
    const tag = readFourCC(view, offset);
    const byteOffset = view.getUint32(offset + 4, true);
    const byteLength = view.getUint32(offset + 8, true);
    const elementType = view.getUint16(offset + 12, true);
    const components = view.getUint16(offset + 14, true);
    const count = view.getUint32(offset + 16, true);
    const section = descriptorByTag.get(tag);
    const Constructor = TYPE_CONSTRUCTORS[elementType];
    if (!section || !Constructor) throw new Error(`Unknown garment section: ${tag}`);
    if (section.components !== components) throw new Error(`Component mismatch for ${tag}`);
    if (byteOffset < payloadOffset || byteOffset + byteLength > source.byteLength) throw new Error(`Invalid byte range for ${tag}`);
    if (byteLength !== count * Constructor.BYTES_PER_ELEMENT) throw new Error(`Byte length mismatch for ${tag}`);
    arrays[section.key] = new Constructor(source.slice(byteOffset, byteOffset + byteLength));
  }
  const payload = { ...metadata, ...arrays };
  delete payload.binaryFormat;
  validateGarmentPayload(payload);
  return payload;
}

export function inspectGarmentBinary(bufferLike) {
  const source = bufferLike instanceof ArrayBuffer
    ? bufferLike
    : bufferLike.buffer.slice(bufferLike.byteOffset, bufferLike.byteOffset + bufferLike.byteLength);
  const view = new DataView(source);
  const sectionCount = view.getUint16(8, true);
  const sections = [];
  for (let index = 0; index < sectionCount; index += 1) {
    const offset = HEADER_BYTES + index * DESCRIPTOR_BYTES;
    sections.push({
      tag: readFourCC(view, offset),
      byteOffset: view.getUint32(offset + 4, true),
      byteLength: view.getUint32(offset + 8, true),
      elementType: view.getUint16(offset + 12, true),
      components: view.getUint16(offset + 14, true),
      count: view.getUint32(offset + 16, true),
    });
  }
  return { magic: readFourCC(view, 0), version: view.getUint16(4, true), totalLength: view.getUint32(20, true), sections };
}
