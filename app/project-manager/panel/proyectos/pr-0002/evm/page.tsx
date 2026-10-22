import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { money } from "@/lib/project-manager/pr0002";
import { performanceSnapshot as s, calculateEvm } from "@/lib/project-manager/performance-data";
import { PmHeader, card } from "@/app/project-manager/panel/_components";

const evm = calculateEvm({bac:s.bac,pv:s.pv,ev:s.ev,ac:s.ac});

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect("/project-manager/login");
  const metrics = [
    ["BAC","Presupuesto al completar",money(s.bac)],
    ["PV","Valor planeado",money(s.pv)],
    ["EV","Valor ganado",money(s.ev)],
    ["AC","Costo real",money(s.ac)],
    ["SPI","Índice de plazo",evm.spi===null?"Sin corte":evm.spi.toFixed(2)],
    ["CPI","Índice de costo",evm.cpi===null?"Sin corte":evm.cpi.toFixed(2)],
    ["SV","Variación de plazo",money(evm.sv)],
    ["CV","Variación de costo",money(evm.cv)],
  ];
  return (
    <main style={{minHeight:"100vh",background:"#06172c",color:"#fff"}}>
      <PmHeader title="Valor Ganado (EVM)" subtitle="Control integrado de avance, plazo y costo." />
      <section style={{maxWidth:1300,margin:"0 auto",padding:"0 22px 54px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
          {metrics.map(([code,label,value])=><div key={code} style={card}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><strong style={{color:"#edcb71"}}>{code}</strong><span style={{color:"#8fa5bb",fontSize:12}}>{label}</span></div><div style={{fontSize:24,fontWeight:900,marginTop:10}}>{value}</div></div>)}
        </div>
        <div style={{...card,marginTop:18,padding:24}}>
          <h2 style={{marginTop:0}}>Estado actual</h2>
          <p style={{color:"#aabaca",lineHeight:1.6}}>
            No se muestran SPI ni CPI porque todavía no existen PV, EV y AC de un corte real. Mostrar 0.00 sería técnicamente incorrecto y podría interpretarse como desempeño crítico.
          </p>
          <p style={{marginBottom:0,color:"#d6c99e"}}><b>Regla Certeza:</b> si no hay base suficiente para un indicador, el sistema debe mostrar “Sin corte” o “Datos insuficientes”, no inventar una conclusión.</p>
        </div>
        <div style={{...card,marginTop:18}}>
          <h2 style={{marginTop:0}}>Motor matemático</h2>
          <p style={{color:"#9fb2c6",lineHeight:1.7,marginBottom:0}}>
            SPI = EV / PV · CPI = EV / AC · SV = EV − PV · CV = EV − AC · EAC = BAC / CPI cuando exista CPI válido.
          </p>
        </div>
      </section>
    </main>
  );
}
