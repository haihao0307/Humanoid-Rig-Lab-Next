export const CHARACTER_STUDIO_DATABASE = 'humanoid-rig-lab-next-character-studio';
export const CHARACTER_STUDIO_DATABASE_VERSION = 1;

const STORE_PROJECTS = 'projects';
const STORE_SNAPSHOTS = 'snapshots';
const STORE_EVENTS = 'events';
const STORE_RESOURCES = 'resources';
const STORE_RESOURCE_BLOBS = 'resourceBlobs';

export class IndexedDbCharacterStudioPersistence {
  constructor({
    indexedDB = globalThis.indexedDB,
    storageManager = globalThis.navigator?.storage,
    databaseName = CHARACTER_STUDIO_DATABASE,
    now = () => new Date().toISOString(),
  } = {}) {
    this.indexedDB = indexedDB;
    this.storageManager = storageManager;
    this.databaseName = databaseName;
    this.now = now;
    this.databasePromise = null;
  }

  async open() {
    if (!this.indexedDB) throw new Error('IndexedDB is required for Character Studio persistence.');
    if (!this.databasePromise) {
      this.databasePromise = openDatabase(this.indexedDB, this.databaseName);
    }
    return this.databasePromise;
  }

  async saveProjectState(projectState, { operationEvent = null, reason = 'character-studio' } = {}) {
    assertStructuredDataSafe(projectState, 'ProjectState');
    if (operationEvent) assertStructuredDataSafe(operationEvent, 'OperationEvent');
    const state = structuredClone(projectState);
    const projectId = requiredId(state.projectId, 'ProjectState.projectId');
    const revision = nonNegativeInteger(state.revision, 'ProjectState.revision');
    const savedAt = this.now();
    const snapshotKey = createSnapshotKey(projectId, revision, state.updatedAt);
    const snapshot = {
      snapshot_key: snapshotKey,
      project_id: projectId,
      revision,
      saved_at: savedAt,
      reason: String(reason || 'character-studio'),
      character_summary: createPersistedCharacterSummary(state),
      state,
    };
    const project = {
      project_id: projectId,
      project_name: String(state.projectName || projectId),
      schema_version: nonNegativeInteger(state.schemaVersion, 'ProjectState.schemaVersion'),
      current_revision: revision,
      current_snapshot_key: snapshotKey,
      state_updated_at: String(state.updatedAt || ''),
      updated_at: savedAt,
    };
    const database = await this.open();
    await runTransaction(database, [STORE_PROJECTS, STORE_SNAPSHOTS, STORE_EVENTS], 'readwrite', (stores) => {
      stores[STORE_SNAPSHOTS].put(snapshot);
      if (operationEvent?.event_id) {
        stores[STORE_EVENTS].put({
          event_id: String(operationEvent.event_id),
          project_id: projectId,
          sequence: nonNegativeInteger(operationEvent.revision, 'OperationEvent.revision'),
          recorded_at: savedAt,
          event: structuredClone(operationEvent),
        });
      }
      const currentProjectRequest = stores[STORE_PROJECTS].get(projectId);
      currentProjectRequest.onsuccess = () => {
        const currentRevision = Number(currentProjectRequest.result?.current_revision || -1);
        const currentTime = Date.parse(currentProjectRequest.result?.state_updated_at || 0) || 0;
        const incomingTime = Date.parse(project.state_updated_at || 0) || 0;
        if (revision > currentRevision || (revision === currentRevision && incomingTime >= currentTime)) {
          stores[STORE_PROJECTS].put(project);
        }
      };
    });
    return structuredClone(await getRecord(database, STORE_PROJECTS, projectId) || project);
  }

  async loadLatestProjectState(projectId) {
    const id = requiredId(projectId, 'projectId');
    const database = await this.open();
    const project = await getRecord(database, STORE_PROJECTS, id);
    if (!project?.current_snapshot_key) return null;
    const snapshot = await getRecord(database, STORE_SNAPSHOTS, project.current_snapshot_key);
    if (!snapshot?.state) return null;
    assertStructuredDataSafe(snapshot.state, 'Persisted ProjectState');
    return structuredClone(snapshot);
  }

