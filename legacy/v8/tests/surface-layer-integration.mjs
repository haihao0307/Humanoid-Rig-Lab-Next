import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSmplSkinLayer, SKIN_RUNTIME_BUILD } from '../src/smpl-skin.js';
import { applyBodyProfileToDefinition } from '../src/body-profile.js';
import { createStandardHumanoidPreset, normalizeSkeletonDefinition } from '../src/skeleton-presets.js';

const assetPath = new URL('../assets/smpl/smpl-male-surface-skinned.glb', import.meta.url);
globalThis.fetch = async () => {
  const buffer = await readFile(assetPath);
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  };
};

class V3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone() { return new V3(this.x, this.y, this.z); }
  fromArray(values, offset = 0) { this.x = values[offset]; this.y = values[offset + 1]; this.z = values[offset + 2]; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  multiplyScalar(value) { this.x *= value; this.y *= value; this.z *= value; return this; }
  subVectors(a, b) { this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z; return this; }
  crossVectors(a, b) {
    this.x = a.y * b.z - a.z * b.y;
    this.y = a.z * b.x - a.x * b.z;
    this.z = a.x * b.y - a.y * b.x;
    return this;
  }
  lengthSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }
  length() { return Math.sqrt(this.lengthSq()); }
  normalize() { const length = this.length() || 1; return this.multiplyScalar(1 / length); }
  lerp(target, alpha) {
    this.x += (target.x - this.x) * alpha;
    this.y += (target.y - this.y) * alpha;
    this.z += (target.z - this.z) * alpha;
    return this;
  }
}

class Q {
  constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; }
  set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; return this; }
  fromArray(values, offset = 0) { return this.set(values[offset], values[offset + 1], values[offset + 2], values[offset + 3]); }
  clone() { return new Q(this.x, this.y, this.z, this.w); }
  identity() { return this.set(0, 0, 0, 1); }
  copy(q) { return this.set(q.x, q.y, q.z, q.w); }
  setFromUnitVectors(vFrom, vTo) {
    let r = vFrom.x * vTo.x + vFrom.y * vTo.y + vFrom.z * vTo.z + 1;
    if (r < 1e-8) {
      r = 0;
      if (Math.abs(vFrom.x) > Math.abs(vFrom.z)) {
        this.set(-vFrom.y, vFrom.x, 0, r);
      } else {
        this.set(0, -vFrom.z, vFrom.y, r);
      }
    } else {
      this.set(
        vFrom.y * vTo.z - vFrom.z * vTo.y,
        vFrom.z * vTo.x - vFrom.x * vTo.z,
        vFrom.x * vTo.y - vFrom.y * vTo.x,
        r,
      );
    }
    return this.normalize();
  }
  setFromRotationMatrix(matrix) {
    const te = matrix.elements;
    const m11 = te[0], m12 = te[4], m13 = te[8];
    const m21 = te[1], m22 = te[5], m23 = te[9];
    const m31 = te[2], m32 = te[6], m33 = te[10];
    const trace = m11 + m22 + m33;
    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1);
      this.w = 0.25 / s;
      this.x = (m32 - m23) * s;
      this.y = (m13 - m31) * s;
      this.z = (m21 - m12) * s;
    } else if (m11 > m22 && m11 > m33) {
      const s = 2 * Math.sqrt(1 + m11 - m22 - m33);
      this.w = (m32 - m23) / s;
      this.x = 0.25 * s;
      this.y = (m12 + m21) / s;
      this.z = (m13 + m31) / s;
    } else if (m22 > m33) {
      const s = 2 * Math.sqrt(1 + m22 - m11 - m33);
      this.w = (m13 - m31) / s;
      this.x = (m12 + m21) / s;
      this.y = 0.25 * s;
      this.z = (m23 + m32) / s;
    } else {
      const s = 2 * Math.sqrt(1 + m33 - m11 - m22);
      this.w = (m21 - m12) / s;
      this.x = (m13 + m31) / s;
      this.y = (m23 + m32) / s;
      this.z = 0.25 * s;
    }
    return this.normalize();
  }
  multiply(q) {
    const qax = this.x, qay = this.y, qaz = this.z, qaw = this.w;
    const qbx = q.x, qby = q.y, qbz = q.z, qbw = q.w;
    this.x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby;
    this.y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;
    this.z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx;
    this.w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz;
    return this;
  }
  invert() {
    const lengthSq = this.x ** 2 + this.y ** 2 + this.z ** 2 + this.w ** 2 || 1;
    this.x = -this.x / lengthSq;
    this.y = -this.y / lengthSq;
    this.z = -this.z / lengthSq;
    this.w /= lengthSq;
    return this;
  }
  normalize() {
    const length = Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2 + this.w ** 2) || 1;
    this.x /= length;
    this.y /= length;
    this.z /= length;
    this.w /= length;
    return this;
  }
}

