import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";
import { pr0002 } from "@/lib/project-manager/pr0002";
import { PmHeader, card } from "@/app/project-manager/panel/_components";
import { guardarPreparacionConstructibilidad } from "./actions";

function asObj(v:unknown){return (v&&typeof v==="object"&&!Array.isArray(v)?v:{}) as Record<string,unknown>;}
function asList(v:unknown){return Array.isArray(v)?v.map(String):[];}

export default async function PreparacionConstructibilidadPage({params,searchParams}:{params:Promise<{codigo:string}>;searchParams:Promise<{guardado?:string}>}) {
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
  const contratacion=asObj(data?.contratacionSuministros);
  const prep=asObj(data?.preparacionObra);
  const entregables=asList(data?.entregablesPaso9);
  const riesgos=asList(data?.riesgosPaso9);
  const progreso=data?.progresoPaso9 ?? 0;
  const listo=data?.estadoPaso9==="LISTO_PARA_INICIO";

  const Check=({name,label,source}:{name:string;label:string;source:Record<string,unknown>})=><label style={{display:"flex",gap:8,marginTop:9,fontSize:13}}>
    <input type="checkbox" name={name} defaultChecked={source[name]===true} disabled={readOnly||legacy}/>{label}
  </label>;

  return <main style={{minHeight:"100vh",background:"#eef6fb",color:"#082f64"}}>
    <PmHeader title="Constructibilidad · Paso 9" subtitle={`${code} · ${nombre} · Contratación, suministros y preparación de obra`}/>
    <section style={{maxWidth:1400,margin:"0 auto",padding:"20px 20px 60px"}}>
      {q.guardado&&<div style={{...card,marginBottom:14,background:"#e7f7ee",color:"#187342",fontWeight:900}}>Paso 9 guardado correctamente.</div>}
      {readOnly&&<div style={{...card,marginBottom:14,background:"#e8f3fb",fontWeight:900}}>CLIENTE · SÓLO LECTURA</div>}
      {legacy&&<div style={{...card,marginBottom:14,background:"#fff5dd",color:"#8a5b00",fontWeight:800}}>PR-0002 requiere completar su migración para guardar esta información.</div>}

      <div style={{...card,padding:20,border:`2px solid ${listo?"#1f9d55":"#ff8500"}`}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:20,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:12,fontWeight:950,color:listo?"#187342":"#c86100"}}>PASO 9</div>
            <h1 style={{margin:"5px 0 7px",fontSize:28}}>{listo?"Proyecto listo para iniciar":"¿Está realmente lista la obra para arrancar?"}</h1>
            <p style={{margin:0,color:"#4a657d",lineHeight:1.55}}>Este paso valida contratación, suministros, logística, seguridad, instalaciones provisionales y personal técnico antes de liberar el inicio físico.</p>
          </div>
          <div style={{minWidth:190}}>
            <div style={{fontSize:11,fontWeight:900}}>CONDICIÓN DE ARRANQUE</div>
            <div style={{height:12,borderRadius:99,background:"#e3ebf1",overflow:"hidden",marginTop:7}}><div style={{height:"100%",width:`${progreso}%`,background:listo?"#1f9d55":progreso>=50?"#e6a700":"#d63c3c"}}/></div>
            <div style={{fontSize:24,fontWeight:950,marginTop:5}}>{progreso}%</div>
            <div style={{fontSize:12,fontWeight:900,color:listo?"#187342":"#8a5b00"}}>{listo?"LISTO PARA INICIO":"EN PREPARACIÓN"}</div>
          </div>
        </div>
      </div>

      <form action={guardarPreparacionConstructibilidad} style={{marginTop:14}}>
        <input type="hidden" name="codigo" value={code}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <article style={{...card,padding:18}}>
            <h2 style={{marginTop:0}}>9.1 Contratación y suministros</h2>
            <Check name="contratosClave" label="Contratos clave formalizados" source={contratacion}/>
            <Check name="alcancesCerrados" label="Alcances y exclusiones cerrados" source={contratacion}/>
            <Check name="garantias" label="Garantías / fianzas definidas" source={contratacion}/>
            <Check name="programaCompras" label="Programa de compras disponible" source={contratacion}/>
            <Check name="proveedoresCriticos" label="Proveedores críticos definidos" source={contratacion}/>
            <Check name="ordenesCompra" label="Órdenes de compra iniciales emitidas" source={contratacion}/>
            <Check name="almacenDefinido" label="Almacén / estrategia de inventario definida" source={contratacion}/>
            <Check name="responsablesSuministro" label="Responsables de suministro definidos por paquete" source={contratacion}/>
            <label style={{display:"block",fontSize:12,fontWeight:850,marginTop:12}}>Observaciones<input name="contratacionObservaciones" defaultValue={String(contratacion.observaciones??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:10,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
          </article>

          <article style={{...card,padding:18}}>
            <h2 style={{marginTop:0}}>9.2 Preparación de obra</h2>
            <Check name="campamento" label="Campamento / instalaciones provisionales" source={prep}/>
            <Check name="oficinas" label="Oficinas de obra" source={prep}/>
            <Check name="bodega" label="Bodega / almacén" source={prep}/>
            <Check name="seguridad" label="Control de accesos y seguridad física" source={prep}/>
            <Check name="accesosProvisionales" label="Accesos provisionales operables" source={prep}/>
            <Check name="energiaProvisional" label="Energía provisional" source={prep}/>
            <Check name="aguaProvisional" label="Agua provisional" source={prep}/>
            <Check name="senalizacion" label="Señalización inicial" source={prep}/>
            <Check name="trazoControl" label="Trazo y control topográfico disponibles" source={prep}/>
            <Check name="personalTecnico" label="Personal técnico movilizado" source={prep}/>
            <Check name="contratistasMovilizados" label="Contratistas clave movilizados" source={prep}/>
            <Check name="planSeguridad" label="Plan de seguridad aprobado" source={prep}/>
            <Check name="bitacora" label="Bitácora / control documental habilitado" source={prep}/>
            <label style={{display:"block",fontSize:12,fontWeight:850,marginTop:12}}>Observaciones<input name="preparacionObservaciones" defaultValue={String(prep.observaciones??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:10,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
          </article>
        </div>

        {!readOnly&&!legacy&&<div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}>
          <button type="submit" style={{border:0,background:"#ff8500",color:"#fff",fontWeight:950,padding:"12px 18px",borderRadius:10,cursor:"pointer"}}>Guardar y evaluar Listo para Inicio</button>
        </div>}
      </form>

      {(entregables.length>0||riesgos.length>0)&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:16}}>
        <article style={{...card,padding:16}}><h3 style={{marginTop:0}}>Entregables del Paso 9</h3>{entregables.map(x=><div key={x} style={{padding:"8px 0",borderBottom:"1px solid #edf2f6",fontSize:12,fontWeight:850}}>✓ {x}</div>)}</article>
        <article style={{...card,padding:16}}><h3 style={{marginTop:0}}>Pendientes de arranque</h3>{riesgos.length?riesgos.map(x=><div key={x} style={{padding:"8px 0",borderBottom:"1px solid #edf2f6",fontSize:12,fontWeight:850,color:"#b53030"}}>⚠ {x}</div>):<div style={{fontSize:12,color:"#187342",fontWeight:850}}>Sin pendientes críticos de arranque.</div>}</article>
      </div>}

      <div style={{...card,marginTop:16,padding:18,background:"#f8fbfd"}}>
        <div style={{fontSize:12,fontWeight:950,color:"#c86100"}}>SIGUIENTE ETAPA</div>
        <h3 style={{margin:"5px 0"}}>Paso 10 · Estructura de ejecución y seguimiento</h3>
        <p style={{margin:0,color:"#526c84"}}>Definiremos qué información se capturará durante la obra, con qué frecuencia, por quién, en qué módulo y qué reporte alimentará: avance, costo, calidad, seguridad, contratos, materiales, mano de obra, maquinaria y evidencias.</p>
      </div>

      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad/ejecucion`} style={{background:"#053f79",color:"#fff",textDecoration:"none",fontWeight:900,padding:"12px 16px",borderRadius:10}}>← Paso 8 · Presupuesto / Programa</Link>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad`} style={{border:"1px solid #b8cad9",color:"#294f73",textDecoration:"none",fontWeight:900,padding:"12px 16px",borderRadius:10}}>Panel de Constructibilidad</Link>
      </div>
    </section>

    <style>{`@media(max-width:850px){div[style*="1fr 1fr"]{grid-template-columns:1fr !important;}}`}</style>
  </main>;
}
