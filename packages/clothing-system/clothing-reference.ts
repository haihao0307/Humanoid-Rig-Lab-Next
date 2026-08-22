export interface ClothingReference {
  clothingId: string;
  definitionId: string | null;
  revision: number;
}

export interface CharacterClothingReferences {
  upper: ClothingReference | null;
  lower: ClothingReference | null;
  shoes: ClothingReference | null;
  accessory: ClothingReference | null;
}

export * from './clothing-reference.js';
