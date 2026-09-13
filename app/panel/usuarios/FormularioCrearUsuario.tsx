"use client";

import { useMemo, useState } from "react";
import { RolUsuario } from "@prisma/client";
import PasswordField from "@/components/forms/PasswordField";
import { crearUsuarioFase2 } from "./actions-fase2";

type Zona = { id: string; nombre: string };
type Gerente = { id: string; nombre: string; email: string; zonaId: string | null };
type Coordinador = { id: string; nombre: string; email: string; zonaId: string | null; gerenteId: string | null };

type Props = {
  rolesCreables: RolUsuario[];
  zonas: Zona[];
  gerentes: Gerente[];
  coordinadores?: Coordinador[];
};

export default function FormularioCrearUsuario({ rolesCreables, zonas, gerentes, coordinadores = [] }: Props) {
  const [rol, setRol] = useState<RolUsuario | "">("");
  const [zonaId, setZonaId] = useState("");
  const [gerenteId, setGerenteId] = useState("");
  const [alcance, setAlcance] = useState<"GLOBAL" | "ZONA">("GLOBAL");

  const internos = rolesCreables.filter(r => r !== RolUsuario.CLIENTE);
  const esAdmin = rol === RolUsuario.ADMINISTRADOR;
  const esVendedor = rol === RolUsuario.VENDEDOR;
  const esGerente = rol === RolUsuario.GERENTE;
  const esCoordinador = rol === RolUsuario.COORDINADOR;
  const esInspector = rol === RolUsuario.INSPECTOR;
  const mostrarZona = esVendedor || esGerente || esCoordinador || esInspector || (esAdmin && alcance === "ZONA");
  const mostrarGerente = esCoordinador || esInspector;

  const gerentesZona = useMemo(() => gerentes.filter(g => g.zonaId === zonaId), [gerentes, zonaId]);
  const coordinadoresDisponibles = useMemo(() => coordinadores.filter(c => c.zonaId === zonaId && c.gerenteId === gerenteId), [coordinadores, zonaId, gerenteId]);

  return <form action={crearUsuarioFase2} className="mt-7 space-y-5">
    <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4 text-sm leading-6 text-cyan-100">Usuarios es el único módulo para crear cuentas internas. Los clientes se originan desde Pre-cotizaciones y no se dan de alta manualmente.</div>
    <Campo nombre="nombre" etiqueta="Nombre completo" tipo="text" />
    <Campo nombre="email" etiqueta="Correo / usuario de acceso" tipo="email" />
    <PasswordField name="password" label="Contraseña inicial" autoComplete="new-password" minLength={8} inputClassName="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 pr-24 outline-none focus:border-cyan-300" />

    <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">Rol</span><select name="rol" required value={rol} onChange={e => { setRol(e.target.value as RolUsuario); setZonaId(""); setGerenteId(""); setAlcance("GLOBAL"); }} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"><option value="" disabled>Selecciona un rol</option>{internos.map(r => <option key={r} value={r}>{etiqueta(r)}</option>)}</select></label>

    {esAdmin && <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">Alcance administrativo</span><select name="alcanceAdministrador" value={alcance} onChange={e => { setAlcance(e.target.value as "GLOBAL" | "ZONA"); if (e.target.value === "GLOBAL") setZonaId(""); }} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"><option value="GLOBAL">Global</option><option value="ZONA">Por zona</option></select></label>}

    {mostrarZona && <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">Zona *</span><select name="zonaId" required value={zonaId} onChange={e => { setZonaId(e.target.value); setGerenteId(""); }} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"><option value="" disabled>Selecciona una zona</option>{zonas.map(z => <option key={z.id} value={z.id}>{z.nombre}</option>)}</select></label>}

    {mostrarGerente && <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">Gerente responsable *</span><select name="gerenteId" required value={gerenteId} onChange={e => setGerenteId(e.target.value)} disabled={!zonaId} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 disabled:opacity-50"><option value="" disabled>Selecciona un Gerente</option>{gerentesZona.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}</select></label>}

    {esInspector && <>
      <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">Coordinador responsable *</span><select name="coordinadorId" required disabled={!gerenteId} defaultValue="" key={`${zonaId}-${gerenteId}`} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 disabled:opacity-50"><option value="" disabled>Selecciona un Coordinador</option>{coordinadoresDisponibles.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
      <div className="grid gap-4 sm:grid-cols-2"><Campo nombre="telefono" etiqueta="Teléfono" tipo="text" /><Campo nombre="ciudad" etiqueta="Ciudad" tipo="text" /><Campo nombre="especialidad" etiqueta="Especialidad" tipo="text" /><Campo nombre="cedula" etiqueta="Cédula profesional" tipo="text" /></div>
      <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100">Al guardar se crearán en una sola operación la cuenta de acceso y el perfil operativo del Inspector.</div>
    </>}

    <button type="submit" className="w-full rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950">Crear usuario</button>
  </form>;
}

function etiqueta(rol: RolUsuario) { return rol.charAt(0) + rol.slice(1).toLowerCase().replaceAll("_", " "); }
function Campo({ nombre, etiqueta, tipo }: { nombre: string; etiqueta: string; tipo: string }) { return <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">{etiqueta}</span><input type={tipo} name={nombre} required={nombre === "nombre" || nombre === "email"} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300" /></label>; }
