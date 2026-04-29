const DB_NAME = "toolbox_shared";
const DB_VERSION = 1;
const STORE_NAME = "datasets";

function openSharedDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getSharedDataset(key) {
  const db = await openSharedDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function saveSharedDataset(key, payload) {
  const db = await openSharedDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const record = { ...payload, key };
    const req = store.keyPath === "key" ? store.put(record) : store.put(record, key);
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function deleteSharedDataset(key) {
  const db = await openSharedDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(key);
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function hasSharedDataset(key) {
  const dataset = await getSharedDataset(key);
  return dataset !== null;
}

export async function getAllSharedDatasetMeta() {
  const db = await openSharedDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      db.close();
      const records = (req.result ?? []).map(({ key, version, source, meta }) => ({
        key,
        version,
        source,
        meta
      }));
      resolve(records);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}
