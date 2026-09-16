import { registrarDecisionClienteSitioV1 } from "./actions";

const OPCIONES = [
  ["RECIBO_LA_VIVIENDA", "RECIBO LA VIVIENDA"],
  ["NO_RECIBO_LA_VIVIENDA", "NO RECIBO LA VIVIENDA"],
  ["PREFIERO_ESPERAR_EL_REPORTE_FINAL", "PREFIERO ESPERAR EL REPORTE FINAL"],
  ["NO_DESEO_REGISTRAR_DECISION", "NO DESEO REGISTRAR DECISIÓN"],
] as const;

export default function DecisionClienteSitioV1({ inspeccionId, decisionActual, puedeRegistrar }: {
  inspeccionId: string;
  decisionActual: string | null;
  puedeRegistrar: boolean;
}) {
  const etiquetaActual = OPCIONES.find(([valor]) => valor === decisionActual)?.[1] ?? null;

  return (
    <section className="border-t border-slate-200 bg-cyan-50 px-7 py-7 print:hidden">
      <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-800">Decisión opcional del cliente en sitio</p>
      <h2 className="mt-2 text-2xl font-black">¿Desea registrar una decisión con este pre-reporte?</h2>
      <p className="mt-2 text-sm leading-6 text-slate-700">Esta selección documenta únicamente la decisión expresada por el cliente en este momento. Certeza Habitacional no decide por el cliente y el reporte sigue siendo preliminar hasta la autorización de Dirección.</p>

      {etiquetaActual && (
        <div className="mt-4 rounded-2xl border border-cyan-200 bg-white p-4 text-sm font-bold text-cyan-900">
          Decisión registrada: {etiquetaActual}
        </div>
      )}

      {puedeRegistrar && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {OPCIONES.map(([valor, etiqueta]) => (
            <form action={registrarDecisionClienteSitioV1} key={valor}>
              <input type="hidden" name="inspeccionId" value={inspeccionId} />
              <input type="hidden" name="decision" value={valor} />
              <button className={`h-full w-full rounded-2xl border px-4 py-3 text-left text-sm font-black transition ${decisionActual === valor ? "border-cyan-700 bg-cyan-800 text-white" : "border-cyan-200 bg-white text-cyan-950 hover:border-cyan-500"}`}>
                {etiqueta}
              </button>
            </form>
          ))}
        </div>
      )}
    </section>
  );
}
