import { FACE_EXPRESSION_CHANNELS, createFaceExpressionState } from './face-expression.js';

export const FACE_ANALYSIS_ADAPTER_SCHEMA = 'humanoid_rig/face_analysis_adapter@1.0';

export class FaceAnalysisAdapter {
  analyze() {
    throw new Error('FaceAnalysisAdapter.analyze() is an integration point for a future image-analysis provider.');
  }

  toExpressionState(result = {}) {
    return imageAnalysisResultToExpressionState(result);
  }
}

export function createFaceAnalysisAdapter({ analyze, toExpressionState = imageAnalysisResultToExpressionState } = {}) {
  if (typeof analyze !== 'function') throw new TypeError('Face analysis adapter must expose analyze(imageInput, context).');
  if (typeof toExpressionState !== 'function') throw new TypeError('Face analysis adapter must expose toExpressionState(result).');
  return Object.freeze({
    schema: FACE_ANALYSIS_ADAPTER_SCHEMA,
    analyze,
    toExpressionState,
  });
}

export function imageAnalysisResultToExpressionState(result = {}) {
  const source = result && typeof result === 'object' && !Array.isArray(result)
    ? (result.channels && typeof result.channels === 'object' ? result.channels : result)
    : {};
  const channels = Object.fromEntries(
    FACE_EXPRESSION_CHANNELS
      .filter((channel) => channel in source)
      .map((channel) => [channel, source[channel]]),
  );
  return createFaceExpressionState({ channels });
}
