import { computePoseWorldPositions, computeRestWorldPositions } from './skeleton-model.js';
import { loadGlbSkin } from './glb-geometry.js';
import {
  bodyShapeProfileKey,
  createSkinShapeResponse,
  deformSkinPositions,
  normalizeBodyShapeProfile,
} from '../../../packages/body-shape/index.js';

const EPSILON = 1e-8;
const REST_EPSILON = 1e-7;
const SMPL_SKINNED_ASSET_URL = new URL('../assets/smpl/smpl-male-surface-skinned.glb', import.meta.url).href;

export const SKIN_RUNTIME_BUILD = Object.freeze({
  buildId: 'skin-v002-single-surface-guard',
  patchId: 'skin-patch-v002',
  moduleVersion: 'skin@0.5.1',
  compatibleRigVersion: 'rig@0.4.0',
  assetSha256: '736cb39c828203eae72f5e5d094f1623c0a4465a31b484737a6e8df02a7ec899',
});

const SURFACE_OWNER_KEY = '__humanoidRigPrimarySurfaceOwner';
const SURFACE_GENERATION_KEY = '__humanoidRigPrimarySurfaceGeneration';
const EDITOR_VISUAL_KINDS = new Set(['joint', 'bone', 'gizmo']);
const ALLOWED_ATTACHMENT_ROLES = new Set([
  'clothing',
  'hair',
  'eyes',
  'accessory',
  'collision-debug',
  'environment',
]);
const EDITOR_VISUAL_GROUPS = new Set([
  'HumanoidSkeletonHierarchy',
  'HumanoidBoneVisuals',
  'TranslationGizmo',
]);

const SMPL_JOINT_IDS = Object.freeze([
  'hips',
  'leftUpperLeg', 'rightUpperLeg',
  'spine',
  'leftLowerLeg', 'rightLowerLeg',
  'chest',
  'leftFoot', 'rightFoot',
  'upperChest',
  'leftToes', 'rightToes',
  'neck',
  'leftShoulder', 'rightShoulder',
  'head',
  'leftUpperArm', 'rightUpperArm',
  'leftLowerArm', 'rightLowerArm',
  'leftHand', 'rightHand',
  'leftHandEnd', 'rightHandEnd',
]);

const PRIMARY_CHILD = Object.freeze({
  hips: 'spine',
  spine: 'chest',
  chest: 'upperChest',
  upperChest: 'neck',
  neck: 'head',
  head: 'headTop',
  leftShoulder: 'leftUpperArm',
  leftUpperArm: 'leftLowerArm',
  leftLowerArm: 'leftHand',
  leftHand: 'leftHandEnd',
  rightShoulder: 'rightUpperArm',
  rightUpperArm: 'rightLowerArm',
  rightLowerArm: 'rightHand',
  rightHand: 'rightHandEnd',
  leftUpperLeg: 'leftLowerLeg',
  leftLowerLeg: 'leftFoot',
  leftFoot: 'leftToes',
  leftToes: 'leftToesEnd',
  rightUpperLeg: 'rightLowerLeg',
  rightLowerLeg: 'rightFoot',
  rightFoot: 'rightToes',
  rightToes: 'rightToesEnd',
});

const LEGACY_RUNTIME_PROVENANCE = Object.freeze({
  className: 'SingleSmplHumanSurfaceLayer',
  meshConstructor: 'new this.THREE.Mesh',
  deformation: 'CPU region-isolated adjacency-smoothed four-influence DQS',
  weighting: '分区四关节权重',
  pickSource: 'detailed-smpl-mesh',
});

const PARENT_FALLBACK = Object.freeze({
  leftHandEnd: 'leftHand',
  rightHandEnd: 'rightHand',
  leftToes: 'leftFoot',
  rightToes: 'rightFoot',
  head: 'neck',
  neck: 'upperChest',
});

/**
 * Creates one pre-bound human surface. The GLB contains the only render mesh,
 * native JOINTS_0 and WEIGHTS_0 attributes, a 24-joint skin and inverse bind
 * matrices. No procedural body, hidden picking shell or duplicate mesh exists.
 */
export async function createSmplSkinLayer(THREE, scene, definition, callbacks = {}) {
  const layer = new NativeSmplSkinnedSurfaceLayer(THREE, scene, callbacks);
  layer.init(definition);
  return layer;
}

class NativeSmplSkinnedSurfaceLayer {
  constructor(THREE, scene, callbacks = {}) {
    this.THREE = THREE;
    this.scene = scene;
    this.callbacks = callbacks;
    this.visible = true;
    this.opacity = 1;
    this.mode = 'solid';
    this.source = 'detail';
    this.disposed = false;
    this.weightsReady = false;
    this.lastDefinition = null;
    this.lastSurfaceState = null;
    this.lastCompatibilityMismatch = null;
    this.jointIds = [];
    this.orderedJointIds = [];
    this.boneIndexById = new Map();
    this.bonesById = new Map();
    this.parentIdById = new Map();
    this.assetRestPoints = new Map();
    this.bindLocalPositions = new Map();
    this.bindLocalQuaternions = new Map();
    this.bindLocalScales = new Map();
    this.bindWorldQuaternions = new Map();
    this.skinIndices = null;
    this.skinWeights = null;
    this.inverseBindMatrices = null;
    this.skinMatrices = null;
    this.restPositions = null;
    this.shapedRestPositions = null;
    this.restNormals = null;
    this.bodyShapeProfile = normalizeBodyShapeProfile();
    this.bodyShapeResponse = createSkinShapeResponse(this.bodyShapeProfile);
    this.lastBodyShapeKey = '';
    this.lastSourceValues = null;
    this.detailPromise = null;
    this.surfaceOwnerToken = '';
    this.surfaceGeneration = 0;
    this.sceneAuditCount = 0;
    this.removedLegacySurfaceCount = 0;
    this.removedLegacySurfaces = [];
    this.lastSceneAudit = null;
    this.sceneAuditTimer = null;
    this.sceneAuditIntervalMs = 160;
    this.temp = {
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      c: new THREE.Vector3(),
      qA: new THREE.Quaternion(),
      qB: new THREE.Quaternion(),
      qC: new THREE.Quaternion(),
      matrix: new THREE.Matrix4(),
      localMatrix: new THREE.Matrix4(),
    };
  }

  init(definition) {
    this.lastDefinition = definition;
    this.claimPrimarySurfaceSlot();
    this.auditSceneSurfaces({ purge: true, phase: 'before-primary-group' });

    this.group = new this.THREE.Group();
    this.group.name = 'SMPLSingleNativeSkinnedSurface';
    this.group.renderOrder = 0;
    this.group.userData.humanoidSurfaceRole = 'primary-container';
    this.group.userData.skinBuildId = SKIN_RUNTIME_BUILD.buildId;
    this.group.userData.surfaceOwnerToken = this.surfaceOwnerToken;
    this.scene.add(this.group);
    this.setVisible(this.visible);
    this.startSceneAuditMonitor();

    this.emitState(
      'loading',
      'SKIN V002 正在读取唯一预绑定表皮',
      `${SKIN_RUNTIME_BUILD.buildId} · 正在加载一个原生 SkinnedMesh`,
    );

    this.detailPromise = this.loadNativeSurface(definition)
      .catch((error) => {
        if (this.disposed) return null;
        console.error('Native skinned human surface failed to initialize.', error);
        this.emitState(
          'error',
          '预绑定人物表皮加载失败',
          error instanceof Error ? error.message : String(error),
        );
        return null;
      })
      .finally(() => {
        this.detailPromise = null;
      });
  }

