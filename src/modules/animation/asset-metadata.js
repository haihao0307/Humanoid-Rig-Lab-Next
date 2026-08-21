export const ANIMATION_ASSET_METADATA_SCHEMA = 'humanoid_rig/animation_asset_metadata@1.0';

export const ANIMATION_ASSET_CATEGORIES = Object.freeze([
  'idle',
  'locomotion',
  'jump',
  'gesture',
  'combat',
  'interaction',
]);

const CATEGORY_SET = new Set(ANIMATION_ASSET_CATEGORIES);
const ROOT_MOTION_MODES = new Set(['in_place', 'root_motion']);
const STABLE_ID = /^[A-Za-z][A-Za-z0-9_-]*$/;

/**
 * @typedef {Object} AnimationAssetMetadata
 * @property {string} clipId
 * @property {string} name
 * @property {'idle'|'locomotion'|'jump'|'gesture'|'combat'|'interaction'} category
 * @property {string[]} tags
 * @property {string} compatibleRig
 * @property {string[]} requiredChains
 * @property {Object[]} contacts
 * @property {{mode: string, rootJointId: string, enabled: boolean}} rootMotion
 * @property {boolean} mirrorSupport
 * @property {Object} retargetPolicy
 * @property {Object} quality
 */

/**
 * Joint IDs live only in this binding table. Motion authoring code addresses
 * semantic roles, while the existing rotationTrack remains the runtime truth.
 */
const SEMANTIC_MOTION_DEFINITIONS = Object.freeze({
  leftArmSwing: semanticDefinition('joint_chain', ['left_arm'], {
    anchor: 'leftShoulder',
    upper: 'leftUpperArm',
    lower: 'leftLowerArm',
    hand: 'leftHand',
  }),
  rightArmSwing: semanticDefinition('joint_chain', ['right_arm'], {
    anchor: 'rightShoulder',
    upper: 'rightUpperArm',
    lower: 'rightLowerArm',
    hand: 'rightHand',
  }),
  leftLegStep: semanticDefinition('joint_chain', ['left_leg'], {
    upper: 'leftUpperLeg',
    lower: 'leftLowerLeg',
    foot: 'leftFoot',
    toes: 'leftToes',
  }),
  rightLegStep: semanticDefinition('joint_chain', ['right_leg'], {
    upper: 'rightUpperLeg',
    lower: 'rightLowerLeg',
    foot: 'rightFoot',
    toes: 'rightToes',
  }),
  footContact: semanticDefinition('contact', ['left_leg', 'right_leg'], {
    left: 'leftFoot',
    right: 'rightFoot',
  }),
  bodyLean: semanticDefinition('joint_chain', ['root', 'spine'], {
    root: 'hips',
    lower: 'spine',
    middle: 'chest',
    upper: 'upperChest',
  }),
  headGesture: semanticDefinition('joint_chain', ['head'], {
    base: 'neck',
    head: 'head',
    tip: 'headTop',
  }),
  breathing: semanticDefinition('joint_chain', ['spine', 'left_arm', 'right_arm'], {
    lower: 'spine',
    middle: 'chest',
    upper: 'upperChest',
    leftAnchor: 'leftShoulder',
    rightAnchor: 'rightShoulder',
  }),
});

const MIRRORED_SEMANTICS = Object.freeze({
  leftArmSwing: 'rightArmSwing',
  rightArmSwing: 'leftArmSwing',
  leftLegStep: 'rightLegStep',
  rightLegStep: 'leftLegStep',
  footContact: 'footContact',
  bodyLean: 'bodyLean',
  headGesture: 'headGesture',
  breathing: 'breathing',
});

export const SEMANTIC_MOTION_CHANNELS = Object.freeze(Object.keys(SEMANTIC_MOTION_DEFINITIONS));

