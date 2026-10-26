import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/project-manager/access";
import { agregarHallazgo, agregarRegistroAuditoria, cerrarRegistroSupervision } from "./actions";

type Obj=Record<string,unknown>;
const dm=(v:unknown):Obj=>v&&typeof v==="object"&&!Array.isArray(v)?v as Obj:{};
const money=(v:unknown)=>new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0}).format(Number(v||0));
const dateText=(v:Date|null)=>v?new Intl.DateTimeFormat("es-MX",{year:"numeric",month:"short",day:"2-digit",timeZone:"UTC"}).format(v):"Sin fecha";

const mods=[
  "SUPERVISION_HALLAZGO","SUPERVISION_CALIDAD","AUDITORIA_ESTIMACION","AUDITORIA_COSTOS","AUDITORIA_CONTRACTUAL","AUDITORIA_CIERRE"
];

export default async function SupervisionProyectoPage({params}:{params:Promise<{codigo:string}>}){
  const {codigo}=await params;
  const access=await requireProjectAccess(codigo);
  const p=access.proyecto;
  const registros=await prisma.registroModuloPM.findMany({
    where:{proyectoId:p.id,modulo:{in:mods}},
    orderBy:{creadoEn:"desc"},
  });
  const hallazgos=registros.filter(r=>r.modulo==="SUPERVISION_HALLAZGO");
  const auditorias=registros.filter(r=>r.modulo!=="SUPERVISION_HALLAZGO");
  const abiertos=registros.filter(r=>r.estado!=="CERRADO").length;
  const criticos=hallazgos.filter(r=>String(dm(r.datos).criticidad)==="CRITICA"&&r.estado!=="CERRADO").length;
  const desviacionCosto=auditorias.filter(r=>r.modulo==="AUDITORIA_COSTOS").reduce((a,r)=>a+Number(dm(r.datos).desviacion||0),0);
  const code=p.codigo.toLowerCase();

  return <main style={{minHeight:"100vh",background:"#f6f4fa",color:"#2d2550"}}>
    <header style={{background:"linear-gradient(100deg,#391066,#7728c8)",color:"#fff"}}>
      <div style={{maxWidth:1420,margin:"0 auto",padding:"18px 22px"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
          <Link href="/certeza-tecnica/app/supervision-auditoria" style={{color:"#fff",textDecoration:"none",fontWeight:800}}>← Proyectos</Link>
          <Link href={`/project-manager/panel/proyectos/${code}`} style={{color:"#fff",textDecoration:"none",fontWeight:800}}>Abrir en Project Manager →</Link>
        </div>
        <div style={{marginTop:18}}>
          <div style={{fontSize:13,fontWeight:900,letterSpacing:".1em",opacity:.9}}>{p.codigo} · SUPERVISIÓN Y AUDITORÍA</div>
          <h1 style={{fontSize:"clamp(30px,5vw,48px)",margin:"5px 0 5px"}}>{p.nombre}</h1>
          <div style={{opacity:.9}}>{p.cliente||"Cliente no definido"} · {p.ubicacion||"Ubicación no definida"}</div>
        </div>
      </div>
    </header>

    <div style={{maxWidth:1420,margin:"0 auto",padding:22}}>
      <section style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12}}>
        <Kpi title="Registros abiertos" value={String(abiertos)} detail={registros.length+" totales"}/>
        <Kpi title="Hallazgos críticos" value={String(criticos)} detail={hallazgos.length+" hallazgos"}/>
        <Kpi title="Desviación auditada" value={money(desviacionCosto)} detail="Acumulada en auditoría de costos"/>
        <Kpi title="Presupuesto proyecto" value={money(p.presupuesto)} detail={p.estado}/>
      </section>

      <section style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:16}}>
        <article style={box}>
          <div style={head}><span>1</span><div><b>Nuevo hallazgo</b><small>Supervisión técnica y de calidad</small></div></div>
          <form action={agregarHallazgo} style={{display:"grid",gap:11,marginTop:15}}>
            <input type="hidden" name="codigo" value={p.codigo}/>
            <Field name="titulo" label="Hallazgo" required/>
            <TextArea name="descripcion" label="Descripción"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Field name="area" label="Área / especialidad"/>
              <Field name="ubicacion" label="Ubicación"/>
              <Select name="criticidad" label="Criticidad" options={["BAJA","MEDIA","ALTA","CRITICA"]}/>
              <Field name="responsable" label="Responsable"/>
              <Field name="fechaCompromiso" label="Fecha compromiso" type="date"/>
              <Field name="costoEstimado" label="Costo estimado $" type="number"/>
              <Field name="impactoPlazoDias" label="Impacto plazo (días)" type="number"/>
              <Field name="evidenciaUrl" label="Referencia / evidencia URL"/>
            </div>
            <TextArea name="normaEspecificacion" label="Norma, plano o especificación incumplida"/>
            <TextArea name="recomendacion" label="Acción correctiva recomendada"/>
            {!access.projectReadOnly&&<button style={primary}>Agregar hallazgo</button>}
          </form>
        </article>

        <article style={box}>
          <div style={head}><span>2</span><div><b>Nueva auditoría / control</b><small>Calidad, estimaciones, costos, contrato o cierre</small></div></div>
          <form action={agregarRegistroAuditoria} style={{display:"grid",gap:11,marginTop:15}}>
            <input type="hidden" name="codigo" value={p.codigo}/>
            <Select name="tipo" label="Tipo de revisión" options={["CALIDAD","ESTIMACION","COSTOS","CONTRACTUAL","CIERRE"]}/>
            <Field name="titulo" label="Título de revisión" required/>
            <TextArea name="descripcion" label="Alcance / descripción"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Field name="responsable" label="Responsable"/>
              <Field name="fechaRevision" label="Fecha revisión" type="date"/>
              <Select name="prioridad" label="Prioridad" options={["ALTA","MEDIA","BAJA"]}/>
              <Select name="bloqueante" label="¿Bloqueante?" options={["NO","SI"]}/>
              <Field name="importePlan" label="Importe plan $" type="number"/>
              <Field name="importeReal" label="Importe revisado $" type="number"/>
              <Field name="desviacion" label="Desviación $" type="number"/>
              <Field name="fuenteDocumento" label="Documento fuente"/>
              <Field name="avanceFisico" label="Avance físico %" type="number"/>
              <Field name="avanceFinanciero" label="Avance financiero %" type="number"/>
            </div>
            <TextArea name="referencia" label="Contrato / estimación / documento de referencia"/>
            <TextArea name="criterio" label="Criterio de auditoría"/>
            <TextArea name="resultado" label="Resultado"/>
            <TextArea name="recomendacion" label="Recomendación"/>
            {!access.projectReadOnly&&<button style={primary}>Agregar revisión</button>}
          </form>
        </article>
      </section>

      <section style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:16}}>
        <article style={box}>
          <h2 style={{marginTop:0}}>Hallazgos de supervisión</h2>
          <div style={{display:"grid",gap:10}}>
            {hallazgos.map(r=>{
              const d=dm(r.datos); const crit=String(d.criticidad||"MEDIA");
              const border=crit==="CRITICA"?"#c92a2a":crit==="ALTA"?"#e67700":crit==="MEDIA"?"#e0a800":"#2b8a3e";
              return <div key={r.id} style={{...card,borderLeft:`5px solid ${border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:10}}>
                  <div><b>{r.clave} · {r.titulo}</b><div style={muted}>{r.descripcion||"Sin descripción"}</div></div>
                  <Status state={crit}/>
                </div>
                <div style={meta}>
                  <span>Área: <b>{String(d.area||"—")}</b></span>
                  <span>Ubicación: <b>{String(d.ubicacion||"—")}</b></span>
                  <span>Responsable: <b>{r.responsable||"Sin asignar"}</b></span>
                  <span>Compromiso: <b>{dateText(r.fechaPlan)}</b></span>
                  <span>Costo: <b>{money(r.importePlan)}</b></span>
                  <span>Impacto plazo: <b>{String(d.impactoPlazoDias||0)} días</b></span>
                </div>
                {!access.projectReadOnly&&r.estado!=="CERRADO"&&<CloseForm codigo={p.codigo} id={r.id}/>}
              </div>
            })}
            {hallazgos.length===0&&<Empty text="Todavía no hay hallazgos registrados."/>}
          </div>
        </article>

        <article style={box}>
          <h2 style={{marginTop:0}}>Auditorías y controles</h2>
          <div style={{display:"grid",gap:10}}>
            {auditorias.map(r=>{
              const d=dm(r.datos);
              return <div key={r.id} style={card}>
                <div style={{display:"flex",justifyContent:"space-between",gap:10}}>
                  <div><b>{r.clave} · {r.titulo}</b><div style={muted}>{r.descripcion||"Sin descripción"}</div></div>
                  <Status state={r.estado}/>
                </div>
                <div style={meta}>
                  <span>Tipo: <b>{String(d.tipo||r.modulo)}</b></span>
                  <span>Responsable: <b>{r.responsable||"Sin asignar"}</b></span>
                  <span>Revisión: <b>{dateText(r.fechaPlan)}</b></span>
                  <span>Importe plan: <b>{money(r.importePlan)}</b></span>
                  <span>Importe revisado: <b>{money(r.importeReal)}</b></span>
                  <span>Desviación: <b>{money(d.desviacion)}</b></span>
                </div>
                <div style={{marginTop:8,fontSize:13}}><b>Resultado:</b> {String(d.resultado||"Sin registrar")}</div>
                {!access.projectReadOnly&&r.estado!=="CERRADO"&&<CloseForm codigo={p.codigo} id={r.id}/>}
              </div>
            })}
            {auditorias.length===0&&<Empty text="Todavía no hay auditorías o controles registrados."/>}
          </div>
        </article>
      </section>

      <section style={{...box,marginTop:16,background:"#fbf8ff",borderColor:"#d9c6ef"}}>
        <b>Integración activa:</b> Supervisión y Auditoría ya registra información dentro del mismo ProyectoPM. Estos datos quedan preparados para alimentar reportes ejecutivos, alertas, seguimiento contractual, control físico-financiero y cierre del proyecto.
      </section>
    </div>

    <style>{`
      @media(max-width:900px){
        section[style*="repeat(4"]{grid-template-columns:repeat(2,minmax(0,1fr)) !important}
        section[style*="1fr 1fr"]{grid-template-columns:1fr !important}
      }
      @media(max-width:600px){
        section[style*="repeat(4"]{grid-template-columns:1fr !important}
        div[style*="1fr 1fr"]{grid-template-columns:1fr !important}
      }
    `}</style>
  </main>
}

function Kpi({title,value,detail}:{title:string;value:string;detail:string}){return <article style={{background:"#fff",border:"1px solid #e0d8e9",borderRadius:14,padding:16,boxShadow:"0 4px 14px rgba(51,28,83,.05)"}}><div style={{fontSize:11,fontWeight:900,color:"#85758f",textTransform:"uppercase"}}>{title}</div><div style={{fontSize:28,fontWeight:950,marginTop:6}}>{value}</div><div style={{fontSize:12,color:"#776d82",marginTop:3}}>{detail}</div></article>}
function Field({name,label,type="text",required=false}:{name:string;label:string;type?:string;required?:boolean}){return <label style={labelStyle}><span>{label}</span><input name={name} type={type} required={required} style={input}/></label>}
function TextArea({name,label}:{name:string;label:string}){return <label style={labelStyle}><span>{label}</span><textarea name={name} rows={3} style={{...input,resize:"vertical"}}/></label>}
function Select({name,label,options}:{name:string;label:string;options:string[]}){return <label style={labelStyle}><span>{label}</span><select name={name} style={input}>{options.map(x=><option key={x}>{x}</option>)}</select></label>}
function Status({state}:{state:string}){return <span style={{whiteSpace:"nowrap",fontSize:11,fontWeight:950,background:"#f1ecf6",border:"1px solid #dfd4e9",borderRadius:999,padding:"5px 8px",height:"fit-content"}}>{state}</span>}
function CloseForm({codigo,id}:{codigo:string;id:string}){return <form action={cerrarRegistroSupervision} style={{marginTop:10}}><input type="hidden" name="codigo" value={codigo}/><input type="hidden" name="registroId" value={id}/><button style={small}>Cerrar registro</button></form>}
function Empty({text}:{text:string}){return <div style={{padding:16,border:"1px dashed #d7cee0",borderRadius:12,color:"#786f82"}}>{text}</div>}
const box={background:"#fff",border:"1px solid #e0d8e9",borderRadius:16,padding:20,boxShadow:"0 6px 18px rgba(51,28,83,.055)"} as const;
const head={display:"flex",alignItems:"center",gap:10} as const;
const labelStyle={display:"grid",gap:5,fontSize:12,fontWeight:850,color:"#5a4f67"} as const;
const input={width:"100%",boxSizing:"border-box",border:"1px solid #d7cde0",borderRadius:9,padding:"10px 11px",fontSize:14,color:"#2d2550",background:"#fff"} as const;
const primary={border:0,borderRadius:10,background:"#6f25b8",color:"#fff",padding:"12px 16px",fontWeight:950,cursor:"pointer"} as const;
const small={border:"1px solid #d9cfe2",borderRadius:8,background:"#faf8fc",color:"#4c3563",padding:"7px 10px",fontWeight:850,cursor:"pointer"} as const;
const card={border:"1px solid #e4ddeb",borderRadius:12,padding:13,background:"#fdfcff"} as const;
const muted={fontSize:12,color:"#766b80",marginTop:4,lineHeight:1.5} as const;
const meta={display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:10,fontSize:12,color:"#665b72"} as const;
