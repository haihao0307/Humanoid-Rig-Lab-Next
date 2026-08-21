import type { FaceIdentity } from './face-profile.ts';
import type { FaceRuntimeDescriptor } from './face-runtime.ts';
import type { FaceExpressionRuntimeDescriptor } from './face-runtime-descriptor.ts';
import type { FaceExpressionState } from './face-expression.ts';

export interface FaceState {
  schema: 'humanoid_rig/face_state@1.0';
  revision: number;
  updated_at: string;
  active_face_id: string;
  dirty: boolean;
  profiles: Record<string, FaceIdentity>;
  versions: Record<string, FaceIdentity[]>;
  runtime_descriptor: FaceRuntimeDescriptor;
  expression: FaceExpressionState;
  expression_versions: FaceExpressionState[];
  expression_runtime_descriptor: FaceExpressionRuntimeDescriptor;
}

export * from './face-editor.js';
