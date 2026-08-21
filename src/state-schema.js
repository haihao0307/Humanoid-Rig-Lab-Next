import {
  ACTIVE_VERSIONS,
  BUILD_ID,
  BUILD_VERSION,
  MODULE_BASE_REVISIONS,
  MODULE_IDS,
  SCHEMA_VERSION,
  createDefaultState,
} from './default-state.js';
import { bodyProfileRequiresSkinRebind } from '../legacy/v8/src/body-profile.js';
import { normalizeCharacterState } from '../packages/character-core/index.js';
import { normalizeBodyShapeState } from '../packages/body-shape/index.js';
import { normalizeFaceState } from '../packages/face-system/index.js';
import { clothingAttachmentReferences, normalizeClothingState } from '../packages/clothing-system/index.js';
import { getAppearanceCharacterReferences, normalizeAppearanceState } from '../packages/appearance-system/index.js';
import { normalizeCharacterGeneratorState } from '../apps/character-generator/character-generator.js';

const MODULE_SET = new Set(MODULE_IDS);
const SURFACE_SOURCES = new Set(['detail']);
const DISPLAY_MODES = new Set(['skin', 'skeleton', 'both']);

export function normalizeModuleId(value) {
  if (MODULE_SET.has(value)) return value;
  if (value === 'dashboard' || value === 'system') return 'integration';
  return 'integration';
}

