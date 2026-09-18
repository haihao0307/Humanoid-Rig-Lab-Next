import {
  computeChickenPhase1NeckSectorGate,
  computeChickenPhase1TorsoWeights,
  createChickenPhase1Pchip,
  createChickenPhase1ArcLengthMap
} from './chicken_phase1_centerline_sweep_adapter.mjs';
import { computeChickenPhase1CoatRootAnchors } from './chicken_phase1_ring_coherent_adapter.mjs';

const EPSILON = 1e-8;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const sat = (value) => clamp(value, 0, 1);
const smooth = (a, b, value) => {
  const t = sat((value - a) / (b - a || 1));
  return t * t * (3 - 2 * t);
};

export const CHICKEN_PHASE1_SEGMENTED_NECK_REVISION = 'segmented-rigid-head-and-buried-root-neck-v8-2';
export const CHICKEN_PHASE1_SEGMENTED_TOPOLOGY_REVISION = 'torso-buried-neck-rigid-head-v8-2';
export const CHICKEN_PHASE1_SEGMENTED_CURVE_REVISION = 'bone-centerline-parallel-transport-with-buried-root-v4';
export const CHICKEN_PHASE1_SEGMENTED_COAT_REVISION = 'root-rigid-single-bone-coat-v8-2';

const NECK_BONES = Object.freeze([
  'neck_base',
  'neck_c0',
  'neck_c1',
  'neck_c2',
  'neck_c3',
  'head_base'
]);

const PROFILE_KEYS = Object.freeze([
  Object.freeze({ s: 0.00, normal: 0.120, lateral: 0.095, ventral: 0.82 }),
  Object.freeze({ s: 0.12, normal: 0.108, lateral: 0.084, ventral: 0.82 }),
  Object.freeze({ s: 0.28, normal: 0.084, lateral: 0.066, ventral: 0.83 }),
  Object.freeze({ s: 0.48, normal: 0.065, lateral: 0.051, ventral: 0.85 }),
  Object.freeze({ s: 0.68, normal: 0.056, lateral: 0.044, ventral: 0.87 }),
  Object.freeze({ s: 0.84, normal: 0.052, lateral: 0.040, ventral: 0.89 }),
  Object.freeze({ s: 1.00, normal: 0.050, lateral: 0.038, ventral: 0.90 })
]);

function requireThree(THREE) {
  for (const name of [
    'Bone',
    'BufferGeometry',
    'SkinnedMesh',
    'Float32BufferAttribute',
    'Uint16BufferAttribute',
    'Uint32BufferAttribute',
    'Quaternion',
    'Vector3',
    'Matrix4'
  ]) {
    if (!THREE?.[name]) throw new Error(`THREE.${name} is required`);
  }
}

export function prependChickenPhase1BuriedNeckRoot(points, burial = 0.09) {
  if (!Array.isArray(points) || points.length < 2) {
    throw new Error('at least two cervical control points are required');
  }
  const first = points[0];
  const second = points[1];
  const dx = second[0] - first[0];
  const dy = second[1] - first[1];
  const dz = second[2] - first[2];
  const length = Math.hypot(dx, dy, dz);
  if (length <= EPSILON) throw new Error('cervical root direction is degenerate');
  const distance = Math.max(0, Number(burial) || 0);
  const root = Object.freeze([
    first[0] - dx / length * distance,
    first[1] - dy / length * distance,
    first[2] - dz / length * distance
  ]);
  return Object.freeze([root, ...points.map((point) => Object.freeze([...point]))]);
}

export function sampleChickenPhase1SegmentedNeckProfile(s) {
  if (s <= PROFILE_KEYS[0].s) return PROFILE_KEYS[0];
  const last = PROFILE_KEYS.length - 1;
  if (s >= PROFILE_KEYS[last].s) return PROFILE_KEYS[last];
  for (let index = 0; index < last; index++) {
    const a = PROFILE_KEYS[index];
    const b = PROFILE_KEYS[index + 1];
    if (s > b.s) continue;
    const t = smooth(a.s, b.s, s);
    return {
      s,
      normal: a.normal + (b.normal - a.normal) * t,
      lateral: a.lateral + (b.lateral - a.lateral) * t,
      ventral: a.ventral + (b.ventral - a.ventral) * t
    };
  }
  return PROFILE_KEYS[last];
}

function triangleMeanX(positionArray, a, b, c) {
  return (
    positionArray[a * 3]
    + positionArray[b * 3]
    + positionArray[c * 3]
  ) / 3;
}

