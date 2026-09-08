import { distance3 } from './math.js';

export function garmentBounds(positionArray) {
  if (!(positionArray instanceof Float32Array) || positionArray.length % 3 !== 0) {
    throw new TypeError('positionArray must be a Float32Array of xyz triples');
  }
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < positionArray.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = positionArray[index + axis];
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
    }
  }
  return { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]], diagonal: distance3(...min, ...max) };
}
