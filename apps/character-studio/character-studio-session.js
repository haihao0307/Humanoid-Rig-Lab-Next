import { createCharacterProfileExport } from './character-profile-export.js';

export const CHARACTER_STUDIO_SESSION_SCHEMA = 'humanoid_rig/character_studio_session@1.0';
export const CHARACTER_STUDIO_WINDOW_ROLES = Object.freeze([
  'character-studio',
  'main-editor',
  'animation-editor',
  'data-inspector',
]);

export class CharacterStudioSession {
  constructor({ hub, persistence, role = 'character-studio', now = () => new Date().toISOString() } = {}) {
    if (!hub?.getState || !hub?.subscribe) throw new TypeError('CharacterStudioSession requires a ProjectHub-compatible client.');
    if (!persistence?.saveProjectState || !persistence?.loadLatestProjectState) {
      throw new TypeError('CharacterStudioSession requires a persistence adapter.');
    }
    this.hub = hub;
    this.persistence = persistence;
    this.role = normalizeWindowRole(role);
    this.now = now;
    this.state = null;
    this.initialized = false;
    this.closed = false;
    this.listeners = new Set();
    this.unsubscribeHub = null;
    this.persistQueue = Promise.resolve();
    this.lastPersistedRevision = -1;
  }

  async initialize({ restore = true } = {}) {
    this.#assertOpen();
    if (this.initialized) return this.getSnapshot();
    await this.persistence.open?.();
    const initial = this.hub.getState();
    if (restore) {
      const persisted = await this.persistence.loadLatestProjectState(initial.projectId);
      if (persisted?.state && isPersistedStateNewer(persisted.state, initial)) {
        if (!this.hub.restorePersistedState) {
          throw new Error('The ProjectHub client cannot hydrate persisted ProjectState.');
        }
        this.hub.restorePersistedState(persisted.state, {
          source: 'character-studio:indexeddb-restore',
          broadcast: true,
        });
        this.lastPersistedRevision = Number(persisted.revision || persisted.state.revision || 0);
      }
    }
    this.unsubscribeHub = this.hub.subscribe((state, detail = {}) => {
      this.state = structuredClone(state);
      this.#notify(detail);
      if (detail.source !== 'initial') this.#queuePersist(state, null, `sync:${detail.source || 'project-hub'}`);
    });
    this.state = this.hub.getState();
    this.initialized = true;
    await this.#queuePersist(this.state, null, 'character-studio:initialize');
    return this.getSnapshot();
  }

  getSnapshot() {
    const state = this.state || this.hub.getState();
    return createCharacterStudioStateSnapshot(state, this.role);
  }

  async createCharacter(profile, options = {}) {
    await this.#ensureInitialized();
    const result = this.hub.createCharacter(profile, options);
    await this.#queuePersist(result.state, result.event, 'character.create');
    return cloneOperationResult(result);
  }

  async loadCharacter(characterId, { version = null, ...options } = {}) {
    await this.#ensureInitialized();
    const id = String(characterId || this.state?.characterCore?.active_character_id || '').trim();
    if (version != null) return this.hub.getCharacter(id, { version });
    if (id === this.state?.characterCore?.active_character_id) return this.hub.getCharacter(id);
    if (!this.hub.loadCharacter) throw new Error('The ProjectHub client does not support synchronized Character loading.');
    const result = this.hub.loadCharacter(id, options);
    await this.#queuePersist(result.state, result.event, 'character.load');
    return structuredClone(result.profile);
  }

  async saveCharacter(profilePatch, options = {}) {
    await this.#ensureInitialized();
    const characterId = String(
      profilePatch?.character_id || this.state?.characterCore?.active_character_id || '',
    ).trim();
    if (!characterId) throw new Error('No active Character is available to save.');
    const result = this.hub.saveCharacter({ ...profilePatch, character_id: characterId }, options);
    await this.#queuePersist(result.state, result.event, 'character.save');
    return cloneOperationResult(result);
  }

  async restoreCharacter(characterId, version, options = {}) {
    await this.#ensureInitialized();
    if (!this.hub.restoreCharacter) throw new Error('The ProjectHub client does not support Character history restore.');
    const id = String(characterId || this.state?.characterCore?.active_character_id || '').trim();
    const result = this.hub.restoreCharacter(id, version, options);
    await this.#queuePersist(result.state, result.event, 'character.restore');
    return cloneOperationResult(result);
  }

