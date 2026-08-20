export type ClothingType = 'top' | 'pants' | 'shoes';

export interface ClothingAsset {
  clothing_id: string;
  revision: number;
  type: ClothingType;
  rig_profile: {
    target: 'simulationRig';
    rig_revision: string;
    attachment_points: string[];
  };
  material: { base_color: string; roughness: number; metalness: number; opacity: number };
  physics_profile: { mode: 'static-follow'; enabled: false; collision: 'none' | 'body-readonly' };
  size_profile: { size: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'custom'; scale: number; body_shape_revision: number };
}

export * from './clothing-asset.js';
