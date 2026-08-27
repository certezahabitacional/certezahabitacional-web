import Link from "next/link";
import {
  EstadoInspeccion,
  RolUsuario,
} from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function InspectorPage() {
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
      email: true,
      rol: true,
      activo: true,
      inspector: {
        select: {
          id: true,
          activo: true,
          telefono: true,
          especialidad: true,
          ciudad: true,
        },
      },
    },
  });

  if (
    !usuarioActual ||
    !usuarioActual.activo ||
    usuarioActual.rol !== RolUsuario.INSPECTOR ||
    !usuarioActual.inspector ||
    !usuarioActual.inspector.activo
  ) {
    redirect("/acceso");
  }

  const inspecciones =
    await prisma.inspeccion.findMany({
      where: {
        inspectorId:
          usuarioActual.inspector.id,
      },

      include: {
        inmueble: {
          select: {
            id: true,
            alias: true,
            tipo: true,
            direccion: true,
            colonia: true,
            ciudad: true,
            estado: true,
          },
        },

        _count: {
          select: {
            hallazgos: true,
            fotografias: true,
          },
        },
      },

      orderBy: [
        {
          fechaProgramada: "asc",
        },
        {
          folio: "asc",
        },
      ],
    });

  const programadas =
    inspecciones.filter(
      (inspeccion) =>
        inspeccion.estado ===
        EstadoInspeccion.PROGRAMADA,
    ).length;

  const enProceso =
    inspecciones.filter(
      (inspeccion) =>
        inspeccion.estado ===
        EstadoInspeccion.EN_PROCESO,
    ).length;

  const pendientesReporte =
    inspecciones.filter(
      (inspeccion) =>
        inspeccion.estado ===
        EstadoInspeccion.REPORTE_PENDIENTE,
    ).length;

  const finalizadas =
    inspecciones.filter(
      (inspeccion) =>
        inspeccion.estado ===
        EstadoInspeccion.FINALIZADA,
    ).length;

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <section className="rounded-3xl bg-cyan-300 p-8 text-slate-950">
        <p className="text-xs font-black uppercase tracking-[0.28em]">
          Bienvenido
        </p>

        <h1 className="mt-3 text-4xl font-black">
          {usuarioActual.nombre}
        </h1>

        <p className="mt-3 max-w-2xl">
          Consulta únicamente tus inspecciones
          asignadas y ejecuta las actividades
          propias de tu función como Inspector.
        </p>
      </section>

      <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Resumen
          titulo="Programadas"
          valor={programadas}
        />

        <Resumen
          titulo="En proceso"
          valor={enProceso}
        />

        <Resumen
          titulo="Reporte pendiente"
          valor={pendientesReporte}
        />

        <Resumen
          titulo="Finalizadas"
          valor={finalizadas}
        />
      </section>

      <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
        <header className="border-b border-white/10 p-7">
          <h2 className="text-2xl font-black">
            Mis inspecciones
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Solo se muestran las inspecciones
            asignadas directamente a tu perfil.
          </p>
        </header>

        {inspecciones.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-lg font-black">
              No tienes inspecciones asignadas
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Cuando Gerencia o Administración
              te asignen una inspección dentro
              del flujo autorizado, aparecerá
              en esta pantalla.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {inspecciones.map(
              (inspeccion) => (
                <article
                  key={inspeccion.id}
                  className="grid gap-6 p-7 lg:grid-cols-[1fr_auto] lg:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-black">
                        {inspeccion.folio}
                      </h3>

                      <Estado
                        estado={
                          inspeccion.estado
                        }
                      />
                    </div>

                    <p className="mt-3 font-bold text-slate-200">
                      {inspeccion.inmueble
                        ?.alias ??
                        inspeccion.tipoInmueble}
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      {inspeccion.direccion}
                      {inspeccion.inmueble
                        ?.colonia
                        ? `, ${inspeccion.inmueble.colonia}`
                        : ""}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {inspeccion.ciudad}
                      {inspeccion.inmueble
                        ?.estado
                        ? `, ${inspeccion.inmueble.estado}`
                        : ""}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
                      <span>
                        Fecha:{" "}
                        {inspeccion.fechaProgramada.toLocaleString(
                          "es-MX",
                          {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </span>

                      <span>
                        Hallazgos:{" "}
                        {
                          inspeccion._count
                            .hallazgos
                        }
                      </span>

                      <span>
                        Fotografías:{" "}
                        {
                          inspeccion._count
                            .fotografias
                        }
                      </span>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        href={`/panel/inspecciones/${inspeccion.id}`}
                        className="rounded-full border border-white/15 px-4 py-2 text-sm font-black text-cyan-300 transition hover:border-cyan-300"
                      >
                        Ver expediente
                      </Link>

                      {(inspeccion.estado ===
                        EstadoInspeccion.PROGRAMADA ||
                        inspeccion.estado ===
                          EstadoInspeccion.EN_PROCESO) && (
                        <Link
                          href={`/panel/inspecciones/${inspeccion.id}/captura`}
                          className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-300"
                        >
                          {inspeccion.estado ===
                          EstadoInspeccion.PROGRAMADA
                            ? "Iniciar captura"
                            : "Continuar captura"}
                        </Link>
                      )}

                      {inspeccion.estado ===
                        EstadoInspeccion.REPORTE_PENDIENTE && (
                        <span className="rounded-full bg-orange-400/10 px-4 py-2 text-sm font-black text-orange-300">
                          En revisión
                        </span>
                      )}

                      {inspeccion.estado ===
                        EstadoInspeccion.FINALIZADA && (
                        <span className="rounded-full bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-300">
                          Expediente cerrado
                        </span>
                      )}

                      {inspeccion.estado ===
                        EstadoInspeccion.CANCELADA && (
                        <span className="rounded-full bg-rose-400/10 px-4 py-2 text-sm font-black text-rose-300">
                          Cancelada
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-950 px-5 py-4 text-right">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-600">
                      Servicio
                    </p>

                    <p className="mt-2 font-bold text-cyan-300">
                      {
                        inspeccion.tipoServicio
                      }
                    </p>
                  </div>
                </article>
              ),
            )}
          </div>
        )}
      </section>
    </main>
  );
}

function Resumen({
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

function Estado({
  estado,
}: {
  estado: EstadoInspeccion;
}) {
  const estilos: Record<
    EstadoInspeccion,
    string
  > = {
    PROGRAMADA:
      "bg-sky-400/10 text-sky-300",

    EN_PROCESO:
      "bg-amber-400/10 text-amber-300",

    REPORTE_PENDIENTE:
      "bg-orange-400/10 text-orange-300",

    FINALIZADA:
      "bg-emerald-400/10 text-emerald-300",

    CANCELADA:
      "bg-rose-400/10 text-rose-300",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-black ${
        estilos[estado]
      }`}
    >
      {estado.replaceAll("_", " ")}
    </span>
  );
}
