import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CLOTHING_CHARACTER_FIT_SCHEMA,
  ClothingRegistry,
  ClothingRuntime,
  createClothingAsset,
  createClothingDefinition,
  createClothingProfile,
  createClothingReference,
} from '../packages/clothing-system/index.js';
import { createCharacterProfile } from '../packages/character-core/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const registry = new ClothingRegistry();
const asset = registry.registerAsset(createClothingAsset({
  clothingId: 'integration_shirt_001',
  name: 'Integration Shirt',
  category: 'upper_body',
  assetReference: { assetId: 'integration_shirt_asset', revision: 3, uri: 'opfs://clothing/integration_shirt_asset' },
  meshReference: { assetId: 'integration_shirt_mesh', revision: 2, uri: 'opfs://clothing/integration_shirt_mesh.glb' },
  materialReference: { assetId: 'integration_shirt_material', revision: 1, uri: null },
  compatibleRig: { target: 'simulationRig', versions: ['rig@0.4.0'] },
  compatibleBody: { profileIds: ['body_shape_001'], minimumRevision: 1 },
  attachmentPoints: ['upperChest', 'chest'],
  layer: 'outer',
  metadata: {
    previewMaterial: { base_color: '#446688', roughness: 0.7, metalness: 0.05, opacity: 1 },
    sizeProfile: { size: 'M', scale: 1, length: 1, offset: { x: 0, y: 0, z: 0 } },
    physicsMode: 'cloth-simulation',
    collisionGroup: 'character-clothing',
    materialProperties: { density: 1.2, friction: 0.4, damping: 0.6 },
  },
}));
const definition = registry.registerDefinition(createClothingDefinition({
  definitionId: 'integration_shirt_001.binding',
  clothingId: asset.clothingId,
  attachmentBones: ['upperChest', 'chest'],
}));
const reference = createClothingReference({
  clothingId: asset.clothingId,
  definitionId: definition.definitionId,
  revision: asset.assetReference.revision,
});

const character = createCharacterProfile({
  character_id: 'character_clothing_integration',
  clothing_references: { upper: reference },
  clothing_revision: 3,
});
const refreshedCharacter = createCharacterProfile(JSON.parse(JSON.stringify(character)));
assert.deepEqual(refreshedCharacter.clothing_references.upper, reference);
assert.equal(registry.loadAsset(refreshedCharacter.clothing_references.upper.clothingId).name, 'Integration Shirt');

const rendererFrames = [];
const runtime = new ClothingRuntime(createClothingProfile({
  clothing_profile_id: 'clothing_integration_profile',
  character_id: character.character_id,
}), {
  renderer: {
    id: 'integration-render-adapter',
    applyClothingFrame(frame) { rendererFrames.push(frame); },
  },
});
const attached = runtime.attachClothing(registry.getAsset(reference.clothingId), {
  definition: registry.getDefinition(reference.definitionId),
  reference,
});
assert.equal(attached.clothing_id, asset.clothingId);
assert.equal(attached.attachment.target, 'simulationRig');
assert.deepEqual(attached.attachment.attachment_points, definition.attachmentBones);
assert.equal(attached.simulation_interface.active, false);
assert.equal(attached.simulation_interface.physicsMode, 'cloth-simulation');

const bodyShape = {
  version: 5,
  muscle: 0.7,
  fat: 0.6,
  shoulder_volume: 0.8,
  chest_volume: 0.7,
  waist_volume: 0.5,
  hip_volume: 0.6,
  arm_volume: 0.6,
  leg_volume: 0.7,
};
const bodyProfile = {
  height: 1.92,
  shoulderWidth: 0.46,
  hipWidth: 0.22,
  draftRevision: 8,
};
const fit = runtime.fitClothingToCharacter({ bodyShape, bodyProfile });
assert.equal(fit.schema, CLOTHING_CHARACTER_FIT_SCHEMA);
assert.equal(fit.body_shape_revision, 5);
assert.equal(fit.proportion_revision, 8);
assert.notEqual(fit.scale.shoulder, 1);

const simulationRigA = {
  rigVersion: 'rig@0.4.0',
  positions: { upperChest: [0, 1.4, 0], chest: [0, 1.2, 0] },
  rotations: { upperChest: [0, 0, 0, 1], chest: [0, 0, 0, 1] },
};
const frameA = runtime.updateClothingPose(simulationRigA);
const shirtA = frameA.asset_frames.find((item) => item.clothing_id === asset.clothingId);
assert.equal(frameA.render_status.status, 'ready');
assert.equal(shirtA.render.visible, true);
assert.equal(shirtA.fit_transform.body_shape_revision, 5);
assert.equal(shirtA.fit_transform.proportion_revision, 8);
assert.equal(rendererFrames.length, 1);

