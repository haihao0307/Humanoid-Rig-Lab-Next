import { stableFingerprint } from '../core-utils.js';

export const NATIVE_HUMAN_SURFACE_TOPOLOGY_V1_SCHEMA = 'humanoid_rig/native_human_surface_topology@1.0';
export const NATIVE_HUMAN_SURFACE_TOPOLOGY_V1_ID = 'native-human-surface-topology-v1';
export const NATIVE_HUMAN_SURFACE_REFERENCE_HEIGHT = 1.795672;
export const NATIVE_HUMAN_SURFACE_SUBDIVISION_LEVEL = 2;

export const NATIVE_HUMAN_SURFACE_PATCHES_V1 = deepFreeze([
  patch('head', 'head', 'Head'),
  patch('neck', 'neck', 'Neck'),
  patch('upper-torso', 'upper-torso', 'Upper Torso'),
  patch('lower-torso', 'lower-torso', 'Lower Torso'),
  patch('pelvis', 'pelvis', 'Pelvis'),
  pairedPatch('shoulder-junction', 'shoulder-junction', 'Shoulder Junction'),
  pairedPatch('upper-arm', 'upper-arm', 'Upper Arm'),
  pairedPatch('elbow-junction', 'elbow-junction', 'Elbow Junction'),
  pairedPatch('forearm', 'forearm', 'Forearm'),
  pairedPatch('hand', 'hand', 'Hand'),
  pairedPatch('hip-junction', 'hip-junction', 'Hip Junction'),
  pairedPatch('thigh', 'thigh', 'Thigh'),
  pairedPatch('knee-junction', 'knee-junction', 'Knee Junction'),
  pairedPatch('calf', 'calf', 'Calf'),
  pairedPatch('ankle', 'ankle', 'Ankle'),
  pairedPatch('foot', 'foot', 'Foot'),
].flat());

const HALF_CAGE_V1 = deepFreeze([
  control('head-top', 0.000, 1.795672, 'head'),
  control('groin-center', 0.000, 0.790, 'pelvis'),
  control('groin-inner', 0.052, 0.790, 'hip-junction'),
  control('inner-thigh-high', 0.060, 0.700, 'thigh'),
  control('inner-thigh-low', 0.058, 0.560, 'thigh'),
  control('inner-knee', 0.052, 0.485, 'knee-junction'),
  control('inner-calf', 0.047, 0.300, 'calf'),
  control('inner-ankle', 0.043, 0.105, 'ankle'),
  control('inner-foot-ground', 0.052, 0.000, 'foot'),
  control('outer-foot-ground', 0.128, 0.000, 'foot'),
  control('outer-heel', 0.139, 0.052, 'foot'),
  control('outer-ankle', 0.119, 0.125, 'ankle'),
  control('outer-calf-low', 0.137, 0.225, 'calf'),
  control('outer-calf-high', 0.151, 0.335, 'calf'),
  control('outer-knee', 0.134, 0.500, 'knee-junction'),
  control('outer-thigh-low', 0.148, 0.610, 'thigh'),
  control('outer-thigh-high', 0.174, 0.755, 'thigh'),
  control('outer-hip', 0.193, 0.925, 'hip-junction'),
  control('pelvis-side', 0.196, 1.015, 'pelvis'),
  control('waist-side', 0.164, 1.115, 'lower-torso'),
  control('lower-rib-side', 0.177, 1.245, 'lower-torso'),
  control('chest-side', 0.218, 1.365, 'upper-torso'),
  control('axilla-floor', 0.242, 1.405, 'shoulder-junction'),
  control('upper-arm-under', 0.342, 1.410, 'upper-arm'),
  control('elbow-under', 0.520, 1.412, 'elbow-junction'),
  control('forearm-under', 0.735, 1.420, 'forearm'),
  control('wrist-under', 0.860, 1.425, 'hand'),
  control('palm-under', 0.958, 1.415, 'hand'),
  control('hand-tip-under', 1.018, 1.443, 'hand'),
  control('hand-tip', 1.027, 1.474, 'hand'),
  control('hand-tip-over', 1.002, 1.505, 'hand'),
  control('palm-over', 0.930, 1.523, 'hand'),
  control('wrist-over', 0.850, 1.520, 'hand'),
  control('forearm-over', 0.710, 1.535, 'forearm'),
  control('elbow-over', 0.520, 1.548, 'elbow-junction'),
  control('upper-arm-over', 0.340, 1.552, 'upper-arm'),
  control('acromion', 0.245, 1.555, 'shoulder-junction'),
  control('clavicle-slope', 0.178, 1.590, 'upper-torso'),
  control('neck-side', 0.103, 1.612, 'neck'),
  control('jaw-angle', 0.116, 1.657, 'head'),
  control('skull-side-low', 0.112, 1.718, 'head'),
  control('skull-side-high', 0.091, 1.770, 'head'),
  control('crown-side', 0.052, 1.795672, 'head'),
]);

