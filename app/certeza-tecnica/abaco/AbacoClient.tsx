"use client";

import { useMemo, useState } from "react";
import {
  type BudgetRow,
  type ProgramRow,
  type SeqRow,
  makeProgram,
  makeSequential,
  money,
  pct,
  readBudgetFile,
} from "./logic";

export default function AbacoClient() {
  const [budget, setBudget] = useState<BudgetRow[]>([]);
  const [seq, setSeq] = useState<SeqRow[]>([]);
  const [program, setProgram] = useState<ProgramRow[]>([]);
  const [view, setView] = useState<"none"|"seq"|"program">("none");
  const [message, setMessage] = useState("Carga un presupuesto para comenzar.");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0,10));
  const [targetDays, setTargetDays] = useState(90);

  const total = useMemo(() => budget.reduce((s,r)=>s+r.importe,0), [budget]);
  const unresolved = useMemo(() => seq.filter(r=>r.revisar || !r.cantidadConfiable || r.rendimiento<=0).length,[seq]);

  async function loadFile(file: File) {
    try {
      setMessage("Leyendo presupuesto...");
      const parsed = await readBudgetFile(file);
      setBudget(parsed);
      setSeq([]);
      setProgram([]);
      setView("none");
      setMessage("Presupuesto cargado. Genera el Secuencial para revisar cantidades, rendimientos y predecesoras.");
    } catch (error) {
      setBudget([]);
      setView("none");
      setMessage(error instanceof Error ? error.message : "No fue posible leer el archivo.");
    }
  }

  function generateSeq() {
    const result = makeSequential(budget);
    setSeq(result);
    setProgram([]);
    setView("seq");
    setMessage("Secuencial generado. Ajusta los campos marcados antes de generar el Ábaco definitivo.");
  }

  function updateRow(sec:number, patch:Partial<SeqRow>) {
    setSeq(rows=>rows.map(r=>r.sec===sec?{...r,...patch}:r));
    setProgram([]);
    setView("seq");
  }

  function generateProgram() {
    const base = seq.length ? seq : makeSequential(budget);
    setSeq(base);
    setProgram(makeProgram(base,startDate,targetDays));
    setView("program");
    setMessage("Ábaco generado. Las actividades con cantidad y rendimiento válidos usan producción real; las demás quedan identificadas como PARAMÉTRICAS.");
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
          <p className="text-xs font-black uppercase tracking-[.18em] text-[#edcb71]">Paso 1</p>
          <h2 className="mt-2 text-xl font-bold">Cargar presupuesto</h2>
          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={(e)=>{const f=e.target.files?.[0]; if(f) void loadFile(f);}}
            className="mt-4 block w-full rounded-xl border border-white/20 bg-[#0b2747] p-3 text-sm"
          />
          <p className="mt-3 rounded-xl bg-[#06162a] p-3 text-sm text-slate-200">{message}</p>
          {budget.length ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Metric label="Conceptos" value={String(budget.length)} />
              <Metric label="Presupuesto" value={money(total)} />
              <Metric label="Eventos por revisar" value={String(unresolved)} />
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
          <p className="text-xs font-black uppercase tracking-[.18em] text-[#edcb71]">Parámetros generales</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Fecha de inicio">
              <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="w-full rounded-lg border border-white/20 bg-[#0b2747] px-3 py-3" />
            </Field>
            <Field label="Duración objetivo de respaldo">
              <input type="number" min={1} value={targetDays} onChange={(e)=>setTargetDays(Math.max(1,Number(e.target.value)||1))} className="w-full rounded-lg border border-white/20 bg-[#0b2747] px-3 py-3" />
            </Field>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-400">
            La duración objetivo solo se usa como respaldo cuando un evento todavía no tiene cantidad/rendimiento confiables. Con datos válidos se aplica: cantidad ÷ rendimiento ÷ cuadrillas.
          </p>
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <button type="button" disabled={!budget.length} onClick={generateSeq} className="rounded-2xl bg-[#edcb71] p-5 text-left font-black text-[#071d38] disabled:opacity-40">
          <span className="text-xs uppercase tracking-[.18em]">Enlace 1</span>
          <span className="mt-2 block text-xl">GENERAR SECUENCIAL Y EQUIVALENCIAS</span>
        </button>
        <button type="button" disabled={!budget.length} onClick={generateProgram} className="rounded-2xl border border-cyan-300/50 bg-cyan-950/50 p-5 text-left font-black text-white disabled:opacity-40">
          <span className="text-xs uppercase tracking-[.18em] text-cyan-200">Enlace 2</span>
          <span className="mt-2 block text-xl">GENERAR ÁBACO DE PROGRAMACIÓN</span>
        </button>
      </div>

      {view==="seq" ? <SeqTable rows={seq} onChange={updateRow}/> : null}
      {view==="program" ? <ProgramTable rows={program}/> : null}
    </div>
  );
}

