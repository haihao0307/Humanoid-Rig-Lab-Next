const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;

export function encodeHybridStaticGlb(source, materials) {
  const bufferParts = [];
  const bufferViews = [];
  const accessors = [];
  const meshes = [];
  const nodes = [];
  const materialIndex = new Map(materials.map((item, index) => [item.materialId, index]));
  let byteOffset = 0;

  const appendBuffer = (typedArray, target) => {
    const padding = (4 - (byteOffset % 4)) % 4;
    if (padding) { bufferParts.push(Buffer.alloc(padding)); byteOffset += padding; }
    const data = Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
    const viewIndex = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset, byteLength: data.length, target });
    bufferParts.push(data);
    byteOffset += data.length;
    return viewIndex;
  };

  for (const module of source.modules) {
    const primitives = [];
    for (const part of module.parts) {
      const positions = new Float32Array(part.positions.flat());
      const normals = new Float32Array(part.normals.flat());
      const indices = new Uint32Array(part.indices.flat());
      const positionView = appendBuffer(positions, 34962);
      const normalView = appendBuffer(normals, 34962);
      const indexView = appendBuffer(indices, 34963);
      const positionAccessor = accessors.length;
      accessors.push({ bufferView: positionView, byteOffset: 0, componentType: 5126, count: part.positions.length, type: 'VEC3', min: vectorMin(part.positions), max: vectorMax(part.positions) });
      const normalAccessor = accessors.length;
      accessors.push({ bufferView: normalView, byteOffset: 0, componentType: 5126, count: part.normals.length, type: 'VEC3' });
      const indexAccessor = accessors.length;
      accessors.push({ bufferView: indexView, byteOffset: 0, componentType: 5125, count: indices.length, type: 'SCALAR', min: [0], max: [Math.max(...indices)] });
      primitives.push({
        attributes: { POSITION: positionAccessor, NORMAL: normalAccessor },
        indices: indexAccessor,
        material: materialIndex.get(part.materialId),
        mode: 4,
        extras: { materialId: part.materialId },
      });
    }
    const meshIndex = meshes.length;
    meshes.push({ name: module.moduleId, primitives, extras: { moduleId: module.moduleId, anchorJointIds: module.anchorJointIds } });
    nodes.push({ name: module.moduleId, mesh: meshIndex, extras: { moduleId: module.moduleId } });
  }

  const binaryChunk = Buffer.concat(bufferParts);
  const gltf = {
    asset: { version: '2.0', generator: 'Humanoid Rig Lab Next deterministic hybrid-static-v1 P1.1 writer', copyright: 'Project-owned geometry' },
    scene: 0,
    scenes: [{ name: 'HRL Hybrid Production Skeleton Static V1', nodes: nodes.map((_, index) => index) }],
    nodes,
    meshes,
    materials: materials.map((item) => ({
      name: item.materialId,
      pbrMetallicRoughness: { baseColorFactor: item.baseColorFactor, metallicFactor: item.metallicFactor, roughnessFactor: item.roughnessFactor },
      doubleSided: item.doubleSided,
      extras: { materialId: item.materialId },
    })),
    accessors,
    bufferViews,
    buffers: [{ byteLength: binaryChunk.length }],
    extras: {
      assetId: source.assetId,
      sourceCommit: source.sourceCommit,
      p0SelectionCommit: source.p0SelectionCommit,
      refinementBaseCommit: source.refinementBaseCommit,
      refinementRevision: source.refinementRevision,
      userReviewBaseline: source.userReviewBaseline,
      coreRigFingerprint: source.coreRigFingerprint,
      pose: source.pose,
      authoritativeForPose: false,
      staticDisplayCache: true,
      projectOwnedGeometry: true,
    },
  };

  const jsonData = Buffer.from(JSON.stringify(gltf), 'utf8');
  const jsonPadding = (4 - (jsonData.length % 4)) % 4;
  const paddedJson = Buffer.concat([jsonData, Buffer.alloc(jsonPadding, 0x20)]);
  const binPadding = (4 - (binaryChunk.length % 4)) % 4;
  const paddedBin = Buffer.concat([binaryChunk, Buffer.alloc(binPadding)]);
  const totalLength = 12 + 8 + paddedJson.length + 8 + paddedBin.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(GLB_VERSION, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(paddedJson.length, 0);
  jsonHeader.writeUInt32LE(JSON_CHUNK_TYPE, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(paddedBin.length, 0);
  binHeader.writeUInt32LE(BIN_CHUNK_TYPE, 4);

  return {
    glb: Buffer.concat([header, jsonHeader, paddedJson, binHeader, paddedBin]),
    gltf,
    stats: {
      vertexCount: source.modules.reduce((sum, module) => sum + module.parts.reduce((partSum, part) => partSum + part.positions.length, 0), 0),
      triangleCount: source.modules.reduce((sum, module) => sum + module.parts.reduce((partSum, part) => partSum + part.indices.length, 0), 0),
      meshCount: meshes.length,
      primitiveCount: meshes.reduce((sum, mesh) => sum + mesh.primitives.length, 0),
      materialCount: materials.length,
      moduleCount: source.modules.length,
    },
  };
}

export function inspectGlb(buffer) {
  if (buffer.readUInt32LE(0) !== GLB_MAGIC) throw new Error('Invalid GLB magic.');
  if (buffer.readUInt32LE(4) !== GLB_VERSION) throw new Error('Invalid GLB version.');
  if (buffer.readUInt32LE(8) !== buffer.length) throw new Error('GLB length header mismatch.');
  const jsonLength = buffer.readUInt32LE(12);
  const jsonType = buffer.readUInt32LE(16);
  if (jsonType !== JSON_CHUNK_TYPE) throw new Error('Missing GLB JSON chunk.');
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').trim());
  const binHeaderOffset = 20 + jsonLength;
  const binLength = buffer.readUInt32LE(binHeaderOffset);
  const binType = buffer.readUInt32LE(binHeaderOffset + 4);
  if (binType !== BIN_CHUNK_TYPE) throw new Error('Missing GLB BIN chunk.');
  if (binHeaderOffset + 8 + binLength !== buffer.length) throw new Error('GLB BIN chunk length mismatch.');
  return { json, jsonLength, binLength };
}

function vectorMin(points) { return [0, 1, 2].map((axis) => Math.min(...points.map((point) => point[axis]))); }
function vectorMax(points) { return [0, 1, 2].map((axis) => Math.max(...points.map((point) => point[axis]))); }
