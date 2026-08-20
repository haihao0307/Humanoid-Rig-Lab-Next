import { calculateBounds, computePoseWorldPositions, topologyKey } from './skeleton-model.js';
import { createSmplSkinLayer } from './smpl-skin.js';
import { createStaticClothingLayer } from './clothing-layer.js';

const EPSILON = 1e-7;

export async function createThreeSkeletonView(THREE, container, callbacks = {}) {
  const view = new ThreeSkeletonView(THREE, container, callbacks);
  await view.init();
  return view;
}

class ThreeSkeletonView {
  constructor(THREE, container, callbacks) {
    this.THREE = THREE;
    this.container = container;
    this.callbacks = callbacks;
    this.definition = null;
    this.selectedJointId = null;
    this.hoveredJointId = null;
    this.hoveredKind = null;
    this.space = 'world';
    this.topology = '';
    this.interaction = null;
    this.lastPointer = { x: 0, y: 0 };
    this.lastHoverKey = '';
    this.showGrid = true;
    this.showAxes = true;
    this.showSkeleton = true;
    this.skeletonDetail = 'performance';
    this.skeletonXray = true;
    this.skinVisible = true;
    this.skinOpacity = 1;
    this.skinMode = 'solid';
    this.skinSource = 'detail';
    this.bodyShapeProfile = null;
    this.skinLayer = null;
    this.clothingProfile = null;
    this.clothingLayer = null;
    this.skinLoadPromise = null;
    this.skinLoadGeneration = 0;
    this.disposed = false;
    this.backendName = 'WebGPU';

    this.bonesById = new Map();
    this.jointMeshesById = new Map();
    this.boneMeshesById = new Map();
    this.jointMeshes = [];
    this.boneMeshes = [];
    this.gizmoHitMeshes = [];

    this.cameraState = {
      target: new THREE.Vector3(0, 0.9, 0),
      radius: 3.2,
      theta: 0,
      phi: Math.PI / 2,
    };

    this.pointer = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.dragPlane = new THREE.Plane();
    this.yAxis = new THREE.Vector3(0, 1, 0);
    this.axisVectors = {
      x: new THREE.Vector3(1, 0, 0),
      y: new THREE.Vector3(0, 1, 0),
      z: new THREE.Vector3(0, 0, 1),
    };
    this.tempA = new THREE.Vector3();
    this.tempB = new THREE.Vector3();
    this.tempC = new THREE.Vector3();
    this.tempD = new THREE.Vector3();
    this.tempQuaternion = new THREE.Quaternion();

    this.boundPointerDown = (event) => this.onPointerDown(event);
    this.boundPointerMove = (event) => this.onPointerMove(event);
    this.boundPointerUp = (event) => this.onPointerUp(event);
    this.boundPointerLeave = (event) => this.onPointerLeave(event);
    this.boundWheel = (event) => this.onWheel(event);
    this.boundContextMenu = (event) => event.preventDefault();
  }

