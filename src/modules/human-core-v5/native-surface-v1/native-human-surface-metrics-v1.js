import { createBodyDNA } from '../body-dna-v5.js';
import {
  assertNativeHumanSurfaceTopologyV1,
  createNativeHumanSurfaceTopologyV1,
} from './native-human-surface-topology-v1.js';

export const NATIVE_HUMAN_SURFACE_METRICS_V1_SCHEMA = 'humanoid_rig/native_human_surface_metrics@1.0';

export function auditNativeHumanSurfaceGeometryV1({
  evaluation,
  topology = createNativeHumanSurfaceTopologyV1(),
  landmarkEvaluation = null,
  bodyDNA = {},
  includeSelfIntersections = true,
} = {}) {
  assertNativeHumanSurfaceTopologyV1(topology);
  assertEvaluation(evaluation, topology);
  const dna = createBodyDNA(bodyDNA);
  const positions = evaluation.positions;
  const indices = evaluation.indices;
  const edgeAudit = auditEdges(indices, topology.vertexCount);
  const triangleAudit = auditTriangles(positions, indices);
  const normalAudit = auditNormals(evaluation.normals);
  const finiteAudit = auditFinite(positions, evaluation.normals);
  const bounds = computeBounds(positions);
  const intersections = includeSelfIntersections
    ? detectTriangleSelfIntersections(positions, indices, topology)
    : { criticalSelfIntersectionCount: null, totalSelfIntersectionCount: null, pairs: [], skipped: true };
  const landmarkMetrics = landmarkEvaluation
    ? computeNativeHumanSurfaceLandmarkMetricsV1({ landmarkEvaluation, positions, bodyDNA: dna })
    : null;
  const geometryMetrics = {
    schema: NATIVE_HUMAN_SURFACE_METRICS_V1_SCHEMA,
    schemaVersion: 1,
    type: 'NativeHumanSurfaceGeometryMetricsV1',
    bodyDNAId: dna.bodyDNAId,
    topologyFingerprint: topology.topologyFingerprint,
    indexHash: topology.indexHash,
    vertexCount: topology.vertexCount,
    triangleCount: topology.triangleCount,
    edgeCount: edgeAudit.edgeCount,
    connectedComponentCount: edgeAudit.connectedComponentCount,
    boundaryEdgeCount: edgeAudit.boundaryEdgeCount,
    nonManifoldEdgeCount: edgeAudit.nonManifoldEdgeCount,
    degenerateTriangleRatio: triangleAudit.degenerateTriangleRatio,
    minimumTriangleArea: triangleAudit.minimumTriangleArea,
    maximumTriangleAspectRatio: triangleAudit.maximumTriangleAspectRatio,
    signedVolume: triangleAudit.signedVolume,
    NaNCount: finiteAudit.NaNCount,
    InfCount: finiteAudit.InfCount,
    normalLengthError: normalAudit.normalLengthError,
    triangleWindingConsistency: edgeAudit.triangleWindingConsistency && triangleAudit.signedVolume > 0,
    criticalSelfIntersectionCount: intersections.criticalSelfIntersectionCount,
    totalSelfIntersectionCount: intersections.totalSelfIntersectionCount,
    selfIntersectionPairs: intersections.pairs,
    bounds,
    thresholdPolicy: {
      degenerateTriangleArea: 1e-14,
      intersectionEpsilon: 1e-9,
      importedThresholdsChanged: false,
    },
  };
  geometryMetrics.passed = geometryMetrics.connectedComponentCount === 1
    && geometryMetrics.boundaryEdgeCount === 0
    && geometryMetrics.nonManifoldEdgeCount === 0
    && geometryMetrics.degenerateTriangleRatio === 0
    && geometryMetrics.NaNCount === 0
    && geometryMetrics.InfCount === 0
    && geometryMetrics.normalLengthError <= 1e-5
    && geometryMetrics.triangleWindingConsistency === true
    && (geometryMetrics.criticalSelfIntersectionCount == null || geometryMetrics.criticalSelfIntersectionCount === 0);
  return { geometryMetrics, landmarkMetrics };
}

