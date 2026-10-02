"use client";

import { useEffect, useState } from "react";
import { enqueueOfflineOperation } from "@/lib/offline/sync-queue";

export default function OfflineFieldCloseButton({ inspeccionId }: { inspeccionId: string }) {
  const [online, setOnline] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const actualizar = () => setOnline(navigator.onLine);
    actualizar();
    window.addEventListener("online", actualizar);
    window.addEventListener("offline", actualizar);
    return () => {
      window.removeEventListener("online", actualizar);
      window.removeEventListener("offline", actualizar);
    };
  }, []);

  async function cerrar() {
    setGuardando(true);
    setMensaje("");
    try {
      if (!navigator.onLine) {
        await enqueueOfflineOperation({
          inspectionId: inspeccionId,
          operation: "FIELD_CLOSE_REQUEST_V1",
          payload: { inspectionId: inspeccionId },
        });
        localStorage.setItem(
          `certeza:cierre-campo:${inspeccionId}`,
          JSON.stringify({ solicitadoEn: new Date().toISOString() }),
        );
        setMensaje("MODO SIN CONEXIÓN · Solicitud de cierre guardada. Se aplicará automáticamente cuando todos los pendientes se hayan sincronizado.");
        return;
      }

      const response = await fetch("/api/offline/v1/sync-field-close", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientMutationId: crypto.randomUUID(),
          operation: "FIELD_CLOSE_REQUEST_V1",
          payload: { inspectionId: inspeccionId },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMensaje(result?.error || "No fue posible cerrar el trabajo de campo.");
        return;
      }
      setMensaje("Trabajo de campo cerrado correctamente.");
    } catch {
      await enqueueOfflineOperation({
        inspectionId: inspeccionId,
        operation: "FIELD_CLOSE_REQUEST_V1",
        payload: { inspectionId: inspeccionId },
      });
      setMensaje("Conexión interrumpida · Solicitud de cierre guardada localmente.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="mt-5 rounded-3xl border border-cyan-300/20 bg-cyan-300/5 p-6">
      <p className="text-xs font-black uppercase tracking-widest text-cyan-300">Cierre de campo compatible con modo offline</p>
      <h2 className="mt-2 text-xl font-black">Terminar trabajo de campo</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        {online
          ? "El sistema validará recorrido, hermeticidad, hallazgos, portada y firmas antes de cerrar."
          : "Puedes dejar solicitada la terminación de la visita sin señal. Se aplicará cuando la sincronización esté completa y todas las validaciones sean correctas."}
      </p>
      <button
        type="button"
        onClick={cerrar}
        disabled={guardando}
        className="mt-4 w-full rounded-xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
      >
        {guardando ? "GUARDANDO..." : online ? "TERMINAR TRABAJO DE CAMPO" : "GUARDAR CIERRE PARA SINCRONIZAR"}
      </button>
      {mensaje && <p className="mt-3 rounded-xl bg-slate-950 p-3 text-xs font-bold text-cyan-100">{mensaje}</p>}
    </section>
  );
}
