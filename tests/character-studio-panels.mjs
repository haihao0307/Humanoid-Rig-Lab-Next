import assert from 'node:assert/strict';
import {
  CharacterManager,
  appendOperationEvent,
} from '../packages/character-core/index.js';
import {
  BodyShapeEditor,
  getActiveBodyShapeProfile,
} from '../packages/body-shape/index.js';
import {
  FaceEditor,
  getActiveFaceIdentity,
} from '../packages/face-system/index.js';
import {
  ClothingManager,
  clothingAttachmentReferences,
  getActiveClothingProfile,
} from '../packages/clothing-system/index.js';
import {
  AppearanceManager,
  getAppearanceCharacterReferences,
} from '../packages/appearance-system/index.js';
import { createDefaultState } from '../src/default-state.js';
import { normalizeProjectState } from '../src/state-schema.js';
import {
  CharacterStudioController,
  buildCharacterStudioSnapshot,
} from '../apps/character-studio/character-studio-controller.js';
import {
  CHARACTER_STUDIO_PANELS,
  renderCharacterStudioSidebar,
} from '../apps/character-studio/components/character-studio-sidebar.js';

const characterManager = new CharacterManager();
const bodyShapeEditor = new BodyShapeEditor();
const faceEditor = new FaceEditor();
const clothingManager = new ClothingManager();
const appearanceManager = new AppearanceManager();

class MemoryHub {
  constructor() { this.state = createDefaultState(); }
  getState() { return structuredClone(this.state); }
  getCharacter(id = this.state.characterCore.active_character_id) { return characterManager.load(this.state.characterCore, id); }
  getBodyShape() { return bodyShapeEditor.loadVersion(this.state.bodyShape); }
  getFace() { return faceEditor.loadVersion(this.state.faceSystem); }
  getClothing() { return clothingManager.loadVersion(this.state.clothingSystem); }

  transaction(mutator, { module = 'integration' } = {}) {
    const next = this.getState();
    mutator(next);
    next.moduleRevisions[module] = Number(next.moduleRevisions[module] || 1) + 1;
    next.moduleUpdatedAt[module] = new Date().toISOString();
    next.revision += 1;
    next.updatedAt = new Date().toISOString();
    this.state = normalizeProjectState(next);
    return this.getState();
  }

  saveCharacter(patch) {
    const result = characterManager.save(this.state.characterCore, patch, {
      expected_revision: this.state.characterCore.revision,
      actor: 'character-studio-test',
    });
    return this.#commitCharacterResult(result);
  }

  updateCharacterReferences(characterId, references) {
    const result = characterManager.updateReferences(this.state.characterCore, characterId, references, {
      expected_revision: this.state.characterCore.revision,
      actor: 'character-studio-test',
    });
    return this.#commitCharacterResult(result);
  }

  updateBodyShape(parameters) {
    const bodyShape = bodyShapeEditor.update(this.state.bodyShape, parameters, {
      expected_revision: this.state.bodyShape.revision,
    });
    return this.transaction((next) => { next.bodyShape = bodyShape; }, { module: 'integration' });
  }

