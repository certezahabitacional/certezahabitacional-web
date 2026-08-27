import Link from "next/link";
import {
  ClasificacionHallazgo,
  EstadoInspeccion,
  Prisma,
  RolUsuario,
} from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function PanelPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const usuarioActual = await prisma.usuario.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      nombre: true,
      rol: true,
      activo: true,
      zonaId: true,
    },
  });

  if (!usuarioActual || !usuarioActual.activo) {
    redirect("/acceso");
  }

  const rol = usuarioActual.rol;

  const esDirector = rol === RolUsuario.DIRECTOR;
  const esAdministrador =
    rol === RolUsuario.ADMINISTRADOR;
  const esGerente = rol === RolUsuario.GERENTE;
  const esCoordinador =
    rol === RolUsuario.COORDINADOR;

  const tieneAccesoPanel =
    esDirector ||
    esAdministrador ||
    esGerente ||
    esCoordinador;

  if (!tieneAccesoPanel) {
    redirect("/acceso");
  }

  let alcanceInspecciones: Prisma.InspeccionWhereInput = {};

  if (esGerente) {
    if (!usuarioActual.zonaId) {
      alcanceInspecciones = {
        id: "__SIN_ALCANCE__",
      };
    } else {
      alcanceInspecciones = {
        OR: [
          {
            zonaId: usuarioActual.zonaId,
          },
          {
            zonaId: null,
            inspector: {
              usuario: {
                zonaId: usuarioActual.zonaId,
              },
            },
          },
        ],
      };
    }
  }

  if (esCoordinador) {
    alcanceInspecciones = {
      inspector: {
        usuario: {
          coordinadorId: usuarioActual.id,
        },
      },
    };
  }

  const [
    inspeccionesPorEstado,
    recientes,
    clientes,
  ] = await Promise.all([
    prisma.inspeccion.groupBy({
      by: ["estado"],
      where: alcanceInspecciones,
      _count: {
        _all: true,
      },
    }),

    prisma.inspeccion.findMany({
      where: alcanceInspecciones,
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
      take: esAdministrador ? 4 : 6,
    }),

    esDirector || esAdministrador
      ? prisma.cliente.count()
      : Promise.resolve(0),
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

  if (esDirector) {
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
        (item) =>
          item.vigente === false,
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

  const indicadores =
    esDirector
      ? [
          {
            titulo: "Inspecciones activas",
            valor: activas,
            detalle: "Actualmente en proceso",
          },
          {
            titulo: "Programadas",
            valor: programadas,
            detalle: "Pendientes de iniciar",
          },
          {
            titulo: "Reportes pendientes",
            valor: reportesPendientes,
            detalle: "Por completar o emitir",
          },
          {
            titulo: "Clientes registrados",
            valor: clientes,
            detalle: "Base total de clientes",
          },
          {
            titulo: "Hallazgos críticos",
            valor: criticos,
            detalle: "Críticos sin resolver",
          },
          {
            titulo: "Certificados emitidos",
            valor: certificadosEmitidos,
            detalle: "Total histórico",
          },
        ]
      : esAdministrador
        ? [
            {
              titulo: "Inspecciones activas",
              valor: activas,
              detalle: "Seguimiento administrativo",
            },
            {
              titulo: "Programadas",
              valor: programadas,
              detalle: "Servicios agendados",
            },
            {
              titulo: "Reportes pendientes",
              valor: reportesPendientes,
              detalle: "Seguimiento del proceso",
            },
            {
              titulo: "Clientes registrados",
              valor: clientes,
              detalle: "Base total de clientes",
            },
          ]
        : [
            {
              titulo: "Inspecciones activas",
              valor: activas,
              detalle: "Dentro de tu alcance",
            },
            {
              titulo: "Programadas",
              valor: programadas,
              detalle: "Dentro de tu alcance",
            },
            {
              titulo: "Reportes pendientes",
              valor: reportesPendientes,
              detalle: esGerente
                ? "Pendientes de control o aprobación"
                : "Pendientes de revisión técnica",
            },
          ];

  const tituloPanel =
    esDirector
      ? "Dashboard ejecutivo"
      : esAdministrador
        ? "Panel de administración"
        : esGerente
          ? "Panel de gerencia"
          : "Panel de coordinación técnica";

  const descripcionPanel =
    esDirector
      ? "Resumen operativo, control, auditoría y estado general de la plataforma."
      : esAdministrador
        ? "Operación administrativa y comercial, clientes, inmuebles, cotizaciones y seguimiento."
        : esGerente
          ? "Control operativo de tu zona, asignación, aprobaciones y seguimiento de Coordinadores e Inspectores."
          : "Revisión técnica y seguimiento de los Inspectores bajo tu coordinación.";

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
              Certeza Habitacional
            </p>

            <h1 className="mt-2 text-4xl font-black">
              {tituloPanel}
            </h1>

            <p className="mt-2 text-slate-400">
              {descripcionPanel}
            </p>

            <p className="mt-2 text-xs font-bold uppercase tracking-widest text-amber-300">
              Sesión: {rol}
            </p>
          </div>

          <nav className="flex flex-wrap gap-3">
            {esAdministrador && (
              <>
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
                <BotonNavegacion
                  href="/panel/paquetes"
                  texto="Paquetes"
                />
                <BotonNavegacion
                  href="/panel/cotizaciones"
                  texto="Cotizaciones"
                />
                <BotonNavegacion
                  href="/panel/inspecciones"
                  texto="Inspecciones"
                />
                <BotonNavegacion
                  href="/panel/inspectores"
                  texto="Inspectores"
                />
                <BotonNavegacion
                  href="/panel/usuarios"
                  texto="Usuarios"
                />
              </>
            )}

            {esGerente && (
              <>
                <BotonNavegacion
                  href="/panel/inspecciones"
                  texto="Inspecciones"
                />
                <BotonNavegacion
                  href="/panel/agenda"
                  texto="Agenda"
                />
                <BotonNavegacion
                  href="/panel/inspectores"
                  texto="Inspectores"
                />
                <BotonNavegacion
                  href="/panel/paquetes"
                  texto="Paquetes"
                />
                <BotonNavegacion
                  href="/panel/cotizaciones"
                  texto="Cotizaciones"
                />
                <BotonNavegacion
                  href="/panel/auditoria"
                  texto="Auditoría"
                />
                <Link
                  href="/panel/inspecciones/nueva"
                  className="rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950 transition hover:bg-cyan-300"
                >
                  Nueva inspección
                </Link>
              </>
            )}

            {esCoordinador && (
              <>
                <BotonNavegacion
                  href="/panel/inspecciones"
                  texto="Inspecciones"
                />
                <BotonNavegacion
                  href="/panel/agenda"
                  texto="Agenda"
                />
                <BotonNavegacion
                  href="/panel/inspectores"
                  texto="Inspectores"
                />
              </>
            )}

            {esDirector && (
              <>
                <BotonNavegacion
                  href="/panel/inspecciones"
                  texto="Inspecciones"
                />
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
                <BotonNavegacion
                  href="/panel/paquetes"
                  texto="Paquetes"
                />
                <BotonNavegacion
                  href="/panel/cotizaciones"
                  texto="Cotizaciones"
                />
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
                <BotonNavegacion
                  href="/panel/configuracion"
                  texto="Configuración"
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

        <section
          className={`mt-8 grid gap-5 sm:grid-cols-2 ${
            esDirector
              ? "xl:grid-cols-3"
              : indicadores.length === 4
                ? "xl:grid-cols-4"
                : "xl:grid-cols-3"
          }`}
        >
          {indicadores.map(
            (indicador) => (
              <Metrica
                key={indicador.titulo}
                titulo={indicador.titulo}
                valor={indicador.valor}
                detalle={indicador.detalle}
              />
            ),
          )}
        </section>

        <section className="mt-8 grid gap-8 xl:grid-cols-[1fr_340px]">
          <article className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
            <header className="flex items-center justify-between border-b border-white/10 p-6">
              <div>
                <h2 className="text-xl font-black">
                  Actividad reciente
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Últimas inspecciones actualizadas dentro de tu alcance.
                </p>
              </div>

              <Link
                href="/panel/inspecciones"
                className="text-sm font-bold text-cyan-300"
              >
                Ver todas →
              </Link>
            </header>

            {recientes.length === 0 ? (
              <p className="p-12 text-center text-slate-400">
                Aún no hay inspecciones registradas dentro de tu alcance.
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
                        {esDirector || esAdministrador
                          ? "Cliente"
                          : "Referencia"}
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
                          key={inspeccion.id}
                          className="border-t border-white/10"
                        >
                          <td className="px-6 py-5">
                            <Link
                              href={`/panel/inspecciones/${inspeccion.id}`}
                              className="font-black text-cyan-300"
                            >
                              {inspeccion.folio}
                            </Link>
                          </td>

                          <td className="px-6 py-5 font-bold">
                            {esDirector ||
                            esAdministrador
                              ? inspeccion.cliente.nombre
                              : "Expediente operativo"}
                          </td>

                          <td className="px-6 py-5 text-slate-400">
                            <p>
                              {inspeccion.tipoInmueble}
                            </p>

                            <p className="mt-1 text-xs text-slate-600">
                              {inspeccion.ciudad}
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
                                ).toFixed(0)
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

          <aside className="space-y-5">
            {esAdministrador && (
              <>
                <section className="rounded-3xl bg-cyan-300 p-7 text-slate-950">
                  <p className="text-xs font-black uppercase tracking-[0.25em]">
                    Administración
                  </p>

                  <p className="mt-6 text-4xl font-black">
                    {programadas}
                  </p>

                  <p className="mt-2 font-black">
                    inspecciones programadas
                  </p>

                  <p className="mt-4 text-sm font-semibold text-slate-800">
                    Gestiona la operación comercial y administrativa sin sustituir las funciones técnicas u operativas de otros roles.
                  </p>
                </section>

                <section className="rounded-3xl border border-white/10 bg-slate-900 p-7">
                  <h2 className="text-lg font-black">
                    Operación administrativa
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
                      href="/panel/usuarios"
                      texto="Gestionar usuarios"
                    />
                    <Acceso
                      href="/panel/inspectores"
                      texto="Administrar Inspectores"
                    />
                  </div>
                </section>
              </>
            )}

            {esGerente && (
              <>
                <section className="rounded-3xl bg-cyan-300 p-7 text-slate-950">
                  <p className="text-xs font-black uppercase tracking-[0.25em]">
                    Gerencia
                  </p>

                  <p className="mt-6 text-4xl font-black">
                    {reportesPendientes}
                  </p>

                  <p className="mt-2 font-black">
                    reporte(s) pendiente(s)
                  </p>

                  <p className="mt-4 text-sm font-semibold text-slate-800">
                    Controla la operación de su zona, asigna cuando corresponda y participa en el flujo de revisión y aprobación.
                  </p>
                </section>

                <section className="rounded-3xl border border-white/10 bg-slate-900 p-7">
                  <h2 className="text-lg font-black">
                    Control de gerencia
                  </h2>

                  <div className="mt-5 space-y-3">
                    <Acceso
                      href="/panel/inspecciones"
                      texto="Revisar inspecciones"
                    />
                    <Acceso
                      href="/panel/agenda"
                      texto="Consultar agenda"
                    />
                    <Acceso
                      href="/panel/inspectores"
                      texto="Inspectores de la zona"
                    />
                    <Acceso
                      href="/panel/auditoria"
                      texto="Auditar Coordinadores e Inspectores"
                    />
                  </div>
                </section>
              </>
            )}

            {esCoordinador && (
              <>
                <section className="rounded-3xl bg-cyan-300 p-7 text-slate-950">
                  <p className="text-xs font-black uppercase tracking-[0.25em]">
                    Coordinación técnica
                  </p>

                  <p className="mt-6 text-4xl font-black">
                    {reportesPendientes}
                  </p>

                  <p className="mt-2 font-black">
                    reporte(s) pendiente(s) de revisión
                  </p>

                  <p className="mt-4 text-sm font-semibold text-slate-800">
                    Revisa expedientes de los Inspectores bajo tu coordinación y registra el visto bueno técnico cuando corresponda.
                  </p>
                </section>

                <section className="rounded-3xl border border-white/10 bg-slate-900 p-7">
                  <h2 className="text-lg font-black">
                    Revisión técnica
                  </h2>

                  <div className="mt-5 space-y-3">
                    <Acceso
                      href="/panel/inspecciones"
                      texto="Revisar inspecciones"
                    />
                    <Acceso
                      href="/panel/agenda"
                      texto="Consultar agenda"
                    />
                    <Acceso
                      href="/panel/inspectores"
                      texto="Mis Inspectores"
                    />
                  </div>
                </section>
              </>
            )}

            {esDirector && (
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
                            Number(ishPromedio),
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
                    {certificadosRevocados}
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
                    Control directivo
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
                      href="/panel/usuarios"
                      texto="Gestionar usuarios"
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

        <section
          className={`mt-8 grid gap-8 ${
            esDirector
              ? "xl:grid-cols-3"
              : "xl:grid-cols-1"
          }`}
        >
          <Distribucion
            titulo="Inspecciones por estado"
            items={distribucionEstados}
          />

          {esDirector && (
            <>
              <Distribucion
                titulo="Hallazgos por clasificación"
                items={distribucionHallazgos}
              />

              <Distribucion
                titulo="Semáforo habitacional"
                items={distribucionSemaforo}
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
          No hay información disponible.
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