export function normalizeProjectState(input) {
  const defaults = createDefaultState();
  const source = input && typeof input === 'object' ? structuredClone(input) : {};
  const state = mergeDefaults(defaults, source);
  state.schemaVersion = SCHEMA_VERSION;
  state.projectId = String(state.projectId || defaults.projectId);
  state.projectName = String(state.projectName || defaults.projectName);
  state.revision = Math.max(1, Number(state.revision || 1));
  state.updatedAt = validIso(state.updatedAt) ? state.updatedAt : new Date().toISOString();
  state.build = {
    ...defaults.build,
    ...(state.build || {}),
    id: BUILD_ID,
    version: BUILD_VERSION,
  };
  state.activeVersions = mergeDefaults(defaults.activeVersions, state.activeVersions || {});
  for (const [key, minimum] of Object.entries(ACTIVE_VERSIONS)) {
    state.activeVersions[key] = ensureVersionAtLeast(state.activeVersions[key], minimum);
  }

  state.moduleRevisions = state.moduleRevisions || {};
  state.moduleUpdatedAt = state.moduleUpdatedAt || {};
  for (const id of MODULE_IDS) {
    const minimumRevision = MODULE_BASE_REVISIONS[id] ?? 1;
    const sourceRevision = Math.max(0, Number(source.moduleRevisions?.[id] || 0));
    state.moduleRevisions[id] = Math.max(minimumRevision, Number(state.moduleRevisions[id] || minimumRevision));
    state.moduleUpdatedAt[id] = validIso(state.moduleUpdatedAt[id]) ? state.moduleUpdatedAt[id] : state.updatedAt;
    if (!defaults.modules[id]) continue;
    const incomingModule = state.modules?.[id] || {};
    const incomingVersion = String(incomingModule.version || '');
    const minimumVersion = defaults.modules[id].version;
    const needsMetadataUpgrade = sourceRevision < minimumRevision || isVersionOlder(incomingVersion, minimumVersion);
    state.modules[id] = needsMetadataUpgrade
      ? structuredClone(defaults.modules[id])
      : mergeDefaults(defaults.modules[id], incomingModule);
  }

  const profile = state.character.bodyProfile;
  profile.height = clamp(Number(profile.height), 1.40, 2.15, defaults.character.bodyProfile.height);
  profile.shoulderWidth = clamp(Number(profile.shoulderWidth), 0.28, 0.58, defaults.character.bodyProfile.shoulderWidth);
  profile.hipWidth = clamp(Number(profile.hipWidth), 0.14, 0.38, defaults.character.bodyProfile.hipWidth);
  profile.upperArmLength = clamp(Number(profile.upperArmLength), 0.20, 0.40, defaults.character.bodyProfile.upperArmLength);
  profile.forearmLength = clamp(Number(profile.forearmLength), 0.18, 0.36, defaults.character.bodyProfile.forearmLength);
  profile.handControlLength = clamp(Number(profile.handControlLength), 0.04, 0.12, defaults.character.bodyProfile.handControlLength);
  profile.thighLength = clamp(Number(profile.thighLength), 0.30, 0.56, defaults.character.bodyProfile.thighLength);
  profile.lowerLegLength = clamp(Number(profile.lowerLegLength), 0.30, 0.54, defaults.character.bodyProfile.lowerLegLength);
  profile.viewportMode = DISPLAY_MODES.has(profile.viewportMode) ? profile.viewportMode : 'skeleton';
  // The flag is derived from dimensions, not trusted from an older payload.
  // Otherwise a migrated/custom profile can silently keep the reference-skin path.
  profile.requiresRebind = bodyProfileRequiresSkinRebind(profile);
  profile.draftRevision = Math.max(1, Number(profile.draftRevision || 1));
  state.character.rigRules = mergeDefaults(defaults.character.rigRules, state.character.rigRules || {});
  state.character.rigRules.lockBoneIds = state.character.rigRules.lockBoneIds !== false;
  state.character.rigRules.lockBindPoseAfterPublish = state.character.rigRules.lockBindPoseAfterPublish !== false;
  state.character.rigRules.mirrorEditing = state.character.rigRules.mirrorEditing !== false;

  state.character.display.mode = DISPLAY_MODES.has(state.character.display.mode) ? state.character.display.mode : 'both';
  state.character.display.skinVisible = state.character.display.mode !== 'skeleton';
  state.character.display.skeletonVisible = state.character.display.mode !== 'skin';
  state.character.display.skinOpacity = clamp(Number(state.character.display.skinOpacity), 0.15, 1, 0.92);
  state.character.skin.source = SURFACE_SOURCES.has(state.character.skin.source) ? state.character.skin.source : 'detail';
  state.character.skin.activeSource = 'detail';
  state.character.skin.singleLayer = true;
  state.character.skin.detailAsset = defaults.character.skin.detailAsset;
  state.character.skin.bindingMetadata = defaults.character.skin.bindingMetadata;
  state.character.skin.bindingVersion = defaults.character.skin.bindingVersion;
  state.character.skin.runtimeBuildId = defaults.character.skin.runtimeBuildId;
  state.character.skin.pickingSource = defaults.character.skin.pickingSource;
  state.character.skin.deformation = defaults.character.skin.deformation;
  state.character.skin.bindPoseProtection = true;
  delete state.character.skin.fallbackAsset;
  state.character.skin.reloadToken = Math.max(0, Number(state.character.skin.reloadToken || 0));
  state.character.pose.poseSnapshot = state.character.pose.poseSnapshot && typeof state.character.pose.poseSnapshot === 'object'
    ? state.character.pose.poseSnapshot
    : null;
  state.character.pose.v8Payload = state.character.pose.v8Payload && typeof state.character.pose.v8Payload === 'object'
    ? state.character.pose.v8Payload
    : null;
  state.character.pose.imagePoseAssetId = state.character.pose.imagePoseAssetId == null
    ? null
    : String(state.character.pose.imagePoseAssetId);
  state.character.animation.keyframes = Array.isArray(state.character.animation.keyframes) ? state.character.animation.keyframes : [];
  state.bodyShape = normalizeBodyShapeState(state.bodyShape, {
    fallbackProfile: defaults.bodyShape.profiles.body_shape_001,
  });
  state.faceSystem = normalizeFaceState(state.faceSystem, {
    fallbackProfile: defaults.faceSystem.profiles.face_001,
  });
  state.clothingSystem = normalizeClothingState(state.clothingSystem, {
    fallbackProfile: defaults.clothingSystem.profiles.clothing_profile_001,
  });
  state.appearanceSystem = normalizeAppearanceState(state.appearanceSystem, {
    fallbackCharacterId: defaults.appearanceSystem.character_id,
  });
  state.characterGenerator = normalizeCharacterGeneratorState(state.characterGenerator);
  state.characterCore = normalizeCharacterState(state.characterCore, {
    fallbackProfile: defaults.characterCore.profiles.character_001,
  });
  reconcileFaceReference(state, source);
  reconcileClothingReferences(state, source);
  reconcileAppearanceReferences(state, source);
  state.operationEvents = uniqueOperationEvents(Array.isArray(state.operationEvents) ? state.operationEvents : []).slice(0, 200);
  state.activity = uniqueById(Array.isArray(state.activity) ? state.activity : []).slice(0, 100);
  state.reviews = uniqueById(Array.isArray(state.reviews) ? state.reviews : []).slice(0, 100);
  state.collaboration = mergeDefaults(defaults.collaboration, state.collaboration || {});
  return state;
}

