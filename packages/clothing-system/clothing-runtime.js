import { createClothingProfile } from './clothing-profile.js';
import { createClothingAsset } from './clothing-asset.js';
import { createClothingDefinition } from './clothing-definition.js';
import { createClothingReference } from './clothing-reference.js';

export const CLOTHING_RUNTIME_DESCRIPTOR_SCHEMA = 'humanoid_rig/clothing_runtime_descriptor@1.0';
export const CLOTHING_FOLLOW_FRAME_SCHEMA = 'humanoid_rig/clothing_follow_frame@1.0';
export const CLOTHING_ASSET_REFERENCE_SCHEMA = 'humanoid_rig/clothing_asset_reference@1.0';
export const CLOTHING_ATTACHMENT_SCHEMA = 'humanoid_rig/clothing_attachment@1.0';
export const CLOTHING_RENDER_INSTANCE_SCHEMA = 'humanoid_rig/clothing_render_instance@1.0';
export const CLOTHING_ATTACHMENT_TRANSFORM_SCHEMA = 'humanoid_rig/clothing_attachment_transform@1.0';
export const CLOTHING_CHARACTER_FIT_SCHEMA = 'humanoid_rig/clothing_character_fit@1.0';

export const CLOTHING_RUNTIME_CHAIN = Object.freeze([
  'asset',
  'profile',
  'reference',
  'attachment',
  'simulationRig',
  'render',
]);

export function createClothingRuntimeDescriptor(profileInput, { runtimeAssets = [] } = {}) {
  const profile = createClothingProfile(profileInput);
  const assets = mergeRuntimeAssets(profile.assets.map(createClothingRuntimeAsset), runtimeAssets);
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
    assets,
    reads: ['character.reference', 'body_skin.bounds', 'simulationRig.transforms'],
    writes: ['clothing.mesh.transforms', 'clothing.mesh.material'],
    preserves: ['body_skin', 'body_vertices', 'skin_weights', 'rig', 'bone_lengths', 'hierarchy', 'pose', 'animation_tracks'],
  };
}

