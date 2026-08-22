import type { ClothingAsset } from './clothing-asset.ts';
import type { ClothingDefinition } from './clothing-definition.ts';

export interface ClothingRegistrySnapshot {
  schema: 'humanoid_rig/clothing_registry@1.0';
  assets: ClothingAsset[];
  definitions: ClothingDefinition[];
}

export * from './clothing-registry.js';
