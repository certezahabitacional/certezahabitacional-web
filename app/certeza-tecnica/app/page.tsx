import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";

const navy="#071d38";
const gold="#edcb71";
const border="rgba(237,203,113,.28)";

const areas=[
  {
    n:"1",
    title:"Dirección y Desarrollo",
    subtitle:"Define el rumbo y genera valor.",
    color:"#e85a13",
    href:"/certeza-tecnica/app/direccion-desarrollo",
    items:["Evaluación técnico-económica","Estrategia y toma de decisiones","Ingeniería de valor","Gestión de riesgos","Capacitación técnica y consultoría"],
  },
  {
    n:"2",
    title:"Planeación y Administración",
    subtitle:"Organiza, programa y controla.",
    color:"#0874d9",
    href:"/project-manager/panel",
    items:["Certeza Project Manager","Programa y línea base","Contratos, cambios y restricciones","Valor ganado y pronóstico","Reportes e inteligencia"],
  },
  {
    n:"3",
    title:"Presupuestos y Costos",
    subtitle:"Cuantifica, analiza y optimiza.",
    color:"#268c10",
    href:"/certeza-tecnica/presupuestos-costos",
    items:["Generadores y cuantificaciones","APU y tarjetas","Explosión de insumos","Presupuestos","Control y variaciones"],
  },
  {
    n:"4",
    title:"Supervisión y Auditoría",
    subtitle:"Verifica, asegura y da cumplimiento.",
    color:"#6a22ba",
    href:"/certeza-tecnica/app/supervision-auditoria",
    items:["Supervisión técnica y calidad","Auditoría de obra","Estimaciones y generadores","Avance físico-financiero","Cierre y recepción"],
  },
] as const;