const LANDMARK_COORDINATES = deepFreeze([
  ['headTop', 0, 1.795672], ['chin', 0, 1.610], ['neckBase', 0, 1.570],
  ['sternum', 0, 1.335], ['waistCenter', 0, 1.105], ['pelvisCenter', 0, 0.925],
  ['groin', 0, 0.790], ['shoulderCenter', 0.245, 1.480], ['elbowCenter', 0.520, 1.480],
  ['wristCenter', 0.850, 1.475], ['hipCenter', 0.100, 0.925],
  ['kneeCenter', 0.095, 0.490], ['ankleCenter', 0.080, 0.105],
  ['heel', 0.095, 0.020], ['toe', 0.095, 0.045],
]);

let cachedTopology = null;

/**
 * Builds the project-owned canonical cage. Connectivity is derived only from
 * the authored half-cage above and the fixed subdivision level. BodyDNA never
 * participates in this function.
 */
export function createNativeHumanSurfaceTopologyV1() {
  if (cachedTopology) return cloneTopology(cachedTopology);
  const initial = buildInitialClosedCage();
  let vertices = initial.vertices;
  let indices = initial.indices;
  for (let level = 0; level < NATIVE_HUMAN_SURFACE_SUBDIVISION_LEVEL; level += 1) {
    ({ vertices, indices } = subdivideTriangles(vertices, indices));
  }
  const symmetry = createSymmetryMap(vertices);
  const enriched = vertices.map((vertex, vertexId) => {
    const classification = classifyPatch(vertex.u, vertex.v);
    return {
      vertexId,
      controlCoordinate: [round(vertex.u), round(vertex.v), round(vertex.shellCoordinate)],
      patchId: `${classification.side === 'center' ? '' : `${classification.side}-`}${classification.regionId}`,
      regionId: classification.regionId,
      longitudinalCoordinate: round(classification.longitudinalCoordinate),
      circumferenceCoordinate: round((vertex.shellCoordinate + 1) * 0.5),
      landmarkWeights: nearestLandmarkWeights(vertex.u, vertex.v),
      leftRightSide: classification.side,
      symmetryPartner: symmetry[vertexId],
      seamGroup: classifySeam(vertex, classification),
    };
  });
  const indexHash = stableFingerprint(indices);
  const topologyFingerprint = stableFingerprint({
    topologyId: NATIVE_HUMAN_SURFACE_TOPOLOGY_V1_ID,
    subdivisionLevel: NATIVE_HUMAN_SURFACE_SUBDIVISION_LEVEL,
    vertices: enriched.map(({ controlCoordinate, symmetryPartner }) => ({ controlCoordinate, symmetryPartner })),
    indices,
  });
  cachedTopology = deepFreeze({
    schema: NATIVE_HUMAN_SURFACE_TOPOLOGY_V1_SCHEMA,
    schemaVersion: 1,
    type: 'NativeHumanSurfaceTopologyV1',
    topologyId: NATIVE_HUMAN_SURFACE_TOPOLOGY_V1_ID,
    method: 'project-authored-symmetric-silhouette-cage-fixed-triangle-subdivision',
    subdivision: {
      scheme: 'fixed-triangle-midpoint-smoothing-equivalent-cage-refinement',
      level: NATIVE_HUMAN_SURFACE_SUBDIVISION_LEVEL,
      bodyDNADependent: false,
    },
    vertexCount: enriched.length,
    triangleCount: indices.length / 3,
    indices,
    vertices: enriched,
    patches: NATIVE_HUMAN_SURFACE_PATCHES_V1,
    topologyFingerprint,
    indexHash,
    authority: {
      topology: 'NativeHumanSurfaceTopologyV1',
      positions: 'BodyDNA -> HumanRigCore -> NativeHumanSurfaceEvaluatorV1',
      externalHumanMeshUsed: false,
    },
  });
  assertNativeHumanSurfaceTopologyV1(cachedTopology);
  return cloneTopology(cachedTopology);
}

export function assertNativeHumanSurfaceTopologyV1(topology) {
  if (topology?.schema !== NATIVE_HUMAN_SURFACE_TOPOLOGY_V1_SCHEMA) {
    throw new Error(`Native topology schema must be ${NATIVE_HUMAN_SURFACE_TOPOLOGY_V1_SCHEMA}.`);
  }
  if (!Number.isInteger(topology.vertexCount) || topology.vertexCount < 4) throw new Error('Native topology has no vertices.');
  if (!Array.isArray(topology.indices) || topology.indices.length % 3 !== 0) throw new Error('Native topology indices must contain triangles.');
  if (topology.indices.some((index) => !Number.isInteger(index) || index < 0 || index >= topology.vertexCount)) {
    throw new Error('Native topology contains an invalid index.');
  }
  if (topology.vertices.length !== topology.vertexCount) throw new Error('Native topology vertex metadata count mismatch.');
  if (topology.vertices.some((vertex, index) => vertex.vertexId !== index || !Array.isArray(vertex.landmarkWeights))) {
    throw new Error('Native topology vertex metadata is incomplete.');
  }
  return topology;
}

