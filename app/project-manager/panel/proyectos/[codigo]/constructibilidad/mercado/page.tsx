import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";
import { pr0002 } from "@/lib/project-manager/pr0002";
import { PmHeader, card } from "@/app/project-manager/panel/_components";
import { guardarMercadoConstructibilidad } from "./actions";

function asObj(v:unknown){return (v&&typeof v==="object"&&!Array.isArray(v)?v:{}) as Record<string,unknown>;}
function asList(v:unknown){return Array.isArray(v)?v.map(String):[];}

export default async function MercadoConstructibilidadPage({params,searchParams}:{params:Promise<{codigo:string}>;searchParams:Promise<{guardado?:string}>}) {
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
  const mercado=asObj(data?.mercadoComercializacion);
  const fin=asObj(data?.financiamientoProyecto);
  const entregables=asList(data?.entregablesPaso6);
  const riesgos=asList(data?.riesgosPaso6);
  const progreso=data?.progresoPaso6 ?? 0;

  return <main style={{minHeight:"100vh",background:"#eef6fb",color:"#082f64"}}>
    <PmHeader title="Constructibilidad · Paso 6" subtitle={`${code} · ${nombre} · Mercado, comercialización y financiamiento`}/>
    <section style={{maxWidth:1400,margin:"0 auto",padding:"20px 20px 60px"}}>
      {q.guardado&&<div style={{...card,marginBottom:14,background:"#e7f7ee",color:"#187342",fontWeight:900}}>Paso 6 guardado correctamente.</div>}
      {readOnly&&<div style={{...card,marginBottom:14,background:"#e8f3fb",fontWeight:900}}>CLIENTE · SÓLO LECTURA</div>}
      {legacy&&<div style={{...card,marginBottom:14,background:"#fff5dd",color:"#8a5b00",fontWeight:800}}>PR-0002 requiere completar su migración para guardar esta información.</div>}

      <div style={{...card,padding:20,border:"2px solid #ff8500"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:20,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:12,fontWeight:950,color:"#c86100"}}>PASO 6</div>
            <h1 style={{margin:"5px 0 7px",fontSize:28}}>¿Cómo se venderá y cómo se financiará el proyecto?</h1>
            <p style={{margin:0,color:"#4a657d",lineHeight:1.55}}>Separamos el esquema de colocación del comprador final de la fuente de recursos para construir.</p>
          </div>
          <div style={{minWidth:170}}>
            <div style={{fontSize:11,fontWeight:900}}>AVANCE</div>
            <div style={{height:12,borderRadius:99,background:"#e3ebf1",overflow:"hidden",marginTop:7}}><div style={{height:"100%",width:`${progreso}%`,background:progreso>=80?"#1f9d55":progreso>=50?"#e6a700":"#d63c3c"}}/></div>
            <div style={{fontSize:24,fontWeight:950,marginTop:5}}>{progreso}%</div>
          </div>
        </div>
      </div>

      <form action={guardarMercadoConstructibilidad} style={{marginTop:14}}>
        <input type="hidden" name="codigo" value={code}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <article style={{...card,padding:18}}>
            <h2 style={{marginTop:0}}>6.1 Mercado / colocación</h2>
            {[
              ["infonavit","INFONAVIT"],
              ["fovissste","FOVISSSTE"],
              ["bancario","Crédito bancario"],
              ["recursosComprador","Recursos propios del comprador"],
              ["renta","Renta"],
              ["institucional","Venta institucional"],
            ].map(([n,l])=><label key={n} style={{display:"flex",gap:8,marginTop:9,fontSize:13}}><input type="checkbox" name={n} defaultChecked={mercado[n]===true} disabled={readOnly||legacy}/>{l}</label>)}

            <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:9,marginTop:14}}>
              <label style={{fontSize:12,fontWeight:850}}>% INFONAVIT<input type="number" name="porcentajeInfonavit" min="0" max="100" defaultValue={String(mercado.porcentajeInfonavit??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:9,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
              <label style={{fontSize:12,fontWeight:850}}>% Bancario<input type="number" name="porcentajeBancario" min="0" max="100" defaultValue={String(mercado.porcentajeBancario??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:9,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
              <label style={{fontSize:12,fontWeight:850}}>% Otros<input type="number" name="porcentajeOtros" min="0" max="100" defaultValue={String(mercado.porcentajeOtros??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:9,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            </div>
            <label style={{display:"block",fontSize:12,fontWeight:850,marginTop:10}}>Observaciones<input name="mercadoObservaciones" defaultValue={String(mercado.observaciones??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:10,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
          </article>

          <article style={{...card,padding:18}}>
            <h2 style={{marginTop:0}}>6.2 Financiamiento del desarrollo</h2>
            {[
              ["recursosPropios","Recursos propios"],
              ["creditoPuente","Crédito puente"],
              ["lineaBancaria","Línea bancaria"],
              ["inversionistas","Capital de inversionistas"],
              ["preventas","Preventas"],
              ["fideicomiso","Fideicomiso"],
            ].map(([n,l])=><label key={n} style={{display:"flex",gap:8,marginTop:9,fontSize:13}}><input type="checkbox" name={n} defaultChecked={fin[n]===true} disabled={readOnly||legacy}/>{l}</label>)}

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginTop:14}}>
              <label style={{fontSize:12,fontWeight:850}}>Banco / institución<input name="banco" defaultValue={String(fin.banco??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:9,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
              <label style={{fontSize:12,fontWeight:850}}>Monto de crédito<input type="number" name="montoCredito" min="0" step="0.01" defaultValue={String(fin.montoCredito??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:9,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
              <label style={{fontSize:12,fontWeight:850}}>Aforo<input name="aforo" defaultValue={String(fin.aforo??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:9,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
              <label style={{fontSize:12,fontWeight:850}}>Ministraciones / condiciones<input name="ministraciones" defaultValue={String(fin.ministraciones??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:9,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
            </div>
            <label style={{display:"flex",gap:8,marginTop:10,fontSize:13}}><input type="checkbox" name="supervisionBancaria" defaultChecked={fin.supervisionBancaria===true} disabled={readOnly||legacy}/> Requiere supervisión bancaria / avance certificado</label>
            <label style={{display:"block",fontSize:12,fontWeight:850,marginTop:10}}>Observaciones<input name="financiamientoObservaciones" defaultValue={String(fin.observaciones??"")} disabled={readOnly||legacy} style={{width:"100%",boxSizing:"border-box",padding:10,marginTop:4,border:"1px solid #cbd9e5",borderRadius:8}}/></label>
          </article>
        </div>

        {!readOnly&&!legacy&&<div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}>
          <button type="submit" style={{border:0,background:"#ff8500",color:"#fff",fontWeight:950,padding:"12px 18px",borderRadius:10,cursor:"pointer"}}>Guardar mercado y financiamiento</button>
        </div>}
      </form>

      {(entregables.length>0||riesgos.length>0)&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:16}}>
        <article style={{...card,padding:16}}><h3 style={{marginTop:0}}>Entregables generados</h3>{entregables.map(x=><div key={x} style={{padding:"8px 0",borderBottom:"1px solid #edf2f6",fontSize:12,fontWeight:850}}>✓ {x}</div>)}</article>
        <article style={{...card,padding:16}}><h3 style={{marginTop:0}}>Riesgos comerciales / financieros</h3>{riesgos.length?riesgos.map(x=><div key={x} style={{padding:"8px 0",borderBottom:"1px solid #edf2f6",fontSize:12,fontWeight:850,color:"#b53030"}}>⚠ {x}</div>):<div style={{fontSize:12,color:"#526c84"}}>Sin riesgos registrados.</div>}</article>
      </div>}

      <div style={{...card,marginTop:16,padding:18,background:"#f8fbfd"}}>
        <div style={{fontSize:12,fontWeight:950,color:"#c86100"}}>SIGUIENTE ETAPA</div>
        <h3 style={{margin:"5px 0"}}>Paso 7 · Proyecto ejecutivo y autorizaciones</h3>
        <p style={{margin:0,color:"#526c84"}}>Estado por disciplina, entregables de ingeniería, revisiones, permisos, licencias, dictámenes y condición de liberación para construir.</p>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad/proyecto`} style={{display:"inline-block",marginTop:12,background:"#ff8500",color:"#fff",textDecoration:"none",fontWeight:950,padding:"11px 15px",borderRadius:9}}>Continuar al Paso 7 →</Link>
      </div>

      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad/producto`} style={{background:"#053f79",color:"#fff",textDecoration:"none",fontWeight:900,padding:"12px 16px",borderRadius:10}}>← Paso 5 · Producto</Link>
        <Link href={`/project-manager/panel/proyectos/${codigo}/constructibilidad`} style={{border:"1px solid #b8cad9",color:"#294f73",textDecoration:"none",fontWeight:900,padding:"12px 16px",borderRadius:10}}>Panel de Constructibilidad</Link>
      </div>
    </section>

    <style>{`
      @media(max-width:850px){div[style*="1fr 1fr"],div[style*="repeat(3"]{grid-template-columns:1fr !important;}}
    `}</style>
  </main>;
}
