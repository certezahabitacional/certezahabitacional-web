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

type CriticalPhotoPayload = {
  fileKey: string;
  inspectionId: string;
  codigo: string;
  itemId: string;
  origin: "CAMARA" | "GALERIA";
};

type NoAplicaPayload = {
  inspectionId: string;
  itemId: string;
  motivo: string;
};

type ResultAreaPayload = {
  inspectionId: string;
  areaId: string;
  itemId: string;
  descripcionFinal: string;
  clasificacion: string;
  prioridad: string;
  valorMedido: string;
  valorProyecto: string;
  unidadMedida: string;
};

type ResultCriticalPayload = {
  inspectionId: string;
  codigo: string;
  itemId: string;
  descripcionFinal: string;
  clasificacion: string;
  prioridad: string;
  valorMedido: string;
  valorProyecto: string;
  unidadMedida: string;
};

type SignaturesPayload = {
  inspectionId: string;
  inspector: string;
  cliente: string;
};

type HermeticityStartPayload = {
  inspectionId: string;
  codigo: string;
  itemId: string;
  lecturaInicial: string;
  unidad: string;
};

type HermeticityFinalDraftPayload = {
  inspectionId: string;
  codigo: string;
  lecturaFinal: string;
  unidad: string;
  descripcionFinal: string;
  clasificacion: string;
  prioridad: string;
};

type FieldClosePayload = {
  inspectionId: string;
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
          if (item.operation === "PHOTO_CRITICAL_CONCEPT_V1") {
            const payload = item.payload as CriticalPhotoPayload;
            const file = await getOfflineFile(payload.fileKey);
            if (!file) throw new Error("La fotografía local ya no está disponible.");

            const form = new FormData();
            form.set("clientMutationId", item.clientMutationId);
            form.set("inspectionId", payload.inspectionId);
            form.set("codigo", payload.codigo);
            form.set("itemId", payload.itemId);
            form.set("origin", payload.origin);
            form.set("file", new File([file.blob], file.name, { type: file.type }));

            const response = await fetch("/api/offline/v1/sync-critical-photo", {
              method: "POST",
              body: form,
              credentials: "include",
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
              throw new Error(result?.error || "No fue posible sincronizar la fotografía crítica.");
            }

            await deleteOfflineFile(payload.fileKey);
            await removeQueueItem(item.id);
            continue;
          }

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

          if (item.operation === "RESULT_CRITICAL_CONCEPT_V1") {
            const payload = item.payload as ResultCriticalPayload;
            const response = await fetch("/api/offline/v1/sync-critical-result", {
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
              throw new Error(result?.error || "No fue posible sincronizar el resultado crítico.");
            }

            await removeQueueItem(item.id);
            continue;
          }

          if (item.operation === "RESULT_AREA_CONCEPT_V1") {
            const payload = item.payload as ResultAreaPayload;
            const response = await fetch("/api/offline/v1/sync-result", {
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
              throw new Error(result?.error || "No fue posible sincronizar el resultado.");
            }

            await removeQueueItem(item.id);
            continue;
          }

          if (item.operation === "HERMETICITY_START_V1") {
            const payload = item.payload as HermeticityStartPayload;
            const response = await fetch("/api/offline/v1/sync-hermeticity-start", {
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
              throw new Error(result?.error || "No fue posible sincronizar la lectura inicial de hermeticidad.");
            }

            await removeQueueItem(item.id);
            continue;
          }

          if (item.operation === "HERMETICITY_FINAL_DRAFT_V1") {
            const payload = item.payload as HermeticityFinalDraftPayload;
            const response = await fetch("/api/offline/v1/sync-hermeticity-final-draft", {
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
              throw new Error(result?.error || "No fue posible sincronizar la lectura final de hermeticidad.");
            }

            await removeQueueItem(item.id);
            continue;
          }

          if (item.operation === "FIELD_CLOSE_REQUEST_V1") {
            const payload = item.payload as FieldClosePayload;
            const response = await fetch("/api/offline/v1/sync-field-close", {
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
              throw new Error(result?.error || "No fue posible sincronizar el cierre de campo.");
            }

            await removeQueueItem(item.id);
            continue;
          }

          if (item.operation === "SIGNATURES_V1") {
            const payload = item.payload as SignaturesPayload;
            const response = await fetch("/api/offline/v1/sync-signatures", {
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
              throw new Error(result?.error || "No fue posible sincronizar las firmas.");
            }

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