export function splitChickenPhase1BodyDomains(positionArray, indexArray, options = {}) {
  const headStartX = options.headStartX ?? 0.392;
  const torsoPreserveBeforeX = options.torsoPreserveBeforeX ?? 0.085;
  const torsoGateLimit = options.torsoGateLimit ?? 0.70;
  const torso = [];
  const head = [];

  for (let offset = 0; offset < indexArray.length; offset += 3) {
    const a = indexArray[offset];
    const b = indexArray[offset + 1];
    const c = indexArray[offset + 2];
    const ids = [a, b, c];
    const meanX = triangleMeanX(positionArray, a, b, c);
    let maxGate = 0;
    let minX = Infinity;
    for (const id of ids) {
      const q = id * 3;
      minX = Math.min(minX, positionArray[q]);
      maxGate = Math.max(maxGate, computeChickenPhase1NeckSectorGate(
        positionArray[q],
        positionArray[q + 1]
      ));
    }

    if (meanX >= headStartX || minX >= headStartX - 0.010) {
      head.push(a, b, c);
      continue;
    }
    if (meanX < torsoPreserveBeforeX || maxGate < torsoGateLimit) {
      torso.push(a, b, c);
    }
  }

  return Object.freeze({
    torsoIndices: new Uint32Array(torso),
    headIndices: new Uint32Array(head),
    headStartX,
    torsoPreserveBeforeX,
    torsoGateLimit
  });
}

function setTwoBoneTorsoWeights(THREE, geometry, boneIndex) {
  const position = geometry.getAttribute('position');
  const indices = new Uint16Array(position.count * 4);
  const weights = new Float32Array(position.count * 4);
  for (let vertex = 0; vertex < position.count; vertex++) {
    const blend = computeChickenPhase1TorsoWeights(position.getX(vertex));
    const offset = vertex * 4;
    indices[offset] = boneIndex.pelvis;
    indices[offset + 1] = boneIndex.chest;
    weights[offset] = blend.pelvis;
    weights[offset + 1] = blend.chest;
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
}

function setRigidWeights(THREE, geometry, boneIndex) {
  const count = geometry.getAttribute('position').count;
  const indices = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);
  for (let vertex = 0; vertex < count; vertex++) {
    const offset = vertex * 4;
    indices[offset] = boneIndex;
    weights[offset] = 1;
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
}

function chooseRigidCoatBone(x, y) {
  const gate = computeChickenPhase1NeckSectorGate(x, y);
  if (gate < 0.46) return x < -0.16 ? 'pelvis' : 'chest';
  if (x < 0.135) return 'neck_base';
  if (x < 0.195) return 'neck_c0';
  if (x < 0.255) return 'neck_c1';
  if (x < 0.315) return 'neck_c2';
  if (x < 0.360) return 'neck_c3';
  if (x < 0.402) return 'head_base';
  return 'head';
}

function setRootRigidCoatWeights(THREE, mesh, boneIndex) {
  const geometry = mesh.geometry;
  const positions = geometry.getAttribute('position').array;
  const seeds = geometry.getAttribute('seed')?.array || null;
  const uvs = geometry.getAttribute('uv')?.array || null;
  const anchors = computeChickenPhase1CoatRootAnchors(positions, seeds, uvs);
  const count = positions.length / 3;
  const indices = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);
  const counts = {};
  for (let vertex = 0; vertex < count; vertex++) {
    const id = chooseRigidCoatBone(anchors.rootX[vertex], anchors.rootY[vertex]);
    const offset = vertex * 4;
    indices[offset] = boneIndex[id];
    weights[offset] = 1;
    counts[id] = (counts[id] || 0) + 1;
  }
  const oldIndex = geometry.getAttribute('skinIndex')?.clone?.() || null;
  const oldWeight = geometry.getAttribute('skinWeight')?.clone?.() || null;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  mesh.normalizeSkinWeights();
  return Object.freeze({
    restore() {
      if (oldIndex) geometry.setAttribute('skinIndex', oldIndex);
      if (oldWeight) geometry.setAttribute('skinWeight', oldWeight);
    },
    elementCount: anchors.elementCount,
    rootRigid: anchors.rootRigid,
    primaryBoneCounts: Object.freeze({ ...counts })
  });
}