  async init() {
    const THREE = this.THREE;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070b16);
    this.scene.fog = new THREE.FogExp2(0x070b16, 0.035);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);

    this.renderer = await this.createRenderer(false).catch(async (firstError) => {
      console.warn('Default WebGPU renderer initialization failed, trying WebGL 2.', firstError);
      return this.createRenderer(true);
    });

    this.backendName = detectBackendName(this.renderer);
    this.renderer.domElement.classList.add('three-canvas');
    this.renderer.domElement.setAttribute('aria-label', '可交互三维骨骼链视图');
    this.renderer.domElement.setAttribute('tabindex', '0');
    this.renderer.domElement.style.touchAction = 'none';
    this.container.replaceChildren(this.renderer.domElement);

    const hemisphere = new THREE.HemisphereLight(0xe8f2ff, 0x111827, 2.35);
    this.scene.add(hemisphere);

    const keyLight = new THREE.DirectionalLight(0xffffff, 3.4);
    keyLight.position.set(2.8, 3.6, 3.3);
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x72c7ff, 1.45);
    rimLight.position.set(-3.1, 2.1, -2.6);
    this.scene.add(rimLight);

    this.gridHelper = new THREE.GridHelper(4, 40, 0x385677, 0x17243a);
    this.gridHelper.position.y = 0;
    this.scene.add(this.gridHelper);

    this.axesHelper = new THREE.AxesHelper(0.28);
    this.axesHelper.position.set(-1.55, 0.003, 1.55);
    this.scene.add(this.axesHelper);

    this.jointGeometries = {
      joint: new THREE.SphereGeometry(1, 22, 16),
      articulation: new THREE.SphereGeometry(1, 16, 12),
      face: new THREE.IcosahedronGeometry(1, 1),
      twist: new THREE.TorusGeometry(0.72, 0.25, 8, 20),
      control: new THREE.OctahedronGeometry(1, 0),
      pole: new THREE.TetrahedronGeometry(1, 0),
      'foot-roll': new THREE.TorusGeometry(0.78, 0.20, 8, 24),
      contact: new THREE.OctahedronGeometry(1, 0),
      corrective: new THREE.IcosahedronGeometry(1, 0),
    };
    this.cylinderGeometry = new THREE.CylinderGeometry(0.70, 1, 1, 14, 1, false);

    this.materials = {
      jointCenter: rigMaterial(THREE, 0xe8f1ff, 0x18314e, 0.18),
      jointLeft: rigMaterial(THREE, 0x59d5ff, 0x075985, 0.34),
      jointRight: rigMaterial(THREE, 0xff7bb8, 0x7a164c, 0.30),
      jointExtension: rigMaterial(THREE, 0x9ee7ff, 0x0b526c, 0.25),
      jointFace: rigMaterial(THREE, 0xffd166, 0x7c4a00, 0.28),
      jointTwist: rigMaterial(THREE, 0xb69cff, 0x4c2b8f, 0.42),
      jointCorrective: rigMaterial(THREE, 0xd98cff, 0x641b82, 0.40),
      jointControl: rigMaterial(THREE, 0xffcf5a, 0x875000, 0.46),
      jointMarker: rigMaterial(THREE, 0x59f0c2, 0x0b7258, 0.42),
      jointHover: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x16b8ff,
        emissiveIntensity: 0.82,
        roughness: 0.26,
        metalness: 0.04,
      }),
      jointSelected: new THREE.MeshStandardMaterial({
        color: 0xffe29a,
        emissive: 0xff8a00,
        emissiveIntensity: 0.78,
        roughness: 0.24,
        metalness: 0.06,
      }),
      boneCenter: rigMaterial(THREE, 0x8ca3bd, 0x13243b, 0.08),
      boneLeft: rigMaterial(THREE, 0x248fba, 0x063c58, 0.18),
      boneRight: rigMaterial(THREE, 0xbc477d, 0x54102f, 0.16),
      boneExtension: rigMaterial(THREE, 0x4bafca, 0x073e50, 0.17),
      boneFace: rigMaterial(THREE, 0xc58b2d, 0x5e3500, 0.18),
      boneTwist: rigMaterial(THREE, 0x7655c9, 0x32196f, 0.28),
      boneCorrective: rigMaterial(THREE, 0x9d4ec0, 0x451259, 0.26),
      boneHover: new THREE.MeshStandardMaterial({
        color: 0xb7edff,
        emissive: 0x087ea6,
        emissiveIntensity: 0.66,
        roughness: 0.31,
        metalness: 0.05,
      }),
      boneSelected: new THREE.MeshStandardMaterial({
        color: 0xffc857,
        emissive: 0x8f4b00,
        emissiveIntensity: 0.62,
        roughness: 0.28,
        metalness: 0.06,
      }),
    };

    this.selectionHalo = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.08, 8, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffc857,
        transparent: true,
        opacity: 0.92,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.selectionHalo.name = 'RigSelectionHalo';
    this.selectionHalo.renderOrder = 18;
    this.selectionHalo.visible = false;
    this.scene.add(this.selectionHalo);

    this.createGizmo();
    this.bindEvents();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
    this.updateCamera();
    this.renderer.setAnimationLoop(() => this.renderFrame());
    return this;
  }

  async createRenderer(forceWebGL) {
    const THREE = this.THREE;
    const renderer = new THREE.WebGPURenderer({
      antialias: true,
      alpha: false,
      forceWebGL,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.10;
    await renderer.init();
    return renderer;
  }

  refresh(definition, selectedJointId, hoveredJointId = null, hoveredKind = null) {
    this.definition = definition;
    this.selectedJointId = selectedJointId;
    this.hoveredJointId = hoveredJointId;
    this.hoveredKind = hoveredKind;

    const nextTopology = topologyKey(definition);
    if (nextTopology !== this.topology) {
      this.topology = nextTopology;
      this.buildSkeleton();
    } else {
      this.syncSkeletonFromDefinition();
    }

    const surfaceInteraction = {
      selectedJointId: this.selectedJointId,
      hoveredJointId: this.hoveredJointId,
      hoveredKind: this.hoveredKind,
    };
    if (this.skinLayer) {
      this.skinLayer.refresh(definition, surfaceInteraction);
    } else {
      this.ensureSkinLayer();
    }
    this.ensureClothingLayer();
  }

  setView(viewType) {
    if (!this.definition) {
      return;
    }

    const bounds = calculateBounds(this.definition);
    this.cameraState.target.set(bounds.center.x, bounds.center.y, bounds.center.z);
    const maxDimension = Math.max(bounds.size.x, bounds.size.y, bounds.size.z, 0.55);
    const halfFov = this.THREE.MathUtils.degToRad(this.camera.fov * 0.5);
    this.cameraState.radius = Math.max(1.1, (maxDimension * 0.68) / Math.tan(halfFov));

    if (viewType === 'side') {
      this.cameraState.theta = Math.PI / 2;
      this.cameraState.phi = Math.PI / 2;
    } else if (viewType === 'top') {
      this.cameraState.theta = 0;
      this.cameraState.phi = 0.035;
    } else if (viewType === 'perspective') {
      this.cameraState.theta = 0.62;
      this.cameraState.phi = 1.16;
      this.cameraState.radius *= 1.08;
    } else {
      this.cameraState.theta = 0;
      this.cameraState.phi = Math.PI / 2;
    }
    this.updateCamera();
  }

  fitToDefinition() {
    this.setView('front');
  }

  setGridVisible(visible) {
    this.showGrid = Boolean(visible);
    if (this.gridHelper) {
      this.gridHelper.visible = this.showGrid;
    }
  }

  setAxesVisible(visible) {
    this.showAxes = Boolean(visible);
    if (this.axesHelper) {
      this.axesHelper.visible = this.showAxes;
    }
  }

  setSkeletonVisible(visible) {
    this.showSkeleton = Boolean(visible);
    if (this.skeletonGroup) this.skeletonGroup.visible = this.showSkeleton;
    if (this.boneVisualGroup) this.boneVisualGroup.visible = this.showSkeleton;
    this.updateGizmo();
  }

  setSkeletonDetail(mode) {
    this.skeletonDetail = ['core', 'production', 'performance'].includes(mode)
      ? mode
      : 'performance';
    this.syncSkeletonFromDefinition();
  }

  setSkeletonXray(enabled) {
    this.skeletonXray = Boolean(enabled);
    for (const material of Object.values(this.materials ?? {})) {
      material.depthTest = !this.skeletonXray;
      material.depthWrite = !this.skeletonXray;
      material.needsUpdate = true;
    }
    if (this.selectionHalo?.material) {
      this.selectionHalo.material.depthTest = false;
      this.selectionHalo.material.depthWrite = false;
    }
  }

  setSkinVisible(visible) {
    this.skinVisible = Boolean(visible);
    this.skinLayer?.setVisible(this.skinVisible);
    if (this.skinVisible && !this.skinLayer) this.ensureSkinLayer();
    this.updateGizmo();
  }

  setSkinOpacity(value) {
    this.skinOpacity = clamp(Number(value), 0.2, 1);
    this.skinLayer?.setOpacity(this.skinOpacity);
  }

  setSkinMode(mode) {
    this.skinMode = ['solid', 'translucent', 'wireframe'].includes(mode) ? mode : 'solid';
    this.skinLayer?.setMode(this.skinMode);
  }

  setSkinSource(source) {
    this.skinSource = 'detail';
    this.skinLayer?.setSource?.('detail');
  }

  setBodyShape(profile) {
    this.bodyShapeProfile = profile ? structuredClone(profile) : null;
    return this.skinLayer?.setBodyShape?.(this.bodyShapeProfile || {});
  }

  setClothingProfile(profile) {
    this.clothingProfile = profile ? structuredClone(profile) : null;
    const layer = this.ensureClothingLayer();
    layer?.setProfile(this.clothingProfile || {});
    if (this.definition) layer?.refresh(this.definition);
    return layer?.getDiagnostics?.() || null;
  }

  ensureClothingLayer() {
    if (!this.scene || this.disposed) return null;
    if (!this.clothingLayer) {
      this.clothingLayer = createStaticClothingLayer(this.THREE, this.scene);
      this.clothingLayer.setProfile(this.clothingProfile || {});
    }
    return this.clothingLayer;
  }

  ensureSkinLayer({ force = false } = {}) {
    if (!this.definition || this.disposed) {
      return Promise.resolve(null);
    }
    if (force) {
      this.skinLoadGeneration += 1;
      this.skinLayer?.dispose?.();
      this.skinLayer = null;
      this.skinLoadPromise = null;
    } else if (this.skinLayer) {
      return Promise.resolve(this.skinLayer);
    } else if (this.skinLoadPromise) {
      return this.skinLoadPromise;
    }

    const generation = ++this.skinLoadGeneration;
    const loadingPromise = createSmplSkinLayer(
      this.THREE,
      this.scene,
      this.definition,
      this.callbacks,
    ).then((layer) => {
      if (this.disposed || generation !== this.skinLoadGeneration) {
        layer.dispose?.();
        return null;
      }
      this.skinLayer = layer;
      this.skinLayer.setSource?.(this.skinSource);
      this.skinLayer.setVisible(this.skinVisible);
      this.skinLayer.setOpacity(this.skinOpacity);
      this.skinLayer.setMode(this.skinMode);
      this.skinLayer.setBodyShape?.(this.bodyShapeProfile || {});
      this.skinLayer.refresh(this.definition, {
        selectedJointId: this.selectedJointId,
        hoveredJointId: this.hoveredJointId,
        hoveredKind: this.hoveredKind,
      });
      return layer;
    }).catch((error) => {
      console.warn('Unable to initialize surface layer.', error);
      if (generation === this.skinLoadGeneration) {
        this.callbacks.onSurfaceState?.({
          state: 'error',
          label: '人物表皮加载失败',
          detail: error instanceof Error ? error.message : String(error),
        });
      }
      return null;
    }).finally(() => {
      if (this.skinLoadPromise === loadingPromise) {
        this.skinLoadPromise = null;
      }
    });
    this.skinLoadPromise = loadingPromise;
    return loadingPromise;
  }

  reloadSkinLayer() {
    return this.ensureSkinLayer({ force: true });
  }

  getSurfaceDiagnostics() {
    return {
      backend: this.backendName,
      requestedVisible: this.skinVisible,
      requestedOpacity: this.skinOpacity,
      requestedMode: this.skinMode,
      requestedSource: this.skinSource,
      requestedBodyShape: this.bodyShapeProfile ? structuredClone(this.bodyShapeProfile) : null,
      loading: Boolean(this.skinLoadPromise),
      layer: this.skinLayer?.getDiagnostics?.() ?? null,
      clothing: this.clothingLayer?.getDiagnostics?.() ?? null,
    };
  }

  setSpace(space) {
    this.space = space === 'local' ? 'local' : 'world';
  }

  baseJointMaterial(joint) {
    if (joint.role === 'control') return this.materials.jointControl;
    if (joint.role === 'marker') return this.materials.jointMarker;
    if (joint.role === 'corrective') return this.materials.jointCorrective;
    if (joint.visualShape === 'twist') return this.materials.jointTwist;
    if (joint.category === 'face') return this.materials.jointFace;
    if (joint.rigTier === 'full-performance') return this.materials.jointExtension;
    if (joint.side === 'left') return this.materials.jointLeft;
    if (joint.side === 'right') return this.materials.jointRight;
    return this.materials.jointCenter;
  }

  baseBoneMaterial(joint) {
    if (joint.role === 'corrective') return this.materials.boneCorrective;
    if (joint.visualShape === 'twist') return this.materials.boneTwist;
    if (joint.category === 'face') return this.materials.boneFace;
    if (joint.rigTier === 'full-performance') return this.materials.boneExtension;
    if (joint.side === 'left') return this.materials.boneLeft;
    if (joint.side === 'right') return this.materials.boneRight;
    return this.materials.boneCenter;
  }

  detailAllows(joint) {
    if (this.skeletonDetail === 'core') return (joint.rigTier ?? 'core') === 'core';
    if (this.skeletonDetail === 'production') return joint.rigTier !== 'full-performance';
    return true;
  }

  buildSkeleton() {
    const THREE = this.THREE;
    if (this.skeletonGroup) {
      this.scene.remove(this.skeletonGroup);
    }
    if (this.boneVisualGroup) {
      this.scene.remove(this.boneVisualGroup);
    }

    this.bonesById.clear();
    this.jointMeshesById.clear();
    this.boneMeshesById.clear();
    this.jointMeshes = [];
    this.boneMeshes = [];

    this.skeletonGroup = new THREE.Group();
    this.skeletonGroup.name = 'HumanoidSkeletonHierarchy';
    this.scene.add(this.skeletonGroup);

    this.boneVisualGroup = new THREE.Group();
    this.boneVisualGroup.name = 'HumanoidBoneVisuals';
    this.scene.add(this.boneVisualGroup);

    for (const jointDefinition of this.definition.joints) {
      const bone = new THREE.Bone();
      bone.name = jointDefinition.id;
      bone.position.fromArray(jointDefinition.localPosition);
      bone.userData.jointId = jointDefinition.id;
      this.bonesById.set(jointDefinition.id, bone);

      if (jointDefinition.visualJoint !== false) {
        const geometry = this.jointGeometries[jointDefinition.visualShape]
          ?? this.jointGeometries.joint;
        const sphere = new THREE.Mesh(geometry, this.baseJointMaterial(jointDefinition));
        sphere.name = `${jointDefinition.id}_joint_visual`;
        sphere.userData.kind = 'joint';
        sphere.userData.jointId = jointDefinition.id;
        sphere.userData.rigTier = jointDefinition.rigTier ?? 'core';
        sphere.userData.role = jointDefinition.role ?? 'deform';
        sphere.renderOrder = 4;
        bone.add(sphere);
        this.jointMeshesById.set(jointDefinition.id, sphere);
        this.jointMeshes.push(sphere);
      }
    }

    for (const jointDefinition of this.definition.joints) {
      const bone = this.bonesById.get(jointDefinition.id);
      const parent = jointDefinition.parentId
        ? this.bonesById.get(jointDefinition.parentId)
        : null;
      if (parent) {
        parent.add(bone);
      } else {
        this.skeletonGroup.add(bone);
      }
    }

    for (const jointDefinition of this.definition.joints) {
      if (!jointDefinition.parentId || jointDefinition.visualBone === false) {
        continue;
      }
      const cylinder = new THREE.Mesh(this.cylinderGeometry, this.baseBoneMaterial(jointDefinition));
      cylinder.name = `${jointDefinition.id}_bone_visual`;
      cylinder.userData.kind = 'bone';
      cylinder.userData.jointId = jointDefinition.id;
      cylinder.userData.rigTier = jointDefinition.rigTier ?? 'core';
      cylinder.userData.role = jointDefinition.role ?? 'deform';
      cylinder.renderOrder = 2;
      this.boneVisualGroup.add(cylinder);
      this.boneMeshesById.set(jointDefinition.id, cylinder);
      this.boneMeshes.push(cylinder);
    }

    this.setSkeletonVisible(this.showSkeleton);
    this.setSkeletonXray(this.skeletonXray);
    this.syncSkeletonFromDefinition();
  }

  syncSkeletonFromDefinition() {
    if (!this.skeletonGroup) {
      return;
    }

    const poseWorld = computePoseWorldPositions(this.definition);
    for (const jointDefinition of this.definition.joints) {
      const bone = this.bonesById.get(jointDefinition.id);
      if (!bone) {
        continue;
      }
      const point = poseWorld.get(jointDefinition.id);
      if (jointDefinition.parentId) {
        const parentPoint = poseWorld.get(jointDefinition.parentId);
        bone.position.set(
          point.x - parentPoint.x,
          point.y - parentPoint.y,
          point.z - parentPoint.z,
        );
      } else {
        bone.position.set(point.x, point.y, point.z);
      }
    }

    this.skeletonGroup.updateMatrixWorld(true);

    for (const jointDefinition of this.definition.joints) {
      const sphere = this.jointMeshesById.get(jointDefinition.id);
      if (sphere) {
        sphere.visible = this.detailAllows(jointDefinition);
        const selected = jointDefinition.id === this.selectedJointId;
        const hovered = jointDefinition.id === this.hoveredJointId && this.hoveredKind === 'joint';
        const scaleFactor = selected ? 1.12 : hovered ? 1.22 : 1;
        sphere.scale.setScalar(jointDefinition.jointRadius * scaleFactor);
        sphere.material = selected
          ? this.materials.jointSelected
          : hovered
            ? this.materials.jointHover
            : this.baseJointMaterial(jointDefinition);
      }

      if (!jointDefinition.parentId) {
        continue;
      }

      const parentBone = this.bonesById.get(jointDefinition.parentId);
      const childBone = this.bonesById.get(jointDefinition.id);
      const cylinder = this.boneMeshesById.get(jointDefinition.id);
      if (!parentBone || !childBone || !cylinder) {
        continue;
      }

      parentBone.getWorldPosition(this.tempA);
      childBone.getWorldPosition(this.tempB);
      this.tempC.subVectors(this.tempB, this.tempA);
      const length = this.tempC.length();
      cylinder.visible = this.detailAllows(jointDefinition) && length > EPSILON;
      if (!cylinder.visible) {
        continue;
      }

      const selected = jointDefinition.id === this.selectedJointId;
      const hovered = jointDefinition.id === this.hoveredJointId && this.hoveredKind === 'bone';
      const radiusFactor = selected ? 1.12 : hovered ? 1.34 : 1;
      cylinder.position.copy(this.tempA).add(this.tempB).multiplyScalar(0.5);
      cylinder.quaternion.setFromUnitVectors(this.yAxis, this.tempC.normalize());
      cylinder.scale.set(
        jointDefinition.boneRadius * radiusFactor,
        length,
        jointDefinition.boneRadius * radiusFactor,
      );
      cylinder.material = selected
        ? this.materials.boneSelected
        : hovered
          ? this.materials.boneHover
          : this.baseBoneMaterial(jointDefinition);
    }

    this.updateSelectionHalo();
    this.updateGizmo();
    this.clothingLayer?.refresh(this.definition, poseWorld);
  }

  updateSelectionHalo() {
    if (!this.selectionHalo || !this.selectedJointId || !this.showSkeleton) {
      if (this.selectionHalo) this.selectionHalo.visible = false;
      return;
    }
    const definition = this.definition.joints.find((item) => item.id === this.selectedJointId);
    const bone = this.bonesById.get(this.selectedJointId);
    if (!definition || !bone || !this.detailAllows(definition)) {
      this.selectionHalo.visible = false;
      return;
    }
    bone.getWorldPosition(this.tempD);
    this.selectionHalo.position.copy(this.tempD);
    this.selectionHalo.quaternion.copy(this.camera.quaternion);
    const radius = Math.max(0.032, Number(definition.jointRadius) * 1.65);
    this.selectionHalo.scale.setScalar(radius);
    this.selectionHalo.visible = true;
  }

  createGizmo() {
    const THREE = this.THREE;
    this.gizmoGroup = new THREE.Group();
    this.gizmoGroup.name = 'TranslationGizmo';
    this.gizmoGroup.visible = false;
    this.scene.add(this.gizmoGroup);

    const createAxis = (axis, color, rotation) => {
      const group = new THREE.Group();
      group.rotation.set(rotation.x, rotation.y, rotation.z);

      const material = new THREE.MeshBasicMaterial({
        color,
        depthTest: false,
        depthWrite: false,
      });
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.026, 0.52, 10),
        material,
      );
      shaft.position.y = 0.27;
      shaft.renderOrder = 20;
      shaft.userData.kind = 'gizmo';
      shaft.userData.axis = axis;

      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.072, 0.18, 12),
        material,
      );
      tip.position.y = 0.62;
      tip.renderOrder = 20;
      tip.userData.kind = 'gizmo';
      tip.userData.axis = axis;

      group.add(shaft, tip);
      this.gizmoGroup.add(group);
      this.gizmoHitMeshes.push(shaft, tip);
    };

    createAxis('x', 0xff5f6d, { x: 0, y: 0, z: -Math.PI / 2 });
    createAxis('y', 0x52df83, { x: 0, y: 0, z: 0 });
    createAxis('z', 0x4e9cff, { x: Math.PI / 2, y: 0, z: 0 });

    const centerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd166,
      depthTest: false,
      depthWrite: false,
    });
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.078, 14, 10), centerMaterial);
    center.renderOrder = 21;
    center.userData.kind = 'gizmo';
    center.userData.axis = 'free';
    this.gizmoGroup.add(center);
    this.gizmoHitMeshes.push(center);
  }

  updateGizmo() {
    if (!this.gizmoGroup || !this.selectedJointId || (!this.showSkeleton && !this.skinVisible)) {
      if (this.gizmoGroup) {
        this.gizmoGroup.visible = false;
      }
      return;
    }

    const bone = this.bonesById.get(this.selectedJointId);
    if (!bone) {
      this.gizmoGroup.visible = false;
      return;
    }

    bone.getWorldPosition(this.tempA);
    this.gizmoGroup.visible = true;
    this.gizmoGroup.position.copy(this.tempA);
    const distance = this.camera.position.distanceTo(this.tempA);
    this.gizmoGroup.scale.setScalar(Math.max(0.22, distance * 0.105));
    this.gizmoGroup.updateMatrixWorld(true);
  }

  bindEvents() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('contextmenu', this.boundContextMenu);
    canvas.addEventListener('pointerdown', this.boundPointerDown);
    canvas.addEventListener('pointermove', this.boundPointerMove);
    canvas.addEventListener('pointerup', this.boundPointerUp);
    canvas.addEventListener('pointercancel', this.boundPointerUp);
    canvas.addEventListener('pointerleave', this.boundPointerLeave);
    canvas.addEventListener('wheel', this.boundWheel, { passive: false });
  }

  onPointerDown(event) {
    if (!this.definition) {
      return;
    }
    event.preventDefault();
    this.lastPointer = { x: event.clientX, y: event.clientY };
    this.updateRay(event);

    if (event.button === 0) {
      const hit = this.pickObject();
      if (hit?.kind === 'gizmo') {
        this.renderer.domElement.setPointerCapture(event.pointerId);
        if (hit.axis === 'free') {
          this.startFreeDrag(this.selectedJointId, event.pointerId, 'joint');
        } else {
          this.startAxisDrag(this.selectedJointId, hit.axis, event.pointerId);
        }
        return;
      }

      if (hit?.jointId) {
        this.callbacks.onSelect?.(hit.jointId);
        this.renderer.domElement.setPointerCapture(event.pointerId);
        this.startFreeDrag(hit.jointId, event.pointerId, hit.kind, hit.point);
        return;
      }

      this.renderer.domElement.setPointerCapture(event.pointerId);
      this.interaction = {
        type: 'orbit',
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastY: event.clientY,
      };
      this.setCursor('grabbing');
      return;
    }

    if (event.button === 1 || event.button === 2) {
      this.renderer.domElement.setPointerCapture(event.pointerId);
      this.interaction = {
        type: 'pan',
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastY: event.clientY,
      };
      this.setCursor('grabbing');
    }
  }

  onPointerMove(event) {
    this.lastPointer = { x: event.clientX, y: event.clientY };
    if (this.interaction?.pointerId === event.pointerId) {
      this.handleInteractionMove(event);
      return;
    }

    this.updateRay(event);
    const hit = this.pickObject();
    const hoverJointId = hit?.jointId ?? null;
    const hoverKind = hit?.kind === 'gizmo' ? 'gizmo' : hit?.kind ?? null;
    const key = `${hoverJointId ?? ''}:${hoverKind ?? ''}:${hit?.axis ?? ''}`;

    if (key !== this.lastHoverKey) {
      this.lastHoverKey = key;
      this.callbacks.onHover?.(hoverJointId, hoverKind, event.clientX, event.clientY, hit?.axis ?? null);
    } else if (hoverJointId || hit?.kind === 'gizmo') {
      this.callbacks.onHover?.(hoverJointId, hoverKind, event.clientX, event.clientY, hit?.axis ?? null);
    }

    this.setCursor(hit ? (hit.kind === 'gizmo' ? 'move' : 'pointer') : 'grab');
  }

  onPointerUp(event) {
    if (!this.interaction || this.interaction.pointerId !== event.pointerId) {
      return;
    }

    const interaction = this.interaction;
    this.interaction = null;
    if (this.renderer.domElement.hasPointerCapture(event.pointerId)) {
      this.renderer.domElement.releasePointerCapture(event.pointerId);
    }

    if (interaction.type === 'drag-free' || interaction.type === 'drag-axis') {
      this.callbacks.onDragEnd?.({
        jointId: interaction.jointId,
        kind: interaction.kind ?? 'joint',
        changed: interaction.changed,
      });
    }
    this.setCursor('grab');
  }

  onPointerLeave(event) {
    if (!this.interaction) {
      this.lastHoverKey = '';
      this.callbacks.onHover?.(null, null, event.clientX, event.clientY, null);
      this.setCursor('grab');
    }
  }

  onWheel(event) {
    event.preventDefault();
    const factor = Math.exp(event.deltaY * 0.00105);
    this.cameraState.radius = clamp(this.cameraState.radius * factor, 0.4, 30);
    this.updateCamera();
  }

  handleInteractionMove(event) {
    const interaction = this.interaction;
    if (interaction.type === 'orbit') {
      const dx = event.clientX - interaction.lastX;
      const dy = event.clientY - interaction.lastY;
      interaction.lastX = event.clientX;
      interaction.lastY = event.clientY;
      this.cameraState.theta -= dx * 0.0075;
      this.cameraState.phi = clamp(this.cameraState.phi - dy * 0.0075, 0.035, Math.PI - 0.035);
      this.updateCamera();
      return;
    }

    if (interaction.type === 'pan') {
      const dx = event.clientX - interaction.lastX;
      const dy = event.clientY - interaction.lastY;
      interaction.lastX = event.clientX;
      interaction.lastY = event.clientY;
      this.panCamera(dx, dy);
      return;
    }

    this.updateRay(event);
    const hitPoint = this.raycaster.ray.intersectPlane(interaction.plane, this.tempA);
    if (!hitPoint) {
      return;
    }

    let nextWorld;
    if (interaction.type === 'drag-axis') {
      const parameter = this.tempB.copy(hitPoint).sub(interaction.startWorld).dot(interaction.axis);
      nextWorld = this.tempC
        .copy(interaction.startWorld)
        .addScaledVector(interaction.axis, parameter - interaction.startParameter)
        .clone();
    } else {
      nextWorld = this.tempB.copy(hitPoint).add(interaction.offset).clone();
    }

    interaction.changed = true;
    this.callbacks.onDrag?.({
      jointId: interaction.jointId,
      kind: interaction.kind ?? 'joint',
      worldPosition: {
        x: nextWorld.x,
        y: nextWorld.y,
        z: nextWorld.z,
      },
    });
  }

  startFreeDrag(jointId, pointerId, kind = 'joint', anchorPoint = null) {
    if (!jointId) {
      return;
    }
    const bone = this.bonesById.get(jointId);
    if (!bone) {
      return;
    }

    let startWorld;
    if (kind === 'bone') {
      if (anchorPoint) {
        startWorld = anchorPoint.clone ? anchorPoint.clone() : new this.THREE.Vector3(anchorPoint.x, anchorPoint.y, anchorPoint.z);
      } else {
        const jointDefinition = this.definition.joints.find((item) => item.id === jointId);
        const parentBone = jointDefinition?.parentId ? this.bonesById.get(jointDefinition.parentId) : null;
        bone.getWorldPosition(this.tempA);
        if (parentBone) {
          parentBone.getWorldPosition(this.tempB);
          startWorld = this.tempA.clone().add(this.tempB).multiplyScalar(0.5);
        } else {
          startWorld = this.tempA.clone();
        }
      }
    } else {
      bone.getWorldPosition(this.tempA);
      startWorld = this.tempA.clone();
      kind = 'joint';
    }

    const planeNormal = this.camera.getWorldDirection(this.tempB).normalize();
    const plane = new this.THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, startWorld);
    const hitPoint = this.raycaster.ray.intersectPlane(plane, this.tempC);
    const offset = hitPoint
      ? startWorld.clone().sub(hitPoint)
      : new this.THREE.Vector3();

    this.interaction = {
      type: 'drag-free',
      kind,
      pointerId,
      jointId,
      plane,
      offset,
      startWorld,
      changed: false,
    };
    this.callbacks.onDragStart?.({
      jointId,
      kind,
      anchorWorld: { x: startWorld.x, y: startWorld.y, z: startWorld.z },
    });
    this.setCursor('grabbing');
  }

  startAxisDrag(jointId, axisName, pointerId) {
    if (!jointId || !this.axisVectors[axisName]) {
      return;
    }
    const bone = this.bonesById.get(jointId);
    if (!bone) {
      return;
    }

    bone.getWorldPosition(this.tempA);
    const startWorld = this.tempA.clone();
    const axis = this.axisVectors[axisName].clone();
    const cameraDirection = this.camera.getWorldDirection(this.tempB).normalize();
    const planeNormal = this.tempC
      .crossVectors(axis, cameraDirection)
      .cross(axis)
      .normalize();

    if (planeNormal.lengthSq() < EPSILON) {
      planeNormal.copy(this.camera.up).addScaledVector(axis, -this.camera.up.dot(axis)).normalize();
    }
    if (planeNormal.lengthSq() < EPSILON) {
      planeNormal.set(0, 0, 1);
    }

    const plane = new this.THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, startWorld);
    const hitPoint = this.raycaster.ray.intersectPlane(plane, this.tempD);
    const startParameter = hitPoint
      ? this.tempD.clone().sub(startWorld).dot(axis)
      : 0;

    this.interaction = {
      type: 'drag-axis',
      kind: 'joint',
      pointerId,
      jointId,
      axis,
      axisName,
      plane,
      startWorld,
      startParameter,
      changed: false,
    };
    this.callbacks.onDragStart?.({
      jointId,
      kind: 'joint',
      anchorWorld: { x: startWorld.x, y: startWorld.y, z: startWorld.z },
    });
    this.setCursor('grabbing');
  }

  pickObject() {
    if (this.gizmoGroup?.visible) {
      const gizmoHits = this.raycaster.intersectObjects(this.gizmoHitMeshes, false);
      if (gizmoHits.length) {
        return {
          kind: 'gizmo',
          axis: gizmoHits[0].object.userData.axis,
          jointId: this.selectedJointId,
          distance: gizmoHits[0].distance,
        };
      }
    }

    let jointHit = null;
    let boneHit = null;
    if (this.showSkeleton) {
      jointHit = this.raycaster.intersectObjects(this.jointMeshes, false)[0] ?? null;
      boneHit = this.raycaster.intersectObjects(this.boneMeshes, false)[0] ?? null;
    }

    // The editable skeleton remains first priority. In skin-only mode the same
    // detailed SMPL mesh used for rendering is raycast directly and resolves
    // the clicked triangle through its generated skin weights.
    if (jointHit && (!boneHit || jointHit.distance <= boneHit.distance + 0.09)) {
      return {
        kind: 'joint',
        jointId: jointHit.object.userData.jointId,
        distance: jointHit.distance,
        point: jointHit.point.clone(),
      };
    }
    if (boneHit) {
      return {
        kind: 'bone',
        jointId: boneHit.object.userData.jointId,
        distance: boneHit.distance,
        point: boneHit.point.clone(),
      };
    }

    if (this.skinVisible && this.skinLayer) {
      const targets = this.skinLayer.getPickTargets?.() ?? [];
      if (targets.length) {
        const surfaceHit = this.raycaster.intersectObjects(targets, false)[0];
        const resolved = this.skinLayer.resolvePick?.(surfaceHit);
        if (resolved?.jointId) return resolved;
      }
    }

    if (jointHit) {
      return {
        kind: 'joint',
        jointId: jointHit.object.userData.jointId,
        distance: jointHit.distance,
        point: jointHit.point.clone(),
      };
    }
    return null;
  }

  updateRay(event) {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  panCamera(dx, dy) {
    const direction = this.camera.getWorldDirection(this.tempA).normalize();
    const right = this.tempB.crossVectors(direction, this.camera.up).normalize();
    const up = this.tempC.crossVectors(right, direction).normalize();
    const worldPerPixel = this.cameraState.radius * 0.0017;
    this.cameraState.target
      .addScaledVector(right, -dx * worldPerPixel)
      .addScaledVector(up, dy * worldPerPixel);
    this.updateCamera();
  }

  updateCamera() {
    const { target, radius, theta, phi } = this.cameraState;
    const sinPhi = Math.sin(phi);
    this.camera.position.set(
      target.x + radius * sinPhi * Math.sin(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * sinPhi * Math.cos(theta),
    );

    if (phi < 0.10 || phi > Math.PI - 0.10) {
      this.camera.up.set(0, 0, phi < Math.PI / 2 ? -1 : 1);
    } else {
      this.camera.up.set(0, 1, 0);
    }
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld();
    this.updateGizmo();
  }

  resize() {
    if (!this.renderer || !this.camera) {
      return;
    }
    const bounds = this.container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(bounds.width));
    const height = Math.max(1, Math.floor(bounds.height));
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  renderFrame() {
    if (!this.renderer || !this.scene || !this.camera) {
      return;
    }
    this.updateSelectionHalo();
    this.updateGizmo();
    this.renderer.render(this.scene, this.camera);
  }

  setCursor(cursor) {
    if (this.renderer?.domElement) {
      this.renderer.domElement.style.cursor = cursor;
    }
  }

  dispose() {
    this.disposed = true;
    this.skinLoadGeneration += 1;
    this.skinLayer?.dispose?.();
    this.skinLayer = null;
    this.clothingLayer?.dispose?.();
    this.clothingLayer = null;
    this.resizeObserver?.disconnect();
    if (this.renderer) {
      this.renderer.setAnimationLoop(null);
      const canvas = this.renderer.domElement;
      canvas.removeEventListener('contextmenu', this.boundContextMenu);
      canvas.removeEventListener('pointerdown', this.boundPointerDown);
      canvas.removeEventListener('pointermove', this.boundPointerMove);
      canvas.removeEventListener('pointerup', this.boundPointerUp);
      canvas.removeEventListener('pointercancel', this.boundPointerUp);
      canvas.removeEventListener('pointerleave', this.boundPointerLeave);
      canvas.removeEventListener('wheel', this.boundWheel);
      this.renderer.dispose?.();
      canvas.remove();
    }

    for (const geometry of Object.values(this.jointGeometries ?? {})) {
      geometry.dispose?.();
    }
    this.cylinderGeometry?.dispose?.();
    this.selectionHalo?.geometry?.dispose?.();
    this.selectionHalo?.material?.dispose?.();
    for (const material of Object.values(this.materials ?? {})) {
      material.dispose?.();
    }
  }
}

function rigMaterial(THREE, color, emissive, emissiveIntensity) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity,
    roughness: 0.31,
    metalness: 0.08,
  });
}

function detectBackendName(renderer) {
  const backend = renderer?.backend;
  const constructorName = backend?.constructor?.name?.toLowerCase?.() ?? '';
  if (backend?.isWebGPUBackend === true || constructorName.includes('webgpu')) {
    return 'WebGPU';
  }
  return 'WebGL 2';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