  async saveResource({
    project_id,
    character_id = null,
    asset_id,
    blob = null,
    kind = 'character-resource',
    file_name = null,
    mime_type = null,
    byte_length = null,
    content_hash = null,
    uri = null,
    storage = null,
  } = {}) {
    const projectId = requiredId(project_id, 'resource.project_id');
    const assetId = requiredId(asset_id, 'resource.asset_id');
    const resourceKey = createResourceKey(projectId, assetId);
    const isBlob = blob != null && isBlobValue(blob);
    if (blob != null && !isBlob) throw new TypeError('resource.blob must be a Blob.');

    let storageKind = String(storage || (isBlob ? 'opfs' : 'external-reference'));
    let opfsPath = null;
    let fallbackBlob = null;
    if (isBlob) {
      try {
        opfsPath = await writeBlobToOpfs(this.storageManager, projectId, assetId, blob);
        storageKind = 'opfs';
      } catch (_) {
        storageKind = 'indexeddb-blob-fallback';
        fallbackBlob = blob;
      }
    }

    const metadata = {
      resource_key: resourceKey,
      project_id: projectId,
      character_id: nullableId(character_id),
      asset_id: assetId,
      kind: String(kind || 'character-resource'),
      storage: storageKind,
      opfs_path: opfsPath,
      uri: uri == null ? null : String(uri),
      file_name: file_name == null ? null : String(file_name),
      mime_type: mime_type == null ? (isBlob ? String(blob.type || '') || null : null) : String(mime_type),
      byte_length: nonNegativeInteger(
        byte_length == null && isBlob ? blob.size : byte_length || 0,
        'resource.byte_length',
      ),
      content_hash: content_hash == null ? null : String(content_hash),
      updated_at: this.now(),
    };
    assertStructuredDataSafe(metadata, 'ResourceReference');
    const database = await this.open();
    await runTransaction(database, [STORE_RESOURCES, STORE_RESOURCE_BLOBS], 'readwrite', (stores) => {
      stores[STORE_RESOURCES].put(metadata);
      if (fallbackBlob) {
        stores[STORE_RESOURCE_BLOBS].put({ resource_key: resourceKey, blob: fallbackBlob });
      } else {
        stores[STORE_RESOURCE_BLOBS].delete(resourceKey);
      }
    });
    return structuredClone(metadata);
  }

  async listResourceReferences(projectId, { characterId = null } = {}) {
    const id = requiredId(projectId, 'projectId');
    const database = await this.open();
    const records = await getAllByIndex(database, STORE_RESOURCES, 'project_id', id);
    const requestedCharacter = nullableId(characterId);
    return records
      .filter((record) => requestedCharacter == null || record.character_id == null || record.character_id === requestedCharacter)
      .map((record) => structuredClone(record))
      .sort((left, right) => left.asset_id.localeCompare(right.asset_id));
  }

  async close() {
    if (!this.databasePromise) return;
    const database = await this.databasePromise;
    database.close();
    this.databasePromise = null;
  }
}

export class MemoryCharacterStudioPersistence {
  constructor({ now = () => new Date().toISOString() } = {}) {
    this.now = now;
    this.projects = new Map();
    this.snapshots = new Map();
    this.events = new Map();
    this.resources = new Map();
    this.resourceBlobs = new Map();
  }

  async open() {
    return this;
  }

  async saveProjectState(projectState, { operationEvent = null, reason = 'character-studio' } = {}) {
    assertStructuredDataSafe(projectState, 'ProjectState');
    if (operationEvent) assertStructuredDataSafe(operationEvent, 'OperationEvent');
    const state = structuredClone(projectState);
    const projectId = requiredId(state.projectId, 'ProjectState.projectId');
    const revision = nonNegativeInteger(state.revision, 'ProjectState.revision');
    const snapshotKey = createSnapshotKey(projectId, revision, state.updatedAt);
    const savedAt = this.now();
    const snapshot = {
      snapshot_key: snapshotKey,
      project_id: projectId,
      revision,
      saved_at: savedAt,
      reason: String(reason || 'character-studio'),
      character_summary: createPersistedCharacterSummary(state),
      state,
    };
    const project = {
      project_id: projectId,
      project_name: String(state.projectName || projectId),
      schema_version: nonNegativeInteger(state.schemaVersion, 'ProjectState.schemaVersion'),
      current_revision: revision,
      current_snapshot_key: snapshotKey,
      state_updated_at: String(state.updatedAt || ''),
      updated_at: savedAt,
    };
    const currentProject = this.projects.get(projectId);
    const currentRevision = Number(currentProject?.current_revision || -1);
    const currentTime = Date.parse(currentProject?.state_updated_at || 0) || 0;
    const incomingTime = Date.parse(project.state_updated_at || 0) || 0;
    if (!currentProject || revision > currentRevision || (revision === currentRevision && incomingTime >= currentTime)) {
      this.projects.set(projectId, project);
    }
    this.snapshots.set(snapshotKey, snapshot);
    if (operationEvent?.event_id) this.events.set(String(operationEvent.event_id), structuredClone(operationEvent));
    return structuredClone(this.projects.get(projectId));
  }

