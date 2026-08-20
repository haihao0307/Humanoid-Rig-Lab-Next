import type { AccessoryProfile } from './accessory-profile.ts';
import type { HairProfile } from './hair-profile.ts';

export interface AppearanceVersion {
  schema: 'humanoid_rig/appearance_version@1.0';
  character_id: string;
  version: number;
  saved_at: string;
  active_hair_id: string | null;
  hair_profiles: Record<string, HairProfile>;
  accessories: Record<string, AccessoryProfile>;
}

export interface AppearanceState {
  schema: 'humanoid_rig/appearance_state@1.0';
  revision: number;
  updated_at: string;
  character_id: string;
  version: number;
  dirty: boolean;
  active_hair_id: string | null;
  hair_profiles: Record<string, HairProfile>;
  accessories: Record<string, AccessoryProfile>;
  versions: AppearanceVersion[];
  runtime_descriptor: AppearanceRuntimeDescriptor;
}

export interface AppearanceRuntimeDescriptor {
  schema: 'humanoid_rig/appearance_runtime_descriptor@1.0';
  character_id: string;
  appearance_version: number;
  phase: 'static-attachments';
  render_stack: string[];
  binding: 'simulationRig';
  hair: null | { hair_id: string; revision: number; style: string; attachment_points: string[] };
  accessories: Array<{ accessory_id: string; revision: number; type: string; attachment_point: string }>;
  simulation: { hair: false; cloth: false; gpu_hair: false };
  reads: string[];
  writes: string[];
  preserves: string[];
}

export interface AppearanceCharacterReferences {
  hair: { hair_id: string | null; revision: number };
  accessory_attachments: Array<{ accessory_id: string; revision: number }>;
  hair_revision: number;
  accessory_revision: number;
}

export * from './appearance-runtime.js';
