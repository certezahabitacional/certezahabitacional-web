import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { healthSnapshot as h } from "@/lib/project-manager/health-data";
import { PmHeader, card } from "@/app/project-manager/panel/_components";

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect("/project-manager/login");
  return (
    <main style={{minHeight:"100vh",background:"#06172c",color:"#fff"}}>
      <PmHeader title="Alertas Tempranas" subtitle="Dato → tendencia → umbral → alerta → causa → acción." />
      <section style={{maxWidth:1300,margin:"0 auto",padding:"0 22px 54px"}}>
        <div style={{...card,padding:24}}>
          <h2 style={{marginTop:0}}>Top 5 de atención</h2>
          <p style={{color:"#9fb2c6",lineHeight:1.6,marginBottom:0}}>
            El sistema prioriza los asuntos con mayor impacto potencial y fecha más próxima. No repite el mismo problema si ya está consolidado en una decisión principal.
          </p>
        </div>
        <div style={{display:"grid",gap:12,marginTop:18}}>
          {h.alerts.map(([priority,title,sources,due,action],i)=><article key={String(title)} style={{...card,padding:20}}>
            <div style={{display:"grid",gridTemplateColumns:"72px 1fr",gap:16,alignItems:"start"}}>
              <div style={{width:58,height:58,borderRadius:16,display:"grid",placeItems:"center",background:"rgba(239,94,94,.14)",color:"#ff9696",fontWeight:900,fontSize:18}}>{String(i+1).padStart(2,"0")}</div>
              <div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                  <strong style={{fontSize:20}}>{title}</strong>
                  <span style={{fontSize:12,fontWeight:900,color:"#ff9696"}}>{priority}</span>
                </div>
                <div style={{color:"#8fa5bb",fontSize:13,marginTop:5}}>Fuentes: {sources} · Fecha objetivo: {due}</div>
                <p style={{margin:"10px 0 0",color:"#d6dee7",lineHeight:1.55}}><b>Acción:</b> {action}</p>
              </div>
            </div>
          </article>)}
        </div>
      </section>
    </main>
  );
}
