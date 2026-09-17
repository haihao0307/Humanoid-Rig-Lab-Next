import {
  buildChickenPhase1AnatomicalNeckShell as buildV7NeckShell,
  computeChickenPhase1NeckSectorFloor,
  computeChickenPhase1NeckSectorGate,
  computeChickenPhase1TorsoWeights,
  createChickenPhase1ArcLengthMap,
  createChickenPhase1CenterlineSweepAdapter as createV7CenterlineSweepAdapter,
  createChickenPhase1Pchip,
  filterChickenPhase1TorsoTriangles as filterV7TorsoTriangles,
  phaseAlignChickenPhase1ClosedRings
} from './chicken_phase1_centerline_sweep_adapter.mjs';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const sat = (value) => clamp(value, 0, 1);
const ss = (a, b, value) => {
  const t = sat((value - a) / (b - a || 1));
  return t * t * (3 - 2 * t);
};

export const CHICKEN_PHASE1_CENTERLINE_SWEEP_REVISION =
  'anatomical-neck-root-preserving-centerline-sweep-v7.1';
export const CHICKEN_PHASE1_CENTERLINE_CURVE_REVISION =
  'rotation-minimizing-frame-centerline-v2';
export const CHICKEN_PHASE1_TORSO_PRESERVE_BEFORE_X = 0.2835;
export const CHICKEN_PHASE1_NECK_SHELL_START_X = 0.255;
export const CHICKEN_PHASE1_CENTERLINE_DOMAIN_MIN_X = 0.075;

export {
  computeChickenPhase1NeckSectorFloor,
  computeChickenPhase1NeckSectorGate,
  computeChickenPhase1TorsoWeights,
  createChickenPhase1ArcLengthMap,
  createChickenPhase1Pchip,
  phaseAlignChickenPhase1ClosedRings
};

export function buildChickenPhase1AnatomicalNeckShell(positionArray, options = {}) {
  return buildV7NeckShell(positionArray, {
    startX: CHICKEN_PHASE1_NECK_SHELL_START_X,
    ...options
  });
}

export function filterChickenPhase1TorsoTriangles(positionArray, indexArray, options = {}) {
  return filterV7TorsoTriangles(positionArray, indexArray, {
    preserveBeforeX: CHICKEN_PHASE1_TORSO_PRESERVE_BEFORE_X,
    ...options
  });
}

const NECK_BONES = Object.freeze([
  'neck_base',
  'neck_c0',
  'neck_c1',
  'neck_c2',
  'neck_c3',
  'head_base',
  'head'
]);
const NECK_STATIONS = Object.freeze([0.120, 0.180, 0.240, 0.300, 0.350, 0.382, 0.420]);

function distance3(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function extrapolatePoint(a, b, scale) {
  return [
    a[0] + (a[0] - b[0]) * scale,
    a[1] + (a[1] - b[1]) * scale,
    a[2] + (a[2] - b[2]) * scale
  ];
}

function makeCurveControls(points, xMin, xMax) {
  const firstGap = NECK_STATIONS[1] - NECK_STATIONS[0];
  const last = NECK_STATIONS.length - 1;
  const lastGap = NECK_STATIONS[last] - NECK_STATIONS[last - 1];
  const startScale = Math.max(0, (NECK_STATIONS[0] - xMin) / firstGap);
  const endScale = Math.max(0, (xMax - NECK_STATIONS[last]) / lastGap);
  return {
    xs: [xMin, ...NECK_STATIONS, xMax],
    points: [
      extrapolatePoint(points[0], points[1], startScale),
      ...points.map((value) => [...value]),
      extrapolatePoint(points[last], points[last - 1], endScale)
    ]
  };
}

function sampleQuaternion(THREE, x, quaternions) {
  if (x <= NECK_STATIONS[0]) return quaternions[0].clone();
  const last = NECK_STATIONS.length - 1;
  if (x >= NECK_STATIONS[last]) return quaternions[last].clone();
  for (let i = 0; i < last; i++) {
    if (x <= NECK_STATIONS[i + 1]) {
      const t = ss(NECK_STATIONS[i], NECK_STATIONS[i + 1], x);
      return quaternions[i].clone().slerp(quaternions[i + 1], t).normalize();
    }
  }
  return quaternions[last].clone();
}

function localBonePosition(THREE, bone, parentInverse) {
  return new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld).applyMatrix4(parentInverse);
}

