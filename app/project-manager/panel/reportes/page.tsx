import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { money } from "@/lib/project-manager/pr0002";
import { performanceSnapshot as p } from "@/lib/project-manager/performance-data";
import { healthSnapshot as h } from "@/lib/project-manager/health-data";
import { PmHeader, card } from "@/app/project-manager/panel/_components";

const ink="#082f64";
const body="#294f73";
const orange="#d87300";
const dark="#06172c";
const lightOnDark="#c9e6fb";

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect("/project-manager/login");
  return (
    <main style={{minHeight:"100vh",background:dark,color:"#fff"}}>
      <PmHeader title="Reportes Ejecutivos" subtitle="Seguimiento → medición → análisis → pronóstico → informe." />
      <section style={{maxWidth:1250,margin:"0 auto",padding:"0 22px 54px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12}}>
          {[
            ["Resumen ejecutivo","Estado general, salud, alertas y decisiones.","/project-manager/panel/proyectos/pr-0002/resumen"],
            ["Control de desempeño","Avance, EVM y forecast del proyecto.","/project-manager/panel/proyectos/pr-0002/evm"],
            ["Riesgos y restricciones","Exposición y asuntos que pueden impedir el avance.","/project-manager/panel/proyectos/pr-0002/riesgos"],
            ["Decisiones","Pendientes, cerradas y trazabilidad histórica.","/project-manager/panel/proyectos/pr-0002/decisiones"],
          ].map(([title,desc,href])=><Link key={title} href={href} style={{...card,textDecoration:"none",color:ink,display:"block"}}>
            <h2 style={{marginTop:0,color:ink,fontWeight:900}}>{title}</h2>
            <p style={{color:body,lineHeight:1.55,fontWeight:600}}>{desc}</p>
            <span style={{color:orange,fontWeight:950}}>Abrir →</span>
          </Link>)}
        </div>

        <div style={{...card,marginTop:18,padding:24}}>
          <h2 style={{marginTop:0,color:ink}}>Corte ejecutivo actual</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:10}}>
            {[
              ["BAC",money(p.bac)],["EAC",money(p.eac)],["Avance","0.00%"],["SPI","Sin corte"],["CPI","Sin corte"],["Salud",String(h.score)+"/100"],["Alertas","5 prioritarias"],["Forecast","30/06/2027"]
            ].map(([k,v])=><div key={k} style={{background:dark,color:"#fff",borderRadius:10,padding:13,border:"1px solid #123c68"}}>
              <div style={{fontSize:12,color:lightOnDark,fontWeight:800}}>{k}</div>
              <strong style={{display:"block",marginTop:5,color:"#ffffff",fontSize:16,fontWeight:950}}>{v}</strong>
            </div>)}
          </div>
        </div>

        <div style={{...card,marginTop:18}}>
          <h2 style={{marginTop:0,color:ink}}>Regla de emisión</h2>
          <p style={{color:body,lineHeight:1.6,marginBottom:0,fontWeight:600}}>
            Un reporte no se considera listo si sólo contiene datos. Debe incluir contexto, causa, impacto, pronóstico, decisión requerida, responsable y próxima revisión.
          </p>
        </div>
      </section>
    </main>
  );
}
