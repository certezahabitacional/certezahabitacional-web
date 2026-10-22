import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { pr0002, money } from "@/lib/project-manager/pr0002";
import { PmHeader, card } from "@/app/project-manager/panel/_components";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user) redirect("/project-manager/login");
  const p = pr0002.project;
  return (
    <main style={{ minHeight:"100vh", background:"#06172c", color:"#fff" }}>
      <PmHeader title="Proyectos" subtitle="Portafolio operativo de Certeza Project Manager." />
      <section style={{ maxWidth:1440, margin:"0 auto", padding:"0 22px 54px" }}>
        <article style={{...card, padding:24}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:18,flexWrap:"wrap",alignItems:"start"}}>
            <div>
              <p style={{margin:0,color:"#edcb71",fontWeight:900}}>{p.code}</p>
              <h2 style={{margin:"6px 0",fontSize:28}}>{p.name}</h2>
              <p style={{margin:0,color:"#9fb2c6"}}>{p.client} · {p.location}</p>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:12,color:"#8fa5bb"}}>PRESUPUESTO</div>
              <strong style={{fontSize:24}}>{money(p.budget)}</strong>
              <div style={{marginTop:6,color:"#f4c86d",fontWeight:800}}>{p.status}</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginTop:22}}>
            {[["Inicio",p.startDate],["Término contractual",p.targetDate],["Responsable",p.manager],["Riesgo",p.riskLevel]].map(([k,v])=><div key={k} style={{background:"#06172c",padding:14,borderRadius:12}}><div style={{fontSize:12,color:"#8fa5bb"}}>{k}</div><strong>{v}</strong></div>)}
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:22}}>
            <Link href="/project-manager/panel/proyectos/pr-0002" style={{background:"#edcb71",color:"#071d38",textDecoration:"none",fontWeight:900,padding:"12px 18px",borderRadius:10}}>Abrir proyecto →</Link>
          </div>
        </article>
      </section>
    </main>
  );
}
