import { EstadoCotizacion, RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { calcularResumenFinancieroCaja } from "@/lib/caja-finanzas";
import { prisma } from "@/lib/prisma";
import { regresarAPrecotizacion } from "./actions-flujo-aprobado";

function dinero(valor: unknown) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(Number(valor ?? 0));
}

export default async function CotizacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; ok?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const usuario = await prisma.usuario.findUnique({ where: { id: session.user.id }, select: { rol: true, activo: true } });
  const puedeEntrar = usuario?.rol === RolUsuario.DIRECTOR || usuario?.rol === RolUsuario.ADMINISTRADOR || usuario?.rol === RolUsuario.VENDEDOR;
  if (!usuario?.activo || !puedeEntrar) redirect("/acceso");

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const estadoFiltro = (params.estado ?? "").trim();
  const gestiona = usuario.rol === RolUsuario.DIRECTOR || usuario.rol === RolUsuario.ADMINISTRADOR;

  const cotizaciones = await prisma.cotizacion.findMany({
    where: {
      estado: EstadoCotizacion.AUTORIZADA,
      ...(q ? { OR: [
        { folio: { contains: q, mode: "insensitive" } },
        { cliente: { nombre: { contains: q, mode: "insensitive" } } },
        { inmueble: { alias: { contains: q, mode: "insensitive" } } },
      ] } : {}),
    },
    select: {
      id: true, folio: true, total: true, montoPagado: true, excepcionApertura: true, excepcionInicio: true,
      cliente: { select: { nombre: true, tipo: true } },
      inmueble: { select: { alias: true, superficieTerrenoM2: true, superficieConstruccionM2: true } },
      paquete: { select: { nombre: true } },
      inspeccion: { select: { id: true, fechaProgramada: true } },
      versiones: { orderBy: { version: "desc" }, take: 1, select: { archivoUrl: true } },
    },
    orderBy: { creadoEn: "desc" },
  });

  const filas = cotizaciones.map((c) => ({
    c,
    financiero: calcularResumenFinancieroCaja({
      importe: Number(c.total), pagado: Number(c.montoPagado), excepcionApertura: c.excepcionApertura,
      excepcionInicio: c.excepcionInicio, tieneInspeccion: Boolean(c.inspeccion), fechaAgendada: c.inspeccion?.fechaProgramada ?? null,
    }),
  })).filter(({ financiero }) => !estadoFiltro || financiero.estadoOperativo === estadoFiltro);

  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6"><div className="mx-auto max-w-[1700px]">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div>
      <p className="text-sm font-black uppercase tracking-[0.28em] text-amber-300">Base formal autorizada</p>
      <h1 className="mt-2 text-4xl font-black">Cotizaciones</h1>
      <p className="mt-3 max-w-4xl text-slate-400">Solo cotizaciones aceptadas y autorizadas. El estado operativo se obtiene de Caja; Vendedor tiene consulta únicamente.</p>
    </div><form className="grid gap-2 sm:grid-cols-[minmax(260px,1fr)_210px_auto]">
      <input name="q" defaultValue={q} placeholder="Buscar folio, cliente o inmueble" className="rounded-full border border-white/10 bg-slate-900 px-5 py-3"/>
      <select name="estado" defaultValue={estadoFiltro} className="rounded-full border border-white/10 bg-slate-900 px-5 py-3"><option value="">Todos los estados</option><option value="SIN_AGENDAR">Sin agendar</option><option value="AGENDADA">Agendada</option><option value="SIN_LIBERAR">Sin liberar</option><option value="LIBERADA">Liberada</option></select>
      <button className="rounded-full border border-white/15 px-5 py-3 font-black">Buscar / filtrar</button>
    </form></div>

    {(params.ok || params.error) && <p className={`mt-6 rounded-2xl border p-4 font-bold ${params.error ? "border-rose-400/20 bg-rose-400/10 text-rose-300" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"}`}>{params.error ?? params.ok}</p>}

    <div className="mt-8 overflow-x-auto rounded-3xl border border-white/10 bg-slate-900/70"><table className="min-w-[1700px] w-full border-collapse text-left">
      <thead className="sticky top-0 z-20 bg-slate-900"><tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
        <th className="px-3 py-4">Folio</th><th className="px-3 py-4">Servicio contratado</th><th className="px-3 py-4">Tipo de cliente</th><th className="px-3 py-4">Nombre de cliente</th><th className="px-3 py-4">Alias inmueble</th><th className="px-3 py-4">M2 terreno</th><th className="px-3 py-4">M2 construcción</th><th className="px-3 py-4 text-right">Importe</th><th className="px-3 py-4">Ver cotización (PDF)</th><th className="px-3 py-4">Estatus cliente</th><th className="px-3 py-4">Regresar a pre-cotización</th>
      </tr></thead><tbody>{filas.map(({ c, financiero }) => <tr key={c.id} className="border-t border-white/5 align-top hover:bg-white/[0.025]">
        <td className="px-3 py-4 font-mono text-xs font-black text-cyan-300">{c.folio}</td>
        <td className="px-3 py-4">{c.paquete?.nombre ?? "Servicio de inspección"}</td>
        <td className="px-3 py-4">{c.cliente.tipo.replaceAll("_", " ")}</td>
        <td className="px-3 py-4 font-bold">{c.cliente.nombre}</td>
        <td className="px-3 py-4">{c.inmueble?.alias ?? "—"}</td>
        <td className="px-3 py-4">{c.inmueble?.superficieTerrenoM2 ? Number(c.inmueble.superficieTerrenoM2).toLocaleString("es-MX") : "—"}</td>
        <td className="px-3 py-4">{c.inmueble?.superficieConstruccionM2 ? Number(c.inmueble.superficieConstruccionM2).toLocaleString("es-MX") : "—"}</td>
        <td className="px-3 py-4 text-right font-black">{dinero(c.total)}</td>
        <td className="px-3 py-4">{c.versiones[0]?.archivoUrl ? <a href={c.versiones[0].archivoUrl} target="_blank" rel="noreferrer" className="font-black text-cyan-300">Ver PDF</a> : <span className="text-slate-500">Sin PDF</span>}</td>
        <td className="px-3 py-4"><span className="rounded-full bg-white/5 px-3 py-2 text-xs font-black">{financiero.estadoOperativo.replaceAll("_", " ")}</span><p className="mt-2 text-[11px] text-slate-500">Caja: {financiero.porcentajePagado.toFixed(0)}% pagado · saldo {dinero(financiero.saldo)}</p></td>
        <td className="px-3 py-4">{gestiona ? <details><summary className="cursor-pointer font-black text-amber-300">Regresar</summary><form action={regresarAPrecotizacion} className="mt-3 flex w-[360px] gap-2"><input type="hidden" name="id" value={c.id}/><input name="motivo" required placeholder="Motivo de la corrección" className="min-w-0 flex-1 rounded-xl bg-slate-950 px-3 py-2"/><button className="rounded-xl border border-amber-300/30 px-3 font-black text-amber-300">Confirmar</button></form><p className="mt-2 w-[360px] text-[11px] text-slate-500">No elimina pagos, agenda, inspección, inspector ni antecedentes. Exigirá nueva aceptación y autorización.</p></details> : <span className="text-xs text-slate-500">Solo lectura</span>}</td>
      </tr>)}</tbody>
    </table>{filas.length === 0 && <div className="p-10 text-center text-slate-400">No hay cotizaciones con esos filtros.</div>}</div>
  </div></main>;
}
