import * as THREE from 'three';

export function createHrlSurfaceThreeGeometryV1(deformer) {
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(deformer.positions, 3).setUsage(THREE.DynamicDrawUsage);
  const normal = new THREE.BufferAttribute(deformer.normals, 3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', position);
  geometry.setAttribute('normal', normal);
  geometry.setIndex(new THREE.BufferAttribute(deformer.indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const unsubscribe = deformer.onChange(() => {
    position.array = deformer.positions;
    normal.array = deformer.normals;
    position.clearUpdateRanges(); normal.clearUpdateRanges();
    position.addUpdateRange(0, deformer.positions.length);
    normal.addUpdateRange(0, deformer.normals.length);
    position.needsUpdate = true; normal.needsUpdate = true;
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  });
  geometry.userData.hrlSurface = { schema: deformer.header.schema, topologyFingerprint: deformer.header.topology?.topologyFingerprint, unsubscribe };
  return geometry;
}
