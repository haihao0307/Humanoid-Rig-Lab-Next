import { FORBIDDEN_ASSET_KEYS, FORBIDDEN_ASSET_TOKENS } from './constants.js';

function walk(value, path, violations, visited) {
  if (value === null || value === undefined) return;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    for (const token of FORBIDDEN_ASSET_TOKENS) {
      if (normalized.includes(token)) {
        violations.push({ path, kind: 'forbidden_token', token, value });
      }
    }
    if (/^https?:\/\//i.test(value)) {
      violations.push({ path, kind: 'remote_asset_reference', value });
    }
    return;
  }
  if (typeof value !== 'object') return;
  if (visited.has(value)) return;
  visited.add(value);

  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walk(entry, `${path}[${index}]`, violations, visited));
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    if (FORBIDDEN_ASSET_KEYS.includes(normalizedKey)) {
      violations.push({ path: `${path}.${key}`, kind: 'forbidden_key', key });
    }
    walk(entry, `${path}.${key}`, violations, visited);
  }
}

export function inspectForExternalAssetDependencies(value) {
  const violations = [];
  walk(value, '$', violations, new WeakSet());
  return violations;
}

export function assertProceduralOnly(value) {
  const violations = inspectForExternalAssetDependencies(value);
  if (violations.length > 0) {
    const summary = violations.map((item) => `${item.kind}@${item.path}`).join(', ');
    throw new Error(`Procedural-only policy violation: ${summary}`);
  }
  return true;
}
