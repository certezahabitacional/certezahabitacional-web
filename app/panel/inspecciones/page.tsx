import Link from "next/link";
import { EstadoInspeccion, Prisma, RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { obtenerUsuarioConAlcanceZona, zonaEfectivaId } from "@/lib/alcance-zona";
import { puedeVerExpedienteTecnico } from "@/lib/permisos";
import { prisma } from "@/lib/prisma";

function formatoFecha(fecha: Date, zonaHoraria: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: zonaHoraria }).format(fecha);
}
function etiquetaEstado(estado: EstadoInspeccion) { return estado.replaceAll("_", " "); }

export default async function InspeccionesPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string; inspector?: string; zonaId?: string }> }) {
  const usuario = await obtenerUsuarioConAlcanceZona("/panel/inspecciones");
  if (usuario.rol === RolUsuario.CLIENTE) redirect("/portal/inspecciones");
  const rolesPermitidos = [RolUsuario.DIRECTOR, RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR, RolUsuario.GERENTE, RolUsuario.COORDINADOR, RolUsuario.INSPECTOR];
  if (!rolesPermitidos.includes(usuario.rol)) redirect("/acceso");

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const estado = (params.estado ?? "").trim();
  const inspector = (params.inspector ?? "").trim();
  const zonaId = zonaEfectivaId(usuario, params.zonaId);
  const zonas = usuario.rol === RolUsuario.DIRECTOR ? await prisma.zona.findMany({ where: { activa: true }, select: { id: true, nombre: true, codigo: true }, orderBy: { nombre: "asc" } }) : [];

  let alcanceRol: Prisma.InspeccionWhereInput = {};
  switch (usuario.rol) {
    case RolUsuario.DIRECTOR:
    case RolUsuario.ADMINISTRADOR:
    case RolUsuario.VENDEDOR:
      alcanceRol = {};
      break;
    case RolUsuario.GERENTE:
      alcanceRol = { inspector: { usuario: { gerenteId: usuario.id } } };
      break;
    case RolUsuario.COORDINADOR:
      alcanceRol = { inspector: { usuario: { coordinadorId: usuario.id } } };
      break;
    case RolUsuario.INSPECTOR:
      if (!usuario.inspector?.id) redirect("/acceso");
      alcanceRol = { inspectorId: usuario.inspector.id };
      break;
  }

  const where: Prisma.InspeccionWhereInput = { AND: [
    zonaId ? { zonaId } : {},
    alcanceRol,
    estado ? { estado: estado as EstadoInspeccion } : {},
    inspector ? { inspector: { usuario: { nombre: { contains: inspector, mode: "insensitive" } } } } : {},
    q ? { OR: [
      { folio: { contains: q, mode: "insensitive" } },
      { cliente: { nombre: { contains: q, mode: "insensitive" } } },
      { inmueble: { alias: { contains: q, mode: "insensitive" } } },
      { direccion: { contains: q, mode: "insensitive" } },
      { inspector: { usuario: { nombre: { contains: q, mode: "insensitive" } } } },
    ] } : {},
  ] };

  const inspecciones = await prisma.inspeccion.findMany({
    where,
    select: {
      id: true,
      folio: true,
      numeroInspeccion: true,
      fechaProgramada: true,
      estado: true,
      zonaHoraria: true,
      cliente: { select: { nombre: true } },
      inmueble: { select: { alias: true, direccion: true, ciudad: true } },
      inspector: { select: { usuario: { select: { nombre: true } } } },
      zona: { select: { nombre: true, codigo: true, zonaHoraria: true } },
    },
    orderBy: [{ fechaProgramada: "desc" }, { folio: "desc" }],
    take: 500,
  });
  const inspectores = Array.from(new Set(inspecciones.map(i => i.inspector?.usuario.nombre).filter((n): n is string => Boolean(n)))).sort((a,b)=>a.localeCompare(b,"es"));
  const puedeAbrirExpediente = puedeVerExpedienteTecnico(usuario.rol);

  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6"><div className="mx-auto max-w-[1550px]">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300 sm:text-sm sm:tracking-[0.28em]">Control operativo</p><h1 className="mt-2 text-4xl font-black">Inspecciones</h1><p className="mt-3 max-w-4xl text-sm text-slate-400 sm:text-base">{usuario.rol===RolUsuario.DIRECTOR?"Dirección puede consultar el universo completo, separado por zona mediante el filtro.":`Consulta restringida a ${usuario.zona?.nombre ?? "tu zona"} y al alcance de tu rol.`}</p></div>
    <form className="grid gap-2 sm:grid-cols-[minmax(230px,1fr)_180px_200px_210px_auto]"><input name="q" defaultValue={q} placeholder="Buscar folio, cliente, inmueble, domicilio o inspector" className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm sm:rounded-full sm:px-5"/><select name="estado" defaultValue={estado} className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm sm:rounded-full sm:px-5"><option value="">Todos los estatus</option>{Object.values(EstadoInspeccion).map(v=><option key={v} value={v}>{etiquetaEstado(v)}</option>)}</select><select name="inspector" defaultValue={inspector} className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm sm:rounded-full sm:px-5"><option value="">Todos los inspectores</option>{inspectores.map(n=><option key={n} value={n}>{n}</option>)}</select>{usuario.rol===RolUsuario.DIRECTOR?<select name="zonaId" defaultValue={params.zonaId??""} className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm sm:rounded-full sm:px-5"><option value="">Todas las zonas</option>{zonas.map(z=><option key={z.id} value={z.id}>{z.nombre} · {z.codigo}</option>)}</select>:<div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 px-4 py-3 text-sm font-bold text-cyan-200 sm:rounded-full sm:px-5">{usuario.zona?.nombre}</div>}<button className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 sm:rounded-full sm:border sm:border-white/15 sm:bg-transparent sm:text-white">Buscar / filtrar</button></form></div>

    <div className="mobile-card-list mt-6 sm:hidden">
      {inspecciones.map(i=>{const zh=i.zona?.zonaHoraria??i.zonaHoraria??"America/Ciudad_Juarez"; const contenido=<><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-sm font-black text-cyan-300">{i.folio}</p><p className="mt-1 text-xs font-bold text-slate-500">Versión {i.numeroInspeccion}</p></div><Estado estado={i.estado}/></div><div className="mt-4"><p className="mobile-label">Cliente</p><p className="mt-1 font-bold">{i.cliente.nombre}</p></div><div className="mt-3"><p className="mobile-label">Inmueble</p><p className="mt-1 font-bold">{i.inmueble?.alias??"Sin alias"}</p><p className="mt-1 text-sm text-slate-400">{i.inmueble?`${i.inmueble.direccion}, ${i.inmueble.ciudad}`:"Sin inmueble asociado"}</p></div><div className="mt-4 grid grid-cols-2 gap-3"><div><p className="mobile-label">Agenda</p><p className="mt-1 text-sm">{formatoFecha(i.fechaProgramada,zh)}</p></div><div><p className="mobile-label">Inspector</p><p className="mt-1 text-sm">{i.inspector?.usuario.nombre??"Sin asignar"}</p></div></div><div className="mt-3"><p className="mobile-label">Zona</p><p className="mt-1 text-sm">{i.zona?`${i.zona.nombre} · ${i.zona.codigo}`:"—"}</p></div>{puedeAbrirExpediente&&<div className="mt-4 rounded-xl bg-cyan-300 px-4 py-3 text-center text-sm font-black text-slate-950">Abrir expediente</div>}</>; return puedeAbrirExpediente?<Link key={i.id} href={`/panel/inspecciones/${i.id}`} className="mobile-card block">{contenido}</Link>:<article key={i.id} className="mobile-card">{contenido}</article>})}
      {inspecciones.length===0&&<div className="mobile-card text-center text-slate-400">No hay inspecciones con esos filtros dentro de tu alcance.</div>}
    </div>

    <div className="mt-8 hidden max-h-[72vh] overflow-auto rounded-3xl border border-white/10 bg-slate-900/70 sm:block"><table className="min-w-[1300px] w-full border-collapse text-left"><thead className="sticky top-0 z-20 bg-slate-900"><tr className="text-[10px] font-black uppercase tracking-wider text-slate-400"><th className="px-4 py-4">Folio</th><th className="px-4 py-4">Cliente</th><th className="px-4 py-4">Inmueble</th><th className="px-4 py-4">Zona</th><th className="px-4 py-4">Agenda</th><th className="px-4 py-4">Inspector</th><th className="px-4 py-4">Estatus</th></tr></thead><tbody>{inspecciones.map(i=>{const zh=i.zona?.zonaHoraria??i.zonaHoraria??"America/Ciudad_Juarez"; const folio=<div><p className="font-mono text-xs font-black text-cyan-300">{i.folio}</p><p className="mt-1 text-[11px] font-bold text-slate-500">V{i.numeroInspeccion}</p></div>; return <tr key={i.id} className="border-t border-white/5 hover:bg-white/[0.025]"><td className="px-4 py-4">{puedeAbrirExpediente?<Link href={`/panel/inspecciones/${i.id}`}>{folio}</Link>:folio}</td><td className="px-4 py-4 font-bold">{i.cliente.nombre}</td><td className="px-4 py-4"><p className="font-bold">{i.inmueble?.alias??"Sin alias"}</p><p className="mt-1 text-xs text-slate-500">{i.inmueble?`${i.inmueble.direccion}, ${i.inmueble.ciudad}`:"Sin inmueble asociado"}</p></td><td className="px-4 py-4">{i.zona?`${i.zona.nombre} · ${i.zona.codigo}`:"—"}</td><td className="px-4 py-4">{formatoFecha(i.fechaProgramada,zh)}</td><td className="px-4 py-4">{i.inspector?.usuario.nombre??"Sin asignar"}</td><td className="px-4 py-4"><Estado estado={i.estado}/></td></tr>})}</tbody></table>{inspecciones.length===0&&<div className="p-10 text-center text-slate-400">No hay inspecciones con esos filtros dentro de tu alcance.</div>}</div>
  </div></main>;
}

function Estado({ estado }: { estado: EstadoInspeccion }) { const clase=estado===EstadoInspeccion.FINALIZADA?"bg-emerald-400/15 text-emerald-300":estado===EstadoInspeccion.CANCELADA?"bg-rose-400/15 text-rose-300":estado===EstadoInspeccion.EN_PROCESO?"bg-amber-400/15 text-amber-300":estado===EstadoInspeccion.REPORTE_PENDIENTE?"bg-violet-400/15 text-violet-300":"bg-sky-400/15 text-sky-300"; return <span className={`inline-block rounded-full px-3 py-1 text-[11px] font-black ${clase}`}>{etiquetaEstado(estado)}</span>; }
