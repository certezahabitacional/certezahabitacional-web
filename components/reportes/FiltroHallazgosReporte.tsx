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

export default function FiltroHallazgosReporte({
  folio,
  hallazgos,
  inmueble,
  direccion,
  fechaInspeccion,
}: {
  folio: string;
  hallazgos: HallazgoFiltro[];
  inmueble: string;
  direccion: string;
  fechaInspeccion: string;
}) {
  const [abierto,setAbierto] = useState(false);
  const [seleccionadas,setSeleccionadas] = useState<Prioridad[]>(PRIORIDADES);

  const visibles = useMemo(
    () => hallazgos.filter((h)=>seleccionadas.includes(h.prioridad)),
    [hallazgos,seleccionadas],
  );
  const partidas = useMemo(() => {
    const grupos = new Map<string, HallazgoFiltro[]>();
    for (const h of visibles) grupos.set(h.partida,[...(grupos.get(h.partida)??[]),h]);
    return Array.from(grupos,([nombre,hallazgos])=>({nombre,hallazgos}));
  },[visibles]);

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
    window.setTimeout(limpiar,60000);
  }

  return (
    <section className="hallazgos-print-view mx-auto mb-4 max-w-5xl">
      <style>{`
        @media print {
          .hallazgos-print-view { display:none!important; }
          html.print-hallazgos-mode main { display:block!important; background:#fff!important; padding:0!important; }
          html.print-hallazgos-mode main > :not(.hallazgos-print-view) { display:none!important; }
          html.print-hallazgos-mode main > .hallazgos-print-view { display:block!important; margin:0!important; max-width:none!important; padding:0!important; }
          html.print-hallazgos-mode .certeza-panel-menu { display:none!important; }
          html.print-hallazgos-mode .hallazgos-filter-controls,
          html.print-hallazgos-mode .hallazgos-toggle,
          html.print-hallazgos-mode .hallazgos-intro { display:none!important; }
          html.print-hallazgos-mode .hallazgos-portada { break-after:page!important; page-break-after:always!important; display:flex!important; }
          html.print-hallazgos-mode .hallazgos-partida { break-before:auto!important; break-after:auto!important; padding:0!important; }
          html.print-hallazgos-mode .hallazgos-partida-titulo { break-after:avoid!important; page-break-after:avoid!important; }
          html.print-hallazgos-mode .hallazgo-resumen-card { break-inside:avoid!important; page-break-inside:avoid!important; min-height:0!important; margin:4mm 0!important; display:grid!important; grid-template-columns:34% 1fr!important; }
          html.print-hallazgos-mode .hallazgo-resumen-card img { max-height:78mm!important; object-fit:contain!important; width:100%!important; }
          html.print-hallazgos-mode .hallazgos-print-view { font-size:10pt; }
          html.print-hallazgos-mode .hallazgos-contenido { border:0!important; padding:0!important; margin:0!important; box-shadow:none!important; }
          html.print-hallazgos-mode .hallazgos-portada { height:235mm; min-height:235mm; flex-direction:column; justify-content:center; padding:15mm; border:2px solid #0f172a; }
          html.print-hallazgos-mode .hallazgos-partida { margin-bottom:6mm; }
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
        <div className="hallazgos-contenido mt-3 rounded-3xl border border-slate-300 bg-white p-5 shadow-sm">
          <section className="hallazgos-portada hidden">
            <p className="text-sm font-black uppercase tracking-[.3em] text-cyan-800">Certeza Habitacional</p>
            <h1 className="mt-8 text-3xl font-black text-slate-950">RELACIÓN DE HALLAZGOS PARA CORRECCIÓN</h1>
            <p className="mt-3 text-sm text-slate-500">Documento técnico independiente para el responsable de realizar las correcciones.</p>
            <div className="mt-12 space-y-4 border-t border-slate-300 pt-8 text-base">
              <p><strong>Inmueble:</strong> {inmueble}</p>
              <p><strong>Ubicación:</strong> {direccion}</p>
              <p><strong>Folio de inspección:</strong> {folio}</p>
              <p><strong>Fecha de inspección:</strong> {fechaInspeccion}</p>
              <p><strong>Prioridades incluidas:</strong> {seleccionadas.join(", ")}</p>
              <p><strong>Hallazgos por corregir:</strong> {visibles.length}</p>
            </div>
            <p className="mt-12 text-xs text-slate-500">El contenido incluye únicamente las observaciones y evidencias correspondientes a las prioridades seleccionadas. No contiene datos personales del cliente.</p>
          </section>
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
            <button type="button" onClick={imprimirFiltrado} disabled={visibles.length===0} className="rounded-full bg-slate-950 px-5 py-2 text-sm font-black text-white disabled:opacity-30">IMPRIMIR SOLO HALLAZGOS FILTRADOS / GUARDAR PDF</button>
          </div>

          <div className="mt-5">
            {partidas.map((partida)=>(
              <div key={partida.nombre} className="hallazgos-partida space-y-3">
                <h2 className="hallazgos-partida-titulo mt-5 border-b-2 border-slate-900 pb-2 text-lg font-black">{partida.nombre}</h2>
                {partida.hallazgos.map((h)=>{
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
