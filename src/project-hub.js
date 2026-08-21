import { createDefaultState, MODULE_IDS, SCHEMA_VERSION } from './default-state.js';
import {
  applyModulePatch,
  createModulePatch,
  normalizeModuleId,
  normalizeProjectState,
} from './state-schema.js';
import { CharacterManager, appendOperationEvent } from '../packages/character-core/index.js';
import { BodyShapeEditor, getActiveBodyShapeProfile } from '../packages/body-shape/index.js';
import {
  FaceEditor,
  getActiveFaceExpression,
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

const STORAGE_KEY = 'humanoid-rig-lab-next:project-state:v11';
const LEGACY_STORAGE_KEYS = ['humanoid-rig-lab-next:project-state:v10', 'humanoid-rig-lab-next:project-state:v9', 'humanoid-rig-lab-next:project-state:v8', 'humanoid-rig-lab-next:project-state:v7', 'humanoid-rig-lab-next:project-state:v6', 'humanoid-rig-lab-next:project-state:v5', 'humanoid-rig-lab-next:project-state:v4', 'humanoid-rig-lab-next:project-state:v3', 'humanoid-rig-lab-next:project-state:v2', 'humanoid-rig-lab-next:project-state:v1'];
const CHANNEL_NAME = 'humanoid-rig-lab-next:project-hub:v11';
const characterManager = new CharacterManager();
const bodyShapeEditor = new BodyShapeEditor();
const faceEditor = new FaceEditor();
const clothingManager = new ClothingManager();
const appearanceManager = new AppearanceManager();

function safeClone(value) {
  return structuredClone(value);
}

function loadLocalState() {
  for (const key of [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const normalized = normalizeProjectState(JSON.parse(raw));
      if (key !== STORAGE_KEY) localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      return normalized;
    } catch (error) {
      console.warn(`Failed to restore project state from ${key}`, error);
    }
  }
  return createDefaultState();
}

function saveLocalState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to persist project state', error);
  }
}

function createActivity(module, summary) {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    module,
    summary,
  };
}

function appendActivity(state, entry) {
  state.activity = [entry, ...(state.activity || []).filter((item) => item.id !== entry.id)].slice(0, 100);
}

export class ProjectHubClient extends EventTarget {
  constructor({ module = 'dashboard', title = document.title } = {}) {
    super();
    this.clientId = crypto.randomUUID();
    this.module = normalizeModuleId(module);
    this.requestedModule = module;
    this.title = title;
    this.state = loadLocalState();
    this.transport = 'local';
    this.worker = null;
    this.channel = null;
    this.presence = [];
    this.connected = false;
    this.#connect();
  }

