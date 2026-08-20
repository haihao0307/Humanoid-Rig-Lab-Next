const DB_NAME = 'humanoid-rig-lab-next-image-poses';
const DB_VERSION = 1;
const STORE_NAME = 'source-images';
const memoryStore = new Map();

export async function saveImagePoseSource(assetId, blob) {
  const id = String(assetId || '').trim();
  if (!id || !(blob instanceof Blob)) return false;
  if (typeof indexedDB === 'undefined') {
    memoryStore.set(id, blob);
    return true;
  }
  try {
    const database = await openDatabase();
    await runTransaction(database, 'readwrite', (store) => store.put({
      id,
      blob,
      updatedAt: new Date().toISOString(),
    }));
    return true;
  } catch (error) {
    console.warn('Unable to persist image pose source in IndexedDB.', error);
    memoryStore.set(id, blob);
    return false;
  }
}

export async function loadImagePoseSource(assetId) {
  const id = String(assetId || '').trim();
  if (!id) return null;
  if (memoryStore.has(id)) return memoryStore.get(id);
  if (typeof indexedDB === 'undefined') return null;
  try {
    const database = await openDatabase();
    const record = await runTransaction(database, 'readonly', (store) => store.get(id));
    return record?.blob instanceof Blob ? record.blob : null;
  } catch (error) {
    console.warn('Unable to load image pose source from IndexedDB.', error);
    return null;
  }
}

export async function deleteImagePoseSource(assetId) {
  const id = String(assetId || '').trim();
  if (!id) return false;
  memoryStore.delete(id);
  if (typeof indexedDB === 'undefined') return true;
  try {
    const database = await openDatabase();
    await runTransaction(database, 'readwrite', (store) => store.delete(id));
    return true;
  } catch (error) {
    console.warn('Unable to delete image pose source from IndexedDB.', error);
    return false;
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed.'));
    request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked by another window.'));
  });
}

function runTransaction(database, mode, operation) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let request;
    try {
      request = operation(store);
    } catch (error) {
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onerror = () => reject(transaction.error || request?.error || new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted.'));
  });
}