  async loadLatestProjectState(projectId) {
    const id = requiredId(projectId, 'projectId');
    const project = this.projects.get(id);
    const snapshot = project ? this.snapshots.get(project.current_snapshot_key) : null;
    return snapshot ? structuredClone(snapshot) : null;
  }

  async saveResource(resource = {}) {
    const projectId = requiredId(resource.project_id, 'resource.project_id');
    const assetId = requiredId(resource.asset_id, 'resource.asset_id');
    const blob = resource.blob || null;
    if (blob != null && !isBlobValue(blob)) throw new TypeError('resource.blob must be a Blob.');
    const resourceKey = createResourceKey(projectId, assetId);
    const metadata = {
      resource_key: resourceKey,
      project_id: projectId,
      character_id: nullableId(resource.character_id),
      asset_id: assetId,
      kind: String(resource.kind || 'character-resource'),
      storage: blob ? 'memory-blob' : String(resource.storage || 'external-reference'),
      opfs_path: null,
      uri: resource.uri == null ? null : String(resource.uri),
      file_name: resource.file_name == null ? null : String(resource.file_name),
      mime_type: resource.mime_type == null ? (blob ? String(blob.type || '') || null : null) : String(resource.mime_type),
      byte_length: nonNegativeInteger(
        resource.byte_length == null && blob ? blob.size : resource.byte_length || 0,
        'resource.byte_length',
      ),
      content_hash: resource.content_hash == null ? null : String(resource.content_hash),
      updated_at: this.now(),
    };
    assertStructuredDataSafe(metadata, 'ResourceReference');
    this.resources.set(resourceKey, metadata);
    if (blob) this.resourceBlobs.set(resourceKey, blob);
    return structuredClone(metadata);
  }

  async listResourceReferences(projectId, { characterId = null } = {}) {
    const id = requiredId(projectId, 'projectId');
    const requestedCharacter = nullableId(characterId);
    return [...this.resources.values()]
      .filter((record) => record.project_id === id)
      .filter((record) => requestedCharacter == null || record.character_id == null || record.character_id === requestedCharacter)
      .map((record) => structuredClone(record))
      .sort((left, right) => left.asset_id.localeCompare(right.asset_id));
  }

  async close() {}
}

export function assertStructuredDataSafe(value, path = 'value', seen = new Set()) {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return true;
  if (typeof value === 'string') {
    if (/^data:[^,]*;base64,/i.test(value)) throw new TypeError(`${path} contains an inline base64 resource.`);
    return true;
  }
  if (typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol') {
    throw new TypeError(`${path} is not JSON-safe structured data.`);
  }
  if (isBlobValue(value) || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    throw new TypeError(`${path} contains binary data; save it through the OPFS resource API.`);
  }
  if (seen.has(value)) throw new TypeError(`${path} contains a circular reference.`);
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertStructuredDataSafe(item, `${path}[${index}]`, seen));
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`${path} contains a non-plain object.`);
    }
    for (const [key, child] of Object.entries(value)) {
      assertStructuredDataSafe(child, `${path}.${key}`, seen);
    }
  }
  seen.delete(value);
  return true;
}

function openDatabase(indexedDB, databaseName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, CHARACTER_STUDIO_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      const upgradeTransaction = request.transaction;
      createStore(database, upgradeTransaction, STORE_PROJECTS, { keyPath: 'project_id' });
      const snapshots = createStore(database, upgradeTransaction, STORE_SNAPSHOTS, { keyPath: 'snapshot_key' });
      ensureIndex(snapshots, 'project_id', 'project_id');
      const events = createStore(database, upgradeTransaction, STORE_EVENTS, { keyPath: 'event_id' });
      ensureIndex(events, 'project_id', 'project_id');
      const resources = createStore(database, upgradeTransaction, STORE_RESOURCES, { keyPath: 'resource_key' });
      ensureIndex(resources, 'project_id', 'project_id');
      createStore(database, upgradeTransaction, STORE_RESOURCE_BLOBS, { keyPath: 'resource_key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Character Studio IndexedDB open failed.'));
    request.onblocked = () => reject(new Error('Character Studio IndexedDB upgrade is blocked by another window.'));
  });
}

