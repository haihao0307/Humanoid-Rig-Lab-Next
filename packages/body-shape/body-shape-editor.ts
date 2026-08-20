import type { BodyShapeProfile } from './body-shape-profile.ts';
import type { SkinShapeResponse } from './body-shape-runtime.ts';

export interface BodyShapeState {
  schema: 'humanoid_rig/body_shape_state@1.0';
  revision: number;
  updated_at: string;
  active_profile_id: string;
  dirty: boolean;
  profiles: Record<string, BodyShapeProfile>;
  versions: Record<string, BodyShapeProfile[]>;
  skin_response: SkinShapeResponse;
}

export * from './body-shape-editor.js';
