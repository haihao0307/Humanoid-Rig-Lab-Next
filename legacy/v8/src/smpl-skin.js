import { computePoseWorldPositions, computeRestWorldPositions } from './skeleton-model.js';
import { loadGlbSkin } from './glb-geometry.js';
import {
  bodyShapeProfileKey,
  createSkinShapeResponse,
  deformSkinPositions,
  normalizeBodyShapeProfile,
} from '../../../packages/body-shape/index.js';
import { ProductionSkinRuntime } from './production-skin-runtime.js';
import { SMPL24_COMPATIBILITY_BINDING_PROFILE_V4 } from './skin-binding-profile-v4.js';

const EPSILON = 1e-8;
const REST_EPSILON = 1e-7;
const SMPL_SKINNED_ASSET_URL = new URL('../assets/smpl/smpl-male-surface-skinned.glb', import.meta.url).href;

export const SKIN_RUNTIME_BUILD = Object.freeze({
  buildId: 'skin-v002-single-surface-guard',
  patchId: 'skin-patch-v002',
  moduleVersion: 'skin@0.5.1',
  compatibleRigVersion: 'rig@0.4.0',
  productionRuntimeVersion: 'production-skin-v4-runtime@1',
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

const RUNTIME_WEIGHT_PROFILE = 'anatomical-extended-deform-v3';
const POSE_CORRECTIVE_PROFILE = 'bone-driven-pose-corrective-v4';
export const POSE_CORRECTIVE_CHANNELS = Object.freeze([
  'shoulderRaise',
  'shoulderTwist',
  'hipTwist',
  'elbowFlex',
  'wristFlex',
  'kneeFlex',
]);

/**
 * Stable description of the live surface-deformation path. The default path
 * remains Three.js GPU LBS; DQS is deliberately kept as an opt-in CPU quality
 * reference. Every corrective evaluation starts from the immutable rest
 * buffer (or its current body-shape result), never from the previous frame.
 */
export const SKIN_DEFORMATION_PIPELINE = Object.freeze({
  schema: 'humanoid_rig/skin_deformation_pipeline@4.0',
  source: 'simulationRig.finalPose.localRotations',
  stages: Object.freeze([
    'simulationRig.finalPose.localRotations',
    'skin-binding-profile-v4',
    'core-to-deform-map',
    'bone-local-quaternions',
    'three-skeleton-update',
    'skin-matrix',
    'bone-driven-corrective',
    'three-gpu-lbs',
  ]),
  correctiveRegions: Object.freeze(['shoulder', 'elbow', 'wrist', 'hip', 'knee']),
  correctiveProfile: POSE_CORRECTIVE_PROFILE,
  productionDefault: 'three-gpu-lbs-with-bone-driven-correctives',
  experimentalModes: Object.freeze(['cpu-dqs-reference', 'offline-hybrid-reference']),
  nonAccumulating: true,
  rotationReconstructionFromWorldPositions: false,
  sourceAsset: Object.freeze({
    profile: 'smpl24',
    jointCount: 24,
    assetClass: 'compatibility',
    productionReady: false,
    authoredFingerWeights: false,
    authoredTwistWeights: false,
    authoredScapulaWeights: false,
  }),
  runtimeWeightExtension: Object.freeze({
    profile: RUNTIME_WEIGHT_PROFILE,
    mode: 'legacy-diagnostic-only',
    enabledByDefault: false,
    productionAuthoredWeights: false,
  }),
});

const POSE_CORRECTIVE_SPECS = Object.freeze([
  {
    id: 'leftShoulderVolume', category: 'shoulder', parentId: 'upperChest', driverId: 'leftUpperArm',
    jointId: 'leftUpperArm', childId: 'leftLowerArm', startAngle: 0.20, fullAngle: 1.25,
    parentSpan: 0.13, childSpan: 0.18, radius: 0.19, radialGain: 0.060,
  },
  {
    id: 'rightShoulderVolume', category: 'shoulder', parentId: 'upperChest', driverId: 'rightUpperArm',
    jointId: 'rightUpperArm', childId: 'rightLowerArm', startAngle: 0.20, fullAngle: 1.25,
    parentSpan: 0.13, childSpan: 0.18, radius: 0.19, radialGain: 0.060,
  },
  {
    id: 'leftElbowVolume', category: 'elbow', parentId: 'leftUpperArm', driverId: 'leftLowerArm',
    jointId: 'leftLowerArm', childId: 'leftHand', startAngle: 0.32, fullAngle: 1.75,
    parentSpan: 0.12, childSpan: 0.13, radius: 0.105, radialGain: 0.095,
  },
  {
    id: 'rightElbowVolume', category: 'elbow', parentId: 'rightUpperArm', driverId: 'rightLowerArm',
    jointId: 'rightLowerArm', childId: 'rightHand', startAngle: 0.32, fullAngle: 1.75,
    parentSpan: 0.12, childSpan: 0.13, radius: 0.105, radialGain: 0.095,
  },
  {
    id: 'leftWristVolume', category: 'wrist', parentId: 'leftLowerArm', driverId: 'leftHand',
    jointId: 'leftHand', childId: 'leftHandEnd', startAngle: 0.20, fullAngle: 1.15,
    parentSpan: 0.075, childSpan: 0.065, radius: 0.075, radialGain: 0.045,
  },
  {
    id: 'rightWristVolume', category: 'wrist', parentId: 'rightLowerArm', driverId: 'rightHand',
    jointId: 'rightHand', childId: 'rightHandEnd', startAngle: 0.20, fullAngle: 1.15,
    parentSpan: 0.075, childSpan: 0.065, radius: 0.075, radialGain: 0.045,
  },
  {
    id: 'leftHipVolume', category: 'hip', parentId: 'hips', driverId: 'leftUpperLeg',
    jointId: 'leftUpperLeg', childId: 'leftLowerLeg', startAngle: 0.24, fullAngle: 1.30,
    parentSpan: 0.14, childSpan: 0.20, radius: 0.205, radialGain: 0.060,
  },
  {
    id: 'rightHipVolume', category: 'hip', parentId: 'hips', driverId: 'rightUpperLeg',
    jointId: 'rightUpperLeg', childId: 'rightLowerLeg', startAngle: 0.24, fullAngle: 1.30,
    parentSpan: 0.14, childSpan: 0.20, radius: 0.205, radialGain: 0.060,
  },
  {
    id: 'leftKneeVolume', category: 'knee', parentId: 'leftUpperLeg', driverId: 'leftLowerLeg',
    jointId: 'leftLowerLeg', childId: 'leftFoot', startAngle: 0.28, fullAngle: 1.80,
    parentSpan: 0.16, childSpan: 0.16, radius: 0.125, radialGain: 0.090,
  },
  {
    id: 'rightKneeVolume', category: 'knee', parentId: 'rightUpperLeg', driverId: 'rightLowerLeg',
    jointId: 'rightLowerLeg', childId: 'rightFoot', startAngle: 0.28, fullAngle: 1.80,
    parentSpan: 0.16, childSpan: 0.16, radius: 0.125, radialGain: 0.090,
  },
]);

const TWIST_WEIGHT_SPECS = Object.freeze([
  { id: 'leftUpperArmTwist', sourceId: 'leftUpperArm', endId: 'leftLowerArm', radius: 0.105 },
  { id: 'rightUpperArmTwist', sourceId: 'rightUpperArm', endId: 'rightLowerArm', radius: 0.105 },
  { id: 'leftForearmTwist', sourceId: 'leftLowerArm', endId: 'leftHand', radius: 0.078 },
  { id: 'rightForearmTwist', sourceId: 'rightLowerArm', endId: 'rightHand', radius: 0.078 },
  { id: 'leftThighTwist', sourceId: 'leftUpperLeg', endId: 'leftLowerLeg', radius: 0.155 },
  { id: 'rightThighTwist', sourceId: 'rightUpperLeg', endId: 'rightLowerLeg', radius: 0.155 },
  { id: 'leftCalfTwist', sourceId: 'leftLowerLeg', endId: 'leftFoot', radius: 0.120 },
  { id: 'rightCalfTwist', sourceId: 'rightLowerLeg', endId: 'rightFoot', radius: 0.120 },
]);

const FINGER_WEIGHT_CHAINS = Object.freeze([
  ['ThumbMetacarpal', 'ThumbProximal', 'ThumbDistal'],
  ['IndexProximal', 'IndexIntermediate', 'IndexDistal'],
  ['MiddleProximal', 'MiddleIntermediate', 'MiddleDistal'],
  ['RingProximal', 'RingIntermediate', 'RingDistal'],
  ['LittleProximal', 'LittleIntermediate', 'LittleDistal'],
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
    this.legacyDiagnosticRuntimeWeights = callbacks.legacyDiagnosticRuntimeWeights === true;
    this.visible = true;
    this.opacity = 1;
    this.mode = 'solid';
    this.source = 'detail';
    this.disposed = false;
    this.weightsReady = false;
    this.lastDefinition = null;
    this.lastSurfaceState = null;
    this.lastCompatibilityMismatch = null;
    this.lastSimulationRigFrame = null;
    this.lastSimulationRigFrameId = '';
    this.poseAuthority = 'legacy-world-position-fallback';
    this.productionSkinRuntime = new ProductionSkinRuntime({
      bindingProfile: SMPL24_COMPATIBILITY_BINDING_PROFILE_V4,
    });
    this.productionPoseResult = null;
    this.assetJointIds = [];
    this.assetJointCount = 0;
    this.jointIds = [];
    this.orderedJointIds = [];
    this.boneIndexById = new Map();
    this.bonesById = new Map();
    this.parentIdById = new Map();
    this.primaryChildById = new Map();
    this.runtimeDeformMetaById = new Map();
    this.assetRestPoints = new Map();
    this.bindLocalPositions = new Map();
    this.bindLocalQuaternions = new Map();
    this.bindLocalScales = new Map();
    this.bindWorldQuaternions = new Map();
    this.skinIndices = null;
    this.skinWeights = null;
    this.inverseBindMatrices = null;
    this.skinMatrices = null;
    this.dualQuaternions = null;
    this.restPositions = null;
    this.shapedRestPositions = null;
    this.poseCorrectedRestPositions = null;
    this.restNormals = null;
    this.bodyShapeProfile = normalizeBodyShapeProfile();
    this.bodyShapeResponse = createSkinShapeResponse(this.bodyShapeProfile);
    this.lastBodyShapeKey = '';
    this.runtimeWeightStats = null;
    this.runtimeSkeletonStats = null;
    this.poseCorrectiveFields = [];
    this.poseCorrectiveStats = createInactivePoseCorrectiveStats();
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
    this.mesh.userData.surfaceEngine = 'Production Skin V4 native GLB SkinnedMesh';
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
    if (this.legacyDiagnosticRuntimeWeights) {
      this.appendRuntimeDeformSkeleton(definition);
      this.group.updateMatrixWorld(true);
    } else {
      this.runtimeSkeletonStats = {
        profile: 'skin-binding-v4-smpl24-compat@1',
        assetJointCount: this.assetJointCount,
        runtimeJointCount: this.jointIds.length,
        appendedJointCount: 0,
        twistJointCount: 0,
        correctiveJointCount: 0,
        fingerJointCount: 0,
        faceJointCount: 0,
        appendedJointIds: [],
        compatibility: 'asset skeleton preserved; no runtime deform joints appended',
      };
    }
    const runtimeBindPoints = new Map(this.jointIds.map((id) => [
      id,
      this.bonesById.get(id).getWorldPosition(new this.THREE.Vector3()),
    ]));
    this.runtimeWeightStats = this.legacyDiagnosticRuntimeWeights
      ? rebuildArticulationStableWeights(
        geometry,
        runtimeBindPoints,
        this.boneIndexById,
      )
      : summarizeRuntimeWeights(
        this.skinIndices,
        this.skinWeights,
        this.jointIds,
        {
          profile: 'asset-prebound-v4',
          vertexCount: geometry.attributes.position.count,
          runtimeWeightGeneration: false,
          extendedWeightingApplied: false,
          weightSource: 'asset-prebound',
        },
      );
    this.poseCorrectiveFields = buildPoseCorrectiveFields(
      this.shapedRestPositions ?? this.restPositions,
      runtimeBindPoints,
    );
    this.poseCorrectedRestPositions = new Float32Array(this.restPositions.length);
    this.mesh.userData.runtimeWeightProfile = this.runtimeWeightStats.profile;
    this.mesh.userData.runtimeWeightStats = structuredClone(this.runtimeWeightStats);
    this.mesh.userData.runtimeWeightGeneration = this.legacyDiagnosticRuntimeWeights;
    this.auditSceneSurfaces({ purge: true, phase: 'native-surface-attached' });

    const boneInverses = [];
    for (let index = 0; index < this.assetJointCount; index += 1) {
      const matrix = new this.THREE.Matrix4();
      matrix.fromArray(this.inverseBindMatrices, index * 16);
      boneInverses.push(matrix);
    }
    for (let index = this.assetJointCount; index < this.jointIds.length; index += 1) {
      const bone = this.bonesById.get(this.jointIds[index]);
      boneInverses.push(bone.matrixWorld.clone().invert());
    }
    this.skeleton = new this.THREE.Skeleton(
      this.jointIds.map((id) => this.bonesById.get(id)),
      boneInverses,
    );
    this.mesh.bindMode = 'attached';
    this.mesh.bind(this.skeleton, new this.THREE.Matrix4());
    this.mesh.normalizeSkinWeights?.();

    this.captureBindState();
    const definitionRest = computeRestWorldPositions(definition);
    const definitionRoot = definitionRest.get('hips') ?? definitionRest.get('root') ?? { x: 0, y: 0, z: 0 };
    this.productionSkinRuntime.bindCharacter({
      skinAsset: {
        assetReference: 'assets/smpl/smpl-male-surface-skinned.glb',
        compatibleRig: SKIN_RUNTIME_BUILD.compatibleRigVersion,
        vertexCount: geometry.attributes.position.count,
        jointIds: this.assetJointIds,
        attributes: [
          'POSITION',
          'NORMAL',
          ...(geometry.attributes.uv ? ['TEXCOORD_0'] : []),
          'JOINTS_0',
          'WEIGHTS_0',
        ],
        inverseBindMatrixCount: meshData.skin.inverseBindMatrices.count,
        productionReady: false,
      },
      bindingProfile: SMPL24_COMPATIBILITY_BINDING_PROFILE_V4,
      sourceRootPosition: [definitionRoot.x, definitionRoot.y, definitionRoot.z],
    });
    this.skinMatrices = new Float32Array(this.jointIds.length * 16);
    this.dualQuaternions = new Float32Array(this.jointIds.length * 8);
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
      'Production Skin V4 兼容表皮已就绪',
      `${SKIN_RUNTIME_BUILD.productionRuntimeVersion} · ${vertexCount.toLocaleString()} 顶点 · 预绑定权重 · 场景可见人体表皮 ${sceneAudit.visibleSurfaceCount} 层`,
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
    this.assetJointIds = [...skin.jointIds];
    this.assetJointCount = this.assetJointIds.length;
    this.jointIds = [...this.assetJointIds];
    this.boneIndexById.clear();
    this.bonesById.clear();
    this.parentIdById.clear();
    this.primaryChildById.clear();
    this.runtimeDeformMetaById.clear();

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
    this.rebuildPrimaryChildMap();
  }

  appendRuntimeDeformSkeleton(definition) {
    const definitionJoints = Array.isArray(definition?.joints) ? definition.joints : [];
    const definitionRestPoints = computeRestWorldPositions(definition);
    const appendable = definitionJoints.filter((joint) => (
      joint?.deformInfluence === true
      && !this.bonesById.has(joint.id)
    ));

    const appendedIds = [];
    for (const joint of appendable) {
      const parent = this.bonesById.get(joint.parentId);
      if (!parent) {
        throw new Error(`运行时蒙皮扩展骨 ${joint.id} 缺少可变形父骨 ${joint.parentId}。`);
      }
      const bone = new this.THREE.Bone();
      bone.name = joint.id;
      bone.userData.jointId = joint.id;
      bone.userData.runtimeExtendedDeform = true;
      bone.userData.deformRole = joint.role ?? 'deform';
      parent.updateMatrixWorld(true);
      const desiredWorldPoint = definitionRestPoints.get(joint.id);
      const parentWorldPoint = parent.getWorldPosition(new this.THREE.Vector3());
      const parentWorldRotation = parent.getWorldQuaternion(new this.THREE.Quaternion()).invert();
      if (desiredWorldPoint) {
        bone.position.set(
          desiredWorldPoint.x - parentWorldPoint.x,
          desiredWorldPoint.y - parentWorldPoint.y,
          desiredWorldPoint.z - parentWorldPoint.z,
        ).applyQuaternion(parentWorldRotation);
      } else {
        bone.position.fromArray(joint.localPosition ?? [0, 0, 0]);
      }
      bone.quaternion.set(0, 0, 0, 1);
      bone.scale.set(1, 1, 1);
      parent.add(bone);
      bone.updateMatrixWorld(true);

      const jointIndex = this.jointIds.length;
      this.jointIds.push(joint.id);
      appendedIds.push(joint.id);
      this.bonesById.set(joint.id, bone);
      this.boneIndexById.set(joint.id, jointIndex);
      this.parentIdById.set(joint.id, joint.parentId);
      this.runtimeDeformMetaById.set(joint.id, {
        category: joint.category ?? 'body',
        role: joint.role ?? 'deform',
        visualShape: joint.visualShape ?? 'joint',
        side: joint.side ?? 'center',
      });
    }

    this.orderedJointIds = orderJointIds(this.jointIds, this.parentIdById);
    this.rebuildPrimaryChildMap();
    const appendedJoints = appendable.filter((joint) => appendedIds.includes(joint.id));
    this.runtimeSkeletonStats = {
      profile: 'smpl24-append-only-deform67@1',
      assetJointCount: this.assetJointCount,
      runtimeJointCount: this.jointIds.length,
      appendedJointCount: appendedIds.length,
      twistJointCount: appendedJoints.filter((joint) => joint.visualShape === 'twist').length,
      correctiveJointCount: appendedJoints.filter((joint) => joint.role === 'corrective').length,
      fingerJointCount: appendedJoints.filter((joint) => joint.category === 'hand').length,
      faceJointCount: appendedJoints.filter((joint) => joint.category === 'face').length,
      appendedJointIds: [...appendedIds],
      compatibility: 'original SMPL 24 order and inverse bind matrices preserved',
    };
    if (this.jointIds.length > 255) {
      throw new Error(`运行时蒙皮骨数量 ${this.jointIds.length} 超出 Uint8/Uint16 兼容预算。`);
    }
  }

  rebuildPrimaryChildMap() {
    this.primaryChildById.clear();
    for (const id of this.jointIds) {
      const parentId = this.parentIdById.get(id);
      if (parentId && !this.primaryChildById.has(parentId)) {
        this.primaryChildById.set(parentId, id);
      }
    }
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

  refresh(definition, _interaction = null, { force = false, simulationRigFrame = undefined } = {}) {
    this.lastDefinition = definition;
    if (!this.ownsPrimarySurfaceSlot()) {
      if (this.group?.parent === this.scene) this.scene.remove(this.group);
      this.auditSceneSurfaces({ purge: true, phase: 'stale-owner-refresh' });
      return;
    }
    this.auditSceneSurfaces({ purge: true, phase: 'refresh-start' });
    if (!this.mesh || !this.weightsReady || !this.skeleton) return;

    if (simulationRigFrame !== undefined) {
      this.lastSimulationRigFrame = isSimulationRigFrameV4(simulationRigFrame)
        ? structuredClone(simulationRigFrame)
        : null;
    }
    const directSimulationRigFrame = this.lastSimulationRigFrame;
    const directFrameId = directSimulationRigFrame
      ? String(directSimulationRigFrame.frameId || directSimulationRigFrame.finalPose?.timestamp || '')
      : '';
    const compatibilityMismatch = Boolean(definition.profilePreview?.requiresSkinRebind);
    let poseChanged = force
      || this.lastCompatibilityMismatch !== compatibilityMismatch
      || this.lastSimulationRigFrameId !== directFrameId;
    const sourceRest = computeRestWorldPositions(definition);
    let pose = null;
    let sourceLocalPositions = this.bindLocalPositions;
    if (!directSimulationRigFrame) {
      pose = computePoseWorldPositions(definition);
      sourceLocalPositions = buildSourceLocalPositions(
        this.THREE,
        sourceRest,
        this.parentIdById,
        this.jointIds,
        this.bindLocalPositions,
      );
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
    }
    if (!poseChanged) return;

    let restPose = pose ? isRestPose(sourceRest, pose, this.jointIds, REST_EPSILON) : false;
    let directPoseApplied = false;
    if (directSimulationRigFrame) {
      if (compatibilityMismatch) {
        this.resetBonesToBind();
        this.applyProductionPoseCorrectives({});
        this.productionPoseResult = {
          applied: false,
          reason: 'Rig definition requires a skin rebind after proportion change.',
        };
        this.poseAuthority = 'simulation-rig-v4-blocked-proportion-mismatch';
      } else {
        const result = this.applySimulationRigPose(directSimulationRigFrame);
        directPoseApplied = result?.applied === true;
        this.productionPoseResult = result || null;
        if (directPoseApplied) {
          this.applyProductionPoseCorrectives(result.correctiveActivations);
          this.poseAuthority = 'simulation-rig-final-pose-v4';
        } else {
          this.resetBonesToBind();
          this.applyProductionPoseCorrectives({});
          this.poseAuthority = 'simulation-rig-v4-blocked-incompatible-skin';
        }
      }
    } else {
      if (restPose) this.resetBonesToBind(sourceLocalPositions);
      else this.applyPoseDeltas(sourceRest, pose, sourceLocalPositions);
      this.applyPoseCorrectives(sourceRest, pose, restPose);
      this.poseAuthority = 'legacy-world-position-fallback';
    }

    this.mesh.updateMatrixWorld(true);
    this.skeleton.update();
    this.cacheSkinMatrices();
    skinMatricesToDualQuaternions(this.skinMatrices, this.dualQuaternions);
    this.mesh.userData.bindPoseProtected = restPose;
    this.mesh.userData.referenceBindingMismatch = compatibilityMismatch;
    this.mesh.userData.poseAuthority = this.poseAuthority;
    this.mesh.userData.simulationRigFrameId = directPoseApplied ? directFrameId : null;
    this.lastCompatibilityMismatch = compatibilityMismatch;
    this.lastSimulationRigFrameId = directFrameId;
    this.auditSceneSurfaces({ purge: true, phase: 'refresh-complete' });
  }

  resetBonesToBind(sourceLocalPositions = this.bindLocalPositions) {
    for (const id of this.jointIds) {
      const bone = this.bonesById.get(id);
      const runtimePosition = this.boneIndexById.get(id) < this.assetJointCount
        ? sourceLocalPositions.get(id)
        : this.bindLocalPositions.get(id);
      bone.position.copy(runtimePosition ?? this.bindLocalPositions.get(id));
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
      const runtimePosition = this.boneIndexById.get(id) < this.assetJointCount
        ? sourceLocalPositions.get(id)
        : this.bindLocalPositions.get(id);
      bone.position.copy(runtimePosition ?? this.bindLocalPositions.get(id));
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

  /** V4 formal path: finalPose local quaternions are the only rotation input. */
  applySimulationRigPose(frame) {
    const result = this.productionSkinRuntime.updatePose(frame);
    if (!result.applied) return result;
    for (const id of this.orderedJointIds) {
      const deltaArray = result.localRotations[id];
      if (!isQuaternionArray(deltaArray)) continue;
      const bone = this.bonesById.get(id);
      const bindQuaternion = this.bindLocalQuaternions.get(id);
      bone.position.copy(this.bindLocalPositions.get(id));
      bone.quaternion.copy(bindQuaternion).multiply(
        this.temp.qA.fromArray(deltaArray),
      ).normalize();
      bone.scale.copy(this.bindLocalScales.get(id));
    }
    const rootId = result.rootJointId;
    const rootBone = this.bonesById.get(rootId);
    if (rootBone && isVector3Array(result.rootDelta)) {
      rootBone.position.copy(this.bindLocalPositions.get(rootId)).add(
        this.temp.a.fromArray(result.rootDelta),
      );
    }
    return result;
  }

  /** @deprecated Legacy compatibility only. V4 runtime frames must not call this. */
  calculateJointDeltaRotation(id, restPoints, posePoints) {
    const THREE = this.THREE;
    const runtimeMeta = this.runtimeDeformMetaById.get(id);
    if (runtimeMeta?.visualShape === 'twist') {
      const sourceId = this.parentIdById.get(id);
      return sourceId
        ? this.calculateJointDeltaRotation(sourceId, restPoints, posePoints)
        : new THREE.Quaternion();
    }
    if (runtimeMeta?.role === 'corrective') {
      const upperArmId = runtimeMeta.side === 'right' ? 'rightUpperArm' : 'leftUpperArm';
      const torsoDelta = this.calculateJointDeltaRotation('upperChest', restPoints, posePoints);
      const armDelta = this.calculateJointDeltaRotation(upperArmId, restPoints, posePoints);
      return blendQuaternionsNormalized(THREE, torsoDelta, armDelta, 0.15);
    }
    if (runtimeMeta?.category === 'hand') {
      return this.calculateFingerDeltaRotation(id, runtimeMeta.side, restPoints, posePoints);
    }
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
    const childId = PRIMARY_CHILD[id] ?? this.primaryChildById.get(id);
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

    const parentId = PARENT_FALLBACK[id] ?? this.parentIdById.get(id);
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

  calculateFingerDeltaRotation(id, side, restPoints, posePoints) {
    const THREE = this.THREE;
    const handId = side === 'right' ? 'rightHand' : 'leftHand';
    const handDelta = this.calculateJointDeltaRotation(handId, restPoints, posePoints).normalize();
    const restPoint = restPoints.get(id);
    const currentPoint = posePoints.get(id);
    if (!restPoint || !currentPoint) return handDelta;

    const childId = this.primaryChildById.get(id);
    const parentId = this.parentIdById.get(id);
    const restReference = childId ? restPoints.get(childId) : restPoints.get(parentId);
    const currentReference = childId ? posePoints.get(childId) : posePoints.get(parentId);
    if (!restReference || !currentReference) return handDelta;

    const restDirection = childId
      ? new THREE.Vector3(
        restReference.x - restPoint.x,
        restReference.y - restPoint.y,
        restReference.z - restPoint.z,
      )
      : new THREE.Vector3(
        restPoint.x - restReference.x,
        restPoint.y - restReference.y,
        restPoint.z - restReference.z,
      );
    const currentDirection = childId
      ? new THREE.Vector3(
        currentReference.x - currentPoint.x,
        currentReference.y - currentPoint.y,
        currentReference.z - currentPoint.z,
      )
      : new THREE.Vector3(
        currentPoint.x - currentReference.x,
        currentPoint.y - currentReference.y,
        currentPoint.z - currentReference.z,
      );
    if (restDirection.lengthSq() <= EPSILON || currentDirection.lengthSq() <= EPSILON) return handDelta;

    const inverseHandDelta = handDelta.clone().invert();
    currentDirection.applyQuaternion(inverseHandDelta).normalize();
    const relativeSwing = new THREE.Quaternion().setFromUnitVectors(
      restDirection.normalize(),
      currentDirection,
    );
    return handDelta.multiply(relativeSwing).normalize();
  }

  cacheSkinMatrices() {
    for (let index = 0; index < this.jointIds.length; index += 1) {
      const bone = this.bonesById.get(this.jointIds[index]);
      this.temp.matrix.multiplyMatrices(bone.matrixWorld, this.skeleton.boneInverses[index]);
      this.skinMatrices.set(this.temp.matrix.elements, index * 16);
    }
  }

  applyPoseCorrectives(sourceRest, posePoints, restPose = false) {
    const basePositions = this.shapedRestPositions ?? this.restPositions;
    const outputPositions = this.poseCorrectedRestPositions ?? new Float32Array(basePositions.length);
    this.poseCorrectedRestPositions = outputPositions;
    const activations = new Map();
    for (const spec of POSE_CORRECTIVE_SPECS) {
      if (restPose) {
        activations.set(spec.id, 0);
        continue;
      }
      const parentDelta = this.calculateJointDeltaRotation(spec.parentId, sourceRest, posePoints);
      const driverDelta = this.calculateJointDeltaRotation(spec.driverId, sourceRest, posePoints);
      const angle = relativeQuaternionAngle(parentDelta, driverDelta);
      activations.set(
        spec.id,
        smoothstep01((angle - spec.startAngle) / Math.max(EPSILON, spec.fullAngle - spec.startAngle)),
      );
    }
    this.poseCorrectiveStats = applyPoseCorrectiveFields(
      basePositions,
      outputPositions,
      this.poseCorrectiveFields,
      activations,
    );
    const position = this.mesh?.geometry?.attributes?.position;
    if (position?.array) {
      position.array.set(outputPositions);
      position.needsUpdate = true;
    }
    if (this.mesh) {
      this.mesh.userData.poseCorrectiveProfile = POSE_CORRECTIVE_PROFILE;
      this.mesh.userData.poseCorrectiveStats = structuredClone(this.poseCorrectiveStats);
    }
    return this.poseCorrectiveStats;
  }

  applyProductionPoseCorrectives(activationInput = {}) {
    const basePositions = this.shapedRestPositions ?? this.restPositions;
    const outputPositions = this.poseCorrectedRestPositions ?? new Float32Array(basePositions.length);
    this.poseCorrectedRestPositions = outputPositions;
    const activations = new Map(Object.entries(activationInput ?? {}));
    this.poseCorrectiveStats = {
      ...applyPoseCorrectiveFields(
        basePositions,
        outputPositions,
        this.poseCorrectiveFields,
        activations,
      ),
      authority: 'finalPose.localRotations',
      driverMode: 'bone-driven-local-quaternion',
      modifiesRig: false,
    };
    const position = this.mesh?.geometry?.attributes?.position;
    if (position?.array) {
      position.array.set(outputPositions);
      position.needsUpdate = true;
    }
    if (this.mesh) {
      this.mesh.userData.poseCorrectiveProfile = POSE_CORRECTIVE_PROFILE;
      this.mesh.userData.poseCorrectiveStats = structuredClone(this.poseCorrectiveStats);
    }
    return this.poseCorrectiveStats;
  }

  sampleDeformedPositions(options = {}) {
    const method = typeof options === 'string' ? options : options.method ?? 'final';
    const sourcePositions = this.poseCorrectedRestPositions
      ?? this.shapedRestPositions
      ?? this.restPositions;
    if (!this.skinMatrices) return new Float32Array(sourcePositions ?? 0);
    const output = new Float32Array(sourcePositions.length);
    if (method === 'dqs-reference') {
      const outputNormals = new Float32Array(sourcePositions.length);
      deformSurfaceDqs(
        sourcePositions,
        this.restNormals,
        output,
        outputNormals,
        this.skinIndices,
        this.skinWeights,
        this.dualQuaternions,
      );
      return output;
    }
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
    if (this.lastDefinition && this.weightsReady) {
      this.refresh(this.lastDefinition, null, { force: true });
    }
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
    if (this.assetRestPoints.size && this.poseCorrectiveFields.length) {
      this.poseCorrectiveFields = buildPoseCorrectiveFields(
        this.shapedRestPositions,
        this.assetRestPoints,
      );
    }
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
    const production = this.productionSkinRuntime.getDiagnostics();
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
      assetJointCount: this.assetJointCount,
      jointCount: this.jointIds.length,
      runtimeSkeletonProfile: this.runtimeSkeletonStats?.profile ?? null,
      runtimeSkeletonStats: this.runtimeSkeletonStats ? structuredClone(this.runtimeSkeletonStats) : null,
      vertexCount: position?.count ?? 0,
      triangleCount: geometry?.index ? Math.floor(geometry.index.count / 3) : 0,
      pickSource: 'detailed-smpl-skinned-mesh',
      pickable,
      skinVersion: production.skinVersion,
      bindingVersion: production.bindingVersion,
      rigVersion: production.rigVersion,
      deformRigStatus: production.deformRigStatus,
      correctiveStatus: production.correctiveStatus,
      skinQuality: production.skinQuality,
      productionReady: production.productionReady,
      assetClass: production.assetClass,
      weightSource: production.weightSource,
      inverseBindSource: production.inverseBindSource,
      runtimeWeightGeneration: this.legacyDiagnosticRuntimeWeights,
      proportionCompatible: production.proportionCompatible && !this.lastCompatibilityMismatch,
      lockedProportionRevision: production.lockedProportionRevision,
      productionSkinDiagnostics: production,
      deformation: `native Three.js SkinnedMesh GPU LBS + ${POSE_CORRECTIVE_PROFILE}`,
      deformationPipeline: structuredClone(SKIN_DEFORMATION_PIPELINE),
      renderDeformationMode: production.deformationMode,
      dqsReferenceMode: 'cpu-quality-reference',
      dqsReferenceAvailable: Boolean(this.dualQuaternions?.length),
      poseCorrectiveProfile: POSE_CORRECTIVE_PROFILE,
      poseCorrectiveFieldCount: this.poseCorrectiveFields.length,
      poseCorrectiveStats: structuredClone(this.poseCorrectiveStats),
      bodyShape: structuredClone(this.bodyShapeResponse),
      bodyShapeAppliedToSkinOnly: true,
      bindPoseProtected: Boolean(this.mesh?.userData?.bindPoseProtected),
      poseAuthority: this.poseAuthority,
      simulationRigFrameId: this.mesh?.userData?.simulationRigFrameId ?? null,
      legacyDirectionRotationFallback: !this.lastSimulationRigFrame,
      referenceBindingMismatch: Boolean(this.lastCompatibilityMismatch),
      assetWeightStatus: this.mesh?.userData?.assetWeightStatus ?? 'unknown',
      runtimeWeightProfile: this.mesh?.userData?.runtimeWeightProfile ?? null,
      runtimeWeightStats: this.runtimeWeightStats ? structuredClone(this.runtimeWeightStats) : null,
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
    new Uint16Array(sourceSkinIndex.array),
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

/**
 * Replaces the asset's transitional full-segment interpolation at runtime.
 *
 * A limb vertex should be driven primarily by the bone spanning that segment;
 * it should only blend to the next bone in a narrow band around the joint.
 * Blending linearly from one joint to the next across an entire upper arm or
 * thigh makes the surface behave like a soft hose. The source GLB is preserved
 * on disk, while the live BufferAttributes receive a deterministic, topology-
 * smoothed articulation profile suitable for editing and animation preview.
 */
function rebuildArticulationStableWeights(
  geometry,
  bindPoints,
  boneIndexById,
  { smoothingPasses = 4, smoothingAlpha = 0.18 } = {},
) {
  const position = geometry?.attributes?.position;
  const skinIndex = geometry?.attributes?.skinIndex;
  const skinWeight = geometry?.attributes?.skinWeight;
  if (!position?.array || !skinIndex?.array || !skinWeight?.array) {
    return { profile: 'asset-fallback', vertexCount: 0, smoothingPasses: 0 };
  }

  const chains = createWeightChains(bindPoints, boneIndexById);
  const jointCount = boneIndexById.size;
  const indices = skinIndex.array;
  const weights = skinWeight.array;
  const nextIndices = new Uint16Array(indices.length);
  const nextWeights = new Float32Array(weights.length);
  const influence = new Float64Array(jointCount);
  const touched = new Uint8Array(jointCount);
  const vertexCount = position.count;
  let fallbackVertexCount = 0;

  for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
    influence.fill(0);
    touched.fill(0);
    const offset = vertexIndex * 3;
    const x = position.array[offset];
    const y = position.array[offset + 1];
    const z = position.array[offset + 2];
    const candidates = selectWeightCandidates(x, y, z, chains);

    for (const candidate of candidates) {
      const result = evaluateChainNumeric(x, y, z, candidate.chain);
      result.score *= candidate.multiplier;
      addStableSegmentInfluences(influence, touched, result);
    }

    stabilizeArmWeights(influence, touched, x, y, bindPoints, boneIndexById);
    stabilizeHipWeights(influence, touched, x, y, boneIndexById);

    let fallbackIndex = indices[vertexIndex * 4] ?? 0;
    if (!hasTouched(touched)) {
      fallbackVertexCount += 1;
      fallbackIndex = boneIndexById.get(fallbackJointForVertex(x, y, z)) ?? fallbackIndex;
      influence[fallbackIndex] = 1;
      touched[fallbackIndex] = 1;
    }
    writeFourStrongestInfluences(
      influence,
      touched,
      nextIndices,
      nextWeights,
      vertexIndex,
      fallbackIndex,
    );
  }

  indices.set(nextIndices);
  weights.set(nextWeights);
  smoothSkinWeights(geometry, indices, weights, jointCount, {
    passes: smoothingPasses,
    alpha: smoothingAlpha,
  });
  const anatomicalGuardStats = enforceAnatomicalWeightGuards(
    geometry,
    boneIndexById,
    chains,
    indices,
    weights,
  );
  const extendedDeformStats = applyExtendedDeformWeights(
    geometry,
    bindPoints,
    boneIndexById,
    indices,
    weights,
  );
  skinIndex.needsUpdate = true;
  skinWeight.needsUpdate = true;

  return summarizeRuntimeWeights(
    indices,
    weights,
    [...boneIndexById.entries()].sort((left, right) => left[1] - right[1]).map(([id]) => id),
    {
      profile: RUNTIME_WEIGHT_PROFILE,
      vertexCount,
      fallbackVertexCount,
      smoothingPasses,
      smoothingAlpha,
      ...anatomicalGuardStats,
      ...extendedDeformStats,
    },
  );
}

function addStableSegmentInfluences(target, touched, result) {
  const { chain, segmentIndex, t, score } = result;
  const currentIndex = chain.indices[segmentIndex];
  const nextIndex = chain.indices[segmentIndex + 1];
  const previousIndex = chain.indices[segmentIndex - 1];

  // This 24-joint preview asset has one palm joint plus a hand-end marker, not
  // independently skinned finger joints. Treat the terminal hand volume as a
  // rigid palm until a real finger-weight asset is supplied; blending it to a
  // marker twists neighbouring finger vertices in opposite directions.
  if (chain.name.endsWith('Arm') && segmentIndex === chain.indices.length - 2) {
    addWeightNumeric(target, touched, currentIndex, score);
    return;
  }

  // Keep the middle of a bone segment rigid. Only the last quarter transitions
  // to the next bone; a smaller proximal band blends back to the parent.
  const distalBlend = smoothstep(0.72, 0.96, t);
  const proximalBlend = Number.isInteger(previousIndex)
    ? (1 - smoothstep(0.02, 0.20, t)) * 0.32
    : 0;
  const currentWeight = Math.max(0, 1 - distalBlend) * (1 - proximalBlend);

  addWeightNumeric(target, touched, currentIndex, score * currentWeight);
  addWeightNumeric(target, touched, nextIndex, score * distalBlend);
  addWeightNumeric(target, touched, previousIndex, score * proximalBlend);
}

/**
 * The GLB's 24-joint shoulder has a very short clavicle segment. Selecting the
 * closest segment in 3D makes neighbouring front/back vertices jump between
 * clavicle and upper-arm transforms. Use a lateral deltoid blend instead so a
 * topology edge cannot straddle two unrelated rotations. The clavicle remains
 * available to the rig, but the visible shoulder volume transitions directly
 * from upper chest to upper arm.
 */
function stabilizeArmWeights(target, touched, x, y, bindPoints, boneIndexById) {
  const absX = Math.abs(x);
  const side = x < 0 ? 'left' : 'right';
  const elbowPoint = bindPoints.get(`${side}LowerArm`);
  const wristPoint = bindPoints.get(`${side}Hand`);
  if (!elbowPoint || !wristPoint || y < 0.68 || y > 1.53) return;
  const armBoundary = armBoundaryAtHeight(y);
  let armGate = smoothstep(armBoundary - 0.08, armBoundary + 0.08, absX);
  if (y < 0.82) armGate *= smoothstep(0.28, 0.36, absX);
  if (armGate <= 1e-6) return;

  const upperChestIndex = boneIndexById.get('upperChest');
  const upperArmIndex = boneIndexById.get(`${side}UpperArm`);
  const lowerArmIndex = boneIndexById.get(`${side}LowerArm`);
  const handIndex = boneIndexById.get(`${side}Hand`);
  if (
    !Number.isInteger(upperChestIndex)
    || !Number.isInteger(upperArmIndex)
    || !Number.isInteger(lowerArmIndex)
    || !Number.isInteger(handIndex)
  ) return;

  const elbowX = Math.abs(elbowPoint.x);
  const wristX = Math.abs(wristPoint.x);
  const shoulderBlend = smoothstep(0.135, 0.265, absX);
  const elbowBlend = smoothstep(elbowX - 0.10, elbowX + 0.045, absX);
  let wristBlend = smoothstep(wristX - 0.075, wristX + 0.02, absX);
  if (y < wristPoint.y - 0.035) {
    wristBlend = Math.max(wristBlend, smoothstep(wristX - 0.115, wristX - 0.02, absX));
  }

  let sourceTotal = 0;
  for (let index = 0; index < target.length; index += 1) sourceTotal += target[index];
  if (sourceTotal <= EPSILON) sourceTotal = 1;
  const sourceScale = 1 - armGate;
  for (let index = 0; index < target.length; index += 1) target[index] *= sourceScale;

  addWeightNumeric(target, touched, upperChestIndex, sourceTotal * armGate * (1 - shoulderBlend));
  addWeightNumeric(
    target,
    touched,
    upperArmIndex,
    sourceTotal * armGate * shoulderBlend * (1 - elbowBlend),
  );
  addWeightNumeric(
    target,
    touched,
    lowerArmIndex,
    sourceTotal * armGate * elbowBlend * (1 - wristBlend),
  );
  addWeightNumeric(target, touched, handIndex, sourceTotal * armGate * elbowBlend * wristBlend);
}

/**
 * Topology smoothing is useful at joints, but it also diffuses weights back
 * into the middle of long limb segments. That diffusion is what makes a bent
 * arm or leg look like a soft hose. Re-apply continuous anatomical fields
 * after smoothing, then pull segment interiors toward their spanning bone.
 * The transition bands remain blended; only the volume-preserving cores are
 * made deliberately rigid.
 */
function enforceAnatomicalWeightGuards(
  geometry,
  boneIndexById,
  chains,
  skinIndices,
  skinWeights,
) {
  const position = geometry?.attributes?.position;
  const jointCount = boneIndexById.size;
  if (!position?.array || !jointCount) {
    return { guardedVertexCount: 0, rigidCoreVertexCount: 0 };
  }

  const influence = new Float64Array(jointCount);
  const touched = new Uint8Array(jointCount);
  let guardedVertexCount = 0;
  let rigidCoreVertexCount = 0;
  let ankleGuardVertexCount = 0;

  for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 1) {
    influence.fill(0);
    touched.fill(0);
    const sparseOffset = vertexIndex * 4;
    for (let slot = 0; slot < 4; slot += 1) {
      const weight = skinWeights[sparseOffset + slot];
      if (weight <= 0) continue;
      const jointIndex = skinIndices[sparseOffset + slot];
      influence[jointIndex] += weight;
      touched[jointIndex] = 1;
    }

    const positionOffset = vertexIndex * 3;
    const x = position.array[positionOffset];
    const y = position.array[positionOffset + 1];
    const z = position.array[positionOffset + 2];
    const rigidCoreApplied = reinforceRigidSegmentCore(
      influence,
      touched,
      x,
      y,
      z,
      chains,
    );
    const ankleGuardApplied = projectAnkleWeightField(
      influence,
      touched,
      x,
      y,
      boneIndexById,
    );
    if (rigidCoreApplied) rigidCoreVertexCount += 1;
    if (ankleGuardApplied) ankleGuardVertexCount += 1;
    if (rigidCoreApplied || ankleGuardApplied) {
      guardedVertexCount += 1;
    }
    writeFourStrongestInfluences(
      influence,
      touched,
      skinIndices,
      skinWeights,
      vertexIndex,
      skinIndices[sparseOffset] ?? 0,
    );
  }

  return { guardedVertexCount, rigidCoreVertexCount, ankleGuardVertexCount };
}

function projectAnkleWeightField(target, touched, x, y, boneIndexById) {
  const gate = smoothstep(0.09, 0.14, y) * (1 - smoothstep(0.24, 0.30, y));
  if (gate <= 1e-5 || Math.abs(x) > 0.22) return false;

  const side = x < 0 ? 'left' : 'right';
  const lowerLegIndex = boneIndexById.get(`${side}LowerLeg`);
  const footIndex = boneIndexById.get(`${side}Foot`);
  if (!Number.isInteger(lowerLegIndex) || !Number.isInteger(footIndex)) return false;

  const lowerLegWeight = smoothstep(0.105, 0.245, y);
  blendInfluenceTowardPair(
    target,
    touched,
    footIndex,
    lowerLegIndex,
    lowerLegWeight,
    gate * 0.93,
  );
  return true;
}

function reinforceRigidSegmentCore(target, touched, x, y, z, chains) {
  let best = null;
  for (const candidate of selectWeightCandidates(x, y, z, chains)) {
    const result = evaluateChainNumeric(x, y, z, candidate.chain);
    result.score *= candidate.multiplier;
    if (!best || result.score > best.score) best = result;
  }
  if (!best || best.normalizedDistance > 1.75) return false;

  const { chain, segmentIndex, t, normalizedDistance } = best;
  if (chain.name === 'torso') return false;
  if (chain.name.endsWith('Arm') && segmentIndex === 0) return false;

  const distanceGate = 1 - smoothstep(1.05, 1.75, normalizedDistance);
  let coreGate = smoothstep(0.14, 0.30, t) * (1 - smoothstep(0.66, 0.84, t));
  let strength = coreGate * distanceGate * 0.90;

  // The terminal arm segment represents the complete palm and fingers in the
  // transitional 24-joint asset. Keep it on the hand joint so the hand-end
  // marker cannot pull individual finger vertices in different directions.
  if (chain.name.endsWith('Arm') && segmentIndex === chain.indices.length - 2) {
    strength = distanceGate * 0.985;
  }

  // The foot-to-toe segment needs a small distal blend for toe-off, but the
  // heel and mid-foot must remain rigid under step and squat poses.
  if (chain.name.endsWith('Leg') && segmentIndex === chain.indices.length - 2) {
    coreGate = 1 - smoothstep(0.62, 0.86, t);
    strength = coreGate * distanceGate * 0.94;
  }

  if (chain.name.endsWith('Arm')) {
    strength *= 1 - smoothstep(1.08, 1.28, y);
  }
  if (chain.name.endsWith('Leg') && segmentIndex === 0) {
    strength *= 1 - smoothstep(0.54, 0.76, y);
  }

  if (strength <= 1e-5) return false;
  blendInfluenceTowardJoint(target, touched, chain.indices[segmentIndex], strength);
  return true;
}

function blendInfluenceTowardJoint(target, touched, jointIndex, strength) {
  if (!Number.isInteger(jointIndex)) return;
  const clampedStrength = clamp(strength, 0, 0.995);
  const retain = 1 - clampedStrength;
  for (let index = 0; index < target.length; index += 1) target[index] *= retain;
  target[jointIndex] += clampedStrength;
  touched[jointIndex] = 1;
}

function blendInfluenceTowardPair(target, touched, firstIndex, secondIndex, secondWeight, strength) {
  const clampedStrength = clamp(strength, 0, 0.995);
  const retain = 1 - clampedStrength;
  const clampedSecondWeight = clamp(secondWeight, 0, 1);
  for (let index = 0; index < target.length; index += 1) target[index] *= retain;
  target[firstIndex] += clampedStrength * (1 - clampedSecondWeight);
  target[secondIndex] += clampedStrength * clampedSecondWeight;
  touched[firstIndex] = 1;
  touched[secondIndex] = 1;
}

function stabilizeHipWeights(target, touched, x, y, boneIndexById) {
  const absX = Math.abs(x);
  if (y > 0.95 && absX > 0.20) return;
  const pelvisGate = smoothstep(0.50, 0.60, y)
    * (1 - smoothstep(1.16, 1.24, y))
    * (1 - smoothstep(0.24, 0.30, absX));
  if (pelvisGate <= 1e-6) return;

  const side = x < 0 ? 'left' : 'right';
  const hipsIndex = boneIndexById.get('hips');
  const upperLegIndex = boneIndexById.get(`${side}UpperLeg`);
  if (!Number.isInteger(hipsIndex) || !Number.isInteger(upperLegIndex)) return;

  // Use one smooth radial field around the crotch instead of independent X/Y
  // thresholds. Adjacent vertices then cannot jump from pelvis to thigh when
  // both coordinates change across a diagonal triangle edge.
  const downward = Math.max(0, (0.86 - y) / 0.24);
  const lateralScale = 0.11 + smoothstep(0.86, 1.04, y) * 0.08;
  const lateral = absX / lateralScale;
  const centerWidth = smoothstep(0.68, 0.82, y) * 0.04;
  const centerLegFade = centerWidth > EPSILON ? smoothstep(0.002, centerWidth, absX) : 1;
  const upperLegBlend = smoothstep(0.05, 1.30, Math.hypot(downward, lateral))
    * (1 - smoothstep(1.02, 1.20, y))
    * centerLegFade;

  let sourceTotal = 0;
  for (let index = 0; index < target.length; index += 1) sourceTotal += target[index];
  if (sourceTotal <= EPSILON) sourceTotal = 1;
  const sourceScale = 1 - pelvisGate;
  for (let index = 0; index < target.length; index += 1) target[index] *= sourceScale;
  addWeightNumeric(target, touched, hipsIndex, sourceTotal * pelvisGate * (1 - upperLegBlend));
  addWeightNumeric(target, touched, upperLegIndex, sourceTotal * pelvisGate * upperLegBlend);
}

/**
 * Expands the live 24-joint preview weights onto append-only runtime deform
 * bones. The source GLB and its original inverse bind matrices remain intact.
 * Face joints enter the palette for protocol stability, but intentionally keep
 * zero generated influence until a landmark-authored face skin is available.
 */
function applyExtendedDeformWeights(
  geometry,
  bindPoints,
  boneIndexById,
  skinIndices,
  skinWeights,
) {
  const position = geometry?.attributes?.position;
  const jointCount = boneIndexById.size;
  if (!position?.array || jointCount <= SMPL_JOINT_IDS.length) {
    return {
      extendedWeightingApplied: false,
      twistWeightedVertexCount: 0,
      scapulaWeightedVertexCount: 0,
      fingerWeightedVertexCount: 0,
      generatedFaceWeightVertexCount: 0,
    };
  }

  const twistFields = createTwistWeightFields(bindPoints, boneIndexById);
  const scapulaFields = createScapulaWeightFields(bindPoints, boneIndexById);
  const fingerFields = createFingerWeightFields(bindPoints, boneIndexById);
  const influence = new Float64Array(jointCount);
  const touched = new Uint8Array(jointCount);
  let twistWeightedVertexCount = 0;
  let scapulaWeightedVertexCount = 0;
  let fingerWeightedVertexCount = 0;

  for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 1) {
    influence.fill(0);
    touched.fill(0);
    const sparseOffset = vertexIndex * 4;
    for (let slot = 0; slot < 4; slot += 1) {
      const weight = skinWeights[sparseOffset + slot];
      if (weight <= 0) continue;
      const jointIndex = skinIndices[sparseOffset + slot];
      influence[jointIndex] += weight;
      touched[jointIndex] = 1;
    }

    const positionOffset = vertexIndex * 3;
    const x = position.array[positionOffset];
    const y = position.array[positionOffset + 1];
    const z = position.array[positionOffset + 2];
    if (applyTwistWeightFields(influence, touched, x, y, z, twistFields)) {
      twistWeightedVertexCount += 1;
    }
    if (applyScapulaWeightFields(influence, touched, x, y, z, scapulaFields)) {
      scapulaWeightedVertexCount += 1;
    }
    if (applyFingerWeightFields(influence, touched, x, y, z, fingerFields)) {
      fingerWeightedVertexCount += 1;
    }

    writeFourStrongestInfluences(
      influence,
      touched,
      skinIndices,
      skinWeights,
      vertexIndex,
      skinIndices[sparseOffset] ?? 0,
    );
  }

  const mirroredVertexCount = mirrorRuntimeWeightsLeftToRight(
    position,
    skinIndices,
    skinWeights,
    boneIndexById,
  );
  const weightedJointIds = collectWeightedJointIds(skinIndices, skinWeights, boneIndexById);
  const weightedTwistJointCount = twistFields.filter((field) => weightedJointIds.has(field.id)).length;
  const weightedScapulaJointCount = scapulaFields.filter((field) => weightedJointIds.has(field.id)).length;
  const fingerJointIds = fingerFields.flatMap((field) => field.chains.flatMap((chain) => chain.ids));
  const weightedFingerJointIds = [...new Set(
    fingerJointIds.filter((id) => weightedJointIds.has(id)),
  )];
  const weightedFingerJointCount = weightedFingerJointIds.length;

  return {
    extendedWeightingApplied: true,
    twistWeightedVertexCount,
    scapulaWeightedVertexCount,
    fingerWeightedVertexCount,
    mirroredVertexCount,
    generatedFaceWeightVertexCount: 0,
    weightedTwistJointCount,
    weightedScapulaJointCount,
    weightedFingerJointCount,
    weightedFingerJointIds,
    weightedRuntimeJointCount: weightedJointIds.size,
    generatedWeightPolicy: 'twist + scapula corrective + fingers; face palette only',
  };
}

function mirrorRuntimeWeightsLeftToRight(position, skinIndices, skinWeights, boneIndexById) {
  const cellSize = 0.0035;
  const maximumPairDistanceSq = 0.0055 ** 2;
  const buckets = new Map();
  const keyFor = (x, y, z) => (
    `${Math.round(Math.abs(x) / cellSize)}:${Math.round(y / cellSize)}:${Math.round(z / cellSize)}`
  );
  for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 1) {
    const offset = vertexIndex * 3;
    const x = position.array[offset];
    if (x <= 0.002) continue;
    const key = keyFor(x, position.array[offset + 1], position.array[offset + 2]);
    const bucket = buckets.get(key) ?? [];
    bucket.push(vertexIndex);
    buckets.set(key, bucket);
  }

  const idByIndex = [...boneIndexById.entries()].reduce((result, [id, index]) => {
    result[index] = id;
    return result;
  }, []);
  const mirroredIndexByIndex = idByIndex.map((id, index) => {
    if (!id?.startsWith('left')) return index;
    return boneIndexById.get(`right${id.slice(4)}`) ?? index;
  });
  let mirroredVertexCount = 0;

  for (let leftVertex = 0; leftVertex < position.count; leftVertex += 1) {
    const positionOffset = leftVertex * 3;
    const x = position.array[positionOffset];
    const y = position.array[positionOffset + 1];
    if (x >= -0.35 || y < 0.72 || y > 1.00) continue;
    const absoluteXCell = Math.round(Math.abs(x) / cellSize);
    const yCell = Math.round(y / cellSize);
    const zCell = Math.round(position.array[positionOffset + 2] / cellSize);
    let bestVertex = -1;
    let bestDistanceSq = maximumPairDistanceSq;
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          const candidates = buckets.get(`${absoluteXCell + dx}:${yCell + dy}:${zCell + dz}`) ?? [];
          for (const rightVertex of candidates) {
            const rightOffset = rightVertex * 3;
            const distanceSq = (
              (Math.abs(x) - position.array[rightOffset]) ** 2
              + (y - position.array[rightOffset + 1]) ** 2
              + (position.array[positionOffset + 2] - position.array[rightOffset + 2]) ** 2
            );
            if (distanceSq < bestDistanceSq) {
              bestDistanceSq = distanceSq;
              bestVertex = rightVertex;
            }
          }
        }
      }
    }
    if (bestVertex < 0) continue;
    const sourceOffset = leftVertex * 4;
    const targetOffset = bestVertex * 4;
    for (let slot = 0; slot < 4; slot += 1) {
      skinIndices[targetOffset + slot] = mirroredIndexByIndex[skinIndices[sourceOffset + slot]];
      skinWeights[targetOffset + slot] = skinWeights[sourceOffset + slot];
    }
    mirroredVertexCount += 1;
  }
  return mirroredVertexCount;
}

function createTwistWeightFields(bindPoints, boneIndexById) {
  return TWIST_WEIGHT_SPECS.map((spec) => ({
    ...spec,
    start: pointArrayOrNull(bindPoints.get(spec.sourceId)),
    end: pointArrayOrNull(bindPoints.get(spec.endId)),
    sourceIndex: boneIndexById.get(spec.sourceId),
    twistIndex: boneIndexById.get(spec.id),
  })).filter((field) => (
    field.start
    && field.end
    && Number.isInteger(field.sourceIndex)
    && Number.isInteger(field.twistIndex)
  ));
}

function applyTwistWeightFields(target, touched, x, y, z, fields) {
  let applied = false;
  for (const field of fields) {
    const sourceWeight = target[field.sourceIndex];
    if (sourceWeight <= 0.04) continue;
    const projection = projectPointToSegmentNumeric(x, y, z, field.start, field.end, field.radius);
    if (projection.normalizedDistance >= 1.45) continue;
    const longitudinalGate = smoothstep(0.16, 0.40, projection.t)
      * (1 - smoothstep(0.88, 0.99, projection.t));
    const radialGate = 1 - smoothstep(0.72, 1.45, projection.normalizedDistance);
    const transfer = sourceWeight * longitudinalGate * radialGate * 0.44;
    if (transfer <= 0.002) continue;
    target[field.sourceIndex] -= transfer;
    target[field.twistIndex] += transfer;
    touched[field.twistIndex] = 1;
    applied = true;
  }
  return applied;
}

function createScapulaWeightFields(bindPoints, boneIndexById) {
  return ['left', 'right'].map((side) => {
    const id = `${side}ScapulaCorrective`;
    return {
      id,
      side,
      point: pointArrayOrNull(bindPoints.get(id)),
      targetIndex: boneIndexById.get(id),
      sourceIndices: ['upperChest', `${side}Shoulder`, `${side}UpperArm`]
        .map((sourceId) => boneIndexById.get(sourceId))
        .filter(Number.isInteger),
    };
  }).filter((field) => field.point && Number.isInteger(field.targetIndex) && field.sourceIndices.length);
}

function applyScapulaWeightFields(target, touched, x, y, z, fields) {
  const side = x < 0 ? 'left' : 'right';
  const field = fields.find((candidate) => candidate.side === side);
  if (!field) return false;
  const distance = Math.hypot(x - field.point[0], y - field.point[1], z - field.point[2]);
  const radialGate = 1 - smoothstep(0.105, 0.225, distance);
  const heightGate = smoothstep(field.point[1] - 0.13, field.point[1] - 0.04, y)
    * (1 - smoothstep(field.point[1] + 0.035, field.point[1] + 0.095, y));
  const gate = radialGate * heightGate;
  if (gate <= 0.015) return false;

  let sourceWeight = 0;
  for (const sourceIndex of field.sourceIndices) sourceWeight += target[sourceIndex];
  const transfer = sourceWeight * gate * 0.050;
  if (transfer <= 0.002 || sourceWeight <= EPSILON) return false;
  const retain = 1 - transfer / sourceWeight;
  for (const sourceIndex of field.sourceIndices) target[sourceIndex] *= retain;
  target[field.targetIndex] += transfer;
  touched[field.targetIndex] = 1;
  return true;
}

function createFingerWeightFields(bindPoints, boneIndexById) {
  return ['left', 'right'].map((side) => ({
    side,
    handIndex: boneIndexById.get(`${side}Hand`),
    handEndIndex: boneIndexById.get(`${side}HandEnd`),
    chains: FINGER_WEIGHT_CHAINS.map((suffixes) => {
      const ids = suffixes.map((suffix) => `${side}${suffix}`);
      const points = ids.map((id) => pointArrayOrNull(bindPoints.get(id)));
      const indices = ids.map((id) => boneIndexById.get(id));
      if (!points.every(Boolean) || !indices.every(Number.isInteger)) return null;
      const last = points[2];
      const before = points[1];
      // The procedural performance rig stops at the distal joint centre while
      // the real mesh continues to the fingertip. Extend the terminal ray far
      // enough to cover that surface volume without adding a fake endpoint
      // bone to the public rig contract.
      const terminalScale = 2.60;
      const terminal = [
        last[0] + (last[0] - before[0]) * terminalScale,
        last[1] + (last[1] - before[1]) * terminalScale,
        last[2] + (last[2] - before[2]) * terminalScale,
      ];
      return {
        name: `${side}${suffixes[0]}`,
        finger: suffixes[0].replace(/(Metacarpal|Proximal)$/, '').toLowerCase(),
        ids,
        indices: [...indices, indices[2]],
        points: [...points, terminal],
        radii: [0.022, 0.021, 0.019],
      };
    }).filter(Boolean),
  })).filter((field) => Number.isInteger(field.handIndex) && field.chains.length === 5);
}

function applyFingerWeightFields(target, touched, x, y, z, fields) {
  const side = x < 0 ? 'left' : 'right';
  const field = fields.find((candidate) => candidate.side === side);
  if (!field) return false;
  const handWeight = target[field.handIndex] ?? 0;
  const handEndWeight = Number.isInteger(field.handEndIndex) ? target[field.handEndIndex] ?? 0 : 0;
  const sourceWeight = handWeight + handEndWeight;
  if (sourceWeight < 0.24) return false;

  const candidates = [];
  for (const chain of field.chains) {
    const result = evaluateChainNumeric(x, y, z, chain);
    const distalGate = smoothstep(0.014, 0.060, chain.points[0][1] - y);
    result.selectionDistance = result.normalizedDistance;
    if (chain.finger === 'index') result.selectionDistance *= 1 - distalGate * 0.24;
    if (chain.finger === 'thumb') result.selectionDistance *= 1 + distalGate * 0.34;
    if (result.normalizedDistance < 1.45) candidates.push(result);
  }
  candidates.sort((left, right) => left.selectionDistance - right.selectionDistance);
  const best = candidates[0];
  if (!best || best.normalizedDistance >= 1.45) return false;
  const radialGate = 1 - smoothstep(0.52, 1.45, best.normalizedDistance);
  const palmRootGate = best.segmentIndex === 0
    ? smoothstep(0.16, 0.58, best.t)
    : 1;
  const transfer = sourceWeight * radialGate * palmRootGate * 0.70;
  if (transfer <= 0.003) return false;

  const retain = 1 - transfer / sourceWeight;
  target[field.handIndex] *= retain;
  if (Number.isInteger(field.handEndIndex)) target[field.handEndIndex] *= retain;
  const currentIndex = best.chain.indices[best.segmentIndex];
  const nextIndex = best.chain.indices[best.segmentIndex + 1];
  // Joint centres sit inside the finger volume, so the surface reaches the
  // next phalanx before a centre-line projection reaches t=1. Move the blend
  // band inward to ensure distal surface rings follow the distal bone.
  const nextWeight = best.segmentIndex >= best.chain.indices.length - 2
    ? 0
    : smoothstep(0.10, 0.62, best.t);
  addWeightNumeric(target, touched, currentIndex, transfer * (1 - nextWeight));
  addWeightNumeric(target, touched, nextIndex, transfer * nextWeight);
  return true;
}

function projectPointToSegmentNumeric(x, y, z, start, end, radius) {
  const abx = end[0] - start[0];
  const aby = end[1] - start[1];
  const abz = end[2] - start[2];
  const apx = x - start[0];
  const apy = y - start[1];
  const apz = z - start[2];
  const lengthSq = abx * abx + aby * aby + abz * abz;
  const t = lengthSq > EPSILON
    ? clamp((apx * abx + apy * aby + apz * abz) / lengthSq, 0, 1)
    : 0;
  const dx = apx - abx * t;
  const dy = apy - aby * t;
  const dz = apz - abz * t;
  return {
    t,
    normalizedDistance: Math.hypot(dx, dy, dz) / Math.max(EPSILON, radius),
  };
}

function pointArrayOrNull(point) {
  return point ? [point.x, point.y, point.z] : null;
}

function collectWeightedJointIds(skinIndices, skinWeights, boneIndexById) {
  const idByIndex = [...boneIndexById.entries()].reduce((result, [id, index]) => {
    result[index] = id;
    return result;
  }, []);
  const result = new Set();
  for (let offset = 0; offset < skinWeights.length; offset += 1) {
    if (skinWeights[offset] <= 1e-4) continue;
    const id = idByIndex[skinIndices[offset]];
    if (id) result.add(id);
  }
  return result;
}

function summarizeRuntimeWeights(indices, weights, jointIds, base) {
  const dominantCounts = Object.fromEntries(jointIds.map((id) => [id, 0]));
  let dominantWeightSum = 0;
  let minimumWeightSum = Infinity;
  let maximumWeightSum = -Infinity;
  const vertexCount = weights.length / 4;
  for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
    const offset = vertexIndex * 4;
    let dominantSlot = 0;
    let sum = 0;
    for (let slot = 0; slot < 4; slot += 1) {
      const weight = weights[offset + slot];
      sum += weight;
      if (weight > weights[offset + dominantSlot]) dominantSlot = slot;
    }
    minimumWeightSum = Math.min(minimumWeightSum, sum);
    maximumWeightSum = Math.max(maximumWeightSum, sum);
    dominantWeightSum += weights[offset + dominantSlot];
    const id = jointIds[indices[offset + dominantSlot]];
    if (id) dominantCounts[id] += 1;
  }
  return {
    ...base,
    maximumInfluences: 4,
    meanDominantWeight: vertexCount ? dominantWeightSum / vertexCount : 0,
    minimumWeightSum: Number.isFinite(minimumWeightSum) ? minimumWeightSum : 0,
    maximumWeightSum: Number.isFinite(maximumWeightSum) ? maximumWeightSum : 0,
    dominantCounts,
  };
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

  // The A-pose hands overlap the pelvis vertically but are far outside the
  // torso corridor. Never let a tiny torso Gaussian survive normalization and
  // give a finger vertex a hips influence.
  if (absX > 0.32 && y >= 0.70 && y <= 0.98) {
    candidates.length = 0;
    pushCandidate(candidates, byName.get(`${side}Arm`), 1);
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
  return {
    chain,
    score,
    segmentIndex: bestSegment,
    t: bestT,
    normalizedDistance: bestNormalizedDistance,
  };
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

function createInactivePoseCorrectiveStats() {
  return {
    profile: POSE_CORRECTIVE_PROFILE,
    fieldCount: 0,
    activeRegionCount: 0,
    activeRegionIds: [],
    activeCategories: [],
    correctedVertexCount: 0,
    correctionSampleCount: 0,
    maximumActivation: 0,
    maximumInputDisplacement: 0,
    outwardCorrectionSampleCount: 0,
  };
}

/**
 * Creates sparse, bind-space volume fields around the major articulation
 * centres. The fields are renderer-agnostic: WebGPU and WebGL both consume the
 * corrected POSITION attribute before Three.js performs its native GPU LBS.
 */
function buildPoseCorrectiveFields(basePositions, bindPoints, specs = POSE_CORRECTIVE_SPECS) {
  if (!basePositions?.length || !bindPoints?.size) return [];
  const fields = [];
  const vertexCount = basePositions.length / 3;
  for (const spec of specs) {
    const joint = bindPoints.get(spec.jointId);
    const child = bindPoints.get(spec.childId);
    if (!joint || !child) continue;
    const axisX0 = child.x - joint.x;
    const axisY0 = child.y - joint.y;
    const axisZ0 = child.z - joint.z;
    const axisLength = Math.hypot(axisX0, axisY0, axisZ0);
    if (axisLength <= EPSILON) continue;
    const axisX = axisX0 / axisLength;
    const axisY = axisY0 / axisLength;
    const axisZ = axisZ0 / axisLength;
    const indices = [];
    const deltas = [];
    let maximumFieldDisplacement = 0;

    for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
      const offset = vertexIndex * 3;
      const dx = basePositions[offset] - joint.x;
      const dy = basePositions[offset + 1] - joint.y;
      const dz = basePositions[offset + 2] - joint.z;
      const longitudinal = dx * axisX + dy * axisY + dz * axisZ;
      if (longitudinal < -spec.parentSpan || longitudinal > spec.childSpan) continue;
      const radialX = dx - axisX * longitudinal;
      const radialY = dy - axisY * longitudinal;
      const radialZ = dz - axisZ * longitudinal;
      const radialDistance = Math.hypot(radialX, radialY, radialZ);
      if (radialDistance <= EPSILON || radialDistance >= spec.radius) continue;

      const axialRatio = longitudinal < 0
        ? Math.abs(longitudinal) / Math.max(EPSILON, spec.parentSpan)
        : longitudinal / Math.max(EPSILON, spec.childSpan);
      const axialEnvelope = 1 - smoothstep01(axialRatio);
      const radialEnvelope = smoothstep01(
        (spec.radius - radialDistance) / Math.max(EPSILON, spec.radius * 0.38),
      );
      const scale = spec.radialGain * axialEnvelope * radialEnvelope;
      if (scale <= 1e-5) continue;
      const correctionX = radialX * scale;
      const correctionY = radialY * scale;
      const correctionZ = radialZ * scale;
      maximumFieldDisplacement = Math.max(
        maximumFieldDisplacement,
        Math.hypot(correctionX, correctionY, correctionZ),
      );
      indices.push(vertexIndex);
      deltas.push(correctionX, correctionY, correctionZ);
    }
    fields.push({
      id: spec.id,
      category: spec.category,
      indices: Uint32Array.from(indices),
      deltas: Float32Array.from(deltas),
      maximumFieldDisplacement,
    });
  }
  return fields;
}

function applyPoseCorrectiveFields(basePositions, outputPositions, fields, activations) {
  outputPositions.set(basePositions);
  const corrected = new Uint8Array(basePositions.length / 3);
  const activeRegionIds = [];
  const activeCategories = new Set();
  let correctionSampleCount = 0;
  let maximumActivation = 0;
  for (const field of fields) {
    const activation = clamp(Number(activations.get(field.id)) || 0, 0, 1);
    maximumActivation = Math.max(maximumActivation, activation);
    if (activation <= 1e-4) continue;
    activeRegionIds.push(field.id);
    activeCategories.add(field.category);
    correctionSampleCount += field.indices.length;
    for (let sampleIndex = 0; sampleIndex < field.indices.length; sampleIndex += 1) {
      const vertexIndex = field.indices[sampleIndex];
      const positionOffset = vertexIndex * 3;
      const deltaOffset = sampleIndex * 3;
      outputPositions[positionOffset] += field.deltas[deltaOffset] * activation;
      outputPositions[positionOffset + 1] += field.deltas[deltaOffset + 1] * activation;
      outputPositions[positionOffset + 2] += field.deltas[deltaOffset + 2] * activation;
      corrected[vertexIndex] = 1;
    }
  }

  let correctedVertexCount = 0;
  let maximumInputDisplacement = 0;
  for (let vertexIndex = 0; vertexIndex < corrected.length; vertexIndex += 1) {
    if (!corrected[vertexIndex]) continue;
    correctedVertexCount += 1;
    const offset = vertexIndex * 3;
    maximumInputDisplacement = Math.max(
      maximumInputDisplacement,
      Math.hypot(
        outputPositions[offset] - basePositions[offset],
        outputPositions[offset + 1] - basePositions[offset + 1],
        outputPositions[offset + 2] - basePositions[offset + 2],
      ),
    );
  }
  return {
    profile: POSE_CORRECTIVE_PROFILE,
    fieldCount: fields.length,
    activeRegionCount: activeRegionIds.length,
    activeRegionIds,
    activeCategories: [...activeCategories],
    correctedVertexCount,
    correctionSampleCount,
    maximumActivation,
    maximumInputDisplacement,
    outwardCorrectionSampleCount: correctionSampleCount,
  };
}

/**
 * Public, renderer-independent pose-corrective entry point. Each evaluation
 * starts from restPositions, then produces the POSITION input consumed by the
 * existing Three.js GPU LBS path. JOINTS_0, WEIGHTS_0 and bind matrices remain
 * untouched, so repeated frames cannot accumulate vertex deformation.
 */
export function applyPoseCorrective(restPositions, outputPositions, {
  analysis = {},
  restPoints = null,
  fields = null,
} = {}) {
  if (!restPositions || !outputPositions || restPositions.length !== outputPositions.length) {
    throw new Error('Pose corrective requires equal-length rest and output position buffers.');
  }
  if (restPositions === outputPositions) {
    throw new Error('Pose corrective output must not alias restPositions.');
  }

  const normalized = normalizePoseCorrectiveAnalysis(analysis);
  const resolvedFields = fields ?? buildPoseCorrectiveFields(restPositions, restPoints);
  const activations = new Map();
  for (const spec of POSE_CORRECTIVE_SPECS) {
    const side = spec.id.startsWith('left') ? 'left' : 'right';
    const activation = spec.category === 'shoulder'
      ? Math.max(normalized.shoulderRaise[side], Math.abs(normalized.shoulderTwist[side]))
      : spec.category === 'hip'
        ? Math.abs(normalized.hipTwist[side])
        : spec.category === 'elbow'
          ? normalized.elbowFlex[side]
          : spec.category === 'wrist'
            ? normalized.wristFlex[side]
            : normalized.kneeFlex[side];
    activations.set(spec.id, activation);
  }

  const result = applyPoseCorrectiveFields(restPositions, outputPositions, resolvedFields, activations);
  const activeChannels = POSE_CORRECTIVE_CHANNELS.filter((channel) => (
    Math.max(Math.abs(normalized[channel].left), Math.abs(normalized[channel].right)) > 1e-6
  ));
  return {
    ...result,
    nonAccumulating: true,
    gpuLbsPreserved: true,
    activeChannels,
    channelMaxOffsetM: Object.fromEntries(POSE_CORRECTIVE_CHANNELS.map((channel) => [
      channel,
      activeChannels.includes(channel) ? result.maximumInputDisplacement : 0,
    ])),
  };
}

function normalizePoseCorrectiveAnalysis(input) {
  return Object.fromEntries(POSE_CORRECTIVE_CHANNELS.map((channel) => {
    const value = input?.[channel];
    return [channel, {
      left: clamp(Number(value?.left) || 0, -1, 1),
      right: clamp(Number(value?.right) || 0, -1, 1),
    }];
  }));
}

function relativeQuaternionAngle(parent, child) {
  const relative = parent.clone().invert().multiply(child).normalize();
  return 2 * Math.acos(clamp(Math.abs(relative.w), 0, 1));
}

function smoothstep01(value) {
  const t = clamp(Number(value) || 0, 0, 1);
  return t * t * (3 - 2 * t);
}

export function skinMatricesToDualQuaternions(skinMatrices, output = new Float32Array((skinMatrices?.length ?? 0) / 2)) {
  const jointCount = Math.floor((skinMatrices?.length ?? 0) / 16);
  if (output.length !== jointCount * 8) {
    throw new Error(`Dual quaternion buffer must contain ${jointCount * 8} values.`);
  }
  for (let jointIndex = 0; jointIndex < jointCount; jointIndex += 1) {
    const matrixOffset = jointIndex * 16;
    const outputOffset = jointIndex * 8;
    const [qx, qy, qz, qw] = matrixElementsToQuaternion(skinMatrices, matrixOffset);
    const dual = translationTimesQuaternion(
      skinMatrices[matrixOffset + 12],
      skinMatrices[matrixOffset + 13],
      skinMatrices[matrixOffset + 14],
      qx, qy, qz, qw,
    );
    output[outputOffset] = qx;
    output[outputOffset + 1] = qy;
    output[outputOffset + 2] = qz;
    output[outputOffset + 3] = qw;
    output[outputOffset + 4] = dual[0];
    output[outputOffset + 5] = dual[1];
    output[outputOffset + 6] = dual[2];
    output[outputOffset + 7] = dual[3];
  }
  return output;
}

function matrixElementsToQuaternion(elements, offset = 0) {
  const scaleX = Math.hypot(elements[offset], elements[offset + 1], elements[offset + 2]) || 1;
  const scaleY = Math.hypot(elements[offset + 4], elements[offset + 5], elements[offset + 6]) || 1;
  const scaleZ = Math.hypot(elements[offset + 8], elements[offset + 9], elements[offset + 10]) || 1;
  const m11 = elements[offset] / scaleX;
  const m21 = elements[offset + 1] / scaleX;
  const m31 = elements[offset + 2] / scaleX;
  const m12 = elements[offset + 4] / scaleY;
  const m22 = elements[offset + 5] / scaleY;
  const m32 = elements[offset + 6] / scaleY;
  const m13 = elements[offset + 8] / scaleZ;
  const m23 = elements[offset + 9] / scaleZ;
  const m33 = elements[offset + 10] / scaleZ;
  let x; let y; let z; let w;
  const trace = m11 + m22 + m33;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    w = 0.25 / s;
    x = (m32 - m23) * s;
    y = (m13 - m31) * s;
    z = (m21 - m12) * s;
  } else if (m11 > m22 && m11 > m33) {
    const s = 2 * Math.sqrt(Math.max(EPSILON, 1 + m11 - m22 - m33));
    w = (m32 - m23) / s;
    x = 0.25 * s;
    y = (m12 + m21) / s;
    z = (m13 + m31) / s;
  } else if (m22 > m33) {
    const s = 2 * Math.sqrt(Math.max(EPSILON, 1 + m22 - m11 - m33));
    w = (m13 - m31) / s;
    x = (m12 + m21) / s;
    y = 0.25 * s;
    z = (m23 + m32) / s;
  } else {
    const s = 2 * Math.sqrt(Math.max(EPSILON, 1 + m33 - m11 - m22));
    w = (m21 - m12) / s;
    x = (m13 + m31) / s;
    y = (m23 + m32) / s;
    z = 0.25 * s;
  }
  const length = Math.hypot(x, y, z, w) || 1;
  return [x / length, y / length, z / length, w / length];
}

