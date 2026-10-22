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
  const kpis = [
    ["Avance","0.00%"],
    ["SPI","Sin corte"],
    ["CPI","Sin corte"],
    ["EAC",money(p.eac)],
    ["Forecast","30/06/2027"],
    ["Salud",String(h.score)+"/100"],
    ["Riesgos altos","2"],
    ["Restricciones","4"],
  ];
  return (
    <main style={{minHeight:"100vh",background:"#06172c",color:"#fff"}}>
      <PmHeader title="Resumen Ejecutivo" subtitle="Mucho análisis detrás, poca información al frente." />
      <section style={{maxWidth:1400,margin:"0 auto",padding:"0 22px 54px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12}}>
          {kpis.map(([k,v])=><div key={k} style={card}><div style={{color:"#b9dbf5",fontSize:12}}>{k}</div><strong style={{fontSize:22,display:"block",marginTop:6}}>{v}</strong></div>)}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:14,marginTop:18}}>
          <section style={{...card,padding:22}}>
            <h2 style={{marginTop:0}}>🔔 Atención requerida</h2>
            <div style={{display:"grid",gap:10}}>
              {h.alerts.slice(0,3).map(([priority,title,sources,due],i)=><div key={String(title)} style={{background:"#06172c",color:"#ffffff",padding:13,borderRadius:11}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:10}}><strong>{i+1}. {title}</strong><span style={{color:"#ff9696",fontSize:12,fontWeight:900}}>{priority}</span></div>
                <div style={{color:"#b9dbf5",fontSize:12,marginTop:5}}>{sources} · {due}</div>
              </div>)}
            </div>
            <Link href="/project-manager/panel/proyectos/pr-0002/alertas" style={{display:"inline-block",marginTop:14,color:"#edcb71",fontWeight:900,textDecoration:"none"}}>Ver todas las alertas →</Link>
          </section>

          <section style={{...card,padding:22}}>
            <h2 style={{marginTop:0}}>🩺 Salud del proyecto</h2>
            <div style={{fontSize:48,fontWeight:900,color:"#edcb71"}}>{h.score}/100</div>
            <p style={{color:"#365b7d",lineHeight:1.55}}>{h.status}</p>
            <div style={{display:"grid",gap:7}}>
              {h.dimensions.slice(0,4).map(([name,score,status])=><div key={String(name)} style={{display:"flex",justifyContent:"space-between",gap:12}}><span>{name}</span><strong style={{color:status==="VERDE"?"#9fe0b5":"#f4c86d"}}>{score}</strong></div>)}
            </div>
            <Link href="/project-manager/panel/proyectos/pr-0002/salud" style={{display:"inline-block",marginTop:14,color:"#edcb71",fontWeight:900,textDecoration:"none"}}>Ver diagnóstico →</Link>
          </section>
        </div>

        <section style={{...card,marginTop:18,padding:22}}>
          <h2 style={{marginTop:0}}>📈 Pronóstico actual</h2>
          <p style={{color:"#365b7d",lineHeight:1.6,marginBottom:0}}>
            PR-0002 está todavía en etapa preoperativa. Con la información disponible, el escenario base mantiene EAC = {money(p.eac)} y término = 30/06/2027. Los indicadores SPI y CPI permanecen como “Sin corte” hasta que exista ejecución real.
          </p>
        </section>
      </section>
    </main>
  );
}
