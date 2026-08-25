import * as THREE from 'three';
import { RENDERER_ADAPTER_INPUT_V5_SCHEMA } from '../../modules/human-core-v5/procedural-deform/procedural-deform-frame-v5.js';

export class ThreeProceduralHumanAdapterV5 {
  constructor({ material = null, displayMode = 'surface' } = {}) {
    this.geometry = new THREE.BufferGeometry();
    this.material = material ?? new THREE.MeshStandardMaterial({ color: 0xd7c7b4, roughness: 0.72, metalness: 0.02, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'HumanCoreV5ProceduralSurface';
    this.topologyFingerprint = null;
    this.lastUploadTimeMs = 0;
    this.ownsMaterial = !material;
    this.setDisplayMode(displayMode);
  }

  update(input) {
    if (input?.schema !== RENDERER_ADAPTER_INPUT_V5_SCHEMA) throw new Error('ThreeProceduralHumanAdapterV5 requires RendererAdapterInput V5.');
    const started = performance.now();
    const topologyChanged = this.topologyFingerprint !== input.topologyFingerprint;
    if (topologyChanged) {
      this.geometry.setAttribute('position', new THREE.BufferAttribute(input.positions, 3));
      this.geometry.setAttribute('normal', new THREE.BufferAttribute(input.normals, 3));
      this.geometry.setIndex(new THREE.BufferAttribute(input.indices, 1));
      this.geometry.setAttribute('regionId', new THREE.Uint16BufferAttribute(input.regionIds, 4));
      this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(createRegionColors(input.regionIds), 3));
      this.topologyFingerprint = input.topologyFingerprint;
    } else {
      updateAttribute(this.geometry.getAttribute('position'), input.positions);
      updateAttribute(this.geometry.getAttribute('normal'), input.normals);
    }
    this.geometry.computeBoundingBox();
    this.geometry.computeBoundingSphere();
    this.lastUploadTimeMs = performance.now() - started;
    return this.getDiagnostics();
  }

  setDisplayMode(mode) {
    const normalized = ['surface', 'wireframe', 'region-ownership'].includes(mode) ? mode : 'surface';
    this.displayMode = normalized;
    this.material.wireframe = normalized === 'wireframe';
    if ('vertexColors' in this.material) this.material.vertexColors = normalized === 'region-ownership';
    this.material.needsUpdate = true;
    return normalized;
  }

  setMaterial(material, { disposePrevious = this.ownsMaterial } = {}) {
    if (disposePrevious) this.material.dispose();
    this.material = material;
    this.mesh.material = material;
    this.ownsMaterial = false;
  }

  getObject3D() { return this.mesh; }
  getDiagnostics() {
    return {
      adapter: 'three-procedural-human-adapter-v5',
      topologyFingerprint: this.topologyFingerprint,
      vertexCount: this.geometry.getAttribute('position')?.count ?? 0,
      triangleCount: (this.geometry.index?.count ?? 0) / 3,
      rendererUploadTimeMs: this.lastUploadTimeMs,
      displayMode: this.displayMode,
      computesBodyDNA: false,
      mutatesPose: false,
      mutatesRig: false,
    };
  }
  dispose() {
    this.geometry.dispose();
    if (this.ownsMaterial) this.material.dispose();
    this.mesh.removeFromParent();
  }
}

function updateAttribute(attribute, source) {
  if (!attribute || attribute.array.length !== source.length) throw new Error('Renderer topology changed without a new topology fingerprint.');
  attribute.array.set(source);
  attribute.needsUpdate = true;
}

const REGION_PALETTE = Object.freeze([
  [0.89, 0.52, 0.42], [0.95, 0.72, 0.34], [0.65, 0.78, 0.38], [0.33, 0.78, 0.62],
  [0.27, 0.68, 0.88], [0.43, 0.56, 0.91], [0.64, 0.48, 0.88], [0.86, 0.43, 0.73],
  [0.89, 0.48, 0.52], [0.76, 0.66, 0.35], [0.47, 0.75, 0.42], [0.31, 0.72, 0.72],
  [0.36, 0.59, 0.87], [0.56, 0.50, 0.88], [0.76, 0.46, 0.82], [0.88, 0.45, 0.62],
  [0.72, 0.72, 0.76],
]);

function createRegionColors(regionIds) {
  const vertexCount = regionIds.length / 4;
  const colors = new Float32Array(vertexCount * 3);
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const color = REGION_PALETTE[regionIds[vertex * 4] % REGION_PALETTE.length];
    colors.set(color, vertex * 3);
  }
  return colors;
}
