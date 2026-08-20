import { createDefaultState, MODULE_IDS, SCHEMA_VERSION } from './default-state.js';
import {
  applyModulePatch,
  createModulePatch,
  normalizeModuleId,
  normalizeProjectState,
} from './state-schema.js';

const STORAGE_KEY = 'humanoid-rig-lab-next:project-state:v5';
const LEGACY_STORAGE_KEYS = ['humanoid-rig-lab-next:project-state:v4', 'humanoid-rig-lab-next:project-state:v3', 'humanoid-rig-lab-next:project-state:v2', 'humanoid-rig-lab-next:project-state:v1'];
const CHANNEL_NAME = 'humanoid-rig-lab-next:project-hub:v5';

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
          name: 'humanoid-rig-lab-next-project-hub-v5',
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

  getModuleRevision(module = this.module) {
    return Number(this.state.moduleRevisions?.[normalizeModuleId(module)] || 1);
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

  replaceState(nextState, summary = '导入项目状态') {
    const normalized = normalizeProjectState(nextState);
    const now = new Date().toISOString();
    normalized.revision = Math.max(Number(this.state.revision || 0) + 1, Number(normalized.revision || 0) + 1);
    normalized.updatedAt = now;
    for (const id of MODULE_IDS) {
      normalized.moduleRevisions[id] = Math.max(
        Number(this.state.moduleRevisions?.[id] || 1) + 1,
        Number(normalized.moduleRevisions?.[id] || 1),
      );
      normalized.moduleUpdatedAt[id] = now;
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
      else if (data.activeVersions) state.activeVersions = { ...state.activeVersions, ...data.activeVersions };
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
