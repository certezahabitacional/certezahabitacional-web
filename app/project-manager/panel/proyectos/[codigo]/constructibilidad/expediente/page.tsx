import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";
import { pr0002 } from "@/lib/project-manager/pr0002";
import { PmHeader, card } from "@/app/project-manager/panel/_components";
import { actualizarExpedienteMaestro, generarExpedienteMaestro } from "./actions";

function asList(v:unknown){return Array.isArray(v)?v as Record<string,unknown>[]:[];}

export default async function ExpedienteConstructibilidadPage({params,searchParams}:{params:Promise<{codigo:string}>;searchParams:Promise<{generado?:string;guardado?:string}>}) {
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
  const expediente=asList(data?.expedienteMaestroGenerado);
  const progreso=data?.progresoPaso11 ?? 0;
  const listo=data?.estadoPaso11==="EXPEDIENTE_LISTO";

  return <main style={{minHeight:"100vh",background:"#eef6fb",color:"#082f64"}}>
    <PmHeader title="Constructibilidad · Paso 11" subtitle={`${code} · ${nombre} · Expediente Maestro de Arranque`}/>
    <section style={{maxWidth:1600,margin:"0 auto",padding:"20px 20px 60px"}}>
      {q.generado&&<div style={{...card,marginBottom:14,background:"#e7f7ee",color:"#187342",fontWeight:900}}>Expediente Maestro generado desde Constructibilidad.</div>}
      {q.guardado&&<div style={{...card,marginBottom:14,background:"#e7f7ee",color:"#187342",fontWeight:900}}>Expediente Maestro actualizado correctamente.</div>}
      {readOnly&&<div style={{...card,marginBottom:14,background:"#e8f3fb",fontWeight:900}}>CLIENTE · SÓLO LECTURA</div>}
      {legacy&&<div style={{...card,marginBottom:14,background:"#fff5dd",color:"#8a5b00",fontWeight:800}}>PR-0002 requiere completar su migración para guardar esta información.</div>}

      <div style={{...card,padding:20,border:`2px solid ${listo?"#1f9d55":"#ff8500"}`}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:20,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:12,fontWeight:950,color:listo?"#187342":"#c86100"}}>PASO 11</div>
            <h1 style={{margin:"5px 0 7px",fontSize:28}}>Expediente Maestro de Arranque</h1>
            <p style={{margin:0,color:"#4a657d",lineHeight:1.55}}>Este expediente ya no se define de forma genérica: se genera con los entregables exigidos por las respuestas de Constructibilidad.</p>
          </div>
          <div style={{minWidth:190}}>
            <div style={{fontSize:11,fontWeight:900}}>INTEGRACIÓN DEL EXPEDIENTE</div>
            <div style={{height:12,borderRadius:99,background:"#e3ebf1",overflow:"hidden",marginTop:7}}><div style={{height:"100%",width:`${progreso}%`,background:listo?"#1f9d55":progreso>=50?"#e6a700":"#d63c3c"}}/></div>
            <div style={{fontSize:24,fontWeight:950,marginTop:5}}>{progreso}%</div>
          </div>
        </div>
      </div>

      {!expediente.length && !readOnly && !legacy && <form action={generarExpedienteMaestro} style={{marginTop:14}}>
        <input type="hidden" name="codigo" value={code}/>
        <button type="submit" style={{border:0,background:"#ff8500",color:"#fff",fontWeight:950,padding:"13px 20px",borderRadius:10,cursor:"pointer"}}>Generar Expediente Maestro desde Constructibilidad</button>
      </form>}

      {expediente.length>0 && <form action={actualizarExpedienteMaestro} style={{marginTop:14}}>
        <input type="hidden" name="codigo" value={code}/>
        <div style={{...card,padding:0,overflow:"hidden"}}>
          <div style={{padding:"14px 16px",fontSize:19,fontWeight:950,borderBottom:"1px solid #d8e6f2"}}>Matriz de Entregables de Arranque</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:1450}}>
              <thead><tr style={{background:"#f2f7fb",textAlign:"left"}}>
                {["ID","Entregable","Clasificación","Responsable","Formato","Fuente","Fecha objetivo","Dependencia","Criterio de aceptación","Estado","Validado"].map(h=><th key={h} style={{padding:9,borderBottom:"1px solid #d8e6f2"}}>{h}</th>)}
              </tr></thead>
              <tbody>{expediente.map((row)=>{
                const id=String(row.id??"");
                return <tr key={id}>
                  <td style={{padding:8,borderBottom:"1px solid #edf2f6",fontWeight:900}}>{id}</td>
                  <td style={{padding:8,borderBottom:"1px solid #edf2f6",fontWeight:850,minWidth:230}}>{String(row.nombre??"")}</td>
                  <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}><select name={`${id}_clasificacion`} defaultValue={String(row.clasificacion??"OBLIGATORIO")} disabled={readOnly||legacy} style={{width:"100%",padding:7,border:"1px solid #cbd9e5",borderRadius:7,background:"#fff"}}><option value="OBLIGATORIO">Obligatorio</option><option value="CONDICIONAL">Condicional</option><option value="NO_APLICA">No aplica</option></select></td>
                  <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}><input name={`${id}_responsable`} defaultValue={String(row.responsable??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:7,border:"1px solid #cbd9e5",borderRadius:7}}/></td>
                  <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}><input name={`${id}_formato`} defaultValue={String(row.formato??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:7,border:"1px solid #cbd9e5",borderRadius:7}}/></td>
                  <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}><input name={`${id}_fuente`} defaultValue={String(row.fuente??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:7,border:"1px solid #cbd9e5",borderRadius:7}}/></td>
                  <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}><input type="date" name={`${id}_fecha`} defaultValue={String(row.fechaObjetivo??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:7,border:"1px solid #cbd9e5",borderRadius:7}}/></td>
                  <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}><input name={`${id}_dependencia`} defaultValue={String(row.dependencia??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:7,border:"1px solid #cbd9e5",borderRadius:7}}/></td>
                  <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}><input name={`${id}_criterio`} defaultValue={String(row.criterioAceptacion??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:7,border:"1px solid #cbd9e5",borderRadius:7}}/></td>
                  <td style={{padding:8,borderBottom:"1px solid #edf2f6"}}><select name={`${id}_estado`} defaultValue={String(row.estado??"PENDIENTE")} disabled={readOnly||legacy} style={{width:"100%",padding:7,border:"1px solid #cbd9e5",borderRadius:7,background:"#fff"}}><option value="PENDIENTE">Pendiente</option><option value="EN_PROCESO">En proceso</option><option value="COMPLETO">Completo</option><option value="OBSERVADO">Observado</option><option value="NO_APLICA">No aplica</option></select></td>
                  <td style={{padding:8,borderBottom:"1px solid #edf2f6",textAlign:"center"}}><input type="checkbox" name={`${id}_validado`} defaultChecked={row.validado===true} disabled={readOnly||legacy}/></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </div>

        {!readOnly&&!legacy&&<div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}>
          <button type="submit" style={{border:0,background:"#ff8500",color:"#fff",fontWeight:950,padding:"12px 18px",borderRadius:10,cursor:"pointer"}}>Guardar avance del Expediente Maestro</button>
          <button formAction={generarExpedienteMaestro} type="submit" style={{border:"1px solid #b8cad9",background:"#fff",color:"#294f73",fontWeight:900,padding:"12px 16px",borderRadius:10,cursor:"pointer"}}>Regenerar desde Constructibilidad</button>
        </div>}
      </form>}

      <div style={{...card,marginTop:16,padding:18,background:"#f8fbfd"}}>
        <div style={{fontSize:12,fontWeight:950,color:"#c86100"}}>RESULTADO DE CONSTRUCTIBILIDAD</div>
        <h3 style={{margin:"5px 0"}}>Cuando este expediente esté listo, el proyecto podrá establecer formalmente sus líneas base y comenzar la operación.</h3>
        <p style={{margin:0,color:"#526c84"}}>A partir de aquí, el seguimiento operativo definido en el Paso 10 será el mecanismo de alimentación durante la ejecución.</p>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad/cierre`} style={{display:"inline-block",marginTop:12,background:"#ff8500",color:"#fff",textDecoration:"none",fontWeight:950,padding:"11px 15px",borderRadius:9}}>Ir al cierre de Constructibilidad →</Link>
      </div>

      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad/seguimiento`} style={{background:"#053f79",color:"#fff",textDecoration:"none",fontWeight:900,padding:"12px 16px",borderRadius:10}}>← Paso 10 · Seguimiento</Link>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad`} style={{border:"1px solid #b8cad9",color:"#294f73",textDecoration:"none",fontWeight:900,padding:"12px 16px",borderRadius:10}}>Panel de Constructibilidad</Link>
      </div>
    </section>
  </main>;
}
