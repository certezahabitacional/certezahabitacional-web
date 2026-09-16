import {
  HERRAMIENTAS_INSPECCION,
  type CodigoHerramienta,
  type ResultadosInstrumentales,
} from "@/lib/herramientas-inspeccion";
import {
  fichaHerramientaReporte,
  TECNOLOGIA_BASE_CERTEZA,
} from "@/lib/tecnologia-inspeccion";

type Props = {
  resultados: ResultadosInstrumentales;
  compact?: boolean;
  mostrarNoEjecutadas?: boolean;
};

function resumenValores(valores: Record<string, string>) {
  return Object.entries(valores)
    .filter(([, valor]) => valor.trim())
    .map(([clave, valor]) => `${clave.replaceAll("_", " ")}: ${valor}`)
    .join(" · ");
}

export default function TecnologiaInspeccionV1({
  resultados,
  compact = false,
  mostrarNoEjecutadas = false,
}: Props) {
  const realizadas = HERRAMIENTAS_INSPECCION.filter(
    (herramienta) => resultados[herramienta.codigo]?.estado === "REALIZADA",
  );
  const noEjecutadas = HERRAMIENTAS_INSPECCION.filter(
    (herramienta) => resultados[herramienta.codigo]?.estado === "NO_EJECUTADA",
  );

  return (
    <div>
      <div className={compact ? "space-y-3" : "grid gap-4 md:grid-cols-2"}>
        <article className="rounded-2xl border border-amber-300/30 bg-amber-50 p-4 text-slate-950">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-amber-700">
            Tecnología base del Método Certeza
          </p>
          <h3 className="mt-2 text-lg font-black">{TECNOLOGIA_BASE_CERTEZA.nombre}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {TECNOLOGIA_BASE_CERTEZA.funcion}
          </p>
          {!compact && (
            <>
              <p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-500">Aplicación</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">{TECNOLOGIA_BASE_CERTEZA.aplicacion}</p>
              <p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-500">Ventaja</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">{TECNOLOGIA_BASE_CERTEZA.ventaja}</p>
            </>
          )}
        </article>

        {realizadas.map((herramienta) => {
          const ficha = fichaHerramientaReporte(herramienta.codigo as CodigoHerramienta);
          const resultado = resultados[herramienta.codigo];
          if (!ficha || !resultado) return null;
          const valores = resumenValores(resultado.valores);
          return (
            <article key={herramienta.codigo} className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-950">
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-700">Equipo utilizado</p>
              <h3 className="mt-2 text-lg font-black">{ficha.nombre}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">{ficha.funcion}</p>
              {valores && (
                <p className="mt-3 rounded-xl bg-slate-100 p-3 text-xs font-bold leading-5 text-slate-700">
                  {valores}
                </p>
              )}
              {!compact && (
                <>
                  <p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-500">Aplicación en el reporte</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{ficha.aplicacion}</p>
                  <p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-500">Ventaja técnica</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{ficha.ventaja}</p>
                </>
              )}
            </article>
          );
        })}
      </div>

      {realizadas.length === 0 && (
        <p className="mt-3 text-xs text-slate-500">
          No hay resultados instrumentales adicionales registrados como ejecutados. La Aplicación Certeza Habitacional permanece como tecnología base del proceso.
        </p>
      )}

      {mostrarNoEjecutadas && noEjecutadas.length > 0 && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-slate-900">
          <p className="text-xs font-black uppercase tracking-wider text-amber-800">Pruebas o equipos no ejecutados</p>
          <div className="mt-3 space-y-2">
            {noEjecutadas.map((herramienta) => (
              <div key={herramienta.codigo} className="rounded-xl bg-white p-3 text-sm">
                <p className="font-black">{herramienta.nombre}</p>
                <p className="mt-1 text-slate-600">
                  {resultados[herramienta.codigo]?.motivoNoEjecutada || "Sin motivo registrado."}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
