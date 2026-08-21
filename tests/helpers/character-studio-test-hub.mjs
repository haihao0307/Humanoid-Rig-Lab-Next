import { CharacterManager, appendOperationEvent } from '../../packages/character-core/index.js';
import { createModulePatch, applyModulePatch, normalizeProjectState } from '../../src/state-schema.js';

export class CharacterStudioTestNetwork {
  constructor() {
    this.clients = new Set();
  }

  createClient(initialState, role) {
    const client = new CharacterStudioTestHub(this, initialState, role);
    this.clients.add(client);
    return client;
  }

  broadcast(sender, patch) {
    for (const client of this.clients) {
      if (client === sender) continue;
      client.receivePatch(patch, sender.role);
    }
  }
}

export class CharacterStudioTestHub {
  constructor(network, initialState, role) {
    this.network = network;
    this.role = role;
    this.state = normalizeProjectState(initialState);
    this.manager = new CharacterManager();
    this.listeners = new Set();
    this.lastPatch = null;
  }

  getState() {
    return structuredClone(this.state);
  }

  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.getState(), { source: 'initial' });
    return () => this.listeners.delete(callback);
  }

  getCharacter(characterId, options = {}) {
    return this.manager.load(this.state.characterCore, characterId, options);
  }

  createCharacter(profile, options = {}) {
    return this.commit(this.manager.create(this.state.characterCore, profile, {
      ...options,
      expected_revision: options.expected_revision ?? this.state.characterCore.revision,
      module_revisions: this.state.moduleRevisions,
      actor: options.actor || this.role,
    }));
  }

  loadCharacter(characterId, options = {}) {
    return this.commit(this.manager.activate(this.state.characterCore, characterId, {
      ...options,
      expected_revision: options.expected_revision ?? this.state.characterCore.revision,
      actor: options.actor || this.role,
    }));
  }

  saveCharacter(profile, options = {}) {
    return this.commit(this.manager.save(this.state.characterCore, profile, {
      ...options,
      expected_revision: options.expected_revision ?? this.state.characterCore.revision,
      actor: options.actor || this.role,
    }));
  }

  restoreCharacter(characterId, version, options = {}) {
    return this.commit(this.manager.restore(this.state.characterCore, characterId, version, {
      ...options,
      expected_revision: options.expected_revision ?? this.state.characterCore.revision,
      actor: options.actor || this.role,
    }));
  }

  restorePersistedState(nextState, { source = 'indexeddb' } = {}) {
    const incoming = normalizeProjectState(nextState);
    if (incoming.projectId !== this.state.projectId) throw new Error('Project id mismatch.');
    if (incoming.revision < this.state.revision) return false;
    this.state = incoming;
    this.emit(source);
    return true;
  }

  commit(result) {
    const next = this.getState();
    const now = result.event.at;
    next.characterCore = structuredClone(result.state);
    next.operationEvents = appendOperationEvent(next.operationEvents, result.event);
    next.moduleRevisions.integration += 1;
    next.moduleUpdatedAt.integration = now;
    next.revision += 1;
    next.updatedAt = now;
    next.collaboration.lastWriterByModule.integration = this.role;
    next.collaboration.lastWriter = this.role;
    this.state = normalizeProjectState(next);
    this.lastPatch = createModulePatch(this.state, 'integration');
    this.network.broadcast(this, this.lastPatch);
    this.emit(this.role);
    return {
      state: this.getState(),
      profile: structuredClone(result.profile),
      event: structuredClone(result.event),
    };
  }

  receivePatch(patch, source) {
    const result = applyModulePatch(this.state, patch);
    if (!result.accepted) return;
    this.state = result.state;
    this.emit(source);
  }

  emit(source) {
    const state = this.getState();
    for (const callback of this.listeners) callback(state, { source, module: 'integration' });
  }
}
