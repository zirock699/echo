const dbName = 'echo-studio-cache-v1';

export const cacheKey = owner => `state:${owner}`;
export const draftKey = (owner, writer) => `${cacheKey(owner)}:draft:${writer}`;

export function sameDraftVersion(current, reviewed) {
  if (!reviewed || !current?.pending || current.owner !== reviewed.owner) return false;
  if (reviewed.token) return current.token === reviewed.token;
  return JSON.stringify(current) === JSON.stringify(reviewed);
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('kv');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction(mode, work) {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', mode);
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(tx.error || Error('Device storage was interrupted.'));
      work(tx.objectStore('kv'), value => { result = value; });
    });
  } finally {
    db.close();
  }
}

export const deviceCache = {
  get(key) {
    return transaction('readonly', (store, result) => {
      const request = store.get(key);
      request.onsuccess = () => result(request.result);
    });
  },
  set(key, value) {
    return transaction('readwrite', store => store.put(value, key));
  },
  list(owner) {
    return transaction('readonly', (store, result) => {
      const records = new Map();
      result(records);
      const legacy = store.get(cacheKey(owner));
      legacy.onsuccess = () => {
        if (legacy.result?.pending) records.set(cacheKey(owner), legacy.result);
      };
      const prefix = draftKey(owner, '');
      const request = store.openCursor(IDBKeyRange.bound(prefix, prefix + '\uffff'));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        if (cursor.value?.pending) records.set(cursor.key, cursor.value);
        cursor.continue();
      };
    });
  },
  remove(key, reviewed) {
    return transaction('readwrite', (store, result) => {
      if (!reviewed) {
        store.delete(key);
        result(true);
        return;
      }
      const request = store.get(key);
      request.onsuccess = () => {
        const matches = sameDraftVersion(request.result, reviewed);
        if (matches) store.delete(key);
        result(matches);
      };
    });
  },
};
