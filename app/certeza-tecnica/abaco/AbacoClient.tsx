"use client";

import { useMemo, useState } from "react";
import {
  type BudgetRow,
  type ProgramRow,
  type SeqRow,
  makeProgram,
  makeSequential,
  money,
  norm,
  pct,
  readBudgetFile,
} from "./logic";

type LearnedRule = {
  key:string;
  cuadrilla:string;
  rendimiento:number;
};

const STORAGE_KEY="certeza-abaco-rendimientos-aprendidos-v1";
const ruleKey=(r:Pick<BudgetRow,"descripcion"|"unidad">)=>`${norm(r.unidad)}|${norm(r.descripcion)}`;

function loadLearnedRules():LearnedRule[]{
  if(typeof window==="undefined") return [];
  try {
    const raw=window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as LearnedRule[] : [];
  } catch {
    return [];
  }
}

function applyLearnedRules(rows:BudgetRow[]){
  const learned=loadLearnedRules();
  const map=new Map(learned.map(r=>[r.key,r]));
  return rows.map(row=>{
    if(row.rendimiento>0) return row;
    const saved=map.get(ruleKey(row));
    if(!saved) return row;
    return {
      ...row,
      cuadrilla:saved.cuadrilla,
      rendimiento:saved.rendimiento,
      reglaRendimiento:"APRENDIDO",
    };
  });
}

