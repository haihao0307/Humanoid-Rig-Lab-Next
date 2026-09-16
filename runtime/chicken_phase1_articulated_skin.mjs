const EPSILON = 1e-8;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const sat = (value) => clamp(value, 0, 1);
const ss = (a, b, value) => {
  const t = sat((value - a) / (b - a || 1));
  return t * t * (3 - 2 * t);
};

export const CHICKEN_PHASE1_BONE_ORDER = Object.freeze([
  'body_root',
  'pelvis',
  'chest',
  'neck_c0',
  'neck_c1',
  'head',
  'wing_l',
  'wing_r',
  'hip_l',
  'knee_l',
  'ankle_l',
  'toe_l',
  'hip_r',
  'knee_r',
  'ankle_r',
  'toe_r',
  'tail'
]);

export const CHICKEN_PHASE1_BIND_WORLD = Object.freeze({
  body_root: Object.freeze([-0.08, 0.39, 0.09]),
  pelvis: Object.freeze([-0.08, 0.39, 0.09]),
  chest: Object.freeze([0.10, 0.58, 0.09]),
  neck_c0: Object.freeze([0.22, 0.72, 0.09]),
  neck_c1: Object.freeze([0.30, 0.84, 0.09]),
  head: Object.freeze([0.39, 0.93, 0.09]),
  wing_l: Object.freeze([-0.02, 0.57, 0.185]),
  wing_r: Object.freeze([-0.02, 0.57, -0.005]),
  hip_l: Object.freeze([-0.035, 0.33, 0.14]),
  knee_l: Object.freeze([-0.025, 0.17, 0.14]),
  ankle_l: Object.freeze([0.00, 0.050, 0.14]),
  toe_l: Object.freeze([0.080, 0.018, 0.14]),
  hip_r: Object.freeze([-0.035, 0.33, 0.04]),
  knee_r: Object.freeze([-0.025, 0.17, 0.04]),
  ankle_r: Object.freeze([0.00, 0.050, 0.04]),
  toe_r: Object.freeze([0.080, 0.018, 0.04]),
  tail: Object.freeze([-0.31, 0.53, 0.09])
});

const PARENT = Object.freeze({
  body_root: null,
  pelvis: 'body_root',
  chest: 'pelvis',
  neck_c0: 'chest',
  neck_c1: 'neck_c0',
  head: 'neck_c1',
  wing_l: 'chest',
  wing_r: 'chest',
  hip_l: 'pelvis',
  knee_l: 'hip_l',
  ankle_l: 'knee_l',
  toe_l: 'ankle_l',
  hip_r: 'pelvis',
  knee_r: 'hip_r',
  ankle_r: 'knee_r',
  toe_r: 'ankle_r',
  tail: 'pelvis'
});

function addWeight(bucket, index, weight) {
  if (Number.isInteger(index) && weight > EPSILON) bucket.push([index, weight]);
}

function packWeights(bucket) {
  bucket.sort((a, b) => b[1] - a[1]);
  const selected = bucket.slice(0, 4);
  let total = selected.reduce((sum, value) => sum + value[1], 0);
  if (total < EPSILON) {
    selected.length = 0;
    selected.push([0, 1]);
    total = 1;
  }
  const indices = [0, 0, 0, 0];
  const weights = [0, 0, 0, 0];
  for (let i = 0; i < selected.length; i++) {
    indices[i] = selected[i][0];
    weights[i] = selected[i][1] / total;
  }
  return { indices, weights };
}