  async loadNativeSurface(definition) {
    const meshData = await loadGlbSkin(SMPL_SKINNED_ASSET_URL);
    if (this.disposed || !this.ownsPrimarySurfaceSlot()) return null;
    this.validateRigMapping(meshData, definition);

    const geometry = createNativeThreeGeometry(this.THREE, meshData);
    this.restPositions = new Float32Array(geometry.attributes.position.array);
    this.restNormals = new Float32Array(geometry.attributes.normal.array);
    this.skinIndices = geometry.attributes.skinIndex.array;
    this.skinWeights = geometry.attributes.skinWeight.array;
    this.inverseBindMatrices = new Float32Array(meshData.skin.inverseBindMatrices.array);

    this.material = createReliableSurfaceMaterial(this.THREE);
    const NativeSkinnedMesh = this.THREE.SkinnedMesh;
    this.mesh = new NativeSkinnedMesh(geometry, this.material);
    this.mesh.name = 'MeshcapadeSampleHumanSurfaceNativeSkinnedMesh';
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0;
    this.mesh.userData.surfaceEngine = 'native GLB SkinnedMesh with JOINTS_0, WEIGHTS_0 and inverseBindMatrices';
    this.mesh.userData.surfacePickSource = 'detailed-smpl-skinned-mesh';
    this.mesh.userData.assetWeightStatus = meshData.skin.extras?.weightStatus ?? 'unknown';
    this.mesh.userData.humanoidSurfaceRole = 'primary-render-surface';
    this.mesh.userData.skinBuildId = SKIN_RUNTIME_BUILD.buildId;
    this.mesh.userData.surfaceOwnerToken = this.surfaceOwnerToken;
    this.applyBodyShapeToGeometry({ force: true });

    this.buildNativeSkeleton(meshData.skin);
    for (const rootBone of this.rootBones) this.mesh.add(rootBone);
    this.group.add(this.mesh);
    this.group.updateMatrixWorld(true);
    this.auditSceneSurfaces({ purge: true, phase: 'native-surface-attached' });

    const boneInverses = [];
    for (let index = 0; index < this.jointIds.length; index += 1) {
      const matrix = new this.THREE.Matrix4();
      matrix.fromArray(this.inverseBindMatrices, index * 16);
      boneInverses.push(matrix);
    }
    this.skeleton = new this.THREE.Skeleton(
      this.jointIds.map((id) => this.bonesById.get(id)),
      boneInverses,
    );
    this.mesh.bindMode = 'attached';
    this.mesh.bind(this.skeleton, new this.THREE.Matrix4());
    this.mesh.normalizeSkinWeights?.();

    this.captureBindState();
    this.skinMatrices = new Float32Array(this.jointIds.length * 16);
    this.lastSourceValues = new Float64Array(this.jointIds.length * 6);
    this.lastSourceValues.fill(Number.NaN);
    this.weightsReady = true;

    this.setMode(this.mode);
    this.setOpacity(this.opacity);
    this.setVisible(this.visible);
    this.refresh(this.lastDefinition ?? definition, null, { force: true });

    const vertexCount = geometry.attributes.position.count;
    const triangleCount = geometry.index ? Math.floor(geometry.index.count / 3) : Math.floor(vertexCount / 3);
    const sceneAudit = this.auditSceneSurfaces({ purge: true, phase: 'ready' });
    this.emitState(
      'ready',
      'SKIN V002 唯一预绑定表皮已就绪',
      `${SKIN_RUNTIME_BUILD.buildId} · ${vertexCount.toLocaleString()} 顶点 · 场景可见人体表皮 ${sceneAudit.visibleSurfaceCount} 层`,
    );
    return this;
  }

  validateRigMapping(meshData, definition) {
    const assetIds = meshData.skin?.jointIds ?? [];
    if (assetIds.length !== SMPL_JOINT_IDS.length) {
      throw new Error(`预绑定 GLB 需要 ${SMPL_JOINT_IDS.length} 个关节，当前为 ${assetIds.length} 个。`);
    }
    for (let index = 0; index < SMPL_JOINT_IDS.length; index += 1) {
      if (assetIds[index] !== SMPL_JOINT_IDS[index]) {
        throw new Error(`预绑定 GLB 关节顺序不兼容：${assetIds[index]} / ${SMPL_JOINT_IDS[index]}。`);
      }
    }
    const definitionIds = new Set(definition.joints.map((joint) => joint.id));
    const missing = assetIds.filter((id) => !definitionIds.has(id));
    if (missing.length) throw new Error(`当前 RigDefinition 缺少蒙皮关节：${missing.join(', ')}。`);
  }

  claimPrimarySurfaceSlot() {
    const sceneData = this.scene.userData || (this.scene.userData = {});
    const previousGeneration = Number(sceneData[SURFACE_GENERATION_KEY]) || 0;
    this.surfaceGeneration = previousGeneration + 1;
    this.surfaceOwnerToken = `${SKIN_RUNTIME_BUILD.buildId}:${this.surfaceGeneration}`;
    sceneData[SURFACE_GENERATION_KEY] = this.surfaceGeneration;
    sceneData[SURFACE_OWNER_KEY] = this.surfaceOwnerToken;
  }

  ownsPrimarySurfaceSlot() {
    return Boolean(
      this.surfaceOwnerToken
      && this.scene?.userData?.[SURFACE_OWNER_KEY] === this.surfaceOwnerToken,
    );
  }

  startSceneAuditMonitor() {
    if (this.sceneAuditTimer || typeof globalThis.setInterval !== 'function') return;
    this.sceneAuditTimer = globalThis.setInterval(() => {
      if (this.disposed) {
        this.stopSceneAuditMonitor();
        return;
      }
      this.auditSceneSurfaces({ purge: true, phase: 'continuous-monitor' });
    }, this.sceneAuditIntervalMs);
    this.sceneAuditTimer?.unref?.();
  }

  stopSceneAuditMonitor() {
    if (!this.sceneAuditTimer) return;
    globalThis.clearInterval?.(this.sceneAuditTimer);
    this.sceneAuditTimer = null;
  }

  auditSceneSurfaces({ purge = true, phase = 'runtime' } = {}) {
    const ownsSlot = this.ownsPrimarySurfaceSlot();
    const primaryMesh = ownsSlot ? this.mesh : null;
    const sceneOwnerToken = this.scene?.userData?.[SURFACE_OWNER_KEY] ?? null;
    const inspected = inspectSceneSurfaceMeshes(this.scene, primaryMesh, sceneOwnerToken);
    const duplicates = inspected.filter((entry) => !entry.primary);
    const removed = [];

    if (purge) {
      for (const entry of duplicates) {
        const parent = entry.object?.parent;
        if (!parent?.remove) continue;
        parent.remove(entry.object);
        const record = {
          phase,
          name: entry.name,
          type: entry.type,
          path: entry.path,
          visible: entry.visible,
          reason: entry.reason,
        };
        removed.push(record);
        this.removedLegacySurfaces.push(record);
      }
      if (removed.length) {
        this.removedLegacySurfaceCount += removed.length;
        this.removedLegacySurfaces = this.removedLegacySurfaces.slice(-24);
      }
    }

    const finalEntries = purge
      ? inspectSceneSurfaceMeshes(this.scene, primaryMesh, sceneOwnerToken)
      : inspected;
    const visibleEntries = finalEntries.filter((entry) => entry.visible);
    const finalDuplicates = finalEntries.filter((entry) => !entry.primary);
    this.sceneAuditCount += 1;
    this.lastSceneAudit = {
      phase,
      auditSequence: this.sceneAuditCount,
      buildId: SKIN_RUNTIME_BUILD.buildId,
      ownsPrimarySurfaceSlot: ownsSlot,
      ownerToken: this.surfaceOwnerToken,
      sceneOwnerToken: this.scene?.userData?.[SURFACE_OWNER_KEY] ?? null,
      surfaceMeshCount: finalEntries.length,
      visibleSurfaceCount: visibleEntries.length,
      primarySurfaceCount: finalEntries.filter((entry) => entry.primary).length,
      duplicateSurfaceCount: finalDuplicates.length,
      visibleDuplicateSurfaceCount: finalDuplicates.filter((entry) => entry.visible).length,
      removedThisAudit: removed,
      removedLegacySurfaceCount: this.removedLegacySurfaceCount,
      surfaces: finalEntries.map(toPublicSurfaceRecord),
    };
    return this.lastSceneAudit;
  }

