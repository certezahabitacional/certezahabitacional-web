import Link from "next/link";

import {
  EsquemaPago,
  EstadoCotizacion,
  EstadoPago,
} from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import NuevaCotizacionForm from "./NuevaCotizacionForm";

import {
  cambiarEstadoCotizacion,
  registrarPagoTotal,
  registrarPrimerPago50,
  registrarSegundoPago50,
} from "./actions";

function dinero(valor: unknown) {
  return new Intl.NumberFormat(
    "es-MX",
    {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
    },
  ).format(Number(valor ?? 0));
}

function fecha(valor: Date | null) {
  if (!valor) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "es-MX",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
  ).format(valor);
}

export default async function CotizacionesPage({
  searchParams,
}: {
  searchParams: Promise<{
    ok?: string;
    error?: string;
  }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const usuarioActual =
    await prisma.usuario.findUnique({
      where: {
        id: session.user.id,
      },
      select: {
        id: true,
        rol: true,
        activo: true,
      },
    });

  if (
    !usuarioActual ||
    !usuarioActual.activo
  ) {
    redirect("/acceso");
  }

  if (
    usuarioActual.rol !== "DIRECTOR" &&
    usuarioActual.rol !== "ADMINISTRADOR" &&
    usuarioActual.rol !== "GERENTE"
  ) {
    redirect("/acceso");
  }

  const esDirector =
    usuarioActual.rol === "DIRECTOR";

  const esAdministrador =
    usuarioActual.rol === "ADMINISTRADOR";

  const esGerente =
    usuarioActual.rol === "GERENTE";

  const puedeGestionarCotizaciones =
    esDirector || esAdministrador;

  /*
   * Gerencia puede consultar la cotización completa en modo
   * solo lectura, incluidos importe, esquema de pago, monto
   * pagado y saldo, para saber si el servicio cumple la
   * condición administrativa necesaria para programarse.
   */
  const puedeVerDatosAdministrativos =
    esDirector ||
    esAdministrador ||
    esGerente;

  const params =
    await searchParams;

  const [
    clientes,
    inmueblesDb,
    paquetesDb,
    cotizaciones,
  ] = await Promise.all([
    prisma.cliente.findMany({
      select: {
        id: true,
        nombre: true,
      },
      orderBy: {
        nombre: "asc",
      },
    }),

    prisma.inmueble.findMany({
      select: {
        id: true,
        clienteId: true,
        alias: true,
        direccion: true,
        superficieConstruccionM2: true,
      },
      orderBy: {
        alias: "asc",
      },
    }),

    prisma.paqueteServicio.findMany({
      where: {
        activo: true,
      },
      orderBy: [
        {
          orden: "asc",
        },
        {
          nombre: "asc",
        },
      ],
    }),

    prisma.cotizacion.findMany({
      include: {
        cliente: {
          select: {
            nombre: true,
          },
        },

        inmueble: {
          select: {
            alias: true,
            direccion: true,
          },
        },

        paquete: {
          select: {
            nombre: true,
            codigo: true,
          },
        },

        creadaPor: {
          select: {
            nombre: true,
          },
        },

        autorizadaPor: {
          select: {
            nombre: true,
          },
        },

        rechazadaPor: {
          select: {
            nombre: true,
          },
        },
      },

      orderBy: {
        creadoEn: "desc",
      },
    }),
  ]);

  const inmuebles =
    inmueblesDb.map(
      (inmueble) => ({
        ...inmueble,

        superficieConstruccionM2:
          inmueble.superficieConstruccionM2 ===
          null
            ? null
            : Number(
                inmueble.superficieConstruccionM2,
              ),
      }),
    );

  const paquetes =
    paquetesDb.map(
      (paquete) => ({
        id: paquete.id,
        nombre: paquete.nombre,
        codigo: paquete.codigo,
        tipoCalculo:
          paquete.tipoCalculo,

        precioBase: Number(
          paquete.precioBase,
        ),

        superficieIncluidaM2:
          paquete.superficieIncluidaM2 ===
          null
            ? null
            : Number(
                paquete.superficieIncluidaM2,
              ),

        precioM2Adicional:
          paquete.precioM2Adicional ===
          null
            ? null
            : Number(
                paquete.precioM2Adicional,
              ),

        superficieMinimaM2:
          paquete.superficieMinimaM2 ===
          null
            ? null
            : Number(
                paquete.superficieMinimaM2,
              ),

        superficieMaximaM2:
          paquete.superficieMaximaM2 ===
          null
            ? null
            : Number(
                paquete.superficieMaximaM2,
              ),
      }),
    );

  const totalCotizaciones =
    cotizaciones.length;

  const totalAceptadas =
    cotizaciones.filter(
      (item) =>
        item.estado ===
        EstadoCotizacion.ACEPTADA,
    ).length;

  const totalPendientes =
    cotizaciones.filter(
      (item) =>
        item.estado ===
          EstadoCotizacion.BORRADOR ||
        item.estado ===
          EstadoCotizacion.PENDIENTE_AUTORIZACION ||
        item.estado ===
          EstadoCotizacion.AUTORIZADA ||
        item.estado ===
          EstadoCotizacion.ENVIADA,
    ).length;

  const valorCotizado =
    cotizaciones.reduce(
      (total, item) =>
        total +
        Number(item.total),
      0,
    );

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <Link
              href="/panel"
              className="text-sm font-black text-cyan-300 transition hover:text-cyan-200"
            >
              ← Volver al panel
            </Link>

            <p className="mt-7 text-sm font-black uppercase tracking-[0.3em] text-amber-300">
              CertezaHabitacional v2.0
            </p>

            <h1 className="mt-3 text-4xl font-black">
              Cotizaciones
            </h1>

            <p className="mt-3 max-w-3xl text-slate-400">
              {esGerente
                ? "Consulta el estado comercial de las cotizaciones en modo solo lectura."
                : "Calcula, registra y controla el precio de cada servicio antes de programar la inspección."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {puedeGestionarCotizaciones && (
              <>
                <Link
                  href="/panel/clientes"
                  className="rounded-full border border-white/15 px-5 py-3 text-sm font-black transition hover:border-cyan-300 hover:text-cyan-300"
                >
                  Clientes
                </Link>

                <Link
                  href="/panel/inmuebles"
                  className="rounded-full border border-white/15 px-5 py-3 text-sm font-black transition hover:border-cyan-300 hover:text-cyan-300"
                >
                  Inmuebles
                </Link>

                <Link
                  href="/panel/paquetes"
                  className="rounded-full border border-white/15 px-5 py-3 text-sm font-black transition hover:border-cyan-300 hover:text-cyan-300"
                >
                  Paquetes
                </Link>
              </>
            )}

            <Link
              href="/panel/agenda"
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-black transition hover:border-cyan-300 hover:text-cyan-300"
            >
              Agenda
            </Link>
          </div>
        </div>

        {(params.ok ||
          params.error) && (
          <div
            className={`mt-7 rounded-2xl border p-5 ${
              params.error
                ? "border-rose-400/20 bg-rose-400/5"
                : "border-emerald-400/20 bg-emerald-400/5"
            }`}
          >
            <p
              className={`text-xs font-black uppercase tracking-[0.2em] ${
                params.error
                  ? "text-rose-300"
                  : "text-emerald-300"
              }`}
            >
              {params.error
                ? "Acción no disponible"
                : "Operación completada"}
            </p>

            <p className="mt-2 font-bold text-slate-200">
              {params.error ??
                params.ok}
            </p>
          </div>
        )}

        <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Indicador
            titulo="Cotizaciones"
            valor={String(
              totalCotizaciones,
            ).padStart(2, "0")}
            detalle="Total registradas"
          />

          <Indicador
            titulo="Aceptadas"
            valor={String(
              totalAceptadas,
            ).padStart(2, "0")}
            detalle="Aceptadas por el cliente"
          />

          <Indicador
            titulo="Pendientes"
            valor={String(
              totalPendientes,
            ).padStart(2, "0")}
            detalle="En elaboración, autorización o envío"
          />

          <Indicador
            titulo={puedeVerDatosAdministrativos ? "Valor cotizado" : "Modo"}
            valor={
              puedeVerDatosAdministrativos
                ? dinero(valorCotizado)
                : "LECTURA"
            }
            detalle={
              puedeVerDatosAdministrativos
                ? "Importe acumulado"
                : "Sin datos financieros"
            }
          />
        </section>

        {puedeGestionarCotizaciones && (
          <section className="mt-10 rounded-3xl border border-cyan-400/20 bg-slate-900 p-7">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
              Operación comercial
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Nueva cotización
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Selecciona cliente, inmueble,
              superficie, paquete y forma de pago.
              El sistema calculará automáticamente
              el importe.
            </p>
          </div>

          {clientes.length === 0 ? (
            <div className="mt-7 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-6">
              <p className="font-black text-amber-300">
                No existen clientes registrados.
              </p>

              <p className="mt-2 text-sm text-slate-400">
                Debes registrar un cliente antes
                de generar una cotización.
              </p>

              <Link
                href="/panel/clientes"
                className="mt-5 inline-block rounded-full bg-amber-300 px-5 py-3 text-sm font-black text-slate-950"
              >
                Ir a Clientes
              </Link>
            </div>
          ) : paquetes.length ===
            0 ? (
            <div className="mt-7 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-6">
              <p className="font-black text-amber-300">
                No existen paquetes activos.
              </p>

              <p className="mt-2 text-sm text-slate-400">
                Crea al menos un paquete de
                servicio antes de cotizar.
              </p>

              <Link
                href="/panel/paquetes"
                className="mt-5 inline-block rounded-full bg-amber-300 px-5 py-3 text-sm font-black text-slate-950"
              >
                Ir a Paquetes
              </Link>
            </div>
          ) : (
            <div className="mt-7">
              <NuevaCotizacionForm
                clientes={clientes}
                inmuebles={inmuebles}
                paquetes={paquetes}
              />
            </div>
          )}
        </section>
        )}

        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">
                Seguimiento
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Historial de cotizaciones
              </h2>
            </div>

            <p className="text-sm text-slate-500">
              {cotizaciones.length} registro
              {cotizaciones.length ===
              1
                ? ""
                : "s"}
            </p>
          </div>

          {cotizaciones.length ===
          0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-white/15 bg-slate-900/50 p-12 text-center">
              <p className="text-xl font-black">
                Todavía no hay cotizaciones.
              </p>

              <p className="mt-2 text-slate-500">
                La primera cotización aparecerá
                aquí después de guardarla.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {cotizaciones.map(
                (cotizacion) => {
                  const total =
                    Number(
                      cotizacion.total,
                    );

                  const pagado =
                    Number(
                      cotizacion.montoPagado,
                    );

                  const saldo =
                    Math.max(
                      0,
                      total -
                        pagado,
                    );

                  const es5050 =
                    cotizacion.esquemaPago ===
                    EsquemaPago.DOS_EXHIBICIONES_50_50;

                  const primer50 =
                    total / 2;

                  const puedeAgendar =
                    cotizacion.estado ===
                      EstadoCotizacion.ACEPTADA &&
                    (
                      cotizacion.estadoPago ===
                        EstadoPago.PAGADO ||
                      (
                        es5050 &&
                        cotizacion.estadoPago ===
                          EstadoPago.PARCIAL
                      )
                    );

                  return (
                    <article
                      key={
                        cotizacion.id
                      }
                      className="rounded-3xl border border-white/10 bg-slate-900 p-7"
                    >
                      <div className="flex flex-col justify-between gap-6 xl:flex-row">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="font-mono text-xs font-bold text-cyan-300">
                              {
                                cotizacion.folio
                              }
                            </p>

                            <EstadoCotizacionBadge
                              estado={
                                cotizacion.estado
                              }
                            />

                            {puedeVerDatosAdministrativos && (
                              <EstadoPagoBadge
                                estado={
                                  cotizacion.estadoPago
                                }
                                esquemaPago={
                                  cotizacion.esquemaPago
                                }
                              />
                            )}
                          </div>

                          <h3 className="mt-3 text-2xl font-black">
                            {
                              cotizacion
                                .cliente
                                .nombre
                            }
                          </h3>

                          <div className="mt-3 space-y-1 text-sm text-slate-400">
                            <p>
                              <span className="font-bold text-slate-300">
                                Inmueble:
                              </span>{" "}
                              {cotizacion.inmueble
                                ? `${cotizacion.inmueble.alias} — ${cotizacion.inmueble.direccion}`
                                : "Sin inmueble asociado"}
                            </p>

                            <p>
                              <span className="font-bold text-slate-300">
                                Paquete:
                              </span>{" "}
                              {cotizacion.paquete
                                ?.nombre ??
                                "Sin paquete"}
                            </p>

                            {puedeVerDatosAdministrativos &&
                              cotizacion.creadaPor?.nombre && (
                                <p>
                                  <span className="font-bold text-slate-300">
                                    Elaboró:
                                  </span>{" "}
                                  {cotizacion.creadaPor.nombre}
                                </p>
                              )}

                            <p>
                              <span className="font-bold text-slate-300">
                                Creada:
                              </span>{" "}
                              {fecha(
                                cotizacion.creadoEn,
                              )}
                            </p>

                            {puedeVerDatosAdministrativos &&
                              cotizacion.solicitudAutorizacionEn && (
                                <p>
                                  <span className="font-bold text-slate-300">
                                    Autorización solicitada:
                                  </span>{" "}
                                  {fecha(cotizacion.solicitudAutorizacionEn)}
                                </p>
                              )}

                            {puedeVerDatosAdministrativos &&
                              cotizacion.autorizadaEn && (
                                <p>
                                  <span className="font-bold text-emerald-300">
                                    Autorizada:
                                  </span>{" "}
                                  {fecha(cotizacion.autorizadaEn)}
                                  {cotizacion.autorizadaPor?.nombre
                                    ? ` por ${cotizacion.autorizadaPor.nombre}`
                                    : ""}
                                </p>
                              )}

                            {puedeVerDatosAdministrativos &&
                              cotizacion.rechazadaEn && (
                                <p>
                                  <span className="font-bold text-rose-300">
                                    Rechazada:
                                  </span>{" "}
                                  {fecha(cotizacion.rechazadaEn)}
                                  {cotizacion.rechazadaPor?.nombre
                                    ? ` por ${cotizacion.rechazadaPor.nombre}`
                                    : ""}
                                </p>
                              )}
                          </div>
                        </div>

                        <div className="xl:text-right">
                          {puedeVerDatosAdministrativos ? (
                            <>
                              <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                                Total cotizado
                              </p>

                              <p className="mt-1 text-4xl font-black text-cyan-300">
                                {dinero(
                                  cotizacion.total,
                                )}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                                Acceso
                              </p>

                              <p className="mt-1 text-lg font-black text-emerald-300">
                                SOLO LECTURA
                              </p>
                            </>
                          )}

                          <p className="mt-2 text-xs text-slate-500">
                            Vigencia hasta:{" "}
                            {fecha(
                              cotizacion.vigenciaHasta,
                            )}
                          </p>
                        </div>
                      </div>

                      {puedeVerDatosAdministrativos && (
                        <>
                      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                        <Dato
                          titulo="Superficie"
                          valor={`${Number(
                            cotizacion.superficieM2 ??
                              0,
                          ).toLocaleString(
                            "es-MX",
                          )} m²`}
                        />

                        <Dato
                          titulo="Precio base"
                          valor={dinero(
                            cotizacion.precioBase,
                          )}
                        />

                        <Dato
                          titulo="m² adicionales"
                          valor={`${Number(
                            cotizacion.metrosAdicionales,
                          ).toLocaleString(
                            "es-MX",
                          )} m²`}
                        />

                        <Dato
                          titulo="Cargo m²"
                          valor={dinero(
                            cotizacion.cargoMetrosAdicionales,
                          )}
                        />

                        <Dato
                          titulo="Extras"
                          valor={dinero(
                            cotizacion.cargosExtra,
                          )}
                        />

                        <Dato
                          titulo="Descuento"
                          valor={dinero(
                            cotizacion.descuento,
                          )}
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap justify-end gap-6 rounded-2xl bg-slate-950 p-5">
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest text-slate-600">
                            Subtotal
                          </p>

                          <p className="mt-1 text-xl font-black text-slate-200">
                            {dinero(
                              cotizacion.subtotal,
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-black uppercase tracking-widest text-cyan-400">
                            Total
                          </p>

                          <p className="mt-1 text-xl font-black text-cyan-300">
                            {dinero(
                              cotizacion.total,
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 lg:grid-cols-3">
                        <Dato
                          titulo="Esquema de pago"
                          valor={
                            es5050
                              ? "Dos exhibiciones 50/50"
                              : "Una exhibición"
                          }
                        />

                        <Dato
                          titulo="Pagado"
                          valor={dinero(
                            pagado,
                          )}
                        />

                        <Dato
                          titulo="Saldo"
                          valor={dinero(
                            saldo,
                          )}
                        />
                      </div>

                      {es5050 && (
                        <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                            Condición 50/50
                          </p>

                          <p className="mt-2 text-sm text-slate-300">
                            Primer pago:{" "}
                            {dinero(
                              primer50,
                            )}
                            . Con este 50% la
                            inspección puede
                            agendarse. El saldo de{" "}
                            {dinero(
                              primer50,
                            )}{" "}
                            debe quedar liquidado
                            antes de iniciar la
                            inspección.
                          </p>
                        </div>
                      )}

                      {(cotizacion.notas ||
                        cotizacion.observacionesInternas) && (
                        <div className="mt-5 grid gap-4 lg:grid-cols-2">
                          {cotizacion.notas && (
                            <div className="rounded-2xl border border-white/10 p-5">
                              <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                                Notas
                              </p>

                              <p className="mt-2 text-sm leading-6 text-slate-300">
                                {
                                  cotizacion.notas
                                }
                              </p>
                            </div>
                          )}

                          {cotizacion.observacionesInternas && (
                            <div className="rounded-2xl border border-amber-300/10 bg-amber-300/5 p-5">
                              <p className="text-xs font-black uppercase tracking-widest text-amber-300">
                                Uso interno
                              </p>

                              <p className="mt-2 text-sm leading-6 text-slate-300">
                                {
                                  cotizacion.observacionesInternas
                                }
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {cotizacion.motivoRechazo && (
                        <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/5 p-5">
                          <p className="text-xs font-black uppercase tracking-widest text-rose-300">
                            Motivo de rechazo
                          </p>

                          <p className="mt-2 text-sm leading-6 text-slate-300">
                            {
                              cotizacion.motivoRechazo
                            }
                          </p>
                        </div>
                      )}

                        </>
                      )}

                      {puedeGestionarCotizaciones && (
                        <>
                      <div className="mt-7 flex flex-col gap-4 border-t border-white/10 pt-6">
                        <div className="flex flex-wrap items-center gap-4">
                          {cotizacion.estado ===
                            EstadoCotizacion.BORRADOR && (
                            <form
                              action={
                                cambiarEstadoCotizacion
                              }
                            >
                              <input
                                type="hidden"
                                name="id"
                                value={
                                  cotizacion.id
                                }
                              />

                              <input
                                type="hidden"
                                name="estado"
                                value={
                                  EstadoCotizacion.PENDIENTE_AUTORIZACION
                                }
                              />

                              <button
                                type="submit"
                                className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
                              >
                                Solicitar autorización
                              </button>
                            </form>
                          )}

                          {cotizacion.estado ===
                            EstadoCotizacion.PENDIENTE_AUTORIZACION &&
                            puedeGestionarCotizaciones && (
                              <>
                                <form
                                  action={
                                    cambiarEstadoCotizacion
                                  }
                                >
                                  <input
                                    type="hidden"
                                    name="id"
                                    value={
                                      cotizacion.id
                                    }
                                  />

                                  <input
                                    type="hidden"
                                    name="estado"
                                    value={
                                      EstadoCotizacion.AUTORIZADA
                                    }
                                  />

                                  <button
                                    type="submit"
                                    className="rounded-full bg-emerald-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-200"
                                  >
                                    Autorizar cotización
                                  </button>
                                </form>

                                <form
                                  action={
                                    cambiarEstadoCotizacion
                                  }
                                  className="flex flex-wrap items-center gap-3"
                                >
                                  <input
                                    type="hidden"
                                    name="id"
                                    value={
                                      cotizacion.id
                                    }
                                  />

                                  <input
                                    type="hidden"
                                    name="estado"
                                    value={
                                      EstadoCotizacion.RECHAZADA
                                    }
                                  />

                                  <input
                                    type="text"
                                    name="motivoRechazo"
                                    placeholder="Motivo del rechazo"
                                    className="min-w-64 rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600"
                                  />

                                  <button
                                    type="submit"
                                    className="rounded-full bg-rose-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-rose-200"
                                  >
                                    Rechazar cotización
                                  </button>
                                </form>
                              </>
                            )}

                          {cotizacion.estado ===
                            EstadoCotizacion.AUTORIZADA && (
                            <form
                              action={
                                cambiarEstadoCotizacion
                              }
                            >
                              <input
                                type="hidden"
                                name="id"
                                value={
                                  cotizacion.id
                                }
                              />

                              <input
                                type="hidden"
                                name="estado"
                                value={
                                  EstadoCotizacion.ENVIADA
                                }
                              />

                              <button
                                type="submit"
                                className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
                              >
                                Marcar como enviada
                              </button>
                            </form>
                          )}

                          {cotizacion.estado ===
                            EstadoCotizacion.ENVIADA && (
                            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 px-5 py-4">
                              <p className="text-sm font-black text-cyan-300">
                                Enviada al cliente.
                                Pendiente de
                                aceptación.
                              </p>
                            </div>
                          )}

                          {cotizacion.estado ===
                            EstadoCotizacion.RECHAZADA && (
                            <div className="rounded-2xl border border-rose-300/20 bg-rose-300/5 px-5 py-4">
                              <p className="text-sm font-black text-rose-300">
                                Cotización rechazada.
                              </p>
                            </div>
                          )}

                          {cotizacion.estado ===
                            EstadoCotizacion.VENCIDA && (
                            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 px-5 py-4">
                              <p className="text-sm font-black text-amber-300">
                                Cotización vencida.
                              </p>
                            </div>
                          )}

                          {cotizacion.estado ===
                            EstadoCotizacion.CANCELADA && (
                            <div className="rounded-2xl border border-slate-400/20 bg-slate-400/5 px-5 py-4">
                              <p className="text-sm font-black text-slate-300">
                                Cotización cancelada.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {cotizacion.estado ===
                        EstadoCotizacion.ACEPTADA && (
                        <div className="mt-6">
                          {cotizacion.estadoPago ===
                            EstadoPago.PENDIENTE &&
                            es5050 && (
                              <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5">
                                <p className="font-black text-amber-300">
                                  Cotización aceptada
                                  — primer pago
                                  pendiente
                                </p>

                                <p className="mt-1 text-sm text-slate-400">
                                  Registra el primer
                                  50% para habilitar la programación por Gerencia o Dirección.
                                </p>

                                <form
                                  action={
                                    registrarPrimerPago50
                                  }
                                  className="mt-4"
                                >
                                  <input
                                    type="hidden"
                                    name="id"
                                    value={
                                      cotizacion.id
                                    }
                                  />

                                  <button className="rounded-full bg-amber-300 px-5 py-3 text-sm font-black text-slate-950">
                                    Registrar primer
                                    50% —{" "}
                                    {dinero(
                                      primer50,
                                    )}
                                  </button>
                                </form>
                              </div>
                            )}

                          {cotizacion.estadoPago ===
                            EstadoPago.PENDIENTE &&
                            !es5050 && (
                              <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5">
                                <p className="font-black text-amber-300">
                                  Cotización aceptada
                                  — pago pendiente
                                </p>

                                <p className="mt-1 text-sm text-slate-400">
                                  Esta cotización es
                                  de una sola
                                  exhibición. Debe
                                  liquidarse al 100%
                                  para habilitar la programación por Gerencia o Dirección.
                                </p>

                                <form
                                  action={
                                    registrarPagoTotal
                                  }
                                  className="mt-4"
                                >
                                  <input
                                    type="hidden"
                                    name="id"
                                    value={
                                      cotizacion.id
                                    }
                                  />

                                  <button className="rounded-full bg-amber-300 px-5 py-3 text-sm font-black text-slate-950">
                                    Registrar pago
                                    total —{" "}
                                    {dinero(
                                      total,
                                    )}
                                  </button>
                                </form>
                              </div>
                            )}

                          {cotizacion.estadoPago ===
                            EstadoPago.PARCIAL &&
                            es5050 && (
                              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5">
                                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                                  <div>
                                    <p className="font-black text-emerald-300">
                                      Primer 50%
                                      recibido —
                                      Programación habilitada
                                    </p>

                                    <p className="mt-1 text-sm text-slate-400">
                                      Pagado:{" "}
                                      {dinero(
                                        pagado,
                                      )}
                                      . Saldo:{" "}
                                      {dinero(
                                        saldo,
                                      )}
                                      . El segundo
                                      50% debe
                                      liquidarse antes
                                      de iniciar la
                                      inspección.
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap gap-3">
                                    <Link
                                      href="/panel/agenda"
                                      className="rounded-full bg-emerald-300 px-5 py-3 text-sm font-black text-slate-950"
                                    >
                                      Ver Agenda
                                    </Link>

                                    <form
                                      action={
                                        registrarSegundoPago50
                                      }
                                    >
                                      <input
                                        type="hidden"
                                        name="id"
                                        value={
                                          cotizacion.id
                                        }
                                      />

                                      <button className="rounded-full border border-cyan-300/30 px-5 py-3 text-sm font-black text-cyan-300">
                                        Registrar
                                        segundo 50% —{" "}
                                        {dinero(
                                          saldo,
                                        )}
                                      </button>
                                    </form>
                                  </div>
                                </div>
                              </div>
                            )}

                          {cotizacion.estadoPago ===
                            EstadoPago.PAGADO && (
                              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5">
                                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                                  <div>
                                    <p className="font-black text-emerald-300">
                                      Cotización
                                      liquidada al
                                      100%
                                    </p>

                                    <p className="mt-1 text-sm text-slate-400">
                                      El pago está
                                      completo. La
                                      cotización ya cumple la condición administrativa de pago y
                                      la inspección
                                      podrá iniciar
                                      cuando llegue su
                                      fecha programada.
                                    </p>
                                  </div>

                                  <Link
                                    href="/panel/agenda"
                                    className="rounded-full bg-emerald-300 px-5 py-3 text-sm font-black text-slate-950"
                                  >
                                    Ver Agenda
                                  </Link>
                                </div>
                              </div>
                            )}

                          {cotizacion.estadoPago ===
                            EstadoPago.CANCELADO && (
                              <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-5">
                                <p className="font-black text-rose-300">
                                  Pago cancelado
                                </p>

                                <p className="mt-1 text-sm text-slate-400">
                                  La cotización no
                                  puede avanzar a programación mientras el
                                  pago permanezca
                                  cancelado.
                                </p>
                              </div>
                            )}

                          {!puedeAgendar &&
                            cotizacion.estadoPago !==
                              EstadoPago.PENDIENTE &&
                            cotizacion.estadoPago !==
                              EstadoPago.CANCELADO &&
                            !(
                              es5050 &&
                              cotizacion.estadoPago ===
                                EstadoPago.PARCIAL
                            ) && (
                              <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5">
                                <p className="font-black text-amber-300">
                                  Programación todavía no habilitada
                                </p>
                              </div>
                            )}
                        </div>
                      )}
                        </>
                      )}

                      {esGerente && (
                        <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5">
                          <p className="font-black text-emerald-300">
                            Consulta únicamente
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            Gerencia puede consultar el importe, esquema de pago,
                            monto pagado y saldo para verificar si el servicio está
                            administrativamente habilitado, pero no puede crear,
                            autorizar, enviar, rechazar ni registrar pagos de
                            cotizaciones.
                          </p>
                        </div>
                      )}
                    </article>
                  );
                },
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Indicador({
  titulo,
  valor,
  detalle,
}: {
  titulo: string;
  valor: string;
  detalle: string;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-slate-900 p-6">
      <p className="text-sm font-bold text-slate-400">
        {titulo}
      </p>

      <p className="mt-4 break-words text-3xl font-black text-cyan-300">
        {valor}
      </p>

      <p className="mt-2 text-xs text-slate-600">
        {detalle}
      </p>
    </article>
  );
}

function Dato({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-950 p-4">
      <p className="text-xs font-black uppercase tracking-widest text-slate-600">
        {titulo}
      </p>

      <p className="mt-2 font-black text-slate-200">
        {valor}
      </p>
    </div>
  );
}

function EstadoCotizacionBadge({
  estado,
}: {
  estado: EstadoCotizacion;
}) {
  let estilos =
    "bg-slate-400/10 text-slate-300";

  if (
    estado ===
    EstadoCotizacion.PENDIENTE_AUTORIZACION
  ) {
    estilos =
      "bg-amber-400/10 text-amber-300";
  }

  if (
    estado ===
    EstadoCotizacion.AUTORIZADA
  ) {
    estilos =
      "bg-violet-400/10 text-violet-300";
  }

  if (
    estado ===
    EstadoCotizacion.ACEPTADA
  ) {
    estilos =
      "bg-emerald-400/10 text-emerald-300";
  }

  if (
    estado ===
    EstadoCotizacion.ENVIADA
  ) {
    estilos =
      "bg-cyan-400/10 text-cyan-300";
  }

  if (
    estado ===
      EstadoCotizacion.RECHAZADA ||
    estado ===
      EstadoCotizacion.CANCELADA
  ) {
    estilos =
      "bg-rose-400/10 text-rose-300";
  }

  if (
    estado ===
    EstadoCotizacion.VENCIDA
  ) {
    estilos =
      "bg-amber-400/10 text-amber-300";
  }

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-black ${estilos}`}
    >
      {estado.replaceAll(
        "_",
        " ",
      )}
    </span>
  );
}

function EstadoPagoBadge({
  estado,
  esquemaPago,
}: {
  estado: EstadoPago;
  esquemaPago: EsquemaPago;
}) {
  let estilos =
    "bg-amber-400/10 text-amber-300";

  let texto =
    "PAGO: PENDIENTE";

  if (
    estado ===
    EstadoPago.PAGADO
  ) {
    estilos =
      "bg-emerald-400/10 text-emerald-300";

    texto =
      "PAGO: 100% PAGADO";
  }

  if (
    estado ===
    EstadoPago.PARCIAL
  ) {
    estilos =
      "bg-cyan-400/10 text-cyan-300";

    texto =
      esquemaPago ===
      EsquemaPago.DOS_EXHIBICIONES_50_50
        ? "PAGO: PRIMER 50% PAGADO"
        : "PAGO: PARCIAL";
  }

  if (
    estado ===
    EstadoPago.CANCELADO
  ) {
    estilos =
      "bg-rose-400/10 text-rose-300";

    texto =
      "PAGO: CANCELADO";
  }

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-black ${estilos}`}
    >
      {texto}
    </span>
  );
}
