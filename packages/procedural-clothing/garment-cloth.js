import { clamp, normalize3 } from './math.js';
import { validateGarmentPayload } from './garment-compiler.js';
import { deformGarment } from './garment-skinning.js';

export function createHybridClothState(payload) {
  validateGarmentPayload(payload);
  return {
    schema: 'humanoid_rig/hybrid_cloth_state@1.0',
    payloadHash: payload.contentHash,
    positions: new Float32Array(payload.positions),
    previousPositions: new Float32Array(payload.positions),
    targetPositions: new Float32Array(payload.positions.length),
    targetNormals: new Float32Array(payload.normals.length),
    frame: 0,
  };
}

function solveDistanceConstraint(positions, inverseMass, a, b, restLength, stiffness) {
  const ia = a * 3;
  const ib = b * 3;
  const ax = positions[ia]; const ay = positions[ia + 1]; const az = positions[ia + 2];
  const bx = positions[ib]; const by = positions[ib + 1]; const bz = positions[ib + 2];
  const dx = bx - ax; const dy = by - ay; const dz = bz - az;
  const length = Math.hypot(dx, dy, dz);
  if (length < 1e-9) return;
  const wa = inverseMass[a]; const wb = inverseMass[b]; const total = wa + wb;
  if (total <= 0) return;
  const correction = ((length - restLength) / length) * stiffness;
  const cx = dx * correction; const cy = dy * correction; const cz = dz * correction;
  positions[ia] += cx * (wa / total);
  positions[ia + 1] += cy * (wa / total);
  positions[ia + 2] += cz * (wa / total);
  positions[ib] -= cx * (wb / total);
  positions[ib + 1] -= cy * (wb / total);
  positions[ib + 2] -= cz * (wb / total);
}

function applyBodyCollision(positions, clearance, sampleBodySDF) {
  if (typeof sampleBodySDF !== 'function') return;
  for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
    const offset = vertex * 3;
    const sample = sampleBodySDF(positions[offset], positions[offset + 1], positions[offset + 2]);
    if (!sample || !Number.isFinite(sample.distance) || !Array.isArray(sample.normal)) continue;
    if (sample.distance >= clearance) continue;
    const normal = normalize3(sample.normal[0], sample.normal[1], sample.normal[2]);
    const correction = clearance - sample.distance;
    positions[offset] += normal[0] * correction;
    positions[offset + 1] += normal[1] * correction;
    positions[offset + 2] += normal[2] * correction;
  }
}

export function stepHybridCloth(payload, state, skinMatrices, deltaSeconds, options = {}) {
  validateGarmentPayload(payload);
  if (!state || state.payloadHash !== payload.contentHash) throw new Error('Hybrid cloth state does not match garment payload');
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0 || deltaSeconds > 0.25) {
    throw new RangeError('deltaSeconds must be within (0, 0.25]');
  }
  const iterations = Number.isInteger(options.iterations) ? clamp(options.iterations, 1, 24) : 5;
  const structuralStiffness = clamp(options.structuralStiffness ?? 0.72, 0, 1);
  const seamStiffness = clamp(options.seamStiffness ?? 0.86, 0, 1);
  const followStiffness = clamp(options.followStiffness ?? 0.68, 0, 1);
  const damping = clamp(options.damping ?? 0.13, 0, 0.99);
  const gravity = Array.isArray(options.gravity) ? options.gravity : [0, -9.81, 0];
  const clearance = options.surfaceClearance ?? payload.fitContract.resolved.surfaceClearance;
  const target = deformGarment(payload, skinMatrices, { positions: state.targetPositions, normals: state.targetNormals });
  const dt2 = deltaSeconds * deltaSeconds;
  const positions = state.positions;
  const previous = state.previousPositions;
  for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
    const offset = vertex * 3;
    const follow = payload.followWeights[vertex];
    for (let axis = 0; axis < 3; axis += 1) {
      const current = positions[offset + axis];
      const velocity = (current - previous[offset + axis]) * (1 - damping);
      previous[offset + axis] = current;
      const dynamicFactor = 1 - follow;
      const predicted = current + velocity + gravity[axis] * dt2 * dynamicFactor;
      const targetValue = target.positions[offset + axis];
      positions[offset + axis] = predicted + (targetValue - predicted) * follow * followStiffness;
    }
  }
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (let edge = 0; edge < payload.stretchEdges.length; edge += 2) {
      solveDistanceConstraint(
        positions,
        payload.inverseMass,
        payload.stretchEdges[edge],
        payload.stretchEdges[edge + 1],
        payload.restLengths[edge / 2],
        structuralStiffness / iterations,
      );
    }
    for (let seam = 0; seam < payload.seamPairs.length; seam += 2) {
      solveDistanceConstraint(
        positions,
        payload.inverseMass,
        payload.seamPairs[seam],
        payload.seamPairs[seam + 1],
        0,
        seamStiffness / iterations,
      );
    }
    applyBodyCollision(positions, clearance, options.sampleBodySDF);
  }
  state.frame += 1;
  return state;
}