export function followSimulationRig(profileInput, simulationRigInput, {
  runtimeAssets = [],
  attachmentTransforms = null,
  characterFit = null,
} = {}) {
  const profile = createClothingProfile(profileInput);
  const descriptor = createClothingRuntimeDescriptor(profile, { runtimeAssets });
  const normalizedFit = normalizeCharacterFit(characterFit);
  const source = simulationRigInput?.fk || simulationRigInput || {};
  const positions = source.positions;
  const rotations = source.rotations;
  const assetFrames = descriptor.assets.map((runtimeAsset) => {
    const attachmentPoints = runtimeAsset.attachment.attachment_points;
    const missingAttachmentPoints = attachmentPoints.filter((jointId) => (
      !hasTransform(positions, jointId) || !hasTransform(rotations, jointId)
    ));
    const status = missingAttachmentPoints.length === 0 ? 'ready' : 'waiting-for-rig';
    const attachmentTransform = normalizeAttachmentTransform(readTransform(attachmentTransforms, runtimeAsset.clothing_id));
    const fitTransform = createAssetFitTransform(runtimeAsset, normalizedFit);
    const renderTransform = combineRenderTransform(runtimeAsset, attachmentTransform, fitTransform);
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
      attachment_transform: attachmentTransform,
      fit_transform: fitTransform,
      render_transform: renderTransform,
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
    render_profile: structuredClone(assetFrame.render.render_profile),
    attachment_transform: structuredClone(assetFrame.attachment_transform),
    fit_transform: structuredClone(assetFrame.fit_transform),
    render_transform: structuredClone(assetFrame.render_transform),
    joint_transforms: structuredClone(assetFrame.joint_transforms),
  }));
  const readyCount = assetFrames.filter((item) => item.status === 'ready').length;
  return {
    schema: CLOTHING_FOLLOW_FRAME_SCHEMA,
    clothing_profile_id: profile.clothing_profile_id,
    clothing_revision: profile.version,
    rig_revision: String(simulationRigInput?.rigVersion || runtimeRigVersion(descriptor.assets) || 'rig@0.4.0'),
    source: 'simulationRig',
    static_clothing: true,
    runtime_chain: [...CLOTHING_RUNTIME_CHAIN],
    profile_reference: structuredClone(descriptor.profile_reference),
    character_fit: structuredClone(normalizedFit),
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
    this.runtimeAssets = new Map();
    this.attachmentTransforms = new Map();
    this.characterFit = createClothingCharacterFit();
    this.descriptor = createClothingRuntimeDescriptor(this.profile);
    this.renderer = renderer;
    this.lastFrame = null;
    this.lastSimulationRig = null;
  }

  setRenderer(renderer = null) {
    this.renderer = renderer;
    return this;
  }

  bind(profileInput) {
    this.profile = createClothingProfile(profileInput);
    const activeIds = new Set(this.profile.assets.map((asset) => asset.clothing_id));
    for (const clothingId of this.attachmentTransforms.keys()) {
      if (!activeIds.has(clothingId) && !this.runtimeAssets.has(clothingId)) this.attachmentTransforms.delete(clothingId);
    }
    this.refreshDescriptor();
    this.lastFrame = null;
    return structuredClone(this.descriptor);
  }

  attachClothing(assetInput, options = {}) {
    const runtimeAsset = createCoreClothingRuntimeAsset(assetInput, options);
    this.runtimeAssets.set(runtimeAsset.clothing_id, runtimeAsset);
    this.refreshDescriptor();
    if (this.lastSimulationRig) this.update(this.lastSimulationRig);
    return structuredClone(runtimeAsset);
  }

  detachClothing(clothingId) {
    const id = String(clothingId || '').trim();
    const removedRuntimeAsset = this.runtimeAssets.delete(id);
    const hasProfileAsset = this.profile.assets.some((asset) => asset.clothing_id === id);
    if (hasProfileAsset) {
      this.profile = createClothingProfile({
        ...this.profile,
        assets: this.profile.assets.filter((asset) => asset.clothing_id !== id),
      });
    }
    if (!removedRuntimeAsset && !hasProfileAsset) throw new Error(`ClothingAsset ${id} is not attached.`);
    this.attachmentTransforms.delete(id);
    this.refreshDescriptor();
    if (this.lastSimulationRig) this.update(this.lastSimulationRig);
    return structuredClone(this.descriptor);
  }

  updateClothingPose(simulationRigInput) {
    return this.update(simulationRigInput);
  }

  updateClothingTransform(clothingId, transformInput = {}) {
    const id = String(clothingId || '').trim();
    if (!this.descriptor.assets.some((asset) => asset.clothing_id === id)) {
      throw new Error(`ClothingAsset ${id} is not attached.`);
    }
    const transform = normalizeAttachmentTransform(transformInput);
    this.attachmentTransforms.set(id, transform);
    if (this.lastSimulationRig) return this.update(this.lastSimulationRig);
    return structuredClone(transform);
  }

  fitClothingToCharacter(input = {}, bodyProfileInput = null) {
    const source = isPlainObject(input) ? input : {};
    const hasEnvelope = 'bodyShape' in source || 'body_shape' in source || 'bodyProfile' in source || 'body_profile' in source;
    this.characterFit = createClothingCharacterFit({
      bodyShape: hasEnvelope ? (source.bodyShape || source.body_shape || {}) : source,
      bodyProfile: hasEnvelope ? (source.bodyProfile || source.body_profile || {}) : (bodyProfileInput || {}),
      bodyShapeRevision: source.bodyShapeRevision ?? source.body_shape_revision,
      proportionRevision: source.proportionRevision ?? source.proportion_revision,
    });
    if (this.lastSimulationRig) return this.update(this.lastSimulationRig);
    return structuredClone(this.characterFit);
  }

  update(simulationRigInput) {
    this.lastSimulationRig = simulationRigInput;
    const frame = followSimulationRig(this.profile, simulationRigInput, {
      runtimeAssets: [...this.runtimeAssets.values()],
      attachmentTransforms: this.attachmentTransforms,
      characterFit: this.characterFit,
    });
    this.lastFrame = {
      ...frame,
      render_delivery: deliverClothingFrame(frame, this.renderer),
    };
    return structuredClone(this.lastFrame);
  }

  refreshDescriptor() {
    this.descriptor = createClothingRuntimeDescriptor(this.profile, {
      runtimeAssets: [...this.runtimeAssets.values()],
    });
    return this.descriptor;
  }
}

