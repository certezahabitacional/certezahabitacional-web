import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { pr0002, money } from "@/lib/project-manager/pr0002";
import { PmHeader, card } from "@/app/project-manager/panel/_components";

export default async function Page() {
  const session=await auth();
  if(!session?.user) redirect("/project-manager/login");
  return (
    <main style={{minHeight:"100vh",background:"#06172c",color:"#fff"}}>
      <PmHeader title="Captura de Corte" subtitle="Avance, productividad, costos reales y evidencias en un solo flujo." />
      <section style={{maxWidth:1300,margin:"0 auto",padding:"0 22px 54px"}}>
        <div style={{...card,padding:24,border:"1px solid rgba(237,203,113,.3)"}}>
          <div style={{color:"#edcb71",fontWeight:900,fontSize:12}}>MODO PREVIEW SEGURO</div>
          <h2 style={{margin:"7px 0 6px"}}>Flujo de captura preparado</h2>
          <p style={{margin:0,color:"#aabaca",lineHeight:1.6}}>Las pantallas ya están listas para revisión. El botón Guardar permanecerá deshabilitado hasta completar la conexión de escritura contra Supabase DEV; producción no será utilizada para estas pruebas.</p>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:14,marginTop:18}}>
          {[
            ["1","Fecha de corte","Seleccionar el periodo de control que se va a cerrar."],
            ["2","Avance por actividad","Capturar cantidad ejecutada y porcentaje real por actividad."],
            ["3","Productividad","Capturar HH, cuadrilla, equipo, improductividad y retrabajo."],
            ["4","Costos reales","Registrar AC por EDT/actividad y referencia documental."],
            ["5","Evidencias","Adjuntar notas, fotografías o documentos del corte."],
            ["6","Cerrar corte","Calcular EVM, Forecast, Salud y Alertas."],
          ].map(([n,t,d])=><div key={n} style={card}><div style={{color:"#edcb71",fontWeight:900}}>PASO {n}</div><h3 style={{margin:"8px 0 6px"}}>{t}</h3><p style={{margin:0,color:"#9fb2c6",lineHeight:1.5}}>{d}</p></div>)}
        </div>

        <section style={{...card,marginTop:18}}>
          <h2 style={{marginTop:0}}>Actividades disponibles · PR-0002</h2>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:880}}>
              <thead><tr>{["Código","Actividad","EDT","Inicio","Fin","Cantidad real","HH reales","Costo real"].map(h=><th key={h} style={{textAlign:"left",padding:11,color:"#edcb71",borderBottom:"1px solid rgba(255,255,255,.12)"}}>{h}</th>)}</tr></thead>
              <tbody>{pr0002.activities.map(([code,name,start,end,wbs])=><tr key={code}>
                <td style={{padding:11,borderBottom:"1px solid rgba(255,255,255,.07)",fontWeight:900}}>{code}</td>
                <td style={{padding:11,borderBottom:"1px solid rgba(255,255,255,.07)"}}>{name}</td>
                <td style={{padding:11,borderBottom:"1px solid rgba(255,255,255,.07)"}}>{wbs}</td>
                <td style={{padding:11,borderBottom:"1px solid rgba(255,255,255,.07)"}}>{start}</td>
                <td style={{padding:11,borderBottom:"1px solid rgba(255,255,255,.07)"}}>{end}</td>
                <td style={{padding:11,borderBottom:"1px solid rgba(255,255,255,.07)",color:"#8fa5bb"}}>—</td>
                <td style={{padding:11,borderBottom:"1px solid rgba(255,255,255,.07)",color:"#8fa5bb"}}>—</td>
                <td style={{padding:11,borderBottom:"1px solid rgba(255,255,255,.07)",color:"#8fa5bb"}}>{money(0)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>

        <div style={{display:"flex",justifyContent:"flex-end",marginTop:18}}>
          <button disabled style={{border:0,borderRadius:12,padding:"14px 22px",fontWeight:900,background:"#8b94a0",color:"#d8dee6",cursor:"not-allowed"}}>Guardar corte (pendiente de conexión DEV)</button>
        </div>
      </section>
    </main>
  );
}
