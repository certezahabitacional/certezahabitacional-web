import Link from "next/link";
import { RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { incorporarCotizacionDefinitiva } from "./actions";

export default async function CargaCotizacionPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth(); if (!session?.user?.id) redirect("/login");
  const usuario = await prisma.usuario.findUnique({ where: { id: session.user.id }, select: { rol: true, activo: true } });
  if (!usuario?.activo || (usuario.rol !== RolUsuario.DIRECTOR && usuario.rol !== RolUsuario.ADMINISTRADOR)) redirect("/acceso");
  const params = await searchParams;
  const clientes = await prisma.cliente.findMany({ select: { id: true, nombre: true, correo: true, telefono: true }, orderBy: { nombre: "asc" } });

  return <main className="min-h-screen bg-slate-950 px-6 py-8 text-white"><div className="mx-auto max-w-5xl">
    <Link href="/panel/cotizaciones" className="text-sm font-black text-cyan-300">← Cotizaciones</Link>
    <p className="mt-7 text-xs font-black uppercase tracking-[0.25em] text-amber-300">Incorporación formal</p><h1 className="mt-2 text-3xl font-black">Cargar cotización definitiva</h1>
    <p className="mt-3 max-w-3xl text-slate-400">Carga el PDF definitivo sin la marca PRE COTIZACIÓN. El sistema reutiliza al cliente y al inmueble cuando encuentra una coincidencia segura; si hay ambigüedad, obliga a seleccionar el cliente existente.</p>
    {params.error && <p className="mt-6 rounded-2xl bg-rose-400/10 p-4 font-bold text-rose-300">{params.error}</p>}

    <form action={incorporarCotizacionDefinitiva} className="mt-8 space-y-6 rounded-3xl border border-white/10 bg-slate-900 p-7">
      <section><h2 className="font-black text-cyan-300">1. PDF definitivo</h2><input name="pdf" type="file" accept="application/pdf,.pdf" required className="mt-3 block w-full rounded-xl border border-white/10 bg-slate-950 p-3"/><p className="mt-2 text-xs text-slate-500">Máximo 15 MB.</p></section>
      <section><h2 className="font-black text-cyan-300">2. Cliente</h2><label className="mt-3 block text-xs font-bold text-slate-400">Cliente existente (recomendado cuando ya ha contratado antes)</label><select name="clienteId" className="mt-2 w-full rounded-xl bg-slate-950 px-4 py-3"><option value="">Buscar automáticamente / crear si no existe</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.correo ? ` · ${c.correo}` : ""}{c.telefono ? ` · ${c.telefono}` : ""}</option>)}</select><div className="mt-4 grid gap-3 md:grid-cols-2"><Campo n="nombre" p="Nombre completo" req/><Campo n="correo" p="Correo" type="email"/><Campo n="telefono" p="Teléfono"/><Campo n="rfc" p="RFC"/><Campo n="curp" p="CURP"/></div></section>
      <section><h2 className="font-black text-cyan-300">3. Inmueble</h2><div className="mt-4 grid gap-3 md:grid-cols-2"><Campo n="alias" p="Alias del inmueble" req/><Campo n="tipoInmueble" p="Tipo de inmueble" req/><Campo n="direccion" p="Dirección" req/><Campo n="colonia" p="Colonia"/><Campo n="ciudad" p="Ciudad" req/><Campo n="estado" p="Estado" req/><Campo n="codigoPostal" p="Código postal"/><Campo n="superficieM2" p="Superficie construcción m²" type="number" step="0.01"/></div></section>
      <section><h2 className="font-black text-cyan-300">4. Condiciones definitivas</h2><div className="mt-4 grid gap-3 md:grid-cols-2"><Campo n="total" p="Importe total MXN" type="number" step="0.01" req/><div><label className="mb-2 block text-xs font-bold text-slate-400">Vigencia hasta</label><input name="vigenciaHasta" type="date" required className="w-full rounded-xl bg-slate-950 px-4 py-3"/></div></div></section>
      <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-slate-300"><strong className="text-amber-300">Importante:</strong> cargar el PDF todavía no autoriza la cotización. Primero deberá quedar disponible para que el cliente la acepte; después Director o Administrador podrá autorizarla y enviarla a Caja.</div>
      <button className="rounded-full bg-cyan-300 px-6 py-3 font-black text-slate-950">Incorporar cotización definitiva</button>
    </form>
  </div></main>;
}

function Campo({ n, p, type = "text", step, req = false }: { n: string; p: string; type?: string; step?: string; req?: boolean }) { return <input name={n} placeholder={p} type={type} step={step} required={req} className="rounded-xl bg-slate-950 px-4 py-3"/>; }
