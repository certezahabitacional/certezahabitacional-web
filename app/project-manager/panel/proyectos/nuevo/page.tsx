import Link from "next/link";
import { requireProjectManagerDirector } from "@/lib/project-manager/access";
import { PmHeader, card } from "@/app/project-manager/panel/_components";
import { crearProyectoPM } from "./actions";

export default async function NuevoProyectoPage({searchParams}:{searchParams:Promise<{error?:string}>}) {
  await requireProjectManagerDirector();
  const q=await searchParams;

  const input={
    width:"100%",
    boxSizing:"border-box" as const,
    border:"1px solid #b8cad9",
    borderRadius:10,
    padding:"11px 12px",
    background:"#fff",
    color:"#082f64",
    fontSize:14,
  };

  return <main style={{minHeight:"100vh",background:"#eef6fb",color:"#082f64"}}>
    <PmHeader title="Nuevo proyecto" subtitle="Crear un proyecto nuevo dentro de Certeza Project Manager."/>
    <section style={{maxWidth:1050,margin:"0 auto",padding:"24px 22px 60px"}}>
      <div style={{...card,padding:26}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"start",flexWrap:"wrap"}}>
          <div>
            <h2 style={{margin:"0 0 6px"}}>Datos generales del proyecto</h2>
            <p style={{margin:0,color:"#294f73",fontWeight:600,lineHeight:1.55}}>
              El sistema generará automáticamente el siguiente código disponible PR-XXXX. Después podrás completar línea base, EDT, programa, presupuesto, riesgos y demás módulos.
            </p>
          </div>
          <Link href="/project-manager/panel/proyectos" style={{color:"#0a6fdc",fontWeight:900,textDecoration:"none"}}>← Volver a Proyectos</Link>
        </div>

        {q.error && <div style={{marginTop:18,background:"#fee4e2",color:"#b42318",padding:12,borderRadius:10,fontWeight:850}}>
          Revisa los datos obligatorios antes de guardar.
        </div>}

        <form action={crearProyectoPM} style={{display:"grid",gap:16,marginTop:24}}>
          <label style={{display:"grid",gap:6,fontWeight:850}}>Nombre del proyecto *
            <input name="nombre" required minLength={3} placeholder="Ej. Ampliación Planta Norte" style={input}/>
          </label>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <label style={{display:"grid",gap:6,fontWeight:850}}>Cliente
              <input name="cliente" placeholder="Empresa o propietario" style={input}/>
            </label>
            <label style={{display:"grid",gap:6,fontWeight:850}}>Ubicación
              <input name="ubicacion" placeholder="Ciudad, Estado" style={input}/>
            </label>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
            <label style={{display:"grid",gap:6,fontWeight:850}}>Fecha de inicio
              <input name="fechaInicio" type="date" style={input}/>
            </label>
            <label style={{display:"grid",gap:6,fontWeight:850}}>Fin planificado
              <input name="fechaFinPlan" type="date" style={input}/>
            </label>
            <label style={{display:"grid",gap:6,fontWeight:850}}>Presupuesto inicial
              <input name="presupuesto" type="number" min="0" step="0.01" placeholder="0.00" style={input}/>
            </label>
          </div>

          <label style={{display:"grid",gap:6,fontWeight:850}}>Descripción
            <textarea name="descripcion" rows={5} placeholder="Alcance general, objetivo y notas iniciales." style={{...input,resize:"vertical"}}/>
          </label>

          <div style={{display:"flex",justifyContent:"flex-end",gap:10,flexWrap:"wrap"}}>
            <Link href="/project-manager/panel/proyectos" style={{padding:"12px 18px",border:"1px solid #b8cad9",borderRadius:10,color:"#294f73",textDecoration:"none",fontWeight:850}}>Cancelar</Link>
            <button type="submit" style={{border:0,borderRadius:10,padding:"12px 20px",background:"#ff8500",color:"#fff",fontWeight:950,cursor:"pointer"}}>Crear proyecto</button>
          </div>
        </form>
      </div>
    </section>
  </main>
}
