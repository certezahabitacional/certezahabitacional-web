import Link from "next/link";
import { requireProjectAccess, requireProjectManagerAccess } from "@/lib/project-manager/access";
import { prisma } from "@/lib/prisma";
import { pr0002, money } from "@/lib/project-manager/pr0002";
import { PmHeader, card } from "@/app/project-manager/panel/_components";

const modules = [
  ["🎯","Resumen ejecutivo","Estado, salud, alertas y prioridades.","resumen"],
  ["🩺","Salud del proyecto","Diagnóstico integral 0–100.","salud"],
  ["🔔","Alertas tempranas","Prioridades, causas y acciones.","alertas"],
  ["📋","Línea base","Referencia aprobada de alcance, plazo y costo.","linea-base"],
  ["📐","EDT / WBS","Estructura de control del proyecto.","edt"],
  ["📅","Programa","Actividades, relaciones y ruta crítica.","programa"],
  ["💰","Presupuesto","Conceptos, cantidades, precios y forecast.","presupuesto"],
  ["🏗️","Avance físico","Progreso real contra la línea base.","avance"],
  ["⚙️","Productividad","Rendimiento de cuadrillas, HH y equipo.","productividad"],
  ["📊","Valor Ganado (EVM)","PV, EV, AC, SPI, CPI y variaciones.","evm"],
  ["📈","Forecast","EAC, ETC, VAC y fecha probable de cierre.","forecast"],
  ["⚠️","Riesgos","Identificación, nivel, estrategia y respuesta.","riesgos"],
  ["🚧","Restricciones","Pendientes que pueden impedir la ejecución.","restricciones"],
  ["🔄","Cambios","Solicitudes, impactos y autorizaciones.","cambios"],
  ["✅","Decisiones","Asuntos que requieren resolución humana.","decisiones"],
];

export default async function ProjectDetailPage() {
  const existente=await prisma.proyectoPM.findUnique({where:{codigo:"PR-0002"},select:{id:true}});
  const access=existente ? await requireProjectAccess("PR-0002") : await requireProjectManagerAccess();
  const { readOnly, role }=access;
  if(!existente && role!=="DIRECTOR" && role!=="ADMINISTRADOR") {
    return null;
  }
  const p=pr0002.project;
  return <main style={{minHeight:"100vh",background:"#06172c",color:"#fff"}}>
    <PmHeader title={p.name} subtitle={p.code+" · "+p.client} />
    <section style={{maxWidth:1440,margin:"0 auto",padding:"0 22px 54px"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
        {[["Presupuesto",money(p.budget)],["Inicio",p.startDate],["Término",p.targetDate],["Estado",p.status],["Riesgo",p.riskLevel]].map(([k,v])=><div key={k} style={card}><div style={{color:"#8fa5bb",fontSize:12}}>{k}</div><strong style={{fontSize:18}}>{v}</strong></div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:14,marginTop:20}}>
        {modules.map(([icon,title,desc,path])=><Link key={title} href={"/project-manager/panel/proyectos/pr-0002/"+path} style={{...card,textDecoration:"none",color:"#fff",display:"block"}}>
          <div style={{fontSize:30}}>{icon}</div><h2 style={{margin:"10px 0 6px",fontSize:20}}>{title}</h2><p style={{margin:0,color:"#9fb2c6"}}>{desc}</p>
        </Link>)}
      </div>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:20}}>
        {readOnly ? (
          <div style={{background:"#e8f3fb",border:"1px solid #bcd7ea",color:"#082f64",padding:"12px 14px",borderRadius:10,fontWeight:850}}>
            Modo CLIENTE · Sólo lectura · Puede consultar indicadores, reportes y detalle completo del proyecto.
          </div>
        ) : (
          <>
            <Link href="/project-manager/portal/pr-0002" style={{color:"#edcb71",fontWeight:900,textDecoration:"none"}}>Abrir vista del cliente →</Link>
            <Link href="/project-manager/panel/proyectos/equipo?codigo=PR-0002" style={{color:"#edcb71",fontWeight:900,textDecoration:"none"}}>Participantes / Equipo →</Link>
            <Link href="/project-manager/panel/accesos" style={{color:"#edcb71",fontWeight:900,textDecoration:"none"}}>Administrar accesos →</Link>
          </>
        )}
      </div>
    </section>
  </main>
}
