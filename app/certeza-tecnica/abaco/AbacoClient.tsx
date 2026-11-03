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

type Front = {
  id:number;
  nombre:string;
  desfase:number;
  factorEconomico:number;
  prioridad:number;
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

async function loadCentralRules():Promise<LearnedRule[]>{
  try {
    const response=await fetch("/api/certeza-tecnica/abaco/rendimientos",{cache:"no-store"});
    if(!response.ok) return [];
    const data=await response.json() as {
      rendimientos?:Array<{
        clave:string;
        cuadrilla:string;
        rendimiento:number;
      }>;
    };
    return (data.rendimientos??[]).map(r=>({
      key:r.clave,
      cuadrilla:r.cuadrilla,
      rendimiento:Number(r.rendimiento),
    }));
  } catch {
    return [];
  }
}

function applyRuleSet(rows:BudgetRow[], learned:LearnedRule[], source:string){
  const map=new Map(learned.map(r=>[r.key,r]));
  return rows.map(row=>{
    if(row.rendimiento>0) return row;
    const saved=map.get(ruleKey(row));
    if(!saved) return row;
    return {
      ...row,
      cuadrilla:saved.cuadrilla,
      rendimiento:saved.rendimiento,
      reglaRendimiento:source,
    };
  });
}

async function applyLearnedRules(rows:BudgetRow[]){
  const central=await loadCentralRules();
  const withCentral=applyRuleSet(rows,central,"BIBLIOTECA CENTRAL");
  return applyRuleSet(withCentral,loadLearnedRules(),"APRENDIDO LOCAL");
}

export default function AbacoClient() {
  const [budget, setBudget] = useState<BudgetRow[]>([]);
  const [seq, setSeq] = useState<SeqRow[]>([]);
  const [program, setProgram] = useState<ProgramRow[]>([]);
  const [view, setView] = useState<"none"|"unmatched"|"seq"|"program">("none");
  const [message, setMessage] = useState("Carga un presupuesto para comenzar.");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0,10));
  const [targetDays, setTargetDays] = useState(90);
  const [fronts, setFronts] = useState<Front[]>([
    {id:1,nombre:"Frente 1",desfase:0,factorEconomico:1,prioridad:1},
  ]);
  const [resourceCaps, setResourceCaps] = useState<Record<string,number>>({});
  const [resourcePreferredFront, setResourcePreferredFront] = useState<Record<string,number>>({});

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
      const parsed = await applyLearnedRules(await readBudgetFile(file));
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

  function updateResourceCap(cuadrilla:string,capacidad:number) {
    setResourceCaps(current=>({
      ...current,
      [cuadrilla]:Math.max(1,Math.round(capacidad)||1),
    }));
  }

  function updatePreferredFront(cuadrilla:string,frontId:number) {
    setResourcePreferredFront(current=>({
      ...current,
      [cuadrilla]:frontId,
    }));
  }

  function updateBudgetRow(index:number, patch:Partial<BudgetRow>) {
    setBudget(rows=>rows.map((r,i)=>i===index?{...r,...patch}:r));
    setSeq([]);
    setProgram([]);
  }

  async function saveLearnedRules() {
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

    const centralPayload=budget
      .filter(row=>row.rendimiento>0 && row.cuadrilla.trim())
      .map(row=>({
        clave:ruleKey(row),
        descripcionNormalizada:norm(row.descripcion),
        descripcionEjemplo:row.descripcion,
        unidad:norm(row.unidad)||"SIN UNIDAD",
        cuadrilla:row.cuadrilla.trim(),
        rendimiento:row.rendimiento,
      }));

    let centralSaved=false;
    try {
      const response=await fetch("/api/certeza-tecnica/abaco/rendimientos",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({rendimientos:centralPayload}),
      });
      centralSaved=response.ok;
    } catch {
      centralSaved=false;
    }

    const result=makeSequential(budget);
    setSeq(result);
    setProgram([]);
    setView("seq");
    setMessage(
      centralSaved
        ? "Rendimientos guardados en la biblioteca central y Secuencial recalculado."
        : "Secuencial recalculado. La biblioteca central no respondió; las reglas quedaron respaldadas en este navegador."
    );
  }

  function addFront() {
    setFronts(current=>{
      const nextId=Math.max(0,...current.map(f=>f.id))+1;
      const previous=current[current.length-1];
      return [
        ...current,
        {
          id:nextId,
          nombre:`Frente ${nextId}`,
          desfase:(previous?.desfase??0)+5,
          factorEconomico:1,
          prioridad:nextId,
        },
      ];
    });
  }

  function updateFront(id:number,patch:Partial<Front>) {
    setFronts(current=>current.map(f=>f.id===id?{...f,...patch}:f));
  }

  function removeFront(id:number) {
    setFronts(current=>current.length<=1?current:current.filter(f=>f.id!==id));
  }

  function generateProgram() {
    const base = seq.length ? seq : makeSequential(budget);
    setSeq(base);
    setProgram(makeProgram(base,startDate,targetDays));
    setView("program");
    setMessage(`Ábaco generado para ${fronts.length} frente(s). Cada frente replica el Secuencial con su propio desfase y factor económico.`);
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
            El motor calcula jornadas por concepto usando cantidad ÷ rendimiento. Los rendimientos corregidos se guardan primero en la biblioteca central de Certeza Técnica. Si la base DEV no está disponible, quedan respaldados localmente en este navegador.
          </p>
        </section>
      </div>

      {budget.length ? (
        <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-[#edcb71]">Frentes de producción</p>
              <h2 className="mt-2 text-xl font-bold">Edificios, viviendas, manzanas o lotes</h2>
              <p className="mt-1 text-sm text-slate-300">
                El desfase mueve el arranque del frente en días de trabajo. El factor económico multiplica el valor del presupuesto para ese frente.
              </p>
            </div>
            <button type="button" onClick={addFront} className="rounded-lg bg-[#edcb71] px-4 py-3 text-sm font-black text-[#071d38]">
              + AGREGAR FRENTE
            </button>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {fronts.map(front=>(
              <div key={front.id} className="rounded-xl border border-white/10 bg-[#06162a] p-4">
                <div className="flex items-center justify-between gap-2">
                  <input
                    value={front.nombre}
                    onChange={e=>updateFront(front.id,{nombre:e.target.value})}
                    className="w-full rounded border border-white/20 bg-[#0b2747] px-3 py-2 font-bold text-white"
                  />
                  <button
                    type="button"
                    disabled={fronts.length<=1}
                    onClick={()=>removeFront(front.id)}
                    className="rounded border border-rose-300/30 px-3 py-2 text-xs font-bold text-rose-200 disabled:opacity-30"
                  >
                    Quitar
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <Field label="Desfase (días)">
                    <input
                      type="number"
                      min={0}
                      value={front.desfase}
                      onChange={e=>updateFront(front.id,{desfase:Math.max(0,Number(e.target.value)||0)})}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Factor económico">
                    <input
                      type="number"
                      min={0.01}
                      step="0.01"
                      value={front.factorEconomico}
                      onChange={e=>updateFront(front.id,{factorEconomico:Math.max(0.01,Number(e.target.value)||1)})}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Prioridad">
                    <input
                      type="number"
                      min={1}
                      step="1"
                      value={front.prioridad}
                      onChange={e=>updateFront(front.id,{prioridad:Math.max(1,Math.round(Number(e.target.value)||1))})}
                      className={inputClass}
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {seq.length ? (
        <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#edcb71]">Capacidad de recursos compartidos</p>
            <h2 className="mt-2 text-xl font-bold">Cuadrillas disponibles para todos los frentes</h2>
            <p className="mt-1 text-sm text-slate-300">
              Define cuántas cuadrillas de cada oficio existen realmente. ÁBACO evitará sobreasignarlas entre frentes.
            </p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...new Set(seq.map(r=>r.cuadrilla).filter(Boolean))].map(cuadrilla=>(
              <div key={cuadrilla} className="rounded-xl border border-white/10 bg-[#06162a] p-4">
                <p className="min-h-[40px] text-sm font-bold text-slate-100">{cuadrilla}</p>
                <label className="mt-2 block text-xs font-semibold text-slate-400">
                  Cuadrillas disponibles
                  <input
                    type="number"
                    min={1}
                    step="1"
                    value={resourceCaps[cuadrilla]??1}
                    onChange={e=>updateResourceCap(cuadrilla,Number(e.target.value))}
                    className="mt-1 w-full rounded border border-white/20 bg-[#0b2747] px-3 py-2 text-white"
                  />
                </label>
                <label className="mt-3 block text-xs font-semibold text-slate-400">
                  Frente preferente
                  <select
                    value={resourcePreferredFront[cuadrilla]??""}
                    onChange={e=>updatePreferredFront(cuadrilla,Number(e.target.value)||0)}
                    className="mt-1 w-full rounded border border-white/20 bg-[#0b2747] px-3 py-2 text-white"
                  >
                    <option value="">Usar prioridad general</option>
                    {[...fronts].sort((a,b)=>a.prioridad-b.prioridad).map(front=>(
                      <option key={front.id} value={front.id}>{front.nombre}</option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
      {view==="program" ? <ProgramTable rows={program} fronts={fronts} resourceCaps={resourceCaps} resourcePreferredFront={resourcePreferredFront}/> : null}
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
          Define cuadrilla y rendimiento diario. Al guardar, la regla se envía a la biblioteca central y también queda respaldada localmente.
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

function parseProgramDate(value:string){
  const [day,month,year]=value.split("/").map(Number);
  return new Date(year,month-1,day,12,0,0);
}

function dayKey(date:Date){
  return [
    date.getFullYear(),
    String(date.getMonth()+1).padStart(2,"0"),
    String(date.getDate()).padStart(2,"0"),
  ].join("-");
}

function buildCalendar(rows:ProgramRow[]){
  if(!rows.length) return [] as Date[];
  const starts=rows.map(r=>parseProgramDate(r.inicio).getTime());
  const ends=rows.map(r=>parseProgramDate(r.termino).getTime());
  const start=new Date(Math.min(...starts));
  const end=new Date(Math.max(...ends));
  const days:Date[]=[];
  const cursor=new Date(start);
  while(cursor.getTime()<=end.getTime()){
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate()+1);
  }
  return days;
}

function isActiveOn(row:ProgramRow,date:Date){
  const t=date.getTime();
  return (
    t>=parseProgramDate(row.inicio).getTime() &&
    t<=parseProgramDate(row.termino).getTime() &&
    date.getDay()!==0
  );
}

function shiftProgramDate(value:string,workDays:number){
  const date=parseProgramDate(value);
  let pending=Math.max(0,Math.round(workDays));
  while(pending>0){
    date.setDate(date.getDate()+1);
    if(date.getDay()!==0) pending-=1;
  }
  return date;
}

type FrontProgramRow = ProgramRow & {
  frontId:number;
  frontName:string;
  factorEconomico:number;
  inicioDate:Date;
  terminoDate:Date;
  recursoNivelado:boolean;
  prioridadFrente:number;
};

function addWorkDaysDate(start:Date,days:number){
  const date=new Date(start);
  let pending=Math.max(0,Math.round(days));
  while(pending>0){
    date.setDate(date.getDate()+1);
    if(date.getDay()!==0) pending-=1;
  }
  return date;
}

function workingDates(start:Date,duration:number){
  const dates:Date[]=[];
  const cursor=new Date(start);
  while(dates.length<Math.max(1,duration)){
    if(cursor.getDay()!==0) dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate()+1);
  }
  return dates;
}

function ProgramTable({
  rows,
  fronts,
  resourceCaps,
  resourcePreferredFront,
}:{
  rows:ProgramRow[];
  fronts:Front[];
  resourceCaps:Record<string,number>;
  resourcePreferredFront:Record<string,number>;
}) {
  const requested=fronts.flatMap(front=>
    rows.map(row=>({
      ...row,
      frontId:front.id,
      frontName:front.nombre,
      factorEconomico:front.factorEconomico,
      importe:row.importe*front.factorEconomico,
      equivalencia:row.equivalencia*front.factorEconomico,
      inicioDate:shiftProgramDate(row.inicio,front.desfase),
      terminoDate:shiftProgramDate(row.termino,front.desfase),
      recursoNivelado:false,
      prioridadFrente:front.prioridad,
    }))
  );

  const bookings=new Map<string,Map<string,number>>();
  const leveled=new Map<string,FrontProgramRow>();
  const expanded:FrontProgramRow[]=[];

  const ordered=[...requested].sort((a,b)=>{
    const prefA=resourcePreferredFront[a.cuadrilla];
    const prefB=resourcePreferredFront[b.cuadrilla];
    if(a.cuadrilla===b.cuadrilla && prefA){
      const aPreferred=a.frontId===prefA?0:1;
      const bPreferred=b.frontId===prefA?0:1;
      if(aPreferred!==bPreferred) return aPreferred-bPreferred;
    }
    if(a.inicioDate.getTime()!==b.inicioDate.getTime()){
      return a.inicioDate.getTime()-b.inicioDate.getTime();
    }
    if(a.prioridadFrente!==b.prioridadFrente){
      return a.prioridadFrente-b.prioridadFrente;
    }
    return a.orden-b.orden;
  });

  for(const task of ordered){
    let earliest=new Date(task.inicioDate);

    if(task.predecesora!==null){
      const pred=leveled.get(`${task.frontId}-${task.predecesora}`);
      if(pred){
        const offset=Math.max(1,Math.round(pred.dias*(1-Math.max(0,Math.min(.95,task.traslape)))));
        const predAllowed=addWorkDaysDate(pred.inicioDate,offset);
        if(predAllowed.getTime()>earliest.getTime()) earliest=predAllowed;
      }
    }

    const capacity=Math.max(1,resourceCaps[task.cuadrilla]??1);
    const demand=Math.max(1,Math.min(task.cuadrillas,capacity));
    let candidate=new Date(earliest);
    let safety=0;

    while(safety<2000){
      safety+=1;
      if(candidate.getDay()===0){
        candidate.setDate(candidate.getDate()+1);
        continue;
      }

      const dates=workingDates(candidate,task.dias);
      const crewBookings=bookings.get(task.cuadrilla)??new Map<string,number>();
      const fits=dates.every(date=>(crewBookings.get(dayKey(date))??0)+demand<=capacity);

      if(fits){
        dates.forEach(date=>crewBookings.set(dayKey(date),(crewBookings.get(dayKey(date))??0)+demand));
        bookings.set(task.cuadrilla,crewBookings);
        const leveledTask:FrontProgramRow={
          ...task,
          inicioDate:dates[0],
          terminoDate:dates[dates.length-1],
          recursoNivelado:dayKey(dates[0])!==dayKey(task.inicioDate),
        };
        leveled.set(`${task.frontId}-${task.sec}`,leveledTask);
        expanded.push(leveledTask);
        break;
      }

      candidate=addWorkDaysDate(candidate,1);
    }
  }

  expanded.sort((a,b)=>a.frontId-b.frontId || a.orden-b.orden);

  const normalizedTotal=expanded.reduce((s,r)=>s+r.equivalencia,0);

  const calendar=expanded.length ? (()=>{
    const start=new Date(Math.min(...expanded.map(r=>r.inicioDate.getTime())));
    const end=new Date(Math.max(...expanded.map(r=>r.terminoDate.getTime())));
    const days:Date[]=[];
    const cursor=new Date(start);
    while(cursor.getTime()<=end.getTime()){
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate()+1);
    }
    return days;
  })() : [];

  let cumulativeFlow=0;
  let cumulativeProgress=0;

  const daily=calendar.map(date=>{
    const active=expanded.filter(row=>
      date.getTime()>=row.inicioDate.getTime() &&
      date.getTime()<=row.terminoDate.getTime() &&
      date.getDay()!==0
    );
    const flow=active.reduce((sum,row)=>sum+(row.importe/Math.max(1,row.dias)),0);
    const progressRaw=active.reduce((sum,row)=>sum+(row.equivalencia/Math.max(1,row.dias)),0);
    const progress=normalizedTotal>0?progressRaw/normalizedTotal:0;
    cumulativeFlow+=flow;
    cumulativeProgress+=progress;
    const milestones=expanded
      .filter(row=>dayKey(row.terminoDate)===dayKey(date))
      .map(row=>`${row.frontName}: SEC ${row.sec}`);
    return {
      date,
      flow,
      progress,
      cumulativeFlow,
      cumulativeProgress:Math.min(1,cumulativeProgress),
      milestones,
    };
  });

  return <div className="space-y-5">
    <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#edcb71]">Ábaco gráfico de programación</h2>
          <p className="mt-1 max-w-4xl text-sm text-slate-300">
            Calendario horizontal del proyecto. Cada celda activa representa un día programado del SEC; arriba se calculan flujo, avance y acumulados.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-6">
          <Metric label="Días calendario" value={String(calendar.length)} />
          <Metric label="Frentes" value={String(fronts.length)} />
          <Metric label="Eventos" value={String(expanded.length)} />
          <Metric label="Flujo total" value={money(expanded.reduce((s,r)=>s+r.importe,0))} />
          <Metric label="Ajustes por recursos" value={String(expanded.filter(r=>r.recursoNivelado).length)} />
          <Metric label="Prioridad activa" value="Sí" />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
        <table className="border-collapse text-[11px]">
          <thead>
            <tr className="bg-[#06162a]">
              <th className="sticky left-0 z-30 min-w-[210px] border border-white/10 bg-[#06162a] px-3 py-2 text-left text-[#edcb71]">INDICADOR</th>
              {daily.map(d=><th key={dayKey(d.date)} className="min-w-[62px] border border-white/10 px-1 py-2 text-center text-slate-100">{money(d.flow)}</th>)}
            </tr>
            <tr className="bg-[#06162a]">
              <th className="sticky left-0 z-30 border border-white/10 bg-[#06162a] px-3 py-2 text-left text-[#edcb71]">FLUJO ACUMULADO</th>
              {daily.map(d=><th key={dayKey(d.date)} className="min-w-[62px] border border-white/10 px-1 py-2 text-center text-slate-200">{money(d.cumulativeFlow)}</th>)}
            </tr>
            <tr className="bg-[#0b2747]">
              <th className="sticky left-0 z-30 border border-white/10 bg-[#0b2747] px-3 py-2 text-left text-[#edcb71]">% DIARIO</th>
              {daily.map(d=><th key={dayKey(d.date)} className="min-w-[62px] border border-white/10 px-1 py-2 text-center text-cyan-100">{pct(d.progress)}</th>)}
            </tr>
            <tr className="bg-[#0b2747]">
              <th className="sticky left-0 z-30 border border-white/10 bg-[#0b2747] px-3 py-2 text-left text-[#edcb71]">% ACUMULADO</th>
              {daily.map(d=><th key={dayKey(d.date)} className="min-w-[62px] border border-white/10 px-1 py-2 text-center text-cyan-100">{pct(d.cumulativeProgress)}</th>)}
            </tr>
            <tr className="bg-[#102f52]">
              <th className="sticky left-0 z-30 border border-white/10 bg-[#102f52] px-3 py-2 text-left text-[#edcb71]">HITOS / CHECKPOINTS</th>
              {daily.map(d=><th key={dayKey(d.date)} className="min-w-[62px] border border-white/10 px-1 py-2 text-center text-amber-200">{d.milestones.join(", ")||"—"}</th>)}
            </tr>
            <tr className="bg-[#102f52]">
              <th className="sticky left-0 z-30 border border-white/10 bg-[#102f52] px-3 py-2 text-left text-[#edcb71]">DÍA</th>
              {daily.map((d,index)=><th key={dayKey(d.date)} className="min-w-[62px] border border-white/10 px-1 py-2 text-center text-slate-100">{index+1}</th>)}
            </tr>
            <tr className="bg-[#102f52]">
              <th className="sticky left-0 z-30 border border-white/10 bg-[#102f52] px-3 py-2 text-left text-[#edcb71]">FECHA</th>
              {daily.map(d=><th key={dayKey(d.date)} className="min-w-[62px] border border-white/10 px-1 py-2 text-center text-white">
                <span className="block font-bold">{String(d.date.getDate()).padStart(2,"0")}/{String(d.date.getMonth()+1).padStart(2,"0")}</span>
                <span className={d.date.getDay()===0?"text-rose-300":"text-slate-400"}>{["DOM","LUN","MAR","MIÉ","JUE","VIE","SÁB"][d.date.getDay()]}</span>
              </th>)}
            </tr>
          </thead>
          <tbody>
            {expanded.map(row=><tr key={`${row.frontId}-${row.sec}`}>
              <td className="sticky left-0 z-20 border border-white/10 bg-[#071d38] px-3 py-2">
                <span className="block text-[10px] font-black uppercase tracking-wide text-cyan-200">{row.frontName} · Prioridad {row.prioridadFrente}</span>
                <span className="block font-black text-[#edcb71]">SEC {row.sec}</span>
                <span className="block min-w-[190px] text-slate-200">{row.etapa}</span>
                <span className="mt-1 block text-[10px] text-slate-400">{row.cuadrilla} · {row.dias} día(s)</span>
                {row.recursoNivelado ? <span className="mt-1 block text-[10px] font-bold text-amber-300">AJUSTADO POR RECURSO</span> : null}
              </td>
              {calendar.map(date=>{
                const active=date.getTime()>=row.inicioDate.getTime() && date.getTime()<=row.terminoDate.getTime() && date.getDay()!==0;
                const finish=dayKey(row.terminoDate)===dayKey(date);
                return <td key={dayKey(date)} className={
                  "h-12 min-w-[62px] border border-white/10 text-center " +
                  (active
                    ? "bg-[#edcb71] font-black text-[#071d38]"
                    : date.getDay()===0
                      ? "bg-rose-950/20 text-rose-200"
                      : "bg-white/[0.02] text-slate-600")
                }>
                  {active ? (finish ? `${row.frontName} · S${row.sec} ✓` : `S${row.sec}`) : ""}
                </td>;
              })}
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>

    <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
      <h2 className="text-xl font-bold text-[#edcb71]">Detalle de programación</h2>
      <p className="mt-1 text-sm text-slate-300">
        RENDIMIENTO = cobertura completa. MIXTO = parte por rendimientos y parte por respaldo. PARAMÉTRICO = aún no existe rendimiento aplicable.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[1500px] w-full text-sm">
          <thead className="bg-[#0b2747]">
            <tr>
              <H>FRENTE</H><H>PRIORIDAD</H><H>SEC</H><H>EVENTO</H><H>INCIDENCIA</H><H>JORNADAS BASE</H><H>SIN REND.</H><H>CUADRILLAS</H><H>DÍAS</H><H>PREDECESORA</H><H>TRASLAPE</H><H>INICIO</H><H>TÉRMINO</H><H>NIVELACIÓN</H><H>% ACUM.</H><H>MÉTODO</H>
            </tr>
          </thead>
          <tbody>
            {expanded.map(r=><tr key={`${r.frontId}-${r.sec}`} className="border-t border-white/10">
              <D>{r.frontName}</D><D>{r.prioridadFrente}</D><D>{r.revisar?"REVISAR":r.sec}</D><D>{r.etapa}</D><D>{pct(r.equivalencia)}</D><D>{r.jornadasBase>0?r.jornadasBase.toFixed(2):"—"}</D><D>{r.conceptosSinRendimiento}</D><D>{r.cuadrillas}</D><D>{r.dias}</D><D>{r.predecesora??"Inicio"}</D><D>{pct(r.traslape)}</D><D>{new Intl.DateTimeFormat("es-MX").format(r.inicioDate)}</D><D>{new Intl.DateTimeFormat("es-MX").format(r.terminoDate)}</D><D>{r.recursoNivelado?"AJUSTADO":"SIN AJUSTE"}</D><D>{pct(r.avance)}</D>
              <D><span className={r.metodoDuracion==="RENDIMIENTO"?"font-bold text-emerald-300":r.metodoDuracion==="MIXTO"?"font-bold text-cyan-300":"font-bold text-amber-300"}>{r.metodoDuracion}</span></D>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>
  </div>;
}

