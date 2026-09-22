"use client";

import { useMemo, useState } from "react";

type Prioridad = "P1" | "P2" | "P3" | "P4" | "P5";

type FotoHallazgo = {
  url: string;
  descripcion?: string | null;
};

type HallazgoFiltro = {
  id: string;
  prioridad: Prioridad;
  partida: string;
  punto: string;
  titulo: string;
  descripcion: string;
  recomendacion?: string | null;
  fotografias?: FotoHallazgo[];
};

const PRIORIDADES: Prioridad[] = ["P1","P2","P3","P4","P5"];

function agruparDeTres<T>(items:T[]) {
  const grupos:T[][] = [];
  for (let i=0;i<items.length;i+=3) grupos.push(items.slice(i,i+3));
  return grupos;
}

export default function FiltroHallazgosReporte({
  folio,
  hallazgos,
}: {
  folio: string;
  hallazgos: HallazgoFiltro[];
}) {
  const [abierto,setAbierto] = useState(false);
  const [seleccionadas,setSeleccionadas] = useState<Prioridad[]>(PRIORIDADES);

  const visibles = useMemo(
    () => hallazgos.filter((h)=>seleccionadas.includes(h.prioridad)),
    [hallazgos,seleccionadas],
  );
  const paginas = useMemo(()=>agruparDeTres(visibles),[visibles]);

  function alternar(prioridad: Prioridad) {
    setSeleccionadas((actual)=>
      actual.includes(prioridad)
        ? actual.filter((p)=>p!==prioridad)
        : [...actual,prioridad]
    );
  }

  function imprimirFiltrado() {
    document.documentElement.classList.add("print-hallazgos-mode");
    window.setTimeout(()=>window.print(),50);
    const limpiar=()=>document.documentElement.classList.remove("print-hallazgos-mode");
    window.addEventListener("afterprint",limpiar,{once:true});
    window.setTimeout(limpiar,3000);
  }

  return (
    <section className="hallazgos-print-view mx-auto mb-4 max-w-5xl">
      <style>{`
        @media print {
          .hallazgos-print-view { display:none!important; }
          html.print-hallazgos-mode body > * { display:none!important; }
          html.print-hallazgos-mode body main { display:block!important; background:#fff!important; padding:0!important; }
          html.print-hallazgos-mode body main > * { display:none!important; }
          html.print-hallazgos-mode .hallazgos-print-view { display:block!important; margin:0!important; max-width:none!important; padding:0!important; }
          html.print-hallazgos-mode .hallazgos-filter-controls,
          html.print-hallazgos-mode .hallazgos-toggle,
          html.print-hallazgos-mode .hallazgos-intro { display:none!important; }
          html.print-hallazgos-mode .hallazgos-pagina { break-after:page!important; page-break-after:always!important; padding:10mm!important; }
          html.print-hallazgos-mode .hallazgos-pagina:last-child { break-after:auto!important; page-break-after:auto!important; }
          html.print-hallazgos-mode .hallazgo-resumen-card { break-inside:avoid!important; page-break-inside:avoid!important; min-height:78mm; }
        }
      `}</style>

      <div className="hallazgos-toggle rounded-3xl border border-slate-300 bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={()=>setAbierto((v)=>!v)}
          className="flex w-full items-center justify-between gap-4 text-left"
        >
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-800">Vista resumida opcional</p>
            <h2 className="mt-1 text-lg font-black">FILTRAR HALLAZGOS PARA COMPARTIR</h2>
            <p className="mt-1 text-sm text-slate-600">Abre esta opción únicamente cuando quieras preparar una vista resumida por prioridades P1–P5.</p>
          </div>
          <span className="shrink-0 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white">{abierto ? "OCULTAR" : "ABRIR FILTRO"}</span>
        </button>
      </div>

      {abierto && (
        <div className="mt-3 rounded-3xl border border-slate-300 bg-white p-5 shadow-sm">
          <div className="hallazgos-intro flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-800">Hallazgos filtrados · {folio}</p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Selecciona una o varias prioridades. La vista resumida se organiza, cuando el contenido lo permite, en tres hallazgos por página con fotografías a la izquierda y texto a la derecha.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-white">
              <p className="text-2xl font-black">{visibles.length}</p>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Hallazgos visibles</p>
            </div>
          </div>

          <div className="hallazgos-filter-controls mt-4 flex flex-wrap gap-2">
            {PRIORIDADES.map((prioridad)=>{
              const activa=seleccionadas.includes(prioridad);
              const total=hallazgos.filter((h)=>h.prioridad===prioridad).length;
              return <button key={prioridad} type="button" onClick={()=>alternar(prioridad)} className={`rounded-full border px-4 py-2 text-sm font-black transition ${activa?"border-cyan-800 bg-cyan-800 text-white":"border-slate-300 bg-white text-slate-500"}`}>{prioridad} · {total}</button>;
            })}
            <button type="button" onClick={()=>setSeleccionadas(PRIORIDADES)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-black text-slate-700">TODOS</button>
            <button type="button" onClick={()=>setSeleccionadas(["P1","P2"])} className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-black text-amber-900">P1 + P2</button>
            <button type="button" onClick={imprimirFiltrado} disabled={visibles.length===0} className="rounded-full bg-slate-950 px-5 py-2 text-sm font-black text-white disabled:opacity-30">IMPRIMIR / GUARDAR PDF FILTRADO</button>
          </div>

          <div className="mt-5">
            {paginas.map((grupo, paginaIndex)=>(
              <div key={paginaIndex} className="hallazgos-pagina space-y-3">
                {grupo.map((h)=>{
                  const fotos=(h.fotografias??[]).slice(0,2);
                  return (
                    <article key={h.id} className="hallazgo-resumen-card grid gap-4 rounded-2xl border border-slate-200 p-4 md:grid-cols-[34%_1fr]">
                      <div className="min-h-[150px] overflow-hidden rounded-xl bg-slate-950">
                        {fotos.length>0 ? (
                          <div className={`grid h-full ${fotos.length>1?"grid-rows-2":""}`}>
                            {fotos.map((foto,i)=><img key={i} src={foto.url} alt={foto.descripcion??h.titulo} className="h-full min-h-0 w-full object-contain"/>)}
                          </div>
                        ) : (
                          <div className="grid h-full min-h-[150px] place-items-center px-4 text-center text-xs font-bold text-slate-400">Sin fotografía asociada al hallazgo</div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-500">{h.partida}<br/>{h.punto}</p>
                          <span className="rounded-full bg-slate-950 px-3 py-1 text-[10px] font-black text-white">{h.prioridad}</span>
                        </div>
                        <h3 className="mt-2 text-sm font-black">{h.titulo}</h3>
                        <p className="mt-2 text-xs leading-5 text-slate-600">{h.descripcion}</p>
                        {h.recomendacion&&<p className="mt-2 text-xs leading-5 text-slate-700"><strong>Recomendación:</strong> {h.recomendacion}</p>}
                      </div>
                    </article>
                  );
                })}
              </div>
            ))}
          </div>

          {visibles.length===0&&<p className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm font-bold text-slate-500">No hay hallazgos para las prioridades seleccionadas.</p>}
        </div>
      )}
    </section>
  );
}