export function createModulePatch(nextState, module, activityEntry = null) {
  const id = normalizeModuleId(module);
  const state = normalizeProjectState(nextState);
  const patch = {
    module: id,
    moduleRevision: state.moduleRevisions[id],
    moduleUpdatedAt: state.moduleUpdatedAt[id],
    optimisticRevision: state.revision,
    activityEntry: activityEntry ? structuredClone(activityEntry) : null,
    writer: state.collaboration.lastWriterByModule?.[id] || state.collaboration.lastWriter || null,
    moduleState: id === 'integration' ? null : structuredClone(state.modules[id])
  };

  if (id === 'proportion') {
    patch.bodyProfile = structuredClone(state.character.bodyProfile);
    patch.rigRules = structuredClone(state.character.rigRules);
    patch.activeVersion = state.activeVersions.rig;
  } else if (id === 'skin') {
    patch.display = structuredClone(state.character.display);
    patch.skin = structuredClone(state.character.skin);
    patch.activeVersion = state.activeVersions.skin;
  } else if (id === 'pose') {
    patch.pose = structuredClone(state.character.pose);
    patch.physics = structuredClone(state.character.physics);
    patch.activeVersion = state.activeVersions.pose;
  } else if (id === 'animation') {
    patch.animation = structuredClone(state.character.animation);
    patch.activeVersion = state.activeVersions.animation;
  } else if (id === 'clothing') {
    patch.clothingSystem = structuredClone(state.clothingSystem);
    patch.characterCore = structuredClone(state.characterCore);
    patch.operationEvents = structuredClone(state.operationEvents);
    patch.activeVersion = state.activeVersions.clothing;
  } else {
    patch.activeVersions = structuredClone(state.activeVersions);
    patch.display = structuredClone(state.character.display);
    patch.reviews = structuredClone(state.reviews);
    patch.characterCore = structuredClone(state.characterCore);
    patch.bodyShape = structuredClone(state.bodyShape);
    patch.faceSystem = structuredClone(state.faceSystem);
    patch.clothingSystem = structuredClone(state.clothingSystem);
    patch.appearanceSystem = structuredClone(state.appearanceSystem);
    patch.characterGenerator = structuredClone(state.characterGenerator);
    patch.operationEvents = structuredClone(state.operationEvents);
  }
  return patch;
}

