import { FACE_EXPRESSION_CHANNELS, createFaceExpressionState } from './face-expression.js';
import { createFaceFeatureDescriptor } from './face-feature-descriptor.js';

export const FACE_ANALYSIS_ADAPTER_SCHEMA = 'humanoid_rig/face_analysis_adapter@1.0';

export class FaceAnalysisAdapter {
  analyze() {
    throw new Error('FaceAnalysisAdapter.analyze() is an integration point for a future image-analysis provider.');
  }

  toExpressionState(result = {}) {
    return imageAnalysisResultToExpressionState(result);
  }

  toFaceFeatureDescriptor(result = {}) {
    return imageAnalysisResultToFaceFeatureDescriptor(result);
  }
}

export function createFaceAnalysisAdapter({
  analyze,
  toExpressionState = imageAnalysisResultToExpressionState,
  toFaceFeatureDescriptor = imageAnalysisResultToFaceFeatureDescriptor,
} = {}) {
  if (typeof analyze !== 'function') throw new TypeError('Face analysis adapter must expose analyze(imageInput, context).');
  if (typeof toExpressionState !== 'function') throw new TypeError('Face analysis adapter must expose toExpressionState(result).');
  if (typeof toFaceFeatureDescriptor !== 'function') throw new TypeError('Face analysis adapter must expose toFaceFeatureDescriptor(result).');
  return Object.freeze({
    schema: FACE_ANALYSIS_ADAPTER_SCHEMA,
    analyze,
    toExpressionState,
    toFaceFeatureDescriptor,
  });
}

export const FACE_IMAGE_ANALYSIS_ADAPTER_SCHEMA = 'humanoid_rig/face_image_analysis_adapter@1.0';

export class FaceImageAnalysisAdapter {
  analyze(imageInput, context) {
    void imageInput;
    void context;
    throw new Error('FaceImageAnalysisAdapter.analyze() is an integration point for a future image-analysis provider.');
  }

  toFaceFeatureDescriptor(result = {}) {
    return imageAnalysisResultToFaceFeatureDescriptor(result);
  }

  toExpressionState(result = {}) {
    return imageAnalysisResultToExpressionState(result);
  }
}

export function createFaceImageAnalysisAdapter({
  analyze,
  toFaceFeatureDescriptor = imageAnalysisResultToFaceFeatureDescriptor,
  toExpressionState = imageAnalysisResultToExpressionState,
} = {}) {
  if (typeof analyze !== 'function') throw new TypeError('Face image analysis adapter must expose analyze(imageInput, context).');
  if (typeof toFaceFeatureDescriptor !== 'function') throw new TypeError('Face image analysis adapter must expose toFaceFeatureDescriptor(result).');
  if (typeof toExpressionState !== 'function') throw new TypeError('Face image analysis adapter must expose toExpressionState(result).');
  return Object.freeze({
    schema: FACE_IMAGE_ANALYSIS_ADAPTER_SCHEMA,
    analyze,
    toFaceFeatureDescriptor,
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

export function imageAnalysisResultToFaceFeatureDescriptor(result = {}) {
  return createFaceFeatureDescriptor(result);
}
