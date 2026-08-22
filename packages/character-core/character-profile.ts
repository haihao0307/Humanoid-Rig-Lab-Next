import type { FaceExpressionRuntimeDescriptor } from '../face-system/face-runtime-descriptor.ts';

export interface CharacterIdentityReference {
  identity_id: string | null;
  revision: number;
  tags: string[];
}

export interface BodyShapeReference {
  profile_id: string | null;
  revision: number;
}

export interface FaceIdentityReference {
  face_id: string | null;
  revision: number;
}

export interface ClothingAttachmentReference {
  clothing_id: string;
  revision: number;
}

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

export interface HairReference {
  hair_id: string | null;
  revision: number;
}

export interface AccessoryAttachmentReference {
  accessory_id: string;
  revision: number;
}

export interface CharacterProfile {
  character_id: string;
  name: string;
  version: number;
  identity: CharacterIdentityReference;
  body_shape: BodyShapeReference;
  face_identity: FaceIdentityReference;
  clothing_attachments: ClothingAttachmentReference[];
  clothing_references: CharacterClothingReferences;
  hair: HairReference;
  accessory_attachments: AccessoryAttachmentReference[];
  proportion_revision: number;
  body_shape_revision: number;
  skin_revision: number;
  face_revision: number;
  expression_revision: number;
  expression_runtime_descriptor: FaceExpressionRuntimeDescriptor | null;
  clothing_revision: number;
  hair_revision: number;
  accessory_revision: number;
  pose_revision: number;
  animation_revision: number;
}

export * from './character-profile.js';
