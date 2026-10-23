import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";
import { pr0002 } from "@/lib/project-manager/pr0002";
import { PmHeader, card } from "@/app/project-manager/panel/_components";
import { guardarEstudiosConstructibilidad } from "./actions";

function asObj(v:unknown){return (v&&typeof v==="object"&&!Array.isArray(v)?v:{}) as Record<string,unknown>;}
function asList(v:unknown){return Array.isArray(v)?v.map(String):[];}

const studies=[
  ["topografia","Topografía"],
  ["mecanicaSuelos","Mecánica de suelos"],
  ["geotecnia","Geotecnia especializada"],
  ["hidrologia","Hidrología"],
  ["hidraulica","Hidráulica"],
  ["impactoAmbiental","Impacto ambiental"],
  ["impactoUrbano","Impacto urbano"],
  ["transito","Tránsito / movilidad"],
  ["riesgo","Estudio de riesgo"],
  ["proteccionCivil","Protección Civil"],
  ["contaminacion","Contaminación / remediación"],
  ["infraestructura","Estudios de infraestructura"],
] as const;

export default async function EstudiosConstructibilidadPage({params,searchParams}:{params:Promise<{codigo:string}>;searchParams:Promise<{guardado?:string}>}) {
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
  const all=asObj(data?.estudiosEspecializados);
  const entregables=asList(data?.entregablesPaso4);
  const riesgos=asList(data?.riesgosPaso4);
  const progreso=data?.progresoPaso4 ?? 0;

  return <main style={{minHeight:"100vh",background:"#eef6fb",color:"#082f64"}}>
    <PmHeader title="Constructibilidad · Paso 4" subtitle={`${code} · ${nombre} · Estudios especializados y restricciones`}/>
    <section style={{maxWidth:1450,margin:"0 auto",padding:"20px 20px 60px"}}>
      {q.guardado&&<div style={{...card,marginBottom:14,background:"#e7f7ee",color:"#187342",fontWeight:900}}>Paso 4 guardado correctamente.</div>}
      {readOnly&&<div style={{...card,marginBottom:14,background:"#e8f3fb",fontWeight:900}}>CLIENTE · SÓLO LECTURA</div>}
      {legacy&&<div style={{...card,marginBottom:14,background:"#fff5dd",color:"#8a5b00",fontWeight:800}}>PR-0002 requiere completar su migración para guardar esta información.</div>}

      <div style={{...card,padding:20,border:"2px solid #ff8500"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:20,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:12,fontWeight:950,color:"#c86100"}}>PASO 4</div>
            <h1 style={{margin:"5px 0 7px",fontSize:28}}>¿Qué estudios necesita realmente este proyecto?</h1>
            <p style={{margin:0,color:"#4a657d",lineHeight:1.55}}>Cada estudio puede marcarse como requerido o no requerido, asignarse a un responsable y seguirse hasta su aprobación.</p>
          </div>
          <div style={{minWidth:170}}>
            <div style={{fontSize:11,fontWeight:900}}>AVANCE</div>
            <div style={{height:12,borderRadius:99,background:"#e3ebf1",overflow:"hidden",marginTop:7}}><div style={{height:"100%",width:`${progreso}%`,background:progreso>=80?"#1f9d55":progreso>=50?"#e6a700":"#d63c3c"}}/></div>
            <div style={{fontSize:24,fontWeight:950,marginTop:5}}>{progreso}%</div>
          </div>
        </div>
      </div>

      <form action={guardarEstudiosConstructibilidad} style={{marginTop:14}}>
        <input type="hidden" name="codigo" value={code}/>
        <div style={{display:"grid",gap:12}}>
          {studies.map(([key,label])=>{
            const s=asObj(all[key]);
            return <article key={key} style={{...card,padding:16}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr .8fr 1fr .8fr 1.4fr",gap:10,alignItems:"end"}}>
                <div>
                  <div style={{fontWeight:950}}>{label}</div>
                  <label style={{display:"block",fontSize:12,fontWeight:850,marginTop:7}}>¿Requerido?<select name={`${key}Requerido`} defaultValue={String(s.requerido??"")} disabled={readOnly||legacy} style={{width:"100%",padding:9,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8,background:"#fff"}}>
                    <option value="">Por definir</option><option value="SI">Sí</option><option value="NO">No aplica</option>
                  </select></label>
                </div>
                <label style={{fontSize:12,fontWeight:850}}>Estado<select name={`${key}Estado`} defaultValue={String(s.estado??"")} disabled={readOnly||legacy} style={{width:"100%",padding:9,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8,background:"#fff"}}>
                  <option value="">Seleccionar</option><option value="PENDIENTE">Pendiente</option><option value="CONTRATADO">Contratado</option><option value="EN_PROCESO">En proceso</option><option value="EN_REVISION">En revisión</option><option value="OBSERVADO">Observado</option><option value="TERMINADO">Terminado</option><option value="APROBADO">Aprobado</option>
                </select></label>
                <label style={{fontSize:12,fontWeight:850}}>Responsable<input name={`${key}Responsable`} defaultValue={String(s.responsable??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:9,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
                <label style={{fontSize:12,fontWeight:850}}>Fecha objetivo<input type="date" name={`${key}Fecha`} defaultValue={String(s.fecha??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:9,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
                <label style={{fontSize:12,fontWeight:850}}>Resultado / restricción<input name={`${key}Resultado`} defaultValue={String(s.resultado??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:9,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
              </div>
              <label style={{display:"block",fontSize:12,fontWeight:850,marginTop:9}}>Observaciones<input name={`${key}Observaciones`} defaultValue={String(s.observaciones??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:9,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            </article>
          })}
        </div>

        {!readOnly&&!legacy&&<div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}>
          <button type="submit" style={{border:0,background:"#ff8500",color:"#fff",fontWeight:950,padding:"12px 18px",borderRadius:10,cursor:"pointer"}}>Guardar matriz de estudios</button>
        </div>}
      </form>

      {(entregables.length>0||riesgos.length>0)&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:16}}>
        <article style={{...card,padding:16}}><h3 style={{marginTop:0}}>Entregables del Paso 4</h3>{entregables.map(x=><div key={x} style={{padding:"8px 0",borderBottom:"1px solid #edf2f6",fontSize:12,fontWeight:850}}>✓ {x}</div>)}</article>
        <article style={{...card,padding:16}}><h3 style={{marginTop:0}}>Estudios en riesgo</h3>{riesgos.length?riesgos.map(x=><div key={x} style={{padding:"8px 0",borderBottom:"1px solid #edf2f6",fontSize:12,fontWeight:850,color:"#b53030"}}>⚠ {x}</div>):<div style={{fontSize:12}}>Sin riesgos registrados.</div>}</article>
      </div>}

      <div style={{...card,marginTop:16,padding:18,background:"#f8fbfd"}}>
        <div style={{fontSize:12,fontWeight:950,color:"#c86100"}}>SIGUIENTE ETAPA</div>
        <h3 style={{margin:"5px 0"}}>Paso 5 · Definición del producto y escala del desarrollo</h3>
        <p style={{margin:0,color:"#526c84"}}>Tipo de proyecto, número de viviendas o edificios, prototipos, etapas, frentes, manzanas y estructura física de control.</p>
      </div>

      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad/servicios`} style={{background:"#053f79",color:"#fff",textDecoration:"none",fontWeight:900,padding:"12px 16px",borderRadius:10}}>← Paso 3 · Servicios</Link>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad`} style={{border:"1px solid #b8cad9",color:"#294f73",textDecoration:"none",fontWeight:900,padding:"12px 16px",borderRadius:10}}>Panel de Constructibilidad</Link>
      </div>
    </section>

    <style>{`
      @media(max-width:1100px){div[style*="1fr .8fr 1fr .8fr 1.4fr"]{grid-template-columns:1fr 1fr !important;}}
      @media(max-width:700px){div[style*="1fr .8fr 1fr .8fr 1.4fr"],div[style*="1fr 1fr"]{grid-template-columns:1fr !important;}}
    `}</style>
  </main>;
}
