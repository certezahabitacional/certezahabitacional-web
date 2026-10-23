import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";
import { pr0002 } from "@/lib/project-manager/pr0002";
import { PmHeader, card } from "@/app/project-manager/panel/_components";
import { cerrarConstructibilidad } from "./actions";

function asObj(v:unknown){return (v&&typeof v==="object"&&!Array.isArray(v)?v:{}) as Record<string,unknown>;}
function asRows(v:unknown){return Array.isArray(v)?v as Record<string,unknown>[]:[];}
function asList(v:unknown){return Array.isArray(v)?v.map(String):[];}

const stateLabel:Record<string,string>={
  NO_CONFIGURADO:"No configurado",
  CONFIGURADO_CON_CONDICIONES:"Configurado con condiciones",
  LISTO_PARA_LINEA_BASE:"Listo para línea base",
  LISTO_PARA_EJECUCION:"Listo para ejecución",
};

const stateColor:Record<string,string>={
  NO_CONFIGURADO:"#d63c3c",
  CONFIGURADO_CON_CONDICIONES:"#e6a700",
  LISTO_PARA_LINEA_BASE:"#0b73ba",
  LISTO_PARA_EJECUCION:"#1f9d55",
};

export default async function CierreConstructibilidadPage({params,searchParams}:{params:Promise<{codigo:string}>;searchParams:Promise<{generado?:string}>}) {
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
  const cierre=asObj(data?.cierreConstructibilidad);
  const modulos=asRows(data?.matrizMaestraConfiguracion);
  const liberaciones=asRows(data?.liberacionesMaestras);
  const riesgos=asList(data?.riesgosPaso12);
  const estado=String(data?.estadoPaso12??"BORRADOR");
  const color=stateColor[estado]??"#8fa2b5";
  const pasos=[
    data?.progresoPaso1??0,data?.progresoPaso2??0,data?.progresoPaso3??0,data?.progresoPaso4??0,
    data?.progresoPaso5??0,data?.progresoPaso6??0,data?.progresoPaso7??0,data?.progresoPaso8??0,
    data?.progresoPaso9??0,data?.progresoPaso10??0,data?.progresoPaso11??0
  ];

  return <main style={{minHeight:"100vh",background:"#eef6fb",color:"#082f64"}}>
    <PmHeader title="Constructibilidad · Cierre" subtitle={`${code} · ${nombre} · Matriz Maestra de Configuración del Proyecto`}/>
    <section style={{maxWidth:1600,margin:"0 auto",padding:"20px 20px 60px"}}>
      {q.generado&&<div style={{...card,marginBottom:14,background:"#e7f7ee",color:"#187342",fontWeight:900}}>Cierre de Constructibilidad recalculado correctamente.</div>}
      {readOnly&&<div style={{...card,marginBottom:14,background:"#e8f3fb",fontWeight:900}}>CLIENTE · SÓLO LECTURA</div>}
      {legacy&&<div style={{...card,marginBottom:14,background:"#fff5dd",color:"#8a5b00",fontWeight:800}}>PR-0002 requiere completar su migración para calcular este cierre.</div>}

      <div style={{...card,padding:22,border:`2px solid ${color}`,background:"#fff"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:24,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:12,fontWeight:950,color,letterSpacing:".08em"}}>DICTAMEN FINAL DE CONSTRUCTIBILIDAD</div>
            <h1 style={{margin:"6px 0 8px",fontSize:30}}>{stateLabel[estado]??"Pendiente de generar"}</h1>
            <p style={{margin:0,color:"#4a657d",lineHeight:1.55,maxWidth:850}}>
              El cierre consolida los once pasos previos y determina si el proyecto puede pasar a línea base, si requiere condiciones previas o si está listo para entrar a ejecución.
            </p>
          </div>
          <div style={{minWidth:230}}>
            <div style={{fontSize:11,fontWeight:900}}>AVANCE GLOBAL</div>
            <div style={{height:14,borderRadius:99,background:"#e3ebf1",overflow:"hidden",marginTop:7}}><div style={{height:"100%",width:`${Number(cierre.avanceGlobal??0)}%`,background:color}}/></div>
            <div style={{fontSize:30,fontWeight:950,marginTop:5}}>{Number(cierre.avanceGlobal??0)}%</div>
          </div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:10,marginTop:14}}>
        {[
          ["Módulos activos",Number(cierre.modulosActivos??0)],
          ["Entregables del expediente",Number(cierre.entregablesExpediente??0)],
          ["Reglas de seguimiento",Number(cierre.reglasSeguimiento??0)],
          ["Riesgos abiertos",Number(cierre.riesgosAbiertos??0)],
          ["Riesgos críticos",Number(cierre.riesgosCriticos??0)],
        ].map(([label,value])=><article key={String(label)} style={{...card,padding:15}}>
          <div style={{fontSize:11,fontWeight:900,color:"#61788f"}}>{label}</div>
          <div style={{fontSize:28,fontWeight:950,marginTop:5}}>{value}</div>
        </article>)}
      </div>

      <div style={{...card,marginTop:14,padding:18}}>
        <h2 style={{marginTop:0}}>Avance por paso</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(6,minmax(0,1fr))",gap:9}}>
          {pasos.map((pct,i)=><div key={i} style={{border:"1px solid #d8e6f2",borderRadius:9,padding:10,background:"#fbfdff"}}>
            <div style={{fontSize:11,fontWeight:900}}>Paso {i+1}</div>
            <div style={{fontSize:20,fontWeight:950,marginTop:4}}>{pct}%</div>
            <div style={{height:6,borderRadius:99,background:"#e5edf3",overflow:"hidden",marginTop:5}}><div style={{height:"100%",width:`${pct}%`,background:pct>=80?"#1f9d55":pct>=50?"#e6a700":"#d63c3c"}}/></div>
          </div>)}
        </div>
      </div>

      {!data?.cierreConstructibilidad && !readOnly && !legacy && <form action={cerrarConstructibilidad} style={{marginTop:14}}>
        <input type="hidden" name="codigo" value={code}/>
        <button type="submit" style={{border:0,background:"#ff8500",color:"#fff",fontWeight:950,padding:"13px 20px",borderRadius:10,cursor:"pointer"}}>Generar cierre de Constructibilidad</button>
      </form>}

      {data?.cierreConstructibilidad && !readOnly && !legacy && <form action={cerrarConstructibilidad} style={{marginTop:14}}>
        <input type="hidden" name="codigo" value={code}/>
        <button type="submit" style={{border:"1px solid #ff8500",background:"#fff",color:"#c86100",fontWeight:950,padding:"11px 16px",borderRadius:10,cursor:"pointer"}}>Recalcular cierre</button>
      </form>}

      <div style={{display:"grid",gridTemplateColumns:"1.1fr .9fr",gap:14,marginTop:16}}>
        <article style={{...card,padding:0,overflow:"hidden"}}>
          <div style={{padding:"14px 16px",fontWeight:950,fontSize:19,borderBottom:"1px solid #d8e6f2"}}>Matriz Maestra de Configuración</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:850}}>
              <thead><tr style={{background:"#f2f7fb",textAlign:"left"}}>
                {["ID","Módulo","Activo","Origen","Dependencia","Responsable","Estado"].map(h=><th key={h} style={{padding:9,borderBottom:"1px solid #d8e6f2"}}>{h}</th>)}
              </tr></thead>
              <tbody>{modulos.length?modulos.map(row=><tr key={String(row.id)}>
                <td style={{padding:9,borderBottom:"1px solid #edf2f6",fontWeight:900}}>{String(row.id??"")}</td>
                <td style={{padding:9,borderBottom:"1px solid #edf2f6",fontWeight:850}}>{String(row.modulo??"")}</td>
                <td style={{padding:9,borderBottom:"1px solid #edf2f6"}}>{row.activo===true?"Sí":"No"}</td>
                <td style={{padding:9,borderBottom:"1px solid #edf2f6"}}>{String(row.origen??"")}</td>
                <td style={{padding:9,borderBottom:"1px solid #edf2f6"}}>{String(row.dependencia??"—")}</td>
                <td style={{padding:9,borderBottom:"1px solid #edf2f6"}}>{String(row.responsable??"—")}</td>
                <td style={{padding:9,borderBottom:"1px solid #edf2f6"}}>{String(row.estado??"")}</td>
              </tr>):<tr><td colSpan={7} style={{padding:18,color:"#60778d"}}>Genera el cierre para crear la matriz.</td></tr>}</tbody>
            </table>
          </div>
        </article>

        <article style={{...card,padding:0,overflow:"hidden"}}>
          <div style={{padding:"14px 16px",fontWeight:950,fontSize:19,borderBottom:"1px solid #d8e6f2"}}>Liberaciones maestras</div>
          <div style={{padding:"0 15px"}}>
            {liberaciones.length?liberaciones.map(row=>{
              const ok=String(row.estado)==="LIBERADO";
              return <div key={String(row.id)} style={{display:"grid",gridTemplateColumns:"74px 1fr 110px",gap:10,alignItems:"center",padding:"10px 0",borderBottom:"1px solid #edf2f6"}}>
                <div style={{fontSize:11,fontWeight:950}}>{String(row.id)}</div>
                <div><div style={{fontSize:12,fontWeight:900}}>{String(row.nombre)}</div><div style={{fontSize:10,color:"#61788f"}}>{String(row.dependencia)}</div></div>
                <div style={{fontSize:11,fontWeight:950,color:ok?"#187342":"#b53030",textAlign:"right"}}>{String(row.estado)}</div>
              </div>;
            }):<div style={{padding:18,color:"#60778d"}}>Sin liberaciones generadas.</div>}
          </div>
        </article>
      </div>

      <div style={{...card,marginTop:16,padding:18}}>
        <h2 style={{marginTop:0}}>Riesgos consolidados</h2>
        {riesgos.length?<div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
          {risksSafe(riesgos).map((r,i)=><div key={i} style={{border:"1px solid #f0d1d1",background:"#fff7f7",borderRadius:8,padding:10,fontSize:12,fontWeight:800,color:"#9f2f2f"}}>⚠ {r}</div>)}
        </div>:<div style={{color:"#187342",fontWeight:850}}>No existen riesgos consolidados registrados.</div>}
      </div>

      <div style={{...card,marginTop:16,padding:18,background:"#f8fbfd"}}>
        <div style={{fontSize:12,fontWeight:950,color:"#c86100"}}>SALIDA DE CONSTRUCTIBILIDAD</div>
        <h3 style={{margin:"5px 0"}}>El siguiente paso fuera de Constructibilidad es establecer las líneas base definitivas y comenzar la operación del proyecto.</h3>
        <p style={{margin:0,color:"#526c84"}}>El Expediente Maestro y la Matriz de Seguimiento serán las dos fuentes principales para alimentar Certeza Project Manager durante la ejecución.</p>
        <Link href={`/project-manager/panel/proyectos/${codigo}/linea-base`} style={{display:"inline-block",marginTop:12,background:"#1f9d55",color:"#fff",textDecoration:"none",fontWeight:950,padding:"11px 15px",borderRadius:9}}>Continuar a Línea Base Definitiva →</Link>
      </div>

      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad/expediente`} style={{background:"#053f79",color:"#fff",textDecoration:"none",fontWeight:900,padding:"12px 16px",borderRadius:10}}>← Paso 11 · Expediente Maestro</Link>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad`} style={{border:"1px solid #b8cad9",color:"#294f73",textDecoration:"none",fontWeight:900,padding:"12px 16px",borderRadius:10}}>Panel de Constructibilidad</Link>
      </div>
    </section>

    <style>{`
      @media(max-width:1100px){div[style*="repeat(5"],div[style*="repeat(6"]{grid-template-columns:repeat(3,minmax(0,1fr)) !important;}div[style*="1.1fr .9fr"]{grid-template-columns:1fr !important;}}
      @media(max-width:700px){div[style*="repeat(5"],div[style*="repeat(6"],div[style*="repeat(2"]{grid-template-columns:1fr !important;}}
    `}</style>
  </main>;
}

function risksSafe(items:string[]){ return Array.from(new Set(items)).slice(0,30); }
