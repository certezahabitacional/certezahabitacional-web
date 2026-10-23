import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";
import { pr0002 } from "@/lib/project-manager/pr0002";
import { PmHeader, card } from "@/app/project-manager/panel/_components";

type Status = "ok" | "risk" | "late" | "future";
const colors:Record<Status,string>={ok:"#1f9d55",risk:"#e6a700",late:"#d63c3c",future:"#8fa2b5"};
const fills:Record<Status,string>={ok:"#e8f7ef",risk:"#fff7dd",late:"#fdecec",future:"#eef2f6"};

const stages:{label:string;status:Status}[]=[
  {label:"Tierra / Predio",status:"ok"},
  {label:"Legal",status:"ok"},
  {label:"Uso de suelo",status:"ok"},
  {label:"Servicios",status:"risk"},
  {label:"Estudios",status:"ok"},
  {label:"Producto",status:"ok"},
  {label:"Comercialización",status:"risk"},
  {label:"Financiamiento",status:"ok"},
  {label:"Proyecto",status:"ok"},
  {label:"Permisos",status:"risk"},
  {label:"Presupuesto",status:"ok"},
  {label:"Programa",status:"ok"},
  {label:"Estrategia de construcción",status:"ok"},
  {label:"Contratos y suministros",status:"risk"},
  {label:"Preparación de obra",status:"risk"},
  {label:"Tierra y urbanización",status:"late"},
  {label:"Infraestructura",status:"late"},
  {label:"Obras especiales",status:"risk"},
  {label:"Edificación",status:"risk"},
  {label:"Control",status:"ok"},
  {label:"Calidad",status:"ok"},
  {label:"Preentrega",status:"future"},
  {label:"Entrega",status:"future"},
  {label:"Cierre",status:"future"},
];

const kpis=[
  ["Condición del predio","85%","Apto con condiciones","ok"],
  ["Viabilidad urbanística","70%","En proceso","risk"],
  ["Factibilidad de servicios","60%","Requiere obras","risk"],
  ["Proyecto ejecutivo","75%","En proceso","risk"],
  ["Autorizaciones","40%","Pendiente","late"],
  ["Presupuesto base","80%","En revisión","ok"],
  ["Programa maestro","65%","En proceso","risk"],
  ["Riesgos críticos","30%","Atención requerida","late"],
  ["Liberación para construir","50%","En proceso","risk"],
] as const;

const moduleRows=[
  ["Habilitación del predio","Completado","Escrituras, liberación, topografía","Desarrollo","Inicio de estudios","ok"],
  ["Proyecto ejecutivo","En proceso","Planos, memorias, especificaciones","Proyectos","Completar ingenierías","risk"],
  ["Autorizaciones","Pendiente","Uso de suelo, licencias, dictámenes","Gestión","Tramitar licencia","late"],
  ["Presupuesto","En proceso","Costo directo, indirecto, contingencias","Costos","Validar con proveedores","risk"],
  ["Programa","En proceso","Programa maestro, hitos, curva S","Planeación","Ajustar con contratistas","ok"],
  ["Urbanización","Pendiente","Plataformas, vialidades, redes","Obra","Iniciar movimiento de tierras","late"],
  ["Infraestructura","Pendiente","Agua, drenaje, electricidad, pluvial","Obra","Contratar y ejecutar","late"],
  ["Vivienda / Edificación","En proceso","Cimentación, estructura, instalaciones, acabados","Obra","Liberar frentes de trabajo","risk"],
  ["Obras especiales","En proceso","PTAR, cárcamo, equipamiento","Obra / Especialistas","Contratar y ejecutar","risk"],
] as const;

const services=[
  ["Agua","Existe","Red o punto de conexión por confirmar","ok"],
  ["Drenaje","Requiere definición","Capacidad, descarga y obras por validar","risk"],
  ["Electricidad","Requiere definición","Capacidad y punto de conexión por validar","risk"],
  ["Pluvial","Requiere definición","Solución de captación y descarga","risk"],
  ["Vialidades","Requiere definición","Accesos y urbanización","risk"],
  ["Acceso","Por validar","Acceso legal y físico","risk"],
  ["Topografía","Por integrar","Levantamiento y bancos de nivel","risk"],
  ["Mecánica de suelos","Por integrar","Estudio y recomendaciones geotécnicas","late"],
] as const;

