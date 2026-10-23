import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";
import { pr0002 } from "@/lib/project-manager/pr0002";
import { PmHeader, card } from "@/app/project-manager/panel/_components";
import { guardarPredioConstructibilidad } from "./actions";

const options=[
  ["BRENA","Tierra en breña","Predio sin urbanización integral; requiere revisar habilitación, infraestructura, estudios y permisos."],
  ["MACROLOTE_URBANIZADO","Macrolote urbanizado","Cuenta con infraestructura general, pero requiere validar capacidades, conexiones y urbanización interior."],
  ["MACROLOTE_PARCIAL","Macrolote parcialmente urbanizado","Existe parte de la infraestructura; el sistema identifica faltantes y responsabilidades."],
  ["LOTES_URBANIZADOS","Lotes urbanizados","Lotes con servicios y vialidades; se validan factibilidades y documentos soporte."],
  ["LOTES_PARCIALES","Lotes parcialmente urbanizados","Existen servicios parciales; se activan sólo obras y gestiones faltantes."],
  ["CONSTRUCCION_EXISTENTE","Predio con construcción existente","Requiere diagnóstico de conservación, demolición, interferencias, ampliación o cambio de uso."],
  ["REMODELACION","Remodelación / ampliación","Activa levantamiento de existente, demoliciones, interferencias y operación durante obra."],
  ["MIXTO","Condición mixta","Permite dividir el proyecto por zonas con condiciones distintas."],
] as const;

const checks=[
  ["Límites y acceso",[
    ["limitesDefinidos","Límites del predio claramente definidos"],
    ["deslinde","Deslinde disponible / validado"],
    ["accesoLegal","Acceso legal acreditado"],
    ["accesoFisico","Acceso físico disponible"],
    ["accesoMaquinaria","Acceso apto para maquinaria pesada"],
    ["derechoPaso","Derecho de paso resuelto cuando aplica"],
  ]],
  ["Topografía y suelo",[
    ["topografia","Levantamiento topográfico disponible"],
    ["bancoNivel","Banco de nivel / referencia disponible"],
    ["mecanicaSuelos","Mecánica de suelos disponible"],
    ["rellenos","Se identifican rellenos existentes"],
    ["sueloEspecial","Se identifican condiciones geotécnicas especiales"],
  ]],
  ["Agua y drenaje natural",[
    ["escurrimientos","Existen escurrimientos naturales"],
    ["cauces","Existen cauces / canales"],
    ["zonasInundables","Existen zonas inundables o depresiones críticas"],
    ["obrasHidraulicas","Existen obras hidráulicas en el predio"],
  ]],
  ["Interferencias",[
    ["lineasElectricas","Líneas eléctricas"],
    ["tuberias","Tuberías"],
    ["colectores","Colectores"],
    ["pozos","Pozos"],
    ["construcciones","Construcciones existentes"],
    ["derechosVia","Derechos de vía"],
    ["interferenciasCriticas","Interferencias críticas para el desarrollo"],
  ]],
  ["Urbanización existente",[
    ["agua","Agua potable"],
    ["drenaje","Drenaje sanitario"],
    ["electricidad","Electricidad"],
    ["pluvial","Infraestructura pluvial"],
    ["vialidades","Vialidades"],
    ["alumbrado","Alumbrado"],
    ["telecomunicaciones","Telecomunicaciones"],
  ]],
] as const;

function asObj(value:unknown){ return (value&&typeof value==="object"&&!Array.isArray(value)?value:{}) as Record<string,unknown>; }
function asList(value:unknown){ return Array.isArray(value)?value.map(String):[]; }