/** Dual quaternion deformation keeps shoulder and hip volume better than LBS. */
export function deformSurfaceDqs(
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

function blendQuaternionsNormalized(THREE, first, second, amount) {
  const t = clamp(amount, 0, 1);
  const dot = first.x * second.x + first.y * second.y + first.z * second.z + first.w * second.w;
  const sign = dot < 0 ? -1 : 1;
  return new THREE.Quaternion(
    first.x + (second.x * sign - first.x) * t,
    first.y + (second.y * sign - first.y) * t,
    first.z + (second.z * sign - first.z) * t,
    first.w + (second.w * sign - first.w) * t,
  ).normalize();
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

function isSimulationRigFrameV4(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && value.type === 'SimulationRigFrame'
    && value.schema === 'humanoid_rig/simulation_rig_frame@4.0'
    && value.finalPose?.type === 'PoseFrame'
    && value.finalPose?.schema === 'humanoid_rig/pose_frame@4.0'
    && value.finalPose?.localRotations
    && typeof value.finalPose.localRotations === 'object',
  );
}

function isQuaternionArray(value) {
  return (Array.isArray(value) || ArrayBuffer.isView(value))
    && value.length === 4
    && Array.from(value).every((component) => Number.isFinite(Number(component)))
    && Math.abs(Math.hypot(...Array.from(value, Number)) - 1) < 1e-4;
}

function isVector3Array(value) {
  return (Array.isArray(value) || ArrayBuffer.isView(value))
    && value.length === 3
    && Array.from(value).every((component) => Number.isFinite(Number(component)));
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
  rebuildArticulationStableWeights,
  applyExtendedDeformWeights,
  enforceAnatomicalWeightGuards,
  reinforceRigidSegmentCore,
  buildPoseCorrectiveFields,
  applyPoseCorrectiveFields,
  applyPoseCorrective,
  skinMatricesToDualQuaternions,
  matrixElementsToQuaternion,
  relativeQuaternionAngle,
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
