import { identityMatrix4V1 } from './canonical-reference-loader-v1.js';

export const CANONICAL_REFERENCE_STATIC_EXTRACTOR_V1_SCHEMA = 'humanoid_rig/canonical_reference_static_extractor@1.0';

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

export function buildCanonicalReferenceStaticGlbV1({ sourceParsed, sourceData } = {}) {
  if (!sourceParsed?.gltf || !sourceData?.positions || !sourceData?.normals || !sourceData?.indices) {
    throw new Error('Canonical static extraction requires parsed source glTF and extracted static geometry.');
  }
  if (sourceData.vertexCount !== sourceData.positions.length / 3 || sourceData.vertexCount !== sourceData.normals.length / 3) {
    throw new Error('Canonical source POSITION/NORMAL counts are inconsistent.');
  }
  if (sourceData.indexCount !== sourceData.indices.length || sourceData.indexCount % 3 !== 0) {
    throw new Error('Canonical source index data is inconsistent.');
  }

  const segments = [
    createSegment('POSITION', sourceData.positions, 34962),
    createSegment('NORMAL', sourceData.normals, 34962),
    createSegment('INDEX', sourceData.indices, 34963),
  ];
  let binaryByteLength = 0;
  for (const segment of segments) {
    binaryByteLength = align4(binaryByteLength);
    segment.byteOffset = binaryByteLength;
    binaryByteLength += segment.bytes.byteLength;
  }
  binaryByteLength = align4(binaryByteLength);
  const binaryChunk = new Uint8Array(binaryByteLength);
  for (const segment of segments) binaryChunk.set(segment.bytes, segment.byteOffset);

  const sourceMaterial = sourceParsed.gltf.materials?.[sourceData.primitiveIndex === 0
    ? sourceParsed.gltf.meshes[sourceData.meshIndex].primitives[sourceData.primitiveIndex].material
    : null];
  const worldMatrix = [...sourceData.sourceWorldMatrix];
  const canonical = {
    asset: {
      version: '2.0',
      generator: 'Humanoid-Rig-Lab-Next Task16A R2A exact static extractor v1',
      extras: {
        sourceProject: 'MakeHuman Community MPFB2',
        sourceRepository: 'https://github.com/makehumancommunity/mpfb2',
        sourceCommit: '437dd513888a92399d1d3200d2e80859fae55abc',
        sourceFile: 'src/mpfb/data/3dobjs/base.obj',
        sourceConvertedAsset: 'assets/human/production-surface-v2/candidate-a/neutral-body-candidate-a.glb',
        license: 'CC0-1.0',
        sourceReferencePose: 'makehuman-source-rest-reference',
        sourceReferencePoseClass: 'a-pose-like',
        sourceReferencePoseModified: false,
        shapeModified: false,
        topologyModified: false,
      },
    },
    scene: 0,
    scenes: [{ name: 'CanonicalReferenceStaticSceneV1', nodes: [0] }],
    nodes: [{ name: 'MakeHumanReferenceNeutralStaticV1', mesh: 0, matrix: worldMatrix }],
    meshes: [{
      name: 'MakeHumanReferenceNeutralStaticMeshV1',
      primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0, mode: 4 }],
    }],
    materials: [structuredClone(sourceMaterial ?? {
      name: 'CanonicalReferenceNeutralSkinV1',
      pbrMetallicRoughness: { baseColorFactor: [0.61, 0.37, 0.25, 1], metallicFactor: 0, roughnessFactor: 0.7 },
      doubleSided: false,
    })],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: sourceData.vertexCount,
        type: 'VEC3',
        min: [...(sourceData.positionAccessor.min ?? calculateMinMax(sourceData.positions).min)],
        max: [...(sourceData.positionAccessor.max ?? calculateMinMax(sourceData.positions).max)],
      },
      { bufferView: 1, componentType: 5126, count: sourceData.vertexCount, type: 'VEC3' },
      {
        bufferView: 2,
        componentType: sourceData.indexComponentType,
        count: sourceData.indexCount,
        type: 'SCALAR',
        min: [minimumIndex(sourceData.indices)],
        max: [maximumIndex(sourceData.indices)],
      },
    ],
    bufferViews: segments.map((segment) => ({
      buffer: 0,
      byteOffset: segment.byteOffset,
      byteLength: segment.bytes.byteLength,
      target: segment.target,
    })),
    buffers: [{ byteLength: binaryChunk.byteLength }],
  };

  assertCanonicalReferenceStaticStructureV1(canonical);
  const glbBytes = encodeGlb(canonical, binaryChunk);
  return {
    schema: CANONICAL_REFERENCE_STATIC_EXTRACTOR_V1_SCHEMA,
    type: 'CanonicalReferenceStaticGlbV1',
    gltf: canonical,
    binaryChunk,
    glbBytes,
    byteLength: glbBytes.byteLength,
    sourceWorldMatrix: worldMatrix,
    sourceReferencePose: 'makehuman-source-rest-reference',
    sourceReferencePoseClass: 'a-pose-like',
    sourceReferencePoseModified: false,
    shapeModified: false,
    topologyModified: false,
    vertexOrderModified: false,
    indexOrderModified: false,
    normalOrderModified: false,
    skinRemoved: true,
    skeletonRemoved: true,
    animationsRemoved: true,
  };
}

