export type FaceExpressionChannel =
  | 'eyeBlinkLeft' | 'eyeBlinkRight' | 'eyeWideLeft' | 'eyeWideRight'
  | 'browDownLeft' | 'browDownRight' | 'browInnerUp'
  | 'mouthSmileLeft' | 'mouthSmileRight' | 'mouthFrownLeft' | 'mouthFrownRight'
  | 'jawOpen' | 'jawLeft' | 'jawRight'
  | 'cheekPuff' | 'cheekSquintLeft' | 'cheekSquintRight';

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
