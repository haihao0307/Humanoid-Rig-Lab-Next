import { createClothingProfile } from './clothing-profile.js';

export const CLOTHING_RUNTIME_DESCRIPTOR_SCHEMA = 'humanoid_rig/clothing_runtime_descriptor@1.0';
export const CLOTHING_FOLLOW_FRAME_SCHEMA = 'humanoid_rig/clothing_follow_frame@1.0';

export function createClothingRuntimeDescriptor(profileInput) {
  const profile = createClothingProfile(profileInput);
  return {
    schema: CLOTHING_RUNTIME_DESCRIPTOR_SCHEMA,
    clothing_profile_id: profile.clothing_profile_id,
    clothing_revision: profile.version,
    phase: 'static-clothing',
    render_stack: ['character', 'body_skin', 'clothing_mesh'],
    binding: 'simulationRig',
    assets: profile.assets.map((asset) => ({
      clothing_id: asset.clothing_id,
      asset_revision: asset.revision,
      type: asset.type,
      attachment_points: [...asset.rig_profile.attachment_points],
      physics_mode: asset.physics_profile.mode,
    })),
    reads: ['character.reference', 'body_skin.bounds', 'simulationRig.transforms'],
    writes: ['clothing.mesh.transforms', 'clothing.mesh.material'],
    preserves: ['body_skin', 'body_vertices', 'skin_weights', 'rig', 'bone_lengths', 'hierarchy', 'pose', 'animation_tracks'],
  };
}

export function followSimulationRig(profileInput, simulationRigInput) {
  const profile = createClothingProfile(profileInput);
  const source = simulationRigInput?.fk || simulationRigInput || {};
  const positions = source.positions;
  const rotations = source.rotations;
  const assetFrames = profile.assets.map((asset) => ({
    clothing_id: asset.clothing_id,
    type: asset.type,
    source: 'simulationRig',
    joint_transforms: Object.fromEntries(asset.rig_profile.attachment_points.map((jointId) => [
      jointId,
      {
        position: vector(readTransform(positions, jointId), [0, 0, 0]),
        rotation: vector(readTransform(rotations, jointId), [0, 0, 0, 1]),
      },
    ])),
  }));
  return {
    schema: CLOTHING_FOLLOW_FRAME_SCHEMA,
    clothing_profile_id: profile.clothing_profile_id,
    clothing_revision: profile.version,
    rig_revision: String(simulationRigInput?.rigVersion || profile.assets[0]?.rig_profile.rig_revision || 'rig@0.4.0'),
    source: 'simulationRig',
    static_clothing: true,
    asset_frames: assetFrames,
    writes: ['clothing.mesh.transforms'],
    preserves: ['body_skin', 'body_vertices', 'rig', 'pose', 'animation_tracks'],
  };
}

export class ClothingRuntime {
  constructor(profileInput = {}) {
    this.profile = createClothingProfile(profileInput);
    this.descriptor = createClothingRuntimeDescriptor(this.profile);
    this.lastFrame = null;
  }

  bind(profileInput) {
    this.profile = createClothingProfile(profileInput);
    this.descriptor = createClothingRuntimeDescriptor(this.profile);
    this.lastFrame = null;
    return structuredClone(this.descriptor);
  }

  update(simulationRigInput) {
    this.lastFrame = followSimulationRig(this.profile, simulationRigInput);
    return structuredClone(this.lastFrame);
  }
}

function readTransform(collection, key) {
  if (collection instanceof Map) return collection.get(key);
  if (collection && typeof collection === 'object') return collection[key];
  return undefined;
}

function vector(value, fallback) {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    const result = [...value].map(Number);
    if (result.length === fallback.length && result.every(Number.isFinite)) return result;
  }
  if (value && typeof value === 'object') {
    const keys = fallback.length === 4 ? ['x', 'y', 'z', 'w'] : ['x', 'y', 'z'];
    const result = keys.map((key, index) => Number(value[key] ?? fallback[index]));
    if (result.every(Number.isFinite)) return result;
  }
  return [...fallback];
}
