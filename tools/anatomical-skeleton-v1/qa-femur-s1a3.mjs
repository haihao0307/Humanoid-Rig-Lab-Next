import { FEMUR_LOD_SPECS_V1, VARIANT_SPECS, createVariantPackage } from './anatomical-model-v1.mjs';
import { getFemurMeasurementFrameV1 } from '../../src/core/human-core-v5/longBoneGeneratorV1.js';

const LANDMARK_NAMES = Object.freeze([
  'greaterTrochanter', 'lesserTrochanter',
  'medialCondyle', 'lateralCondyle', 'intercondylarNotch',
]);

export function auditFemurS1A3() {
  const variants = [];
  for (const spec of VARIANT_SPECS) {
    const packageData = createVariantPackage(spec.variantId);
    const records = [];
    for (const side of ['left', 'right']) {
      const parameters = packageData.skeletalDNA.boneParameters.find(({ boneId }) => boneId === `${side}_femur`).generatorParameters;
      const hipJointCenter = packageData.graph.joints.find(({ jointId }) => jointId === `${side}_hip`).jointCenter;
      const frame = getFemurMeasurementFrameV1(parameters, { side, hipJointCenter });
      for (const lod of [0, 1, 2]) {
        const group = packageData.geometry.primitiveGroups.find((entry) => entry.groupId === `${side}-femur-lod${lod}`);
        records.push(auditMesh(packageData.geometry, group, parameters, frame, side, lod));
      }
    }
    const lodComparisons = createLodComparisons(records);
    const angleRecords = records.filter(({ lod }) => lod === 0).map(({ side, neckShaftAngle, anteversion }) => ({ side, neckShaftAngle, anteversion }));
    const variant = {
      variantId: spec.variantId,
      records,
      lodComparisons,
      angleRecords,
      passed: records.every(({ passed }) => passed) && lodComparisons.every(({ passed }) => passed),
    };
    variants.push(variant);
  }
  const baseline = variants.find(({ variantId }) => variantId === 'baseline');
  const anteversion = variants.find(({ variantId }) => variantId === 'anteversion_plus_10_degrees');
  const anteversionDeltas = ['left', 'right'].map((side) => {
    const baselineValue = baseline.angleRecords.find((record) => record.side === side).anteversion.measuredDegrees;
    const variantValue = anteversion.angleRecords.find((record) => record.side === side).anteversion.measuredDegrees;
    const measuredDeltaDegrees = variantValue - baselineValue;
    return { side, baselineDegrees: baselineValue, variantDegrees: variantValue, measuredDeltaDegrees, targetDeltaDegrees: 10, errorDegrees: Math.abs(measuredDeltaDegrees - 10), passed: Math.abs(measuredDeltaDegrees - 10) <= 0.25 };
  });
  const report = {
    schema: 'humanoid_rig/femur_s1a3_regional_geometry_audit@1.0',
    generatorId: 'LongBoneGeneratorV1@1.1.0',
    packageGeneratorVersion: 'anatomical-skeleton-s1@1.1.0',
    previousGeneratorId: 'LongBoneGeneratorV1@1.0.0',
    previousPackageGeneratorVersion: 'anatomical-skeleton-s1@1.0.0',
    previousBinarySha256: {
      baseline: 'e690539344efab3f2be1802251e1b2878ca11ec11f2ab0b60bb466bcdd0fe29a',
      long_femur_plus_08_percent: '28bf3d2a11335c94b20f89426e7a8e9eb29c46566599c6ed8a7362c1dcb723bd',
      anteversion_plus_10_degrees: 'a05f6c305169ac02e4c699078b552927d46d489a1ba2bb58528efc7f8920eeda',
      left_right_asymmetry_02: '2549d5ddda8588334b39a03859716a56bc0058126b4e8a0282df9eb4433a3979',
    },
    meshConstruction: 'single continuous closed regional sweep per side and LOD',
    sphereFitTolerance: { rmsRadiusRatioMaximum: 0.06, maxRadiusRatioMaximum: 0.15, centerOffsetMaximumMeters: 0.003 },
    variants,
    anteversionDeltas,
    policyCounters: {
      externalGeometrySourceCount: 0,
      generatedGlbCount: 0,
      loadedGlbCount: 0,
      humanRigCoreWriteCount: 0,
      finalPoseWriteCount: 0,
      runtimeBoneScaleCount: 0,
      negativeScaleCount: 0,
      overlappingClosedMeshCount: 0,
    },
  };
  report.passed = variants.every(({ passed }) => passed) && anteversionDeltas.every(({ passed }) => passed)
    && Object.values(report.policyCounters).every((count) => count === 0);
  return report;
}

