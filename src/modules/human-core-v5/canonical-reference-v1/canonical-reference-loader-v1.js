export const CANONICAL_REFERENCE_LOADER_V1_SCHEMA = 'humanoid_rig/canonical_reference_loader@1.0';

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const COMPONENT_COUNTS = Object.freeze({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 });
const COMPONENT_BYTES = Object.freeze({ 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 });

export async function loadCanonicalReferenceGlbV1(url, { fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Canonical reference loader requires fetch().');
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Canonical reference asset request failed: ${response.status} ${url}`);
  const arrayBuffer = await response.arrayBuffer();
  return parseCanonicalReferenceGlbV1(arrayBuffer, { assetPath: url });
}

export function parseCanonicalReferenceGlbV1(input, { assetPath = null } = {}) {
  const bytes = toUint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 20 || view.getUint32(0, true) !== GLB_MAGIC) throw new Error('Canonical reference input is not a GLB container.');
  if (view.getUint32(4, true) !== 2) throw new Error('Canonical reference input must use glTF 2.0.');
  const declaredLength = view.getUint32(8, true);
  if (declaredLength !== bytes.byteLength) throw new Error(`GLB declared length ${declaredLength} does not match ${bytes.byteLength}.`);
  let offset = 12;
  let jsonBytes = null;
  let binaryChunk = null;
  const chunks = [];
  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) throw new Error('GLB chunk header exceeds the container.');
    const byteLength = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const end = start + byteLength;
    if (end > bytes.byteLength) throw new Error('GLB chunk exceeds the container.');
    const data = bytes.subarray(start, end);
    chunks.push({ type, byteLength });
    if (type === JSON_CHUNK) jsonBytes = data;
    else if (type === BIN_CHUNK) binaryChunk = data;
    offset = end;
  }
  if (!jsonBytes || !binaryChunk) throw new Error('Canonical reference GLB requires JSON and BIN chunks.');
  const jsonText = new TextDecoder().decode(jsonBytes).replace(/[\u0000\u0020]+$/g, '');
  const gltf = JSON.parse(jsonText);
  if (gltf.asset?.version !== '2.0') throw new Error('Canonical reference JSON must declare glTF 2.0.');
  if ((gltf.buffers?.length ?? 0) !== 1) throw new Error('Canonical reference loader supports one embedded GLB buffer only.');
  if (gltf.buffers[0].byteLength > binaryChunk.byteLength) throw new Error('GLB BIN chunk is shorter than buffers[0].byteLength.');
  return {
    schema: CANONICAL_REFERENCE_LOADER_V1_SCHEMA,
    type: 'CanonicalReferenceParsedGlbV1',
    assetPath,
    bytes,
    byteLength: bytes.byteLength,
    gltf,
    binaryChunk,
    chunks,
  };
}

export function listCanonicalReferenceSceneV1(parsed) {
  const { gltf } = parsed;
  return {
    sceneIndex: gltf.scene ?? 0,
    scenes: (gltf.scenes ?? []).map((scene, sceneIndex) => ({ sceneIndex, name: scene.name ?? null, nodes: [...(scene.nodes ?? [])] })),
    nodes: (gltf.nodes ?? []).map((node, nodeIndex) => ({
      nodeIndex,
      name: node.name ?? null,
      mesh: node.mesh ?? null,
      skin: node.skin ?? null,
      children: [...(node.children ?? [])],
      localMatrix: nodeLocalMatrixV1(node),
      worldMatrix: nodeWorldMatrixV1(parsed, nodeIndex),
    })),
    meshes: (gltf.meshes ?? []).map((mesh, meshIndex) => ({
      meshIndex,
      name: mesh.name ?? null,
      primitiveCount: mesh.primitives?.length ?? 0,
      primitives: (mesh.primitives ?? []).map((primitive, primitiveIndex) => ({
        primitiveIndex,
        mode: primitive.mode ?? 4,
        material: primitive.material ?? null,
        indices: primitive.indices ?? null,
        attributes: { ...(primitive.attributes ?? {}) },
        targets: primitive.targets ?? null,
      })),
    })),
    skinCount: gltf.skins?.length ?? 0,
    skins: structuredClone(gltf.skins ?? []),
    animationCount: gltf.animations?.length ?? 0,
    materialCount: gltf.materials?.length ?? 0,
  };
}

export function findCanonicalReferenceBodyV1(parsed) {
  const { gltf } = parsed;
  const candidates = [];
  for (let nodeIndex = 0; nodeIndex < (gltf.nodes?.length ?? 0); nodeIndex += 1) {
    const node = gltf.nodes[nodeIndex];
    if (node.mesh == null) continue;
    const mesh = gltf.meshes?.[node.mesh];
    if (!mesh) throw new Error(`Node ${nodeIndex} references missing mesh ${node.mesh}.`);
    for (let primitiveIndex = 0; primitiveIndex < (mesh.primitives?.length ?? 0); primitiveIndex += 1) {
      const primitive = mesh.primitives[primitiveIndex];
      if (primitive.mode != null && primitive.mode !== 4) continue;
      if (primitive.attributes?.POSITION == null || primitive.attributes?.NORMAL == null || primitive.indices == null) continue;
      candidates.push({ nodeIndex, node, meshIndex: node.mesh, mesh, primitiveIndex, primitive });
    }
  }
  if (candidates.length !== 1) throw new Error(`Expected exactly one formal indexed body primitive; found ${candidates.length}.`);
  const body = candidates[0];
  return {
    ...body,
    nodeName: body.node.name ?? `node-${body.nodeIndex}`,
    meshName: body.mesh.name ?? `mesh-${body.meshIndex}`,
    sourceNodeMatrix: nodeLocalMatrixV1(body.node),
    sourceWorldMatrix: nodeWorldMatrixV1(parsed, body.nodeIndex),
  };
}

export async function extractCanonicalReferenceStaticDataV1(parsed, body = findCanonicalReferenceBodyV1(parsed)) {
  const positionAccessor = readCanonicalReferenceAccessorV1(parsed, body.primitive.attributes.POSITION);
  const normalAccessor = readCanonicalReferenceAccessorV1(parsed, body.primitive.attributes.NORMAL);
  const indexAccessor = readCanonicalReferenceAccessorV1(parsed, body.primitive.indices);
  if (positionAccessor.componentCount !== 3 || positionAccessor.componentType !== 5126) throw new Error('Body POSITION must be float VEC3.');
  if (normalAccessor.componentCount !== 3 || normalAccessor.componentType !== 5126) throw new Error('Body NORMAL must be float VEC3.');
  if (indexAccessor.componentCount !== 1 || ![5121, 5123, 5125].includes(indexAccessor.componentType)) throw new Error('Body indices must use an unsigned scalar accessor.');
  if (positionAccessor.count !== normalAccessor.count) throw new Error('Body POSITION/NORMAL counts differ.');
  if (indexAccessor.count % 3 !== 0) throw new Error('Body index count is not triangular.');
  const positions = new Float32Array(positionAccessor.values);
  const normals = new Float32Array(normalAccessor.values);
  const indices = cloneTypedArray(indexAccessor.values);
  const worldPositions = transformPositionsV1(positions, body.sourceWorldMatrix);
  const worldNormals = transformNormalsV1(normals, body.sourceWorldMatrix);
  return {
    schema: CANONICAL_REFERENCE_LOADER_V1_SCHEMA,
    type: 'CanonicalReferenceStaticGeometryDataV1',
    assetPath: parsed.assetPath,
    nodeIndex: body.nodeIndex,
    nodeName: body.nodeName,
    meshIndex: body.meshIndex,
    meshName: body.meshName,
    primitiveIndex: body.primitiveIndex,
    primitiveCount: body.mesh.primitives.length,
    materialCount: parsed.gltf.materials?.length ?? 0,
    mode: body.primitive.mode ?? 4,
    positions,
    normals,
    indices,
    positionComponentType: positionAccessor.componentType,
    normalComponentType: normalAccessor.componentType,
    indexComponentType: indexAccessor.componentType,
    positionAccessor: structuredClone(parsed.gltf.accessors[body.primitive.attributes.POSITION]),
    normalAccessor: structuredClone(parsed.gltf.accessors[body.primitive.attributes.NORMAL]),
    indexAccessor: structuredClone(parsed.gltf.accessors[body.primitive.indices]),
    sourceNodeMatrix: [...body.sourceNodeMatrix],
    sourceWorldMatrix: [...body.sourceWorldMatrix],
    vertexCount: positionAccessor.count,
    indexCount: indexAccessor.count,
    triangleCount: indexAccessor.count / 3,
    worldPositions,
    worldNormals,
    positionHash: await hashTypedArraySha256V1(positions),
    indexHash: await hashTypedArraySha256V1(indices),
    normalHash: await hashTypedArraySha256V1(normals),
    worldSpacePositionHash: await hashTypedArraySha256V1(worldPositions),
    worldSpaceNormalHash: await hashTypedArraySha256V1(worldNormals),
    sourceHasSkin: body.node.skin != null,
    sourceUsesSkinning: false,
    ignoredAttributes: Object.keys(body.primitive.attributes).filter((name) => !['POSITION', 'NORMAL'].includes(name)),
  };
}

export function readCanonicalReferenceAccessorV1(parsed, accessorIndex) {
  const accessor = parsed.gltf.accessors?.[accessorIndex];
  if (!accessor) throw new Error(`Missing accessor ${accessorIndex}.`);
  if (accessor.sparse) throw new Error(`Sparse accessor ${accessorIndex} is not allowed in the locked reference path.`);
  const bufferView = parsed.gltf.bufferViews?.[accessor.bufferView];
  if (!bufferView || bufferView.buffer !== 0) throw new Error(`Accessor ${accessorIndex} must reference embedded buffer 0.`);
  const componentCount = COMPONENT_COUNTS[accessor.type];
  const componentBytes = COMPONENT_BYTES[accessor.componentType];
  if (!componentCount || !componentBytes) throw new Error(`Accessor ${accessorIndex} has an unsupported format.`);
  const elementBytes = componentCount * componentBytes;
  const stride = bufferView.byteStride ?? elementBytes;
  const start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const values = createTypedArray(accessor.componentType, accessor.count * componentCount);
  const data = new DataView(parsed.binaryChunk.buffer, parsed.binaryChunk.byteOffset, parsed.binaryChunk.byteLength);
  for (let element = 0; element < accessor.count; element += 1) {
    for (let component = 0; component < componentCount; component += 1) {
      values[element * componentCount + component] = readComponent(data, start + element * stride + component * componentBytes, accessor.componentType);
    }
  }
  return { accessorIndex, accessor, bufferView, count: accessor.count, componentCount, componentType: accessor.componentType, values };
}

export function nodeLocalMatrixV1(node = {}) {
  if (Array.isArray(node.matrix)) {
    if (node.matrix.length !== 16) throw new Error('glTF node matrix must contain 16 values.');
    return node.matrix.map(Number);
  }
  const translation = node.translation ?? [0, 0, 0];
  const rotation = node.rotation ?? [0, 0, 0, 1];
  const scale = node.scale ?? [1, 1, 1];
  const [x, y, z, w] = rotation.map(Number);
  const [sx, sy, sz] = scale.map(Number);
  const xx = x * x; const yy = y * y; const zz = z * z;
  const xy = x * y; const xz = x * z; const yz = y * z;
  const wx = w * x; const wy = w * y; const wz = w * z;
  return [
    (1 - 2 * (yy + zz)) * sx, (2 * (xy + wz)) * sx, (2 * (xz - wy)) * sx, 0,
    (2 * (xy - wz)) * sy, (1 - 2 * (xx + zz)) * sy, (2 * (yz + wx)) * sy, 0,
    (2 * (xz + wy)) * sz, (2 * (yz - wx)) * sz, (1 - 2 * (xx + yy)) * sz, 0,
    Number(translation[0]), Number(translation[1]), Number(translation[2]), 1,
  ];
}

export function nodeWorldMatrixV1(parsed, nodeIndex) {
  const parents = new Map();
  (parsed.gltf.nodes ?? []).forEach((node, parentIndex) => (node.children ?? []).forEach((child) => {
    if (parents.has(child)) throw new Error(`glTF node ${child} has multiple parents.`);
    parents.set(child, parentIndex);
  }));
  const chain = [];
  let cursor = nodeIndex;
  while (cursor != null) {
    chain.unshift(cursor);
    cursor = parents.get(cursor) ?? null;
  }
  return chain.reduce((matrix, index) => multiplyMatrix4V1(matrix, nodeLocalMatrixV1(parsed.gltf.nodes[index])), identityMatrix4V1());
}

export function transformPositionsV1(positions, matrix) {
  const result = new Float64Array(positions.length);
  for (let offset = 0; offset < positions.length; offset += 3) {
    const x = positions[offset]; const y = positions[offset + 1]; const z = positions[offset + 2];
    result[offset] = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
    result[offset + 1] = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
    result[offset + 2] = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
  }
  return result;
}

export function transformNormalsV1(normals, matrix) {
  const normalMatrix = inverseTranspose3V1(matrix);
  const result = new Float64Array(normals.length);
  for (let offset = 0; offset < normals.length; offset += 3) {
    const x = normals[offset]; const y = normals[offset + 1]; const z = normals[offset + 2];
    const nx = normalMatrix[0] * x + normalMatrix[3] * y + normalMatrix[6] * z;
    const ny = normalMatrix[1] * x + normalMatrix[4] * y + normalMatrix[7] * z;
    const nz = normalMatrix[2] * x + normalMatrix[5] * y + normalMatrix[8] * z;
    const length = Math.hypot(nx, ny, nz);
    if (length <= 1e-20) throw new Error(`Normal ${offset / 3} collapses under the node matrix.`);
    result[offset] = nx / length;
    result[offset + 1] = ny / length;
    result[offset + 2] = nz / length;
  }
  return result;
}

export async function hashBytesSha256V1(input) {
  const bytes = toUint8Array(input);
  if (!globalThis.crypto?.subtle) throw new Error('SHA256 requires Web Crypto subtle.digest.');
  const source = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes : bytes.slice();
  const digest = await globalThis.crypto.subtle.digest('SHA-256', source);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export async function hashTypedArraySha256V1(values) {
  return hashBytesSha256V1(new Uint8Array(values.buffer, values.byteOffset, values.byteLength));
}

export function identityMatrix4V1() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

export function multiplyMatrix4V1(left, right) {
  const result = new Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let inner = 0; inner < 4; inner += 1) result[column * 4 + row] += left[inner * 4 + row] * right[column * 4 + inner];
    }
  }
  return result;
}

function inverseTranspose3V1(matrix) {
  const a00 = matrix[0]; const a01 = matrix[4]; const a02 = matrix[8];
  const a10 = matrix[1]; const a11 = matrix[5]; const a12 = matrix[9];
  const a20 = matrix[2]; const a21 = matrix[6]; const a22 = matrix[10];
  const b01 = a22 * a11 - a12 * a21;
  const b11 = -a22 * a10 + a12 * a20;
  const b21 = a21 * a10 - a11 * a20;
  const determinant = a00 * b01 + a01 * b11 + a02 * b21;
  if (Math.abs(determinant) <= 1e-20) throw new Error('Node matrix has no invertible normal matrix.');
  const inverse = 1 / determinant;
  const inverted = [
    b01 * inverse, (-a22 * a01 + a02 * a21) * inverse, (a12 * a01 - a02 * a11) * inverse,
    b11 * inverse, (a22 * a00 - a02 * a20) * inverse, (-a12 * a00 + a02 * a10) * inverse,
    b21 * inverse, (-a21 * a00 + a01 * a20) * inverse, (a11 * a00 - a01 * a10) * inverse,
  ];
  return [inverted[0], inverted[3], inverted[6], inverted[1], inverted[4], inverted[7], inverted[2], inverted[5], inverted[8]];
}

function createTypedArray(componentType, length) {
  if (componentType === 5120) return new Int8Array(length);
  if (componentType === 5121) return new Uint8Array(length);
  if (componentType === 5122) return new Int16Array(length);
  if (componentType === 5123) return new Uint16Array(length);
  if (componentType === 5125) return new Uint32Array(length);
  if (componentType === 5126) return new Float32Array(length);
  throw new Error(`Unsupported accessor component type ${componentType}.`);
}

function readComponent(view, offset, componentType) {
  if (componentType === 5120) return view.getInt8(offset);
  if (componentType === 5121) return view.getUint8(offset);
  if (componentType === 5122) return view.getInt16(offset, true);
  if (componentType === 5123) return view.getUint16(offset, true);
  if (componentType === 5125) return view.getUint32(offset, true);
  if (componentType === 5126) return view.getFloat32(offset, true);
  throw new Error(`Unsupported accessor component type ${componentType}.`);
}

function cloneTypedArray(values) {
  return new values.constructor(values);
}

function toUint8Array(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  throw new Error('Expected ArrayBuffer or typed array.');
}
