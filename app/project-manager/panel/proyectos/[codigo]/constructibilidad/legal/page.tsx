import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";
import { pr0002 } from "@/lib/project-manager/pr0002";
import { PmHeader, card } from "@/app/project-manager/panel/_components";
import { guardarLegalConstructibilidad } from "./actions";

function asObj(v:unknown){return (v&&typeof v==="object"&&!Array.isArray(v)?v:{}) as Record<string,unknown>;}
function asList(v:unknown){return Array.isArray(v)?v.map(String):[];}

export default async function LegalConstructibilidadPage({params,searchParams}:{params:Promise<{codigo:string}>;searchParams:Promise<{guardado?:string}>}) {
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
  const juridico=asObj(data?.situacionJuridica);
  const uso=asObj(data?.usoSuelo);
  const urb=asObj(data?.parametrosUrbanisticos);
  const riesgos=asList(data?.riesgosPaso2);
  const entregables=asList(data?.entregablesPaso2);
  const progreso=data?.progresoPaso2 ?? 0;

  return <main style={{minHeight:"100vh",background:"#eef6fb",color:"#082f64"}}>
    <PmHeader title="Constructibilidad · Paso 2" subtitle={`${code} · ${nombre} · Situación jurídica, uso de suelo y condiciones urbanísticas`}/>
    <section style={{maxWidth:1400,margin:"0 auto",padding:"20px 20px 60px"}}>
      {q.guardado&&<div style={{...card,marginBottom:14,background:"#e7f7ee",color:"#187342",fontWeight:900}}>Paso 2 guardado correctamente.</div>}
      {readOnly&&<div style={{...card,marginBottom:14,background:"#e8f3fb",fontWeight:900}}>CLIENTE · SÓLO LECTURA</div>}
      {legacy&&<div style={{...card,marginBottom:14,background:"#fff5dd",color:"#8a5b00",fontWeight:800}}>PR-0002 requiere completar su migración para guardar esta información.</div>}

      <div style={{...card,padding:20,border:"2px solid #ff8500"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:20,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:12,fontWeight:950,color:"#c86100"}}>PASO 2</div>
            <h1 style={{margin:"5px 0 7px",fontSize:28}}>¿El proyecto es jurídicamente y urbanísticamente viable?</h1>
            <p style={{margin:0,color:"#4a657d",lineHeight:1.55}}>Este bloque determina si el predio puede desarrollarse legalmente y bajo qué parámetros debe diseñarse el proyecto.</p>
          </div>
          <div style={{minWidth:170}}><div style={{fontSize:11,fontWeight:900}}>AVANCE</div><div style={{height:12,borderRadius:99,background:"#e3ebf1",overflow:"hidden",marginTop:7}}><div style={{height:"100%",width:`${progreso}%`,background:progreso>=80?"#1f9d55":progreso>=50?"#e6a700":"#d63c3c"}}/></div><div style={{fontSize:24,fontWeight:950,marginTop:5}}>{progreso}%</div></div>
        </div>
      </div>

      <form action={guardarLegalConstructibilidad} style={{marginTop:14}}>
        <input type="hidden" name="codigo" value={code}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <article style={{...card,padding:18}}>
            <h2 style={{marginTop:0}}>2.1 Situación jurídica</h2>
            <label style={{fontSize:12,fontWeight:850}}>Tenencia<select name="tenencia" defaultValue={String(juridico.tenencia??"")} disabled={readOnly||legacy} style={{width:"100%",padding:10,marginTop:5,border:"1px solid #cbd9e5",borderRadius:8,background:"#fff"}}>
              <option value="">Seleccionar</option><option value="PROPIEDAD">Propiedad</option><option value="PROMESA">Promesa de compraventa</option><option value="FIDEICOMISO">Fideicomiso</option><option value="APORTACION">Aportación de tierra</option><option value="ASOCIACION">Asociación</option><option value="OTRA">Otra</option>
            </select></label>
            <label style={{display:"block",fontSize:12,fontWeight:850,marginTop:10}}>Situación registral<select name="situacionRegistral" defaultValue={String(juridico.situacionRegistral??"")} disabled={readOnly||legacy} style={{width:"100%",padding:10,marginTop:5,border:"1px solid #cbd9e5",borderRadius:8,background:"#fff"}}>
              <option value="">Seleccionar</option><option value="REGULAR">Regular</option><option value="EN_REVISION">En revisión</option><option value="IRREGULAR">Irregular</option><option value="PENDIENTE">Pendiente</option>
            </select></label>
            {[
              ["escritura","Escritura disponible"],
              ["registroPublico","Inscripción en Registro Público"],
              ["libertadGravamen","Libertad de gravamen"],
              ["gravamenes","Existen gravámenes"],
              ["servidumbres","Existen servidumbres"],
              ["derechosVia","Existen derechos de vía"],
              ["litigios","Existen litigios o controversias"],
              ["fusionesSubdivisiones","Requiere fusión o subdivisión"],
            ].map(([n,l])=><label key={n} style={{display:"flex",gap:8,marginTop:9,fontSize:13}}><input type="checkbox" name={n} defaultChecked={juridico[n]===true} disabled={readOnly||legacy}/>{l}</label>)}
          </article>

          <article style={{...card,padding:18}}>
            <h2 style={{marginTop:0}}>2.2 Uso de suelo</h2>
            <label style={{fontSize:12,fontWeight:850}}>Estado<select name="usoSueloEstado" defaultValue={String(uso.estado??"")} disabled={readOnly||legacy} style={{width:"100%",padding:10,marginTop:5,border:"1px solid #cbd9e5",borderRadius:8,background:"#fff"}}>
              <option value="">Seleccionar</option><option value="AUTORIZADO">Autorizado</option><option value="COMPATIBLE">Compatible</option><option value="CONDICIONADO">Condicionado</option><option value="EN_TRAMITE">En trámite</option><option value="REQUIERE_CAMBIO">Requiere cambio</option><option value="DESCONOCIDO">Desconocido</option>
            </select></label>
            <label style={{display:"block",fontSize:12,fontWeight:850,marginTop:10}}>Compatibilidad / destino permitido<input name="compatibilidad" defaultValue={String(uso.compatibilidad??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:10,marginTop:5,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            <label style={{display:"flex",gap:8,marginTop:12,fontSize:13}}><input type="checkbox" name="usoSueloDocumento" defaultChecked={uso.documento===true} disabled={readOnly||legacy}/> Documento de uso de suelo disponible</label>
            <label style={{display:"flex",gap:8,marginTop:9,fontSize:13}}><input type="checkbox" name="requiereCambio" defaultChecked={uso.requiereCambio===true} disabled={readOnly||legacy}/> Requiere cambio o modificación</label>

            <h3 style={{margin:"20px 0 8px"}}>2.3 Parámetros urbanísticos</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
              {[
                ["densidad","Densidad"],
                ["cos","COS"],
                ["cus","CUS"],
                ["alturaMaxima","Altura máxima"],
                ["retiros","Retiros"],
                ["estacionamiento","Estacionamiento"],
                ["donaciones","Donaciones / cesiones"],
                ["restricciones","Restricciones adicionales"],
              ].map(([n,l])=><label key={n} style={{fontSize:12,fontWeight:850}}>{l}<input name={n} defaultValue={String(urb[n]??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:9,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>)}
            </div>
          </article>
        </div>

        {!readOnly&&!legacy&&<div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}>
          <button type="submit" style={{border:0,background:"#ff8500",color:"#fff",fontWeight:950,padding:"12px 18px",borderRadius:10,cursor:"pointer"}}>Guardar y evaluar viabilidad</button>
        </div>}
      </form>

      {(riesgos.length>0||entregables.length>0)&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:16}}>
        <article style={{...card,padding:16}}><h3 style={{marginTop:0}}>Entregables del Paso 2</h3>{entregables.map(x=><div key={x} style={{padding:"8px 0",borderBottom:"1px solid #edf2f6",fontSize:12,fontWeight:800}}>✓ {x}</div>)}</article>
        <article style={{...card,padding:16}}><h3 style={{marginTop:0}}>Riesgos jurídicos / urbanísticos</h3>{riesgos.length?riesgos.map(x=><div key={x} style={{padding:"8px 0",borderBottom:"1px solid #edf2f6",fontSize:12,fontWeight:800,color:"#b53030"}}>⚠ {x}</div>):<div style={{fontSize:12}}>Sin riesgos registrados.</div>}</article>
      </div>}

      <div style={{...card,marginTop:16,padding:18,background:"#f8fbfd"}}>
        <div style={{fontSize:12,fontWeight:950,color:"#c86100"}}>SIGUIENTE ETAPA</div>
        <h3 style={{margin:"5px 0"}}>Paso 3 · Factibilidad de servicios e infraestructura</h3>
        <p style={{margin:0,color:"#526c84"}}>Agua, drenaje, electricidad, pluvial, vialidades, gas y telecomunicaciones se evaluarán con base en el predio y los parámetros urbanísticos definidos.</p>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad/servicios`} style={{display:"inline-block",marginTop:12,background:"#ff8500",color:"#fff",textDecoration:"none",fontWeight:950,padding:"11px 15px",borderRadius:9}}>Continuar al Paso 3 →</Link>
      </div>

      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad/predio`} style={{background:"#053f79",color:"#fff",textDecoration:"none",fontWeight:900,padding:"12px 16px",borderRadius:10}}>← Paso 1 · Predio</Link>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad`} style={{border:"1px solid #b8cad9",color:"#294f73",textDecoration:"none",fontWeight:900,padding:"12px 16px",borderRadius:10}}>Panel de Constructibilidad</Link>
      </div>
    </section>

    <style>{`@media(max-width:800px){div[style*="1fr 1fr"]{grid-template-columns:1fr !important;}}`}</style>
  </main>;
}