export function createCoreClothingRuntimeAsset(assetInput, {
  definition: definitionInput = null,
  reference: referenceInput = null,
} = {}) {
  const asset = createClothingAsset(assetInput);
  const definition = createClothingDefinition(definitionInput || {
    clothingId: asset.clothingId,
    attachmentBones: asset.attachmentPoints,
  });
  if (definition.clothingId !== asset.clothingId) {
    throw new TypeError('ClothingDefinition clothingId must match ClothingAsset clothingId.');
  }
  const reference = createClothingReference(referenceInput || {
    clothingId: asset.clothingId,
    definitionId: definition.definitionId,
    revision: asset.assetReference.revision,
  });
  if (reference.clothingId !== asset.clothingId) {
    throw new TypeError('ClothingReference clothingId must match ClothingAsset clothingId.');
  }
  const physicsMode = ['static-follow', 'cloth-simulation'].includes(String(asset.metadata?.physicsMode))
    ? String(asset.metadata.physicsMode)
    : 'static-follow';
  const material = normalizeRuntimeMaterial(asset.metadata?.previewMaterial);
  const sizeProfile = normalizeRuntimeSizeProfile(asset.metadata?.sizeProfile);
  const renderProfile = { layer: layerIndex(asset.layer) };
  return {
    clothing_id: asset.clothingId,
    asset_revision: reference.revision,
    type: asset.category,
    attachment_points: [...definition.attachmentBones],
    physics_mode: physicsMode,
    simulation_interface: {
      active: false,
      physicsMode,
      collisionGroup: nullableString(asset.metadata?.collisionGroup),
      materialProperties: normalizeMaterialProperties(asset.metadata?.materialProperties),
    },
    asset: structuredClone(asset),
    definition: structuredClone(definition),
    clothing_reference: structuredClone(reference),
    asset_reference: {
      schema: CLOTHING_ASSET_REFERENCE_SCHEMA,
      asset_kind: 'clothing',
      clothing_id: asset.clothingId,
      revision: reference.revision,
      type: asset.category,
    },
    attachment: {
      schema: CLOTHING_ATTACHMENT_SCHEMA,
      attachment_id: `clothing:${asset.clothingId}`,
      target: 'simulationRig',
      attachment_points: [...definition.attachmentBones],
      follow_mode: 'static-follow',
    },
    render: {
      schema: CLOTHING_RENDER_INSTANCE_SCHEMA,
      render_id: `clothing:${asset.clothingId}`,
      role: 'clothing',
      layer: 'clothing_mesh',
      layer_index: renderProfile.layer,
      visible: true,
      status: 'unresolved',
      material,
      size_profile: sizeProfile,
      render_profile: renderProfile,
    },
  };
}

