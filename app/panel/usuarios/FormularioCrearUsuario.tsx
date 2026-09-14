"use client";

import { useState } from "react";
import { RolUsuario } from "@prisma/client";
import PasswordField from "@/components/forms/PasswordField";
import { crearUsuarioFase2 } from "./actions-fase2";

type Zona = { id: string; nombre: string };
type Props = {
  rolesCreables: RolUsuario[];
  zonas: Zona[];
  gerentes?: unknown[];
  coordinadores?: unknown[];
};

export default function FormularioCrearUsuario({ rolesCreables, zonas }: Props) {
  const [rol, setRol] = useState<RolUsuario | "">("");
  const internos = rolesCreables.filter(r => r !== RolUsuario.CLIENTE);
  const esDirector = rol === RolUsuario.DIRECTOR;
  const esInspector = rol === RolUsuario.INSPECTOR;
  const mostrarZona = Boolean(rol) && !esDirector;

  return <form action={crearUsuarioFase2} className="mt-7 space-y-5">
    <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4 text-sm leading-6 text-cyan-100">
      Gerentes, Coordinadores e Inspectores se crean como usuarios independientes. Su relación operativa se define al asignarlos a cada inspección.
    </div>
    <Campo nombre="nombre" etiqueta="Nombre completo" tipo="text" />
    <Campo nombre="email" etiqueta="Correo / usuario de acceso" tipo="email" />
    <PasswordField name="password" label="Contraseña inicial" autoComplete="new-password" minLength={8} inputClassName="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 pr-24 outline-none focus:border-cyan-300" />

    <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">Rol</span><select name="rol" required value={rol} onChange={e => setRol(e.target.value as RolUsuario)} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"><option value="" disabled>Selecciona un rol</option>{internos.map(r => <option key={r} value={r}>{etiqueta(r)}</option>)}</select></label>

    {mostrarZona && <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">Zona *</span><select name="zonaId" required defaultValue="" className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"><option value="" disabled>Selecciona una zona</option>{zonas.map(z => <option key={z.id} value={z.id}>{z.nombre}</option>)}</select></label>}

    {esInspector && <>
      <div className="grid gap-4 sm:grid-cols-2"><Campo nombre="telefono" etiqueta="Teléfono" tipo="text" /><Campo nombre="ciudad" etiqueta="Ciudad" tipo="text" /><Campo nombre="especialidad" etiqueta="Especialidad" tipo="text" /><Campo nombre="cedula" etiqueta="Cédula profesional" tipo="text" /></div>
      <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100">No se requiere seleccionar Gerente ni Coordinador. Se asignarán, cuando corresponda, al crear cada inspección.</div>
    </>}

    <button type="submit" className="w-full rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950">Crear usuario</button>
  </form>;
}

function etiqueta(rol: RolUsuario) { return rol.charAt(0) + rol.slice(1).toLowerCase().replaceAll("_", " "); }
function Campo({ nombre, etiqueta, tipo }: { nombre: string; etiqueta: string; tipo: string }) { return <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">{etiqueta}</span><input type={tipo} name={nombre} required={nombre === "nombre" || nombre === "email"} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300" /></label>; }
