import {
  DEFAULT_BODY_SHAPE_PARAMETERS,
  getActiveBodyShapeProfile,
  normalizeBodyShapeState,
} from '../../packages/body-shape/index.js';
import {
  FACE_EXPRESSION_CHANNELS,
  createFaceIdentity,
  getActiveFaceIdentity,
  normalizeFaceState,
} from '../../packages/face-system/index.js';
import {
  getActiveClothingProfile,
  normalizeClothingState,
} from '../../packages/clothing-system/index.js';
import { normalizeAppearanceState } from '../../packages/appearance-system/index.js';
import { createDefaultState } from '../../src/default-state.js';
import { posePreset } from '../../src/modules/pose/index.js';
import {
  addClip,
  getActiveClip,
  mirrorAnimationClip,
  normalizeAnimationState,
  resolveTransportPlaybackStart,
  setActiveClip,
  setAnimationLayer,
  setTransport,
} from '../../src/modules/animation/model.js';
import {
  ACCESSORY_CATALOG,
  CLOTHING_CATALOG,
  HAIR_CATALOG,
  findAccessoryCatalogItem,
  findClothingCatalogItem,
  findHairCatalogItem,
} from './catalogs.js';

const PROPORTION_FIELDS = Object.freeze([
  'height', 'shoulderWidth', 'hipWidth', 'upperArmLength', 'forearmLength',
  'handControlLength', 'thighLength', 'lowerLegLength',
]);
const CLOTHING_SIZES = new Set(['XS', 'S', 'M', 'L', 'XL', 'custom']);

export class CharacterStudioController {
  constructor(hub) {
    if (!hub || typeof hub.getState !== 'function' || typeof hub.transaction !== 'function') {
      throw new TypeError('CharacterStudioController requires a ProjectHub-compatible client.');
    }
    this.hub = hub;
  }

  snapshot(state = this.hub.getState()) {
    return buildCharacterStudioSnapshot(state);
  }

  applyIdentity({ name, identityId = null, tags = [] }) {
    const current = this.hub.getCharacter();
    return this.hub.saveCharacter({
      character_id: current.character_id,
      name: String(name || current.name).trim(),
      identity: {
        identity_id: String(identityId || '').trim() || null,
        revision: current.identity.revision + 1,
        tags: normalizeTags(tags),
      },
    });
  }

  resetIdentity() {
    return this.applyIdentity({ name: 'Default Character', identityId: null, tags: [] });
  }

  applyBodyShape(parameters) {
    this.hub.updateBodyShape(pickFinite(parameters, Object.keys(DEFAULT_BODY_SHAPE_PARAMETERS)));
    return this.hub.saveBodyShapeVersion();
  }

  resetBodyShape() {
    return this.applyBodyShape(DEFAULT_BODY_SHAPE_PARAMETERS);
  }

  applyFace(patch) {
    this.hub.updateFaceIdentity(patch);
    return this.hub.saveFaceVersion();
  }

  applyFaceExpression(channels) {
    return this.hub.updateFaceExpression({ channels: pickFinite(channels, FACE_EXPRESSION_CHANNELS) });
  }

  mirrorFaceExpression() {
    return this.hub.mirrorFaceExpression();
  }

  mirrorFaceExpressionPair(pair) {
    return this.hub.mirrorFaceExpressionPair(pair);
  }

  resetFaceExpression() {
    return this.applyFaceExpression(Object.fromEntries(FACE_EXPRESSION_CHANNELS.map((channel) => [channel, 0])));
  }

  resetFace() {
    const current = this.hub.getFace();
    const defaults = createFaceIdentity({ face_id: current.face_id });
    this.applyFace({
      age: defaults.age,
      face_shape: defaults.face_shape,
      eye_shape: defaults.eye_shape,
      nose_shape: defaults.nose_shape,
      mouth_shape: defaults.mouth_shape,
      expression_profile: defaults.expression_profile,
    });
    return this.resetFaceExpression();
  }

