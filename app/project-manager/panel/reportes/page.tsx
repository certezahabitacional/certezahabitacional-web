import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { money } from "@/lib/project-manager/pr0002";
import { performanceSnapshot as p } from "@/lib/project-manager/performance-data";
import { healthSnapshot as h } from "@/lib/project-manager/health-data";
import { PmHeader, card } from "@/app/project-manager/panel/_components";

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect("/project-manager/login");
  return (
    <main style={{minHeight:"100vh",background:"#06172c",color:"#fff"}}>
      <PmHeader title="Reportes Ejecutivos" subtitle="Seguimiento → medición → análisis → pronóstico → informe." />
      <section style={{maxWidth:1250,margin:"0 auto",padding:"0 22px 54px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12}}>
          {[
            ["Resumen ejecutivo","Estado general, salud, alertas y decisiones.","/project-manager/panel/proyectos/pr-0002/resumen"],
            ["Control de desempeño","Avance, EVM y forecast del proyecto.","/project-manager/panel/proyectos/pr-0002/evm"],
            ["Riesgos y restricciones","Exposición y asuntos que pueden impedir el avance.","/project-manager/panel/proyectos/pr-0002/riesgos"],
            ["Decisiones","Pendientes, cerradas y trazabilidad histórica.","/project-manager/panel/proyectos/pr-0002/decisiones"],
          ].map(([title,desc,href])=><Link key={title} href={href} style={{...card,textDecoration:"none",color:"#fff",display:"block"}}>
            <h2 style={{marginTop:0}}>{title}</h2><p style={{color:"#365b7d",lineHeight:1.55}}>{desc}</p><span style={{color:"#edcb71",fontWeight:900}}>Abrir →</span>
          </Link>)}
        </div>

        <div style={{...card,marginTop:18,padding:24}}>
          <h2 style={{marginTop:0}}>Corte ejecutivo actual</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:10}}>
            {[
              ["BAC",money(p.bac)],["EAC",money(p.eac)],["Avance","0.00%"],["SPI","Sin corte"],["CPI","Sin corte"],["Salud",String(h.score)+"/100"],["Alertas","5 prioritarias"],["Forecast","30/06/2027"]
            ].map(([k,v])=><div key={k} style={{background:"#06172c",color:"#ffffff",borderRadius:10,padding:13}}><div style={{fontSize:12,color:"#476987"}}>{k}</div><strong>{v}</strong></div>)}
          </div>
        </div>

        <div style={{...card,marginTop:18}}>
          <h2 style={{marginTop:0}}>Regla de emisión</h2>
          <p style={{color:"#365b7d",lineHeight:1.6,marginBottom:0}}>Un reporte no se considera listo si sólo contiene datos. Debe incluir contexto, causa, impacto, pronóstico, decisión requerida, responsable y próxima revisión.</p>
        </div>
      </section>
    </main>
  );
}
