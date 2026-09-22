"use client";

import { useMemo, useState } from "react";

type Prioridad = "P1" | "P2" | "P3" | "P4" | "P5";

type HallazgoFiltro = {
  id: string;
  prioridad: Prioridad;
  partida: string;
  punto: string;
  titulo: string;
  descripcion: string;
  recomendacion?: string | null;
};

const PRIORIDADES: Prioridad[] = ["P1","P2","P3","P4","P5"];

export default function FiltroHallazgosReporte({
  folio,
  hallazgos,
}: {
  folio: string;
  hallazgos: HallazgoFiltro[];
}) {
  const [seleccionadas,setSeleccionadas] = useState<Prioridad[]>(PRIORIDADES);

  const visibles = useMemo(
    () => hallazgos.filter((h)=>seleccionadas.includes(h.prioridad)),
    [hallazgos,seleccionadas],
  );

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
    <section className="hallazgos-print-view mx-auto mb-4 max-w-5xl rounded-3xl border border-slate-300 bg-white p-5 shadow-sm">
      <style>{`
        @media print {
          html.print-hallazgos-mode body > * { display:none!important; }
          html.print-hallazgos-mode body main { display:block!important; background:#fff!important; padding:0!important; }
          html.print-hallazgos-mode body main > * { display:none!important; }
          html.print-hallazgos-mode .hallazgos-print-view { display:block!important; margin:0!important; max-width:none!important; border:0!important; box-shadow:none!important; padding:10mm!important; }
          html.print-hallazgos-mode .hallazgos-filter-controls { display:none!important; }
          html.print-hallazgos-mode .hallazgo-resumen-card { break-inside:avoid!important; page-break-inside:avoid!important; }
        }
      `}</style>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-800">Vista resumida para compartir</p>
          <h2 className="mt-1 text-xl font-black">Hallazgos filtrados · {folio}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Selecciona una o varias prioridades para mostrar únicamente los hallazgos que deseas compartir con inmobiliaria, propietario o responsable de atención.
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

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {visibles.map((h)=>(
          <article key={h.id} className="hallazgo-resumen-card rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-500">{h.partida} · {h.punto}</p>
              <span className="rounded-full bg-slate-950 px-3 py-1 text-[10px] font-black text-white">{h.prioridad}</span>
            </div>
            <h3 className="mt-2 text-sm font-black">{h.titulo}</h3>
            <p className="mt-2 text-xs leading-5 text-slate-600">{h.descripcion}</p>
            {h.recomendacion&&<p className="mt-2 text-xs leading-5 text-slate-700"><strong>Recomendación:</strong> {h.recomendacion}</p>}
          </article>
        ))}
      </div>

      {visibles.length===0&&<p className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm font-bold text-slate-500">No hay hallazgos para las prioridades seleccionadas.</p>}
    </section>
  );
}