function appendIdentityHelperBone(THREE, skeleton, parent) {
  parent.updateMatrixWorld(true);
  const helper = new THREE.Bone();
  helper.name = 'segmented_neck_identity_helper';
  parent.add(helper);
  parent.updateMatrixWorld(true);
  const index = skeleton.bones.length;
  skeleton.bones.push(helper);
  skeleton.boneInverses.push(helper.matrixWorld.clone().invert());
  skeleton.boneMatrices = new Float32Array(skeleton.bones.length * 16);
  if (skeleton.boneTexture) {
    skeleton.boneTexture.dispose?.();
    skeleton.boneTexture = null;
  }
  skeleton.computeBoneTexture?.();
  return { helper, index };
}

function removeIdentityHelperBone(skeleton, helperInfo) {
  if (skeleton.bones[skeleton.bones.length - 1] !== helperInfo.helper) return;
  skeleton.bones.pop();
  skeleton.boneInverses.pop();
  skeleton.boneMatrices = new Float32Array(skeleton.bones.length * 16);
  if (skeleton.boneTexture) {
    skeleton.boneTexture.dispose?.();
    skeleton.boneTexture = null;
  }
  skeleton.computeBoneTexture?.();
}

function localBonePosition(THREE, bone, parentInverse) {
  return new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld).applyMatrix4(parentInverse);
}

function localBoneQuaternion(THREE, bone, parentQuaternionInverse) {
  const value = new THREE.Quaternion();
  bone.getWorldQuaternion(value);
  return parentQuaternionInverse.clone().multiply(value).normalize();
}

function sampleQuaternion(THREE, t, quaternions, curveParameters) {
  if (t <= curveParameters[0]) return quaternions[0].clone();
  const last = curveParameters.length - 1;
  if (t >= curveParameters[last]) return quaternions[last].clone();
  for (let index = 0; index < last; index++) {
    if (t > curveParameters[index + 1]) continue;
    const u = smooth(curveParameters[index], curveParameters[index + 1], t);
    return quaternions[index].clone().slerp(quaternions[index + 1], u).normalize();
  }
  return quaternions[last].clone();
}

export function parameterizeChickenPhase1SegmentedControlPoints(points) {
  const values = [0];
  let total = 0;
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];
    total += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    values.push(total);
  }
  const scale = total > EPSILON ? 1 / total : 1;
  return Object.freeze(values.map((value) => value * scale));
}

function makeTransportFrame(THREE, tangent, orientation, previousLateral = null) {
  const unitTangent = tangent.clone().normalize();
  let lateral = previousLateral
    ? previousLateral.clone()
    : new THREE.Vector3(0, 0, 1).applyQuaternion(orientation);
  lateral.addScaledVector(unitTangent, -lateral.dot(unitTangent));
  if (lateral.lengthSq() < 1e-8) {
    lateral.set(0, 0, 1).addScaledVector(unitTangent, -unitTangent.z);
  }
  lateral.normalize();
  const normal = new THREE.Vector3().crossVectors(lateral, unitTangent).normalize();
  return { tangent: unitTangent, normal, lateral };
}

