"use client";

import { useMemo, useState } from "react";

type Zona = { id: string; nombre: string; codigo: string };
type UsuarioOperativo = { id: string; nombre: string; zonaId: string | null };
type Inspector = { id: string; usuario: { nombre: string; zonaId: string | null } };

export default function ZonaInspectorSelect({
  zonas, inspectores, gerentes, coordinadores,
  zonaInicial = "", inspectorInicial = "", gerenteInicial = "", coordinadorInicial = "",
  gerenteFijoId = "",
}: {
  zonas: Zona[];
  inspectores: Inspector[];
  gerentes: UsuarioOperativo[];
  coordinadores: UsuarioOperativo[];
  zonaInicial?: string;
  inspectorInicial?: string;
  gerenteInicial?: string;
  coordinadorInicial?: string;
  gerenteFijoId?: string;
}) {
  const [zonaId, setZonaId] = useState(zonaInicial);
  const [inspectorId, setInspectorId] = useState(inspectorInicial);
  const [gerenteId, setGerenteId] = useState(gerenteFijoId || gerenteInicial);
  const [coordinadorId, setCoordinadorId] = useState(coordinadorInicial);

  const inspectoresZona = useMemo(() => inspectores.filter(i => i.usuario.zonaId === zonaId), [inspectores, zonaId]);
  const gerentesZona = useMemo(() => gerentes.filter(g => g.zonaId === zonaId), [gerentes, zonaId]);
  const coordinadoresZona = useMemo(() => coordinadores.filter(c => c.zonaId === zonaId), [coordinadores, zonaId]);

  function cambiarZona(id: string) {
    setZonaId(id); setInspectorId(""); setCoordinadorId("");
    if (!gerenteFijoId) setGerenteId("");
  }

  return <div className="space-y-5">
    <div className="grid gap-5 md:grid-cols-2">
      <Select label="Zona *" name="zonaId" required value={zonaId} onChange={cambiarZona} options={zonas.map(z=>({value:z.id,label:`${z.nombre} (${z.codigo})`}))} placeholder="Selecciona una zona" />
      <Select label="Inspector" name="inspectorId" value={inspectorId} onChange={setInspectorId} disabled={!zonaId} options={inspectoresZona.map(i=>({value:i.id,label:i.usuario.nombre}))} placeholder={zonaId?"Pendiente de asignar":"Selecciona primero una zona"} />
    </div>
    <div className="grid gap-5 md:grid-cols-2">
      <Select label="Gerente de esta inspección (opcional)" name="gerenteId" value={gerenteId} onChange={setGerenteId} disabled={!zonaId || Boolean(gerenteFijoId)} options={gerentesZona.map(g=>({value:g.id,label:g.nombre}))} placeholder="Sin Gerente asignado" />
      {gerenteFijoId && <input type="hidden" name="gerenteId" value={gerenteFijoId} />}
      <Select label="Coordinador de esta inspección (opcional)" name="coordinadorId" value={coordinadorId} onChange={setCoordinadorId} disabled={!zonaId} options={coordinadoresZona.map(c=>({value:c.id,label:c.nombre}))} placeholder="Sin Coordinador asignado" />
    </div>
    <p className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4 text-sm text-cyan-100">Estas asignaciones aplican únicamente a esta inspección. Gerente, Coordinador e Inspector solo podrán visualizarla si quedaron vinculados aquí.</p>
  </div>;
}

function Select({label,name,value,onChange,options,placeholder,required=false,disabled=false}:{label:string;name:string;value:string;onChange:(v:string)=>void;options:{value:string;label:string}[];placeholder:string;required?:boolean;disabled?:boolean}) {
  return <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">{label}</span><select name={name} required={required} value={value} onChange={e=>onChange(e.target.value)} disabled={disabled} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 disabled:opacity-50"><option value="">{placeholder}</option>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
}
