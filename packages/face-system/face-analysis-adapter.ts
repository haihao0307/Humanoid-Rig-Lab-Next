import type { FaceFeatureDescriptor } from './face-feature-descriptor.ts';
import type { FaceExpressionState } from './face-expression.ts';

export interface FaceImageAnalysisAdapter {
  analyze(imageInput: unknown, context?: unknown): Promise<unknown> | unknown;
  toFaceFeatureDescriptor(result: unknown): FaceFeatureDescriptor;
  toExpressionState(result: unknown): FaceExpressionState;
}

export type FaceImageAnalysisResult = Partial<FaceFeatureDescriptor> & Record<string, unknown>;

export const FACE_ANALYSIS_ADAPTER_SCHEMA = 'humanoid_rig/face_analysis_adapter@1.0';

export interface FaceAnalysisAdapter<TImage = unknown, TResult = unknown> {
  analyze(imageInput: TImage, context?: unknown): TResult | Promise<TResult>;
  toFaceFeatureDescriptor?(result: TResult): FaceFeatureDescriptor;
  toExpressionState(result: TResult): FaceExpressionState;
}