function feetWeights(x, z, vertexKind, localCoord, centerZ, index) {
  const side = z >= centerZ ? 'l' : 'r';
  const hip = index[`hip_${side}`];
  const knee = index[`knee_${side}`];
  const ankle = index[`ankle_${side}`];
  const toe = index[`toe_${side}`];
  const bucket = [];

  // kind 3 is the generated tarsometatarsus tube. Its localCoord.x is the
  // longitudinal parameter from the upper attachment (0) to the ankle (1).
  // Limit every cross-section to two adjacent bones; the previous four-bone
  // height blend sheared the tube into a broad triangular sheet.
  if (vertexKind === 3) {
    const s = sat(localCoord?.[0] ?? 0.5);
    if (s <= 0.46) {
      const kneeWeight = ss(0.04, 0.42, s);
      addWeight(bucket, hip, 1 - kneeWeight);
      addWeight(bucket, knee, kneeWeight);
    } else {
      const ankleWeight = ss(0.52, 0.94, s);
      addWeight(bucket, knee, 1 - ankleWeight);
      addWeight(bucket, ankle, ankleWeight);
    }
    return packWeights(bucket);
  }

  // kind 4 contains the metatarsal pad, digits and plantar pads. Keep roots on
  // the ankle and move the distal portions with the toe controller. This is a
  // deliberately rigid Phase-1 split rather than a high-cost per-digit rig.
  if (vertexKind === 4) {
    const longitudinal = sat(localCoord?.[0] ?? 0.5);
    const distanceGate = ss(0.016, 0.070, Math.abs(x));
    const toeWeight = clamp(Math.max(distanceGate, longitudinal * 0.82), 0, 0.96);
    addWeight(bucket, ankle, 1 - toeWeight);
    addWeight(bucket, toe, toeWeight);
    return packWeights(bucket);
  }

  // kind 5 is claw geometry. A rigid toe assignment avoids stretching the
  // narrow claw tubes between the ankle and toe transforms.
  if (vertexKind === 5) {
    addWeight(bucket, toe, 1);
    return packWeights(bucket);
  }

  return null;
}

function neckFloor(x) {
  if (x <= 0.14) return 0.52;
  if (x <= 0.24) return 0.52 + (x - 0.14) * 0.90;
  if (x <= 0.33) return 0.61 + (x - 0.24) * 1.22;
  if (x <= 0.41) return 0.72 + (x - 0.33) * 1.38;
  return 0.83;
}