  buildNativeSkeleton(skin) {
    this.jointIds = [...skin.jointIds];
    this.boneIndexById.clear();
    this.bonesById.clear();
    this.parentIdById.clear();

    for (const joint of skin.joints) {
      const bone = new this.THREE.Bone();
      bone.name = joint.id;
      bone.userData.jointId = joint.id;
      applyNodeTransform(this.THREE, bone, joint);
      this.bonesById.set(joint.id, bone);
      this.boneIndexById.set(joint.id, joint.jointIndex);
      this.parentIdById.set(joint.id, joint.parentId);
    }
    for (const joint of skin.joints) {
      const bone = this.bonesById.get(joint.id);
      const parent = joint.parentId ? this.bonesById.get(joint.parentId) : null;
      if (parent) parent.add(bone);
    }
    this.rootBones = skin.joints
      .filter((joint) => !joint.parentId)
      .map((joint) => this.bonesById.get(joint.id));
    if (this.rootBones.length !== 1 || this.rootBones[0]?.name !== 'hips') {
      throw new Error('预绑定 GLB 必须使用 hips 作为唯一蒙皮根骨。');
    }
    this.orderedJointIds = orderJointIds(this.jointIds, this.parentIdById);
  }

  captureBindState() {
    this.mesh.updateMatrixWorld(true);
    this.assetRestPoints.clear();
    this.bindLocalPositions.clear();
    this.bindLocalQuaternions.clear();
    this.bindLocalScales.clear();
    this.bindWorldQuaternions.clear();
    for (const id of this.jointIds) {
      const bone = this.bonesById.get(id);
      this.bindLocalPositions.set(id, bone.position.clone());
      this.bindLocalQuaternions.set(id, bone.quaternion.clone());
      this.bindLocalScales.set(id, bone.scale.clone());
      this.assetRestPoints.set(id, bone.getWorldPosition(new this.THREE.Vector3()));
      this.bindWorldQuaternions.set(id, bone.getWorldQuaternion(new this.THREE.Quaternion()));
    }
  }

  refresh(definition, _interaction = null, { force = false } = {}) {
    this.lastDefinition = definition;
    if (!this.ownsPrimarySurfaceSlot()) {
      if (this.group?.parent === this.scene) this.scene.remove(this.group);
      this.auditSceneSurfaces({ purge: true, phase: 'stale-owner-refresh' });
      return;
    }
    this.auditSceneSurfaces({ purge: true, phase: 'refresh-start' });
    if (!this.mesh || !this.weightsReady || !this.skeleton) return;

    const sourceRest = computeRestWorldPositions(definition);
    const pose = computePoseWorldPositions(definition);
    const sourceLocalPositions = buildSourceLocalPositions(
      this.THREE,
      sourceRest,
      this.parentIdById,
      this.jointIds,
      this.bindLocalPositions,
    );
    const compatibilityMismatch = Boolean(definition.profilePreview?.requiresSkinRebind);
    let poseChanged = force || this.lastCompatibilityMismatch !== compatibilityMismatch;
    for (let index = 0; index < this.jointIds.length; index += 1) {
      const id = this.jointIds[index];
      const restPoint = sourceRest.get(id);
      const posePoint = pose.get(id);
      if (!restPoint || !posePoint) continue;
      const offset = index * 6;
      const values = [restPoint.x, restPoint.y, restPoint.z, posePoint.x, posePoint.y, posePoint.z];
      for (let component = 0; component < 6; component += 1) {
        if (this.lastSourceValues[offset + component] !== values[component]) {
          poseChanged = true;
          this.lastSourceValues[offset + component] = values[component];
        }
      }
    }
    if (!poseChanged) return;

    const restPose = isRestPose(sourceRest, pose, this.jointIds, REST_EPSILON);
    if (restPose) this.resetBonesToBind(sourceLocalPositions);
    else this.applyPoseDeltas(sourceRest, pose, sourceLocalPositions);

    this.mesh.updateMatrixWorld(true);
    this.skeleton.update();
    this.cacheSkinMatrices();
    this.mesh.userData.bindPoseProtected = restPose;
    this.mesh.userData.referenceBindingMismatch = compatibilityMismatch;
    this.lastCompatibilityMismatch = compatibilityMismatch;
    this.auditSceneSurfaces({ purge: true, phase: 'refresh-complete' });
  }

  resetBonesToBind(sourceLocalPositions = this.bindLocalPositions) {
    for (const id of this.jointIds) {
      const bone = this.bonesById.get(id);
      bone.position.copy(sourceLocalPositions.get(id) ?? this.bindLocalPositions.get(id));
      bone.quaternion.copy(this.bindLocalQuaternions.get(id));
      bone.scale.copy(this.bindLocalScales.get(id));
    }
  }

  applyPoseDeltas(sourceRest, posePoints, sourceLocalPositions = this.bindLocalPositions) {
    const desiredWorldRotations = new Map();
    for (const id of this.orderedJointIds) {
      const delta = this.calculateJointDeltaRotation(id, sourceRest, posePoints).normalize();
      const desired = new this.THREE.Quaternion()
        .copy(delta)
        .multiply(this.bindWorldQuaternions.get(id))
        .normalize();
      desiredWorldRotations.set(id, desired);

      const parentId = this.parentIdById.get(id);
      const local = new this.THREE.Quaternion();
      if (parentId) {
        local.copy(desiredWorldRotations.get(parentId)).invert().multiply(desired).normalize();
      } else {
        local.copy(desired);
      }
      const bone = this.bonesById.get(id);
      bone.position.copy(sourceLocalPositions.get(id) ?? this.bindLocalPositions.get(id));
      bone.quaternion.copy(local);
      bone.scale.copy(this.bindLocalScales.get(id));
    }

    const rootId = this.rootBones[0].name;
    const sourceRoot = sourceRest.get(rootId);
    const poseRoot = posePoints.get(rootId);
    if (sourceRoot && poseRoot) {
      this.rootBones[0].position.copy(sourceLocalPositions.get(rootId) ?? this.bindLocalPositions.get(rootId)).add(
        this.temp.a.set(
          poseRoot.x - sourceRoot.x,
          poseRoot.y - sourceRoot.y,
          poseRoot.z - sourceRoot.z,
        ),
      );
    }
  }