  applyClothing(selection = {}) {
    let changed = false;
    for (const type of Object.keys(CLOTHING_CATALOG)) {
      const desiredId = String(selection[type] || '');
      const currentAssets = this.hub.getClothing().assets.filter((asset) => asset.type === type);
      for (const asset of currentAssets) {
        if (asset.clothing_id !== desiredId) {
          this.hub.removeClothingAsset(asset.clothing_id);
          changed = true;
        }
      }
      if (desiredId && !this.hub.getClothing().assets.some((asset) => asset.clothing_id === desiredId)) {
        const catalogItem = findClothingCatalogItem(desiredId);
        if (!catalogItem || catalogItem.type !== type) throw new Error(`Unsupported ${type} clothing selection ${desiredId}.`);
        this.hub.addClothingAsset(clothingAssetFromCatalog(catalogItem, this.hub.getState()));
        changed = true;
      }
    }
    return changed ? this.hub.saveClothingVersion() : this.hub.getState();
  }

  resetClothing() {
    return this.applyClothing({ top: '', pants: '', shoes: '' });
  }

  addClothing(clothingId) {
    const item = findClothingCatalogItem(clothingId);
    if (!item) throw new Error(`Unsupported clothing selection ${clothingId}.`);
    if (this.hub.getClothing().assets.some((asset) => asset.clothing_id === item.id)) return this.hub.getState();
    this.hub.addClothingAsset(clothingAssetFromCatalog(item, this.hub.getState()));
    return this.hub.saveClothingVersion();
  }

  removeClothing(clothingId) {
    const id = String(clothingId || '');
    if (!this.hub.getClothing().assets.some((asset) => asset.clothing_id === id)) return this.hub.getState();
    this.hub.removeClothingAsset(id);
    return this.hub.saveClothingVersion();
  }

  replaceClothing(clothingId, replacementId) {
    const current = this.hub.getClothing().assets.find((asset) => asset.clothing_id === String(clothingId || ''));
    if (!current) throw new Error(`ClothingAsset ${clothingId} does not exist.`);
    const replacement = findClothingCatalogItem(replacementId);
    if (!replacement || replacement.type !== current.type) {
      throw new Error(`Replacement ${replacementId} must be a ${current.type} clothing asset.`);
    }
    if (replacement.id === current.clothing_id) return this.hub.getState();
    this.hub.replaceClothingAsset(current.clothing_id, {
      clothing_id: replacement.id,
      type: replacement.type,
      material: { base_color: replacement.color },
    });
    return this.hub.saveClothingVersion();
  }

  applyClothingParameters(clothingId, parameters = {}) {
    const current = this.hub.getClothing().assets.find((asset) => asset.clothing_id === String(clothingId || ''));
    if (!current) throw new Error(`ClothingAsset ${clothingId} does not exist.`);
    const size = String(parameters.size || current.size_profile.size);
    if (!CLOTHING_SIZES.has(size)) throw new TypeError(`Unsupported clothing size ${size}.`);
    this.hub.updateClothingAsset(current.clothing_id, {
      size_profile: {
        size,
        scale: finiteInRange(parameters.scale ?? current.size_profile.scale, 0.5, 2, 'scale'),
        length: finiteInRange(parameters.length ?? current.size_profile.length, 0.5, 2, 'length'),
        offset: {
          x: finiteInRange(parameters.offsetX ?? current.size_profile.offset?.x, -1, 1, 'offsetX'),
          y: finiteInRange(parameters.offsetY ?? current.size_profile.offset?.y, -1, 1, 'offsetY'),
          z: finiteInRange(parameters.offsetZ ?? current.size_profile.offset?.z, -1, 1, 'offsetZ'),
        },
      },
      render_profile: {
        layer: integerInRange(parameters.layer ?? current.render_profile.layer, 0, 31, 'layer'),
      },
      material: {
        base_color: normalizeHexColor(parameters.baseColor, current.material.base_color),
        roughness: finiteInRange(parameters.roughness ?? current.material.roughness, 0, 1, 'roughness'),
        metalness: finiteInRange(parameters.metalness ?? current.material.metalness, 0, 1, 'metalness'),
        opacity: finiteInRange(parameters.opacity ?? current.material.opacity, 0, 1, 'opacity'),
      },
    });
    return this.hub.saveClothingVersion();
  }

