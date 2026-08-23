import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ClasificacionHallazgo,
  EstadoInspeccion,
} from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function PanelPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const rol = session.user.role;

  const esCoordinador = rol === "COORDINADOR";

  const tieneAccesoPanel =
    rol === "DIRECTOR" ||
    rol === "ADMINISTRADOR" ||
    rol === "GERENTE" ||
    rol === "SUPERVISOR" ||
    rol === "COORDINADOR";

  if (!tieneAccesoPanel) {
    redirect("/acceso");
  }

  /*
   * CONSULTAS PRINCIPALES
   *
   * Se agruparon para reducir considerablemente
   * la cantidad de conexiones a Supabase.
   */
  const [
    inspeccionesPorEstado,
    clientes,
    recientes,
  ] = await Promise.all([
    prisma.inspeccion.groupBy({
      by: ["estado"],
      _count: {
        _all: true,
      },
    }),

    prisma.cliente.count(),

    prisma.inspeccion.findMany({
      include: {
        cliente: {
          select: {
            nombre: true,
          },
        },
      },

      orderBy: {
        actualizadoEn: "desc",
      },

      take: esCoordinador ? 4 : 6,
    }),
  ]);

  function obtenerCantidadEstado(
    estado: EstadoInspeccion,
  ) {
    return (
      inspeccionesPorEstado.find(
        (item) => item.estado === estado,
      )?._count._all ?? 0
    );
  }

  const activas = obtenerCantidadEstado(
    EstadoInspeccion.EN_PROCESO,
  );

  const programadas = obtenerCantidadEstado(
    EstadoInspeccion.PROGRAMADA,
  );

  const reportesPendientes =
    obtenerCantidadEstado(
      EstadoInspeccion.REPORTE_PENDIENTE,
    );

  /*
   * INFORMACIÓN EJECUTIVA
   *
   * No se carga para COORDINADOR.
   */
  let criticos = 0;
  let certificadosEmitidos = 0;
  let certificadosRevocados = 0;
  let ishPromedio = "0.0";

  let distribucionHallazgos: Array<{
    etiqueta: string;
    valor: number;
    porcentaje: number;
  }> = [];

  let distribucionSemaforo: Array<{
    etiqueta: string;
    valor: number;
    porcentaje: number;
  }> = [];

  if (!esCoordinador) {
    const [
      criticosResultado,
      certificadosPorVigencia,
      ish,
      hallazgosPorClasificacion,
      inspeccionesConSemaforo,
    ] = await Promise.all([
      prisma.hallazgo.count({
        where: {
          clasificacion:
            ClasificacionHallazgo.CR,

          resuelto: false,
        },
      }),

      prisma.certificado.groupBy({
        by: ["vigente"],

        _count: {
          _all: true,
        },
      }),

      prisma.inspeccion.aggregate({
        _avg: {
          ish: true,
        },

        where: {
          ish: {
            not: null,
          },
        },
      }),

      prisma.hallazgo.groupBy({
        by: ["clasificacion"],

        _count: {
          _all: true,
        },
      }),

      prisma.inspeccion.groupBy({
        by: ["semaforo"],

        where: {
          semaforo: {
            not: null,
          },
        },

        _count: {
          _all: true,
        },
      }),
    ]);

    criticos = criticosResultado;

    certificadosEmitidos =
      certificadosPorVigencia.reduce(
        (total, item) =>
          total + item._count._all,
        0,
      );

    certificadosRevocados =
      certificadosPorVigencia.find(
        (item) => item.vigente === false,
      )?._count._all ?? 0;

    ishPromedio = Number(
      ish._avg.ish ?? 0,
    ).toFixed(1);

    const totalClasificaciones =
      hallazgosPorClasificacion.reduce(
        (total, item) =>
          total + item._count._all,
        0,
      );

    distribucionHallazgos =
      hallazgosPorClasificacion.map(
        (item) => ({
          etiqueta: etiquetaClasificacion(
            item.clasificacion,
          ),

          valor: item._count._all,

          porcentaje:
            totalClasificaciones > 0
              ? Math.round(
                  (item._count._all /
                    totalClasificaciones) *
                    100,
                )
              : 0,
        }),
      );

    const totalSemaforos =
      inspeccionesConSemaforo.reduce(
        (total, item) =>
          total + item._count._all,
        0,
      );

    distribucionSemaforo =
      inspeccionesConSemaforo.map(
        (item) => ({
          etiqueta:
            item.semaforo ??
            "SIN EVALUAR",

          valor: item._count._all,

          porcentaje:
            totalSemaforos > 0
              ? Math.round(
                  (item._count._all /
                    totalSemaforos) *
                    100,
                )
              : 0,
        }),
      );
  }

  const totalEstados =
    inspeccionesPorEstado.reduce(
      (total, item) =>
        total + item._count._all,
      0,
    );

  const distribucionEstados =
    inspeccionesPorEstado.map(
      (item) => ({
        etiqueta: item.estado.replaceAll(
          "_",
          " ",
        ),

        valor: item._count._all,

        porcentaje:
          totalEstados > 0
            ? Math.round(
                (item._count._all /
                  totalEstados) *
                  100,
              )
            : 0,
      }),
    );

  const indicadores = esCoordinador
    ? [
        {
          titulo:
            "Inspecciones activas",

          valor: activas,

          detalle:
            "Actualmente en proceso",
        },

        {
          titulo: "Programadas",

          valor: programadas,

          detalle:
            "Pendientes de iniciar",
        },

        {
          titulo:
            "Reportes pendientes",

          valor: reportesPendientes,

          detalle:
            "Por completar o emitir",
        },

        {
          titulo:
            "Clientes registrados",

          valor: clientes,

          detalle:
            "Base total de clientes",
        },
      ]
    : [
        {
          titulo:
            "Inspecciones activas",

          valor: activas,

          detalle:
            "Actualmente en proceso",
        },

        {
          titulo: "Programadas",

          valor: programadas,

          detalle:
            "Pendientes de iniciar",
        },

        {
          titulo:
            "Reportes pendientes",

          valor: reportesPendientes,

          detalle:
            "Por completar o emitir",
        },

        {
          titulo:
            "Clientes registrados",

          valor: clientes,

          detalle:
            "Base total de clientes",
        },

        {
          titulo:
            "Hallazgos críticos",

          valor: criticos,

          detalle:
            "Críticos sin resolver",
        },

        {
          titulo:
            "Certificados emitidos",

          valor:
            certificadosEmitidos,

          detalle:
            "Total histórico",
        },
      ];

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        {/* ENCABEZADO */}
        <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
              Certeza Habitacional
            </p>

            <h1 className="mt-2 text-4xl font-black">
              {esCoordinador
                ? "Panel de coordinación"
                : "Dashboard ejecutivo"}
            </h1>

            <p className="mt-2 text-slate-400">
              {esCoordinador
                ? "Clientes, inmuebles, cotizaciones, precios y agenda."
                : "Resumen operativo y estado general de la plataforma."}
            </p>

            <p className="mt-2 text-xs font-bold uppercase tracking-widest text-amber-300">
              Sesión: {rol}
            </p>
          </div>

          {/* MENÚ PRINCIPAL */}
          <nav className="flex flex-wrap gap-3">
            <BotonNavegacion
              href="/panel/clientes"
              texto="Clientes"
            />

            <BotonNavegacion
              href="/panel/inmuebles"
              texto="Inmuebles"
            />

            <BotonNavegacion
              href="/panel/agenda"
              texto="Agenda"
            />

            {(esCoordinador ||
              rol === "ADMINISTRADOR" ||
              rol === "DIRECTOR") && (
              <>
                <BotonNavegacion
                  href="/panel/paquetes"
                  texto="Paquetes"
                />

                <BotonNavegacion
                  href="/panel/cotizaciones"
                  texto="Cotizaciones"
                />
              </>
            )}

            {!esCoordinador && (
              <>
                <BotonNavegacion
                  href="/panel/inspectores"
                  texto="Inspectores"
                />

                <BotonNavegacion
                  href="/panel/auditoria"
                  texto="Auditoría"
                />

                <BotonNavegacion
                  href="/panel/usuarios"
                  texto="Usuarios"
                />

                <Link
                  href="/panel/inspecciones/nueva"
                  className="rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950 transition hover:bg-cyan-300"
                >
                  Nueva inspección
                </Link>
              </>
            )}
          </nav>
        </header>

        {/* MÉTRICAS */}
        <section
          className={`mt-8 grid gap-5 sm:grid-cols-2 ${
            esCoordinador
              ? "xl:grid-cols-4"
              : "xl:grid-cols-3"
          }`}
        >
          {indicadores.map(
            (indicador) => (
              <Metrica
                key={indicador.titulo}
                titulo={
                  indicador.titulo
                }
                valor={indicador.valor}
                detalle={
                  indicador.detalle
                }
              />
            ),
          )}
        </section>

        {/* CUERPO PRINCIPAL */}
        <section className="mt-8 grid gap-8 xl:grid-cols-[1fr_340px]">
          {/* ACTIVIDAD */}
          <article className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
            <header className="flex items-center justify-between border-b border-white/10 p-6">
              <div>
                <h2 className="text-xl font-black">
                  Actividad reciente
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Últimas inspecciones
                  actualizadas.
                </p>
              </div>

              {!esCoordinador && (
                <Link
                  href="/panel/inspecciones"
                  className="text-sm font-bold text-cyan-300"
                >
                  Ver todas →
                </Link>
              )}
            </header>

            {recientes.length === 0 ? (
              <p className="p-12 text-center text-slate-400">
                Aún no hay inspecciones
                registradas.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left">
                  <thead className="bg-slate-950 text-xs uppercase tracking-widest text-slate-500">
                    <tr>
                      <th className="px-6 py-4">
                        Folio
                      </th>

                      <th className="px-6 py-4">
                        Cliente
                      </th>

                      <th className="px-6 py-4">
                        Inmueble
                      </th>

                      <th className="px-6 py-4">
                        Estado
                      </th>

                      <th className="px-6 py-4">
                        ISH
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {recientes.map(
                      (inspeccion) => (
                        <tr
                          key={
                            inspeccion.id
                          }
                          className="border-t border-white/10"
                        >
                          <td className="px-6 py-5">
                            {!esCoordinador ? (
                              <Link
                                href={`/panel/inspecciones/${inspeccion.id}`}
                                className="font-black text-cyan-300"
                              >
                                {
                                  inspeccion.folio
                                }
                              </Link>
                            ) : (
                              <span className="font-black text-cyan-300">
                                {
                                  inspeccion.folio
                                }
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-5 font-bold">
                            {
                              inspeccion
                                .cliente
                                .nombre
                            }
                          </td>

                          <td className="px-6 py-5 text-slate-400">
                            <p>
                              {
                                inspeccion.tipoInmueble
                              }
                            </p>

                            <p className="mt-1 text-xs text-slate-600">
                              {
                                inspeccion.ciudad
                              }
                            </p>
                          </td>

                          <td className="px-6 py-5">
                            <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-black text-amber-300">
                              {inspeccion.estado.replaceAll(
                                "_",
                                " ",
                              )}
                            </span>
                          </td>

                          <td className="px-6 py-5 font-black">
                            {inspeccion.ish !==
                            null
                              ? Number(
                                  inspeccion.ish,
                                ).toFixed(
                                  0,
                                )
                              : "—"}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          {/* COLUMNA DERECHA */}
          <aside className="space-y-5">
            {esCoordinador ? (
              <>
                <section className="rounded-3xl bg-cyan-300 p-7 text-slate-950">
                  <p className="text-xs font-black uppercase tracking-[0.25em]">
                    Coordinación
                  </p>

                  <p className="mt-6 text-4xl font-black">
                    {programadas}
                  </p>

                  <p className="mt-2 font-black">
                    inspecciones programadas
                  </p>

                  <p className="mt-4 text-sm font-semibold text-slate-800">
                    Gestiona desde aquí
                    clientes, inmuebles,
                    cotizaciones, paquetes y
                    agenda.
                  </p>
                </section>

                <section className="rounded-3xl border border-white/10 bg-slate-900 p-7">
                  <h2 className="text-lg font-black">
                    Operación comercial
                  </h2>

                  <div className="mt-5 space-y-3">
                    <Acceso
                      href="/panel/clientes"
                      texto="Gestionar clientes"
                    />

                    <Acceso
                      href="/panel/inmuebles"
                      texto="Gestionar inmuebles"
                    />

                    <Acceso
                      href="/panel/paquetes"
                      texto="Paquetes y precios"
                    />

                    <Acceso
                      href="/panel/cotizaciones"
                      texto="Cotizaciones"
                    />

                    <Acceso
                      href="/panel/agenda"
                      texto="Consultar agenda"
                    />
                  </div>
                </section>

                <section className="rounded-3xl border border-amber-300/20 bg-amber-300/5 p-7">
                  <p className="text-xs font-black uppercase tracking-widest text-amber-300">
                    CertezaHabitacional
                    v2.0
                  </p>

                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Flujo comercial:
                    cliente → inmueble →
                    paquete → cotización →
                    agenda → inspección.
                  </p>
                </section>
              </>
            ) : (
              <>
                <section className="rounded-3xl bg-cyan-300 p-7 text-slate-950">
                  <p className="text-xs font-black uppercase tracking-[0.25em]">
                    Índice general
                  </p>

                  <p className="mt-7 text-7xl font-black">
                    {ishPromedio}
                  </p>

                  <p className="mt-2 text-xl font-black">
                    ISH promedio
                  </p>

                  <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-950/20">
                    <div
                      className="h-full rounded-full bg-slate-950"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            Number(
                              ishPromedio,
                            ),
                          ),
                        )}%`,
                      }}
                    />
                  </div>
                </section>

                <section className="rounded-3xl border border-white/10 bg-slate-900 p-7">
                  <p className="text-sm font-bold text-slate-400">
                    Certificados revocados
                  </p>

                  <p className="mt-3 text-4xl font-black text-rose-300">
                    {
                      certificadosRevocados
                    }
                  </p>

                  <Link
                    href="/certificados"
                    className="mt-5 inline-block text-sm font-bold text-cyan-300"
                  >
                    Revisar certificados →
                  </Link>
                </section>

                <section className="rounded-3xl border border-white/10 bg-slate-900 p-7">
                  <h2 className="text-lg font-black">
                    Accesos rápidos
                  </h2>

                  <div className="mt-5 space-y-3">
                    <Acceso
                      href="/panel/inspecciones"
                      texto="Ver inspecciones"
                    />

                    <Acceso
                      href="/panel/agenda"
                      texto="Consultar agenda"
                    />

                    <Acceso
                      href="/panel/paquetes"
                      texto="Paquetes y precios"
                    />

                    <Acceso
                      href="/panel/cotizaciones"
                      texto="Cotizaciones"
                    />

                    <Acceso
                      href="/panel/auditoria"
                      texto="Revisar auditoría"
                    />

                    <Acceso
                      href="/panel/configuracion"
                      texto="Configuración"
                    />
                  </div>
                </section>
              </>
            )}
          </aside>
        </section>

        {/* DISTRIBUCIONES */}
        <section
          className={`mt-8 grid gap-8 ${
            esCoordinador
              ? "xl:grid-cols-1"
              : "xl:grid-cols-3"
          }`}
        >
          <Distribucion
            titulo="Inspecciones por estado"
            items={distribucionEstados}
          />

          {!esCoordinador && (
            <>
              <Distribucion
                titulo="Hallazgos por clasificación"
                items={
                  distribucionHallazgos
                }
              />

              <Distribucion
                titulo="Semáforo habitacional"
                items={
                  distribucionSemaforo
                }
              />
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function etiquetaClasificacion(
  clasificacion: ClasificacionHallazgo,
) {
  switch (clasificacion) {
    case ClasificacionHallazgo.C:
      return "Conformes";

    case ClasificacionHallazgo.O:
      return "Observaciones";

    case ClasificacionHallazgo.NC:
      return "No conformes";

    case ClasificacionHallazgo.CR:
      return "Críticos";

    case ClasificacionHallazgo.NA:
      return "No aplica";

    default:
      return clasificacion;
  }
}

function BotonNavegacion({
  href,
  texto,
}: {
  href: string;
  texto: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-full border border-white/15 px-5 py-3 font-bold transition hover:border-cyan-300 hover:text-cyan-300"
    >
      {texto}
    </Link>
  );
}

function Metrica({
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
        {String(valor).padStart(
          2,
          "0",
        )}
      </p>

      <p className="mt-2 text-xs text-slate-600">
        {detalle}
      </p>
    </article>
  );
}

function Acceso({
  href,
  texto,
}: {
  href: string;
  texto: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold transition hover:text-cyan-300"
    >
      {texto}
    </Link>
  );
}

function Distribucion({
  titulo,
  items,
}: {
  titulo: string;
  items: Array<{
    etiqueta: string;
    valor: number;
    porcentaje: number;
  }>;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-slate-900 p-7">
      <h2 className="text-xl font-black">
        {titulo}
      </h2>

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          No hay información
          disponible.
        </p>
      ) : (
        <div className="mt-7 space-y-5">
          {items.map((item) => (
            <div key={item.etiqueta}>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-bold text-slate-300">
                  {item.etiqueta}
                </span>

                <span className="font-black text-cyan-300">
                  {item.valor}
                </span>
              </div>

              <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-950">
                <div
                  className="h-full rounded-full bg-cyan-400"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        item.porcentaje,
                      ),
                    )}%`,
                  }}
                />
              </div>

              <p className="mt-1 text-right text-xs text-slate-600">
                {item.porcentaje}%
              </p>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}