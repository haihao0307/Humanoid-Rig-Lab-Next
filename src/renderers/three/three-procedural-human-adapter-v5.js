import * as THREE from 'three';
import { RENDERER_ADAPTER_INPUT_V5_SCHEMA } from '../../modules/human-core-v5/procedural-deform/procedural-deform-frame-v5.js';

export const PROCEDURAL_HUMAN_SOFTWARE_BUFFER_LIMIT_V5 = 48 * 1024;

export class ThreeProceduralHumanAdapterV5 {
  constructor({ material = null, displayMode = 'surface' } = {}) {
    this.geometry = new THREE.BufferGeometry();
    this.material = material ?? createSurfaceMaterial();
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'HumanCoreV5ProceduralSurface';
    this.topologyFingerprint = null;
    this.lastUploadTimeMs = 0;
    this.ownsMaterial = !material;
    this.setDisplayMode(displayMode);
  }

  update(input) {
    assertRendererInput(input);
    const started = performance.now();
    if (this.topologyFingerprint !== input.topologyFingerprint) this.replaceTopology(input);
    else {
      updateDynamicAttribute(this.geometry.getAttribute('position'), input.positions);
      updateDynamicAttribute(this.geometry.getAttribute('normal'), input.normals);
    }
    this.geometry.computeBoundingBox();
    this.geometry.computeBoundingSphere();
    this.lastUploadTimeMs = performance.now() - started;
    return this.getDiagnostics();
  }