  #connect() {
    if ('SharedWorker' in window && location.protocol !== 'file:') {
      try {
        this.worker = new SharedWorker('./workers/project-hub.shared.js?build=four-module-v002-20260819', {
          name: 'humanoid-rig-lab-next-project-hub-v11',
          type: 'module',
        });
        this.worker.port.start();
        this.worker.port.onmessage = (event) => this.#handleMessage(event.data);
        this.worker.port.postMessage({
          type: 'HELLO',
          clientId: this.clientId,
          module: this.requestedModule,
          title: this.title,
          state: this.state,
        });
        this.transport = 'SharedWorker';
        this.connected = true;
        return;
      } catch (error) {
        console.warn('SharedWorker unavailable, using BroadcastChannel', error);
      }
    }

    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event) => this.#handleMessage(event.data);
      this.transport = 'BroadcastChannel';
      this.connected = true;
      this.channel.postMessage({
        type: 'HELLO_BROADCAST',
        clientId: this.clientId,
        state: this.state,
      });
      return;
    }

    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try { this.#adopt(JSON.parse(event.newValue), 'storage-event'); } catch (_) {}
    });
    this.transport = 'localStorage';
    this.connected = true;
  }

  #handleMessage(message = {}) {
    if (message.type === 'STATE' && message.state) {
      this.#adopt(message.state, message.source || 'remote');
      return;
    }
    if (message.type === 'MODULE_PATCH' && message.patch && message.clientId !== this.clientId) {
      this.#adoptPatch(message.patch, message.clientId || 'remote-patch');
      return;
    }
    if (message.type === 'STATE_UPDATE' && message.state && message.clientId !== this.clientId) {
      this.#adopt(message.state, message.clientId || 'remote-state');
      return;
    }
    if (message.type === 'HELLO_BROADCAST' && message.clientId !== this.clientId) {
      const incoming = normalizeProjectState(message.state);
      if (Number(incoming.revision || 0) > Number(this.state.revision || 0)) this.#adopt(incoming, message.clientId);
      else this.#sendState();
      return;
    }
    if (message.type === 'REPLACE_STATE' && message.state && message.clientId !== this.clientId) {
      this.#adopt(message.state, message.clientId || 'replace-state');
      return;
    }
    if (message.type === 'TRANSIENT' && message.clientId !== this.clientId) {
      this.#dispatchTransient(message, message.clientId || 'remote-transient');
      return;
    }
    if (message.type === 'PRESENCE') {
      this.presence = message.clients || [];
      this.dispatchEvent(new CustomEvent('presence', { detail: this.presence }));
    }
  }

  #adopt(nextState, source) {
    const normalized = normalizeProjectState(nextState);
    const incomingRevision = Number(normalized.revision || 0);
    const localRevision = Number(this.state.revision || 0);
    const incomingTime = Date.parse(normalized.updatedAt || 0) || 0;
    const localTime = Date.parse(this.state.updatedAt || 0) || 0;
    if (incomingRevision < localRevision) return;
    if (incomingRevision === localRevision && incomingTime < localTime) return;

    this.state = normalized;
    saveLocalState(this.state);
    this.dispatchEvent(new CustomEvent('statechange', {
      detail: { state: this.getState(), source },
    }));
  }

  #adoptPatch(patch, source) {
    const result = applyModulePatch(this.state, patch);
    if (!result.accepted) return;
    this.state = result.state;
    saveLocalState(this.state);
    this.dispatchEvent(new CustomEvent('statechange', {
      detail: { state: this.getState(), source, module: result.module },
    }));
  }

  #sendState() {
    const message = { type: 'STATE_UPDATE', clientId: this.clientId, state: this.state };
    if (this.worker) this.worker.port.postMessage(message);
    else if (this.channel) this.channel.postMessage(message);
  }

  #sendPatch(patch) {
    const message = { type: 'MODULE_PATCH', clientId: this.clientId, patch };
    if (this.worker) this.worker.port.postMessage(message);
    else if (this.channel) this.channel.postMessage(message);
  }

  #dispatchTransient(message, source) {
    const detail = {
      ...safeClone(message),
      source,
    };
    this.dispatchEvent(new CustomEvent('transient', { detail }));
  }

  getState() {
    return safeClone(this.state);
  }

  restorePersistedState(nextState, { source = 'indexeddb', broadcast = true } = {}) {
    const normalized = normalizeProjectState(nextState);
    if (normalized.projectId !== this.state.projectId) {
      throw new Error(`Cannot restore project ${normalized.projectId} into ${this.state.projectId}.`);
    }
    const incomingRevision = Number(normalized.revision || 0);
    const localRevision = Number(this.state.revision || 0);
    const incomingTime = Date.parse(normalized.updatedAt || 0) || 0;
    const localTime = Date.parse(this.state.updatedAt || 0) || 0;
    if (incomingRevision < localRevision || (incomingRevision === localRevision && incomingTime < localTime)) {
      return false;
    }
    this.state = normalized;
    saveLocalState(this.state);
    if (broadcast) this.#sendState();
    this.dispatchEvent(new CustomEvent('statechange', {
      detail: { state: this.getState(), source },
    }));
    return true;
  }

  getModuleRevision(module = this.module) {
    return Number(this.state.moduleRevisions?.[normalizeModuleId(module)] || 1);
  }

  getCharacter(characterId = this.state.characterCore?.active_character_id, options = {}) {
    return characterManager.load(this.state.characterCore, characterId, options);
  }

  loadCharacter(characterId, { expected_revision = this.state.characterCore?.revision, ...options } = {}) {
    const result = characterManager.activate(this.state.characterCore, characterId, {
      ...options,
      expected_revision,
      actor: options.actor || `character:${this.clientId.slice(0, 8)}`,
    });
    return this.#commitCharacterOperation(result, `加载人物 ${result.profile.name}`);
  }

  createCharacter(profile, { expected_revision = this.state.characterCore?.revision, ...options } = {}) {
    const result = characterManager.create(this.state.characterCore, profile, {
      ...options,
      expected_revision,
      module_revisions: this.state.moduleRevisions,
      actor: options.actor || `character:${this.clientId.slice(0, 8)}`,
    });
    return this.#commitCharacterOperation(result, `创建人物 ${result.profile.name}`);
  }

  saveCharacter(profile, { expected_revision = this.state.characterCore?.revision, ...options } = {}) {
    const result = characterManager.save(this.state.characterCore, profile, {
      ...options,
      expected_revision,
      actor: options.actor || `character:${this.clientId.slice(0, 8)}`,
    });
    return this.#commitCharacterOperation(result, `保存人物 ${result.profile.name} v${result.profile.version}`);
  }

  restoreCharacter(characterId, version, {
    expected_revision = this.state.characterCore?.revision,
    ...options
  } = {}) {
    const result = characterManager.restore(this.state.characterCore, characterId, version, {
      ...options,
      expected_revision,
      actor: options.actor || `character:${this.clientId.slice(0, 8)}`,
    });
    return this.#commitCharacterOperation(
      result,
      `恢复人物 ${result.profile.name} 到历史版本 ${version}，生成 v${result.profile.version}`,
    );
  }

  updateCharacterReferences(characterId, references, {
    expected_revision = this.state.characterCore?.revision,
    ...options
  } = {}) {
    const result = characterManager.updateReferences(this.state.characterCore, characterId, references, {
      ...options,
      expected_revision,
      actor: options.actor || `character:${this.clientId.slice(0, 8)}`,
    });
    return this.#commitCharacterOperation(result, `更新人物 ${result.profile.name} 的模块版本引用`);
  }

  getBodyShape({ version = null } = {}) {
    return bodyShapeEditor.loadVersion(this.state.bodyShape, version);
  }

  updateBodyShape(parameters, { expected_revision = this.state.bodyShape?.revision, ...options } = {}) {
    const bodyShape = bodyShapeEditor.update(this.state.bodyShape, parameters, {
      ...options,
      expected_revision,
    });
    return this.#commitBodyShapeState(bodyShape, '修改身体形态参数', { syncCharacter: false });
  }

  saveBodyShapeVersion({
    expected_revision = this.state.bodyShape?.revision,
    expected_character_revision = this.state.characterCore?.revision,
    ...options
  } = {}) {
    const bodyShape = bodyShapeEditor.saveVersion(this.state.bodyShape, {
      ...options,
      expected_revision,
    });
    return this.#commitBodyShapeState(bodyShape, '保存身体形态版本', {
      syncCharacter: true,
      expectedCharacterRevision: expected_character_revision,
      actor: options.actor,
    });
  }

  restoreBodyShapeVersion(version, {
    expected_revision = this.state.bodyShape?.revision,
    expected_character_revision = this.state.characterCore?.revision,
    ...options
  } = {}) {
    const bodyShape = bodyShapeEditor.restoreVersion(this.state.bodyShape, version, {
      ...options,
      expected_revision,
    });
    return this.#commitBodyShapeState(bodyShape, `恢复身体形态版本 ${version}`, {
      syncCharacter: true,
      expectedCharacterRevision: expected_character_revision,
      actor: options.actor,
    });
  }

  getFace({ version = null, face_id = null } = {}) {
    return faceEditor.loadVersion(this.state.faceSystem, version, { face_id });
  }

  createFaceIdentity(profile, {
    expected_revision = this.state.faceSystem?.revision,
    expected_character_revision = this.state.characterCore?.revision,
    ...options
  } = {}) {
    const faceSystem = faceEditor.create(this.state.faceSystem, profile, {
      ...options,
      expected_revision,
    });
    return this.#commitFaceSystem(faceSystem, `创建 Face Identity ${profile.face_id}`, {
      syncCharacter: true,
      expectedCharacterRevision: expected_character_revision,
      actor: options.actor,
    });
  }

  updateFaceIdentity(patch, { expected_revision = this.state.faceSystem?.revision, ...options } = {}) {
    const faceSystem = faceEditor.update(this.state.faceSystem, patch, {
      ...options,
      expected_revision,
    });
    return this.#commitFaceSystem(faceSystem, '修改 Face Identity 参数', { syncCharacter: false });
  }

  getFaceExpression({ version = null } = {}) {
    return version == null
      ? getActiveFaceExpression(this.state.faceSystem)
      : faceEditor.loadExpressionVersion(this.state.faceSystem, version);
  }

  updateFaceExpression(patch, { expected_revision = this.state.faceSystem?.revision, ...options } = {}) {
    const faceSystem = faceEditor.updateExpression(this.state.faceSystem, patch, {
      ...options,
      expected_revision,
    });
    return this.#commitFaceSystem(faceSystem, '修改 Face Expression 参数', { syncCharacter: false });
  }

  mirrorFaceExpression({ expected_revision = this.state.faceSystem?.revision, ...options } = {}) {
    const faceSystem = faceEditor.mirrorExpression(this.state.faceSystem, {
      ...options,
      expected_revision,
    });
    return this.#commitFaceSystem(faceSystem, '镜像 Face Expression 参数', { syncCharacter: false });
  }

  mirrorFaceExpressionPair(pair, { expected_revision = this.state.faceSystem?.revision, ...options } = {}) {
    const faceSystem = faceEditor.mirrorExpressionPair(this.state.faceSystem, pair, {
      ...options,
      expected_revision,
    });
    return this.#commitFaceSystem(faceSystem, '镜像 Face Expression 单组参数', { syncCharacter: false });
  }

  saveFaceExpressionVersion({
    expected_revision = this.state.faceSystem?.revision,
    expected_character_revision = this.state.characterCore?.revision,
    ...options
  } = {}) {
    const faceSystem = faceEditor.saveExpressionVersion(this.state.faceSystem, {
      ...options,
      expected_revision,
    });
    return this.#commitFaceSystem(faceSystem, '保存 Face Expression 版本', {
      syncCharacter: true,
      expectedCharacterRevision: expected_character_revision,
      actor: options.actor,
    });
  }

  restoreFaceExpressionVersion(version, {
    expected_revision = this.state.faceSystem?.revision,
    expected_character_revision = this.state.characterCore?.revision,
    ...options
  } = {}) {
    const faceSystem = faceEditor.restoreExpressionVersion(this.state.faceSystem, version, {
      ...options,
      expected_revision,
    });
    return this.#commitFaceSystem(faceSystem, `恢复 Face Expression 版本 ${version}`, {
      syncCharacter: true,
      expectedCharacterRevision: expected_character_revision,
      actor: options.actor,
    });
  }

  saveFaceVersion({
    expected_revision = this.state.faceSystem?.revision,
    expected_character_revision = this.state.characterCore?.revision,
    ...options
  } = {}) {
    const faceSystem = faceEditor.saveVersion(this.state.faceSystem, {
      ...options,
      expected_revision,
    });
    return this.#commitFaceSystem(faceSystem, '保存 Face Identity 版本', {
      syncCharacter: true,
      expectedCharacterRevision: expected_character_revision,
      actor: options.actor,
    });
  }

  restoreFaceVersion(version, {
    expected_revision = this.state.faceSystem?.revision,
    expected_character_revision = this.state.characterCore?.revision,
    ...options
  } = {}) {
    const faceSystem = faceEditor.restoreVersion(this.state.faceSystem, version, {
      ...options,
      expected_revision,
    });
    return this.#commitFaceSystem(faceSystem, `恢复 Face Identity 版本 ${version}`, {
      syncCharacter: true,
      expectedCharacterRevision: expected_character_revision,
      actor: options.actor,
    });
  }

  getClothing({ version = null } = {}) {
    return clothingManager.loadVersion(this.state.clothingSystem, version);
  }

  addClothingAsset(asset, {
    expected_revision = this.state.clothingSystem?.revision,
    expected_character_revision = this.state.characterCore?.revision,
    ...options
  } = {}) {
    const clothingSystem = clothingManager.add(this.state.clothingSystem, asset, {
      ...options,
      expected_revision,
    });
    return this.#commitClothingSystem(clothingSystem, `添加服装 ${asset.clothing_id}`, {
      expectedCharacterRevision: expected_character_revision,
      actor: options.actor,
    });
  }

  removeClothingAsset(clothingId, {
    expected_revision = this.state.clothingSystem?.revision,
    expected_character_revision = this.state.characterCore?.revision,
    ...options
  } = {}) {
    const clothingSystem = clothingManager.remove(this.state.clothingSystem, clothingId, {
      ...options,
      expected_revision,
    });
    return this.#commitClothingSystem(clothingSystem, `删除服装 ${clothingId}`, {
      expectedCharacterRevision: expected_character_revision,
      actor: options.actor,
    });
  }

  saveClothingVersion({
    expected_revision = this.state.clothingSystem?.revision,
    expected_character_revision = this.state.characterCore?.revision,
    ...options
  } = {}) {
    const clothingSystem = clothingManager.saveVersion(this.state.clothingSystem, {
      ...options,
      expected_revision,
    });
    return this.#commitClothingSystem(clothingSystem, '保存服装版本', {
      expectedCharacterRevision: expected_character_revision,
      actor: options.actor,
    });
  }

  restoreClothingVersion(version, {
    expected_revision = this.state.clothingSystem?.revision,
    expected_character_revision = this.state.characterCore?.revision,
    ...options
  } = {}) {
    const clothingSystem = clothingManager.restoreVersion(this.state.clothingSystem, version, {
      ...options,
      expected_revision,
    });
    return this.#commitClothingSystem(clothingSystem, `恢复服装版本 ${version}`, {
      expectedCharacterRevision: expected_character_revision,
      actor: options.actor,
    });
  }

  getAppearance({ version = null } = {}) {
    return appearanceManager.loadVersion(this.state.appearanceSystem, version);
  }

  addHair(profile, {
    expected_revision = this.state.appearanceSystem?.revision,
    expected_character_revision = this.state.characterCore?.revision,
    ...options
  } = {}) {
    const appearanceSystem = appearanceManager.addHair(this.state.appearanceSystem, profile, {
      ...options,
      expected_revision,
    });
    return this.#commitAppearanceSystem(appearanceSystem, `添加发型 ${profile.hair_id}`, {
      expectedCharacterRevision: expected_character_revision,
      actor: options.actor,
    });
  }

  switchHair(hairId, {
    expected_revision = this.state.appearanceSystem?.revision,
    expected_character_revision = this.state.characterCore?.revision,
    ...options
  } = {}) {
    const appearanceSystem = appearanceManager.switchHair(this.state.appearanceSystem, hairId, {
      ...options,
      expected_revision,
    });
    return this.#commitAppearanceSystem(appearanceSystem, `切换发型 ${hairId}`, {
      expectedCharacterRevision: expected_character_revision,
      actor: options.actor,
    });
  }

  removeHair(hairId, {
    expected_revision = this.state.appearanceSystem?.revision,
    expected_character_revision = this.state.characterCore?.revision,
    ...options
  } = {}) {
    const appearanceSystem = appearanceManager.removeHair(this.state.appearanceSystem, hairId, {
      ...options,
      expected_revision,
    });
    return this.#commitAppearanceSystem(appearanceSystem, `删除发型 ${hairId}`, {
      expectedCharacterRevision: expected_character_revision,
      actor: options.actor,
    });
  }

  addAccessory(profile, {
    expected_revision = this.state.appearanceSystem?.revision,
    expected_character_revision = this.state.characterCore?.revision,
    ...options
  } = {}) {
    const appearanceSystem = appearanceManager.addAccessory(this.state.appearanceSystem, profile, {
      ...options,
      expected_revision,
    });
    return this.#commitAppearanceSystem(appearanceSystem, `添加附件 ${profile.accessory_id}`, {
      expectedCharacterRevision: expected_character_revision,
      actor: options.actor,
    });
  }

  removeAccessory(accessoryId, {
    expected_revision = this.state.appearanceSystem?.revision,
    expected_character_revision = this.state.characterCore?.revision,
    ...options
  } = {}) {
    const appearanceSystem = appearanceManager.removeAccessory(this.state.appearanceSystem, accessoryId, {
      ...options,
      expected_revision,
    });
    return this.#commitAppearanceSystem(appearanceSystem, `删除附件 ${accessoryId}`, {
      expectedCharacterRevision: expected_character_revision,
      actor: options.actor,
    });
  }

  saveAppearanceVersion({
    expected_revision = this.state.appearanceSystem?.revision,
    expected_character_revision = this.state.characterCore?.revision,
    ...options
  } = {}) {
    const appearanceSystem = appearanceManager.saveVersion(this.state.appearanceSystem, {
      ...options,
      expected_revision,
    });
    return this.#commitAppearanceSystem(appearanceSystem, '保存 Appearance 版本', {
      expectedCharacterRevision: expected_character_revision,
      actor: options.actor,
    });
  }

  restoreAppearanceVersion(version, {
    expected_revision = this.state.appearanceSystem?.revision,
    expected_character_revision = this.state.characterCore?.revision,
    ...options
  } = {}) {
    const appearanceSystem = appearanceManager.restoreVersion(this.state.appearanceSystem, version, {
      ...options,
      expected_revision,
    });
    return this.#commitAppearanceSystem(appearanceSystem, `恢复 Appearance 版本 ${version}`, {
      expectedCharacterRevision: expected_character_revision,
      actor: options.actor,
    });
  }

  #commitCharacterOperation(result, summary) {
    const state = this.transaction((next) => {
      next.characterCore = structuredClone(result.state);
      next.operationEvents = appendOperationEvent(next.operationEvents, result.event);
    }, { module: 'integration', summary });
    return {
      state,
      profile: structuredClone(result.profile),
      event: structuredClone(result.event),
    };
  }

  #commitBodyShapeState(bodyShape, summary, {
    syncCharacter = false,
    expectedCharacterRevision = this.state.characterCore?.revision,
    actor = null,
  } = {}) {
    const bodyShapeProfile = getActiveBodyShapeProfile(bodyShape);
    const characterId = this.state.characterCore?.active_character_id;
    const characterResult = syncCharacter && characterId
      ? characterManager.save(this.state.characterCore, {
          character_id: characterId,
          body_shape: {
            profile_id: bodyShapeProfile.body_shape_id,
            revision: bodyShapeProfile.version,
          },
          body_shape_revision: bodyShapeProfile.version,
        }, {
          expected_revision: expectedCharacterRevision,
          actor: actor || `body-shape:${this.clientId.slice(0, 8)}`,
        })
      : null;
    const state = this.transaction((next) => {
      next.bodyShape = structuredClone(bodyShape);
      if (characterResult) {
        next.characterCore = structuredClone(characterResult.state);
        next.operationEvents = appendOperationEvent(next.operationEvents, characterResult.event);
      }
    }, { module: 'integration', summary });
    return {
      state,
      bodyShape: structuredClone(bodyShape),
      profile: bodyShapeProfile,
      character: characterResult ? structuredClone(characterResult.profile) : null,
      event: characterResult ? structuredClone(characterResult.event) : null,
    };
  }

  #commitFaceSystem(faceSystem, summary, {
    syncCharacter = false,
    expectedCharacterRevision = this.state.characterCore?.revision,
    actor = null,
  } = {}) {
    const faceIdentity = getActiveFaceIdentity(faceSystem);
    const faceExpression = getActiveFaceExpression(faceSystem);
    const characterId = this.state.characterCore?.active_character_id;
    const characterResult = syncCharacter && characterId
      ? characterManager.save(this.state.characterCore, {
          character_id: characterId,
          face_identity: { face_id: faceIdentity.face_id, revision: faceIdentity.version },
          face_revision: faceIdentity.version,
          expression_revision: faceExpression.expressionRevision,
          expression_runtime_descriptor: faceSystem.expression_runtime_descriptor,
        }, {
          expected_revision: expectedCharacterRevision,
          actor: actor || `face-system:${this.clientId.slice(0, 8)}`,
        })
      : null;
    const state = this.transaction((next) => {
      next.faceSystem = structuredClone(faceSystem);
      if (characterResult) {
        next.characterCore = structuredClone(characterResult.state);
        next.operationEvents = appendOperationEvent(next.operationEvents, characterResult.event);
      }
    }, { module: 'integration', summary });
    return {
      state,
      faceSystem: structuredClone(faceSystem),
      profile: faceIdentity,
      character: characterResult ? structuredClone(characterResult.profile) : null,
      event: characterResult ? structuredClone(characterResult.event) : null,
    };
  }

  #commitClothingSystem(clothingSystem, summary, {
    expectedCharacterRevision = this.state.characterCore?.revision,
    actor = null,
  } = {}) {
    const clothingProfile = getActiveClothingProfile(clothingSystem);
    const characterId = this.state.characterCore?.active_character_id;
    const characterResult = characterId
      ? characterManager.save(this.state.characterCore, {
          character_id: characterId,
          clothing_attachments: clothingAttachmentReferences(clothingProfile),
          clothing_revision: clothingProfile.version,
        }, {
          expected_revision: expectedCharacterRevision,
          actor: actor || `clothing-system:${this.clientId.slice(0, 8)}`,
        })
      : null;
    const state = this.transaction((next) => {
      next.clothingSystem = structuredClone(clothingSystem);
      if (characterResult) {
        next.characterCore = structuredClone(characterResult.state);
        next.operationEvents = appendOperationEvent(next.operationEvents, characterResult.event);
      }
    }, { module: 'clothing', summary });
    return {
      state,
      clothingSystem: structuredClone(clothingSystem),
      profile: clothingProfile,
      character: characterResult ? structuredClone(characterResult.profile) : null,
      event: characterResult ? structuredClone(characterResult.event) : null,
    };
  }

  #commitAppearanceSystem(appearanceSystem, summary, {
    expectedCharacterRevision = this.state.characterCore?.revision,
    actor = null,
  } = {}) {
    const references = getAppearanceCharacterReferences(appearanceSystem);
    const characterId = this.state.characterCore?.active_character_id;
    const characterResult = characterId
      ? characterManager.save(this.state.characterCore, {
          character_id: characterId,
          ...references,
        }, {
          expected_revision: expectedCharacterRevision,
          actor: actor || `appearance-system:${this.clientId.slice(0, 8)}`,
        })
      : null;
    const state = this.transaction((next) => {
      next.appearanceSystem = structuredClone(appearanceSystem);
      if (characterResult) {
        next.characterCore = structuredClone(characterResult.state);
        next.operationEvents = appendOperationEvent(next.operationEvents, characterResult.event);
      }
    }, { module: 'integration', summary });
    return {
      state,
      appearanceSystem: structuredClone(appearanceSystem),
      appearance: appearanceManager.loadVersion(appearanceSystem),
      character: characterResult ? structuredClone(characterResult.profile) : null,
      event: characterResult ? structuredClone(characterResult.event) : null,
    };
  }

  subscribe(callback) {
    const handler = (event) => callback(event.detail.state, event.detail);
    this.addEventListener('statechange', handler);
    callback(this.getState(), { source: 'initial' });
    return () => this.removeEventListener('statechange', handler);
  }

  subscribeTransient(transientType, callback) {
    const expected = String(transientType || '*');
    const handler = (event) => {
      if (expected !== '*' && event.detail.transientType !== expected) return;
      callback(safeClone(event.detail.payload), safeClone(event.detail));
    };
    this.addEventListener('transient', handler);
    return () => this.removeEventListener('transient', handler);
  }

  publishTransient(transientType, payload = {}, {
    resource = null,
    syncGroup = null,
  } = {}) {
    const type = String(transientType || '').trim();
    if (!type) throw new Error('Transient message type is required.');
    const message = {
      protocol: 'humanoid_rig/transient_bus@1.0',
      type: 'TRANSIENT',
      transientType: type,
      projectId: this.state.projectId,
      clientId: this.clientId,
      module: this.module,
      resource: resource == null ? null : String(resource),
      syncGroup: syncGroup == null ? null : String(syncGroup),
      issuedAt: Date.now(),
      payload: safeClone(payload),
    };
    if (this.worker) this.worker.port.postMessage(message);
    else if (this.channel) this.channel.postMessage(message);
    this.#dispatchTransient(message, 'local-transient');
    return safeClone(message);
  }

  transaction(mutator, { module = this.module, summary = '更新项目状态' } = {}) {
    const id = normalizeModuleId(module);
    const next = this.getState();
    mutator(next);
    const now = new Date().toISOString();
    next.moduleRevisions[id] = Number(next.moduleRevisions[id] || 1) + 1;
    next.moduleUpdatedAt[id] = now;
    next.revision = Number(next.revision || 0) + 1;
    next.updatedAt = now;
    next.collaboration = next.collaboration || {};
    next.collaboration.lastWriterByModule = next.collaboration.lastWriterByModule || {};
    const writer = `${id}:${this.clientId.slice(0, 8)}`;
    next.collaboration.lastWriterByModule[id] = writer;
    next.collaboration.lastWriter = writer;
    const activityEntry = createActivity(id, summary);
    appendActivity(next, activityEntry);
    this.state = normalizeProjectState(next);
    const patch = createModulePatch(this.state, id, activityEntry);
    saveLocalState(this.state);
    this.#sendPatch(patch);
    this.dispatchEvent(new CustomEvent('statechange', {
      detail: { state: this.getState(), source: this.clientId, module: id },
    }));
    return this.getState();
  }

  replaceState(nextState, summary = '导入项目状态', { changedModules = MODULE_IDS } = {}) {
    const normalized = normalizeProjectState(nextState);
    const now = new Date().toISOString();
    normalized.revision = Math.max(Number(this.state.revision || 0) + 1, Number(normalized.revision || 0) + 1);
    const changed = new Set((Array.isArray(changedModules) ? changedModules : MODULE_IDS).map(normalizeModuleId));
    normalized.updatedAt = now;
    for (const id of MODULE_IDS) {
      if (changed.has(id)) {
        normalized.moduleRevisions[id] = Math.max(
          Number(this.state.moduleRevisions?.[id] || 1) + 1,
          Number(normalized.moduleRevisions?.[id] || 1),
        );
        normalized.moduleUpdatedAt[id] = now;
      } else {
        normalized.moduleRevisions[id] = Math.max(
          Number(this.state.moduleRevisions?.[id] || 1),
          Number(normalized.moduleRevisions?.[id] || 1),
        );
      }
    }
    const entry = createActivity('integration', summary);
    appendActivity(normalized, entry);
    this.state = normalized;
    saveLocalState(normalized);
    const message = { type: 'REPLACE_STATE', clientId: this.clientId, state: normalized };
    if (this.worker) this.worker.port.postMessage(message);
    else if (this.channel) this.channel.postMessage(message);
    this.dispatchEvent(new CustomEvent('statechange', {
      detail: { state: this.getState(), source: this.clientId },
    }));
  }

  importModuleBundle(bundle, expectedModule = this.module) {
    if (!bundle || bundle.type !== 'HumanoidRigModuleBundle') throw new Error('模块更新包格式不正确。');
    const module = normalizeModuleId(bundle.module);
    if (module !== normalizeModuleId(expectedModule)) throw new Error(`当前窗口是 ${expectedModule}，更新包属于 ${bundle.module}。`);
    const data = bundle.data || {};
    return this.transaction((state) => {
      if (module === 'proportion') {
        state.character.bodyProfile = safeClone(data.bodyProfile || data);
        if (data.rigRules) state.character.rigRules = { ...state.character.rigRules, ...safeClone(data.rigRules) };
      }
      else if (module === 'skin') {
        state.character.display = { ...state.character.display, ...(data.display || {}) };
        state.character.skin = { ...state.character.skin, ...(data.skin || data) };
      } else if (module === 'pose') {
        state.character.pose = safeClone(data.pose || data);
        if (data.physics) state.character.physics = { ...state.character.physics, ...data.physics };
      } else if (module === 'animation') state.character.animation = safeClone(data.animation || data);
      else if (module === 'clothing') state.clothingSystem = safeClone(data.clothingSystem || data);
      else {
        if (data.appearanceSystem) state.appearanceSystem = safeClone(data.appearanceSystem);
        if (data.activeVersions) state.activeVersions = { ...state.activeVersions, ...data.activeVersions };
      }
    }, { module, summary: `导入 ${module} 模块更新包` });
  }

  reset() {
    const next = createDefaultState();
    next.revision = Number(this.state.revision || 0) + 1;
    next.updatedAt = new Date().toISOString();
    this.replaceState(next, '重置项目');
  }
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(JSON.parse(String(reader.result))); } catch (error) { reject(error); }
    };
    reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
    reader.readAsText(file, 'utf-8');
  });
}

export { SCHEMA_VERSION };
