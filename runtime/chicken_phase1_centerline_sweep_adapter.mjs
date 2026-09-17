const EPSILON = 1e-8;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const sat = (value) => clamp(value, 0, 1);
const ss = (a, b, value) => {
  const t = sat((value - a) / (b - a || 1));
  return t * t * (3 - 2 * t);
};

export const CHICKEN_PHASE1_CENTERLINE_SWEEP_REVISION = 'anatomical-topology-split-and-centerline-sweep-v7';
export const CHICKEN_PHASE1_CENTERLINE_CURVE_REVISION = 'bone-centerline-pchip-volume-preserving-v1';

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

export function computeChickenPhase1NeckSectorFloor(x) {
  if (x <= 0.14) return 0.52;
  if (x <= 0.24) return 0.52 + (x - 0.14) * 0.90;
  if (x <= 0.33) return 0.61 + (x - 0.24) * 1.22;
  if (x <= 0.41) return 0.72 + (x - 0.33) * 1.38;
  return 0.83;
}

export function computeChickenPhase1NeckSectorGate(x, y) {
  const floor = computeChickenPhase1NeckSectorFloor(x);
  const dorsal = ss(floor - 0.040, floor + 0.060, y) * ss(0.045, 0.115, x);
  const cranialLock = ss(0.395, 0.445, x) * ss(0.760, 0.840, y);
  return sat(Math.max(dorsal, cranialLock));
}

export function computeChickenPhase1TorsoWeights(x) {
  const chest = ss(-0.22, 0.035, x);
  return Object.freeze({ pelvis: 1 - chest, chest });
}

function findSegment(xs, x) {
  if (x <= xs[0]) return { index: 0, t: 0 };
  const last = xs.length - 1;
  if (x >= xs[last]) return { index: last - 1, t: 1 };
  for (let i = 0; i < last; i++) {
    if (x <= xs[i + 1]) {
      return { index: i, t: (x - xs[i]) / (xs[i + 1] - xs[i] || 1) };
    }
  }
  return { index: last - 1, t: 1 };
}

function endpointSlope(h0, h1, d0, d1) {
  let slope = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1 || 1);
  if (slope * d0 <= 0) slope = 0;
  else if ((d0 * d1 < 0) && Math.abs(slope) > Math.abs(3 * d0)) slope = 3 * d0;
  return slope;
}

export function createChickenPhase1Pchip(xsInput, pointsInput) {
  if (!Array.isArray(xsInput) || !Array.isArray(pointsInput) || xsInput.length !== pointsInput.length || xsInput.length < 2) {
    throw new Error('PCHIP requires matching arrays with at least two points');
  }
  const xs = xsInput.map(Number);
  const points = pointsInput.map((value) => [Number(value[0]), Number(value[1]), Number(value[2])]);
  for (let i = 1; i < xs.length; i++) {
    if (!(xs[i] > xs[i - 1])) throw new Error('PCHIP x values must be strictly increasing');
  }
  const n = xs.length;
  const h = new Array(n - 1);
  const delta = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    h[i] = xs[i + 1] - xs[i];
    delta[i] = [
      (points[i + 1][0] - points[i][0]) / h[i],
      (points[i + 1][1] - points[i][1]) / h[i],
      (points[i + 1][2] - points[i][2]) / h[i]
    ];
  }
  const slopes = Array.from({ length: n }, () => [0, 0, 0]);
  if (n === 2) {
    slopes[0] = [...delta[0]];
    slopes[1] = [...delta[0]];
  } else {
    for (let axis = 0; axis < 3; axis++) {
      slopes[0][axis] = endpointSlope(h[0], h[1], delta[0][axis], delta[1][axis]);
      slopes[n - 1][axis] = endpointSlope(
        h[n - 2],
        h[n - 3],
        delta[n - 2][axis],
        delta[n - 3][axis]
      );
      for (let i = 1; i < n - 1; i++) {
        const d0 = delta[i - 1][axis];
        const d1 = delta[i][axis];
        if (d0 * d1 <= 0) {
          slopes[i][axis] = 0;
        } else {
          const w1 = 2 * h[i] + h[i - 1];
          const w2 = h[i] + 2 * h[i - 1];
          slopes[i][axis] = (w1 + w2) / (w1 / d0 + w2 / d1);
        }
      }
    }
  }

  const evaluate = (x) => {
    const { index, t } = findSegment(xs, x);
    const step = h[index];
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    return [0, 1, 2].map((axis) => (
      h00 * points[index][axis]
      + h10 * step * slopes[index][axis]
      + h01 * points[index + 1][axis]
      + h11 * step * slopes[index + 1][axis]
    ));
  };

  const derivative = (x) => {
    const { index, t } = findSegment(xs, x);
    const step = h[index];
    const t2 = t * t;
    const dh00 = (6 * t2 - 6 * t) / step;
    const dh10 = 3 * t2 - 4 * t + 1;
    const dh01 = (-6 * t2 + 6 * t) / step;
    const dh11 = 3 * t2 - 2 * t;
    return [0, 1, 2].map((axis) => (
      dh00 * points[index][axis]
      + dh10 * slopes[index][axis]
      + dh01 * points[index + 1][axis]
      + dh11 * slopes[index + 1][axis]
    ));
  };

  return Object.freeze({ evaluate, derivative, xs: Object.freeze([...xs]) });
}

