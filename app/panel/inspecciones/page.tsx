import Link from "next/link";
import { EstadoInspeccion, EstadoPago, Prisma, RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { obtenerUsuarioConAlcanceZona, zonaEfectivaId } from "@/lib/alcance-zona";
import { idsInspeccionesAsignadas, rolAsignableDesdeUsuario } from "@/lib/asignaciones-inspeccion";
import { puedeVerExpedienteTecnico } from "@/lib/permisos";
import { prisma } from "@/lib/prisma";
import { iniciarInspeccion } from "./[id]/actions";

function formatoFecha(fecha: Date, zonaHoraria: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: zonaHoraria }).format(fecha);
}
function etiquetaEstado(estado: EstadoInspeccion) { return estado.replaceAll("_", " "); }
function etiquetaEstadoParaRol(estado: EstadoInspeccion, rol: RolUsuario) {
  if (rol === RolUsuario.DIRECTOR && estado === EstadoInspeccion.REPORTE_PENDIENTE) return "ESPERA AUTORIZACIÓN DIRECCIÓN";
  return etiquetaEstado(estado);
}

type AsignacionFila={inspeccionId:string;rol:"GERENTE"|"COORDINADOR"|"INSPECTOR"};

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
  const rolAsignable = rolAsignableDesdeUsuario(usuario.rol);
  if (rolAsignable) {
    const ids = await idsInspeccionesAsignadas(usuario.id, rolAsignable);
    alcanceRol = { id: { in: ids } };
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
      id:true,folio:true,numeroInspeccion:true,fechaProgramada:true,estado:true,zonaHoraria:true,inspectorId:true,inicioLiberadoSinPago:true,requiereGerenteZona:true,requiereCoordinador:true,
      cliente:{select:{nombre:true}},inmueble:{select:{alias:true,direccion:true,ciudad:true}},inspector:{select:{usuario:{select:{nombre:true}}}},zona:{select:{nombre:true,codigo:true,zonaHoraria:true}},
      cotizacion:{select:{total:true,montoPagado:true,estadoPago:true}},
    },
    orderBy:[{fechaProgramada:"desc"},{folio:"desc"}],take:500,
  });

  const idsProgramadas=inspecciones.filter(i=>i.estado===EstadoInspeccion.PROGRAMADA).map(i=>i.id);
  const asignaciones:AsignacionFila[]=idsProgramadas.length?await prisma.$queryRaw<AsignacionFila[]>(Prisma.sql`
    SELECT "inspeccionId", "rol"::text AS "rol"
    FROM "AsignacionRolInspeccion"
    WHERE "inspeccionId" IN (${Prisma.join(idsProgramadas)})
  `):[];
  const rolesPorInspeccion=new Map<string,Set<string>>();
  for(const a of asignaciones){const set=rolesPorInspeccion.get(a.inspeccionId)??new Set<string>();set.add(a.rol);rolesPorInspeccion.set(a.inspeccionId,set);}

  function estaLiberada(i:(typeof inspecciones)[number]){
    if(i.estado!==EstadoInspeccion.PROGRAMADA||!i.cotizacion)return false;
    const saldo=Math.max(0,Number(i.cotizacion.total)-Number(i.cotizacion.montoPagado));
    const pagoCompleto=i.cotizacion.estadoPago===EstadoPago.PAGADO&&saldo<=0.01;
    const financiera=pagoCompleto||Boolean(i.inicioLiberadoSinPago);
    const roles=rolesPorInspeccion.get(i.id)??new Set<string>();
    const equipo=(!i.requiereGerenteZona||roles.has("GERENTE"))&&(!i.requiereCoordinador||roles.has("COORDINADOR"));
    const responsableCampo=Boolean(i.inspectorId)||usuario.rol===RolUsuario.DIRECTOR;
    return financiera&&equipo&&responsableCampo;
  }

  function responsableCampo(i:(typeof inspecciones)[number]){
    if(i.inspector?.usuario.nombre)return i.inspector.usuario.nombre;
    if(i.estado===EstadoInspeccion.EN_PROCESO)return "Director por ausencia";
    return "Sin asignar";
  }

  const inspectores=Array.from(new Set(inspecciones.map(i=>i.inspector?.usuario.nombre).filter((n):n is string=>Boolean(n)))).sort((a,b)=>a.localeCompare(b,"es"));
  const esVendedor = usuario.rol === RolUsuario.VENDEDOR;
  const puedeAbrirExpediente=puedeVerExpedienteTecnico(usuario.rol);
  const puedeReagendar=usuario.rol===RolUsuario.DIRECTOR||usuario.rol===RolUsuario.ADMINISTRADOR;
  const puedeIniciar=usuario.rol===RolUsuario.DIRECTOR||usuario.rol===RolUsuario.INSPECTOR;

  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6"><div className="mx-auto max-w-[1550px]">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300 sm:text-sm sm:tracking-[0.28em]">Control operativo</p><h1 className="mt-2 text-4xl font-black">Inspecciones</h1><p className="mt-3 max-w-4xl text-sm text-slate-400 sm:text-base">{usuario.rol===RolUsuario.DIRECTOR?"Dirección puede consultar el universo completo.":usuario.rol===RolUsuario.GERENTE||usuario.rol===RolUsuario.COORDINADOR||usuario.rol===RolUsuario.INSPECTOR?"Solo se muestran inspecciones ligadas directamente a tu usuario.":`Consulta operativa de ${usuario.zona?.nombre??"tu zona"}.`}</p></div>
    <form className="grid gap-2 sm:grid-cols-[minmax(230px,1fr)_180px_200px_210px_auto]"><input name="q" defaultValue={q} placeholder="Buscar folio, cliente, inmueble, domicilio o inspector" className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm sm:rounded-full sm:px-5"/><select name="estado" defaultValue={estado} className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm sm:rounded-full sm:px-5"><option value="">Todos los estatus</option>{Object.values(EstadoInspeccion).map(v=><option key={v} value={v}>{etiquetaEstado(v)}</option>)}</select><select name="inspector" defaultValue={inspector} className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm sm:rounded-full sm:px-5"><option value="">Todos los inspectores</option>{inspectores.map(n=><option key={n} value={n}>{n}</option>)}</select>{usuario.rol===RolUsuario.DIRECTOR?<select name="zonaId" defaultValue={params.zonaId??""} className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm sm:rounded-full sm:px-5"><option value="">Todas las zonas</option>{zonas.map(z=><option key={z.id} value={z.id}>{z.nombre} · {z.codigo}</option>)}</select>:<div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 px-4 py-3 text-sm font-bold text-cyan-200 sm:rounded-full sm:px-5">{usuario.zona?.nombre}</div>}<button className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 sm:rounded-full sm:border sm:border-white/15 sm:bg-transparent sm:text-white">Buscar / filtrar</button></form></div>

    <div className="mobile-card-list mt-6 sm:hidden">{inspecciones.map(i=>{const zh=i.zona?.zonaHoraria??i.zonaHoraria??"America/Ciudad_Juarez";const liberada=estaLiberada(i);return <article key={i.id} className="mobile-card"><div className="flex items-start justify-between gap-3"><div>{puedeAbrirExpediente?<Link href={esVendedor
  ? `/panel/inspecciones/${i.id}`
  : i.estado===EstadoInspeccion.PROGRAMADA
    ? `/panel/inspecciones/${i.id}/revision-inicial`
    : i.estado===EstadoInspeccion.EN_PROCESO
      ? (i.numeroInspeccion===1?`/panel/inspecciones/${i.id}/flujo`:`/panel/inspecciones/${i.id}/captura`)
      : `/panel/inspecciones/${i.id}`} className="font-mono text-sm font-black text-cyan-300">{i.folio}</Link>:<p className="font-mono text-sm font-black text-cyan-300">{i.folio}</p>}<p className="mt-1 text-xs font-bold text-slate-500">Versión {i.numeroInspeccion}</p></div>{liberada?<Liberada/>:<Estado estado={i.estado} rol={usuario.rol}/>}</div><div className="mt-4"><p className="mobile-label">Cliente</p><p className="mt-1 font-bold">{i.cliente.nombre}</p></div><div className="mt-3"><p className="mobile-label">Inmueble</p><p className="mt-1 font-bold">{i.inmueble?.alias??"Sin alias"}</p><p className="mt-1 text-sm text-slate-400">{i.inmueble?`${i.inmueble.direccion}, ${i.inmueble.ciudad}`:"Sin inmueble asociado"}</p></div><div className="mt-4 grid grid-cols-2 gap-3"><div><p className="mobile-label">Agenda</p><p className="mt-1 text-sm">{formatoFecha(i.fechaProgramada,zh)}</p></div><div><p className="mobile-label">Inspector</p><p className="mt-1 text-sm">{responsableCampo(i)}</p></div></div><div className="mt-4 grid gap-2">{usuario.rol===RolUsuario.DIRECTOR&&i.estado===EstadoInspeccion.REPORTE_PENDIENTE?<Link href={`/panel/inspecciones/${i.id}/revision`} className="rounded-xl bg-violet-300 px-4 py-3 text-center text-sm font-black text-slate-950">REVISAR PARA AUTORIZAR</Link>:puedeAbrirExpediente&&i.estado!==EstadoInspeccion.EN_PROCESO&&i.estado!==EstadoInspeccion.PROGRAMADA&&<Link href={`/panel/inspecciones/${i.id}`} className="rounded-xl border border-cyan-300/30 px-4 py-3 text-center text-sm font-black text-cyan-200">Abrir expediente</Link>}{puedeIniciar&&i.estado===EstadoInspeccion.EN_PROCESO&&<Link href={i.numeroInspeccion===1?`/panel/inspecciones/${i.id}/flujo`:`/panel/inspecciones/${i.id}/captura`} className="rounded-xl bg-cyan-300 px-4 py-3 text-center text-sm font-black text-slate-950">Continuar inspección</Link>}{puedeReagendar&&i.estado===EstadoInspeccion.PROGRAMADA&&<Link href={`/panel/inspecciones/${i.id}/editar`} className="rounded-xl border border-white/15 px-4 py-3 text-center text-sm font-black">Reagendar</Link>}{puedeIniciar&&liberada&&<form action={iniciarInspeccion}><input type="hidden" name="id" value={i.id}/><button className="w-full rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950">Iniciar Inspección</button></form>}</div></article>})}{inspecciones.length===0&&<div className="mobile-card text-center text-slate-400">No hay inspecciones con esos filtros dentro de tu alcance.</div>}</div>

    <div className="mt-8 hidden max-h-[72vh] overflow-auto rounded-3xl border border-white/10 bg-slate-900/70 sm:block"><table className="min-w-[1450px] w-full border-collapse text-left"><thead className="sticky top-0 z-20 bg-slate-900"><tr className="text-[10px] font-black uppercase tracking-wider text-slate-400"><th className="px-4 py-4">Folio</th><th className="px-4 py-4">Cliente</th><th className="px-4 py-4">Inmueble</th><th className="px-4 py-4">Zona</th><th className="px-4 py-4">Agenda</th><th className="px-4 py-4">Inspector</th><th className="px-4 py-4">Estatus</th><th className="sticky right-0 z-30 min-w-[190px] bg-slate-900 px-4 py-4 shadow-[-18px_0_28px_-20px_rgba(0,0,0,0.9)]">Acciones</th></tr></thead><tbody>{inspecciones.map(i=>{const zh=i.zona?.zonaHoraria??i.zonaHoraria??"America/Ciudad_Juarez";const liberada=estaLiberada(i);const folio=<div><p className="font-mono text-xs font-black text-cyan-300">{i.folio}</p><p className="mt-1 text-[11px] font-bold text-slate-500">V{i.numeroInspeccion}</p></div>;return <tr key={i.id} className="border-t border-white/5 hover:bg-white/[0.025]"><td className="px-4 py-4">{puedeAbrirExpediente?<Link href={esVendedor
  ? `/panel/inspecciones/${i.id}`
  : i.estado===EstadoInspeccion.PROGRAMADA
    ? `/panel/inspecciones/${i.id}/revision-inicial`
    : i.estado===EstadoInspeccion.EN_PROCESO
      ? (i.numeroInspeccion===1?`/panel/inspecciones/${i.id}/flujo`:`/panel/inspecciones/${i.id}/captura`)
      : `/panel/inspecciones/${i.id}`}>{folio}</Link>:folio}</td><td className="px-4 py-4 font-bold">{i.cliente.nombre}</td><td className="px-4 py-4"><p className="font-bold">{i.inmueble?.alias??"Sin alias"}</p><p className="mt-1 text-xs text-slate-500">{i.inmueble?`${i.inmueble.direccion}, ${i.inmueble.ciudad}`:"Sin inmueble asociado"}</p></td><td className="px-4 py-4">{i.zona?`${i.zona.nombre} · ${i.zona.codigo}`:"—"}</td><td className="px-4 py-4">{formatoFecha(i.fechaProgramada,zh)}</td><td className="px-4 py-4">{responsableCampo(i)}</td><td className="px-4 py-4">{liberada?<Liberada/>:<Estado estado={i.estado} rol={usuario.rol}/>}</td><td className="sticky right-0 z-10 min-w-[190px] bg-slate-900 px-4 py-4 shadow-[-18px_0_28px_-20px_rgba(0,0,0,0.9)]"><div className="flex flex-wrap gap-2">{usuario.rol===RolUsuario.DIRECTOR&&i.estado===EstadoInspeccion.REPORTE_PENDIENTE&&<Link href={`/panel/inspecciones/${i.id}/revision`} className="rounded-full bg-violet-300 px-3 py-2 text-xs font-black text-slate-950">Revisar / autorizar</Link>}{puedeIniciar&&i.estado===EstadoInspeccion.EN_PROCESO&&<Link href={i.numeroInspeccion===1?`/panel/inspecciones/${i.id}/flujo`:`/panel/inspecciones/${i.id}/captura`} className="rounded-full bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950">Continuar inspección</Link>}{puedeReagendar&&i.estado===EstadoInspeccion.PROGRAMADA&&<Link href={`/panel/inspecciones/${i.id}/editar`} className="rounded-full border border-white/15 px-3 py-2 text-xs font-black">Reagendar</Link>}{puedeIniciar&&liberada&&<form action={iniciarInspeccion}><input type="hidden" name="id" value={i.id}/><button className="rounded-full bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950">Iniciar Inspección</button></form>}</div></td></tr>})}</tbody></table>{inspecciones.length===0&&<div className="p-10 text-center text-slate-400">No hay inspecciones con esos filtros dentro de tu alcance.</div>}</div>
  </div></main>;
}
function Liberada(){return <span className="inline-block rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-black text-emerald-300">LIBERADA</span>}
function Estado({estado,rol}:{estado:EstadoInspeccion;rol:RolUsuario}){const clase=estado===EstadoInspeccion.FINALIZADA?"bg-emerald-400/15 text-emerald-300":estado===EstadoInspeccion.CANCELADA?"bg-rose-400/15 text-rose-300":estado===EstadoInspeccion.EN_PROCESO?"bg-amber-400/15 text-amber-300":estado===EstadoInspeccion.REPORTE_PENDIENTE?"bg-violet-400/15 text-violet-300":"bg-sky-400/15 text-sky-300";return <span className={`inline-block rounded-full px-3 py-1 text-[11px] font-black ${clase}`}>{etiquetaEstadoParaRol(estado,rol)}</span>}