  saveBodyShapeVersion() {
    const bodyShape = bodyShapeEditor.saveVersion(this.state.bodyShape, {
      expected_revision: this.state.bodyShape.revision,
    });
    const profile = getActiveBodyShapeProfile(bodyShape);
    return this.#commitModuleAndCharacter('bodyShape', bodyShape, {
      body_shape: { profile_id: profile.body_shape_id, revision: profile.version },
      body_shape_revision: profile.version,
    }, 'integration');
  }

  updateFaceIdentity(patch) {
    const faceSystem = faceEditor.update(this.state.faceSystem, patch, {
      expected_revision: this.state.faceSystem.revision,
    });
    return this.transaction((next) => { next.faceSystem = faceSystem; }, { module: 'integration' });
  }

  saveFaceVersion() {
    const faceSystem = faceEditor.saveVersion(this.state.faceSystem, {
      expected_revision: this.state.faceSystem.revision,
    });
    const profile = getActiveFaceIdentity(faceSystem);
    return this.#commitModuleAndCharacter('faceSystem', faceSystem, {
      face_identity: { face_id: profile.face_id, revision: profile.version },
      face_revision: profile.version,
    }, 'integration');
  }

  addClothingAsset(asset) {
    const system = clothingManager.add(this.state.clothingSystem, asset, {
      expected_revision: this.state.clothingSystem.revision,
    });
    return this.#commitClothing(system);
  }

  removeClothingAsset(id) {
    const system = clothingManager.remove(this.state.clothingSystem, id, {
      expected_revision: this.state.clothingSystem.revision,
    });
    return this.#commitClothing(system);
  }

  saveClothingVersion() {
    const system = clothingManager.saveVersion(this.state.clothingSystem, {
      expected_revision: this.state.clothingSystem.revision,
    });
    return this.#commitClothing(system);
  }

  addHair(profile) {
    const system = appearanceManager.addHair(this.state.appearanceSystem, profile, {
      expected_revision: this.state.appearanceSystem.revision,
    });
    return this.#commitAppearance(system);
  }

  switchHair(id) {
    const system = appearanceManager.switchHair(this.state.appearanceSystem, id, {
      expected_revision: this.state.appearanceSystem.revision,
    });
    return this.#commitAppearance(system);
  }

  addAccessory(profile) {
    const system = appearanceManager.addAccessory(this.state.appearanceSystem, profile, {
      expected_revision: this.state.appearanceSystem.revision,
    });
    return this.#commitAppearance(system);
  }

  removeAccessory(id) {
    const system = appearanceManager.removeAccessory(this.state.appearanceSystem, id, {
      expected_revision: this.state.appearanceSystem.revision,
    });
    return this.#commitAppearance(system);
  }

  saveAppearanceVersion() {
    const system = appearanceManager.saveVersion(this.state.appearanceSystem, {
      expected_revision: this.state.appearanceSystem.revision,
    });
    return this.#commitAppearance(system);
  }

  #commitCharacterResult(result) {
    this.transaction((next) => {
      next.characterCore = result.state;
      next.operationEvents = appendOperationEvent(next.operationEvents, result.event);
    }, { module: 'integration' });
    return { state: this.getState(), profile: result.profile, event: result.event };
  }

  #commitModuleAndCharacter(key, system, references, module) {
    const characterId = this.state.characterCore.active_character_id;
    const result = characterManager.save(this.state.characterCore, {
      character_id: characterId,
      ...references,
    }, {
      expected_revision: this.state.characterCore.revision,
      actor: 'character-studio-test',
    });
    this.transaction((next) => {
      next[key] = system;
      next.characterCore = result.state;
      next.operationEvents = appendOperationEvent(next.operationEvents, result.event);
    }, { module });
    return this.getState();
  }

  #commitClothing(system) {
    const profile = getActiveClothingProfile(system);
    return this.#commitModuleAndCharacter('clothingSystem', system, {
      clothing_attachments: clothingAttachmentReferences(profile),
      clothing_revision: profile.version,
    }, 'clothing');
  }

  #commitAppearance(system) {
    return this.#commitModuleAndCharacter(
      'appearanceSystem',
      system,
      getAppearanceCharacterReferences(system),
      'integration',
    );
  }
}

const hub = new MemoryHub();
const controller = new CharacterStudioController(hub);

let snapshot = buildCharacterStudioSnapshot(hub.getState());
const markup = renderCharacterStudioSidebar(snapshot);
assert.deepEqual(CHARACTER_STUDIO_PANELS.map((panel) => panel.title), [
  'Identity', 'BodyShape', 'Face', 'Clothing', 'Hair', 'Accessory', 'Proportion', 'Pose', 'Animation',
]);
for (const panel of CHARACTER_STUDIO_PANELS) {
  assert.match(markup, new RegExp(`data-character-section="${panel.id}"`));
}

controller.applyIdentity({ name: 'Studio Character', identityId: 'identity_studio', tags: 'hero, editable' });
snapshot = controller.snapshot();
assert.equal(snapshot.profile.name, 'Studio Character');
assert.deepEqual(snapshot.profile.identity.tags, ['hero', 'editable']);

const proportionBeforeBodyShape = structuredClone(hub.getState().character.bodyProfile);
controller.applyBodyShape({
  muscle: 0.8, fat: 0.35, shoulder_volume: 0.7, chest_volume: 0.65,
  waist_volume: 0.4, hip_volume: 0.55, arm_volume: 0.75, leg_volume: 0.72,
});
snapshot = controller.snapshot();
assert.equal(snapshot.bodyShape.muscle, 0.8);
assert.equal(snapshot.profile.body_shape_revision, snapshot.bodyShape.version);
assert.deepEqual(hub.getState().character.bodyProfile, proportionBeforeBodyShape, 'BodyShape must not change bone proportions');

