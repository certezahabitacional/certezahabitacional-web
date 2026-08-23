import Link from "next/link";
import { EstadoPago } from "@prisma/client";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  cambiarEstado,
  cancelarInspeccion,
  crearHallazgo,
  iniciarInspeccion,
  liberarInicioSinPago,
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
    },
  });

  if (!inspeccion) notFound();

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

  const rolesDirectivos = ["DIRECTOR", "GERENTE", "ADMINISTRADOR"];
  const esDirectivo = session?.user?.role
    ? rolesDirectivos.includes(session.user.role)
    : false;

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
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/panel/inspecciones/${inspeccion.id}/editar`}
                className="rounded-full border border-white/15 px-5 py-3 font-black hover:bg-white/5"
              >
                Editar
              </Link>
              {operacionBloqueada ? (
                <span className="cursor-not-allowed rounded-full border border-amber-300/30 bg-amber-300/10 px-5 py-3 font-black text-amber-300">
                  Saldo pendiente — {dinero(saldoPendiente)}
                </span>
              ) : (
                <form action={iniciarInspeccion}>
                  <input type="hidden" name="id" value={inspeccion.id} />
                  <button className="rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950 hover:bg-cyan-300">
                    {inspeccion.estado === "PROGRAMADA"
                      ? "Iniciar inspección"
                      : "Continuar captura"}
                  </button>
                </form>
              )}
              <Link
                href={`/panel/inspecciones/${inspeccion.id}/reporte`}
                className="rounded-full border border-white/15 px-5 py-3 font-black hover:bg-white/5"
              >
                Ver reporte
              </Link>
              <Link
               href={`/panel/inspecciones/${inspeccion.id}/certificado`}
               className="rounded-full border border-cyan-400 px-5 py-3 font-black text-cyan-300 transition hover:bg-cyan-400 hover:text-slate-950"
>
               Certificado
              </Link>
            </div>
          </div>
        </header>

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
                  esDirectivo &&
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
          esDirectivo && (
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
                {operacionBloqueada ? (
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
                {operacionBloqueada ? (
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
                {operacionBloqueada ? (
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
                <Link
                  href={`/panel/inspecciones/${inspeccion.id}/certificado`}
                  className="rounded-2xl border border-cyan-300/30 px-4 py-3 text-center font-black text-cyan-300"
                >
                  {inspeccion.certificado ? "Ver certificado" : "Emitir certificado"}
                </Link>
              </div>

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
                    <option value="REPORTE_PENDIENTE" disabled={operacionBloqueada}>Reporte pendiente</option>
                    <option value="FINALIZADA" disabled={operacionBloqueada}>Finalizada</option>
                    <option value="CANCELADA">Cancelada</option>
                  </select>
                </label>
                <button className="mt-3 w-full rounded-2xl border border-white/15 px-4 py-3 font-black">
                  Actualizar estado
                </button>
              </form>

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
              <h2 className="text-2xl font-black">Hallazgos recientes</h2>
              {inspeccion.hallazgos.length === 0 ? (
                <p className="mt-5 text-slate-400">Aún no hay hallazgos registrados.</p>
              ) : (
                <div className="mt-5 divide-y divide-white/10">
                  {inspeccion.hallazgos.slice(0, 6).map((hallazgo) => (
                    <article key={hallazgo.id} className="py-5 first:pt-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <Clasificacion valor={hallazgo.clasificacion} />
                        <span className="text-xs font-black text-slate-400">{hallazgo.prioridad}</span>
                        <span className="text-xs text-slate-500">{hallazgo.area}</span>
                        <span className="text-xs text-slate-500">{hallazgo.fotografias.length} foto(s)</span>
                      </div>
                      <h3 className="mt-2 text-lg font-black">{hallazgo.titulo}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-300">{hallazgo.descripcion}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-white/10 bg-slate-900 p-6">
              <h2 className="text-2xl font-black">Hallazgo rápido</h2>
              {operacionBloqueada ? (
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