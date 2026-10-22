import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { money } from "@/lib/project-manager/pr0002";
import { PmHeader, card } from "@/app/project-manager/panel/_components";

const projects = [
  {code:"PR-0001",name:"Edificio Administrativo Certeza – 2 niveles",budget:11800000,status:"ACTIVO",health:"Sin corte web",risk:"BAJO",href:"#"},
  {code:"PR-0002",name:"Centro Logístico Certeza – Nave Industrial 1,500 m²",budget:24600000,status:"PLANEACIÓN",health:"82/100",risk:"MEDIO",href:"/project-manager/panel/proyectos/pr-0002/resumen"},
];

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect("/project-manager/login");
  const total=projects.reduce((a,p)=>a+p.budget,0);
  return (
    <main style={{minHeight:"100vh",background:"#06172c",color:"#fff"}}>
      <PmHeader title="Portafolio" subtitle="Visibilidad ejecutiva de múltiples proyectos con una sola lógica de control." />
      <section style={{maxWidth:1300,margin:"0 auto",padding:"0 22px 54px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12}}>
          {[["Proyectos","2"],["Presupuesto total",money(total)],["Con salud web","1"],["En migración","1"]].map(([k,v])=><div key={k} style={card}><div style={{color:"#8fa5bb",fontSize:12}}>{k}</div><strong style={{fontSize:24}}>{v}</strong></div>)}
        </div>
        <div style={{display:"grid",gap:12,marginTop:18}}>
          {projects.map(p=><article key={p.code} style={{...card,padding:22}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:18,alignItems:"start",flexWrap:"wrap"}}>
              <div><div style={{color:"#edcb71",fontWeight:900}}>{p.code}</div><h2 style={{margin:"5px 0"}}>{p.name}</h2><div style={{color:"#9fb2c6"}}>{p.status} · Riesgo {p.risk}</div></div>
              <div style={{textAlign:"right"}}><div style={{fontSize:12,color:"#8fa5bb"}}>PRESUPUESTO</div><strong style={{fontSize:22}}>{money(p.budget)}</strong><div style={{marginTop:5,color:"#f4c86d"}}>Salud: {p.health}</div></div>
            </div>
            {p.href!=="#" ? <Link href={p.href} style={{display:"inline-block",marginTop:14,color:"#edcb71",fontWeight:900,textDecoration:"none"}}>Abrir proyecto →</Link> : <div style={{marginTop:14,color:"#8fa5bb"}}>Pendiente de migración web completa.</div>}
          </article>)}
        </div>
      </section>
    </main>
  );
}
