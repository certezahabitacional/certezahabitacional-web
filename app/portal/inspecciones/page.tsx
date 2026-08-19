import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerClienteActual } from "@/lib/cliente-actual";

function formatoFecha(
  fecha: Date,
  zonaHoraria: string,
) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: zonaHoraria,
  }).format(fecha);
}

export default async function PortalInspeccionesPage() {
  const cliente = await obtenerClienteActual();

  const inspecciones = await prisma.inspeccion.findMany({
    where: {
      clienteId: cliente.id,
    },

    include: {
      inmueble: true,

      inspector: {
        include: {
          usuario: true,
        },
      },

      certificado: true,

      _count: {
        select: {
          hallazgos: true,
          fotografias: true,
          firmas: true,
        },
      },
    },

    orderBy: {
      actualizadoEn: "desc",
    },
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
            Portal del cliente
          </p>

          <h1 className="mt-2 text-4xl font-black">
            Mis inspecciones
          </h1>

          <p className="mt-2 text-slate-400">
            Consulta el avance, los hallazgos, las evidencias y los documentos
            asociados a tus inspecciones.
          </p>
        </div>

        <Link
          href="/portal"
          className="rounded-full border border-white/10 px-5 py-3 text-sm font-bold transition hover:border-cyan-300 hover:text-cyan-300"
        >
          Volver al inicio
        </Link>
      </header>

      {inspecciones.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-white/10 bg-slate-900 p-12 text-center">
          <h2 className="text-2xl font-black">
            No hay inspecciones registradas
          </h2>

          <p className="mt-2 text-slate-500">
            Cuando se registre una inspección a tu nombre, aparecerá en esta
            sección.
          </p>
        </section>
      ) : (
        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          {inspecciones.map((inspeccion) => (
            <article
              key={inspeccion.id}
              className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900"
            >
              <div className="border-b border-white/10 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-cyan-300">
                      {inspeccion.folio}
                    </p>

                    <h2 className="mt-2 text-xl font-black">
                      {inspeccion.inmueble?.alias ?? inspeccion.tipoInmueble}
                    </h2>
                  </div>

                  <Estado estado={inspeccion.estado} />
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-400">
                  {inspeccion.direccion}, {inspeccion.ciudad}
                </p>
              </div>

              <div className="p-6">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Dato
                    label="Servicio"
                    value={inspeccion.tipoServicio}
                  />

                  <Dato
                    label="Fecha programada"
                    value={formatoFecha(
                      inspeccion.fechaProgramada,
                      inspeccion.zonaHoraria,
                    )}
                  />

                  <Dato
                    label="Zona horaria"
                    value={inspeccion.zonaHoraria}
                  />

                  <Dato
                    label="Inspector"
                    value={
                      inspeccion.inspector?.usuario.nombre ??
                      "Pendiente de asignar"
                    }
                  />

                  <Dato
                    label="ISH"
                    value={
                      inspeccion.ish !== null
                        ? `${Number(inspeccion.ish).toFixed(0)} / 100`
                        : "Sin evaluar"
                    }
                  />
                </dl>

                <div className="mt-6 grid grid-cols-3 gap-3">
                  <Contador
                    valor={inspeccion._count.hallazgos}
                    texto="Hallazgos"
                  />

                  <Contador
                    valor={inspeccion._count.fotografias}
                    texto="Evidencias"
                  />

                  <Contador
                    valor={inspeccion._count.firmas}
                    texto="Firmas"
                  />
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
                  <p className="text-sm text-slate-500">
                    {inspeccion.certificado
                      ? "Certificado disponible"
                      : "Certificado pendiente"}
                  </p>

                  <Link
                    href={`/portal/inspecciones/${inspeccion.id}`}
                    className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300"
                  >
                    Ver detalle
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

function Estado({
  estado,
}: {
  estado: string;
}) {
  const estilos: Record<string, string> = {
    PROGRAMADA: "bg-sky-400/10 text-sky-300",
    EN_PROCESO: "bg-amber-400/10 text-amber-300",
    REPORTE_PENDIENTE: "bg-orange-400/10 text-orange-300",
    FINALIZADA: "bg-emerald-400/10 text-emerald-300",
    CANCELADA: "bg-rose-400/10 text-rose-300",
  };

  return (
    <span
      className={`rounded-full px-4 py-2 text-xs font-black ${
        estilos[estado] ?? "bg-white/10 text-slate-300"
      }`}
    >
      {estado.replaceAll("_", " ")}
    </span>
  );
}

function Dato({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-950 p-4">
      <dt className="text-xs font-black uppercase tracking-widest text-slate-600">
        {label}
      </dt>

      <dd className="mt-2 text-sm font-bold text-slate-200">
        {value}
      </dd>
    </div>
  );
}

function Contador({
  valor,
  texto,
}: {
  valor: number;
  texto: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-950 p-4 text-center">
      <p className="text-2xl font-black text-cyan-300">
        {valor}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        {texto}
      </p>
    </div>
  );
}