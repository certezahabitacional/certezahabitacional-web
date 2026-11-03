"use client";

import { useEffect, useMemo, useState } from "react";
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
  fechaEntrega:string;
};

type ProductionStrategy =
  | "FLUJO_CONTINUO"
  | "TERMINAR_FRENTE"
  | "FECHA_ENTREGA"
  | "RUTA_FISICA"
  | "MIN_DURACION";

type HistoricalCut = {
  fechaCorte:string;
  avanceReal:Record<string,number>;
  resumen?:{
    programado:number;
    real:number;
    variacion:number;
    eventosAtrasados:number;
  };
  actualizadoEn?:string;
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
    {id:1,nombre:"Frente 1",desfase:0,factorEconomico:1,prioridad:1,fechaEntrega:""},
  ]);
  const [resourceCaps, setResourceCaps] = useState<Record<string,number>>({});
  const [resourcePreferredFront, setResourcePreferredFront] = useState<Record<string,number>>({});
  const [strategy, setStrategy] = useState<ProductionStrategy>("FLUJO_CONTINUO");
  const [cutoffDate, setCutoffDate] = useState(new Date().toISOString().slice(0,10));
  const [actualProgress, setActualProgress] = useState<Record<string,number>>({});
  const [projectName, setProjectName] = useState("Proyecto ÁBACO 1");

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
          fechaEntrega:"",
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
                <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
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
                  <Field label="Prioridad / ruta">
                    <input
                      type="number"
                      min={1}
                      step="1"
                      value={front.prioridad}
                      onChange={e=>updateFront(front.id,{prioridad:Math.max(1,Math.round(Number(e.target.value)||1))})}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Fecha objetivo">
                    <input
                      type="date"
                      value={front.fechaEntrega}
                      onChange={e=>updateFront(front.id,{fechaEntrega:e.target.value})}
                      className={inputClass}
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {budget.length ? (
        <section className="rounded-2xl border border-cyan-300/20 bg-cyan-950/20 p-5">
          <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-200">Estrategia de producción</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-[360px_1fr]">
            <select
              value={strategy}
              onChange={e=>setStrategy(e.target.value as ProductionStrategy)}
              className="w-full rounded-lg border border-cyan-300/30 bg-[#0b2747] px-3 py-3 font-bold text-white"
            >
              <option value="FLUJO_CONTINUO">Flujo continuo de cuadrillas</option>
              <option value="TERMINAR_FRENTE">Terminar un frente antes de pasar al siguiente</option>
              <option value="FECHA_ENTREGA">Prioridad por fecha de entrega</option>
              <option value="RUTA_FISICA">Prioridad por ruta física</option>
              <option value="MIN_DURACION">Optimizar duración total</option>
            </select>
            <div className="rounded-xl bg-[#06162a] p-4 text-sm text-slate-300">
              {strategy==="FLUJO_CONTINUO" ? "Mantiene a las cuadrillas trabajando de forma continua, respetando capacidad y frentes preferentes." : null}
              {strategy==="TERMINAR_FRENTE" ? "Da prioridad a completar el frente de mayor prioridad antes de mover recursos al siguiente." : null}
              {strategy==="FECHA_ENTREGA" ? "Atiende primero los frentes con fecha objetivo más próxima." : null}
              {strategy==="RUTA_FISICA" ? "Usa el número de prioridad como orden físico de recorrido de los frentes." : null}
              {strategy==="MIN_DURACION" ? "Favorece actividades disponibles de menor duración para reducir tiempos muertos y buscar un cierre global más corto." : null}
            </div>
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
      {view==="program" ? (
        <ProgramTable
          rows={program}
          fronts={fronts}
          resourceCaps={resourceCaps}
          resourcePreferredFront={resourcePreferredFront}
          strategy={strategy}
          cutoffDate={cutoffDate}
          onCutoffDateChange={setCutoffDate}
          actualProgress={actualProgress}
          onActualProgressChange={(key,value)=>setActualProgress(current=>({...current,[key]:Math.max(0,Math.min(100,value))}))}
          projectName={projectName}
          onProjectNameChange={setProjectName}
          onLoadHistoricalCut={(cut)=>{
            setCutoffDate(cut.fechaCorte);
            setActualProgress(cut.avanceReal);
          }}
        />
      ) : null}
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
  fechaEntrega:string;
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

function plannedProgressAt(row:FrontProgramRow,cutoff:Date){
  if(cutoff.getTime()<row.inicioDate.getTime()) return 0;
  if(cutoff.getTime()>=row.terminoDate.getTime()) return 1;
  const dates=workingDates(row.inicioDate,row.dias);
  const elapsed=dates.filter(date=>date.getTime()<=cutoff.getTime()).length;
  return Math.max(0,Math.min(1,elapsed/Math.max(1,row.dias)));
}

function ProgramTable({
  rows,
  fronts,
  resourceCaps,
  resourcePreferredFront,
  strategy,
  cutoffDate,
  onCutoffDateChange,
  actualProgress,
  onActualProgressChange,
  projectName,
  onProjectNameChange,
  onLoadHistoricalCut,
}:{
  rows:ProgramRow[];
  fronts:Front[];
  resourceCaps:Record<string,number>;
  resourcePreferredFront:Record<string,number>;
  strategy:ProductionStrategy;
  cutoffDate:string;
  onCutoffDateChange:(value:string)=>void;
  actualProgress:Record<string,number>;
  onActualProgressChange:(key:string,value:number)=>void;
  projectName:string;
  onProjectNameChange:(value:string)=>void;
  onLoadHistoricalCut:(cut:HistoricalCut)=>void;
}) {
  const [history, setHistory] = useState<HistoricalCut[]>([]);
  const [historyMessage, setHistoryMessage] = useState("Sin cortes guardados.");
  const historyKey=`certeza-abaco-historico-v1|${norm(projectName)||"PROYECTO"}`;

  useEffect(()=>{
    let cancelled=false;
    const local=(()=>{
      try {
        const raw=window.localStorage.getItem(historyKey);
        return raw ? JSON.parse(raw) as HistoricalCut[] : [];
      } catch {
        return [] as HistoricalCut[];
      }
    })();
    setHistory(local);
    setHistoryMessage(local.length?`${local.length} corte(s) disponible(s) en respaldo local.`:"Sin cortes guardados.");

    async function loadCentralHistory(){
      try {
        const response=await fetch(`/api/certeza-tecnica/abaco/historico?proyecto=${encodeURIComponent(projectName)}`,{cache:"no-store"});
        if(!response.ok) return;
        const data=await response.json() as {cortes?:HistoricalCut[]};
        if(cancelled || !data.cortes?.length) return;
        const merged=new Map<string,HistoricalCut>();
        [...local,...data.cortes].forEach(cut=>merged.set(cut.fechaCorte,cut));
        const cuts=[...merged.values()].sort((a,b)=>b.fechaCorte.localeCompare(a.fechaCorte));
        setHistory(cuts);
        window.localStorage.setItem(historyKey,JSON.stringify(cuts));
        setHistoryMessage(`${cuts.length} corte(s) recuperado(s).`);
      } catch {
        // El respaldo local mantiene operativo el histórico.
      }
    }
    void loadCentralHistory();
    return ()=>{cancelled=true;};
  },[historyKey,projectName]);


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
      fechaEntrega:front.fechaEntrega,
    }))
  );

  const bookings=new Map<string,Map<string,number>>();
  const leveled=new Map<string,FrontProgramRow>();
  const expanded:FrontProgramRow[]=[];

  const ordered=[...requested].sort((a,b)=>{
    if(strategy==="TERMINAR_FRENTE"){
      if(a.prioridadFrente!==b.prioridadFrente) return a.prioridadFrente-b.prioridadFrente;
      if(a.frontId!==b.frontId) return a.frontId-b.frontId;
      return a.orden-b.orden;
    }

    if(strategy==="FECHA_ENTREGA"){
      const da=a.fechaEntrega ? new Date(a.fechaEntrega+"T12:00:00").getTime() : Number.MAX_SAFE_INTEGER;
      const db=b.fechaEntrega ? new Date(b.fechaEntrega+"T12:00:00").getTime() : Number.MAX_SAFE_INTEGER;
      if(da!==db) return da-db;
      if(a.prioridadFrente!==b.prioridadFrente) return a.prioridadFrente-b.prioridadFrente;
    }

    if(strategy==="RUTA_FISICA"){
      if(a.prioridadFrente!==b.prioridadFrente) return a.prioridadFrente-b.prioridadFrente;
      if(a.orden!==b.orden) return a.orden-b.orden;
    }

    if(strategy==="MIN_DURACION"){
      if(a.inicioDate.getTime()!==b.inicioDate.getTime()) return a.inicioDate.getTime()-b.inicioDate.getTime();
      if(a.dias!==b.dias) return a.dias-b.dias;
      if(a.prioridadFrente!==b.prioridadFrente) return a.prioridadFrente-b.prioridadFrente;
    }

    const pref=resourcePreferredFront[a.cuadrilla];
    if(strategy==="FLUJO_CONTINUO" && a.cuadrilla===b.cuadrilla && pref){
      const aPreferred=a.frontId===pref?0:1;
      const bPreferred=b.frontId===pref?0:1;
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

  const cutoff=new Date(cutoffDate+"T12:00:00");
  const totalWeight=expanded.reduce((sum,row)=>sum+row.equivalencia,0) || 1;
  const plannedAtCutoff=expanded.reduce((sum,row)=>sum+(plannedProgressAt(row,cutoff)*row.equivalencia),0)/totalWeight;
  const actualAtCutoff=expanded.reduce((sum,row)=>{
    const key=`${row.frontId}-${row.sec}`;
    return sum+((actualProgress[key]??0)/100)*row.equivalencia;
  },0)/totalWeight;
  const variance=actualAtCutoff-plannedAtCutoff;
  const delayedCount=expanded.filter(row=>{
    const key=`${row.frontId}-${row.sec}`;
    return ((actualProgress[key]??0)/100)+0.0001<plannedProgressAt(row,cutoff);
  }).length;

  const curveCuts=[...history]
    .sort((a,b)=>a.fechaCorte.localeCompare(b.fechaCorte))
    .map(cut=>{
      const cutDate=new Date(cut.fechaCorte+"T12:00:00");
      const planned=expanded.reduce(
        (sum,row)=>sum+(plannedProgressAt(row,cutDate)*row.equivalencia),
        0
      )/totalWeight;
      const actual=expanded.reduce((sum,row)=>{
        const key=`${row.frontId}-${row.sec}`;
        return sum+(((cut.avanceReal?.[key]??0)/100)*row.equivalencia);
      },0)/totalWeight;
      return {
        fechaCorte:cut.fechaCorte,
        planned:Math.max(0,Math.min(1,planned)),
        actual:Math.max(0,Math.min(1,actual)),
        variance:actual-planned,
      };
    });

  const lastCurvePoint=curveCuts[curveCuts.length-1];
  const previousCurvePoint=curveCuts[curveCuts.length-2];
  const trend=
    !lastCurvePoint || !previousCurvePoint
      ? "SIN HISTORIAL SUFICIENTE"
      : lastCurvePoint.variance-previousCurvePoint.variance>0.01
        ? "RECUPERANDO"
        : lastCurvePoint.variance-previousCurvePoint.variance<-0.01
          ? "AUMENTANDO ATRASO"
          : "ESTABLE";

  const trendDelta=
    lastCurvePoint && previousCurvePoint
      ? lastCurvePoint.variance-previousCurvePoint.variance
      : 0;

  async function saveHistoricalCut(){
    const cut:HistoricalCut={
      fechaCorte:cutoffDate,
      avanceReal:{...actualProgress},
      resumen:{
        programado:plannedAtCutoff,
        real:actualAtCutoff,
        variacion:variance,
        eventosAtrasados:delayedCount,
      },
      actualizadoEn:new Date().toISOString(),
    };

    const map=new Map(history.map(item=>[item.fechaCorte,item]));
    map.set(cut.fechaCorte,cut);
    const next=[...map.values()].sort((a,b)=>b.fechaCorte.localeCompare(a.fechaCorte));
    window.localStorage.setItem(historyKey,JSON.stringify(next));
    setHistory(next);

    let centralSaved=false;
    try {
      const response=await fetch("/api/certeza-tecnica/abaco/historico",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          proyecto:projectName.trim()||"Proyecto ÁBACO",
          fechaCorte:cutoffDate,
          avanceReal:actualProgress,
          resumen:cut.resumen,
        }),
      });
      centralSaved=response.ok;
    } catch {
      centralSaved=false;
    }

    setHistoryMessage(
      centralSaved
        ? `Corte ${cutoffDate} guardado en histórico central y respaldo local.`
        : `Corte ${cutoffDate} guardado localmente. La base central no está disponible o requiere sesión autorizada.`
    );
  }

  return <div className="space-y-5">
    {curveCuts.length ? (
      <section className="rounded-2xl border border-cyan-300/20 bg-white/5 p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-200">Control ejecutivo</p>
            <h2 className="mt-2 text-xl font-bold text-[#edcb71]">Curva S · Programado vs. Real</h2>
            <p className="mt-1 text-sm text-slate-300">
              Evolución acumulada del proyecto a partir de los cortes históricos guardados.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <Metric label="Cortes" value={String(curveCuts.length)} />
            <Metric label="Último programado" value={lastCurvePoint?pct(lastCurvePoint.planned):"—"} />
            <Metric label="Último real" value={lastCurvePoint?pct(lastCurvePoint.actual):"—"} />
            <Metric label="Tendencia" value={trend} />
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-[#06162a] p-4">
          <svg viewBox="0 0 1000 360" className="h-auto w-full" role="img" aria-label="Curva S Programado contra Real">
            {[0,0.25,0.5,0.75,1].map(level=>{
              const y=320-level*280;
              return <g key={level}>
                <line x1="70" y1={y} x2="970" y2={y} stroke="currentColor" strokeOpacity="0.12" />
                <text x="12" y={y+5} fill="currentColor" opacity="0.7" fontSize="18">{Math.round(level*100)}%</text>
              </g>;
            })}
            <line x1="70" y1="320" x2="970" y2="320" stroke="currentColor" strokeOpacity="0.3" />
            <line x1="70" y1="40" x2="70" y2="320" stroke="currentColor" strokeOpacity="0.3" />

            {curveCuts.length>1 ? (
              <>
                <polyline
                  fill="none"
                  stroke="#edcb71"
                  strokeWidth="7"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={curveCuts.map((point,index)=>{
                    const x=70+(index/(curveCuts.length-1))*900;
                    const y=320-point.planned*280;
                    return `${x},${y}`;
                  }).join(" ")}
                />
                <polyline
                  fill="none"
                  stroke="#67e8f9"
                  strokeWidth="7"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={curveCuts.map((point,index)=>{
                    const x=70+(index/(curveCuts.length-1))*900;
                    const y=320-point.actual*280;
                    return `${x},${y}`;
                  }).join(" ")}
                />
              </>
            ) : null}

            {curveCuts.map((point,index)=>{
              const x=curveCuts.length===1?520:70+(index/(curveCuts.length-1))*900;
              const py=320-point.planned*280;
              const ay=320-point.actual*280;
              return <g key={point.fechaCorte}>
                <circle cx={x} cy={py} r="7" fill="#edcb71" />
                <circle cx={x} cy={ay} r="7" fill="#67e8f9" />
                <text x={x} y="345" textAnchor="middle" fill="currentColor" opacity="0.7" fontSize="14">
                  {point.fechaCorte.slice(5)}
                </text>
              </g>;
            })}
          </svg>

          <div className="mt-3 flex flex-wrap gap-5 text-xs">
            <span className="font-bold text-[#edcb71]">● PROGRAMADO</span>
            <span className="font-bold text-cyan-300">● REAL</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl bg-[#0b2747] p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Tendencia</p>
            <p className={
              "mt-2 text-xl font-black " +
              (trend==="RECUPERANDO"
                ? "text-emerald-300"
                : trend==="AUMENTANDO ATRASO"
                  ? "text-rose-300"
                  : trend==="ESTABLE"
                    ? "text-amber-300"
                    : "text-slate-300")
            }>{trend}</p>
          </div>
          <div className="rounded-xl bg-[#0b2747] p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Cambio entre últimos cortes</p>
            <p className="mt-2 text-xl font-black text-white">{curveCuts.length>1?pct(trendDelta):"—"}</p>
          </div>
          <div className="rounded-xl bg-[#0b2747] p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Lectura ejecutiva</p>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              {trend==="RECUPERANDO"
                ? "La brecha entre avance real y programado está mejorando respecto al corte anterior."
                : trend==="AUMENTANDO ATRASO"
                  ? "La brecha negativa se está ampliando. Conviene revisar frentes, cuadrillas y SEC con mayor atraso."
                  : trend==="ESTABLE"
                    ? "La brecha se mantiene prácticamente igual. El proyecto no está recuperando ni deteriorándose de forma significativa."
                    : "Guarda por lo menos dos cortes para calcular la tendencia del proyecto."}
            </p>
          </div>
        </div>
      </section>
    ) : null}

    <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-200">Seguimiento de ejecución</p>
          <h2 className="mt-2 text-xl font-bold text-[#edcb71]">Programa vs. Real</h2>
          <p className="mt-1 text-sm text-slate-300">Captura el avance real por frente y SEC. El sistema compara automáticamente contra lo que debería llevarse a la fecha de corte.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Proyecto">
            <input
              value={projectName}
              onChange={e=>onProjectNameChange(e.target.value)}
              className="rounded-lg border border-white/20 bg-[#0b2747] px-3 py-3 text-white"
            />
          </Field>
          <Field label="Fecha de corte">
            <input
              type="date"
              value={cutoffDate}
              onChange={e=>onCutoffDateChange(e.target.value)}
              className="rounded-lg border border-white/20 bg-[#0b2747] px-3 py-3 text-white"
            />
          </Field>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={()=>void saveHistoricalCut()}
          className="rounded-lg bg-[#edcb71] px-4 py-3 text-sm font-black text-[#071d38]"
        >
          GUARDAR CORTE
        </button>
        <span className="text-sm text-slate-300">{historyMessage}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metric label="Programado a corte" value={pct(plannedAtCutoff)} />
        <Metric label="Real a corte" value={pct(actualAtCutoff)} />
        <Metric label="Variación" value={pct(variance)} />
        <Metric label="Eventos atrasados" value={String(delayedCount)} />
        <Metric label="Estado" value={variance>=-0.01?"EN META":"ATRASADO"} />
      </div>

      {history.length ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-[#06162a] p-4">
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#edcb71]">Histórico de cortes</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {history.map(cut=>(
              <button
                key={cut.fechaCorte}
                type="button"
                onClick={()=>onLoadHistoricalCut(cut)}
                className="rounded-lg border border-white/15 bg-[#0b2747] px-3 py-2 text-left text-xs text-white hover:border-[#edcb71]"
              >
                <span className="block font-bold">{cut.fechaCorte}</span>
                <span className="text-slate-400">
                  Real {cut.resumen?pct(cut.resumen.real):"—"} · Var. {cut.resumen?pct(cut.resumen.variacion):"—"}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[1400px] w-full text-sm">
          <thead className="bg-[#0b2747]">
            <tr>
              <H>FRENTE</H><H>SEC</H><H>EVENTO</H><H>INICIO</H><H>TÉRMINO</H><H>PROGRAMADO</H><H>REAL</H><H>VARIACIÓN</H><H>ESTADO</H>
            </tr>
          </thead>
          <tbody>
            {expanded.map(row=>{
              const key=`${row.frontId}-${row.sec}`;
              const planned=plannedProgressAt(row,cutoff);
              const actual=(actualProgress[key]??0)/100;
              const diff=actual-planned;
              const status=diff>=-0.01?"EN META":diff>=-0.1?"ATENCIÓN":"ATRASADO";
              return <tr key={`pv-${key}`} className="border-t border-white/10">
                <D>{row.frontName}</D>
                <D>{row.sec}</D>
                <D>{row.etapa}</D>
                <D>{new Intl.DateTimeFormat("es-MX").format(row.inicioDate)}</D>
                <D>{new Intl.DateTimeFormat("es-MX").format(row.terminoDate)}</D>
                <D>{pct(planned)}</D>
                <D>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={actualProgress[key]??0}
                    onChange={e=>onActualProgressChange(key,Number(e.target.value)||0)}
                    className="w-24 rounded border border-white/20 bg-[#0b2747] px-2 py-2 text-white"
                  />
                  <span className="ml-1 text-slate-400">%</span>
                </D>
                <D>{pct(diff)}</D>
                <D>
                  <span className={
                    status==="EN META"
                      ? "font-bold text-emerald-300"
                      : status==="ATENCIÓN"
                        ? "font-bold text-amber-300"
                        : "font-bold text-rose-300"
                  }>{status}</span>
                </D>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </section>

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
          <Metric label="Estrategia" value={
            strategy==="FLUJO_CONTINUO"?"Flujo continuo":
            strategy==="TERMINAR_FRENTE"?"Terminar frente":
            strategy==="FECHA_ENTREGA"?"Fecha entrega":
            strategy==="RUTA_FISICA"?"Ruta física":
            "Menor duración"
          } />
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