function localBoneQuaternion(THREE, bone, parentWorldQuaternionInverse) {
  const value = new THREE.Quaternion();
  bone.getWorldQuaternion(value);
  return parentWorldQuaternionInverse.clone().multiply(value).normalize();
}

function makeFrame(THREE, curve, x, orientation, previousFrame = null) {
  const tangent = new THREE.Vector3(...curve.derivative(x)).normalize();
  const anatomicalLateral = new THREE.Vector3(0, 0, 1).applyQuaternion(orientation);
  anatomicalLateral.addScaledVector(tangent, -anatomicalLateral.dot(tangent));

  let lateral;
  if (previousFrame) {
    lateral = previousFrame.lateral.clone();
    lateral.addScaledVector(tangent, -lateral.dot(tangent));
    if (lateral.lengthSq() < 1e-10) {
      lateral.copy(previousFrame.normal).cross(tangent);
    }
    lateral.normalize();
    if (anatomicalLateral.lengthSq() > 1e-10) {
      anatomicalLateral.normalize();
      if (anatomicalLateral.dot(lateral) < 0) anatomicalLateral.negate();
      lateral.lerp(anatomicalLateral, 0.12).normalize();
    }
  } else {
    lateral = anatomicalLateral;
    if (lateral.lengthSq() < 1e-10) {
      lateral = new THREE.Vector3(0, 0, 1);
      lateral.addScaledVector(tangent, -lateral.dot(tangent));
    }
    lateral.normalize();
  }

  const normal = new THREE.Vector3().crossVectors(lateral, tangent).normalize();
  lateral = new THREE.Vector3().crossVectors(tangent, normal).normalize();
  if (previousFrame && lateral.dot(previousFrame.lateral) < 0) {
    lateral.negate();
    normal.negate();
  }
  return { tangent, normal, lateral };
}

function frameToLocal(frame, vector) {
  return [
    vector.dot(frame.tangent),
    vector.dot(frame.normal),
    vector.dot(frame.lateral)
  ];
}

function frameFromLocal(THREE, frame, values) {
  return new THREE.Vector3()
    .addScaledVector(frame.tangent, values[0])
    .addScaledVector(frame.normal, values[1])
    .addScaledVector(frame.lateral, values[2]);
}

function polygonArea3FromArray(values, vertexStart, count) {
  let areaX = 0;
  let areaY = 0;
  let areaZ = 0;
  for (let i = 0; i < count; i++) {
    const a = (vertexStart + i) * 3;
    const b = (vertexStart + ((i + 1) % count)) * 3;
    const ax = values[a];
    const ay = values[a + 1];
    const az = values[a + 2];
    const bx = values[b];
    const by = values[b + 1];
    const bz = values[b + 2];
    areaX += ay * bz - az * by;
    areaY += az * bx - ax * bz;
    areaZ += ax * by - ay * bx;
  }
  return 0.5 * Math.hypot(areaX, areaY, areaZ);
}

function polygonArea3FromAttribute(attribute, vertexStart, count) {
  let areaX = 0;
  let areaY = 0;
  let areaZ = 0;
  for (let i = 0; i < count; i++) {
    const a = vertexStart + i;
    const b = vertexStart + ((i + 1) % count);
    const ax = attribute.getX(a);
    const ay = attribute.getY(a);
    const az = attribute.getZ(a);
    const bx = attribute.getX(b);
    const by = attribute.getY(b);
    const bz = attribute.getZ(b);
    areaX += ay * bz - az * by;
    areaY += az * bx - ax * bz;
    areaZ += ax * by - ay * bx;
  }
  return 0.5 * Math.hypot(areaX, areaY, areaZ);
}

function quantile(sorted, q) {
  if (!sorted.length) return 1;
  const index = (sorted.length - 1) * q;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  return lo === hi
    ? sorted[lo]
    : sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}

