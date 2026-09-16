export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const mul = (a, s) => a.map(v => v * s);
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const length = a => Math.hypot(...a);
export const distance = (a, b) => length(sub(a, b));
export const normalize = (a, fallback = [0, 0, 1]) => length(a) > 1e-9 ? mul(a, 1 / length(a)) : [...fallback];
export const mix = (a, b, t) => add(mul(a, 1 - t), mul(b, t));
export const angle = x => Math.atan2(Math.sin(x), Math.cos(x));
export const smooth = t => { t = clamp(t, 0, 1); return t * t * t * (10 + t * (-15 + t * 6)); };
export const rotateY = (v, yaw) => [v[0] * Math.cos(yaw) + v[2] * Math.sin(yaw), v[1], -v[0] * Math.sin(yaw) + v[2] * Math.cos(yaw)];
export function finiteVector(v) { return Array.isArray(v) && v.length === 3 && v.every(Number.isFinite); }

// Analytic two-bone positional IK. Segment lengths never change. Pole is a
// world-space point; unreachable targets produce a residual, not a false pass.
export function solveTwoBone(root, target, pole, upper, lower) {
  if (![root, target, pole].every(finiteVector) || ![upper, lower].every(x => Number.isFinite(x) && x > 0)) throw Error('Invalid IK input');
  const delta = sub(target, root), direction = normalize(delta);
  const d = clamp(length(delta), Math.abs(upper - lower) + 1e-6, upper + lower - 1e-6);
  const along = (upper * upper - lower * lower + d * d) / (2 * d);
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));
  let plane = sub(sub(pole, root), mul(direction, dot(sub(pole, root), direction)));
  if (length(plane) < 1e-7) {
    const axis = Math.abs(direction[0]) < .8 ? [1, 0, 0] : [0, 0, 1];
    plane = sub(axis, mul(direction, dot(axis, direction)));
  }
  const knee = add(add(root, mul(direction, along)), mul(normalize(plane), height));
  const end = add(root, mul(direction, d));
  return { root: [...root], knee, end, residual: distance(end, target),
    lengthError: Math.max(Math.abs(distance(root, knee) - upper), Math.abs(distance(knee, end) - lower)) };
}
