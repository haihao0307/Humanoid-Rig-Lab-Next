const EPSILON = 1e-30;

export function rebuildDeformedSurfaceNormalsV5({ deformedPositions, indices }) {
  if (!(deformedPositions instanceof Float32Array) || deformedPositions.length % 3) {
    throw new Error('Deformed surface normal rebuild requires packed Float32Array positions.');
  }
  if (!(indices instanceof Uint32Array) || indices.length % 3) {
    throw new Error('Deformed surface normal rebuild requires packed Uint32Array indices.');
  }
  const vertexCount = deformedPositions.length / 3;
  const accumulated = new Float64Array(deformedPositions.length);
  let degenerateTriangleCount = 0;
  for (let offset = 0; offset < indices.length; offset += 3) {
    const ia = indices[offset];
    const ib = indices[offset + 1];
    const ic = indices[offset + 2];
    if (ia >= vertexCount || ib >= vertexCount || ic >= vertexCount) {
      throw new Error(`Surface triangle ${offset / 3} references a missing vertex.`);
    }
    const face = faceNormal(deformedPositions, ia, ib, ic);
    if (squaredLength(face) <= EPSILON) {
      degenerateTriangleCount += 1;
      continue;
    }
    for (const index of [ia, ib, ic]) {
      accumulated[index * 3] += face[0];
      accumulated[index * 3 + 1] += face[1];
      accumulated[index * 3 + 2] += face[2];
    }
  }

  const normals = new Float32Array(deformedPositions.length);
  let invalidNormalCount = 0;
  let minimumNormalLength = Number.POSITIVE_INFINITY;
  let maximumNormalLength = 0;
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const offset = vertex * 3;
    const x = accumulated[offset];
    const y = accumulated[offset + 1];
    const z = accumulated[offset + 2];
    const length = Math.hypot(x, y, z);
    if (!Number.isFinite(length) || length <= EPSILON) {
      invalidNormalCount += 1;
      normals.set(fallbackNormal(deformedPositions, vertex), offset);
    } else {
      normals[offset] = x / length;
      normals[offset + 1] = y / length;
      normals[offset + 2] = z / length;
    }
    const normalizedLength = Math.hypot(normals[offset], normals[offset + 1], normals[offset + 2]);
    minimumNormalLength = Math.min(minimumNormalLength, normalizedLength);
    maximumNormalLength = Math.max(maximumNormalLength, normalizedLength);
  }

  const alignment = analyzeFaceVertexNormalAlignment(deformedPositions, normals, indices);
  return {
    deformedNormals: normals,
    normalDiagnostics: {
      invalidNormalCount,
      degenerateTriangleCount,
      minimumNormalLength: vertexCount ? minimumNormalLength : 0,
      maximumNormalLength,
      faceVertexNormalAlignmentMinimum: alignment.minimum,
      faceVertexNormalAlignmentMean: alignment.mean,
    },
  };
}

export function assertDeformedSurfaceNormalGateV5(diagnostics) {
  const failures = [];
  if (diagnostics.invalidNormalCount !== 0) failures.push('invalid normals');
  if (!(diagnostics.minimumNormalLength >= 0.999)) failures.push('minimum normal length below 0.999');
  if (!(diagnostics.maximumNormalLength <= 1.001)) failures.push('maximum normal length above 1.001');
  if (!(diagnostics.faceVertexNormalAlignmentMean >= 0.85)) failures.push('mean face/vertex normal alignment below 0.85');
  if (failures.length) throw new Error(`Deformed surface normal gate failed: ${failures.join(', ')}. ${JSON.stringify(diagnostics)}`);
  return diagnostics;
}

function analyzeFaceVertexNormalAlignment(positions, normals, indices) {
  let sum = 0;
  let count = 0;
  let minimum = Number.POSITIVE_INFINITY;
  for (let offset = 0; offset < indices.length; offset += 3) {
    const face = faceNormal(positions, indices[offset], indices[offset + 1], indices[offset + 2]);
    const faceLength = Math.hypot(...face);
    if (faceLength <= EPSILON) continue;
    const unitFace = face.map((value) => value / faceLength);
    for (const vertex of [indices[offset], indices[offset + 1], indices[offset + 2]]) {
      const normalOffset = vertex * 3;
      const alignment = unitFace[0] * normals[normalOffset]
        + unitFace[1] * normals[normalOffset + 1]
        + unitFace[2] * normals[normalOffset + 2];
      minimum = Math.min(minimum, alignment);
      sum += alignment;
      count += 1;
    }
  }
  return { minimum: count ? minimum : -1, mean: count ? sum / count : -1 };
}

function faceNormal(positions, ia, ib, ic) {
  const ax = positions[ia * 3]; const ay = positions[ia * 3 + 1]; const az = positions[ia * 3 + 2];
  const abx = positions[ib * 3] - ax; const aby = positions[ib * 3 + 1] - ay; const abz = positions[ib * 3 + 2] - az;
  const acx = positions[ic * 3] - ax; const acy = positions[ic * 3 + 1] - ay; const acz = positions[ic * 3 + 2] - az;
  return [aby * acz - abz * acy, abz * acx - abx * acz, abx * acy - aby * acx];
}

function fallbackNormal(positions, vertex) {
  const x = positions[vertex * 3];
  const y = positions[vertex * 3 + 1];
  const z = positions[vertex * 3 + 2];
  const length = Math.hypot(x, y, z);
  return length > EPSILON ? [x / length, y / length, z / length] : [0, 1, 0];
}

function squaredLength(value) { return value[0] * value[0] + value[1] * value[1] + value[2] * value[2]; }
