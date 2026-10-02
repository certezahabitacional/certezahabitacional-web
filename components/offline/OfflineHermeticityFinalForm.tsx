"use client";

import { FormEvent, useEffect, useState } from "react";
import { enqueueOfflineOperation } from "@/lib/offline/sync-queue";

export default function OfflineHermeticityFinalForm({
  inspeccionId,
  codigo,
  serverAction,
  iaDisponible,
  lecturaFinalDefault,
  unidadDefault,
  descripcionDefault,
  clasificacionDefault,
  prioridadDefault,
}: {
  inspeccionId: string;
  codigo: string;
  serverAction: (formData: FormData) => Promise<void>;
  iaDisponible: boolean;
  lecturaFinalDefault: string;
  unidadDefault: string;
  descripcionDefault: string;
  clasificacionDefault: string;
  prioridadDefault: string;
}) {
  const [online, setOnline] = useState(true);
  const [mensaje, setMensaje] = useState("");

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

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    if (navigator.onLine) {
      if (!iaDisponible) {
        event.preventDefault();
        setMensaje("Con Internet, genera primero la interpretación IA antes de cerrar formalmente la prueba.");
      }
      return;
    }

    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const lecturaFinal = String(form.get("lecturaFinal") ?? "").trim();
    const unidad = String(form.get("unidad") ?? "").trim();
    const descripcionFinal = String(form.get("descripcionFinal") ?? "").trim();
    const clasificacion = String(form.get("clasificacion") ?? "").trim();
    const prioridad = String(form.get("prioridad") ?? "").trim();

    if (!lecturaFinal || !unidad || descripcionFinal.length < 10) {
      setMensaje("Completa lectura final, unidad e interpretación del Inspector.");
      return;
    }

    await enqueueOfflineOperation({
      inspectionId: inspeccionId,
      operation: "HERMETICITY_FINAL_DRAFT_V1",
      payload: { inspectionId: inspeccionId, codigo, lecturaFinal, unidad, descripcionFinal, clasificacion, prioridad },
    });

    localStorage.setItem(
      `certeza:hermeticidad:${inspeccionId}:${codigo}:final`,
      JSON.stringify({ lecturaFinal, unidad, descripcionFinal, clasificacion, prioridad, guardadoEn: new Date().toISOString() }),
    );
    setMensaje("MODO SIN CONEXIÓN · Lectura final guardada. Al recuperar Internet se sincronizará y quedará pendiente únicamente la interpretación IA.");
  };

  return (
    <form action={serverAction} onSubmit={onSubmit} className="rounded-2xl border border-emerald-300/20 bg-emerald-300/5 p-4">
      <input type="hidden" name="inspeccionId" value={inspeccionId} />
      <input type="hidden" name="codigo" value={codigo} />
      <input type="hidden" name="retorno" value="HERMETICIDAD_CIERRE" />
      <p className="text-xs font-black uppercase text-emerald-200">Cierre técnico · interpretación final del Inspector</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input name="lecturaFinal" required defaultValue={lecturaFinalDefault} placeholder="Lectura final" className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2" />
        <input name="unidad" required defaultValue={unidadDefault} placeholder="Unidad" className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2" />
      </div>
      <label className="mt-3 block text-xs font-black uppercase tracking-wider text-emerald-200">
        Interpretación final del Inspector
        <textarea name="descripcionFinal" required defaultValue={descripcionDefault} placeholder="Describe el resultado observado." className="mt-2 min-h-32 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm font-normal normal-case tracking-normal text-white" />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <select name="clasificacion" defaultValue={clasificacionDefault} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2">
          <option value="C">C · Conforme</option><option value="O">O · Observación</option><option value="NC">NC · No conformidad</option><option value="CR">CR · Crítico</option>
        </select>
        <select name="prioridad" defaultValue={prioridadDefault} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2">
          <option value="SH">SH · Sin hallazgo · 100/100</option><option value="P1">P1</option><option value="P2">P2</option><option value="P3">P3</option><option value="P4">P4</option><option value="P5">P5</option>
        </select>
      </div>
      <div className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-3 text-xs text-cyan-50">
        {online
          ? iaDisponible
            ? "Interpretación IA disponible. Puedes cerrar formalmente la prueba."
            : "La IA requiere Internet. Genera primero la interpretación IA para cerrar formalmente."
          : "Sin Internet puedes dejar toda la lectura final capturada. La IA se ejecutará después de recuperar conexión."}
      </div>
      <button className="mt-3 w-full rounded-xl bg-emerald-300 px-4 py-3 text-sm font-black text-slate-950">
        {online ? (iaDisponible ? "REGISTRAR LECTURA FINAL Y CERRAR PRUEBA" : "GUARDAR / REVISAR REQUISITO IA") : "GUARDAR LECTURA FINAL SIN CONEXIÓN"}
      </button>
      {mensaje && <p className="mt-3 rounded-lg bg-cyan-300/10 p-3 text-xs font-bold text-cyan-100">{mensaje}</p>}
    </form>
  );
}
