export type FaceExpressionChannel =
  | 'eyeBlinkLeft' | 'eyeBlinkRight' | 'eyeClosureLeft' | 'eyeClosureRight'
  | 'eyeUpperLidRaiseLeft' | 'eyeUpperLidRaiseRight' | 'eyeLowerLidLeft' | 'eyeLowerLidRight'
  | 'eyeWideLeft' | 'eyeWideRight' | 'eyeSquintLeft' | 'eyeSquintRight'
  | 'eyeGlareLeft' | 'eyeGlareRight'
  | 'browRaiseLeft' | 'browRaiseRight' | 'browDownLeft' | 'browDownRight'
  | 'browInnerLeft' | 'browInnerRight' | 'browAngryLeft' | 'browAngryRight' | 'browInnerUp'
  | 'mouthSmileLeft' | 'mouthSmileRight' | 'mouthFrownLeft' | 'mouthFrownRight'
  | 'lipTightenerLeft' | 'lipTightenerRight' | 'mouthOpen' | 'mouthPuckerLeft' | 'mouthPuckerRight'
  | 'jawOpen' | 'jawLeft' | 'jawRight'
  | 'cheekPuff' | 'cheekPuffLeft' | 'cheekPuffRight' | 'cheekSquintLeft' | 'cheekSquintRight';

export type FaceExpressionChannelCategory = 'Eye' | 'Brow' | 'Mouth' | 'Jaw' | 'Cheek';
export type FaceExpressionChannelSide = 'left' | 'right' | 'center';

export interface FaceExpressionChannelDefinition {
  channel: FaceExpressionChannel;
  category: FaceExpressionChannelCategory;
  label: string;
  side: FaceExpressionChannelSide;
}

export interface FaceExpressionState {
  schema: 'humanoid_rig/face_expression@1.0';
  expressionRevision: number;
  channels: Record<FaceExpressionChannel, number>;
}

export declare function createFaceExpressionState(input?: Partial<FaceExpressionState>): FaceExpressionState;
export declare function normalizeFaceExpression(input?: Partial<FaceExpressionState>): FaceExpressionState;
export declare function validateFaceExpression(input: FaceExpressionState): true;
export declare function mergeFaceExpression(current: FaceExpressionState, patch?: Partial<FaceExpressionState> | Record<string, number>): FaceExpressionState;
export declare function updateFaceExpression(current: FaceExpressionState, patch?: Partial<FaceExpressionState> | Record<string, number>): FaceExpressionState;
export declare function mirrorFaceExpression(input: FaceExpressionState): FaceExpressionState;
export declare function mirrorFaceExpressionPair(input: FaceExpressionState, pair: readonly [FaceExpressionChannel, FaceExpressionChannel]): FaceExpressionState;

export declare const FACE_EXPRESSION_CHANNEL_DEFINITIONS: readonly FaceExpressionChannelDefinition[];
export declare const FACE_EXPRESSION_CHANNELS: readonly FaceExpressionChannel[];
export declare const FACE_EXPRESSION_MIRROR_PAIRS: readonly (readonly [FaceExpressionChannel, FaceExpressionChannel])[];
