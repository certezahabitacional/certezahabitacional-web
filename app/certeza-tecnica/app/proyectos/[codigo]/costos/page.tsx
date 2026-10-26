import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/project-manager/access";
import { inicializarCertezaCost, recalcularCertezaCostVinculado } from "./actions";

const money=(v:unknown)=>new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0}).format(Number(v||0));

export default async function CostosProyecto360({params}:{params:Promise<{codigo:string}>}){
  const {codigo}=await params;
  const access=await requireProjectAccess(codigo);
  const p=access.proyecto;

  const cost=await prisma.proyectoGeneradores.findUnique({
    where:{codigo:p.codigo},
    include:{
      _count:{select:{conceptos:true,generadores:true,tarjetasAPU:true,presupuestos:true,explosionesInsumos:true}},
      presupuestos:{orderBy:{version:"desc"},take:1},
      explosionesInsumos:{orderBy:{version:"desc"},take:1},
    },
  });

  const latestBudget=cost?.presupuestos[0] ?? null;
  const latestExplosion=cost?.explosionesInsumos[0] ?? null;

  return <main style={{minHeight:"100vh",background:"#f3f7f1",color:"#224228"}}>
    <header style={{background:"linear-gradient(105deg,#174c1c,#268c10)",color:"#fff"}}>
      <div style={{maxWidth:1400,margin:"0 auto",padding:"20px 22px"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
          <Link href={`/certeza-tecnica/app/proyectos/${p.codigo.toLowerCase()}/tablero`} style={{color:"#fff",textDecoration:"none",fontWeight:900}}>← Tablero Ejecutivo</Link>
          <Link href={`/project-manager/panel/proyectos/${p.codigo.toLowerCase()}`} style={{color:"#fff",textDecoration:"none",fontWeight:900}}>Project Manager →</Link>
        </div>
        <div style={{marginTop:18}}>
          <div style={{fontSize:12,fontWeight:900,letterSpacing:".11em",opacity:.9}}>CERTEZA COST · PROYECTO VINCULADO</div>
          <h1 style={{fontSize:"clamp(30px,5vw,48px)",margin:"5px 0"}}>{p.codigo} · {p.nombre}</h1>
          <div style={{opacity:.9}}>{p.cliente||"Cliente no definido"} · {p.ubicacion||"Ubicación no definida"}</div>
        </div>
      </div>
    </header>

    <div style={{maxWidth:1400,margin:"0 auto",padding:22}}>
      {!cost ? <section style={box}>
        <div style={{fontSize:12,fontWeight:950,color:"#5c7d5f",letterSpacing:".08em"}}>CONEXIÓN PENDIENTE</div>
        <h2 style={{fontSize:28,margin:"6px 0 8px"}}>Inicializar Certeza Cost para este proyecto</h2>
        <p style={{lineHeight:1.7,color:"#58705b",maxWidth:900}}>
          Se creará el proyecto de costos con el mismo código <b>{p.codigo}</b>. A partir de ese momento, generadores, APU, presupuestos y explosión de insumos pertenecerán al mismo proyecto que utiliza Certeza Project Manager.
        </p>
        {!access.projectReadOnly&&<form action={inicializarCertezaCost.bind(null,p.codigo)}>
          <button style={primary}>Inicializar Certeza Cost →</button>
        </form>}
      </section> : <>
        <section style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:12}}>
          <Kpi title="Conceptos" value={String(cost._count.conceptos)} />
          <Kpi title="Generadores" value={String(cost._count.generadores)} />
          <Kpi title="Tarjetas APU" value={String(cost._count.tarjetasAPU)} />
          <Kpi title="Presupuesto vigente" value={latestBudget?money(latestBudget.totalPresupuesto):"Pendiente"} />
          <Kpi title="Explosión de insumos" value={latestExplosion?money(latestExplosion.totalGeneral):"Pendiente"} />
        </section>

        <section style={{display:"grid",gridTemplateColumns:"1.1fr .9fr",gap:16,marginTop:16}}>
          <article style={box}>
            <div style={{fontSize:12,fontWeight:950,color:"#5c7d5f",letterSpacing:".08em"}}>FLUJO OPERATIVO</div>
            <h2 style={{margin:"5px 0 8px"}}>Certeza Cost vinculado a {p.codigo}</h2>
            <p style={{color:"#58705b",lineHeight:1.65}}>
              Trabaja conceptos, generadores, tarjetas de precio unitario, insumos y presupuesto. Los resultados se reflejan directamente en el Tablero Ejecutivo y en Project Manager.
            </p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10,marginTop:14}}>
              <Link href={`/panel/certeza-tecnica/generadores/${cost.id}`} style={navCard}><b>1. Generadores y cuantificación</b><span>Conceptos, cantidades y generadores.</span></Link>
              <Link href="/panel/certeza-tecnica/apu" style={navCard}><b>2. Tarjetas APU</b><span>Análisis de precios unitarios.</span></Link>
              <Link href="/panel/certeza-tecnica/explosion-insumos" style={navCard}><b>3. Explosión de insumos</b><span>Materiales, mano de obra y equipo.</span></Link>
              <Link href="/panel/certeza-tecnica/presupuestos" style={navCard}><b>4. Presupuestos</b><span>Versiones y línea base de costos.</span></Link>
            </div>
          </article>

          <article style={box}>
            <div style={{fontSize:12,fontWeight:950,color:"#5c7d5f",letterSpacing:".08em"}}>SINCRONIZACIÓN</div>
            <h2 style={{margin:"5px 0 8px"}}>Información compartida</h2>
            <div style={{display:"grid",gap:8}}>
              {[
                ["Código común",p.codigo],
                ["Último presupuesto",latestBudget?money(latestBudget.totalPresupuesto):"Sin generar"],
                ["Versión presupuesto",latestBudget?`v${latestBudget.version} · ${latestBudget.estado}`:"—"],
                ["Explosión de insumos",latestExplosion?money(latestExplosion.totalGeneral):"Sin generar"],
              ].map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",gap:12,borderBottom:"1px solid #e6eee4",padding:"9px 0"}}><span style={{color:"#6b7f6c"}}>{k}</span><b style={{textAlign:"right"}}>{v}</b></div>)}
            </div>
            {!access.projectReadOnly&&<form action={recalcularCertezaCostVinculado.bind(null,p.codigo)} style={{marginTop:16}}>
              <button style={primary}>Recalcular costos y actualizar tablero</button>
            </form>}
          </article>
        </section>
      </>}

      <section style={{...box,marginTop:16,background:"#f8fff6"}}>
        <b>Regla de integración:</b> Certeza Cost y Project Manager comparten el código del proyecto. El presupuesto y la explosión de insumos se leen desde Certeza Cost como fuente única de información económica.
      </section>
    </div>

    <style>{`
      @media(max-width:1050px){section[style*="repeat(5"]{grid-template-columns:repeat(3,minmax(0,1fr)) !important}}
      @media(max-width:800px){
        section[style*="1.1fr .9fr"]{grid-template-columns:1fr !important}
        section[style*="repeat(5"]{grid-template-columns:repeat(2,minmax(0,1fr)) !important}
      }
      @media(max-width:560px){
        section[style*="repeat(5"]{grid-template-columns:1fr !important}
        div[style*="repeat(2"]{grid-template-columns:1fr !important}
      }
    `}</style>
  </main>
}

function Kpi({title,value}:{title:string;value:string}){return <article style={{background:"#fff",border:"1px solid #dce8da",borderTop:"4px solid #268c10",borderRadius:14,padding:15,boxShadow:"0 4px 14px rgba(34,66,40,.05)"}}><div style={{fontSize:11,fontWeight:900,color:"#789078",textTransform:"uppercase"}}>{title}</div><div style={{fontSize:23,fontWeight:950,marginTop:6}}>{value}</div></article>}
const box={background:"#fff",border:"1px solid #dce8da",borderRadius:16,padding:20,boxShadow:"0 6px 18px rgba(34,66,40,.055)"} as const;
const primary={border:0,borderRadius:10,background:"#268c10",color:"#fff",padding:"12px 16px",fontWeight:950,cursor:"pointer"} as const;
const navCard={textDecoration:"none",color:"#224228",border:"1px solid #dce8da",borderRadius:12,padding:14,display:"grid",gap:5,background:"#fbfefb",fontSize:13} as const;
