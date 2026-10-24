import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";
import { PmHeader, card } from "@/app/project-manager/panel/_components";
import { generarDocumentosMaestros } from "./actions";
import { sincronizarDocumentosConModulos } from "./sync-actions";

export default async function DocumentosMaestrosPage({params,searchParams}:{params:Promise<{codigo:string}>;searchParams:Promise<{generados?:string;sincronizados?:string;seguimientos?:string}>}) {
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
        where:{activo:true},
        include:{_count:{select:{actividades:true}}},
        orderBy:{codigo:"asc"}
      }
    }
  });
  if(!proyecto||!proyecto.activo) notFound();
  const ok=role==="DIRECTOR"||role==="ADMINISTRADOR"||proyecto.participantes.length>0;
  if(!ok) notFound();

  const docs=proyecto.documentosMaestros;
  const completos=docs.filter(d=>d.estado==="COMPLETO").length;
  const pendientes=docs.filter(d=>d.estado==="PENDIENTE").length;
  const parciales=docs.filter(d=>d.estado==="EN_PROCESO"||d.estado==="PARCIAL").length;

  return <main style={{minHeight:"100vh",background:"#eef6fb",color:"#082f64"}}>
    <PmHeader title="Documentos Maestros del Proyecto" subtitle={`${code} · ${proyecto.nombre} · Información estructurada que alimentará automáticamente los módulos de CPM`}/>
    <section style={{maxWidth:1450,margin:"0 auto",padding:"22px 20px 60px"}}>
      {q.generados&&<div style={{...card,background:"#e7f7ee",color:"#187342",padding:14,fontWeight:900,marginBottom:14}}>Documentos Maestros generados/actualizados desde Constructibilidad.</div>}
      {q.sincronizados&&<div style={{...card,background:"#e8f3fb",color:"#0b4f87",padding:14,fontWeight:900,marginBottom:14}}>Sincronización operativa completada: {q.sincronizados} registros de módulo y {q.seguimientos||"0"} fichas de seguimiento procesadas.</div>}
      {readOnly&&<div style={{...card,background:"#e8f3fb",padding:14,fontWeight:900,marginBottom:14}}>CLIENTE · SÓLO LECTURA</div>}

      <div style={{...card,padding:20,border:"2px solid #ff8500"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:18,flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:12,fontWeight:950,color:"#c86100",letterSpacing:".08em"}}>GENERADOS DESDE CONSTRUCTIBILIDAD</div>
            <h1 style={{margin:"5px 0 7px",fontSize:28}}>Documentos Maestros</h1>
            <p style={{margin:0,color:"#4a657d",lineHeight:1.55,maxWidth:900}}>Cada Documento Maestro contiene la estructura de actividades y datos que alimentará uno o varios módulos. Las actividades también pueden agregarse manualmente cuando la operación lo requiera.</p>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            <a href={`/api/project-manager/proyectos/${codigo}/documentos-maestros/descargar`} style={{background:"#053f79",color:"#fff",textDecoration:"none",fontWeight:950,padding:"12px 17px",borderRadius:10}}>Descargar todos (.zip)</a>
            {!readOnly&&<>
            <form action={generarDocumentosMaestros}>
              <input type="hidden" name="codigo" value={code}/>
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
            <div style={{background:"#f7fbfe",padding:9,borderRadius:8}}><div style={{fontSize:10,color:"#61788f"}}>ACTIVIDADES</div><strong>{d._count.actividades}</strong></div>
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