export function computeNativeHumanSurfaceLandmarkMetricsV1({ landmarkEvaluation, positions, bodyDNA = {} }) {
  const dna = createBodyDNA(bodyDNA);
  const centers = landmarkEvaluation.landmarks.filter((landmark) => landmark.landmarkType === 'anatomical-center');
  const errors = centers.map((landmark) => distance(landmark.point, landmark.rigTarget));
  const byId = new Map(landmarkEvaluation.landmarks.map((landmark) => [landmark.landmarkId, landmark]));
  const bounds = computeBounds(positions);
  const shoulderWidthError = pairDistanceError(byId, 'leftShoulderCenter', 'rightShoulderCenter');
  const hipWidthError = pairDistanceError(byId, 'leftHipCenter', 'rightHipCenter');
  const handVertices = landmarkEvaluation.landmarks.filter((landmark) => /WristCenter$/.test(landmark.landmarkId));
  const expectedArmSpan = handVertices.length === 2
    ? distance(handVertices[0].rigTarget, handVertices[1].rigTarget)
    : bounds.max[0] - bounds.min[0];
  const measuredArmSpan = bounds.max[0] - bounds.min[0];
  const legLengthErrors = ['left', 'right'].map((side) => {
    const hip = byId.get(`${side}HipCenter`);
    const ankle = byId.get(`${side}AnkleCenter`);
    if (!hip || !ankle) return 0;
    return Math.abs(distance(hip.point, ankle.point) - distance(hip.rigTarget, ankle.rigTarget));
  });
  const metrics = {
    schema: NATIVE_HUMAN_SURFACE_METRICS_V1_SCHEMA,
    type: 'NativeHumanSurfaceLandmarkMetricsV1',
    bodyDNAId: dna.bodyDNAId,
    measuredLandmarkCount: centers.length,
    maximumLandmarkError: errors.length ? Math.max(...errors) : 0,
    meanLandmarkError: errors.length ? errors.reduce((sum, value) => sum + value, 0) / errors.length : 0,
    heightError: Math.abs((bounds.max[1] - bounds.min[1]) - dna.proportion.height),
    shoulderWidthError,
    hipWidthError,
    armSpanError: Math.abs(measuredArmSpan - expectedArmSpan),
    legLengthError: Math.max(...legLengthErrors),
    definitionsDistinguishSkinAndCenters: landmarkEvaluation.definitionsDistinguishSkinAndCenters === true,
    targets: {
      maximumLandmarkError: 0.02,
      meanLandmarkError: 0.008,
      heightError: 0.01,
      shoulderWidthError: 0.01,
      hipWidthError: 0.01,
    },
  };
  metrics.passed = metrics.maximumLandmarkError <= metrics.targets.maximumLandmarkError
    && metrics.meanLandmarkError <= metrics.targets.meanLandmarkError
    && metrics.heightError <= metrics.targets.heightError
    && metrics.shoulderWidthError <= metrics.targets.shoulderWidthError
    && metrics.hipWidthError <= metrics.targets.hipWidthError;
  return metrics;
}

export function measureNativeHumanSurfaceSymmetryV1(evaluation, topology = createNativeHumanSurfaceTopologyV1()) {
  assertEvaluation(evaluation, topology);
  let maximumPositionError = 0;
  let maximumNormalError = 0;
  for (const vertex of topology.vertices) {
    const partner = topology.vertices[vertex.symmetryPartner];
    if (partner.vertexId < vertex.vertexId) continue;
    const leftOffset = vertex.vertexId * 3;
    const rightOffset = partner.vertexId * 3;
    maximumPositionError = Math.max(maximumPositionError,
      Math.abs(evaluation.positions[leftOffset] + evaluation.positions[rightOffset]),
      Math.abs(evaluation.positions[leftOffset + 1] - evaluation.positions[rightOffset + 1]),
      Math.abs(evaluation.positions[leftOffset + 2] - evaluation.positions[rightOffset + 2]));
    maximumNormalError = Math.max(maximumNormalError,
      Math.abs(evaluation.normals[leftOffset] + evaluation.normals[rightOffset]),
      Math.abs(evaluation.normals[leftOffset + 1] - evaluation.normals[rightOffset + 1]),
      Math.abs(evaluation.normals[leftOffset + 2] - evaluation.normals[rightOffset + 2]));
  }
  return { maximumPositionError, maximumNormalError, mirrored: maximumPositionError <= 1e-9 && maximumNormalError <= 1e-8 };
}

