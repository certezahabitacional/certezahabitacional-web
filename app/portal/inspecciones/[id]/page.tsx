import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { obtenerClienteActual } from "@/lib/cliente-actual";
import { prisma } from "@/lib/prisma";

function formatearFechaHora(
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

function formatearFechaHoraCorta(
  fecha: Date,
  zonaHoraria: string,
) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: zonaHoraria,
  }).format(fecha);
}

function obtenerSupabase() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function crearUrlEvidencia(ruta: string) {
  if (
    ruta.startsWith("http://") ||
    ruta.startsWith("https://")
  ) {
    return ruta;
  }

  const supabase = obtenerSupabase();

  if (!supabase) {
    return null;
  }

  const bucket =
    process.env.SUPABASE_STORAGE_BUCKET ||
    "evidencias";

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(ruta, 60 * 60);

  if (error) {
    console.error(
      "No se pudo crear la URL firmada:",
      error.message,
    );

    return null;
  }

  return data.signedUrl;
}

export default async function PortalInspeccionDetallePage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const cliente = await obtenerClienteActual();
  const { id } = await params;

  const inspeccion = await prisma.inspeccion.findFirst({
    where: {
      id,
      clienteId: cliente.id,
    },

    include: {
      inmueble: true,

      inspector: {
        include: {
          usuario: true,
        },
      },

      hallazgos: {
        include: {
          fotografias: {
            orderBy: {
              creadaEn: "asc",
            },
          },
        },

        orderBy: [
          {
            prioridad: "asc",
          },
          {
            creadoEn: "asc",
          },
        ],
      },

      fotografias: {
        where: {
          hallazgoId: null,
        },

        orderBy: {
          creadaEn: "asc",
        },
      },

      firmas: {
        orderBy: {
          firmadaEn: "asc",
        },
      },

      certificado: true,
    },
  });

  if (!inspeccion) {
    notFound();
  }

  const todasLasFotografias = [
    ...inspeccion.fotografias,
    ...inspeccion.hallazgos.flatMap(
      (hallazgo) => hallazgo.fotografias,
    ),
  ];

  const urlsEvidencias = new Map<string, string>();

  await Promise.all(
    todasLasFotografias.map(async (fotografia) => {
      const url = await crearUrlEvidencia(
        fotografia.url,
      );

      if (url) {
        urlsEvidencias.set(fotografia.id, url);
      }
    }),
  );

  const hallazgosCriticos =
    inspeccion.hallazgos.filter(
      (hallazgo) =>
        hallazgo.clasificacion === "CR",
    ).length;

  const hallazgosNoConformes =
    inspeccion.hallazgos.filter(
      (hallazgo) =>
        hallazgo.clasificacion === "NC",
    ).length;

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div>
          <Link
            href="/portal/inspecciones"
            className="text-sm font-bold text-cyan-300 transition hover:text-cyan-200"
          >
            ← Volver a mis inspecciones
          </Link>

          <p className="mt-6 text-xs font-black uppercase tracking-[0.28em] text-slate-500">
            Expediente de inspección
          </p>

          <h1 className="mt-2 text-4xl font-black">
            {inspeccion.folio}
          </h1>

          <p className="mt-3 text-slate-400">
            {inspeccion.direccion},{" "}
            {inspeccion.ciudad}
          </p>
        </div>

        <Estado estado={inspeccion.estado} />
      </header>

      <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Resumen
          titulo="ISH"
          valor={
            inspeccion.ish !== null
              ? Number(inspeccion.ish).toFixed(0)
              : "—"
          }
          detalle="Índice de Salud Habitacional"
        />

        <Resumen
          titulo="Hallazgos"
          valor={String(inspeccion.hallazgos.length)}
          detalle="Total documentado"
        />

        <Resumen
          titulo="No conformes"
          valor={String(hallazgosNoConformes)}
          detalle="Requieren corrección"
          alerta={hallazgosNoConformes > 0}
        />

        <Resumen
          titulo="Críticos"
          valor={String(hallazgosCriticos)}
          detalle="Atención prioritaria"
          alerta={hallazgosCriticos > 0}
        />
      </section>

      <section className="mt-8 grid gap-8 xl:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <article className="rounded-3xl border border-white/10 bg-slate-900 p-7">
            <h2 className="text-xl font-black">
              Información general
            </h2>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <Dato
                label="Servicio"
                value={inspeccion.tipoServicio}
              />

              <Dato
                label="Tipo de inmueble"
                value={inspeccion.tipoInmueble}
              />

              <Dato
                label="Inmueble"
                value={
                  inspeccion.inmueble?.alias ??
                  "Sin inmueble relacionado"
                }
              />

              <Dato
                label="Inspector"
                value={
                  inspeccion.inspector?.usuario.nombre ??
                  "Pendiente de asignar"
                }
              />

              <Dato
                label="Fecha programada"
                value={formatearFechaHora(
                  inspeccion.fechaProgramada,
                  inspeccion.zonaHoraria,
                )}
              />

              <Dato
                label="Zona horaria"
                value={inspeccion.zonaHoraria}
              />

              <Dato
                label="Semáforo"
                value={
                  inspeccion.semaforo ??
                  "Sin evaluar"
                }
              />
            </dl>

            {inspeccion.observaciones && (
              <div className="mt-6 rounded-2xl bg-slate-950 p-5">
                <p className="text-xs font-black uppercase tracking-widest text-cyan-300">
                  Observaciones generales
                </p>

                <p className="mt-3 whitespace-pre-line leading-7 text-slate-300">
                  {inspeccion.observaciones}
                </p>
              </div>
            )}
          </article>

          <article className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
            <header className="border-b border-white/10 p-7">
              <h2 className="text-xl font-black">
                Hallazgos técnicos
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Observaciones, prioridades y recomendaciones
                registradas durante la inspección.
              </p>
            </header>

            {inspeccion.hallazgos.length === 0 ? (
              <p className="p-10 text-center text-slate-500">
                No se registraron hallazgos.
              </p>
            ) : (
              <div className="divide-y divide-white/10">
                {inspeccion.hallazgos.map(
                  (hallazgo, indice) => (
                    <section
                      key={hallazgo.id}
                      className="p-7"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest text-cyan-300">
                            Hallazgo {indice + 1}
                          </p>

                          <h3 className="mt-2 text-xl font-black">
                            {hallazgo.titulo}
                          </h3>

                          <p className="mt-1 text-sm text-slate-500">
                            {hallazgo.area}
                            {hallazgo.ubicacion
                              ? ` · ${hallazgo.ubicacion}`
                              : ""}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Etiqueta
                            texto={hallazgo.clasificacion}
                          />

                          <Etiqueta
                            texto={hallazgo.prioridad}
                          />

                          {hallazgo.resuelto && (
                            <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-300">
                              RESUELTO
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="mt-5 whitespace-pre-line leading-7 text-slate-300">
                        {hallazgo.descripcion}
                      </p>

                      {hallazgo.recomendacion && (
                        <div className="mt-5 rounded-2xl bg-cyan-400/10 p-5">
                          <p className="text-xs font-black uppercase tracking-widest text-cyan-300">
                            Recomendación
                          </p>

                          <p className="mt-3 whitespace-pre-line leading-7 text-cyan-100">
                            {hallazgo.recomendacion}
                          </p>
                        </div>
                      )}

                      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
                        <DatoPequeno
                          label="Responsable"
                          value={
                            hallazgo.responsable ??
                            "No especificado"
                          }
                        />

                        <DatoPequeno
                          label="Tiempo estimado"
                          value={
                            hallazgo.tiempoReparacion ??
                            "No especificado"
                          }
                        />

                        <DatoPequeno
                          label="Costo estimado"
                          value={
                            hallazgo.costoEstimado !== null
                              ? Number(
                                  hallazgo.costoEstimado,
                                ).toLocaleString(
                                  "es-MX",
                                  {
                                    style: "currency",
                                    currency: "MXN",
                                  },
                                )
                              : "No especificado"
                          }
                        />
                      </dl>

                      {hallazgo.fotografias.length > 0 && (
                        <div className="mt-6 grid gap-4 sm:grid-cols-2">
                          {hallazgo.fotografias.map(
                            (fotografia) => {
                              const url =
                                urlsEvidencias.get(
                                  fotografia.id,
                                );

                              if (!url) {
                                return (
                                  <div
                                    key={fotografia.id}
                                    className="rounded-2xl bg-slate-950 p-5 text-sm text-slate-500"
                                  >
                                    Evidencia temporalmente no
                                    disponible.
                                  </div>
                                );
                              }

                              return (
                                <figure
                                  key={fotografia.id}
                                  className="overflow-hidden rounded-2xl bg-slate-950"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={url}
                                    alt={
                                      fotografia.descripcion ??
                                      hallazgo.titulo
                                    }
                                    className="aspect-video w-full object-cover"
                                  />

                                  {fotografia.descripcion && (
                                    <figcaption className="p-3 text-xs text-slate-500">
                                      {
                                        fotografia.descripcion
                                      }
                                    </figcaption>
                                  )}
                                </figure>
                              );
                            },
                          )}
                        </div>
                      )}
                    </section>
                  ),
                )}
              </div>
            )}
          </article>

          {inspeccion.fotografias.length > 0 && (
            <article className="rounded-3xl border border-white/10 bg-slate-900 p-7">
              <h2 className="text-xl font-black">
                Evidencias generales
              </h2>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {inspeccion.fotografias.map(
                  (fotografia) => {
                    const url = urlsEvidencias.get(
                      fotografia.id,
                    );

                    if (!url) {
                      return null;
                    }

                    return (
                      <figure
                        key={fotografia.id}
                        className="overflow-hidden rounded-2xl bg-slate-950"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={
                            fotografia.descripcion ??
                            "Evidencia de inspección"
                          }
                          className="aspect-video w-full object-cover"
                        />

                        {fotografia.descripcion && (
                          <figcaption className="p-3 text-xs text-slate-500">
                            {fotografia.descripcion}
                          </figcaption>
                        )}
                      </figure>
                    );
                  },
                )}
              </div>
            </article>
          )}
        </div>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-white/10 bg-slate-900 p-7">
            <h2 className="text-xl font-black">
              Certificado
            </h2>

            {inspeccion.certificado ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl bg-slate-950 p-5">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-600">
                    Folio
                  </p>

                  <p className="mt-2 font-black text-cyan-300">
                    {inspeccion.certificado.folio}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-950 p-5">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-600">
                    Código de validación
                  </p>

                  <p className="mt-2 break-all font-black text-cyan-300">
                    {
                      inspeccion.certificado
                        .codigoValidacion
                    }
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-950 p-5">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-600">
                    Estado
                  </p>

                  <p
                    className={`mt-2 font-black ${
                      inspeccion.certificado.vigente
                        ? "text-emerald-300"
                        : "text-rose-300"
                    }`}
                  >
                    {inspeccion.certificado.vigente
                      ? "VIGENTE"
                      : "REVOCADO"}
                  </p>
                </div>

                <Link
                  href={`/certificados/verificar/${inspeccion.certificado.codigoValidacion}`}
                  className="block rounded-2xl bg-cyan-400 px-5 py-4 text-center font-black text-slate-950 transition hover:bg-cyan-300"
                >
                  Consultar certificado
                </Link>
              </div>
            ) : (
              <p className="mt-5 rounded-2xl bg-slate-950 p-5 text-sm leading-6 text-slate-500">
                El certificado todavía no se encuentra
                disponible.
              </p>
            )}
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-900 p-7">
            <h2 className="text-xl font-black">
              Firmas registradas
            </h2>

            {inspeccion.firmas.length === 0 ? (
              <p className="mt-5 text-sm text-slate-500">
                No hay firmas registradas.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {inspeccion.firmas.map((firma) => (
                  <div
                    key={firma.id}
                    className="rounded-2xl bg-slate-950 p-4"
                  >
                    <p className="font-bold">
                      {firma.nombreFirmante}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {firma.tipo}
                    </p>

                    <p className="mt-1 text-xs text-slate-600">
                      {formatearFechaHoraCorta(
                        firma.firmadaEn,
                        inspeccion.zonaHoraria,
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </section>
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
    EN_PROCESO:
      "bg-amber-400/10 text-amber-300",
    REPORTE_PENDIENTE:
      "bg-orange-400/10 text-orange-300",
    FINALIZADA:
      "bg-emerald-400/10 text-emerald-300",
    CANCELADA: "bg-rose-400/10 text-rose-300",
  };

  return (
    <span
      className={`rounded-full px-5 py-3 text-sm font-black ${
        estilos[estado] ??
        "bg-white/10 text-slate-300"
      }`}
    >
      {estado.replaceAll("_", " ")}
    </span>
  );
}

function Resumen({
  titulo,
  valor,
  detalle,
  alerta = false,
}: {
  titulo: string;
  valor: string;
  detalle: string;
  alerta?: boolean;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-slate-900 p-6">
      <p className="text-sm font-bold text-slate-400">
        {titulo}
      </p>

      <p
        className={`mt-4 text-4xl font-black ${
          alerta
            ? "text-rose-300"
            : "text-cyan-300"
        }`}
      >
        {valor}
      </p>

      <p className="mt-2 text-xs text-slate-600">
        {detalle}
      </p>
    </article>
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
    <div className="rounded-2xl bg-slate-950 p-5">
      <dt className="text-xs font-black uppercase tracking-widest text-slate-600">
        {label}
      </dt>

      <dd className="mt-2 font-bold text-slate-200">
        {value}
      </dd>
    </div>
  );
}

function DatoPequeno({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 p-4">
      <dt className="text-xs font-black uppercase tracking-widest text-slate-600">
        {label}
      </dt>

      <dd className="mt-2 text-sm font-bold text-slate-300">
        {value}
      </dd>
    </div>
  );
}

function Etiqueta({
  texto,
}: {
  texto: string;
}) {
  const estilos: Record<string, string> = {
    C: "bg-emerald-400/10 text-emerald-300",
    O: "bg-sky-400/10 text-sky-300",
    NC: "bg-orange-400/10 text-orange-300",
    CR: "bg-rose-400/10 text-rose-300",
    NA: "bg-slate-400/10 text-slate-300",
    P1: "bg-rose-400/10 text-rose-300",
    P2: "bg-orange-400/10 text-orange-300",
    P3: "bg-amber-400/10 text-amber-300",
    P4: "bg-sky-400/10 text-sky-300",
    P5: "bg-slate-400/10 text-slate-300",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-black ${
        estilos[texto] ??
        "bg-white/10 text-slate-300"
      }`}
    >
      {texto}
    </span>
  );
}