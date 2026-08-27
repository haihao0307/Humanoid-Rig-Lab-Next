import {
  SURFACE_CARRIER_V2_SCHEMA,
  assertFinalPoseReadOnly,
  assertSurfaceAssetDescriptor,
} from './surface-carrier-v2-contract.js';
import { loadSurfaceAssetReceiptV2, validateSurfaceAssetReceiptV2 } from './surface-asset-receipt-v2.js';
import { PerformanceDeformRigV2 } from './performance-deform-rig-v2.js';
import { SurfaceRetargetRuntimeV2 } from './surface-retarget-runtime-v2.js';

export class SurfaceCarrierV2 {
  constructor({ THREE, GLTFLoader, scene = null, rigCore, sourceReferenceFrame } = {}) {
    if (!THREE || !GLTFLoader || !Array.isArray(rigCore?.joints) || !sourceReferenceFrame?.joints) {
      throw new Error('SurfaceCarrierV2 requires THREE, GLTFLoader, rigCore, and a source Reference T frame.');
    }
    this.THREE = THREE;
    this.GLTFLoader = GLTFLoader;
    this.scene = scene;
    this.rigCore = rigCore;
    this.sourceReferenceFrame = sourceReferenceFrame;
    this.group = new THREE.Group();
    this.group.name = 'SurfaceCarrierV2';
    this.loadTimeMs = null;
    this.referencePoseSetupTimeMs = null;
    this.poseUpdateTimes = [];
    this.surfaceSampleTimes = [];
    this.loaded = false;
    scene?.add(this.group);
  }

  async load(assetDescriptor) {
    assertSurfaceAssetDescriptor(assetDescriptor);
    if (this.loaded) this.disposeAssetOnly();
    const started = performance.now();
    const loader = new this.GLTFLoader();
    const receiptPromise = assetDescriptor.receipt
      ? Promise.resolve(validateSurfaceAssetReceiptV2(assetDescriptor.receipt))
      : loadSurfaceAssetReceiptV2(assetDescriptor.receiptUrl);
    const gltfPromise = assetDescriptor.arrayBuffer
      ? loader.parseAsync(assetDescriptor.arrayBuffer, assetDescriptor.resourcePath ?? '')
      : loader.loadAsync(assetDescriptor.url);
    const [receipt, gltf] = await Promise.all([receiptPromise, gltfPromise]);
    const meshes = [];
    gltf.scene.traverse((object) => { if (object.isSkinnedMesh) meshes.push(object); });
    if (meshes.length !== 1) throw new Error(`Candidate A must contain exactly one SkinnedMesh; found ${meshes.length}.`);
    this.assetReceipt = receipt;
    this.assetScene = gltf.scene;
    this.mesh = meshes[0];
    this.skeleton = this.mesh.skeleton;
    this.group.add(this.assetScene);
    this.group.updateMatrixWorld(true);
    this.restGeometry = this.mesh.geometry.clone();
    this.inverseBindMatrices = new Float32Array(this.skeleton.boneInverses.length * 16);
    this.skeleton.boneInverses.forEach((matrix, index) => this.inverseBindMatrices.set(matrix.elements, index * 16));
    this.skinWeights = this.mesh.geometry.getAttribute('skinWeight').array;
    this.performanceRig = new PerformanceDeformRigV2({
      THREE: this.THREE,
      skeleton: this.skeleton,
      carrierGroup: this.group,
      rigCore: this.rigCore,
      sourceReferenceFrame: this.sourceReferenceFrame,
    });
    const bonesById = this.performanceRig.getJointMap();
    const jointIdByBone = new Map([...bonesById].map(([jointId, bone]) => [bone, jointId]));
    const parentIdById = new Map([...bonesById].map(([jointId, bone]) => [
      jointId,
      jointIdByBone.get(bone.parent) ?? null,
    ]));
    const templateLayer = {
      group: this.group,
      mesh: this.mesh,
      skeleton: this.skeleton,
      bonesById,
      parentIdById,
      orderedJointIds: [...bonesById.keys()],
      inverseBindMatrices: this.inverseBindMatrices,
      skinWeights: this.skinWeights,
      cacheSkinMatrices: () => {
        this.group.updateMatrixWorld(true);
        this.skeleton.update();
      },
    };
    const referenceStarted = performance.now();
    this.retargetRuntime = new SurfaceRetargetRuntimeV2({
      THREE: this.THREE,
      performanceRig: this.performanceRig,
      templateLayer,
      rigCore: this.rigCore,
      sourceReferenceFrame: this.sourceReferenceFrame,
    });
    this.referencePoseSetupTimeMs = performance.now() - referenceStarted;
    this.loadTimeMs = performance.now() - started;
    this.geometryMetrics = computeGeometryMetrics(this.mesh.geometry);
    this.loaded = true;
    return this;
  }

  getAssetReceipt() { return structuredClone(this.assetReceipt); }
  getMesh() { return this.mesh; }
  getSkeleton() { return this.skeleton; }
  getJointMap() { return this.performanceRig.getJointMap(); }
  getRestGeometry() { return this.restGeometry.clone(); }