  async exportCharacterProfile(characterId = null, options = {}) {
    await this.#ensureInitialized();
    await this.flush();
    const state = this.hub.getState();
    const id = String(characterId || state.characterCore?.active_character_id || '').trim();
    const profile = this.hub.getCharacter(id, { version: options.version ?? null });
    const persistedResources = await this.persistence.listResourceReferences?.(state.projectId, {
      characterId: profile.character_id,
    }) || [];
    const document = createCharacterProfileExport({
      projectState: state,
      characterProfile: profile,
      persistedResources,
      exportedAt: options.exportedAt || this.now(),
    });
    await this.#queuePersist(state, null, 'character.export');
    return document;
  }

  async saveResource(resource) {
    await this.#ensureInitialized();
    if (!this.persistence.saveResource) throw new Error('The persistence adapter does not support resource storage.');
    const state = this.hub.getState();
    return this.persistence.saveResource({
      ...resource,
      project_id: state.projectId,
      character_id: resource?.character_id || state.characterCore?.active_character_id || null,
    });
  }

  subscribeCharacterState(callback) {
    if (typeof callback !== 'function') throw new TypeError('subscribeCharacterState requires a callback.');
    this.listeners.add(callback);
    callback(this.getSnapshot(), { source: 'initial' });
    return () => this.listeners.delete(callback);
  }

  async flush() {
    await this.persistQueue;
  }

  async close() {
    if (this.closed) return;
    await this.flush();
    this.unsubscribeHub?.();
    this.unsubscribeHub = null;
    this.listeners.clear();
    await this.persistence.close?.();
    this.closed = true;
  }

  async #ensureInitialized() {
    if (!this.initialized) await this.initialize();
    this.#assertOpen();
  }

  #queuePersist(state, operationEvent, reason) {
    const snapshot = structuredClone(state);
    const revision = Number(snapshot.revision || 0);
    this.persistQueue = this.persistQueue.then(async () => {
      if (!operationEvent && revision < this.lastPersistedRevision) return null;
      const result = await this.persistence.saveProjectState(snapshot, { operationEvent, reason });
      this.lastPersistedRevision = Math.max(this.lastPersistedRevision, revision);
      return result;
    });
    return this.persistQueue;
  }

  #notify(detail) {
    const snapshot = this.getSnapshot();
    for (const callback of this.listeners) callback(structuredClone(snapshot), structuredClone(detail));
  }

  #assertOpen() {
    if (this.closed) throw new Error('CharacterStudioSession is closed.');
  }
}

export function createCharacterStudioStateSnapshot(projectState, role = 'character-studio') {
  const characterId = projectState.characterCore?.active_character_id || null;
  const profile = characterId ? projectState.characterCore?.profiles?.[characterId] || null : null;
  return {
    schema: CHARACTER_STUDIO_SESSION_SCHEMA,
    role: normalizeWindowRole(role),
    project_id: String(projectState.projectId || ''),
    project_revision: Number(projectState.revision || 0),
    character_state_revision: Number(projectState.characterCore?.revision || 0),
    active_character_id: characterId,
    character_profile: profile ? structuredClone(profile) : null,
    module_revisions: profile ? {
      proportion_revision: profile.proportion_revision,
      body_shape_revision: profile.body_shape_revision,
      skin_revision: profile.skin_revision,
      face_revision: profile.face_revision,
      clothing_revision: profile.clothing_revision,
      appearance_revision: Number(projectState.appearanceSystem?.revision || 0),
      hair_revision: profile.hair_revision,
      accessory_revision: profile.accessory_revision,
      pose_revision: profile.pose_revision,
      animation_revision: profile.animation_revision,
    } : null,
  };
}

function cloneOperationResult(result) {
  return {
    state: structuredClone(result.state),
    profile: structuredClone(result.profile),
    event: structuredClone(result.event),
  };
}

function normalizeWindowRole(value) {
  const role = String(value || 'character-studio');
  if (!CHARACTER_STUDIO_WINDOW_ROLES.includes(role)) {
    throw new TypeError(`Unsupported Character Studio window role: ${role}.`);
  }
  return role;
}

function isPersistedStateNewer(persisted, current) {
  const persistedRevision = Number(persisted.revision || 0);
  const currentRevision = Number(current.revision || 0);
  if (persistedRevision !== currentRevision) return persistedRevision > currentRevision;
  return (Date.parse(persisted.updatedAt || 0) || 0) > (Date.parse(current.updatedAt || 0) || 0);
}