  calculateJointDeltaRotation(id, restPoints, posePoints) {
    const THREE = this.THREE;
    if (id === 'hips') {
      return bodyFrameRotation(
        THREE, restPoints, posePoints,
        'leftUpperLeg', 'rightUpperLeg', 'hips', 'upperChest',
      );
    }
    if (id === 'upperChest') {
      return bodyFrameRotation(
        THREE, restPoints, posePoints,
        'leftUpperArm', 'rightUpperArm', 'upperChest', 'neck',
      );
    }

    const restPoint = restPoints.get(id);
    const currentPoint = posePoints.get(id);
    const childId = PRIMARY_CHILD[id];
    if (childId && restPoint && currentPoint) {
      const restChild = restPoints.get(childId);
      const currentChild = posePoints.get(childId);
      if (restChild && currentChild) {
        const restDirection = this.temp.a.set(restChild.x, restChild.y, restChild.z)
          .sub(this.temp.b.set(restPoint.x, restPoint.y, restPoint.z));
        const currentDirection = this.temp.c.set(currentChild.x, currentChild.y, currentChild.z)
          .sub(this.temp.b.set(currentPoint.x, currentPoint.y, currentPoint.z));
        if (restDirection.lengthSq() > EPSILON && currentDirection.lengthSq() > EPSILON) {
          return new THREE.Quaternion().setFromUnitVectors(
            restDirection.normalize(),
            currentDirection.normalize(),
          );
        }
      }
    }

    const parentId = PARENT_FALLBACK[id];
    if (parentId && restPoint && currentPoint) {
      const restParent = restPoints.get(parentId);
      const currentParent = posePoints.get(parentId);
      if (restParent && currentParent) {
        const restDirection = this.temp.a.set(restPoint.x, restPoint.y, restPoint.z)
          .sub(this.temp.b.set(restParent.x, restParent.y, restParent.z));
        const currentDirection = this.temp.c.set(currentPoint.x, currentPoint.y, currentPoint.z)
          .sub(this.temp.b.set(currentParent.x, currentParent.y, currentParent.z));
        if (restDirection.lengthSq() > EPSILON && currentDirection.lengthSq() > EPSILON) {
          return new THREE.Quaternion().setFromUnitVectors(
            restDirection.normalize(),
            currentDirection.normalize(),
          );
        }
      }
    }
    return new THREE.Quaternion();
  }

  cacheSkinMatrices() {
    for (let index = 0; index < this.jointIds.length; index += 1) {
      const bone = this.bonesById.get(this.jointIds[index]);
      this.temp.matrix.multiplyMatrices(bone.matrixWorld, this.skeleton.boneInverses[index]);
      this.skinMatrices.set(this.temp.matrix.elements, index * 16);
    }
  }

  sampleDeformedPositions() {
    const sourcePositions = this.shapedRestPositions ?? this.restPositions;
    if (!this.skinMatrices) return new Float32Array(sourcePositions ?? 0);
    const output = new Float32Array(sourcePositions.length);
    deformSurfaceLbs(
      sourcePositions,
      output,
      this.skinIndices,
      this.skinWeights,
      this.skinMatrices,
    );
    return output;
  }

  setBodyShape(profileInput = {}) {
    this.bodyShapeProfile = normalizeBodyShapeProfile(profileInput);
    this.bodyShapeResponse = createSkinShapeResponse(this.bodyShapeProfile);
    this.applyBodyShapeToGeometry();
    return structuredClone(this.bodyShapeResponse);
  }

  applyBodyShapeToGeometry({ force = false } = {}) {
    if (!this.restPositions || !this.mesh?.geometry?.attributes?.position) return false;
    const key = bodyShapeProfileKey(this.bodyShapeProfile);
    this.mesh.userData.bodyShapeId = this.bodyShapeProfile.body_shape_id;
    this.mesh.userData.bodyShapeRevision = this.bodyShapeProfile.version;
    this.mesh.userData.bodyShapeMethod = this.bodyShapeResponse.method;
    if (!force && key === this.lastBodyShapeKey) return false;
    this.shapedRestPositions = deformSkinPositions(this.restPositions, this.bodyShapeProfile);
    const position = this.mesh.geometry.attributes.position;
    position.array.set(this.shapedRestPositions);
    position.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    this.mesh.geometry.computeBoundingBox();
    this.mesh.geometry.computeBoundingSphere();
    this.lastBodyShapeKey = key;
    return true;
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    if (!this.group) return;
    this.group.visible = this.visible;
    const attached = this.group.parent === this.scene;
    if (!this.ownsPrimarySurfaceSlot()) {
      if (attached) this.scene.remove(this.group);
      return;
    }
    if (this.visible && !attached) this.scene.add(this.group);
    if (!this.visible && attached) this.scene.remove(this.group);
    this.auditSceneSurfaces({ purge: true, phase: this.visible ? 'show-primary' : 'hide-primary' });
  }

  setSource(_source) {
    this.source = 'detail';
  }

  getActiveSource() {
    return this.visible && this.ownsPrimarySurfaceSlot() ? 'detail' : 'hidden';
  }

  setOpacity(value) {
    this.opacity = clamp(Number(value), 0.2, 1);
    this.applyMaterialDisplay();
  }

  setMode(mode) {
    this.mode = ['solid', 'translucent', 'wireframe'].includes(mode) ? mode : 'solid';
    this.applyMaterialDisplay();
  }

  applyMaterialDisplay() {
    if (!this.material) return;
    const effectiveOpacity = this.mode === 'translucent'
      ? Math.min(this.opacity, 0.72)
      : this.opacity;
    this.material.wireframe = this.mode === 'wireframe';
    this.material.opacity = effectiveOpacity;
    this.material.transparent = this.mode === 'translucent' || effectiveOpacity < 0.999;
    this.material.depthWrite = effectiveOpacity >= 0.78 && this.mode !== 'translucent';
    this.material.needsUpdate = true;
  }

  getPickTargets() {
    const sceneAudit = this.auditSceneSurfaces({ purge: true, phase: 'pick-targets' });
    if (!this.visible || !this.mesh || !this.ownsPrimarySurfaceSlot()) return [];
    if (sceneAudit.duplicateSurfaceCount > 0 || sceneAudit.visibleSurfaceCount > 1) return [];
    return [this.mesh];
  }

  resolvePick(intersection) {
    if (!intersection || intersection.object !== this.mesh) return null;
    const jointIndex = this.resolveDominantJointIndex(intersection);
    if (!Number.isInteger(jointIndex)) return null;
    const jointId = this.jointIds[jointIndex];
    if (!jointId) return null;
    return {
      kind: 'joint',
      jointId,
      point: intersection.point?.clone?.() ?? intersection.point,
      distance: intersection.distance,
      surfacePart: 'detailed-smpl-skinned-mesh',
    };
  }

  resolveDominantJointIndex(intersection) {
    if (!this.skinIndices || !this.skinWeights) return this.nearestJointIndex(intersection.point);
    const vertices = faceVertexIndices(this.mesh.geometry, intersection);
    if (!vertices.length) return this.nearestJointIndex(intersection.point);
    const scores = new Float64Array(this.jointIds.length);
    for (const vertexIndex of vertices) {
      const offset = vertexIndex * 4;
      for (let slot = 0; slot < 4; slot += 1) {
        const index = this.skinIndices[offset + slot];
        scores[index] += this.skinWeights[offset + slot];
      }
    }
    let bestIndex = 0;
    let bestScore = -1;
    for (let index = 0; index < scores.length; index += 1) {
      if (scores[index] > bestScore) {
        bestScore = scores[index];
        bestIndex = index;
      }
    }
    return bestIndex;
  }