export default function AbacoClient() {
  const [budget, setBudget] = useState<BudgetRow[]>([]);
  const [seq, setSeq] = useState<SeqRow[]>([]);
  const [program, setProgram] = useState<ProgramRow[]>([]);
  const [view, setView] = useState<"none"|"unmatched"|"seq"|"program">("none");
  const [message, setMessage] = useState("Carga un presupuesto para comenzar.");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0,10));
  const [targetDays, setTargetDays] = useState(90);

  const total = useMemo(() => budget.reduce((s,r)=>s+r.importe,0), [budget]);
  const productivityCoverage = useMemo(() => {
    if (!budget.length) return 0;
    return budget.filter(r=>r.rendimiento>0).length / budget.length;
  }, [budget]);
  const unmatchedRows = useMemo(
    () => budget.map((r,index)=>({r,index})).filter(({r})=>r.rendimiento<=0),
    [budget]
  );
  const unresolved = useMemo(
    () => seq.filter(r=>r.revisar || r.conceptosSinRendimiento>0).length,
    [seq]
  );

  async function loadFile(file: File) {
    try {
      setMessage("Leyendo presupuesto...");
      const parsed = applyLearnedRules(await readBudgetFile(file));
      setBudget(parsed);
      setSeq([]);
      setProgram([]);
      setView("none");
      const pending=parsed.filter(r=>r.rendimiento<=0).length;
      setMessage(
        pending
          ? `Presupuesto cargado. Hay ${pending} concepto(s) sin rendimiento. Puedes resolverlos antes de generar el Secuencial.`
          : "Presupuesto cargado con cobertura completa de rendimientos."
      );
    } catch (error) {
      setBudget([]);
      setSeq([]);
      setProgram([]);
      setView("none");
      setMessage(error instanceof Error ? error.message : "No fue posible leer el archivo.");
    }
  }

  function generateSeq() {
    const result = makeSequential(budget);
    setSeq(result);
    setProgram([]);
    setView("seq");
    setMessage("Secuencial generado. Las jornadas base se calculan concepto por concepto cuando existe un rendimiento compatible con su unidad.");
  }

  function updateSeqRow(sec:number, patch:Partial<SeqRow>) {
    setSeq(rows=>rows.map(r=>r.sec===sec?{...r,...patch}:r));
    setProgram([]);
    setView("seq");
  }

  function updateBudgetRow(index:number, patch:Partial<BudgetRow>) {
    setBudget(rows=>rows.map((r,i)=>i===index?{...r,...patch}:r));
    setSeq([]);
    setProgram([]);
  }

  function saveLearnedRules() {
    const existing=loadLearnedRules();
    const map=new Map(existing.map(r=>[r.key,r]));
    budget.forEach(row=>{
      if(row.rendimiento>0 && row.cuadrilla.trim()){
        map.set(ruleKey(row),{
          key:ruleKey(row),
          cuadrilla:row.cuadrilla.trim(),
          rendimiento:row.rendimiento,
        });
      }
    });
    window.localStorage.setItem(STORAGE_KEY,JSON.stringify([...map.values()]));
    const result=makeSequential(budget);
    setSeq(result);
    setProgram([]);
    setView("seq");
    setMessage("Rendimientos guardados en este navegador y Secuencial recalculado.");
  }

  function generateProgram() {
    const base = seq.length ? seq : makeSequential(budget);
    setSeq(base);
    setProgram(makeProgram(base,startDate,targetDays));
    setView("program");
    setMessage("Ábaco generado. El método de duración indica si la etapa quedó por RENDIMIENTO, MIXTO o PARAMÉTRICO.");
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
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Conceptos" value={String(budget.length)} />
              <Metric label="Presupuesto" value={money(total)} />
              <Metric label="Cobertura rendimientos" value={pct(productivityCoverage)} />
              <Metric label="Sin rendimiento" value={String(unmatchedRows.length)} />
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
          <p className="text-xs font-black uppercase tracking-[.18em] text-[#edcb71]">Parámetros generales</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Fecha de inicio">
              <input
                type="date"
                value={startDate}
                onChange={(e)=>setStartDate(e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-[#0b2747] px-3 py-3"
              />
            </Field>
            <Field label="Duración objetivo de respaldo">
              <input
                type="number"
                min={1}
                value={targetDays}
                onChange={(e)=>setTargetDays(Math.max(1,Number(e.target.value)||1))}
                className="w-full rounded-lg border border-white/20 bg-[#0b2747] px-3 py-3"
              />
            </Field>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-400">
            El motor calcula jornadas por concepto usando cantidad ÷ rendimiento. Los rendimientos que tú corrijas se guardan en este navegador y se reutilizan en futuros presupuestos con la misma descripción y unidad.
          </p>
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <button
          type="button"
          disabled={!budget.length || !unmatchedRows.length}
          onClick={()=>setView("unmatched")}
          className="rounded-2xl border border-amber-300/50 bg-amber-950/40 p-5 text-left font-black text-white disabled:opacity-40"
        >
          <span className="text-xs uppercase tracking-[.18em] text-amber-200">Revisión</span>
          <span className="mt-2 block text-xl">CONCEPTOS SIN RENDIMIENTO</span>
          <span className="mt-2 block text-sm font-semibold text-amber-50">{unmatchedRows.length} pendiente(s)</span>
        </button>

        <button
          type="button"
          disabled={!budget.length}
          onClick={generateSeq}
          className="rounded-2xl bg-[#edcb71] p-5 text-left font-black text-[#071d38] disabled:opacity-40"
        >
          <span className="text-xs uppercase tracking-[.18em]">Enlace 1</span>
          <span className="mt-2 block text-xl">GENERAR SECUENCIAL Y EQUIVALENCIAS</span>
        </button>

        <button
          type="button"
          disabled={!budget.length}
          onClick={generateProgram}
          className="rounded-2xl border border-cyan-300/50 bg-cyan-950/50 p-5 text-left font-black text-white disabled:opacity-40"
        >
          <span className="text-xs uppercase tracking-[.18em] text-cyan-200">Enlace 2</span>
          <span className="mt-2 block text-xl">GENERAR ÁBACO DE PROGRAMACIÓN</span>
        </button>
      </div>

      {view==="unmatched" ? (
        <UnmatchedTable
          rows={unmatchedRows}
          onChange={updateBudgetRow}
          onSave={saveLearnedRules}
        />
      ) : null}
      {view==="seq" ? <SeqTable rows={seq} onChange={updateSeqRow}/> : null}
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

function UnmatchedTable({
  rows,
  onChange,
  onSave,
}:{
  rows:Array<{r:BudgetRow;index:number}>;
  onChange:(index:number,patch:Partial<BudgetRow>)=>void;
  onSave:()=>void;
}) {
  return <section className="rounded-2xl border border-amber-300/30 bg-amber-950/20 p-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-amber-200">Conceptos sin rendimiento</h2>
        <p className="mt-1 max-w-4xl text-sm text-slate-300">
          Define cuadrilla y rendimiento diario. Al guardar, la regla queda aprendida en este navegador para futuras cargas con la misma descripción y unidad.
        </p>
      </div>
      <button
        type="button"
        onClick={onSave}
        className="rounded-lg bg-[#edcb71] px-4 py-3 text-sm font-black text-[#071d38]"
      >
        GUARDAR REGLAS Y RECALCULAR
      </button>
    </div>

    <div className="mt-4 overflow-x-auto">
      <table className="min-w-[1350px] w-full text-sm">
        <thead className="bg-[#0b2747]">
          <tr>
            <H>PARTIDA</H><H>DESCRIPCIÓN</H><H>UNIDAD</H><H>CANTIDAD</H><H>IMPORTE</H><H>CUADRILLA / OFICIO</H><H>RENDIMIENTO / DÍA</H>
          </tr>
        </thead>
        <tbody>
          {rows.map(({r,index})=><tr key={index} className="border-t border-white/10">
            <D>{r.partida||"—"}</D>
            <D>{r.descripcion}</D>
            <D>{r.unidad||"—"}</D>
            <D>{r.cantidad||"—"}</D>
            <D>{money(r.importe)}</D>
            <D>
              <input
                value={r.cuadrilla}
                placeholder="Ej. Albañilería"
                onChange={e=>onChange(index,{cuadrilla:e.target.value})}
                className="w-full min-w-[180px] rounded border border-white/20 bg-[#0b2747] px-2 py-2 text-white"
              />
            </D>
            <D>
              <input
                type="number"
                min={0}
                step="any"
                value={r.rendimiento||""}
                placeholder="0"
                onChange={e=>onChange(index,{rendimiento:Number(e.target.value)||0,reglaRendimiento:"MANUAL"})}
                className={inputClass}
              />
            </D>
          </tr>)}
        </tbody>
      </table>
    </div>
  </section>;
}

function SeqTable({rows,onChange}:{rows:SeqRow[];onChange:(sec:number,patch:Partial<SeqRow>)=>void}) {
  return <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
    <h2 className="text-xl font-bold text-[#edcb71]">Matriz de producción del Secuencial</h2>
    <p className="mt-1 text-sm text-slate-300">
      Jornadas base = suma de jornadas calculadas concepto por concepto. Las etapas con conceptos sin rendimiento quedan señaladas para revisión.
    </p>

    <div className="mt-4 overflow-x-auto">
      <table className="min-w-[1550px] w-full text-sm">
        <thead className="bg-[#0b2747]">
          <tr>
            <H>#</H><H>SEC</H><H>TIPO DE PRODUCTO</H><H>VALOR</H><H>EQUIV.</H><H>UNIDAD</H><H>JORNADAS BASE</H><H>SIN REND.</H><H>CUADRILLAS</H><H>PREDECESORA</H><H>TRASLAPE</H><H>CUADRILLA / OFICIO</H>
          </tr>
        </thead>
        <tbody>
          {rows.map(r=><tr key={r.sec} className="border-t border-white/10">
            <D>{r.orden}</D><D>{r.revisar?"REVISAR":r.sec}</D><D>{r.etapa}</D><D>{money(r.importe)}</D><D>{pct(r.equivalencia)}</D><D>{r.unidad}</D><D>{r.jornadasBase>0?r.jornadasBase.toFixed(2):"—"}</D>
            <D><span className={r.conceptosSinRendimiento>0?"font-bold text-amber-300":"font-bold text-emerald-300"}>{r.conceptosSinRendimiento}</span></D>
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
          </tr>)}
        </tbody>
      </table>
    </div>
  </section>;
}

function ProgramTable({rows}:{rows:ProgramRow[]}) {
  return <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
    <h2 className="text-xl font-bold text-[#edcb71]">Ábaco de programación</h2>
    <p className="mt-1 text-sm text-slate-300">
      RENDIMIENTO = cobertura completa. MIXTO = parte por rendimientos y parte por respaldo. PARAMÉTRICO = aún no existe rendimiento aplicable.
    </p>

    <div className="mt-4 overflow-x-auto">
      <table className="min-w-[1500px] w-full text-sm">
        <thead className="bg-[#0b2747]">
          <tr>
            <H>#</H><H>SEC</H><H>EVENTO</H><H>INCIDENCIA</H><H>JORNADAS BASE</H><H>SIN REND.</H><H>CUADRILLAS</H><H>DÍAS</H><H>PREDECESORA</H><H>TRASLAPE</H><H>INICIO</H><H>TÉRMINO</H><H>% ACUM.</H><H>MÉTODO</H>
          </tr>
        </thead>
        <tbody>
          {rows.map(r=><tr key={r.sec} className="border-t border-white/10">
            <D>{r.orden}</D><D>{r.revisar?"REVISAR":r.sec}</D><D>{r.etapa}</D><D>{pct(r.equivalencia)}</D><D>{r.jornadasBase>0?r.jornadasBase.toFixed(2):"—"}</D><D>{r.conceptosSinRendimiento}</D><D>{r.cuadrillas}</D><D>{r.dias}</D><D>{r.predecesora??"Inicio"}</D><D>{pct(r.traslape)}</D><D>{r.inicio}</D><D>{r.termino}</D><D>{pct(r.avance)}</D>
            <D><span className={r.metodoDuracion==="RENDIMIENTO"?"font-bold text-emerald-300":r.metodoDuracion==="MIXTO"?"font-bold text-cyan-300":"font-bold text-amber-300"}>{r.metodoDuracion}</span></D>
          </tr>)}
        </tbody>
      </table>
    </div>
  </section>;
}
