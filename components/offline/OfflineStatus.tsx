"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  getPendingQueueCount,
  OFFLINE_QUEUE_CHANGED,
} from "@/lib/offline/sync-queue";

export default function OfflineStatus() {
  const [online, setOnline] =
    useState(true);

  const [pending, setPending] =
    useState(0);

  const [ready, setReady] =
    useState(false);

  const [syncing, setSyncing] =
    useState(false);

  const refreshPending =
    useCallback(async () => {
      try {
        const count =
          await getPendingQueueCount();

        setPending(count);
      } catch (error) {
        console.error(
          "No fue posible consultar la cola offline.",
          error,
        );
      }
    }, []);

  useEffect(() => {
    setOnline(
      navigator.onLine,
    );

    setReady(true);

    void refreshPending();

    const handleOnline = () => {
      setOnline(true);
      void refreshPending();
    };

    const handleOffline = () => {
      setOnline(false);
      void refreshPending();
    };

    const handleQueueChanged = () => {
      void refreshPending();
    };

    const handleSyncState = (event: Event) => {
      const detail = (event as CustomEvent<{ estado?: string }>).detail;
      if (detail?.estado === "syncing") {
        setSyncing(true);
        return;
      }

      setSyncing(false);
      void refreshPending();
    };

    window.addEventListener(
      "online",
      handleOnline,
    );

    window.addEventListener(
      "offline",
      handleOffline,
    );

    const handleOfflineLink = (event: MouseEvent) => {
      if (navigator.onLine) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      const url = new URL(anchor.href, window.location.href);
      if (
        url.origin === window.location.origin &&
        url.pathname.startsWith("/panel/inspecciones/")
      ) {
        event.preventDefault();
        event.stopPropagation();
        window.location.assign(url.href);
      }
    };

    document.addEventListener("click", handleOfflineLink, true);

    window.addEventListener(
      OFFLINE_QUEUE_CHANGED,
      handleQueueChanged,
    );

    window.addEventListener(
      "certeza:offline-sync-state",
      handleSyncState,
    );

    return () => {
      window.removeEventListener(
        "online",
        handleOnline,
      );

      window.removeEventListener(
        "offline",
        handleOffline,
      );

      document.removeEventListener("click", handleOfflineLink, true);

      window.removeEventListener(
        OFFLINE_QUEUE_CHANGED,
        handleQueueChanged,
      );

      window.removeEventListener(
        "certeza:offline-sync-state",
        handleSyncState,
      );
    };
  }, [refreshPending]);

  if (!ready) {
    return null;
  }

  if (online && pending === 0 && !syncing) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[100] max-w-sm rounded-2xl border border-white/10 bg-slate-950/95 px-4 py-3 text-sm text-white shadow-2xl backdrop-blur print:hidden">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`h-3 w-3 shrink-0 rounded-full ${
            online
              ? "bg-amber-400"
              : "bg-rose-500"
          }`}
        />

        <div>
          <p className="font-black">
            {syncing
              ? "SINCRONIZANDO"
              : online
                ? "Conexión recuperada"
                : "MODO SIN CONEXIÓN"}
          </p>

          <p className="mt-0.5 text-xs text-slate-300">
            {syncing
              ? `Subiendo ${pending} cambio${pending === 1 ? "" : "s"} pendiente${pending === 1 ? "" : "s"}.`
              : pending > 0
              ? `${pending} cambio${
                  pending === 1
                    ? ""
                    : "s"
                } pendiente${
                  pending === 1
                    ? ""
                    : "s"
                } de sincronizar.`
              : "Modo sin conexión activo. La inspección descargada puede seguir consultándose."}
          </p>
        </div>
      </div>
    </div>
  );
}
