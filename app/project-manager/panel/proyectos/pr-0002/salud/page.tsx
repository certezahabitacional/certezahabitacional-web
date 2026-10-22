import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { healthSnapshot as h } from "@/lib/project-manager/health-data";
import { PmHeader, card } from "@/app/project-manager/panel/_components";

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect("/project-manager/login");
  return (
    <main style={{minHeight:"100vh",background:"#06172c",color:"#fff"}}>
      <PmHeader title="Salud del Proyecto" subtitle="Diagnóstico integral de PR-0002 en seis dimensiones." />
      <section style={{maxWidth:1250,margin:"0 auto",padding:"0 22px 54px"}}>
        <div style={{...card,padding:26,display:"flex",justifyContent:"space-between",gap:20,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <div style={{color:"#8fa5bb",fontSize:12}}>CERTEZA PROJECT HEALTH INDEX</div>
            <div style={{fontSize:56,fontWeight:900,color:"#edcb71",lineHeight:1}}>{h.score}<span style={{fontSize:24}}>/100</span></div>
          </div>
          <div style={{maxWidth:620}}>
            <h2 style={{margin:"0 0 6px"}}>{h.status}</h2>
            <p style={{margin:0,color:"#aabaca",lineHeight:1.6}}>
              La salud es favorable en alcance, costo y cronograma; la atención debe concentrarse en riesgos, restricciones y recursos/suministros antes del arranque.
            </p>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12,marginTop:18}}>
          {h.dimensions.map(([name,score,status,note])=><div key={String(name)} style={card}>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}>
              <strong>{name}</strong>
              <span style={{color:status==="VERDE"?"#9fe0b5":"#f4c86d",fontWeight:900}}>{score}/100</span>
            </div>
            <div style={{height:8,background:"#06172c",borderRadius:999,margin:"12px 0"}}>
              <div style={{width:String(score)+"%",height:"100%",borderRadius:999,background:status==="VERDE"?"#4fb477":"#d6a746"}}/>
            </div>
            <p style={{margin:0,color:"#9fb2c6",lineHeight:1.5}}>{note}</p>
          </div>)}
        </div>
      </section>
    </main>
  );
}