function auditEdges(indices, vertexCount) {
  const edges = new Map();
  const parent = Array.from({ length: vertexCount }, (_, index) => index);
  const find = (value) => {
    let cursor = value;
    while (parent[cursor] !== cursor) {
      parent[cursor] = parent[parent[cursor]];
      cursor = parent[cursor];
    }
    return cursor;
  };
  const union = (left, right) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent[b] = a;
  };
  for (let cursor = 0; cursor < indices.length; cursor += 3) {
    const face = [indices[cursor], indices[cursor + 1], indices[cursor + 2]];
    for (let edge = 0; edge < 3; edge += 1) {
      const a = face[edge];
      const b = face[(edge + 1) % 3];
      union(a, b);
      const low = Math.min(a, b);
      const high = Math.max(a, b);
      const key = `${low}:${high}`;
      const record = edges.get(key) ?? { count: 0, directionSum: 0 };
      record.count += 1;
      record.directionSum += a === low ? 1 : -1;
      edges.set(key, record);
    }
  }
  const activeVertices = new Set(indices);
  const components = new Set([...activeVertices].map(find));
  const records = [...edges.values()];
  return {
    edgeCount: edges.size,
    connectedComponentCount: components.size,
    boundaryEdgeCount: records.filter((record) => record.count === 1).length,
    nonManifoldEdgeCount: records.filter((record) => record.count !== 2).length,
    triangleWindingConsistency: records.every((record) => record.count === 2 && record.directionSum === 0),
  };
}

function auditTriangles(positions, indices) {
  let minimumTriangleArea = Infinity;
  let maximumTriangleAspectRatio = 0;
  let degenerateTriangleCount = 0;
  let signedVolume = 0;
  for (let cursor = 0; cursor < indices.length; cursor += 3) {
    const a = point(positions, indices[cursor]);
    const b = point(positions, indices[cursor + 1]);
    const c = point(positions, indices[cursor + 2]);
    const ab = subtract(b, a);
    const ac = subtract(c, a);
    const bc = subtract(c, b);
    const doubleArea = length(cross(ab, ac));
    const area = doubleArea * 0.5;
    if (area <= 1e-14) degenerateTriangleCount += 1;
    minimumTriangleArea = Math.min(minimumTriangleArea, area);
    const maximumEdge = Math.max(length(ab), length(ac), length(bc));
    maximumTriangleAspectRatio = Math.max(maximumTriangleAspectRatio, doubleArea > 0 ? maximumEdge * maximumEdge / doubleArea : Infinity);
    signedVolume += dot(a, cross(b, c)) / 6;
  }
  return {
    minimumTriangleArea,
    maximumTriangleAspectRatio,
    degenerateTriangleRatio: degenerateTriangleCount / (indices.length / 3),
    signedVolume,
  };
}

function auditNormals(normals) {
  let normalLengthError = 0;
  for (let cursor = 0; cursor < normals.length; cursor += 3) {
    normalLengthError = Math.max(normalLengthError, Math.abs(Math.hypot(normals[cursor], normals[cursor + 1], normals[cursor + 2]) - 1));
  }
  return { normalLengthError };
}

function auditFinite(...arrays) {
  let NaNCount = 0;
  let InfCount = 0;
  for (const values of arrays) {
    for (const value of values) {
      if (Number.isNaN(value)) NaNCount += 1;
      else if (!Number.isFinite(value)) InfCount += 1;
    }
  }
  return { NaNCount, InfCount };
}

function computeBounds(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let cursor = 0; cursor < positions.length; cursor += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], positions[cursor + axis]);
      max[axis] = Math.max(max[axis], positions[cursor + axis]);
    }
  }
  return { min, max, size: max.map((value, axis) => value - min[axis]) };
}

