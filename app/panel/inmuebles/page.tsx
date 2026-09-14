import { EstadoCotizacion, RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";
import { obtenerUsuarioConAlcanceZona, zonaEfectivaId } from "@/lib/alcance-zona";
import { prisma } from "@/lib/prisma";

export default async function InmueblesPage({ searchParams }: { searchParams: Promise<{ q?: string; servicio?: string; zonaId?: string }> }) {
  const usuario = await obtenerUsuarioConAlcanceZona("/panel/inmuebles");
  const puedeEntrar = usuario.rol === RolUsuario.DIRECTOR || usuario.rol === RolUsuario.ADMINISTRADOR || usuario.rol === RolUsuario.VENDEDOR;
  if (!puedeEntrar) redirect("/acceso");

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const servicio = (params.servicio ?? "").trim();
  const zonaId = zonaEfectivaId(usuario, params.zonaId);
  const zonas = usuario.rol===RolUsuario.DIRECTOR ? await prisma.zona.findMany({where:{activa:true},select:{id:true,nombre:true,codigo:true},orderBy:{nombre:"asc"}}) : [];
  const inmuebles = await prisma.inmueble.findMany({
    where: {
      ...(zonaId ? { OR: [{ cotizaciones: { some: { zonaId } } }, { inspecciones: { some: { zonaId } } }] } : {}),
      ...(q ? { AND: [{ OR: [
        { alias: { contains: q, mode: "insensitive" } }, { direccion: { contains: q, mode: "insensitive" } },
        { ciudad: { contains: q, mode: "insensitive" } }, { cliente: { folio: { contains: q, mode: "insensitive" } } },
        { cliente: { nombre: { contains: q, mode: "insensitive" } } },
      ] }] } : {}),
    },
    select: {
      id: true, alias: true, direccion: true, colonia: true, ciudad: true, estado: true, superficieTerrenoM2: true, superficieConstruccionM2: true,
      cliente: { select: { folio: true, nombre: true } },
      cotizaciones: { where: { estado: EstadoCotizacion.AUTORIZADA, ...(zonaId ? { zonaId } : {}) }, orderBy: { autorizadaEn: "desc" }, take: 1, select: { paquete: { select: { nombre: true } }, zona: { select:{nombre:true,codigo:true} } } },
    }, orderBy: [{ cliente: { creadoEn: "desc" } }, { creadoEn: "desc" }],
  });
  const filas = inmuebles.map(i => ({ ...i, servicio: i.cotizaciones[0]?.paquete?.nombre ?? "Sin servicio autorizado", zona: i.cotizaciones[0]?.zona ?? null })).filter(i => !servicio || i.servicio === servicio);
  const servicios = Array.from(new Set(inmuebles.map(i => i.cotizaciones[0]?.paquete?.nombre).filter(Boolean) as string[])).sort();

  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6"><div className="mx-auto max-w-[1550px]">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-sm font-black uppercase tracking-[0.28em] text-amber-300">Base maestra de consulta</p><h1 className="mt-2 text-4xl font-black">Inmuebles</h1><p className="mt-3 max-w-4xl text-slate-400">{usuario.rol===RolUsuario.DIRECTOR?"Dirección consulta todos los inmuebles y puede separarlos por zona.":`Consulta limitada a inmuebles relacionados con ${usuario.zona?.nombre ?? "tu zona"}.`}</p></div><form className="grid gap-2 sm:grid-cols-[minmax(260px,1fr)_220px_210px_auto]">
      <input name="q" defaultValue={q} placeholder="Buscar folio, cliente, alias, domicilio o ciudad" className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm" />
      <select name="servicio" defaultValue={servicio} className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm"><option value="">Todos los servicios</option>{servicios.map(n => <option key={n} value={n}>{n}</option>)}</select>
      {usuario.rol===RolUsuario.DIRECTOR?<select name="zonaId" defaultValue={params.zonaId??""} className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm"><option value="">Todas las zonas</option>{zonas.map(z=><option key={z.id} value={z.id}>{z.nombre} · {z.codigo}</option>)}</select>:<div className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-5 py-3 text-sm font-bold text-cyan-200">{usuario.zona?.nombre}</div>}
      <button className="rounded-full border border-white/15 px-5 py-3 text-sm font-black">Buscar / filtrar</button></form></div>
    <div className="mt-8 overflow-x-auto rounded-3xl border border-white/10 bg-slate-900/70"><table className="min-w-[1450px] w-full border-collapse text-left"><thead className="sticky top-0 z-20 bg-slate-900"><tr className="text-[10px] font-black uppercase tracking-wider text-slate-400"><th className="px-4 py-4">Folio cliente</th><th className="px-4 py-4">Servicio</th><th className="px-4 py-4">Alias inmueble</th><th className="px-4 py-4">Zona</th><th className="px-4 py-4">Domicilio</th><th className="px-4 py-4 text-right">M2 terreno</th><th className="px-4 py-4 text-right">M2 construcción</th></tr></thead><tbody>{filas.map(i=><tr key={i.id} className="border-t border-white/5 hover:bg-white/[0.025]"><td className="px-4 py-4"><p className="font-mono text-xs font-black text-cyan-300">{i.cliente.folio}</p><p className="mt-1 text-xs text-slate-500">{i.cliente.nombre}</p></td><td className="px-4 py-4 font-bold">{i.servicio}</td><td className="px-4 py-4 font-bold">{i.alias}</td><td className="px-4 py-4">{i.zona?`${i.zona.nombre} · ${i.zona.codigo}`:"—"}</td><td className="px-4 py-4 text-slate-300">{[i.direccion,i.colonia,i.ciudad,i.estado].filter(Boolean).join(", ")}</td><td className="px-4 py-4 text-right">{i.superficieTerrenoM2?.toString()??"—"}</td><td className="px-4 py-4 text-right">{i.superficieConstruccionM2?.toString()??"—"}</td></tr>)}</tbody></table>{filas.length===0&&<div className="p-10 text-center text-slate-400">No hay inmuebles con esos filtros dentro de la zona seleccionada.</div>}</div>
  </div></main>;
}