export function applyModulePatch(currentState, incomingPatch) {
  const state = normalizeProjectState(currentState);
  const patch = incomingPatch && typeof incomingPatch === 'object' ? incomingPatch : {};
  const id = normalizeModuleId(patch.module);
  const incomingRevision = Math.max(1, Number(patch.moduleRevision || 1));
  const localRevision = Math.max(1, Number(state.moduleRevisions[id] || 1));
  const incomingTime = Date.parse(patch.moduleUpdatedAt || 0) || 0;
  const localTime = Date.parse(state.moduleUpdatedAt[id] || 0) || 0;
  if (incomingRevision < localRevision || (incomingRevision === localRevision && incomingTime < localTime)) {
    return { state, accepted: false, module: id };
  }

  if (id !== 'integration' && patch.moduleState) state.modules[id] = mergeDefaults(state.modules[id], patch.moduleState);
  if (id === 'proportion') {
    if (patch.bodyProfile) state.character.bodyProfile = mergeDefaults(state.character.bodyProfile, patch.bodyProfile);
    if (patch.rigRules) state.character.rigRules = mergeDefaults(state.character.rigRules, patch.rigRules);
    if (patch.activeVersion) state.activeVersions.rig = String(patch.activeVersion);
  } else if (id === 'skin') {
    if (patch.display) state.character.display = mergeDefaults(state.character.display, patch.display);
    if (patch.skin) state.character.skin = mergeDefaults(state.character.skin, patch.skin);
    if (patch.activeVersion) state.activeVersions.skin = String(patch.activeVersion);
  } else if (id === 'pose') {
    if (patch.pose) state.character.pose = mergeDefaults(state.character.pose, patch.pose);
    if (patch.physics) state.character.physics = mergeDefaults(state.character.physics, patch.physics);
    if (patch.activeVersion) state.activeVersions.pose = String(patch.activeVersion);
  } else if (id === 'animation') {
    if (patch.animation) state.character.animation = mergeDefaults(state.character.animation, patch.animation);
    if (patch.activeVersion) state.activeVersions.animation = String(patch.activeVersion);
  } else if (id === 'clothing') {
    if (patch.clothingSystem) {
      const incomingClothingSystem = normalizeClothingState(patch.clothingSystem, {
        fallbackProfile: state.clothingSystem.profiles.clothing_profile_001,
      });
      if (incomingClothingSystem.revision >= state.clothingSystem.revision) state.clothingSystem = incomingClothingSystem;
    }
    if (patch.characterCore) {
      const incomingCharacterCore = normalizeCharacterState(patch.characterCore, {
        fallbackProfile: state.characterCore.profiles.character_001,
      });
      if (incomingCharacterCore.revision >= state.characterCore.revision) state.characterCore = incomingCharacterCore;
    }
    if (Array.isArray(patch.operationEvents)) {
      state.operationEvents = uniqueOperationEvents([...patch.operationEvents, ...state.operationEvents]).slice(0, 200);
    }
    if (patch.activeVersion) state.activeVersions.clothing = String(patch.activeVersion);
  } else {
    if (patch.activeVersions) state.activeVersions = mergeDefaults(state.activeVersions, patch.activeVersions);
    if (patch.display) state.character.display = mergeDefaults(state.character.display, patch.display);
    if (Array.isArray(patch.reviews)) state.reviews = uniqueById([...patch.reviews, ...state.reviews]).slice(0, 100);
    if (patch.characterCore) {
      const incomingCharacterCore = normalizeCharacterState(patch.characterCore, {
        fallbackProfile: state.characterCore.profiles.character_001,
      });
      if (incomingCharacterCore.revision >= state.characterCore.revision) state.characterCore = incomingCharacterCore;
    }
    if (patch.bodyShape) {
      const incomingBodyShape = normalizeBodyShapeState(patch.bodyShape, {
        fallbackProfile: state.bodyShape.profiles.body_shape_001,
      });
      if (incomingBodyShape.revision >= state.bodyShape.revision) state.bodyShape = incomingBodyShape;
    }
    if (patch.faceSystem) {
      const incomingFaceSystem = normalizeFaceState(patch.faceSystem, {
        fallbackProfile: state.faceSystem.profiles.face_001,
      });
      if (incomingFaceSystem.revision >= state.faceSystem.revision) state.faceSystem = incomingFaceSystem;
    }
    if (patch.clothingSystem) {
      const incomingClothingSystem = normalizeClothingState(patch.clothingSystem, {
        fallbackProfile: state.clothingSystem.profiles.clothing_profile_001,
      });
      if (incomingClothingSystem.revision >= state.clothingSystem.revision) state.clothingSystem = incomingClothingSystem;
    }
    if (patch.appearanceSystem) {
      const incomingAppearanceSystem = normalizeAppearanceState(patch.appearanceSystem, {
        fallbackCharacterId: state.characterCore.active_character_id,
      });
      if (incomingAppearanceSystem.revision >= state.appearanceSystem.revision) state.appearanceSystem = incomingAppearanceSystem;
    }
    if (patch.characterGenerator) {
      const incomingGenerator = normalizeCharacterGeneratorState(patch.characterGenerator);
      if (incomingGenerator.revision >= state.characterGenerator.revision) state.characterGenerator = incomingGenerator;
    }
    if (Array.isArray(patch.operationEvents)) {
      state.operationEvents = uniqueOperationEvents([...patch.operationEvents, ...state.operationEvents]).slice(0, 200);
    }
  }

  const now = validIso(patch.moduleUpdatedAt) ? patch.moduleUpdatedAt : new Date().toISOString();
  state.moduleRevisions[id] = incomingRevision;
  state.moduleUpdatedAt[id] = now;
  state.revision = Math.max(Number(state.revision || 0) + 1, Number(patch.optimisticRevision || 0));
  state.updatedAt = now;
  state.collaboration.lastWriterByModule[id] = patch.writer || null;
  state.collaboration.lastWriter = patch.writer || state.collaboration.lastWriter;
  if (patch.activityEntry?.id) state.activity = uniqueById([patch.activityEntry, ...state.activity]).slice(0, 100);
  return { state: normalizeProjectState(state), accepted: true, module: id };
}

