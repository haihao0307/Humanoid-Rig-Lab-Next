import type { FaceExpressionState } from './face-expression.ts';
import type { FaceExpressionRuntimeDescriptor } from './face-runtime-descriptor.ts';

export interface FacePreviewFrame {
  schema: 'humanoid_rig/face_preview_frame@1.0';
  expressionRevision: number;
  source: 'face-system-expression-runtime';
  runtimeDescriptor: FaceExpressionRuntimeDescriptor;
  profile: {
    face_id: string;
    face_shape: { width: number; height: number; jaw_width: number; cheekbone: number };
    eye_shape: { size: number; spacing: number; tilt: number };
    mouth_shape: { width: number; fullness: number; corner_curve: number };
  };
  surface: {
    faceScaleX: number;
    faceScaleY: number;
    jawDrop: number;
    jawShift: number;
    cheekPuffLeft: number;
    cheekPuffRight: number;
  };
  eyes: Record<'left' | 'right', { closure: number; openness: number; squint: number; wide: number }>;
  brows: Record<'left' | 'right', { raise: number; down: number; angry: number; inner: number }>;
  mouth: { smile: number; frown: number; open: number; pucker: number; tightener: number; shift: number };
  morphWeights: FaceExpressionState['channels'];
  correctiveWeights: Record<string, number>;
}

export declare const FACE_PREVIEW_FRAME_SCHEMA: 'humanoid_rig/face_preview_frame@1.0';
export declare function createFacePreviewFrame(
  expression?: Partial<FaceExpressionState>,
  faceIdentity?: unknown,
): FacePreviewFrame;
