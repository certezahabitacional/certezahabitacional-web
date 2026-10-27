import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";

export default async function DireccionDesarrolloPage(){
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
    select:{codigo:true,nombre:true,cliente:true,ubicacion:true,estado:true,presupuesto:true,actualizadoEn:true},
  });

  return <main style={{minHeight:"100vh",background:"#f5f7f9",color:"#183653"}}>
    <header style={{background:"linear-gradient(100deg,#8d240d,#e85a13)",color:"#fff",padding:"22px"}}>
      <div style={{maxWidth:1300,margin:"0 auto"}}>
        <Link href="/certeza-tecnica/app" style={{color:"#fff",textDecoration:"none",fontWeight:800}}>← Certeza Técnica 360</Link>
        <h1 style={{fontSize:"clamp(30px,5vw,48px)",margin:"12px 0 4px"}}>Dirección y Desarrollo</h1>
        <p style={{margin:0,fontSize:18}}>Evaluación técnico-económica, decisiones y riesgos conectados al mismo proyecto.</p>
      </div>
    </header>

    <div style={{maxWidth:1300,margin:"0 auto",padding:22}}>
      <section style={{background:"#fff",border:"1px solid #dae5ed",borderRadius:16,padding:20,boxShadow:"0 6px 18px rgba(17,49,76,.06)"}}>
        <div style={{display:"flex",alignItems:"end",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:12,fontWeight:900,letterSpacing:".1em",color:"#a44920"}}>PROYECTOS DISPONIBLES</div>
            <h2 style={{margin:"5px 0 0",fontSize:28}}>Selecciona el proyecto a dirigir</h2>
          </div>
          <Link href="/project-manager/panel/proyectos" style={{color:"#8d240d",fontWeight:900,textDecoration:"none"}}>Administrar proyectos →</Link>
        </div>
      </section>

      <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(285px,1fr))",gap:14,marginTop:16}}>
        {proyectos.map(p=><Link key={p.codigo} href={`/certeza-tecnica/app/direccion-desarrollo/${p.codigo.toLowerCase()}`} style={{background:"#fff",border:"1px solid #dae5ed",borderRadius:16,padding:18,textDecoration:"none",color:"#183653",boxShadow:"0 5px 16px rgba(17,49,76,.05)"}}>
          <div style={{fontSize:12,fontWeight:900,color:"#d65c1b"}}>{p.codigo}</div>
          <h3 style={{fontSize:21,margin:"6px 0 8px"}}>{p.nombre}</h3>
          <div style={{fontSize:13,color:"#657a8c",lineHeight:1.6}}>{p.cliente || "Cliente no definido"}<br/>{p.ubicacion || "Ubicación no definida"}</div>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,marginTop:14,paddingTop:12,borderTop:"1px solid #edf1f4",fontSize:12,fontWeight:800}}>
            <span>{p.estado}</span><span>Entrar →</span>
          </div>
        </Link>)}
        {proyectos.length===0 && <div style={{background:"#fff",border:"1px dashed #c9d6df",borderRadius:16,padding:24,color:"#6b7f90"}}>No hay proyectos disponibles para tu usuario.</div>}
      </section>
    </div>
  </main>
}
