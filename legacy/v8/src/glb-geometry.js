const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const EPSILON = 1e-8;

const COMPONENT_INFO = Object.freeze({
  5120: { ArrayType: Int8Array, bytes: 1, getter: 'getInt8', normalizedDivisor: 127, signed: true },
  5121: { ArrayType: Uint8Array, bytes: 1, getter: 'getUint8', normalizedDivisor: 255, signed: false },
  5122: { ArrayType: Int16Array, bytes: 2, getter: 'getInt16', normalizedDivisor: 32767, signed: true },
  5123: { ArrayType: Uint16Array, bytes: 2, getter: 'getUint16', normalizedDivisor: 65535, signed: false },
  5125: { ArrayType: Uint32Array, bytes: 4, getter: 'getUint32', normalizedDivisor: 4294967295, signed: false },
  5126: { ArrayType: Float32Array, bytes: 4, getter: 'getFloat32', normalizedDivisor: 1, signed: true },
});

const TYPE_SIZE = Object.freeze({
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
});

/** Loads the first triangle mesh from a binary glTF file. */
export async function loadGlbMesh(url, { signal } = {}) {
  return parseGlbMesh(await fetchGlb(url, signal));
}

/** Loads one pre-bound triangle mesh with native glTF skinning data. */
export async function loadGlbSkin(url, { signal } = {}) {
  return parseGlbSkin(await fetchGlb(url, signal));
}

async function fetchGlb(url, signal) {
  const response = await fetch(url, { cache: 'force-cache', signal });
  if (!response.ok) {
    throw new Error(`人体表皮文件加载失败：HTTP ${response.status}`);
  }
  return response.arrayBuffer();
}

export function parseGlbMesh(arrayBuffer) {
  return parseGlbAsset(arrayBuffer, { requireSkin: false });
}

export function parseGlbSkin(arrayBuffer) {
  return parseGlbAsset(arrayBuffer, { requireSkin: true });
}

function parseGlbAsset(arrayBuffer, { requireSkin }) {
  const { json, binaryChunk } = parseGlbContainer(arrayBuffer);
  const record = findTrianglePrimitive(json, { requireSkin });
  const { primitive } = record;
  const attributes = {};
  for (const [semantic, accessorIndex] of Object.entries(primitive.attributes ?? {})) {
    const key = semanticToKey(semantic);
    if (!key) continue;
    attributes[key] = readAccessor(json, binaryChunk, accessorIndex);
  }
  if (!attributes.position) {
    throw new Error('GLB 网格缺少 POSITION 属性。');
  }

  const index = Number.isInteger(primitive.indices)
    ? readAccessor(json, binaryChunk, primitive.indices)
    : null;
  if (index && index.itemSize !== 1) {
    throw new Error('GLB 索引访问器必须是 SCALAR。');
  }

  const skin = Number.isInteger(record.skinIndex)
    ? parseSkin(json, binaryChunk, record.skinIndex, record.meshNodeIndex)
    : null;
  let skinValidation = null;
  if (requireSkin) {
    skinValidation = validateNativeSkin(attributes, skin);
    attributes.skinWeight.decodedArray = skinValidation.decodedWeights;
  }

  return {
    attributes,
    index,
    skin,
    skinValidation,
    mode: primitive.mode ?? 4,
    vertexCount: attributes.position.count,
    triangleCount: index
      ? Math.floor(index.count / 3)
      : Math.floor(attributes.position.count / 3),
    metadata: {
      asset: json.asset ?? {},
      extras: json.extras ?? null,
      extensionsUsed: Array.isArray(json.extensionsUsed) ? [...json.extensionsUsed] : [],
      meshName: json.meshes?.[record.meshIndex]?.name ?? '',
      meshIndex: record.meshIndex,
      primitiveIndex: record.primitiveIndex,
      meshNodeIndex: record.meshNodeIndex,
      meshNode: Number.isInteger(record.meshNodeIndex)
        ? normalizeNode(json.nodes?.[record.meshNodeIndex], record.meshNodeIndex)
        : null,
      material: Number.isInteger(primitive.material)
        ? structuredCloneSafe(json.materials?.[primitive.material] ?? null)
        : null,
      bounds: {
        min: attributes.position.min ?? null,
        max: attributes.position.max ?? null,
      },
    },
  };
}

