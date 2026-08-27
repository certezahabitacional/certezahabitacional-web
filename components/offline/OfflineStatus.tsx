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

    window.addEventListener(
      "online",
      handleOnline,
    );

    window.addEventListener(
      "offline",
      handleOffline,
    );

    window.addEventListener(
      OFFLINE_QUEUE_CHANGED,
      handleQueueChanged,
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

      window.removeEventListener(
        OFFLINE_QUEUE_CHANGED,
        handleQueueChanged,
      );
    };
  }, [refreshPending]);

  if (!ready) {
    return null;
  }

  if (online && pending === 0) {
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
            {online
              ? "Conexión recuperada"
              : "Sin conexión"}
          </p>

          <p className="mt-0.5 text-xs text-slate-300">
            {pending > 0
              ? `${pending} cambio${
                  pending === 1
                    ? ""
                    : "s"
                } pendiente${
                  pending === 1
                    ? ""
                    : "s"
                } de sincronizar.`
              : "La captura offline se habilitará en la siguiente fase."}
          </p>
        </div>
      </div>
    </div>
  );
}