export function normalizeAnimationAssetMetadata(input = {}, { clip = {} } = {}) {
  const source = isPlainObject(input) ? input : {};
  const semanticChannels = normalizeSemanticMotionChannels(clip.semanticChannels, { clip });
  const inferredCategory = inferAnimationCategory(clip);
  const requestedCategory = String(source.category || clip.metadata?.category || inferredCategory);
  const category = CATEGORY_SET.has(requestedCategory) ? requestedCategory : inferredCategory;
  const derivedChains = semanticChannels.flatMap((channel) => (
    SEMANTIC_MOTION_DEFINITIONS[channel.semantic]?.requiredChains || []
  ));
  const explicitChains = Array.isArray(source.requiredChains || source.required_chains)
    ? (source.requiredChains || source.required_chains).map(String)
    : [];
  const clipContacts = Array.isArray(clip.contacts)
    ? clone(clip.contacts)
    : Array.isArray(source.contacts) ? clone(source.contacts) : [];
  const rootMotionSource = isPlainObject(source.rootMotion || source.root_motion)
    ? (source.rootMotion || source.root_motion)
    : {};
  const mode = ROOT_MOTION_MODES.has(clip.rootMotionMode)
    ? clip.rootMotionMode
    : ROOT_MOTION_MODES.has(rootMotionSource.mode) ? rootMotionSource.mode : 'in_place';
  const rootJointId = String(clip.rootJointId || rootMotionSource.rootJointId || rootMotionSource.root_joint_id || 'hips');
  const retargetPolicy = isPlainObject(clip.retargetPolicy)
    ? clone(clip.retargetPolicy)
    : isPlainObject(source.retargetPolicy || source.retarget_policy)
      ? clone(source.retargetPolicy || source.retarget_policy)
      : {};
  const quality = isPlainObject(clip.quality)
    ? clone(clip.quality)
    : isPlainObject(source.quality) ? clone(source.quality) : {};

  return {
    schema: ANIMATION_ASSET_METADATA_SCHEMA,
    type: 'AnimationAssetMetadata',
    clipId: sanitizeId(clip.clipId || source.clipId || source.clip_id, 'custom'),
    name: String(clip.name || source.name || 'Untitled Clip'),
    category,
    tags: uniqueStrings(source.tags ?? clip.metadata?.tags),
    compatibleRig: String(clip.compatibleRig || source.compatibleRig || source.compatible_rig || 'unknown-rig'),
    requiredChains: uniqueStrings(derivedChains.length ? derivedChains : explicitChains),
    contacts: clipContacts,
    rootMotion: {
      mode,
      rootJointId,
      enabled: mode === 'root_motion',
    },
    mirrorSupport: source.mirrorSupport ?? source.mirror_support ?? true,
    retargetPolicy,
    quality,
  };
}

export function validateAnimationAssetMetadata(input, { clip = null } = {}) {
  const errors = [];
  const warnings = [];
  const source = isPlainObject(input) ? input : {};

  if (source.schema !== ANIMATION_ASSET_METADATA_SCHEMA) errors.push('ASSET_METADATA_SCHEMA_INVALID');
  if (source.type !== 'AnimationAssetMetadata') errors.push('ASSET_METADATA_TYPE_INVALID');
  if (!STABLE_ID.test(String(source.clipId || ''))) errors.push('ASSET_METADATA_CLIP_ID_INVALID');
  if (!String(source.name || '').trim()) errors.push('ASSET_METADATA_NAME_MISSING');
  if (!CATEGORY_SET.has(source.category)) errors.push(`ASSET_METADATA_CATEGORY_INVALID:${source.category || 'empty'}`);
  if (!Array.isArray(source.tags) || source.tags.some((tag) => typeof tag !== 'string')) errors.push('ASSET_METADATA_TAGS_INVALID');
  if (!String(source.compatibleRig || '').trim()) errors.push('ASSET_METADATA_COMPATIBLE_RIG_MISSING');
  if (!Array.isArray(source.requiredChains) || source.requiredChains.some((chain) => !STABLE_ID.test(String(chain)))) {
    errors.push('ASSET_METADATA_REQUIRED_CHAINS_INVALID');
  }
  if (!Array.isArray(source.contacts)) errors.push('ASSET_METADATA_CONTACTS_INVALID');
  if (!isPlainObject(source.rootMotion)) errors.push('ASSET_METADATA_ROOT_MOTION_INVALID');
  else {
    if (!ROOT_MOTION_MODES.has(source.rootMotion.mode)) errors.push('ASSET_METADATA_ROOT_MOTION_MODE_INVALID');
    if (!STABLE_ID.test(String(source.rootMotion.rootJointId || ''))) errors.push('ASSET_METADATA_ROOT_JOINT_INVALID');
    if (typeof source.rootMotion.enabled !== 'boolean') errors.push('ASSET_METADATA_ROOT_MOTION_ENABLED_INVALID');
  }
  if (typeof source.mirrorSupport !== 'boolean') errors.push('ASSET_METADATA_MIRROR_SUPPORT_INVALID');
  if (!isPlainObject(source.retargetPolicy)) errors.push('ASSET_METADATA_RETARGET_POLICY_INVALID');
  if (!isPlainObject(source.quality)) errors.push('ASSET_METADATA_QUALITY_INVALID');

  if (clip) {
    if (String(source.clipId || '') !== String(clip.clipId || '')) errors.push('ASSET_METADATA_CLIP_ID_MISMATCH');
    if (String(source.name || '') !== String(clip.name || '')) errors.push('ASSET_METADATA_NAME_MISMATCH');
    if (String(source.compatibleRig || '') !== String(clip.compatibleRig || '')) errors.push('ASSET_METADATA_RIG_MISMATCH');
    if (clip.rootMotionMode && source.rootMotion?.mode !== clip.rootMotionMode) errors.push('ASSET_METADATA_ROOT_MOTION_MISMATCH');
    if (clip.rootJointId && source.rootMotion?.rootJointId !== clip.rootJointId) errors.push('ASSET_METADATA_ROOT_JOINT_MISMATCH');
    if (Array.isArray(source.contacts) && stableStringify(source.contacts) !== stableStringify(clip.contacts || [])) {
      errors.push('ASSET_METADATA_CONTACTS_MISMATCH');
    }
    if (isPlainObject(source.retargetPolicy) && stableStringify(source.retargetPolicy) !== stableStringify(clip.retargetPolicy || {})) {
      errors.push('ASSET_METADATA_RETARGET_POLICY_MISMATCH');
    }
    if (isPlainObject(source.quality) && stableStringify(source.quality) !== stableStringify(clip.quality || {})) {
      errors.push('ASSET_METADATA_QUALITY_MISMATCH');
    }
  }

  if (!source.tags?.length) warnings.push('ASSET_METADATA_TAGS_EMPTY');
  return { valid: errors.length === 0, errors: uniqueStrings(errors), warnings: uniqueStrings(warnings) };
}

