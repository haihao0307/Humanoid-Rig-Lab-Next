import type { FaceExpressionState } from './face-expression.ts';

export const FACE_ANALYSIS_ADAPTER_SCHEMA = 'humanoid_rig/face_analysis_adapter@1.0';

export interface FaceAnalysisAdapter<TImage = unknown, TResult = unknown> {
  analyze(imageInput: TImage, context?: unknown): TResult | Promise<TResult>;
  toExpressionState(result: TResult): FaceExpressionState;
}
