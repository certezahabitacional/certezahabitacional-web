import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

const services=[
"Supervisión técnica de obra",
"Supervisión de calidad",
"Auditoría de obra",
"Auditoría de estimaciones y generadores",
"Auditoría de costos",
"Auditoría de avance físico-financiero",
"Auditoría contractual",
"Auditoría documental",
"Diagnóstico de obra en proceso",
"Cierre y recepción de obra",
];

const modules=[
["Hallazgos","Registro con fotografía, ubicación, criticidad, responsable y fecha compromiso."],
["Calidad","Inspecciones, cumplimiento de especificaciones y evidencias de corrección."],
["Auditoría de estimaciones","Cruce de cantidades, generadores, avance y autorización."],
["Auditoría de costos","Comparación presupuesto, comprometido, ejercido y pronóstico."],
["Auditoría contractual","Contratos, alcances, cambios, obligaciones y cumplimiento."],
["Cierre y recepción","Pendientes, punch list, evidencias, entrega y cierre documental."],
];

export default async function SupervisionAuditoriaPage(){
 const session=await auth();
 if(!session?.user) redirect("/certeza-tecnica/login?callbackUrl=%2Fcerteza-tecnica%2Fapp%2Fsupervision-auditoria");
 return <main style={{minHeight:"100vh",background:"#f7f5fb",color:"#2d2550"}}>
  <header style={{background:"linear-gradient(100deg,#3f1476,#7728c8)",color:"#fff",padding:"22px"}}>
   <div style={{maxWidth:1300,margin:"0 auto"}}>
    <Link href="/certeza-tecnica/app" style={{color:"#fff",textDecoration:"none",fontWeight:800}}>← Certeza Técnica 360</Link>
    <h1 style={{fontSize:"clamp(30px,5vw,48px)",margin:"12px 0 4px"}}>Supervisión y Auditoría</h1>
    <p style={{margin:0,fontSize:18}}>Verifica, asegura y da cumplimiento.</p>
   </div>
  </header>
  <div style={{maxWidth:1300,margin:"0 auto",padding:22}}>
   <section style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
    <article style={box}><h2 style={{marginTop:0}}>Servicios del portafolio</h2>{services.map(x=><div key={x} style={row}>✓ {x}</div>)}</article>
    <article style={box}><h2 style={{marginTop:0}}>Módulos del sistema</h2>{modules.map(([a,b])=><div key={a} style={{padding:"10px 0",borderBottom:"1px solid #ebe5f2"}}><b>{a}</b><div style={{fontSize:13,color:"#6b6380",marginTop:3}}>{b}</div></div>)}</article>
   </section>
   <section style={{...box,marginTop:16,background:"#faf6ff",borderColor:"#d8bdf0"}}><b>Fase actual:</b> estructura funcional creada. El siguiente paso será registrar hallazgos y auditorías directamente contra el proyecto, presupuesto y programa existentes.</section>
  </div>
  <style>{`@media(max-width:760px){section[style*="1fr 1fr"]{grid-template-columns:1fr !important}}`}</style>
 </main>
}
const box={background:"#fff",border:"1px solid #e0d8e9",borderRadius:16,padding:20,boxShadow:"0 6px 18px rgba(51,28,83,.06)"} as const;
const row={padding:"9px 0",borderBottom:"1px solid #f0ebf4",fontWeight:700} as const;
