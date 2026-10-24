import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";
import { PmHeader, card } from "@/app/project-manager/panel/_components";
import { generarDocumentosMaestros } from "./actions";
import { sincronizarDocumentosConModulos } from "./sync-actions";
import { buildRecalculationPreview } from "@/lib/project-manager/master-document-recalculation";

export default async function DocumentosMaestrosPage({params,searchParams}:{params:Promise<{codigo:string}>;searchParams:Promise<{generados?:string;sincronizados?:string;seguimientos?:string;error?:string}>}) {
  const {session,role,readOnly}=await requireProjectManagerAccess();
  const {codigo}=await params;
  const q=await searchParams;
  const code=codigo.toUpperCase();
  const userId=String((session.user as {id?:string}).id ?? "");

  const proyecto=await prisma.proyectoPM.findUnique({
    where:{codigo:code},
    include:{
      participantes:{where:{usuarioId:userId},select:{id:true}},
      documentosMaestros:{
        include:{
          actividades:true,
          _count:{select:{actividades:true}}
        },
        orderBy:{codigo:"asc"}
      },
      constructibilidad:true,
      lineaBase:{select:{estado:true,version:true}},
      recalculosDocumentosMaestros:{
        include:{aplicadoPor:{select:{nombre:true}}},
        orderBy:{version:"desc"},
        take:10
      }
    }
  });
  if(!proyecto||!proyecto.activo) notFound();
  const ok=role==="DIRECTOR"||role==="ADMINISTRADOR"||proyecto.participantes.length>0;
  if(!ok) notFound();

  const docs=proyecto.documentosMaestros.filter(d=>d.activo);
  const preview=proyecto.constructibilidad?buildRecalculationPreview(proyecto.constructibilidad,proyecto.documentosMaestros):null;
  const completos=docs.filter(d=>d.estado==="COMPLETO").length;
  const pendientes=docs.filter(d=>d.estado==="PENDIENTE").length;
  const parciales=docs.filter(d=>d.estado==="EN_PROCESO"||d.estado==="PARCIAL").length;
  const lineaBaseAprobada=proyecto.lineaBase?.estado==="APROBADA";
  const historial=proyecto.recalculosDocumentosMaestros;

  return <main style={{minHeight:"100vh",background:"#eef6fb",color:"#082f64"}}>
    <PmHeader title="Documentos Maestros del Proyecto" subtitle={`${code} · ${proyecto.nombre} · Información estructurada que alimentará automáticamente los módulos de CPM`}/>
    <section style={{maxWidth:1450,margin:"0 auto",padding:"22px 20px 60px"}}>
      {q.generados&&<div style={{...card,background:"#e7f7ee",color:"#187342",padding:14,fontWeight:900,marginBottom:14}}>Documentos Maestros generados/actualizados desde Constructibilidad.</div>}
      {q.sincronizados&&<div style={{...card,background:"#e8f3fb",color:"#0b4f87",padding:14,fontWeight:900,marginBottom:14}}>Sincronización operativa completada: {q.sincronizados} registros de módulo y {q.seguimientos||"0"} fichas de seguimiento procesadas.</div>}
      {q.error==="motivo_requerido"&&<div style={{...card,background:"#fdecec",color:"#a52a2a",padding:14,fontWeight:900,marginBottom:14}}>La Línea Base está aprobada. Debes indicar el motivo del recálculo para mantener la trazabilidad del proyecto.</div>}
      {q.error==="sin_constructibilidad"&&<div style={{...card,background:"#fff5dd",color:"#8a5b00",padding:14,fontWeight:900,marginBottom:14}}>Antes de descargar los Documentos Maestros debes configurar la Constructibilidad del proyecto. CPM generará los archivos según esa configuración.</div>}
      {readOnly&&<div style={{...card,background:"#e8f3fb",padding:14,fontWeight:900,marginBottom:14}}>CLIENTE · SÓLO LECTURA</div>}

      <div style={{...card,padding:20,border:"2px solid #ff8500"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:18,flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:12,fontWeight:950,color:"#c86100",letterSpacing:".08em"}}>GENERADOS DESDE CONSTRUCTIBILIDAD</div>
            <h1 style={{margin:"5px 0 7px",fontSize:28}}>Documentos Maestros</h1>
            <p style={{margin:0,color:"#4a657d",lineHeight:1.55,maxWidth:900}}>Cada Documento Maestro contiene la estructura de actividades y datos que alimentará uno o varios módulos. Las actividades también pueden agregarse manualmente cuando la operación lo requiera.</p>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            {proyecto.constructibilidad
              ? <a href={`/api/project-manager/proyectos/${codigo}/documentos-maestros/descargar`} style={{background:"#053f79",color:"#fff",textDecoration:"none",fontWeight:950,padding:"12px 17px",borderRadius:10}}>Descargar todos (.zip)</a>
              : <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad?error=sin_constructibilidad`} style={{background:"#fff5dd",color:"#8a5b00",textDecoration:"none",fontWeight:950,padding:"12px 17px",borderRadius:10,border:"1px solid #f0c36a"}}>Configurar Constructibilidad para descargar</Link>}
            {!readOnly&&<>
            <a href="#preview-recalculo" style={{background:"#fff5dd",color:"#8a5b00",textDecoration:"none",fontWeight:950,padding:"12px 17px",borderRadius:10,border:"1px solid #f0c36a"}}>Ver cambios antes de recalcular</a>
            <form action={generarDocumentosMaestros} style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
              <input type="hidden" name="codigo" value={code}/>
              <input
                name="motivo"
                required={lineaBaseAprobada}
                placeholder={lineaBaseAprobada?"Motivo obligatorio por Línea Base aprobada":"Motivo del recálculo (opcional)"}
                style={{minWidth:280,padding:"11px 12px",border:"1px solid #cbd9e5",borderRadius:9}}
              />
              <button type="submit" style={{border:0,background:"#ff8500",color:"#fff",fontWeight:950,padding:"12px 17px",borderRadius:10,cursor:"pointer"}}>{docs.length?"Recalcular desde Constructibilidad":"Generar Documentos Maestros"}</button>
            </form>
            {docs.length>0&&<form action={sincronizarDocumentosConModulos}>
              <input type="hidden" name="codigo" value={code}/>
              <button type="submit" style={{border:0,background:"#1f9d55",color:"#fff",fontWeight:950,padding:"12px 17px",borderRadius:10,cursor:"pointer"}}>Sincronizar módulos →</button>
            </form>}
            </>}
          </div>
        </div>
      </div>


      {preview&&<div id="preview-recalculo" style={{...card,marginTop:14,padding:18,border:"2px solid #0b73ba"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:14,alignItems:"flex-start",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:11,fontWeight:950,color:"#0b73ba",letterSpacing:".08em"}}>VISTA PREVIA DE RECÁLCULO</div>
            <h2 style={{margin:"5px 0 7px"}}>Impacto de la Constructibilidad vigente</h2>
            <p style={{margin:0,color:"#526c84",maxWidth:900}}>Este análisis no modifica información. Muestra qué Documentos Maestros y actividades cambiarían si aplicas el recálculo.</p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:8,minWidth:520}}>
            {[
              ["DM aplicables",preview.resumen.documentosAplicables],
              ["Actividades esperadas",preview.resumen.actividadesEsperadas],
              ["Cambios detectados",preview.resumen.cambiosTotales],
              ["Protegidas",preview.resumen.protegidas]
            ].map(([k,v])=><div key={String(k)} style={{background:"#f7fbfe",padding:10,borderRadius:8}}><div style={{fontSize:9,color:"#61788f"}}>{k}</div><strong style={{fontSize:20}}>{v}</strong></div>)}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:10,marginTop:14}}>
          <article style={{background:"#e7f7ee",padding:12,borderRadius:9}}>
            <strong>Documentos nuevos / reactivados</strong>
            <div style={{fontSize:11,marginTop:6}}>{[...preview.documentosNuevos,...preview.documentosReactivados].length?[...preview.documentosNuevos,...preview.documentosReactivados].join(", "):"Ninguno"}</div>
          </article>
          <article style={{background:"#fff5dd",padding:12,borderRadius:9}}>
            <strong>Documentos a desactivar</strong>
            <div style={{fontSize:11,marginTop:6}}>{preview.documentosDesactivados.length?preview.documentosDesactivados.join(", "):"Ninguno"}</div>
          </article>
          <article style={{background:"#e8f3fb",padding:12,borderRadius:9}}>
            <strong>Actividades protegidas</strong>
            <div style={{fontSize:11,marginTop:6}}>{preview.actividadesObsoletasProtegidas.length} con ejecución o evidencia; no se eliminarán.</div>
          </article>
        </div>
        <details style={{marginTop:12}}>
          <summary style={{cursor:"pointer",fontWeight:950,color:"#0b73ba"}}>Ver detalle de actividades</summary>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:10}}>
            <article style={{background:"#f7fbfe",padding:12,borderRadius:8}}>
              <strong>Nuevas ({preview.actividadesNuevas.length})</strong>
              {preview.actividadesNuevas.slice(0,30).map(a=><div key={a.documento+a.codigo} style={{fontSize:10,padding:"5px 0",borderBottom:"1px solid #e3ebf1"}}>{a.documento} · {a.codigo} · {a.actividad}</div>)}
            </article>
            <article style={{background:"#f7fbfe",padding:12,borderRadius:8}}>
              <strong>Modificadas ({preview.actividadesModificadas.length})</strong>
              {preview.actividadesModificadas.slice(0,30).map(a=><div key={a.documento+a.codigo} style={{fontSize:10,padding:"5px 0",borderBottom:"1px solid #e3ebf1"}}>{a.documento} · {a.codigo} · {a.cambios.join(", ")}</div>)}
            </article>
            <article style={{background:"#fff5dd",padding:12,borderRadius:8}}>
              <strong>Obsoletas eliminables ({preview.actividadesObsoletasEliminables.length})</strong>
              {preview.actividadesObsoletasEliminables.slice(0,30).map(a=><div key={a.documento+a.codigo} style={{fontSize:10,padding:"5px 0",borderBottom:"1px solid #f4dfad"}}>{a.documento} · {a.codigo} · {a.actividad}</div>)}
            </article>
            <article style={{background:"#fdecec",padding:12,borderRadius:8}}>
              <strong>Protegidas ({preview.actividadesObsoletasProtegidas.length})</strong>
              {preview.actividadesObsoletasProtegidas.slice(0,30).map(a=><div key={a.documento+a.codigo} style={{fontSize:10,padding:"5px 0",borderBottom:"1px solid #f1cccc"}}>{a.documento} · {a.codigo} · {a.actividad}</div>)}
            </article>
          </div>
        </details>
      </div>}


      <div style={{...card,marginTop:14,padding:18}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:11,fontWeight:950,color:"#0b73ba",letterSpacing:".08em"}}>BITÁCORA DE RECÁLCULOS</div>
            <h2 style={{margin:"5px 0"}}>Historial de versiones de Documentos Maestros</h2>
            <p style={{margin:0,color:"#526c84",fontSize:12}}>Cada recálculo conserva el contexto de Constructibilidad y la relación con la Línea Base vigente.</p>
          </div>
          {lineaBaseAprobada&&<span style={{background:"#fff5dd",color:"#8a5b00",fontWeight:950,padding:"8px 11px",borderRadius:999,fontSize:11}}>Línea Base v{proyecto.lineaBase?.version} APROBADA · motivo obligatorio</span>}
        </div>
        {!historial.length?<div style={{marginTop:12,fontSize:12,color:"#60778d"}}>Aún no existen recálculos versionados.</div>:<div style={{overflowX:"auto",marginTop:12}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:900,fontSize:11}}>
            <thead><tr style={{background:"#f2f7fb",textAlign:"left"}}>
              {["Versión","Fecha","Aplicado por","Motivo","Línea Base","Condición"].map(h=><th key={h} style={{padding:9,borderBottom:"1px solid #d8e6f2"}}>{h}</th>)}
            </tr></thead>
            <tbody>{historial.map(h=><tr key={h.id}>
              <td style={{padding:8,borderBottom:"1px solid #edf2f6",fontWeight:950}}>v{h.version}</td>
              <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}>{h.aplicadoEn.toISOString().slice(0,16).replace("T"," ")}</td>
              <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}>{h.aplicadoPor?.nombre||"—"}</td>
              <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}>{h.motivo||"—"}</td>
              <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}>{h.lineaBaseEstado?`${h.lineaBaseEstado} v${h.lineaBaseVersion??"—"}`:"Sin Línea Base"}</td>
              <td style={{padding:8,borderBottom:"1px solid #edf2f6",fontWeight:900,color:h.posteriorLineaBase?"#8a5b00":"#187342"}}>{h.posteriorLineaBase?"Posterior a Línea Base":"Configuración previa"}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10,marginTop:14}}>
        {[
          ["Documentos activos",docs.length],
          ["Completos",completos],
          ["En proceso",parciales],
          ["Pendientes",pendientes],
        ].map(([k,v])=><article key={String(k)} style={{...card,padding:15}}>
          <div style={{fontSize:11,fontWeight:900,color:"#61788f"}}>{k}</div>
          <div style={{fontSize:28,fontWeight:950,marginTop:4}}>{v}</div>
        </article>)}
      </div>

      {!docs.length?<div style={{...card,marginTop:14,padding:24,textAlign:"center"}}>
        <h2 style={{marginTop:0}}>Aún no hay Documentos Maestros</h2>
        <p style={{color:"#526c84"}}>Completa lo necesario en Constructibilidad y genera los documentos aplicables para este proyecto.</p>
      </div>:<div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12,marginTop:14}}>
        {docs.map(d=><Link key={d.id} href={`/project-manager/panel/proyectos/${codigo}/documentos-maestros/${d.codigo.toLowerCase()}`} style={{...card,padding:18,textDecoration:"none",color:"#082f64",display:"block",border:d.codigo==="DM-01"?"2px solid #ff8500":"1px solid #d8e6f2"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
            <div>
              <div style={{fontSize:11,fontWeight:950,color:d.codigo==="DM-01"?"#c86100":"#0b73ba"}}>{d.codigo}</div>
              <h2 style={{margin:"4px 0 6px",fontSize:19}}>{d.nombre}</h2>
              <p style={{margin:0,color:"#526c84",fontSize:12,lineHeight:1.5}}>{d.descripcion}</p>
            </div>
            <span style={{padding:"6px 9px",borderRadius:999,background:d.estado==="COMPLETO"?"#e7f7ee":d.estado==="EN_PROCESO"?"#fff5dd":"#edf2f6",fontSize:10,fontWeight:900}}>{d.estado.replaceAll("_"," ")}</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:14}}>
            <div style={{background:"#f7fbfe",padding:9,borderRadius:8}}>
              <div style={{fontSize:10,color:"#61788f"}}>ACTIVIDADES</div>
              <strong>{d._count.actividades}</strong>
              <div style={{fontSize:9,color:"#61788f",marginTop:2}}>
                {d.actividades.filter(a=>a.origen==="AUTOMATICO").length} automáticas · {d.actividades.filter(a=>a.origen!=="AUTOMATICO").length} manual/importadas
              </div>
            </div>
            <div style={{background:"#f7fbfe",padding:9,borderRadius:8}}><div style={{fontSize:10,color:"#61788f"}}>SEGUIMIENTO</div><strong style={{fontSize:11}}>{d.periodicidadDefault||"Por definir"}</strong></div>
            <div style={{background:"#f7fbfe",padding:9,borderRadius:8}}><div style={{fontSize:10,color:"#61788f"}}>MÓDULO</div><strong style={{fontSize:11}}>{d.moduloPrincipal||"—"}</strong></div>
          </div>
          <div style={{marginTop:12,fontSize:12,fontWeight:950,color:"#0b73ba"}}>Abrir Documento Maestro →</div>
        </Link>)}
      </div>}

      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad`} style={{background:"#053f79",color:"#fff",textDecoration:"none",fontWeight:900,padding:"11px 15px",borderRadius:9}}>← Constructibilidad</Link>
        <Link href={`/project-manager/panel/proyectos/${codigo}/modulos`} style={{background:"#1f9d55",color:"#fff",textDecoration:"none",fontWeight:900,padding:"11px 15px",borderRadius:9}}>Módulos operativos</Link>
        <Link href={`/project-manager/panel/proyectos/${codigo}/seguimiento`} style={{background:"#0b73ba",color:"#fff",textDecoration:"none",fontWeight:900,padding:"11px 15px",borderRadius:9}}>Qué actualizar</Link>
        <Link href={`/project-manager/panel/proyectos/${codigo}`} style={{border:"1px solid #b8cad9",color:"#294f73",textDecoration:"none",fontWeight:900,padding:"11px 15px",borderRadius:9}}>Volver al proyecto</Link>
      </div>
    </section>

    <style>{`
      @media(max-width:900px){div[style*="repeat(4"],div[style*="repeat(2"]{grid-template-columns:1fr 1fr !important;}}
      @media(max-width:620px){div[style*="repeat(4"],div[style*="repeat(2"]{grid-template-columns:1fr !important;}}
    `}</style>
  </main>;
}
