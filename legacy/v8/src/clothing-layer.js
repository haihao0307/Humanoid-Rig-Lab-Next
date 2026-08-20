export function createStaticClothingLayer(THREE, scene) {
  return new StaticClothingLayer(THREE, scene);
}

class StaticClothingLayer {
  constructor(THREE, scene) {
    this.THREE = THREE;
    this.scene = scene;
    this.profile = null;
    this.profileKey = '';
    this.entries = new Map();
    this.group = new THREE.Group();
    this.group.name = 'CharacterClothingAttachmentLayer';
    this.group.userData.owner = 'clothing-system';
    this.group.userData.notSkin = true;
    scene.add(this.group);
    this.yAxis = new THREE.Vector3(0, 1, 0);
    this.zAxis = new THREE.Vector3(0, 0, 1);
    this.tempA = new THREE.Vector3();
    this.tempB = new THREE.Vector3();
    this.tempDirection = new THREE.Vector3();
  }

  setProfile(profileInput) {
    const profile = normalizeProfile(profileInput);
    const key = JSON.stringify(profile);
    if (key === this.profileKey) return false;
    this.profile = profile;
    this.profileKey = key;
    this.rebuild();
    return true;
  }

  rebuild() {
    this.clear();
    for (const asset of this.profile?.assets || []) {
      const entry = this.createEntry(asset);
      this.entries.set(asset.clothing_id, entry);
      this.group.add(entry.group);
    }
  }

  createEntry(asset) {
    const THREE = this.THREE;
    const group = new THREE.Group();
    group.name = `ClothingAsset:${asset.clothing_id}`;
    group.userData.clothingId = asset.clothing_id;
    group.userData.clothingType = asset.type;
    group.userData.rigTarget = 'simulationRig';
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(asset.material.base_color),
      roughness: asset.material.roughness,
      metalness: asset.material.metalness,
      transparent: asset.material.opacity < 1,
      opacity: asset.material.opacity,
      side: THREE.DoubleSide,
    });
    const meshes = [];
    if (asset.type === 'top') {
      meshes.push(new THREE.Mesh(new THREE.CylinderGeometry(1, .82, 1, 24, 1, false), material));
    } else if (asset.type === 'pants') {
      for (let index = 0; index < 4; index += 1) {
        meshes.push(new THREE.Mesh(new THREE.CylinderGeometry(.92, .74, 1, 16, 1, false), material));
      }
    } else {
      for (let index = 0; index < 2; index += 1) meshes.push(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material));
    }
    for (const mesh of meshes) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.renderOrder = 1;
      mesh.userData.kind = 'clothing';
      mesh.userData.clothingId = asset.clothing_id;
      group.add(mesh);
    }
    return { asset, group, meshes, material };
  }

  refresh(definition, poseWorldInput = null) {
    if (!definition || this.entries.size === 0) return;
    const poseWorld = poseWorldInput || worldPositions(definition);
    for (const entry of this.entries.values()) {
      const scale = Number(entry.asset.size_profile?.scale || 1);
      if (entry.asset.type === 'top') this.updateTop(entry, poseWorld, scale);
      else if (entry.asset.type === 'pants') this.updatePants(entry, poseWorld, scale);
      else this.updateShoes(entry, poseWorld, scale);
    }
    this.group.updateMatrixWorld(true);
  }

  updateTop(entry, points, scale) {
    const top = point(points, 'upperChest') || point(points, 'chest') || point(points, 'spine');
    const bottom = point(points, 'hips');
    if (!top || !bottom) return;
    const left = point(points, 'leftShoulder') || point(points, 'leftUpperArm');
    const right = point(points, 'rightShoulder') || point(points, 'rightUpperArm');
    const shoulderWidth = left && right ? distance(left, right) : .42;
    this.alignCylinder(entry.meshes[0], bottom, top, shoulderWidth * .63 * scale, shoulderWidth * .34 * scale, 1.02);
  }

  updatePants(entry, points, scale) {
    const pairs = [
      ['leftUpperLeg', 'leftLowerLeg'],
      ['leftLowerLeg', 'leftFoot'],
      ['rightUpperLeg', 'rightLowerLeg'],
      ['rightLowerLeg', 'rightFoot'],
    ];
    pairs.forEach(([startId, endId], index) => {
      const start = point(points, startId);
      const end = point(points, endId);
      if (!start || !end) return;
      const radius = (index % 2 === 0 ? .105 : .085) * scale;
      this.alignCylinder(entry.meshes[index], start, end, radius, radius * .82, .96);
    });
  }

  updateShoes(entry, points, scale) {
    [['leftFoot', 'leftToes'], ['rightFoot', 'rightToes']].forEach(([footId, toeId], index) => {
      const foot = point(points, footId);
      const toe = point(points, toeId) || point(points, `${toeId}End`);
      if (!foot) return;
      const end = toe || { x: foot.x, y: foot.y, z: foot.z + .2 };
      this.alignBoxAlongZ(entry.meshes[index], foot, end, scale);
    });
  }

  alignCylinder(mesh, start, end, radiusX, radiusZ, lengthFactor = 1) {
    this.tempA.set(start.x, start.y, start.z);
    this.tempB.set(end.x, end.y, end.z);
    this.tempDirection.subVectors(this.tempB, this.tempA);
    const length = Math.max(.01, this.tempDirection.length() * lengthFactor);
    mesh.position.copy(this.tempA).add(this.tempB).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(this.yAxis, this.tempDirection.normalize());
    mesh.scale.set(radiusX, length, radiusZ);
    mesh.visible = true;
  }

  alignBoxAlongZ(mesh, start, end, scale) {
    this.tempA.set(start.x, start.y, start.z);
    this.tempB.set(end.x, end.y, end.z);
    this.tempDirection.subVectors(this.tempB, this.tempA);
    const length = Math.max(.16, this.tempDirection.length() + .09) * scale;
    mesh.position.copy(this.tempA).add(this.tempB).multiplyScalar(.5);
    mesh.position.y += .01;
    mesh.quaternion.setFromUnitVectors(this.zAxis, this.tempDirection.lengthSq() > 1e-8 ? this.tempDirection.normalize() : this.zAxis);
    mesh.scale.set(.13 * scale, .075 * scale, length);
    mesh.visible = true;
  }

  getDiagnostics() {
    return {
      owner: 'clothing-system',
      independentFromSkin: true,
      binding: 'simulationRig',
      phase: 'static-clothing',
      profileId: this.profile?.clothing_profile_id || null,
      assets: [...this.entries.keys()],
    };
  }

  clear() {
    for (const entry of this.entries.values()) {
      entry.group.removeFromParent();
      for (const mesh of entry.meshes) mesh.geometry?.dispose?.();
      entry.material?.dispose?.();
    }
    this.entries.clear();
  }

  dispose() {
    this.clear();
    this.group.removeFromParent();
  }
}

function normalizeProfile(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    clothing_profile_id: String(source.clothing_profile_id || 'clothing_profile_001'),
    version: Math.max(1, Number(source.version || 1)),
    assets: Array.isArray(source.assets) ? structuredClone(source.assets) : [],
  };
}

function point(points, id) {
  if (points instanceof Map) return points.get(id) || null;
  return points?.[id] || null;
}

function distance(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
}

function worldPositions(definition) {
  const result = new Map();
  for (const joint of definition.joints || []) {
    const position = joint.poseWorldPosition || joint.bindWorldPosition;
    if (position) result.set(joint.id, position);
  }
  return result;
}
