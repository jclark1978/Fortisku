const canUseIndexedDB = typeof indexedDB !== "undefined" && indexedDB !== null;

export function createStore(dbName, storeName) {
  if (!canUseIndexedDB) {
    throw new Error("IndexedDB is not available in this environment.");
  }

  const dbp = new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return { dbp, storeName };
}

const defaultStore = createStore("fortisku-idb", "store");

function withStore(type, store, callback) {
  return store.dbp.then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(store.storeName, type);
        const objectStore = transaction.objectStore(store.storeName);
        let request;

        try {
          request = callback(objectStore);
        } catch (error) {
          reject(error);
          return;
        }

        transaction.oncomplete = () => resolve(request?.result);
        transaction.onabort = transaction.onerror = () =>
          reject(transaction.error || request?.error);
      })
  );
}

export function get(key, store = defaultStore) {
  return withStore("readonly", store, (s) => s.get(key));
}

export function set(key, value, store = defaultStore) {
  return withStore("readwrite", store, (s) => s.put(value, key));
}

export function del(key, store = defaultStore) {
  return withStore("readwrite", store, (s) => s.delete(key));
}

export function clear(store = defaultStore) {
  return withStore("readwrite", store, (s) => s.clear());
}

export function keys(store = defaultStore) {
  return withStore("readonly", store, (s) => s.getAllKeys());
}