  addClothingAccessory(type) {
    const requested = String(type || '');
    const currentTypes = new Set(this.snapshot().accessories.map((item) => item.type));
    currentTypes.add(requested);
    return this.applyAccessories([...currentTypes]);
  }

  removeClothingAccessory(type) {
    const requested = String(type || '');
    return this.applyAccessories(this.snapshot().accessories.map((item) => item.type).filter((item) => item !== requested));
  }

  applyHair(styleOrId) {
    const requested = String(styleOrId || '');
    let changed = false;
    if (!requested) {
      for (const hairId of Object.keys(this.hub.getState().appearanceSystem.hair_profiles || {})) {
        this.#removeHair(hairId);
        changed = true;
      }
    } else {
      const item = findHairCatalogItem(requested);
      if (!item) throw new Error(`Unsupported hair selection ${requested}.`);
      const appearance = this.hub.getState().appearanceSystem;
      if (appearance.hair_profiles?.[item.id]) {
        if (appearance.active_hair_id !== item.id) {
          this.hub.switchHair(item.id);
          changed = true;
        }
      } else {
        this.hub.addHair({ hair_id: item.id, name: item.label, style: item.style });
        changed = true;
      }
    }
    return changed ? this.hub.saveAppearanceVersion() : this.hub.getState();
  }

  resetHair() {
    return this.applyHair(null);
  }

  applyAccessories(enabledTypes = []) {
    const desiredTypes = new Set((Array.isArray(enabledTypes) ? enabledTypes : []).map(String));
    let changed = false;
    const current = Object.values(this.hub.getState().appearanceSystem.accessories || {});
    for (const accessory of current) {
      const catalog = findAccessoryCatalogItem(accessory.type);
      if (!desiredTypes.has(accessory.type) || !catalog || accessory.accessory_id !== catalog.id) {
        this.hub.removeAccessory(accessory.accessory_id);
        changed = true;
      }
    }
    for (const type of desiredTypes) {
      const item = findAccessoryCatalogItem(type);
      if (!item) throw new Error(`Unsupported accessory type ${type}.`);
      const exists = Object.values(this.hub.getState().appearanceSystem.accessories || {})
        .some((accessory) => accessory.type === type && accessory.accessory_id === item.id);
      if (!exists) {
        this.hub.addAccessory({ accessory_id: item.id, name: item.label, type: item.type });
        changed = true;
      }
    }
    return changed ? this.hub.saveAppearanceVersion() : this.hub.getState();
  }

  resetAccessories() {
    return this.applyAccessories([]);
  }

  applyProportion(parameters) {
    const values = pickFinite(parameters, PROPORTION_FIELDS);
    this.hub.transaction((state) => {
      Object.assign(state.character.bodyProfile, values);
      state.character.bodyProfile.draftRevision = Number(state.character.bodyProfile.draftRevision || 0) + 1;
    }, { module: 'proportion', summary: 'Character Studio 应用人物比例' });
    return this.#syncModuleReference('proportion', 'proportion_revision');
  }

  resetProportion() {
    const defaults = createDefaultState().character.bodyProfile;
    return this.applyProportion(Object.fromEntries(PROPORTION_FIELDS.map((key) => [key, defaults[key]])));
  }

  applyPose(presetId) {
    const preset = posePreset(presetId);
    this.hub.transaction((state) => {
      state.character.pose = {
        ...state.character.pose,
        name: preset.label,
        joints: preset.joints,
        poseSnapshot: null,
        v8Payload: null,
        imagePoseAssetId: null,
      };
    }, { module: 'pose', summary: `Character Studio 应用姿势 ${preset.label}` });
    return this.#syncModuleReference('pose', 'pose_revision');
  }

