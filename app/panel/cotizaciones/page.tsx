import Link from "next/link";
import { EstadoCotizacion, RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { calcularResumenFinancieroCaja } from "@/lib/caja-finanzas";
import { prisma } from "@/lib/prisma";
import { cancelarCotizacion, regresarAPrecotizacion } from "./actions-flujo-aprobado";

function dinero(valor: unknown) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(Number(valor ?? 0));
}

function fecha(valor: Date) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(valor);
}

function causaCierre(descripcion?: string | null) {
  if (!descripcion) return "Cancelada";
  if (descripcion.includes("FALTA DE RESPUESTA DEL CLIENTE")) return "Falta de respuesta del cliente";
  if (descripcion.includes("CANCELACIÓN DEL CLIENTE")) return "Cancelación del cliente";
  return "Cancelada";
}

function motivoCierre(descripcion?: string | null) {
  if (!descripcion) return "Sin detalle disponible";
  const match = descripcion.match(/Motivo:\s*(.*?)(?:\. Pagos preservados:|$)/i);
  return match?.[1]?.trim() || "Consultar Auditoría";
}

export default async function CotizacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; vista?: string; ok?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const usuario = await prisma.usuario.findUnique({ where: { id: session.user.id }, select: { rol: true, activo: true } });
  const puedeEntrar = usuario?.rol === RolUsuario.DIRECTOR || usuario?.rol === RolUsuario.ADMINISTRADOR || usuario?.rol === RolUsuario.VENDEDOR;
  if (!usuario?.activo || !puedeEntrar) redirect("/acceso");

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const estadoFiltro = (params.estado ?? "").trim();
  const vistaHistorico = params.vista === "historico";
  const gestiona = usuario.rol === RolUsuario.DIRECTOR || usuario.rol === RolUsuario.ADMINISTRADOR;

  const cotizaciones = await prisma.cotizacion.findMany({
    where: {
      estado: vistaHistorico ? EstadoCotizacion.CANCELADA : EstadoCotizacion.AUTORIZADA,
      ...(q ? { OR: [
        { folio: { contains: q, mode: "insensitive" } },
        { cliente: { nombre: { contains: q, mode: "insensitive" } } },
        { inmueble: { alias: { contains: q, mode: "insensitive" } } },
      ] } : {}),
    },
    select: {
      id: true, folio: true, total: true, montoPagado: true, excepcionApertura: true, excepcionInicio: true, actualizadoEn: true,
      cliente: { select: { nombre: true, tipo: true } },
      inmueble: { select: { alias: true, superficieTerrenoM2: true, superficieConstruccionM2: true } },
      paquete: { select: { nombre: true } },
      inspeccion: { select: { id: true, folio: true, fechaProgramada: true, estado: true } },
    },
    orderBy: { creadoEn: "desc" },
  });

  const ids = cotizaciones.map((c) => c.id);
  const eventosCierre = vistaHistorico && ids.length > 0
    ? await prisma.eventoAuditoria.findMany({
        where: {
          entidad: "Cotizacion",
          entidadId: { in: ids },
          descripcion: { contains: "cerró", mode: "insensitive" },
        },
        select: {
          entidadId: true,
          descripcion: true,
          creadoEn: true,
          usuario: { select: { nombre: true, rol: true } },
        },
        orderBy: { creadoEn: "desc" },
      })
    : [];

  const cierrePorCotizacion = new Map<string, (typeof eventosCierre)[number]>();
  for (const evento of eventosCierre) {
    if (evento.entidadId && !cierrePorCotizacion.has(evento.entidadId)) cierrePorCotizacion.set(evento.entidadId, evento);
  }

  const filas = cotizaciones.map((c) => ({
    c,
    financiero: calcularResumenFinancieroCaja({
      importe: Number(c.total), pagado: Number(c.montoPagado), excepcionApertura: c.excepcionApertura,
      excepcionInicio: c.excepcionInicio, tieneInspeccion: Boolean(c.inspeccion), fechaAgendada: c.inspeccion?.fechaProgramada ?? null,
    }),
    cierre: cierrePorCotizacion.get(c.id),
  })).filter(({ financiero }) => vistaHistorico || !estadoFiltro || financiero.estadoOperativo === estadoFiltro);

  const queryComun = q ? `&q=${encodeURIComponent(q)}` : "";

  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6"><div className="mx-auto max-w-[1800px]">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div>
      <p className="text-sm font-black uppercase tracking-[0.28em] text-amber-300">Base formal autorizada</p>
      <h1 className="mt-2 text-4xl font-black">Cotizaciones</h1>
      <p className="mt-3 max-w-4xl text-slate-400">Las cotizaciones activas continúan el proceso operativo. Las canceladas se conservan como histórico con causa, responsable, fecha y situación financiera; nunca se borran.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/panel/cotizaciones?vista=activas${queryComun}`} className={`rounded-full px-4 py-2 text-sm font-black ${!vistaHistorico ? "bg-cyan-300 text-slate-950" : "border border-white/15 text-slate-300"}`}>Activas</Link>
        <Link href={`/panel/cotizaciones?vista=historico${queryComun}`} className={`rounded-full px-4 py-2 text-sm font-black ${vistaHistorico ? "bg-rose-300 text-slate-950" : "border border-white/15 text-slate-300"}`}>Histórico canceladas</Link>
      </div>
    </div><form className="grid gap-2 sm:grid-cols-[minmax(260px,1fr)_210px_auto]">
      <input type="hidden" name="vista" value={vistaHistorico ? "historico" : "activas"}/>
      <input name="q" defaultValue={q} placeholder="Buscar folio, cliente o inmueble" className="rounded-full border border-white/10 bg-slate-900 px-5 py-3"/>
      {!vistaHistorico ? <select name="estado" defaultValue={estadoFiltro} className="rounded-full border border-white/10 bg-slate-900 px-5 py-3"><option value="">Todos los estados</option><option value="SIN_AGENDAR">Sin agendar</option><option value="AGENDADA">Agendada</option><option value="SIN_LIBERAR">Sin liberar</option><option value="LIBERADA">Liberada</option></select> : <div className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm text-slate-400">Estado: CANCELADA</div>}
      <button className="rounded-full border border-white/15 px-5 py-3 font-black">Buscar / filtrar</button>
    </form></div>

    {(params.ok || params.error) && <p className={`mt-6 rounded-2xl border p-4 font-bold ${params.error ? "border-rose-400/20 bg-rose-400/10 text-rose-300" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"}`}>{params.error ?? params.ok}</p>}

    <div className="mt-8 overflow-x-auto rounded-3xl border border-white/10 bg-slate-900/70"><table className="min-w-[1800px] w-full border-collapse text-left">
      <thead className="sticky top-0 z-20 bg-slate-900"><tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
        <th className="px-3 py-4">Folio</th><th className="px-3 py-4">Servicio contratado</th><th className="px-3 py-4">Tipo de cliente</th><th className="px-3 py-4">Nombre de cliente</th><th className="px-3 py-4">Alias inmueble</th><th className="px-3 py-4">M2 terreno</th><th className="px-3 py-4">M2 construcción</th><th className="px-3 py-4 text-right">Importe</th><th className="px-3 py-4">Ver cotización (PDF)</th><th className="px-3 py-4">{vistaHistorico ? "Situación financiera" : "Estatus cliente"}</th><th className="px-3 py-4">{vistaHistorico ? "Cierre / histórico" : "Gestión"}</th>
      </tr></thead><tbody>{filas.map(({ c, financiero, cierre }) => <tr key={c.id} className="border-t border-white/5 align-top hover:bg-white/[0.025]">
        <td className="px-3 py-4 font-mono text-xs font-black text-cyan-300">{c.folio}</td>
        <td className="px-3 py-4">{c.paquete?.nombre ?? "Servicio de inspección"}</td>
        <td className="px-3 py-4">{c.cliente.tipo.replaceAll("_", " ")}</td>
        <td className="px-3 py-4 font-bold">{c.cliente.nombre}</td>
        <td className="px-3 py-4">{c.inmueble?.alias ?? "—"}</td>
        <td className="px-3 py-4">{c.inmueble?.superficieTerrenoM2 ? Number(c.inmueble.superficieTerrenoM2).toLocaleString("es-MX") : "—"}</td>
        <td className="px-3 py-4">{c.inmueble?.superficieConstruccionM2 ? Number(c.inmueble.superficieConstruccionM2).toLocaleString("es-MX") : "—"}</td>
        <td className="px-3 py-4 text-right font-black">{dinero(c.total)}</td>
        <td className="px-3 py-4"><a href={`/api/cotizaciones/${c.id}/pdf`} target="_blank" rel="noreferrer" className="font-black text-cyan-300">Ver PDF</a></td>
        <td className="px-3 py-4">{vistaHistorico ? <><span className="rounded-full bg-rose-400/10 px-3 py-2 text-xs font-black text-rose-300">CANCELADA</span><p className="mt-2 text-[11px] text-slate-500">Pagado {dinero(financiero.pagado)} · saldo registrado {dinero(financiero.saldo)}</p></> : <><span className="rounded-full bg-white/5 px-3 py-2 text-xs font-black">{financiero.estadoOperativo.replaceAll("_", " ")}</span><p className="mt-2 text-[11px] text-slate-500">Caja: {financiero.porcentajePagado.toFixed(0)}% pagado · saldo {dinero(financiero.saldo)}</p></>}</td>
        <td className="px-3 py-4">{vistaHistorico ? <div className="min-w-[360px] rounded-2xl border border-rose-300/15 bg-rose-300/5 p-3 text-xs"><p className="font-black text-rose-300">{causaCierre(cierre?.descripcion)}</p><p className="mt-2 text-slate-300">{motivoCierre(cierre?.descripcion)}</p><p className="mt-2 text-slate-500">Fecha: {fecha(cierre?.creadoEn ?? c.actualizadoEn)}</p><p className="mt-1 text-slate-500">Responsable: {cierre?.usuario ? `${cierre.usuario.nombre} · ${cierre.usuario.rol}` : "Consultar Auditoría"}</p>{c.inspeccion && <p className="mt-1 text-slate-500">Inspección: {c.inspeccion.folio} · {c.inspeccion.estado.replaceAll("_", " ")}</p>}</div> : gestiona ? <div className="min-w-[390px] space-y-3">
          <details className="rounded-2xl border border-amber-300/15 bg-amber-300/5 p-3"><summary className="cursor-pointer font-black text-amber-300">Corregir / ajustar</summary><form action={regresarAPrecotizacion} className="mt-3 flex gap-2"><input type="hidden" name="id" value={c.id}/><input name="motivo" required placeholder="Dato o valor que requiere ajuste" className="min-w-0 flex-1 rounded-xl bg-slate-950 px-3 py-2 text-xs"/><button className="rounded-xl border border-amber-300/30 px-3 text-xs font-black text-amber-300">Enviar a Pre-cotización</button></form><p className="mt-2 text-[11px] leading-5 text-slate-500">Conserva pagos, agenda, inspección, inspector y antecedentes. La nueva versión requiere aceptación del cliente y autorización interna.</p></details>
          <details className="rounded-2xl border border-rose-300/15 bg-rose-300/5 p-3"><summary className="cursor-pointer font-black text-rose-300">Cancelar / cerrar</summary><form action={cancelarCotizacion} className="mt-3 grid gap-2"><input type="hidden" name="id" value={c.id}/><select name="tipoCierre" required defaultValue="" className="rounded-xl bg-slate-950 px-3 py-2 text-xs"><option value="" disabled>Selecciona causa de cierre</option><option value="CANCELACION_CLIENTE">Cancelación del cliente</option><option value="SIN_RESPUESTA_CLIENTE">Falta de respuesta del cliente</option></select><input name="motivo" required placeholder="Motivo o antecedente documentado" className="rounded-xl bg-slate-950 px-3 py-2 text-xs"/><button className="rounded-xl border border-rose-300/30 px-3 py-2 text-xs font-black text-rose-300">Cerrar cotización</button></form><p className="mt-2 text-[11px] leading-5 text-slate-500">No regresa a Pre-cotizaciones. Conserva historial y pagos. Si existe una inspección programada se cancela sin borrarse; si ya inició, el cierre simple queda bloqueado.</p></details>
        </div> : <span className="text-xs text-slate-500">Solo lectura</span>}</td>
      </tr>)}</tbody>
    </table>{filas.length === 0 && <div className="p-10 text-center text-slate-400">{vistaHistorico ? "No hay cotizaciones canceladas con esos filtros." : "No hay cotizaciones activas con esos filtros."}</div>}</div>
  </div></main>;
}