function parseGlbContainer(arrayBuffer) {
  if (!(arrayBuffer instanceof ArrayBuffer)) {
    throw new TypeError('GLB 解析器需要 ArrayBuffer。');
  }
  if (arrayBuffer.byteLength < 20) {
    throw new Error('GLB 文件过短。');
  }

  const view = new DataView(arrayBuffer);
  const magic = view.getUint32(0, true);
  const version = view.getUint32(4, true);
  const declaredLength = view.getUint32(8, true);
  if (magic !== GLB_MAGIC) throw new Error('文件不是有效的 GLB。');
  if (version !== 2) throw new Error(`仅支持 GLB 2.0，当前版本为 ${version}。`);
  if (declaredLength > arrayBuffer.byteLength) throw new Error('GLB 文件内容不完整。');

  let json = null;
  let binaryChunk = null;
  let offset = 12;
  while (offset + 8 <= declaredLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    offset += 8;
    if (offset + chunkLength > declaredLength) throw new Error('GLB 数据块长度越界。');
    if (chunkType === JSON_CHUNK) {
      const bytes = new Uint8Array(arrayBuffer, offset, chunkLength);
      const text = new TextDecoder().decode(bytes).replace(/[\u0000\u0020]+$/g, '');
      json = JSON.parse(text);
    } else if (chunkType === BIN_CHUNK && !binaryChunk) {
      binaryChunk = { buffer: arrayBuffer, byteOffset: offset, byteLength: chunkLength };
    }
    offset += chunkLength;
  }
  if (!json || !binaryChunk) throw new Error('GLB 缺少 JSON 或 BIN 数据块。');
  return { json, binaryChunk };
}

function findTrianglePrimitive(json, { requireSkin }) {
  const meshNodes = [];
  for (let nodeIndex = 0; nodeIndex < (json.nodes?.length ?? 0); nodeIndex += 1) {
    const node = json.nodes[nodeIndex];
    if (Number.isInteger(node?.mesh)) {
      meshNodes.push({ meshIndex: node.mesh, meshNodeIndex: nodeIndex, skinIndex: node.skin });
    }
  }

  const candidates = meshNodes.length
    ? meshNodes
    : (json.meshes ?? []).map((_mesh, meshIndex) => ({ meshIndex, meshNodeIndex: null, skinIndex: null }));

  let firstTriangle = null;
  for (const candidate of candidates) {
    const mesh = json.meshes?.[candidate.meshIndex];
    if (!mesh) continue;
    for (let primitiveIndex = 0; primitiveIndex < (mesh.primitives?.length ?? 0); primitiveIndex += 1) {
      const primitive = mesh.primitives[primitiveIndex];
      const mode = primitive.mode ?? 4;
      if (mode !== 4 || primitive.attributes?.POSITION == null) continue;
      const record = { ...candidate, primitive, primitiveIndex };
      if (!firstTriangle) firstTriangle = record;
      const hasNativeSkin = Number.isInteger(candidate.skinIndex)
        && primitive.attributes?.JOINTS_0 != null
        && primitive.attributes?.WEIGHTS_0 != null;
      if (!requireSkin || hasNativeSkin) return record;
    }
  }

  if (requireSkin && firstTriangle) {
    throw new Error('GLB 人体网格缺少 skin、JOINTS_0 或 WEIGHTS_0。');
  }
  if (firstTriangle) return firstTriangle;
  throw new Error('GLB 中没有三角形人体网格。');
}

function parseSkin(json, binaryChunk, skinIndex, meshNodeIndex) {
  const source = json.skins?.[skinIndex];
  if (!source) throw new Error(`GLB skin ${skinIndex} 不存在。`);
  if (!Array.isArray(source.joints) || source.joints.length === 0) {
    throw new Error('GLB skin 没有关节节点。');
  }
  if (!Number.isInteger(source.inverseBindMatrices)) {
    throw new Error('GLB skin 缺少 inverseBindMatrices。');
  }
  const inverseBindMatrices = readAccessor(json, binaryChunk, source.inverseBindMatrices);
  if (inverseBindMatrices.itemSize !== 16 || inverseBindMatrices.type !== 'MAT4'
    || inverseBindMatrices.componentType !== 5126
    || inverseBindMatrices.count !== source.joints.length) {
    throw new Error('inverseBindMatrices 必须使用与关节数量一致的 FLOAT MAT4。');
  }

  const jointSet = new Set(source.joints);
  const parentByNode = new Map();
  for (let nodeIndex = 0; nodeIndex < (json.nodes?.length ?? 0); nodeIndex += 1) {
    for (const childIndex of json.nodes[nodeIndex]?.children ?? []) {
      if (!parentByNode.has(childIndex)) parentByNode.set(childIndex, nodeIndex);
    }
  }
  const jointIndexByNode = new Map(source.joints.map((nodeIndex, jointIndex) => [nodeIndex, jointIndex]));
  const joints = source.joints.map((nodeIndex, jointIndex) => {
    const node = json.nodes?.[nodeIndex];
    if (!node) throw new Error(`GLB skin joint node ${nodeIndex} 不存在。`);
    const parentNodeIndex = parentByNode.get(nodeIndex) ?? null;
    const parentJointIndex = jointSet.has(parentNodeIndex)
      ? jointIndexByNode.get(parentNodeIndex)
      : null;
    const id = String(node.extras?.humanoidJointId || node.name || `joint_${jointIndex}`);
    return {
      ...normalizeNode(node, nodeIndex),
      jointIndex,
      id,
      parentNodeIndex,
      parentJointIndex: Number.isInteger(parentJointIndex) ? parentJointIndex : null,
      parentId: null,
      childJointIndices: (node.children ?? [])
        .filter((childNodeIndex) => jointSet.has(childNodeIndex))
        .map((childNodeIndex) => jointIndexByNode.get(childNodeIndex)),
    };
  });
  for (const joint of joints) {
    joint.parentId = Number.isInteger(joint.parentJointIndex)
      ? joints[joint.parentJointIndex].id
      : null;
  }

  const jointIds = joints.map((joint) => joint.id);
  if (new Set(jointIds).size !== jointIds.length) {
    throw new Error('GLB skin 关节 ID 不唯一。');
  }

  return {
    index: skinIndex,
    name: String(source.name || `skin_${skinIndex}`),
    meshNodeIndex,
    skeletonNodeIndex: Number.isInteger(source.skeleton) ? source.skeleton : source.joints[0],
    jointNodeIndices: [...source.joints],
    jointIds,
    joints,
    inverseBindMatrices,
    extras: structuredCloneSafe(source.extras ?? null),
  };
}

