import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { money } from "@/lib/project-manager/pr0002";
import { performanceSnapshot as s } from "@/lib/project-manager/performance-data";
import { PmHeader, card } from "@/app/project-manager/panel/_components";

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect("/project-manager/login");
  return (
    <main style={{minHeight:"100vh",background:"#06172c",color:"#fff"}}>
      <PmHeader title="Forecast / Pronóstico al cierre" subtitle="Dónde probablemente terminará el proyecto con la información disponible." />
      <section style={{maxWidth:1250,margin:"0 auto",padding:"0 22px 54px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12}}>
          {[
            ["BAC",money(s.bac)],
            ["EAC",money(s.eac)],
            ["ETC",money(s.etc)],
            ["VAC",money(s.vac)],
            ["Fecha contractual","30/06/2027"],
            ["Fecha forecast","30/06/2027"],
            ["Salud",String(s.healthScore)+"/100"],
            ["Estado",s.healthStatus],
          ].map(([k,v])=><div key={k} style={card}><div style={{color:"#294f73",fontSize:12,fontWeight:800}}>{k}</div><strong style={{fontSize:20,display:"block",marginTop:6}}>{v}</strong></div>)}
        </div>
        <div style={{...card,marginTop:18,padding:24}}>
          <h2 style={{marginTop:0}}>Escenario actual: Base</h2>
          <p style={{color:"#294f73",lineHeight:1.6}}>
            Como el proyecto aún no inicia ejecución, el mejor pronóstico disponible es la propia línea base: EAC = $24.6 M y término previsto = 30/06/2027.
          </p>
          <p style={{marginBottom:0,color:"#7a5d16"}}>En cuanto existan datos reales, Certeza generará escenarios <b>Base, Recuperación y Riesgo</b>.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:12,marginTop:18}}>
          {[
            ["Recuperación","Qué pasaría si las acciones correctivas recuperan productividad y plazo."],
            ["Base","Qué pasaría si continúa la tendencia observada."],
            ["Riesgo","Qué pasaría si se materializan riesgos relevantes."],
          ].map(([t,d])=><div key={t} style={card}><h3 style={{marginTop:0,color:"#c86100"}}>{t}</h3><p style={{margin:0,color:"#294f73",lineHeight:1.55}}>{d}</p></div>)}
        </div>
      </section>
    </main>
  );
}
