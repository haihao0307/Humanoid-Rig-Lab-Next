import {
  BODY_SHAPE_PARAMETER_KEYS,
  normalizeBodyShapeProfile,
} from './body-shape-profile.js';

export const BODY_SHAPE_SKIN_RESPONSE_SCHEMA = 'humanoid_rig/body_shape_skin_response@1.0';

export function createSkinShapeResponse(profileInput) {
  const profile = normalizeBodyShapeProfile(profileInput);
  const centered = Object.fromEntries(
    BODY_SHAPE_PARAMETER_KEYS.map((key) => [key, round(profile[key] - 0.5, 6)]),
  );
  return {
    schema: BODY_SHAPE_SKIN_RESPONSE_SCHEMA,
    body_shape_id: profile.body_shape_id,
    body_shape_revision: profile.version,
    target: 'skin.vertex_positions',
    method: 'regional-radial-displacement-v1',
    preserves: ['rig', 'bone_lengths', 'hierarchy', 'pose', 'animation_tracks', 'vertex_y'],
    writes: ['skin.vertex_positions', 'skin.vertex_normals', 'skin.bounds'],
    influences: centered,
    radial_scales: {
      global_x: round(1 + centered.fat * 0.16 + centered.muscle * 0.06, 6),
      global_z: round(1 + centered.fat * 0.20 + centered.muscle * 0.08, 6),
      shoulder: round(1 + centered.shoulder_volume * 0.28, 6),
      chest: round(1 + centered.chest_volume * 0.24, 6),
      waist: round(1 + centered.waist_volume * 0.24, 6),
      hip: round(1 + centered.hip_volume * 0.28, 6),
      arm: round(1 + centered.arm_volume * 0.22 + centered.muscle * 0.08, 6),
      leg: round(1 + centered.leg_volume * 0.22 + centered.muscle * 0.08, 6),
    },
  };
}

export function deformSkinPositions(restPositions, profileInput) {
  if (!ArrayBuffer.isView(restPositions) && !Array.isArray(restPositions)) {
    throw new TypeError('Skin rest positions must be an array or typed array.');
  }
  if (restPositions.length % 3 !== 0) throw new RangeError('Skin rest positions must contain XYZ triples.');
  const response = createSkinShapeResponse(profileInput);
  const output = new Float32Array(restPositions.length);
  if (restPositions.length === 0) return output;

  const bounds = positionBounds(restPositions);
  const height = Math.max(1e-6, bounds.maxY - bounds.minY);
  const centerX = (bounds.minX + bounds.maxX) * 0.5;
  const centerZ = (bounds.minZ + bounds.maxZ) * 0.5;
  const halfWidth = Math.max(1e-6, (bounds.maxX - bounds.minX) * 0.5);
  const scales = response.radial_scales;

  for (let offset = 0; offset < restPositions.length; offset += 3) {
    const x = Number(restPositions[offset]);
    const y = Number(restPositions[offset + 1]);
    const z = Number(restPositions[offset + 2]);
    const normalizedY = clamp((y - bounds.minY) / height, 0, 1);
    const lateral = clamp(Math.abs(x - centerX) / halfWidth, 0, 1);
    const torso = 1 - smoothstep(0.50, 0.86, lateral);
    const shoulderWeight = bell(normalizedY, 0.68, 0.86) * torso;
    const chestWeight = bell(normalizedY, 0.54, 0.74) * torso;
    const waistWeight = bell(normalizedY, 0.40, 0.58) * torso;
    const hipWeight = bell(normalizedY, 0.28, 0.47) * torso;
    const armWeight = bell(normalizedY, 0.47, 0.82) * smoothstep(0.45, 0.78, lateral);
    const legWeight = (1 - smoothstep(0.43, 0.55, normalizedY)) * smoothstep(0.12, 0.34, lateral);

    const regionalScale = 1
      + shoulderWeight * (scales.shoulder - 1)
      + chestWeight * (scales.chest - 1)
      + waistWeight * (scales.waist - 1)
      + hipWeight * (scales.hip - 1)
      + armWeight * (scales.arm - 1)
      + legWeight * (scales.leg - 1);
    const xScale = clamp(scales.global_x * regionalScale, 0.78, 1.28);
    const zScale = clamp(scales.global_z * regionalScale, 0.78, 1.32);
    output[offset] = centerX + (x - centerX) * xScale;
    output[offset + 1] = y;
    output[offset + 2] = centerZ + (z - centerZ) * zScale;
  }
  return output;
}

function positionBounds(positions) {
  const bounds = {
    minX: Infinity, maxX: -Infinity,
    minY: Infinity, maxY: -Infinity,
    minZ: Infinity, maxZ: -Infinity,
  };
  for (let offset = 0; offset < positions.length; offset += 3) {
    const x = Number(positions[offset]);
    const y = Number(positions[offset + 1]);
    const z = Number(positions[offset + 2]);
    bounds.minX = Math.min(bounds.minX, x);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxY = Math.max(bounds.maxY, y);
    bounds.minZ = Math.min(bounds.minZ, z);
    bounds.maxZ = Math.max(bounds.maxZ, z);
  }
  return bounds;
}

function bell(value, start, end) {
  const center = (start + end) * 0.5;
  if (value <= start || value >= end) return 0;
  if (value <= center) return smoothstep(start, center, value);
  return 1 - smoothstep(center, end, value);
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / Math.max(1e-8, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}