function normalizeNode(node = {}, nodeIndex) {
  return {
    nodeIndex,
    name: String(node.name || ''),
    translation: Array.isArray(node.translation) ? [...node.translation] : [0, 0, 0],
    rotation: Array.isArray(node.rotation) ? [...node.rotation] : [0, 0, 0, 1],
    scale: Array.isArray(node.scale) ? [...node.scale] : [1, 1, 1],
    matrix: Array.isArray(node.matrix) ? [...node.matrix] : null,
    children: Array.isArray(node.children) ? [...node.children] : [],
    extras: structuredCloneSafe(node.extras ?? null),
  };
}

function validateNativeSkin(attributes, skin) {
  if (!skin) throw new Error('GLB 人体网格没有可用 skin。');
  const skinIndex = attributes.skinIndex;
  const skinWeight = attributes.skinWeight;
  if (!skinIndex || skinIndex.itemSize !== 4) throw new Error('JOINTS_0 必须是 VEC4。');
  if (![5121, 5123].includes(skinIndex.componentType)) {
    throw new Error('JOINTS_0 必须使用 UNSIGNED_BYTE 或 UNSIGNED_SHORT。');
  }
  if (skinIndex.normalized) throw new Error('JOINTS_0 不能使用 normalized。');
  if (!skinWeight || skinWeight.itemSize !== 4) throw new Error('WEIGHTS_0 必须是 VEC4。');
  const validWeightEncoding = skinWeight.componentType === 5126
    || ([5121, 5123].includes(skinWeight.componentType) && skinWeight.normalized);
  if (!validWeightEncoding) {
    throw new Error('WEIGHTS_0 必须使用 FLOAT，或 normalized UNSIGNED_BYTE / UNSIGNED_SHORT。');
  }
  if (skinIndex.count !== attributes.position.count || skinWeight.count !== attributes.position.count) {
    throw new Error('JOINTS_0、WEIGHTS_0 与 POSITION 顶点数量不一致。');
  }

  const decodedWeights = accessorToFloat32(skinWeight);
  let maxWeightSumError = 0;
  let minWeightSum = Infinity;
  let maxWeightSum = -Infinity;
  let invalidWeightCount = 0;
  let maxJointIndex = 0;
  for (let vertexIndex = 0; vertexIndex < attributes.position.count; vertexIndex += 1) {
    const offset = vertexIndex * 4;
    let total = 0;
    for (let slot = 0; slot < 4; slot += 1) {
      const weight = decodedWeights[offset + slot];
      const jointIndex = Number(skinIndex.array[offset + slot]);
      if (!Number.isFinite(weight) || weight < -EPSILON) invalidWeightCount += 1;
      if (!Number.isInteger(jointIndex) || jointIndex < 0 || jointIndex >= skin.joints.length) {
        throw new Error(`JOINTS_0 包含越界关节索引 ${jointIndex}。`);
      }
      maxJointIndex = Math.max(maxJointIndex, jointIndex);
      total += Math.max(0, weight);
    }
    if (total <= EPSILON) throw new Error(`顶点 ${vertexIndex} 的 WEIGHTS_0 总和为零。`);
    minWeightSum = Math.min(minWeightSum, total);
    maxWeightSum = Math.max(maxWeightSum, total);
    maxWeightSumError = Math.max(maxWeightSumError, Math.abs(1 - total));
    if (Math.abs(1 - total) > 1e-6) {
      for (let slot = 0; slot < 4; slot += 1) decodedWeights[offset + slot] /= total;
    }
  }
  if (invalidWeightCount) throw new Error(`WEIGHTS_0 包含 ${invalidWeightCount} 个非法权重。`);

  for (const value of skin.inverseBindMatrices.array) {
    if (!Number.isFinite(value)) throw new Error('inverseBindMatrices 包含非有限数值。');
  }

  return {
    native: true,
    jointCount: skin.joints.length,
    maxJointIndex,
    decodedWeights,
    minWeightSum,
    maxWeightSum,
    maxWeightSumError,
  };
}