function buildInitialClosedCage() {
  const halfPoints = HALF_CAGE_V1.map((item) => [item.u, item.v]);
  const halfTriangles = triangulateSimplePolygon(halfPoints);
  const front = buildSymmetricDisk(1, halfTriangles);
  const back = buildSymmetricDisk(-1, halfTriangles);
  const vertices = [...front.vertices, ...back.vertices];
  const backOffset = front.vertices.length;
  const indices = [
    ...front.indices,
    ...back.indices.map((index) => index + backOffset),
  ];
  const boundary = front.outerBoundary;
  for (let cursor = 0; cursor < boundary.length; cursor += 1) {
    const frontA = boundary[cursor];
    const frontB = boundary[(cursor + 1) % boundary.length];
    const backA = frontA + backOffset;
    const backB = frontB + backOffset;
    indices.push(frontA, backA, backB, frontA, backB, frontB);
  }
  return { vertices, indices };
}

function buildSymmetricDisk(shellCoordinate, halfTriangles) {
  const vertices = HALF_CAGE_V1.map((item) => ({ u: item.u, v: item.v, shellCoordinate }));
  const mirror = new Map([[0, 0], [1, 1]]);
  for (let index = 2; index < HALF_CAGE_V1.length; index += 1) {
    const source = HALF_CAGE_V1[index];
    mirror.set(index, vertices.length);
    vertices.push({ u: -source.u, v: source.v, shellCoordinate });
  }
  const indices = [];
  for (const [a, b, c] of halfTriangles) {
    if (shellCoordinate > 0) {
      indices.push(a, b, c, mirror.get(a), mirror.get(c), mirror.get(b));
    } else {
      indices.push(a, c, b, mirror.get(a), mirror.get(b), mirror.get(c));
    }
  }
  const rightOuter = Array.from({ length: HALF_CAGE_V1.length - 2 }, (_, index) => index + 2);
  const leftDescending = [...rightOuter].reverse().map((index) => mirror.get(index));
  const outerBoundary = [0, ...leftDescending, 1, ...rightOuter];
  return { vertices, indices, outerBoundary };
}