export function assertCanonicalReferenceStaticStructureV1(gltf) {
  const errors = [];
  if ((gltf.scenes?.length ?? 0) !== 1 || (gltf.nodes?.length ?? 0) !== 1 || (gltf.meshes?.length ?? 0) !== 1) errors.push('expected one scene, node and mesh');
  if ((gltf.meshes?.[0]?.primitives?.length ?? 0) !== 1) errors.push('expected one primitive');
  const primitive = gltf.meshes?.[0]?.primitives?.[0];
  if (!primitive || Object.keys(primitive.attributes ?? {}).join(',') !== 'POSITION,NORMAL') errors.push('attributes must be POSITION,NORMAL only');
  if (gltf.nodes?.[0]?.skin != null) errors.push('node skin must be absent');
  if ((gltf.skins?.length ?? 0) !== 0) errors.push('skins must be absent');
  if ((gltf.animations?.length ?? 0) !== 0) errors.push('animations must be absent');
  if ((gltf.nodes?.[0]?.matrix ?? identityMatrix4V1()).length !== 16) errors.push('canonical node matrix must contain 16 values');
  if (gltf.extensionsUsed?.includes('KHR_draco_mesh_compression')) errors.push('Draco is forbidden');
  if (gltf.extensionsUsed?.some((name) => /meshopt/i.test(name))) errors.push('Meshopt is forbidden');
  if (errors.length) throw new Error(`Invalid canonical static structure: ${errors.join('; ')}.`);
  return true;
}

function createSegment(name, values, target) {
  const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength).slice();
  return { name, bytes, target, byteOffset: 0 };
}

function encodeGlb(gltf, binaryChunk) {
  const encodedJson = new TextEncoder().encode(JSON.stringify(gltf));
  const paddedJsonLength = align4(encodedJson.byteLength);
  const paddedBinaryLength = align4(binaryChunk.byteLength);
  const totalLength = 12 + 8 + paddedJsonLength + 8 + paddedBinaryLength;
  const glb = new Uint8Array(totalLength);
  const view = new DataView(glb.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);
  view.setUint32(12, paddedJsonLength, true);
  view.setUint32(16, JSON_CHUNK, true);
  glb.fill(0x20, 20, 20 + paddedJsonLength);
  glb.set(encodedJson, 20);
  const binaryHeader = 20 + paddedJsonLength;
  view.setUint32(binaryHeader, paddedBinaryLength, true);
  view.setUint32(binaryHeader + 4, BIN_CHUNK, true);
  glb.set(binaryChunk, binaryHeader + 8);
  return glb;
}

function calculateMinMax(values) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let offset = 0; offset < values.length; offset += 3) {
    for (let component = 0; component < 3; component += 1) {
      min[component] = Math.min(min[component], values[offset + component]);
      max[component] = Math.max(max[component], values[offset + component]);
    }
  }
  return { min, max };
}

function minimumIndex(indices) {
  let result = Infinity;
  for (const value of indices) result = Math.min(result, value);
  return result;
}

function maximumIndex(indices) {
  let result = -Infinity;
  for (const value of indices) result = Math.max(result, value);
  return result;
}

function align4(value) {
  return (value + 3) & ~3;
}
