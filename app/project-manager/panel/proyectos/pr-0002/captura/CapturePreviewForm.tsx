"use client";

import { useMemo, useState } from "react";

type Activity = {
  code: string;
  name: string;
  control: string;
};

export default function CapturePreviewForm({ activities }: { activities: Activity[] }) {
  const [activityCode,setActivityCode]=useState(activities[0]?.code ?? "");
  const [plannedQty,setPlannedQty]=useState("0");
  const [actualQty,setActualQty]=useState("0");
  const [plannedHours,setPlannedHours]=useState("0");
  const [actualHours,setActualHours]=useState("0");
  const [actualCost,setActualCost]=useState("0");
  const [note,setNote]=useState("");

  const selected=activities.find(a=>a.code===activityCode);
  const metrics=useMemo(()=>{
    const pq=Number(plannedQty)||0;
    const aq=Number(actualQty)||0;
    const ph=Number(plannedHours)||0;
    const ah=Number(actualHours)||0;
    return {
      qtyProgress:pq>0?(aq/pq)*100:null,
      hhPerUnit:aq>0?ah/aq:null,
      plannedHhPerUnit:pq>0?ph/pq:null,
      productivityIndex:aq>0&&ah>0&&pq>0&&ph>0 ? (ph/pq)/(ah/aq) : null,
    };
  },[plannedQty,actualQty,plannedHours,actualHours]);

  const fieldStyle={width:"100%",boxSizing:"border-box" as const,borderRadius:10,border:"1px solid rgba(255,255,255,.14)",background:"#06172c",color:"#fff",padding:"11px 12px",fontSize:15};
  const labelStyle={display:"grid",gap:6,color:"#dbe4ed",fontWeight:700,fontSize:13};

  return (
    <section style={{border:"1px solid rgba(255,255,255,.1)",borderRadius:16,background:"#0a223d",padding:22}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:16,flexWrap:"wrap",alignItems:"end"}}>
        <div>
          <div style={{color:"#edcb71",fontWeight:900,fontSize:12}}>SIMULADOR DE CAPTURA</div>
          <h2 style={{margin:"6px 0"}}>Previsualizar un registro del corte</h2>
          <p style={{margin:0,color:"#9fb2c6"}}>Los valores se calculan localmente y todavía no se guardan.</p>
        </div>
        <div style={{color:"#9fb2c6",fontSize:13}}>{selected?.control} · {selected?.name}</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,marginTop:20}}>
        <label style={labelStyle}>Actividad
          <select value={activityCode} onChange={e=>setActivityCode(e.target.value)} style={fieldStyle}>
            {activities.map(a=><option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
          </select>
        </label>
        <label style={labelStyle}>Cantidad planeada
          <input inputMode="decimal" value={plannedQty} onChange={e=>setPlannedQty(e.target.value)} style={fieldStyle}/>
        </label>
        <label style={labelStyle}>Cantidad ejecutada
          <input inputMode="decimal" value={actualQty} onChange={e=>setActualQty(e.target.value)} style={fieldStyle}/>
        </label>
        <label style={labelStyle}>HH planeadas
          <input inputMode="decimal" value={plannedHours} onChange={e=>setPlannedHours(e.target.value)} style={fieldStyle}/>
        </label>
        <label style={labelStyle}>HH reales
          <input inputMode="decimal" value={actualHours} onChange={e=>setActualHours(e.target.value)} style={fieldStyle}/>
        </label>
        <label style={labelStyle}>Costo real del registro
          <input inputMode="decimal" value={actualCost} onChange={e=>setActualCost(e.target.value)} style={fieldStyle}/>
        </label>
      </div>

      <label style={{...labelStyle,marginTop:14}}>Observación / evidencia
        <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} style={{...fieldStyle,resize:"vertical"}}/>
      </label>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,marginTop:18}}>
        {[
          ["Avance cantidad",metrics.qtyProgress===null?"Datos insuficientes":metrics.qtyProgress.toFixed(2)+"%"],
          ["HH / unidad real",metrics.hhPerUnit===null?"Datos insuficientes":metrics.hhPerUnit.toFixed(3)],
          ["HH / unidad plan",metrics.plannedHhPerUnit===null?"Datos insuficientes":metrics.plannedHhPerUnit.toFixed(3)],
          ["Índice productividad",metrics.productivityIndex===null?"Datos insuficientes":metrics.productivityIndex.toFixed(3)],
          ["Costo real","$"+(Number(actualCost)||0).toLocaleString("es-MX",{maximumFractionDigits:2})],
        ].map(([k,v])=><div key={k} style={{background:"#06172c",borderRadius:10,padding:12}}><div style={{fontSize:11,color:"#8fa5bb"}}>{k}</div><strong style={{display:"block",marginTop:4}}>{v}</strong></div>)}
      </div>

      <div style={{display:"flex",justifyContent:"flex-end",marginTop:18}}>
        <button disabled style={{border:0,borderRadius:12,padding:"13px 20px",fontWeight:900,background:"#8b94a0",color:"#d8dee6",cursor:"not-allowed"}}>Guardar en DEV (pendiente de canal seguro)</button>
      </div>
    </section>
  );
}