function detectTriangleSelfIntersections(positions, indices, topology) {
  const triangleCount = indices.length / 3;
  const triangles = Array.from({ length: triangleCount }, (_, triangleId) => {
    const ids = [indices[triangleId * 3], indices[triangleId * 3 + 1], indices[triangleId * 3 + 2]];
    const points = ids.map((id) => point(positions, id));
    const min = [0, 1, 2].map((axis) => Math.min(...points.map((item) => item[axis])));
    const max = [0, 1, 2].map((axis) => Math.max(...points.map((item) => item[axis])));
    return { triangleId, ids, points, min, max, regions: new Set(ids.map((id) => topology.vertices[id].regionId)) };
  });
  const cellSize = 0.08;
  const cells = new Map();
  for (const triangle of triangles) {
    const start = triangle.min.map((value) => Math.floor(value / cellSize));
    const end = triangle.max.map((value) => Math.floor(value / cellSize));
    for (let x = start[0]; x <= end[0]; x += 1) {
      for (let y = start[1]; y <= end[1]; y += 1) {
        for (let z = start[2]; z <= end[2]; z += 1) {
          const key = `${x}:${y}:${z}`;
          if (!cells.has(key)) cells.set(key, []);
          cells.get(key).push(triangle.triangleId);
        }
      }
    }
  }
  const checked = new Set();
  const pairs = [];
  for (const triangleIds of cells.values()) {
    for (let left = 0; left < triangleIds.length; left += 1) {
      for (let right = left + 1; right < triangleIds.length; right += 1) {
        const aId = Math.min(triangleIds[left], triangleIds[right]);
        const bId = Math.max(triangleIds[left], triangleIds[right]);
        const key = aId * triangleCount + bId;
        if (checked.has(key)) continue;
        checked.add(key);
        const a = triangles[aId];
        const b = triangles[bId];
        if (a.ids.some((id) => b.ids.includes(id))) continue;
        if (!aabbOverlap(a, b, 1e-9)) continue;
        if (!trianglesIntersect(a.points, b.points, 1e-9)) continue;
        const sameRegion = [...a.regions].some((region) => b.regions.has(region));
        pairs.push({ triangleA: aId, triangleB: bId, critical: !sameRegion, regionsA: [...a.regions], regionsB: [...b.regions] });
      }
    }
  }
  return {
    criticalSelfIntersectionCount: pairs.filter((pair) => pair.critical).length,
    totalSelfIntersectionCount: pairs.length,
    pairs: pairs.slice(0, 100),
    skipped: false,
  };
}

function trianglesIntersect(left, right, epsilon) {
  const edges = [[0, 1], [1, 2], [2, 0]];
  for (const [a, b] of edges) if (segmentTriangle(left[a], left[b], right, epsilon)) return true;
  for (const [a, b] of edges) if (segmentTriangle(right[a], right[b], left, epsilon)) return true;
  return false;
}

function segmentTriangle(start, end, triangle, epsilon) {
  const direction = subtract(end, start);
  const edge1 = subtract(triangle[1], triangle[0]);
  const edge2 = subtract(triangle[2], triangle[0]);
  const p = cross(direction, edge2);
  const determinant = dot(edge1, p);
  if (Math.abs(determinant) <= epsilon) return false;
  const inverse = 1 / determinant;
  const tVector = subtract(start, triangle[0]);
  const u = dot(tVector, p) * inverse;
  if (u <= epsilon || u >= 1 - epsilon) return false;
  const q = cross(tVector, edge1);
  const v = dot(direction, q) * inverse;
  if (v <= epsilon || u + v >= 1 - epsilon) return false;
  const t = dot(edge2, q) * inverse;
  return t > epsilon && t < 1 - epsilon;
}

function aabbOverlap(left, right, epsilon) {
  return [0, 1, 2].every((axis) => left.max[axis] + epsilon >= right.min[axis] && right.max[axis] + epsilon >= left.min[axis]);
}

function pairDistanceError(byId, leftId, rightId) {
  const left = byId.get(leftId);
  const right = byId.get(rightId);
  if (!left || !right) return Infinity;
  return Math.abs(distance(left.point, right.point) - distance(left.rigTarget, right.rigTarget));
}

function assertEvaluation(evaluation, topology) {
  if (evaluation?.topologyFingerprint !== topology.topologyFingerprint) throw new Error('Native metrics topology mismatch.');
  if (!evaluation.positions || evaluation.positions.length !== topology.vertexCount * 3) throw new Error('Native metrics positions mismatch.');
  if (!evaluation.normals || evaluation.normals.length !== topology.vertexCount * 3) throw new Error('Native metrics normals mismatch.');
  if (!evaluation.indices || evaluation.indices.length !== topology.indices.length) throw new Error('Native metrics indices mismatch.');
}

function point(positions, vertexId) {
  const offset = vertexId * 3;
  return [positions[offset], positions[offset + 1], positions[offset + 2]];
}
function subtract(left, right) { return [left[0] - right[0], left[1] - right[1], left[2] - right[2]]; }
function cross(left, right) { return [left[1] * right[2] - left[2] * right[1], left[2] * right[0] - left[0] * right[2], left[0] * right[1] - left[1] * right[0]]; }
function dot(left, right) { return left[0] * right[0] + left[1] * right[1] + left[2] * right[2]; }
function length(value) { return Math.hypot(value[0], value[1], value[2]); }
function distance(left, right) { return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]); }