function createTubeGeometry(THREE, ringCount, ringSize) {
  const positions = new Float32Array(ringCount * ringSize * 3);
  const normals = new Float32Array(positions.length);
  const localCoords = new Float32Array(positions.length);
  const uvs = new Float32Array(ringCount * ringSize * 2);
  const seeds = new Float32Array(ringCount * ringSize);
  const zones = new Float32Array(ringCount * ringSize);
  const kinds = new Float32Array(ringCount * ringSize);
  const indices = [];
  for (let ring = 0; ring < ringCount; ring++) {
    for (let sample = 0; sample < ringSize; sample++) {
      const vertex = ring * ringSize + sample;
      uvs[vertex * 2] = ring / Math.max(1, ringCount - 1);
      uvs[vertex * 2 + 1] = sample / ringSize;
      seeds[vertex] = (vertex * 0.61803398875) % 1;
      zones[vertex] = 1;
      kinds[vertex] = 0;
      if (ring >= ringCount - 1) continue;
      const next = (sample + 1) % ringSize;
      const a = ring * ringSize + sample;
      const b = ring * ringSize + next;
      const c = (ring + 1) * ringSize + sample;
      const d = (ring + 1) * ringSize + next;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('localCoord', new THREE.Float32BufferAttribute(localCoords, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('seed', new THREE.Float32BufferAttribute(seeds, 1));
  geometry.setAttribute('zone', new THREE.Float32BufferAttribute(zones, 1));
  geometry.setAttribute('kind', new THREE.Float32BufferAttribute(kinds, 1));
  geometry.setIndex(new THREE.Uint32BufferAttribute(new Uint32Array(indices), 1));
  return geometry;
}

function computeQuantile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}

export function createChickenPhase1SegmentedNeckAdapter(THREE, baseSkin, options = {}) {
  requireThree(THREE);
  if (!baseSkin?.bones || !baseSkin?.skeleton || !Array.isArray(baseSkin.meshes)) {
    throw new Error('an articulated chicken skin is required');
  }
  if (baseSkin.diagnostics?.().weightingRevision === CHICKEN_PHASE1_SEGMENTED_NECK_REVISION) {
    return baseSkin;
  }

  const bodyMesh = baseSkin.meshes.find((mesh) => (
    mesh?.isSkinnedMesh
    && mesh?.userData?.materialKind === 'body'
    && !mesh?.userData?.component
  ));
  if (!bodyMesh?.geometry?.index) throw new Error('indexed source body mesh is required');
  const parent = bodyMesh.parent;
  if (!parent) throw new Error('body mesh parent is required');
  const skeleton = baseSkin.skeleton;
  const bones = baseSkin.bones;
  const logicalBoneCount = skeleton.bones.length;
  const boneIndex = Object.fromEntries(skeleton.bones.map((bone, index) => [bone.name, index]));
  for (const id of ['pelvis', 'chest', 'head', ...NECK_BONES]) {
    if (!Number.isInteger(boneIndex[id]) || !bones[id]) throw new Error(`missing segmented domain bone ${id}`);
  }

  const sourceGeometry = bodyMesh.geometry;
  const sourcePositions = new Float32Array(sourceGeometry.getAttribute('position').array);
  const sourceIndices = new Uint32Array(sourceGeometry.index.array);
  const domains = splitChickenPhase1BodyDomains(sourcePositions, sourceIndices, options.domains || {});

  const torsoGeometry = sourceGeometry.clone();
  torsoGeometry.setIndex(new THREE.Uint32BufferAttribute(domains.torsoIndices, 1));
  setTwoBoneTorsoWeights(THREE, torsoGeometry, boneIndex);
  torsoGeometry.computeBoundingBox?.();
  torsoGeometry.computeBoundingSphere?.();
  bodyMesh.geometry = torsoGeometry;
  bodyMesh.bind(skeleton, bodyMesh.bindMatrix.clone());
  bodyMesh.normalizeSkinWeights();

  const headGeometry = sourceGeometry.clone();
  headGeometry.setIndex(new THREE.Uint32BufferAttribute(domains.headIndices, 1));
  setRigidWeights(THREE, headGeometry, boneIndex.head);
  headGeometry.computeBoundingBox?.();
  headGeometry.computeBoundingSphere?.();
  const headMaterial = bodyMesh.material.clone();
  const headMesh = new THREE.SkinnedMesh(headGeometry, headMaterial);
  headMesh.name = 'chicken_rigid_head_carrier_v8_2';
  headMesh.userData = {
    ...bodyMesh.userData,
    materialKind: 'body',
    component: 'rigid_head_carrier_v8_2',
    generatedBy: CHICKEN_PHASE1_SEGMENTED_NECK_REVISION
  };
  headMesh.castShadow = bodyMesh.castShadow;
  headMesh.receiveShadow = bodyMesh.receiveShadow;
  headMesh.frustumCulled = false;
  parent.add(headMesh);
  parent.updateMatrixWorld(true);
  headMesh.bind(skeleton, bodyMesh.bindMatrix.clone());
  headMesh.normalizeSkinWeights();

  const coatMesh = baseSkin.meshes.find((mesh) => mesh?.isSkinnedMesh && mesh?.userData?.materialKind === 'coat');
  const coatRestore = coatMesh ? setRootRigidCoatWeights(THREE, coatMesh, boneIndex) : null;
  if (coatMesh) coatMesh.bind(skeleton, coatMesh.bindMatrix.clone());

  const helperInfo = appendIdentityHelperBone(THREE, skeleton, parent);
  const ringCount = Math.max(18, Math.floor(options.ringCount ?? 34));
  const ringSize = Math.max(16, Math.floor(options.ringSize ?? 28));
  const tubeGeometry = createTubeGeometry(THREE, ringCount, ringSize);
  setRigidWeights(THREE, tubeGeometry, helperInfo.index);
  const tubeMaterial = bodyMesh.material.clone();
  if (typeof tubeMaterial.vertexShader === 'string') {
    tubeMaterial.vertexShader = tubeMaterial.vertexShader.replace('vRest=position;', 'vRest=localCoord;');
  }
  tubeMaterial.defines = { ...(tubeMaterial.defines || {}), USE_SKINNING: '' };
  tubeMaterial.needsUpdate = true;
  const tubeMesh = new THREE.SkinnedMesh(tubeGeometry, tubeMaterial);
  tubeMesh.name = 'chicken_neck_tube_v8_2';
  tubeMesh.userData = {
    ...bodyMesh.userData,
    materialKind: 'body',
    component: 'buried_root_swept_neck_tube_v8_2',
    generatedBy: CHICKEN_PHASE1_SEGMENTED_NECK_REVISION
  };
  tubeMesh.castShadow = bodyMesh.castShadow;
  tubeMesh.receiveShadow = bodyMesh.receiveShadow;
  tubeMesh.frustumCulled = false;
  parent.add(tubeMesh);
  parent.updateMatrixWorld(true);
  tubeMesh.bind(skeleton, bodyMesh.bindMatrix.clone());

  const outputPosition = tubeGeometry.getAttribute('position');
  const localCoord = tubeGeometry.getAttribute('localCoord');
  const bindLongitudinal = [];
  let bindCurveLength = null;
  let applyCount = 0;
  let lastPose = null;
  let lastFrameAudit = null;

  const rootBurial = Math.max(0.04, Number(options.rootBurial ?? 0.09));
  const readControlState = () => {
    parent.updateMatrixWorld(true);
    const parentInverse = parent.matrixWorld.clone().invert();
    const parentQuaternion = new THREE.Quaternion();
    parent.getWorldQuaternion(parentQuaternion);
    const parentQuaternionInverse = parentQuaternion.clone().invert();
    const cervicalPoints = NECK_BONES.map((id) => (
      localBonePosition(THREE, bones[id], parentInverse).toArray()
    ));
    const cervicalQuaternions = NECK_BONES.map((id) => (
      localBoneQuaternion(THREE, bones[id], parentQuaternionInverse)
    ));
    return {
      points: prependChickenPhase1BuriedNeckRoot(cervicalPoints, rootBurial),
      quaternions: [cervicalQuaternions[0].clone(), ...cervicalQuaternions]
    };
  };
  const bindControlState = readControlState();
  const curveParameters = parameterizeChickenPhase1SegmentedControlPoints(bindControlState.points);

  function updateTube(recordBind = false) {
    const state = readControlState();
    const curve = createChickenPhase1Pchip(curveParameters, state.points);
    const arc = createChickenPhase1ArcLengthMap(curve, 0, 1, options.arcSamples ?? 320);
    let previousLateral = null;
    const centers = [];
    const frames = [];
    for (let ring = 0; ring < ringCount; ring++) {
      const fraction = ring / Math.max(1, ringCount - 1);
      const t = arc.xAtFraction(fraction);
      const center = new THREE.Vector3(...curve.evaluate(t));
      const tangent = new THREE.Vector3(...curve.derivative(t));
      const orientation = sampleQuaternion(THREE, t, state.quaternions, curveParameters);
      const frame = makeTransportFrame(THREE, tangent, orientation, previousLateral);
      previousLateral = frame.lateral.clone();
      centers.push(center);
      frames.push(frame);
      const profile = sampleChickenPhase1SegmentedNeckProfile(fraction);
      for (let sample = 0; sample < ringSize; sample++) {
        const theta = 2 * Math.PI * sample / ringSize;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        const normalRadius = profile.normal * (cos < 0 ? profile.ventral : 1);
        const point = center.clone()
          .addScaledVector(frame.normal, normalRadius * cos)
          .addScaledVector(frame.lateral, profile.lateral * sin);
        const vertex = ring * ringSize + sample;
        outputPosition.setXYZ(vertex, point.x, point.y, point.z);
        if (recordBind) localCoord.setXYZ(vertex, point.x, point.y, point.z);
      }
    }

    const currentLongitudinal = [];
    for (let ring = 1; ring < ringCount; ring++) {
      for (let sample = 0; sample < ringSize; sample++) {
        const previousVertex = (ring - 1) * ringSize + sample;
        const vertex = ring * ringSize + sample;
        const dx = outputPosition.getX(vertex) - outputPosition.getX(previousVertex);
        const dy = outputPosition.getY(vertex) - outputPosition.getY(previousVertex);
        const dz = outputPosition.getZ(vertex) - outputPosition.getZ(previousVertex);
        currentLongitudinal.push(Math.hypot(dx, dy, dz));
      }
    }
    if (recordBind) {
      bindLongitudinal.splice(0, bindLongitudinal.length, ...currentLongitudinal);
      bindCurveLength = arc.totalLength;
    }
    const ratios = currentLongitudinal.map((value, index) => (
      value / Math.max(EPSILON, bindLongitudinal[index] ?? value)
    ));
    outputPosition.needsUpdate = true;
    if (recordBind) localCoord.needsUpdate = true;
    tubeGeometry.computeVertexNormals();
    tubeGeometry.getAttribute('normal').needsUpdate = true;
    tubeGeometry.computeBoundingBox();
    tubeGeometry.computeBoundingSphere();
    lastFrameAudit = Object.freeze({
      ringCount,
      ringSize,
      bindCurveLength: bindCurveLength ?? arc.totalLength,
      poseCurveLength: arc.totalLength,
      curveLengthRatio: arc.totalLength / Math.max(EPSILON, bindCurveLength ?? arc.totalLength),
      longitudinalRatioMin: ratios.length ? Math.min(...ratios) : 1,
      longitudinalRatioMedian: computeQuantile(ratios, 0.5) ?? 1,
      longitudinalRatioP95: computeQuantile(ratios, 0.95) ?? 1,
      longitudinalRatioMax: ratios.length ? Math.max(...ratios) : 1,
      ringAreaRatioMin: 1,
      ringAreaRatioMax: 1,
      startCenter: centers[0]?.toArray() || null,
      endCenter: centers.at(-1)?.toArray() || null
    });
  }

  updateTube(true);

  function applyPose(pose) {
    const result = baseSkin.applyPose(pose);
    updateTube(false);
    skeleton.update();
    applyCount++;
    lastPose = pose;
    return {
      ...result,
      segmentedNeckApplied: true,
      segmentedNeckRevision: CHICKEN_PHASE1_SEGMENTED_NECK_REVISION,
      segmentedFrameAudit: lastFrameAudit
    };
  }

  function diagnostics() {
    const base = baseSkin.diagnostics();
    return {
      ...base,
      schema: 'life_ecosystem/chicken_phase1_articulated_skin_diagnostics@1.5',
      boneCount: base.boneCount ?? logicalBoneCount,
      logicalBoneCount,
      skeletonBoneCount: skeleton.bones.length,
      helperBoneCount: skeleton.bones.length - logicalBoneCount,
      skinnedMeshCount: (base.skinnedMeshCount || 0) + 2,
      applyCount: Math.max(base.applyCount || 0, applyCount),
      lastState: lastPose?.state ?? base.lastState,
      topologyRevision: CHICKEN_PHASE1_SEGMENTED_TOPOLOGY_REVISION,
      centerlineCurveRevision: CHICKEN_PHASE1_SEGMENTED_CURVE_REVISION,
      weightingRevision: CHICKEN_PHASE1_SEGMENTED_NECK_REVISION,
      coatWeightingRevision: CHICKEN_PHASE1_SEGMENTED_COAT_REVISION,
      domains: {
        sourceTriangleCount: sourceIndices.length / 3,
        torsoTriangleCount: domains.torsoIndices.length / 3,
        headTriangleCount: domains.headIndices.length / 3,
        headStartX: domains.headStartX
      },
      neckTube: {
        startMode: 'buried-root',
        rootBurial,
        endpointBone: 'head_base',
        curveParameters: [...curveParameters],
        ringCount,
        ringSize,
        vertexCount: outputPosition.count,
        triangleCount: tubeGeometry.index.count / 3
      },
      coat: coatRestore ? {
        elementCount: coatRestore.elementCount,
        rootRigid: coatRestore.rootRigid,
        primaryBoneCounts: coatRestore.primaryBoneCounts
      } : null,
      lastFrameAudit
    };
  }

  function detach() {
    parent.remove(headMesh);
    parent.remove(tubeMesh);
    parent.remove(helperInfo.helper);
    headGeometry.dispose();
    tubeGeometry.dispose();
    headMaterial.dispose?.();
    tubeMaterial.dispose?.();
    bodyMesh.geometry = sourceGeometry;
    torsoGeometry.dispose();
    coatRestore?.restore();
    removeIdentityHelperBone(skeleton, helperInfo);
    baseSkin.detach();
  }

  return Object.freeze({
    bones,
    skeleton,
    meshes: [...baseSkin.meshes, headMesh, tubeMesh],
    applyPose,
    verifyInvariants: baseSkin.verifyInvariants,
    detach,
    diagnostics,
    rootOrigin: baseSkin.rootOrigin,
    headMesh,
    tubeMesh,
    domains
  });
}
