import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CLOTHING_ASSET_SCHEMA,
  CLOTHING_CATEGORIES,
  CLOTHING_LAYERS,
  CLOTHING_REGISTRY_SCHEMA,
  ClothingRegistry,
  createClothingAsset,
  createClothingDefinition,
  createClothingReference,
} from '../packages/clothing-system/index.js';
import {
  CHARACTER_PROFILE_SCHEMA,
  CharacterManager,
  createCharacterProfile,
  createCharacterState,
} from '../packages/character-core/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const shirt = createClothingAsset({
  clothingId: 'shirt_core_001',
  name: 'Core Shirt',
  category: 'upper_body',
  assetReference: { assetId: 'shirt_asset_001', revision: 3, uri: 'opfs://clothing/shirt_asset_001' },
  meshReference: { assetId: 'shirt_mesh_001', revision: 2, uri: 'opfs://clothing/shirt_mesh_001.glb' },
  materialReference: { assetId: 'shirt_material_001', revision: 4, uri: null },
  compatibleRig: { target: 'simulationRig', versions: ['rig@0.4.0'] },
  compatibleBody: { profileIds: ['body_default'], minimumRevision: 2 },
  attachmentPoints: ['upperChest', 'chest'],
  layer: 'base',
  metadata: { author: 'clothing-core-test', tags: ['shirt', 'static'] },
});
assert.equal(CLOTHING_ASSET_SCHEMA, 'humanoid_rig/clothing_asset@1.0');
assert.deepEqual(CLOTHING_CATEGORIES, ['upper_body', 'lower_body', 'shoes', 'head', 'accessory']);
assert.deepEqual(CLOTHING_LAYERS, ['underwear', 'base', 'outer', 'armor']);
assert.equal(shirt.clothingId, 'shirt_core_001');
assert.equal(shirt.compatibleRig.target, 'simulationRig');
assert.equal(shirt.meshReference.revision, 2);
assert.throws(() => createClothingAsset({ clothingId: 'bad', category: 'cape' }), /category must be one of/);

const migratedLegacyAsset = createClothingAsset({
  clothing_id: 'legacy_pants_001',
  revision: 5,
  type: 'pants',
  rig_profile: { target: 'simulationRig', rig_revision: 'rig@0.4.0', attachment_points: ['hips'] },
});
assert.equal(migratedLegacyAsset.clothingId, 'legacy_pants_001');
assert.equal(migratedLegacyAsset.category, 'lower_body');
assert.equal(migratedLegacyAsset.assetReference.revision, 5);

const shirtDefinition = createClothingDefinition({
  definitionId: 'shirt_core_001.binding',
  clothingId: shirt.clothingId,
  attachmentBones: ['upperChest', 'chest', 'leftShoulder', 'rightShoulder', 'leftUpperArm', 'rightUpperArm'],
  metadata: { bindingVersion: 1 },
});
const futureDefinition = createClothingDefinition({
  definitionId: 'shirt_core_001.future_binding',
  clothingId: shirt.clothingId,
  attachmentBones: ['futureDeformNode01', 'futureDeformNode02'],
});
assert.equal(shirtDefinition.bindingTarget, 'simulationRig');
assert.deepEqual(futureDefinition.attachmentBones, ['futureDeformNode01', 'futureDeformNode02']);
assert.throws(() => createClothingDefinition({ clothingId: shirt.clothingId }), /at least one bone/);

const registry = new ClothingRegistry();
registry.registerAsset(shirt);
registry.registerAsset(migratedLegacyAsset);
registry.registerDefinition(shirtDefinition);
registry.registerDefinition(futureDefinition);
assert.equal(registry.getAsset(shirt.clothingId).name, 'Core Shirt');
assert.deepEqual(registry.listAssets({ category: 'lower_body' }).map((asset) => asset.clothingId), ['legacy_pants_001']);
assert.equal(registry.listDefinitions({ clothingId: shirt.clothingId }).length, 2);
const returnedAsset = registry.getAsset(shirt.clothingId);
returnedAsset.name = 'mutated clone';
assert.equal(registry.getAsset(shirt.clothingId).name, 'Core Shirt');

const snapshot = registry.toJSON();
assert.equal(snapshot.schema, CLOTHING_REGISTRY_SCHEMA);
const restoredRegistry = new ClothingRegistry(JSON.parse(JSON.stringify(snapshot)));
assert.equal(restoredRegistry.getAsset(shirt.clothingId).meshReference.assetId, 'shirt_mesh_001');
assert.equal(restoredRegistry.getDefinition(shirtDefinition.definitionId).clothingId, shirt.clothingId);
assert.equal(restoredRegistry.removeAsset(shirt.clothingId), true);
assert.equal(restoredRegistry.getAsset(shirt.clothingId), null);
assert.equal(restoredRegistry.listDefinitions({ clothingId: shirt.clothingId }).length, 0);

const upperReference = createClothingReference({
  clothingId: shirt.clothingId,
  definitionId: shirtDefinition.definitionId,
  revision: 3,
});
const character = createCharacterProfile({
  character_id: 'character_clothing_core',
  name: 'Clothing Core Character',
  clothing_references: { upper: upperReference },
});
assert.equal(CHARACTER_PROFILE_SCHEMA, 'humanoid_rig/character_profile@1.6');
assert.deepEqual(character.clothing_references, {
  upper: upperReference,
  lower: null,
  shoes: null,
  accessory: null,
});

const characterManager = new CharacterManager();
const created = characterManager.create(createCharacterState(), character);
const saved = characterManager.save(created.state, {
  character_id: character.character_id,
  clothing_references: {
    shoes: createClothingReference({ clothingId: 'shoes_core_001', revision: 1 }),
  },
});
assert.equal(saved.profile.clothing_references.upper.clothingId, shirt.clothingId);
assert.equal(saved.profile.clothing_references.shoes.clothingId, 'shoes_core_001');

const legacyCharacter = createCharacterProfile({
  character_id: 'character_legacy_clothing',
  name: 'Legacy Clothing Character',
  clothing_attachments: [{ clothing_id: 'legacy_top_001', revision: 2 }],
});
assert.deepEqual(legacyCharacter.clothing_attachments, [{ clothing_id: 'legacy_top_001', revision: 2 }]);
assert.deepEqual(legacyCharacter.clothing_references, {
  upper: null,
  lower: null,
  shoes: null,
  accessory: null,
});

const assetSchema = JSON.parse(await readFile(join(root, 'schemas/clothing-asset.schema.json'), 'utf8'));
assert.equal(assetSchema.$id, CLOTHING_ASSET_SCHEMA);
assert.equal(assetSchema.additionalProperties, false);
assert.deepEqual(assetSchema.properties.category.enum, [...CLOTHING_CATEGORIES]);
assert.deepEqual(assetSchema.properties.layer.enum, [...CLOTHING_LAYERS]);
const characterSchema = JSON.parse(await readFile(join(root, 'schemas/character-profile.schema.json'), 'utf8'));
assert.equal(characterSchema.$id, CHARACTER_PROFILE_SCHEMA);
assert.ok(characterSchema.required.includes('clothing_references'));
assert.deepEqual(characterSchema.properties.clothing_references.required, ['upper', 'lower', 'shoes', 'accessory']);

console.log('PASS ClothingAsset creation and legacy asset migration');
console.log('PASS ClothingDefinition remains data-driven and simulationRig-compatible');
console.log('PASS ClothingRegistry register, read, serialize, restore, and remove');
console.log('PASS CharacterProfile clothing references and legacy character compatibility');
