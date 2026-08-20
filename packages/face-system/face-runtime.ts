import type { FaceIdentity } from './face-profile.ts';

export type FaceBackend = 'FLAME' | '3DMM' | 'AI_FACE_RECONSTRUCTION';

export interface FaceRuntimeDescriptor {
  schema: 'humanoid_rig/face_runtime_descriptor@1.0';
  face_id: string;
  face_revision: number;
  source: 'face-identity-parameters';
  canonical_parameters: Omit<FaceIdentity, 'face_id' | 'version'>;
  backend_interfaces: Array<{ backend: FaceBackend; status: string; expected_output: string }>;
  writes: ['face.identity_descriptor'];
  preserves: string[];
}

export interface FaceBackendAdapter<T = unknown> {
  prepare(profile: FaceIdentity, descriptor: FaceRuntimeDescriptor): T;
}

export * from './face-runtime.js';
