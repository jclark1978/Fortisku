// toolbox_shared IndexedDB adapter — shared storage contract for FabricBOM toolbox family
// DB: toolbox_shared | Store: datasets | Schema version: 1
//
// Lifecycle key constants (hardware_lifecycle and software_lifecycle are scaffolded here
// for future cross-tool interoperability; FabricBOM does not consume them yet).

const TOOLBOX_DB_NAME    = 'toolbox_shared';
const TOOLBOX_DB_VERSION = 1;
const TOOLBOX_STORE      = 'datasets';

const TOOLBOX_KEY_PRICING            = 'pricing';
const TOOLBOX_KEY_HARDWARE_LIFECYCLE = 'hardware_lifecycle'; // reserved, not yet used
const TOOLBOX_KEY_SOFTWARE_LIFECYCLE = 'software_lifecycle'; // reserved, not yet used

let _toolboxDb = null;

function _openToolboxDB() {
  if (_toolboxDb) return Promise.resolve(_toolboxDb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(TOOLBOX_DB_NAME, TOOLBOX_DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(TOOLBOX_STORE)) {
        db.createObjectStore(TOOLBOX_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = e => { _toolboxDb = e.target.result; resolve(_toolboxDb); };
    req.onerror   = e => reject(e.target.error);
  });
}

async function getDataset(key) {
  const db = await _openToolboxDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(TOOLBOX_STORE, 'readonly');
    const req = tx.objectStore(TOOLBOX_STORE).get(key);
    req.onsuccess = e => resolve(e.target.result || null);
    req.onerror   = e => reject(e.target.error);
  });
}

async function saveDataset(key, payload) {
  const db = await _openToolboxDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TOOLBOX_STORE, 'readwrite');
    const store = tx.objectStore(TOOLBOX_STORE);
    const record = { ...payload, key };
    if (store.keyPath === 'key') {
      store.put(record);
    } else {
      store.put(record, key);
    }
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  });
}

async function deleteDataset(key) {
  const db = await _openToolboxDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TOOLBOX_STORE, 'readwrite');
    tx.objectStore(TOOLBOX_STORE).delete(key);
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  });
}

async function hasDataset(key) {
  const data = await getDataset(key);
  return data !== null;
}
