import Link from "next/link";
import { EstadoInspeccion, EstadoPago } from "@prisma/client";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  aprobarDireccion,
  asignarInspector,
  aprobarGerencia,
  devolverACoordinacion,
  devolverAInspector,
  cambiarEstado,
  cancelarInspeccion,
  crearHallazgo,
  darVistoBuenoCoordinador,
  finalizarCaptura,
  iniciarInspeccion,
  levantarBloqueoYAprobar,
  liberarInicioSinPago,
  noAprobarDireccion,
  retenerParaAuditoria,
} from "./actions";

type SearchParams = Promise<{ ok?: string; error?: string }>;

function formatoFecha(valor: Date, zonaHoraria: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: zonaHoraria,
  }).format(valor);
}

function dinero(valor: unknown) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number(valor ?? 0));
}

export default async function ExpedientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await auth();

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    include: {
      cliente: true,
      inmueble: true,
      inspector: { include: { usuario: true } },
      certificado: true,
      cotizacion: {
        select: {
          folio: true,
          total: true,
          montoPagado: true,
          estadoPago: true,
          esquemaPago: true,
        },
      },
      hallazgos: {
        orderBy: { creadoEn: "desc" },
        include: { fotografias: { select: { id: true } } },
      },
      fotografias: { orderBy: { creadaEn: "desc" } },
      firmas: { orderBy: { firmadaEn: "desc" } },
      bloqueadaPor: {
        select: {
          nombre: true,
          email: true,
          rol: true,
        },
      },
      revisiones: {
        orderBy: { creadaEn: "desc" },
        include: {
          usuario: {
            select: {
              nombre: true,
              email: true,
              rol: true,
            },
          },
        },
      },
    },
  });

  if (!inspeccion) notFound();

  const historialInspecciones = inspeccion.inmuebleId
    ? await prisma.inspeccion.findMany({
        where: {
          inmuebleId: inspeccion.inmuebleId,
        },
        orderBy: [
          { numeroInspeccion: "asc" },
          { fechaProgramada: "asc" },
        ],
        select: {
          id: true,
          folio: true,
          numeroInspeccion: true,
          inspeccionAnteriorId: true,
          fechaProgramada: true,
          estado: true,
          ish: true,
          semaforo: true,
          _count: {
            select: {
              hallazgos: true,
            },
          },
        },
      })
    : [];

  const totalCotizacion = Number(inspeccion.cotizacion?.total ?? 0);
  const montoPagado = Number(inspeccion.cotizacion?.montoPagado ?? 0);
  const saldoPendiente = Math.max(0, totalCotizacion - montoPagado);
  const pagoLiquidado =
    !inspeccion.cotizacion ||
    (inspeccion.cotizacion.estadoPago === EstadoPago.PAGADO &&
      saldoPendiente <= 0.01);

  const excepcionAdministrativa =
    Boolean(inspeccion.inicioLiberadoSinPago) && !pagoLiquidado;

  const operacionBloqueada =
    inspeccion.estado === "PROGRAMADA" &&
    !pagoLiquidado &&
    !excepcionAdministrativa;

  // Una inspección finalizada queda en modo consulta. La excepción
  // administrativa solo libera el INICIO con saldo; nunca libera el
  // certificado ni reabre un expediente finalizado.
  const expedienteFinalizado = inspeccion.estado === "FINALIZADA";
  const expedienteCancelado = inspeccion.estado === "CANCELADA";
  const capturaSoloLectura = expedienteFinalizado || expedienteCancelado;
  const certificadoFinancieramenteLiberado = pagoLiquidado;

  const rolesAutorizanExcepcionPago = ["DIRECTOR", "ADMINISTRADOR"];
  const puedeAutorizarExcepcionPago = session?.user?.role
    ? rolesAutorizanExcepcionPago.includes(session.user.role)
    : false;

  const rolActual = session?.user?.role ?? "";
  const puedeIniciarInspeccion =
    rolActual === "INSPECTOR" || rolActual === "DIRECTOR";
  const puedeFinalizarCaptura = [
    "INSPECTOR",
    "SUPERVISOR",
    "COORDINADOR",
    "GERENTE",
    "DIRECTOR",
    "ADMINISTRADOR",
  ].includes(rolActual);
  const esCoordinador = rolActual === "COORDINADOR";
  const esGerente = rolActual === "GERENTE";
  const esDirector = rolActual === "DIRECTOR";
  const puedeAsignarInspector = esGerente || esDirector;

  const inspectoresDisponibles = puedeAsignarInspector
    ? await prisma.inspector.findMany({
        where: {
          activo: true,
          usuario: {
            activo: true,
          },
        },
        select: {
          id: true,
          ciudad: true,
          especialidad: true,
          usuario: {
            select: {
              nombre: true,
              email: true,
            },
          },
          _count: {
            select: {
              inspecciones: {
                where: {
                  estado: {
                    in: [
                      EstadoInspeccion.PROGRAMADA,
                      EstadoInspeccion.EN_PROCESO,
                      EstadoInspeccion.REPORTE_PENDIENTE,
                    ],
                  },
                },
              },
            },
          },
        },
      })
    : [];

  inspectoresDisponibles.sort((a, b) => {
    const diferenciaCarga =
      a._count.inspecciones - b._count.inspecciones;

    if (diferenciaCarga !== 0) return diferenciaCarga;

    return a.usuario.nombre.localeCompare(
      b.usuario.nombre,
      "es-MX",
    );
  });

  const ultimaDevolucion = inspeccion.revisiones.find(
    (revision) =>
      revision.decision === "DEVUELTO_INSPECTOR" ||
      revision.decision === "DEVUELTO_COORDINACION",
  );

  const devolucionActiva =
    inspeccion.estado === "EN_PROCESO" &&
    ultimaDevolucion?.decision === "DEVUELTO_INSPECTOR"
      ? ultimaDevolucion
      : null;

  const revisionesVigentes = inspeccion.revisiones.filter(
    (revision) => revision.estado === "VIGENTE",
  );

  const vistoBuenoCoordinador = revisionesVigentes.find(
    (revision) =>
      revision.rol === "COORDINADOR" &&
      revision.decision === "VISTO_BUENO",
  );

  const aprobacionGerencia = revisionesVigentes.find(
    (revision) =>
      revision.rol === "GERENTE" &&
      revision.decision === "APROBADO",
  );

  const aprobacionDireccion = revisionesVigentes.find(
    (revision) =>
      revision.rol === "DIRECTOR" &&
      revision.decision === "APROBADO",
  );

  const totalHallazgos = inspeccion.hallazgos.length;
  const criticos = inspeccion.hallazgos.filter(
    (hallazgo) => hallazgo.clasificacion === "CR",
  ).length;
  const noConformes = inspeccion.hallazgos.filter(
    (hallazgo) => hallazgo.clasificacion === "NC",
  ).length;
  const firmasInspector = inspeccion.firmas.some(
    (firma) => firma.tipo.toLowerCase().includes("inspector"),
  );
  const firmasCliente = inspeccion.firmas.some((firma) =>
    firma.tipo.toLowerCase().includes("cliente"),
  );

  const hallazgosSinEvidencia = inspeccion.hallazgos.filter(
    (hallazgo) => hallazgo.fotografias.length === 0,
  ).length;

  const requisitosRevision = [
    {
      nombre: "Hallazgos registrados",
      completo: totalHallazgos > 0,
    },
    {
      nombre: "Evidencia fotográfica en todos los hallazgos",
      completo: totalHallazgos > 0 && hallazgosSinEvidencia === 0,
    },
    {
      nombre: "Firma del inspector",
      completo: firmasInspector,
    },
    {
      nombre: "Firma del cliente",
      completo: firmasCliente,
    },
  ];

  const expedienteListoParaRevision = requisitosRevision.every(
    (requisito) => requisito.completo,
  );

  const requisitosPendientes = requisitosRevision.filter(
    (requisito) => !requisito.completo,
  );

  const pasos = [
    { nombre: "Datos generales", completo: true },
    { nombre: "Hallazgos", completo: totalHallazgos > 0 },
    { nombre: "Evidencias", completo: inspeccion.fotografias.length > 0 },
    { nombre: "Firma del inspector", completo: firmasInspector },
    { nombre: "Firma del cliente", completo: firmasCliente },
    { nombre: "Reporte", completo: Boolean(inspeccion.certificado) || inspeccion.estado === "FINALIZADA" },
  ];
  const avance = Math.round(
    (pasos.filter((paso) => paso.completo).length / pasos.length) * 100,
  );

  const actividad = [
    {
      fecha: inspeccion.creadoEn,
      titulo: "Inspección creada",
      detalle: `Expediente ${inspeccion.folio}`,
    },
    ...inspeccion.hallazgos.slice(0, 5).map((hallazgo) => ({
      fecha: hallazgo.creadoEn,
      titulo: "Hallazgo registrado",
      detalle: `${hallazgo.area}: ${hallazgo.titulo}`,
    })),
    ...inspeccion.fotografias.slice(0, 5).map((foto) => ({
      fecha: foto.creadaEn,
      titulo: "Evidencia incorporada",
      detalle: foto.descripcion ?? "Fotografía del expediente",
    })),
    ...inspeccion.firmas.slice(0, 3).map((firma) => ({
      fecha: firma.firmadaEn,
      titulo: "Firma registrada",
      detalle: `${firma.tipo}: ${firma.nombreFirmante}`,
    })),
    ...(inspeccion.certificado
      ? [
          {
            fecha: inspeccion.certificado.emitidoEn,
            titulo: "Certificado emitido",
            detalle: inspeccion.certificado.folio,
          },
        ]
      : []),
  ]
    .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
    .slice(0, 8);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <Link href="/panel" className="text-sm font-bold text-cyan-300">
          ← Panel
        </Link>

        {query.ok && (
          <p className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-4 font-bold text-emerald-300">
            {query.ok}
          </p>
        )}
        {query.error && (
          <p className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-5 py-4 font-bold text-rose-300">
            {query.error}
          </p>
        )}

        <header className="mt-5 rounded-3xl border border-white/10 bg-slate-900 p-7">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-black text-cyan-300">{inspeccion.folio}</p>
                <Estado estado={inspeccion.estado} />
                <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-300">
                  INSPECCIÓN {String(inspeccion.numeroInspeccion).padStart(2, "0")} · V{inspeccion.numeroInspeccion}
                </span>
                {excepcionAdministrativa && (
                  <span className="rounded-full bg-violet-400/15 px-3 py-1 text-xs font-black text-violet-300">
                    EXCEPCIÓN ADMINISTRATIVA
                  </span>
                )}
              </div>
              <h1 className="mt-2 text-3xl font-black">
                {inspeccion.inmueble?.alias ?? inspeccion.tipoInmueble}
              </h1>
              <p className="mt-2 text-slate-400">
                {inspeccion.cliente.nombre} · {inspeccion.direccion}, {inspeccion.ciudad}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Programada: {formatoFecha(inspeccion.fechaProgramada, inspeccion.zonaHoraria)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Inspector: {inspeccion.inspector?.usuario.nombre ?? "Sin asignar"}
              </p>

              {inspeccion.numeroInspeccion > 1 && inspeccion.inspeccionAnteriorId && (
                <p className="mt-2 text-sm font-bold text-cyan-300">
                  Inspección de seguimiento · antecedente V{inspeccion.numeroInspeccion - 1}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              {expedienteFinalizado ? (
                <span className="cursor-not-allowed rounded-full border border-white/10 px-5 py-3 font-black text-slate-600">
                  Expediente en solo lectura
                </span>
              ) : (
                <Link
                  href={`/panel/inspecciones/${inspeccion.id}/editar`}
                  className="rounded-full border border-white/15 px-5 py-3 font-black hover:bg-white/5"
                >
                  Editar
                </Link>
              )}
              {expedienteFinalizado ? null : operacionBloqueada ? (
                <span className="cursor-not-allowed rounded-full border border-amber-300/30 bg-amber-300/10 px-5 py-3 font-black text-amber-300">
                  Saldo pendiente — {dinero(saldoPendiente)}
                </span>
              ) : puedeIniciarInspeccion && (inspeccion.estado === "PROGRAMADA" || inspeccion.estado === "EN_PROCESO") ? (
                <form action={iniciarInspeccion}>
                  <input type="hidden" name="id" value={inspeccion.id} />
                  <button className="rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950 hover:bg-cyan-300">
                    {inspeccion.estado === "PROGRAMADA"
                      ? "Iniciar inspección"
                      : "Continuar captura"}
                  </button>
                </form>
              ) : null}
              <Link
                href={`/panel/inspecciones/${inspeccion.id}/reporte`}
                className="rounded-full border border-white/15 px-5 py-3 font-black hover:bg-white/5"
              >
                Ver reporte
              </Link>
              {inspeccion.liberacionBloqueada ? (
                <span className="cursor-not-allowed rounded-full border border-rose-400/30 bg-rose-400/10 px-5 py-3 font-black text-rose-300">
                  Certificado bloqueado
                </span>
              ) : inspeccion.certificado ? (
                <Link
                  href={`/panel/inspecciones/${inspeccion.id}/certificado`}
                  className="rounded-full border border-cyan-400 px-5 py-3 font-black text-cyan-300 transition hover:bg-cyan-400 hover:text-slate-950"
                >
                  Ver certificado
                </Link>
              ) : inspeccion.estado === "FINALIZADA" && !certificadoFinancieramenteLiberado ? (
                <span className="cursor-not-allowed rounded-full border border-amber-300/30 bg-amber-300/10 px-5 py-3 font-black text-amber-300">
                  Certificado pendiente de liquidación — {dinero(saldoPendiente)}
                </span>
              ) : inspeccion.estado === "FINALIZADA" ? (
                <Link
                  href={`/panel/inspecciones/${inspeccion.id}/certificado`}
                  className="rounded-full border border-cyan-400 px-5 py-3 font-black text-cyan-300 transition hover:bg-cyan-400 hover:text-slate-950"
                >
                  Emitir certificado
                </Link>
              ) : (
                <span className="cursor-not-allowed rounded-full border border-white/10 px-5 py-3 font-black text-slate-600">
                  Certificado pendiente
                </span>
              )}
            </div>
          </div>
        </header>

        {historialInspecciones.length > 0 && (
          <section className="mt-5 rounded-3xl border border-cyan-400/20 bg-slate-900 p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                  Historial del inmueble
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  Evolución de inspecciones
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Cada inspección conserva su expediente y reporte como antecedente histórico independiente.
                </p>
              </div>

              <span className="text-sm font-bold text-slate-500">
                {historialInspecciones.length} inspección(es)
              </span>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {historialInspecciones.map((item) => {
                const actual = item.id === inspeccion.id;

                return (
                  <Link
                    key={item.id}
                    href={`/panel/inspecciones/${item.id}`}
                    className={`rounded-2xl border p-5 transition ${
                      actual
                        ? "border-cyan-400/50 bg-cyan-400/10"
                        : "border-white/10 bg-slate-950 hover:border-cyan-400/30 hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-300">
                          V{item.numeroInspeccion}
                        </span>
                        <span className="text-sm font-black">
                          Inspección {String(item.numeroInspeccion).padStart(2, "0")}
                        </span>
                        {actual && (
                          <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-300">
                            ACTUAL
                          </span>
                        )}
                      </div>

                      <Estado estado={item.estado} />
                    </div>

                    <p className="mt-4 font-black text-white">
                      {item.folio}
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      {formatoFecha(item.fechaProgramada, inspeccion.zonaHoraria)}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
                      <span>{item._count.hallazgos} hallazgo(s)</span>
                      <span>
                        ISH: {item.ish === null ? "Sin evaluar" : Math.round(Number(item.ish))}
                      </span>
                      <span>{item.semaforo ?? "Sin semáforo"}</span>
                    </div>

                    {item.numeroInspeccion > 1 && (
                      <p className="mt-3 text-xs font-bold text-cyan-300">
                        Seguimiento de V{item.numeroInspeccion - 1}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {puedeAsignarInspector && (
          <section className="mt-5 rounded-3xl border border-cyan-400/20 bg-cyan-400/5 p-6">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
              <div className="max-w-3xl">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                  Asignación operativa
                </p>
                <h2 className="mt-2 text-xl font-black">
                  {inspeccion.inspector
                    ? "Reasignar inspector"
                    : "Asignar inspector"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Gerencia y Dirección pueden asignar al inspector responsable.
                  La lista se ordena por carga operativa actual: inspecciones
                  programadas, en proceso o con reporte pendiente.
                </p>

                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                    Inspector actual
                  </p>
                  <p className="mt-2 font-black text-white">
                    {inspeccion.inspector?.usuario.nombre ?? "Sin asignar"}
                  </p>
                  {inspeccion.inspector?.usuario.email && (
                    <p className="mt-1 text-sm text-slate-500">
                      {inspeccion.inspector.usuario.email}
                    </p>
                  )}
                </div>
              </div>

              {expedienteFinalizado || expedienteCancelado ? (
                <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-950 p-5 text-sm text-slate-400">
                  La asignación está bloqueada porque el expediente está {" "}
                  <strong className="text-slate-200">
                    {inspeccion.estado.replaceAll("_", " ")}
                  </strong>. Un expediente cerrado no puede reasignarse por el
                  flujo ordinario.
                </div>
              ) : (
                <form
                  action={asignarInspector}
                  className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-950 p-5"
                >
                  <input
                    type="hidden"
                    name="inspeccionId"
                    value={inspeccion.id}
                  />

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-300">
                      Inspector responsable
                    </span>
                    <select
                      name="inspectorId"
                      required
                      defaultValue={inspeccion.inspectorId ?? ""}
                      className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-300"
                    >
                      <option value="" disabled>
                        Selecciona un inspector
                      </option>
                      {inspectoresDisponibles.map((inspector) => (
                        <option key={inspector.id} value={inspector.id}>
                          {inspector.usuario.nombre} · {inspector.ciudad ?? "Sin ciudad"} · {inspector._count.inspecciones} activa(s)
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="mt-4 block">
                    <span className="mb-2 block text-sm font-bold text-slate-300">
                      {inspeccion.inspector
                        ? "Motivo de la reasignación *"
                        : "Comentario de asignación"}
                    </span>
                    <textarea
                      name="motivo"
                      required={Boolean(inspeccion.inspector)}
                      minLength={inspeccion.inspector ? 10 : undefined}
                      rows={3}
                      placeholder={
                        inspeccion.inspector
                          ? "Ej. Redistribución de carga operativa (mínimo 10 caracteres)"
                          : "Comentario opcional"
                      }
                      className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-300"
                    />
                  </label>

                  <button className="mt-4 w-full rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950 transition hover:bg-cyan-300">
                    {inspeccion.inspector
                      ? "Confirmar reasignación"
                      : "Asignar inspector"}
                  </button>
                </form>
              )}
            </div>
          </section>
        )}

        {devolucionActiva && (
          <section className="mt-5 rounded-3xl border border-rose-400/30 bg-rose-400/10 p-6">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
              <div className="max-w-3xl">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-300">
                  Expediente devuelto para corrección
                </p>

                <h2 className="mt-2 text-xl font-black text-white">
                  Coordinación solicita completar o corregir esta inspección
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-300">
                  El expediente regresó a EN PROCESO. Atiende las observaciones
                  indicadas y vuelve a finalizar la captura cuando hayas
                  completado las correcciones.
                </p>

                <div className="mt-4 rounded-2xl border border-rose-300/20 bg-slate-950/60 p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-rose-300">
                    Motivo de la devolución
                  </p>

                  <p className="mt-2 text-base font-bold text-white">
                    {devolucionActiva.comentario ??
                      "No se registró un comentario de devolución."}
                  </p>

                  <p className="mt-3 text-xs text-slate-500">
                    Devuelto por {devolucionActiva.usuario.nombre} ·{" "}
                    {formatoFecha(
                      devolucionActiva.creadaEn,
                      inspeccion.zonaHoraria,
                    )}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-3">
                <Link
                  href={`/panel/inspecciones/${inspeccion.id}/captura`}
                  className="rounded-full bg-rose-300 px-5 py-3 text-center font-black text-slate-950 transition hover:bg-rose-200"
                >
                  Corregir inspección
                </Link>

                <Link
                  href={`/panel/inspecciones/${inspeccion.id}/firmas`}
                  className="rounded-full border border-white/15 px-5 py-3 text-center font-black text-white transition hover:bg-white/5"
                >
                  Revisar firmas
                </Link>
              </div>
            </div>
          </section>
        )}

        {inspeccion.cotizacion && (
          <section
            className={`mt-5 rounded-3xl border p-5 ${
              pagoLiquidado
                ? "border-emerald-400/20 bg-emerald-400/5"
                : excepcionAdministrativa
                  ? "border-violet-400/20 bg-violet-400/5"
                  : "border-amber-300/20 bg-amber-300/5"
            }`}
          >
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div>
                <p
                  className={`text-xs font-black uppercase tracking-[0.2em] ${
                    pagoLiquidado
                      ? "text-emerald-300"
                      : excepcionAdministrativa
                        ? "text-violet-300"
                        : "text-amber-300"
                  }`}
                >
                  {pagoLiquidado
                    ? "Pago liquidado"
                    : excepcionAdministrativa
                      ? "Excepción administrativa activa"
                      : "Bloqueo financiero"}
                </p>
                <p className="mt-2 text-lg font-black">
                  {pagoLiquidado
                    ? "La inspección está habilitada para iniciar."
                    : excepcionAdministrativa
                      ? "Dirección, Gerencia o Administración autorizó iniciar esta inspección aun con saldo pendiente."
                      : "La inspección puede estar programada, pero no puede iniciar con saldo pendiente."}
                </p>

                {!pagoLiquidado && !excepcionAdministrativa && (
                  <p className="mt-1 text-sm text-slate-400">
                    Liquida {dinero(saldoPendiente)} para habilitar el inicio de la inspección.
                  </p>
                )}

                {excepcionAdministrativa && (
                  <p className="mt-1 text-sm text-violet-200">
                    El saldo de {dinero(saldoPendiente)} continúa pendiente y deberá mantenerse visible hasta su liquidación.
                  </p>
                )}

                {excepcionAdministrativa &&
                  puedeAutorizarExcepcionPago &&
                  inspeccion.motivoLiberacionPago && (
                    <div className="mt-4 rounded-2xl border border-violet-300/15 bg-violet-300/5 p-4">
                      <p className="text-xs font-black uppercase tracking-widest text-violet-300">
                        Motivo registrado
                      </p>
                      <p className="mt-2 text-sm text-slate-300">
                        {inspeccion.motivoLiberacionPago}
                      </p>
                      {inspeccion.inicioLiberadoEn && (
                        <p className="mt-2 text-xs text-slate-500">
                          Autorizada el{" "}
                          {formatoFecha(
                            inspeccion.inicioLiberadoEn,
                            inspeccion.zonaHoraria,
                          )}
                        </p>
                      )}
                    </div>
                  )}
              </div>

              <div className="grid grid-cols-3 gap-3 text-right">
                <DatoMini etiqueta="Total" valor={dinero(totalCotizacion)} />
                <DatoMini etiqueta="Pagado" valor={dinero(montoPagado)} />
                <DatoMini etiqueta="Saldo" valor={dinero(saldoPendiente)} />
              </div>
            </div>
          </section>
        )}

        {inspeccion.cotizacion &&
          !pagoLiquidado &&
          !excepcionAdministrativa &&
          inspeccion.estado === "PROGRAMADA" &&
          puedeAutorizarExcepcionPago && (
            <section className="mt-5 rounded-3xl border border-violet-400/20 bg-violet-400/5 p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
                Excepción de nivel directivo
              </p>

              <h2 className="mt-2 text-lg font-black">
                Autorizar inicio con saldo pendiente
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Esta acción no modifica el pago ni elimina el saldo. Únicamente libera
                el inicio de esta inspección y deja registro de quién, cuándo y por qué
                autorizó la excepción.
              </p>

              <form action={liberarInicioSinPago} className="mt-4">
                <input type="hidden" name="id" value={inspeccion.id} />

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-300">
                    Justificación obligatoria
                  </span>

                  <textarea
                    name="motivo"
                    required
                    minLength={10}
                    rows={3}
                    placeholder="Ej. Cliente corporativo con pago programado para el día..."
                    className="w-full rounded-2xl border border-violet-300/20 bg-slate-950 px-4 py-3 outline-none focus:border-violet-300"
                  />
                </label>

                <button
                  type="submit"
                  className="mt-4 rounded-full bg-violet-300 px-5 py-3 font-black text-slate-950 transition hover:bg-violet-200"
                >
                  Autorizar excepción administrativa
                </button>
              </form>
            </section>
          )}

        <section className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
          <Metrica etiqueta="Avance" valor={`${avance}%`} />
          <Metrica etiqueta="Hallazgos" valor={String(totalHallazgos)} />
          <Metrica etiqueta="No conformes" valor={String(noConformes)} />
          <Metrica etiqueta="Críticos" valor={String(criticos)} />
          <Metrica
            etiqueta="Índice general"
            valor={inspeccion.ish === null ? "—" : String(Math.round(Number(inspeccion.ish)))}
          />
        </section>

        <section className="mt-7 rounded-3xl border border-cyan-400/20 bg-slate-900 p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                Revisión y aprobación
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Control de cierre y liberación
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Coordinación puede emitir visto bueno técnico. Gerencia puede aprobar y finalizar.
                Dirección puede aprobar directamente, aunque no existan aprobaciones previas, y también
                puede detener la liberación mediante no aprobación o retención para auditoría.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <RevisionEstado
                etiqueta="Coordinación"
                activo={Boolean(vistoBuenoCoordinador)}
              />
              <RevisionEstado
                etiqueta="Gerencia"
                activo={Boolean(aprobacionGerencia)}
              />
              <RevisionEstado
                etiqueta="Dirección"
                activo={Boolean(aprobacionDireccion)}
              />
            </div>
          </div>

          {inspeccion.liberacionBloqueada && (
            <div className="mt-5 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-5">
              <p className="font-black text-rose-300">
                LIBERACIÓN BLOQUEADA POR DIRECCIÓN
              </p>

              <p className="mt-2 text-sm text-slate-300">
                {inspeccion.motivoBloqueoLiberacion ??
                  "La inspección se encuentra retenida por Dirección."}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                {inspeccion.bloqueadaPor?.nombre
                  ? `Bloqueada por ${inspeccion.bloqueadaPor.nombre}`
                  : "Bloqueo directivo"}
                {inspeccion.bloqueadaEn
                  ? ` · ${formatoFecha(
                      inspeccion.bloqueadaEn,
                      inspeccion.zonaHoraria,
                    )}`
                  : ""}
              </p>
            </div>
          )}

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {inspeccion.estado === "EN_PROCESO" &&
              puedeFinalizarCaptura && (
                <form
                  action={finalizarCaptura}
                  className="rounded-2xl border border-white/10 bg-slate-950 p-5"
                >
                  <input
                    type="hidden"
                    name="inspeccionId"
                    value={inspeccion.id}
                  />

                  <p className="font-black">
                    Finalizar captura de campo
                  </p>

                  <p className="mt-2 text-sm text-slate-400">
                    Envía la inspección a REPORTE PENDIENTE para iniciar la revisión interna.
                  </p>

                  <button className="mt-4 w-full rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950">
                    Finalizar captura
                  </button>
                </form>
              )}

            {inspeccion.estado === "REPORTE_PENDIENTE" &&
              esCoordinador &&
              !inspeccion.liberacionBloqueada &&
              !vistoBuenoCoordinador &&
              expedienteListoParaRevision && (
                <form
                  action={darVistoBuenoCoordinador}
                  className="rounded-2xl border border-white/10 bg-slate-950 p-5"
                >
                  <input
                    type="hidden"
                    name="inspeccionId"
                    value={inspeccion.id}
                  />

                  <p className="font-black">
                    Coordinación
                  </p>

                  <p className="mt-2 text-sm text-slate-400">
                    El visto bueno técnico queda registrado, pero no cierra por sí solo la inspección.
                  </p>

                  <textarea
                    name="comentario"
                    rows={3}
                    placeholder="Comentario opcional"
                    className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
                  />

                  <button className="mt-3 w-full rounded-full border border-cyan-400/40 px-5 py-3 font-black text-cyan-300">
                    Dar visto bueno técnico
                  </button>
                </form>
              )}

            {inspeccion.estado === "REPORTE_PENDIENTE" &&
              esCoordinador &&
              !inspeccion.liberacionBloqueada &&
              !vistoBuenoCoordinador &&
              !expedienteListoParaRevision && (
                <div className="grid gap-4 lg:col-span-2 lg:grid-cols-2">
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
                    <p className="font-black text-amber-300">
                      Expediente incompleto
                    </p>

                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      Coordinación no puede emitir visto bueno hasta que se completen los requisitos pendientes.
                    </p>

                    <div className="mt-4 space-y-2 text-sm">
                      {requisitosPendientes.map((requisito) => (
                        <p key={requisito.nombre} className="text-amber-200">
                          â€¢ {requisito.nombre}
                        </p>
                      ))}
                    </div>
                  </div>

                  <form
                    action={devolverAInspector}
                    className="rounded-2xl border border-rose-400/20 bg-slate-950 p-5"
                  >
                    <input
                      type="hidden"
                      name="inspeccionId"
                      value={inspeccion.id}
                    />

                    <p className="font-black text-rose-300">
                      Devolver al Inspector
                    </p>

                    <p className="mt-2 text-sm text-slate-400">
                      Regresa el expediente a EN PROCESO para que el Inspector complete o corrija los requisitos pendientes.
                    </p>

                    <textarea
                      name="comentario"
                      required
                      minLength={10}
                      rows={3}
                      placeholder="Motivo obligatorio de la devolución (mínimo 10 caracteres)"
                      className="mt-4 w-full rounded-2xl border border-rose-400/20 bg-slate-900 px-4 py-3"
                    />

                    <button className="mt-3 w-full rounded-full border border-rose-400/40 px-5 py-3 font-black text-rose-300">
                      Devolver al Inspector
                    </button>
                  </form>
                </div>
              )}

            {inspeccion.estado === "REPORTE_PENDIENTE" &&
              esCoordinador &&
              !inspeccion.liberacionBloqueada &&
              vistoBuenoCoordinador && (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5">
                  <p className="font-black text-emerald-300">
                    Visto bueno técnico registrado
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Coordinación ya aprobó esta revisión. No es posible emitir otro visto bueno
                    mientras esta decisión continúe vigente.
                  </p>

                  <p className="mt-3 text-xs text-slate-500">
                    Si Gerencia devuelve la inspección, el visto bueno vigente se invalidará
                    y esta opción volverá a habilitarse automáticamente.
                  </p>
                </div>
              )}

            {inspeccion.estado === "REPORTE_PENDIENTE" &&
              esGerente &&
              !inspeccion.liberacionBloqueada &&
              vistoBuenoCoordinador &&
              expedienteListoParaRevision && (
                <div className="grid gap-4 lg:col-span-2 lg:grid-cols-2">
                  <form
                    action={aprobarGerencia}
                    className="rounded-2xl border border-emerald-400/20 bg-slate-950 p-5"
                  >
                    <input
                      type="hidden"
                      name="inspeccionId"
                      value={inspeccion.id}
                    />

                    <p className="font-black text-emerald-300">
                      Aprobar y finalizar
                    </p>

                    <p className="mt-2 text-sm text-slate-400">
                      La aprobación de Gerencia es suficiente para finalizar la inspección
                      si existe visto bueno técnico vigente de Coordinación y no hay bloqueo de Dirección.
                    </p>

                    <textarea
                      name="comentario"
                      rows={3}
                      placeholder="Comentario opcional"
                      className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
                    />

                    <button className="mt-3 w-full rounded-full bg-emerald-400 px-5 py-3 font-black text-slate-950">
                      Aprobar y finalizar
                    </button>
                  </form>

                  <form
                    action={devolverACoordinacion}
                    className="rounded-2xl border border-amber-400/20 bg-slate-950 p-5"
                  >
                    <input
                      type="hidden"
                      name="inspeccionId"
                      value={inspeccion.id}
                    />

                    <p className="font-black text-amber-300">
                      Devolver a Coordinación
                    </p>

                    <p className="mt-2 text-sm text-slate-400">
                      Devuelve el expediente para una nueva revisión técnica.
                      El visto bueno vigente de Coordinación quedará invalidado.
                    </p>

                    <textarea
                      name="comentario"
                      required
                      minLength={10}
                      rows={3}
                      placeholder="Motivo obligatorio de la devolución (mínimo 10 caracteres)"
                      className="mt-4 w-full rounded-2xl border border-amber-400/20 bg-slate-900 px-4 py-3"
                    />

                    <button className="mt-3 w-full rounded-full border border-amber-400/40 px-5 py-3 font-black text-amber-300">
                      Devolver a Coordinación
                    </button>
                  </form>
                </div>
              )}

            {inspeccion.estado === "REPORTE_PENDIENTE" &&
              esGerente &&
              !inspeccion.liberacionBloqueada &&
              vistoBuenoCoordinador &&
              !expedienteListoParaRevision && (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-5 lg:col-span-2">
                  <p className="font-black text-rose-300">
                    Expediente incompleto
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Gerencia no puede aprobar ni finalizar mientras existan requisitos incompletos.
                  </p>
                </div>
              )}

            {inspeccion.estado === "REPORTE_PENDIENTE" &&
              esGerente &&
              !inspeccion.liberacionBloqueada &&
              !vistoBuenoCoordinador && (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5 lg:col-span-2">
                  <p className="font-black text-amber-300">
                    Pendiente de visto bueno de Coordinación
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Gerencia no puede aprobar ni finalizar esta inspección hasta que exista
                    un visto bueno técnico vigente de Coordinación.
                  </p>
                </div>
              )}

            {esDirector &&
              inspeccion.estado !== "PROGRAMADA" &&
              inspeccion.estado !== "EN_PROCESO" &&
              inspeccion.estado !== "CANCELADA" && (
                <div className="rounded-2xl border border-violet-400/20 bg-violet-400/5 p-5 lg:col-span-2">
                  <p className="font-black text-violet-300">
                    Dirección
                  </p>

                  <p className="mt-2 text-sm text-slate-400">
                    La decisión de Dirección prevalece sobre todas las revisiones anteriores.
                  </p>

                  {inspeccion.liberacionBloqueada ? (
                    <form
                      action={levantarBloqueoYAprobar}
                      className="mt-4"
                    >
                      <input
                        type="hidden"
                        name="inspeccionId"
                        value={inspeccion.id}
                      />

                      <textarea
                        name="comentario"
                        required
                        minLength={10}
                        rows={3}
                        placeholder="Explica por qué se levanta el bloqueo y se aprueba la inspección."
                        className="w-full rounded-2xl border border-violet-300/20 bg-slate-950 px-4 py-3"
                      />

                      <button className="mt-3 w-full rounded-full bg-violet-300 px-5 py-3 font-black text-slate-950">
                        Levantar bloqueo y aprobar
                      </button>
                    </form>
                  ) : (
                    <div className="mt-4 grid gap-4 lg:grid-cols-3">
                      <form
                        action={aprobarDireccion}
                        className="rounded-2xl border border-white/10 bg-slate-950 p-4"
                      >
                        <input
                          type="hidden"
                          name="inspeccionId"
                          value={inspeccion.id}
                        />

                        <textarea
                          name="comentario"
                          rows={3}
                          placeholder="Comentario opcional"
                          className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
                        />

                        <button className="mt-3 w-full rounded-full bg-emerald-400 px-4 py-3 font-black text-slate-950">
                          Aprobar y finalizar
                        </button>
                      </form>

                      <form
                        action={noAprobarDireccion}
                        className="rounded-2xl border border-white/10 bg-slate-950 p-4"
                      >
                        <input
                          type="hidden"
                          name="inspeccionId"
                          value={inspeccion.id}
                        />

                        <textarea
                          name="comentario"
                          required
                          minLength={10}
                          rows={3}
                          placeholder="Motivo obligatorio de la no aprobación"
                          className="w-full rounded-2xl border border-rose-400/20 bg-slate-900 px-4 py-3"
                        />

                        <button className="mt-3 w-full rounded-full border border-rose-400/40 px-4 py-3 font-black text-rose-300">
                          No aprobar
                        </button>
                      </form>

                      <form
                        action={retenerParaAuditoria}
                        className="rounded-2xl border border-white/10 bg-slate-950 p-4"
                      >
                        <input
                          type="hidden"
                          name="inspeccionId"
                          value={inspeccion.id}
                        />

                        <textarea
                          name="comentario"
                          required
                          minLength={10}
                          rows={3}
                          placeholder="Motivo obligatorio de la auditoría o retención"
                          className="w-full rounded-2xl border border-amber-300/20 bg-slate-900 px-4 py-3"
                        />

                        <button className="mt-3 w-full rounded-full border border-amber-300/40 px-4 py-3 font-black text-amber-300">
                          Retener para auditoría
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}
          </div>

          <div className="mt-6 border-t border-white/10 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-black">
                Historial de revisiones
              </h3>

              <span className="text-xs text-slate-500">
                {inspeccion.revisiones.length} registro(s)
              </span>
            </div>

            {inspeccion.revisiones.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                Aún no existen decisiones de revisión.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {inspeccion.revisiones.slice(0, 10).map((revision) => (
                  <div
                    key={revision.id}
                    className="rounded-2xl border border-white/10 bg-slate-950 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-300">
                        {revision.rol}
                      </span>

                      <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-black text-slate-300">
                        {revision.decision.replaceAll("_", " ")}
                      </span>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          revision.estado === "VIGENTE"
                            ? "bg-emerald-400/10 text-emerald-300"
                            : revision.estado === "INVALIDADA"
                              ? "bg-rose-400/10 text-rose-300"
                              : "bg-slate-700/40 text-slate-400"
                        }`}
                      >
                        {revision.estado}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-300">
                      {revision.usuario.nombre}
                      {revision.comentario
                        ? ` · ${revision.comentario}`
                        : ""}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {formatoFecha(
                        revision.creadaEn,
                        inspeccion.zonaHoraria,
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="mt-7 grid gap-7 xl:grid-cols-[360px_1fr]">
          <aside className="space-y-7">
            <section className="rounded-3xl border border-white/10 bg-slate-900 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black">Progreso</h2>
                <span className="font-black text-cyan-300">{avance}%</span>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-950">
                <div
                  className="h-full rounded-full bg-cyan-400"
                  style={{ width: `${avance}%` }}
                />
              </div>
              <div className="mt-5 space-y-3">
                {pasos.map((paso) => (
                  <div key={paso.nombre} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-300">{paso.nombre}</span>
                    <span className={paso.completo ? "text-emerald-300" : "text-slate-500"}>
                      {paso.completo ? "Completado" : "Pendiente"}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-slate-900 p-6">
              <h2 className="text-xl font-black">Acciones</h2>
              <div className="mt-5 grid gap-3">
                {capturaSoloLectura ? (
                  <div className="rounded-2xl border border-white/10 px-4 py-3 text-center font-black text-slate-600">
                    Captura en solo lectura
                  </div>
                ) : operacionBloqueada ? (
                  <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-center font-black text-amber-300">
                    Captura bloqueada por saldo pendiente
                  </div>
                ) : (
                  <Link
                    href={`/panel/inspecciones/${inspeccion.id}/captura`}
                    className="rounded-2xl bg-cyan-400 px-4 py-3 text-center font-black text-slate-950"
                  >
                    Capturar Método Certeza
                  </Link>
                )}
                {capturaSoloLectura ? (
                  <Link
                    href={`/panel/inspecciones/${inspeccion.id}/evidencias`}
                    className="rounded-2xl border border-white/15 px-4 py-3 text-center font-black"
                  >
                    Ver evidencias ({inspeccion.fotografias.length})
                  </Link>
                ) : operacionBloqueada ? (
                  <div className="rounded-2xl border border-white/10 px-4 py-3 text-center font-black text-slate-600">
                    Evidencias bloqueadas
                  </div>
                ) : (
                  <Link
                    href={`/panel/inspecciones/${inspeccion.id}/evidencias`}
                    className="rounded-2xl border border-white/15 px-4 py-3 text-center font-black"
                  >
                    Evidencias ({inspeccion.fotografias.length})
                  </Link>
                )}
                {capturaSoloLectura ? (
                  <Link
                    href={`/panel/inspecciones/${inspeccion.id}/firmas`}
                    className="rounded-2xl border border-white/15 px-4 py-3 text-center font-black"
                  >
                    Ver firmas ({inspeccion.firmas.length})
                  </Link>
                ) : operacionBloqueada ? (
                  <div className="rounded-2xl border border-white/10 px-4 py-3 text-center font-black text-slate-600">
                    Firmas bloqueadas
                  </div>
                ) : (
                  <Link
                    href={`/panel/inspecciones/${inspeccion.id}/firmas`}
                    className="rounded-2xl border border-white/15 px-4 py-3 text-center font-black"
                  >
                    Firmas ({inspeccion.firmas.length})
                  </Link>
                )}
                {inspeccion.liberacionBloqueada ? (
                  <div className="cursor-not-allowed rounded-2xl border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-center font-black text-rose-300">
                    Certificado bloqueado por Dirección
                  </div>
                ) : inspeccion.certificado ? (
                  <Link
                    href={`/panel/inspecciones/${inspeccion.id}/certificado`}
                    className="rounded-2xl border border-cyan-300/30 px-4 py-3 text-center font-black text-cyan-300"
                  >
                    Ver certificado
                  </Link>
                ) : inspeccion.estado === "FINALIZADA" && !certificadoFinancieramenteLiberado ? (
                  <div className="cursor-not-allowed rounded-2xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-center font-black text-amber-300">
                    Certificado pendiente de liquidación — {dinero(saldoPendiente)}
                  </div>
                ) : inspeccion.estado === "FINALIZADA" ? (
                  <Link
                    href={`/panel/inspecciones/${inspeccion.id}/certificado`}
                    className="rounded-2xl border border-cyan-300/30 px-4 py-3 text-center font-black text-cyan-300"
                  >
                    Emitir certificado
                  </Link>
                ) : (
                  <div className="cursor-not-allowed rounded-2xl border border-white/10 px-4 py-3 text-center font-black text-slate-600">
                    Certificado pendiente de aprobación
                  </div>
                )}
              </div>

              {!expedienteFinalizado && (
              <form action={cambiarEstado} className="mt-6 border-t border-white/10 pt-5">
                <input type="hidden" name="id" value={inspeccion.id} />
                <label className="block text-sm font-bold text-slate-300">
                  Estado del expediente
                  <select
                    name="estado"
                    defaultValue={inspeccion.estado}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
                  >
                    <option value="PROGRAMADA">Programada</option>
                    <option value="EN_PROCESO" disabled={operacionBloqueada}>En proceso</option>
                    <option value="REPORTE_PENDIENTE" disabled>Reporte pendiente — solo al finalizar captura</option>
                    <option value="FINALIZADA" disabled>Finalizada — solo mediante aprobación</option>
                    <option value="CANCELADA">Cancelada</option>
                  </select>
                </label>
                <button className="mt-3 w-full rounded-2xl border border-white/15 px-4 py-3 font-black">
                  Actualizar estado
                </button>
              </form>
              )}

              {inspeccion.estado !== "CANCELADA" && inspeccion.estado !== "FINALIZADA" && (
                <form action={cancelarInspeccion} className="mt-3">
                  <input type="hidden" name="id" value={inspeccion.id} />
                  <button className="w-full rounded-2xl border border-rose-400/30 px-4 py-3 font-black text-rose-300">
                    Cancelar inspección
                  </button>
                </form>
              )}
            </section>
          </aside>

          <div className="space-y-7">
            <section className="rounded-3xl border border-white/10 bg-slate-900 p-6">
              <h2 className="text-2xl font-black">Datos generales</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Dato etiqueta="Cliente" valor={inspeccion.cliente.nombre} />
                <Dato etiqueta="Tipo de servicio" valor={inspeccion.tipoServicio} />
                <Dato etiqueta="Inmueble" valor={inspeccion.tipoInmueble} />
                <Dato etiqueta="Superficie" valor={inspeccion.superficieM2 ? `${Number(inspeccion.superficieM2)} m²` : "No registrada"} />
                <Dato etiqueta="Dirección" valor={`${inspeccion.direccion}, ${inspeccion.ciudad}`} />
                <Dato etiqueta="Semáforo" valor={inspeccion.semaforo ?? "Sin evaluar"} />
              </div>
              {inspeccion.observaciones && (
                <div className="mt-5 rounded-2xl bg-white/[0.04] p-4 text-slate-300">
                  <b>Observaciones:</b> {inspeccion.observaciones}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-white/10 bg-slate-900 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-black">Actividad del expediente</h2>
                <span className="text-sm text-slate-500">Eventos recientes</span>
              </div>
              <div className="mt-5 space-y-4">
                {actividad.map((evento, index) => (
                  <div key={`${evento.titulo}-${evento.fecha.toISOString()}-${index}`} className="flex gap-4 border-b border-white/10 pb-4 last:border-0">
                    <div className="mt-1 h-3 w-3 shrink-0 rounded-full bg-cyan-400" />
                    <div>
                      <p className="font-black">{evento.titulo}</p>
                      <p className="text-sm text-slate-400">{evento.detalle}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatoFecha(evento.fecha, inspeccion.zonaHoraria)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-slate-900 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-black">Hallazgos recientes</h2>

                {!operacionBloqueada && !capturaSoloLectura && inspeccion.hallazgos.length > 0 && (
                  <Link
                    href={`/panel/inspecciones/${inspeccion.id}/evidencias`}
                    className="text-sm font-bold text-cyan-300 hover:text-cyan-200"
                  >
                    Ver todas las evidencias →
                  </Link>
                )}
              </div>

              {inspeccion.hallazgos.length === 0 ? (
                <p className="mt-5 text-slate-400">
                  Aún no hay hallazgos registrados.
                </p>
              ) : (
                <div className="mt-5 divide-y divide-white/10">
                  {inspeccion.hallazgos.slice(0, 6).map((hallazgo) => (
                    <article key={hallazgo.id} className="py-5 first:pt-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <Clasificacion valor={hallazgo.clasificacion} />

                        <span className="text-xs font-black text-slate-400">
                          {hallazgo.prioridad}
                        </span>

                        <span className="text-xs text-slate-500">
                          {hallazgo.area}
                        </span>

                        {hallazgo.fotografias.length > 0 ? (
                          <Link
                            href={`/panel/inspecciones/${inspeccion.id}/evidencias?hallazgoId=${hallazgo.id}`}
                            className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-300 transition hover:bg-cyan-400 hover:text-slate-950"
                            title={`Ver ${hallazgo.fotografias.length} evidencia(s) de este hallazgo`}
                          >
                            📷 {hallazgo.fotografias.length} foto(s)
                          </Link>
                        ) : (
                          <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-500">
                            0 foto(s)
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-lg font-black">
                            {hallazgo.titulo}
                          </h3>

                          <p className="mt-1 text-sm leading-6 text-slate-300">
                            {hallazgo.descripcion}
                          </p>
                        </div>

                        {!operacionBloqueada && !capturaSoloLectura && (
                          <Link
                            href={`/panel/inspecciones/${inspeccion.id}/evidencias?hallazgoId=${hallazgo.id}`}
                            className="shrink-0 rounded-full border border-cyan-400/40 px-4 py-2 text-center text-sm font-black text-cyan-300 transition hover:bg-cyan-400 hover:text-slate-950"
                          >
                            📷 Agregar evidencia
                          </Link>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-white/10 bg-slate-900 p-6">
              <h2 className="text-2xl font-black">Hallazgo rápido</h2>
              {capturaSoloLectura ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="font-black text-slate-300">Expediente en solo lectura</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Una inspección finalizada o cancelada no admite nuevos hallazgos ni modificaciones operativas.
                  </p>
                </div>
              ) : operacionBloqueada ? (
                <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5">
                  <p className="font-black text-amber-300">Captura no disponible</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Liquida el saldo pendiente de {dinero(saldoPendiente)} antes de iniciar la inspección y registrar hallazgos.
                  </p>
                </div>
              ) : (
              <form action={crearHallazgo} className="mt-5 grid gap-4 md:grid-cols-2">
                <input type="hidden" name="inspeccionId" value={inspeccion.id} />
                <Campo name="area" label="Área *" placeholder="Instalación eléctrica" />
                <Campo name="titulo" label="Título *" placeholder="Contacto sin tierra física" />
                <Campo name="ubicacion" label="Ubicación" placeholder="Recámara principal" />
                <label className="block">
                  <span className="mb-2 block text-sm font-bold">Clasificación</span>
                  <select name="clasificacion" defaultValue="O" className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3">
                    <option value="C">Conforme</option><option value="O">Observación</option><option value="NC">No conforme</option><option value="CR">Crítico</option><option value="NA">No aplica</option>
                  </select>
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-bold">Descripción *</span>
                  <textarea name="descripcion" required rows={4} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold">Prioridad</span>
                  <select name="prioridad" defaultValue="P3" className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3">
                    <option value="P1">P1 Inmediata</option><option value="P2">P2 Alta</option><option value="P3">P3 Media</option><option value="P4">P4 Baja</option><option value="P5">P5 Informativa</option>
                  </select>
                </label>
                <Campo name="costoEstimado" label="Costo estimado (MXN)" type="number" />
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-bold">Recomendación</span>
                  <textarea name="recomendacion" rows={3} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" />
                </label>
                <div className="md:col-span-2">
                  <button className="w-full rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950">Guardar hallazgo</button>
                </div>
              </form>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function RevisionEstado({
  etiqueta,
  activo,
}: {
  etiqueta: string;
  activo: boolean;
}) {
  return (
    <span
      className={`rounded-full px-3 py-2 text-xs font-black ${
        activo
          ? "bg-emerald-400/15 text-emerald-300"
          : "bg-white/5 text-slate-500"
      }`}
    >
      {etiqueta}: {activo ? "APROBADO" : "PENDIENTE"}
    </span>
  );
}

function DatoMini({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
        {etiqueta}
      </p>
      <p className="mt-1 text-sm font-black text-slate-200">{valor}</p>
    </div>
  );
}

function Estado({ estado }: { estado: string }) {
  const clase = estado === "FINALIZADA" ? "bg-emerald-400/15 text-emerald-300" : estado === "CANCELADA" ? "bg-rose-400/15 text-rose-300" : estado === "EN_PROCESO" ? "bg-amber-400/15 text-amber-300" : "bg-sky-400/15 text-sky-300";
  return <span className={`rounded-full px-3 py-1 text-xs font-black ${clase}`}>{estado.replaceAll("_", " ")}</span>;
}
function Metrica({ etiqueta, valor }: { etiqueta: string; valor: string }) { return <div className="rounded-3xl border border-white/10 bg-slate-900 p-5"><p className="text-sm font-bold text-slate-400">{etiqueta}</p><p className="mt-2 text-3xl font-black text-cyan-300">{valor}</p></div>; }
function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) { return <div className="rounded-2xl bg-white/[0.04] p-4"><p className="text-xs font-black uppercase tracking-wider text-slate-500">{etiqueta}</p><p className="mt-2 font-bold text-slate-200">{valor}</p></div>; }
function Clasificacion({ valor }: { valor: string }) { const clase = valor === "CR" ? "bg-rose-400/15 text-rose-300" : valor === "NC" ? "bg-orange-400/15 text-orange-300" : valor === "O" ? "bg-amber-400/15 text-amber-300" : "bg-emerald-400/15 text-emerald-300"; return <span className={`rounded-full px-3 py-1 text-xs font-black ${clase}`}>{valor}</span>; }
function Campo({ name, label, type = "text", placeholder }: { name: string; label: string; type?: string; placeholder?: string }) { return <label className="block"><span className="mb-2 block text-sm font-bold">{label}</span><input name={name} type={type} required={label.includes("*")} placeholder={placeholder} step="any" className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" /></label>; }