import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";

export default async function SupervisionAuditoriaPage(){
  const access=await requireProjectManagerAccess();
  const where={
    activo:true,
    OR:[
      {participantes:{some:{usuarioId:access.userId}}},
      {creadoPorId:access.userId},
    ],
  };

  const proyectos=await prisma.proyectoPM.findMany({
    where,
    orderBy:{actualizadoEn:"desc"},
    select:{codigo:true,nombre:true,cliente:true,ubicacion:true,estado:true,presupuesto:true},
  });

  return <main style={{minHeight:"100vh",background:"#f7f5fb",color:"#2d2550"}}>
    <header style={{background:"linear-gradient(100deg,#3f1476,#7728c8)",color:"#fff",padding:"22px"}}>
      <div style={{maxWidth:1300,margin:"0 auto"}}>
        <Link href="/certeza-tecnica/app" style={{color:"#fff",textDecoration:"none",fontWeight:800}}>← Certeza Técnica 360</Link>
        <h1 style={{fontSize:"clamp(30px,5vw,48px)",margin:"12px 0 4px"}}>Supervisión y Auditoría</h1>
        <p style={{margin:0,fontSize:18}}>Hallazgos, calidad, auditorías y cierre conectados al mismo proyecto.</p>
      </div>
    </header>
    <div style={{maxWidth:1300,margin:"0 auto",padding:22}}>
      <section style={{background:"#fff",border:"1px solid #e0d8e9",borderRadius:16,padding:20,boxShadow:"0 6px 18px rgba(51,28,83,.06)"}}>
        <div style={{fontSize:12,fontWeight:900,letterSpacing:".1em",color:"#6e2aaf"}}>PROYECTOS DISPONIBLES</div>
        <h2 style={{margin:"5px 0 0",fontSize:28}}>Selecciona el proyecto a supervisar o auditar</h2>
      </section>
      <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(285px,1fr))",gap:14,marginTop:16}}>
        {proyectos.map(p=><Link key={p.codigo} href={`/certeza-tecnica/app/supervision-auditoria/${p.codigo.toLowerCase()}`} style={{background:"#fff",border:"1px solid #e0d8e9",borderRadius:16,padding:18,textDecoration:"none",color:"#2d2550",boxShadow:"0 5px 16px rgba(51,28,83,.05)"}}>
          <div style={{fontSize:12,fontWeight:900,color:"#7b2fc1"}}>{p.codigo}</div>
          <h3 style={{fontSize:21,margin:"6px 0 8px"}}>{p.nombre}</h3>
          <div style={{fontSize:13,color:"#71677f",lineHeight:1.6}}>{p.cliente||"Cliente no definido"}<br/>{p.ubicacion||"Ubicación no definida"}</div>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,marginTop:14,paddingTop:12,borderTop:"1px solid #eee8f2",fontSize:12,fontWeight:800}}>
            <span>{p.estado}</span><span>Entrar →</span>
          </div>
        </Link>)}
        {proyectos.length===0&&<div style={{background:"#fff",border:"1px dashed #d7cee0",borderRadius:16,padding:24,color:"#776d82"}}>No hay proyectos disponibles para tu usuario.</div>}
      </section>
    </div>
  </main>
}
