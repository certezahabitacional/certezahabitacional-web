import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";
import { PmHeader, card } from "@/app/project-manager/panel/_components";

type CheckStatus="COMPLETO"|"PENDIENTE"|"PARCIAL"|"NO_APLICA";
const statusStyle:Record<CheckStatus,{bg:string;color:string;label:string}>={
  COMPLETO:{bg:"#e7f7ee",color:"#187342",label:"Completo"},
  PARCIAL:{bg:"#fff5dd",color:"#8a5b00",label:"En integración"},
  PENDIENTE:{bg:"#fff0f0",color:"#b53030",label:"Pendiente"},
  NO_APLICA:{bg:"#edf2f6",color:"#60778d",label:"No aplica"},
};

function aggregate(values:number[]):CheckStatus{
  if(values.every(v=>v>=80)) return "COMPLETO";
  if(values.some(v=>v>0)) return "PARCIAL";
  return "PENDIENTE";
}

export default async function ConstructibilidadChecklistPage({params}:{params:Promise<{codigo:string}>}) {
  const {session,role,readOnly}=await requireProjectManagerAccess();
  const {codigo}=await params;
  const code=codigo.toUpperCase();
  const userId=String((session.user as {id?:string}).id ?? "");

  const proyecto=await prisma.proyectoPM.findUnique({
    where:{codigo:code},
    include:{
      participantes:{where:{usuarioId:userId},select:{id:true}},
      constructibilidad:true,
      documentosMaestros:{where:{activo:true},select:{id:true,codigo:true,estado:true}}
    }
  });
  if(!proyecto||!proyecto.activo) notFound();
  const ok=role==="DIRECTOR"||role==="ADMINISTRADOR"||proyecto.participantes.length>0;
  if(!ok) notFound();

  const c=proyecto.constructibilidad;
  const p=(n:number)=>c ? Number((c as any)[`progresoPaso${n}`]??0) : 0;

  const blocks=[
    {
      code:"A",title:"Predio y situación legal",
      desc:"Condición del terreno, propiedad, accesos, uso de suelo, restricciones y disponibilidad.",
      status:aggregate([p(1),p(2)]),links:[["Definir predio","predio"],["Legal / uso de suelo","legal"]],
      items:["Predio","Accesos","Situación jurídica","Uso de suelo","Restricciones"]
    },
    {
      code:"B",title:"Servicios y estudios",
      desc:"Factibilidades, infraestructura existente y estudios técnicos que condicionan el proyecto.",
      status:aggregate([p(3),p(4)]),links:[["Servicios","servicios"],["Estudios","estudios"]],
      items:["Agua","Drenaje","Electricidad","Topografía","Mecánica de suelos","Estudios especiales"]
    },
    {
      code:"C",title:"Producto y alcance",
      desc:"Qué se construirá, escala, etapas, frentes, unidades, edificios y estructura física de control.",
      status:aggregate([p(5)]),links:[["Definir producto","producto"]],
      items:["Tipo de proyecto","Escala","Etapas","Frentes","Unidades / edificios"]
    },
    {
      code:"D",title:"Proyecto y permisos",
      desc:"Proyecto ejecutivo por disciplina, licencias, dictámenes y autorizaciones.",
      status:aggregate([p(7)]),links:[["Proyecto / permisos","proyecto"]],
      items:["Arquitectura","Ingenierías","Licencias","Autorizaciones","Liberaciones"]
    },
    {
      code:"E",title:"Presupuesto y programa",
      desc:"Costo base, catálogo, precios unitarios, programa maestro, hitos y ruta crítica.",
      status:aggregate([p(8)]),links:[["Presupuesto / programa","ejecucion"]],
      items:["Presupuesto","Catálogo","Programa","Hitos","Ruta crítica"]
    },
    {
      code:"F",title:"Ejecución y contratación",
      desc:"Administración directa, subcontratos, suministros, mano de obra, maquinaria y responsables.",
      status:aggregate([p(8),p(9)]),links:[["Estrategia de ejecución","ejecucion"],["Contratación / preparación","preparacion"]],
      items:["Modalidad","Contratos","Suministros","Mano de obra","Maquinaria"]
    },
    {
      code:"G",title:"Organización y control",
      desc:"Responsables, periodicidades, calidad, seguridad, riesgos, cambios y evidencias.",
      status:aggregate([p(10)]),links:[["Configurar seguimiento","seguimiento"]],
      items:["Responsables","Periodicidad","Calidad","Seguridad","Riesgos","Cambios"]
    },
    {
      code:"H",title:"Preparación para iniciar",
      desc:"Condiciones mínimas de arranque, instalaciones provisionales, personal, bitácora y liberaciones.",
      status:aggregate([p(9)]),links:[["Preparación de obra","preparacion"]],
      items:["Accesos","Instalaciones provisionales","Personal técnico","Seguridad","Bitácora"]
    },
  ] as const;

  const completed=blocks.filter(b=>b.status==="COMPLETO").length;
  const partial=blocks.filter(b=>b.status==="PARCIAL").length;
  const pending=blocks.filter(b=>b.status==="PENDIENTE").length;
  const overall=Math.round(blocks.reduce((a,b)=>{
    const v=b.status==="COMPLETO"?100:b.status==="PARCIAL"?50:0; return a+v;
  },0)/blocks.length);

  const docs=proyecto.documentosMaestros.length;
  const condition=overall>=85?"Configurado":overall>=40?"Configurado con pendientes":"Por configurar";

  return <main style={{minHeight:"100vh",background:"#eef6fb",color:"#082f64"}}>
    <PmHeader title="Constructibilidad" subtitle={`${code} · ${proyecto.nombre} · Checklist maestro para definir la base del proyecto`}/>
    <section style={{maxWidth:1450,margin:"0 auto",padding:"20px 20px 60px"}}>
      {readOnly&&<div style={{...card,background:"#e8f3fb",padding:14,fontWeight:900,marginBottom:14}}>CLIENTE · SÓLO LECTURA</div>}

      <div style={{...card,padding:20,border:"2px solid #ff8500"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:20,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:12,fontWeight:950,color:"#c86100",letterSpacing:".08em"}}>CHECKLIST MAESTRO DEL PROYECTO</div>
            <h1 style={{margin:"5px 0 7px",fontSize:29}}>Define lo necesario; CPM genera lo demás</h1>
            <p style={{margin:0,color:"#4a657d",lineHeight:1.55,maxWidth:900}}>Constructibilidad identifica qué aplica, qué falta y qué no aplica. Con esas respuestas CPM generará los Documentos Maestros necesarios para alimentar automáticamente cada módulo y definir su seguimiento.</p>
          </div>
          <div style={{minWidth:210}}>
            <div style={{fontSize:11,fontWeight:900}}>AVANCE DE DEFINICIÓN</div>
            <div style={{height:13,borderRadius:99,background:"#e3ebf1",overflow:"hidden",marginTop:7}}><div style={{height:"100%",width:`${overall}%`,background:overall>=85?"#1f9d55":overall>=40?"#e6a700":"#d63c3c"}}/></div>
            <div style={{fontSize:30,fontWeight:950,marginTop:4}}>{overall}%</div>
            <div style={{fontSize:12,fontWeight:900,color:overall>=85?"#187342":"#8a5b00"}}>{condition}</div>
          </div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10,marginTop:14}}>
        {[
          ["Bloques completos",completed,"#187342"],
          ["En integración",partial,"#8a5b00"],
          ["Pendientes",pending,"#b53030"],
          ["Documentos Maestros",docs,"#0b73ba"],
        ].map(([label,value,color])=><article key={String(label)} style={{...card,padding:15}}>
          <div style={{fontSize:11,fontWeight:900,color:"#61788f"}}>{label}</div>
          <div style={{fontSize:28,fontWeight:950,marginTop:4,color:String(color)}}>{value}</div>
        </article>)}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12,marginTop:14}}>
        {blocks.map(b=>{
          const s=statusStyle[b.status];
          return <article key={b.code} style={{...card,padding:18}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}>
              <div style={{display:"grid",gridTemplateColumns:"34px 1fr",gap:10}}>
                <div style={{width:32,height:32,borderRadius:"50%",display:"grid",placeItems:"center",background:"#053f79",color:"#fff",fontWeight:950}}>{b.code}</div>
                <div>
                  <h2 style={{margin:"0 0 5px",fontSize:18}}>{b.title}</h2>
                  <p style={{margin:0,color:"#526c84",fontSize:12,lineHeight:1.5}}>{b.desc}</p>
                </div>
              </div>
              <span style={{padding:"6px 9px",borderRadius:999,background:s.bg,color:s.color,fontSize:10,fontWeight:950,whiteSpace:"nowrap"}}>{s.label}</span>
            </div>

            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:12}}>
              {b.items.map(x=><span key={x} style={{padding:"5px 7px",borderRadius:999,background:"#f1f6fa",fontSize:10,fontWeight:850,color:"#405e78"}}>{x}</span>)}
            </div>

            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:13}}>
              {b.links.map(([label,slug])=><Link key={slug} href={`/project-manager/panel/proyectos/${codigo}/constructibilidad/${slug}`} style={{textDecoration:"none",fontSize:11,fontWeight:950,color:"#0b73ba",border:"1px solid #c8d8e6",borderRadius:8,padding:"7px 9px"}}>{label} →</Link>)}
            </div>
          </article>;
        })}
      </div>

      <div style={{...card,marginTop:16,padding:20,background:"linear-gradient(135deg,#f4fbf7,#fff)"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:12,fontWeight:950,color:"#187342"}}>RESULTADO DE CONSTRUCTIBILIDAD</div>
            <h2 style={{margin:"5px 0 5px"}}>Documentos Maestros del Proyecto</h2>
            <p style={{margin:0,color:"#526c84",lineHeight:1.5,maxWidth:850}}>Cuando el checklist tenga suficiente definición, genera los Documentos Maestros aplicables. Cada documento podrá alimentar varios módulos, contener su propio programa y admitir actividades manuales.</p>
          </div>
          <Link href={`/project-manager/panel/proyectos/${codigo}/documentos-maestros`} style={{background:"#1f9d55",color:"#fff",textDecoration:"none",fontWeight:950,padding:"12px 16px",borderRadius:10}}>Abrir Documentos Maestros →</Link>
        </div>
      </div>

      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}>
        <Link href={`/project-manager/panel/proyectos/${codigo}`} style={{background:"#053f79",color:"#fff",textDecoration:"none",fontWeight:900,padding:"11px 15px",borderRadius:9}}>← Volver al proyecto</Link>
        <Link href="/project-manager/panel/proyectos" style={{border:"1px solid #b8cad9",color:"#294f73",textDecoration:"none",fontWeight:900,padding:"11px 15px",borderRadius:9}}>Proyectos</Link>
      </div>
    </section>

    <style>{`
      @media(max-width:900px){div[style*="repeat(4"],div[style*="repeat(2"]{grid-template-columns:1fr 1fr !important;}}
      @media(max-width:620px){div[style*="repeat(4"],div[style*="repeat(2"]{grid-template-columns:1fr !important;}}
    `}</style>
  </main>;
}
