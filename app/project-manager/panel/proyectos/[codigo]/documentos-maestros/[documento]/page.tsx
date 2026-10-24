import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";
import { PmHeader, card } from "@/app/project-manager/panel/_components";
import { agregarActividadManual } from "../actions";
import { ImportadorDocumentoMaestro } from "./importador";

export default async function DocumentoMaestroDetallePage({params,searchParams}:{params:Promise<{codigo:string;documento:string}>;searchParams:Promise<{agregada?:string}>}) {
  const {session,role,readOnly}=await requireProjectManagerAccess();
  const {codigo,documento}=await params;
  const q=await searchParams;
  const code=codigo.toUpperCase();
  const docCode=documento.toUpperCase();
  const userId=String((session.user as {id?:string}).id ?? "");

  const proyecto=await prisma.proyectoPM.findUnique({
    where:{codigo:code},
    include:{participantes:{where:{usuarioId:userId},select:{id:true}}}
  });
  if(!proyecto||!proyecto.activo) notFound();
  const ok=role==="DIRECTOR"||role==="ADMINISTRADOR"||proyecto.participantes.length>0;
  if(!ok) notFound();

  const doc=await prisma.documentoMaestroPM.findUnique({
    where:{proyectoId_codigo:{proyectoId:proyecto.id,codigo:docCode}},
    include:{actividades:{orderBy:[{fechaInicioPlan:"asc"},{codigo:"asc"}]}}
  });
  if(!doc||!doc.activo) notFound();

  const total=doc.actividades.length;
  const completas=doc.actividades.filter(a=>a.estado==="COMPLETO").length;
  const bloqueantes=doc.actividades.filter(a=>a.bloqueante&&a.estado!=="COMPLETO").length;
  const pct=total?Math.round((completas/total)*100):0;

  return <main style={{minHeight:"100vh",background:"#eef6fb",color:"#082f64"}}>
    <PmHeader title={`${doc.codigo} · ${doc.nombre}`} subtitle={`${code} · ${proyecto.nombre} · Documento Maestro operativo`}/>
    <section style={{maxWidth:1600,margin:"0 auto",padding:"20px 20px 60px"}}>
      {q.agregada&&<div style={{...card,background:"#e7f7ee",color:"#187342",padding:14,fontWeight:900,marginBottom:14}}>Actividad manual agregada correctamente.</div>}
      {readOnly&&<div style={{...card,background:"#e8f3fb",padding:14,fontWeight:900,marginBottom:14}}>CLIENTE · SÓLO LECTURA</div>}

      <div style={{...card,padding:20,border:doc.codigo==="DM-01"?"2px solid #ff8500":"1px solid #d8e6f2"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:18,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:12,fontWeight:950,color:"#c86100"}}>{doc.codigo}</div>
            <h1 style={{margin:"4px 0 7px",fontSize:28}}>{doc.nombre}</h1>
            <p style={{margin:0,color:"#4a657d",lineHeight:1.55,maxWidth:950}}>{doc.descripcion}</p>
          </div>
          <div style={{minWidth:220}}>
            <div style={{fontSize:11,fontWeight:900}}>AVANCE DEL DOCUMENTO</div>
            <div style={{height:12,borderRadius:99,background:"#e3ebf1",overflow:"hidden",marginTop:7}}><div style={{height:"100%",width:`${pct}%`,background:pct>=85?"#1f9d55":pct>=50?"#e6a700":"#d63c3c"}}/></div>
            <div style={{fontSize:26,fontWeight:950,marginTop:4}}>{pct}%</div>
            <div style={{fontSize:11,fontWeight:850,color:"#61788f"}}>{total} actividades · {bloqueantes} bloqueantes pendientes</div>
          </div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr .45fr",gap:14,marginTop:14}}>
        <article style={{...card,padding:0,overflow:"hidden"}}>
          <div style={{padding:"14px 16px",fontWeight:950,fontSize:18,borderBottom:"1px solid #d8e6f2"}}>Programa de actividades</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:1200}}>
              <thead><tr style={{background:"#f2f7fb",textAlign:"left"}}>
                {["ID","Actividad","Tipo","Etapa","Dependencia","Responsable","Inicio plan","Fin plan","Entregable","Periodicidad","Bloqueante","Origen","Estado"].map(h=><th key={h} style={{padding:9,borderBottom:"1px solid #d8e6f2"}}>{h}</th>)}
              </tr></thead>
              <tbody>{doc.actividades.map(a=><tr key={a.id}>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6",fontWeight:900}}>{a.codigo}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6",fontWeight:850,minWidth:220}}>{a.actividad}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}>{a.tipo||"—"}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}>{a.etapa||"—"}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}>{a.dependencia||"—"}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}>{a.responsable||"Por asignar"}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}>{a.fechaInicioPlan?.toISOString().slice(0,10)||"—"}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}>{a.fechaFinPlan?.toISOString().slice(0,10)||"—"}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}>{a.entregable||"—"}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}>{a.periodicidad||doc.periodicidadDefault||"—"}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6",fontWeight:900,color:a.bloqueante?"#b53030":"#526c84"}}>{a.bloqueante?"Sí":"No"}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}>{a.origen}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6",fontWeight:900}}>{a.estado}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </article>

        <aside style={{display:"grid",gap:12,alignContent:"start"}}>
          <div style={{...card,padding:16}}>
            <h3 style={{marginTop:0}}>Alimenta automáticamente</h3>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {(Array.isArray(doc.modulosDestino)?doc.modulosDestino.map(String):[]).map(x=><span key={x} style={{padding:"6px 8px",borderRadius:999,background:"#e8f2ff",fontSize:10,fontWeight:900}}>{x}</span>)}
            </div>
          </div>

          {!readOnly&&<ImportadorDocumentoMaestro codigoProyecto={code} documentoId={doc.id} documentoCodigo={doc.codigo}/>}
          {!readOnly&&<form action={agregarActividadManual} style={{...card,padding:16}}>
            <input type="hidden" name="codigoProyecto" value={code}/>
            <input type="hidden" name="documentoId" value={doc.id}/>
            <h3 style={{marginTop:0}}>+ Agregar actividad manual</h3>
            <label style={{display:"block",fontSize:11,fontWeight:850}}>Código opcional<input name="codigoActividad" placeholder="Se genera automáticamente" style={{width:"100%",boxSizing:"border-box",padding:8,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            <label style={{display:"block",fontSize:11,fontWeight:850,marginTop:8}}>Actividad<input name="actividad" required style={{width:"100%",boxSizing:"border-box",padding:8,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            <label style={{display:"block",fontSize:11,fontWeight:850,marginTop:8}}>Descripción<input name="descripcion" style={{width:"100%",boxSizing:"border-box",padding:8,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
              <label style={{fontSize:11,fontWeight:850}}>Tipo<input name="tipo" defaultValue="ACTIVIDAD" style={{width:"100%",boxSizing:"border-box",padding:8,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
              <label style={{fontSize:11,fontWeight:850}}>Prioridad<select name="prioridad" defaultValue="MEDIA" style={{width:"100%",padding:8,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8,background:"#fff"}}><option value="ALTA">Alta</option><option value="MEDIA">Media</option><option value="BAJA">Baja</option></select></label>
            </div>
            <label style={{display:"block",fontSize:11,fontWeight:850,marginTop:8}}>Responsable<input name="responsable" style={{width:"100%",boxSizing:"border-box",padding:8,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            <label style={{display:"block",fontSize:11,fontWeight:850,marginTop:8}}>Autoridad / organismo<input name="organismo" style={{width:"100%",boxSizing:"border-box",padding:8,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
              <label style={{fontSize:11,fontWeight:850}}>Inicio<input type="date" name="fechaInicioPlan" style={{width:"100%",boxSizing:"border-box",padding:8,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
              <label style={{fontSize:11,fontWeight:850}}>Fin<input type="date" name="fechaFinPlan" style={{width:"100%",boxSizing:"border-box",padding:8,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            </div>
            <label style={{display:"block",fontSize:11,fontWeight:850,marginTop:8}}>Entregable<input name="entregable" style={{width:"100%",boxSizing:"border-box",padding:8,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            <label style={{display:"block",fontSize:11,fontWeight:850,marginTop:8}}>Periodicidad<select name="periodicidad" defaultValue={doc.periodicidadDefault||"SEMANAL"} style={{width:"100%",padding:8,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8,background:"#fff"}}><option value="DIARIA">Diaria</option><option value="SEMANAL">Semanal</option><option value="QUINCENAL">Quincenal</option><option value="MENSUAL">Mensual</option><option value="POR_EVENTO">Por evento</option><option value="POR_ESTIMACION">Por estimación</option><option value="UNA_VEZ">Una sola vez</option></select></label>
            <label style={{display:"block",fontSize:11,fontWeight:850,marginTop:8}}>Regla de alerta<input name="reglaAlerta" placeholder="Ej. 7 días sin avance" style={{width:"100%",boxSizing:"border-box",padding:8,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            <label style={{display:"flex",gap:8,alignItems:"center",fontSize:11,fontWeight:850,marginTop:9}}><input type="checkbox" name="bloqueante"/> Actividad bloqueante</label>
            <button type="submit" style={{marginTop:12,border:0,background:"#ff8500",color:"#fff",fontWeight:950,padding:"10px 13px",borderRadius:9,cursor:"pointer"}}>Agregar actividad</button>
          </form>}
        </aside>
      </div>

      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}>
        <Link href={`/project-manager/panel/proyectos/${codigo}/documentos-maestros`} style={{background:"#053f79",color:"#fff",textDecoration:"none",fontWeight:900,padding:"11px 15px",borderRadius:9}}>← Documentos Maestros</Link>
        <Link href={`/project-manager/panel/proyectos/${codigo}`} style={{border:"1px solid #b8cad9",color:"#294f73",textDecoration:"none",fontWeight:900,padding:"11px 15px",borderRadius:9}}>Volver al proyecto</Link>
      </div>
    </section>

    <style>{`
      @media(max-width:1100px){div[style*="1fr .45fr"]{grid-template-columns:1fr !important;}}
      @media(max-width:600px){div[style*="1fr 1fr"]{grid-template-columns:1fr !important;}}
    `}</style>
  </main>;
}