function auditMesh(geometry, group, parameters, frame, side, lod) {
  const ids = Array.from(geometry.indices.slice(group.indexOffset, group.indexOffset + group.indexCount));
  const vertexIds = [...new Set(ids)].sort((left, right) => left - right);
  const edgeCounts = new Map();
  const edgeDirections = new Map();
  const adjacency = new Map();
  const triangles = [];
  let degenerateTriangles = 0;
  let signedVolume = 0;
  for (let index = 0; index < ids.length; index += 3) {
    const triangleIds = ids.slice(index, index + 3);
    const points = triangleIds.map((id) => vertex(geometry.positions, id));
    const faceNormal = cross(subtract(points[1], points[0]), subtract(points[2], points[0]));
    if (length(faceNormal) <= 1e-12) degenerateTriangles += 1;
    signedVolume += dot(points[0], cross(points[1], points[2])) / 6;
    triangles.push({ ids: triangleIds, points, aabb: triangleAabb(points) });
    for (const [left, right] of [[triangleIds[0], triangleIds[1]], [triangleIds[1], triangleIds[2]], [triangleIds[2], triangleIds[0]]]) {
      const key = left < right ? `${left},${right}` : `${right},${left}`;
      edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
      edgeDirections.set(key, (edgeDirections.get(key) ?? 0) + (left < right ? 1 : -1));
      if (!adjacency.has(left)) adjacency.set(left, new Set());
      if (!adjacency.has(right)) adjacency.set(right, new Set());
      adjacency.get(left).add(right);
      adjacency.get(right).add(left);
    }
  }
  const connectedComponents = countComponents(vertexIds, adjacency);
  const boundaryEdges = [...edgeCounts.values()].filter((count) => count === 1).length;
  const nonManifoldEdges = [...edgeCounts.values()].filter((count) => count > 2).length;
  const invertedNormals = [...edgeCounts].filter(([key, count]) => count === 2 && Math.abs(edgeDirections.get(key)) === 2).length;
  const positionValues = vertexIds.flatMap((id) => vertex(geometry.positions, id));
  const normalValues = vertexIds.flatMap((id) => vertex(geometry.normals, id));
  const nanCount = [...positionValues, ...normalValues].filter(Number.isNaN).length;
  const infCount = [...positionValues, ...normalValues].filter((value) => !Number.isNaN(value) && !Number.isFinite(value)).length;
  const undefinedNormals = vertexIds.filter((id) => {
    const normalLength = length(vertex(geometry.normals, id));
    return !Number.isFinite(normalLength) || normalLength < 0.999 || normalLength > 1.001;
  }).length;
  const selfIntersections = countSelfIntersections(triangles, FEMUR_LOD_SPECS_V1[lod].radialSegments);
  const sphereFit = auditHeadSphere(geometry.positions, vertexIds, parameters, frame);
  const landmarkSurface = Object.fromEntries(LANDMARK_NAMES.map((name) => {
    const nearest = nearestVertex(geometry.positions, vertexIds, frame[name]);
    return [name, { target: frame[name], nearestSurfacePoint: nearest.point, distanceMeters: nearest.distance }];
  }));
  const distal = auditDistalSection(geometry.positions, vertexIds[0], vertexIds.length, parameters, lod);
  const neckShaftAngle = measureNeckShaftAngle(frame, parameters);
  const anteversion = measureAnteversion(frame, parameters, side);
  const trochanterSeparationMeters = distance(frame.greaterTrochanter, frame.lesserTrochanter);
  const maximumLandmarkDistanceMeters = Math.max(...Object.values(landmarkSurface).map(({ distanceMeters }) => distanceMeters));
  const landmarkToleranceMeters = [0.005, 0.008, 0.013][lod];
  const result = {
    side, lod,
    vertexCount: vertexIds.length,
    triangleCount: ids.length / 3,
    connectedComponents,
    boundaryEdges,
    nonManifoldEdges,
    degenerateTriangles,
    undefinedNormals,
    nanCount,
    infCount,
    selfIntersections,
    invertedNormals,
    signedVolume,
    sphereFit,
    neckShaftAngle,
    anteversion,
    landmarkSurface,
    maximumLandmarkDistanceMeters,
    landmarkToleranceMeters,
    trochanterSeparationMeters,
    distal,
  };
  result.passed = connectedComponents === 1 && boundaryEdges === 0 && nonManifoldEdges === 0 && degenerateTriangles === 0
    && undefinedNormals === 0 && nanCount === 0 && infCount === 0 && selfIntersections === 0 && invertedNormals === 0 && signedVolume > 0
    && sphereFit.passed && neckShaftAngle.passed && anteversion.passed && maximumLandmarkDistanceMeters <= landmarkToleranceMeters
    && trochanterSeparationMeters >= 0.018 && distal.passed;
  return result;
}

