import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/project-manager/access";
import { agregarDecisionDireccion, agregarRiesgoDireccion, actualizarEstadoDireccion, guardarEvaluacionDireccion } from "./actions";

type DataMap=Record<string,unknown>;
function dataMap(value:unknown):DataMap{
  return value && typeof value==="object" && !Array.isArray(value) ? value as DataMap : {};
}
function money(value:unknown){
  const n=Number(value ?? 0);
  return new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0}).format(Number.isFinite(n)?n:0);
}
function dateText(value:Date|null){
  if(!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX",{year:"numeric",month:"short",day:"2-digit",timeZone:"UTC"}).format(value);
}

export default async function DireccionProyectoPage({params}:{params:Promise<{codigo:string}>}){
  const {codigo}=await params;
  const access=await requireProjectAccess(codigo);
  const p=access.proyecto;

  const registros=await prisma.registroModuloPM.findMany({
    where:{proyectoId:p.id,modulo:{in:["DIRECCION_EVALUACION","DIRECCION_DECISION","DIRECCION_RIESGO"]}},
    orderBy:{creadoEn:"desc"},
  });
  const evaluacion=registros.find(r=>r.modulo==="DIRECCION_EVALUACION") ?? null;
  const decisiones=registros.filter(r=>r.modulo==="DIRECCION_DECISION");
  const riesgos=registros.filter(r=>r.modulo==="DIRECCION_RIESGO");
  const evalData=dataMap(evaluacion?.datos);
  const score=Number(evalData.calificacionGlobal ?? 0);
  const riskRed=riesgos.filter(r=>dataMap(r.datos).semaforo==="ROJO" && r.estado!=="MITIGADO").length;
  const pending=decisiones.filter(r=>r.estado!=="CERRADA").length;
  const code=p.codigo.toLowerCase();

  return <main style={{minHeight:"100vh",background:"#f3f6f8",color:"#183653"}}>
    <header style={{background:"linear-gradient(100deg,#7d200d,#e85a13)",color:"#fff"}}>
      <div style={{maxWidth:1420,margin:"0 auto",padding:"18px 22px"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:16,flexWrap:"wrap",alignItems:"center"}}>
          <Link href="/certeza-tecnica/app/direccion-desarrollo" style={{color:"#fff",textDecoration:"none",fontWeight:800}}>← Proyectos</Link>
          <Link href={`/project-manager/panel/proyectos/${code}`} style={{color:"#fff",textDecoration:"none",fontWeight:800}}>Abrir en Project Manager →</Link>
        </div>
        <div style={{marginTop:18}}>
          <div style={{fontSize:13,fontWeight:900,letterSpacing:".1em",opacity:.9}}>{p.codigo} · DIRECCIÓN Y DESARROLLO</div>
          <h1 style={{fontSize:"clamp(30px,5vw,48px)",margin:"5px 0 5px"}}>{p.nombre}</h1>
          <div style={{opacity:.9}}>{p.cliente || "Cliente no definido"} · {p.ubicacion || "Ubicación no definida"}</div>
        </div>
      </div>
    </header>

    <div style={{maxWidth:1420,margin:"0 auto",padding:22}}>
      <section style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12}}>
        <Kpi title="Evaluación global" value={score?score+"%":"Pendiente"} detail={evaluacion?.estado ?? "Sin dictamen"} />
        <Kpi title="Decisiones pendientes" value={String(pending)} detail={decisiones.length+" registradas"} />
        <Kpi title="Riesgos críticos" value={String(riskRed)} detail={riesgos.length+" riesgos registrados"} />
        <Kpi title="Presupuesto del proyecto" value={money(p.presupuesto)} detail={p.estado} />
      </section>

      <section style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:16}}>
        <article style={box}>
          <div style={sectionHead}><span>1</span><div><b>Evaluación técnico-económica</b><small>Dictamen directivo del proyecto</small></div></div>
          <form action={guardarEvaluacionDireccion} style={{display:"grid",gap:12,marginTop:16}}>
            <input type="hidden" name="codigo" value={p.codigo}/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
              <ScoreInput name="viabilidadTecnica" label="Viabilidad técnica %" value={evalData.viabilidadTecnica}/>
              <ScoreInput name="viabilidadEconomica" label="Viabilidad económica %" value={evalData.viabilidadEconomica}/>
              <ScoreInput name="viabilidadDocumental" label="Viabilidad documental %" value={evalData.viabilidadDocumental}/>
              <ScoreInput name="viabilidadOperativa" label="Viabilidad operativa %" value={evalData.viabilidadOperativa}/>
            </div>
            <Field name="responsable" label="Responsable" defaultValue={evaluacion?.responsable ?? ""}/>
            <TextArea name="conclusion" label="Conclusión" defaultValue={evaluacion?.descripcion ?? ""}/>
            <TextArea name="recomendacion" label="Recomendación directiva" defaultValue={String(evalData.recomendacion ?? "")}/>
            <TextArea name="supuestos" label="Supuestos principales" defaultValue={String(evalData.supuestos ?? "")}/>
            <TextArea name="observaciones" label="Observaciones" defaultValue={String(evalData.observaciones ?? "")}/>
            {!access.projectReadOnly && <button style={primaryBtn}>Guardar evaluación</button>}
          </form>
        </article>

        <article style={box}>
          <div style={sectionHead}><span>2</span><div><b>Registrar decisión</b><small>Libro de decisiones del proyecto</small></div></div>
          <form action={agregarDecisionDireccion} style={{display:"grid",gap:12,marginTop:16}}>
            <input type="hidden" name="codigo" value={p.codigo}/>
            <Field name="titulo" label="Decisión requerida" required/>
            <TextArea name="descripcion" label="Contexto / problema"/>
            <Field name="responsable" label="Responsable"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Field name="fechaLimite" label="Fecha límite" type="date"/>
              <Select name="prioridad" label="Prioridad" options={["ALTA","MEDIA","BAJA"]}/>
              <Field name="impactoCosto" label="Impacto estimado $" type="number"/>
              <Field name="impactoPlazoDias" label="Impacto plazo (días)" type="number"/>
            </div>
            <Select name="bloqueante" label="¿Bloquea el proyecto?" options={["NO","SI"]}/>
            <TextArea name="alternativaRecomendada" label="Alternativa recomendada"/>
            <TextArea name="justificacion" label="Justificación"/>
            {!access.projectReadOnly && <button style={primaryBtn}>Agregar decisión</button>}
          </form>
        </article>
      </section>

      <section style={{...box,marginTop:16}}>
        <div style={sectionHead}><span>3</span><div><b>Gestión de riesgos directivos</b><small>Probabilidad × impacto, respuesta y responsable</small></div></div>
        <form action={agregarRiesgoDireccion} style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10,marginTop:16}}>
          <input type="hidden" name="codigo" value={p.codigo}/>
          <div style={{gridColumn:"span 2"}}><Field name="titulo" label="Riesgo" required/></div>
          <Field name="responsable" label="Responsable"/>
          <Field name="fechaRevision" label="Próxima revisión" type="date"/>
          <div style={{gridColumn:"span 2"}}><TextArea name="descripcion" label="Descripción / causa"/></div>
          <Select name="probabilidad" label="Probabilidad (1-5)" options={["1","2","3","4","5"]}/>
          <Select name="impacto" label="Impacto (1-5)" options={["1","2","3","4","5"]}/>
          <div style={{gridColumn:"span 2"}}><TextArea name="respuesta" label="Respuesta / mitigación"/></div>
          <TextArea name="disparador" label="Disparador / señal de alerta"/>
          <Field name="exposicionCosto" label="Exposición económica $" type="number"/>
          <Field name="impactoPlazoDias" label="Impacto plazo (días)" type="number"/>
          {!access.projectReadOnly && <button style={{...primaryBtn,alignSelf:"end"}}>Agregar riesgo</button>}
        </form>
      </section>

      <section style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:16}}>
        <article style={box}>
          <h2 style={{marginTop:0}}>Libro de decisiones</h2>
          <div style={{display:"grid",gap:10}}>
            {decisiones.map(d=>{
              const data=dataMap(d.datos);
              return <div key={d.id} style={recordCard}>
                <div style={{display:"flex",justifyContent:"space-between",gap:10}}>
                  <div><b>{d.clave} · {d.titulo}</b><div style={muted}>{d.descripcion || "Sin descripción"}</div></div>
                  <Status state={d.estado}/>
                </div>
                <div style={metaGrid}>
                  <span>Responsable: <b>{d.responsable || "Sin asignar"}</b></span>
                  <span>Fecha límite: <b>{dateText(d.fechaPlan)}</b></span>
                  <span>Impacto costo: <b>{money(d.importePlan)}</b></span>
                  <span>Impacto plazo: <b>{String(data.impactoPlazoDias ?? 0)} días</b></span>
                </div>
                {!access.projectReadOnly && d.estado!=="CERRADA" && <form action={actualizarEstadoDireccion} style={{marginTop:10}}>
                  <input type="hidden" name="codigo" value={p.codigo}/><input type="hidden" name="registroId" value={d.id}/><input type="hidden" name="estado" value="CERRADA"/>
                  <button style={smallBtn}>Marcar cerrada</button>
                </form>}
              </div>
            })}
            {decisiones.length===0 && <Empty text="Todavía no hay decisiones registradas."/>}
          </div>
        </article>

        <article style={box}>
          <h2 style={{marginTop:0}}>Matriz de riesgos</h2>
          <div style={{display:"grid",gap:10}}>
            {riesgos.map(r=>{
              const data=dataMap(r.datos);
              const sem=String(data.semaforo ?? "VERDE");
              return <div key={r.id} style={{...recordCard,borderLeft:`5px solid ${sem==="ROJO"?"#d62828":sem==="AMARILLO"?"#e49b0f":"#2f9e44"}`}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:10}}>
                  <div><b>{r.clave} · {r.titulo}</b><div style={muted}>{r.descripcion || "Sin descripción"}</div></div>
                  <Status state={String(data.semaforo ?? r.estado)}/>
                </div>
                <div style={metaGrid}>
                  <span>P × I: <b>{String(data.probabilidad ?? "-")} × {String(data.impacto ?? "-")} = {String(data.nivel ?? "-")}</b></span>
                  <span>Responsable: <b>{r.responsable || "Sin asignar"}</b></span>
                  <span>Exposición: <b>{money(r.importePlan)}</b></span>
                  <span>Revisión: <b>{dateText(r.fechaPlan)}</b></span>
                </div>
                <div style={{marginTop:8,fontSize:13}}><b>Respuesta:</b> {String(data.respuesta ?? "Sin definir")}</div>
                {!access.projectReadOnly && r.estado!=="MITIGADO" && <form action={actualizarEstadoDireccion} style={{marginTop:10}}>
                  <input type="hidden" name="codigo" value={p.codigo}/><input type="hidden" name="registroId" value={r.id}/><input type="hidden" name="estado" value="MITIGADO"/>
                  <button style={smallBtn}>Marcar mitigado</button>
                </form>}
              </div>
            })}
            {riesgos.length===0 && <Empty text="Todavía no hay riesgos directivos registrados."/>}
          </div>
        </article>
      </section>

      <section style={{...box,marginTop:16,background:"#fff9f3",borderColor:"#efc8ad"}}>
        <b>Integración activa:</b> estos registros pertenecen al mismo ProyectoPM y quedan vinculados al Expediente Maestro de Dirección y Desarrollo. En las siguientes fases alimentarán automáticamente reportes ejecutivos, alertas e Inteligencia Certeza.
      </section>
    </div>

    <style>{`
      @media(max-width:900px){
        section[style*="repeat(4"]{grid-template-columns:repeat(2,minmax(0,1fr)) !important}
        section[style*="1fr 1fr"]{grid-template-columns:1fr !important}
        form[style*="repeat(4"]{grid-template-columns:1fr 1fr !important}
      }
      @media(max-width:600px){
        section[style*="repeat(4"]{grid-template-columns:1fr !important}
        form[style*="repeat(4"]{grid-template-columns:1fr !important}
        div[style*="grid-column:span 2"]{grid-column:span 1 !important}
      }
    `}</style>
  </main>
}

