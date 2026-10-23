import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";
import { pr0002 } from "@/lib/project-manager/pr0002";
import { PmHeader, card } from "@/app/project-manager/panel/_components";
import { guardarSeguimientoConstructibilidad } from "./actions";

function asObj(v:unknown){return (v&&typeof v==="object"&&!Array.isArray(v)?v:{}) as Record<string,unknown>;}
function asList(v:unknown){return Array.isArray(v)?v.map(String):[];}

const areas=[
  ["avanceFisico","Avance físico","Volúmenes ejecutados, hitos y porcentaje de avance"],
  ["avanceFinanciero","Avance financiero","Ejercido, pagado, comprometido y proyección"],
  ["contratos","Contratos","Monto, anticipo, estimaciones, retenciones y saldo"],
  ["manoObra","Mano de obra","Personal, cuadrillas, costo y rendimiento"],
  ["materiales","Materiales","Solicitado, comprado, recibido, consumido y stock"],
  ["maquinaria","Maquinaria","Horas, utilización, combustible y rendimiento"],
  ["calidad","Calidad","Inspecciones, pruebas, no conformidades y liberaciones"],
  ["seguridad","Seguridad","Incidentes, recorridos, observaciones y acciones"],
  ["cambios","Cambios","Origen, impacto en costo/plazo y autorización"],
  ["riesgos","Riesgos","Probabilidad, impacto, respuesta y responsable"],
  ["restricciones","Restricciones","Pendientes que impiden o condicionan la ejecución"],
  ["evidencias","Evidencias","Fotografías, reportes, bitácora y documentos"],
] as const;