function ensureVersionAtLeast(value, minimum) {
  const incoming = parseVersion(value);
  const floor = parseVersion(minimum);
  if (!floor) return String(value || minimum);
  if (!incoming || incoming.name !== floor.name) return String(minimum);
  return compareVersionParts(incoming.parts, floor.parts) >= 0 ? String(value) : String(minimum);
}

function isVersionOlder(value, minimum) {
  const incoming = parseVersion(value);
  const floor = parseVersion(minimum);
  if (!floor) return false;
  if (!incoming || incoming.name !== floor.name) return true;
  return compareVersionParts(incoming.parts, floor.parts) < 0;
}

function parseVersion(value) {
  const match = /^([^@]+)@(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(String(value || ''));
  if (!match) return null;
  return {
    name: match[1],
    parts: [Number(match[2] || 0), Number(match[3] || 0), Number(match[4] || 0)],
  };
}

function compareVersionParts(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function mergeDefaults(defaultValue, sourceValue) {
  if (Array.isArray(defaultValue)) return Array.isArray(sourceValue) ? structuredClone(sourceValue) : structuredClone(defaultValue);
  if (!isPlainObject(defaultValue)) return sourceValue === undefined ? defaultValue : sourceValue;
  const result = {};
  const source = isPlainObject(sourceValue) ? sourceValue : {};
  for (const [key, value] of Object.entries(defaultValue)) result[key] = mergeDefaults(value, source[key]);
  for (const [key, value] of Object.entries(source)) if (!(key in result)) result[key] = structuredClone(value);
  return result;
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    const id = item?.id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function uniqueOperationEvents(items) {
  const seen = new Set();
  return items.filter((item) => {
    const id = item?.event_id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function reconcileFaceReference(state, source) {
  const activeFace = state.faceSystem.profiles[state.faceSystem.active_face_id];
  const activeCharacter = state.characterCore.profiles[state.characterCore.active_character_id];
  if (!activeFace || !activeCharacter) return;

  const sourceCharacterState = isPlainObject(source.characterCore) ? source.characterCore : {};
  const sourceCharacterId = String(
    sourceCharacterState.active_character_id || state.characterCore.active_character_id || '',
  );
  const sourceCharacter = isPlainObject(sourceCharacterState.profiles?.[sourceCharacterId])
    ? sourceCharacterState.profiles[sourceCharacterId]
    : null;
  const migratedWithoutFaceSystem = !isPlainObject(source.faceSystem);
  const referencedFaceId = activeCharacter.face_identity?.face_id;
  const referencedFaceVersions = state.faceSystem.versions[referencedFaceId] || [];
  const missingReference = !referencedFaceId
    || !state.faceSystem.profiles[referencedFaceId]
    || !referencedFaceVersions.some((profile) => profile.version === activeCharacter.face_identity.revision);
  const legacyCharacterWithoutFaceReference = migratedWithoutFaceSystem
    && !isPlainObject(sourceCharacter?.face_identity);
  const missingExpressionReference = !Number.isInteger(activeCharacter.expression_revision)
    || !isPlainObject(activeCharacter.expression_runtime_descriptor);
  const migrateExpressionReference = missingExpressionReference
    && (migratedWithoutFaceSystem || legacyCharacterWithoutFaceReference);
  if (!missingReference && !legacyCharacterWithoutFaceReference && !migrateExpressionReference) return;

  if (missingReference || legacyCharacterWithoutFaceReference) {
    activeCharacter.face_identity = {
      face_id: activeFace.face_id,
      revision: activeFace.version,
    };
    activeCharacter.face_revision = activeFace.version;
  }
  if (migrateExpressionReference) {
    activeCharacter.expression_revision = state.faceSystem.expression.expressionRevision;
    activeCharacter.expression_runtime_descriptor = structuredClone(state.faceSystem.expression_runtime_descriptor);
  }
}

function reconcileClothingReferences(state, source) {
  const activeProfile = state.clothingSystem.profiles[state.clothingSystem.active_profile_id];
  const activeCharacter = state.characterCore.profiles[state.characterCore.active_character_id];
  if (!activeProfile || !activeCharacter) return;
  const sourceCharacterState = isPlainObject(source.characterCore) ? source.characterCore : {};
  const sourceCharacterId = String(
    sourceCharacterState.active_character_id || state.characterCore.active_character_id || '',
  );
  const sourceCharacter = isPlainObject(sourceCharacterState.profiles?.[sourceCharacterId])
    ? sourceCharacterState.profiles[sourceCharacterId]
    : null;
  if (isPlainObject(source.clothingSystem) && Array.isArray(sourceCharacter?.clothing_attachments)) return;
  activeCharacter.clothing_attachments = clothingAttachmentReferences(activeProfile);
  activeCharacter.clothing_revision = activeProfile.version;
}

function reconcileAppearanceReferences(state, source) {
  const activeCharacter = state.characterCore.profiles[state.characterCore.active_character_id];
  if (!activeCharacter) return;
  const sourceCharacterState = isPlainObject(source.characterCore) ? source.characterCore : {};
  const sourceCharacterId = String(
    sourceCharacterState.active_character_id || state.characterCore.active_character_id || '',
  );
  const sourceCharacter = isPlainObject(sourceCharacterState.profiles?.[sourceCharacterId])
    ? sourceCharacterState.profiles[sourceCharacterId]
    : null;
  const hasAppearanceReferences = isPlainObject(source.appearanceSystem)
    && isPlainObject(sourceCharacter?.hair)
    && Array.isArray(sourceCharacter?.accessory_attachments);
  if (hasAppearanceReferences) return;
  const references = getAppearanceCharacterReferences(state.appearanceSystem);
  activeCharacter.hair = references.hair;
  activeCharacter.accessory_attachments = references.accessory_attachments;
  activeCharacter.hair_revision = references.hair_revision;
  activeCharacter.accessory_revision = references.accessory_revision;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validIso(value) {
  return Number.isFinite(Date.parse(value || ''));
}

function clamp(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}
