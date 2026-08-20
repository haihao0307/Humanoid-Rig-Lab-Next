import type { ClothingAsset } from './clothing-asset.ts';

export interface ClothingProfile {
  clothing_profile_id: string;
  character_id: string | null;
  version: number;
  assets: ClothingAsset[];
}

export * from './clothing-profile.js';
