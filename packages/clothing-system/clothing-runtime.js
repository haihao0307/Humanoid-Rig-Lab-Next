import { createClothingProfile } from './clothing-profile.js';

export const CLOTHING_RUNTIME_DESCRIPTOR_SCHEMA = 'humanoid_rig/clothing_runtime_descriptor@1.0';
export const CLOTHING_FOLLOW_FRAME_SCHEMA = 'humanoid_rig/clothing_follow_frame@1.0';
export const CLOTHING_ASSET_REFERENCE_SCHEMA = 'humanoid_rig/clothing_asset_reference@1.0';
export const CLOTHING_ATTACHMENT_SCHEMA = 'humanoid_rig/clothing_attachment@1.0';
export const CLOTHING_RENDER_INSTANCE_SCHEMA = 'humanoid_rig/clothing_render_instance@1.0';

export const CLOTHING_RUNTIME_CHAIN = Object.freeze([
  'asset',
  'profile',
  'reference',
  'attachment',
  'simulationRig',
  'render',
]);

export function createClothingRuntimeDescriptor(profileInput) {
  const profile = createClothingProfile(profileInput);
  return {
    schema: CLOTHING_RUNTIME_DESCRIPTOR_SCHEMA,
    clothing_profile_id: profile.clothing_profile_id,
    clothing_revision: profile.version,
    phase: 'static-clothing',
    render_stack: ['character', 'body_skin', 'clothing_mesh'],
    binding: 'simulationRig',
    runtime_chain: [...CLOTHING_RUNTIME_CHAIN],
    profile_reference: {
      clothing_profile_id: profile.clothing_profile_id,
      version: profile.version,
    },
    assets: profile.assets.map(createClothingRuntimeAsset),
    reads: ['character.reference', 'body_skin.bounds', 'simulationRig.transforms'],
    writes: ['clothing.mesh.transforms', 'clothing.mesh.material'],
    preserves: ['body_skin', 'body_vertices', 'skin_weights', 'rig', 'bone_lengths', 'hierarchy', 'pose', 'animation_tracks'],
  };
}

export function followSimulationRig(profileInput, simulationRigInput) {
  const profile = createClothingProfile(profileInput);
  const descriptor = createClothingRuntimeDescriptor(profile);
  const source = simulationRigInput?.fk || simulationRigInput || {};
  const positions = source.positions;
  const rotations = source.rotations;
  const assetFrames = descriptor.assets.map((runtimeAsset) => {
    const attachmentPoints = runtimeAsset.attachment.attachment_points;
    const missingAttachmentPoints = attachmentPoints.filter((jointId) => (
      !hasTransform(positions, jointId) || !hasTransform(rotations, jointId)
    ));
    const status = missingAttachmentPoints.length === 0 ? 'ready' : 'waiting-for-rig';
    return {
      clothing_id: runtimeAsset.clothing_id,
      type: runtimeAsset.type,
      source: 'simulationRig',
      status,
      asset: structuredClone(runtimeAsset.asset),
      profile_reference: structuredClone(descriptor.profile_reference),
      asset_reference: structuredClone(runtimeAsset.asset_reference),
      attachment: structuredClone(runtimeAsset.attachment),
      resolved_attachment_points: attachmentPoints.filter((jointId) => !missingAttachmentPoints.includes(jointId)),
      missing_attachment_points: missingAttachmentPoints,
      joint_transforms: Object.fromEntries(attachmentPoints.map((jointId) => [
        jointId,
        {
          position: vector(readTransform(positions, jointId), [0, 0, 0]),
          rotation: vector(readTransform(rotations, jointId), [0, 0, 0, 1]),
        },
      ])),
      render: {
        ...structuredClone(runtimeAsset.render),
        status,
        visible: status === 'ready',
      },
    };
  });
  const renderCommands = assetFrames.map((assetFrame) => ({
    operation: 'upsert',
    render_id: assetFrame.render.render_id,
    asset_reference: structuredClone(assetFrame.asset_reference),
    attachment_id: assetFrame.attachment.attachment_id,
    status: assetFrame.status,
    visible: assetFrame.render.visible,
    material: structuredClone(assetFrame.render.material),
    size_profile: structuredClone(assetFrame.render.size_profile),
    joint_transforms: structuredClone(assetFrame.joint_transforms),
  }));
  const readyCount = assetFrames.filter((item) => item.status === 'ready').length;
  return {
    schema: CLOTHING_FOLLOW_FRAME_SCHEMA,
    clothing_profile_id: profile.clothing_profile_id,
    clothing_revision: profile.version,
    rig_revision: String(simulationRigInput?.rigVersion || profile.assets[0]?.rig_profile.rig_revision || 'rig@0.4.0'),
    source: 'simulationRig',
    static_clothing: true,
    runtime_chain: [...CLOTHING_RUNTIME_CHAIN],
    profile_reference: structuredClone(descriptor.profile_reference),
    asset_frames: assetFrames,
    render_commands: renderCommands,
    render_status: {
      status: readyCount === assetFrames.length ? 'ready' : 'waiting-for-rig',
      ready_count: readyCount,
      waiting_count: assetFrames.length - readyCount,
    },
    writes: ['clothing.mesh.transforms'],
    preserves: ['body_skin', 'body_vertices', 'rig', 'pose', 'animation_tracks'],
  };
}