function Kpi({title,value,detail}:{title:string;value:string;detail:string}){
  return <article style={{background:"#fff",border:"1px solid #dae5ed",borderRadius:14,padding:16,boxShadow:"0 4px 14px rgba(17,49,76,.05)"}}><div style={{fontSize:11,fontWeight:900,color:"#7a8c9b",textTransform:"uppercase"}}>{title}</div><div style={{fontSize:28,fontWeight:950,marginTop:6}}>{value}</div><div style={{fontSize:12,color:"#6b7f90",marginTop:3}}>{detail}</div></article>
}
function Field({name,label,type="text",defaultValue="",required=false}:{name:string;label:string;type?:string;defaultValue?:string;required?:boolean}){
  return <label style={labelStyle}><span>{label}</span><input name={name} type={type} defaultValue={defaultValue} required={required} style={inputStyle}/></label>
}
function ScoreInput({name,label,value}:{name:string;label:string;value:unknown}){
  return <label style={labelStyle}><span>{label}</span><input name={name} type="number" min="0" max="100" defaultValue={value===undefined?"":String(value)} style={inputStyle}/></label>
}
function TextArea({name,label,defaultValue=""}:{name:string;label:string;defaultValue?:string}){
  return <label style={labelStyle}><span>{label}</span><textarea name={name} defaultValue={defaultValue} rows={3} style={{...inputStyle,resize:"vertical"}}/></label>
}
function Select({name,label,options}:{name:string;label:string;options:string[]}){
  return <label style={labelStyle}><span>{label}</span><select name={name} style={inputStyle}>{options.map(x=><option key={x}>{x}</option>)}</select></label>
}
function Status({state}:{state:string}){
  return <span style={{whiteSpace:"nowrap",fontSize:11,fontWeight:950,background:"#edf3f7",border:"1px solid #d9e4eb",borderRadius:999,padding:"5px 8px",height:"fit-content"}}>{state}</span>
}
function Empty({text}:{text:string}){return <div style={{padding:16,border:"1px dashed #cbd8e1",borderRadius:12,color:"#718697"}}>{text}</div>}

const box={background:"#fff",border:"1px solid #d9e4ec",borderRadius:16,padding:20,boxShadow:"0 6px 18px rgba(17,49,76,.055)"} as const;
const sectionHead={display:"flex",alignItems:"center",gap:10} as const;
const labelStyle={display:"grid",gap:5,fontSize:12,fontWeight:850,color:"#425f78"} as const;
const inputStyle={width:"100%",boxSizing:"border-box",border:"1px solid #cfdce5",borderRadius:9,padding:"10px 11px",fontSize:14,color:"#183653",background:"#fff"} as const;
const primaryBtn={border:0,borderRadius:10,background:"#d95c18",color:"#fff",padding:"12px 16px",fontWeight:950,cursor:"pointer"} as const;
const smallBtn={border:"1px solid #cbd8e1",borderRadius:8,background:"#f8fbfd",color:"#284e6b",padding:"7px 10px",fontWeight:850,cursor:"pointer"} as const;
const recordCard={border:"1px solid #dfe8ee",borderRadius:12,padding:13,background:"#fbfdfe"} as const;
const muted={fontSize:12,color:"#6e8292",marginTop:4,lineHeight:1.5} as const;
const metaGrid={display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:10,fontSize:12,color:"#587087"} as const;
