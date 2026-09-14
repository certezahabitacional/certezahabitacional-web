import { EstadoCotizacion, RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  aceptarEnRepresentacionDelCliente,
  autorizarCotizacionAceptada,
  marcarListaParaCliente,
} from "../cotizaciones/actions-flujo-aprobado";

function dinero(valor: unknown) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number(valor ?? 0));
}

function tipoCliente(tipo: string) {
  return tipo.replaceAll("_", " ");
}

function estadoCliente(estado: EstadoCotizacion) {
  if (estado === EstadoCotizacion.ACEPTADA) return "ACEPTADA";
  if (estado === EstadoCotizacion.ENVIADA) return "POR ACEPTAR";
  return "BORRADOR";
}

function estadoCerteza(estado: EstadoCotizacion) {
  if (estado === EstadoCotizacion.BORRADOR) return "POR ENVIAR";
  if (estado === EstadoCotizacion.ENVIADA) return "POR AUTORIZAR";
  if (estado === EstadoCotizacion.ACEPTADA) return "POR AUTORIZAR";
  return estado.replaceAll("_", " ");
}

export default async function PreCotizacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; ok?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { rol: true, activo: true },
  });

  const puedeEntrar =
    usuario?.rol === RolUsuario.DIRECTOR ||
    usuario?.rol === RolUsuario.ADMINISTRADOR ||
    usuario?.rol === RolUsuario.VENDEDOR;

  if (!usuario?.activo || !puedeEntrar) redirect("/acceso");

  const params = await searchParams;
  const busqueda = (params.q ?? "").trim();
  const filtroEstado = (params.estado ?? "").trim();
  const gestiona = usuario.rol === RolUsuario.DIRECTOR || usuario.rol === RolUsuario.ADMINISTRADOR;
  const ahora = new Date();

  await prisma.cotizacion.updateMany({
    where: {
      estado: { in: [EstadoCotizacion.BORRADOR, EstadoCotizacion.ENVIADA, EstadoCotizacion.ACEPTADA] },
      vigenciaHasta: { lt: ahora },
    },
    data: { estado: EstadoCotizacion.VENCIDA, editablePublica: false },
  });

  const estadosActivos = [EstadoCotizacion.BORRADOR, EstadoCotizacion.ENVIADA, EstadoCotizacion.ACEPTADA];

  const precotizaciones = await prisma.cotizacion.findMany({
    where: {
      estado: { in: estadosActivos },
      ...(filtroEstado ? { estado: filtroEstado as EstadoCotizacion } : {}),
      ...(busqueda
        ? {
            OR: [
              { folio: { contains: busqueda, mode: "insensitive" } },
              { cliente: { nombre: { contains: busqueda, mode: "insensitive" } } },
              { inmueble: { alias: { contains: busqueda, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      folio: true,
      estado: true,
      total: true,
      vigenciaHasta: true,
      versionActual: true,
      cliente: { select: { tipo: true, nombre: true } },
      inmueble: {
        select: {
          alias: true,
          superficieTerrenoM2: true,
          superficieConstruccionM2: true,
        },
      },
      paquete: { select: { nombre: true } },
      versiones: {
        orderBy: { version: "desc" },
        take: 1,
        select: { id: true, version: true },
      },
    },
    orderBy: [{ creadoEn: "desc" }, { folio: "desc" }],
  });

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-[1700px]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-amber-300">Base temporal comercial</p>
            <h1 className="mt-2 text-4xl font-black">Pre-cotizaciones</h1>
            <p className="mt-3 max-w-4xl text-slate-400">
              Solicitudes provenientes de la página pública o cotizaciones regresadas temporalmente para corrección. Permanecen aquí hasta su vencimiento o hasta completar aceptación y autorización.
            </p>
          </div>

          <form className="grid gap-2 sm:grid-cols-[minmax(260px,1fr)_220px_auto]">
            <input name="q" defaultValue={busqueda} placeholder="Buscar folio, cliente o inmueble" className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm" />
            <select name="estado" defaultValue={filtroEstado} className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm">
              <option value="">Todos los estados</option>
              <option value={EstadoCotizacion.BORRADOR}>Borrador</option>
              <option value={EstadoCotizacion.ENVIADA}>Por aceptar</option>
              <option value={EstadoCotizacion.ACEPTADA}>Por autorizar</option>
            </select>
            <button className="rounded-full border border-white/15 px-5 py-3 text-sm font-black">Buscar / filtrar</button>
          </form>
        </div>

        {(params.ok || params.error) && (
          <p className={`mt-6 rounded-2xl border p-4 font-bold ${params.error ? "border-rose-400/20 bg-rose-400/10 text-rose-300" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"}`}>{params.error ?? params.ok}</p>
        )}

        <div className="mt-8 overflow-x-auto rounded-3xl border border-white/10 bg-slate-900/70">
          <table className="min-w-[1750px] w-full border-collapse text-left">
            <thead className="sticky top-0 z-20 bg-slate-900 shadow-[0_1px_0_rgba(255,255,255,0.08)]">
              <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-4 py-4">Folio</th><th className="px-4 py-4">Servicio contratado</th><th className="px-4 py-4">Tipo de cliente</th><th className="px-4 py-4">Nombre de cliente</th><th className="px-4 py-4">Alias inmueble</th><th className="px-4 py-4 text-right">M2 terreno</th><th className="px-4 py-4 text-right">M2 construcción</th><th className="px-4 py-4 text-right">Importe</th><th className="px-4 py-4">Ver pre-cotización</th><th className="px-4 py-4">Editar pre-cotización</th><th className="px-4 py-4">Estatus cliente</th><th className="px-4 py-4">Estatus Certeza</th>
              </tr>
            </thead>
            <tbody>
              {precotizaciones.map((c) => {
                const versionConsistente = c.versiones[0]?.version === c.versionActual;
                return (
                  <tr key={c.id} className="border-t border-white/5 align-top hover:bg-white/[0.025]">
                    <td className="px-4 py-4 font-mono text-xs font-black text-cyan-300">{c.folio}<div className="mt-1 text-[10px] text-slate-500">V{c.versionActual}</div></td>
                    <td className="px-4 py-4">{c.paquete?.nombre ?? "Inspección residencial"}</td>
                    <td className="px-4 py-4">{tipoCliente(c.cliente.tipo)}</td>
                    <td className="px-4 py-4 font-bold">{c.cliente.nombre}</td>
                    <td className="px-4 py-4">{c.inmueble?.alias ?? "Por definir"}</td>
                    <td className="px-4 py-4 text-right">{c.inmueble?.superficieTerrenoM2?.toString() ?? "—"}</td>
                    <td className="px-4 py-4 text-right">{c.inmueble?.superficieConstruccionM2?.toString() ?? "—"}</td>
                    <td className="px-4 py-4 text-right font-black">{dinero(c.total)}</td>
                    <td className="px-4 py-4"><a href={`/api/cotizaciones/${c.id}/pdf`} target="_blank" rel="noreferrer" className="text-cyan-300 underline underline-offset-4">Ver PDF</a></td>
                    <td className="px-4 py-4">{gestiona ? <a href={`/panel/pre-cotizaciones/${c.id}/editar`} className="text-amber-300 underline underline-offset-4">Editar</a> : <span className="text-slate-500">Solo lectura</span>}</td>
                    <td className="px-4 py-4 font-black">{estadoCliente(c.estado)}</td>
                    <td className="px-4 py-4">
                      {c.estado === EstadoCotizacion.BORRADOR && gestiona ? (
                        <form action={marcarListaParaCliente} className="min-w-[290px]">
                          <input type="hidden" name="id" value={c.id} />
                          <button disabled={!versionConsistente} className="rounded-xl bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">Enviar V{c.versionActual} al cliente</button>
                          {!versionConsistente && <p className="mt-2 text-[11px] text-rose-300">Versión documental inconsistente. Requiere revisión.</p>}
                        </form>
                      ) : c.estado === EstadoCotizacion.ENVIADA && gestiona ? (
                        <form action={aceptarEnRepresentacionDelCliente} className="flex min-w-[360px] gap-2">
                          <input type="hidden" name="id" value={c.id} />
                          <input name="motivo" required placeholder="Motivo aceptación por excepción" className="min-w-0 flex-1 rounded-xl bg-slate-950 px-3 py-2 text-xs" />
                          <button className="rounded-xl border border-amber-300/30 px-3 text-xs font-black text-amber-300">Aceptar excepción</button>
                        </form>
                      ) : c.estado === EstadoCotizacion.ACEPTADA && gestiona ? (
                        <form action={autorizarCotizacionAceptada}><input type="hidden" name="id" value={c.id} /><button className="rounded-xl bg-emerald-300 px-4 py-2 text-xs font-black text-slate-950">Autorizar V{c.versionActual}</button></form>
                      ) : (
                        <span className="font-black text-slate-300">{estadoCerteza(c.estado)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {precotizaciones.length === 0 && <div className="p-10 text-center text-slate-400">No hay pre-cotizaciones activas con esos filtros.</div>}
        </div>
      </div>
    </main>
  );
}
