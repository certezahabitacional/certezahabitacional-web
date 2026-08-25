import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
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

  const rol = session.user.role;
  const puedeCrearInspeccion =
    rol === "ADMINISTRADOR" || rol === "DIRECTOR";

  const inspecciones = await prisma.inspeccion.findMany({
    include: {
      cliente: { select: { nombre: true } },
      inmueble: true,
      inspector: {
        include: {
          usuario: {
            select: { nombre: true },
          },
        },
      },
      _count: {
        select: {
          hallazgos: true,
          fotografias: true,
        },
      },
    },
    orderBy: { fechaProgramada: "desc" },
  });

  const resumen = {
    total: inspecciones.length,
    programadas: inspecciones.filter(
      (item) => item.estado === "PROGRAMADA",
    ).length,
    proceso: inspecciones.filter(
      (item) => item.estado === "EN_PROCESO",
    ).length,
    finalizadas: inspecciones.filter(
      (item) => item.estado === "FINALIZADA",
    ).length,
  };

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

            <h1 className="mt-2 text-3xl font-black">
              Inspecciones
            </h1>

            <p className="mt-1 text-slate-400">
              Programación, expedientes y seguimiento operativo.
            </p>
          </div>

          {puedeCrearInspeccion && (
            <Link
              href="/panel/inspecciones/nueva"
              className="rounded-full bg-cyan-400 px-6 py-3 text-center font-black text-slate-950"
            >
              Nueva inspección
            </Link>
          )}
        </div>

        <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tarjeta etiqueta="Total" valor={resumen.total} />
          <Tarjeta
            etiqueta="Programadas"
            valor={resumen.programadas}
          />
          <Tarjeta
            etiqueta="En proceso"
            valor={resumen.proceso}
          />
          <Tarjeta
            etiqueta="Finalizadas"
            valor={resumen.finalizadas}
          />
        </section>

        <section className="mt-7 overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
          {inspecciones.length === 0 ? (
            <p className="p-14 text-center text-slate-400">
              No hay inspecciones registradas.
            </p>
          ) : (
            <div className="divide-y divide-white/10">
              {inspecciones.map((inspeccion) => (
                <Link
                  key={inspeccion.id}
                  href={`/panel/inspecciones/${inspeccion.id}`}
                  className="grid gap-4 p-6 transition hover:bg-white/[0.03] md:grid-cols-[1.1fr_1.5fr_1fr_auto] md:items-center"
                >
                  <div>
                    <p className="font-black text-cyan-300">
                      {inspeccion.folio}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {inspeccion.cliente.nombre}
                    </p>
                  </div>

                  <div>
                    <p className="font-black">
                      {inspeccion.inmueble?.alias ??
                        inspeccion.tipoInmueble}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {inspeccion.direccion}, {inspeccion.ciudad}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-bold">
                      {formatoFecha.format(
                        inspeccion.fechaProgramada,
                      )}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {inspeccion.inspector?.usuario.nombre ??
                        "Sin asignar"}
                    </p>
                  </div>

                  <div className="text-right">
                    <Estado estado={inspeccion.estado} />
                    <p className="mt-2 text-xs text-slate-500">
                      {inspeccion._count.hallazgos} hallazgos ·{" "}
                      {inspeccion._count.fotografias} fotos
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

function Estado({ estado }: { estado: string }) {
  const clase =
    estado === "FINALIZADA"
      ? "bg-emerald-400/15 text-emerald-300"
      : estado === "CANCELADA"
        ? "bg-rose-400/15 text-rose-300"
        : estado === "EN_PROCESO"
          ? "bg-amber-400/15 text-amber-300"
          : "bg-sky-400/15 text-sky-300";

  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-black ${clase}`}
    >
      {estado.replaceAll("_", " ")}
    </span>
  );
}