export default async function SeguimientoConstructibilidadPage({params,searchParams}:{params:Promise<{codigo:string}>;searchParams:Promise<{guardado?:string}>}) {
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
  const tracking=asObj(data?.seguimientoOperativo);
  const entregables=asList(data?.entregablesPaso10);
  const riesgos=asList(data?.riesgosPaso10);
  const progreso=data?.progresoPaso10 ?? 0;

  return <main style={{minHeight:"100vh",background:"#eef6fb",color:"#082f64"}}>
    <PmHeader title="Constructibilidad · Paso 10" subtitle={`${code} · ${nombre} · Estructura de ejecución y seguimiento`}/>
    <section style={{maxWidth:1550,margin:"0 auto",padding:"20px 20px 60px"}}>
      {q.guardado&&<div style={{...card,marginBottom:14,background:"#e7f7ee",color:"#187342",fontWeight:900}}>Paso 10 guardado correctamente.</div>}
      {readOnly&&<div style={{...card,marginBottom:14,background:"#e8f3fb",fontWeight:900}}>CLIENTE · SÓLO LECTURA</div>}
      {legacy&&<div style={{...card,marginBottom:14,background:"#fff5dd",color:"#8a5b00",fontWeight:800}}>PR-0002 requiere completar su migración para guardar esta información.</div>}

      <div style={{...card,padding:20,border:"2px solid #ff8500"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:20,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:12,fontWeight:950,color:"#c86100"}}>PASO 10</div>
            <h1 style={{margin:"5px 0 7px",fontSize:28}}>¿Cómo se alimentará Certeza Project Manager durante la ejecución?</h1>
            <p style={{margin:0,color:"#4a657d",lineHeight:1.55}}>Cada dato debe capturarse una sola vez en su fuente y alimentar automáticamente indicadores, alertas, módulos y reportes.</p>
          </div>
          <div style={{minWidth:180}}>
            <div style={{fontSize:11,fontWeight:900}}>AVANCE DE CONFIGURACIÓN</div>
            <div style={{height:12,borderRadius:99,background:"#e3ebf1",overflow:"hidden",marginTop:7}}><div style={{height:"100%",width:`${progreso}%`,background:progreso>=85?"#1f9d55":progreso>=50?"#e6a700":"#d63c3c"}}/></div>
            <div style={{fontSize:24,fontWeight:950,marginTop:5}}>{progreso}%</div>
          </div>
        </div>
      </div>

      <form action={guardarSeguimientoConstructibilidad} style={{marginTop:14}}>
        <input type="hidden" name="codigo" value={code}/>
        <div style={{display:"grid",gap:11}}>
          {areas.map(([key,label,desc])=>{
            const a=asObj(tracking[key]);
            return <article key={key} style={{...card,padding:15}}>
              <div style={{display:"grid",gridTemplateColumns:".9fr .85fr 1fr 1fr 1.25fr 1fr 1fr 1fr",gap:8,alignItems:"end"}}>
                <div>
                  <label style={{display:"flex",gap:8,alignItems:"center",fontWeight:950}}>
                    <input type="checkbox" name={`${key}Activo`} defaultChecked={a.activo===true} disabled={readOnly||legacy}/>
                    {label}
                  </label>
                  <div style={{fontSize:10,color:"#60778d",lineHeight:1.35,marginTop:4}}>{desc}</div>
                </div>
                <label style={{fontSize:11,fontWeight:850}}>Frecuencia<select name={`${key}Frecuencia`} defaultValue={String(a.frecuencia??"")} disabled={readOnly||legacy} style={{width:"100%",padding:8,marginTop:3,border:"1px solid #cbd9e5",borderRadius:8,background:"#fff"}}>
                  <option value="">Definir</option><option value="DIARIA">Diaria</option><option value="SEMANAL">Semanal</option><option value="QUINCENAL">Quincenal</option><option value="MENSUAL">Mensual</option><option value="POR_EVENTO">Por evento</option><option value="POR_ESTIMACION">Por estimación</option><option value="POR_ENTREGA">Por entrega</option>
                </select></label>
                <label style={{fontSize:11,fontWeight:850}}>Responsable<input name={`${key}Responsable`} defaultValue={String(a.responsable??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:8,marginTop:3,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
                <label style={{fontSize:11,fontWeight:850}}>Fuente<input name={`${key}Fuente`} defaultValue={String(a.fuente??"")} disabled={readOnly||legacy} placeholder="Campo, contrato, almacén..." style={{width:"100%",boxSizing:"border-box",padding:8,marginTop:3,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
                <label style={{fontSize:11,fontWeight:850}}>Dato a capturar<input name={`${key}Dato`} defaultValue={String(a.dato??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:8,marginTop:3,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
                <label style={{fontSize:11,fontWeight:850}}>Cálculo generado<input name={`${key}Calculo`} defaultValue={String(a.calculo??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:8,marginTop:3,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
                <label style={{fontSize:11,fontWeight:850}}>Indicador<input name={`${key}Indicador`} defaultValue={String(a.indicador??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:8,marginTop:3,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
                <label style={{fontSize:11,fontWeight:850}}>Módulo destino<input name={`${key}Modulo`} defaultValue={String(a.moduloDestino??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:8,marginTop:3,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
              </div>
              <label style={{display:"block",fontSize:11,fontWeight:850,marginTop:8}}>Regla de alerta<input name={`${key}Alerta`} defaultValue={String(a.alerta??"")} disabled={readOnly||legacy} placeholder="Ej. desviación > 10%, atraso > 3 días..." style={{width:"100%",boxSizing:"border-box",padding:8,marginTop:3,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            </article>
          })}
        </div>

        {!readOnly&&!legacy&&<div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}>
          <button type="submit" style={{border:0,background:"#ff8500",color:"#fff",fontWeight:950,padding:"12px 18px",borderRadius:10,cursor:"pointer"}}>Guardar matriz de seguimiento</button>
        </div>}
      </form>

      {(entregables.length>0||riesgos.length>0)&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:16}}>
        <article style={{...card,padding:16}}><h3 style={{marginTop:0}}>Entregables del Paso 10</h3>{entregables.map(x=><div key={x} style={{padding:"8px 0",borderBottom:"1px solid #edf2f6",fontSize:12,fontWeight:850}}>✓ {x}</div>)}</article>
        <article style={{...card,padding:16}}><h3 style={{marginTop:0}}>Campos de seguimiento pendientes</h3>{riesgos.length?riesgos.map(x=><div key={x} style={{padding:"8px 0",borderBottom:"1px solid #edf2f6",fontSize:12,fontWeight:850,color:"#b53030"}}>⚠ {x}</div>):<div style={{fontSize:12,color:"#187342",fontWeight:850}}>Matriz de seguimiento completa.</div>}</article>
      </div>}

      <div style={{...card,marginTop:16,padding:18,background:"#f8fbfd"}}>
        <div style={{fontSize:12,fontWeight:950,color:"#c86100"}}>SIGUIENTE ETAPA</div>
        <h3 style={{margin:"5px 0"}}>Paso 11 · Generación del Expediente Maestro de Arranque</h3>
        <p style={{margin:0,color:"#526c84"}}>Con Constructibilidad definida, el sistema podrá generar el listado exacto de documentos, líneas base, matrices, contratos, estudios y datos que debe contener el Expediente Maestro de este proyecto.</p>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad/expediente`} style={{display:"inline-block",marginTop:12,background:"#ff8500",color:"#fff",textDecoration:"none",fontWeight:950,padding:"11px 15px",borderRadius:9}}>Continuar al Paso 11 →</Link>
      </div>

      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad/preparacion`} style={{background:"#053f79",color:"#fff",textDecoration:"none",fontWeight:900,padding:"12px 16px",borderRadius:10}}>← Paso 9 · Preparación</Link>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad`} style={{border:"1px solid #b8cad9",color:"#294f73",textDecoration:"none",fontWeight:900,padding:"12px 16px",borderRadius:10}}>Panel de Constructibilidad</Link>
      </div>
    </section>

    <style>{`
      @media(max-width:1300px){div[style*=".9fr .85fr 1fr 1fr 1.25fr 1fr 1fr 1fr"]{grid-template-columns:1fr 1fr 1fr 1fr !important;}}
      @media(max-width:850px){div[style*=".9fr .85fr 1fr 1fr 1.25fr 1fr 1fr 1fr"],div[style*="1fr 1fr"]{grid-template-columns:1fr !important;}}
    `}</style>
  </main>;
}