export function deliverClothingFrame(frameInput, renderer) {
  const renderCount = Array.isArray(frameInput?.render_commands) ? frameInput.render_commands.length : 0;
  if (!renderer || typeof renderer.applyClothingFrame !== 'function') {
    return { delivered: false, renderer: null, render_count: renderCount };
  }
  renderer.applyClothingFrame(structuredClone(frameInput));
  return {
    delivered: true,
    renderer: String(renderer.id || renderer.name || 'clothing-render-adapter'),
    render_count: renderCount,
  };
}

export class ClothingRuntime {
  constructor(profileInput = {}, { renderer = null } = {}) {
    this.profile = createClothingProfile(profileInput);
    this.descriptor = createClothingRuntimeDescriptor(this.profile);
    this.renderer = renderer;
    this.lastFrame = null;
  }

  setRenderer(renderer = null) {
    this.renderer = renderer;
    return this;
  }

  bind(profileInput) {
    this.profile = createClothingProfile(profileInput);
    this.descriptor = createClothingRuntimeDescriptor(this.profile);
    this.lastFrame = null;
    return structuredClone(this.descriptor);
  }

  update(simulationRigInput) {
    const frame = followSimulationRig(this.profile, simulationRigInput);
    this.lastFrame = {
      ...frame,
      render_delivery: deliverClothingFrame(frame, this.renderer),
    };
    return structuredClone(this.lastFrame);
  }
}

function createClothingRuntimeAsset(asset) {
  const assetReference = {
    schema: CLOTHING_ASSET_REFERENCE_SCHEMA,
    asset_kind: 'clothing',
    clothing_id: asset.clothing_id,
    revision: asset.revision,
    type: asset.type,
  };
  const attachment = {
    schema: CLOTHING_ATTACHMENT_SCHEMA,
    attachment_id: `clothing:${asset.clothing_id}`,
    target: 'simulationRig',
    attachment_points: [...asset.rig_profile.attachment_points],
    follow_mode: asset.physics_profile.mode,
  };
  return {
    clothing_id: asset.clothing_id,
    asset_revision: asset.revision,
    type: asset.type,
    attachment_points: [...asset.rig_profile.attachment_points],
    physics_mode: asset.physics_profile.mode,
    asset: structuredClone(asset),
    asset_reference: assetReference,
    attachment,
    render: {
      schema: CLOTHING_RENDER_INSTANCE_SCHEMA,
      render_id: `clothing:${asset.clothing_id}`,
      role: 'clothing',
      layer: 'clothing_mesh',
      visible: true,
      status: 'unresolved',
      material: structuredClone(asset.material),
      size_profile: structuredClone(asset.size_profile),
    },
  };
}

function readTransform(collection, key) {
  if (collection instanceof Map) return collection.get(key);
  if (collection && typeof collection === 'object') return collection[key];
  return undefined;
}

function hasTransform(collection, key) {
  return readTransform(collection, key) !== undefined;
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
