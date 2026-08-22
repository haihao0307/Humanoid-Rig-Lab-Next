import type { LegacyClothingAsset } from './clothing-asset.ts';

export interface ClothingProfile {
  clothing_profile_id: string;
  character_id: string | null;
  version: number;
  assets: LegacyClothingAsset[];
}

export * from './clothing-profile.js';