  nearestJointIndex(point) {
    if (!point) return this.boneIndexById.get('hips') ?? 0;
    let bestIndex = this.boneIndexById.get('hips') ?? 0;
    let bestDistance = Infinity;
    for (let index = 0; index < this.jointIds.length; index += 1) {
      const bone = this.bonesById.get(this.jointIds[index]);
      const candidate = bone?.getWorldPosition?.(this.temp.a) ?? this.assetRestPoints.get(this.jointIds[index]);
      if (!candidate) continue;
      const dx = point.x - candidate.x;
      const dy = point.y - candidate.y;
      const dz = point.z - candidate.z;
      const distance = dx * dx + dy * dy + dz * dz;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    return bestIndex;
  }

  getDiagnostics() {
    const sceneAudit = this.auditSceneSurfaces({ purge: true, phase: 'diagnostics' });
    const geometry = this.mesh?.geometry;
    const position = geometry?.attributes?.position;
    const attached = this.group?.parent === this.scene;
    const ownsSlot = this.ownsPrimarySurfaceSlot();
    const renderableCount = sceneAudit.visibleSurfaceCount;
    const pickable = Boolean(
      ownsSlot
      && this.visible
      && attached
      && this.mesh?.visible !== false
      && sceneAudit.duplicateSurfaceCount === 0
      && renderableCount <= 1,
    ) ? 1 : 0;
    return {
      type: 'single-smpl-human-surface',
      pipeline: 'native-glb-skinnedmesh',
      buildId: SKIN_RUNTIME_BUILD.buildId,
      patchId: SKIN_RUNTIME_BUILD.patchId,
      moduleVersion: SKIN_RUNTIME_BUILD.moduleVersion,
      compatibleRigVersion: SKIN_RUNTIME_BUILD.compatibleRigVersion,
      state: this.lastSurfaceState?.state ?? 'loading',
      visible: this.visible,
      opacity: this.opacity,
      effectiveOpacity: this.material?.opacity ?? this.opacity,
      mode: this.mode,
      requestedSource: 'detail',
      activeSource: this.getActiveSource(),
      singleVisibleSurface: sceneAudit.duplicateSurfaceCount === 0 && renderableCount <= 1,
      renderableSurfaceCount: renderableCount,
      sceneSurfaceMeshCount: sceneAudit.surfaceMeshCount,
      duplicateSurfaceCount: sceneAudit.duplicateSurfaceCount,
      visibleDuplicateSurfaceCount: sceneAudit.visibleDuplicateSurfaceCount,
      legacySurfaceRemovalCount: this.removedLegacySurfaceCount,
      removedLegacySurfaces: [...this.removedLegacySurfaces],
      proceduralSurfacePresent: false,
      duplicateSurfaceDetectedAfterGuard: sceneAudit.duplicateSurfaceCount > 0,
      attachedToScene: attached,
      ownsPrimarySurfaceSlot: ownsSlot,
      surfaceOwnerToken: this.surfaceOwnerToken,
      meshVisible: Boolean(this.mesh?.visible !== false && this.visible && attached && ownsSlot),
      meshType: this.mesh?.isSkinnedMesh ? 'SkinnedMesh' : this.mesh?.constructor?.name ?? '',
      weightsReady: this.weightsReady,
      nativeSkinAttributes: Boolean(geometry?.attributes?.skinIndex && geometry?.attributes?.skinWeight),
      inverseBindMatrices: Boolean(this.skeleton?.boneInverses?.length === this.jointIds.length),
      jointCount: this.jointIds.length,
      vertexCount: position?.count ?? 0,
      triangleCount: geometry?.index ? Math.floor(geometry.index.count / 3) : 0,
      pickSource: 'detailed-smpl-skinned-mesh',
      pickable,
      deformation: 'native Three.js SkinnedMesh GPU linear blend skinning',
      bodyShape: structuredClone(this.bodyShapeResponse),
      bodyShapeAppliedToSkinOnly: true,
      bindPoseProtected: Boolean(this.mesh?.userData?.bindPoseProtected),
      referenceBindingMismatch: Boolean(this.lastCompatibilityMismatch),
      assetWeightStatus: this.mesh?.userData?.assetWeightStatus ?? 'unknown',
      assetUrl: SMPL_SKINNED_ASSET_URL,
      assetSha256: SKIN_RUNTIME_BUILD.assetSha256,
      continuousSceneGuard: Boolean(this.sceneAuditTimer),
      sceneAuditIntervalMs: this.sceneAuditIntervalMs,
      sceneAuditCount: this.sceneAuditCount,
      sceneAudit,
      migrationFrom: LEGACY_RUNTIME_PROVENANCE,
    };
  }

  emitState(state, label, detail) {
    this.lastSurfaceState = { state, label, detail };
    this.callbacks.onSurfaceState?.(this.lastSurfaceState);
  }

  dispose() {
    this.disposed = true;
    this.stopSceneAuditMonitor();
    if (this.group?.parent === this.scene) this.scene.remove(this.group);
    if (this.ownsPrimarySurfaceSlot()) {
      this.scene.userData[SURFACE_OWNER_KEY] = null;
    }
    this.skeleton?.dispose?.();
    this.mesh?.geometry?.dispose?.();
    this.material?.dispose?.();
    this.skinIndices = null;
    this.skinWeights = null;
    this.inverseBindMatrices = null;
    this.skinMatrices = null;
    this.restPositions = null;
    this.shapedRestPositions = null;
  }
}

function inspectSceneSurfaceMeshes(scene, primaryMesh, sceneOwnerToken) {
  const entries = [];
  walkScene(scene, (object) => {
    if (!object?.isMesh || isEditorVisualMesh(object) || isAllowedNonSurfaceMesh(object)) return;
    const primary = object === primaryMesh || Boolean(
      sceneOwnerToken
      && object?.userData?.surfaceOwnerToken === sceneOwnerToken
      && object?.userData?.humanoidSurfaceRole === 'primary-render-surface',
    );
    entries.push({
      object,
      primary,
      name: object.name || '(unnamed mesh)',
      type: object.isSkinnedMesh ? 'SkinnedMesh' : object.constructor?.name || 'Mesh',
      path: objectPath(object),
      visible: isEffectivelyVisible(object),
      reason: primary ? 'registered-primary-surface' : surfaceCandidateReason(object),
    });
  });
  return entries;
}

function walkScene(root, visit) {
  for (const child of [...(root?.children ?? [])]) {
    visit(child);
    walkScene(child, visit);
  }
}

function isEditorVisualMesh(object) {
  if (EDITOR_VISUAL_KINDS.has(object?.userData?.kind)) return true;
  let current = object?.parent;
  while (current) {
    if (EDITOR_VISUAL_GROUPS.has(current.name)) return true;
    current = current.parent;
  }
  return false;
}

function isAllowedNonSurfaceMesh(object) {
  if (object?.userData?.allowAlongsideHumanoidSurface === true) return true;
  if (ALLOWED_ATTACHMENT_ROLES.has(object?.userData?.humanoidAttachmentRole)) return true;
  const name = String(object?.name ?? '');
  return /(?:ground|floor|grid|helper|environment|collision-debug)/i.test(name);
}

function surfaceCandidateReason(object) {
  if (object?.userData?.humanoidSurfaceRole) return `surface-role:${object.userData.humanoidSurfaceRole}`;
  if (object?.userData?.surfaceEngine) return 'surface-engine-metadata';
  if (object?.userData?.surfacePickSource) return 'surface-pick-metadata';
  if (/(?:smpl|meshcapade|human|body|surface|skin|proxy|selection)/i.test(object?.name ?? '')) {
    return 'surface-name-match';
  }
  return 'unregistered-render-mesh-in-humanoid-viewport';
}

function isEffectivelyVisible(object) {
  let current = object;
  while (current) {
    if (current.visible === false) return false;
    current = current.parent;
  }
  return true;
}

function objectPath(object) {
  const names = [];
  let current = object;
  while (current) {
    names.push(current.name || current.constructor?.name || 'Object3D');
    current = current.parent;
  }
  return names.reverse().join('/');
}

function toPublicSurfaceRecord(entry) {
  return {
    primary: entry.primary,
    name: entry.name,
    type: entry.type,
    path: entry.path,
    visible: entry.visible,
    reason: entry.reason,
  };
}

function createReliableSurfaceMaterial(THREE) {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.78,
    metalness: 0,
    transparent: false,
    opacity: 1,
    depthTest: true,
    depthWrite: true,
    side: THREE.FrontSide ?? 0,
    vertexColors: true,
  });
}

