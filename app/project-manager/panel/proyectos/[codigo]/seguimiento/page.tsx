import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";
import { PmHeader, card } from "@/app/project-manager/panel/_components";
import { registrarSeguimientoUnico } from "./actions";

function statusLabel(date:Date|null, requiere:boolean){
  if(!requiere) return "Sin actualización";
  if(!date) return "Por evento";
  const today=new Date(); today.setHours(0,0,0,0);
  const d=new Date(date); d.setHours(0,0,0,0);
  if(d<today) return "Atrasado";
  if(d.getTime()===today.getTime()) return "Hoy";
  return "Próximo";
}

export default async function SeguimientoPage({params,searchParams}:{params:Promise<{codigo:string}>;searchParams:Promise<{actualizado?:string}>}) {
  const {session,role}=await requireProjectManagerAccess();
  const {codigo}=await params;
  const q=await searchParams;
  const code=codigo.toUpperCase();
  const userId=String((session.user as {id?:string}).id ?? "");
  const proyecto=await prisma.proyectoPM.findUnique({
    where:{codigo:code},
    include:{participantes:{where:{usuarioId:userId},select:{id:true}}}
  });
  if(!proyecto||!proyecto.activo) notFound();
  if(!(role==="DIRECTOR"||role==="ADMINISTRADOR"||proyecto.participantes.length>0)) notFound();

  const rows=await prisma.seguimientoActividadPM.findMany({
    where:{proyectoId:proyecto.id},
    include:{actividadOrigen:{include:{documentoMaestro:{select:{codigo:true,nombre:true}}}}},
    orderBy:[{requiereActualizacion:"desc"},{proximaRevision:"asc"}]
  });

  const hoy=rows.filter(r=>statusLabel(r.proximaRevision,r.requiereActualizacion)==="Hoy").length;
  const atrasadas=rows.filter(r=>statusLabel(r.proximaRevision,r.requiereActualizacion)==="Atrasado").length;
  const evento=rows.filter(r=>statusLabel(r.proximaRevision,r.requiereActualizacion)==="Por evento").length;
  const pendientes=rows.filter(r=>r.requiereActualizacion).length;

  return <main style={{minHeight:"100vh",background:"#eef6fb",color:"#082f64"}}>
    <PmHeader title="Qué actualizar" subtitle={`${code} · Agenda automática según la periodicidad definida en los Documentos Maestros`}/>
    <section style={{maxWidth:1500,margin:"0 auto",padding:"20px 20px 60px"}}>
      {q.actualizado&&<div style={{...card,background:"#e7f7ee",color:"#187342",padding:14,fontWeight:900,marginBottom:14}}>Actualización registrada. Documento Maestro, módulos y agenda quedaron sincronizados.</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10}}>
        {[
          ["Requieren seguimiento",pendientes],
          ["Para hoy",hoy],
          ["Atrasadas",atrasadas],
          ["Por evento",evento]
        ].map(([k,v])=><article key={String(k)} style={{...card,padding:15}}>
          <div style={{fontSize:11,fontWeight:900,color:"#61788f"}}>{k}</div>
          <div style={{fontSize:28,fontWeight:950,marginTop:4}}>{v}</div>
        </article>)}
      </div>

      <div style={{...card,marginTop:14,padding:0,overflow:"hidden"}}>
        <div style={{padding:"14px 16px",fontSize:18,fontWeight:950,borderBottom:"1px solid #d8e6f2"}}>Agenda de seguimiento</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:1100,fontSize:11}}>
            <thead><tr style={{background:"#f2f7fb",textAlign:"left"}}>
              {["Documento","Actividad","Responsable","Periodicidad","Próxima revisión","Situación","Estado","Última revisión","Avance","Actualizar"].map(h=><th key={h} style={{padding:9,borderBottom:"1px solid #d8e6f2"}}>{h}</th>)}
            </tr></thead>
            <tbody>{rows.map(r=>{
              const label=statusLabel(r.proximaRevision,r.requiereActualizacion);
              const color=label==="Atrasado"?"#b53030":label==="Hoy"?"#8a5b00":label==="Sin actualización"?"#60778d":"#187342";
              return <tr key={r.id}>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6",fontWeight:900}}>{r.actividadOrigen.documentoMaestro.codigo}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6",fontWeight:850}}>{r.actividadOrigen.codigo} · {r.actividadOrigen.actividad}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}>{r.responsable||"Por asignar"}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}>{r.periodicidad}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}>{r.proximaRevision?.toISOString().slice(0,10)||"Por evento"}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6",fontWeight:950,color}}>{label}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}>{r.estado}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}>{r.ultimaRevision?.toISOString().slice(0,10)||"—"}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}>{r.porcentajeAvance!=null?`${Number(r.porcentajeAvance)}%`:"—"}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}>
                  <details>
                    <summary style={{cursor:"pointer",fontWeight:950,color:"#0b73ba"}}>Capturar</summary>
                    <form action={registrarSeguimientoUnico} style={{display:"grid",gap:7,minWidth:320,marginTop:8,padding:10,background:"#f7fbfe",border:"1px solid #d8e6f2",borderRadius:9}}>
                      <input type="hidden" name="codigoProyecto" value={code}/>
                      <input type="hidden" name="seguimientoId" value={r.id}/>
                      <label style={{fontSize:10,fontWeight:850}}>Estado
                        <select name="estado" defaultValue={r.estado} style={{width:"100%",marginTop:3,padding:7,border:"1px solid #cbd9e5",borderRadius:7,background:"#fff"}}>
                          <option value="PENDIENTE">Pendiente</option>
                          <option value="EN_PROCESO">En proceso</option>
                          <option value="BLOQUEADO">Bloqueado</option>
                          <option value="COMPLETO">Completo</option>
                        </select>
                      </label>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
                        <label style={{fontSize:10,fontWeight:850}}>Avance %
                          <input type="number" min="0" max="100" step="1" name="porcentajeAvance" defaultValue={r.porcentajeAvance!=null?Number(r.porcentajeAvance):undefined} style={{width:"100%",boxSizing:"border-box",marginTop:3,padding:7,border:"1px solid #cbd9e5",borderRadius:7}}/>
                        </label>
                        <label style={{fontSize:10,fontWeight:850}}>Fecha real
                          <input type="date" name="fechaReal" style={{width:"100%",boxSizing:"border-box",marginTop:3,padding:7,border:"1px solid #cbd9e5",borderRadius:7}}/>
                        </label>
                      </div>
                      <label style={{fontSize:10,fontWeight:850}}>Valor actual
                        <input name="valorActual" defaultValue={r.valorActual??""} placeholder="Ej. Factibilidad aprobada / 125 m³" style={{width:"100%",boxSizing:"border-box",marginTop:3,padding:7,border:"1px solid #cbd9e5",borderRadius:7}}/>
                      </label>
                      <label style={{fontSize:10,fontWeight:850}}>Comentario
                        <textarea name="comentario" defaultValue={r.comentario??""} rows={2} style={{width:"100%",boxSizing:"border-box",marginTop:3,padding:7,border:"1px solid #cbd9e5",borderRadius:7}}/>
                      </label>
                      <label style={{fontSize:10,fontWeight:850}}>Evidencia / liga
                        <input name="evidenciaUrl" defaultValue={r.evidenciaUrl??""} placeholder="URL o referencia documental" style={{width:"100%",boxSizing:"border-box",marginTop:3,padding:7,border:"1px solid #cbd9e5",borderRadius:7}}/>
                      </label>
                      <button type="submit" style={{border:0,background:"#1f9d55",color:"#fff",fontWeight:950,padding:"8px 10px",borderRadius:8,cursor:"pointer"}}>Guardar actualización</button>
                    </form>
                  </details>
                </td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </div>

      <div style={{display:"flex",gap:10,marginTop:16,flexWrap:"wrap"}}>
        <Link href={`/project-manager/panel/proyectos/${codigo}/modulos`} style={{background:"#053f79",color:"#fff",textDecoration:"none",fontWeight:900,padding:"11px 15px",borderRadius:9}}>← Módulos operativos</Link>
        <Link href={`/project-manager/panel/proyectos/${codigo}`} style={{border:"1px solid #b8cad9",color:"#294f73",textDecoration:"none",fontWeight:900,padding:"11px 15px",borderRadius:9}}>Volver al proyecto</Link>
      </div>
    </section>

    <style>{`
      @media(max-width:760px){div[style*="repeat(4"]{grid-template-columns:1fr 1fr !important;}}
      @media(max-width:480px){div[style*="repeat(4"]{grid-template-columns:1fr !important;}}
    `}</style>
  </main>;
}