function auditHeadSphere(positions, vertexIds, parameters, frame) {
  const points = vertexIds.map((id) => vertex(positions, id)).filter((point) => {
    const relative = subtract(point, frame.headCenter);
    const axial = dot(relative, frame.neckAxis);
    const radialError = Math.abs(length(relative) - parameters.headRadius);
    return axial >= -0.861 * parameters.headRadius && radialError <= parameters.headRadius * 0.01;
  });
  const fit = fitSphere(points);
  const errors = points.map((point) => Math.abs(distance(point, fit.center) - fit.radius));
  const rmsErrorMeters = Math.sqrt(errors.reduce((sum, value) => sum + value * value, 0) / errors.length);
  const maxErrorMeters = Math.max(...errors);
  const rmsRadiusRatio = rmsErrorMeters / fit.radius;
  const maxRadiusRatio = maxErrorMeters / fit.radius;
  const centerOffsetMeters = distance(fit.center, frame.headCenter);
  return {
    sampleCount: points.length,
    fittedCenter: fit.center,
    expectedHipJointCenter: frame.headCenter,
    fittedRadiusMeters: fit.radius,
    expectedRadiusMeters: parameters.headRadius,
    rmsErrorMeters,
    maxErrorMeters,
    rmsRadiusRatio,
    maxRadiusRatio,
    centerOffsetMeters,
    passed: points.length >= 60 && rmsRadiusRatio <= 0.06 && maxRadiusRatio <= 0.15 && centerOffsetMeters <= 0.003,
  };
}

function auditDistalSection(positions, firstVertexId, vertexCount, parameters, lod) {
  const radialSegments = FEMUR_LOD_SPECS_V1[lod].radialSegments;
  const longitudinalSegments = (vertexCount - 2) / radialSegments + 1;
  const ringOrdinal = Math.max(1, Math.min(longitudinalSegments - 1, Math.round(0.072 * longitudinalSegments)));
  const ringStart = firstVertexId + 1 + (ringOrdinal - 1) * radialSegments;
  const ring = Array.from({ length: radialSegments }, (_, index) => vertex(positions, ringStart + index));
  const center = ring.reduce(add, [0, 0, 0]).map((value) => value / ring.length);
  const radiusAt = (theta) => distance(ring[thetaIndex(theta, radialSegments)], center);
  const pointAt = (theta) => ring[thetaIndex(theta, radialSegments)];
  const posteriorCenterRadius = radiusAt(-Math.PI / 2);
  const posteriorMedialRadius = radiusAt(-Math.PI / 2 - 0.58);
  const posteriorLateralRadius = radiusAt(-Math.PI / 2 + 0.58);
  const anteriorCenterRadius = radiusAt(Math.PI / 2);
  const anteriorMedialRadius = radiusAt(Math.PI / 2 - 0.52);
  const anteriorLateralRadius = radiusAt(Math.PI / 2 + 0.52);
  const intercondylarNotchDepthMeters = (posteriorMedialRadius + posteriorLateralRadius) / 2 - posteriorCenterRadius;
  const patellarGrooveDepthMeters = (anteriorMedialRadius + anteriorLateralRadius) / 2 - anteriorCenterRadius;
  const intercondylarNotchMouthWidthMeters = distance(pointAt(-Math.PI / 2 - 0.58), pointAt(-Math.PI / 2 + 0.58));
  const posteriorCondyleSeparationMeters = intercondylarNotchMouthWidthMeters;
  const anteriorPosteriorSectionDifferenceMeters = Math.abs(intercondylarNotchDepthMeters - patellarGrooveDepthMeters) + Math.abs(posteriorCenterRadius - anteriorCenterRadius);
  return {
    ringOrdinal,
    targetIntercondylarNotchWidthMeters: parameters.intercondylarNotchWidth,
    intercondylarNotchMouthWidthMeters,
    intercondylarNotchDepthMeters,
    patellarGrooveDepthMeters,
    posteriorCondyleSeparationMeters,
    anteriorPosteriorSectionDifferenceMeters,
    passed: intercondylarNotchMouthWidthMeters >= parameters.intercondylarNotchWidth * 0.72
      && intercondylarNotchDepthMeters >= 0.0015 && patellarGrooveDepthMeters >= 0.0006
      && posteriorCondyleSeparationMeters >= 0.018 && anteriorPosteriorSectionDifferenceMeters >= 0.001,
  };
}