export function createChickenPhase1ArcLengthMap(curve, xMin, xMax, samples = 192) {
  if (!curve?.evaluate || !(xMax > xMin)) throw new Error('valid curve and x range are required');
  const count = Math.max(16, Math.floor(samples));
  const xs = new Float64Array(count);
  const lengths = new Float64Array(count);
  let previous = curve.evaluate(xMin);
  xs[0] = xMin;
  lengths[0] = 0;
  for (let i = 1; i < count; i++) {
    const x = xMin + (xMax - xMin) * i / (count - 1);
    const point = curve.evaluate(x);
    xs[i] = x;
    lengths[i] = lengths[i - 1] + distance3(point, previous);
    previous = point;
  }
  const totalLength = lengths[count - 1] || 1;
  for (let i = 0; i < count; i++) lengths[i] /= totalLength;

  const interpolate = (values, targets, value) => {
    const target = clamp(value, targets[0], targets[targets.length - 1]);
    let lo = 0;
    let hi = targets.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (targets[mid] <= target) lo = mid;
      else hi = mid;
    }
    const span = targets[hi] - targets[lo] || 1;
    return values[lo] + (values[hi] - values[lo]) * ((target - targets[lo]) / span);
  };

  return Object.freeze({
    totalLength,
    fractionAtX(x) { return interpolate(lengths, xs, x); },
    xAtFraction(fraction) { return interpolate(xs, lengths, sat(fraction)); },
    sampleCount: count
  });
}

function distance3(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.hypot(dx, dy, dz);
}

function lerp3(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}

function mean3(points) {
  const value = [0, 0, 0];
  for (const point of points) {
    value[0] += point[0];
    value[1] += point[1];
    value[2] += point[2];
  }
  const scale = points.length ? 1 / points.length : 0;
  return [value[0] * scale, value[1] * scale, value[2] * scale];
}

function resamplePolyline(points, count) {
  if (points.length < 2) return Array.from({ length: count }, () => [...points[0]]);
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + distance3(points[i], points[i - 1]));
  const total = cumulative[cumulative.length - 1] || 1;
  const result = [];
  for (let sample = 0; sample < count; sample++) {
    const target = total * (sample / Math.max(1, count - 1));
    let segment = 0;
    while (segment < cumulative.length - 2 && cumulative[segment + 1] < target) segment++;
    const denom = cumulative[segment + 1] - cumulative[segment] || 1;
    result.push(lerp3(points[segment], points[segment + 1], (target - cumulative[segment]) / denom));
  }
  return result;
}

function resampleClosedRing(points, count) {
  const cumulative = [0];
  for (let i = 1; i <= points.length; i++) {
    cumulative.push(cumulative[i - 1] + distance3(points[i % points.length], points[(i - 1) % points.length]));
  }
  const total = cumulative[cumulative.length - 1] || 1;
  const result = [];
  for (let sample = 0; sample < count; sample++) {
    const target = total * sample / count;
    let segment = 0;
    while (segment < points.length - 1 && cumulative[segment + 1] < target) segment++;
    const denom = cumulative[segment + 1] - cumulative[segment] || 1;
    result.push(lerp3(
      points[segment % points.length],
      points[(segment + 1) % points.length],
      (target - cumulative[segment]) / denom
    ));
  }
  return result;
}

function rollRing(ring, shift, reverse = false) {
  const source = reverse ? [...ring].reverse() : ring;
  const count = source.length;
  return Array.from({ length: count }, (_, i) => [...source[(i - shift + count) % count]]);
}

