import type { ClothingProfile } from './clothing-profile.ts';
import type { ClothingRuntimeDescriptor } from './clothing-runtime.ts';

export interface ClothingState {
  schema: 'humanoid_rig/clothing_state@1.0';
  revision: number;
  updated_at: string;
  active_profile_id: string;
  dirty: boolean;
  profiles: Record<string, ClothingProfile>;
  versions: Record<string, ClothingProfile[]>;
  runtime_descriptor: ClothingRuntimeDescriptor;
}

export * from './clothing-manager.js';
