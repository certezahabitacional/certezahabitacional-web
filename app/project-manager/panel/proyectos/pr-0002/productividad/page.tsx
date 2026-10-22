import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { productivityState } from "@/lib/project-manager/performance-data";
import { PmHeader, card } from "@/app/project-manager/panel/_components";

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect("/project-manager/login");
  return (
    <main style={{minHeight:"100vh",background:"#06172c",color:"#fff"}}>
      <PmHeader title="Productividad" subtitle="Rendimiento real de mano de obra, cuadrillas y equipo." />
      <section style={{maxWidth:1200,margin:"0 auto",padding:"0 22px 54px"}}>
        <div style={{...card,padding:26}}>
          <div style={{fontSize:44}}>⚙️</div>
          <h2 style={{margin:"10px 0 6px"}}>Sin datos de producción todavía</h2>
          <p style={{margin:0,color:"#aabaca",lineHeight:1.6}}>{productivityState.message}</p>
          <p style={{color:"#edcb71",fontWeight:900,marginBottom:0}}>Inicio planeado: {productivityState.plannedStart}</p>
        </div>
        <h2 style={{margin:"26px 0 12px"}}>Indicadores que se calcularán automáticamente</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
          {productivityState.measures.map((x,i)=><div key={x} style={card}><div style={{color:"#edcb71",fontWeight:900,fontSize:12}}>INDICADOR {String(i+1).padStart(2,"0")}</div><strong style={{display:"block",marginTop:8}}>{x}</strong></div>)}
        </div>
        <div style={{...card,marginTop:18}}>
          <h2 style={{marginTop:0}}>Lógica de control</h2>
          <p style={{color:"#aabaca",lineHeight:1.6,marginBottom:0}}>
            Certeza comparará rendimiento planeado contra real. Una caída sostenida de productividad podrá generar alerta aun cuando el costo total todavía no muestre sobrecosto.
          </p>
        </div>
      </section>
    </main>
  );
}