export function createChickenPhase1CenterlineSweepAdapter(THREE, baseSkin, options = {}) {
  const wrapped = createV7CenterlineSweepAdapter(THREE, baseSkin, {
    ...options,
    shell: {
      startX: CHICKEN_PHASE1_NECK_SHELL_START_X,
      ...(options.shell || {})
    },
    torso: {
      preserveBeforeX: CHICKEN_PHASE1_TORSO_PRESERVE_BEFORE_X,
      ...(options.torso || {})
    }
  });

  const { bones, skeleton, neckMesh, shell } = wrapped;
  const parent = neckMesh?.parent;
  if (!parent || !neckMesh?.geometry?.getAttribute('position')) {
    wrapped.detach();
    throw new Error('V7.1 requires the V7 neck shell mesh and its parent');
  }
  for (const id of NECK_BONES) {
    if (!bones[id]) {
      wrapped.detach();
      throw new Error(`V7.1 missing cervical bone ${id}`);
    }
  }

  neckMesh.name = 'ChickenPhase1AnatomicalNeckRootPreservingShellV71';
  neckMesh.userData = {
    ...(neckMesh.userData || {}),
    component: 'anatomical_neck_root_preserving_shell_v7_1',
    topologyRevision: 'torso-preserving-neck-root-split-v7.1'
  };

  parent.updateMatrixWorld(true);
  const bindParentInverse = parent.matrixWorld.clone().invert();
  const parentWorldQuaternion = new THREE.Quaternion();
  parent.getWorldQuaternion(parentWorldQuaternion);
  const bindParentQuaternionInverse = parentWorldQuaternion.clone().invert();
  const readControlState = () => {
    parent.updateMatrixWorld(true);
    const parentInverse = parent.matrixWorld.clone().invert();
    const parentQuaternion = new THREE.Quaternion();
    parent.getWorldQuaternion(parentQuaternion);
    const parentQuaternionInverse = parentQuaternion.clone().invert();
    return {
      points: NECK_BONES.map((id) => localBonePosition(THREE, bones[id], parentInverse).toArray()),
      quaternions: NECK_BONES.map((id) => localBoneQuaternion(
        THREE,
        bones[id],
        parentQuaternionInverse
      ))
    };
  };

  const bindState = {
    points: NECK_BONES.map((id) => localBonePosition(THREE, bones[id], bindParentInverse).toArray()),
    quaternions: NECK_BONES.map((id) => localBoneQuaternion(
      THREE,
      bones[id],
      bindParentQuaternionInverse
    ))
  };
  const shellXMin = shell.stationXs[0];
  const shellXMax = shell.stationXs[shell.stationXs.length - 1];
  const curveXMin = options.curveMinX ?? CHICKEN_PHASE1_CENTERLINE_DOMAIN_MIN_X;
  const curveXMax = shellXMax;
  const bindControls = makeCurveControls(bindState.points, curveXMin, curveXMax);
  const bindCurve = createChickenPhase1Pchip(bindControls.xs, bindControls.points);
  const bindArc = createChickenPhase1ArcLengthMap(
    bindCurve,
    curveXMin,
    curveXMax,
    options.arcSamples ?? 256
  );
  const bindChestMatrix = bindParentInverse.clone().multiply(bones.chest.matrixWorld);
  const bindChestInverse = bindChestMatrix.clone().invert();
  const ringCache = [];
  let previousBindFrame = null;

  for (let ringIndex = 0; ringIndex < shell.ringCount; ringIndex++) {
    const x = shell.stationXs[ringIndex];
    const orientation = sampleQuaternion(THREE, x, bindState.quaternions);
    const frame = makeFrame(THREE, bindCurve, x, orientation, previousBindFrame);
    previousBindFrame = frame;
    const curvePoint = new THREE.Vector3(...bindCurve.evaluate(x));
    const center = new THREE.Vector3(...shell.ringCenters[ringIndex]);
    const rawCenterLocal = frameToLocal(frame, center.clone().sub(curvePoint));
    const centerLocal = [0, rawCenterLocal[1], rawCenterLocal[2]];
    const locals = [];
    const chestLocals = [];
    for (let sample = 0; sample < shell.ringSize; sample++) {
      const q = (ringIndex * shell.ringSize + sample) * 3;
      const point = new THREE.Vector3(
        shell.positions[q],
        shell.positions[q + 1],
        shell.positions[q + 2]
      );
      locals.push(frameToLocal(frame, point.clone().sub(center)));
      chestLocals.push(point.clone().applyMatrix4(bindChestInverse).toArray());
    }
    ringCache.push({
      x,
      arcFraction: bindArc.fractionAtX(x),
      shellFraction: shell.ringCount <= 1 ? 0 : ringIndex / (shell.ringCount - 1),
      centerLocal,
      locals,
      chestLocals
    });
  }

  const rawOffsets = ringCache.map((entry) => [...entry.centerLocal]);
  for (let i = 0; i < ringCache.length; i++) {
    let normal = 0;
    let lateral = 0;
    let weight = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(ringCache.length - 1, i + 2); j++) {
      const w = j === i ? 3 : (Math.abs(j - i) === 1 ? 2 : 1);
      normal += rawOffsets[j][1] * w;
      lateral += rawOffsets[j][2] * w;
      weight += w;
    }
    ringCache[i].centerLocal = [0, normal / weight, lateral / weight];
  }

  const outputPosition = neckMesh.geometry.getAttribute('position');
  const bindRingAreas = new Float64Array(shell.ringCount);
  for (let ringIndex = 0; ringIndex < shell.ringCount; ringIndex++) {
    bindRingAreas[ringIndex] = polygonArea3FromArray(
      shell.positions,
      ringIndex * shell.ringSize,
      shell.ringSize
    );
  }
  const bindLongitudinalLengths = new Float64Array(
    Math.max(0, shell.ringCount - 1) * shell.ringSize
  );
  for (let ringIndex = 1; ringIndex < shell.ringCount; ringIndex++) {
    for (let sample = 0; sample < shell.ringSize; sample++) {
      const q0 = ((ringIndex - 1) * shell.ringSize + sample) * 3;
      const q1 = (ringIndex * shell.ringSize + sample) * 3;
      bindLongitudinalLengths[(ringIndex - 1) * shell.ringSize + sample] = Math.hypot(
        shell.positions[q1] - shell.positions[q0],
        shell.positions[q1 + 1] - shell.positions[q0 + 1],
        shell.positions[q1 + 2] - shell.positions[q0 + 2]
      );
    }
  }

  let applyCount = 0;
  let lastPose = null;
  let lastFrameAudit = null;

  function updateShell() {
    const poseState = readControlState();
    const controls = makeCurveControls(poseState.points, curveXMin, curveXMax);
    const curve = createChickenPhase1Pchip(controls.xs, controls.points);
    const poseArc = createChickenPhase1ArcLengthMap(
      curve,
      curveXMin,
      curveXMax,
      options.arcSamples ?? 256
    );
    parent.updateMatrixWorld(true);
    const parentInverse = parent.matrixWorld.clone().invert();
    const currentChestMatrix = parentInverse.multiply(bones.chest.matrixWorld);
    let previousFrame = null;
    let minRingAreaRatio = Infinity;
    let maxRingAreaRatio = 0;

    for (let ringIndex = 0; ringIndex < ringCache.length; ringIndex++) {
      const cached = ringCache[ringIndex];
      const poseX = poseArc.xAtFraction(cached.arcFraction);
      const orientation = sampleQuaternion(THREE, poseX, poseState.quaternions);
      const frame = makeFrame(THREE, curve, poseX, orientation, previousFrame);
      previousFrame = frame;
      const curvePoint = new THREE.Vector3(...curve.evaluate(poseX));
      const center = curvePoint.add(frameFromLocal(THREE, frame, cached.centerLocal));
      const sweepWeight = ss(0, 0.28, cached.shellFraction);

      for (let sample = 0; sample < shell.ringSize; sample++) {
        const sweepTarget = center.clone().add(
          frameFromLocal(THREE, frame, cached.locals[sample])
        );
        const chestTarget = new THREE.Vector3(...cached.chestLocals[sample])
          .applyMatrix4(currentChestMatrix);
        const target = chestTarget.lerp(sweepTarget, sweepWeight);
        const vertex = ringIndex * shell.ringSize + sample;
        outputPosition.setXYZ(vertex, target.x, target.y, target.z);
      }

      const bindArea = bindRingAreas[ringIndex] || 1;
      const currentArea = polygonArea3FromAttribute(
        outputPosition,
        ringIndex * shell.ringSize,
        shell.ringSize
      );
      const ratio = currentArea / bindArea;
      minRingAreaRatio = Math.min(minRingAreaRatio, ratio);
      maxRingAreaRatio = Math.max(maxRingAreaRatio, ratio);
    }

    const longitudinalRatios = [];
    for (let ringIndex = 1; ringIndex < shell.ringCount; ringIndex++) {
      for (let sample = 0; sample < shell.ringSize; sample++) {
        const a = (ringIndex - 1) * shell.ringSize + sample;
        const b = ringIndex * shell.ringSize + sample;
        const current = Math.hypot(
          outputPosition.getX(b) - outputPosition.getX(a),
          outputPosition.getY(b) - outputPosition.getY(a),
          outputPosition.getZ(b) - outputPosition.getZ(a)
        );
        const bind = bindLongitudinalLengths[(ringIndex - 1) * shell.ringSize + sample] || 1;
        longitudinalRatios.push(current / bind);
      }
    }
    longitudinalRatios.sort((a, b) => a - b);

    outputPosition.needsUpdate = true;
    neckMesh.geometry.computeVertexNormals();
    neckMesh.geometry.getAttribute('normal').needsUpdate = true;
    neckMesh.geometry.computeBoundingBox();
    neckMesh.geometry.computeBoundingSphere();

    lastFrameAudit = Object.freeze({
      ringCount: shell.ringCount,
      ringSize: shell.ringSize,
      ringAreaRatioMin: minRingAreaRatio,
      ringAreaRatioMax: maxRingAreaRatio,
      longitudinalRatioMedian: quantile(longitudinalRatios, 0.5),
      longitudinalRatioP95: quantile(longitudinalRatios, 0.95),
      longitudinalRatioMax: longitudinalRatios.at(-1) ?? 1,
      seamSweepStartFraction: 0,
      seamSweepEndFraction: 0.28,
      curvePointCount: controls.points.length,
      bindCurveLength: bindArc.totalLength,
      poseCurveLength: poseArc.totalLength,
      curveLengthRatio: poseArc.totalLength / (bindArc.totalLength || 1)
    });
  }

  function applyPose(pose) {
    const result = wrapped.applyPose(pose);
    updateShell();
    skeleton.update();
    applyCount++;
    lastPose = pose;
    return {
      ...result,
      centerlineSweepApplied: true,
      centerlineSweepRevision: CHICKEN_PHASE1_CENTERLINE_SWEEP_REVISION,
      centerlineFrameAudit: lastFrameAudit
    };
  }

  function diagnostics() {
    const base = wrapped.diagnostics();
    return {
      ...base,
      schema: 'life_ecosystem/chicken_phase1_articulated_skin_diagnostics@1.5',
      applyCount: Math.max(base.applyCount || 0, applyCount),
      lastState: lastPose?.state ?? base.lastState,
      topologyRevision: 'torso-preserving-neck-root-split-v7.1',
      centerlineCurveRevision: CHICKEN_PHASE1_CENTERLINE_CURVE_REVISION,
      weightingRevision: CHICKEN_PHASE1_CENTERLINE_SWEEP_REVISION,
      neckShell: {
        ringCount: shell.ringCount,
        ringSize: shell.ringSize,
        vertexCount: shell.positions.length / 3,
        triangleCount: shell.indices.length / 3,
        xRange: [shellXMin, shellXMax],
        centerlineDomain: [curveXMin, curveXMax]
      },
      lastFrameAudit
    };
  }

  return Object.freeze({
    bones,
    skeleton,
    meshes: wrapped.meshes,
    applyPose,
    verifyInvariants: wrapped.verifyInvariants,
    detach: wrapped.detach,
    diagnostics,
    rootOrigin: wrapped.rootOrigin,
    neckMesh,
    shell
  });
}
