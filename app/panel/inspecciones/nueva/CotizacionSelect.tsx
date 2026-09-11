"use client";

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
};

export default function CotizacionSelect({ cotizaciones }: { cotizaciones: CotizacionDisponible[] }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-300">Cotización autorizada *</span>
      <select name="cotizacionId" required defaultValue="" className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300">
        <option value="" disabled>Selecciona el folio que origina la inspección</option>
        {cotizaciones.map((c) => {
          const porcentaje = c.total > 0 ? (c.montoPagado / c.total) * 100 : 0;
          return (
            <option key={c.id} value={c.id}>
              {c.folio} · {c.clienteNombre} · {c.inmuebleAlias} · pagado {porcentaje.toFixed(0)}%{c.excepcionApertura ? " · excepción Dirección" : ""}
            </option>
          );
        })}
      </select>
      <p className="mt-2 text-xs text-slate-500">Solo aparecen cotizaciones autorizadas, con inmueble y con al menos 50% pagado, salvo excepción expresa de Dirección.</p>
    </label>
  );
}