export function normalizeSemanticMotionChannels(input, {
  clip = null,
  includeInferred = true,
} = {}) {
  const channels = Array.isArray(input)
    ? input.map(normalizeSemanticChannel).filter((channel) => channel.metadata.derived !== true)
    : [];
  if (includeInferred && clip) channels.push(...inferSemanticMotionChannels(clip));
  const unique = new Map();
  for (const channel of channels) {
    const key = `${channel.channelId}:${channel.semantic}`;
    if (!unique.has(key)) unique.set(key, channel);
  }
  return [...unique.values()];
}

export function inferSemanticMotionChannels(clipInput = {}) {
  const clip = isPlainObject(clipInput) ? clipInput : {};
  const rotationJointIds = new Set((clip.tracks || [])
    .filter((track) => track?.channel === 'rotation')
    .map((track) => String(track.jointId || track.joint_id || '')));
  const contactJointIds = new Set((clip.contacts || [])
    .map((contact) => String(contact.jointId || contact.joint_id || '')));
  const result = [];
  for (const [semantic, definition] of Object.entries(SEMANTIC_MOTION_DEFINITIONS)) {
    const jointIds = Object.values(definition.joints);
    const matched = definition.kind === 'contact'
      ? jointIds.some((jointId) => contactJointIds.has(jointId))
      : jointIds.some((jointId) => rotationJointIds.has(jointId));
    if (matched) result.push(normalizeSemanticChannel({
      channelId: semantic,
      semantic,
      required: true,
      metadata: { derived: true },
    }));
  }
  return result;
}

export function validateSemanticMotionChannels(input, {
  clip = null,
  jointMap = {},
} = {}) {
  const errors = [];
  const warnings = [];
  if (!Array.isArray(input)) return { valid: false, errors: ['SEMANTIC_CHANNELS_INVALID'], warnings, stats: { channels: 0, resolvedJoints: 0 } };
  const channelIds = new Set();
  let resolvedJoints = 0;
  for (const raw of input) {
    const channel = normalizeSemanticChannel(raw);
    if (!STABLE_ID.test(channel.channelId)) errors.push(`SEMANTIC_CHANNEL_ID_INVALID:${channel.channelId || 'empty'}`);
    else if (channelIds.has(channel.channelId)) errors.push(`SEMANTIC_CHANNEL_ID_DUPLICATE:${channel.channelId}`);
    else channelIds.add(channel.channelId);
    if (!SEMANTIC_MOTION_DEFINITIONS[channel.semantic]) {
      errors.push(`SEMANTIC_CHANNEL_UNKNOWN:${channel.semantic || 'empty'}`);
      continue;
    }
    const resolved = resolveSemanticMotionChannel(channel, { clip, jointMap });
    resolvedJoints += resolved.jointIds.length;
    if (!resolved.jointIds.length) errors.push(`SEMANTIC_CHANNEL_UNRESOLVED:${channel.channelId}`);
    if (clip && channel.required) {
      const hasContent = resolved.kind === 'contact' ? resolved.contacts.length > 0 : resolved.tracks.length > 0;
      if (!hasContent) errors.push(`SEMANTIC_CHANNEL_CONTENT_MISSING:${channel.channelId}`);
    }
    if (resolved.kind === 'joint_chain' && resolved.tracks.length < resolved.sourceJointIds.length) {
      warnings.push(`SEMANTIC_CHANNEL_PARTIAL_TRACKS:${channel.channelId}`);
    }
  }
  return {
    valid: errors.length === 0,
    errors: uniqueStrings(errors),
    warnings: uniqueStrings(warnings),
    stats: { channels: input.length, resolvedJoints },
  };
}