function Metric({label,value}:{label:string;value:string}) {
  return <div className="rounded-xl bg-[#0b2747] p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 font-bold">{value}</p></div>;
}
function Field({label,children}:{label:string;children:React.ReactNode}) {
  return <label className="text-sm font-semibold text-slate-200"><span className="mb-1 block">{label}</span>{children}</label>;
}
function H({children}:{children:React.ReactNode}) { return <th className="whitespace-nowrap px-3 py-3 text-left text-[#edcb71]">{children}</th>; }
function D({children}:{children:React.ReactNode}) { return <td className="px-3 py-3 align-top text-slate-100">{children}</td>; }
const inputClass="w-full min-w-[90px] rounded border border-white/20 bg-[#0b2747] px-2 py-2 text-white";

function SeqTable({rows,onChange}:{rows:SeqRow[];onChange:(sec:number,patch:Partial<SeqRow>)=>void}) {
  return <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-[#edcb71]">Matriz de producción del Secuencial</h2>
        <p className="mt-1 text-sm text-slate-300">Revisa cantidad, unidad, rendimiento, cuadrillas, predecesora y traslape antes de generar el Ábaco.</p>
      </div>
    </div>
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-[1600px] w-full text-sm">
        <thead className="bg-[#0b2747]"><tr>
          <H>#</H><H>SEC</H><H>TIPO DE PRODUCTO</H><H>VALOR</H><H>EQUIV.</H><H>CANTIDAD</H><H>UNIDAD</H><H>REND./DÍA/CUADRILLA</H><H>CUADRILLAS</H><H>PREDECESORA</H><H>TRASLAPE</H><H>CUADRILLA / OFICIO</H>
        </tr></thead>
        <tbody>{rows.map(r=><tr key={r.sec} className="border-t border-white/10">
          <D>{r.orden}</D>
          <D>{r.revisar?"REVISAR":r.sec}</D>
          <D>{r.etapa}</D>
          <D>{money(r.importe)}</D>
          <D>{pct(r.equivalencia)}</D>
          <D><input type="number" min={0} step="any" value={r.cantidad} onChange={e=>onChange(r.sec,{cantidad:Number(e.target.value)||0,cantidadConfiable:true})} className={inputClass}/></D>
          <D><input value={r.unidad} onChange={e=>onChange(r.sec,{unidad:e.target.value,cantidadConfiable:true})} className={inputClass}/></D>
          <D><input type="number" min={0} step="any" value={r.rendimiento} onChange={e=>onChange(r.sec,{rendimiento:Number(e.target.value)||0})} className={inputClass}/></D>
          <D><input type="number" min={1} step="1" value={r.cuadrillas} onChange={e=>onChange(r.sec,{cuadrillas:Math.max(1,Number(e.target.value)||1)})} className={inputClass}/></D>
          <D>
            <select value={r.predecesora??""} onChange={e=>onChange(r.sec,{predecesora:e.target.value===""?null:Number(e.target.value)})} className={inputClass}>
              <option value="">Inicio</option>
              {rows.filter(x=>x.orden<r.orden).map(x=><option key={x.sec} value={x.sec}>{x.revisar?"REV":x.sec} - {x.etapa}</option>)}
            </select>
          </D>
          <D>
            <select value={r.traslape} onChange={e=>onChange(r.sec,{traslape:Number(e.target.value)})} className={inputClass}>
              <option value={0}>0%</option><option value={0.25}>25%</option><option value={0.5}>50%</option><option value={0.75}>75%</option>
            </select>
          </D>
          <D><input value={r.cuadrilla} onChange={e=>onChange(r.sec,{cuadrilla:e.target.value})} className="w-full min-w-[180px] rounded border border-white/20 bg-[#0b2747] px-2 py-2 text-white"/></D>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}

function ProgramTable({rows}:{rows:ProgramRow[]}) {
  return <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
    <h2 className="text-xl font-bold text-[#edcb71]">Ábaco de programación</h2>
    <p className="mt-1 text-sm text-slate-300">La columna MÉTODO indica si la duración salió de rendimiento real o del respaldo paramétrico.</p>
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-[1500px] w-full text-sm">
        <thead className="bg-[#0b2747]"><tr>
          <H>#</H><H>SEC</H><H>EVENTO</H><H>INCIDENCIA</H><H>CANTIDAD</H><H>UNIDAD</H><H>REND.</H><H>CUADRILLAS</H><H>DÍAS</H><H>PREDECESORA</H><H>TRASLAPE</H><H>INICIO</H><H>TÉRMINO</H><H>% ACUM.</H><H>MÉTODO</H>
        </tr></thead>
        <tbody>{rows.map(r=><tr key={r.sec} className="border-t border-white/10">
          <D>{r.orden}</D><D>{r.revisar?"REVISAR":r.sec}</D><D>{r.etapa}</D><D>{pct(r.equivalencia)}</D><D>{r.cantidad||"—"}</D><D>{r.unidad}</D><D>{r.rendimiento||"—"}</D><D>{r.cuadrillas}</D><D>{r.dias}</D><D>{r.predecesora??"Inicio"}</D><D>{pct(r.traslape)}</D><D>{r.inicio}</D><D>{r.termino}</D><D>{pct(r.avance)}</D><D><span className={r.metodoDuracion==="RENDIMIENTO"?"font-bold text-emerald-300":"font-bold text-amber-300"}>{r.metodoDuracion}</span></D>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}