export function computeChickenPhase1VertexWeights(
  x,
  y,
  z,
  materialKind = 'body',
  options = {}
) {
  const centerZ = options.centerZ ?? 0.09;
  const index = options.boneIndex || Object.fromEntries(
    CHICKEN_PHASE1_BONE_ORDER.map((id, boneIndex) => [id, boneIndex])
  );
  const vertexKind = Number.isFinite(options.vertexKind) ? Math.round(options.vertexKind) : null;
  const localCoord = options.localCoord || null;
  const bucket = [];

  // Small facial and comb meshes follow the head rigidly. The body carrier is
  // intentionally excluded here; treating every upper-front body vertex as a
  // rigid head was the main cause of the R10.0 peck fold.
  if (['comb', 'iris', 'nostril', 'lid'].includes(materialKind)) {
    addWeight(bucket, index.head, 1);
    return packWeights(bucket);
  }
  if (materialKind === 'parts' && x > 0.30 && y > 0.76 && vertexKind !== 3 && vertexKind !== 4 && vertexKind !== 5) {
    addWeight(bucket, index.head, 1);
    return packWeights(bucket);
  }

  if (materialKind === 'parts' && vertexKind !== null) {
    const generatedFoot = feetWeights(x, z, vertexKind, localCoord, centerZ, index);
    if (generatedFoot) return generatedFoot;
  }

  // Fallback for a legacy low part without an explicit kind attribute.
  if (y < 0.37 && (materialKind === 'parts' || materialKind === 'body')) {
    const side = z >= centerZ ? 'l' : 'r';
    const hip = index[`hip_${side}`];
    const knee = index[`knee_${side}`];
    const ankle = index[`ankle_${side}`];
    const toe = index[`toe_${side}`];
    if (y > 0.22) {
      const kneeWeight = ss(0.22, 0.34, 0.34 - y);
      addWeight(bucket, hip, 1 - kneeWeight);
      addWeight(bucket, knee, kneeWeight);
    } else if (y > 0.075) {
      const ankleWeight = ss(0.09, 0.22, 0.22 - y);
      addWeight(bucket, knee, 1 - ankleWeight);
      addWeight(bucket, ankle, ankleWeight);
    } else {
      const toeWeight = ss(0.018, 0.075, Math.abs(x));
      addWeight(bucket, ankle, 1 - toeWeight);
      addWeight(bucket, toe, toeWeight);
    }
    return packWeights(bucket);
  }

  if (materialKind === 'feather') {
    const tailWeight = 1 - ss(-0.28, -0.10, x);
    if (tailWeight > 0.35) {
      addWeight(bucket, index.tail, 0.90 * tailWeight);
      addWeight(bucket, index.pelvis, 0.10 + 0.10 * (1 - tailWeight));
      return packWeights(bucket);
    }
    const side = z >= centerZ ? 'l' : 'r';
    const wing = index[`wing_${side}`];
    const lateral = ss(0.025, 0.095, Math.abs(z - centerZ));
    const wingDomain = ss(-0.24, -0.08, x)
      * (1 - ss(0.16, 0.28, x))
      * ss(0.36, 0.50, y)
      * (1 - ss(0.72, 0.84, y));
    const wingWeight = lateral * wingDomain;
    if (wingWeight > 0.12) {
      addWeight(bucket, wing, 0.82 + 0.16 * wingWeight);
      addWeight(bucket, index.chest, 0.18 - 0.10 * wingWeight);
      return packWeights(bucket);
    }
  }

  const floor = neckFloor(x);
  const upperGate = ss(floor, floor + 0.075, y);
  const headGate = ss(Math.max(0.79, floor + 0.015), Math.max(0.87, floor + 0.095), y);
  const head = ss(0.325, 0.405, x) * headGate;
  const neck1 = ss(0.245, 0.335, x)
    * (1 - ss(0.405, 0.445, x))
    * upperGate
    * (1 - head * 0.78);
  const neck0 = ss(0.135, 0.245, x)
    * (1 - ss(0.325, 0.375, x))
    * ss(floor - 0.025, floor + 0.060, y)
    * (1 - head * 0.84)
    * (1 - neck1 * 0.52);
  const tail = (1 - ss(-0.30, -0.11, x)) * ss(0.34, 0.61, y);
  const chest = ss(-0.10, 0.16, x)
    * ss(0.41, 0.69, y)
    * (1 - neck0 * 0.62)
    * (1 - upperGate * 0.90);
  const pelvis = Math.max(0.06, 1 - head - neck1 - neck0 - tail * 0.72 - chest * 0.62);

  addWeight(bucket, index.head, head);
  addWeight(bucket, index.neck_c1, neck1);
  addWeight(bucket, index.neck_c0, neck0);
  addWeight(bucket, index.tail, tail * 0.82);
  addWeight(bucket, index.chest, chest);
  addWeight(bucket, index.pelvis, pelvis);
  return packWeights(bucket);
}

export function computeChickenPhase1SkinAttributes(positionArray, materialKind = 'body', options = {}) {
  if (!positionArray || positionArray.length % 3 !== 0) {
    throw new Error('positionArray must contain xyz triples');
  }
  const count = positionArray.length / 3;
  const indices = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);
  const vertexKinds = options.vertexKinds || null;
  const localCoords = options.localCoords || null;
  const primaryCounts = new Uint32Array(CHICKEN_PHASE1_BONE_ORDER.length);

  for (let i = 0; i < count; i++) {
    const q = i * 3;
    const out = i * 4;
    const localCoord = localCoords
      ? [localCoords[q], localCoords[q + 1], localCoords[q + 2]]
      : null;
    const packed = computeChickenPhase1VertexWeights(
      positionArray[q],
      positionArray[q + 1],
      positionArray[q + 2],
      materialKind,
      {
        ...options,
        vertexKind: vertexKinds ? vertexKinds[i] : null,
        localCoord
      }
    );
    for (let k = 0; k < 4; k++) {
      indices[out + k] = packed.indices[k];
      weights[out + k] = packed.weights[k];
    }
    primaryCounts[packed.indices[0]] += 1;
  }
  return { indices, weights, count, primaryCounts };
}

