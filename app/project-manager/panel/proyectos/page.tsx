import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";
import { pr0002, money } from "@/lib/project-manager/pr0002";
import { PmHeader, card } from "@/app/project-manager/panel/_components";

function fmtDate(value: Date | null) {
  if (!value) return "Por definir";
  return new Intl.DateTimeFormat("es-MX",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(value);
}

export default async function ProjectsPage() {
  const { session, role, readOnly } = await requireProjectManagerAccess();
  const userId=String((session.user as {id?:string}).id ?? "");
  const puedeCrear=role==="DIRECTOR";

  const proyectos=await prisma.proyectoPM.findMany({
    where: role==="DIRECTOR" || role==="ADMINISTRADOR"
      ? {activo:true}
      : {activo:true,participantes:{some:{usuarioId:userId}}},
    orderBy:{creadoEn:"desc"},
  });

  const mostrarLegacy=role==="DIRECTOR" || role==="ADMINISTRADOR";

  return (
    <main style={{minHeight:"100vh",background:"#eef6fb",color:"#082f64"}}>
      <PmHeader title="Proyectos" subtitle="Selecciona un proyecto para abrir su Centro de Control y sus módulos."/>
      <section style={{maxWidth:1450,margin:"0 auto",padding:"24px 22px 60px"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"center",flexWrap:"wrap",marginBottom:18}}>
          <div>
            <h2 style={{margin:"0 0 5px"}}>Portafolio disponible</h2>
            <p style={{margin:0,color:"#294f73",fontWeight:600}}>
              Ningún proyecto se abre automáticamente. Debes seleccionarlo desde esta pantalla.
            </p>
          </div>
          {puedeCrear && <Link href="/project-manager/panel/proyectos/nuevo" style={{background:"#ff8500",color:"#fff",textDecoration:"none",fontWeight:950,padding:"12px 18px",borderRadius:10}}>+ Nuevo proyecto</Link>}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(340px,1fr))",gap:16}}>
          {mostrarLegacy && <article style={{...card,padding:22}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:14}}>
              <div>
                <div style={{color:"#c86100",fontWeight:950,fontSize:13}}>PR-0002 · PROYECTO DE PRUEBA</div>
                <h3 style={{fontSize:22,margin:"6px 0"}}>{pr0002.project.name}</h3>
                <p style={{margin:0,color:"#294f73",lineHeight:1.5}}>{pr0002.project.client}<br/>{pr0002.project.location}</p>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:11,color:"#294f73",fontWeight:800}}>PRESUPUESTO</div>
                <strong>{money(pr0002.project.budget)}</strong>
              </div>
            </div>
            <div style={{marginTop:16,padding:12,borderRadius:10,background:"#eaf4fb",color:"#294f73",fontSize:13,fontWeight:650}}>
              Este proyecto se conserva como expediente de demostración. Sólo se abre cuando lo seleccionas.
            </div>
            <Link href="/project-manager/panel/proyectos/pr-0002" style={{display:"inline-block",marginTop:16,background:"#053f79",color:"#fff",textDecoration:"none",fontWeight:900,padding:"11px 15px",borderRadius:9}}>Abrir proyecto →</Link>
          </article>}

          {proyectos.map(p=><article key={p.id} style={{...card,padding:22}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:14}}>
              <div>
                <div style={{color:"#c86100",fontWeight:950,fontSize:13}}>{p.codigo}</div>
                <h3 style={{fontSize:22,margin:"6px 0"}}>{p.nombre}</h3>
                <p style={{margin:0,color:"#294f73",lineHeight:1.5}}>{p.cliente || "Cliente por definir"}<br/>{p.ubicacion || "Ubicación por definir"}</p>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:11,color:"#294f73",fontWeight:800}}>ESTADO</div>
                <strong>{p.estado}</strong>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:16,fontSize:12}}>
              <div><b>Inicio:</b><br/>{fmtDate(p.fechaInicio)}</div>
              <div><b>Fin plan:</b><br/>{fmtDate(p.fechaFinPlan)}</div>
            </div>
            <Link href={`/project-manager/panel/proyectos/${p.codigo.toLowerCase()}`} style={{display:"inline-block",marginTop:16,background:"#053f79",color:"#fff",textDecoration:"none",fontWeight:900,padding:"11px 15px",borderRadius:9}}>Abrir proyecto →</Link>
          </article>)}

          {!mostrarLegacy && proyectos.length===0 && <div style={{...card,padding:28,gridColumn:"1/-1",textAlign:"center"}}>
            <div style={{fontSize:38}}>📁</div>
            <h3>No tienes proyectos asignados</h3>
            <p style={{color:"#294f73"}}>Cuando el Director te asigne a un proyecto, aparecerá aquí.</p>
          </div>}
        </div>

        {readOnly && <div style={{...card,marginTop:18,background:"#f5faff"}}>
          <strong>CLIENTE · SÓLO LECTURA</strong>
          <p style={{marginBottom:0,color:"#294f73"}}>Sólo aparecen proyectos donde tienes acceso autorizado.</p>
        </div>}
      </section>
    </main>
  );
}