const transformed = runtime.updateClothingTransform(asset.clothingId, {
  translation: [0.02, 0.01, -0.03],
  rotation: [0, 0, 0, 1],
  scale: [1.02, 1.01, 1.03],
});
const transformFrame = transformed.asset_frames.find((item) => item.clothing_id === asset.clothingId);
assert.deepEqual(transformFrame.attachment_transform.translation, [0.02, 0.01, -0.03]);
assert.notDeepEqual(transformFrame.render_transform.scale, [1, 1, 1]);

const simulationRigB = {
  ...simulationRigA,
  positions: { upperChest: [0.05, 1.43, 0.02], chest: [0.01, 1.22, 0.01] },
  rotations: { upperChest: [0, 0.258819, 0, 0.965926], chest: [0, 0.130526, 0, 0.991445] },
};
const frameB = runtime.updateClothingPose(simulationRigB);
const shirtB = frameB.asset_frames.find((item) => item.clothing_id === asset.clothingId);
assert.notDeepEqual(shirtA.joint_transforms.upperChest, shirtB.joint_transforms.upperChest);
assert.equal(frameB.render_commands[0].visible, true);

const bodySnapshot = structuredClone(bodyShape);
runtime.fitClothingToCharacter({
  bodyShape: { ...bodyShape, version: 6, shoulder_volume: 1 },
  bodyProfile: { ...bodyProfile, draftRevision: 9, shoulderWidth: 0.5 },
});
const refit = runtime.updateClothingPose(simulationRigB);
const refitShirt = refit.asset_frames.find((item) => item.clothing_id === asset.clothingId);
assert.equal(refitShirt.render.visible, true);
assert.notDeepEqual(refitShirt.fit_transform.scale, shirtB.fit_transform.scale);
assert.deepEqual(bodyShape, bodySnapshot);

const detached = runtime.detachClothing(asset.clothingId);
assert.equal(detached.assets.length, 0);
assert.equal(runtime.updateClothingPose(simulationRigB).asset_frames.length, 0);

const legacyRuntime = new ClothingRuntime(createClothingProfile({
  clothing_profile_id: 'legacy_clothing_profile',
  assets: [{ clothing_id: 'legacy_top_001', type: 'top' }],
}));
const legacyFrame = legacyRuntime.updateClothingPose({
  rigVersion: 'rig@0.4.0',
  positions: Object.fromEntries(['spine', 'chest', 'upperChest', 'leftUpperArm', 'rightUpperArm'].map((id) => [id, [0, 1, 0]])),
  rotations: Object.fromEntries(['spine', 'chest', 'upperChest', 'leftUpperArm', 'rightUpperArm'].map((id) => [id, [0, 0, 0, 1]])),
});
assert.equal(legacyFrame.asset_frames[0].status, 'ready');
assert.deepEqual(legacyFrame.preserves, ['body_skin', 'body_vertices', 'rig', 'pose', 'animation_tracks']);

const [studioSource, hostSource, viewSource, layerSource] = await Promise.all([
  readFile(join(root, 'apps/character-studio/index.js'), 'utf8'),
  readFile(join(root, 'legacy/v8/src/main.js'), 'utf8'),
  readFile(join(root, 'legacy/v8/src/three-view.js'), 'utf8'),
  readFile(join(root, 'legacy/v8/src/clothing-layer.js'), 'utf8'),
]);
assert.match(studioSource, /createClothingCharacterFit/);
assert.match(hostSource, /setClothingFrame\(hostState\.clothingFrame\)/);
assert.match(viewSource, /setClothingFrame\(frame\)/);
assert.match(layerSource, /runtimeAssetFrame\?\.render_transform/);
assert.match(layerSource, /independentFromSkin:\s*true/);

console.log('PASS Clothing Registry, Definition, CharacterProfile reference, Runtime, and render chain');
console.log('PASS simulationRig pose follow and manual attachment transform');
console.log('PASS BodyShape and Proportion refit preserves attached clothing and source body data');
console.log('PASS detach restores body-only render and legacy ClothingProfile remains compatible');
console.log('PASS Character Studio host delivers Clothing Runtime transforms to the independent V8 clothing layer');
