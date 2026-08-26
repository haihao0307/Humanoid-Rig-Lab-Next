const EPSILON = 1e-9;
const DEFAULT_MARGIN = 0.10;

export const PROCEDURAL_CAMERA_DIRECTIONS_V5 = Object.freeze({
  Front: Object.freeze([0, 0, 1]),
  Back: Object.freeze([0, 0, -1]),
  Left: Object.freeze([-1, 0, 0]),
  Right: Object.freeze([1, 0, 0]),
  Perspective: Object.freeze([2.4, 0.45, 2.8]),
});

const JOINT_LOCAL_REGIONS = Object.freeze({
  leftShoulder: Object.freeze(['leftUpperArm', 'upperTorso']),
  rightShoulder: Object.freeze(['rightUpperArm', 'upperTorso']),
  leftLowerArm: Object.freeze(['leftUpperArm', 'leftForearm']),
  rightLowerArm: Object.freeze(['rightUpperArm', 'rightForearm']),
  leftHip: Object.freeze(['pelvis', 'leftThigh']),
  rightHip: Object.freeze(['pelvis', 'rightThigh']),
  leftKnee: Object.freeze(['leftThigh', 'leftCalf']),
  rightKnee: Object.freeze(['rightThigh', 'rightCalf']),
});

export function computeDeformedBoundsV5(positions) {
  if (!positions || positions.length < 3 || positions.length % 3 !== 0) {
    throw new Error('Camera framing requires packed XYZ deformed positions.');
  }
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  for (let offset = 0; offset < positions.length; offset += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = Number(positions[offset + axis]);
      if (!Number.isFinite(value)) throw new Error('Camera framing received a non-finite deformed position.');
      minimum[axis] = Math.min(minimum[axis], value);
      maximum[axis] = Math.max(maximum[axis], value);
    }
  }
  const center = minimum.map((value, axis) => (value + maximum[axis]) * 0.5);
  const size = maximum.map((value, axis) => value - minimum[axis]);
  let radius = 0;
  for (let offset = 0; offset < positions.length; offset += 3) {
    radius = Math.max(radius, Math.hypot(
      positions[offset] - center[0],
      positions[offset + 1] - center[1],
      positions[offset + 2] - center[2],
    ));
  }
  return { minimum, maximum, center, size, sphere: { center: [...center], radius } };
}

export function frameDeformedBoundsV5({
  positions,
  direction,
  fovDegrees,
  aspect,
  margin = DEFAULT_MARGIN,
  target = null,
} = {}) {
  if (!(margin >= 0.08 && margin <= 0.12)) throw new RangeError('Camera framing margin must stay within 8% to 12%.');
  if (!(Number(aspect) > 0) || !(Number(fovDegrees) > 0 && Number(fovDegrees) < 180)) {
    throw new RangeError('Camera framing requires a valid perspective FOV and aspect ratio.');
  }
  const bounds = computeDeformedBoundsV5(positions);
  const center = target ? finiteVector3(target, 'camera target') : bounds.center;
  const viewDirection = normalize(direction, PROCEDURAL_CAMERA_DIRECTIONS_V5.Perspective);
  const worldUp = Math.abs(dot(viewDirection, [0, 1, 0])) > 0.98 ? [0, 0, 1] : [0, 1, 0];
  const right = normalize(cross(worldUp, viewDirection), [1, 0, 0]);
  const up = normalize(cross(viewDirection, right), [0, 1, 0]);
  const safeFraction = 1 - margin;
  const tangentVertical = Math.tan(Number(fovDegrees) * Math.PI / 360) * safeFraction;
  const tangentHorizontal = tangentVertical * Number(aspect);
  let distance = Math.max(bounds.sphere.radius, 0.05);
  for (let offset = 0; offset < positions.length; offset += 3) {
    const relative = [
      positions[offset] - center[0],
      positions[offset + 1] - center[1],
      positions[offset + 2] - center[2],
    ];
    const towardCamera = dot(relative, viewDirection);
    distance = Math.max(
      distance,
      towardCamera + Math.abs(dot(relative, right)) / tangentHorizontal,
      towardCamera + Math.abs(dot(relative, up)) / tangentVertical,
    );
  }
  distance = Math.max(distance, 0.05);
  const position = center.map((value, axis) => value + viewDirection[axis] * distance);
  let nearestDepth = Infinity;
  let farthestDepth = 0;
  for (let offset = 0; offset < positions.length; offset += 3) {
    const depth = distance - dot([
      positions[offset] - center[0],
      positions[offset + 1] - center[1],
      positions[offset + 2] - center[2],
    ], viewDirection);
    nearestDepth = Math.min(nearestDepth, depth);
    farthestDepth = Math.max(farthestDepth, depth);
  }
  const depthPadding = Math.max(bounds.sphere.radius * 0.08, 0.01);
  const near = Math.max(0.001, nearestDepth - depthPadding);
  const far = Math.max(near + 0.1, farthestDepth + depthPadding);
  return {
    bounds,
    target: center,
    direction: viewDirection,
    right,
    up,
    position,
    distance,
    near,
    far,
    margin,
  };
}

export function selectJointLocalDeformedPositionsV5({
  positions,
  regionIds,
  regionNames,
  jointId,
  jointPosition,
  radius,
  minimumVertexCount = 48,
} = {}) {
  computeDeformedBoundsV5(positions);
  const target = finiteVector3(jointPosition, 'joint position');
  const acceptedRegions = new Set(JOINT_LOCAL_REGIONS[jointId] ?? []);
  const localRadius = Math.max(Number(radius) || 0, 0.08);
  const candidates = [];
  for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
    const point = [positions[vertex * 3], positions[vertex * 3 + 1], positions[vertex * 3 + 2]];
    const distance = Math.hypot(point[0] - target[0], point[1] - target[1], point[2] - target[2]);
    const primaryRegion = regionNames?.[regionIds?.[vertex * 4]] ?? 'unclassified';
    if ((!acceptedRegions.size || acceptedRegions.has(primaryRegion)) && distance <= localRadius) {
      candidates.push({ point, distance });
    }
  }
  if (candidates.length < minimumVertexCount) {
    candidates.length = 0;
    for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
      const point = [positions[vertex * 3], positions[vertex * 3 + 1], positions[vertex * 3 + 2]];
      candidates.push({ point, distance: Math.hypot(point[0] - target[0], point[1] - target[1], point[2] - target[2]) });
    }
    candidates.sort((left, right) => left.distance - right.distance);
    candidates.length = Math.min(candidates.length, Math.max(minimumVertexCount, 96));
  }
  return new Float32Array(candidates.flatMap(({ point }) => point));
}

function finiteVector3(value, label) {
  const result = [0, 1, 2].map((axis) => Number(value?.[axis]));
  if (!result.every(Number.isFinite)) throw new Error(`Camera framing requires a finite ${label}.`);
  return result;
}
function normalize(value, fallback) {
  const vector = finiteVector3(value ?? fallback, 'direction');
  const length = Math.hypot(...vector);
  return length > EPSILON ? vector.map((entry) => entry / length) : [...fallback];
}
function dot(a, b) { return a.reduce((sum, value, axis) => sum + value * b[axis], 0); }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
