import { EstadoCotizacion, Prisma, RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { calcularResumenFinancieroCaja } from "@/lib/caja-finanzas";
import { prisma } from "@/lib/prisma";

function dinero(valor: number) {
  return valor.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function fecha(valor: Date) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(valor);
}

function vendedorDesdeJson(datos: Prisma.JsonValue | null) {
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) return null;
  const vendedor = (datos as Prisma.JsonObject).vendedor;
  if (!vendedor || typeof vendedor !== "object" || Array.isArray(vendedor)) return null;
  const objeto = vendedor as Prisma.JsonObject;
  return typeof objeto.nombre === "string" ? objeto.nombre : null;
}

function causaCierre(descripcion?: string | null) {
  if (!descripcion) return "Cancelada";
  if (descripcion.includes("FALTA DE RESPUESTA DEL CLIENTE")) return "Falta de respuesta del cliente";
  if (descripcion.includes("CANCELACIÓN DEL CLIENTE")) return "Cancelación del cliente";
  return "Cancelada";
}

export default async function CajaHistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { rol: true, activo: true },
  });

  if (!usuario?.activo || (usuario.rol !== RolUsuario.DIRECTOR && usuario.rol !== RolUsuario.ADMINISTRADOR)) {
    redirect("/acceso");
  }

  const params = await searchParams;
  const q = (params.q ?? "").trim();

  const cotizaciones = await prisma.cotizacion.findMany({
    where: {
      estado: EstadoCotizacion.CANCELADA,
      ...(q
        ? {
            OR: [
              { folio: { contains: q, mode: "insensitive" } },
              { cliente: { nombre: { contains: q, mode: "insensitive" } } },
              { inmueble: { alias: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      folio: true,
      total: true,
      montoPagado: true,
      excepcionApertura: true,
      excepcionInicio: true,
      actualizadoEn: true,
      cliente: { select: { nombre: true } },
      inmueble: { select: { alias: true } },
      inspeccion: {
        select: {
          folio: true,
          numeroInspeccion: true,
          fechaProgramada: true,
          estado: true,
          inspector: { select: { usuario: { select: { nombre: true } } } },
        },
      },
      versiones: {
        orderBy: { version: "desc" },
        take: 1,
        select: { datos: true },
      },
      pagos: {
        select: {
          id: true,
          monto: true,
          fechaPago: true,
          metodoPago: true,
          referencia: true,
          notas: true,
          registradoPor: { select: { nombre: true } },
        },
        orderBy: { fechaPago: "desc" },
      },
    },
    orderBy: [{ actualizadoEn: "desc" }, { folio: "desc" }],
  });

  const ids = cotizaciones.map((c) => c.id);
  const cierres = ids.length
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

  const cierrePorCotizacion = new Map<string, (typeof cierres)[number]>();
  for (const cierre of cierres) {
    if (cierre.entidadId && !cierrePorCotizacion.has(cierre.entidadId)) cierrePorCotizacion.set(cierre.entidadId, cierre);
  }

  const filas = cotizaciones.map((c) => ({
    c,
    financiero: calcularResumenFinancieroCaja({
      importe: Number(c.total),
      pagado: Number(c.montoPagado),
      excepcionApertura: c.excepcionApertura,
      excepcionInicio: c.excepcionInicio,
      tieneInspeccion: Boolean(c.inspeccion),
      fechaAgendada: c.inspeccion?.fechaProgramada ?? null,
    }),
    vendedor: vendedorDesdeJson(c.versiones[0]?.datos ?? null) ?? "Por asignar",
    inspector: c.inspeccion?.inspector?.usuario.nombre ?? "Por asignar",
    cierre: cierrePorCotizacion.get(c.id),
  }));

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-rose-300">Histórico financiero</p>
            <h1 className="mt-2 text-4xl font-black">Caja · canceladas</h1>
            <p className="mt-3 max-w-4xl text-slate-400">
              Consulta financiera de cotizaciones cerradas. Los pagos y antecedentes se conservan, pero aquí no se permiten nuevos pagos ni excepciones.
            </p>
            <a href="/panel/caja" className="mt-4 inline-block rounded-full border border-cyan-300/30 px-4 py-2 text-sm font-black text-cyan-300">← Volver a Caja activa</a>
          </div>

          <form className="flex gap-2">
            <input name="q" defaultValue={q} placeholder="Buscar folio, cliente o inmueble" className="min-w-[320px] rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm" />
            <button className="rounded-full border border-white/15 px-5 py-3 text-sm font-black">Buscar</button>
          </form>
        </div>

        <div className="mt-8 overflow-x-auto rounded-3xl border border-white/10 bg-slate-900/70">
          <table className="min-w-[1250px] w-full border-collapse text-left">
            <thead className="sticky top-0 z-20 bg-slate-900">
              <tr className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-4 py-4">Folio (cotización)</th>
                <th className="px-4 py-4">Cliente</th>
                <th className="px-4 py-4">Inmueble</th>
                <th className="px-4 py-4 text-right">Importe</th>
                <th className="px-4 py-4 text-right">Pagos</th>
                <th className="px-4 py-4 text-right">Saldo</th>
                <th className="px-4 py-4">Vendedor</th>
                <th className="px-4 py-4">Inspector</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ c, financiero, vendedor, inspector, cierre }) => (
                <tr key={c.id} className="border-t border-white/5 align-top hover:bg-white/[0.025]">
                  <td className="px-4 py-4">
                    <details>
                      <summary className="cursor-pointer list-none">
                        <p className="font-mono text-xs font-black text-cyan-300">{c.folio}</p>
                        <p className="mt-1 text-[11px] font-black text-rose-300">CANCELADA</p>
                      </summary>
                      <div className="mt-4 w-[720px] max-w-[80vw] rounded-2xl border border-rose-300/15 bg-slate-950 p-5">
                        <div className="grid gap-4 md:grid-cols-3">
                          <Dato t="Causa" v={causaCierre(cierre?.descripcion)} />
                          <Dato t="Fecha de cierre" v={fecha(cierre?.creadoEn ?? c.actualizadoEn)} />
                          <Dato t="Responsable" v={cierre?.usuario ? `${cierre.usuario.nombre} · ${cierre.usuario.rol}` : "Consultar Auditoría"} />
                        </div>
                        <div className="mt-5 grid gap-4 border-t border-white/10 pt-5 md:grid-cols-3">
                          <Dato t="Importe" v={dinero(financiero.importe)} />
                          <Dato t="Pagado histórico" v={dinero(financiero.pagado)} />
                          <Dato t="Saldo al cierre" v={dinero(financiero.saldo)} />
                        </div>
                        {c.inspeccion && <p className="mt-4 text-xs text-slate-400">Inspección relacionada: {c.inspeccion.folio} · V{c.inspeccion.numeroInspeccion} · {c.inspeccion.estado.replaceAll("_", " ")}</p>}
                        <div className="mt-5 border-t border-white/10 pt-5">
                          <p className="text-sm font-black text-slate-200">Movimientos preservados</p>
                          <div className="mt-3 space-y-2 text-xs text-slate-400">
                            {c.pagos.map((p) => <p key={p.id}>{fecha(p.fechaPago)} · {dinero(Number(p.monto))} · {p.metodoPago ?? "Sin método"}{p.referencia ? ` · ${p.referencia}` : ""} · {p.registradoPor.nombre}</p>)}
                            {c.pagos.length === 0 && <p>Sin pagos registrados antes del cierre.</p>}
                          </div>
                        </div>
                      </div>
                    </details>
                  </td>
                  <td className="px-4 py-4 font-bold">{c.cliente.nombre}</td>
                  <td className="px-4 py-4">{c.inmueble?.alias ?? "Por definir"}</td>
                  <td className="px-4 py-4 text-right font-black">{dinero(financiero.importe)}</td>
                  <td className="px-4 py-4 text-right text-emerald-300">{dinero(financiero.pagado)}</td>
                  <td className="px-4 py-4 text-right text-amber-300">{dinero(financiero.saldo)}</td>
                  <td className="px-4 py-4">{vendedor}</td>
                  <td className="px-4 py-4">{inspector}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filas.length === 0 && <div className="p-10 text-center text-slate-400">No hay cotizaciones canceladas con esos filtros.</div>}
        </div>
      </div>
    </main>
  );
}

function Dato({ t, v }: { t: string; v: string }) {
  return <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t}</p><p className="mt-1 text-sm font-bold text-slate-200">{v}</p></div>;
}
