import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { performanceSnapshot as s } from "@/lib/project-manager/performance-data";
import { PmHeader, card } from "@/app/project-manager/panel/_components";

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect("/project-manager/login");
  return (
    <main style={{minHeight:"100vh",background:"#06172c",color:"#fff"}}>
      <PmHeader title="Avance físico" subtitle="Comparación del progreso real contra la línea base del proyecto." />
      <section style={{maxWidth:1200,margin:"0 auto",padding:"0 22px 54px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12}}>
          {[
            ["Corte",s.statusDate],
            ["Avance físico","0.00%"],
            ["Avance financiero","0.00%"],
            ["Inicio contractual","02/11/2026"],
          ].map(([k,v])=><div key={k} style={card}><div style={{color:"#294f73",fontSize:12}}>{k}</div><strong style={{fontSize:24}}>{v}</strong></div>)}
        </div>
        <div style={{...card,marginTop:18,padding:26}}>
          <div style={{fontSize:44}}>🏗️</div>
          <h2 style={{margin:"10px 0 6px"}}>Proyecto en etapa preoperativa</h2>
          <p style={{color:"#294f73",lineHeight:1.6,margin:0}}>
            PR-0002 todavía no tiene un corte de ejecución real. Por eso Certeza Project Manager no genera un porcentaje artificial.
            El primer avance se calculará cuando exista una fecha de corte posterior al arranque y se hayan capturado cantidades ejecutadas.
          </p>
        </div>
        <div style={{...card,marginTop:18}}>
          <h2 style={{marginTop:0}}>Qué alimentará este módulo</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10}}>
            {["Avance por actividad","Avance por EDT","Avance global ponderado","Avance plan vs real","Evidencias de campo","Tendencia de cumplimiento"].map(x=><div key={x} style={{background:"#06172c",color:"#ffffff",borderRadius:10,padding:12}}>{x}</div>)}
          </div>
        </div>
      </section>
    </main>
  );
}