function createNativeThreeGeometry(THREE, meshData) {
  if (meshData.mode !== 4) throw new Error(`人体表皮网格模式 ${meshData.mode} 暂不支持。`);
  const geometry = new THREE.BufferGeometry();
  const sourcePosition = meshData.attributes.position;
  const sourceNormal = meshData.attributes.normal;
  const sourceColor = meshData.attributes.color;
  const sourceUv = meshData.attributes.uv;
  const sourceSkinIndex = meshData.attributes.skinIndex;
  const sourceSkinWeight = meshData.attributes.skinWeight;

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(sourcePosition.array), 3));
  if (sourceNormal) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(sourceNormal.array), 3));
  else geometry.computeVertexNormals();
  if (sourceColor) {
    geometry.setAttribute('color', new THREE.BufferAttribute(
      new sourceColor.array.constructor(sourceColor.array),
      sourceColor.itemSize,
      sourceColor.normalized,
    ));
  }
  if (sourceUv) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(sourceUv.array), 2));
  geometry.setAttribute('skinIndex', new THREE.BufferAttribute(
    new sourceSkinIndex.array.constructor(sourceSkinIndex.array),
    4,
    false,
  ));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(
    new Float32Array(sourceSkinWeight.decodedArray ?? sourceSkinWeight.array),
    4,
  ));
  if (meshData.index) {
    geometry.setIndex(new THREE.BufferAttribute(
      new meshData.index.array.constructor(meshData.index.array),
      1,
      false,
    ));
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function applyNodeTransform(THREE, object, node) {
  if (Array.isArray(node.matrix)) {
    const matrix = new THREE.Matrix4().fromArray(node.matrix);
    matrix.decompose(object.position, object.quaternion, object.scale);
    return;
  }
  object.position.fromArray(node.translation ?? [0, 0, 0]);
  object.quaternion.fromArray(node.rotation ?? [0, 0, 0, 1]);
  object.scale.fromArray(node.scale ?? [1, 1, 1]);
}

function buildSourceLocalPositions(THREE, restPoints, parentIdById, jointIds, fallback) {
  const result = new Map();
  for (const id of jointIds) {
    const point = restPoints.get(id);
    if (!point) {
      result.set(id, fallback.get(id));
      continue;
    }
    const parentId = parentIdById.get(id);
    const parent = parentId ? restPoints.get(parentId) : null;
    result.set(
      id,
      new THREE.Vector3(
        point.x - (parent?.x ?? 0),
        point.y - (parent?.y ?? 0),
        point.z - (parent?.z ?? 0),
      ),
    );
  }
  return result;
}

function orderJointIds(jointIds, parentIdById) {
  const remaining = new Set(jointIds);
  const ordered = [];
  while (remaining.size) {
    let progressed = false;
    for (const id of jointIds) {
      if (!remaining.has(id)) continue;
      const parentId = parentIdById.get(id);
      if (!parentId || ordered.includes(parentId)) {
        ordered.push(id);
        remaining.delete(id);
        progressed = true;
      }
    }
    if (!progressed) throw new Error('蒙皮骨架父子层级存在循环或缺失父级。');
  }
  return ordered;
}

function deformSurfaceLbs(restPositions, outputPositions, skinIndices, skinWeights, skinMatrices) {
  const vertexCount = restPositions.length / 3;
  for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
    const pOffset = vertexIndex * 3;
    const sOffset = vertexIndex * 4;
    const px = restPositions[pOffset];
    const py = restPositions[pOffset + 1];
    const pz = restPositions[pOffset + 2];
    let x = 0;
    let y = 0;
    let z = 0;
    for (let slot = 0; slot < 4; slot += 1) {
      const weight = skinWeights[sOffset + slot];
      if (weight <= 0) continue;
      const matrixOffset = skinIndices[sOffset + slot] * 16;
      x += weight * (
        skinMatrices[matrixOffset] * px
        + skinMatrices[matrixOffset + 4] * py
        + skinMatrices[matrixOffset + 8] * pz
        + skinMatrices[matrixOffset + 12]
      );
      y += weight * (
        skinMatrices[matrixOffset + 1] * px
        + skinMatrices[matrixOffset + 5] * py
        + skinMatrices[matrixOffset + 9] * pz
        + skinMatrices[matrixOffset + 13]
      );
      z += weight * (
        skinMatrices[matrixOffset + 2] * px
        + skinMatrices[matrixOffset + 6] * py
        + skinMatrices[matrixOffset + 10] * pz
        + skinMatrices[matrixOffset + 14]
      );
    }
    outputPositions[pOffset] = x;
    outputPositions[pOffset + 1] = y;
    outputPositions[pOffset + 2] = z;
  }
  return outputPositions;
}
function createWeightChains(points, boneIndexById) {
  const pointArray = (ids) => ids.map((id) => {
    const point = points.get(id);
    return point ? [point.x, point.y, point.z] : null;
  });
  const chain = (name, ids, radii) => ({
    name,
    ids,
    indices: ids.map((id) => boneIndexById.get(id)),
    radii,
    points: pointArray(ids),
  });
  return [
    chain('torso', ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head'], [0.23, 0.23, 0.24, 0.17, 0.145]),
    chain('leftArm', ['leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand', 'leftHandEnd'], [0.115, 0.095, 0.068, 0.055]),
    chain('rightArm', ['rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand', 'rightHandEnd'], [0.115, 0.095, 0.068, 0.055]),
    chain('leftLeg', ['leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes'], [0.145, 0.115, 0.082]),
    chain('rightLeg', ['rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes'], [0.145, 0.115, 0.082]),
  ].filter((item) => item.points.every(Boolean) && item.indices.every(Number.isInteger));
}

/** Returns only anatomically compatible chains for one bind-pose vertex. */
function selectWeightCandidates(x, y, z, chains) {
  const byName = new Map(chains.map((chain) => [chain.name, chain]));
  const candidates = [];
  const absX = Math.abs(x);
  const side = x < 0 ? 'left' : 'right';

  if (y >= 1.50) {
    pushCandidate(candidates, byName.get('torso'), 1);
    return candidates;
  }

  const armBoundary = armBoundaryAtHeight(y);
  const armMask = smoothstep(armBoundary - 0.035, armBoundary + 0.035, absX)
    * smoothstep(0.72, 0.82, y)
    * (1 - smoothstep(1.48, 1.55, y));
  const shoulderTransition = smoothstep(1.20, 1.30, y)
    * (1 - smoothstep(1.47, 1.53, y))
    * smoothstep(0.145, 0.205, absX);

  if (y >= 0.74) {
    const torsoMultiplier = Math.max(0.02, 1 - armMask * 0.96);
    pushCandidate(candidates, byName.get('torso'), torsoMultiplier);
    pushCandidate(candidates, byName.get(`${side}Arm`), Math.max(armMask, shoulderTransition * 0.62));
    if (absX < 0.025 && shoulderTransition < 0.05) {
      pushCandidate(candidates, byName.get(side === 'left' ? 'rightArm' : 'leftArm'), 0.002);
    }
  }

  // Lower-body candidates are limited to the pelvis and leg corridor.
  // A-pose hands sit near y=0.83 and x=+-0.39, so an unbounded leg mask
  // would mix hand vertices with the hip and thigh and create long spikes.
  const legBoundary = lowerBodyBoundaryAtHeight(y);
  const insideLegCorridor = absX <= legBoundary;
  const legMask = insideLegCorridor
    ? (1 - smoothstep(0.91, 1.04, y)) * smoothstep(0.015, 0.075, absX)
    : 0;
  if ((legMask > 0.001 || y < 0.76) && (insideLegCorridor || y < 0.70)) {
    pushCandidate(candidates, byName.get(`${side}Leg`), Math.max(legMask, y < 0.76 ? 1 : 0));
    if (y > 0.78) pushCandidate(candidates, byName.get('torso'), smoothstep(0.78, 0.96, y) * 0.42);
  }

  // Forefoot vertices can cross the sagittal plane. Keep them on the nearest
  // leg using lateral sign and the forward Z coordinate.
  if (y < 0.20 && z > 0.035) {
    candidates.length = 0;
    pushCandidate(candidates, byName.get(`${side}Leg`), 1);
  }

  return mergeCandidates(candidates);
}

function pushCandidate(target, chain, multiplier) {
  if (chain && multiplier > 1e-6) target.push({ chain, multiplier });
}

function mergeCandidates(candidates) {
  const merged = new Map();
  for (const item of candidates) {
    const previous = merged.get(item.chain.name);
    if (!previous || item.multiplier > previous.multiplier) merged.set(item.chain.name, item);
  }
  return [...merged.values()];
}

function armBoundaryAtHeight(y) {
  if (y >= 1.34) return 0.18;
  if (y <= 0.82) return 0.26;
  return 0.18 + (1.34 - y) * (0.08 / 0.52);
}

function lowerBodyBoundaryAtHeight(y) {
  if (y >= 1.02) return 0.16;
  if (y <= 0.70) return 0.26;
  return 0.16 + (1.02 - y) * (0.10 / 0.32);
}

function fallbackJointForVertex(x, y, z) {
  if (y > 1.52) return 'head';
  if (y > 1.40) return 'neck';
  if (y > 1.02) return 'upperChest';
  if (y > 0.78) return 'hips';
  const side = x < 0 ? 'left' : 'right';
  if (y > 0.30) return `${side}UpperLeg`;
  if (y > 0.12) return `${side}LowerLeg`;
  return z > 0.05 ? `${side}Toes` : `${side}Foot`;
}

function evaluateChainNumeric(x, y, z, chain) {
  let bestNormalizedDistance = Infinity;
  let bestSegment = 0;
  let bestT = 0;
  let bestRadius = 0.1;
  for (let index = 0; index < chain.points.length - 1; index += 1) {
    const a = chain.points[index];
    const b = chain.points[index + 1];
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const abz = b[2] - a[2];
    const apx = x - a[0];
    const apy = y - a[1];
    const apz = z - a[2];
    const lengthSq = abx * abx + aby * aby + abz * abz;
    const t = lengthSq > EPSILON
      ? clamp((apx * abx + apy * aby + apz * abz) / lengthSq, 0, 1)
      : 0;
    const dx = apx - abx * t;
    const dy = apy - aby * t;
    const dz = apz - abz * t;
    const radius = chain.radii[index] ?? chain.radii.at(-1) ?? 0.1;
    const normalizedDistance = Math.sqrt(dx * dx + dy * dy + dz * dz) / radius;
    if (normalizedDistance < bestNormalizedDistance) {
      bestNormalizedDistance = normalizedDistance;
      bestSegment = index;
      bestT = t;
      bestRadius = radius;
    }
  }
  const score = Math.exp(-0.5 * bestNormalizedDistance * bestNormalizedDistance) * (0.75 + bestRadius);
  return { chain, score, segmentIndex: bestSegment, t: bestT };
}

function addChainInfluencesNumeric(target, touched, result) {
  const { chain, segmentIndex, t, score } = result;
  const aIndex = chain.indices[segmentIndex];
  const bIndex = chain.indices[segmentIndex + 1];
  addWeightNumeric(target, touched, aIndex, score * (1 - t));
  addWeightNumeric(target, touched, bIndex, score * t);
  const previousIndex = chain.indices[segmentIndex - 1];
  const nextIndex = chain.indices[segmentIndex + 2];
  if (Number.isInteger(previousIndex)) addWeightNumeric(target, touched, previousIndex, score * 0.08 * (1 - t));
  if (Number.isInteger(nextIndex)) addWeightNumeric(target, touched, nextIndex, score * 0.08 * t);
}

function addWeightNumeric(target, touched, index, value) {
  if (!Number.isInteger(index) || value <= 0) return;
  target[index] += value;
  touched[index] = 1;
}

/**
 * Smooth sparse weights over the real triangle adjacency graph. Neighbouring
 * shoulder and hip vertices then receive compatible bone mixtures, reducing
 * spikes and hard seams without adding another surface layer.
 */
function smoothSkinWeights(
  geometry,
  skinIndices,
  skinWeights,
  jointCount,
  { passes = 2, alpha = 0.32 } = {},
) {
  const triangleIndices = geometry?.index?.array;
  const position = geometry?.attributes?.position;
  if (!triangleIndices || !position?.count || passes <= 0 || alpha <= 0) return;

  const vertexCount = position.count;
  const clampedAlpha = clamp(alpha, 0, 0.8);
  const ownScale = 1 - clampedAlpha;
  const neighborAccum = new Float32Array(vertexCount * jointCount);
  const neighborCount = new Uint16Array(vertexCount);
  const nextIndices = new Uint16Array(skinIndices.length);
  const nextWeights = new Float32Array(skinWeights.length);
  const influence = new Float64Array(jointCount);
  const touched = new Uint8Array(jointCount);

  const accumulateNeighbor = (targetVertex, sourceVertex) => {
    const targetBase = targetVertex * jointCount;
    const sourceBase = sourceVertex * 4;
    for (let slot = 0; slot < 4; slot += 1) {
      const weight = skinWeights[sourceBase + slot];
      if (weight <= 0) continue;
      const jointIndex = skinIndices[sourceBase + slot];
      neighborAccum[targetBase + jointIndex] += weight;
    }
    neighborCount[targetVertex] += 1;
  };

  for (let pass = 0; pass < passes; pass += 1) {
    neighborAccum.fill(0);
    neighborCount.fill(0);

    for (let offset = 0; offset < triangleIndices.length; offset += 3) {
      const a = triangleIndices[offset];
      const b = triangleIndices[offset + 1];
      const c = triangleIndices[offset + 2];
      accumulateNeighbor(a, b); accumulateNeighbor(a, c);
      accumulateNeighbor(b, a); accumulateNeighbor(b, c);
      accumulateNeighbor(c, a); accumulateNeighbor(c, b);
    }

    for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
      influence.fill(0);
      touched.fill(0);
      const sparseOffset = vertexIndex * 4;
      for (let slot = 0; slot < 4; slot += 1) {
        const weight = skinWeights[sparseOffset + slot] * ownScale;
        if (weight <= 0) continue;
        const jointIndex = skinIndices[sparseOffset + slot];
        influence[jointIndex] += weight;
        touched[jointIndex] = 1;
      }

      const count = neighborCount[vertexIndex];
      if (count > 0) {
        const denseOffset = vertexIndex * jointCount;
        const scale = clampedAlpha / count;
        for (let jointIndex = 0; jointIndex < jointCount; jointIndex += 1) {
          const weight = neighborAccum[denseOffset + jointIndex] * scale;
          if (weight <= 0) continue;
          influence[jointIndex] += weight;
          touched[jointIndex] = 1;
        }
      }

      writeFourStrongestInfluences(
        influence,
        touched,
        nextIndices,
        nextWeights,
        vertexIndex,
        skinIndices[sparseOffset] ?? 0,
      );
    }

    skinIndices.set(nextIndices);
    skinWeights.set(nextWeights);
  }
}

