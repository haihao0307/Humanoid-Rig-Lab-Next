export interface BodyShapeProfile {
  body_shape_id: string;
  name: string;
  version: number;
  muscle: number;
  fat: number;
  shoulder_volume: number;
  chest_volume: number;
  waist_volume: number;
  hip_volume: number;
  arm_volume: number;
  leg_volume: number;
}

export type BodyShapeParameters = Pick<BodyShapeProfile,
  | 'muscle'
  | 'fat'
  | 'shoulder_volume'
  | 'chest_volume'
  | 'waist_volume'
  | 'hip_volume'
  | 'arm_volume'
  | 'leg_volume'
>;

export * from './body-shape-profile.js';
