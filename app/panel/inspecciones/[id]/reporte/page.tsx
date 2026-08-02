import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import PrintButton from "./PrintButton";

const etiquetaClasificacion: Record<string, string> = {
  C: "Conforme",
  O: "Observación",
  NC: "No conforme",
  CR: "Condición crítica",
  NA: "No aplica",
};

const estiloClasificacion: Record<string, string> = {
  C: "bg-emerald-100 text-emerald-800",
  O: "bg-amber-100 text-amber-800",
  NC: "bg-orange-100 text-orange-800",
  CR: "bg-rose-100 text-rose-800",
  NA: "bg-slate-100 text-slate-700",
};

function obtenerSupabase() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

async function obtenerUrlImagen(
  valor: string,
  supabase: ReturnType<typeof obtenerSupabase>,
) {
  if (valor.startsWith("http://") || valor.startsWith("https://")) {
    return valor;
  }

  if (!supabase) {
    return null;
  }

  const bucket =
    process.env.SUPABASE_STORAGE_BUCKET || "evidencias";

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(valor, 60 * 60);

  return error ? null : data.signedUrl;
}

export default async function ReportePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    include: {
      cliente: true,
      inmueble: true,
      inspector: {
        include: {
          usuario: true,
        },
      },
      hallazgos: {
        orderBy: [
          { prioridad: "asc" },
          { creadoEn: "asc" },
        ],
        include: {
          fotografias: true,
        },
      },
      fotografias: {
        orderBy: {
          creadaEn: "asc",
        },
      },
      certificado: true,
    },
  });

  if (!inspeccion) {
    notFound();
  }

  const resumen = inspeccion.hallazgos.reduce(
    (acumulado, hallazgo) => {
      acumulado[hallazgo.clasificacion] =
        (acumulado[hallazgo.clasificacion] ?? 0) + 1;

      return acumulado;
    },
    {
      C: 0,
      O: 0,
      NC: 0,
      CR: 0,
      NA: 0,
    } as Record<string, number>,
  );

  const costoTotal = inspeccion.hallazgos.reduce(
    (total, hallazgo) =>
      total + Number(hallazgo.costoEstimado ?? 0),
    0,
  );

  const totalHallazgos = inspeccion.hallazgos.length;
  const ish = Math.round(Number(inspeccion.ish ?? 100));
  const semaforo = inspeccion.semaforo ?? "SIN EVALUAR";

  const supabase = obtenerSupabase();

  const fotografiasConUrl = await Promise.all(
    inspeccion.fotografias.map(async (foto) => ({
      ...foto,
      imagenUrl: await obtenerUrlImagen(foto.url, supabase),
    })),
  );

  const urlPorFoto = new Map(
    fotografiasConUrl.map((foto) => [
      foto.id,
      foto.imagenUrl,
    ]),
  );

  const fotografiaPortada =
    fotografiasConUrl.find((foto) => foto.imagenUrl)
      ?.imagenUrl ?? null;

  let qrDataUrl: string | null = null;

  if (inspeccion.certificado) {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000";

    const urlValidacion =
      `${baseUrl}/certificados/verificar/` +
      inspeccion.certificado.codigoValidacion;

    qrDataUrl = await QRCode.toDataURL(urlValidacion, {
      width: 260,
      margin: 1,
      errorCorrectionLevel: "M",
    });
  }

  const urgentes = inspeccion.hallazgos.filter(
  (hallazgo) =>
    hallazgo.clasificacion === "CR" ||
    Number(hallazgo.prioridad) <= 1,
);

  const prioritarios = inspeccion.hallazgos.filter(
    (hallazgo) =>
      hallazgo.clasificacion === "NC" &&
      !urgentes.some((urgente) => urgente.id === hallazgo.id),
  );

  const preventivos = inspeccion.hallazgos.filter(
    (hallazgo) =>
      hallazgo.clasificacion === "O" ||
      hallazgo.clasificacion === "C",
  );

  const fechaReporte = new Date().toLocaleDateString(
    "es-MX",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    },
  );

  return (
    <main className="min-h-screen bg-slate-200 px-4 py-8 text-slate-950 print:bg-white print:p-0">
      <style>{`
        @page {
          size: Letter;
          margin: 10mm;
        }

        @media print {
          body {
            background: white !important;
          }

          .salto-pagina {
            break-before: page;
            page-break-before: always;
          }

          .evitar-corte {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="mx-auto mb-5 flex max-w-5xl items-center justify-between gap-4 print:hidden">
        <Link
          href={`/panel/inspecciones/${inspeccion.id}`}
          className="font-bold text-slate-700"
        >
          ← Volver al expediente
        </Link>

        <div className="flex gap-3">
          {inspeccion.certificado && (
            <Link
              href={`/panel/inspecciones/${inspeccion.id}/certificado`}
              className="rounded-full border border-slate-400 px-5 py-3 font-bold"
            >
              Ver certificado
            </Link>
          )}

          <PrintButton />
        </div>
      </div>

      <article className="mx-auto max-w-5xl bg-white shadow-2xl print:max-w-none print:shadow-none">
        {/* PORTADA */}
        <section className="relative flex min-h-[950px] flex-col overflow-hidden bg-slate-950 px-12 py-12 text-white print:min-h-[250mm]">
          <div className="absolute right-0 top-0 h-72 w-72 rounded-bl-full bg-cyan-400/10" />

          <header className="relative z-10">
            <p className="text-sm font-black uppercase tracking-[0.35em] text-cyan-300">
              Certeza Habitacional
            </p>

            <p className="mt-2 text-sm uppercase tracking-widest text-slate-400">
              Inspección • Diagnóstico • Evidencia
            </p>
          </header>

          <div className="relative z-10 mt-20">
            <p className="text-sm font-black uppercase tracking-[0.28em] text-cyan-300">
              Documento confidencial
            </p>

            <h1 className="mt-5 max-w-3xl text-6xl font-black leading-tight">
              Reporte Técnico de Inspección
            </h1>

            <p className="mt-5 text-xl text-slate-300">
              Evaluación visual y documental del estado habitacional
            </p>
          </div>

          <div className="relative z-10 mt-12 grid gap-8 md:grid-cols-[1fr_260px]">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
              <dl className="grid gap-5 sm:grid-cols-2">
                <PortadaDato
                  label="Folio"
                  value={inspeccion.folio}
                />

                <PortadaDato
                  label="Cliente"
                  value={inspeccion.cliente.nombre}
                />

                <PortadaDato
                  label="Inmueble"
                  value={
                    inspeccion.inmueble?.alias ??
                    inspeccion.tipoInmueble
                  }
                />

                <PortadaDato
                  label="Inspector"
                  value={
                    inspeccion.inspector?.usuario.nombre ??
                    "Sin asignar"
                  }
                />

                <PortadaDato
                  label="Dirección"
                  value={`${inspeccion.direccion}, ${inspeccion.ciudad}`}
                />

                <PortadaDato
                  label="Fecha"
                  value={fechaReporte}
                />
              </dl>
            </div>

            <div className="rounded-[2rem] bg-cyan-300 p-8 text-slate-950">
              <p className="text-xs font-black uppercase tracking-[0.25em]">
                Índice de Salud Habitacional
              </p>

              <p className="mt-5 text-8xl font-black">
                {ish}
              </p>

              <p className="mt-2 text-2xl font-black">
                {semaforo}
              </p>

              <div className="mt-7 h-3 overflow-hidden rounded-full bg-slate-950/20">
                <div
                  className="h-full rounded-full bg-slate-950"
                  style={{
                    width: `${Math.min(100, Math.max(0, ish))}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-10">
            {fotografiaPortada ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fotografiaPortada}
                alt="Fotografía principal del inmueble"
                className="h-72 w-full rounded-[2rem] object-cover"
              />
            ) : (
              <div className="grid h-72 place-items-center rounded-[2rem] border border-dashed border-white/20 bg-white/5 text-slate-500">
                Sin fotografía principal registrada
              </div>
            )}
          </div>

          <footer className="relative z-10 mt-auto flex items-end justify-between border-t border-white/10 pt-7 text-xs text-slate-400">
            <p>Certeza Habitacional</p>
            <p>{inspeccion.folio}</p>
          </footer>
        </section>

        {/* ÍNDICE */}
        <section className="salto-pagina min-h-[900px] px-12 py-14">
          <EncabezadoSeccion
            numero="01"
            titulo="Contenido del reporte"
            subtitulo="Estructura documental del expediente técnico"
          />

          <div className="mt-12 space-y-4">
            {[
              ["01", "Contenido del reporte"],
              ["02", "Resumen ejecutivo"],
              ["03", "Datos generales"],
              ["04", "Índice de Salud Habitacional"],
              ["05", "Hallazgos técnicos"],
              ["06", "Evidencia fotográfica"],
              ["07", "Recomendaciones finales"],
              ["08", "Firmas y aceptación"],
              ["09", "Certificado y validación"],
            ].map(([numero, titulo]) => (
              <div
                key={numero}
                className="flex items-center gap-5 border-b border-slate-200 py-4"
              >
                <span className="text-xl font-black text-cyan-600">
                  {numero}
                </span>

                <span className="font-bold">
                  {titulo}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* RESUMEN EJECUTIVO */}
        <section className="salto-pagina px-12 py-14">
          <EncabezadoSeccion
            numero="02"
            titulo="Resumen ejecutivo"
            subtitulo="Resultado general de la inspección"
          />

          <div className="mt-9 rounded-[2rem] bg-slate-950 p-8 text-white">
            <p className="text-lg leading-8 text-slate-300">
              Durante la inspección del inmueble se registraron{" "}
              <strong className="text-white">
                {totalHallazgos} hallazgos
              </strong>
              , incluyendo{" "}
              <strong className="text-rose-300">
                {resumen.CR} condiciones críticas
              </strong>
              ,{" "}
              <strong className="text-orange-300">
                {resumen.NC} no conformidades
              </strong>{" "}
              y{" "}
              <strong className="text-amber-300">
                {resumen.O} observaciones
              </strong>
              .
            </p>

            <p className="mt-5 text-lg leading-8 text-slate-300">
              El Índice de Salud Habitacional resultante es de{" "}
              <strong className="text-cyan-300">
                {ish}/100
              </strong>
              , correspondiente al estado{" "}
              <strong className="text-white">
                {semaforo}
              </strong>
              .
            </p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Metric label="ISH" value={ish} />
            <Metric label="Hallazgos" value={totalHallazgos} />
            <Metric label="Conformes" value={resumen.C} />
            <Metric label="Observaciones" value={resumen.O} />
            <Metric label="No conformes" value={resumen.NC} />
            <Metric label="Críticos" value={resumen.CR} />
          </div>

          <div className="mt-8 rounded-[2rem] border border-slate-200 p-7">
            <p className="text-sm font-black uppercase tracking-widest text-slate-500">
              Costo correctivo estimado
            </p>

            <p className="mt-3 text-4xl font-black">
              {costoTotal.toLocaleString("es-MX", {
                style: "currency",
                currency: "MXN",
              })}
            </p>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              Esta cifra es informativa y debe confirmarse mediante
              cotizaciones, levantamientos específicos y alcances
              claramente definidos.
            </p>
          </div>
        </section>

        {/* DATOS GENERALES */}
        <section className="salto-pagina px-12 py-14">
          <EncabezadoSeccion
            numero="03"
            titulo="Datos generales"
            subtitulo="Información del servicio, cliente e inmueble"
          />

          <div className="mt-9 grid gap-8 md:grid-cols-2">
            <BloqueDatos titulo="Datos del servicio">
              <Row label="Folio" value={inspeccion.folio} />
              <Row
                label="Servicio"
                value={inspeccion.tipoServicio}
              />
              <Row
                label="Fecha programada"
                value={inspeccion.fechaProgramada.toLocaleString(
                  "es-MX",
                )}
              />
              <Row
                label="Estado"
                value={inspeccion.estado.replaceAll("_", " ")}
              />
              <Row
                label="Inspector"
                value={
                  inspeccion.inspector?.usuario.nombre ??
                  "Sin asignar"
                }
              />
            </BloqueDatos>

            <BloqueDatos titulo="Cliente e inmueble">
              <Row
                label="Cliente"
                value={inspeccion.cliente.nombre}
              />
              <Row
                label="Inmueble"
                value={
                  inspeccion.inmueble?.alias ??
                  inspeccion.tipoInmueble
                }
              />
              <Row
                label="Dirección"
                value={inspeccion.direccion}
              />
              <Row
                label="Ciudad"
                value={inspeccion.ciudad}
              />
              <Row
                label="Superficie"
                value={
                  inspeccion.superficieM2
                    ? `${Number(
                        inspeccion.superficieM2,
                      ).toLocaleString("es-MX")} m²`
                    : "No registrada"
                }
              />
            </BloqueDatos>
          </div>
        </section>

        {/* ISH */}
        <section className="salto-pagina px-12 py-14">
          <EncabezadoSeccion
            numero="04"
            titulo="Índice de Salud Habitacional"
            subtitulo="Indicador general del estado observado"
          />

          <div className="mt-10 grid items-center gap-10 md:grid-cols-[280px_1fr]">
            <div className="rounded-[2rem] bg-cyan-300 p-10 text-center">
              <p className="text-xs font-black uppercase tracking-[0.25em]">
                Resultado
              </p>

              <p className="mt-4 text-8xl font-black">
                {ish}
              </p>

              <p className="mt-2 text-xl font-black">
                {semaforo}
              </p>
            </div>

            <div>
              <div className="h-6 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-cyan-500"
                  style={{
                    width: `${Math.min(100, Math.max(0, ish))}%`,
                  }}
                />
              </div>

              <p className="mt-7 text-lg leading-8 text-slate-700">
                El índice resume las condiciones visibles y
                documentadas durante la inspección. Su interpretación
                debe realizarse junto con los hallazgos, evidencias,
                recomendaciones y limitaciones incluidas en este
                reporte.
              </p>
            </div>
          </div>

          <div className="mt-10 space-y-4">
            {[
              ["Conformes", resumen.C],
              ["Observaciones", resumen.O],
              ["No conformes", resumen.NC],
              ["Críticos", resumen.CR],
              ["No aplica", resumen.NA],
            ].map(([label, value]) => {
              const numero = Number(value);
              const porcentaje =
                totalHallazgos > 0
                  ? Math.round(
                      (numero / totalHallazgos) * 100,
                    )
                  : 0;

              return (
                <div key={String(label)}>
                  <div className="flex justify-between text-sm font-bold">
                    <span>{label}</span>
                    <span>{numero}</span>
                  </div>

                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-950"
                      style={{
                        width: `${porcentaje}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* HALLAZGOS */}
        <section className="salto-pagina px-12 py-14">
          <EncabezadoSeccion
            numero="05"
            titulo="Hallazgos técnicos"
            subtitulo="Observaciones registradas durante la inspección"
          />

          {inspeccion.hallazgos.length === 0 ? (
            <p className="mt-8 rounded-3xl bg-slate-100 p-8 text-slate-600">
              No se registraron hallazgos en este expediente.
            </p>
          ) : (
            <div className="mt-8 space-y-8">
              {inspeccion.hallazgos.map(
                (hallazgo, index) => (
                  <article
                    key={hallazgo.id}
                    className="evitar-corte overflow-hidden rounded-[2rem] border border-slate-200"
                  >
                    <header className="flex flex-wrap items-center justify-between gap-4 bg-slate-950 px-7 py-6 text-white">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                          Hallazgo {String(index + 1).padStart(2, "0")}
                        </p>

                        <h3 className="mt-2 text-2xl font-black">
                          {hallazgo.titulo}
                        </h3>
                      </div>

                      <span
                        className={`rounded-full px-4 py-2 text-xs font-black uppercase ${
                          estiloClasificacion[
                            hallazgo.clasificacion
                          ] ?? "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {etiquetaClasificacion[
                          hallazgo.clasificacion
                        ] ?? hallazgo.clasificacion}
                      </span>
                    </header>

                    <div className="p-7">
                      <div className="grid gap-4 text-sm sm:grid-cols-3">
                        <Ficha
                          label="Área"
                          value={hallazgo.area}
                        />

                        <Ficha
                          label="Prioridad"
                          value={String(hallazgo.prioridad)}
                        />

                        <Ficha
                          label="Ubicación"
                          value={
                            hallazgo.ubicacion ??
                            "No especificada"
                          }
                        />
                      </div>

                      <div className="mt-6">
                        <TituloCampo>
                          Descripción
                        </TituloCampo>

                        <p className="mt-2 leading-7 text-slate-700">
                          {hallazgo.descripcion}
                        </p>
                      </div>

                      {hallazgo.recomendacion && (
                        <div className="mt-6 rounded-3xl bg-cyan-50 p-6">
                          <TituloCampo>
                            Recomendación técnica
                          </TituloCampo>

                          <p className="mt-2 leading-7 text-slate-700">
                            {hallazgo.recomendacion}
                          </p>
                        </div>
                      )}

                      <div className="mt-6 grid gap-4 sm:grid-cols-3">
                        <Ficha
                          label="Responsable"
                          value={
                            hallazgo.responsable ??
                            "Por definir"
                          }
                        />

                        <Ficha
                          label="Tiempo estimado"
                          value={
                            hallazgo.tiempoReparacion ??
                            "Por definir"
                          }
                        />

                        <Ficha
                          label="Costo estimado"
                          value={
                            hallazgo.costoEstimado
                              ? Number(
                                  hallazgo.costoEstimado,
                                ).toLocaleString("es-MX", {
                                  style: "currency",
                                  currency: "MXN",
                                })
                              : "No estimado"
                          }
                        />
                      </div>

                      {hallazgo.fotografias.length > 0 && (
                        <div className="mt-7 grid grid-cols-2 gap-4">
                          {hallazgo.fotografias.map(
                            (foto, fotoIndex) => {
                              const imagenUrl =
                                urlPorFoto.get(foto.id);

                              return (
                                <figure
                                  key={foto.id}
                                  className="overflow-hidden rounded-3xl border border-slate-200"
                                >
                                  {imagenUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={imagenUrl}
                                      alt={
                                        foto.descripcion ??
                                        hallazgo.titulo
                                      }
                                      className="h-56 w-full object-cover"
                                    />
                                  ) : (
                                    <div className="grid h-56 place-items-center bg-slate-100 text-sm text-slate-400">
                                      Imagen no disponible
                                    </div>
                                  )}

                                  <figcaption className="p-4 text-sm">
                                    <p className="font-black">
                                      Fotografía{" "}
                                      {fotoIndex + 1}
                                    </p>

                                    <p className="mt-1 text-slate-500">
                                      {foto.descripcion ??
                                        "Evidencia del hallazgo"}
                                    </p>
                                  </figcaption>
                                </figure>
                              );
                            },
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                ),
              )}
            </div>
          )}
        </section>

        {/* ÁLBUM */}
        <section className="salto-pagina px-12 py-14">
          <EncabezadoSeccion
            numero="06"
            titulo="Evidencia fotográfica"
            subtitulo="Álbum general del expediente"
          />

          {fotografiasConUrl.length === 0 ? (
            <p className="mt-8 rounded-3xl bg-slate-100 p-8 text-slate-600">
              No se registraron fotografías.
            </p>
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {fotografiasConUrl.map((foto, index) => (
                <figure
                  key={foto.id}
                  className="evitar-corte overflow-hidden rounded-[2rem] border border-slate-200"
                >
                  {foto.imagenUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={foto.imagenUrl}
                      alt={
                        foto.descripcion ??
                        `Evidencia ${index + 1}`
                      }
                      className="h-72 w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-72 place-items-center bg-slate-100 text-slate-400">
                      Imagen no disponible
                    </div>
                  )}

                  <figcaption className="p-5">
                    <p className="font-black">
                      Fotografía {index + 1}
                    </p>

                    <p className="mt-2 text-sm text-slate-500">
                      {foto.descripcion ??
                        "Evidencia general del expediente"}
                    </p>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>

        {/* RECOMENDACIONES */}
        <section className="salto-pagina px-12 py-14">
          <EncabezadoSeccion
            numero="07"
            titulo="Recomendaciones finales"
            subtitulo="Plan de atención sugerido"
          />

          <div className="mt-9 space-y-7">
            <GrupoRecomendaciones
              titulo="Atención urgente"
              descripcion="Condiciones críticas o de prioridad inmediata."
              hallazgos={urgentes}
              clase="border-rose-200 bg-rose-50"
            />

            <GrupoRecomendaciones
              titulo="Atención prioritaria"
              descripcion="No conformidades que deben corregirse antes de la recepción, ocupación o inversión."
              hallazgos={prioritarios}
              clase="border-orange-200 bg-orange-50"
            />

            <GrupoRecomendaciones
              titulo="Mantenimiento y prevención"
              descripcion="Observaciones y acciones preventivas recomendadas."
              hallazgos={preventivos}
              clase="border-cyan-200 bg-cyan-50"
            />
          </div>
        </section>

        {/* FIRMAS */}
        <section className="salto-pagina min-h-[900px] px-12 py-14">
          <EncabezadoSeccion
            numero="08"
            titulo="Firmas y aceptación"
            subtitulo="Constancia de entrega y recepción del reporte"
          />

          <p className="mt-9 max-w-3xl leading-8 text-slate-600">
            Las firmas dejan constancia de la participación en el
            proceso de inspección y de la entrega del presente
            reporte. No representan aceptación automática de costos,
            responsabilidades o alcances distintos a los expresamente
            contratados.
          </p>

          <div className="mt-28 grid gap-20 md:grid-cols-2">
            <Firma
              nombre={
                inspeccion.inspector?.usuario.nombre ??
                "Inspector asignado"
              }
              cargo="Inspector responsable"
            />

            <Firma
              nombre={inspeccion.cliente.nombre}
              cargo="Cliente o representante"
            />
          </div>

          <div className="mx-auto mt-28 max-w-md">
            <Firma
              nombre="Certeza Habitacional"
              cargo="Empresa emisora"
            />
          </div>
        </section>

        {/* CERTIFICADO */}
        <section className="salto-pagina min-h-[900px] px-12 py-14">
          <EncabezadoSeccion
            numero="09"
            titulo="Certificado y validación"
            subtitulo="Verificación de autenticidad documental"
          />

          {inspeccion.certificado ? (
            <div className="mt-10 rounded-[2rem] border-8 border-slate-950 p-8">
              <div className="border-2 border-cyan-400 p-8 text-center">
                <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-600">
                  Certeza Habitacional
                </p>

                <h3 className="mt-5 text-3xl font-black">
                  Certificado de Estado Habitacional
                </h3>

                <div className="mt-8 grid items-center gap-8 md:grid-cols-[1fr_180px]">
                  <div className="text-left">
                    <Row
                      label="Certificado"
                      value={inspeccion.certificado.folio}
                    />

                    <Row
                      label="Inspección"
                      value={inspeccion.folio}
                    />

                    <Row
                      label="Código"
                      value={
                        inspeccion.certificado
                          .codigoValidacion
                      }
                    />

                    <Row
                      label="ISH"
                      value={`${Math.round(
                        Number(
                          inspeccion.certificado.ish,
                        ),
                      )}/100`}
                    />
                  </div>

                  {qrDataUrl && (
                    <div className="flex flex-col items-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrDataUrl}
                        alt="Código QR de validación"
                        className="h-40 w-40"
                      />

                      <p className="mt-2 text-xs font-bold">
                        Verificar certificado
                      </p>
                    </div>
                  )}
                </div>

                <p className="mt-8 leading-7 text-slate-600">
                  {inspeccion.certificado.dictamen}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-10 rounded-3xl bg-amber-50 p-8 text-amber-800">
              El expediente todavía no cuenta con un certificado
              emitido.
            </div>
          )}
        </section>

        <footer className="border-t border-slate-200 px-12 py-8 text-xs leading-5 text-slate-500">
          <p>
            Este reporte documenta condiciones visibles al momento
            de la inspección. No sustituye estudios estructurales,
            pruebas destructivas, peritajes especializados,
            verificaciones normativas específicas ni garantías de
            funcionamiento oculto.
          </p>

          <p className="mt-3 font-bold text-slate-700">
            Certeza Habitacional · Folio {inspeccion.folio}
          </p>
        </footer>
      </article>
    </main>
  );
}

function EncabezadoSeccion({
  numero,
  titulo,
  subtitulo,
}: {
  numero: string;
  titulo: string;
  subtitulo: string;
}) {
  return (
    <header className="border-b-4 border-slate-950 pb-6">
      <p className="text-sm font-black uppercase tracking-[0.28em] text-cyan-600">
        Sección {numero}
      </p>

      <h2 className="mt-3 text-4xl font-black">
        {titulo}
      </h2>

      <p className="mt-2 text-slate-500">
        {subtitulo}
      </p>
    </header>
  );
}

function PortadaDato({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs font-black uppercase tracking-widest text-cyan-300">
        {label}
      </dt>

      <dd className="mt-2 font-bold text-white">
        {value}
      </dd>
    </div>
  );
}

function BloqueDatos({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[2rem] border border-slate-200 p-7">
      <h3 className="text-xl font-black">
        {titulo}
      </h3>

      <dl className="mt-5 space-y-3 text-sm">
        {children}
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between gap-6 border-b border-slate-100 pb-2">
      <dt className="text-slate-500">
        {label}
      </dt>

      <dd className="text-right font-bold">
        {value}
      </dd>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-3xl bg-slate-100 p-5">
      <p className="text-4xl font-black">
        {value}
      </p>

      <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500">
        {label}
      </p>
    </div>
  );
}

function Ficha({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-100 p-4">
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">
        {label}
      </p>

      <p className="mt-2 font-bold">
        {value}
      </p>
    </div>
  );
}

function TituloCampo({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-700">
      {children}
    </p>
  );
}

function GrupoRecomendaciones({
  titulo,
  descripcion,
  hallazgos,
  clase,
}: {
  titulo: string;
  descripcion: string;
  hallazgos: Array<{
    id: string;
    titulo: string;
    recomendacion: string | null;
  }>;
  clase: string;
}) {
  return (
    <div className={`rounded-[2rem] border p-7 ${clase}`}>
      <h3 className="text-2xl font-black">
        {titulo}
      </h3>

      <p className="mt-2 text-sm text-slate-600">
        {descripcion}
      </p>

      {hallazgos.length === 0 ? (
        <p className="mt-5 text-sm text-slate-500">
          No hay recomendaciones registradas en esta categoría.
        </p>
      ) : (
        <ul className="mt-5 space-y-4">
          {hallazgos.map((hallazgo) => (
            <li
              key={hallazgo.id}
              className="rounded-2xl bg-white/70 p-4"
            >
              <p className="font-black">
                {hallazgo.titulo}
              </p>

              <p className="mt-1 text-sm leading-6 text-slate-600">
                {hallazgo.recomendacion ??
                  "Revisar y definir el procedimiento correctivo correspondiente."}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Firma({
  nombre,
  cargo,
}: {
  nombre: string;
  cargo: string;
}) {
  return (
    <div className="text-center">
      <div className="h-20 border-b border-slate-500" />

      <p className="mt-4 font-black">
        {nombre}
      </p>

      <p className="mt-1 text-sm text-slate-500">
        {cargo}
      </p>
    </div>
  );
}