  replaceTopology(input) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', createDynamicAttribute(new Float32Array(input.positions), 3));
    geometry.setAttribute('normal', createDynamicAttribute(new Float32Array(input.normals), 3));
    geometry.setIndex(createStaticAttribute(new Uint32Array(input.indices), 1));
    geometry.setAttribute('regionId', createStaticUint16Attribute(new Uint16Array(input.regionIds), 4));
    geometry.setAttribute('color', createStaticAttribute(createRegionColors(input.regionIds), 3));
    this.geometry.dispose();
    this.geometry = geometry;
    this.mesh.geometry = geometry;
    this.topologyFingerprint = input.topologyFingerprint;
  }

  setDisplayMode(mode) {
    const normalized = normalizeDisplayMode(mode);
    this.displayMode = normalized;
    applyDisplayMode(this.material, normalized);
    return normalized;
  }

  setMaterial(material, { disposePrevious = this.ownsMaterial } = {}) {
    if (disposePrevious) this.material.dispose();
    this.material = material;
    this.mesh.material = material;
    this.ownsMaterial = false;
    applyDisplayMode(this.material, this.displayMode);
  }

  getObject3D() { return this.mesh; }
  getDiagnostics() {
    return {
      adapter: 'three-procedural-human-adapter-v5',
      uploadMode: 'single-mesh-dynamic-buffer',
      topologyFingerprint: this.topologyFingerprint,
      vertexCount: this.geometry.getAttribute('position')?.count ?? 0,
      triangleCount: (this.geometry.index?.count ?? 0) / 3,
      chunkCount: this.topologyFingerprint ? 1 : 0,
      maximumBufferByteLength: maximumGeometryBufferByteLength(this.geometry),
      rendererUploadTimeMs: this.lastUploadTimeMs,
      displayMode: this.displayMode,
      frontSideSurface: this.material.side === THREE.FrontSide,
      dynamicAttributeObjectsStable: true,
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

export class ChunkedProceduralHumanAdapterV5 {
  constructor({
    material = null,
    displayMode = 'surface',
    maximumBufferByteLength = PROCEDURAL_HUMAN_SOFTWARE_BUFFER_LIMIT_V5,
  } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'HumanCoreV5ProceduralSurface';
    this.material = material ?? createSurfaceMaterial();
    this.ownsMaterial = !material;
    this.maximumBufferByteLength = normalizeBufferLimit(maximumBufferByteLength);
    this.topologyFingerprint = null;
    this.chunks = [];
    this.activeChunkCount = 0;
    this.logicalVertexCount = 0;
    this.logicalTriangleCount = 0;
    this.lastUploadTimeMs = 0;
    this.topologyReplacementCount = 0;
    this.runtimeGeometryDisposeCount = 0;
    this.setDisplayMode(displayMode);
  }

  update(input) {
    assertRendererInput(input);
    const started = performance.now();
    if (this.topologyFingerprint !== input.topologyFingerprint) this.replaceTopology(input);
    else this.updateDynamicData(input);
    this.lastUploadTimeMs = performance.now() - started;
    return this.getDiagnostics();
  }

  replaceTopology(input) {
    const descriptors = partitionGlobalTopology(input.indices, this.maximumBufferByteLength);
    const globalColors = createRegionColors(input.regionIds);
    const bounds = createGlobalBounds(input.positions);
    while (this.chunks.length < descriptors.length) {
      const chunkIndex = this.chunks.length;
      const geometry = createPooledChunkGeometry(this.maximumBufferByteLength);
      const mesh = new THREE.Mesh(geometry, this.material);
      mesh.name = `HumanCoreV5ProceduralSurfaceChunk:${chunkIndex}`;
      mesh.userData.logicalSurface = 'HumanCoreV5ProceduralSurface';
      mesh.userData.chunkIndex = chunkIndex;
      mesh.visible = false;
      this.group.add(mesh);
      this.chunks.push({
        globalVertexIndices: new Uint32Array(0),
        localIndexCount: 0,
        geometry,
        mesh,
      });
    }
    for (let chunkIndex = 0; chunkIndex < this.chunks.length; chunkIndex += 1) {
      const chunk = this.chunks[chunkIndex];
      const descriptor = descriptors[chunkIndex];
      if (descriptor) writePooledChunkTopology(chunk, input, descriptor, globalColors, bounds);
      else deactivatePooledChunk(chunk);
    }
    this.activeChunkCount = descriptors.length;
    this.logicalVertexCount = input.positions.length / 3;
    this.logicalTriangleCount = input.indices.length / 3;
    this.topologyFingerprint = input.topologyFingerprint;
    this.topologyReplacementCount += 1;
  }

  updateDynamicData(input) {
    const bounds = createGlobalBounds(input.positions);
    for (const chunk of this.chunks.slice(0, this.activeChunkCount)) {
      copyGlobalVec3ToLocal(input.positions, chunk.globalVertexIndices, chunk.geometry.getAttribute('position').array);
      copyGlobalVec3ToLocal(input.normals, chunk.globalVertexIndices, chunk.geometry.getAttribute('normal').array);
      markAttributeUpdated(chunk.geometry.getAttribute('position'), chunk.globalVertexIndices.length * 3);
      markAttributeUpdated(chunk.geometry.getAttribute('normal'), chunk.globalVertexIndices.length * 3);
      applyGlobalBounds(chunk.geometry, bounds);
    }
  }

  setDisplayMode(mode) {
    const normalized = normalizeDisplayMode(mode);
    this.displayMode = normalized;
    applyDisplayMode(this.material, normalized);
    return normalized;
  }

  setMaterial(material, { disposePrevious = this.ownsMaterial } = {}) {
    if (disposePrevious) this.material.dispose();
    this.material = material;
    for (const chunk of this.chunks) chunk.mesh.material = material;
    this.ownsMaterial = false;
    applyDisplayMode(this.material, this.displayMode);
  }

  getObject3D() { return this.group; }
  getDiagnostics() {
    const activeChunks = this.chunks.slice(0, this.activeChunkCount);
    const uploadedVertexCount = activeChunks.reduce((sum, chunk) => sum + chunk.globalVertexIndices.length, 0);
    return {
      adapter: 'chunked-procedural-human-adapter-v5',
      uploadMode: 'software-safe-pooled-chunk-dynamic-buffer',
      topologyFingerprint: this.topologyFingerprint,
      vertexCount: this.logicalVertexCount,
      triangleCount: this.logicalTriangleCount,
      chunkCount: this.activeChunkCount,
      pooledChunkCount: this.chunks.length,
      duplicatedBoundaryVertexCount: Math.max(0, uploadedVertexCount - this.logicalVertexCount),
      maximumBufferByteLength: Math.max(0, ...activeChunks.map((chunk) => maximumGeometryBufferByteLength(chunk.geometry))),
      configuredBufferLimit: this.maximumBufferByteLength,
      rendererUploadTimeMs: this.lastUploadTimeMs,
      displayMode: this.displayMode,
      frontSideSurface: this.material.side === THREE.FrontSide,
      dynamicAttributeObjectsStable: true,
      bufferObjectsStableAcrossTopology: true,
      topologyReplacementMode: 'fixed-capacity-buffer-pool',
      topologyReplacementCount: this.topologyReplacementCount,
      runtimeGeometryDisposeCount: this.runtimeGeometryDisposeCount,
      localIndexType: 'Uint32Array',
      globalTopologyPreserved: true,
      logicalSurfaceLayerCount: this.topologyFingerprint ? 1 : 0,
      computesBodyDNA: false,
      mutatesPose: false,
      mutatesRig: false,
    };
  }

  disposeChunks() {
    for (const chunk of this.chunks) {
      this.group.remove(chunk.mesh);
      chunk.geometry.dispose();
    }
    this.chunks = [];
    this.activeChunkCount = 0;
  }

  dispose() {
    this.disposeChunks();
    if (this.ownsMaterial) this.material.dispose();
    this.group.removeFromParent();
  }
}

export function shouldUseChunkedProceduralHumanAdapterV5(adapterInfo = null, { force = false } = {}) {
  if (force) return true;
  const source = adapterInfo && typeof adapterInfo === 'object' ? adapterInfo : {};
  if (source.isFallbackAdapter === true || source.isFallbackAdapter === 'true') return true;
  return /swiftshader|llvmpipe|software|fallback/.test([
    source.vendor, source.architecture, source.device, source.description,
  ].filter(Boolean).join(' ').toLowerCase());
}

function createSurfaceMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0xd7c7b4, roughness: 0.72, metalness: 0.02, side: THREE.FrontSide });
}

