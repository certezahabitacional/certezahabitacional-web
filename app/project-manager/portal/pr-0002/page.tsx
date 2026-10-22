import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { money } from "@/lib/project-manager/pr0002";
import { performanceSnapshot as p } from "@/lib/project-manager/performance-data";
import { healthSnapshot as h } from "@/lib/project-manager/health-data";
import { PmHeader, card } from "@/app/project-manager/panel/_components";

export default async function Page() {
  const session=await auth();
  if(!session?.user) redirect("/project-manager/login");
  return (
    <main style={{minHeight:"100vh",background:"#06172c",color:"#fff"}}>
      <PmHeader title="Portal del Cliente · PR-0002" subtitle="Vista externa controlada del proyecto." />
      <section style={{maxWidth:1250,margin:"0 auto",padding:"0 22px 54px"}}>
        <div style={{...card,padding:24,border:"1px solid rgba(237,203,113,.28)"}}>
          <div style={{color:"#edcb71",fontSize:12,fontWeight:900}}>VISTA DE CLIENTE</div>
          <h2 style={{margin:"7px 0 6px"}}>Información autorizada únicamente</h2>
          <p style={{margin:0,color:"#365b7d",lineHeight:1.6}}>
            Esta vista no expone información interna completa. Cada proyecto definirá qué secciones puede consultar el cliente y si puede comentar, descargar o aprobar.
          </p>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginTop:18}}>
          {[
            ["Presupuesto base",money(p.bac)],
            ["Avance","0.00%"],
            ["Forecast",p.forecastFinish],
            ["Salud",String(h.score)+"/100"],
            ["Estado","PLANEACIÓN"],
            ["Riesgo","MEDIO"],
          ].map(([k,v])=><div key={k} style={card}><div style={{color:"#b9dbf5",fontSize:12}}>{k}</div><strong style={{display:"block",fontSize:21,marginTop:5}}>{v}</strong></div>)}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:14,marginTop:18}}>
          <section style={card}>
            <h2 style={{marginTop:0}}>📅 Programa e hitos</h2>
            <p style={{color:"#365b7d",lineHeight:1.55}}>Vista resumida de hitos contractuales y fecha de término proyectada.</p>
            <div style={{background:"#06172c",color:"#ffffff",padding:12,borderRadius:10}}>Término contractual: <b>30/06/2027</b></div>
          </section>

          <section style={card}>
            <h2 style={{marginTop:0}}>⚠️ Riesgos relevantes</h2>
            <p style={{color:"#365b7d",lineHeight:1.55}}>Sólo riesgos autorizados para comunicación externa.</p>
            <div style={{background:"#06172c",color:"#ffffff",padding:12,borderRadius:10}}>2 riesgos de atención prioritaria</div>
          </section>

          <section style={card}>
            <h2 style={{marginTop:0}}>📂 Documentos compartidos</h2>
            <p style={{color:"#365b7d",lineHeight:1.55}}>Los documentos serán internos por defecto y sólo aparecerán aquí cuando se autorice su publicación.</p>
            <div style={{background:"#06172c",color:"#ffffff",padding:12,borderRadius:10,color:"#476987"}}>Sin documentos compartidos todavía.</div>
          </section>

          <section style={card}>
            <h2 style={{marginTop:0}}>✅ Solicitudes por aprobar</h2>
            <p style={{color:"#365b7d",lineHeight:1.55}}>Sólo visibles para CLIENTE_AUTORIZADOR.</p>
            <div style={{background:"#06172c",color:"#ffffff",padding:12,borderRadius:10,color:"#476987"}}>Sin solicitudes externas activas.</div>
          </section>
        </div>

        <div style={{...card,marginTop:18}}>
          <h2 style={{marginTop:0}}>Permisos de cliente previstos</h2>
          <div style={{display:"grid",gap:8}}>
            {[
              ["CLIENTE_CONSULTA","Ver"],
              ["CLIENTE_PARTICIPANTE","Ver · Descargar · Comentar"],
              ["CLIENTE_AUTORIZADOR","Ver · Descargar · Comentar · Aprobar/Rechazar"],
            ].map(([role,perm])=><div key={role} style={{display:"flex",justifyContent:"space-between",gap:12,background:"#06172c",color:"#ffffff",padding:12,borderRadius:10}}><strong>{role}</strong><span style={{color:"#edcb71"}}>{perm}</span></div>)}
          </div>
        </div>

        <div style={{marginTop:18}}>
          <Link href="/project-manager/panel/accesos" style={{color:"#edcb71",fontWeight:900,textDecoration:"none"}}>Administrar accesos del proyecto →</Link>
        </div>
      </section>
    </main>
  );
}
