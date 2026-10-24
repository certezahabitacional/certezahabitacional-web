import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";
import { PmHeader, card } from "@/app/project-manager/panel/_components";

function money(value:number){
  return new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0}).format(value);
}

export default async function GenericProjectPage({params,searchParams}:{params:Promise<{codigo:string}>;searchParams:Promise<{creado?:string}>}) {
  const { session, role, readOnly }=await requireProjectManagerAccess();
  const {codigo}=await params;
  const q=await searchParams;
  const userId=String((session.user as {id?:string}).id ?? "");
  const code=codigo.toUpperCase();

  const proyecto=await prisma.proyectoPM.findUnique({
    where:{codigo:code},
    include:{participantes:{where:{usuarioId:userId},select:{id:true}}},
  });
  if(!proyecto || !proyecto.activo) notFound();

  const tieneAcceso=role==="DIRECTOR" || role==="ADMINISTRADOR" || proyecto.participantes.length>0;
  if(!tieneAcceso) notFound();

  return <main style={{minHeight:"100vh",background:"#eef6fb",color:"#082f64"}}>
    <PmHeader title={`${proyecto.codigo} · ${proyecto.nombre}`} subtitle="Proyecto seleccionado. Desde aquí se configura y opera el expediente del proyecto."/>
    <section style={{maxWidth:1300,margin:"0 auto",padding:"24px 22px 60px"}}>
      {q.creado&&<div style={{background:"#dcfae6",color:"#137a42",padding:14,borderRadius:10,fontWeight:900,marginBottom:16}}>Proyecto creado correctamente.</div>}
      {readOnly&&<div style={{background:"#e8f3fb",color:"#082f64",padding:14,borderRadius:10,fontWeight:900,marginBottom:16}}>CLIENTE · SÓLO LECTURA</div>}

      <div style={{display:"grid",gridTemplateColumns:"1.3fr .7fr",gap:16}}>
        <article style={{...card,padding:24}}>
          <h2 style={{marginTop:0}}>Datos generales</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
            {[
              ["Cliente",proyecto.cliente || "Por definir"],
              ["Ubicación",proyecto.ubicacion || "Por definir"],
              ["Estado",proyecto.estado],
              ["Presupuesto",money(Number(proyecto.presupuesto))],
              ["Fecha de inicio",proyecto.fechaInicio?.toISOString().slice(0,10) || "Por definir"],
              ["Fin planificado",proyecto.fechaFinPlan?.toISOString().slice(0,10) || "Por definir"],
            ].map(([k,v])=><div key={k} style={{background:"#f5faff",border:"1px solid #d8e6f2",borderRadius:10,padding:12}}>
              <div style={{fontSize:12,color:"#294f73",fontWeight:800}}>{k}</div><strong>{v}</strong>
            </div>)}
          </div>
          {proyecto.descripcion&&<p style={{color:"#294f73",lineHeight:1.6,marginBottom:0}}>{proyecto.descripcion}</p>}
        </article>

        <aside style={{...card,padding:24}}>
          <h2 style={{marginTop:0}}>Configuración inicial</h2>
          <p style={{color:"#294f73",lineHeight:1.55}}>El siguiente paso es integrar la información base del proyecto antes de activar sus indicadores operativos.</p>
          <ol style={{paddingLeft:20,lineHeight:1.9,fontWeight:700}}>
            <li>Completar Constructibilidad</li>
            <li>Generar Documentos Maestros</li>
            <li>Integrar información inicial</li>
            <li>Aprobar Línea Base Definitiva</li>
            <li>Crear EDT</li>
            <li>Cargar programa</li>
            <li>Cargar presupuesto</li>
            <li>Asignar participantes y permisos</li>
            <li>Aprobar línea base</li>
          </ol>
        </aside>
      </div>

      <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad`} style={{...card,marginTop:16,padding:24,display:"block",textDecoration:"none",color:"#082f64",border:"2px solid #ff8500",background:"linear-gradient(135deg,#fff8ef,#ffffff)"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:12,fontWeight:950,color:"#c86100",letterSpacing:".08em"}}>PASO MAESTRO DE CONFIGURACIÓN</div>
            <h2 style={{margin:"6px 0 6px"}}>🏗️ Constructibilidad</h2>
            <p style={{margin:0,color:"#294f73",lineHeight:1.55,maxWidth:850}}>Define, desde la condición del predio hasta la entrega, qué módulos, entregables, liberaciones y controles necesita este proyecto antes de integrar su Expediente Maestro y seguimiento.</p>
          </div>
          <span style={{background:"#ff8500",color:"#fff",padding:"11px 15px",borderRadius:9,fontWeight:950}}>Abrir Constructibilidad →</span>
        </div>
      </Link>

      <Link href={`/project-manager/panel/proyectos/${codigo}/documentos-maestros`} style={{...card,marginTop:16,padding:24,display:"block",textDecoration:"none",color:"#082f64",border:"2px solid #0b73ba",background:"linear-gradient(135deg,#eef8ff,#ffffff)"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:12,fontWeight:950,color:"#0b73ba",letterSpacing:".08em"}}>ALIMENTACIÓN AUTOMÁTICA DEL PROYECTO</div>
            <h2 style={{margin:"6px 0 6px"}}>📚 Documentos Maestros</h2>
            <p style={{margin:0,color:"#294f73",lineHeight:1.55,maxWidth:850}}>Programas, matrices y documentos estructurados generados desde Constructibilidad. Alimentan automáticamente los módulos y permiten agregar actividades manualmente.</p>
          </div>
          <span style={{background:"#0b73ba",color:"#fff",padding:"11px 15px",borderRadius:9,fontWeight:950}}>Abrir Documentos Maestros →</span>
        </div>
      </Link>

      <Link href={`/project-manager/panel/proyectos/${codigo}/linea-base`} style={{...card,marginTop:16,padding:24,display:"block",textDecoration:"none",color:"#082f64",border:"2px solid #1f9d55",background:"linear-gradient(135deg,#effaf3,#ffffff)"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:12,fontWeight:950,color:"#187342",letterSpacing:".08em"}}>REFERENCIA OFICIAL DE CONTROL</div>
            <h2 style={{margin:"6px 0 6px"}}>📌 Línea Base Definitiva</h2>
            <p style={{margin:0,color:"#294f73",lineHeight:1.55,maxWidth:850}}>Congela alcance, presupuesto, programa, estructura y condiciones aprobadas para medir toda la ejecución y administrar cambios autorizados.</p>
          </div>
          <span style={{background:"#1f9d55",color:"#fff",padding:"11px 15px",borderRadius:9,fontWeight:950}}>Abrir Línea Base →</span>
        </div>
      </Link>

      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12,marginTop:16}}>
        <Link href={`/project-manager/panel/proyectos/${codigo}/modulos`} style={{...card,padding:20,textDecoration:"none",color:"#082f64",border:"2px solid #1f9d55"}}>
          <div style={{fontSize:12,fontWeight:950,color:"#187342"}}>OPERACIÓN</div>
          <h2 style={{margin:"5px 0"}}>Módulos operativos</h2>
          <p style={{margin:0,color:"#294f73"}}>Consulta cómo los Documentos Maestros alimentaron Programa, Costos, Riesgos, Liberaciones y demás módulos.</p>
        </Link>
        <Link href={`/project-manager/panel/proyectos/${codigo}/seguimiento`} style={{...card,padding:20,textDecoration:"none",color:"#082f64",border:"2px solid #0b73ba"}}>
          <div style={{fontSize:12,fontWeight:950,color:"#0b73ba"}}>SEGUIMIENTO</div>
          <h2 style={{margin:"5px 0"}}>Qué actualizar</h2>
          <p style={{margin:0,color:"#294f73"}}>Agenda automática de actualizaciones diarias, semanales, mensuales, por evento o por estimación.</p>
        </Link>
      </div>

      <div style={{...card,marginTop:16,padding:24}}>
        <h2 style={{marginTop:0}}>Módulos del proyecto</h2>
        <p style={{color:"#294f73"}}>Estos módulos se activarán con la configuración del proyecto. PR-0002 conserva los módulos completos de demostración.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
          {["Línea Base","EDT","Programa","Presupuesto","Riesgos","Restricciones","Cambios","Decisiones","Avance","Productividad","EVM","Forecast","Salud","Alertas","Reportes"].map(x=><div key={x} style={{border:"1px solid #d8e6f2",borderRadius:10,padding:14,background:"#fff",fontWeight:850}}>{x}</div>)}
        </div>
      </div>

      <div style={{display:"flex",gap:10,marginTop:18,flexWrap:"wrap"}}>
        <Link href="/project-manager/panel/proyectos" style={{background:"#053f79",color:"#fff",textDecoration:"none",fontWeight:900,padding:"11px 15px",borderRadius:9}}>← Volver a Proyectos</Link>
        <Link href={`/project-manager/panel/proyectos/equipo?codigo=${proyecto.codigo}`} style={{background:"#ff8500",color:"#fff",textDecoration:"none",fontWeight:900,padding:"11px 15px",borderRadius:9}}>Participantes / Equipo</Link>
        <Link href="/project-manager/panel" style={{border:"1px solid #b8cad9",color:"#294f73",textDecoration:"none",fontWeight:900,padding:"11px 15px",borderRadius:9}}>Centro de Control general</Link>
      </div>
    </section>
  </main>
}