export function phaseAlignChickenPhase1ClosedRings(rings) {
  if (!rings.length) return [];
  const aligned = [rings[0].map((value) => [...value])];
  for (let ringIndex = 1; ringIndex < rings.length; ringIndex++) {
    const ring = rings[ringIndex];
    const previous = aligned[aligned.length - 1];
    let best = null;
    let bestCost = Infinity;
    for (const reverse of [false, true]) {
      for (let shift = 0; shift < ring.length; shift++) {
        const candidate = rollRing(ring, shift, reverse);
        let cost = 0;
        for (let i = 0; i < ring.length; i++) {
          const d = distance3(candidate[i], previous[i]);
          cost += d * d;
        }
        if (cost < bestCost) {
          bestCost = cost;
          best = candidate;
        }
      }
    }
    aligned.push(best);
  }
  return aligned;
}

export function buildChickenPhase1AnatomicalNeckShell(positionArray, options = {}) {
  if (!positionArray || positionArray.length % 3 !== 0) throw new Error('positionArray must contain xyz triples');
  const ringSize = options.ringSize ?? 96;
  const outputRingSize = options.outputRingSize ?? 32;
  const dorsalSamples = options.dorsalSamples ?? 22;
  const gateThreshold = options.gateThreshold ?? 0.48;
  const startX = options.startX ?? 0.075;
  const fullRingX = options.fullRingX ?? 0.405;
  const vertexCount = positionArray.length / 3;
  const stationCount = Math.floor((vertexCount - 2) / ringSize);
  if (stationCount < 2 || stationCount * ringSize + 2 !== vertexCount) {
    throw new Error(`expected a radial carrier with N*${ringSize}+2 vertices`);
  }
  const rings = [];
  const stationXs = [];
  const sourceStationIndices = [];

  for (let station = 0; station < stationCount; station++) {
    const ring = [];
    let dorsalIndex = 0;
    let dorsalY = -Infinity;
    for (let sample = 0; sample < ringSize; sample++) {
      const q = (station * ringSize + sample) * 3;
      const point = [positionArray[q], positionArray[q + 1], positionArray[q + 2]];
      ring.push(point);
      if (point[1] > dorsalY) {
        dorsalY = point[1];
        dorsalIndex = sample;
      }
    }
    const x = ring[0][0];
    if (x < startX) continue;
    const mask = ring.map((point) => computeChickenPhase1NeckSectorGate(point[0], point[1]) >= gateThreshold);
    if (!mask[dorsalIndex] && x < 0.39) continue;

    let closed;
    if (mask.every(Boolean) || x >= fullRingX) {
      closed = resampleClosedRing(ring, outputRingSize);
    } else {
      let left = dorsalIndex;
      let right = dorsalIndex;
      while (left > 0 && mask[left - 1]) left--;
      while (right < ringSize - 1 && mask[right + 1]) right++;
      left = Math.max(0, left - 1);
      right = Math.min(ringSize - 1, right + 1);
      const dorsalArc = resamplePolyline(ring.slice(left, right + 1), dorsalSamples);
      const leftPoint = dorsalArc[0];
      const rightPoint = dorsalArc[dorsalArc.length - 1];
      const control = [
        x,
        Math.min(leftPoint[1], rightPoint[1]) - 0.018,
        0.5 * (leftPoint[2] + rightPoint[2])
      ];
      const closureCount = outputRingSize - dorsalSamples;
      const closure = [];
      for (let sample = 1; sample <= closureCount; sample++) {
        const t = sample / (closureCount + 1);
        const one = 1 - t;
        closure.push([
          one * one * rightPoint[0] + 2 * one * t * control[0] + t * t * leftPoint[0],
          one * one * rightPoint[1] + 2 * one * t * control[1] + t * t * leftPoint[1],
          one * one * rightPoint[2] + 2 * one * t * control[2] + t * t * leftPoint[2]
        ]);
      }
      closed = [...dorsalArc, ...closure];
    }
    if (closed.length !== outputRingSize) throw new Error('neck shell ring resampling failed');
    rings.push(closed);
    stationXs.push(x);
    sourceStationIndices.push(station);
  }

  const alignedRings = phaseAlignChickenPhase1ClosedRings(rings);
  const positions = [];
  const uvs = [];
  const seeds = [];
  const zones = [];
  const kinds = [];
  const localCoords = [];
  for (let ringIndex = 0; ringIndex < alignedRings.length; ringIndex++) {
    const u = alignedRings.length <= 1 ? 0 : ringIndex / (alignedRings.length - 1);
    for (let sample = 0; sample < outputRingSize; sample++) {
      const point = alignedRings[ringIndex][sample];
      positions.push(...point);
      localCoords.push(...point);
      uvs.push(u, sample / outputRingSize);
      seeds.push((ringIndex * outputRingSize + sample) * 0.61803398875 % 1);
      zones.push(computeChickenPhase1NeckSectorGate(point[0], point[1]));
      kinds.push(0);
    }
  }
  const indices = [];
  for (let ringIndex = 0; ringIndex < alignedRings.length - 1; ringIndex++) {
    for (let sample = 0; sample < outputRingSize; sample++) {
      const next = (sample + 1) % outputRingSize;
      const a = ringIndex * outputRingSize + sample;
      const b = ringIndex * outputRingSize + next;
      const c = (ringIndex + 1) * outputRingSize + sample;
      const d = (ringIndex + 1) * outputRingSize + next;
      indices.push(a, c, b, b, c, d);
    }
  }
  const ringCenters = alignedRings.map(mean3);
  return Object.freeze({
    ringSize: outputRingSize,
    ringCount: alignedRings.length,
    stationXs: Object.freeze([...stationXs]),
    sourceStationIndices: Object.freeze([...sourceStationIndices]),
    ringCenters: Object.freeze(ringCenters.map((value) => Object.freeze([...value]))),
    rings: Object.freeze(alignedRings.map((ring) => Object.freeze(ring.map((value) => Object.freeze([...value]))))),
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    uvs: new Float32Array(uvs),
    seeds: new Float32Array(seeds),
    zones: new Float32Array(zones),
    kinds: new Float32Array(kinds),
    localCoords: new Float32Array(localCoords)
  });
}