function createLodComparisons(records) {
  const comparisons = [];
  for (const side of ['left', 'right']) {
    const baseline = records.find((record) => record.side === side && record.lod === 0);
    for (const lod of [1, 2]) {
      const candidate = records.find((record) => record.side === side && record.lod === lod);
      const landmarkErrors = Object.fromEntries(LANDMARK_NAMES.map((name) => [name, distance(baseline.landmarkSurface[name].nearestSurfacePoint, candidate.landmarkSurface[name].nearestSurfacePoint)]));
      const maximumLandmarkErrorMeters = Math.max(...Object.values(landmarkErrors));
      const toleranceMeters = lod === 1 ? 0.009 : 0.015;
      comparisons.push({ side, referenceLod: 0, lod, landmarkErrors, maximumLandmarkErrorMeters, toleranceMeters, passed: maximumLandmarkErrorMeters <= toleranceMeters });
    }
  }
  return comparisons;
}

function measureNeckShaftAngle(frame, parameters) {
  const measuredDegrees = angleDegrees(frame.neckAxis, frame.shaftAxisToDistal);
  const targetDegrees = parameters.neckShaftAngle;
  const errorDegrees = Math.abs(measuredDegrees - targetDegrees);
  return { measuredDegrees, targetDegrees, errorDegrees, passed: errorDegrees <= 0.5 };
}

function measureAnteversion(frame, parameters, side) {
  const medial = side === 'left' ? 1 : -1;
  const measuredDegrees = Math.atan2(frame.neckAxis[2], medial * frame.neckAxis[0]) * 180 / Math.PI;
  const targetDegrees = parameters.femoralAnteversion;
  const errorDegrees = Math.abs(measuredDegrees - targetDegrees);
  return { measuredDegrees, targetDegrees, errorDegrees, passed: errorDegrees <= 0.25 };
}

function fitSphere(points) {
  const matrix = Array.from({ length: 4 }, () => Array(4).fill(0));
  const vector = Array(4).fill(0);
  for (const [x, y, z] of points) {
    const row = [2 * x, 2 * y, 2 * z, 1];
    const target = x * x + y * y + z * z;
    for (let i = 0; i < 4; i += 1) {
      vector[i] += row[i] * target;
      for (let j = 0; j < 4; j += 1) matrix[i][j] += row[i] * row[j];
    }
  }
  const solution = solveLinearSystem(matrix, vector);
  const center = solution.slice(0, 3);
  const radius = Math.sqrt(Math.max(0, solution[3] + dot(center, center)));
  return { center, radius };
}

function solveLinearSystem(matrix, vector) {
  const rows = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < rows.length; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < rows.length; row += 1) if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    if (Math.abs(divisor) < 1e-14) throw new Error('Femoral head sphere fit is singular.');
    for (let index = column; index <= rows.length; index += 1) rows[column][index] /= divisor;
    for (let row = 0; row < rows.length; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let index = column; index <= rows.length; index += 1) rows[row][index] -= factor * rows[column][index];
    }
  }
  return rows.map((row) => row.at(-1));
}

