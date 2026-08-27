import Link from "next/link";
import {
  EstadoInspeccion,
  RolUsuario,
} from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function formatoFecha(zonaHoraria: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: zonaHoraria,
  });
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

  const usuarioActual = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      rol: true,
      activo: true,
      zonaId: true,
      zona: {
        select: {
          nombre: true,
          codigo: true,
          zonaHoraria: true,
        },
      },
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

  if (usuarioActual.rol === RolUsuario.CLIENTE) {
    redirect("/portal/inspecciones");
  }

  const params = await searchParams;

  /*
   * Alcance de agenda:
   * DIRECTOR        -> global.
   * ADMINISTRADOR   -> global, solo lectura operativa.
   * GERENTE         -> Inspectores adscritos a su Gerencia.
   * COORDINADOR     -> Inspectores bajo su coordinación.
   * INSPECTOR       -> únicamente sus inspecciones.
   */
  let alcanceInspecciones: Record<string, unknown> = {};

  switch (usuarioActual.rol) {
    case RolUsuario.DIRECTOR:
    case RolUsuario.ADMINISTRADOR:
      alcanceInspecciones = {};
      break;

    case RolUsuario.GERENTE:
      alcanceInspecciones = {
        inspector: {
          usuario: {
            gerenteId: usuarioActual.id,
          },
        },
      };
      break;

    case RolUsuario.COORDINADOR:
      alcanceInspecciones = {
        inspector: {
          usuario: {
            coordinadorId: usuarioActual.id,
          },
        },
      };
      break;

    case RolUsuario.INSPECTOR:
      if (!usuarioActual.inspector?.id) {
        redirect(
          `/panel?error=${encodeURIComponent(
            "Tu usuario no tiene un perfil de Inspector asociado.",
          )}`,
        );
      }

      alcanceInspecciones = {
        inspectorId: usuarioActual.inspector.id,
      };
      break;

    default:
      redirect("/acceso");
  }

  /*
   * Se muestran todas las inspecciones PROGRAMADAS y EN PROCESO
   * dentro del alcance del usuario. No usamos medianoche del servidor
   * como corte porque el sistema opera en varias zonas horarias.
   */
  const inspecciones = await prisma.inspeccion.findMany({
    where: {
      ...alcanceInspecciones,
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
      zona: {
        select: {
          nombre: true,
          codigo: true,
          zonaHoraria: true,
        },
      },
    },
    orderBy: {
      fechaProgramada: "asc",
    },
    take: 200,
  });

  const programadas = inspecciones.filter(
    (inspeccion) =>
      inspeccion.estado === EstadoInspeccion.PROGRAMADA,
  ).length;

  const enProceso = inspecciones.filter(
    (inspeccion) =>
      inspeccion.estado === EstadoInspeccion.EN_PROCESO,
  ).length;

  const sinInspector = inspecciones.filter(
    (inspeccion) => !inspeccion.inspectorId,
  ).length;

  const alcanceTexto =
    usuarioActual.rol === RolUsuario.DIRECTOR
      ? "Agenda global de Dirección"
      : usuarioActual.rol === RolUsuario.ADMINISTRADOR
        ? "Agenda global para seguimiento administrativo"
        : usuarioActual.rol === RolUsuario.GERENTE
          ? "Agenda de los Inspectores adscritos a tu Gerencia"
          : usuarioActual.rol === RolUsuario.COORDINADOR
            ? "Agenda de tus Inspectores"
            : "Tu agenda de inspecciones";

  const puedeCrear =
    usuarioActual.rol === RolUsuario.GERENTE ||
    usuarioActual.rol === RolUsuario.DIRECTOR;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <Link
              href={
                usuarioActual.rol === RolUsuario.INSPECTOR
                  ? "/inspector"
                  : "/panel"
              }
              className="text-sm font-black text-cyan-300"
            >
              {usuarioActual.rol === RolUsuario.INSPECTOR
                ? "← Inspector"
                : "← Panel"}
            </Link>

            <p className="mt-7 text-xs font-black uppercase tracking-[0.3em] text-amber-300">
              CertezaHabitacional v2.0
            </p>

            <h1 className="mt-3 text-4xl font-black">
              Agenda operativa
            </h1>

            <p className="mt-2 text-slate-400">
              {alcanceTexto}. La programación y asignación corresponden a
              Gerencia o Dirección; los demás roles consultan la agenda dentro
              de su alcance.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {puedeCrear && (
              <Link
                href="/panel/inspecciones/nueva"
                className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950"
              >
                Nueva inspección
              </Link>
            )}

            <Link
              href="/panel/inspecciones"
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-black hover:border-cyan-300 hover:text-cyan-300"
            >
              Inspecciones
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
            titulo="Programadas"
            valor={programadas}
            detalle="Servicios pendientes de iniciar"
          />

          <Indicador
            titulo="En proceso"
            valor={enProceso}
            detalle="Servicios actualmente iniciados"
          />

          <Indicador
            titulo="Sin Inspector"
            valor={sinInspector}
            detalle="Pendientes de asignación"
          />
        </section>

        <section className="mt-12">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">
                Calendario operativo
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Inspecciones activas
              </h2>
            </div>

            <p className="text-sm font-bold text-slate-500">
              {inspecciones.length} registro
              {inspecciones.length === 1 ? "" : "s"} en tu alcance
            </p>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
            {inspecciones.length === 0 ? (
              <div className="p-16 text-center">
                <p className="text-2xl font-black">
                  Sin servicios programados
                </p>

                <p className="mt-2 text-slate-400">
                  No existen inspecciones PROGRAMADAS o EN PROCESO dentro de tu
                  alcance actual.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {inspecciones.map((inspeccion) => {
                  const zonaHoraria =
                    inspeccion.zona?.zonaHoraria ??
                    inspeccion.zonaHoraria ??
                    "America/Ciudad_Juarez";

                  return (
                    <article
                      key={inspeccion.id}
                      className="grid gap-5 p-6 md:grid-cols-[230px_1fr_1fr_auto] md:items-center"
                    >
                      <div>
                        <p className="font-black text-cyan-300">
                          {inspeccion.folio}
                        </p>

                        <p className="mt-2 text-sm capitalize text-slate-400">
                          {formatoFecha(zonaHoraria).format(
                            inspeccion.fechaProgramada,
                          )}
                        </p>

                        <p className="mt-1 text-xs font-bold text-slate-600">
                          {inspeccion.zona?.nombre ??
                            inspeccion.ciudad}
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

                        <p
                          className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-black ${
                            inspeccion.estado ===
                            EstadoInspeccion.EN_PROCESO
                              ? "bg-amber-400/10 text-amber-300"
                              : "bg-sky-400/10 text-sky-300"
                          }`}
                        >
                          {inspeccion.estado.replaceAll("_", " ")}
                        </p>
                      </div>

                      <Link
                        href={
                          usuarioActual.rol === RolUsuario.ADMINISTRADOR
                            ? "/panel/inspecciones"
                            : usuarioActual.rol === RolUsuario.INSPECTOR
                              ? `/inspector`
                              : `/panel/inspecciones/${inspeccion.id}`
                        }
                        className="rounded-full bg-cyan-400 px-5 py-3 text-center text-sm font-black text-slate-950"
                      >
                        {usuarioActual.rol === RolUsuario.ADMINISTRADOR
                          ? "Ver listado"
                          : "Abrir"}
                      </Link>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {usuarioActual.rol === RolUsuario.ADMINISTRADOR && (
          <section className="mt-8 rounded-3xl border border-violet-400/20 bg-violet-400/5 p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
              Seguimiento administrativo
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-300">
              Administración puede consultar la agenda global para dar
              seguimiento a pagos, documentación, clientes y requisitos
              administrativos, pero no ejecuta funciones técnicas ni programa
              inspecciones desde esta pantalla.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/panel/cotizaciones"
                className="rounded-full border border-white/15 px-5 py-3 text-sm font-black hover:border-violet-300 hover:text-violet-300"
              >
                Cotizaciones
              </Link>

              <Link
                href="/panel/clientes"
                className="rounded-full border border-white/15 px-5 py-3 text-sm font-black hover:border-violet-300 hover:text-violet-300"
              >
                Clientes
              </Link>

              <Link
                href="/panel/inmuebles"
                className="rounded-full border border-white/15 px-5 py-3 text-sm font-black hover:border-violet-300 hover:text-violet-300"
              >
                Inmuebles
              </Link>
            </div>
          </section>
        )}
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
