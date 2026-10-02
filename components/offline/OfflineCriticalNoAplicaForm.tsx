"use client";

import { FormEvent, useState } from "react";
import { enqueueOfflineOperation } from "@/lib/offline/sync-queue";

export default function OfflineCriticalNoAplicaForm({
  inspeccionId,
  codigo,
  itemId,
  serverAction,
}: {
  inspeccionId: string;
  codigo: string;
  itemId: string;
  serverAction: (formData: FormData) => Promise<void>;
}) {
  const [mensaje, setMensaje] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (navigator.onLine) return;

    event.preventDefault();

    await enqueueOfflineOperation({
      inspectionId: inspeccionId,
      operation: "NO_APLICA_CONCEPT_V1",
      payload: {
        inspectionId: inspeccionId,
        itemId,
        motivo: "Marcado como NO APLICA por el Inspector.",
      },
    });

    setMensaje("MODO SIN CONEXIÓN · Concepto marcado NO APLICA. Se sincronizará al recuperar Internet.");
  }

  return (
    <form
      action={serverAction}
      onSubmit={onSubmit}
      className="rounded-2xl border border-slate-600/40 bg-slate-950 p-4"
    >
      <input type="hidden" name="inspeccionId" value={inspeccionId} />
      <input type="hidden" name="codigo" value={codigo} />
      <input type="hidden" name="itemId" value={itemId} />
      <p className="text-xs font-black uppercase tracking-wider text-amber-200">Opción por concepto</p>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">
        Al marcarlo NO APLICA se cerrará sin pedir fotografía, IA, comentario, medición ni prioridad.
      </p>
      <button className="mt-3 w-full rounded-xl border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-sm font-black text-amber-200">
        MARCAR NO APLICA
      </button>
      {mensaje && <p className="mt-3 rounded-lg bg-cyan-300/10 p-3 text-xs font-bold text-cyan-100">{mensaje}</p>}
    </form>
  );
}
