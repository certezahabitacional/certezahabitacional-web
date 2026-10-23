import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";
import { pr0002 } from "@/lib/project-manager/pr0002";
import { PmHeader, card } from "@/app/project-manager/panel/_components";
import { guardarEjecucionConstructibilidad } from "./actions";

function asObj(v:unknown){return (v&&typeof v==="object"&&!Array.isArray(v)?v:{}) as Record<string,unknown>;}
function asList(v:unknown){return Array.isArray(v)?v.map(String):[];}

const packages=[
  ["terracerias","Terracerías"],
  ["urbanizacion","Urbanización"],
  ["cimentacion","Cimentación"],
  ["estructura","Estructura"],
  ["albanileria","Albañilería"],
  ["instalaciones","Instalaciones"],
  ["acabados","Acabados"],
  ["obrasEspeciales","Obras especiales"],
] as const;

export default async function EjecucionConstructibilidadPage({params,searchParams}:{params:Promise<{codigo:string}>;searchParams:Promise<{guardado?:string}>}) {
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
  const presupuesto=asObj(data?.presupuestoBase);
  const programa=asObj(data?.programaMaestro);
  const estrategia=asObj(data?.estrategiaEjecucion);
  const paquetes=asObj(estrategia.paquetes);
  const entregables=asList(data?.entregablesPaso8);
  const riesgos=asList(data?.riesgosPaso8);
  const progreso=data?.progresoPaso8 ?? 0;

  return <main style={{minHeight:"100vh",background:"#eef6fb",color:"#082f64"}}>
    <PmHeader title="Constructibilidad · Paso 8" subtitle={`${code} · ${nombre} · Presupuesto, programa y estrategia de ejecución`}/>
    <section style={{maxWidth:1500,margin:"0 auto",padding:"20px 20px 60px"}}>
      {q.guardado&&<div style={{...card,marginBottom:14,background:"#e7f7ee",color:"#187342",fontWeight:900}}>Paso 8 guardado correctamente.</div>}
      {readOnly&&<div style={{...card,marginBottom:14,background:"#e8f3fb",fontWeight:900}}>CLIENTE · SÓLO LECTURA</div>}
      {legacy&&<div style={{...card,marginBottom:14,background:"#fff5dd",color:"#8a5b00",fontWeight:800}}>PR-0002 requiere completar su migración para guardar esta información.</div>}

      <div style={{...card,padding:20,border:"2px solid #ff8500"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:20,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:12,fontWeight:950,color:"#c86100"}}>PASO 8</div>
            <h1 style={{margin:"5px 0 7px",fontSize:28}}>¿Con qué costo, plazo y estrategia se ejecutará el proyecto?</h1>
            <p style={{margin:0,color:"#4a657d",lineHeight:1.55}}>Este paso convierte el proyecto autorizado en una línea base operable y define los controles que requiere cada paquete de trabajo.</p>
          </div>
          <div style={{minWidth:170}}>
            <div style={{fontSize:11,fontWeight:900}}>AVANCE</div>
            <div style={{height:12,borderRadius:99,background:"#e3ebf1",overflow:"hidden",marginTop:7}}><div style={{height:"100%",width:`${progreso}%`,background:progreso>=80?"#1f9d55":progreso>=50?"#e6a700":"#d63c3c"}}/></div>
            <div style={{fontSize:24,fontWeight:950,marginTop:5}}>{progreso}%</div>
          </div>
        </div>
      </div>

      <form action={guardarEjecucionConstructibilidad} style={{marginTop:14}}>
        <input type="hidden" name="codigo" value={code}/>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <article style={{...card,padding:18}}>
            <h2 style={{marginTop:0}}>8.1 Presupuesto base</h2>
            <label style={{fontSize:12,fontWeight:850}}>Monto total<input name="montoTotal" type="number" step="0.01" min="0" defaultValue={String(presupuesto.montoTotal??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:10,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            {[
              ["catalogoConceptos","Catálogo de conceptos"],
              ["preciosUnitarios","Análisis de precios unitarios"],
              ["explosionInsumos","Explosión de insumos"],
              ["tabuladorManoObra","Tabulador de mano de obra"],
              ["cargaSocial","Carga social"],
              ["provisionesLaborales","Provisiones laborales"],
              ["maquinariaPresupuestada","Maquinaria y equipo"],
              ["subcontratosPresupuestados","Subcontratos"],
              ["indirectos","Indirectos"],
              ["contingencia","Contingencia"],
              ["flujoEconomico","Flujo económico / curva de inversión"],
            ].map(([n,l])=><label key={n} style={{display:"flex",gap:8,marginTop:9,fontSize:13}}><input type="checkbox" name={n} defaultChecked={presupuesto[n]===true} disabled={readOnly||legacy}/>{l}</label>)}
          </article>

          <article style={{...card,padding:18}}>
            <h2 style={{marginTop:0}}>8.2 Programa maestro</h2>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <label style={{fontSize:12,fontWeight:850}}>Inicio<input type="date" name="fechaInicio" defaultValue={String(programa.fechaInicio??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:9,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
              <label style={{fontSize:12,fontWeight:850}}>Término<input type="date" name="fechaFin" defaultValue={String(programa.fechaFin??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:9,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            </div>
            {[
              ["hitos","Hitos principales definidos"],
              ["rutaCritica","Ruta crítica definida"],
              ["programaEtapas","Programa por etapas / frentes"],
              ["programaSuministros","Programa de suministros"],
              ["programaContratacion","Programa de contratación"],
            ].map(([n,l])=><label key={n} style={{display:"flex",gap:8,marginTop:10,fontSize:13}}><input type="checkbox" name={n} defaultChecked={programa[n]===true} disabled={readOnly||legacy}/>{l}</label>)}

            <label style={{display:"block",fontSize:12,fontWeight:850,marginTop:16}}>Modalidad general<select name="modalidadGeneral" defaultValue={String(estrategia.modalidadGeneral??"")} disabled={readOnly||legacy} style={{width:"100%",padding:10,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8,background:"#fff"}}>
              <option value="">Seleccionar</option><option value="DIRECTA">Administración directa</option><option value="SUBCONTRATO">100% subcontratado</option><option value="MIXTO">Mixto</option>
            </select></label>
          </article>
        </div>

        <h2 style={{marginTop:20}}>8.3 Estrategia por paquete</h2>
        <div style={{display:"grid",gap:10}}>
          {packages.map(([key,label])=>{
            const p=asObj(paquetes[key]);
            return <article key={key} style={{...card,padding:15}}>
              <div style={{display:"grid",gridTemplateColumns:"1.1fr 1fr 1fr 1fr 1fr 1fr",gap:9,alignItems:"end"}}>
                <div style={{fontWeight:950}}>{label}</div>
                <label style={{fontSize:12,fontWeight:850}}>Modalidad<select name={`${key}Modalidad`} defaultValue={String(p.modalidad??"")} disabled={readOnly||legacy} style={{width:"100%",padding:9,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8,background:"#fff"}}>
                  <option value="">Seleccionar</option><option value="DIRECTA">Administración directa</option><option value="SUBCONTRATO">Subcontrato</option><option value="MIXTO">Mixto</option><option value="NO_APLICA">No aplica</option>
                </select></label>
                <label style={{fontSize:12,fontWeight:850}}>Tipo de contrato<select name={`${key}Contrato`} defaultValue={String(p.contrato??"")} disabled={readOnly||legacy} style={{width:"100%",padding:9,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8,background:"#fff"}}>
                  <option value="">Seleccionar</option><option value="PRECIO_ALZADO">Precio alzado</option><option value="PRECIOS_UNITARIOS">Precios unitarios</option><option value="DESTajo">Destajo</option><option value="MANO_OBRA">Mano de obra</option><option value="SUMINISTRO_INSTALACION">Suministro e instalación</option><option value="ADMINISTRACION">Administración</option><option value="COSTO_PORCENTAJE">Costo + porcentaje</option><option value="RENTA">Renta</option>
                </select></label>
                <label style={{fontSize:12,fontWeight:850}}>Suministro<select name={`${key}Suministro`} defaultValue={String(p.suministro??"")} disabled={readOnly||legacy} style={{width:"100%",padding:9,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8,background:"#fff"}}>
                  <option value="">Seleccionar</option><option value="PROYECTO">Proyecto</option><option value="CONTRATISTA">Contratista</option><option value="CLIENTE">Cliente</option><option value="MIXTO">Mixto</option>
                </select></label>
                <label style={{fontSize:12,fontWeight:850}}>Mano de obra<select name={`${key}ManoObra`} defaultValue={String(p.manoObra??"")} disabled={readOnly||legacy} style={{width:"100%",padding:9,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8,background:"#fff"}}>
                  <option value="">Seleccionar</option><option value="PROPIA">Propia</option><option value="SUBCONTRATADA">Subcontratada</option><option value="DESTAJO">Destajo</option><option value="MIXTA">Mixta</option>
                </select></label>
                <label style={{fontSize:12,fontWeight:850}}>Maquinaria<select name={`${key}Maquinaria`} defaultValue={String(p.maquinaria??"")} disabled={readOnly||legacy} style={{width:"100%",padding:9,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8,background:"#fff"}}>
                  <option value="">Seleccionar</option><option value="PROPIA">Propia</option><option value="RENTADA">Rentada</option><option value="CONTRATISTA">Contratista</option><option value="MIXTA">Mixta</option>
                </select></label>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:9,marginTop:9}}>
                <label style={{fontSize:12,fontWeight:850}}>Responsable<input name={`${key}Responsable`} defaultValue={String(p.responsable??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:9,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
                <label style={{fontSize:12,fontWeight:850}}>Observaciones<input name={`${key}Observaciones`} defaultValue={String(p.observaciones??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:9,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
              </div>
            </article>;
          })}
        </div>

        {!readOnly&&!legacy&&<div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}>
          <button type="submit" style={{border:0,background:"#ff8500",color:"#fff",fontWeight:950,padding:"12px 18px",borderRadius:10,cursor:"pointer"}}>Guardar línea base y estrategia</button>
        </div>}
      </form>

      {(entregables.length>0||riesgos.length>0)&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:16}}>
        <article style={{...card,padding:16}}><h3 style={{marginTop:0}}>Entregables generados</h3>{entregables.map(x=><div key={x} style={{padding:"8px 0",borderBottom:"1px solid #edf2f6",fontSize:12,fontWeight:850}}>✓ {x}</div>)}</article>
        <article style={{...card,padding:16}}><h3 style={{marginTop:0}}>Riesgos / pendientes</h3>{riesgos.length?riesgos.map(x=><div key={x} style={{padding:"8px 0",borderBottom:"1px solid #edf2f6",fontSize:12,fontWeight:850,color:"#b53030"}}>⚠ {x}</div>):<div style={{fontSize:12,color:"#187342",fontWeight:850}}>Sin pendientes críticos registrados.</div>}</article>
      </div>}

      <div style={{...card,marginTop:16,padding:18,background:"#f8fbfd"}}>
        <div style={{fontSize:12,fontWeight:950,color:"#c86100"}}>SIGUIENTE ETAPA</div>
        <h3 style={{margin:"5px 0"}}>Paso 9 · Contratación, suministros y preparación de obra</h3>
        <p style={{margin:0,color:"#526c84"}}>Contratos, compras, almacenes, movilización, campamento, accesos provisionales, personal técnico y condición de “Listo para inicio”.</p>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad/preparacion`} style={{display:"inline-block",marginTop:12,background:"#ff8500",color:"#fff",textDecoration:"none",fontWeight:950,padding:"11px 15px",borderRadius:9}}>Continuar al Paso 9 →</Link>
      </div>

      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad/proyecto`} style={{background:"#053f79",color:"#fff",textDecoration:"none",fontWeight:900,padding:"12px 16px",borderRadius:10}}>← Paso 7 · Proyecto / Permisos</Link>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad`} style={{border:"1px solid #b8cad9",color:"#294f73",textDecoration:"none",fontWeight:900,padding:"12px 16px",borderRadius:10}}>Panel de Constructibilidad</Link>
      </div>
    </section>

    <style>{`
      @media(max-width:1200px){div[style*="1.1fr 1fr 1fr 1fr 1fr 1fr"]{grid-template-columns:1fr 1fr 1fr !important;}}
      @media(max-width:850px){div[style*="1fr 1fr"],div[style*="1fr 2fr"],div[style*="1.1fr 1fr 1fr 1fr 1fr 1fr"]{grid-template-columns:1fr !important;}}
    `}</style>
  </main>;
}
