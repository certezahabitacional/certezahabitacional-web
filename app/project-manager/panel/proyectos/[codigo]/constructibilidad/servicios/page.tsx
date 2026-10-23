import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";
import { pr0002 } from "@/lib/project-manager/pr0002";
import { PmHeader, card } from "@/app/project-manager/panel/_components";
import { guardarServiciosConstructibilidad } from "./actions";

function asObj(v:unknown){return (v&&typeof v==="object"&&!Array.isArray(v)?v:{}) as Record<string,unknown>;}
function asList(v:unknown){return Array.isArray(v)?v.map(String):[];}

const services=[
  ["agua","Agua potable"],
  ["drenaje","Drenaje sanitario"],
  ["pluvial","Drenaje pluvial"],
  ["electricidad","Electricidad"],
  ["gas","Gas"],
  ["telecomunicaciones","Telecomunicaciones"],
  ["vialidades","Vialidades / accesos"],
  ["alumbrado","Alumbrado público"],
] as const;

export default async function ServiciosConstructibilidadPage({params,searchParams}:{params:Promise<{codigo:string}>;searchParams:Promise<{guardado?:string}>}) {
  const {session,role,readOnly}=await requireProjectManagerAccess();
  const {codigo}=await params;
  const q=await searchParams;
  const code=codigo.toUpperCase();
  const userId=String((session.user as {id?:string}).id ?? "");

  const proyecto=await prisma.proyectoPM.findUnique({
    where:{codigo:code},
    include:{participantes:{where:{usuarioId:userId},select:{id:true}},constructibilidad:true},
  });
  const legacy=code==="PR-0002"&&!proyecto;
  if(!proyecto&&!legacy) notFound();
  if(proyecto){
    const ok=role==="DIRECTOR"||role==="ADMINISTRADOR"||proyecto.participantes.length>0;
    if(!ok||!proyecto.activo) notFound();
  } else if(role!=="DIRECTOR"&&role!=="ADMINISTRADOR") notFound();

  const nombre=proyecto?.nombre ?? pr0002.project.name;
  const data=proyecto?.constructibilidad;
  const svc=asObj(data?.serviciosInfraestructura);
  const obras=asList(data?.obrasEspecialesSugeridas);
  const entregables=asList(data?.entregablesPaso3);
  const riesgos=asList(data?.riesgosPaso3);
  const progreso=data?.progresoPaso3 ?? 0;

  return <main style={{minHeight:"100vh",background:"#eef6fb",color:"#082f64"}}>
    <PmHeader title="Constructibilidad · Paso 3" subtitle={`${code} · ${nombre} · Factibilidad de servicios e infraestructura`}/>
    <section style={{maxWidth:1450,margin:"0 auto",padding:"20px 20px 60px"}}>
      {q.guardado&&<div style={{...card,marginBottom:14,background:"#e7f7ee",color:"#187342",fontWeight:900}}>Paso 3 guardado correctamente.</div>}
      {readOnly&&<div style={{...card,marginBottom:14,background:"#e8f3fb",fontWeight:900}}>CLIENTE · SÓLO LECTURA</div>}
      {legacy&&<div style={{...card,marginBottom:14,background:"#fff5dd",color:"#8a5b00",fontWeight:800}}>PR-0002 requiere completar su migración para guardar esta información.</div>}

      <div style={{...card,padding:20,border:"2px solid #ff8500"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:20,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:12,fontWeight:950,color:"#c86100"}}>PASO 3</div>
            <h1 style={{margin:"5px 0 7px",fontSize:28}}>¿Qué servicios existen, cuáles son suficientes y qué infraestructura falta?</h1>
            <p style={{margin:0,color:"#4a657d",lineHeight:1.55}}>El sistema traduce las factibilidades en obras, riesgos, entregables y módulos específicos para el proyecto.</p>
          </div>
          <div style={{minWidth:170}}>
            <div style={{fontSize:11,fontWeight:900}}>AVANCE</div>
            <div style={{height:12,borderRadius:99,background:"#e3ebf1",overflow:"hidden",marginTop:7}}><div style={{height:"100%",width:`${progreso}%`,background:progreso>=80?"#1f9d55":progreso>=50?"#e6a700":"#d63c3c"}}/></div>
            <div style={{fontSize:24,fontWeight:950,marginTop:5}}>{progreso}%</div>
          </div>
        </div>
      </div>

      <form action={guardarServiciosConstructibilidad} style={{marginTop:14}}>
        <input type="hidden" name="codigo" value={code}/>
        <div style={{display:"grid",gap:12}}>
          {services.map(([key,label])=>{
            const s=asObj(svc[key]);
            return <article key={key} style={{...card,padding:17}}>
              <div style={{display:"grid",gridTemplateColumns:"1.1fr 1fr 1fr 1fr 1fr",gap:10,alignItems:"end"}}>
                <div>
                  <div style={{fontSize:12,fontWeight:950,color:"#c86100"}}>{label.toUpperCase()}</div>
                  <label style={{display:"block",fontSize:12,fontWeight:850,marginTop:6}}>Estado<select name={`${key}Estado`} defaultValue={String(s.estado??"")} disabled={readOnly||legacy} style={{width:"100%",padding:10,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8,background:"#fff"}}>
                    <option value="">Seleccionar</option>
                    <option value="EXISTE">Existe / disponible</option>
                    <option value="DISPONIBLE">Disponible en límite o punto cercano</option>
                    <option value="CAPACIDAD_INSUFICIENTE">Existe pero con capacidad insuficiente</option>
                    <option value="REQUIERE_EXTENSION">Requiere extensión de red</option>
                    <option value="REQUIERE_NUEVA_INFRAESTRUCTURA">Requiere nueva infraestructura</option>
                    <option value="SIN_FACTIBILIDAD">Sin factibilidad</option>
                    <option value="DESCONOCIDO">Desconocido / pendiente</option>
                    <option value="NO_APLICA">No aplica</option>
                  </select></label>
                </div>
                <label style={{fontSize:12,fontWeight:850}}>Capacidad / condición<input name={`${key}Capacidad`} defaultValue={String(s.capacidad??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:10,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
                <label style={{fontSize:12,fontWeight:850}}>Punto de conexión<input name={`${key}Punto`} defaultValue={String(s.puntoConexion??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:10,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
                <label style={{fontSize:12,fontWeight:850}}>Distancia aproximada<input name={`${key}Distancia`} defaultValue={String(s.distancia??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:10,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
                <label style={{fontSize:12,fontWeight:850}}>Responsable / organismo<input name={`${key}Responsable`} defaultValue={String(s.responsable??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:10,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
              </div>
              <label style={{display:"block",fontSize:12,fontWeight:850,marginTop:10}}>Observaciones y posible solución<input name={`${key}Observaciones`} defaultValue={String(s.observaciones??"")} disabled={readOnly||legacy} placeholder="Ej. requiere cárcamo sanitario, PTAR, colector, subestación, tanque, pozo..." style={{width:"100%",boxSizing:"border-box",padding:10,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            </article>
          })}
        </div>

        {!readOnly&&!legacy&&<div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}>
          <button type="submit" style={{border:0,background:"#ff8500",color:"#fff",fontWeight:950,padding:"12px 18px",borderRadius:10,cursor:"pointer"}}>Guardar y generar infraestructura requerida</button>
        </div>}
      </form>

      {(obras.length>0||entregables.length>0||riesgos.length>0)&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:12,marginTop:16}}>
        <article style={{...card,padding:16}}>
          <h3 style={{marginTop:0}}>Obras especiales sugeridas</h3>
          {obras.length?obras.map(x=><div key={x} style={{padding:"8px 0",borderBottom:"1px solid #edf2f6",fontSize:12,fontWeight:850}}>🏗️ {x}</div>):<div style={{fontSize:12,color:"#526c84"}}>Sin obras especiales detectadas.</div>}
        </article>
        <article style={{...card,padding:16}}>
          <h3 style={{marginTop:0}}>Entregables del Paso 3</h3>
          {entregables.map(x=><div key={x} style={{padding:"8px 0",borderBottom:"1px solid #edf2f6",fontSize:12,fontWeight:850}}>✓ {x}</div>)}
        </article>
        <article style={{...card,padding:16}}>
          <h3 style={{marginTop:0}}>Riesgos de servicios</h3>
          {riesgos.length?riesgos.map(x=><div key={x} style={{padding:"8px 0",borderBottom:"1px solid #edf2f6",fontSize:12,fontWeight:850,color:"#b53030"}}>⚠ {x}</div>):<div style={{fontSize:12,color:"#526c84"}}>Sin riesgos registrados.</div>}
        </article>
      </div>}

      <div style={{...card,marginTop:16,padding:18,background:"#f8fbfd"}}>
        <div style={{fontSize:12,fontWeight:950,color:"#c86100"}}>SIGUIENTE ETAPA</div>
        <h3 style={{margin:"5px 0"}}>Paso 4 · Estudios especializados y restricciones</h3>
        <p style={{margin:0,color:"#526c84"}}>Topografía, mecánica de suelos, hidrología, hidráulica, impacto ambiental, impacto urbano, tránsito, riesgo y protección civil se activarán según lo detectado en los tres primeros pasos.</p>
      </div>

      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad/legal`} style={{background:"#053f79",color:"#fff",textDecoration:"none",fontWeight:900,padding:"12px 16px",borderRadius:10}}>← Paso 2 · Legal / Uso de suelo</Link>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad`} style={{border:"1px solid #b8cad9",color:"#294f73",textDecoration:"none",fontWeight:900,padding:"12px 16px",borderRadius:10}}>Panel de Constructibilidad</Link>
      </div>
    </section>

    <style>{`
      @media(max-width:1100px){div[style*="1.1fr 1fr 1fr 1fr 1fr"]{grid-template-columns:1fr 1fr !important;}}
      @media(max-width:700px){div[style*="1.1fr 1fr 1fr 1fr 1fr"],div[style*="repeat(3"]{grid-template-columns:1fr !important;}}
    `}</style>
  </main>;
}