function createStore(database, upgradeTransaction, name, options) {
  return database.objectStoreNames.contains(name)
    ? upgradeTransaction.objectStore(name)
    : database.createObjectStore(name, options);
}

function ensureIndex(store, name, keyPath) {
  if (!store.indexNames.contains(name)) store.createIndex(name, keyPath, { unique: false });
}

function runTransaction(database, storeNames, mode, operation) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeNames, mode);
    const stores = Object.fromEntries(storeNames.map((name) => [name, transaction.objectStore(name)]));
    try {
      operation(stores);
    } catch (error) {
      transaction.abort();
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Character Studio IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('Character Studio IndexedDB transaction aborted.'));
  });
}

function getRecord(database, storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error(`Unable to read ${storeName}.`));
  });
}

function getAllByIndex(database, storeName, indexName, key) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).index(indexName).getAll(key);
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
    request.onerror = () => reject(request.error || new Error(`Unable to enumerate ${storeName}.`));
  });
}

async function writeBlobToOpfs(storageManager, projectId, assetId, blob) {
  if (!storageManager?.getDirectory) throw new Error('OPFS is unavailable.');
  const root = await storageManager.getDirectory();
  const appDirectory = await root.getDirectoryHandle('humanoid-rig-lab-next', { create: true });
  const projectDirectory = await appDirectory.getDirectoryHandle(safePathSegment(projectId), { create: true });
  const resourceDirectory = await projectDirectory.getDirectoryHandle('character-resources', { create: true });
  const fileName = safePathSegment(assetId);
  const fileHandle = await resourceDirectory.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(blob);
    await writable.close();
  } catch (error) {
    try { await writable.abort(); } catch (_) {}
    throw error;
  }
  return `/humanoid-rig-lab-next/${safePathSegment(projectId)}/character-resources/${fileName}`;
}

function safePathSegment(value) {
  return encodeURIComponent(String(value)).replace(/%/g, '_');
}

function createSnapshotKey(projectId, revision, updatedAt) {
  const timestamp = Math.max(0, Date.parse(updatedAt || 0) || 0);
  return `${projectId}:${String(revision).padStart(12, '0')}:${String(timestamp).padStart(15, '0')}`;
}

function createResourceKey(projectId, assetId) {
  return `${projectId}:${assetId}`;
}

function requiredId(value, label) {
  const id = String(value || '').trim();
  if (!id) throw new TypeError(`${label} is required.`);
  return id;
}

function nullableId(value) {
  const id = value == null ? '' : String(value).trim();
  return id || null;
}

function nonNegativeInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new TypeError(`${label} must be a non-negative integer.`);
  return number;
}

function isBlobValue(value) {
  return typeof Blob !== 'undefined' && value instanceof Blob;
}

function createPersistedCharacterSummary(state) {
  const characterId = state.characterCore?.active_character_id || null;
  const profile = characterId ? state.characterCore?.profiles?.[characterId] || null : null;
  if (!profile) return null;
  const resourceReferences = [
    state.character?.skin?.detailAsset,
    state.character?.skin?.bindingMetadata,
    state.character?.pose?.imagePoseAssetId,
    ...profile.clothing_attachments.map((item) => item.clothing_id),
    ...Object.values(profile.clothing_references || {}).map((item) => item?.clothingId),
    profile.hair?.hair_id,
    ...profile.accessory_attachments.map((item) => item.accessory_id),
  ].filter(Boolean).map(String);
  return {
    character_profile: structuredClone(profile),
    module_revisions: {
      proportion_revision: profile.proportion_revision,
      body_shape_revision: profile.body_shape_revision,
      skin_revision: profile.skin_revision,
      face_revision: profile.face_revision,
      clothing_revision: profile.clothing_revision,
      appearance_revision: nonNegativeInteger(state.appearanceSystem?.revision || 0, 'appearance_revision'),
      hair_revision: profile.hair_revision,
      accessory_revision: profile.accessory_revision,
      pose_revision: profile.pose_revision,
      animation_revision: profile.animation_revision,
    },
    resource_references: [...new Set(resourceReferences)].sort(),
  };
}
