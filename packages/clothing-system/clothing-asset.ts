export type ClothingCategory = 'upper_body' | 'lower_body' | 'shoes' | 'head' | 'accessory';
export type ClothingLayer = 'underwear' | 'base' | 'outer' | 'armor';

export interface ClothingResourceReference {
  assetId: string;
  revision: number;
  uri: string | null;
}

export interface ClothingAsset {
  clothingId: string;
  name: string;
  category: ClothingCategory;
  assetReference: ClothingResourceReference;
  meshReference: ClothingResourceReference;
  materialReference: ClothingResourceReference;
  compatibleRig: { target: 'simulationRig'; versions: string[] };
  compatibleBody: { profileIds: string[]; minimumRevision: number };
  attachmentPoints: string[];
  layer: ClothingLayer;
  metadata: Record<string, unknown>;
}

export type ClothingType = 'top' | 'pants' | 'shoes';

export interface LegacyClothingAsset {
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
