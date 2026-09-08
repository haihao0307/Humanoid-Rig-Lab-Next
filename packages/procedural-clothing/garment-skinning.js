import { normalize3, transformDirectionMat4, transformPointMat4 } from './math.js';
import { validateGarmentPayload } from './garment-compiler.js';

export function createIdentitySkinMatrices(jointCount) {
  if (!Number.isInteger(jointCount) || jointCount < 1) throw new RangeError('jointCount must be a positive integer');
  const matrices = new Float32Array(jointCount * 16);
  for (let joint = 0; joint < jointCount; joint += 1) {
    const offset = joint * 16;
    matrices[offset] = 1; matrices[offset + 5] = 1; matrices[offset + 10] = 1; matrices[offset + 15] = 1;
  }
  return matrices;
}

export function setSkinMatrixTranslation(matrices, jointIndex, x, y, z) {
  if (!(matrices instanceof Float32Array)) throw new TypeError('matrices must be Float32Array');
  if (!Number.isInteger(jointIndex) || jointIndex < 0 || jointIndex * 16 + 15 >= matrices.length) {
    throw new RangeError('jointIndex is outside matrices');
  }
  const offset = jointIndex * 16;
  matrices[offset + 12] = x; matrices[offset + 13] = y; matrices[offset + 14] = z;
  return matrices;
}

export function deformGarment(payload, skinMatrices, target = {}) {
  validateGarmentPayload(payload);
  if (!(skinMatrices instanceof Float32Array)) throw new TypeError('skinMatrices must be Float32Array');
  if (skinMatrices.length % 16 !== 0) throw new RangeError('skinMatrices length must be divisible by 16');
  const jointCount = skinMatrices.length / 16;
  const vertexCount = payload.positions.length / 3;
  const positions = target.positions instanceof Float32Array && target.positions.length === payload.positions.length
    ? target.positions : new Float32Array(payload.positions.length);
  const normals = target.normals instanceof Float32Array && target.normals.length === payload.normals.length
    ? target.normals : new Float32Array(payload.normals.length);
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const positionOffset = vertex * 3;
    const weightOffset = vertex * 4;
    const x = payload.positions[positionOffset];
    const y = payload.positions[positionOffset + 1];
    const z = payload.positions[positionOffset + 2];
    const nx = payload.normals[positionOffset];
    const ny = payload.normals[positionOffset + 1];
    const nz = payload.normals[positionOffset + 2];
    let px = 0; let py = 0; let pz = 0; let outNx = 0; let outNy = 0; let outNz = 0;
    for (let channel = 0; channel < 4; channel += 1) {
      const weight = payload.skinWeights[weightOffset + channel];
      if (weight <= 0) continue;
      const joint = payload.skinJoints[weightOffset + channel];
      if (joint >= jointCount) throw new RangeError(`skin joint ${joint} exceeds matrix count ${jointCount}`);
      const matrixOffset = joint * 16;
      const point = transformPointMat4(skinMatrices, matrixOffset, x, y, z);
      const direction = transformDirectionMat4(skinMatrices, matrixOffset, nx, ny, nz);
      px += point[0] * weight; py += point[1] * weight; pz += point[2] * weight;
      outNx += direction[0] * weight; outNy += direction[1] * weight; outNz += direction[2] * weight;
    }
    positions[positionOffset] = px; positions[positionOffset + 1] = py; positions[positionOffset + 2] = pz;
    const normal = normalize3(outNx, outNy, outNz);
    normals[positionOffset] = normal[0]; normals[positionOffset + 1] = normal[1]; normals[positionOffset + 2] = normal[2];
  }
  return {
    positions,
    normals,
    indices: payload.indices,
    materialCoords: payload.materialCoords,
    regionIds: payload.regionIds,
    contentHash: payload.contentHash,
    proportionRevision: payload.proportionRevision,
  };
}
