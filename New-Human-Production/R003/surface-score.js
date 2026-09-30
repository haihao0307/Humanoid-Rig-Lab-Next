import * as THREE from 'three';

export const HUMAN_SURFACE_SCORE_SCHEMA = 'kaopu/human_surface_score@0.1';

function cloneTexture(texture) {
  if (!texture?.isTexture) return texture;
  const clone = texture.clone();
  clone.needsUpdate = true;
  return clone;
}

function cloneMaterial(material) {
  if (!material) return new THREE.MeshStandardMaterial({ color: 0x999999 });
  const clone = material.clone();
  for (const key of Object.keys(clone)) {
    if (clone[key]?.isTexture) clone[key] = cloneTexture(clone[key]);
  }
  clone.userData = { ...material.userData, surfaceReplay: true };
  return clone;
}

function cloneMaterialSet(material) {
  return Array.isArray(material) ? material.map(cloneMaterial) : cloneMaterial(material);
}

function attributeArray(attribute) {
  return attribute?.isInterleavedBufferAttribute ? attribute.data.array : attribute?.array;
}

function geometryByteCount(geometry) {
  let bytes = 0;
  let streams = 0;
  for (const attribute of Object.values(geometry.attributes || {})) {
    const array = attributeArray(attribute);
    bytes += array?.byteLength || 0;
    streams += 1;
  }
  if (geometry.index?.array) {
    bytes += geometry.index.array.byteLength;
    streams += 1;
  }
  for (const list of Object.values(geometry.morphAttributes || {})) {
    for (const attribute of list) {
      const array = attributeArray(attribute);
      bytes += array?.byteLength || 0;
      streams += 1;
    }
  }
  return { bytes, streams };
}

function fnvBytes(hash, array) {
  if (!array) return hash >>> 0;
  const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  for (let index = 0; index < bytes.length; index += 1) {
    hash ^= bytes[index];
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function arraysMatch(source, replay) {
  if (!source || !replay || source.byteLength !== replay.byteLength) return false;
  const a = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  const b = new Uint8Array(replay.buffer, replay.byteOffset, replay.byteLength);
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false;
  }
  return true;
}

/**
 * Reads every renderable mesh from the teacher and creates independent
 * Geometry, Material and Texture objects. The teacher hierarchy is flattened
 * into matrices relative to the teacher root; no primitive body pieces are
 * introduced.
 */
export function buildHumanSurfaceReplay(teacher, sourceIdentity) {
  if (!teacher?.isObject3D) throw new Error('A parsed USD teacher Object3D is required.');
  teacher.updateMatrixWorld(true);

  const rootInverse = teacher.matrixWorld.clone().invert();
  const replay = new THREE.Group();
  replay.name = 'HumanSurfaceReplay_R003';

  const materialSet = new Set();
  const textureSet = new Set();
  const score = {
    schema: HUMAN_SURFACE_SCORE_SCHEMA,
    source: structuredClone(sourceIdentity || {}),
    shorts: 'preserved',
    primitiveBodyAssembly: false,
    geometryByteExact: true,
    vertices: 0,
    triangles: 0,
    geometryBytes: 0,
    attributeStreams: 0,
    materials: 0,
    textures: 0,
    hashFNV32: null,
    meshes: []
  };

  let hash = 2166136261;

  teacher.traverse((sourceMesh) => {
    if (!sourceMesh.isMesh || !sourceMesh.geometry?.attributes?.position) return;

    const sourceGeometry = sourceMesh.geometry;
    const geometry = sourceGeometry.clone();
    geometry.userData = { ...sourceGeometry.userData, surfaceReplay: true };

    const relativeMatrix = rootInverse.clone().multiply(sourceMesh.matrixWorld);
    const material = cloneMaterialSet(sourceMesh.material);
    const replayMesh = new THREE.Mesh(geometry, material);
    replayMesh.name = `${sourceMesh.name || 'mesh'}_surface_replay`;
    replayMesh.matrix.copy(relativeMatrix);
    replayMesh.matrixAutoUpdate = false;
    replayMesh.castShadow = true;
    replayMesh.receiveShadow = true;
    replay.add(replayMesh);

    const sourceAttributeNames = Object.keys(sourceGeometry.attributes || {});
    const replayAttributeNames = Object.keys(geometry.attributes || {});
    if (sourceAttributeNames.join('|') !== replayAttributeNames.join('|')) {
      score.geometryByteExact = false;
    }

    for (const name of sourceAttributeNames) {
      const sourceArray = attributeArray(sourceGeometry.attributes[name]);
      const replayArray = attributeArray(geometry.attributes[name]);
      if (!arraysMatch(sourceArray, replayArray)) score.geometryByteExact = false;
      hash = fnvBytes(hash, replayArray);
    }

    if (sourceGeometry.index?.array || geometry.index?.array) {
      if (!arraysMatch(sourceGeometry.index?.array, geometry.index?.array)) {
        score.geometryByteExact = false;
      }
      hash = fnvBytes(hash, geometry.index?.array);
    }

    const position = geometry.attributes.position;
    const triangles = geometry.index ? geometry.index.count / 3 : position.count / 3;
    const byteCount = geometryByteCount(geometry);

    score.vertices += position.count;
    score.triangles += triangles;
    score.geometryBytes += byteCount.bytes;
    score.attributeStreams += byteCount.streams;

    const materials = Array.isArray(material) ? material : [material];
    for (const item of materials) {
      materialSet.add(item);
      for (const value of Object.values(item)) {
        if (value?.isTexture) textureSet.add(value);
      }
    }

    score.meshes.push({
      sourceName: sourceMesh.name || '',
      replayName: replayMesh.name,
      vertices: position.count,
      triangles: Math.round(triangles),
      attributes: sourceAttributeNames,
      indexed: Boolean(geometry.index),
      groups: geometry.groups.length,
      morphTargets: Object.values(geometry.morphAttributes || {}).reduce(
        (total, list) => total + list.length,
        0
      ),
      relativeMatrix: relativeMatrix.toArray()
    });
  });

  score.materials = materialSet.size;
  score.textures = textureSet.size;
  score.hashFNV32 = (hash >>> 0).toString(16).padStart(8, '0');
  replay.userData.surfaceScore = score;

  if (!score.meshes.length) throw new Error('The USD teacher contains no renderable mesh surfaces.');
  return { replay, score };
}

export function createSurfaceSamplePoints(replay, maximumPointsPerMesh = 12000) {
  const root = new THREE.Group();
  root.name = 'HumanSurfaceSamplePoints_R003';
  let count = 0;

  replay.traverse((mesh) => {
    if (!mesh.isMesh || !mesh.geometry?.attributes?.position) return;
    const source = mesh.geometry.attributes.position;
    const step = Math.max(1, Math.ceil(source.count / maximumPointsPerMesh));
    const values = new Float32Array(Math.ceil(source.count / step) * 3);
    let write = 0;

    for (let index = 0; index < source.count; index += step) {
      values[write++] = source.getX(index);
      values[write++] = source.getY(index);
      values[write++] = source.getZ(index);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(values.subarray(0, write), 3));
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: 0x83ffd1,
        size: 0.006,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.8,
        depthWrite: false
      })
    );
    points.matrix.copy(mesh.matrix);
    points.matrixAutoUpdate = false;
    root.add(points);
    count += write / 3;
  });

  root.userData.samplePointCount = count;
  return root;
}