function hasTouched(touched) {
  for (let index = 0; index < touched.length; index += 1) if (touched[index]) return true;
  return false;
}

function writeFourStrongestInfluences(influence, touched, skinIndices, skinWeights, vertexIndex, fallbackIndex) {
  const bestIndices = [fallbackIndex, fallbackIndex, fallbackIndex, fallbackIndex];
  const bestWeights = [0, 0, 0, 0];
  for (let index = 0; index < influence.length; index += 1) {
    if (!touched[index]) continue;
    const value = influence[index];
    for (let slot = 0; slot < 4; slot += 1) {
      if (value <= bestWeights[slot]) continue;
      for (let shift = 3; shift > slot; shift -= 1) {
        bestWeights[shift] = bestWeights[shift - 1];
        bestIndices[shift] = bestIndices[shift - 1];
      }
      bestWeights[slot] = value;
      bestIndices[slot] = index;
      break;
    }
  }
  const total = bestWeights[0] + bestWeights[1] + bestWeights[2] + bestWeights[3] || 1;
  const offset = vertexIndex * 4;
  for (let slot = 0; slot < 4; slot += 1) {
    skinIndices[offset + slot] = bestIndices[slot];
    skinWeights[offset + slot] = bestWeights[slot] / total;
  }
}

/** Dual quaternion deformation keeps shoulder and hip volume better than LBS. */
function deformSurfaceDqs(
  restPositions,
  restNormals,
  outputPositions,
  outputNormals,
  skinIndices,
  skinWeights,
  dualQuaternions,
) {
  const vertexCount = restPositions.length / 3;
  for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
    const pOffset = vertexIndex * 3;
    const sOffset = vertexIndex * 4;
    const firstJoint = skinIndices[sOffset];
    const firstOffset = firstJoint * 8;
    const refX = dualQuaternions[firstOffset];
    const refY = dualQuaternions[firstOffset + 1];
    const refZ = dualQuaternions[firstOffset + 2];
    const refW = dualQuaternions[firstOffset + 3];

    let rx = 0; let ry = 0; let rz = 0; let rw = 0;
    let dx = 0; let dy = 0; let dz = 0; let dw = 0;
    for (let slot = 0; slot < 4; slot += 1) {
      const weight = skinWeights[sOffset + slot];
      if (weight <= 0) continue;
      const qOffset = skinIndices[sOffset + slot] * 8;
      let qx = dualQuaternions[qOffset];
      let qy = dualQuaternions[qOffset + 1];
      let qz = dualQuaternions[qOffset + 2];
      let qw = dualQuaternions[qOffset + 3];
      let qdx = dualQuaternions[qOffset + 4];
      let qdy = dualQuaternions[qOffset + 5];
      let qdz = dualQuaternions[qOffset + 6];
      let qdw = dualQuaternions[qOffset + 7];
      const sign = qx * refX + qy * refY + qz * refZ + qw * refW < 0 ? -1 : 1;
      qx *= sign; qy *= sign; qz *= sign; qw *= sign;
      qdx *= sign; qdy *= sign; qdz *= sign; qdw *= sign;
      rx += weight * qx; ry += weight * qy; rz += weight * qz; rw += weight * qw;
      dx += weight * qdx; dy += weight * qdy; dz += weight * qdz; dw += weight * qdw;
    }

    const norm = Math.sqrt(rx * rx + ry * ry + rz * rz + rw * rw) || 1;
    rx /= norm; ry /= norm; rz /= norm; rw /= norm;
    dx /= norm; dy /= norm; dz /= norm; dw /= norm;
    const dualDot = rx * dx + ry * dy + rz * dz + rw * dw;
    dx -= rx * dualDot; dy -= ry * dualDot; dz -= rz * dualDot; dw -= rw * dualDot;

    const translation = dualQuaternionTranslation(rx, ry, rz, rw, dx, dy, dz, dw);
    const position = rotatePointByQuaternion(
      restPositions[pOffset], restPositions[pOffset + 1], restPositions[pOffset + 2],
      rx, ry, rz, rw,
    );
    outputPositions[pOffset] = position[0] + translation[0];
    outputPositions[pOffset + 1] = position[1] + translation[1];
    outputPositions[pOffset + 2] = position[2] + translation[2];

    const normal = rotatePointByQuaternion(
      restNormals[pOffset], restNormals[pOffset + 1], restNormals[pOffset + 2],
      rx, ry, rz, rw,
    );
    const normalLength = Math.hypot(normal[0], normal[1], normal[2]) || 1;
    outputNormals[pOffset] = normal[0] / normalLength;
    outputNormals[pOffset + 1] = normal[1] / normalLength;
    outputNormals[pOffset + 2] = normal[2] / normalLength;
  }
}