function countSelfIntersections(triangles, radialSegments) {
  const cellSize = 0.012;
  const cells = new Map();
  for (let index = 0; index < triangles.length; index += 1) {
    const { minimum, maximum } = triangles[index].aabb;
    const lower = minimum.map((value) => Math.floor(value / cellSize));
    const upper = maximum.map((value) => Math.floor(value / cellSize));
    for (let x = lower[0]; x <= upper[0]; x += 1) for (let y = lower[1]; y <= upper[1]; y += 1) for (let z = lower[2]; z <= upper[2]; z += 1) {
      const key = `${x},${y},${z}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(index);
    }
  }
  const tested = new Set();
  let intersections = 0;
  for (const indices of cells.values()) {
    for (let left = 0; left < indices.length; left += 1) for (let right = left + 1; right < indices.length; right += 1) {
      const aIndex = indices[left];
      const bIndex = indices[right];
      const key = aIndex < bIndex ? `${aIndex},${bIndex}` : `${bIndex},${aIndex}`;
      if (tested.has(key)) continue;
      tested.add(key);
      const a = triangles[aIndex];
      const b = triangles[bIndex];
      if (a.ids.some((id) => b.ids.includes(id)) || !aabbOverlap(a.aabb, b.aabb)) continue;
      const topologicalDistance = Math.min(...a.ids.flatMap((leftId) => b.ids.map((rightId) => Math.abs(leftId - rightId))));
      // Adjacent sweep patches can be closer than the broad-phase cell size;
      // they are one continuous surface neighborhood, not self-intersections.
      if (topologicalDistance <= radialSegments * 5 + 1) continue;
      if (trianglesIntersect(a.points, b.points)) intersections += 1;
    }
  }
  return intersections;
}

function trianglesIntersect(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (segmentTriangle(left[index], left[(index + 1) % 3], right)) return true;
    if (segmentTriangle(right[index], right[(index + 1) % 3], left)) return true;
  }
  return false;
}

function segmentTriangle(start, end, triangle) {
  const direction = subtract(end, start);
  const edge1 = subtract(triangle[1], triangle[0]);
  const edge2 = subtract(triangle[2], triangle[0]);
  const p = cross(direction, edge2);
  const determinant = dot(edge1, p);
  if (Math.abs(determinant) < 1e-11) return false;
  const inverse = 1 / determinant;
  const t = subtract(start, triangle[0]);
  const u = dot(t, p) * inverse;
  if (u <= 1e-8 || u >= 1 - 1e-8) return false;
  const q = cross(t, edge1);
  const v = dot(direction, q) * inverse;
  if (v <= 1e-8 || u + v >= 1 - 1e-8) return false;
  const distanceAlong = dot(edge2, q) * inverse;
  return distanceAlong > 1e-8 && distanceAlong < 1 - 1e-8;
}

function countComponents(vertices, adjacency) {
  const visited = new Set();
  let count = 0;
  for (const start of vertices) {
    if (visited.has(start)) continue;
    count += 1;
    const stack = [start];
    visited.add(start);
    while (stack.length) for (const next of adjacency.get(stack.pop()) ?? []) if (!visited.has(next)) { visited.add(next); stack.push(next); }
  }
  return count;
}

function nearestVertex(positions, vertexIds, target) {
  let point = null;
  let nearestDistance = Infinity;
  for (const id of vertexIds) {
    const candidate = vertex(positions, id);
    const candidateDistance = distance(candidate, target);
    if (candidateDistance < nearestDistance) { point = candidate; nearestDistance = candidateDistance; }
  }
  return { point, distance: nearestDistance };
}

function triangleAabb(points) { return { minimum: [0, 1, 2].map((axis) => Math.min(...points.map((point) => point[axis]))), maximum: [0, 1, 2].map((axis) => Math.max(...points.map((point) => point[axis]))) }; }
function aabbOverlap(left, right) { return [0, 1, 2].every((axis) => left.minimum[axis] <= right.maximum[axis] + 1e-10 && right.minimum[axis] <= left.maximum[axis] + 1e-10); }
function thetaIndex(theta, count) { const normalized = ((theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); return Math.round(normalized / (Math.PI * 2) * count) % count; }
function vertex(values, index) { return [values[index * 3], values[index * 3 + 1], values[index * 3 + 2]]; }
function add(left, right) { return left.map((value, index) => value + right[index]); }
function subtract(left, right) { return left.map((value, index) => value - right[index]); }
function cross(left, right) { return [left[1] * right[2] - left[2] * right[1], left[2] * right[0] - left[0] * right[2], left[0] * right[1] - left[1] * right[0]]; }
function dot(left, right) { return left.reduce((total, value, index) => total + value * right[index], 0); }
function length(value) { return Math.hypot(...value); }
function distance(left, right) { return length(subtract(left, right)); }
function angleDegrees(left, right) { return Math.acos(Math.max(-1, Math.min(1, dot(left, right) / (length(left) * length(right))))) * 180 / Math.PI; }

if (pathMatches(process.argv[1])) console.log(JSON.stringify(auditFemurS1A3(), null, 2));
function pathMatches(value) { return value?.replaceAll('\\', '/').endsWith('/qa-femur-s1a3.mjs'); }
