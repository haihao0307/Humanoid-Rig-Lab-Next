import type { FaceExpressionChannel, FaceExpressionState } from './face-expression.ts';

export type FaceExpressionDeformationMode =
  | 'interface-only' | 'morph-target' | 'vertex-corrective' | 'shader-corrective';

export interface FaceExpressionRuntimeDescriptor {
  expressionSchema: 'humanoid_rig/face_expression@1.0';
  channels: Record<FaceExpressionChannel, number>;
  deformationMode: FaceExpressionDeformationMode;
  meshReference: unknown | null;
  morphTargets: unknown[];
  correctiveTargets: unknown[];
}

export declare function createFaceExpressionRuntimeDescriptor(
  expression?: FaceExpressionState,
  options?: Partial<FaceExpressionRuntimeDescriptor>,
): FaceExpressionRuntimeDescriptor;
export declare function validateFaceExpressionRuntimeDescriptor(
  descriptor: FaceExpressionRuntimeDescriptor,
): true;