  resetPose() {
    return this.applyPose('a');
  }

  selectAnimationClip(clipId) {
    this.#mutateAnimation(`Character Studio 切换动画 ${clipId}`, (animation) => setActiveClip(animation, clipId));
    return this.#syncModuleReference('animation', 'animation_revision');
  }

  configureAnimationPreview({ clipId, speed = 1, trimStart = 0, trimEnd = null, blendWeight = 1 } = {}, nowMs = Date.now()) {
    this.#mutateAnimation(`Character Studio 配置动画 ${clipId || ''}`.trim(), (animationInput) => {
      let animation = clipId ? setActiveClip(animationInput, clipId) : animationInput;
      const clip = getActiveClip(animation);
      const start = finiteInRange(trimStart, 0, clip.duration, 'trimStart');
      const end = finiteInRange(trimEnd ?? clip.duration, 0, clip.duration, 'trimEnd');
      if (end <= start) throw new RangeError('trimEnd must be greater than trimStart.');
      const playbackSpeed = finiteInRange(speed, -4, 4, 'speed');
      const weight = finiteInRange(blendWeight, 0, 1, 'blendWeight');
      animation = setTransport(animation, {
        playing: false,
        speed: playbackSpeed,
        time: start,
        anchorTime: start,
        anchorRawTime: start,
        loopStart: start,
        loopEnd: end,
      }, nowMs);
      return setAnimationLayer(animation, 'base', { weight });
    });
    return this.#syncModuleReference('animation', 'animation_revision');
  }

  mirrorActiveAnimation() {
    let mirroredClipId = null;
    this.#mutateAnimation('Character Studio 镜像当前动画', (animation) => {
      const source = getActiveClip(animation);
      if (source.assetMetadata?.mirrorSupport === false) {
        throw new Error(`${source.name} does not support mirroring.`);
      }
      const next = addClip(animation, mirrorAnimationClip(source));
      mirroredClipId = next.activeClipId;
      return next;
    });
    this.#syncModuleReference('animation', 'animation_revision');
    return mirroredClipId;
  }

  playAnimation(nowMs = Date.now()) {
    this.#mutateAnimation('Character Studio 播放动画', (animation) => {
      const start = resolveTransportPlaybackStart(animation, nowMs);
      return setTransport(animation, {
        playing: true,
        time: start.time,
        anchorTime: start.time,
        anchorRawTime: start.rawTime,
        anchorIssuedAt: nowMs,
      }, nowMs);
    });
    return this.#syncModuleReference('animation', 'animation_revision');
  }

  pauseAnimation(nowMs = Date.now()) {
    this.#mutateAnimation('Character Studio 暂停动画', (animation) => setTransport(animation, { playing: false }, nowMs));
    return this.#syncModuleReference('animation', 'animation_revision');
  }

  stopAnimation(nowMs = Date.now()) {
    this.#mutateAnimation('Character Studio 停止动画', (animation) => setTransport(animation, {
      playing: false,
      time: 0,
      anchorTime: 0,
      anchorRawTime: 0,
    }, nowMs));
    return this.#syncModuleReference('animation', 'animation_revision');
  }

  resetAnimation() {
    this.#mutateAnimation('Character Studio 恢复默认动画', (animation) => setTransport(
      setActiveClip(animation, 'idle-breathe'),
      { playing: false, time: 0, anchorTime: 0, anchorRawTime: 0 },
    ));
    return this.#syncModuleReference('animation', 'animation_revision');
  }

  #mutateAnimation(summary, mutator) {
    this.hub.transaction((state) => {
      state.character.animation = mutator(normalizeAnimationFromState(state));
    }, { module: 'animation', summary });
  }

  #syncModuleReference(moduleId, field) {
    const state = this.hub.getState();
    const characterId = state.characterCore.active_character_id;
    if (!characterId) return state;
    return this.hub.updateCharacterReferences(characterId, {
      [field]: Number(state.moduleRevisions?.[moduleId] || 0),
    });
  }

  #removeHair(hairId) {
    return this.hub.removeHair(hairId);
  }
}

