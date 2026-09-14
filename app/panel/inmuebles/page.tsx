import { EstadoCotizacion, RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function InmueblesPage({ searchParams }: { searchParams: Promise<{ q?: string; servicio?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const usuario = await prisma.usuario.findUnique({ where: { id: session.user.id }, select: { rol: true, activo: true } });
  const puedeEntrar = usuario?.rol === RolUsuario.DIRECTOR || usuario?.rol === RolUsuario.ADMINISTRADOR || usuario?.rol === RolUsuario.VENDEDOR;
  if (!usuario?.activo || !puedeEntrar) redirect("/acceso");

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const servicio = (params.servicio ?? "").trim();
  const inmuebles = await prisma.inmueble.findMany({
    where: q ? { OR: [
      { alias: { contains: q, mode: "insensitive" } }, { direccion: { contains: q, mode: "insensitive" } },
      { ciudad: { contains: q, mode: "insensitive" } }, { cliente: { folio: { contains: q, mode: "insensitive" } } },
      { cliente: { nombre: { contains: q, mode: "insensitive" } } },
    ] } : undefined,
    select: {
      id: true, alias: true, direccion: true, colonia: true, ciudad: true, estado: true,
      superficieTerrenoM2: true, superficieConstruccionM2: true,
      cliente: { select: { folio: true, nombre: true } },
      cotizaciones: { where: { estado: EstadoCotizacion.AUTORIZADA }, orderBy: { autorizadaEn: "desc" }, take: 1, select: { paquete: { select: { nombre: true } } } },
    },
    orderBy: [{ cliente: { creadoEn: "desc" } }, { creadoEn: "desc" }],
  });
  const filas = inmuebles.map(i => ({ ...i, servicio: i.cotizaciones[0]?.paquete?.nombre ?? "Sin servicio autorizado" })).filter(i => !servicio || i.servicio === servicio);
  const servicios = Array.from(new Set(inmuebles.map(i => i.cotizaciones[0]?.paquete?.nombre).filter(Boolean) as string[])).sort();

  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6"><div className="mx-auto max-w-[1550px]">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div>
      <p className="text-sm font-black uppercase tracking-[0.28em] text-amber-300">Base maestra de consulta</p><h1 className="mt-2 text-4xl font-black">Inmuebles</h1>
      <p className="mt-3 max-w-4xl text-slate-400">Panel exclusivamente de lectura. Los inmuebles se alimentan y corrigen únicamente desde Pre-cotizaciones.</p>
    </div><form className="grid gap-2 sm:grid-cols-[minmax(300px,1fr)_240px_auto]">
      <input name="q" defaultValue={q} placeholder="Buscar folio, cliente, alias, domicilio o ciudad" className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm" />
      <select name="servicio" defaultValue={servicio} className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm"><option value="">Todos los servicios</option>{servicios.map(n => <option key={n} value={n}>{n}</option>)}</select>
      <button className="rounded-full border border-white/15 px-5 py-3 text-sm font-black">Buscar / filtrar</button></form></div>

    <div className="mt-8 overflow-x-auto rounded-3xl border border-white/10 bg-slate-900/70"><table className="min-w-[1450px] w-full border-collapse text-left">
      <thead className="sticky top-0 z-20 bg-slate-900 shadow-[0_1px_0_rgba(255,255,255,0.08)]"><tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
        <th className="px-4 py-4">Folio del cliente</th><th className="px-4 py-4">Servicio contratado</th><th className="px-4 py-4">Alias del inmueble</th><th className="px-4 py-4">Domicilio</th><th className="px-4 py-4 text-right">M2 de terreno</th><th className="px-4 py-4 text-right">M2 de construcción</th>
      </tr></thead><tbody>{filas.map(i => <tr key={i.id} className="border-t border-white/5 hover:bg-white/[0.025]">
        <td className="px-4 py-4"><p className="font-mono text-xs font-black text-cyan-300">{i.cliente.folio}</p><p className="mt-1 text-xs text-slate-500">{i.cliente.nombre}</p></td>
        <td className="px-4 py-4 font-bold">{i.servicio}</td><td className="px-4 py-4 font-bold">{i.alias}</td>
        <td className="px-4 py-4 text-slate-300">{[i.direccion, i.colonia, i.ciudad, i.estado].filter(Boolean).join(", ")}</td>
        <td className="px-4 py-4 text-right">{i.superficieTerrenoM2?.toString() ?? "—"}</td><td className="px-4 py-4 text-right">{i.superficieConstruccionM2?.toString() ?? "—"}</td>
      </tr>)}</tbody></table>{filas.length === 0 && <div className="p-10 text-center text-slate-400">No hay inmuebles con esos filtros.</div>}</div>
  </div></main>;
}
