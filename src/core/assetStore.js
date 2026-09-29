const DATABASE_NAME = 'ai-video-studio-assets';
const DATABASE_VERSION = 1;
const ASSET_STORE_NAME = 'assets';

let databasePromise = null;

function openDatabase() {
  if (!('indexedDB' in window)) {
    return Promise.reject(new Error('이 브라우저는 이미지 저장소를 지원하지 않습니다.'));
  }

  if (databasePromise) {
    return databasePromise;
  }

  databasePromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(ASSET_STORE_NAME)) {
        database.createObjectStore(ASSET_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('이미지 저장소를 열지 못했습니다.'));
    request.onblocked = () => reject(new Error('이미지 저장소 업데이트가 차단되었습니다.'));
  });

  return databasePromise;
}

async function runRequest(mode, operation) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(ASSET_STORE_NAME, mode);
    const store = transaction.objectStore(ASSET_STORE_NAME);
    const request = operation(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('이미지 저장 작업에 실패했습니다.'));
    transaction.onabort = () => reject(transaction.error || new Error('이미지 저장 작업이 취소되었습니다.'));
  });
}

export function saveAsset(asset) {
  return runRequest('readwrite', (store) => store.put(asset));
}

export function loadAsset(assetId) {
  if (!assetId) {
    return Promise.resolve(null);
  }
  return runRequest('readonly', (store) => store.get(assetId));
}

export function removeAsset(assetId) {
  if (!assetId) {
    return Promise.resolve();
  }
  return runRequest('readwrite', (store) => store.delete(assetId));
}

export function listAssets() {
  return runRequest('readonly', (store) => store.getAll());
}
