"use client";

import { FormEvent, useState } from "react";
import { enqueueOfflineOperation } from "@/lib/offline/sync-queue";

export default function OfflineHermeticityStartForm({
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

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    if (navigator.onLine) return;
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const lecturaInicial = String(form.get("lecturaInicial") ?? "").trim();
    const unidad = String(form.get("unidad") ?? "").trim();
    if (!lecturaInicial || !unidad) {
      setMensaje("Captura la lectura inicial y la unidad.");
      return;
    }

    await enqueueOfflineOperation({
      inspectionId: inspeccionId,
      operation: "HERMETICITY_START_V1",
      payload: { inspectionId: inspeccionId, codigo, itemId, lecturaInicial, unidad },
    });

    localStorage.setItem(
      `certeza:hermeticidad:${inspeccionId}:${codigo}:inicio`,
      JSON.stringify({ lecturaInicial, unidad, guardadoEn: new Date().toISOString() }),
    );
    setMensaje("Lectura inicial guardada en este dispositivo. Se sincronizará al recuperar Internet.");
  };

  return (
    <form action={serverAction} onSubmit={onSubmit} className="mt-4 max-w-xl rounded-2xl border border-white/10 bg-slate-950 p-4">
      <input type="hidden" name="inspeccionId" value={inspeccionId} />
      <input type="hidden" name="codigo" value={codigo} />
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="retorno" value="HERMETICIDAD_INICIO" />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-slate-400">
          Lectura inicial
          <input name="lecturaInicial" required className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white" />
        </label>
        <label className="text-xs font-bold text-slate-400">
          Unidad
          <input name="unidad" required placeholder="psi, kPa, bar..." className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white" />
        </label>
      </div>
      <button className="mt-3 w-full rounded-xl bg-amber-300 px-4 py-3 text-sm font-black text-slate-950">
        REGISTRAR LECTURA INICIAL
      </button>
      {mensaje && <p className="mt-3 rounded-lg bg-cyan-300/10 p-3 text-xs font-bold text-cyan-100">{mensaje}</p>}
    </form>
  );
}
