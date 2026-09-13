import Link from "next/link";
import { EstadoInspeccion, RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { actualizarAgenda } from "./actions";

function fecha(valor: Date, zona: string) { return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: zona }).format(valor); }
function fechaInput(valor: Date) { const d = new Date(valor.getTime() - valor.getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); }
function estatusAgenda(estado: EstadoInspeccion) { if (estado === EstadoInspeccion.FINALIZADA) return "FINALIZADA"; if (estado === EstadoInspeccion.EN_PROCESO) return "EN PROCESO"; if (estado === EstadoInspeccion.CANCELADA) return "CANCELADA"; return "PROGRAMADA"; }

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string; vista?: string; ok?: string; error?: string }> }) {
  const session = await auth(); if (!session?.user?.id) redirect("/login");
  const usuario = await prisma.usuario.findUnique({ where: { id: session.user.id }, select: { id: true, rol: true, activo: true, inspector: { select: { id: true } } } });
  if (!usuario?.activo || usuario.rol === RolUsuario.CLIENTE) redirect("/acceso");
  const roles = [RolUsuario.DIRECTOR, RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR, RolUsuario.GERENTE, RolUsuario.COORDINADOR, RolUsuario.INSPECTOR];
  if (!roles.includes(usuario.rol)) redirect("/acceso");

  let alcance: Record<string, unknown> = {};
  if (usuario.rol === RolUsuario.INSPECTOR) { if (!usuario.inspector?.id) redirect("/acceso"); alcance = { inspectorId: usuario.inspector.id }; }
  else if (usuario.rol === RolUsuario.GERENTE) alcance = { inspector: { usuario: { gerenteId: usuario.id } } };
  else if (usuario.rol === RolUsuario.COORDINADOR) alcance = { inspector: { usuario: { coordinadorId: usuario.id } } };
  const gestiona = usuario.rol === RolUsuario.DIRECTOR || usuario.rol === RolUsuario.ADMINISTRADOR;
  const p = await searchParams; const q = (p.q ?? "").trim(); const filtro = (p.estado ?? "").trim(); const historico = p.vista === "canceladas";

  const estados = historico ? [EstadoInspeccion.CANCELADA] : [EstadoInspeccion.PROGRAMADA, EstadoInspeccion.EN_PROCESO, EstadoInspeccion.FINALIZADA];
  const inspecciones = await prisma.inspeccion.findMany({
    where: { ...alcance, estado: { in: estados }, ...(q ? { OR: [{ folio: { contains: q, mode: "insensitive" } }, { cliente: { nombre: { contains: q, mode: "insensitive" } } }, { inmueble: { alias: { contains: q, mode: "insensitive" } } }, { direccion: { contains: q, mode: "insensitive" } }, { cotizacion: { folio: { contains: q, mode: "insensitive" } } }] } : {}) },
    select: { id: true, folio: true, fechaProgramada: true, estado: true, direccion: true, zonaHoraria: true, actualizadoEn: true, cliente: { select: { nombre: true } }, inmueble: { select: { alias: true } }, cotizacion: { select: { folio: true, estado: true } }, zona: { select: { zonaHoraria: true } } },
    orderBy: [{ fechaProgramada: "desc" }, { folio: "desc" }], take: 500,
  });
  const filas = inspecciones.filter(i => historico || !filtro || i.estado === filtro);

  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6"><div className="mx-auto max-w-[1650px]">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-sm font-black uppercase tracking-[0.28em] text-amber-300">Operación</p><h1 className="mt-2 text-4xl font-black">Agenda</h1><p className="mt-3 max-w-4xl text-slate-400">La agenda activa excluye automáticamente servicios cancelados. Las cancelaciones permanecen en histórico para trazabilidad y nunca se eliminan.</p><div className="mt-4 flex gap-2"><Link href="/panel/agenda?vista=activas" className={`rounded-full px-4 py-2 text-sm font-black ${!historico?"bg-cyan-300 text-slate-950":"border border-white/15 text-slate-300"}`}>Agenda activa</Link><Link href="/panel/agenda?vista=canceladas" className={`rounded-full px-4 py-2 text-sm font-black ${historico?"bg-rose-300 text-slate-950":"border border-white/15 text-slate-300"}`}>Histórico canceladas</Link></div></div>
    <form className="grid gap-2 sm:grid-cols-[minmax(300px,1fr)_200px_auto]"><input type="hidden" name="vista" value={historico?"canceladas":"activas"}/><input name="q" defaultValue={q} placeholder="Buscar inspección, cotización, cliente, inmueble o domicilio" className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm"/>{!historico?<select name="estado" defaultValue={filtro} className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm"><option value="">Todos los estatus</option><option value="PROGRAMADA">Programada</option><option value="EN_PROCESO">En proceso</option><option value="FINALIZADA">Finalizada</option></select>:<div className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm text-slate-400">Estado: CANCELADA</div>}<button className="rounded-full border border-white/15 px-5 py-3 text-sm font-black">Buscar / filtrar</button></form></div>
    {(p.ok || p.error) && <p className={`mt-6 rounded-2xl border p-4 font-bold ${p.error ? "border-rose-400/20 bg-rose-400/10 text-rose-300" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"}`}>{p.error ?? p.ok}</p>}
    <div className="mt-8 overflow-x-auto rounded-3xl border border-white/10 bg-slate-900/70"><table className="min-w-[1550px] w-full border-collapse text-left"><thead className="sticky top-0 z-20 bg-slate-900"><tr className="text-[10px] font-black uppercase tracking-wider text-slate-400"><th className="px-4 py-4">Inspección (folio)</th><th className="px-4 py-4">Cotización (folio)</th><th className="px-4 py-4">Nombre cliente</th><th className="px-4 py-4">Alias inmueble</th><th className="px-4 py-4">Domicilio inmueble</th><th className="px-4 py-4">Fecha agendada</th><th className="px-4 py-4">Estatus</th></tr></thead><tbody>{filas.map(i => { const zona = i.zona?.zonaHoraria ?? i.zonaHoraria ?? "America/Ciudad_Juarez"; return <tr key={i.id} className="border-t border-white/5 align-top hover:bg-white/[0.025]"><td className="px-4 py-4 font-mono text-xs font-black text-cyan-300">{i.folio}</td><td className="px-4 py-4 font-mono text-xs">{i.cotizacion?.folio ?? "—"}</td><td className="px-4 py-4 font-bold">{i.cliente.nombre}</td><td className="px-4 py-4">{i.inmueble?.alias ?? "—"}</td><td className="px-4 py-4">{i.direccion}</td><td className="px-4 py-4">{!historico&&gestiona ? <form action={actualizarAgenda} className="flex min-w-[430px] gap-2"><input type="hidden" name="inspeccionId" value={i.id}/><input type="datetime-local" name="fechaProgramada" defaultValue={fechaInput(i.fechaProgramada)} required className="rounded-xl bg-slate-950 px-3 py-2 text-xs"/><select name="estado" defaultValue={i.estado} className="rounded-xl bg-slate-950 px-3 py-2 text-xs"><option value="PROGRAMADA">PROGRAMADA</option><option value="EN_PROCESO">EN PROCESO</option><option value="FINALIZADA">FINALIZADA</option></select><button className="rounded-xl bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950">Guardar</button></form> : fecha(i.fechaProgramada, zona)}</td><td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${historico?"bg-rose-400/10 text-rose-300":"bg-white/5"}`}>{estatusAgenda(i.estado)}</span>{historico&&<p className="mt-2 text-[11px] text-slate-500">Fuera de operación activa · conservada para historial.</p>}</td></tr>; })}</tbody></table>{filas.length === 0 && <div className="p-10 text-center text-slate-400">{historico?"No hay inspecciones canceladas con esos filtros.":"No hay registros de Agenda con esos filtros."}</div>}</div>
  </div></main>;
}
