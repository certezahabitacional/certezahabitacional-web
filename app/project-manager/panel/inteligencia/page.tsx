import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { healthSnapshot as h } from "@/lib/project-manager/health-data";
import { PmHeader, card } from "@/app/project-manager/panel/_components";

const agents=[
  ["📅","Planeación","Cronograma, ruta crítica y restricciones."],
  ["💰","Costos","EVM, desviaciones y forecast."],
  ["⚙️","Productividad","Rendimientos y deterioro operativo."],
  ["⚠️","Riesgos","Exposición, disparadores y respuestas."],
  ["🔄","Cambios","Impacto en alcance, plazo y costo."],
  ["📑","Reportes","Síntesis ejecutiva y trazabilidad."],
];

export default async function Page() {
  const session=await auth();
  if(!session?.user) redirect("/project-manager/login");
  return (
    <main style={{minHeight:"100vh",background:"#06172c",color:"#fff"}}>
      <PmHeader title="Inteligencia Certeza" subtitle="El sistema analiza y recomienda; la persona responsable decide." />
      <section style={{maxWidth:1300,margin:"0 auto",padding:"0 22px 54px"}}>
        <div style={{...card,padding:24}}>
          <h2 style={{marginTop:0}}>3 asuntos que requieren atención</h2>
          <div style={{display:"grid",gap:10}}>
            {h.alerts.slice(0,3).map(([priority,title,sources,due,action],i)=><div key={String(title)} style={{background:"#06172c",borderRadius:11,padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:12}}><strong>{i+1}. {title}</strong><span style={{color:"#ff9696",fontWeight:900,fontSize:12}}>{priority}</span></div>
              <div style={{color:"#8fa5bb",fontSize:12,marginTop:5}}>{sources} · {due}</div>
              <div style={{color:"#d6dee7",marginTop:8}}><b>Recomendación:</b> {action}</div>
            </div>)}
          </div>
          <Link href="/project-manager/panel/proyectos/pr-0002/alertas" style={{display:"inline-block",marginTop:14,color:"#edcb71",fontWeight:900,textDecoration:"none"}}>Ver centro de alertas →</Link>
        </div>

        <h2 style={{margin:"26px 0 12px"}}>Agentes especializados</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:12}}>
          {agents.map(([icon,name,desc])=><div key={name} style={card}><div style={{fontSize:28}}>{icon}</div><h3 style={{margin:"9px 0 5px"}}>Agente de {name}</h3><p style={{margin:0,color:"#9fb2c6",lineHeight:1.5}}>{desc}</p></div>)}
        </div>

        <div style={{...card,marginTop:18,border:"1px solid rgba(237,203,113,.28)"}}>
          <h2 style={{marginTop:0,color:"#edcb71"}}>Gobierno humano obligatorio</h2>
          <p style={{margin:0,color:"#aabaca",lineHeight:1.6}}>La IA puede consolidar, detectar, comparar, proyectar y recomendar. No autoriza cambios, no modifica líneas base, no negocia compromisos contractuales y no sustituye el juicio profesional del responsable.</p>
        </div>
      </section>
    </main>
  );
}
