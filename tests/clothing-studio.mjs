import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ClothingManager,
  clothingAttachmentReferences,
  followSimulationRig,
  getActiveClothingProfile,
} from '../packages/clothing-system/index.js';
import { CharacterManager, appendOperationEvent } from '../packages/character-core/index.js';
import { CharacterStudioController } from '../apps/character-studio/character-studio-controller.js';
import { ClothingPanel, CLOTHING_LIBRARY_CATEGORIES } from '../apps/character-studio/panels/clothing-panel.js';
import { createDefaultState } from '../src/default-state.js';
import { normalizeProjectState } from '../src/state-schema.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const clothingManager = new ClothingManager();
const characterManager = new CharacterManager();

class ClothingStudioMemoryHub {
  constructor(state = createDefaultState()) {
    this.state = normalizeProjectState(state);
  }

  getState() {
    return structuredClone(this.state);
  }

  getClothing() {
    return clothingManager.loadVersion(this.state.clothingSystem);
  }

  transaction(mutator, { module = 'clothing', summary = 'Clothing Studio test' } = {}) {
    const next = this.getState();
    mutator(next);
    next.revision += 1;
    next.updatedAt = new Date().toISOString();
    next.moduleRevisions[module] = Number(next.moduleRevisions[module] || 0) + 1;
    next.moduleUpdatedAt[module] = next.updatedAt;
    next.activity = [{ id: `test-${next.revision}`, at: next.updatedAt, module, summary }, ...(next.activity || [])];
    this.state = normalizeProjectState(next);
    return this.getState();
  }

  addClothingAsset(asset) {
    return this.#commit(clothingManager.add(this.state.clothingSystem, asset, {
      expected_revision: this.state.clothingSystem.revision,
    }));
  }

  updateClothingAsset(id, patch) {
    return this.#commit(clothingManager.update(this.state.clothingSystem, id, patch, {
      expected_revision: this.state.clothingSystem.revision,
    }));
  }

  replaceClothingAsset(id, replacement) {
    return this.#commit(clothingManager.replace(this.state.clothingSystem, id, replacement, {
      expected_revision: this.state.clothingSystem.revision,
    }));
  }

  removeClothingAsset(id) {
    return this.#commit(clothingManager.remove(this.state.clothingSystem, id, {
      expected_revision: this.state.clothingSystem.revision,
    }));
  }

  saveClothingVersion() {
    return this.#commit(clothingManager.saveVersion(this.state.clothingSystem, {
      expected_revision: this.state.clothingSystem.revision,
    }));
  }

  #commit(clothingSystem) {
    const clothingProfile = getActiveClothingProfile(clothingSystem);
    const characterId = this.state.characterCore.active_character_id;
    const characterResult = characterManager.save(this.state.characterCore, {
      character_id: characterId,
      clothing_attachments: clothingAttachmentReferences(clothingProfile),
      clothing_revision: clothingProfile.version,
    }, {
      expected_revision: this.state.characterCore.revision,
      actor: 'clothing-studio-test',
    });
    return this.transaction((next) => {
      next.clothingSystem = clothingSystem;
      next.characterCore = characterResult.state;
      next.operationEvents = appendOperationEvent(next.operationEvents, characterResult.event);
    });
  }
}

assert.deepEqual(CLOTHING_LIBRARY_CATEGORIES.map((category) => category.label), [
  'Upper Body', 'Lower Body', 'Shoes', 'Accessory',
]);

const hub = new ClothingStudioMemoryHub();
const controller = new CharacterStudioController(hub);
const panelMarkup = new ClothingPanel().render(controller.snapshot());
assert.match(panelMarkup, /data-clothing-library-category="upper-body"/);
assert.match(panelMarkup, /data-clothing-library-category="lower-body"/);
assert.match(panelMarkup, /data-clothing-library-category="shoes"/);
assert.match(panelMarkup, /data-clothing-library-category="accessory"/);
assert.match(panelMarkup, /data-clothing-add="top_classic"/);

controller.addClothing('top_classic');
let snapshot = controller.snapshot();
assert.equal(snapshot.clothing.length, 1, 'Add action must create a ClothingAsset.');
assert.equal(snapshot.clothing[0].clothing_id, 'top_classic');
assert.equal(snapshot.profile.clothing_attachments[0].clothing_id, 'top_classic');
assert.equal(snapshot.profile.clothing_revision, snapshot.clothingProfile.version);
assert.ok(snapshot.clothingProfile.version > 1, 'Add action must save a ClothingProfile version.');