export function resolveSemanticMotionChannel(channelInput, {
  clip = null,
  jointMap = {},
} = {}) {
  const channel = normalizeSemanticChannel(channelInput);
  const definition = SEMANTIC_MOTION_DEFINITIONS[channel.semantic];
  if (!definition) {
    return {
      ...channel,
      kind: 'unknown',
      requiredChains: [],
      sourceJoints: {},
      joints: {},
      sourceJointIds: [],
      jointIds: [],
      tracks: [],
      contacts: [],
    };
  }
  const sourceJoints = clone(definition.joints);
  const joints = Object.fromEntries(Object.entries(sourceJoints).map(([role, jointId]) => [
    role,
    String(jointMap[jointId] || jointId),
  ]));
  const sourceJointIds = uniqueStrings(Object.values(sourceJoints));
  const jointIds = uniqueStrings(Object.values(joints));
  const tracks = Array.isArray(clip?.tracks)
    ? clip.tracks.filter((track) => sourceJointIds.includes(String(track?.jointId || track?.joint_id || ''))).map(clone)
    : [];
  const contacts = Array.isArray(clip?.contacts)
    ? clip.contacts.filter((contact) => sourceJointIds.includes(String(contact?.jointId || contact?.joint_id || ''))).map(clone)
    : [];
  return {
    ...channel,
    kind: definition.kind,
    requiredChains: [...definition.requiredChains],
    sourceJoints,
    joints,
    sourceJointIds,
    jointIds,
    tracks,
    contacts,
  };
}

export function mapSemanticMotionValues(semantic, roleValues = {}, options = {}) {
  const resolved = resolveSemanticMotionChannel(semantic, options);
  const result = {};
  for (const [role, value] of Object.entries(roleValues || {})) {
    const jointId = resolved.joints[role];
    if (jointId && value !== undefined) result[jointId] = clone(value);
  }
  return result;
}

export function mirrorSemanticMotionChannels(input) {
  return normalizeSemanticMotionChannels(input, { includeInferred: false }).map((channel) => {
    const semantic = MIRRORED_SEMANTICS[channel.semantic] || channel.semantic;
    return {
      ...channel,
      channelId: channel.channelId === channel.semantic ? semantic : channel.channelId,
      semantic,
      metadata: { ...channel.metadata, mirroredFrom: channel.semantic },
    };
  });
}

function normalizeSemanticChannel(input) {
  const source = typeof input === 'string' ? { semantic: input } : isPlainObject(input) ? input : {};
  const semantic = String(source.semantic || source.semanticId || source.semantic_id || source.channelId || source.channel_id || 'unknown');
  return {
    channelId: sanitizeId(source.channelId || source.channel_id || semantic, semantic),
    semantic,
    required: source.required !== false,
    metadata: isPlainObject(source.metadata) ? clone(source.metadata) : {},
  };
}

function semanticDefinition(kind, requiredChains, joints) {
  return Object.freeze({
    kind,
    requiredChains: Object.freeze([...requiredChains]),
    joints: Object.freeze({ ...joints }),
  });
}

function inferAnimationCategory(clip) {
  const text = `${clip?.clipId || ''} ${clip?.name || ''}`.toLowerCase();
  if (/idle|breathe|stand/.test(text)) return 'idle';
  if (/walk|run|locomotion|squat/.test(text)) return 'locomotion';
  if (/jump|hop|leap/.test(text)) return 'jump';
  if (/wave|nod|gesture/.test(text)) return 'gesture';
  if (/combat|attack|hit|kick|punch/.test(text)) return 'combat';
  return 'interaction';
}

function sanitizeId(value, fallback) {
  const text = String(value || fallback).trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  const safe = text || fallback;
  return /^[A-Za-z]/.test(safe) ? safe : `id-${safe}`;
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))];
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function clone(value) {
  if (value === undefined) return undefined;
  return structuredClone(value);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
