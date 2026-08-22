import type { FaceExpressionState } from './face-expression.ts';

export interface FaceImageInput {
  schema: 'humanoid_rig/face_image_input@1.0';
  type: 'image';
  reference: string | null;
  mediaType: string | null;
  width: number | null;
  height: number | null;
}

export interface FaceFeatureDescriptor {
  schema: 'humanoid_rig/face_feature_descriptor@1.0';
  descriptorRevision: number;
  source: FaceImageInput;
  face_shape: { width: number; height: number; jaw_width: number; cheekbone: number };
  eye_shape: { size: number; spacing: number; tilt: number };
  mouth_shape: { width: number; fullness: number; corner_curve: number };
  expression: FaceExpressionState;
}

export declare const FACE_FEATURE_DESCRIPTOR_SCHEMA: 'humanoid_rig/face_feature_descriptor@1.0';
export declare const FACE_IMAGE_INPUT_SCHEMA: 'humanoid_rig/face_image_input@1.0';
export declare function createFaceImageInput(input?: string | Partial<FaceImageInput>): FaceImageInput;
export declare function createFaceFeatureDescriptor(
  input?: Partial<FaceFeatureDescriptor>,
  options?: { descriptorRevision?: number; source?: Partial<FaceImageInput> },
): FaceFeatureDescriptor;
export declare function validateFaceFeatureDescriptor(input: FaceFeatureDescriptor): true;
