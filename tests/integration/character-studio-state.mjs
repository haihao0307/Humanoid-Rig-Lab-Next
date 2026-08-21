import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CHARACTER_PROFILE_EXPORT_SCHEMA,
  CharacterStudioSession,
  MemoryCharacterStudioPersistence,
  assertStructuredDataSafe,
  serializeCharacterProfileExport,
} from '../../apps/character-studio/index.js';
import { createDefaultState } from '../../src/default-state.js';
import { CharacterStudioTestNetwork } from '../helpers/character-studio-test-hub.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const nowValues = [
  '2026-08-21T02:00:00.000Z',
  '2026-08-21T02:01:00.000Z',
  '2026-08-21T02:02:00.000Z',
  '2026-08-21T02:03:00.000Z',
  '2026-08-21T02:04:00.000Z',
];
let nowIndex = 0;
const now = () => nowValues[Math.min(nowIndex++, nowValues.length - 1)];
const baseline = createDefaultState();
const originalFourModules = structuredClone(baseline.character);
const originalModuleState = structuredClone(baseline.modules);
const persistence = new MemoryCharacterStudioPersistence({ now });
const network = new CharacterStudioTestNetwork();
const hub = network.createClient(baseline, 'character-studio');
const session = new CharacterStudioSession({ hub, persistence, role: 'character-studio', now });

await session.initialize();
const revisionBeforeCreate = hub.getState().revision;
const created = await session.createCharacter({
  character_id: 'character_studio_test',
  name: 'Character Studio Test',
});
assert.equal(created.event.operation, 'character.create');
assert.equal(created.event.base_revision, 1);
assert.equal(created.event.revision, 2);
assert.ok(created.state.revision > revisionBeforeCreate);
assert.equal(created.state.operationEvents[0].event_id, created.event.event_id);

const saved = await session.saveCharacter({
  character_id: 'character_studio_test',
  name: 'Character Studio Saved',
  pose_revision: created.profile.pose_revision + 1,
});
assert.equal(saved.event.operation, 'character.save');
assert.equal(saved.profile.version, 2);
assert.equal(saved.profile.pose_revision, created.profile.pose_revision + 1);
assert.equal(saved.event.revision, created.event.revision + 1);

await session.saveResource({
  asset_id: 'portrait-source-001',
  kind: 'character-source-image',
  file_name: 'portrait.png',
  mime_type: 'image/png',
  content_hash: 'a'.repeat(64),
  blob: new Blob(['binary-image-content'], { type: 'image/png' }),
});
const exported = await session.exportCharacterProfile('character_studio_test', {
  exportedAt: '2026-08-21T02:05:00.000Z',
});
assert.equal(exported.schema, CHARACTER_PROFILE_EXPORT_SCHEMA);
assert.equal(exported.schemas.character_profile, 'humanoid_rig/character_profile@1.4');
assert.equal(exported.character_profile.version, 2);
assert.equal(exported.version.character_revision, hub.getState().characterCore.revision);
assert.equal(exported.module_references.appearance.revision, hub.getState().appearanceSystem.revision);
assert.equal(exported.resource_references.binary_payloads_included, false);
assert.ok(exported.resource_references.items.some((item) => item.asset_id === 'portrait-source-001'));
assert.doesNotMatch(serializeCharacterProfileExport(exported), /binary-image-content|data:image|;base64,/i);

const restored = await session.restoreCharacter('character_studio_test', 1);
assert.equal(restored.event.operation, 'character.restore');
assert.equal(restored.profile.version, 3);
assert.equal(restored.profile.name, 'Character Studio Test');
assert.equal(restored.event.changes.restored_from_version, 1);

await session.createCharacter({ character_id: 'character_second', name: 'Second Character' });
const loaded = await session.loadCharacter('character_studio_test');
assert.equal(loaded.character_id, 'character_studio_test');
assert.equal(hub.getState().operationEvents[0].operation, 'character.load');
assert.equal(session.getSnapshot().active_character_id, 'character_studio_test');

await session.flush();
const persisted = await persistence.loadLatestProjectState(baseline.projectId);
assert.equal(persisted.state.characterCore.active_character_id, 'character_studio_test');
assert.equal(persisted.character_summary.character_profile.version, 3);
assert.equal(
  persisted.character_summary.module_revisions.appearance_revision,
  persisted.state.appearanceSystem.revision,
);
assert.ok(persisted.character_summary.resource_references.includes('legacy/v8/assets/smpl/smpl-male-surface-skinned.glb'));
assertStructuredDataSafe(persisted.state);
assert.doesNotMatch(JSON.stringify(persisted.state), /binary-image-content|data:image|;base64,/i);
assert.deepEqual(persisted.state.character, originalFourModules);
assert.deepEqual(persisted.state.modules, originalModuleState);

const refreshNetwork = new CharacterStudioTestNetwork();
const refreshHub = refreshNetwork.createClient(createDefaultState(), 'character-studio');
const refreshedSession = new CharacterStudioSession({
  hub: refreshHub,
  persistence,
  role: 'character-studio',
  now: () => '2026-08-21T02:06:00.000Z',
});
await refreshedSession.initialize();
assert.equal(refreshedSession.getSnapshot().active_character_id, 'character_studio_test');
assert.equal(refreshHub.getState().characterCore.profiles.character_studio_test.version, 3);
assert.equal(refreshHub.getState().operationEvents[0].operation, 'character.load');

await assert.rejects(
  () => persistence.saveProjectState({ ...hub.getState(), invalidBlob: new Blob(['bad']) }),
  /binary data/,
);

for (const file of [
  'apps/character-studio/character-studio-session.js',
  'apps/character-studio/character-studio-persistence.js',
  'apps/character-studio/character-profile-export.js',
  'apps/character-studio/index.js',
  'schemas/character-profile-export.schema.json',
]) await access(join(root, file));
const persistenceSource = await readFile(join(root, 'apps/character-studio/character-studio-persistence.js'), 'utf8');
const projectHubSource = await readFile(join(root, 'src/project-hub.js'), 'utf8');
const exportSchema = JSON.parse(await readFile(join(root, 'schemas/character-profile-export.schema.json'), 'utf8'));
assert.match(persistenceSource, /indexedDB\.open/);
assert.match(persistenceSource, /storageManager\.getDirectory/);
assert.match(persistenceSource, /indexeddb-blob-fallback/);
assert.match(projectHubSource, /restorePersistedState/);
assert.match(projectHubSource, /loadCharacter\(/);
assert.match(projectHubSource, /restoreCharacter\(/);
assert.equal(exportSchema.$id, CHARACTER_PROFILE_EXPORT_SCHEMA);

await refreshedSession.close();
await session.close();

console.log('PASS Character Studio create, load, save, historical restore, revision, and OperationEvent flow');
console.log('PASS IndexedDB snapshot contract, OPFS resource path, binary-message guard, and refresh restore');
console.log('PASS stable CharacterProfile export with schemas, module revisions, appearance revision, and resource summary');
console.log('PASS Character Studio operations preserve existing Proportion, Skin, Pose, Animation, and module slices');
