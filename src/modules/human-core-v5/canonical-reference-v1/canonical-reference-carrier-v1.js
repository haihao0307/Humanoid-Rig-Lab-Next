export const CANONICAL_REFERENCE_CARRIER_V1_SCHEMA = 'humanoid_rig/canonical_reference_carrier@1.0';

export function createCanonicalReferenceStaticCarrierV1({
  THREE,
  staticData,
  material = null,
  name = 'CanonicalReferenceStaticCarrierV1',
} = {}) {
  if (!THREE?.BufferGeometry || !THREE?.Mesh) throw new Error('Canonical reference carrier requires THREE.');
  if (!staticData?.positions || !staticData?.normals || !staticData?.indices) {
    throw new Error('Canonical reference carrier requires extracted static POSITION, NORMAL and index arrays.');
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(staticData.positions), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(staticData.normals), 3));
  geometry.setIndex(new THREE.BufferAttribute(cloneIndexArray(staticData.indices), 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const resolvedMaterial = material ?? new THREE.MeshStandardMaterial({
    color: 0xbca58f,
    roughness: 0.78,
    metalness: 0,
    side: THREE.FrontSide,
  });
  if (resolvedMaterial.side !== THREE.FrontSide) {
    throw new Error('Canonical reference static carrier must use THREE.FrontSide.');
  }

  const mesh = new THREE.Mesh(geometry, resolvedMaterial);
  mesh.name = name;
  mesh.matrixAutoUpdate = false;
  mesh.matrix.fromArray(staticData.sourceWorldMatrix);
  mesh.matrixWorldNeedsUpdate = true;
  mesh.updateMatrixWorld(true);
  mesh.userData.canonicalReference = Object.freeze({
    schema: CANONICAL_REFERENCE_CARRIER_V1_SCHEMA,
    sourceUsesSkinning: false,
    ignoredAttributes: [...(staticData.ignoredAttributes ?? [])],
    sourceNodeMatrix: [...staticData.sourceNodeMatrix],
    sourceWorldMatrix: [...staticData.sourceWorldMatrix],
  });

  if (mesh.isSkinnedMesh || mesh.skeleton || mesh.bindMatrix || mesh.bindMatrixInverse) {
    throw new Error('Static truth carrier unexpectedly exposes skinning state.');
  }

  return {
    schema: CANONICAL_REFERENCE_CARRIER_V1_SCHEMA,
    type: 'CanonicalReferenceStaticCarrierV1',
    mesh,
    geometry,
    material: resolvedMaterial,
    sourceUsesSkinning: false,
  };
}

function cloneIndexArray(indices) {
  if (indices instanceof Uint8Array) return new Uint8Array(indices);
  if (indices instanceof Uint16Array) return new Uint16Array(indices);
  if (indices instanceof Uint32Array) return new Uint32Array(indices);
  throw new Error(`Unsupported canonical reference index array: ${indices?.constructor?.name ?? typeof indices}.`);
}
