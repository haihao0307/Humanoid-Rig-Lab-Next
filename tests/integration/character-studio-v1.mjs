import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHARACTER_STUDIO_PANELS,
  CHARACTER_STUDIO_WINDOW_ROLES,
  CharacterStudioApp,
  createCharacterStudioSession,
} from '../../apps/character-studio/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFile(join(root, path), 'utf8');
const [page, entry, controller, persistence, exportSchema, manifest, dashboard] = await Promise.all([
  read('character-studio.html'),
  read('apps/character-studio/index.js'),
  read('apps/character-studio/character-studio-controller.js'),
  read('apps/character-studio/character-studio-persistence.js'),
  read('schemas/character-profile-export.schema.json'),
  read('BUILD_MANIFEST.json'),
  read('index.html'),
]);

for (const id of ['leftPanelHost', 'characterViewportHost', 'rightPanelHost']) {
  assert.match(page, new RegExp(`id=["']${id}["']`));
}
assert.equal((page.match(/<iframe\b/g) || []).length, 1, 'Character Studio must own exactly one viewport iframe.');
assert.match(page, /apps\/character-studio\/index\.js/);
assert.match(dashboard, /href="\.\/character-studio\.html"/);
assert.equal(typeof CharacterStudioApp, 'function');
assert.equal(typeof createCharacterStudioSession, 'function');
console.log('PASS Character Studio v1 page exposes the three-column shell and one simulationRig viewport');

assert.deepEqual(CHARACTER_STUDIO_PANELS.map((panel) => panel.id), [
  'identity', 'body-shape', 'face', 'clothing', 'hair', 'accessory', 'proportion', 'pose', 'animation',
]);
assert.deepEqual(CHARACTER_STUDIO_WINDOW_ROLES, [
  'character-studio', 'main-editor', 'animation-editor', 'data-inspector',
]);
console.log('PASS Character Studio v1 composes all nine panels and four synchronized window roles');

const appClass = entry.slice(
  entry.indexOf('export class CharacterStudioApp'),
  entry.indexOf('function createSimulationPoseSnapshot'),
);
assert.equal((appClass.match(/new ProjectHubClient\s*\(/g) || []).length, 1, 'The page app must create one ProjectHub client.');
assert.equal((appClass.match(/new CharacterViewportHost\s*\(/g) || []).length, 1, 'The page app must create one viewport host.');
assert.match(appClass, /createCharacterStudioSession\(\{[\s\S]*?hub:\s*this\.hub/);
assert.match(appClass, /mountCharacterStudioSidebar\(\{[\s\S]*?hub:\s*this\.hub/);
assert.match(appClass, /followSimulationRig\(clothingProfile, frame\.simulationRig\)/);
assert.match(appClass, /followAppearanceAttachments\(appearanceState, frame\.simulationRig\)/);
console.log('PASS shell, panels, persistence session, clothing, appearance, and viewport reuse one Character state path');

assert.doesNotMatch(controller, /new\s+(CharacterManager|AppearanceManager)\s*\(/);
assert.match(controller, /this\.hub\.removeHair\(hairId\)/);
assert.match(controller, /this\.hub\.saveBodyShapeVersion\(\)/);
assert.match(controller, /this\.hub\.saveFaceVersion\(\)/);
assert.match(controller, /this\.hub\.saveClothingVersion\(\)/);
assert.match(controller, /this\.hub\.saveAppearanceVersion\(\)/);
assert.match(controller, /module:\s*'proportion'/);
assert.match(controller, /module:\s*'pose'/);
assert.match(controller, /module:\s*'animation'/);
console.log('PASS panels route formal edits through ProjectHub, Character Core references, revisions, and OperationEvents');

const tickBody = appClass.slice(appClass.indexOf('scheduleAnimationTick('), appClass.indexOf('async exportActiveCharacter('));
assert.match(tickBody, /requestAnimationFrame/);
assert.doesNotMatch(tickBody, /transaction\(|saveCharacter\(|updateCharacterReferences\(/);
assert.match(appClass, /subscribeTransient\('motion\.scrub\.preview'/);
assert.match(persistence, /inline base64 resource/);
assert.match(persistence, /instanceof ArrayBuffer/);
assert.match(persistence, /writeBlobToOpfs/);
console.log('PASS animation ticks stay transient and binary resources stay outside ordinary JSON messages');

const parsedManifest = JSON.parse(manifest);
const parsedExportSchema = JSON.parse(exportSchema);
assert.equal(parsedManifest.characterStudio.performanceGuards.singleCharacterStateCenter, true);
assert.equal(parsedManifest.characterStudio.performanceGuards.singleViewportInstance, true);
assert.equal(parsedManifest.characterStudio.performanceGuards.binaryMessages, false);
assert.equal(parsedManifest.characterStudio.performanceGuards.transientPreviewRevision, false);
assert.equal(parsedExportSchema.$id, 'humanoid_rig/character_profile_export@1.0');
assert.ok(parsedExportSchema.properties.version.required.includes('character_revision'));
console.log('PASS Character Studio v1 manifest, export schema, and performance guards are stable');
