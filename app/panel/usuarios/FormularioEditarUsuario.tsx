"use client";

import { useMemo, useState } from "react";
import { RolUsuario } from "@prisma/client";

type Zona = { id: string; nombre: string };
type Gerente = { id: string; nombre: string; email: string; zonaId: string | null };
type Coordinador = { id: string; nombre: string; email: string; zonaId: string | null; gerenteId: string | null };
type UsuarioEditable = {
  id: string; nombre: string; email: string; telefono?: string | null; ciudad?: string | null; rol: RolUsuario; zonaId: string | null; gerenteId: string | null; coordinadorId?: string | null;
  inspector?: { telefono: string | null; especialidad: string | null; cedula: string | null; ciudad: string | null } | null;
};

type Props = { usuario: UsuarioEditable; rolesEditables: RolUsuario[]; zonas: Zona[]; gerentes: Gerente[]; coordinadores?: Coordinador[]; action: (formData: FormData) => void | Promise<void> };

export default function FormularioEditarUsuario({ usuario, rolesEditables, zonas, gerentes, coordinadores = [], action }: Props) {
  const [rol, setRol] = useState<RolUsuario>(usuario.rol);
  const [zonaId, setZonaId] = useState(usuario.zonaId ?? "");
  const [gerenteId, setGerenteId] = useState(usuario.gerenteId ?? "");
  const esDirector = rol === RolUsuario.DIRECTOR;
  const esCoordinador = rol === RolUsuario.COORDINADOR;
  const esInspector = rol === RolUsuario.INSPECTOR;
  const mostrarZona = !esDirector;
  const mostrarGerente = esCoordinador || esInspector;
  const gerentesZona = useMemo(() => gerentes.filter(g => g.zonaId === zonaId), [gerentes, zonaId]);
  const coordinadoresDisponibles = useMemo(() => coordinadores.filter(c => c.zonaId === zonaId && c.gerenteId === gerenteId), [coordinadores, zonaId, gerenteId]);

  return <form action={action} className="space-y-4">
    <input type="hidden" name="usuarioId" value={usuario.id} />
    <Campo name="nombre" label="Nombre completo" type="text" defaultValue={usuario.nombre} required />
    <Campo name="email" label="Correo / usuario de acceso" type="email" defaultValue={usuario.email} required />
    <div className="grid gap-4 sm:grid-cols-2"><Campo name="telefono" label="Teléfono" type="text" defaultValue={usuario.inspector?.telefono ?? usuario.telefono ?? ""} /><Campo name="ciudad" label="Ciudad" type="text" defaultValue={usuario.inspector?.ciudad ?? usuario.ciudad ?? ""} /></div>
    <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">Rol</span><select name="rol" required value={rol} onChange={e => { const r=e.target.value as RolUsuario; setRol(r); if (r===RolUsuario.DIRECTOR) {setZonaId("");setGerenteId("");} }} className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3">{rolesEditables.filter(r=>r!==RolUsuario.CLIENTE).map(r=><option key={r} value={r}>{etiquetaRol(r)}</option>)}</select></label>
    {mostrarZona && <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">Zona *</span><select name="zonaId" required value={zonaId} onChange={e=>{setZonaId(e.target.value);setGerenteId("");}} className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"><option value="" disabled>Selecciona una zona</option>{zonas.map(z=><option key={z.id} value={z.id}>{z.nombre}</option>)}</select></label>}
    {mostrarGerente && <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">Gerente responsable *</span><select name="gerenteId" required value={gerenteId} onChange={e=>setGerenteId(e.target.value)} disabled={!zonaId} className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 disabled:opacity-50"><option value="" disabled>Selecciona un Gerente</option>{gerentesZona.map(g=><option key={g.id} value={g.id}>{g.nombre}</option>)}</select></label>}
    {esInspector && <><label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">Coordinador responsable *</span><select name="coordinadorId" required defaultValue={usuario.coordinadorId ?? ""} key={`${zonaId}-${gerenteId}-${usuario.coordinadorId ?? ""}`} disabled={!gerenteId} className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 disabled:opacity-50"><option value="" disabled>Selecciona un Coordinador</option>{coordinadoresDisponibles.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><Campo name="especialidad" label="Especialidad" type="text" defaultValue={usuario.inspector?.especialidad ?? ""}/><Campo name="cedula" label="Cédula profesional" type="text" defaultValue={usuario.inspector?.cedula ?? ""}/></div></>}
    <button type="submit" className="w-full rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950">Guardar cambios</button>
  </form>;
}

function Campo({name,label,type,defaultValue,required=false}:{name:string;label:string;type:string;defaultValue:string;required?:boolean}) { return <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">{label}</span><input name={name} type={type} required={required} defaultValue={defaultValue} className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-300"/></label>; }
function etiquetaRol(rol:RolUsuario){return rol.charAt(0)+rol.slice(1).toLowerCase().replaceAll("_"," ");}