export function createClothingCharacterFit({
  bodyShape = {},
  bodyProfile = {},
  bodyShapeRevision = null,
  proportionRevision = null,
} = {}) {
  const shape = isPlainObject(bodyShape) ? bodyShape : {};
  const profile = isPlainObject(bodyProfile) ? bodyProfile : {};
  const heightScale = clamp(positive(profile.height, 1.795672) / 1.795672, 0.78, 1.25);
  const shoulderScale = clamp(positive(profile.shoulderWidth, 0.42) / 0.42, 0.72, 1.38);
  const hipScale = clamp(positive(profile.hipWidth, 0.20) / 0.20, 0.72, 1.45);
  const muscle = unit(shape.muscle, 0.5) - 0.5;
  const fat = unit(shape.fat, 0.5) - 0.5;
  return {
    schema: CLOTHING_CHARACTER_FIT_SCHEMA,
    body_shape_revision: nonNegativeInteger(bodyShapeRevision ?? shape.version, 0),
    proportion_revision: nonNegativeInteger(proportionRevision ?? profile.draftRevision, 0),
    scale: {
      height: round(heightScale),
      shoulder: round(shoulderScale * (1 + (unit(shape.shoulder_volume, 0.5) - 0.5) * 0.16)),
      chest: round((1 + fat * 0.14 + muscle * 0.06) * (1 + (unit(shape.chest_volume, 0.5) - 0.5) * 0.16)),
      waist: round((1 + fat * 0.16) * (1 + (unit(shape.waist_volume, 0.5) - 0.5) * 0.18)),
      hip: round(hipScale * (1 + (unit(shape.hip_volume, 0.5) - 0.5) * 0.18)),
      limb: round(1 + muscle * 0.08 + (unit(shape.leg_volume, 0.5) - 0.5) * 0.1),
      depth: round(1 + fat * 0.18 + muscle * 0.04),
    },
    offset: { x: 0, y: round((heightScale - 1) * 0.02), z: 0 },
    attachment_mode: 'recompute-from-simulationRig',
  };
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
    physics_mode: asset.physics_profile.physicsMode,
    simulation_interface: {
      active: false,
      physicsMode: asset.physics_profile.physicsMode,
      collisionGroup: asset.physics_profile.collisionGroup,
      materialProperties: structuredClone(asset.physics_profile.materialProperties),
    },
    asset: structuredClone(asset),
    asset_reference: assetReference,
    attachment,
    render: {
      schema: CLOTHING_RENDER_INSTANCE_SCHEMA,
      render_id: `clothing:${asset.clothing_id}`,
      role: 'clothing',
      layer: 'clothing_mesh',
      layer_index: asset.render_profile.layer,
      visible: true,
      status: 'unresolved',
      material: structuredClone(asset.material),
      size_profile: structuredClone(asset.size_profile),
      render_profile: structuredClone(asset.render_profile),
    },
  };
}

function mergeRuntimeAssets(profileAssets, runtimeAssets) {
  const assetsById = new Map(profileAssets.map((asset) => [asset.clothing_id, asset]));
  for (const asset of Array.isArray(runtimeAssets) ? runtimeAssets : []) {
    if (!asset?.clothing_id) continue;
    assetsById.set(String(asset.clothing_id), structuredClone(asset));
  }
  return [...assetsById.values()];
}

function normalizeCharacterFit(value) {
  if (value?.schema === CLOTHING_CHARACTER_FIT_SCHEMA) return structuredClone(value);
  return createClothingCharacterFit();
}

function normalizeAttachmentTransform(value = {}) {
  const source = isPlainObject(value) ? value : {};
  return {
    schema: CLOTHING_ATTACHMENT_TRANSFORM_SCHEMA,
    translation: vector(source.translation || source.position, [0, 0, 0]),
    rotation: normalizedQuaternion(source.rotation),
    scale: positiveVector(source.scale, [1, 1, 1]),
  };
}

function createAssetFitTransform(runtimeAsset, characterFit) {
  const type = String(runtimeAsset.type || 'upper_body');
  const scale = characterFit.scale;
  const fitScale = type === 'top' || type === 'upper_body'
    ? [scale.shoulder * scale.chest, scale.height, scale.depth]
    : type === 'pants' || type === 'lower_body'
      ? [scale.hip * scale.waist, scale.height, scale.depth]
      : type === 'shoes'
        ? [scale.limb, scale.height, scale.depth]
        : [scale.shoulder, scale.height, scale.depth];
  return {
    schema: CLOTHING_CHARACTER_FIT_SCHEMA,
    body_shape_revision: characterFit.body_shape_revision,
    proportion_revision: characterFit.proportion_revision,
    translation: [characterFit.offset.x, characterFit.offset.y, characterFit.offset.z],
    rotation: [0, 0, 0, 1],
    scale: fitScale.map(round),
    attachment_mode: characterFit.attachment_mode,
  };
}

