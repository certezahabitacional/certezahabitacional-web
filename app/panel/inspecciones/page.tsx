import Link from "next/link";
import {
  Prisma,
  RolUsuario,
} from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  puede,
  puedeVerExpedienteTecnico,
} from "@/lib/permisos";
import { prisma } from "@/lib/prisma";

const formatoFecha = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function InspeccionesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  /*
   * La base de datos es la fuente de verdad para rol y alcance
   * organizacional. No dependemos únicamente del rol almacenado
   * en la sesiÃ³n.
   */
  const usuarioActual = await prisma.usuario.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      rol: true,
      activo: true,
      zonaId: true,
      inspector: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!usuarioActual || !usuarioActual.activo) {
    redirect("/acceso");
  }

  const rol = usuarioActual.rol;

  /*
   * CLIENTE nunca utiliza el panel interno de inspecciones.
   * Su acceso se realiza exclusivamente desde el portal.
   */
  if (rol === RolUsuario.CLIENTE) {
    redirect("/portal/inspecciones");
  }

  /*
   * Alcance organizacional:
   *
   * DIRECTOR
   *   - Todas las inspecciones.
   *
   * ADMINISTRADOR
   *   - Vista administrativa transversal de las inspecciones.
   *   - NO se le da acceso al expediente técnico.
   *
   * GERENTE
   *   - Inspecciones asignadas a Inspectores adscritos a su Gerencia.
   *
   * COORDINADOR
   *   - Únicamente inspecciones asignadas a Inspectores
   *     que dependan de su coordinación.
   *
   * INSPECTOR
   *   - Únicamente inspecciones asignadas a él.
   *
   * El alcance de Gerencia se determina por la relación jerárquica
   * del Inspector asignado (usuario.gerenteId). Esto evita que dos
   * Gerentes que compartan una misma zona puedan consultar entre sí
   * inspecciones ajenas a su estructura.
   */
  let where: Prisma.InspeccionWhereInput = {
    id: {
      in: [],
    },
  };

  switch (rol) {
    case RolUsuario.DIRECTOR:
    case RolUsuario.ADMINISTRADOR:
      where = {};
      break;

    case RolUsuario.GERENTE:
      where = {
        inspector: {
          usuario: {
            gerenteId: usuarioActual.id,
          },
        },
      };
      break;

    case RolUsuario.COORDINADOR:
      where = {
        inspector: {
          usuario: {
            coordinadorId: usuarioActual.id,
          },
        },
      };
      break;

    case RolUsuario.INSPECTOR:
      if (usuarioActual.inspector?.id) {
        where = {
          inspectorId: usuarioActual.inspector.id,
        };
      }
      break;
  }

  const puedeCrearInspeccion = puede(
    rol,
    "INSPECCION_PROGRAMAR",
  );

  /*
   * ADMINISTRADOR puede consultar el estado administrativo/operativo
   * de la inspección, pero no abrir el expediente técnico.
   */
  const puedeAbrirExpediente =
    puedeVerExpedienteTecnico(rol);

  /*
   * Intencionalmente NO consultamos hallazgos, fotografías, ISH,
   * revisiones ni ningún otro contenido técnico en este listado.
   * Esto evita exponer información técnica al ADMINISTRADOR.
   */
  const inspecciones =
    await prisma.inspeccion.findMany({
      where,
      select: {
        id: true,
        folio: true,
        numeroInspeccion: true,
        tipoInmueble: true,
        direccion: true,
        ciudad: true,
        fechaProgramada: true,
        estado: true,
        zona: {
          select: {
            nombre: true,
            codigo: true,
          },
        },
        inmueble: {
          select: {
            alias: true,
          },
        },
        inspector: {
          select: {
            usuario: {
              select: {
                nombre: true,
              },
            },
          },
        },
      },
      orderBy: {
        fechaProgramada: "desc",
      },
    });

  const resumen = {
    total: inspecciones.length,
    programadas: inspecciones.filter(
      (item) => item.estado === "PROGRAMADA",
    ).length,
    proceso: inspecciones.filter(
      (item) => item.estado === "EN_PROCESO",
    ).length,
    reportePendiente: inspecciones.filter(
      (item) => item.estado === "REPORTE_PENDIENTE",
    ).length,
    finalizadas: inspecciones.filter(
      (item) => item.estado === "FINALIZADA",
    ).length,
    canceladas: inspecciones.filter(
      (item) => item.estado === "CANCELADA",
    ).length,
  };

  const esVistaAdministrativa =
    rol === RolUsuario.ADMINISTRADOR;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <Link
              href="/panel"
              className="text-sm font-bold text-cyan-300"
            >
              ← Panel
            </Link>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-black">
                Inspecciones
              </h1>

              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-300">
                {etiquetaRol(rol)}
              </span>
            </div>

            <p className="mt-1 text-slate-400">
              {esVistaAdministrativa
                ? "Vista administrativa de programación, asignación y estado de las inspecciones."
                : "Programación, expedientes y seguimiento operativo dentro de tu ámbito."}
            </p>

            {rol === RolUsuario.GERENTE && (
              <p className="mt-2 text-sm font-bold text-emerald-300">
                Alcance: inspectores adscritos a tu Gerencia
              </p>
            )}

            {rol === RolUsuario.COORDINADOR && (
              <p className="mt-2 text-sm font-bold text-indigo-300">
                Alcance: inspectores de tu coordinación
              </p>
            )}

            {rol === RolUsuario.INSPECTOR && (
              <p className="mt-2 text-sm font-bold text-amber-300">
                Alcance: únicamente tus inspecciones asignadas
              </p>
            )}

            {esVistaAdministrativa && (
              <div className="mt-4 max-w-3xl rounded-2xl border border-violet-300/20 bg-violet-300/5 px-4 py-3 text-sm leading-6 text-violet-100">
                Administración puede consultar información operativa
                necesaria para sus funciones, pero no tiene acceso al
                expediente técnico, hallazgos, evidencias, ISH ni
                contenido del reporte.
              </div>
            )}
          </div>

          {puedeCrearInspeccion && (
            <Link
              href="/panel/inspecciones/nueva"
              className="rounded-full bg-cyan-400 px-6 py-3 text-center font-black text-slate-950 transition hover:bg-cyan-300"
            >
              Nueva inspección
            </Link>
          )}
        </div>

        <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Tarjeta
            etiqueta="Total"
            valor={resumen.total}
          />
          <Tarjeta
            etiqueta="Programadas"
            valor={resumen.programadas}
          />
          <Tarjeta
            etiqueta="En proceso"
            valor={resumen.proceso}
          />
          <Tarjeta
            etiqueta="Reporte pendiente"
            valor={resumen.reportePendiente}
          />
          <Tarjeta
            etiqueta="Finalizadas"
            valor={resumen.finalizadas}
          />
          <Tarjeta
            etiqueta="Canceladas"
            valor={resumen.canceladas}
          />
        </section>

        <section className="mt-7 overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
          {inspecciones.length === 0 ? (
            <div className="p-14 text-center">
              <p className="font-black text-slate-300">
                No hay inspecciones disponibles.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                No existen inspecciones dentro del alcance
                correspondiente a tu usuario.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {inspecciones.map((inspeccion) => {
                const contenido = (
                  <>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-cyan-300">
                          {inspeccion.folio}
                        </p>

                        <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-[11px] font-black text-cyan-200">
                          V{inspeccion.numeroInspeccion}
                        </span>
                      </div>

                      {inspeccion.zona && (
                        <p className="mt-2 text-xs font-bold text-slate-500">
                          {inspeccion.zona.nombre} ·{" "}
                          {inspeccion.zona.codigo}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="font-black">
                        {inspeccion.inmueble?.alias ??
                          inspeccion.tipoInmueble}
                      </p>

                      <p className="mt-1 text-sm text-slate-400">
                        {inspeccion.direccion},{" "}
                        {inspeccion.ciudad}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-bold">
                        {formatoFecha.format(
                          inspeccion.fechaProgramada,
                        )}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Inspector:{" "}
                        {inspeccion.inspector?.usuario
                          .nombre ?? "Sin asignar"}
                      </p>
                    </div>

                    <div className="md:text-right">
                      <Estado
                        estado={inspeccion.estado}
                      />

                      {esVistaAdministrativa && (
                        <p className="mt-2 text-xs font-bold text-violet-300">
                          Consulta administrativa
                        </p>
                      )}
                    </div>
                  </>
                );

                if (!puedeAbrirExpediente) {
                  return (
                    <div
                      key={inspeccion.id}
                      className="grid gap-4 p-6 md:grid-cols-[1.1fr_1.5fr_1fr_auto] md:items-center"
                    >
                      {contenido}
                    </div>
                  );
                }

                return (
                  <Link
                    key={inspeccion.id}
                    href={`/panel/inspecciones/${inspeccion.id}`}
                    className="grid gap-4 p-6 transition hover:bg-white/[0.03] md:grid-cols-[1.1fr_1.5fr_1fr_auto] md:items-center"
                  >
                    {contenido}
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Tarjeta({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: number;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900 p-5">
      <p className="text-sm font-bold text-slate-400">
        {etiqueta}
      </p>

      <p className="mt-2 text-3xl font-black text-cyan-300">
        {String(valor).padStart(2, "0")}
      </p>
    </div>
  );
}

function Estado({
  estado,
}: {
  estado: string;
}) {
  const clase =
    estado === "FINALIZADA"
      ? "bg-emerald-400/15 text-emerald-300"
      : estado === "CANCELADA"
        ? "bg-rose-400/15 text-rose-300"
        : estado === "EN_PROCESO"
          ? "bg-amber-400/15 text-amber-300"
          : estado === "REPORTE_PENDIENTE"
            ? "bg-violet-400/15 text-violet-300"
            : "bg-sky-400/15 text-sky-300";

  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-black ${clase}`}
    >
      {etiquetaEstado(estado)}
    </span>
  );
}

function etiquetaEstado(
  estado: string,
): string {
  switch (estado) {
    case "PROGRAMADA":
      return "PROGRAMADA";
    case "EN_PROCESO":
      return "EN PROCESO";
    case "REPORTE_PENDIENTE":
      return "REPORTE PENDIENTE";
    case "FINALIZADA":
      return "FINALIZADA";
    case "CANCELADA":
      return "CANCELADA";
    default:
      return estado.replaceAll("_", " ");
  }
}

const ETIQUETAS_ROL: Record<RolUsuario, string> = {
  [RolUsuario.DIRECTOR]: "DIRECTOR",
  [RolUsuario.ADMINISTRADOR]: "ADMINISTRADOR",
  [RolUsuario.GERENTE]: "GERENTE",
  [RolUsuario.COORDINADOR]: "COORDINADOR",
  [RolUsuario.INSPECTOR]: "INSPECTOR",
  [RolUsuario.CLIENTE]: "CLIENTE",
};

function etiquetaRol(rol: RolUsuario): string {
  return ETIQUETAS_ROL[rol];
}