export function accessorToFloat32(accessor) {
  if (!accessor?.array) throw new TypeError('需要有效的 GLB accessor。');
  if (accessor.array instanceof Float32Array && !accessor.normalized) {
    return new Float32Array(accessor.array);
  }
  const component = COMPONENT_INFO[accessor.componentType];
  if (!component) throw new Error(`无法解码 componentType ${accessor.componentType}。`);
  const output = new Float32Array(accessor.array.length);
  for (let index = 0; index < accessor.array.length; index += 1) {
    const value = Number(accessor.array[index]);
    if (!accessor.normalized || accessor.componentType === 5126) {
      output[index] = value;
    } else if (component.signed) {
      output[index] = Math.max(value / component.normalizedDivisor, -1);
    } else {
      output[index] = value / component.normalizedDivisor;
    }
  }
  return output;
}

function semanticToKey(semantic) {
  if (semantic === 'POSITION') return 'position';
  if (semantic === 'NORMAL') return 'normal';
  if (semantic === 'COLOR_0') return 'color';
  if (semantic === 'TEXCOORD_0') return 'uv';
  if (semantic === 'JOINTS_0') return 'skinIndex';
  if (semantic === 'WEIGHTS_0') return 'skinWeight';
  return null;
}

function readAccessor(json, binaryChunk, accessorIndex) {
  const accessor = json.accessors?.[accessorIndex];
  if (!accessor) throw new Error(`GLB accessor ${accessorIndex} 不存在。`);
  if (accessor.sparse) throw new Error('当前本地 GLB 解析器暂不支持 sparse accessor。');
  const bufferView = json.bufferViews?.[accessor.bufferView];
  if (!bufferView) throw new Error(`GLB accessor ${accessorIndex} 缺少 bufferView。`);
  if ((bufferView.buffer ?? 0) !== 0) {
    throw new Error('当前本地 GLB 解析器只支持单个内嵌 BIN 缓冲区。');
  }

  const component = COMPONENT_INFO[accessor.componentType];
  const itemSize = TYPE_SIZE[accessor.type];
  if (!component || !itemSize) {
    throw new Error(`不支持的 GLB accessor 类型：${accessor.componentType}/${accessor.type}`);
  }

  const count = Number(accessor.count ?? 0);
  const packedStride = component.bytes * itemSize;
  const stride = Number(bufferView.byteStride ?? packedStride);
  const relativeOffset = Number(bufferView.byteOffset ?? 0) + Number(accessor.byteOffset ?? 0);
  const byteOffset = binaryChunk.byteOffset + relativeOffset;
  const requiredEnd = byteOffset + (Math.max(0, count - 1) * stride) + packedStride;
  const binaryEnd = binaryChunk.byteOffset + binaryChunk.byteLength;
  if (count < 0 || requiredEnd > binaryEnd) throw new Error(`GLB accessor ${accessorIndex} 数据越界。`);

  let array;
  if (stride === packedStride && byteOffset % component.bytes === 0) {
    const source = new component.ArrayType(binaryChunk.buffer, byteOffset, count * itemSize);
    array = new component.ArrayType(source);
  } else {
    array = new component.ArrayType(count * itemSize);
    const dataView = new DataView(binaryChunk.buffer);
    for (let row = 0; row < count; row += 1) {
      const rowOffset = byteOffset + row * stride;
      for (let column = 0; column < itemSize; column += 1) {
        const componentOffset = rowOffset + column * component.bytes;
        array[row * itemSize + column] = dataView[component.getter](componentOffset, true);
      }
    }
  }

  return {
    accessorIndex,
    array,
    itemSize,
    count,
    normalized: Boolean(accessor.normalized),
    componentType: accessor.componentType,
    type: accessor.type,
    min: Array.isArray(accessor.min) ? [...accessor.min] : null,
    max: Array.isArray(accessor.max) ? [...accessor.max] : null,
  };
}

function structuredCloneSafe(value) {
  if (value == null) return value;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
