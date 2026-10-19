import { openOfflineDb, STORE_FILES } from "./db";

type OfflineFileRecord = {
  key: string;
  blob: Blob;
  name: string;
  type: string;
  createdAt: string;
};

export async function saveOfflineFile(input: {
  key: string;
  blob: Blob;
  name: string;
  type: string;
}) {
  const db = await openOfflineDb();

  const record: OfflineFileRecord = {
    key: input.key,
    blob: input.blob,
    name: input.name,
    type: input.type,
    createdAt: new Date().toISOString(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_FILES, "readwrite");
    tx.objectStore(STORE_FILES).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  return record;
}

export async function getOfflineFile(key: string) {
  const db = await openOfflineDb();

  return new Promise<OfflineFileRecord | null>((resolve, reject) => {
    const tx = db.transaction(STORE_FILES, "readonly");
    const request = tx.objectStore(STORE_FILES).get(key);
    request.onsuccess = () => resolve((request.result as OfflineFileRecord | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteOfflineFile(key: string) {
  const db = await openOfflineDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_FILES, "readwrite");
    tx.objectStore(STORE_FILES).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