const follow=[
  ["📊","Avance físico","Avance por frente, hitos y entregables"],
  ["💰","Avance financiero","Ejercido vs programado y proyección"],
  ["📄","Contratos","Montos, anticipos, estimaciones y saldos"],
  ["👷","Mano de obra","Personal, rendimientos y productividad"],
  ["🧱","Materiales","Suministros, inventarios y consumos"],
  ["🚜","Maquinaria","Equipos, utilización y rendimientos"],
  ["🛡️","Calidad","Inspecciones, pruebas y no conformidades"],
  ["⛑️","Seguridad","Incidentes, recorridos y acciones"],
  ["🔁","Cambios","Impacto en alcance, costo y plazo"],
  ["📷","Evidencias","Fotos, reportes y bitácora digital"],
] as const;

function Badge({status,label}:{status:Status;label:string}) {
  return <span style={{display:"inline-flex",alignItems:"center",gap:6,borderRadius:999,padding:"5px 9px",fontSize:12,fontWeight:900,color:colors[status],background:fills[status],whiteSpace:"nowrap"}}>
    <span style={{width:8,height:8,borderRadius:"50%",background:colors[status]}}/>{label}
  </span>;
}

function Ring({value,status}:{value:string;status:Status}) {
  return <div style={{width:58,height:58,borderRadius:"50%",display:"grid",placeItems:"center",fontWeight:950,color:"#082f64",background:`conic-gradient(${colors[status]} ${value}, #e9eff4 0)`}}>
    <div style={{width:43,height:43,borderRadius:"50%",display:"grid",placeItems:"center",background:"#fff",fontSize:13}}>{value}</div>
  </div>;
}

