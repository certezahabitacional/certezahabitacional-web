"use client";

import { FormEvent, useEffect, useState } from "react";

import { enqueueOfflineOperation } from "@/lib/offline/sync-queue";

export default function OfflineManualConceptResult({
  inspeccionId,
  areaId,
  itemId,
  requiereMedicion,
  requiereComparacionProyecto,
  origenV3,
  valorMedidoInicial,
  valorProyectoInicial,
  unidadInicial,
}: {
  inspeccionId: string;
  areaId: string;
  itemId: string;
  requiereMedicion: boolean;
  requiereComparacionProyecto: boolean;
  origenV3: string;
  valorMedidoInicial?: string | null;
  valorProyectoInicial?: string | null;
  unidadInicial?: string | null;
}) {
  const [online, setOnline] = useState(true);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const refresh = () => setOnline(navigator.onLine);
    refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, []);

  if (online) return null;

  const guardar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const descripcionFinal = String(form.get("descripcionFinal") ?? "").trim();
    const clasificacion = String(form.get("clasificacion") ?? "C").trim().toUpperCase();
    const prioridad = String(form.get("prioridad") ?? "SH").trim().toUpperCase();
    const valorMedido = String(form.get("valorMedido") ?? "").trim();
    const valorProyecto = String(form.get("valorProyecto") ?? "").trim();
    const unidadMedida = String(form.get("unidadMedida") ?? "").trim();

    if (descripcionFinal.length < 10) {
      setMensaje("Registra una descripción técnica de al menos 10 caracteres.");
      return;
    }
    if (!["C", "O", "NC", "CR"].includes(clasificacion)) {
      setMensaje("Selecciona una clasificación válida.");
      return;
    }
    if (clasificacion !== "C" && !["P1", "P2", "P3", "P4", "P5"].includes(prioridad)) {
      setMensaje("Selecciona una prioridad P1–P5 para el hallazgo.");
      return;
    }
    if (requiereMedicion && (!valorMedido || !unidadMedida)) {
      setMensaje("Este concepto requiere valor medido y unidad.");
      return;
    }
    if (requiereComparacionProyecto && origenV3 === "PROYECTO" && !valorProyecto) {
      setMensaje("Este concepto requiere el valor de proyecto.");
      return;
    }

    await enqueueOfflineOperation({
      inspectionId: inspeccionId,
      operation: "RESULT_AREA_CONCEPT_V1",
      payload: {
        inspectionId: inspeccionId,
        areaId,
        itemId,
        descripcionFinal,
        clasificacion,
        prioridad: clasificacion === "C" ? "SH" : prioridad,
        valorMedido,
        valorProyecto,
        unidadMedida,
      },
    });

    setMensaje("Resultado guardado localmente. Se validará, calificará y sincronizará cuando regrese Internet.");
  };

  return (
    <form onSubmit={guardar} className="rounded-2xl border border-cyan-300/30 bg-cyan-300/5 p-4">
      <p className="text-xs font-black uppercase text-cyan-200">Captura manual sin conexión</p>
      <p className="mt-2 text-[11px] leading-5 text-slate-400">
        La IA no puede ejecutarse sin Internet. Registra tu criterio técnico; al recuperar conexión el sistema validará evidencia, calculará la evaluación y creará el hallazgo cuando corresponda.
      </p>

      {requiereMedicion && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input name="valorMedido" defaultValue={valorMedidoInicial ?? ""} required placeholder="Valor medido" className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm"/>
          <input name="unidadMedida" defaultValue={unidadInicial ?? ""} required placeholder="Unidad" className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm"/>
        </div>
      )}

      {requiereComparacionProyecto && origenV3 === "PROYECTO" && (
        <input name="valorProyecto" defaultValue={valorProyectoInicial ?? ""} required placeholder="Valor de proyecto" className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm"/>
      )}

      <textarea
        name="descripcionFinal"
        required
        minLength={10}
        placeholder="Descripción técnica final del Inspector"
        className="mt-3 min-h-28 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
      />

      <select name="clasificacion" defaultValue="C" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm">
        <option value="C">C · Conforme</option>
        <option value="O">O · Observación</option>
        <option value="NC">NC · No conformidad</option>
        <option value="CR">CR · Crítico</option>
      </select>

      <select name="prioridad" defaultValue="SH" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm">
        <option value="SH">SH · Sin hallazgo</option>
        <option value="P1">P1 · Inmediata / crítica</option>
        <option value="P2">P2 · Muy alta</option>
        <option value="P3">P3 · Alta / corregir</option>
        <option value="P4">P4 · Media / observación</option>
        <option value="P5">P5 · Baja / seguimiento</option>
      </select>

      <button className="mt-3 w-full rounded-xl bg-cyan-300 px-3 py-3 text-sm font-black text-slate-950">
        GUARDAR RESULTADO EN ESTE DISPOSITIVO
      </button>

      {mensaje && <p className="mt-3 rounded-xl bg-white/5 p-3 text-xs font-bold text-slate-200">{mensaje}</p>}
    </form>
  );
}
