import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";
import { pr0002 } from "@/lib/project-manager/pr0002";
import { PmHeader, card } from "@/app/project-manager/panel/_components";

const options=[
  ["Tierra en breña","Predio sin urbanización integral; requiere revisar habilitación, infraestructura, estudios y permisos."],
  ["Macrolote urbanizado","Cuenta con infraestructura general, pero requiere validar capacidades, conexiones y urbanización interior."],
  ["Macrolote parcialmente urbanizado","Existe parte de la infraestructura; el sistema deberá identificar faltantes y responsabilidades."],
  ["Lotes urbanizados","Lotes con servicios y vialidades; se deberán validar factibilidades y documentos de soporte."],
  ["Lotes parcialmente urbanizados","Existen servicios parciales; se activan sólo las obras y gestiones faltantes."],
  ["Predio con construcción existente","Requiere diagnóstico de conservación, demolición, interferencias, ampliación o cambio de uso."],
  ["Remodelación / ampliación","Activa levantamiento de existente, demoliciones, interferencias y operación durante obra."],
  ["Condición mixta","Permite dividir el proyecto por zonas con condiciones distintas: breña, macrolote, lotes u obra existente."],
] as const;

const blocks=[
  ["1.1 Identificación del predio",["Superficie total","Número de predios","Propietario","Clave catastral","Polígono / coordenadas","Disponibilidad física"]],
  ["1.2 Límites y acceso",["Límites identificados","Deslinde","Acceso legal","Acceso físico","Acceso para maquinaria","Derechos de paso"]],
  ["1.3 Topografía y suelo",["Levantamiento topográfico","Bancos de nivel","Pendientes","Mecánica de suelos","Rellenos existentes","Condiciones geotécnicas especiales"]],
  ["1.4 Agua y drenaje natural",["Escurrimientos","Cauces","Canales","Zonas inundables","Depresiones","Obras hidráulicas existentes"]],
  ["1.5 Interferencias",["Líneas eléctricas","Tuberías","Colectores","Pozos","Construcciones","Vegetación","Derechos de vía","Infraestructura existente"]],
  ["1.6 Urbanización existente",["Agua potable","Drenaje sanitario","Electricidad","Pluvial","Vialidades","Alumbrado","Telecomunicaciones"]],
] as const;

export default async function PredioConstructibilidadPage({params}:{params:Promise<{codigo:string}>}) {
  const {session,role,readOnly}=await requireProjectManagerAccess();
  const {codigo}=await params;
  const code=codigo.toUpperCase();
  const userId=String((session.user as {id?:string}).id ?? "");

  const proyecto=await prisma.proyectoPM.findUnique({
    where:{codigo:code},
    include:{participantes:{where:{usuarioId:userId},select:{id:true}}},
  });
  const legacy=code==="PR-0002" && !proyecto;
  if(!proyecto && !legacy) notFound();
  if(proyecto){
    const tieneAcceso=role==="DIRECTOR" || role==="ADMINISTRADOR" || proyecto.participantes.length>0;
    if(!tieneAcceso || !proyecto.activo) notFound();
  } else if(role!=="DIRECTOR" && role!=="ADMINISTRADOR") notFound();

  const nombre=proyecto?.nombre ?? pr0002.project.name;

  return <main style={{minHeight:"100vh",background:"#eef6fb",color:"#082f64"}}>
    <PmHeader title="Constructibilidad · Paso 1" subtitle={`${code} · ${nombre} · Condición inicial del predio / tierra`}/>
    <section style={{maxWidth:1400,margin:"0 auto",padding:"20px 20px 60px"}}>
      {readOnly&&<div style={{...card,marginBottom:14,background:"#e8f3fb",fontWeight:900}}>CLIENTE · SÓLO LECTURA</div>}

      <div style={{...card,padding:20,border:"2px solid #ff8500",background:"linear-gradient(135deg,#fff8ef,#fff)"}}>
        <div style={{fontSize:12,fontWeight:950,color:"#c86100",letterSpacing:".08em"}}>INICIO DEL ASISTENTE MAESTRO</div>
        <h1 style={{fontSize:28,margin:"6px 0 8px"}}>¿Cuál es la condición física y urbana actual del predio?</h1>
        <p style={{margin:0,color:"#405e78",lineHeight:1.6}}>Esta respuesta determina las siguientes preguntas y los módulos preliminares de habilitación, estudios, infraestructura, urbanización y autorizaciones.</p>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12,marginTop:14}}>
        {options.map(([title,desc],i)=><article key={title} style={{...card,padding:17,display:"grid",gridTemplateColumns:"28px 1fr",gap:12,alignItems:"start"}}>
          <div style={{width:26,height:26,borderRadius:"50%",border:"2px solid #0b73ba",display:"grid",placeItems:"center",fontSize:11,fontWeight:950,color:"#0b73ba"}}>{i+1}</div>
          <div><h3 style={{margin:"0 0 5px",fontSize:16}}>{title}</h3><p style={{margin:0,color:"#526c84",fontSize:13,lineHeight:1.5}}>{desc}</p></div>
        </article>)}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:12,marginTop:16}}>
        {blocks.map(([title,items])=><article key={title} style={{...card,padding:17}}>
          <h3 style={{margin:"0 0 9px",fontSize:16}}>{title}</h3>
          <ul style={{margin:0,paddingLeft:18,color:"#405e78",lineHeight:1.75,fontSize:13}}>
            {items.map(x=><li key={x}>{x}</li>)}
          </ul>
        </article>)}
      </div>

      <div style={{...card,marginTop:16,padding:18}}>
        <h2 style={{margin:"0 0 10px",fontSize:20}}>Entregables que debe producir este paso</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:9}}>
          {["Ficha de condición inicial","Matriz de información disponible","Matriz de estudios requeridos","Riesgos preliminares","Interferencias","Pendientes territoriales","Requerimientos del Expediente Maestro","Módulos preliminares sugeridos"].map(x=><div key={x} style={{border:"1px solid #d8e6f2",borderRadius:9,padding:11,background:"#fbfdff",fontSize:12,fontWeight:850}}>{x}</div>)}
        </div>
      </div>

      <div style={{...card,marginTop:16,padding:18,background:"#f8fbfd"}}>
        <div style={{fontSize:12,fontWeight:950,color:"#c86100"}}>SIGUIENTE BLOQUE LÓGICO</div>
        <h3 style={{margin:"5px 0 5px"}}>Paso 2 · Situación jurídica, uso de suelo y condiciones urbanísticas</h3>
        <p style={{margin:0,color:"#526c84",lineHeight:1.5}}>El sistema deberá habilitar este paso conforme se concluya la condición del predio y sus pendientes críticos.</p>
      </div>

      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad`} style={{background:"#053f79",color:"#fff",textDecoration:"none",fontWeight:900,padding:"12px 16px",borderRadius:10}}>← Volver a Constructibilidad</Link>
        {!readOnly&&<span style={{background:"#dfe8ef",color:"#6c8092",fontWeight:900,padding:"12px 16px",borderRadius:10}}>Captura y guardado: siguiente integración</span>}
      </div>
    </section>

    <style>{`
      @media(max-width:900px){
        div[style*="repeat(3"],div[style*="repeat(4"]{grid-template-columns:1fr 1fr !important;}
      }
      @media(max-width:650px){
        div[style*="repeat(2"],div[style*="repeat(3"],div[style*="repeat(4"]{grid-template-columns:1fr !important;}
      }
    `}</style>
  </main>;
}
