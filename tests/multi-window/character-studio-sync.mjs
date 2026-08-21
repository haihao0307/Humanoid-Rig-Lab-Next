import assert from 'node:assert/strict';

import {
  CHARACTER_STUDIO_WINDOW_ROLES,
  CharacterStudioSession,
  MemoryCharacterStudioPersistence,
} from '../../apps/character-studio/index.js';
import { createDefaultState } from '../../src/default-state.js';
import { CharacterStudioTestNetwork } from '../helpers/character-studio-test-hub.mjs';

const baseline = createDefaultState();
const baselineModuleRevisions = structuredClone(baseline.moduleRevisions);
const network = new CharacterStudioTestNetwork();
const persistence = new MemoryCharacterStudioPersistence({
  now: () => '2026-08-21T03:00:00.000Z',
});
const sessions = CHARACTER_STUDIO_WINDOW_ROLES.map((role) => new CharacterStudioSession({
  hub: network.createClient(baseline, role),
  persistence,
  role,
  now: () => '2026-08-21T03:00:00.000Z',
}));

await Promise.all(sessions.map((session) => session.initialize()));
const notifications = Object.fromEntries(CHARACTER_STUDIO_WINDOW_ROLES.map((role) => [role, []]));
const unsubscribe = sessions.map((session) => session.subscribeCharacterState((snapshot, detail) => {
  notifications[snapshot.role].push({
    revision: snapshot.project_revision,
    character_id: snapshot.active_character_id,
    source: detail.source,
  });
}));

const created = await sessions[0].createCharacter({
  character_id: 'character_shared',
  name: 'Shared Character',
});
for (const session of sessions) {
  assert.equal(session.getSnapshot().active_character_id, 'character_shared');
  assert.equal(session.getSnapshot().character_profile.version, 1);
  assert.equal(session.getSnapshot().character_state_revision, created.event.revision);
}

const saved = await sessions[2].saveCharacter({
  character_id: 'character_shared',
  name: 'Animation Editor Update',
  animation_revision: created.profile.animation_revision + 1,
});
for (const session of sessions) {
  assert.equal(session.getSnapshot().character_profile.name, 'Animation Editor Update');
  assert.equal(session.getSnapshot().character_profile.version, 2);
  assert.equal(
    session.getSnapshot().module_revisions.animation_revision,
    created.profile.animation_revision + 1,
  );
}

const restored = await sessions[3].restoreCharacter('character_shared', 1);
for (const session of sessions) {
  assert.equal(session.getSnapshot().character_profile.name, 'Shared Character');
  assert.equal(session.getSnapshot().character_profile.version, 3);
  assert.equal(session.getSnapshot().project_revision, restored.state.revision);
}

for (const role of CHARACTER_STUDIO_WINDOW_ROLES) {
  assert.ok(notifications[role].some((item) => item.character_id === 'character_shared'));
}
const finalState = sessions[1].hub.getState();
assert.equal(finalState.operationEvents[0].operation, 'character.restore');
assert.equal(finalState.operationEvents[1].operation, 'character.save');
assert.equal(finalState.operationEvents[2].operation, 'character.create');
for (const moduleId of ['proportion', 'skin', 'pose', 'animation', 'clothing']) {
  assert.equal(finalState.moduleRevisions[moduleId], baselineModuleRevisions[moduleId]);
}
assert.equal(finalState.moduleRevisions.integration, baselineModuleRevisions.integration + 3);
assert.doesNotMatch(JSON.stringify(sessions[0].hub.lastPatch), /data:|base64|binary-image-content/i);

await Promise.all(sessions.map((session) => session.flush()));
const persisted = await persistence.loadLatestProjectState(baseline.projectId);
assert.equal(persisted.state.characterCore.profiles.character_shared.version, 3);
assert.equal(persisted.state.revision, finalState.revision);
await persistence.saveProjectState({
  ...structuredClone(finalState),
  revision: finalState.revision - 1,
  updatedAt: '2026-08-21T02:59:00.000Z',
}, { reason: 'delayed-older-window-write' });
const afterDelayedWrite = await persistence.loadLatestProjectState(baseline.projectId);
assert.equal(afterDelayedWrite.state.revision, finalState.revision);
const sameRevisionOlderState = structuredClone(finalState);
sameRevisionOlderState.updatedAt = new Date(Date.parse(finalState.updatedAt) - 1000).toISOString();
sameRevisionOlderState.characterCore.profiles.character_shared.name = 'Stale Same Revision';
await persistence.saveProjectState(sameRevisionOlderState, { reason: 'delayed-same-revision-write' });
const afterSameRevisionWrite = await persistence.loadLatestProjectState(baseline.projectId);
assert.equal(afterSameRevisionWrite.state.characterCore.profiles.character_shared.name, 'Shared Character');

unsubscribe.forEach((dispose) => dispose());
await Promise.all(sessions.map((session) => session.close()));

console.log('PASS character-studio, main-editor, animation-editor, and data-inspector share Character state');
console.log('PASS multi-window Character create, save, and restore use integration revisions and OperationEvents');
console.log('PASS ordinary synchronization patches contain references only and preserve unrelated module revisions');
console.log('PASS delayed IndexedDB-style writes cannot move the current persisted revision backwards');
