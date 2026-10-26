import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/project-manager/access";

type Obj=Record<string,unknown>;
const dm=(v:unknown):Obj=>v&&typeof v==="object"&&!Array.isArray(v)?v as Obj:{};
const money=(v:unknown)=>new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0}).format(Number(v||0));
const pct=(v:number)=>`${Math.max(0,Math.min(100,Math.round(v)))}%`;

function stateColor(state:string){
  const s=state.toUpperCase();
  if(["ROJO","CRITICA","CRITICO","REQUIERE_DECISION"].includes(s)) return "#c92a2a";
  if(["AMARILLO","ALTA","FAVORABLE_CON_OBSERVACIONES","PENDIENTE","ABIERTO"].includes(s)) return "#e38b0a";
  if(["VERDE","FAVORABLE","COMPLETADA","CERRADO","CERRADA","MITIGADO","APROBADA","APROBADO"].includes(s)) return "#2b8a3e";
  return "#5f7487";
}

export default async function TableroEjecutivoProyecto({params}:{params:Promise<{codigo:string}>}){
  const {codigo}=await params;
  const access=await requireProjectAccess(codigo);
  const p=access.proyecto;

  const [registros,docs,constructibilidad,lineaBase]=await Promise.all([
    prisma.registroModuloPM.findMany({where:{proyectoId:p.id},orderBy:{creadoEn:"desc"}}),
    prisma.documentoMaestroPM.findMany({
      where:{proyectoId:p.id,activo:true},
      include:{actividades:{select:{estado:true}}},
      orderBy:{codigo:"asc"},
    }),
    prisma.constructibilidadPM.findUnique({where:{proyectoId:p.id}}),
    prisma.lineaBasePM.findUnique({where:{proyectoId:p.id}}),
  ]);

  const evaluation=registros.find(r=>r.modulo==="DIRECCION_EVALUACION");
  const evalData=dm(evaluation?.datos);
  const evalScore=Number(evalData.calificacionGlobal||0);

  const decisions=registros.filter(r=>r.modulo==="DIRECCION_DECISION");
  const decisionsOpen=decisions.filter(r=>!["CERRADA","CERRADO"].includes(r.estado)).length;

  const risks=registros.filter(r=>r.modulo==="DIRECCION_RIESGO");
  const activeRisks=risks.filter(r=>r.estado!=="MITIGADO"&&r.estado!=="CERRADO");
  const redRisks=activeRisks.filter(r=>String(dm(r.datos).semaforo)==="ROJO").length;

  const hallazgos=registros.filter(r=>r.modulo==="SUPERVISION_HALLAZGO");
  const hallazgosOpen=hallazgos.filter(r=>r.estado!=="CERRADO").length;
  const hallazgosCritical=hallazgos.filter(r=>String(dm(r.datos).criticidad)==="CRITICA"&&r.estado!=="CERRADO").length;

  const audits=registros.filter(r=>["SUPERVISION_CALIDAD","AUDITORIA_ESTIMACION","AUDITORIA_COSTOS","AUDITORIA_CONTRACTUAL","AUDITORIA_CIERRE"].includes(r.modulo));
  const auditsOpen=audits.filter(r=>r.estado!=="CERRADO").length;
  const auditedDeviation=audits.filter(r=>r.modulo==="AUDITORIA_COSTOS").reduce((a,r)=>a+Number(dm(r.datos).desviacion||0),0);

  const docActivities=docs.flatMap(d=>d.actividades);
  const docComplete=docActivities.filter(a=>["COMPLETADA","CERRADA","CERRADO"].includes(a.estado)).length;
  const docProgress=docActivities.length?Math.round((docComplete/docActivities.length)*100):0;

  const constructSteps=constructibilidad?[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>Number((constructibilidad as unknown as Record<string,unknown>)[`progresoPaso${n}`]||0)):[];
  const constructProgress=constructSteps.length?Math.round(constructSteps.reduce((a,b)=>a+b,0)/constructSteps.length):0;

  const pmOperational=registros.filter(r=>![
    "DIRECCION_EVALUACION","DIRECCION_DECISION","DIRECCION_RIESGO",
    "SUPERVISION_HALLAZGO","SUPERVISION_CALIDAD","AUDITORIA_ESTIMACION",
    "AUDITORIA_COSTOS","AUDITORIA_CONTRACTUAL","AUDITORIA_CIERRE"
  ].includes(r.modulo));
  const pmDone=pmOperational.filter(r=>["COMPLETADA","CERRADO","CERRADA","MITIGADO"].includes(r.estado)).length;
  const pmProgress=pmOperational.length?Math.round((pmDone/pmOperational.length)*100):docProgress;

  const healthParts=[
    evalScore||50,
    Math.max(0,100-decisionsOpen*8),
    Math.max(0,100-redRisks*20),
    Math.max(0,100-hallazgosCritical*15),
    lineaBase?.estado==="APROBADA"||lineaBase?.estado==="APROBADO"?100:lineaBase?70:40,
    Math.max(docProgress,constructProgress),
  ];
  const health=Math.round(healthParts.reduce((a,b)=>a+b,0)/healthParts.length);
  const healthState=health>=80?"VERDE":health>=60?"AMARILLO":"ROJO";

  const alerts=[
    ...(decisions.filter(r=>!["CERRADA","CERRADO"].includes(r.estado)).slice(0,3).map(r=>({type:"DECISIÓN",title:r.titulo,state:r.estado,href:`/certeza-tecnica/app/direccion-desarrollo/${p.codigo.toLowerCase()}`}))),
    ...(activeRisks.filter(r=>String(dm(r.datos).semaforo)==="ROJO").slice(0,3).map(r=>({type:"RIESGO",title:r.titulo,state:"ROJO",href:`/certeza-tecnica/app/direccion-desarrollo/${p.codigo.toLowerCase()}`}))),
    ...(hallazgos.filter(r=>r.estado!=="CERRADO"&&String(dm(r.datos).criticidad)==="CRITICA").slice(0,3).map(r=>({type:"HALLAZGO",title:r.titulo,state:"CRITICA",href:`/certeza-tecnica/app/supervision-auditoria/${p.codigo.toLowerCase()}`}))),
  ].slice(0,6);

  return <main style={{minHeight:"100vh",background:"#eef4f8",color:"#123a5a"}}>
    <header style={{background:"linear-gradient(110deg,#071d38,#0a3b69 65%,#0d5e96)",color:"#fff",borderBottom:"4px solid #edcb71"}}>
      <div style={{maxWidth:1480,margin:"0 auto",padding:"20px 22px"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
          <Link href="/certeza-tecnica/app" style={{color:"#fff",textDecoration:"none",fontWeight:900}}>← Certeza Técnica 360</Link>
          <Link href={`/project-manager/panel/proyectos/${p.codigo.toLowerCase()}`} style={{color:"#fff",textDecoration:"none",fontWeight:900}}>Abrir Project Manager →</Link>
        </div>
        <div style={{marginTop:18}}>
          <div style={{fontSize:12,fontWeight:900,letterSpacing:".12em",color:"#edcb71"}}>TABLERO EJECUTIVO ÚNICO</div>
          <h1 style={{fontSize:"clamp(30px,5vw,50px)",margin:"5px 0"}}>{p.codigo} · {p.nombre}</h1>
          <div style={{color:"#d8e8f4"}}>{p.cliente||"Cliente no definido"} · {p.ubicacion||"Ubicación no definida"}</div>
        </div>
      </div>
    </header>

    <div style={{maxWidth:1480,margin:"0 auto",padding:22}}>
      <section style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:12}}>
        <Kpi title="Salud integral" value={health+"/100"} detail={healthState} color={stateColor(healthState)}/>
        <Kpi title="Presupuesto" value={money(p.presupuesto)} detail={p.estado} color="#0d5e96"/>
        <Kpi title="Línea base" value={lineaBase?.estado||"SIN APROBAR"} detail={lineaBase?`Versión ${lineaBase.version}`:"Pendiente"} color={stateColor(lineaBase?.estado||"PENDIENTE")}/>
        <Kpi title="Documentación" value={pct(docProgress)} detail={`${docComplete}/${docActivities.length} actividades`} color="#0874d9"/>
        <Kpi title="Constructibilidad" value={pct(constructProgress)} detail={constructibilidad?"12 pasos configurables":"Sin iniciar"} color="#d56a17"/>
      </section>

      <section style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:14,marginTop:16}}>
        <AreaCard
          n="1" title="Dirección y Desarrollo" color="#e85a13"
          href={`/certeza-tecnica/app/direccion-desarrollo/${p.codigo.toLowerCase()}`}
          metrics={[
            ["Evaluación",evalScore?evalScore+"%":"Pendiente"],
            ["Decisiones pendientes",String(decisionsOpen)],
            ["Riesgos activos",String(activeRisks.length)],
            ["Riesgos rojos",String(redRisks)],
          ]}
        />
        <AreaCard
          n="2" title="Planeación y Administración" color="#0874d9"
          href={`/project-manager/panel/proyectos/${p.codigo.toLowerCase()}`}
          metrics={[
            ["Avance operativo",pct(pmProgress)],
            ["Línea base",lineaBase?.estado||"Pendiente"],
            ["Documentos maestros",String(docs.length)],
            ["Registros operativos",String(pmOperational.length)],
          ]}
        />
        <AreaCard
          n="3" title="Presupuestos y Costos" color="#268c10"
          href="/certeza-tecnica/presupuestos-costos"
          metrics={[
            ["Presupuesto proyecto",money(p.presupuesto)],
            ["Desviación auditada",money(auditedDeviation)],
            ["Auditorías de costos",String(audits.filter(r=>r.modulo==="AUDITORIA_COSTOS").length)],
            ["Estado",auditedDeviation>0?"Revisar variación":"Sin desviación registrada"],
          ]}
        />
        <AreaCard
          n="4" title="Supervisión y Auditoría" color="#6a22ba"
          href={`/certeza-tecnica/app/supervision-auditoria/${p.codigo.toLowerCase()}`}
          metrics={[
            ["Hallazgos abiertos",String(hallazgosOpen)],
            ["Hallazgos críticos",String(hallazgosCritical)],
            ["Auditorías abiertas",String(auditsOpen)],
            ["Registros totales",String(hallazgos.length+audits.length)],
          ]}
        />
      </section>

      <section style={{display:"grid",gridTemplateColumns:"1.15fr .85fr",gap:16,marginTop:16}}>
        <article style={box}>
          <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
            <div>
              <div style={eyebrow}>ALERTAS EJECUTIVAS</div>
              <h2 style={{margin:"4px 0 0"}}>Asuntos que requieren atención</h2>
            </div>
            <div style={{fontWeight:950,color:stateColor(healthState)}}>{healthState}</div>
          </div>
          <div style={{display:"grid",gap:9,marginTop:14}}>
            {alerts.map((a,i)=><Link key={i} href={a.href} style={{textDecoration:"none",color:"#183d5a",border:"1px solid #dce6ed",borderLeft:`5px solid ${stateColor(a.state)}`,borderRadius:11,padding:12,background:"#fbfdff"}}>
              <div style={{fontSize:11,fontWeight:950,color:stateColor(a.state)}}>{a.type}</div>
              <div style={{fontWeight:900,marginTop:3}}>{a.title}</div>
            </Link>)}
            {alerts.length===0&&<div style={{border:"1px dashed #cfdbe4",borderRadius:11,padding:16,color:"#6b7f91"}}>No hay alertas críticas registradas en este momento.</div>}
          </div>
        </article>

        <article style={box}>
          <div style={eyebrow}>CONTROL INTEGRADO</div>
          <h2 style={{margin:"4px 0 12px"}}>Ruta del proyecto</h2>
          {[
            ["1. Evaluación y estrategia",evalScore?evalScore+"%":"Pendiente",evalScore>=80?"VERDE":evalScore>=60?"AMARILLO":"ROJO"],
            ["2. Constructibilidad",pct(constructProgress),constructProgress>=80?"VERDE":constructProgress>=50?"AMARILLO":"ROJO"],
            ["3. Expediente maestro",pct(docProgress),docProgress>=80?"VERDE":docProgress>=50?"AMARILLO":"ROJO"],
            ["4. Línea base",lineaBase?.estado||"Pendiente",lineaBase?.estado==="APROBADA"||lineaBase?.estado==="APROBADO"?"VERDE":"AMARILLO"],
            ["5. Ejecución y seguimiento",pct(pmProgress),pmProgress>=80?"VERDE":pmProgress>=50?"AMARILLO":"AMARILLO"],
            ["6. Supervisión y cierre",hallazgosOpen+auditsOpen===0?"Sin pendientes":`${hallazgosOpen+auditsOpen} pendientes`,hallazgosCritical?"ROJO":hallazgosOpen+auditsOpen?"AMARILLO":"VERDE"],
          ].map(([label,value,state])=><div key={label} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,padding:"10px 0",borderBottom:"1px solid #edf2f5",alignItems:"center"}}>
            <div style={{fontWeight:800}}>{label}<div style={{fontSize:12,color:"#738697",marginTop:2}}>{value}</div></div>
            <span style={{width:12,height:12,borderRadius:"50%",background:stateColor(state),display:"inline-block"}}/>
          </div>)}
        </article>
      </section>

      <section style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12,marginTop:16}}>
        <Quick href={`/certeza-tecnica/app/direccion-desarrollo/${p.codigo.toLowerCase()}`} title="Dirección y Desarrollo" text="Evaluación, decisiones y riesgos"/>
        <Quick href={`/project-manager/panel/proyectos/${p.codigo.toLowerCase()}/seguimiento`} title="Seguimiento" text="Actualizaciones y control operativo"/>
        <Quick href="/certeza-tecnica/presupuestos-costos" title="Certeza Cost" text="Presupuestos y costos"/>
        <Quick href={`/certeza-tecnica/app/supervision-auditoria/${p.codigo.toLowerCase()}`} title="Supervisión y Auditoría" text="Hallazgos, calidad y auditorías"/>
      </section>
    </div>

    <style>{`
      @media(max-width:1150px){
        section[style*="repeat(5"]{grid-template-columns:repeat(3,minmax(0,1fr)) !important}
        section[style*="repeat(4"]{grid-template-columns:repeat(2,minmax(0,1fr)) !important}
      }
      @media(max-width:800px){
        section[style*="1.15fr .85fr"]{grid-template-columns:1fr !important}
        section[style*="repeat(5"]{grid-template-columns:repeat(2,minmax(0,1fr)) !important}
      }
      @media(max-width:600px){
        section[style*="repeat(5"]{grid-template-columns:1fr !important}
        section[style*="repeat(4"]{grid-template-columns:1fr !important}
      }
    `}</style>
  </main>
}