export function buildCharacterStudioSnapshot(state) {
  const profile = activeCharacterProfile(state);
  const bodyState = normalizeBodyShapeState(state.bodyShape);
  const bodyShape = bodyState.profiles[profile.body_shape.profile_id]
    || getActiveBodyShapeProfile(bodyState);
  const faceState = normalizeFaceState(state.faceSystem);
  const face = faceState.profiles[profile.face_identity.face_id]
    || getActiveFaceIdentity(faceState);
  const faceExpression = faceState.expression;
  const clothingState = normalizeClothingState(state.clothingSystem);
  const clothingProfile = getActiveClothingProfile(clothingState);
  const clothingById = new Map(clothingProfile.assets.map((asset) => [asset.clothing_id, asset]));
  const clothing = profile.clothing_attachments.map((reference) => clothingById.get(reference.clothing_id)).filter(Boolean);
  const appearance = normalizeAppearanceState(state.appearanceSystem, { fallbackCharacterId: profile.character_id });
  const hair = profile.hair.hair_id ? appearance.hair_profiles[profile.hair.hair_id] || null : null;
  const accessories = profile.accessory_attachments
    .map((reference) => appearance.accessories[reference.accessory_id])
    .filter(Boolean);
  const animation = normalizeAnimationFromState(state);
  const activeClip = getActiveClip(animation);
  return structuredClone({
    stateRevision: state.revision,
    moduleRevisions: state.moduleRevisions,
    profile,
    bodyShape,
    face,
    faceExpression,
    clothing,
    clothingProfile,
    hair,
    accessories,
    appearance,
    proportion: state.character.bodyProfile,
    pose: state.character.pose,
    animation,
    activeClip,
  });
}

function activeCharacterProfile(state) {
  const characterId = state?.characterCore?.active_character_id;
  const profile = characterId ? state.characterCore.profiles?.[characterId] : null;
  if (!profile) throw new Error('Character Studio requires an active CharacterProfile.');
  return profile;
}

function normalizeAnimationFromState(state) {
  return normalizeAnimationState(state.character.animation, {
    compatibleRig: state.activeVersions?.rig,
    sourcePoseVersion: state.activeVersions?.pose,
    targetProportionRevision: state.moduleRevisions?.proportion,
  });
}

function pickFinite(input, keys) {
  const result = {};
  for (const key of keys) {
    const value = Number(input?.[key]);
    if (!Number.isFinite(value)) throw new TypeError(`${key} must be a finite number.`);
    result[key] = value;
  }
  return result;
}

function finiteInRange(value, minimum, maximum, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new RangeError(`${name} must be between ${minimum} and ${maximum}.`);
  }
  return number;
}

function integerInRange(value, minimum, maximum, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new RangeError(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return number;
}

function normalizeHexColor(value, fallback) {
  const color = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : fallback;
}

function clothingAssetFromCatalog(item, state) {
  const characterId = state.characterCore?.active_character_id;
  const bodyShapeRevision = state.characterCore?.profiles?.[characterId]?.body_shape_revision || 0;
  return {
    clothing_id: item.id,
    type: item.type,
    rig_profile: { rig_revision: state.activeVersions?.rig || 'rig@0.4.0' },
    material: { base_color: item.color },
    size_profile: { size: 'M', scale: 1, length: 1, offset: { x: 0, y: 0, z: 0 }, body_shape_revision: bodyShapeRevision },
    render_profile: { layer: 1 },
  };
}

function normalizeTags(value) {
  const items = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(items.map((item) => String(item).trim()).filter(Boolean))];
}

export { ACCESSORY_CATALOG, CLOTHING_CATALOG, HAIR_CATALOG, PROPORTION_FIELDS };
