import {
  openOfflineDb,
  STORE_QUEUE,
  type SyncQueueItem,
} from "./db";

export const OFFLINE_QUEUE_CHANGED =
  "certeza:offline-queue-changed";

function uid() {
  if (
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function emitQueueChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(
        OFFLINE_QUEUE_CHANGED,
      ),
    );
  }
}

export async function enqueueOfflineOperation(input: {
  inspectionId?: string | null;
  operation: string;
  payload: unknown;
}) {
  const db = await openOfflineDb();

  const now = new Date().toISOString();
  const id = uid();

  const item: SyncQueueItem = {
    id,
    clientMutationId: id,
    inspectionId:
      input.inspectionId ?? null,
    operation: input.operation,
    payload: input.payload,
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    lastError: null,
  };

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(
      STORE_QUEUE,
      "readwrite",
    );

    transaction
      .objectStore(STORE_QUEUE)
      .add(item);

    transaction.oncomplete = () =>
      resolve();

    transaction.onerror = () =>
      reject(transaction.error);

    transaction.onabort = () =>
      reject(transaction.error);
  });

  emitQueueChanged();

  return item;
}

export async function getPendingQueueCount() {
  const db = await openOfflineDb();

  const statuses = [
    "PENDING",
    "ERROR",
    "CONFLICT",
  ] as const;

  let total = 0;

  for (const status of statuses) {
    total += await new Promise<number>(
      (resolve, reject) => {
        const transaction =
          db.transaction(
            STORE_QUEUE,
            "readonly",
          );

        const index = transaction
          .objectStore(STORE_QUEUE)
          .index("status");

        const request =
          index.count(status);

        request.onsuccess = () =>
          resolve(request.result);

        request.onerror = () =>
          reject(request.error);
      },
    );
  }

  return total;
}

export async function listQueueItems() {
  const db = await openOfflineDb();

  return new Promise<SyncQueueItem[]>(
    (resolve, reject) => {
      const transaction =
        db.transaction(
          STORE_QUEUE,
          "readonly",
        );

      const request = transaction
        .objectStore(STORE_QUEUE)
        .getAll();

      request.onsuccess = () =>
        resolve(
          (
            request.result as SyncQueueItem[]
          ).sort((a, b) =>
            a.createdAt.localeCompare(
              b.createdAt,
            ),
          ),
        );

      request.onerror = () =>
        reject(request.error);
    },
  );
}