function Kpi({title,value,detail,color}:{title:string;value:string;detail:string;color:string}){
  return <article style={{background:"#fff",border:"1px solid #d7e3ec",borderTop:`4px solid ${color}`,borderRadius:14,padding:15,boxShadow:"0 4px 14px rgba(17,49,76,.05)"}}>
    <div style={{fontSize:11,fontWeight:900,color:"#7b8e9d",textTransform:"uppercase"}}>{title}</div>
    <div style={{fontSize:24,fontWeight:950,marginTop:6}}>{value}</div>
    <div style={{fontSize:12,color:"#6a7e8f",marginTop:4}}>{detail}</div>
  </article>
}
function AreaCard({n,title,color,href,metrics}:{n:string;title:string;color:string;href:string;metrics:[string,string][]}){
  return <Link href={href} style={{textDecoration:"none",color:"#173c58",background:"#fff",border:"1px solid #d7e3ec",borderRadius:16,overflow:"hidden",boxShadow:"0 6px 18px rgba(17,49,76,.05)"}}>
    <div style={{background:color,color:"#fff",padding:"14px 16px",display:"flex",alignItems:"center",gap:10}}>
      <div style={{fontSize:34,fontWeight:950}}>{n}</div><div style={{fontWeight:950}}>{title}</div>
    </div>
    <div style={{padding:14}}>
      {metrics.map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",gap:10,padding:"7px 0",borderBottom:"1px solid #edf2f5",fontSize:12}}><span style={{color:"#6b8090"}}>{k}</span><b style={{textAlign:"right"}}>{v}</b></div>)}
      <div style={{marginTop:12,fontWeight:950,color}}>Abrir área →</div>
    </div>
  </Link>
}
function Quick({href,title,text}:{href:string;title:string;text:string}){return <Link href={href} style={{...box,textDecoration:"none",color:"#173c58",display:"block"}}><b>{title}</b><div style={{fontSize:12,color:"#6d8190",marginTop:4}}>{text}</div></Link>}
const box={background:"#fff",border:"1px solid #d7e3ec",borderRadius:16,padding:18,boxShadow:"0 6px 18px rgba(17,49,76,.05)"} as const;
const eyebrow={fontSize:11,fontWeight:950,letterSpacing:".09em",color:"#748797"} as const;
