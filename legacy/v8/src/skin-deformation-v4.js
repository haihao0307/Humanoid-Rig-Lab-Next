export function blendHybridPositions(lbsPositions, dqsPositions, hybridMask, output = null) {
  if (!lbsPositions || !dqsPositions || lbsPositions.length !== dqsPositions.length) {
    throw new Error('Hybrid deformation requires equal-length LBS and DQS position buffers.');
  }
  const vertexCount = lbsPositions.length / 3;
  if (!hybridMask || hybridMask.length !== vertexCount) {
    throw new Error(`Hybrid mask must contain ${vertexCount} vertex values.`);
  }
  const result = output ?? new Float32Array(lbsPositions.length);
  if (result.length !== lbsPositions.length) {
    throw new Error('Hybrid output length must match the deformation buffers.');
  }
  for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
    const amount = clamp(Number(hybridMask[vertexIndex]) || 0, 0, 1);
    const offset = vertexIndex * 3;
    result[offset] = lerp(lbsPositions[offset], dqsPositions[offset], amount);
    result[offset + 1] = lerp(lbsPositions[offset + 1], dqsPositions[offset + 1], amount);
    result[offset + 2] = lerp(lbsPositions[offset + 2], dqsPositions[offset + 2], amount);
  }
  return result;
}

export function measureRadiusRetention(restPositions, deformedPositions, axis = 'x') {
  if (!restPositions || restPositions.length !== deformedPositions?.length) {
    throw new Error('Radius retention requires equal-length rest and deformed buffers.');
  }
  const axisIndex = axis === 'y' ? 1 : axis === 'z' ? 2 : 0;
  let restRadius = 0;
  let deformedRadius = 0;
  const vertexCount = restPositions.length / 3;
  for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
    const offset = vertexIndex * 3;
    const rest = [];
    const deformed = [];
    for (let component = 0; component < 3; component += 1) {
      if (component === axisIndex) continue;
      rest.push(restPositions[offset + component]);
      deformed.push(deformedPositions[offset + component]);
    }
    restRadius += Math.hypot(...rest);
    deformedRadius += Math.hypot(...deformed);
  }
  const meanRestRadius = restRadius / Math.max(1, vertexCount);
  const meanDeformedRadius = deformedRadius / Math.max(1, vertexCount);
  return {
    meanRestRadius,
    meanDeformedRadius,
    retention: meanRestRadius > 1e-12 ? meanDeformedRadius / meanRestRadius : 1,
  };
}

function lerp(a, b, amount) {
  return a + (b - a) * amount;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
