import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";
import { pr0002 } from "@/lib/project-manager/pr0002";
import { PmHeader, card } from "@/app/project-manager/panel/_components";
import { guardarProductoConstructibilidad } from "./actions";

function asObj(v:unknown){return (v&&typeof v==="object"&&!Array.isArray(v)?v:{}) as Record<string,unknown>;}
function asList(v:unknown){return Array.isArray(v)?v.map(String):[];}

const tipos=[
  ["VIVIENDA_INDIVIDUAL","Vivienda individual"],
  ["RESIDENCIA","Residencia"],
  ["GRUPO_RESIDENCIAS","Grupo de residencias"],
  ["VIVIENDA_SERIE","Vivienda en serie"],
  ["DESARROLLO_HABITACIONAL","Desarrollo habitacional"],
  ["EDIFICIO","Edificio"],
  ["CONJUNTO_EDIFICIOS","Conjunto de edificios"],
  ["COMERCIAL","Comercial"],
  ["INDUSTRIAL","Industrial"],
  ["INSTITUCIONAL","Institucional"],
  ["URBANIZACION","Urbanización"],
  ["INFRAESTRUCTURA","Infraestructura"],
  ["MIXTO","Proyecto mixto"],
] as const;

export default async function ProductoConstructibilidadPage({params,searchParams}:{params:Promise<{codigo:string}>;searchParams:Promise<{guardado?:string}>}) {
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
  const prod=asObj(data?.productoEscala);
  const estructura=asObj(data?.estructuraControl);
  const jerarquia=asList(estructura.jerarquia);
  const entregables=asList(data?.entregablesPaso5);
  const riesgos=asList(data?.riesgosPaso5);
  const progreso=data?.progresoPaso5 ?? 0;

  return <main style={{minHeight:"100vh",background:"#eef6fb",color:"#082f64"}}>
    <PmHeader title="Constructibilidad · Paso 5" subtitle={`${code} · ${nombre} · Definición del producto y escala del desarrollo`}/>
    <section style={{maxWidth:1450,margin:"0 auto",padding:"20px 20px 60px"}}>
      {q.guardado&&<div style={{...card,marginBottom:14,background:"#e7f7ee",color:"#187342",fontWeight:900}}>Paso 5 guardado correctamente.</div>}
      {readOnly&&<div style={{...card,marginBottom:14,background:"#e8f3fb",fontWeight:900}}>CLIENTE · SÓLO LECTURA</div>}
      {legacy&&<div style={{...card,marginBottom:14,background:"#fff5dd",color:"#8a5b00",fontWeight:800}}>PR-0002 requiere completar su migración para guardar esta información.</div>}

      <div style={{...card,padding:20,border:"2px solid #ff8500"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:20,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:12,fontWeight:950,color:"#c86100"}}>PASO 5</div>
            <h1 style={{margin:"5px 0 7px",fontSize:28}}>¿Qué vamos a construir y a qué escala?</h1>
            <p style={{margin:0,color:"#4a657d",lineHeight:1.55}}>Con esta información el sistema define la jerarquía física de control, los niveles de consolidación y el detalle que deberá tener el seguimiento.</p>
          </div>
          <div style={{minWidth:170}}>
            <div style={{fontSize:11,fontWeight:900}}>AVANCE</div>
            <div style={{height:12,borderRadius:99,background:"#e3ebf1",overflow:"hidden",marginTop:7}}><div style={{height:"100%",width:`${progreso}%`,background:progreso>=80?"#1f9d55":progreso>=50?"#e6a700":"#d63c3c"}}/></div>
            <div style={{fontSize:24,fontWeight:950,marginTop:5}}>{progreso}%</div>
          </div>
        </div>
      </div>

      <form action={guardarProductoConstructibilidad} style={{marginTop:14}}>
        <input type="hidden" name="codigo" value={code}/>
        <article style={{...card,padding:18}}>
          <h2 style={{marginTop:0}}>5.1 Tipo de proyecto</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:9}}>
            {tipos.map(([value,label])=><label key={value} style={{border:"1px solid #d8e6f2",borderRadius:10,padding:12,display:"flex",gap:8,alignItems:"center",background:prod.tipoProyecto===value?"#eef8ff":"#fff"}}>
              <input type="radio" name="tipoProyecto" value={value} defaultChecked={prod.tipoProyecto===value} disabled={readOnly||legacy}/>
              <span style={{fontWeight:850,fontSize:13}}>{label}</span>
            </label>)}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10,marginTop:14}}>
            <label style={{fontSize:12,fontWeight:850}}>Segmento<select name="segmento" defaultValue={String(prod.segmento??"")} disabled={readOnly||legacy} style={{width:"100%",padding:10,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8,background:"#fff"}}>
              <option value="">Seleccionar</option>
              <option value="ECONOMICA">Vivienda económica</option>
              <option value="INTERES_SOCIAL">Interés social</option>
              <option value="MEDIA">Media</option>
              <option value="RESIDENCIAL">Residencial</option>
              <option value="RESIDENCIAL_PLUS">Residencial plus</option>
              <option value="MIXTO">Mixto</option>
              <option value="NO_APLICA">No aplica</option>
            </select></label>
            <label style={{fontSize:12,fontWeight:850}}>Unidades / viviendas<input name="unidades" type="number" min="0" defaultValue={String(prod.unidades??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:10,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            <label style={{fontSize:12,fontWeight:850}}>Edificios<input name="edificios" type="number" min="0" defaultValue={String(prod.edificios??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:10,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            <label style={{fontSize:12,fontWeight:850}}>Niveles<input name="niveles" type="number" min="0" defaultValue={String(prod.niveles??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:10,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            <label style={{fontSize:12,fontWeight:850}}>Prototipos / modelos<input name="prototipos" type="number" min="0" defaultValue={String(prod.prototipos??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:10,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            <label style={{fontSize:12,fontWeight:850}}>Etapas<input name="etapas" type="number" min="0" defaultValue={String(prod.etapas??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:10,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            <label style={{fontSize:12,fontWeight:850}}>Frentes<input name="frentes" type="number" min="0" defaultValue={String(prod.frentes??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:10,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            <label style={{fontSize:12,fontWeight:850}}>Manzanas<input name="manzanas" type="number" min="0" defaultValue={String(prod.manzanas??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:10,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            <label style={{fontSize:12,fontWeight:850}}>Hectáreas<input name="hectareas" type="number" min="0" step="0.01" defaultValue={String(prod.hectareas??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:10,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            <label style={{fontSize:12,fontWeight:850}}>m² de construcción<input name="m2Construccion" type="number" min="0" step="0.01" defaultValue={String(prod.m2Construccion??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:10,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            <label style={{fontSize:12,fontWeight:850}}>¿Proceso repetitivo?<select name="repetitivo" defaultValue={String(prod.repetitivo??"")} disabled={readOnly||legacy} style={{width:"100%",padding:10,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8,background:"#fff"}}>
              <option value="">Seleccionar</option><option value="SI">Sí</option><option value="NO">No</option><option value="PARCIAL">Parcial</option>
            </select></label>
          </div>

          <label style={{display:"block",fontSize:12,fontWeight:850,marginTop:10}}>Observaciones<input name="observaciones" defaultValue={String(prod.observaciones??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:10,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
        </article>

        {!readOnly&&!legacy&&<div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}>
          <button type="submit" style={{border:0,background:"#ff8500",color:"#fff",fontWeight:950,padding:"12px 18px",borderRadius:10,cursor:"pointer"}}>Guardar y generar estructura de control</button>
        </div>}
      </form>

      {(jerarquia.length>0||entregables.length>0||riesgos.length>0)&&<div style={{display:"grid",gridTemplateColumns:"1.1fr .95fr .95fr",gap:12,marginTop:16}}>
        <article style={{...card,padding:17}}>
          <h3 style={{marginTop:0}}>Jerarquía de control recomendada</h3>
          <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
            {jerarquia.map((x,i)=><span key={x} style={{display:"inline-flex",alignItems:"center",gap:7}}><span style={{padding:"8px 10px",borderRadius:8,background:"#eef6fb",border:"1px solid #d8e6f2",fontSize:12,fontWeight:900}}>{x}</span>{i<jerarquia.length-1&&<span style={{color:"#ff8500",fontWeight:950}}>→</span>}</span>)}
          </div>
        </article>
        <article style={{...card,padding:17}}>
          <h3 style={{marginTop:0}}>Entregables</h3>
          {entregables.map(x=><div key={x} style={{padding:"8px 0",borderBottom:"1px solid #edf2f6",fontSize:12,fontWeight:850}}>✓ {x}</div>)}
        </article>
        <article style={{...card,padding:17}}>
          <h3 style={{marginTop:0}}>Riesgos / datos faltantes</h3>
          {riesgos.length?riesgos.map(x=><div key={x} style={{padding:"8px 0",borderBottom:"1px solid #edf2f6",fontSize:12,fontWeight:850,color:"#b53030"}}>⚠ {x}</div>):<div style={{fontSize:12,color:"#526c84"}}>Sin riesgos registrados.</div>}
        </article>
      </div>}

      <div style={{...card,marginTop:16,padding:18,background:"#f8fbfd"}}>
        <div style={{fontSize:12,fontWeight:950,color:"#c86100"}}>SIGUIENTE ETAPA</div>
        <h3 style={{margin:"5px 0"}}>Paso 6 · Mercado, esquema de venta y financiamiento</h3>
        <p style={{margin:0,color:"#526c84"}}>Definiremos si el proyecto se colocará por INFONAVIT, FOVISSSTE, banca, recursos propios o esquema mixto; y cómo se financiará la ejecución: crédito puente, recursos propios, inversionistas, preventas o fideicomiso.</p>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad/mercado`} style={{display:"inline-block",marginTop:12,background:"#ff8500",color:"#fff",textDecoration:"none",fontWeight:950,padding:"11px 15px",borderRadius:9}}>Continuar al Paso 6 →</Link>
      </div>

      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad/estudios`} style={{background:"#053f79",color:"#fff",textDecoration:"none",fontWeight:900,padding:"12px 16px",borderRadius:10}}>← Paso 4 · Estudios</Link>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad`} style={{border:"1px solid #b8cad9",color:"#294f73",textDecoration:"none",fontWeight:900,padding:"12px 16px",borderRadius:10}}>Panel de Constructibilidad</Link>
      </div>
    </section>

    <style>{`
      @media(max-width:1000px){div[style*="repeat(4"],div[style*="repeat(3"]{grid-template-columns:1fr 1fr !important;}div[style*="1.1fr .95fr .95fr"]{grid-template-columns:1fr !important;}}
      @media(max-width:650px){div[style*="repeat(3"],div[style*="repeat(4"]{grid-template-columns:1fr !important;}}
    `}</style>
  </main>;
}
