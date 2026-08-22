import type { ClothingProfile } from './clothing-profile.ts';
import type { ClothingAsset, LegacyClothingAsset } from './clothing-asset.ts';

export interface ClothingAssetReference {
  schema: 'humanoid_rig/clothing_asset_reference@1.0';
  asset_kind: 'clothing';
  clothing_id: string;
  revision: number;
  type: string;
}

export interface ClothingAttachmentDescriptor {
  schema: 'humanoid_rig/clothing_attachment@1.0';
  attachment_id: string;
  target: 'simulationRig';
  attachment_points: string[];
  follow_mode: 'static-follow';
}

export interface ClothingRenderInstanceDescriptor {
  schema: 'humanoid_rig/clothing_render_instance@1.0';
  render_id: string;
  role: 'clothing';
  layer: 'clothing_mesh';
  layer_index: number;
  visible: boolean;
  status: 'unresolved' | 'ready' | 'waiting-for-rig';
  material: { base_color: string; roughness: number; metalness: number; opacity: number };
  size_profile: {
    size: string;
    scale: number;
    length: number;
    offset: { x: number; y: number; z: number };
    body_shape_revision: number;
  };
  render_profile: { layer: number };
}

export interface ClothingRuntimeAssetDescriptor {
  clothing_id: string;
  asset_revision: number;
  type: string;
  attachment_points: string[];
  physics_mode: 'static-follow' | 'cloth-simulation';
  simulation_interface: {
    active: false;
    physicsMode: 'static-follow' | 'cloth-simulation';
    collisionGroup: string | null;
    materialProperties: { density: number; friction: number; damping: number };
  };
  asset: ClothingAsset | LegacyClothingAsset;
  definition?: {
    definitionId: string;
    clothingId: string;
    attachmentBones: string[];
    bindingTarget: 'simulationRig';
    metadata: Record<string, unknown>;
  };
  clothing_reference?: {
    clothingId: string;
    definitionId: string | null;
    revision: number;
  };
  asset_reference: ClothingAssetReference;
  attachment: ClothingAttachmentDescriptor;
  render: ClothingRenderInstanceDescriptor;
}

export interface ClothingAttachmentTransform {
  schema: 'humanoid_rig/clothing_attachment_transform@1.0';
  translation: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
}

export interface ClothingCharacterFit {
  schema: 'humanoid_rig/clothing_character_fit@1.0';
  body_shape_revision: number;
  proportion_revision: number;
  scale: {
    height: number;
    shoulder: number;
    chest: number;
    waist: number;
    hip: number;
    limb: number;
    depth: number;
  };
  offset: { x: number; y: number; z: number };
  attachment_mode: 'recompute-from-simulationRig';
}

export interface ClothingRuntimeDescriptor {
  schema: 'humanoid_rig/clothing_runtime_descriptor@1.0';
  clothing_profile_id: string;
  clothing_revision: number;
  phase: 'static-clothing';
  render_stack: ['character', 'body_skin', 'clothing_mesh'];
  binding: 'simulationRig';
  runtime_chain: ['asset', 'profile', 'reference', 'attachment', 'simulationRig', 'render'];
  profile_reference: { clothing_profile_id: string; version: number };
  assets: ClothingRuntimeAssetDescriptor[];
  reads: string[];
  writes: string[];
  preserves: string[];
}

export type ClothingRuntimeInput = ClothingProfile;
export * from './clothing-runtime.js';