function translationTimesQuaternion(tx, ty, tz, qx, qy, qz, qw) {
  return [
    0.5 * (tx * qw + ty * qz - tz * qy),
    0.5 * (ty * qw + tz * qx - tx * qz),
    0.5 * (tz * qw + tx * qy - ty * qx),
    -0.5 * (tx * qx + ty * qy + tz * qz),
  ];
}

function dualQuaternionTranslation(rx, ry, rz, rw, dx, dy, dz, dw) {
  return [
    2 * (-dw * rx + dx * rw - dy * rz + dz * ry),
    2 * (-dw * ry + dx * rz + dy * rw - dz * rx),
    2 * (-dw * rz - dx * ry + dy * rx + dz * rw),
  ];
}

function rotatePointByQuaternion(px, py, pz, qx, qy, qz, qw) {
  const tx = 2 * (qy * pz - qz * py);
  const ty = 2 * (qz * px - qx * pz);
  const tz = 2 * (qx * py - qy * px);
  return [
    px + qw * tx + (qy * tz - qz * ty),
    py + qw * ty + (qz * tx - qx * tz),
    pz + qw * tz + (qx * ty - qy * tx),
  ];
}

function isRestPose(restPoints, posePoints, jointIds, epsilon = REST_EPSILON) {
  for (const id of jointIds) {
    const rest = restPoints.get(id);
    const pose = posePoints.get(id);
    if (!rest || !pose) return false;
    if (
      Math.abs(rest.x - pose.x) > epsilon
      || Math.abs(rest.y - pose.y) > epsilon
      || Math.abs(rest.z - pose.z) > epsilon
    ) return false;
  }
  return true;
}

function bodyFrameRotation(THREE, restPoints, posePoints, leftId, rightId, originId, upId) {
  const restBasis = makeBodyBasis(THREE, restPoints, leftId, rightId, originId, upId);
  const currentBasis = makeBodyBasis(THREE, posePoints, leftId, rightId, originId, upId);
  const restQuaternion = new THREE.Quaternion().setFromRotationMatrix(restBasis);
  const currentQuaternion = new THREE.Quaternion().setFromRotationMatrix(currentBasis);
  return currentQuaternion.multiply(restQuaternion.invert()).normalize();
}

function makeBodyBasis(THREE, points, leftId, rightId, originId, upId) {
  const left = points.get(leftId);
  const rightPoint = points.get(rightId);
  const origin = points.get(originId);
  const upPoint = points.get(upId);
  const x = new THREE.Vector3().subVectors(rightPoint, left).normalize();
  const ySeed = new THREE.Vector3().subVectors(upPoint, origin).normalize();
  const z = new THREE.Vector3().crossVectors(x, ySeed).normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  return new THREE.Matrix4().makeBasis(x, y, z);
}

function faceVertexIndices(geometry, intersection) {
  if (intersection.face && Number.isInteger(intersection.face.a)) {
    return [intersection.face.a, intersection.face.b, intersection.face.c].filter(Number.isInteger);
  }
  if (!Number.isInteger(intersection.faceIndex)) return [];
  const triangleOffset = intersection.faceIndex * 3;
  const indexArray = geometry?.index?.array;
  if (indexArray) {
    return [indexArray[triangleOffset], indexArray[triangleOffset + 1], indexArray[triangleOffset + 2]]
      .filter(Number.isInteger);
  }
  return [triangleOffset, triangleOffset + 1, triangleOffset + 2];
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / Math.max(EPSILON, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function yieldToBrowser() {
  if (typeof requestAnimationFrame === 'function') {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }
  return Promise.resolve();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}


export const __surfaceTestUtils = Object.freeze({
  deformSurfaceLbs,
  deformSurfaceDqs,
  writeFourStrongestInfluences,
  selectWeightCandidates,
  smoothSkinWeights,
  isRestPose,
  rotatePointByQuaternion,
  translationTimesQuaternion,
  dualQuaternionTranslation,
});