export default async function PredioConstructibilidadPage({params,searchParams}:{params:Promise<{codigo:string}>;searchParams:Promise<{guardado?:string}>}) {
  const {session,role,readOnly}=await requireProjectManagerAccess();
  const {codigo}=await params;
  const q=await searchParams;
  const code=codigo.toUpperCase();
  const userId=String((session.user as {id?:string}).id ?? "");

  const proyecto=await prisma.proyectoPM.findUnique({
    where:{codigo:code},
    include:{
      participantes:{where:{usuarioId:userId},select:{id:true}},
      constructibilidad:true,
    },
  });
  const legacy=code==="PR-0002" && !proyecto;
  if(!proyecto && !legacy) notFound();
  if(proyecto){
    const tieneAcceso=role==="DIRECTOR" || role==="ADMINISTRADOR" || proyecto.participantes.length>0;
    if(!tieneAcceso || !proyecto.activo) notFound();
  } else if(role!=="DIRECTOR" && role!=="ADMINISTRADOR") notFound();

  const nombre=proyecto?.nombre ?? pr0002.project.name;
  const data=proyecto?.constructibilidad;
  const identificacion=asObj(data?.identificacion);
  const groups={
    limitesAccesos:asObj(data?.limitesAccesos),
    topografiaSuelo:asObj(data?.topografiaSuelo),
    aguaDrenajeNatural:asObj(data?.aguaDrenajeNatural),
    interferencias:asObj(data?.interferencias),
    urbanizacionExistente:asObj(data?.urbanizacionExistente),
  };
  const all={...groups.limitesAccesos,...groups.topografiaSuelo,...groups.aguaDrenajeNatural,...groups.interferencias,...groups.urbanizacionExistente};
  const entregables=asList(data?.entregablesPaso1);
  const riesgos=asList(data?.riesgosPaso1);
  const modulos=asList(data?.modulosSugeridos);
  const progreso=data?.progresoPaso1 ?? 0;

  return <main style={{minHeight:"100vh",background:"#eef6fb",color:"#082f64"}}>
    <PmHeader title="Constructibilidad · Paso 1" subtitle={`${code} · ${nombre} · Condición inicial del predio / tierra`}/>
    <section style={{maxWidth:1450,margin:"0 auto",padding:"20px 20px 60px"}}>
      {readOnly&&<div style={{...card,marginBottom:14,background:"#e8f3fb",fontWeight:900}}>CLIENTE · SÓLO LECTURA</div>}
      {q.guardado&&<div style={{...card,marginBottom:14,background:"#e7f7ee",color:"#187342",fontWeight:900}}>Información de Constructibilidad guardada correctamente.</div>}
      {legacy&&<div style={{...card,marginBottom:14,background:"#fff5dd",color:"#8a5b00",fontWeight:800}}>PR-0002 aún opera como expediente legado. La captura quedará disponible al completar su migración a ProyectoPM.</div>}

      <div style={{...card,padding:20,border:"2px solid #ff8500",background:"linear-gradient(135deg,#fff8ef,#fff)"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:18,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:12,fontWeight:950,color:"#c86100",letterSpacing:".08em"}}>INICIO DEL ASISTENTE MAESTRO</div>
            <h1 style={{fontSize:28,margin:"6px 0 8px"}}>Condición inicial del predio</h1>
            <p style={{margin:0,color:"#405e78",lineHeight:1.6}}>Las respuestas de este paso determinan estudios, riesgos, módulos y entregables requeridos para alimentar el Expediente Maestro.</p>
          </div>
          <div style={{minWidth:180}}>
            <div style={{fontSize:11,fontWeight:900,color:"#61788f"}}>AVANCE DEL PASO 1</div>
            <div style={{height:12,borderRadius:99,background:"#e1e9ef",overflow:"hidden",marginTop:7}}><div style={{height:"100%",width:`${progreso}%`,background:progreso>=80?"#1f9d55":progreso>=50?"#e6a700":"#d63c3c"}}/></div>
            <div style={{fontSize:24,fontWeight:950,marginTop:5}}>{progreso}%</div>
          </div>
        </div>
      </div>

      <form action={guardarPredioConstructibilidad} style={{marginTop:14}}>
        <input type="hidden" name="codigo" value={code}/>

        <div style={{...card,padding:18}}>
          <h2 style={{margin:"0 0 12px"}}>1. Clasificación del terreno</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
            {options.map(([value,title,desc])=><label key={value} style={{display:"grid",gridTemplateColumns:"22px 1fr",gap:10,border:"1px solid #d8e6f2",borderRadius:10,padding:13,background:data?.condicionPredio===value?"#eef8ff":"#fff",cursor:readOnly?"default":"pointer"}}>
              <input type="radio" name="condicionPredio" value={value} defaultChecked={data?.condicionPredio===value} disabled={readOnly||legacy}/>
              <span><strong>{title}</strong><span style={{display:"block",fontSize:12,color:"#5b7187",lineHeight:1.45,marginTop:3}}>{desc}</span></span>
            </label>)}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10,marginTop:14}}>
            <label style={{fontSize:12,fontWeight:850}}>Superficie total (m²)<input name="superficieM2" type="number" step="0.01" defaultValue={data?.superficieM2?.toString() ?? ""} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",marginTop:5,padding:10,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            <label style={{fontSize:12,fontWeight:850}}>Número de predios<input name="numeroPredios" type="number" min="1" defaultValue={data?.numeroPredios ?? ""} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",marginTop:5,padding:10,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            <label style={{fontSize:12,fontWeight:850}}>Propietario<input name="propietario" defaultValue={String(identificacion.propietario ?? "")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",marginTop:5,padding:10,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            <label style={{fontSize:12,fontWeight:850}}>Clave catastral<input name="claveCatastral" defaultValue={String(identificacion.claveCatastral ?? "")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",marginTop:5,padding:10,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:10}}>
            <label style={{fontSize:12,fontWeight:850}}>Disponibilidad física<select name="disponibilidadFisica" defaultValue={data?.disponibilidadFisica ?? ""} disabled={readOnly||legacy} style={{width:"100%",marginTop:5,padding:10,border:"1px solid #cbd9e5",borderRadius:8,background:"#fff"}}>
              <option value="">Seleccionar</option><option value="TOTAL">Total</option><option value="PARCIAL">Parcial</option><option value="POR_ETAPAS">Por etapas</option><option value="OCUPADO">Ocupado</option><option value="PENDIENTE">Pendiente de entrega</option>
            </select></label>
            <label style={{fontSize:12,fontWeight:850}}>Detalle / observaciones<input name="clasificacionDetalle" defaultValue={data?.clasificacionDetalle ?? ""} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",marginTop:5,padding:10,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
          </div>
          <label style={{display:"flex",gap:8,alignItems:"center",fontSize:12,fontWeight:850,marginTop:10}}><input type="checkbox" name="poligonoDisponible" defaultChecked={identificacion.poligonoDisponible===true} disabled={readOnly||legacy}/> Polígono / coordenadas disponibles</label>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12,marginTop:12}}>
          {checks.map(([title,items])=><article key={title} style={{...card,padding:16}}>
            <h3 style={{margin:"0 0 10px"}}>{title}</h3>
            <div style={{display:"grid",gap:8}}>
              {items.map(([name,label])=><label key={name} style={{display:"flex",gap:9,alignItems:"flex-start",fontSize:13,lineHeight:1.4}}>
                <input type="checkbox" name={name} defaultChecked={all[name]===true} disabled={readOnly||legacy}/><span>{label}</span>
              </label>)}
            </div>
          </article>)}
        </div>

        {!readOnly&&!legacy&&<div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}>
          <button type="submit" style={{border:0,background:"#ff8500",color:"#fff",fontWeight:950,padding:"12px 18px",borderRadius:10,cursor:"pointer"}}>Guardar y recalcular Constructibilidad</button>
          <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad`} style={{background:"#053f79",color:"#fff",textDecoration:"none",fontWeight:900,padding:"12px 16px",borderRadius:10}}>Volver al panel</Link>
        </div>}
      </form>

      {(entregables.length>0||riesgos.length>0||modulos.length>0)&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:12,marginTop:16}}>
        <article style={{...card,padding:16}}><h3 style={{marginTop:0}}>Entregables generados</h3>{entregables.map(x=><div key={x} style={{padding:"7px 0",borderBottom:"1px solid #edf2f6",fontSize:12,fontWeight:800}}>✓ {x}</div>)}</article>
        <article style={{...card,padding:16}}><h3 style={{marginTop:0}}>Riesgos preliminares</h3>{riesgos.length?riesgos.map(x=><div key={x} style={{padding:"7px 0",borderBottom:"1px solid #edf2f6",fontSize:12,fontWeight:800,color:"#b53030"}}>⚠ {x}</div>):<div style={{fontSize:12,color:"#4f6c82"}}>Sin riesgos preliminares registrados.</div>}</article>
        <article style={{...card,padding:16}}><h3 style={{marginTop:0}}>Módulos sugeridos</h3>{modulos.map(x=><div key={x} style={{padding:"7px 0",borderBottom:"1px solid #edf2f6",fontSize:12,fontWeight:800}}>▣ {x}</div>)}</article>
      </div>}

      <div style={{...card,marginTop:16,padding:18,background:"#f8fbfd"}}>
        <div style={{fontSize:12,fontWeight:950,color:"#c86100"}}>SIGUIENTE BLOQUE LÓGICO</div>
        <h3 style={{margin:"5px 0 5px"}}>Paso 2 · Situación jurídica, uso de suelo y condiciones urbanísticas</h3>
        <p style={{margin:0,color:"#526c84",lineHeight:1.5}}>Se activará como siguiente etapa del asistente y utilizará las conclusiones guardadas en este Paso 1.</p>
      </div>

      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad`} style={{background:"#053f79",color:"#fff",textDecoration:"none",fontWeight:900,padding:"12px 16px",borderRadius:10}}>← Volver a Constructibilidad</Link>
      </div>
    </section>

    <style>{`
      @media(max-width:900px){div[style*="repeat(4"],div[style*="repeat(3"]{grid-template-columns:1fr 1fr !important;}}
      @media(max-width:650px){div[style*="repeat(2"],div[style*="repeat(3"],div[style*="repeat(4"]{grid-template-columns:1fr !important;}}
    `}</style>
  </main>;
}