  getDeformedGeometry() {
    const geometry = this.mesh.geometry.clone();
    geometry.setAttribute('position', new this.THREE.BufferAttribute(this.sampleDeformedPositions(), 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  applyFinalPose(finalPose) {
    assertFinalPoseReadOnly(finalPose);
    const authorityBefore = poseAuthorityFingerprint(finalPose);
    const started = performance.now();
    const result = this.retargetRuntime.applyFinalPose(finalPose);
    this.poseUpdateTimes.push(performance.now() - started);
    if (authorityBefore !== poseAuthorityFingerprint(finalPose)) throw new Error('SurfaceCarrierV2 attempted to mutate finalPose authority.');
    return result;
  }

  sampleDeformedPositions() {
    const started = performance.now();
    this.group.updateMatrixWorld(true);
    this.skeleton.update();
    const source = this.mesh.geometry.getAttribute('position');
    const result = new Float32Array(source.count * 3);
    const point = new this.THREE.Vector3();
    for (let index = 0; index < source.count; index += 1) {
      point.fromBufferAttribute(source, index);
      this.mesh.applyBoneTransform(index, point);
      point.toArray(result, index * 3);
    }
    this.surfaceSampleTimes.push(performance.now() - started);
    return result;
  }

  restoreAssetBind() { this.retargetRuntime.restoreAssetBind(); }
  restoreReferencePose() { return this.retargetRuntime.restoreReferencePose(); }
  getGeometryMetrics() { return structuredClone(this.geometryMetrics); }
  getRuntimeMetrics() {
    return {
      schema: SURFACE_CARRIER_V2_SCHEMA,
      loadTimeMs: this.loadTimeMs,
      referencePoseSetupTimeMs: this.referencePoseSetupTimeMs,
      poseUpdateTimeMs: [...this.poseUpdateTimes],
      medianPoseUpdateTimeMs: percentile(this.poseUpdateTimes, 0.5),
      p95PoseUpdateTimeMs: percentile(this.poseUpdateTimes, 0.95),
      surfaceSampleTimeMs: [...this.surfaceSampleTimes],
      medianSurfaceSampleTimeMs: percentile(this.surfaceSampleTimes, 0.5),
      glbByteSize: this.assetReceipt?.convertedSize ?? null,
      geometryMemoryEstimate: estimateGeometryBytes(this.mesh?.geometry),
      skinAttributeMemoryEstimate: estimateSkinBytes(this.mesh?.geometry),
      drawCalls: this.mesh ? 1 : 0,
      singleCandidateSurface: Boolean(this.mesh),
    };
  }

  disposeAssetOnly() {
    this.assetScene?.traverse((object) => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
      else object.material?.dispose?.();
    });
    this.assetScene?.removeFromParent();
    this.restGeometry?.dispose?.();
    this.mesh = null;
    this.skeleton = null;
    this.assetScene = null;
    this.loaded = false;
  }

  dispose() {
    this.disposeAssetOnly();
    this.group.removeFromParent();
    this.group.clear();
  }
}

function poseAuthorityFingerprint(finalPose) {
  return JSON.stringify({ rootPosition: finalPose.rootPosition, rootRotation: finalPose.rootRotation, localRotations: finalPose.localRotations });
}

function computeGeometryMetrics(geometry) {
  const vertexCount = geometry.getAttribute('position').count;
  const index = geometry.index.array;
  const edges = new Map();
  let degenerate = 0;
  const position = geometry.getAttribute('position');
  const a = [0, 0, 0]; const b = [0, 0, 0]; const c = [0, 0, 0];
  const adjacency = Array.from({ length: vertexCount }, () => []);
  for (let offset = 0; offset < index.length; offset += 3) {
    const triangle = [index[offset], index[offset + 1], index[offset + 2]];
    for (let edge = 0; edge < 3; edge += 1) {
      const left = triangle[edge]; const right = triangle[(edge + 1) % 3];
      const key = left < right ? `${left}:${right}` : `${right}:${left}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
      adjacency[left].push(right); adjacency[right].push(left);
    }
    position.getX(triangle[0]);
    for (let axis = 0; axis < 3; axis += 1) {
      const getter = axis === 0 ? 'getX' : axis === 1 ? 'getY' : 'getZ';
      a[axis] = position[getter](triangle[0]); b[axis] = position[getter](triangle[1]); c[axis] = position[getter](triangle[2]);
    }
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    if (Math.hypot(...cross) <= 1e-12) degenerate += 1;
  }
  const visited = new Uint8Array(vertexCount); let components = 0;
  for (let start = 0; start < vertexCount; start += 1) {
    if (visited[start]) continue;
    components += 1; const stack = [start]; visited[start] = 1;
    while (stack.length) for (const next of adjacency[stack.pop()]) if (!visited[next]) { visited[next] = 1; stack.push(next); }
  }
  return {
    vertexCount,
    triangleCount: index.length / 3,
    connectedComponentCount: components,
    boundaryEdgeCount: [...edges.values()].filter((count) => count === 1).length,
    nonManifoldEdgeCount: [...edges.values()].filter((count) => count > 2).length,
    degenerateTriangleRatio: degenerate / (index.length / 3),
  };
}

function estimateGeometryBytes(geometry) {
  if (!geometry) return 0;
  let bytes = geometry.index?.array?.byteLength ?? 0;
  for (const attribute of Object.values(geometry.attributes)) bytes += attribute.array.byteLength;
  return bytes;
}
function estimateSkinBytes(geometry) {
  return (geometry?.getAttribute('skinIndex')?.array?.byteLength ?? 0) + (geometry?.getAttribute('skinWeight')?.array?.byteLength ?? 0);
}
function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)];
}
