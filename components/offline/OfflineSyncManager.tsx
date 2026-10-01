"use client";

import { useCallback, useEffect, useRef } from "react";

import { deleteOfflineFile, getOfflineFile } from "@/lib/offline/files";
import {
  listQueueItems,
  removeQueueItem,
  updateQueueItem,
} from "@/lib/offline/sync-queue";

type PhotoPayload = {
  fileKey: string;
  inspectionId: string;
  areaId: string;
  itemId: string;
  origin: "CAMARA" | "GALERIA";
};

type NoAplicaPayload = {
  inspectionId: string;
  itemId: string;
  motivo: string;
};

export default function OfflineSyncManager() {
  const syncingRef = useRef(false);

  const sync = useCallback(async () => {
    if (!navigator.onLine || syncingRef.current) return;

    syncingRef.current = true;
    try {
      const items = await listQueueItems();

      for (const item of items) {
        if (!["PENDING", "ERROR"].includes(item.status)) continue;

        await updateQueueItem(item.id, {
          status: "SYNCING",
          attempts: item.attempts + 1,
          lastError: null,
        });

        try {
          if (item.operation === "PHOTO_CONCEPT_V1") {
            const payload = item.payload as PhotoPayload;
            const file = await getOfflineFile(payload.fileKey);
            if (!file) throw new Error("La fotografía local ya no está disponible.");

            const form = new FormData();
            form.set("clientMutationId", item.clientMutationId);
            form.set("inspectionId", payload.inspectionId);
            form.set("areaId", payload.areaId);
            form.set("itemId", payload.itemId);
            form.set("origin", payload.origin);
            form.set("file", new File([file.blob], file.name, { type: file.type }));

            const response = await fetch("/api/offline/v1/sync-photo", {
              method: "POST",
              body: form,
              credentials: "include",
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
              throw new Error(result?.error || "No fue posible sincronizar la fotografía.");
            }

            await deleteOfflineFile(payload.fileKey);
            await removeQueueItem(item.id);
            continue;
          }

          if (item.operation === "NO_APLICA_CONCEPT_V1") {
            const payload = item.payload as NoAplicaPayload;
            const response = await fetch("/api/offline/v1/sync-operation", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                clientMutationId: item.clientMutationId,
                operation: item.operation,
                payload,
              }),
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
              throw new Error(result?.error || "No fue posible sincronizar el cambio.");
            }

            await removeQueueItem(item.id);
            continue;
          }

          await updateQueueItem(item.id, {
            status: "CONFLICT",
            lastError: "Operación offline todavía no soportada por el sincronizador.",
          });
        } catch (error) {
          await updateQueueItem(item.id, {
            status: "ERROR",
            lastError: error instanceof Error ? error.message : "Error de sincronización.",
          });
        }
      }
    } finally {
      syncingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const online = () => void sync();
    window.addEventListener("online", online);
    const interval = window.setInterval(() => void sync(), 15_000);
    void sync();

    return () => {
      window.removeEventListener("online", online);
      window.clearInterval(interval);
    };
  }, [sync]);

  return null;
}
