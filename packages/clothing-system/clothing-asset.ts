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
  physics_profile: {
    mode: 'static-follow';
    enabled: false;
    collision: 'none' | 'body-readonly';
    physicsMode: 'static-follow' | 'cloth-simulation';
    collisionGroup: string | null;
    materialProperties: { density: number; friction: number; damping: number };
  };
  size_profile: {
    size: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'custom';
    scale: number;
    length: number;
    offset: { x: number; y: number; z: number };
    body_shape_revision: number;
  };
  render_profile: { layer: number };
}

export * from './clothing-asset.js';
