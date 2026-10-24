"use client";

import { useActionState } from "react";
import { aplicarImportacionDocumentoMaestro, previsualizarImportacionDocumentoMaestro, type ImportPreview } from "../import-actions";

const initial:ImportPreview={ok:false};

export function ImportadorDocumentoMaestro({codigoProyecto,documentoId,documentoCodigo}:{codigoProyecto:string;documentoId:string;documentoCodigo:string}){
  const [state,action,pending]=useActionState(previsualizarImportacionDocumentoMaestro,initial);
  const template=[
    "codigo,actividad,descripcion,tipo,etapa,dependencia,responsable,organismo,fechaInicioPlan,fechaFinPlan,entregable,periodicidad,bloqueante,prioridad,reglaAlerta,estado",
    `${documentoCodigo.replace("DM-","")}-001,Actividad ejemplo,Descripción,ACTIVIDAD,Etapa 1,,Responsable,Autoridad,2026-10-24,2026-10-31,Entregable,SEMANAL,NO,MEDIA,,PENDIENTE`
  ].join("\n");
  const href=`data:text/csv;charset=utf-8,${encodeURIComponent(template)}`;
  const payload=JSON.stringify({nuevas:state.nuevas??[],modificadas:state.modificadas??[]});

  return <div style={{border:"1px solid #d8e6f2",borderRadius:10,padding:16,background:"#fff"}}>
    <h3 style={{marginTop:0}}>Importar Documento Maestro</h3>
    <p style={{fontSize:11,color:"#526c84",lineHeight:1.45}}>Carga un CSV exportado desde Excel. Primero se compara contra lo existente; nada se modifica hasta que confirmes.</p>
    <a href={href} download={`${documentoCodigo}_plantilla.csv`} style={{display:"inline-block",fontSize:11,fontWeight:900,color:"#0b73ba",marginBottom:10}}>Descargar plantilla CSV</a>
    <form action={action}>
      <input type="hidden" name="codigoProyecto" value={codigoProyecto}/>
      <input type="hidden" name="documentoId" value={documentoId}/>
      <input type="file" name="archivo" accept=".csv,text/csv" required style={{display:"block",width:"100%",fontSize:11,marginBottom:9}}/>
      <button disabled={pending} type="submit" style={{border:0,background:"#053f79",color:"#fff",fontWeight:900,padding:"9px 12px",borderRadius:8,cursor:"pointer"}}>{pending?"Comparando...":"Comparar archivo"}</button>
    </form>

    {state.error&&<div style={{marginTop:10,padding:9,borderRadius:8,background:"#fff0f0",color:"#a52f2f",fontSize:11,fontWeight:850}}>{state.error}</div>}

    {state.ok&&<div style={{marginTop:12}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,textAlign:"center"}}>
        {[
          ["Nuevas",state.nuevas?.length??0,"#187342"],
          ["Modificadas",state.modificadas?.length??0,"#8a5b00"],
          ["Sin cambio",state.sinCambio?.length??0,"#60778d"],
          ["Posibles bajas",state.posiblesBajas?.length??0,"#b53030"],
        ].map(([l,n,c])=><div key={String(l)} style={{padding:8,borderRadius:8,background:"#f7fbfe"}}><div style={{fontSize:10,fontWeight:900,color:String(c)}}>{l}</div><strong style={{fontSize:20}}>{n}</strong></div>)}
      </div>
      <p style={{fontSize:10,color:"#60778d",lineHeight:1.4,margin:"9px 0"}}>Las posibles bajas sólo se informan; no se eliminan automáticamente. Esta versión aplica únicamente actividades nuevas y modificadas.</p>
      <form action={aplicarImportacionDocumentoMaestro}>
        <input type="hidden" name="codigoProyecto" value={codigoProyecto}/>
        <input type="hidden" name="documentoId" value={documentoId}/>
        <input type="hidden" name="payload" value={payload}/>
        <button type="submit" disabled={(state.nuevas?.length??0)+(state.modificadas?.length??0)===0} style={{border:0,background:"#1f9d55",color:"#fff",fontWeight:950,padding:"9px 12px",borderRadius:8,cursor:"pointer"}}>Aplicar actualización</button>
      </form>

      {(state.nuevas?.length??0)>0&&<details style={{marginTop:8}}><summary style={{fontSize:11,fontWeight:900,cursor:"pointer"}}>Ver nuevas</summary><div style={{fontSize:10,marginTop:5}}>{state.nuevas?.slice(0,20).map(r=><div key={r.codigo}>{r.codigo} · {r.actividad}</div>)}</div></details>}
      {(state.modificadas?.length??0)>0&&<details style={{marginTop:8}}><summary style={{fontSize:11,fontWeight:900,cursor:"pointer"}}>Ver modificadas</summary><div style={{fontSize:10,marginTop:5}}>{state.modificadas?.slice(0,20).map(r=><div key={r.codigo}>{r.codigo} · {r.actividad}</div>)}</div></details>}
      {(state.posiblesBajas?.length??0)>0&&<details style={{marginTop:8}}><summary style={{fontSize:11,fontWeight:900,cursor:"pointer"}}>Ver posibles bajas</summary><div style={{fontSize:10,marginTop:5}}>{state.posiblesBajas?.slice(0,20).map(r=><div key={r.codigo}>{r.codigo} · {r.actividad}</div>)}</div></details>}
    </div>}
  </div>;
}
