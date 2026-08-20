import type { BodyShapeProfile } from './body-shape-profile.ts';

export interface SkinShapeResponse {
  schema: 'humanoid_rig/body_shape_skin_response@1.0';
  body_shape_id: string;
  body_shape_revision: number;
  target: 'skin.vertex_positions';
  method: 'regional-radial-displacement-v1';
  preserves: string[];
  writes: string[];
  influences: Record<string, number>;
  radial_scales: Record<string, number>;
}

export type BodyShapeRuntimeInput = BodyShapeProfile;

export * from './body-shape-runtime.js';
