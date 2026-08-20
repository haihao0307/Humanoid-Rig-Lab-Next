import type { ClothingProfile } from './clothing-profile.ts';

export interface ClothingRuntimeDescriptor {
  schema: 'humanoid_rig/clothing_runtime_descriptor@1.0';
  clothing_profile_id: string;
  clothing_revision: number;
  phase: 'static-clothing';
  render_stack: ['character', 'body_skin', 'clothing_mesh'];
  binding: 'simulationRig';
  reads: string[];
  writes: string[];
  preserves: string[];
}

export type ClothingRuntimeInput = ClothingProfile;
export * from './clothing-runtime.js';
