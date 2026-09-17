"use client";

import { useMemo, useState } from "react";

export type CotizacionDisponible = {
  id: string;
  folio: string;
  clienteId: string;
  clienteNombre: string;
  inmuebleId: string;
  inmuebleAlias: string;
  total: number;
  montoPagado: number;
  excepcionApertura: boolean;
  modo?: "NUEVA" | "RETOMAR";
  inspeccionFolio?: string | null;
  fechaProgramada?: string | null;
};

export default function CotizacionSelect({ cotizaciones }: { cotizaciones: CotizacionDisponible[] }) {
  const [cotizacionId, setCotizacionId] = useState("");
  const seleccionada = useMemo(
    () => cotizaciones.find((c) => c.id === cotizacionId) ?? null,
    [cotizacionId, cotizaciones],
  );

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-sm font-bold text-slate-300">Cotización autorizada *</span>
        <select
          name="cotizacionId"
          required
          value={cotizacionId}
          onChange={(event) => setCotizacionId(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
        >
          <option value="" disabled>Selecciona el folio que origina o retoma la inspección</option>
          {cotizaciones.map((c) => {
            const porcentaje = c.total > 0 ? (c.montoPagado / c.total) * 100 : 0;
            const retomar = c.inspeccionFolio ? ` · REAGENDAR / COMPLETAR ${c.inspeccionFolio}` : "";
            return (
              <option key={c.id} value={c.id}>
                {c.folio} · {c.clienteNombre} · {c.inmuebleAlias} · pagado {porcentaje.toFixed(0)}%{c.excepcionApertura ? " · excepción Dirección" : ""}{retomar}
              </option>
            );
          })}
        </select>
      </label>

      {seleccionada && (
        <div className="grid gap-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-5 md:grid-cols-2">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">Cliente</p>
            <p className="mt-1 font-bold">{seleccionada.clienteNombre}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">Inmueble</p>
            <p className="mt-1 font-bold">{seleccionada.inmuebleAlias}</p>
          </div>
          {seleccionada.inspeccionFolio && (
            <div className="md:col-span-2 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-amber-300">
                Inspección PROGRAMADA existente · se actualizará, no se duplicará
              </p>
              <p className="mt-2 font-bold text-white">{seleccionada.inspeccionFolio}</p>
              <p className="mt-1 text-sm text-amber-100">
                Puedes completar asignaciones o cambiar la fecha/hora. Si dejas un dato sin cambio, se conserva el valor actual.
              </p>
            </div>
          )}
          <input type="hidden" name="clienteId" value={seleccionada.clienteId} />
          <input type="hidden" name="inmuebleId" value={seleccionada.inmuebleId} />
        </div>
      )}

      <p className="text-xs text-slate-500">
        Aparecen cotizaciones autorizadas y financieramente habilitadas sin inspección y también las vinculadas a una inspección que todavía permanezca PROGRAMADA.
      </p>
    </div>
  );
}
