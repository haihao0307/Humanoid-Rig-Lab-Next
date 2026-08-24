export const IDENTITY_QUATERNION = Object.freeze([0, 0, 0, 1]);

export function cloneValue(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

export function normalizeId(value, fallback) {
  const normalized = String(value ?? '').trim().replace(/[^A-Za-z0-9._-]+/g, '-');
  return normalized || fallback;
}

export function normalizeRevision(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

export function finiteNumber(value, fallback, minimum = -Infinity, maximum = Infinity) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(maximum, Math.max(minimum, numeric));
}

export function normalizeUnitVector(value, fallback = [1, 0, 0]) {
  const source = Array.isArray(value) || ArrayBuffer.isView(value) ? Array.from(value) : fallback;
  const vector = [0, 1, 2].map((index) => finiteNumber(source[index], fallback[index]));
  const length = Math.hypot(...vector);
  if (length < 1e-10) return [...fallback];
  return vector.map((component) => component / length);
}

export function isNormalizedQuaternion(value, tolerance = 1e-5) {
  return Array.isArray(value)
    && value.length === 4
    && value.every((component) => Number.isFinite(Number(component)))
    && Math.abs(Math.hypot(...value.map(Number)) - 1) <= tolerance;
}

export function stableFingerprint(value) {
  const source = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

export function collectForbiddenKeys(value, forbiddenKeys) {
  const found = [];
  const visit = (item, path) => {
    if (!item || typeof item !== 'object') return;
    if (Array.isArray(item) || ArrayBuffer.isView(item)) {
      Array.from(item).forEach((child, index) => visit(child, `${path}[${index}]`));
      return;
    }
    for (const [key, child] of Object.entries(item)) {
      const nextPath = path ? `${path}.${key}` : key;
      if (forbiddenKeys.has(key)) found.push(nextPath);
      visit(child, nextPath);
    }
  };
  visit(value, '');
  return found;
}

export function assertNoForbiddenKeys(value, forbiddenKeys, label) {
  const found = collectForbiddenKeys(value, forbiddenKeys);
  if (found.length) {
    throw new Error(`${label} cannot contain ${found.join(', ')}.`);
  }
}

export function compareNumberArrays(left, right, tolerance = 1e-6) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => Math.abs(Number(value) - Number(right[index])) <= tolerance);
}
