import Link from "next/link";
import {
  EsquemaPago,
  EstadoCotizacion,
  EstadoInspeccion,
  EstadoPago,
} from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { agendarCotizacion } from "./actions";

const formatoFecha = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: "America/Hermosillo",
});

function dinero(valor: unknown) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(valor ?? 0));
}

function puedeAgendar({
  estado,
  estadoPago,
  esquemaPago,
}: {
  estado: EstadoCotizacion;
  estadoPago: EstadoPago;
  esquemaPago: EsquemaPago;
}) {
  if (estado !== EstadoCotizacion.ACEPTADA) {
    return false;
  }

  if (estadoPago === EstadoPago.PAGADO) {
    return true;
  }

  return (
    esquemaPago === EsquemaPago.DOS_EXHIBICIONES_50_50 &&
    estadoPago === EstadoPago.PARCIAL
  );
}

export default async function AgendaPage({
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

  if (
    session.user.role !== "ADMINISTRADOR" &&
    session.user.role !== "COORDINADOR" &&
    session.user.role !== "SUPERVISOR"
  ) {
    redirect("/acceso");
  }

  const params = await searchParams;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const [
    cotizacionesAceptadas,
    inspecciones,
    inspectores,
    inspeccionesConCotizacion,
  ] = await Promise.all([
    prisma.cotizacion.findMany({
      where: {
        estado: EstadoCotizacion.ACEPTADA,
      },
      include: {
        cliente: {
          select: {
            nombre: true,
            telefono: true,
          },
        },
        inmueble: {
          select: {
            alias: true,
            tipo: true,
            direccion: true,
            ciudad: true,
          },
        },
        paquete: {
          select: {
            nombre: true,
          },
        },
      },
      orderBy: {
        creadoEn: "asc",
      },
    }),

    prisma.inspeccion.findMany({
      where: {
        fechaProgramada: {
          gte: hoy,
        },
        estado: {
          in: [
            EstadoInspeccion.PROGRAMADA,
            EstadoInspeccion.EN_PROCESO,
          ],
        },
      },
      include: {
        cliente: {
          select: {
            nombre: true,
          },
        },
        inspector: {
          include: {
            usuario: {
              select: {
                nombre: true,
              },
            },
          },
        },
      },
      orderBy: {
        fechaProgramada: "asc",
      },
      take: 100,
    }),

    prisma.inspector.findMany({
      where: {
        activo: true,
        usuario: {
          activo: true,
        },
      },
      include: {
        usuario: {
          select: {
            nombre: true,
          },
        },
      },
      orderBy: {
        creadoEn: "asc",
      },
    }),

    prisma.inspeccion.findMany({
      where: {
        cotizacionId: {
          not: null,
        },
      },
      select: {
        cotizacionId: true,
      },
    }),
  ]);

  const idsAgendados = new Set(
    inspeccionesConCotizacion
      .map((item) => item.cotizacionId)
      .filter((id): id is string => Boolean(id)),
  );

  const pendientes = cotizacionesAceptadas.filter(
    (cotizacion) =>
      !idsAgendados.has(cotizacion.id) &&
      puedeAgendar({
        estado: cotizacion.estado,
        estadoPago: cotizacion.estadoPago,
        esquemaPago: cotizacion.esquemaPago,
      }),
  );

  const programadas = inspecciones.filter(
    (inspeccion) =>
      inspeccion.estado === EstadoInspeccion.PROGRAMADA,
  ).length;

  const enProceso = inspecciones.filter(
    (inspeccion) =>
      inspeccion.estado === EstadoInspeccion.EN_PROCESO,
  ).length;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <Link
              href="/panel"
              className="text-sm font-black text-cyan-300"
            >
              ← Volver al panel
            </Link>

            <p className="mt-7 text-xs font-black uppercase tracking-[0.3em] text-amber-300">
              CertezaHabitacional v2.0
            </p>

            <h1 className="mt-3 text-4xl font-black">
              Agenda operativa
            </h1>

            <p className="mt-2 text-slate-400">
              Programa únicamente cotizaciones aceptadas que cumplen la
              condición mínima de pago y administra las próximas inspecciones.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/panel/cotizaciones"
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-black hover:border-cyan-300 hover:text-cyan-300"
            >
              Cotizaciones
            </Link>

            <Link
              href="/panel/clientes"
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-black hover:border-cyan-300 hover:text-cyan-300"
            >
              Clientes
            </Link>

            <Link
              href="/panel/inmuebles"
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-black hover:border-cyan-300 hover:text-cyan-300"
            >
              Inmuebles
            </Link>
          </div>
        </header>

        {(params.ok || params.error) && (
          <div
            className={`mt-7 rounded-2xl border p-5 ${
              params.error
                ? "border-rose-400/20 bg-rose-400/5"
                : "border-emerald-400/20 bg-emerald-400/5"
            }`}
          >
            <p
              className={`text-xs font-black uppercase tracking-[0.2em] ${
                params.error ? "text-rose-300" : "text-emerald-300"
              }`}
            >
              {params.error ? "Acción no disponible" : "Operación completada"}
            </p>

            <p className="mt-2 font-bold text-slate-200">
              {params.error ?? params.ok}
            </p>
          </div>
        )}

        <section className="mt-8 grid gap-5 sm:grid-cols-3">
          <Indicador
            titulo="Por agendar"
            valor={pendientes.length}
            detalle="Aceptadas con pago suficiente"
          />

          <Indicador
            titulo="Programadas"
            valor={programadas}
            detalle="Próximas inspecciones"
          />

          <Indicador
            titulo="En proceso"
            valor={enProceso}
            detalle="Servicios iniciados"
          />
        </section>

        <section className="mt-10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
            Pendientes por agendar
          </p>

          <h2 className="mt-2 text-2xl font-black">
            Cotizaciones habilitadas
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Solo aparecen cotizaciones aceptadas que ya cumplen la condición mínima de pago para programación.
          </p>

          {pendientes.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-white/15 bg-slate-900/50 p-12 text-center">
              <p className="text-xl font-black">
                No hay cotizaciones pendientes por agendar.
              </p>

              <p className="mt-2 text-slate-500">
                Una cotización aparecerá aquí cuando esté ACEPTADA y cumpla el pago mínimo requerido.
              </p>

              <Link
                href="/panel/cotizaciones"
                className="mt-5 inline-block font-black text-cyan-300"
              >
                Ir a Cotizaciones →
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {pendientes.map((cotizacion) => (
                <article
                  key={cotizacion.id}
                  className="rounded-3xl border border-emerald-400/20 bg-slate-900 p-7"
                >
                  <div className="grid gap-8 xl:grid-cols-[1fr_420px]">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-mono text-xs font-black text-cyan-300">
                          {cotizacion.folio}
                        </span>

                        <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-300">
                          ACEPTADA
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${
                            cotizacion.estadoPago === EstadoPago.PAGADO
                              ? "bg-emerald-400/10 text-emerald-300"
                              : "bg-cyan-400/10 text-cyan-300"
                          }`}
                        >
                          {cotizacion.estadoPago === EstadoPago.PAGADO
                            ? "PAGO: 100% PAGADO"
                            : "PAGO: PRIMER 50% PAGADO"}
                        </span>
                      </div>

                      <h3 className="mt-4 text-2xl font-black">
                        {cotizacion.cliente.nombre}
                      </h3>

                      <div className="mt-4 space-y-2 text-sm text-slate-400">
                        <p>
                          <strong className="text-slate-200">
                            Servicio:
                          </strong>{" "}
                          {cotizacion.paquete?.nombre ??
                            "Inspección habitacional"}
                        </p>

                        <p>
                          <strong className="text-slate-200">
                            Inmueble:
                          </strong>{" "}
                          {cotizacion.inmueble?.alias ??
                            "Sin inmueble asociado"}
                        </p>

                        <p>
                          <strong className="text-slate-200">
                            Dirección:
                          </strong>{" "}
                          {cotizacion.inmueble?.direccion ?? "Pendiente"}
                        </p>

                        <p>
                          <strong className="text-slate-200">
                            Ciudad:
                          </strong>{" "}
                          {cotizacion.inmueble?.ciudad ?? "Pendiente"}
                        </p>

                        <p>
                          <strong className="text-slate-200">
                            Superficie:
                          </strong>{" "}
                          {Number(
                            cotizacion.superficieM2 ?? 0,
                          ).toLocaleString("es-MX")}{" "}
                          m²
                        </p>

                        {cotizacion.cliente.telefono && (
                          <p>
                            <strong className="text-slate-200">
                              Teléfono:
                            </strong>{" "}
                            {cotizacion.cliente.telefono}
                          </p>
                        )}
                      </div>

                      <div className="mt-6 grid gap-4 sm:grid-cols-3">
                        <DatoPago
                          titulo="Total"
                          valor={dinero(cotizacion.total)}
                        />

                        <DatoPago
                          titulo="Pagado"
                          valor={dinero(cotizacion.montoPagado)}
                        />

                        <DatoPago
                          titulo="Saldo"
                          valor={dinero(
                            Math.max(
                              0,
                              Number(cotizacion.total) -
                                Number(cotizacion.montoPagado),
                            ),
                          )}
                        />
                      </div>

                      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950 p-5">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                          Esquema de pago
                        </p>

                        <p className="mt-2 font-black text-slate-200">
                          {cotizacion.esquemaPago ===
                          EsquemaPago.DOS_EXHIBICIONES_50_50
                            ? "Dos exhibiciones 50/50"
                            : "Una exhibición"}
                        </p>

                        {cotizacion.esquemaPago ===
                          EsquemaPago.DOS_EXHIBICIONES_50_50 &&
                          cotizacion.estadoPago === EstadoPago.PARCIAL && (
                            <p className="mt-2 text-sm text-amber-300">
                              Puede programarse, pero la inspección no deberá
                              iniciar hasta liquidar el saldo restante.
                            </p>
                          )}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-950 p-6">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
                        Programar inspección
                      </p>

                      {!cotizacion.inmueble ? (
                        <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5">
                          <p className="font-black text-amber-300">
                            Falta asociar inmueble
                          </p>

                          <p className="mt-2 text-sm text-slate-400">
                            Esta cotización no puede programarse hasta tener
                            un inmueble asociado.
                          </p>
                        </div>
                      ) : (
                        <form
                          action={agendarCotizacion}
                          className="mt-5 space-y-5"
                        >
                          <input
                            type="hidden"
                            name="cotizacionId"
                            value={cotizacion.id}
                          />

                          <div>
                            <label className="text-sm font-bold text-slate-300">
                              Fecha y hora
                            </label>

                            <input
                              type="datetime-local"
                              name="fechaHora"
                              required
                              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
                            />
                          </div>

                          <div>
                            <label className="text-sm font-bold text-slate-300">
                              Inspector
                            </label>

                            <select
                              name="inspectorId"
                              defaultValue=""
                              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
                            >
                              <option value="">
                                Asignar después
                              </option>

                              {inspectores.map((inspector) => (
                                <option
                                  key={inspector.id}
                                  value={inspector.id}
                                >
                                  {inspector.usuario.nombre}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="submit"
                            className="w-full rounded-full bg-emerald-300 px-6 py-4 font-black text-slate-950 transition hover:bg-emerald-200"
                          >
                            Confirmar programación
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-12">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">
            Calendario operativo
          </p>

          <h2 className="mt-2 text-2xl font-black">
            Próximas inspecciones
          </h2>

          <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
            {inspecciones.length === 0 ? (
              <div className="p-16 text-center">
                <p className="text-2xl font-black">
                  Sin servicios programados
                </p>

                <p className="mt-2 text-slate-400">
                  Las nuevas inspecciones aparecerán aquí.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {inspecciones.map((inspeccion) => (
                  <article
                    key={inspeccion.id}
                    className="grid gap-5 p-6 md:grid-cols-[220px_1fr_1fr_auto] md:items-center"
                  >
                    <div>
                      <p className="font-black text-cyan-300">
                        {inspeccion.folio}
                      </p>

                      <p className="mt-2 text-sm capitalize text-slate-400">
                        {formatoFecha.format(inspeccion.fechaProgramada)}
                      </p>
                    </div>

                    <div>
                      <p className="font-black">
                        {inspeccion.cliente.nombre}
                      </p>

                      <p className="mt-1 text-sm text-slate-400">
                        {inspeccion.tipoServicio}
                      </p>
                    </div>

                    <div>
                      <p className="font-bold">
                        {inspeccion.direccion}
                      </p>

                      <p className="mt-1 text-sm text-slate-400">
                        {inspeccion.inspector?.usuario.nombre ??
                          "Inspector pendiente"}
                      </p>

                      <p className="mt-1 text-xs font-black text-amber-300">
                        {inspeccion.estado.replaceAll("_", " ")}
                      </p>
                    </div>

                    <Link
                      href={`/panel/inspecciones/${inspeccion.id}`}
                      className="rounded-full bg-cyan-400 px-5 py-3 text-center text-sm font-black text-slate-950"
                    >
                      Abrir
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function DatoPago({
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

function Indicador({
  titulo,
  valor,
  detalle,
}: {
  titulo: string;
  valor: number;
  detalle: string;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-slate-900 p-6">
      <p className="text-sm font-bold text-slate-400">
        {titulo}
      </p>

      <p className="mt-4 text-4xl font-black text-cyan-300">
        {String(valor).padStart(2, "0")}
      </p>

      <p className="mt-2 text-xs text-slate-600">
        {detalle}
      </p>
    </article>
  );
}