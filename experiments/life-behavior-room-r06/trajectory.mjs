/**
 * Life Behavior Room R06 — bounded trajectory primitives.
 *
 * Pure helpers for smooth goal-driven motion. These do not change rig topology,
 * bind matrices, body proportions, or skinning. Contact and collision checks
 * remain the caller's responsibility; this module never claims physical validity.
 */
export const LIFE_MOTION_REVISION = 'life-behavior-room-r06';

const finite = n => Number.isFinite(n);
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

export function quintic01(t) {
  const u = clamp(t);
  const value = u * u * u * (10 + u * (-15 + 6 * u));
  return value === 0 ? 0 : value;
}

export function quinticVelocity01(t) {
  const u = clamp(t);
  const value = 30 * u * u * (1 - u) * (1 - u);
  return value === 0 ? 0 : value;
}

export function quinticAcceleration01(t) {
  const u = clamp(t);
  const value = 60 * u * (1 - u) * (1 - 2 * u);
  return value === 0 ? 0 : value;
}

/**
 * Cubic Hermite position in metres. Endpoint tangents are metres/second;
 * duration converts them to normalized-parameter tangents.
 */
export function sampleHermite3(p0, p1, v0, v1, durationS, t) {
  if (![p0, p1, v0, v1].every(v => Array.isArray(v) && v.length === 3 && v.every(finite))) {
    throw new TypeError('Hermite endpoints and velocities must be finite 3-vectors');
  }
  if (!finite(durationS) || durationS <= 0 || !finite(t)) throw new RangeError('Invalid Hermite time');
  const u = clamp(t), u2 = u * u, u3 = u2 * u;
  const h00 = 2*u3 - 3*u2 + 1, h10 = u3 - 2*u2 + u;
  const h01 = -2*u3 + 3*u2, h11 = u3 - u2;
  return p0.map((x, i) => h00*x + h10*durationS*v0[i] + h01*p1[i] + h11*durationS*v1[i]);
}

export function sampleQuintic3(start, end, t) {
  if (![start, end].every(v => Array.isArray(v) && v.length === 3 && v.every(finite))) {
    throw new TypeError('Quintic endpoints must be finite 3-vectors');
  }
  const u = quintic01(t);
  return start.map((x, i) => x + (end[i] - x) * u);
}

/** Bound one control update; this is a safety limit, not a dynamics solver. */
export function limitVectorStep(previous, desired, maxDistanceM) {
  if (![previous, desired].every(v => Array.isArray(v) && v.length === 3 && v.every(finite))) {
    throw new TypeError('Step endpoints must be finite 3-vectors');
  }
  if (!finite(maxDistanceM) || maxDistanceM < 0) throw new RangeError('Invalid step bound');
  const d = desired.map((x, i) => x - previous[i]);
  const length = Math.hypot(...d);
  if (length <= maxDistanceM || length === 0) return [...desired];
  const scale = maxDistanceM / length;
  return previous.map((x, i) => x + d[i] * scale);
}

/**
 * A phase transition is legal only when caller-provided evidence agrees.
 * Evidence fields are deliberately explicit so task completion cannot be
 * inferred from elapsed time alone.
 */
export function canAdvanceLifePhase(evidence) {
  if (!evidence || typeof evidence !== 'object') return { ok: false, reason: 'missing evidence' };
  const checks = [
    ['stableSupport', 'support not stable'],
    ['jointLimitsValid', 'joint limit exceeded'],
    ['bodyClearanceValid', 'body/environment clearance failed'],
    ['contactValid', 'required contact not established'],
    ['objectStateValid', 'object state not verified'],
  ];
  for (const [key, reason] of checks) {
    if (evidence[key] !== true) return { ok: false, reason, failedGate: key };
  }
  return { ok: true, reason: 'all phase gates passed' };
}
