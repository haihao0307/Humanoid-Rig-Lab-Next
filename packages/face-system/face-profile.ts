export interface FaceIdentity {
  face_id: string;
  version: number;
  age: number;
  face_shape: { width: number; height: number; jaw_width: number; cheekbone: number };
  eye_shape: { size: number; spacing: number; tilt: number };
  nose_shape: { width: number; length: number; bridge_height: number };
  mouth_shape: { width: number; fullness: number; corner_curve: number };
  expression_profile: {
    profile_id: string;
    revision: number;
    default_expression: 'neutral' | 'smile' | 'frown' | 'surprise';
  };
}

export * from './face-profile.js';
