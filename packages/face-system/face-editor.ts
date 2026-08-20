import type { FaceIdentity } from './face-profile.ts';
import type { FaceRuntimeDescriptor } from './face-runtime.ts';

export interface FaceState {
  schema: 'humanoid_rig/face_state@1.0';
  revision: number;
  updated_at: string;
  active_face_id: string;
  dirty: boolean;
  profiles: Record<string, FaceIdentity>;
  versions: Record<string, FaceIdentity[]>;
  runtime_descriptor: FaceRuntimeDescriptor;
}

export * from './face-editor.js';
