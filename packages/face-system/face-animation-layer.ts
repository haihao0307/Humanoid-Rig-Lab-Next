import type { FaceExpressionState } from './face-expression.ts';

export interface FaceAnimationLayer {
  schema: 'humanoid_rig/face_animation_layer@1.0';
  layerId: string;
  layerType: 'face-expression';
  source: 'faceSystem.expression';
  enabled: boolean;
  weight: number;
  blendMode: 'override' | 'additive';
  bodyAnimationReference: string;
  expression: FaceExpressionState;
}

export interface FaceAnimationLayerComposition {
  bodyAnimation: unknown | null;
  faceExpressionAnimation: FaceAnimationLayer;
  layerOrder: readonly ['body-animation', 'face-expression-animation'];
}

export declare const FACE_ANIMATION_LAYER_SCHEMA: 'humanoid_rig/face_animation_layer@1.0';
export declare const FACE_ANIMATION_LAYER_ORDER: readonly ['body-animation', 'face-expression-animation'];
export declare function createFaceAnimationLayer(
  expression?: Partial<FaceExpressionState>,
  options?: Partial<FaceAnimationLayer>,
): FaceAnimationLayer;
export declare function normalizeFaceAnimationLayer(input?: Partial<FaceAnimationLayer>): FaceAnimationLayer;
export declare function validateFaceAnimationLayer(input: FaceAnimationLayer): true;
export declare function composeFaceAnimationLayers(
  bodyAnimation?: unknown,
  expression?: Partial<FaceExpressionState>,
  options?: Partial<FaceAnimationLayer>,
): FaceAnimationLayerComposition;