class M4 {
  constructor() { this.elements = new Float64Array(16); this.identity(); }
  identity() {
    this.elements.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    return this;
  }
  copy(matrix) { this.elements.set(matrix.elements); return this; }
  clone() { return new M4().copy(this); }
  fromArray(values, offset = 0) {
    for (let index = 0; index < 16; index += 1) this.elements[index] = values[offset + index];
    return this;
  }
  makeBasis(x, y, z) {
    this.elements.set([
      x.x, x.y, x.z, 0,
      y.x, y.y, y.z, 0,
      z.x, z.y, z.z, 0,
      0, 0, 0, 1,
    ]);
    return this;
  }
  compose(position, quaternion, scale) {
    const te = this.elements;
    const x = quaternion.x, y = quaternion.y, z = quaternion.z, w = quaternion.w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    const sx = scale.x, sy = scale.y, sz = scale.z;

    te[0] = (1 - (yy + zz)) * sx;
    te[1] = (xy + wz) * sx;
    te[2] = (xz - wy) * sx;
    te[3] = 0;
    te[4] = (xy - wz) * sy;
    te[5] = (1 - (xx + zz)) * sy;
    te[6] = (yz + wx) * sy;
    te[7] = 0;
    te[8] = (xz + wy) * sz;
    te[9] = (yz - wx) * sz;
    te[10] = (1 - (xx + yy)) * sz;
    te[11] = 0;
    te[12] = position.x;
    te[13] = position.y;
    te[14] = position.z;
    te[15] = 1;
    return this;
  }
  multiplyMatrices(a, b) {
    const ae = a.elements;
    const be = b.elements;
    const te = this.elements;
    const a11 = ae[0], a12 = ae[4], a13 = ae[8], a14 = ae[12];
    const a21 = ae[1], a22 = ae[5], a23 = ae[9], a24 = ae[13];
    const a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14];
    const a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15];
    const b11 = be[0], b12 = be[4], b13 = be[8], b14 = be[12];
    const b21 = be[1], b22 = be[5], b23 = be[9], b24 = be[13];
    const b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14];
    const b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15];

    te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
    te[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
    te[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
    te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;
    te[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
    te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
    te[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
    te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;
    te[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
    te[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
    te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
    te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;
    te[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
    te[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
    te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
    te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;
    return this;
  }
  decompose(position, quaternion, scale) {
    const te = this.elements;
    let sx = Math.hypot(te[0], te[1], te[2]);
    const sy = Math.hypot(te[4], te[5], te[6]);
    const sz = Math.hypot(te[8], te[9], te[10]);
    const determinant = (
      te[0] * (te[5] * te[10] - te[6] * te[9])
      - te[4] * (te[1] * te[10] - te[2] * te[9])
      + te[8] * (te[1] * te[6] - te[2] * te[5])
    );
    if (determinant < 0) sx = -sx;
    position.set(te[12], te[13], te[14]);
    const rotation = this.clone();
    const r = rotation.elements;
    const invSx = sx ? 1 / sx : 1;
    const invSy = sy ? 1 / sy : 1;
    const invSz = sz ? 1 / sz : 1;
    r[0] *= invSx; r[1] *= invSx; r[2] *= invSx;
    r[4] *= invSy; r[5] *= invSy; r[6] *= invSy;
    r[8] *= invSz; r[9] *= invSz; r[10] *= invSz;
    quaternion.setFromRotationMatrix(rotation);
    scale.set(sx, sy, sz);
    return this;
  }
}

class Obj {
  constructor() {
    this.parent = null;
    this.children = [];
    this.visible = true;
    this.userData = {};
    this.position = new V3();
    this.quaternion = new Q();
    this.scale = new V3(1, 1, 1);
    this.matrix = new M4();
    this.matrixWorld = new M4();
  }
  add(object) {
    object.parent?.remove?.(object);
    if (!this.children.includes(object)) this.children.push(object);
    object.parent = this;
    return this;
  }
  remove(object) {
    this.children = this.children.filter((item) => item !== object);
    if (object?.parent === this) object.parent = null;
    return this;
  }
  updateMatrixWorld(force = false) {
    this.matrix.compose(this.position, this.quaternion, this.scale);
    if (this.parent) this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
    else this.matrixWorld.copy(this.matrix);
    for (const child of this.children) child.updateMatrixWorld(force);
  }
  getWorldPosition(target) {
    this.matrixWorld.decompose(target, new Q(), new V3());
    return target;
  }
  getWorldQuaternion(target) {
    this.matrixWorld.decompose(new V3(), target, new V3());
    return target;
  }
}
class Group extends Obj {}
class Scene extends Group {}
class Bone extends Obj { constructor() { super(); this.isBone = true; } }
class Material {
  constructor(parameters = {}) {
    Object.assign(this, parameters);
    this.type = 'MeshStandardMaterial';
    this.needsUpdate = false;
  }
  dispose() {}
}
class Mesh extends Obj {
  constructor(geometry, material) {
    super();
    this.geometry = geometry;
    this.material = material;
    this.frustumCulled = true;
    this.renderOrder = 0;
    this.isMesh = true;
  }
}
class SkinnedMesh extends Mesh {
  constructor(geometry, material) {
    super(geometry, material);
    this.isSkinnedMesh = true;
    this.bindMatrix = new M4();
    this.bindMatrixInverse = new M4();
  }
  bind(skeleton, bindMatrix = new M4()) {
    this.skeleton = skeleton;
    this.bindMatrix.copy(bindMatrix);
    this.bindMatrixInverse.identity();
  }
  normalizeSkinWeights() {
    const attribute = this.geometry.attributes.skinWeight;
    if (!attribute) return;
    for (let offset = 0; offset < attribute.array.length; offset += 4) {
      const sum = attribute.array[offset] + attribute.array[offset + 1]
        + attribute.array[offset + 2] + attribute.array[offset + 3];
      if (sum > 0) {
        for (let slot = 0; slot < 4; slot += 1) attribute.array[offset + slot] /= sum;
      }
    }
  }
}
class Skeleton {
  constructor(bones, boneInverses) {
    this.bones = bones;
    this.boneInverses = boneInverses;
  }
  update() {}
  dispose() {}
}
class Attr {
  constructor(array, itemSize, normalized = false) {
    this.array = array;
    this.itemSize = itemSize;
    this.normalized = normalized;
    this.count = array.length / itemSize;
    this.needsUpdate = false;
  }
  setUsage(value) { this.usage = value; return this; }
}
class Geo {
  constructor() { this.attributes = {}; this.index = null; }
  setAttribute(name, attribute) { this.attributes[name] = attribute; return this; }
  setIndex(attribute) { this.index = attribute; return this; }
  computeVertexNormals() {}
  computeBoundingBox() {}
  computeBoundingSphere() {}
  dispose() {}
}

const THREE = {
  Vector3: V3,
  Quaternion: Q,
  Matrix4: M4,
  Group,
  Bone,
  Skeleton,
  MeshStandardMaterial: Material,
  SkinnedMesh,
  BufferGeometry: Geo,
  Float32BufferAttribute: Attr,
  BufferAttribute: Attr,
  FrontSide: 0,
};

const buildManifest = JSON.parse(await readFile(new URL('../../../src/modules/skin/skin-build.json', import.meta.url), 'utf8'));
const verifyPage = await readFile(new URL('../../../src/modules/skin/verify.html', import.meta.url), 'utf8');
const dedicatedLauncher = await readFile(new URL('../../../src/modules/skin/open-skin-v002.ps1', import.meta.url), 'utf8');
assert.equal(buildManifest.buildId, SKIN_RUNTIME_BUILD.buildId);
assert.equal(buildManifest.patchId, SKIN_RUNTIME_BUILD.patchId);
assert.equal(buildManifest.expectedSurfaceCount, 1);
assert.equal(buildManifest.continuousSceneGuardIntervalMs, 160);
assert.equal(buildManifest.dedicatedPortStart, 4192);
assert.equal(buildManifest.dedicatedPortEnd, 4210);
assert.match(verifyPage, /人物蒙皮 V002 构建验证/);
assert.match(verifyPage, /skin-v002-single-surface-guard/);
assert.match(dedicatedLauncher, /4192\.\.4210/);
assert.match(dedicatedLauncher, /skin-build\.json/);
assert.match(dedicatedLauncher, /node_modules\\three\\build\\three\.webgpu\.js/);
assert.match(dedicatedLauncher, /npm\.cmd/);
assert.match(dedicatedLauncher, /--skin-build=skin-v002-single-surface-guard/);

const states = [];
const scene = new Scene();
const legacySurfaceGroup = new Group();
legacySurfaceGroup.name = 'LegacyProceduralHumanSurface';
const legacySurfaceMesh = new Mesh(new Geo(), new Material());
legacySurfaceMesh.name = 'LegacyBaseBodyProxyMesh';
legacySurfaceGroup.add(legacySurfaceMesh);
scene.add(legacySurfaceGroup);
const editorJointVisual = new Mesh(new Geo(), new Material());
editorJointVisual.name = 'hips_joint_visual';
editorJointVisual.userData.kind = 'joint';
scene.add(editorJointVisual);
const allowedAttachment = new Mesh(new Geo(), new Material());
allowedAttachment.name = 'FutureClothingAttachment';
allowedAttachment.userData.humanoidAttachmentRole = 'clothing';
scene.add(allowedAttachment);
const definition = normalizeSkeletonDefinition(createStandardHumanoidPreset('A'));
const start = performance.now();
const layer = await createSmplSkinLayer(THREE, scene, definition, {
  onSurfaceState: (state) => states.push(state),
});

const immediate = layer.getDiagnostics();
assert.equal(immediate.type, 'single-smpl-human-surface');
assert.equal(immediate.pipeline, 'native-glb-skinnedmesh');
assert.equal(immediate.buildId, 'skin-v002-single-surface-guard');
assert.equal(immediate.patchId, 'skin-patch-v002');
assert.equal(immediate.proceduralSurfacePresent, false);
assert.ok(immediate.renderableSurfaceCount <= 1);
assert.equal(immediate.requestedSource, 'detail');
assert.equal(legacySurfaceMesh.parent, null, 'Legacy procedural surface was not removed before native loading.');
assert.equal(editorJointVisual.parent, scene, 'Skeleton editor visuals were incorrectly removed by the surface guard.');
assert.equal(allowedAttachment.parent, scene, 'An explicitly allowed clothing or accessory attachment was removed.');
assert.ok(immediate.legacySurfaceRemovalCount >= 1);

const pending = layer.detailPromise;
assert.ok(pending, 'Native detailed surface loading did not start.');
await pending;
const diagnostics = layer.getDiagnostics();
assert.equal(diagnostics.type, 'single-smpl-human-surface');
assert.equal(diagnostics.pipeline, 'native-glb-skinnedmesh');
assert.equal(diagnostics.meshType, 'SkinnedMesh');
assert.equal(diagnostics.visible, true);
assert.equal(diagnostics.meshVisible, true);
assert.equal(diagnostics.weightsReady, true);
assert.equal(diagnostics.nativeSkinAttributes, true);
assert.equal(diagnostics.inverseBindMatrices, true);
assert.equal(diagnostics.jointCount, 24);
assert.equal(diagnostics.attachedToScene, true);
assert.equal(diagnostics.singleVisibleSurface, true);
assert.equal(diagnostics.renderableSurfaceCount, 1);
assert.equal(diagnostics.sceneSurfaceMeshCount, 1);
assert.equal(diagnostics.duplicateSurfaceCount, 0);
assert.equal(diagnostics.visibleDuplicateSurfaceCount, 0);
assert.equal(diagnostics.ownsPrimarySurfaceSlot, true);
assert.equal(diagnostics.continuousSceneGuard, true);
assert.equal(diagnostics.sceneAuditIntervalMs, 160);
assert.equal(diagnostics.proceduralSurfacePresent, false);
assert.equal(diagnostics.pickSource, 'detailed-smpl-skinned-mesh');
assert.equal(diagnostics.vertexCount, 27_578);
assert.equal(diagnostics.triangleCount, 55_152);
assert.equal(diagnostics.bindPoseProtected, true);
assert.equal(diagnostics.assetWeightStatus, 'experimental-transitional');
assert.equal(states[0]?.state, 'loading');
assert.equal(states.at(-1)?.state, 'ready');
assert.match(states.at(-1)?.label ?? '', /SKIN V002/);

const lateLegacySurface = new Mesh(new Geo(), new Material());
lateLegacySurface.name = 'LateStaticHumanSurface';
scene.add(lateLegacySurface);
await new Promise((resolve) => setTimeout(resolve, 240));
assert.equal(lateLegacySurface.parent, null, 'A late duplicate surface survived the continuous scene audit.');
const guardedDiagnostics = layer.getDiagnostics();
assert.equal(guardedDiagnostics.sceneSurfaceMeshCount, 1);
assert.equal(guardedDiagnostics.duplicateSurfaceCount, 0);
assert.equal(guardedDiagnostics.renderableSurfaceCount, 1);
assert.ok(guardedDiagnostics.legacySurfaceRemovalCount >= 2);

const bindSample = layer.sampleDeformedPositions();
let bindMaxDisplacement = 0;
for (let index = 0; index < bindSample.length; index += 1) {
  bindMaxDisplacement = Math.max(bindMaxDisplacement, Math.abs(bindSample[index] - layer.restPositions[index]));
}
assert.ok(bindMaxDisplacement < 1e-5, `Native bind matrices moved the bind surface by ${bindMaxDisplacement}.`);

const tallerDefinition = normalizeSkeletonDefinition(applyBodyProfileToDefinition(definition, {
  height: 2.05,
  preset: 'custom',
}));
layer.refresh(tallerDefinition, null, { force: true });
const tallerSample = layer.sampleDeformedPositions();
const yBounds = (positions) => {
  let min = Infinity;
  let max = -Infinity;
  for (let index = 1; index < positions.length; index += 3) {
    min = Math.min(min, positions[index]);
    max = Math.max(max, positions[index]);
  }
  return { min, max, height: max - min };
};
const referenceBounds = yBounds(bindSample);
const tallerBounds = yBounds(tallerSample);
assert.equal(layer.getDiagnostics().referenceBindingMismatch, true);
assert.ok(
  tallerBounds.height > referenceBounds.height * 1.05,
  `Custom body profile did not resize the surface: ${referenceBounds.height.toFixed(4)} -> ${tallerBounds.height.toFixed(4)} m.`,
);
layer.refresh(definition, null, { force: true });

const targets = layer.getPickTargets();
assert.equal(targets.length, 1);
assert.equal(targets[0].isSkinnedMesh, true);
assert.ok(targets[0].geometry.attributes.skinIndex);
assert.ok(targets[0].geometry.attributes.skinWeight);
const resolved = layer.resolvePick({
  object: targets[0],
  faceIndex: 0,
  distance: 1,
  point: new V3(),
});
assert.ok(resolved?.jointId);
assert.equal(resolved.surfacePart, 'detailed-smpl-skinned-mesh');

const materialBefore = targets[0].material;
layer.refresh(definition, { selectedJointId: 'leftHand', hoveredJointId: 'leftLowerArm', hoveredKind: 'joint' });
assert.equal(targets[0].material, materialBefore, 'Joint selection changed the human surface material.');

layer.setMode('solid');
layer.setOpacity(0.44);
assert.equal(Number(targets[0].material.opacity.toFixed(2)), 0.44);
assert.equal(targets[0].material.transparent, true);
layer.setMode('wireframe');
assert.equal(Number(targets[0].material.opacity.toFixed(2)), 0.44);
assert.equal(targets[0].material.wireframe, true);
layer.setOpacity(0.90);
layer.setMode('translucent');
assert.equal(Number(targets[0].material.opacity.toFixed(2)), 0.72);
layer.setMode('solid');
assert.equal(Number(targets[0].material.opacity.toFixed(2)), 0.90);
assert.equal(targets[0].material.transparent, true);

layer.setSource('base');
const lockedSource = layer.getDiagnostics();
assert.equal(lockedSource.activeSource, 'detail');
assert.equal(lockedSource.requestedSource, 'detail');

layer.setVisible(false);
const hidden = layer.getDiagnostics();
assert.equal(hidden.renderableSurfaceCount, 0);
assert.equal(layer.getPickTargets().length, 0);
layer.setVisible(true);

const tDefinition = normalizeSkeletonDefinition(createStandardHumanoidPreset('T'));
layer.refresh(tDefinition, null, { force: true });
assert.equal(layer.getDiagnostics().bindPoseProtected, false);

const gpuPositionAttribute = targets[0].geometry.attributes.position.array;
assert.deepEqual(
  Array.from(gpuPositionAttribute),
  Array.from(layer.restPositions),
  'Native GPU skinning must not rewrite the bind POSITION buffer on the CPU.',
);
const deformed = layer.sampleDeformedPositions();
const rest = layer.restPositions;
const triangleIndex = targets[0].geometry.index?.array;
let maxDisplacement = 0;
let maxEdgeStretch = 0;
let maxShoulderEdgeStretch = 0;
let nonFiniteCount = 0;
for (let index = 0; index < deformed.length; index += 3) {
  const displacement = Math.hypot(
    deformed[index] - rest[index],
    deformed[index + 1] - rest[index + 1],
    deformed[index + 2] - rest[index + 2],
  );
  if (!Number.isFinite(displacement)) nonFiniteCount += 1;
  maxDisplacement = Math.max(maxDisplacement, displacement);
}
const edgeLength = (array, a, b) => {
  const ao = a * 3;
  const bo = b * 3;
  return Math.hypot(array[ao] - array[bo], array[ao + 1] - array[bo + 1], array[ao + 2] - array[bo + 2]);
};
if (triangleIndex) {
  for (let index = 0; index < triangleIndex.length; index += 3) {
    const ids = [triangleIndex[index], triangleIndex[index + 1], triangleIndex[index + 2]];
    for (const [a, b] of [[ids[0], ids[1]], [ids[1], ids[2]], [ids[2], ids[0]]]) {
      const before = edgeLength(rest, a, b);
      if (before < 1e-5) continue;
      const after = edgeLength(deformed, a, b);
      const ratio = after / before;
      maxEdgeStretch = Math.max(maxEdgeStretch, ratio);
      const ao = a * 3;
      const bo = b * 3;
      const midX = (rest[ao] + rest[bo]) * 0.5;
      const midY = (rest[ao + 1] + rest[bo + 1]) * 0.5;
      if (midY >= 1.18 && midY <= 1.48 && Math.abs(midX) >= 0.12 && Math.abs(midX) <= 0.36) {
        maxShoulderEdgeStretch = Math.max(maxShoulderEdgeStretch, ratio);
      }
    }
  }
}
assert.equal(nonFiniteCount, 0);
assert.ok(maxDisplacement < 0.75, `T pose moved a surface vertex too far: ${maxDisplacement.toFixed(4)} m.`);
assert.ok(maxEdgeStretch < 6.2, `T pose edge stretch exceeded the limit: ${maxEdgeStretch.toFixed(3)}x.`);
assert.ok(maxShoulderEdgeStretch < 1.8, `T pose shoulder stretch exceeded the limit: ${maxShoulderEdgeStretch.toFixed(3)}x.`);

const mismatchDefinition = normalizeSkeletonDefinition(createStandardHumanoidPreset('A'));
mismatchDefinition.profilePreview = { requiresSkinRebind: true };
layer.refresh(mismatchDefinition, null, { force: true });
assert.equal(layer.getDiagnostics().referenceBindingMismatch, true);

const replacementStates = [];
const replacementLayer = await createSmplSkinLayer(THREE, scene, definition, {
  onSurfaceState: (state) => replacementStates.push(state),
});
await replacementLayer.detailPromise;
const replacementDiagnostics = replacementLayer.getDiagnostics();
assert.equal(replacementDiagnostics.ownsPrimarySurfaceSlot, true);
assert.equal(replacementDiagnostics.renderableSurfaceCount, 1);
assert.equal(replacementDiagnostics.sceneSurfaceMeshCount, 1);
assert.equal(replacementDiagnostics.duplicateSurfaceCount, 0);
assert.equal(replacementLayer.getPickTargets().length, 1);
const staleDiagnostics = layer.getDiagnostics();
assert.equal(staleDiagnostics.ownsPrimarySurfaceSlot, false);
assert.equal(staleDiagnostics.sceneSurfaceMeshCount, 1);
assert.equal(staleDiagnostics.renderableSurfaceCount, 1);
assert.equal(replacementLayer.getPickTargets().length, 1, 'Stale layer diagnostics removed the current primary surface.');
assert.match(replacementStates.at(-1)?.label ?? '', /SKIN V002/);
replacementLayer.dispose();
layer.dispose();

console.log(
  `T-pose native LBS quality passed: max displacement ${maxDisplacement.toFixed(4)} m, `
  + `max edge stretch ${maxEdgeStretch.toFixed(3)}x, `
  + `max shoulder stretch ${maxShoulderEdgeStretch.toFixed(3)}x.`,
);

const elapsed = performance.now() - start;
console.log(`V8.4 SKIN V002 scene-wide single-surface guard, native SkinnedMesh, direct weighted picking, inverse-bind matrices, and material-state regression passed in ${elapsed.toFixed(1)} ms.`);
