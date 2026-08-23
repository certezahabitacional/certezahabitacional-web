import Link from "next/link";
import {
  EstadoCotizacion,
} from "@prisma/client";

import {
  obtenerClienteActual,
} from "@/lib/cliente-actual";
import { prisma } from "@/lib/prisma";

function dinero(valor: unknown) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number(valor ?? 0));
}

function fecha(valor: Date | null) {
  if (!valor) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(valor);
}

export default async function PortalPage() {
  const cliente = await obtenerClienteActual();

  const [
    inspecciones,
    inmuebles,
    certificados,
    cotizaciones,
    cotizacionesPendientes,
    recientes,
    cotizacionesRecientes,
  ] = await Promise.all([
    prisma.inspeccion.count({
      where: {
        clienteId: cliente.id,
      },
    }),

    prisma.inmueble.count({
      where: {
        clienteId: cliente.id,
      },
    }),

    prisma.certificado.count({
      where: {
        inspeccion: {
          clienteId: cliente.id,
        },
      },
    }),

    prisma.cotizacion.count({
      where: {
        clienteId: cliente.id,
      },
    }),

    prisma.cotizacion.count({
      where: {
        clienteId: cliente.id,
        estado: EstadoCotizacion.ENVIADA,
      },
    }),

    prisma.inspeccion.findMany({
      where: {
        clienteId: cliente.id,
      },
      include: {
        certificado: true,
      },
      orderBy: {
        actualizadoEn: "desc",
      },
      take: 5,
    }),

    prisma.cotizacion.findMany({
      where: {
        clienteId: cliente.id,

        estado: {
          in: [
            EstadoCotizacion.ENVIADA,
            EstadoCotizacion.ACEPTADA,
            EstadoCotizacion.RECHAZADA,
          ],
        },
      },

      include: {
        inmueble: {
          select: {
            alias: true,
            direccion: true,
          },
        },

        paquete: {
          select: {
            nombre: true,
          },
        },
      },

      orderBy: {
        actualizadoEn: "desc",
      },

      take: 5,
    }),
  ]);

  return (
    <main className="px-6 py-10">
      <div className="mx-auto max-w-7xl">
        {/* BIENVENIDA */}
        <section className="rounded-[2rem] bg-cyan-300 p-8 text-slate-950">
          <p className="text-sm font-black uppercase tracking-[0.25em]">
            Bienvenido
          </p>

          <h1 className="mt-3 text-4xl font-black">
            {cliente.nombre}
          </h1>

          <p className="mt-3 max-w-2xl text-slate-800">
            Consulta tus cotizaciones,
            inspecciones, reportes,
            certificados e inmuebles
            registrados.
          </p>
        </section>

        {/* MÉTRICAS */}
        <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Metrica
            titulo="Cotizaciones"
            valor={cotizaciones}
          />

          <Metrica
            titulo="Inspecciones"
            valor={inspecciones}
          />

          <Metrica
            titulo="Inmuebles"
            valor={inmuebles}
          />

          <Metrica
            titulo="Certificados"
            valor={certificados}
          />
        </section>

        {/* COTIZACIONES PENDIENTES */}
        {cotizacionesPendientes > 0 && (
          <section className="mt-8 rounded-3xl border border-amber-300/20 bg-amber-300/5 p-6">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-300">
                  Acción requerida
                </p>

                <h2 className="mt-2 text-xl font-black">
                  Tienes{" "}
                  {cotizacionesPendientes}{" "}
                  cotización
                  {cotizacionesPendientes === 1
                    ? ""
                    : "es"}{" "}
                  pendiente
                  {cotizacionesPendientes === 1
                    ? ""
                    : "s"}{" "}
                  de revisión
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  Revisa el servicio, importe,
                  inmueble y condiciones antes
                  de aceptar o rechazar.
                </p>
              </div>

              <Link
                href="/portal/cotizaciones"
                className="rounded-full bg-amber-300 px-5 py-3 text-center text-sm font-black text-slate-950"
              >
                Revisar cotizaciones
              </Link>
            </div>
          </section>
        )}

        {/* COTIZACIONES RECIENTES */}
        <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
          <header className="flex flex-col justify-between gap-4 border-b border-white/10 p-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-black">
                Mis cotizaciones
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Cotizaciones enviadas y
                respuestas recientes.
              </p>
            </div>

            <Link
              href="/portal/cotizaciones"
              className="text-sm font-bold text-cyan-300"
            >
              Ver todas →
            </Link>
          </header>

          {cotizacionesRecientes.length === 0 ? (
            <p className="p-10 text-center text-slate-500">
              Todavía no tienes cotizaciones
              disponibles.
            </p>
          ) : (
            <div className="divide-y divide-white/10">
              {cotizacionesRecientes.map(
                (cotizacion) => (
                  <Link
                    key={cotizacion.id}
                    href={`/portal/cotizaciones/${cotizacion.id}`}
                    className="grid gap-4 p-6 transition hover:bg-white/[0.03] md:grid-cols-[1fr_1fr_auto]"
                  >
                    <div>
                      <p className="font-black text-cyan-300">
                        {cotizacion.folio}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {cotizacion.inmueble
                          ? `${cotizacion.inmueble.alias} — ${cotizacion.inmueble.direccion}`
                          : "Sin inmueble asociado"}
                      </p>
                    </div>

                    <div>
                      <p className="font-bold">
                        {cotizacion.paquete
                          ?.nombre ??
                          "Servicio de inspección"}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Estado:{" "}
                        {cotizacion.estado.replaceAll(
                          "_",
                          " ",
                        )}
                      </p>

                      <p className="mt-1 text-xs text-slate-600">
                        Vigencia:{" "}
                        {fecha(
                          cotizacion.vigenciaHasta,
                        )}
                      </p>
                    </div>

                    <div className="md:text-right">
                      <p className="text-xl font-black text-cyan-300">
                        {dinero(
                          cotizacion.total,
                        )}
                      </p>

                      {cotizacion.estado ===
                        EstadoCotizacion.ENVIADA && (
                        <p className="mt-1 text-xs font-black text-amber-300">
                          Requiere tu respuesta
                        </p>
                      )}

                      {cotizacion.estado ===
                        EstadoCotizacion.ACEPTADA && (
                        <p className="mt-1 text-xs font-black text-emerald-300">
                          Aceptada
                        </p>
                      )}

                      {cotizacion.estado ===
                        EstadoCotizacion.RECHAZADA && (
                        <p className="mt-1 text-xs font-black text-rose-300">
                          Rechazada
                        </p>
                      )}
                    </div>
                  </Link>
                ),
              )}
            </div>
          )}
        </section>

        {/* INSPECCIONES RECIENTES */}
        <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
          <header className="flex items-center justify-between border-b border-white/10 p-6">
            <div>
              <h2 className="text-xl font-black">
                Actividad reciente
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Tus últimas inspecciones
                actualizadas.
              </p>
            </div>

            <Link
              href="/portal/inspecciones"
              className="text-sm font-bold text-cyan-300"
            >
              Ver todas →
            </Link>
          </header>

          {recientes.length === 0 ? (
            <p className="p-10 text-center text-slate-500">
              Todavía no tienes inspecciones
              registradas.
            </p>
          ) : (
            <div className="divide-y divide-white/10">
              {recientes.map((inspeccion) => (
                <Link
                  key={inspeccion.id}
                  href={`/portal/inspecciones/${inspeccion.id}`}
                  className="grid gap-4 p-6 transition hover:bg-white/[0.03] md:grid-cols-[1fr_1fr_auto]"
                >
                  <div>
                    <p className="font-black text-cyan-300">
                      {inspeccion.folio}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {inspeccion.direccion}
                    </p>
                  </div>

                  <div>
                    <p className="font-bold">
                      {inspeccion.tipoServicio}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {inspeccion.estado.replaceAll(
                        "_",
                        " ",
                      )}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-black">
                      {inspeccion.ish !== null
                        ? `${Math.round(
                            Number(
                              inspeccion.ish,
                            ),
                          )}/100`
                        : "Sin evaluar"}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {inspeccion.certificado
                        ? "Certificado disponible"
                        : "Sin certificado"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Metrica({
  titulo,
  valor,
}: {
  titulo: string;
  valor: number;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-slate-900 p-6">
      <p className="text-sm font-bold text-slate-400">
        {titulo}
      </p>

      <p className="mt-4 text-4xl font-black text-cyan-300">
        {String(valor).padStart(2, "0")}
      </p>
    </article>
  );
}