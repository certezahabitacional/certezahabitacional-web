export const OFFLINE_DB_NAME = "certeza-habitacional-offline";
export const OFFLINE_DB_VERSION = 1;

export const STORE_QUEUE = "syncQueue";
export const STORE_META = "meta";

export type SyncQueueStatus =
  | "PENDING"
  | "SYNCING"
  | "SYNCED"
  | "ERROR"
  | "CONFLICT";

export type SyncQueueItem = {
  id: string;
  clientMutationId: string;
  inspectionId: string | null;
  operation: string;
  payload: unknown;
  status: SyncQueueStatus;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  lastError: string | null;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function ensureBrowser() {
  if (
    typeof window === "undefined" ||
    typeof indexedDB === "undefined"
  ) {
    throw new Error(
      "IndexedDB sólo está disponible en el navegador.",
    );
  }
}

export function openOfflineDb(): Promise<IDBDatabase> {
  ensureBrowser();

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(
      OFFLINE_DB_NAME,
      OFFLINE_DB_VERSION,
    );

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const queue = db.createObjectStore(STORE_QUEUE, {
          keyPath: "id",
        });

        queue.createIndex("status", "status", {
          unique: false,
        });

        queue.createIndex(
          "inspectionId",
          "inspectionId",
          {
            unique: false,
          },
        );

        queue.createIndex(
          "createdAt",
          "createdAt",
          {
            unique: false,
          },
        );
      }

      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, {
          keyPath: "key",
        });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

export async function clearOfflineDb() {
  const db = await openOfflineDb();

  db.close();
  dbPromise = null;

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(
      OFFLINE_DB_NAME,
    );

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      reject(
        new Error(
          "La base offline está abierta en otra pestaña.",
        ),
      );
    };
  });
}