export default async function ConstructibilidadPage({params}:{params:Promise<{codigo:string}>}) {
  const { session, role, readOnly }=await requireProjectManagerAccess();
  const {codigo}=await params;
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
  } else if(role!=="DIRECTOR" && role!=="ADMINISTRADOR") {
    notFound();
  }

  const nombre=proyecto?.nombre ?? pr0002.project.name;
  const ubicacion=proyecto?.ubicacion ?? pr0002.project.location;
  const cliente=proyecto?.cliente ?? pr0002.project.client;
  const presupuesto=Number(proyecto?.presupuesto ?? pr0002.project.budget);
  const money=new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0}).format(presupuesto);
  const construct=proyecto?.constructibilidad;
  const predioPct=construct?.progresoPaso1 ?? 0;
  const legalPct=construct?.progresoPaso2 ?? 0;
  const serviciosPct=construct?.progresoPaso3 ?? 0;
  const estudiosPct=construct?.progresoPaso4 ?? 0;
  const productoPct=construct?.progresoPaso5 ?? 0;
  const statusFor=(pct:number):Status=>pct>=80?"ok":pct>=50?"risk":"late";
  const detailFor=(pct:number,complete:boolean)=>complete?"Completo":pct>0?"En integración":"Sin captura";
  const dynamicKpis=[
    ["Condición del predio",`${predioPct}%`,detailFor(predioPct,construct?.estadoPaso1==="COMPLETO"),statusFor(predioPct)],
    ["Viabilidad urbanística",`${legalPct}%`,detailFor(legalPct,construct?.estadoPaso2==="COMPLETO"),statusFor(legalPct)],
    ["Factibilidad de servicios",`${serviciosPct}%`,detailFor(serviciosPct,construct?.estadoPaso3==="COMPLETO"),statusFor(serviciosPct)],
    ["Estudios",`${estudiosPct}%`,detailFor(estudiosPct,construct?.estadoPaso4==="COMPLETO"),statusFor(estudiosPct)],
    ["Producto / escala",`${productoPct}%`,detailFor(productoPct,construct?.estadoPaso5==="COMPLETO"),statusFor(productoPct)],
    ...kpis.slice(3),
  ] as const;
  const condicionLabel:Record<string,string>={
    BRENA:"Tierra en breña",
    MACROLOTE_URBANIZADO:"Macrolote urbanizado",
    MACROLOTE_PARCIAL:"Macrolote parcialmente urbanizado",
    LOTES_URBANIZADOS:"Lotes urbanizados",
    LOTES_PARCIALES:"Lotes parcialmente urbanizados",
    CONSTRUCCION_EXISTENTE:"Construcción existente",
    REMODELACION:"Remodelación / ampliación",
    MIXTO:"Condición mixta",
  };
  const riesgosGuardados=[
    ...(Array.isArray(construct?.riesgosPaso1)?construct.riesgosPaso1.map(String):[]),
    ...(Array.isArray(construct?.riesgosPaso2)?construct.riesgosPaso2.map(String):[]),
    ...(Array.isArray(construct?.riesgosPaso3)?construct.riesgosPaso3.map(String):[]),
    ...(Array.isArray(construct?.riesgosPaso4)?construct.riesgosPaso4.map(String):[]),
    ...(Array.isArray(construct?.riesgosPaso5)?construct.riesgosPaso5.map(String):[]),
  ];
  const modulosGuardados=Array.isArray(construct?.modulosSugeridos)?construct.modulosSugeridos.map(String):[];
  const obrasEspeciales=Array.isArray(construct?.obrasEspecialesSugeridas)?construct.obrasEspecialesSugeridas.map(String):[];

  return <main style={{minHeight:"100vh",background:"#eef6fb",color:"#082f64"}}>
    <PmHeader title="CONSTRUCTIBILIDAD" subtitle={`${code} · ${nombre} · Configuración integral desde el predio hasta la entrega de la obra terminada.`}/>
    <section style={{maxWidth:1650,margin:"0 auto",padding:"18px 18px 60px"}}>
      {readOnly&&<div style={{...card,marginBottom:14,background:"#e8f3fb",fontWeight:900}}>CLIENTE · SÓLO LECTURA</div>}

      <div style={{...card,padding:0,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(140px,1fr))",gap:0}}>
          {[
            ["Proyecto",nombre],
            ["Ubicación",ubicacion || "Por definir"],
            ["Cliente",cliente || "Por definir"],
            ["Presupuesto",money],
            ["Estatus general","En configuración"],
          ].map(([k,v])=><div key={k} style={{padding:"14px 16px",borderRight:"1px solid #d8e6f2"}}>
            <div style={{fontSize:11,fontWeight:900,color:"#5f7690",textTransform:"uppercase"}}>{k}</div>
            <div style={{fontWeight:950,marginTop:4}}>{v}</div>
          </div>)}
        </div>
      </div>

      <div style={{...card,marginTop:14,padding:"16px 14px",overflowX:"auto"}}>
        <div style={{display:"flex",minWidth:1480,alignItems:"flex-start"}}>
          {stages.map((s,i)=><div key={s.label} style={{flex:"1 0 58px",position:"relative",textAlign:"center"}}>
            {i<stages.length-1&&<div style={{position:"absolute",top:12,left:"50%",right:"-50%",height:4,background:colors[s.status],zIndex:0}}/>}
            <div style={{position:"relative",zIndex:1,width:26,height:26,borderRadius:"50%",margin:"0 auto",background:colors[s.status],color:"#fff",display:"grid",placeItems:"center",fontWeight:950,fontSize:12}}>{s.status==="ok"?"✓":s.status==="late"?"!":s.status==="future"?"•":"○"}</div>
            <div style={{fontSize:10,fontWeight:850,lineHeight:1.2,marginTop:7,color:"#294f73"}}>{s.label}</div>
          </div>)}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(9,minmax(140px,1fr))",gap:10,marginTop:14,overflowX:"auto"}}>
        {dynamicKpis.map(([title,value,detail,status])=><article key={title} style={{...card,padding:13,minWidth:140}}>
          <div style={{fontSize:11,fontWeight:900,minHeight:30}}>{title}</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginTop:8}}>
            <Ring value={value} status={status}/>
          </div>
          <div style={{fontSize:11,color:"#5b7188",fontWeight:800,marginTop:8}}>{detail}</div>
        </article>)}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1.05fr 1.45fr .75fr",gap:14,marginTop:14}}>
        <article style={{...card,padding:18}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}>
            <h2 style={{margin:0,fontSize:20}}>Resumen de Constructibilidad</h2>
            {!readOnly&&<button type="button" style={{border:"1px solid #c8d8e6",background:"#f7fbfe",color:"#053f79",borderRadius:8,padding:"7px 10px",fontWeight:900}}>Editar</button>}
          </div>
          <div style={{marginTop:14,padding:16,borderRadius:12,background:"linear-gradient(135deg,#0b3767,#0b73ba)",color:"#fff"}}>
            <div style={{fontSize:12,color:"#bfe2ff",fontWeight:900}}>PROYECTO</div>
            <div style={{fontSize:22,fontWeight:950,marginTop:3}}>{nombre}</div>
            <div style={{marginTop:9,lineHeight:1.55,fontSize:13}}>{ubicacion || "Ubicación por definir"}<br/>{cliente || "Cliente por definir"}</div>
          </div>
          <p style={{color:"#405e78",lineHeight:1.55,fontSize:13}}>
            Constructibilidad define la estructura de módulos, entregables de arranque, liberaciones y seguimiento que utilizará Certeza Project Manager para este proyecto.
          </p>
          <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
            {[(construct?.condicionPredio&&condicionLabel[construct.condicionPredio])||"Condición del predio por definir",legalPct>0?"Legal / uso de suelo en integración":"Uso de suelo por validar","Esquema comercial por definir","Financiamiento por definir","Modalidad de ejecución por definir",serviciosPct>0?"Servicios e infraestructura evaluándose":"Infraestructura por definir",obrasEspeciales.length?`Obras especiales: ${obrasEspeciales.length}`:"Obras especiales por definir"].map((x,i)=><span key={x} style={{padding:"7px 9px",borderRadius:999,background:i%3===0?"#fff3dd":i%3===1?"#e7f5ed":"#e8f2ff",fontSize:11,fontWeight:850}}>{x}</span>)}
          </div>
        </article>

        <article style={{...card,padding:0,overflow:"hidden"}}>
          <div style={{padding:"15px 16px",borderBottom:"1px solid #d8e6f2",fontSize:20,fontWeight:950}}>Matriz de módulos y entregables{modulosGuardados.length>0&&<span style={{display:"block",fontSize:11,color:"#5d758c",fontWeight:800,marginTop:4}}>Paso 1 ya sugiere {modulosGuardados.length} módulos para este proyecto.</span>}</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:760}}>
              <thead><tr style={{background:"#f2f7fb",textAlign:"left"}}>
                {["Módulo","Estatus","Entregables principales","Responsable","Próximo paso"].map(h=><th key={h} style={{padding:"10px 9px",borderBottom:"1px solid #d8e6f2"}}>{h}</th>)}
              </tr></thead>
              <tbody>{moduleRows.map(([m,e,d,r,p,s])=><tr key={m}>
                <td style={{padding:"10px 9px",borderBottom:"1px solid #edf2f6",fontWeight:900}}>{m}</td>
                <td style={{padding:"10px 9px",borderBottom:"1px solid #edf2f6"}}><Badge status={s} label={e}/></td>
                <td style={{padding:"10px 9px",borderBottom:"1px solid #edf2f6"}}>{d}</td>
                <td style={{padding:"10px 9px",borderBottom:"1px solid #edf2f6"}}>{r}</td>
                <td style={{padding:"10px 9px",borderBottom:"1px solid #edf2f6"}}>{p}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </article>

        <aside style={{display:"grid",gap:12}}>
          <div style={{...card,padding:15}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h3 style={{margin:0}}>Semáforo general</h3><span style={{fontSize:11,color:"#0b73ba",fontWeight:900}}>Ver detalle →</span></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7,marginTop:12,textAlign:"center"}}>
              {[["12","En tiempo","ok"],["8","En riesgo","risk"],["4","Atrasados","late"]].map(([n,l,s])=><div key={l} style={{padding:9,borderRadius:10,background:fills[s as Status]}}><strong style={{fontSize:22,color:colors[s as Status]}}>{n}</strong><div style={{fontSize:10,fontWeight:800}}>{l}</div></div>)}
            </div>
          </div>
          <div style={{...card,padding:15}}>
            <h3 style={{margin:"0 0 10px"}}>Pendientes críticos</h3>
            {(riesgosGuardados.length?riesgosGuardados.slice(0,4).map(x=>[x,"late"]):[
              ["Mecánica de suelos","late"],
              ["Factibilidad de drenaje","late"],
              ["Licencia de construcción","risk"],
              ["Definición de obras especiales","risk"],
            ]).map(([x,s])=><div key={x} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 0",borderBottom:"1px solid #edf2f6",fontSize:12,fontWeight:800}}><span style={{width:9,height:9,borderRadius:"50%",background:colors[s as Status]}}/>{x}</div>)}
          </div>
          <div style={{...card,padding:15}}>
            <h3 style={{margin:"0 0 10px"}}>Liberaciones</h3>
            {["Predio liberado","Proyecto autorizado","Presupuesto validado","Inicio de obra","Preentrega","Entrega"].map((x,i)=><div key={x} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",fontSize:12,fontWeight:800}}><span style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${i===0?"#1f9d55":"#aab9c7"}`,display:"grid",placeItems:"center",fontSize:11,color:"#1f9d55"}}>{i===0?"✓":""}</span>{x}</div>)}
          </div>
        </aside>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1.25fr .75fr",gap:14,marginTop:14}}>
        <article style={{...card,padding:0,overflow:"hidden"}}>
          <div style={{padding:"14px 16px",fontWeight:950,fontSize:18,borderBottom:"1px solid #d8e6f2"}}>Condición del predio y servicios</div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{background:"#f2f7fb",textAlign:"left"}}><th style={{padding:9}}>Concepto</th><th style={{padding:9}}>Estatus</th><th style={{padding:9}}>Observaciones</th></tr></thead>
            <tbody>{services.map(([x,e,o,s])=><tr key={x}><td style={{padding:9,borderBottom:"1px solid #edf2f6",fontWeight:900}}>{x}</td><td style={{padding:9,borderBottom:"1px solid #edf2f6"}}><Badge status={s} label={e}/></td><td style={{padding:9,borderBottom:"1px solid #edf2f6",color:"#49667f"}}>{o}</td></tr>)}</tbody>
          </table>
        </article>

        <article style={{...card,padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}><h2 style={{margin:0,fontSize:18}}>Estructura de seguimiento</h2><span style={{fontSize:11,color:"#0b73ba",fontWeight:900}}>Se alimentará durante la ejecución</span></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(110px,1fr))",gap:8,marginTop:12}}>
            {follow.map(([icon,title,desc])=><div key={title} style={{border:"1px solid #d8e6f2",borderRadius:10,padding:10,background:"#fbfdff"}}>
              <div style={{fontSize:21}}>{icon}</div><div style={{fontWeight:950,fontSize:12,marginTop:4}}>{title}</div><div style={{fontSize:10,color:"#60778d",lineHeight:1.35,marginTop:3}}>{desc}</div>
            </div>)}
          </div>
        </article>

        <article style={{...card,padding:16}}>
          <h2 style={{margin:"0 0 12px",fontSize:18}}>Salida del panel</h2>
          {[
            ["1","Estructura de módulos del proyecto"],
            ["2","Matriz de entregables de arranque"],
            ["3","Matriz de seguimiento"],
            ["4","Matriz de liberaciones y dependencias"],
          ].map(([n,t])=><div key={n} style={{display:"grid",gridTemplateColumns:"28px 1fr",gap:9,alignItems:"center",padding:"10px 0",borderBottom:"1px solid #edf2f6"}}>
            <div style={{width:26,height:26,borderRadius:"50%",display:"grid",placeItems:"center",background:"#053f79",color:"#fff",fontWeight:950,fontSize:12}}>{n}</div><div style={{fontSize:12,fontWeight:900}}>{t}</div>
          </div>)}
        </article>
      </div>

      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}>
        {!readOnly&&<Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad/predio`} style={{background:"#ff8500",color:"#fff",textDecoration:"none",fontWeight:950,padding:"12px 16px",borderRadius:10}}>Iniciar diagnóstico guiado →</Link>}
        <Link href={code==="PR-0002"?"/project-manager/panel/proyectos/pr-0002":`/project-manager/panel/proyectos/${codigo}`} style={{background:"#053f79",color:"#fff",textDecoration:"none",fontWeight:900,padding:"12px 16px",borderRadius:10}}>← Volver al proyecto</Link>
        <Link href="/project-manager/panel/proyectos" style={{border:"1px solid #b8cad9",color:"#294f73",textDecoration:"none",fontWeight:900,padding:"12px 16px",borderRadius:10}}>Proyectos</Link>
      </div>
    </section>

    <style>{`
      @media(max-width:1200px){
        section > div[style*="1.05fr 1.45fr .75fr"], section > div[style*="1fr 1.25fr .75fr"]{grid-template-columns:1fr !important;}
        div[style*="repeat(9"]{grid-template-columns:repeat(3,minmax(150px,1fr)) !important;}
      }
      @media(max-width:780px){
        section > div:first-child > div{grid-template-columns:1fr !important;}
        div[style*="repeat(5"]{grid-template-columns:repeat(2,minmax(120px,1fr)) !important;}
        div[style*="repeat(9"]{grid-template-columns:repeat(2,minmax(150px,1fr)) !important;}
      }
      @media(max-width:520px){
        div[style*="repeat(5"],div[style*="repeat(9"]{grid-template-columns:1fr !important;}
      }
    `}</style>
  </main>;
}