function requireThree(THREE) {
  for (const name of [
    'Bone',
    'Skeleton',
    'SkinnedMesh',
    'Uint16BufferAttribute',
    'Float32BufferAttribute',
    'Quaternion',
    'Vector3'
  ]) {
    if (!THREE?.[name]) throw new Error(`THREE.${name} is required`);
  }
}

function clone3(value) {
  return [value[0], value[1], value[2]];
}

function setAxisAngle(THREE, axis, angle) {
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis), angle);
}

function classifyPrimaryCounts(primaryCounts) {
  const result = {};
  for (let i = 0; i < primaryCounts.length; i++) {
    if (primaryCounts[i]) result[CHICKEN_PHASE1_BONE_ORDER[i]] = primaryCounts[i];
  }
  return result;
}

export function createChickenPhase1ArticulatedSkin(THREE, group, meshes, options = {}) {
  requireThree(THREE);
  if (!group || !Array.isArray(meshes)) throw new Error('group and meshes are required');

  const bindWorld = options.bindWorld || CHICKEN_PHASE1_BIND_WORLD;
  const boneIndex = Object.fromEntries(CHICKEN_PHASE1_BONE_ORDER.map((id, i) => [id, i]));
  const bones = {};
  const bindLocal = {};
  const bindQuaternion = {};
  const bindScale = {};

  for (const id of CHICKEN_PHASE1_BONE_ORDER) {
    const bone = new THREE.Bone();
    bone.name = id;
    bones[id] = bone;
  }
  for (const id of CHICKEN_PHASE1_BONE_ORDER) {
    const parentId = PARENT[id];
    const world = bindWorld[id];
    const parentWorld = parentId ? bindWorld[parentId] : [0, 0, 0];
    bones[id].position.set(
      world[0] - parentWorld[0],
      world[1] - parentWorld[1],
      world[2] - parentWorld[2]
    );
    if (parentId) bones[parentId].add(bones[id]);
  }

  group.add(bones.body_root);
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(CHICKEN_PHASE1_BONE_ORDER.map((id) => bones[id]));
  skeleton.calculateInverses();

  for (const id of CHICKEN_PHASE1_BONE_ORDER) {
    bindLocal[id] = bones[id].position.clone();
    bindQuaternion[id] = bones[id].quaternion.clone();
    bindScale[id] = bones[id].scale.clone();
  }

  const converted = [];
  const meshAudits = [];
  for (let i = 0; i < meshes.length; i++) {
    const original = meshes[i];
    if (!original?.geometry?.attributes?.position || original.isSkinnedMesh) {
      converted.push(original);
      continue;
    }
    const kind = original.userData?.materialKind || 'body';
    const positions = original.geometry.attributes.position.array;
    const vertexKinds = original.geometry.attributes.kind?.array || null;
    const localCoords = original.geometry.attributes.localCoord?.array || null;
    const attrs = computeChickenPhase1SkinAttributes(positions, kind, {
      centerZ: options.centerZ ?? 0.09,
      boneIndex,
      vertexKinds,
      localCoords
    });
    original.geometry.setAttribute(
      'skinIndex',
      new THREE.Uint16BufferAttribute(attrs.indices, 4)
    );
    original.geometry.setAttribute(
      'skinWeight',
      new THREE.Float32BufferAttribute(attrs.weights, 4)
    );

    const skinned = new THREE.SkinnedMesh(original.geometry, original.material);
    skinned.name = original.name || `chicken_${kind}_${i}`;
    skinned.position.copy(original.position);
    skinned.quaternion.copy(original.quaternion);
    skinned.scale.copy(original.scale);
    skinned.visible = original.visible;
    skinned.renderOrder = original.renderOrder;
    skinned.frustumCulled = original.frustumCulled;
    skinned.userData = { ...original.userData, phase1Skinned: true };
    group.remove(original);
    group.add(skinned);
    skinned.bind(skeleton);
    meshes[i] = skinned;
    converted.push(skinned);
    meshAudits.push(Object.freeze({
      meshIndex: i,
      materialKind: kind,
      vertexCount: attrs.count,
      hasVertexKind: Boolean(vertexKinds),
      hasLocalCoord: Boolean(localCoords),
      primaryBoneCounts: Object.freeze(classifyPrimaryCounts(attrs.primaryCounts))
    }));
  }

  const rootOrigin = clone3(options.rootOrigin || [0, 0, 0]);
  const rootScale = options.rootMotionScale ?? 0.42;
  let applyCount = 0;
  let lastPose = null;
  let lastReport = null;
  let lastAppliedAngles = null;

  function resetRotations() {
    for (const id of CHICKEN_PHASE1_BONE_ORDER) {
      bones[id].quaternion.copy(bindQuaternion[id]);
      bones[id].scale.copy(bindScale[id]);
      if (id !== 'body_root') bones[id].position.copy(bindLocal[id]);
    }
  }

  function rotate(id, pitch = 0, yaw = 0, roll = 0) {
    const bone = bones[id];
    bone.quaternion.copy(bindQuaternion[id]);
    const qYaw = setAxisAngle(THREE, [0, 1, 0], yaw);
    const qPitch = setAxisAngle(THREE, [0, 0, 1], pitch);
    const qRoll = setAxisAngle(THREE, [1, 0, 0], roll);
    bone.quaternion.multiply(qYaw).multiply(qPitch).multiply(qRoll);
  }

  function mapPoseAngles(pose) {
    const peck = pose.state === 'peck';
    const neckPitch = clamp(pose.neck.pitch, peck ? -0.72 : -0.58, 0.52);
    const headPitch = clamp(pose.head.pitch, peck ? -0.32 : -0.28, 0.36);
    const legGain = pose.state === 'short_run'
      ? { hip: 0.48, knee: 0.30, ankle: 0.26 }
      : { hip: 0.54, knee: 0.34, ankle: 0.28 };
    return {
      pelvisPitch: pose.body.pitch * (peck ? 0.28 : 0.42),
      chestPitch: pose.body.pitch * (peck ? 0.42 : 0.52),
      bodyRoll: clamp(pose.body.roll, -0.22, 0.22),
      neck0Pitch: neckPitch * (peck ? 0.38 : 0.46),
      neck1Pitch: neckPitch * (peck ? 0.31 : 0.38),
      neck0Yaw: pose.neck.yaw * 0.42,
      neck1Yaw: pose.neck.yaw * 0.50,
      headPitch: headPitch * (peck ? 0.42 : 0.68),
      headYaw: pose.head.yaw * 0.72,
      hipLeft: clamp(pose.legs.left.hipPitch * legGain.hip, -0.38, 0.38),
      kneeLeft: clamp(pose.legs.left.kneePitch * legGain.knee, -0.10, 0.34),
      ankleLeft: clamp(pose.legs.left.footPitch * legGain.ankle, -0.24, 0.24),
      hipRight: clamp(pose.legs.right.hipPitch * legGain.hip, -0.38, 0.38),
      kneeRight: clamp(pose.legs.right.kneePitch * legGain.knee, -0.10, 0.34),
      ankleRight: clamp(pose.legs.right.footPitch * legGain.ankle, -0.24, 0.24),
      wingLeft: clamp(pose.wings.leftOpen, 0, 1) * -0.62,
      wingRight: clamp(pose.wings.rightOpen, 0, 1) * 0.62
    };
  }

  function applyPose(pose) {
    if (!pose?.root || !pose?.body || !pose?.neck || !pose?.head || !pose?.legs || !pose?.wings) {
      throw new Error('invalid chicken pose');
    }
    resetRotations();
    const root = bones.body_root;
    const base = bindLocal.body_root;
    root.position.set(
      base.x + (pose.root.position[0] - rootOrigin[0]) * rootScale,
      base.y + (pose.root.position[1] - rootOrigin[1]) + clamp(pose.body.yOffset, -0.025, 0.025),
      base.z + (pose.root.position[2] - rootOrigin[2]) * rootScale
    );

    const angles = mapPoseAngles(pose);
    rotate('body_root', 0, pose.root.yaw, 0);
    rotate('pelvis', angles.pelvisPitch, 0, angles.bodyRoll * 0.38);
    rotate('chest', angles.chestPitch, 0, angles.bodyRoll * 0.54);
    rotate('neck_c0', angles.neck0Pitch, angles.neck0Yaw, 0);
    rotate('neck_c1', angles.neck1Pitch, angles.neck1Yaw, 0);
    rotate('head', angles.headPitch, angles.headYaw, 0);
    rotate('hip_l', angles.hipLeft, 0, 0);
    rotate('knee_l', angles.kneeLeft, 0, 0);
    rotate('ankle_l', angles.ankleLeft, 0, 0);
    rotate('toe_l', -angles.ankleLeft * 0.34, 0, 0);
    rotate('hip_r', angles.hipRight, 0, 0);
    rotate('knee_r', angles.kneeRight, 0, 0);
    rotate('ankle_r', angles.ankleRight, 0, 0);
    rotate('toe_r', -angles.ankleRight * 0.34, 0, 0);
    rotate('wing_l', 0, 0, angles.wingLeft);
    rotate('wing_r', 0, 0, angles.wingRight);
    rotate('tail', 0, 0, clamp(-pose.body.roll * 0.28, -0.06, 0.06));

    group.updateMatrixWorld(true);
    skeleton.update();
    applyCount += 1;
    lastPose = pose;
    lastAppliedAngles = angles;
    lastReport = verifyInvariants();
    return {
      applied: true,
      applyCount,
      state: pose.state,
      contacts: { ...pose.contacts },
      appliedAngles: { ...angles },
      invariantReport: lastReport
    };
  }

  function verifyInvariants() {
    const violations = [];
    for (const id of CHICKEN_PHASE1_BONE_ORDER) {
      const bone = bones[id];
      const bindPosition = bindLocal[id];
      const bindBoneScale = bindScale[id];
      if (id !== 'body_root' && bone.position.distanceTo(bindPosition) > 1e-7) {
        violations.push({ type: 'bone_length_or_local_position_changed', joint: id });
      }
      if (bone.scale.distanceTo(bindBoneScale) > 1e-7) {
        violations.push({ type: 'bone_scale_changed', joint: id });
      }
      const quaternionLength = Math.hypot(
        bone.quaternion.x,
        bone.quaternion.y,
        bone.quaternion.z,
        bone.quaternion.w
      );
      if (!Number.isFinite(quaternionLength) || Math.abs(quaternionLength - 1) > 1e-6) {
        violations.push({ type: 'invalid_quaternion', joint: id, length: quaternionLength });
      }
    }
    return { passed: violations.length === 0, violations };
  }

  function detach() {
    if (bones.body_root.parent) bones.body_root.parent.remove(bones.body_root);
  }

  function diagnostics() {
    return {
      schema: 'life_ecosystem/chicken_phase1_articulated_skin_diagnostics@1.1',
      boneCount: CHICKEN_PHASE1_BONE_ORDER.length,
      skinnedMeshCount: converted.filter((value) => value?.isSkinnedMesh).length,
      applyCount,
      lastState: lastPose?.state ?? null,
      lastContacts: lastPose?.contacts ? { ...lastPose.contacts } : null,
      lastAppliedAngles: lastAppliedAngles ? { ...lastAppliedAngles } : null,
      lastInvariantReport: lastReport,
      rootMotionScale: rootScale,
      weightingRevision: 'component-aware-feet-and-profile-aware-neck-v2',
      meshAudits
    };
  }

  return Object.freeze({
    bones,
    skeleton,
    meshes: converted,
    applyPose,
    verifyInvariants,
    detach,
    diagnostics,
    rootOrigin: Object.freeze([...rootOrigin])
  });
}