controller.applyClothingParameters('top_classic', {
  size: 'L',
  scale: 1.12,
  length: 1.25,
  offsetX: 0.03,
  offsetY: -0.02,
  offsetZ: 0.04,
  layer: 3,
  baseColor: '#e06b45',
  roughness: 0.42,
  metalness: 0.18,
  opacity: 0.86,
});
snapshot = controller.snapshot();
const edited = snapshot.clothing[0];
assert.equal(edited.size_profile.size, 'L');
assert.equal(edited.size_profile.length, 1.25);
assert.deepEqual(edited.size_profile.offset, { x: 0.03, y: -0.02, z: 0.04 });
assert.equal(edited.render_profile.layer, 3);
assert.equal(edited.material.base_color, '#e06b45');
assert.equal(edited.physics_profile.physicsMode, 'static-follow');
assert.equal(edited.physics_profile.collisionGroup, null);
assert.deepEqual(Object.keys(edited.physics_profile.materialProperties), ['density', 'friction', 'damping']);
assert.equal(snapshot.profile.clothing_attachments[0].revision, edited.revision);
assert.equal(snapshot.profile.clothing_revision, snapshot.clothingProfile.version);

const joints = ['spine', 'chest', 'upperChest', 'leftUpperArm', 'rightUpperArm'];
const simulationRig = {
  rigVersion: 'rig@0.4.0',
  fk: {
    positions: Object.fromEntries(joints.map((joint, index) => [joint, [index * 0.01, 1 + index * 0.05, 0]])),
    rotations: Object.fromEntries(joints.map((joint) => [joint, [0, 0, 0, 1]])),
  },
};
const previewFrame = followSimulationRig(snapshot.clothingProfile, simulationRig);
assert.equal(previewFrame.render_status.status, 'ready');
assert.equal(previewFrame.asset_frames[0].render.material.base_color, '#e06b45');
assert.equal(previewFrame.asset_frames[0].render.size_profile.length, 1.25);
assert.equal(previewFrame.render_commands[0].render_profile.layer, 3);
assert.equal(previewFrame.asset_frames[0].render.visible, true);

controller.replaceClothing('top_classic', 'top_sport');
snapshot = controller.snapshot();
assert.equal(snapshot.clothing.length, 1);
assert.equal(snapshot.clothing[0].clothing_id, 'top_sport');
assert.equal(snapshot.clothing[0].size_profile.length, 1.25, 'Replace keeps the active fit parameters.');
assert.deepEqual(snapshot.profile.clothing_attachments.map((item) => item.clothing_id), ['top_sport']);

const persistedJson = JSON.stringify(hub.getState());
const refreshedState = normalizeProjectState(JSON.parse(persistedJson));
const refreshedController = new CharacterStudioController(new ClothingStudioMemoryHub(refreshedState));
const refreshedSnapshot = refreshedController.snapshot();
assert.equal(refreshedSnapshot.clothing[0].clothing_id, 'top_sport');
assert.equal(refreshedSnapshot.clothing[0].size_profile.length, 1.25);
assert.deepEqual(refreshedSnapshot.profile.clothing_attachments.map((item) => item.clothing_id), ['top_sport']);

controller.removeClothing('top_sport');
snapshot = controller.snapshot();
assert.equal(snapshot.clothing.length, 0);
assert.deepEqual(snapshot.profile.clothing_attachments, []);

const clothingPanelSource = await readFile(join(root, 'apps/character-studio/panels/clothing-panel.js'), 'utf8');
const parameterPanelSource = await readFile(join(root, 'apps/character-studio/panels/clothing-parameters-panel.js'), 'utf8');
const studioSource = await readFile(join(root, 'apps/character-studio/index.js'), 'utf8');
const projectHubSource = await readFile(join(root, 'src/project-hub.js'), 'utf8');
const previewSource = await readFile(join(root, 'legacy/v8/src/clothing-layer.js'), 'utf8');
assert.match(clothingPanelSource, /data-clothing-add/);
assert.match(clothingPanelSource, /data-clothing-delete/);
assert.match(clothingPanelSource, /data-clothing-replace/);
assert.match(parameterPanelSource, /data-clothing-parameters-apply/);
assert.match(parameterPanelSource, /Size[\s\S]*Length[\s\S]*Offset[\s\S]*Layer[\s\S]*Material/);
assert.match(parameterPanelSource, /physicsMode[\s\S]*collisionGroup[\s\S]*materialProperties/);
assert.match(studioSource, /followSimulationRig/);
assert.match(studioSource, /clothingPreviewCount/);
assert.match(projectHubSource, /localStorage\.setItem\(STORAGE_KEY/);
assert.match(projectHubSource, /updateClothingAsset/);
assert.match(projectHubSource, /replaceClothingAsset/);
assert.match(previewSource, /size_profile\?\.length/);
assert.match(previewSource, /size_profile\?\.offset/);
assert.match(previewSource, /render_profile\?\.layer/);

console.log('PASS Clothing Studio add, delete, replace, and apply controls');
console.log('PASS ClothingProfile and CharacterProfile save/refresh restoration');
console.log('PASS Body + Clothing simulationRig preview frame updates');
console.log('PASS Cloth Simulation interface fields remain data-only');
