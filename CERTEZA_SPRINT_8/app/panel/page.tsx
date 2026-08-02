import Link from "next/link";
import { EstadoInspeccion, ClasificacionHallazgo } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export default async function PanelPage() {
  const [activas, pendientes, clientes, criticos, recientes, ish] = await Promise.all([
    prisma.inspeccion.count({ where: { estado: { in: [EstadoInspeccion.PROGRAMADA, EstadoInspeccion.EN_PROCESO] } } }),
    prisma.inspeccion.count({ where: { estado: EstadoInspeccion.REPORTE_PENDIENTE } }),
    prisma.cliente.count(),
    prisma.hallazgo.count({ where: { clasificacion: ClasificacionHallazgo.CR, resuelto: false } }),
    prisma.inspeccion.findMany({ include: { cliente: true }, orderBy: { actualizadoEn: "desc" }, take: 5 }),
    prisma.inspeccion.aggregate({ _avg: { ish: true }, where: { ish: { not: null } } }),
  ]);
  const indicadores = [["Inspecciones activas", activas],["Reportes pendientes", pendientes],["Clientes registrados", clientes],["Hallazgos críticos", criticos]] as const;
  return <main className="min-h-screen bg-slate-950 px-6 py-8 text-white"><div className="mx-auto max-w-7xl"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><p className="text-sm font-bold text-cyan-300">Panel administrativo</p><h1 className="mt-1 text-3xl font-black">Resumen de operaciones</h1></div><div className="flex flex-wrap gap-3"><Link href="/panel/clientes" className="rounded-full border border-white/15 px-5 py-3 font-bold">Clientes</Link><Link href="/panel/inspectores" className="rounded-full border border-white/15 px-5 py-3 font-bold">Inspectores</Link><Link href="/panel/agenda" className="rounded-full border border-white/15 px-5 py-3 font-bold">Agenda</Link><Link href="/panel/inspecciones" className="rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950">Nueva inspección</Link></div></div>
  <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{indicadores.map(([t,v]) => <article key={t} className="rounded-3xl border border-white/10 bg-slate-900 p-6"><p className="text-sm font-bold text-slate-400">{t}</p><p className="mt-4 text-4xl font-black text-cyan-300">{String(v).padStart(2,"0")}</p></article>)}</section>
  <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_320px]"><section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900"><div className="flex items-center justify-between border-b border-white/10 p-6"><h2 className="text-xl font-black">Actividad reciente</h2><Link href="/panel/inspecciones" className="text-sm font-bold text-cyan-300">Ver todas →</Link></div>{recientes.length === 0 ? <p className="p-12 text-center text-slate-400">Aún no hay inspecciones en la base de datos.</p> : <div className="divide-y divide-white/10">{recientes.map(i => <Link key={i.id} href={`/panel/inspecciones/${i.id}`} className="grid gap-3 p-6 transition hover:bg-white/[0.03] md:grid-cols-[1fr_1fr_auto]"><div><p className="font-black text-cyan-300">{i.folio}</p><p className="text-sm text-slate-400">{i.cliente.nombre}</p></div><div><p className="font-bold">{i.tipoInmueble}</p><p className="text-sm text-slate-500">{i.ciudad}</p></div><span className="text-sm font-black text-amber-300">{i.estado.replaceAll("_"," ")}</span></Link>)}</div>}</section><aside className="rounded-3xl bg-cyan-300 p-7 text-slate-950"><p className="text-sm font-black uppercase tracking-[.2em]">Índice general</p><p className="mt-8 text-7xl font-black">{Math.round(Number(ish._avg.ish ?? 0))}</p><p className="mt-2 text-xl font-black">Salud habitacional</p><p className="mt-5 leading-7 text-slate-800">Promedio real de expedientes con índice registrado.</p></aside></div>
  </div></main>;
}
