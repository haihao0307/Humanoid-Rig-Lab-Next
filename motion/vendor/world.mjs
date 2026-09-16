import { add, mul, sub, finiteVector } from './math.mjs';

// Flat test world only. Swept point against expanded AABBs: conservative
// horizontal body clearance, including diagonal movement. No rigid-body claims.
export class FlatWorld {
  constructor(obstacles = []) {
    this.obstacles = structuredClone(obstacles);
    for (const o of this.obstacles) if (!['minX', 'maxX', 'minZ', 'maxZ'].every(k => Number.isFinite(o[k])) || o.minX >= o.maxX || o.minZ >= o.maxZ) throw Error('Invalid obstacle');
  }
  sweep(start, desired, radius) {
    if (![start, desired].every(finiteVector) || !Number.isFinite(radius) || radius < 0) throw Error('Invalid sweep');
    const delta = sub(desired, start); let fraction = 1;
    for (const o of this.obstacles) {
      let enter = 0, exit = 1, hit = true;
      for (const [axis, low, high] of [[0, o.minX - radius, o.maxX + radius], [2, o.minZ - radius, o.maxZ + radius]]) {
        if (Math.abs(delta[axis]) < 1e-12) { if (start[axis] < low || start[axis] > high) hit = false; continue; }
        const a = (low - start[axis]) / delta[axis], b = (high - start[axis]) / delta[axis];
        enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
        if (enter > exit) hit = false;
      }
      if (hit && exit >= 0 && enter <= 1) fraction = Math.min(fraction, Math.max(0, enter - 1e-5));
    }
    return { position: add(start, mul(delta, fraction)), fraction, blocked: fraction < 1 };
  }
  free(point, radius = 0) {
    return !this.obstacles.some(o => point[0] >= o.minX - radius && point[0] <= o.maxX + radius && point[2] >= o.minZ - radius && point[2] <= o.maxZ + radius);
  }
}