function combineRenderTransform(runtimeAsset, attachmentTransform, fitTransform) {
  const size = runtimeAsset.render?.size_profile || {};
  const offset = size.offset || {};
  const sizeScale = positive(size.scale, 1);
  const length = positive(size.length, 1);
  return {
    translation: [
      attachmentTransform.translation[0] + finite(offset.x, 0) + fitTransform.translation[0],
      attachmentTransform.translation[1] + finite(offset.y, 0) + fitTransform.translation[1],
      attachmentTransform.translation[2] + finite(offset.z, 0) + fitTransform.translation[2],
    ].map(round),
    rotation: [...attachmentTransform.rotation],
    scale: [
      attachmentTransform.scale[0] * fitTransform.scale[0] * sizeScale,
      attachmentTransform.scale[1] * fitTransform.scale[1] * length,
      attachmentTransform.scale[2] * fitTransform.scale[2] * sizeScale,
    ].map(round),
  };
}

function runtimeRigVersion(assets) {
  for (const runtimeAsset of assets) {
    const legacyVersion = runtimeAsset.asset?.rig_profile?.rig_revision;
    if (legacyVersion) return legacyVersion;
    const versions = runtimeAsset.asset?.compatibleRig?.versions;
    if (Array.isArray(versions) && versions[0]) return versions[0];
  }
  return null;
}

function normalizeRuntimeMaterial(value) {
  const source = isPlainObject(value) ? value : {};
  return {
    base_color: /^#[0-9a-fA-F]{6}$/.test(String(source.base_color || '')) ? String(source.base_color).toLowerCase() : '#526d9e',
    roughness: unit(source.roughness, 0.78),
    metalness: unit(source.metalness, 0.02),
    opacity: unit(source.opacity, 1),
  };
}

function normalizeRuntimeSizeProfile(value) {
  const source = isPlainObject(value) ? value : {};
  const offset = isPlainObject(source.offset) ? source.offset : {};
  return {
    size: ['XS', 'S', 'M', 'L', 'XL', 'custom'].includes(String(source.size)) ? String(source.size) : 'M',
    scale: clamp(positive(source.scale, 1), 0.5, 2),
    length: clamp(positive(source.length, 1), 0.5, 2),
    offset: {
      x: clamp(finite(offset.x, 0), -1, 1),
      y: clamp(finite(offset.y, 0), -1, 1),
      z: clamp(finite(offset.z, 0), -1, 1),
    },
    body_shape_revision: nonNegativeInteger(source.body_shape_revision, 0),
  };
}

function normalizeMaterialProperties(value) {
  const source = isPlainObject(value) ? value : {};
  return {
    density: clamp(positive(source.density, 1), 0.01, 10),
    friction: unit(source.friction, 0.5),
    damping: unit(source.damping, 0.5),
  };
}

function layerIndex(value) {
  return ({ underwear: 0, base: 1, outer: 2, armor: 3 })[String(value)] ?? 1;
}

function normalizedQuaternion(value) {
  const quaternion = vector(value, [0, 0, 0, 1]);
  const length = Math.hypot(...quaternion);
  return length > 1e-8 ? quaternion.map((component) => round(component / length)) : [0, 0, 0, 1];
}

function positiveVector(value, fallback) {
  const result = vector(value, fallback);
  return result.every((component) => component > 0) ? result : [...fallback];
}

function positive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function unit(value, fallback) { return clamp(finite(value, fallback), 0, 1); }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function round(value) { return Math.round(Number(value) * 1e6) / 1e6; }
function nonNegativeInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}
function nullableString(value) {
  const result = String(value ?? '').trim();
  return result || null;
}
function isPlainObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }

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
