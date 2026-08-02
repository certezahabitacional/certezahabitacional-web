import {
  EstadoInspeccion,
} from "@prisma/client";
import { obtenerInspectorActual } from "@/lib/inspector-actual";
import { prisma } from "@/lib/prisma";

export default async function InspectorPage() {
  const inspector =
    await obtenerInspectorActual();

  const inspecciones =
    await prisma.inspeccion.findMany({
      where: {
        inspectorId: inspector.id,
      },

      include: {
        cliente: {
          select: {
            nombre: true,
            telefono: true,
          },
        },

        inmueble: true,

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
          {inspector.usuario.nombre}
        </h1>

        <p className="mt-3 max-w-2xl">
          Consulta tus inspecciones asignadas,
          fechas programadas y avance de cada
          expediente.
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
            asignadas a tu perfil.
          </p>
        </header>

        {inspecciones.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-lg font-black">
              No tienes inspecciones asignadas
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Cuando el administrador te asigne
              una inspección aparecerá en esta
              pantalla.
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
                      {
                        inspeccion.cliente
                          .nombre
                      }
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      {inspeccion.inmueble
                        ?.alias ??
                        inspeccion.tipoInmueble}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {
                        inspeccion.direccion
                      }
                      , {inspeccion.ciudad}
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