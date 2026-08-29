const DEFAULT_CLIP_EPSILON = 1e-8;

export function projectWorldPositionToViewportV1({
  position,
  viewportWidth,
  viewportHeight,
  matrixWorldInverse,
  projectionMatrix,
  clipEpsilon = DEFAULT_CLIP_EPSILON,
} = {}) {
  if (!isFiniteTuple(position, 3)
    || !isFinitePositive(viewportWidth)
    || !isFinitePositive(viewportHeight)
    || !isFiniteTuple(matrixWorldInverse, 16)
    || !isFiniteTuple(projectionMatrix, 16)
    || !isFinitePositive(clipEpsilon)) return null;

  const cameraSpace = multiplyMatrix4Vector4(matrixWorldInverse, [position[0], position[1], position[2], 1]);
  if (!cameraSpace.every(Number.isFinite) || cameraSpace[2] >= -clipEpsilon) return null;

  const clip = multiplyMatrix4Vector4(projectionMatrix, cameraSpace);
  if (!clip.every(Number.isFinite) || Math.abs(clip[3]) <= clipEpsilon) return null;

  const ndcX = clip[0] / clip[3];
  const ndcY = clip[1] / clip[3];
  const ndcZ = clip[2] / clip[3];
  if (![ndcX, ndcY, ndcZ].every(Number.isFinite)
    || ndcZ < -1 - clipEpsilon
    || ndcZ > 1 + clipEpsilon) return null;

  const x = (ndcX * 0.5 + 0.5) * viewportWidth;
  const y = (-ndcY * 0.5 + 0.5) * viewportHeight;
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}

function multiplyMatrix4Vector4(elements, vector) {
  const [x, y, z, w] = vector;
  return [
    elements[0] * x + elements[4] * y + elements[8] * z + elements[12] * w,
    elements[1] * x + elements[5] * y + elements[9] * z + elements[13] * w,
    elements[2] * x + elements[6] * y + elements[10] * z + elements[14] * w,
    elements[3] * x + elements[7] * y + elements[11] * z + elements[15] * w,
  ];
}

function isFiniteTuple(value, length) {
  return (Array.isArray(value) || ArrayBuffer.isView(value))
    && value.length === length
    && Array.from(value).every(Number.isFinite);
}

function isFinitePositive(value) {
  return Number.isFinite(value) && value > 0;
}
