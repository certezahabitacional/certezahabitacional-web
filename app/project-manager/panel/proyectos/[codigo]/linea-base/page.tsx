import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";
import { pr0002 } from "@/lib/project-manager/pr0002";
import { PmHeader, card } from "@/app/project-manager/panel/_components";
import { aprobarLineaBase, generarLineaBase } from "./actions";

function asObj(v:unknown){return (v&&typeof v==="object"&&!Array.isArray(v)?v:{}) as Record<string,unknown>;}
function asRows(v:unknown){return Array.isArray(v)?v as Record<string,unknown>[]:[];}
function money(v:unknown){const n=Number(v??0);return new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0}).format(Number.isFinite(n)?n:0);}

export default async function LineaBasePage({params,searchParams}:{params:Promise<{codigo:string}>;searchParams:Promise<{generada?:string;aprobada?:string;error?:string}>}) {
  const {session,role,readOnly}=await requireProjectManagerAccess();
  const {codigo}=await params;
  const q=await searchParams;
  const code=codigo.toUpperCase();
  const userId=String((session.user as {id?:string}).id ?? "");

  const proyecto=await prisma.proyectoPM.findUnique({
    where:{codigo:code},
    include:{
      participantes:{where:{usuarioId:userId},select:{id:true}},
      constructibilidad:true,
      lineaBase:true,
      registrosModulo:{orderBy:{actualizadoEn:"desc"}},
    },
  });

  const legacy=code==="PR-0002"&&!proyecto;
  if(!proyecto&&!legacy) notFound();
  if(proyecto){
    const ok=role==="DIRECTOR"||role==="ADMINISTRADOR"||proyecto.participantes.length>0;
    if(!ok||!proyecto.activo) notFound();
  } else if(role!=="DIRECTOR"&&role!=="ADMINISTRADOR") notFound();

  const nombre=proyecto?.nombre ?? pr0002.project.name;
  const lb=proyecto?.lineaBase;
  const alcance=asObj(lb?.alcance);
  const presupuesto=asObj(lb?.presupuesto);
  const programa=asObj(lb?.programa);
  const estructura=asObj(lb?.estructuraFisica);
  const contratos=asObj(lb?.contratos);
  const expediente=asObj(lb?.expedienteResumen);
  const liberaciones=asRows(lb?.liberaciones);
  const indicadores=asObj(lb?.indicadoresBase);
  const riesgos=Array.isArray(lb?.riesgosBase)?lb?.riesgosBase.map(String):[];
  const approved=lb?.estado==="APROBADA";
  const costSource=String(presupuesto.fuente??"")==="CERTEZA_COST";
  const costConcepts=asRows(presupuesto.conceptos);
  const costPartidas=asRows(presupuesto.partidas);
  const costBase=Number(presupuesto.totalPresupuesto??asObj(presupuesto.base).montoTotal??presupuesto.montoProyecto??0);

  const economicKeywords=["COST","FINAN","CONTRAT","COMPRA","SUBCONTRAT","ESTIM"];
  const economicRecords=(proyecto?.registrosModulo??[]).filter(r=>economicKeywords.some(k=>r.modulo.toUpperCase().includes(k)));
  const comprometido=economicRecords.reduce((s,r)=>s+Number(r.importePlan||0),0);
  const ejercido=economicRecords.reduce((s,r)=>s+Number(r.importeReal||0),0);
  const progressValues=(proyecto?.registrosModulo??[]).map(r=>{
    const d=asObj(r.datos);
    for(const key of ["avanceFisico","porcentajeAvance","avance"]){
      const n=Number(d[key]);
      if(Number.isFinite(n)&&n>=0&&n<=100) return n;
    }
    return null;
  }).filter((n):n is number=>n!==null);
  const avanceFisicoActual=progressValues.length?Math.round(progressValues.reduce((a,b)=>a+b,0)/progressValues.length):Number(indicadores.avanceFisico??0);
  let forecast:number|null=null;
  for(const r of (proyecto?.registrosModulo??[])){
    const d=asObj(r.datos);
    for(const key of ["proyeccionFinal","forecastCosto","costoFinalPronosticado"]){
      const n=Number(d[key]);
      if(Number.isFinite(n)&&n>0){forecast=n;break;}
    }
    if(forecast!==null) break;
  }
  const proyeccionFinal=forecast??costBase;

  return <main style={{minHeight:"100vh",background:"#eef6fb",color:"#082f64"}}>
    <PmHeader title="Línea Base Definitiva" subtitle={`${code} · ${nombre} · Referencia oficial de alcance, costo, plazo y condiciones de ejecución`}/>
    <section style={{maxWidth:1550,margin:"0 auto",padding:"20px 20px 60px"}}>
      {q.generada&&<div style={{...card,marginBottom:14,background:"#e7f7ee",color:"#187342",fontWeight:900}}>Línea Base generada desde Constructibilidad.</div>}
      {q.aprobada&&<div style={{...card,marginBottom:14,background:"#e7f7ee",color:"#187342",fontWeight:900}}>Línea Base aprobada y congelada como referencia oficial.</div>}
      {q.error&&<div style={{...card,marginBottom:14,background:"#fff2f2",color:"#a52f2f",fontWeight:900}}>No fue posible completar la operación: {q.error.replaceAll("_"," ")}.</div>}
      {readOnly&&<div style={{...card,marginBottom:14,background:"#e8f3fb",fontWeight:900}}>CLIENTE · SÓLO LECTURA</div>}
      {legacy&&<div style={{...card,marginBottom:14,background:"#fff5dd",color:"#8a5b00",fontWeight:800}}>PR-0002 requiere completar su migración antes de usar Línea Base.</div>}

      <div style={{...card,padding:22,border:`2px solid ${approved?"#1f9d55":"#ff8500"}`}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:24,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:12,fontWeight:950,color:approved?"#187342":"#c86100",letterSpacing:".08em"}}>REFERENCIA DE CONTROL DEL PROYECTO</div>
            <h1 style={{margin:"6px 0 8px",fontSize:30}}>{approved?"Línea Base Aprobada":"Línea Base en Preparación"}</h1>
            <p style={{margin:0,color:"#4a657d",lineHeight:1.55,maxWidth:900}}>
              Una vez aprobada, esta versión deja de ser editable como referencia original. Las modificaciones posteriores deberán registrarse mediante cambios autorizados y generar una nueva versión controlada.
            </p>
          </div>
          <div style={{minWidth:220}}>
            <div style={{fontSize:11,fontWeight:900}}>VERSIÓN</div>
            <div style={{fontSize:32,fontWeight:950,marginTop:4}}>V{lb?.version??1}</div>
            <div style={{fontSize:12,fontWeight:900,color:approved?"#187342":"#8a5b00"}}>{lb?.estado??"SIN GENERAR"}</div>
          </div>
        </div>
      </div>

      {!lb && !readOnly && !legacy && <form action={generarLineaBase} style={{marginTop:14}}>
        <input type="hidden" name="codigo" value={code}/>
        <button type="submit" style={{border:0,background:"#ff8500",color:"#fff",fontWeight:950,padding:"13px 20px",borderRadius:10,cursor:"pointer"}}>Generar Línea Base desde Constructibilidad</button>
      </form>}

      {lb && !approved && !readOnly && !legacy && <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}>
        <form action={generarLineaBase}><input type="hidden" name="codigo" value={code}/><button type="submit" style={{border:"1px solid #ff8500",background:"#fff",color:"#c86100",fontWeight:950,padding:"11px 16px",borderRadius:10,cursor:"pointer"}}>Regenerar desde Constructibilidad</button></form>
      </div>}

      {lb && <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10,marginTop:14}}>
        {[
          ["Costo base",money(costBase)],
          ["Inicio",String(asObj(programa.base).fechaInicio??"Por definir")],
          ["Término",String(asObj(programa.base).fechaFin??"Por definir")],
          ["Avance inicial","0%"],
        ].map(([label,value])=><article key={label} style={{...card,padding:15}}>
          <div style={{fontSize:11,fontWeight:900,color:"#61788f"}}>{label}</div>
          <div style={{fontSize:20,fontWeight:950,marginTop:5}}>{value}</div>
        </article>)}
      </div>}

      {lb && <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:14}}>
        <article style={{...card,padding:18}}>
          <h2 style={{marginTop:0}}>Alcance base</h2>
          <div style={{fontSize:12,lineHeight:1.7}}>
            <div><strong>Tipo:</strong> {String(alcance.tipoProyecto??"Por definir")}</div>
            <div><strong>Módulos activos:</strong> {asRows(alcance.modulosActivos).length}</div>
            <div><strong>Observaciones:</strong> {String(alcance.alcanceObservado??"—")}</div>
          </div>
        </article>

        <article style={{...card,padding:18}}>
          <h2 style={{marginTop:0}}>Estructura física de control</h2>
          <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
            {(Array.isArray(estructura.jerarquia)?estructura.jerarquia.map(String):[]).map((x,i)=><span key={i} style={{padding:"7px 9px",borderRadius:8,background:"#eef6fb",border:"1px solid #d8e6f2",fontSize:12,fontWeight:850}}>{x}</span>)}
          </div>
        </article>

        <article style={{...card,padding:18}}>
          <h2 style={{marginTop:0}}>Contratos y estrategia</h2>
          <div style={{fontSize:12,lineHeight:1.7}}>
            <div><strong>Modalidad general:</strong> {String(asObj(contratos.estrategia).modalidadGeneral??"Por definir")}</div>
            <div><strong>Contratación:</strong> {contratos.contratacion?"Configurada":"Pendiente"}</div>
          </div>
        </article>

        <article style={{...card,padding:18}}>
          <h2 style={{marginTop:0}}>Expediente Maestro</h2>
          <div style={{fontSize:12,lineHeight:1.7}}>
            <div><strong>Estado:</strong> {String(expediente.estado??"Por definir")}</div>
            <div><strong>Progreso:</strong> {String(expediente.progreso??0)}%</div>
            <div><strong>Entregables:</strong> {String(expediente.entregables??0)}</div>
          </div>
        </article>
      </div>}

      {lb && costSource && <article style={{...card,marginTop:14,padding:18,border:"2px solid #268c10"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:14,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:11,fontWeight:950,color:"#268c10",letterSpacing:".08em"}}>LÍNEA BASE DE COSTOS · CERTEZA COST</div>
            <h2 style={{margin:"5px 0 4px"}}>Presupuesto económico congelado</h2>
            <div style={{fontSize:12,color:"#4a657d"}}>Versión {String(presupuesto.version??"—")} · {costPartidas.length} partidas · {costConcepts.length} conceptos · fuente única de control económico.</div>
          </div>
          <div style={{fontSize:28,fontWeight:950,color:"#187342"}}>{money(costBase)}</div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:9,marginTop:14}}>
          {[
            ["Línea base",money(costBase)],
            ["Comprometido",money(comprometido)],
            ["Ejercido",money(ejercido)],
            ["Avance físico",avanceFisicoActual+"%"],
            ["Proyección final",money(proyeccionFinal)],
          ].map(([k,v])=><div key={k} style={{border:"1px solid #dbe8da",borderRadius:10,padding:11,background:"#f9fdf8"}}>
            <div style={{fontSize:10,fontWeight:900,color:"#6d836d",textTransform:"uppercase"}}>{k}</div>
            <div style={{fontSize:18,fontWeight:950,marginTop:4}}>{v}</div>
          </div>)}
        </div>
        <div style={{fontSize:11,color:"#718171",marginTop:8}}>
          {forecast===null?"Proyección final: todavía no existe forecast capturado; se muestra la Línea Base como referencia.":"Proyección final obtenida del último forecast económico registrado."}
        </div>

        <div style={{overflowX:"auto",marginTop:16}}>
          <table style={{width:"100%",minWidth:900,borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{background:"#eef7ec",textAlign:"left"}}>
              <th style={{padding:9}}>Partida</th><th style={{padding:9}}>Conceptos</th><th style={{padding:9,textAlign:"right"}}>Importe base</th>
            </tr></thead>
            <tbody>{costPartidas.map((row,i)=>{
              const conceptos=asRows(row.conceptos);
              return <tr key={i} style={{borderTop:"1px solid #e2ebe0"}}>
                <td style={{padding:9,fontWeight:900}}>{String(row.partida??"SIN PARTIDA")}</td>
                <td style={{padding:9}}>{conceptos.length}</td>
                <td style={{padding:9,textAlign:"right",fontWeight:900}}>{money(row.importe)}</td>
              </tr>
            })}</tbody>
          </table>
        </div>
        <details style={{marginTop:12}}>
          <summary style={{cursor:"pointer",fontWeight:900,color:"#187342"}}>Ver detalle de conceptos de la Línea Base</summary>
          <div style={{overflowX:"auto",marginTop:10}}>
            <table style={{width:"100%",minWidth:1100,borderCollapse:"collapse",fontSize:11}}>
              <thead><tr style={{background:"#f2f7f1",textAlign:"left"}}>
                {["Partida","Clave","Descripción","Unidad","Cantidad","P.U.","Importe"].map(x=><th key={x} style={{padding:8}}>{x}</th>)}
              </tr></thead>
              <tbody>{costConcepts.map((row,i)=><tr key={i} style={{borderTop:"1px solid #e5ece3"}}>
                <td style={{padding:8}}>{String(row.partida??"—")}</td>
                <td style={{padding:8,fontWeight:800}}>{String(row.clave??"—")}</td>
                <td style={{padding:8}}>{String(row.descripcion??"")}</td>
                <td style={{padding:8}}>{String(row.unidad??"")}</td>
                <td style={{padding:8,textAlign:"right"}}>{Number(row.cantidad??0).toLocaleString("es-MX",{maximumFractionDigits:3})}</td>
                <td style={{padding:8,textAlign:"right"}}>{money(row.precioUnitario)}</td>
                <td style={{padding:8,textAlign:"right",fontWeight:900}}>{money(row.importe)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </details>
      </article>}

      {lb && <div style={{display:"grid",gridTemplateColumns:"1.1fr .9fr",gap:14,marginTop:14}}>
        <article style={{...card,padding:0,overflow:"hidden"}}>
          <div style={{padding:"14px 16px",fontSize:19,fontWeight:950,borderBottom:"1px solid #d8e6f2"}}>Liberaciones incorporadas a la Línea Base</div>
          <div style={{padding:"0 15px"}}>
            {liberaciones.map((row,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"80px 1fr 110px",gap:10,alignItems:"center",padding:"10px 0",borderBottom:"1px solid #edf2f6"}}>
              <div style={{fontSize:11,fontWeight:950}}>{String(row.id??"")}</div>
              <div style={{fontSize:12,fontWeight:850}}>{String(row.nombre??"")}</div>
              <div style={{fontSize:11,fontWeight:950,textAlign:"right",color:String(row.estado)==="LIBERADO"?"#187342":"#b53030"}}>{String(row.estado??"")}</div>
            </div>)}
          </div>
        </article>

        <article style={{...card,padding:18}}>
          <h2 style={{marginTop:0}}>Indicadores de origen</h2>
          <div style={{fontSize:12,lineHeight:1.8}}>
            <div><strong>Avance físico inicial:</strong> {String(indicadores.avanceFisico??0)}%</div>
            <div><strong>Avance financiero inicial:</strong> {String(indicadores.avanceFinanciero??0)}%</div>
            <div><strong>Costo original:</strong> {money(indicadores.costoOriginal)}</div>
            <div><strong>Constructibilidad:</strong> {String(indicadores.avanceConstructibilidad??0)}%</div>
          </div>
        </article>
      </div>}

      {lb && <article style={{...card,marginTop:14,padding:18}}>
        <h2 style={{marginTop:0}}>Riesgos incorporados a la Línea Base</h2>
        {riesgos.length?<div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>{Array.from(new Set(riesgos)).slice(0,30).map((x,i)=><div key={i} style={{border:"1px solid #f0d1d1",background:"#fff7f7",borderRadius:8,padding:10,fontSize:12,fontWeight:800,color:"#9f2f2f"}}>⚠ {x}</div>)}</div>:<div style={{color:"#187342",fontWeight:850}}>Sin riesgos base registrados.</div>}
      </article>}

      {lb && !approved && !readOnly && !legacy && <form action={aprobarLineaBase} style={{...card,marginTop:16,padding:18,border:"2px solid #1f9d55"}}>
        <input type="hidden" name="codigo" value={code}/>
        <h2 style={{marginTop:0}}>Aprobar Línea Base Definitiva</h2>
        <p style={{fontSize:13,color:"#4a657d",lineHeight:1.5}}>Al aprobar, esta versión queda congelada como referencia oficial. Cualquier modificación posterior deberá manejarse mediante control de cambios.</p>
        <label style={{display:"block",fontSize:12,fontWeight:850}}>Motivo / nota de aprobación<input name="motivo" style={{width:"100%",boxSizing:"border-box",padding:10,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
        <button type="submit" style={{marginTop:12,border:0,background:"#1f9d55",color:"#fff",fontWeight:950,padding:"12px 18px",borderRadius:10,cursor:"pointer"}}>Aprobar y congelar Línea Base</button>
      </form>}

      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad/cierre`} style={{background:"#053f79",color:"#fff",textDecoration:"none",fontWeight:900,padding:"12px 16px",borderRadius:10}}>← Cierre de Constructibilidad</Link>
        <Link href={code==="PR-0002"?"/project-manager/panel/proyectos/pr-0002":`/project-manager/panel/proyectos/${codigo}`} style={{border:"1px solid #b8cad9",color:"#294f73",textDecoration:"none",fontWeight:900,padding:"12px 16px",borderRadius:10}}>Volver al proyecto</Link>
      </div>
    </section>

    <style>{`
      @media(max-width:1000px){div[style*="repeat(5"],div[style*="repeat(4"],div[style*="1fr 1fr"],div[style*="1.1fr .9fr"]{grid-template-columns:1fr 1fr !important;}}
      @media(max-width:700px){div[style*="repeat(5"],div[style*="repeat(4"],div[style*="1fr 1fr"],div[style*="1.1fr .9fr"],div[style*="repeat(2"]{grid-template-columns:1fr !important;}}
    `}</style>
  </main>;
}