export default async function CertezaTecnica360Page(){
  const session=await auth();
  if(!session?.user) redirect("/certeza-tecnica/login?callbackUrl=%2Fcerteza-tecnica%2Fapp");
  const access=await requireProjectManagerAccess();
  const user=session.user.name ?? session.user.email ?? "Usuario autorizado";
  const where=access.role==="DIRECTOR" || access.role==="ADMINISTRADOR"
    ? {activo:true}
    : {activo:true,participantes:{some:{usuarioId:access.userId}}};
  const proyectos=await prisma.proyectoPM.findMany({
    where,
    orderBy:{actualizadoEn:"desc"},
    take:6,
    select:{codigo:true,nombre:true,cliente:true,estado:true,presupuesto:true},
  });

  return <main style={{minHeight:"100vh",background:"#eef4f8",color:"#0a315a"}}>
    <header style={{background:`linear-gradient(110deg,${navy},#0a3b69 65%,#0d5e96)`,color:"#fff",borderBottom:`4px solid ${gold}`}}>
      <div style={{maxWidth:1440,margin:"0 auto",padding:"18px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:20,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <Image src="/branding/logo-certeza-tecnica.png" alt="Certeza Técnica" width={150} height={92} priority style={{width:130,height:"auto"}}/>
          <div>
            <div style={{fontSize:12,fontWeight:900,letterSpacing:".12em",color:gold}}>SISTEMA INTEGRAL DE GESTIÓN DE PROYECTOS</div>
            <h1 style={{margin:"4px 0 0",fontSize:"clamp(26px,4vw,42px)",lineHeight:1}}>CERTEZA TÉCNICA 360</h1>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontWeight:900}}>{user}</div>
          <Link href="/certeza-tecnica" style={{color:"#dbe8f3",fontSize:13,textDecoration:"none"}}>← Volver al portafolio</Link>
        </div>
      </div>
    </header>

    <div style={{maxWidth:1440,margin:"0 auto",padding:"22px"}}>
      <section style={{display:"grid",gridTemplateColumns:"1.2fr .8fr",gap:16}}>
        <article style={{background:"#fff",borderRadius:18,border:"1px solid #d6e2ec",padding:22,boxShadow:"0 8px 25px rgba(4,42,76,.07)"}}>
          <div style={{fontSize:12,fontWeight:900,color:"#6d8297",letterSpacing:".08em"}}>CENTRO DE CONTROL</div>
          <h2 style={{fontSize:30,margin:"7px 0 8px"}}>Un proyecto. Cuatro áreas. Una sola fuente de información.</h2>
          <p style={{margin:0,color:"#49657e",lineHeight:1.7,maxWidth:900}}>
            Certeza Técnica 360 conecta estrategia, planeación, costos, supervisión, documentos, riesgos y reportes para evitar capturas duplicadas y mantener trazabilidad desde el arranque hasta el cierre.
          </p>
        </article>
        <article style={{background:navy,color:"#fff",borderRadius:18,padding:22,border:`1px solid ${border}`}}>
          <div style={{fontSize:12,fontWeight:900,color:gold,letterSpacing:".08em"}}>TABLERO EJECUTIVO</div>
          <h2 style={{margin:"8px 0 8px"}}>Selecciona un proyecto</h2>
          <p style={{color:"#c9d7e4",lineHeight:1.6}}>Consulta las 4 áreas del portafolio en una sola pantalla, con decisiones, riesgos, costos, avance, hallazgos y alertas.</p>
          <div style={{display:"grid",gap:8,marginTop:12}}>
            {proyectos.slice(0,3).map(p=><Link key={p.codigo} href={`/certeza-tecnica/app/proyectos/${p.codigo.toLowerCase()}/tablero`} style={{display:"flex",justifyContent:"space-between",gap:10,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.14)",borderRadius:10,padding:"10px 12px",color:"#fff",textDecoration:"none",fontWeight:850}}>
              <span>{p.codigo} · {p.nombre}</span><span style={{color:gold}}>Abrir →</span>
            </Link>)}
          </div>
          {proyectos.length===0&&<div style={{color:"#c9d7e4",marginTop:12}}>No hay proyectos disponibles para tu usuario.</div>}
        </article>
      </section>

      <section style={{marginTop:16,background:"#fff",border:"1px solid #d7e3ec",borderRadius:18,padding:20}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <div><div style={{fontSize:12,fontWeight:900,color:"#6d8297",letterSpacing:".08em"}}>MIS PROYECTOS</div><h2 style={{margin:"5px 0 0"}}>Tableros ejecutivos disponibles</h2></div>
          <Link href="/project-manager/panel/proyectos" style={{fontWeight:900,color:"#0a5a92",textDecoration:"none"}}>Administrar proyectos →</Link>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:10,marginTop:14}}>
          {proyectos.map(p=><Link key={p.codigo} href={`/certeza-tecnica/app/proyectos/${p.codigo.toLowerCase()}/tablero`} style={{border:"1px solid #dce6ed",borderRadius:12,padding:14,textDecoration:"none",color:"#173c58",background:"#fbfdff"}}>
            <div style={{fontSize:11,fontWeight:950,color:"#d56a17"}}>{p.codigo}</div>
            <div style={{fontWeight:950,marginTop:4}}>{p.nombre}</div>
            <div style={{fontSize:12,color:"#6c8090",marginTop:5}}>{p.cliente||"Cliente no definido"} · {p.estado}</div>
            <div style={{marginTop:10,fontWeight:900,color:"#0a5a92"}}>Abrir tablero →</div>
          </Link>)}
        </div>
      </section>

      <section style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:14,marginTop:16}}>
        {areas.map(area=><Link key={area.n} href={area.href} style={{textDecoration:"none",color:"inherit",background:"#fff",border:"1px solid #d7e3ec",borderRadius:18,overflow:"hidden",boxShadow:"0 7px 20px rgba(4,42,76,.06)"}}>
          <div style={{background:area.color,color:"#fff",padding:"16px 18px",display:"flex",gap:12,alignItems:"center"}}>
            <div style={{fontSize:38,fontWeight:950,lineHeight:1}}>{area.n}</div>
            <div><h3 style={{margin:0,fontSize:18}}>{area.title}</h3><div style={{fontSize:12,marginTop:3,opacity:.9}}>{area.subtitle}</div></div>
          </div>
          <div style={{padding:17}}>
            {area.items.map(x=><div key={x} style={{padding:"7px 0",borderBottom:"1px solid #edf2f6",fontSize:13,fontWeight:700,color:"#31536f"}}>{x}</div>)}
            <div style={{marginTop:14,fontWeight:950,color:area.color}}>Entrar al área →</div>
          </div>
        </Link>)}
      </section>

      <section style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:14,marginTop:16}}>
        <Link href="/project-manager/panel/proyectos" style={toolCard}>
          <b>📁 Expediente Maestro</b>
          <span>Accede al proyecto, documentos maestros, constructibilidad y estructura de información.</span>
        </Link>
        <Link href="/project-manager/panel/reportes" style={toolCard}>
          <b>▧ Reportes Integrales</b>
          <span>Reportes ejecutivos, avance, salud del proyecto y documentación para decisión.</span>
        </Link>
        <Link href="/project-manager/panel/inteligencia" style={toolCard}>
          <b>✦ Inteligencia Certeza</b>
          <span>Análisis de riesgos, alertas, pronósticos y apoyo a la toma de decisiones.</span>
        </Link>
      </section>

      <section style={{marginTop:16,background:"#fff",border:"1px solid #d7e3ec",borderRadius:18,padding:20}}>
        <h2 style={{margin:"0 0 12px"}}>Flujo integral del proyecto</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(6,minmax(0,1fr))",gap:8}}>
          {["Alta y evaluación","Expediente maestro","Presupuesto y línea base","Planeación y ejecución","Supervisión y auditoría","Cierre y reporte final"].map((x,i)=><div key={x} style={{background:i%2? "#f4f8fb":"#edf5fb",border:"1px solid #dce8f1",padding:"14px 10px",borderRadius:12,textAlign:"center",fontSize:12,fontWeight:850}}><div style={{color:"#d56a17",fontSize:18,fontWeight:950}}>{i+1}</div>{x}</div>)}
        </div>
      </section>
    </div>

    <style>{`
      @media(max-width:1100px){
        section[style*="repeat(4"]{grid-template-columns:repeat(2,minmax(0,1fr)) !important}
        section[style*="repeat(6"]{grid-template-columns:repeat(3,minmax(0,1fr)) !important}
      }
      @media(max-width:760px){
        section[style*="1.2fr .8fr"]{grid-template-columns:1fr !important}
        section[style*="repeat(3"]{grid-template-columns:1fr !important}
        section[style*="repeat(4"]{grid-template-columns:1fr !important}
        section[style*="repeat(6"]{grid-template-columns:repeat(2,minmax(0,1fr)) !important}
      }
    `}</style>
  </main>
}

const toolCard={
  textDecoration:"none",
  color:"#0a315a",
  background:"#fff",
  border:"1px solid #d7e3ec",
  borderRadius:16,
  padding:18,
  display:"grid",
  gap:7,
  boxShadow:"0 6px 18px rgba(4,42,76,.05)",
} as const;
