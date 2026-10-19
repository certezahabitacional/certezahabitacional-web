"use client";

import { FormEvent, ReactNode, useState } from "react";

import { enqueueOfflineOperation } from "@/lib/offline/sync-queue";

export default function OfflineResultForm({
  inspeccionId,
  areaId,
  itemId,
  serverAction,
  className,
  children,
}: {
  inspeccionId: string;
  areaId: string;
  itemId: string;
  serverAction: (formData: FormData) => Promise<void>;
  className?: string;
  children: ReactNode;
}) {
  const [mensaje, setMensaje] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    if (navigator.onLine) return;

    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const descripcionFinal = String(form.get("descripcionFinal") ?? "").trim();
    const clasificacion = String(form.get("clasificacion") ?? "").trim().toUpperCase();
    const prioridad = String(form.get("prioridad") ?? "").trim().toUpperCase();
    const valorMedido = String(form.get("valorMedido") ?? "").trim();
    const valorProyecto = String(form.get("valorProyecto") ?? "").trim();
    const unidadMedida = String(form.get("unidadMedida") ?? "").trim();

    if (descripcionFinal.length < 10) {
      setMensaje("Registra una descripción técnica de al menos 10 caracteres.");
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
        prioridad,
        valorMedido,
        valorProyecto,
        unidadMedida,
      },
    });

    setMensaje("Resultado guardado en este dispositivo. Se cerrará y calificará al recuperar Internet.");
  };

  return (
    <form action={serverAction} onSubmit={onSubmit} className={className}>
      <input type="hidden" name="inspeccionId" value={inspeccionId}/>
      <input type="hidden" name="areaId" value={areaId}/>
      <input type="hidden" name="itemId" value={itemId}/>
      {children}
      {mensaje && (
        <p className="mt-3 rounded-xl bg-cyan-300/10 p-3 text-xs font-bold text-cyan-100">
          {mensaje}
        </p>
      )}
    </form>
  );
}