const rigBeforeFace = structuredClone(hub.getState().character.rigRules);
controller.applyFace({ age: 42, face_shape: { width: 0.7 }, eye_shape: { size: 0.62 } });
snapshot = controller.snapshot();
assert.equal(snapshot.face.age, 42);
assert.equal(snapshot.face.face_shape.width, 0.7);
assert.equal(snapshot.profile.face_identity.face_id, snapshot.face.face_id);
assert.deepEqual(hub.getState().character.rigRules, rigBeforeFace, 'Face must not rewrite Rig');

const skinBeforeClothing = structuredClone(hub.getState().character.skin);
controller.applyClothing({ top: 'top_classic', pants: 'pants_light', shoes: 'shoes_classic' });
snapshot = controller.snapshot();
assert.deepEqual(new Set(snapshot.clothing.map((asset) => asset.type)), new Set(['top', 'pants', 'shoes']));
assert.equal(snapshot.profile.clothing_attachments.length, 3);
controller.applyClothing({ top: 'top_sport', pants: '', shoes: 'shoes_classic' });
snapshot = controller.snapshot();
assert.equal(snapshot.clothing.find((asset) => asset.type === 'top').clothing_id, 'top_sport');
assert.equal(snapshot.clothing.some((asset) => asset.type === 'pants'), false);
assert.deepEqual(hub.getState().character.skin, skinBeforeClothing, 'Clothing must remain outside Skin');

const clothingBeforeAppearance = structuredClone(hub.getState().clothingSystem);
controller.applyHair('short');
assert.equal(controller.snapshot().profile.hair.hair_id, 'hair_short_001');
controller.applyHair('ponytail');
assert.equal(controller.snapshot().hair.style, 'ponytail');
controller.resetHair();
assert.equal(controller.snapshot().profile.hair.hair_id, null);

controller.applyAccessories(['hat', 'glasses']);
assert.deepEqual(new Set(controller.snapshot().accessories.map((item) => item.type)), new Set(['hat', 'glasses']));
controller.applyAccessories(['ornament']);
snapshot = controller.snapshot();
assert.deepEqual(snapshot.accessories.map((item) => item.type), ['ornament']);
assert.equal(snapshot.profile.accessory_attachments.length, 1);
assert.deepEqual(hub.getState().clothingSystem, clothingBeforeAppearance, 'Appearance must not modify Clothing');

controller.applyProportion({
  height: 1.92, shoulderWidth: 0.46, hipWidth: 0.22, upperArmLength: 0.3,
  forearmLength: 0.26, handControlLength: 0.08, thighLength: 0.45, lowerLegLength: 0.43,
});
snapshot = controller.snapshot();
assert.equal(snapshot.proportion.height, 1.92);
assert.equal(snapshot.profile.proportion_revision, snapshot.moduleRevisions.proportion);

const proportionBeforePose = structuredClone(hub.getState().character.bodyProfile);
controller.applyPose('t');
snapshot = controller.snapshot();
assert.equal(snapshot.pose.name, 'T Pose');
assert.equal(snapshot.profile.pose_revision, snapshot.moduleRevisions.pose);
controller.resetPose();
assert.equal(controller.snapshot().pose.name, 'A Pose');
assert.deepEqual(hub.getState().character.bodyProfile, proportionBeforePose, 'Pose must not modify proportions');

const bindingBeforeAnimation = structuredClone(hub.getState().character.skin);
controller.selectAnimationClip('wave');
assert.equal(controller.snapshot().activeClip.clipId, 'wave');
controller.playAnimation(1_000);
assert.equal(controller.snapshot().animation.transport.playing, true);
controller.pauseAnimation(1_500);
snapshot = controller.snapshot();
assert.equal(snapshot.animation.transport.playing, false);
assert.ok(snapshot.animation.transport.time > 0);
controller.stopAnimation(1_600);
snapshot = controller.snapshot();
assert.equal(snapshot.animation.transport.time, 0);
assert.equal(snapshot.profile.animation_revision, snapshot.moduleRevisions.animation);
assert.deepEqual(hub.getState().character.skin, bindingBeforeAnimation, 'Animation must not modify skin binding');

console.log('PASS Character Studio nine panels, CharacterProfile references, module actions, reset paths, and animation transport controls');