function createDynamicAttribute(array, itemSize) {
  return new THREE.BufferAttribute(array, itemSize).setUsage(THREE.DynamicDrawUsage);
}

function createStaticAttribute(array, itemSize) {
  return new THREE.BufferAttribute(array, itemSize).setUsage(THREE.StaticDrawUsage);
}

function createStaticUint16Attribute(array, itemSize) {
  return new THREE.Uint16BufferAttribute(array, itemSize).setUsage(THREE.StaticDrawUsage);
}

function updateDynamicAttribute(attribute, source) {
  if (!attribute || attribute.array.length !== source.length) throw new Error('Renderer topology changed without a new topology fingerprint.');
  attribute.array.set(source);
  markAttributeUpdated(attribute);
}

function markAttributeUpdated(attribute, count = attribute.array.length) {
  attribute.clearUpdateRanges();
  attribute.addUpdateRange(0, count);
  attribute.needsUpdate = true;
}

function createPooledChunkGeometry(maximumBufferByteLength) {
  const maximumVertices = Math.max(3, Math.floor(maximumBufferByteLength / (3 * Float32Array.BYTES_PER_ELEMENT)));
  const maximumIndexCount = Math.max(3, Math.floor(maximumBufferByteLength / Uint32Array.BYTES_PER_ELEMENT));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', createDynamicAttribute(new Float32Array(maximumVertices * 3), 3));
  geometry.setAttribute('normal', createDynamicAttribute(new Float32Array(maximumVertices * 3), 3));
  geometry.setIndex(createDynamicAttribute(new Uint32Array(maximumIndexCount), 1));
  geometry.setAttribute('color', createDynamicAttribute(new Float32Array(maximumVertices * 3), 3));
  geometry.setDrawRange(0, 0);
  return geometry;
}

function writePooledChunkTopology(chunk, input, descriptor, globalColors, bounds) {
  const position = chunk.geometry.getAttribute('position');
  const normal = chunk.geometry.getAttribute('normal');
  const color = chunk.geometry.getAttribute('color');
  const index = chunk.geometry.index;
  if (descriptor.globalVertexIndices.length > position.count || descriptor.localIndices.length > index.count) {
    throw new Error('Procedural renderer chunk exceeds its fixed GPU buffer capacity.');
  }
  copyGlobalVec3ToLocal(input.positions, descriptor.globalVertexIndices, position.array);
  copyGlobalVec3ToLocal(input.normals, descriptor.globalVertexIndices, normal.array);
  copyGlobalVec3ToLocal(globalColors, descriptor.globalVertexIndices, color.array);
  index.array.set(descriptor.localIndices, 0);
  markAttributeUpdated(position, descriptor.globalVertexIndices.length * 3);
  markAttributeUpdated(normal, descriptor.globalVertexIndices.length * 3);
  markAttributeUpdated(color, descriptor.globalVertexIndices.length * 3);
  markAttributeUpdated(index, descriptor.localIndices.length);
  chunk.geometry.setDrawRange(0, descriptor.localIndices.length);
  applyGlobalBounds(chunk.geometry, bounds);
  chunk.globalVertexIndices = descriptor.globalVertexIndices;
  chunk.localIndexCount = descriptor.localIndices.length;
  chunk.mesh.visible = true;
}

