import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

const services=[
"Evaluación técnico-económica",
"Planeación integral del proyecto",
"Coordinación multidisciplinaria",
"Ingeniería de valor",
"Estrategia de contratación y ejecución",
"Dirección integral del proyecto",
"Gestión de riesgos y toma de decisiones",
"Capacitación técnica y desarrollo de competencias profesionales",
"Consultoría",
];

const modules=[
["Evaluación inicial","Viabilidad técnica, económica, documental y operativa del proyecto."],
["Libro de decisiones","Decisiones, responsable, fecha límite, impacto en costo y plazo, y estado."],
["Riesgos directivos","Riesgos estratégicos, respuesta, responsable y decisión asociada."],
["Ingeniería de valor","Alternativas con comparación de costo, plazo, desempeño y beneficio."],
["Estrategia de contratación","Paquetes, modalidad, alcance y criterios de contratación."],
["Capacitación y consultoría","Servicios de desarrollo técnico, asesoría y competencias profesionales."],
];

export default async function DireccionDesarrolloPage(){
 const session=await auth();
 if(!session?.user) redirect("/certeza-tecnica/login?callbackUrl=%2Fcerteza-tecnica%2Fapp%2Fdireccion-desarrollo");
 return <main style={{minHeight:"100vh",background:"#f5f7f9",color:"#183653"}}>
  <header style={{background:"linear-gradient(100deg,#8d240d,#e85a13)",color:"#fff",padding:"22px"}}>
   <div style={{maxWidth:1300,margin:"0 auto"}}>
    <Link href="/certeza-tecnica/app" style={{color:"#fff",textDecoration:"none",fontWeight:800}}>← Certeza Técnica 360</Link>
    <h1 style={{fontSize:"clamp(30px,5vw,48px)",margin:"12px 0 4px"}}>Dirección y Desarrollo</h1>
    <p style={{margin:0,fontSize:18}}>Define el rumbo, alinea decisiones y genera valor.</p>
   </div>
  </header>
  <div style={{maxWidth:1300,margin:"0 auto",padding:22}}>
   <section style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
    <article style={box}><h2 style={{marginTop:0}}>Servicios del portafolio</h2>{services.map(x=><div key={x} style={row}>✓ {x}</div>)}</article>
    <article style={box}><h2 style={{marginTop:0}}>Módulos del sistema</h2>{modules.map(([a,b])=><div key={a} style={{padding:"10px 0",borderBottom:"1px solid #e7edf2"}}><b>{a}</b><div style={{fontSize:13,color:"#61778a",marginTop:3}}>{b}</div></div>)}</article>
   </section>
   <section style={{...box,marginTop:16,background:"#fff8f3",borderColor:"#efc3aa"}}><b>Fase actual:</b> estructura funcional creada. El siguiente paso será conectar estos módulos al proyecto único y su expediente maestro.</section>
  </div>
  <style>{`@media(max-width:760px){section[style*="1fr 1fr"]{grid-template-columns:1fr !important}}`}</style>
 </main>
}
const box={background:"#fff",border:"1px solid #dae5ed",borderRadius:16,padding:20,boxShadow:"0 6px 18px rgba(17,49,76,.06)"} as const;
const row={padding:"9px 0",borderBottom:"1px solid #edf1f4",fontWeight:700} as const;