export function filterChickenPhase1TorsoTriangles(positionArray, indexArray, options = {}) {
  const keepMaxGate = options.keepMaxGate ?? 0.72;
  const preserveBeforeX = options.preserveBeforeX ?? 0.085;
  const output = [];
  for (let i = 0; i < indexArray.length; i += 3) {
    const a = indexArray[i];
    const b = indexArray[i + 1];
    const c = indexArray[i + 2];
    const ids = [a, b, c];
    let maxGate = 0;
    let meanX = 0;
    for (const id of ids) {
      const q = id * 3;
      const x = positionArray[q];
      const y = positionArray[q + 1];
      meanX += x;
      maxGate = Math.max(maxGate, computeChickenPhase1NeckSectorGate(x, y));
    }
    meanX /= 3;
    if (maxGate < keepMaxGate || meanX < preserveBeforeX) output.push(a, b, c);
  }
  return new Uint32Array(output);
}

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

function localBonePosition(THREE, bone, parentInverse) {
  return new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld).applyMatrix4(parentInverse);
}

function localBoneQuaternion(THREE, bone, parentWorldQuaternionInverse) {
  const value = new THREE.Quaternion();
  bone.getWorldQuaternion(value);
  return parentWorldQuaternionInverse.clone().multiply(value).normalize();
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
  const lastGap = NECK_STATIONS[NECK_STATIONS.length - 1] - NECK_STATIONS[NECK_STATIONS.length - 2];
  const startScale = Math.max(0, (NECK_STATIONS[0] - xMin) / firstGap);
  const endScale = Math.max(0, (xMax - NECK_STATIONS[NECK_STATIONS.length - 1]) / lastGap);
  return {
    xs: [xMin, ...NECK_STATIONS, xMax],
    points: [
      extrapolatePoint(points[0], points[1], startScale),
      ...points.map((value) => [...value]),
      extrapolatePoint(points[points.length - 1], points[points.length - 2], endScale)
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

function makeFrame(THREE, curve, x, orientation, previousLateral = null) {
  const derivative = curve.derivative(x);
  const tangent = new THREE.Vector3(...derivative).normalize();
  let lateral = new THREE.Vector3(0, 0, 1).applyQuaternion(orientation);
  lateral.addScaledVector(tangent, -lateral.dot(tangent));
  if (lateral.lengthSq() < 1e-8 && previousLateral) lateral.copy(previousLateral);
  if (lateral.lengthSq() < 1e-8) lateral.set(0, 0, 1).addScaledVector(tangent, -tangent.z);
  lateral.normalize();
  const normal = new THREE.Vector3().crossVectors(lateral, tangent).normalize();
  return { tangent, normal, lateral };
}

function frameToLocal(frame, vector) {
  return [vector.dot(frame.tangent), vector.dot(frame.normal), vector.dot(frame.lateral)];
}

function frameFromLocal(THREE, frame, values) {
  return new THREE.Vector3()
    .addScaledVector(frame.tangent, values[0])
    .addScaledVector(frame.normal, values[1])
    .addScaledVector(frame.lateral, values[2]);
}

function appendIdentityHelperBone(THREE, skeleton, parent) {
  parent.updateMatrixWorld(true);
  const helper = new THREE.Bone();
  helper.name = 'carrier_identity_helper';
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

function setRigidHelperWeights(THREE, geometry, helperIndex) {
  const count = geometry.getAttribute('position').count;
  const indices = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    indices[i * 4] = helperIndex;
    weights[i * 4] = 1;
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
}

function setTorsoWeights(THREE, geometry, boneIndex) {
  const position = geometry.getAttribute('position');
  const count = position.count;
  const indices = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const blend = computeChickenPhase1TorsoWeights(position.getX(i));
    const q = i * 4;
    indices[q] = boneIndex.pelvis;
    indices[q + 1] = boneIndex.chest;
    weights[q] = blend.pelvis;
    weights[q + 1] = blend.chest;
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
}

export function createChickenPhase1CenterlineSweepAdapter(THREE, baseSkin, options = {}) {
  requireThree(THREE);
  if (!baseSkin?.bones || !baseSkin?.skeleton || !Array.isArray(baseSkin.meshes)) {
    throw new Error('an articulated chicken skin is required');
  }
  const bodyMesh = baseSkin.meshes.find((mesh) => mesh?.userData?.materialKind === 'body');
  if (!bodyMesh?.isSkinnedMesh || !bodyMesh.geometry?.index) throw new Error('body SkinnedMesh with indexed geometry is required');
  const parent = bodyMesh.parent;
  if (!parent) throw new Error('body mesh parent is required');
  const skeleton = baseSkin.skeleton;
  const bones = baseSkin.bones;
  const position = bodyMesh.geometry.getAttribute('position');
  const originalPositionArray = new Float32Array(position.array);
  const originalIndexArray = new Uint32Array(bodyMesh.geometry.index.array);
  const originalBodyGeometry = bodyMesh.geometry;
  const logicalBoneCount = skeleton.bones.length;
  const boneIndex = Object.fromEntries(skeleton.bones.map((bone, index) => [bone.name, index]));
  if (!Number.isInteger(boneIndex.pelvis) || !Number.isInteger(boneIndex.chest)) throw new Error('pelvis and chest bones are required');

  const shell = buildChickenPhase1AnatomicalNeckShell(originalPositionArray, options.shell || {});
  const torsoIndex = filterChickenPhase1TorsoTriangles(originalPositionArray, originalIndexArray, options.torso || {});
  const torsoGeometry = originalBodyGeometry.clone();
  torsoGeometry.setIndex(new THREE.Uint32BufferAttribute(torsoIndex, 1));
  setTorsoWeights(THREE, torsoGeometry, boneIndex);
  torsoGeometry.computeBoundingBox?.();
  torsoGeometry.computeBoundingSphere?.();
  bodyMesh.geometry = torsoGeometry;

  const helperInfo = appendIdentityHelperBone(THREE, skeleton, parent);
  const neckGeometry = new THREE.BufferGeometry();
  neckGeometry.setAttribute('position', new THREE.Float32BufferAttribute(shell.positions, 3));
  neckGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(shell.positions.length), 3));
  neckGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(shell.uvs, 2));
  neckGeometry.setAttribute('seed', new THREE.Float32BufferAttribute(shell.seeds, 1));
  neckGeometry.setAttribute('zone', new THREE.Float32BufferAttribute(shell.zones, 1));
  neckGeometry.setAttribute('kind', new THREE.Float32BufferAttribute(shell.kinds, 1));
  neckGeometry.setAttribute('localCoord', new THREE.Float32BufferAttribute(shell.localCoords, 3));
  neckGeometry.setIndex(new THREE.Uint32BufferAttribute(shell.indices, 1));
  setRigidHelperWeights(THREE, neckGeometry, helperInfo.index);
  neckGeometry.computeVertexNormals();
  neckGeometry.computeBoundingBox();
  neckGeometry.computeBoundingSphere();

  const neckMaterial = bodyMesh.material.clone();
  if (typeof neckMaterial.vertexShader === 'string') {
    neckMaterial.vertexShader = neckMaterial.vertexShader.replace('vRest=position;', 'vRest=localCoord;');
  }
  neckMaterial.defines = { ...(neckMaterial.defines || {}), USE_SKINNING: '' };
  neckMaterial.needsUpdate = true;
  const neckMesh = new THREE.SkinnedMesh(neckGeometry, neckMaterial);
  neckMesh.name = 'chicken_neck_centerline_shell_v7';
  neckMesh.userData = {
    ...bodyMesh.userData,
    materialKind: 'body',
    component: 'anatomical_neck_centerline_shell_v7',
    generatedBy: CHICKEN_PHASE1_CENTERLINE_SWEEP_REVISION
  };
  neckMesh.castShadow = bodyMesh.castShadow;
  neckMesh.receiveShadow = bodyMesh.receiveShadow;
  neckMesh.frustumCulled = false;
  parent.add(neckMesh);
  parent.updateMatrixWorld(true);
  neckMesh.bind(skeleton, bodyMesh.bindMatrix.clone());

  const bindParentInverse = parent.matrixWorld.clone().invert();
  const parentWorldQuaternion = new THREE.Quaternion();
  parent.getWorldQuaternion(parentWorldQuaternion);
  const bindParentQuaternionInverse = parentWorldQuaternion.clone().invert();
  const readControlState = () => {
    parent.updateMatrixWorld(true);
    const inverse = parent.matrixWorld.clone().invert();
    const parentQuaternion = new THREE.Quaternion();
    parent.getWorldQuaternion(parentQuaternion);
    const parentQuaternionInverse = parentQuaternion.clone().invert();
    return {
      points: NECK_BONES.map((id) => localBonePosition(THREE, bones[id], inverse).toArray()),
      quaternions: NECK_BONES.map((id) => localBoneQuaternion(THREE, bones[id], parentQuaternionInverse))
    };
  };

  const bindState = {
    points: NECK_BONES.map((id) => localBonePosition(THREE, bones[id], bindParentInverse).toArray()),
    quaternions: NECK_BONES.map((id) => localBoneQuaternion(THREE, bones[id], bindParentQuaternionInverse))
  };
  const xMin = shell.stationXs[0];
  const xMax = shell.stationXs[shell.stationXs.length - 1];
  const bindControls = makeCurveControls(bindState.points, xMin, xMax);
  const bindCurve = createChickenPhase1Pchip(bindControls.xs, bindControls.points);
  const bindArc = createChickenPhase1ArcLengthMap(bindCurve, xMin, xMax, options.arcSamples ?? 256);
  const ringCache = [];
  let previousBindLateral = null;
  for (let ringIndex = 0; ringIndex < shell.ringCount; ringIndex++) {
    const x = shell.stationXs[ringIndex];
    const orientation = sampleQuaternion(THREE, x, bindState.quaternions);
    const frame = makeFrame(THREE, bindCurve, x, orientation, previousBindLateral);
    previousBindLateral = frame.lateral.clone();
    const curvePoint = new THREE.Vector3(...bindCurve.evaluate(x));
    const center = new THREE.Vector3(...shell.ringCenters[ringIndex]);
    const centerLocal = frameToLocal(frame, center.clone().sub(curvePoint));
    const locals = [];
    for (let sample = 0; sample < shell.ringSize; sample++) {
      const q = (ringIndex * shell.ringSize + sample) * 3;
      const point = new THREE.Vector3(shell.positions[q], shell.positions[q + 1], shell.positions[q + 2]);
      locals.push(frameToLocal(frame, point.sub(center)));
    }
    ringCache.push({ x, arcFraction: bindArc.fractionAtX(x), centerLocal, locals });
  }

  let applyCount = 0;
  let lastPose = null;
  let lastFrameAudit = null;
  const outputPosition = neckGeometry.getAttribute('position');

  function updateNeckShell() {
    const poseState = readControlState();
    const controls = makeCurveControls(poseState.points, xMin, xMax);
    const curve = createChickenPhase1Pchip(controls.xs, controls.points);
    const poseArc = createChickenPhase1ArcLengthMap(curve, xMin, xMax, options.arcSamples ?? 256);
    let previousLateral = null;
    let minRingAreaRatio = Infinity;
    let maxRingAreaRatio = 0;
    for (let ringIndex = 0; ringIndex < ringCache.length; ringIndex++) {
      const cached = ringCache[ringIndex];
      const poseX = poseArc.xAtFraction(cached.arcFraction);
      const orientation = sampleQuaternion(THREE, poseX, poseState.quaternions);
      const frame = makeFrame(THREE, curve, poseX, orientation, previousLateral);
      previousLateral = frame.lateral.clone();
      const curvePoint = new THREE.Vector3(...curve.evaluate(poseX));
      const center = curvePoint.add(frameFromLocal(THREE, frame, cached.centerLocal));
      for (let sample = 0; sample < shell.ringSize; sample++) {
        const target = center.clone().add(frameFromLocal(THREE, frame, cached.locals[sample]));
        const vertex = ringIndex * shell.ringSize + sample;
        outputPosition.setXYZ(vertex, target.x, target.y, target.z);
      }
      // The mapping is a rigid frame transform per ring; exact area retention is therefore 1.
      minRingAreaRatio = Math.min(minRingAreaRatio, 1);
      maxRingAreaRatio = Math.max(maxRingAreaRatio, 1);
    }
    outputPosition.needsUpdate = true;
    neckGeometry.computeVertexNormals();
    neckGeometry.getAttribute('normal').needsUpdate = true;
    neckGeometry.computeBoundingBox();
    neckGeometry.computeBoundingSphere();
    lastFrameAudit = Object.freeze({
      ringCount: shell.ringCount,
      ringSize: shell.ringSize,
      ringAreaRatioMin: minRingAreaRatio,
      ringAreaRatioMax: maxRingAreaRatio,
      curvePointCount: controls.points.length,
      bindCurveLength: bindArc.totalLength,
      poseCurveLength: poseArc.totalLength,
      curveLengthRatio: poseArc.totalLength / (bindArc.totalLength || 1)
    });
  }

  function applyPose(pose) {
    const result = baseSkin.applyPose(pose);
    updateNeckShell();
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
    const base = baseSkin.diagnostics();
    return {
      ...base,
      schema: 'life_ecosystem/chicken_phase1_articulated_skin_diagnostics@1.4',
      boneCount: base.boneCount ?? logicalBoneCount,
      logicalBoneCount,
      skeletonBoneCount: skeleton.bones.length,
      helperBoneCount: skeleton.bones.length - logicalBoneCount,
      skinnedMeshCount: (base.skinnedMeshCount || 0) + 1,
      applyCount: Math.max(base.applyCount || 0, applyCount),
      lastState: lastPose?.state ?? base.lastState,
      topologyRevision: 'anatomical-torso-neck-split-v7',
      centerlineCurveRevision: CHICKEN_PHASE1_CENTERLINE_CURVE_REVISION,
      weightingRevision: CHICKEN_PHASE1_CENTERLINE_SWEEP_REVISION,
      neckShell: {
        ringCount: shell.ringCount,
        ringSize: shell.ringSize,
        vertexCount: shell.positions.length / 3,
        triangleCount: shell.indices.length / 3,
        xRange: [xMin, xMax]
      },
      torso: {
        originalTriangleCount: originalIndexArray.length / 3,
        retainedTriangleCount: torsoIndex.length / 3
      },
      lastFrameAudit
    };
  }

  function detach() {
    parent.remove(neckMesh);
    parent.remove(helperInfo.helper);
    neckGeometry.dispose();
    neckMaterial.dispose?.();
    bodyMesh.geometry = originalBodyGeometry;
    torsoGeometry.dispose();
    if (skeleton.bones[skeleton.bones.length - 1] === helperInfo.helper) {
      skeleton.bones.pop();
      skeleton.boneInverses.pop();
      skeleton.boneMatrices = new Float32Array(skeleton.bones.length * 16);
      if (skeleton.boneTexture) {
        skeleton.boneTexture.dispose?.();
        skeleton.boneTexture = null;
      }
      skeleton.computeBoneTexture?.();
    }
    baseSkin.detach();
  }

  return Object.freeze({
    bones,
    skeleton,
    meshes: [...baseSkin.meshes, neckMesh],
    applyPose,
    verifyInvariants: baseSkin.verifyInvariants,
    detach,
    diagnostics,
    rootOrigin: baseSkin.rootOrigin,
    neckMesh,
    shell
  });
}
