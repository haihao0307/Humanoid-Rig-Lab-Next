import { ProjectHubClient } from '../../src/project-hub.js';
import {
  IndexedDbCharacterStudioPersistence,
  MemoryCharacterStudioPersistence,
} from './character-studio-persistence.js';
import {
  CharacterStudioSession,
  CHARACTER_STUDIO_WINDOW_ROLES,
} from './character-studio-session.js';

export * from './character-studio-session.js';
export * from './character-studio-persistence.js';
export * from './character-profile-export.js';

export function createCharacterStudioSession({
  role = 'character-studio',
  title = 'Humanoid Rig Lab Next · Character Studio',
  hub = null,
  persistence = null,
  now,
} = {}) {
  if (!CHARACTER_STUDIO_WINDOW_ROLES.includes(role)) {
    throw new TypeError(`Unsupported Character Studio window role: ${role}.`);
  }
  const projectHub = hub || new ProjectHubClient({ module: role, title });
  const repository = persistence || (
    globalThis.indexedDB
      ? new IndexedDbCharacterStudioPersistence({ now })
      : new MemoryCharacterStudioPersistence({ now })
  );
  return new CharacterStudioSession({
    hub: projectHub,
    persistence: repository,
    role,
    now,
  });
}
