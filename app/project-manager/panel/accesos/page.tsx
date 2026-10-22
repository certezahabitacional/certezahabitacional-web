import { requireProjectManagerAdmin } from "@/lib/project-manager/access";
import { PmHeader, card } from "@/app/project-manager/panel/_components";

const roles=[
  ["DIRECTOR","Director","Acceso total a todos los proyectos y funciones."],
  ["ADMINISTRADOR","Administrador","Alimentación y retroalimentación administrativa, contable y de costos."],
  ["GERENTE / COORDINADOR / SUPERVISOR / RESIDENTE","Equipo operativo","Acceso de trabajo únicamente a proyectos asignados."],
  ["CLIENTE","Cliente · sólo lectura","Consulta total del proyecto asignado, desde indicadores ejecutivos hasta el detalle, sin facultad de modificar."],
];

export default async function Page(){
 await requireProjectManagerAdmin();
 return <main style={{minHeight:"100vh",background:"#06172c",color:"#fff"}}>
  <PmHeader title="Accesos por Proyecto" subtitle="Cada usuario sólo debe ver los proyectos y funciones expresamente autorizados."/>
  <section style={{maxWidth:1200,margin:"0 auto",padding:"0 22px 54px"}}>
   <div style={{...card,padding:24}}>
    <h2 style={{marginTop:0}}>PR-0002</h2>
    <p style={{color:"#294f73",lineHeight:1.6,marginBottom:0}}>El modelo de permisos ya está definido en DEV. Ningún usuario externo obtendrá acceso por su rol global de Certeza Habitacional; el permiso será siempre explícito por proyecto.</p>
   </div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12,marginTop:18}}>
    {roles.map(([code,title,desc])=><div key={code} style={card}><div style={{color:"#c86100",fontSize:12,fontWeight:900}}>{code}</div><h3 style={{margin:"8px 0 5px"}}>{title}</h3><p style={{margin:0,color:"#294f73",lineHeight:1.5}}>{desc}</p></div>)}
   </div>
  </section>
 </main>
}
