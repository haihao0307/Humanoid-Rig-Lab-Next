export function countSelfIntersectionsV1(positions, indices, { cellSize = 0.03, evidenceLimit = 32 } = {}) {
  const triangleCount = indices.length / 3;
  const triangles = new Array(triangleCount);
  const grid = new Map();
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const vertices = [indices[triangle * 3], indices[triangle * 3 + 1], indices[triangle * 3 + 2]];
    const points = vertices.map((vertex) => [positions[vertex * 3], positions[vertex * 3 + 1], positions[vertex * 3 + 2]]);
    const min = [0, 1, 2].map((component) => Math.min(points[0][component], points[1][component], points[2][component]));
    const max = [0, 1, 2].map((component) => Math.max(points[0][component], points[1][component], points[2][component]));
    triangles[triangle] = { vertices, points, min, max };
    const low = min.map((value) => Math.floor(value / cellSize));
    const high = max.map((value) => Math.floor(value / cellSize));
    for (let x = low[0]; x <= high[0]; x += 1) for (let y = low[1]; y <= high[1]; y += 1) for (let z = low[2]; z <= high[2]; z += 1) {
      const key = `${x}/${y}/${z}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(triangle);
    }
  }

  const tested = new Set();
  const evidence = [];
  let candidatePairCount = 0;
  let intersectionCount = 0;
  for (const bucket of grid.values()) {
    for (let leftIndex = 0; leftIndex < bucket.length; leftIndex += 1) for (let rightIndex = leftIndex + 1; rightIndex < bucket.length; rightIndex += 1) {
      const leftId = Math.min(bucket[leftIndex], bucket[rightIndex]);
      const rightId = Math.max(bucket[leftIndex], bucket[rightIndex]);
      const pairKey = leftId * triangleCount + rightId;
      if (tested.has(pairKey)) continue;
      tested.add(pairKey);
      const left = triangles[leftId]; const right = triangles[rightId];
      if (left.vertices.some((vertex) => right.vertices.includes(vertex))) continue;
      if (!aabbOverlap(left, right)) continue;
      candidatePairCount += 1;
      if (!trianglesIntersect(left.points, right.points)) continue;
      intersectionCount += 1;
      if (evidence.length < evidenceLimit) evidence.push({ leftTriangle: leftId, rightTriangle: rightId, leftVertices: left.vertices, rightVertices: right.vertices });
    }
  }
  return { selfIntersectionCount: intersectionCount, candidatePairCount, testedPairCount: tested.size, gridCellSize: cellSize, evidence };
}

function trianglesIntersect(left, right) {
  const leftNormal = normal(left);
  const rightNormal = normal(right);
  const leftNormalLength = Math.hypot(...leftNormal);
  const rightNormalLength = Math.hypot(...rightNormal);
  if (leftNormalLength <= 1e-20 || rightNormalLength <= 1e-20) return false;
  const crossNormals = cross(leftNormal, rightNormal);
  const parallel = Math.hypot(...crossNormals) <= leftNormalLength * rightNormalLength * 1e-8;
  if (parallel) {
    const planeDistance = Math.abs(dot(leftNormal, subtract(right[0], left[0]))) / leftNormalLength;
    if (planeDistance > 1e-8) return false;
    return coplanarTrianglesOverlap(left, right, leftNormal);
  }
  for (let edge = 0; edge < 3; edge += 1) if (segmentIntersectsTriangle(left[edge], left[(edge + 1) % 3], right)) return true;
  for (let edge = 0; edge < 3; edge += 1) if (segmentIntersectsTriangle(right[edge], right[(edge + 1) % 3], left)) return true;
  return false;
}

function segmentIntersectsTriangle(start, end, triangle) {
  const epsilon = 1e-10;
  const direction = subtract(end, start);
  const edge1 = subtract(triangle[1], triangle[0]);
  const edge2 = subtract(triangle[2], triangle[0]);
  const h = cross(direction, edge2);
  const determinant = dot(edge1, h);
  if (Math.abs(determinant) < epsilon) return false;
  const inverse = 1 / determinant;
  const s = subtract(start, triangle[0]);
  const u = inverse * dot(s, h);
  if (u < -epsilon || u > 1 + epsilon) return false;
  const q = cross(s, edge1);
  const v = inverse * dot(direction, q);
  if (v < -epsilon || u + v > 1 + epsilon) return false;
  const t = inverse * dot(edge2, q);
  return t > epsilon && t < 1 - epsilon;
}

function coplanarTrianglesOverlap(left, right, normalVector) {
  const axis = dominantAxis(normalVector);
  const project = (point) => axis === 0 ? [point[1], point[2]] : axis === 1 ? [point[0], point[2]] : [point[0], point[1]];
  const a = left.map(project); const b = right.map(project);
  for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) if (segmentsIntersect2d(a[i], a[(i + 1) % 3], b[j], b[(j + 1) % 3])) return true;
  return pointInTriangle2d(a[0], b) || pointInTriangle2d(b[0], a);
}

function segmentsIntersect2d(a, b, c, d) {
  const orient = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const abC = orient(a, b, c); const abD = orient(a, b, d); const cdA = orient(c, d, a); const cdB = orient(c, d, b);
  return ((abC > 1e-12 && abD < -1e-12) || (abC < -1e-12 && abD > 1e-12)) && ((cdA > 1e-12 && cdB < -1e-12) || (cdA < -1e-12 && cdB > 1e-12));
}

function pointInTriangle2d(point, triangle) {
  const sign = (p1, p2, p3) => (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
  const d1 = sign(point, triangle[0], triangle[1]); const d2 = sign(point, triangle[1], triangle[2]); const d3 = sign(point, triangle[2], triangle[0]);
  const hasNegative = d1 < -1e-12 || d2 < -1e-12 || d3 < -1e-12;
  const hasPositive = d1 > 1e-12 || d2 > 1e-12 || d3 > 1e-12;
  return !(hasNegative && hasPositive);
}

function aabbOverlap(left, right) { return left.min.every((value, component) => value <= right.max[component] + 1e-12 && left.max[component] + 1e-12 >= right.min[component]); }
function normal(triangle) { return cross(subtract(triangle[1], triangle[0]), subtract(triangle[2], triangle[0])); }
function subtract(left, right) { return [left[0] - right[0], left[1] - right[1], left[2] - right[2]]; }
function cross(left, right) { return [left[1] * right[2] - left[2] * right[1], left[2] * right[0] - left[0] * right[2], left[0] * right[1] - left[1] * right[0]]; }
function dot(left, right) { return left[0] * right[0] + left[1] * right[1] + left[2] * right[2]; }
function dominantAxis(vector) { const values = vector.map(Math.abs); return values[0] > values[1] ? (values[0] > values[2] ? 0 : 2) : (values[1] > values[2] ? 1 : 2); }
