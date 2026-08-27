import Link from "next/link";
import { RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import { auth } from "@/auth";
import { puede, puedeAbrirExpedienteTecnico } from "@/lib/permisos";
import { prisma } from "@/lib/prisma";
import PrintButton from "./PrintButton";
import ReportBrandHeader from "@/components/branding/ReportBrandHeader";

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

const etiquetaSeguimiento: Record<string, string> = {
  PENDIENTE_VERIFICAR: "Pendiente de verificar",
  CORREGIDO: "Corregido satisfactoriamente",
  PARCIALMENTE_CORREGIDO: "Parcialmente corregido",
  NO_CORREGIDO: "No corregido",
  CORRECCION_NO_SATISFACTORIA: "Corrección no satisfactoria",
  NO_VERIFICABLE: "No verificable",
  NUEVO_HALLAZGO: "Nuevo hallazgo",
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

function colorEvaluacion(valor: number) {
  const limitado = Math.max(0, Math.min(100, valor));
  const hue = Math.round((limitado / 100) * 120);

  return {
    intenso: `hsl(${hue} 88% 38%)`,
    medio: `hsl(${hue} 82% 46%)`,
    suave: `hsl(${hue} 90% 94%)`,
    borde: `hsl(${hue} 70% 72%)`,
  };
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
      rol: true,
      activo: true,
      zonaId: true,
      gerenteId: true,
      coordinadorId: true,
      inspector: {
        select: {
          id: true,
          activo: true,
        },
      },
    },
  });

  if (!usuarioActual || !usuarioActual.activo) {
    redirect("/acceso");
  }

  if (
    usuarioActual.rol === RolUsuario.CLIENTE ||
    usuarioActual.rol === RolUsuario.ADMINISTRADOR
  ) {
    redirect(
      usuarioActual.rol === RolUsuario.CLIENTE
        ? "/portal"
        : "/acceso",
    );
  }

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
          hallazgoAnterior: {
            include: {
              fotografias: true,
            },
          },
        },
      },
      fotografias: {
        orderBy: {
          creadaEn: "asc",
        },
      },
      certificado: true,
      firmas: {
        where: {
          tipo: {
            in: ["INSPECTOR", "CLIENTE"],
          },
        },
        orderBy: {
          firmadaEn: "desc",
        },
      },
    },
  });

  if (!inspeccion) {
    notFound();
  }

  const puedeAbrirReporte =
    puede(
      usuarioActual.rol,
      "REPORTE_VER",
    ) &&
    puedeAbrirExpedienteTecnico(
      {
        id: usuarioActual.id,
        rol: usuarioActual.rol,
        zonaId: usuarioActual.zonaId,
        gerenteId: usuarioActual.gerenteId,
        coordinadorId: usuarioActual.coordinadorId,
        inspectorId:
          usuarioActual.inspector?.id ?? null,
      },
      {
        id: inspeccion.id,
        zonaId: inspeccion.zonaId,
        clienteId: inspeccion.clienteId,
        inspectorId: inspeccion.inspectorId,
        inspectorUsuarioId:
          inspeccion.inspector?.usuarioId ?? null,
        inspectorZonaId:
          inspeccion.inspector?.usuario.zonaId ?? null,
        coordinadorUsuarioId:
          inspeccion.inspector?.usuario.coordinadorId ?? null,
        gerenteUsuarioId:
          inspeccion.inspector?.usuario.gerenteId ?? null,
      },
    );

  if (!puedeAbrirReporte) {
    redirect("/acceso");
  }

  const puedeImprimirReporte =
    puede(
      usuarioActual.rol,
      "REPORTE_IMPRIMIR",
    ) &&
    usuarioActual.rol === RolUsuario.DIRECTOR;

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
  const colorISH = colorEvaluacion(ish);
  const esSeguimiento =
    inspeccion.numeroInspeccion > 1 && Boolean(inspeccion.inspeccionAnteriorId);
  const versionAnterior = Math.max(1, inspeccion.numeroInspeccion - 1);
  const hallazgosConSeguimiento = inspeccion.hallazgos.filter(
    (hallazgo) => Boolean(hallazgo.hallazgoAnteriorId),
  );
  const nuevosHallazgos = inspeccion.hallazgos.filter(
    (hallazgo) => !hallazgo.hallazgoAnteriorId,
  );

  const firmaInspector =
    inspeccion.firmas.find(
      (firma) => firma.tipo === "INSPECTOR",
    ) ?? null;

  const firmaCliente =
    inspeccion.firmas.find(
      (firma) => firma.tipo === "CLIENTE",
    ) ?? null;

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

  const idsFotosEnHallazgos = new Set(
    inspeccion.hallazgos.flatMap((hallazgo) =>
      hallazgo.fotografias.map((foto) => foto.id),
    ),
  );

  const fotografiasComplementarias = fotografiasConUrl.filter(
    (foto) => !idsFotosEnHallazgos.has(foto.id),
  );

  const fotografiasAntecedentes = inspeccion.hallazgos.flatMap(
    (hallazgo) => hallazgo.hallazgoAnterior?.fotografias ?? [],
  );

  const fotografiasAntecedentesConUrl = await Promise.all(
    fotografiasAntecedentes.map(async (foto) => ({
      ...foto,
      imagenUrl: await obtenerUrlImagen(foto.url, supabase),
    })),
  );

  const urlPorFotoAntecedente = new Map(
    fotografiasAntecedentesConUrl.map((foto) => [
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
          margin: 13mm 12mm 14mm;
        }

        @media print {
          html,
          body {
            margin: 0 !important;
            background: white !important;
          }

          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .portada-reporte {
            box-sizing: border-box !important;
            height: 244mm !important;
            min-height: 244mm !important;
            max-height: 244mm !important;
            overflow: hidden !important;
            break-after: page;
            page-break-after: always;
          }

          .portada-reporte .portada-titulo {
            margin-top: 10mm !important;
          }

          .portada-reporte .portada-datos {
            margin-top: 6mm !important;
          }

          .portada-reporte .portada-indicadores {
            margin-top: 5mm !important;
          }

          .portada-reporte .portada-footer {
            padding-top: 3mm !important;
          }

          .seccion-reporte {
            padding: 5mm 0 3mm !important;
          }

          .encabezado-seccion {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            break-after: avoid-page !important;
            page-break-after: avoid !important;
          }

          .primer-bloque-seccion {
            break-before: avoid-page !important;
            page-break-before: avoid !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .evitar-corte {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .permitir-corte {
            break-inside: auto;
            page-break-inside: auto;
          }

          .salto-certificado {
            break-before: page;
            page-break-before: always;
          }

          .firmas-unidas {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .comparacion-grid {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
            gap: 4mm !important;
          }

          .firma-grid {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 5mm !important;
          }

          .foto-comparativa {
            height: 38mm !important;
          }

          .foto-miniatura {
            height: 30mm !important;
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
          {inspeccion.certificado &&
            (
              usuarioActual.rol === RolUsuario.GERENTE ||
              usuarioActual.rol === RolUsuario.DIRECTOR
            ) && (
              <Link
                href={`/panel/inspecciones/${inspeccion.id}/certificado`}
                className="rounded-full border border-slate-400 px-5 py-3 font-bold"
              >
                Ver certificado
              </Link>
            )}

          {puedeImprimirReporte && (
            <PrintButton />
          )}
        </div>
      </div>

      <article className="mx-auto max-w-5xl bg-white shadow-2xl print:max-w-none print:shadow-none">
        {/* PORTADA */}
        <section className="portada-reporte relative flex flex-col overflow-hidden bg-slate-950 px-10 py-9 text-white">
          <div className="absolute right-0 top-0 h-72 w-72 rounded-bl-full bg-cyan-400/10" />

          <ReportBrandHeader
            title="Reporte técnico de inspección"
            folio={inspeccion.folio}
            eyebrow="Inspección • Diagnóstico • Evidencia"
            dark
          />

          <div className="portada-titulo relative z-10 mt-12">
            <p className="text-sm font-black uppercase tracking-[0.28em] text-cyan-300">
              Documento confidencial
            </p>

            <h1 className="mt-4 max-w-3xl text-5xl font-black leading-tight">
              Reporte Técnico de Inspección
            </h1>

            <p className="mt-3 text-lg text-slate-300">
              Evaluación visual y documental del estado habitacional
            </p>
          </div>

          <div className="portada-datos relative z-10 mt-7 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
            <dl className="grid gap-x-7 gap-y-3 sm:grid-cols-2">
              <PortadaDato label="Folio" value={inspeccion.folio} />
              <PortadaDato
                label="Versión"
                value={`Inspección ${String(inspeccion.numeroInspeccion).padStart(2, "0")} · V${inspeccion.numeroInspeccion}`}
              />
              <PortadaDato label="Cliente" value={inspeccion.cliente.nombre} />
              <PortadaDato
                label="Inmueble"
                value={inspeccion.inmueble?.alias ?? inspeccion.tipoInmueble}
              />
              <PortadaDato
                label="Inspector"
                value={inspeccion.inspector?.usuario.nombre ?? "Sin asignar"}
              />
              <PortadaDato label="Fecha" value={fechaReporte} />
              <div className="sm:col-span-2">
                <PortadaDato
                  label="Dirección"
                  value={`${inspeccion.direccion}, ${inspeccion.ciudad}`}
                />
              </div>
            </dl>
          </div>

          <div className="portada-indicadores relative z-10 mt-5 grid grid-cols-3 gap-3">
            <div
              className="rounded-xl border p-3"
              style={{
                backgroundColor: colorISH.intenso,
                borderColor: colorISH.borde,
              }}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/80">
                Índice ISH
              </p>
              <p className="mt-1 text-2xl font-black text-white">{ish}/100</p>
            </div>

            <div
              className="rounded-xl border p-3"
              style={{
                backgroundColor: colorISH.intenso,
                borderColor: colorISH.borde,
              }}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/80">
                Resultado
              </p>
              <p className="mt-1 text-lg font-black text-white">{semaforo}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                Hallazgos
              </p>
              <p className="mt-1 text-2xl font-black">{totalHallazgos}</p>
            </div>
          </div>

          <footer className="portada-footer relative z-10 mt-auto flex items-end justify-between border-t border-white/10 pt-4 text-[10px] text-slate-400">
            <p>Certeza Habitacional</p>
            <p>{inspeccion.folio}</p>
          </footer>
        </section>

        {/* RESUMEN EJECUTIVO */}
        <section className="seccion-reporte px-12 py-6">
          <EncabezadoSeccion
            numero="01"
            titulo="Resumen ejecutivo"
            subtitulo="Resultado general de la inspección"
          />

          <div className="primer-bloque-seccion mt-4 rounded-[1.25rem] bg-slate-950 p-5 text-white">
            <p className="text-base leading-6 text-slate-300">
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
              <strong style={{ color: colorISH.medio }}>
                {ish}/100
              </strong>
              , correspondiente al estado{" "}
              <strong className="text-white">
                {semaforo}
              </strong>
              .
            </p>

            {esSeguimiento && (
              <p className="mt-5 text-lg leading-8 text-slate-300">
                Esta inspección corresponde a la versión{" "}
                <strong className="text-violet-300">V{inspeccion.numeroInspeccion}</strong>{" "}
                y documenta la evolución respecto de V{versionAnterior}. Se verificaron{" "}
                <strong className="text-white">{hallazgosConSeguimiento.length} hallazgo(s) antecedente(s)</strong>{" "}
                y se registraron{" "}
                <strong className="text-white">{nuevosHallazgos.length} hallazgo(s) nuevo(s)</strong>.
              </p>
            )}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
            <Metric label="ISH" value={ish} />
            <Metric label="Hallazgos" value={totalHallazgos} />
            <Metric label="Conformes" value={resumen.C} />
            <Metric label="Observaciones" value={resumen.O} />
            <Metric label="No conformes" value={resumen.NC} />
            <Metric label="CrÃ­ticos" value={resumen.CR} />
          </div>

          <div className="mt-5 rounded-[1.5rem] border border-slate-200 p-5">
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
        <section className="seccion-reporte px-12 py-6">
          <EncabezadoSeccion
            numero="02"
            titulo="Datos generales"
            subtitulo="InformaciÃ³n del servicio, cliente e inmueble"
          />

          <div className="primer-bloque-seccion mt-4 grid gap-4 md:grid-cols-2">
            <BloqueDatos titulo="Datos del servicio">
              <Row label="Folio" value={inspeccion.folio} />
              <Row
                label="Versión"
                value={`Inspección ${String(inspeccion.numeroInspeccion).padStart(2, "0")} · V${inspeccion.numeroInspeccion}`}
              />
              {esSeguimiento && (
                <Row
                  label="Antecedente directo"
                  value={`V${versionAnterior}`}
                />
              )}
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
        <section className="seccion-reporte px-12 py-6">
          <EncabezadoSeccion
            numero="03"
            titulo="Índice de Salud Habitacional"
            subtitulo="Indicador general del estado observado"
          />

          <div
            className="primer-bloque-seccion mt-4 rounded-[1.25rem] border p-4"
            style={{
              backgroundColor: colorISH.suave,
              borderColor: colorISH.borde,
            }}
          >
            <div className="grid items-center gap-5 md:grid-cols-[160px_1fr]">
              <div
                className="rounded-2xl px-5 py-4 text-center text-white"
                style={{
                  backgroundColor: colorISH.intenso,
                }}
              >
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/80">
                  Resultado ISH
                </p>
                <p className="mt-1 text-5xl font-black leading-none">{ish}</p>
                <p className="mt-1 text-sm font-black">{semaforo}</p>
              </div>

              <div>
                <div className="h-3 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Math.max(0, ish))}%`,
                      backgroundColor: colorISH.intenso,
                    }}
                  />
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-700">
                  El índice resume las condiciones visibles y documentadas durante la
                  inspección y debe interpretarse junto con los hallazgos y evidencias.
                </p>

                <div className="mt-4 grid grid-cols-5 gap-2">
                  {[
                    ["C", resumen.C],
                    ["O", resumen.O],
                    ["NC", resumen.NC],
                    ["CR", resumen.CR],
                    ["NA", resumen.NA],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-xl bg-white px-2 py-2 text-center"
                    >
                      <p className="text-lg font-black">{Number(value)}</p>
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HALLAZGOS */}
        <section className="seccion-reporte px-12 py-6">
          <EncabezadoSeccion
            numero="04"
            titulo="Hallazgos técnicos y seguimiento"
            subtitulo={
              esSeguimiento
                ? `Evolución documentada respecto de V${versionAnterior}`
                : "Observaciones registradas durante la inspección"
            }
          />

          {inspeccion.hallazgos.length === 0 ? (
            <p className="mt-8 rounded-3xl bg-slate-100 p-8 text-slate-600">
              No se registraron hallazgos en este expediente.
            </p>
          ) : (
            <div className="mt-5 space-y-5">
              {inspeccion.hallazgos.map(
                (hallazgo, index) => (
                  <article
                    key={hallazgo.id}
                    className="permitir-corte overflow-hidden rounded-[1.5rem] border border-slate-200"
                  >
                    <header className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 px-5 py-4 text-white">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                          Hallazgo {String(index + 1).padStart(2, "0")}
                        </p>

                        <h3 className="mt-1 text-xl font-black">
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

                    <div className="p-5">
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

                      {hallazgo.hallazgoAnteriorId && hallazgo.hallazgoAnterior ? (
                        <div className="mt-5 rounded-[1.25rem] border border-violet-200 bg-violet-50 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-700">
                                Seguimiento V{versionAnterior} → V{inspeccion.numeroInspeccion}
                              </p>
                              <p className="mt-2 text-lg font-black text-slate-950">
                                {etiquetaSeguimiento[hallazgo.estadoSeguimiento ?? ""] ??
                                  hallazgo.estadoSeguimiento?.replaceAll("_", " ") ??
                                  "Seguimiento registrado"}
                              </p>
                            </div>

                            <span className="rounded-full bg-violet-200 px-4 py-2 text-xs font-black text-violet-900">
                              Antecedente: {hallazgo.hallazgoAnterior.titulo}
                            </span>
                          </div>

                          {hallazgo.observacionSeguimiento && (
                            <div className="mt-4 rounded-2xl bg-white p-4">
                              <TituloCampo>Observación de seguimiento</TituloCampo>
                              <p className="mt-2 leading-7 text-slate-700">
                                {hallazgo.observacionSeguimiento}
                              </p>
                            </div>
                          )}

                          <div className="comparacion-grid mt-4 grid grid-cols-2 gap-4">
                            <ComparativoEvidencia
                              titulo={`ANTES · V${versionAnterior}`}
                              subtitulo="Evidencia antecedente"
                              fotografias={hallazgo.hallazgoAnterior.fotografias.map((foto) => ({
                                id: foto.id,
                                descripcion: foto.descripcion,
                                imagenUrl: urlPorFotoAntecedente.get(foto.id) ?? null,
                              }))}
                              vacio="Sin evidencia fotogrÃ¡fica antecedente"
                            />

                            <ComparativoEvidencia
                              titulo={`ACTUAL · V${inspeccion.numeroInspeccion}`}
                              subtitulo="Evidencia de seguimiento"
                              fotografias={hallazgo.fotografias.map((foto) => ({
                                id: foto.id,
                                descripcion: foto.descripcion,
                                imagenUrl: urlPorFoto.get(foto.id) ?? null,
                              }))}
                              vacio="Sin evidencia fotogrÃ¡fica actual"
                            />
                          </div>
                        </div>
                      ) : esSeguimiento ? (
                        <div className="mt-7 rounded-3xl border border-cyan-200 bg-cyan-50 p-5">
                          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-700">
                            Nuevo hallazgo de V{inspeccion.numeroInspeccion}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            Este hallazgo no proviene del expediente V{versionAnterior}; fue identificado por primera vez durante la inspección actual.
                          </p>
                        </div>
                      ) : null}

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

                      <div className="mt-4 grid grid-cols-3 gap-3">
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

                      {!hallazgo.hallazgoAnteriorId && hallazgo.fotografias.length > 0 && (
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

        {/* EVIDENCIA COMPLEMENTARIA */}
        {fotografiasComplementarias.length > 0 && (
          <section className="seccion-reporte px-12 py-8">
            <EncabezadoSeccion
              numero="05"
              titulo="Evidencia complementaria"
              subtitulo="Fotografías no vinculadas a un hallazgo especÃ­fico"
            />

            <div className="mt-4 grid grid-cols-3 gap-3">
              {fotografiasComplementarias.map((foto, index) => (
                <figure
                  key={foto.id}
                  className="evitar-corte overflow-hidden rounded-xl border border-slate-200 bg-white"
                >
                  {foto.imagenUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={foto.imagenUrl}
                      alt={foto.descripcion ?? `Evidencia complementaria ${index + 1}`}
                      className="foto-miniatura h-32 w-full object-cover"
                    />
                  ) : (
                    <div className="foto-miniatura grid h-32 place-items-center bg-slate-100 text-xs text-slate-400">
                      Imagen no disponible
                    </div>
                  )}

                  <figcaption className="p-2 text-[10px] leading-4">
                    <p className="font-black">Foto {index + 1}</p>
                    <p className="text-slate-500">
                      {foto.descripcion ?? "Evidencia complementaria"}
                    </p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* RECOMENDACIONES */}
        <section className="seccion-reporte px-12 py-6">
          <EncabezadoSeccion
            numero="06"
            titulo="Recomendaciones finales"
            subtitulo="Plan de atención sugerido"
          />

          <div className="mt-5 space-y-4">
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
        <section className="seccion-reporte firmas-unidas px-12 py-6">
          <EncabezadoSeccion
            numero="07"
            titulo="Firmas y aceptación"
            subtitulo="Constancia de entrega y recepción del reporte"
          />

          <p className="mt-5 max-w-3xl text-sm leading-6 text-slate-600">
            Las firmas dejan constancia de la participación en el
            proceso de inspección y de la entrega del presente
            reporte. No representan aceptación automática de costos,
            responsabilidades o alcances distintos a los expresamente
            contratados.
          </p>

          <div className="firma-grid mt-6 grid grid-cols-3 gap-5">
            <Firma
              nombre={
                inspeccion.inspector?.usuario.nombre ??
                "Inspector asignado"
              }
              cargo="Inspector responsable"
              imagenUrl={firmaInspector?.imagenUrl ?? null}
              fecha={firmaInspector?.firmadaEn ?? null}
            />

            <Firma
              nombre={inspeccion.cliente.nombre}
              cargo="Cliente o representante"
              imagenUrl={firmaCliente?.imagenUrl ?? null}
              fecha={firmaCliente?.firmadaEn ?? null}
            />

            <Firma
              nombre="Certeza Habitacional"
              cargo="Empresa emisora"
              imagenUrl={null}
              fecha={null}
            />
          </div>
        </section>

        {/* CERTIFICADO */}
        <section className="salto-certificado seccion-reporte px-12 py-10">
          <EncabezadoSeccion
            numero="08"
            titulo="Certificado y validación"
            subtitulo="VerificaciÃ³n de autenticidad documental"
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
    <header className="encabezado-seccion rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-center gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-950 text-sm font-black text-cyan-300">
          {numero}
        </div>

        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-cyan-700">
            Certeza Habitacional · Reporte técnico
          </p>

          <h2 className="mt-1 text-lg font-black leading-tight text-slate-950">
            {titulo}
          </h2>

          <p className="mt-0.5 text-xs leading-5 text-slate-500">
            {subtitulo}
          </p>
        </div>
      </div>
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
      <dt className="text-[10px] font-black uppercase tracking-widest text-cyan-300">
        {label}
      </dt>

      <dd className="mt-1 text-sm font-bold leading-5 text-white">
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
    <div className="rounded-[1.5rem] border border-slate-200 p-5">
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
    <div className="rounded-2xl bg-slate-100 p-3">
      <p className="text-2xl font-black">
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

function ComparativoEvidencia({
  titulo,
  subtitulo,
  fotografias,
  vacio,
}: {
  titulo: string;
  subtitulo: string;
  fotografias: Array<{
    id: string;
    descripcion: string | null;
    imagenUrl: string | null;
  }>;
  vacio: string;
}) {
  const visibles = fotografias.slice(0, 2);

  return (
    <div className="evitar-corte overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-3 py-2">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-700">
          {titulo}
        </p>
        <p className="text-[9px] text-slate-500">{subtitulo}</p>
      </div>

      {visibles.length === 0 ? (
        <div className="grid h-28 place-items-center px-3 text-center text-[10px] text-slate-400">
          {vacio}
        </div>
      ) : (
        <div className={`grid gap-2 p-2 ${visibles.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {visibles.map((foto, index) => (
            <figure
              key={foto.id}
              className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
            >
              {foto.imagenUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={foto.imagenUrl}
                  alt={foto.descripcion ?? `${titulo} · fotografía ${index + 1}`}
                  className="foto-comparativa h-36 w-full object-cover"
                />
              ) : (
                <div className="foto-comparativa grid h-36 place-items-center text-[10px] text-slate-400">
                  Imagen no disponible
                </div>
              )}

              <figcaption className="px-2 py-1 text-[9px] leading-4 text-slate-500">
                {foto.descripcion ?? `Fotografía ${index + 1}`}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {fotografias.length > 2 && (
        <p className="border-t border-slate-100 px-3 py-1 text-[9px] text-slate-400">
          + {fotografias.length - 2} evidencia(s) adicional(es) disponibles en el expediente digital.
        </p>
      )}
    </div>
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
    <div className={`evitar-corte rounded-xl border p-4 ${clase}`}>
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h3 className="text-base font-black">{titulo}</h3>
          <p className="mt-1 text-xs text-slate-600">{descripcion}</p>
        </div>
        <span className="text-xs font-black text-slate-500">
          {hallazgos.length}
        </span>
      </div>

      {hallazgos.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          Sin hallazgos en esta categoría.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-200/70 rounded-lg bg-white/70 px-3">
          {hallazgos.map((hallazgo) => (
            <li key={hallazgo.id} className="py-2 text-xs">
              <p className="font-black text-slate-900">{hallazgo.titulo}</p>
              <p className="mt-1 leading-5 text-slate-600">
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
  imagenUrl,
  fecha,
}: {
  nombre: string;
  cargo: string;
  imagenUrl: string | null;
  fecha: Date | null;
}) {
  return (
    <div className="text-center">
      <div className="flex h-16 items-end justify-center border-b border-slate-400 pb-1">
        {imagenUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imagenUrl}
            alt={`Firma de ${nombre}`}
            className="max-h-14 max-w-full object-contain"
          />
        ) : (
          <span className="pb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
            Sin firma digital registrada
          </span>
        )}
      </div>

      <p className="mt-4 font-black">
        {nombre}
      </p>

      <p className="mt-1 text-sm text-slate-500">
        {cargo}
      </p>

      {fecha && (
        <p className="mt-1 text-xs text-slate-400">
          Firmado:{" "}
          {fecha.toLocaleString("es-MX", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}
    </div>
  );
}
