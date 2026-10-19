"use client";

import { FormEvent, useState } from "react";

import { enqueueOfflineOperation } from "@/lib/offline/sync-queue";

export default function OfflineNoAplicaForm({
  inspeccionId,
  itemId,
  serverAction,
}: {
  inspeccionId: string;
  itemId: string;
  serverAction: (formData: FormData) => Promise<void>;
}) {
  const [mensaje, setMensaje] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    if (navigator.onLine) return;

    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const motivo = String(form.get("motivo") ?? "").trim();

    if (motivo.length < 3) {
      setMensaje("Indica brevemente por qué el concepto no aplica.");
      return;
    }

    await enqueueOfflineOperation({
      inspectionId: inspeccionId,
      operation: "NO_APLICA_CONCEPT_V1",
      payload: {
        inspectionId: inspeccionId,
        itemId,
        motivo,
      },
    });

    setMensaje("Guardado en este dispositivo. Se sincronizará al recuperar Internet.");
    event.currentTarget.reset();
  };

  return (
    <form
      action={serverAction}
      onSubmit={onSubmit}
      className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4"
    >
      <input type="hidden" name="inspeccionId" value={inspeccionId}/>
      <input type="hidden" name="itemId" value={itemId}/>
      <p className="text-xs font-black uppercase text-amber-200">Opción por concepto</p>
      <input
        name="motivo"
        required
        minLength={3}
        placeholder="Motivo por el que este concepto no aplica"
        className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
      />
      <button className="mt-2 w-full rounded-xl border border-amber-300/40 px-3 py-2 text-sm font-black text-amber-200">
        MARCAR NO APLICA
      </button>
      {mensaje && (
        <p className="mt-3 rounded-lg bg-cyan-300/10 p-3 text-xs font-bold text-cyan-100">
          {mensaje}
        </p>
      )}
    </form>
  );
}
