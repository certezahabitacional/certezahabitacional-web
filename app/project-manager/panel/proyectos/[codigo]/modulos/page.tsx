import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";
import { PmHeader, card } from "@/app/project-manager/panel/_components";

export default async function ModulosOperativosPage({params}:{params:Promise<{codigo:string}>}) {
  const {session,role}=await requireProjectManagerAccess();
  const {codigo}=await params;
  const code=codigo.toUpperCase();
  const userId=String((session.user as {id?:string}).id ?? "");
  const proyecto=await prisma.proyectoPM.findUnique({
    where:{codigo:code},
    include:{participantes:{where:{usuarioId:userId},select:{id:true}}}
  });
  if(!proyecto||!proyecto.activo) notFound();
  if(!(role==="DIRECTOR"||role==="ADMINISTRADOR"||proyecto.participantes.length>0)) notFound();

  const registros=await prisma.registroModuloPM.findMany({
    where:{proyectoId:proyecto.id},
    orderBy:[{modulo:"asc"},{fechaPlan:"asc"},{clave:"asc"}]
  });
  const groups=new Map<string,typeof registros>();
  for(const r of registros){
    if(!groups.has(r.modulo)) groups.set(r.modulo,[]);
    groups.get(r.modulo)!.push(r);
  }

  return <main style={{minHeight:"100vh",background:"#eef6fb",color:"#082f64"}}>
    <PmHeader title="Módulos operativos" subtitle={`${code} · Información alimentada desde Documentos Maestros`}/>
    <section style={{maxWidth:1500,margin:"0 auto",padding:"20px 20px 60px"}}>
      {!registros.length?<div style={{...card,padding:24,textAlign:"center"}}>
        <h2 style={{marginTop:0}}>Aún no hay información sincronizada</h2>
        <p style={{color:"#526c84"}}>Genera los Documentos Maestros y ejecuta “Sincronizar módulos” para poblar la operación.</p>
      </div>:<div style={{display:"grid",gap:14}}>
        {[...groups.entries()].map(([modulo,rows])=><article key={modulo} style={{...card,padding:0,overflow:"hidden"}}>
          <div style={{padding:"14px 16px",borderBottom:"1px solid #d8e6f2",display:"flex",justifyContent:"space-between",gap:12}}>
            <h2 style={{margin:0,fontSize:18}}>{modulo}</h2>
            <strong>{rows.length} registros</strong>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:950,fontSize:11}}>
              <thead><tr style={{background:"#f2f7fb",textAlign:"left"}}>
                {["Clave","Actividad","Documento","Responsable","Fecha plan","Entregable","Bloqueante","Estado"].map(h=><th key={h} style={{padding:9,borderBottom:"1px solid #d8e6f2"}}>{h}</th>)}
              </tr></thead>
              <tbody>{rows.map(r=><tr key={r.id}>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6",fontWeight:900}}>{r.clave}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6",fontWeight:850}}>{r.titulo}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}>{r.fuenteDocumento||"—"}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}>{r.responsable||"Por asignar"}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}>{r.fechaPlan?.toISOString().slice(0,10)||"—"}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}>{r.entregable||"—"}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6",fontWeight:900,color:r.bloqueante?"#b53030":"#526c84"}}>{r.bloqueante?"Sí":"No"}</td>
                <td style={{padding:8,borderBottom:"1px solid #edf2f6",fontWeight:900}}>{r.estado}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </article>)}
      </div>}
      <div style={{display:"flex",gap:10,marginTop:16,flexWrap:"wrap"}}>
        <Link href={`/project-manager/panel/proyectos/${codigo}/documentos-maestros`} style={{background:"#053f79",color:"#fff",textDecoration:"none",fontWeight:900,padding:"11px 15px",borderRadius:9}}>← Documentos Maestros</Link>
        <Link href={`/project-manager/panel/proyectos/${codigo}/seguimiento`} style={{background:"#1f9d55",color:"#fff",textDecoration:"none",fontWeight:900,padding:"11px 15px",borderRadius:9}}>Qué actualizar →</Link>
      </div>
    </section>
  </main>;
}