function triangulateSimplePolygon(points) {
  const remaining = points.map((_, index) => index);
  const triangles = [];
  if (signedArea(points) < 0) remaining.reverse();
  let guard = points.length * points.length;
  while (remaining.length > 3 && guard > 0) {
    guard -= 1;
    let clipped = false;
    for (let cursor = 0; cursor < remaining.length; cursor += 1) {
      const a = remaining[(cursor - 1 + remaining.length) % remaining.length];
      const b = remaining[cursor];
      const c = remaining[(cursor + 1) % remaining.length];
      if (cross2(points[a], points[b], points[c]) <= 1e-10) continue;
      if (remaining.some((index) => index !== a && index !== b && index !== c
        && pointInTriangle(points[index], points[a], points[b], points[c]))) continue;
      triangles.push([a, b, c]);
      remaining.splice(cursor, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  if (remaining.length === 3) triangles.push([...remaining]);
  if (triangles.length !== points.length - 2) {
    throw new Error(`Native canonical half-cage triangulation failed: expected ${points.length - 2}, got ${triangles.length}.`);
  }
  return triangles;
}

function subdivideTriangles(sourceVertices, sourceIndices) {
  const vertices = sourceVertices.map((vertex) => ({ ...vertex }));
  const edgeMidpoints = new Map();
  const midpoint = (a, b) => {
    const low = Math.min(a, b);
    const high = Math.max(a, b);
    const key = `${low}:${high}`;
    if (edgeMidpoints.has(key)) return edgeMidpoints.get(key);
    const left = vertices[low];
    const right = vertices[high];
    const index = vertices.length;
    vertices.push({
      u: (left.u + right.u) * 0.5,
      v: (left.v + right.v) * 0.5,
      shellCoordinate: (left.shellCoordinate + right.shellCoordinate) * 0.5,
    });
    edgeMidpoints.set(key, index);
    return index;
  };
  const indices = [];
  for (let cursor = 0; cursor < sourceIndices.length; cursor += 3) {
    const a = sourceIndices[cursor];
    const b = sourceIndices[cursor + 1];
    const c = sourceIndices[cursor + 2];
    const ab = midpoint(a, b);
    const bc = midpoint(b, c);
    const ca = midpoint(c, a);
    indices.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
  }
  return { vertices, indices };
}

function createSymmetryMap(vertices) {
  const lookup = new Map(vertices.map((vertex, index) => [coordinateKey(vertex.u, vertex.v, vertex.shellCoordinate), index]));
  return vertices.map((vertex, index) => {
    const partner = lookup.get(coordinateKey(-vertex.u, vertex.v, vertex.shellCoordinate));
    if (!Number.isInteger(partner)) throw new Error(`Native topology symmetry partner missing for vertex ${index}.`);
    return partner;
  });
}

function classifyPatch(u, v) {
  const absoluteX = Math.abs(u);
  const side = absoluteX < 1e-9 ? 'center' : u < 0 ? 'left' : 'right';
  let regionId = 'upper-torso';
  let range = [1.245, 1.590];
  if (v >= 1.610 && absoluteX < 0.150) { regionId = 'head'; range = [1.610, NATIVE_HUMAN_SURFACE_REFERENCE_HEIGHT]; }
  else if (v >= 1.570 && absoluteX < 0.190) { regionId = 'neck'; range = [1.570, 1.650]; }
  else if (v >= 1.385 && v <= 1.575 && absoluteX >= 0.225) {
    if (absoluteX < 0.300) { regionId = 'shoulder-junction'; range = [0.225, 0.300]; }
    else if (absoluteX < 0.475) { regionId = 'upper-arm'; range = [0.300, 0.475]; }
    else if (absoluteX < 0.575) { regionId = 'elbow-junction'; range = [0.475, 0.575]; }
    else if (absoluteX < 0.835) { regionId = 'forearm'; range = [0.575, 0.835]; }
    else { regionId = 'hand'; range = [0.835, 1.027]; }
    return { regionId, side, longitudinalCoordinate: clamp01((absoluteX - range[0]) / (range[1] - range[0])) };
  } else if (v >= 1.245) { regionId = 'upper-torso'; range = [1.245, 1.590]; }
  else if (v >= 1.075) { regionId = 'lower-torso'; range = [1.075, 1.245]; }
  else if (v >= 0.820) { regionId = 'pelvis'; range = [0.820, 1.075]; }
  else if (v >= 0.735) { regionId = 'hip-junction'; range = [0.735, 0.920]; }
  else if (v >= 0.535) { regionId = 'thigh'; range = [0.535, 0.735]; }
  else if (v >= 0.435) { regionId = 'knee-junction'; range = [0.435, 0.535]; }
  else if (v >= 0.145) { regionId = 'calf'; range = [0.145, 0.435]; }
  else if (v >= 0.070) { regionId = 'ankle'; range = [0.070, 0.145]; }
  else { regionId = 'foot'; range = [0, 0.070]; }
  return { regionId, side, longitudinalCoordinate: clamp01((v - range[0]) / Math.max(1e-8, range[1] - range[0])) };
}

function nearestLandmarkWeights(u, v) {
  return LANDMARK_COORDINATES
    .map(([landmarkId, x, y]) => ({ landmarkId, distance: Math.hypot(Math.abs(u) - x, v - y) }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, 2)
    .map(({ landmarkId, distance }, _, entries) => {
      const raw = 1 / Math.max(0.01, distance);
      const total = entries.reduce((sum, entry) => sum + 1 / Math.max(0.01, entry.distance), 0);
      return { landmarkId, weight: round(raw / total) };
    });
}

function classifySeam(vertex, classification) {
  if (Math.abs(vertex.shellCoordinate) < 0.999999) return 'silhouette-side-wall';
  if (Math.abs(vertex.u) < 1e-9) return 'symmetry-centerline';
  return `${classification.regionId}-${vertex.shellCoordinate > 0 ? 'front' : 'back'}`;
}

function signedArea(points) {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0) * 0.5;
}

function cross2(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function pointInTriangle(point, a, b, c) {
  const area0 = cross2(a, b, point);
  const area1 = cross2(b, c, point);
  const area2 = cross2(c, a, point);
  const epsilon = 1e-10;
  return area0 >= -epsilon && area1 >= -epsilon && area2 >= -epsilon;
}

function coordinateKey(u, v, shellCoordinate) {
  return `${round(u, 9)}:${round(v, 9)}:${round(shellCoordinate, 9)}`;
}

function patch(id, regionId, label) {
  return { patchId: id, regionId, label, side: 'center' };
}

function pairedPatch(id, regionId, label) {
  return ['left', 'right'].map((side) => ({ patchId: `${side}-${id}`, regionId, label: `${side} ${label}`, side }));
}

function control(controlId, u, v, regionId) {
  return { controlId, u, v, regionId };
}

function cloneTopology(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function clamp01(value) { return Math.max(0, Math.min(1, value)); }
function round(value, digits = 8) { return Number(Number(value).toFixed(digits)); }

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