function deactivatePooledChunk(chunk) {
  chunk.geometry.setDrawRange(0, 0);
  chunk.globalVertexIndices = new Uint32Array(0);
  chunk.localIndexCount = 0;
  chunk.mesh.visible = false;
}

function createGlobalBounds(positions) {
  const box = new THREE.Box3().setFromArray(positions);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  return { box, sphere };
}

function applyGlobalBounds(geometry, bounds) {
  if (geometry.boundingBox) geometry.boundingBox.copy(bounds.box);
  else geometry.boundingBox = bounds.box.clone();
  if (geometry.boundingSphere) geometry.boundingSphere.copy(bounds.sphere);
  else geometry.boundingSphere = bounds.sphere.clone();
}

function partitionGlobalTopology(globalIndices, maximumBufferByteLength) {
  const maximumVertices = Math.max(3, Math.floor(maximumBufferByteLength / (3 * Float32Array.BYTES_PER_ELEMENT)));
  const maximumIndexCount = Math.max(3, Math.floor(maximumBufferByteLength / Uint32Array.BYTES_PER_ELEMENT));
  const chunks = [];
  let globalToLocal = new Map();
  let globalVertexIndices = [];
  let localIndices = [];
  const flush = () => {
    if (!localIndices.length) return;
    chunks.push({ globalVertexIndices: Uint32Array.from(globalVertexIndices), localIndices: Uint32Array.from(localIndices) });
    globalToLocal = new Map();
    globalVertexIndices = [];
    localIndices = [];
  };
  for (let offset = 0; offset < globalIndices.length; offset += 3) {
    const triangle = [globalIndices[offset], globalIndices[offset + 1], globalIndices[offset + 2]];
    const addedVertices = triangle.reduce((count, globalVertex) => count + (globalToLocal.has(globalVertex) ? 0 : 1), 0);
    if (localIndices.length && (globalVertexIndices.length + addedVertices > maximumVertices || localIndices.length + 3 > maximumIndexCount)) flush();
    for (const globalVertex of triangle) {
      let localVertex = globalToLocal.get(globalVertex);
      if (localVertex === undefined) {
        localVertex = globalVertexIndices.length;
        if (localVertex >= maximumVertices) throw new Error('Chunk local index exceeds its fixed GPU buffer capacity.');
        globalToLocal.set(globalVertex, localVertex);
        globalVertexIndices.push(globalVertex);
      }
      localIndices.push(localVertex);
    }
  }
  flush();
  return chunks;
}

function copyGlobalVec3ToLocal(source, globalVertexIndices, target) {
  copyGlobalTupleToLocal(source, globalVertexIndices, target, 3);
}

function copyGlobalTupleToLocal(source, globalVertexIndices, target, tupleSize) {
  for (let localVertex = 0; localVertex < globalVertexIndices.length; localVertex += 1) {
    const globalOffset = globalVertexIndices[localVertex] * tupleSize;
    const localOffset = localVertex * tupleSize;
    for (let component = 0; component < tupleSize; component += 1) target[localOffset + component] = source[globalOffset + component];
  }
}

function maximumGeometryBufferByteLength(geometry) {
  const attributes = Object.values(geometry.attributes).map((attribute) => attribute.array.byteLength);
  if (geometry.index) attributes.push(geometry.index.array.byteLength);
  return Math.max(0, ...attributes);
}

function normalizeDisplayMode(mode) {
  return ['surface', 'wireframe', 'region-ownership', 'orientation-diagnostic'].includes(mode) ? mode : 'surface';
}

function applyDisplayMode(material, mode) {
  material.wireframe = mode === 'wireframe';
  material.side = mode === 'orientation-diagnostic' ? THREE.DoubleSide : THREE.FrontSide;
  if ('vertexColors' in material) material.vertexColors = mode === 'region-ownership';
  material.needsUpdate = true;
}

function normalizeBufferLimit(value) {
  const parsed = Math.floor(Number(value) || PROCEDURAL_HUMAN_SOFTWARE_BUFFER_LIMIT_V5);
  return Math.max(4 * 1024, Math.min(parsed, 64 * 1024));
}

function assertRendererInput(input) {
  if (input?.schema !== RENDERER_ADAPTER_INPUT_V5_SCHEMA) throw new Error('Procedural human Three.js adapters require RendererAdapterInput V5.');
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
