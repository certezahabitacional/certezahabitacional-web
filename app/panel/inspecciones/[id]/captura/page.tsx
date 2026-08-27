import Link from "next/link";
import { EstadoInspeccion, RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { actualizarHallazgo, crearHallazgo, registrarSeguimientoHallazgo } from "../actions";

type SearchParams = Promise<{
  hallazgoId?: string;
  editar?: string;
  ok?: string;
  error?: string;
}>;

type FotoComparativa = {
  id: string;
  descripcion: string | null;
  imagenUrl: string | null;
};

function obtenerSupabase() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export default async function CapturaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const query = await searchParams;
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
      inspector: {
        select: {
          id: true,
          activo: true,
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

  const inspeccionAlcance = await prisma.inspeccion.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      estado: true,
      inspectorId: true,
      inspector: {
        select: {
          usuarioId: true,
        },
      },
    },
  });

  if (!inspeccionAlcance) {
    notFound();
  }

  if (
    inspeccionAlcance.inspectorId !== usuarioActual.inspector.id ||
    inspeccionAlcance.inspector?.usuarioId !== usuarioActual.id
  ) {
    redirect("/acceso");
  }

  if (
    inspeccionAlcance.estado !== EstadoInspeccion.EN_PROCESO
  ) {
    redirect(
      `/panel/inspecciones/${id}?error=${encodeURIComponent(
        "La captura solo está disponible mientras la inspección está EN PROCESO.",
      )}`,
    );
  }

  const inspeccion = await prisma.inspeccion.findUnique({
    where: {
      id,
    },
    include: {
      cliente: {
        select: {
          nombre: true,
        },
      },
      inmueble: true,
      hallazgos: {
        orderBy: {
          creadoEn: "desc",
        },
        include: {
          fotografias: {
            select: {
              id: true,
              url: true,
              descripcion: true,
            },
          },
        },
      },
    },
  });

  if (!inspeccion) {
    notFound();
  }

  const hallazgosAntecedentes =
    inspeccion.numeroInspeccion > 1 && inspeccion.inspeccionAnteriorId
      ? await prisma.hallazgo.findMany({
          where: {
            inspeccionId: inspeccion.inspeccionAnteriorId,
          },
          orderBy: [
            { prioridad: "asc" },
            { creadoEn: "asc" },
          ],
          include: {
            fotografias: {
              select: {
                id: true,
                url: true,
                descripcion: true,
              },
            },
            hallazgosSiguientes: {
              where: {
                inspeccionId: inspeccion.id,
              },
              select: {
                id: true,
                estadoSeguimiento: true,
                observacionSeguimiento: true,
                fotografias: {
                  select: {
                    id: true,
                    url: true,
                    descripcion: true,
                  },
                },
              },
              take: 1,
            },
          },
        })
      : [];

  const supabase = hallazgosAntecedentes.length > 0 ? obtenerSupabase() : null;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";

  async function resolverImagenUrl(url: string): Promise<string | null> {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }

    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(url, 60 * 60);

    return error ? null : data.signedUrl;
  }

  const hallazgosAntecedentesConImagenes = await Promise.all(
    hallazgosAntecedentes.map(async (anterior) => ({
      ...anterior,
      fotografias: await Promise.all(
        anterior.fotografias.map(async (foto) => ({
          ...foto,
          imagenUrl: await resolverImagenUrl(foto.url),
        })),
      ),
      hallazgosSiguientes: await Promise.all(
        anterior.hallazgosSiguientes.map(async (seguimiento) => ({
          ...seguimiento,
          fotografias: await Promise.all(
            seguimiento.fotografias.map(async (foto) => ({
              ...foto,
              imagenUrl: await resolverImagenUrl(foto.url),
            })),
          ),
        })),
      ),
    })),
  );

  const totalHallazgos = inspeccion.hallazgos.length;
  const totalEvidencias = inspeccion.hallazgos.reduce(
    (total, hallazgo) => total + hallazgo.fotografias.length,
    0,
  );

  const hallazgoRecienCreado = query.hallazgoId
    ? inspeccion.hallazgos.find(
        (hallazgo) => hallazgo.id === query.hallazgoId,
      )
    : undefined;

  const hallazgoEnEdicion = query.editar
    ? inspeccion.hallazgos.find(
        (hallazgo) => hallazgo.id === query.editar,
      )
    : undefined;

  const editandoSeguimiento = Boolean(
    hallazgoEnEdicion?.hallazgoAnteriorId,
  );

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/panel/inspecciones/${id}`}
            className="text-sm font-bold text-cyan-300"
          >
            â† Volver al expediente
          </Link>

          <Link
            href={`/panel/inspecciones/${id}/evidencias`}
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-black text-slate-300"
          >
            Evidencias ({totalEvidencias})
          </Link>
        </div>

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

        {hallazgoRecienCreado && !hallazgoEnEdicion && (
          <section className="mt-5 rounded-3xl border border-cyan-400/30 bg-cyan-400/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
              Hallazgo guardado
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-black">
              <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-cyan-300">
                {hallazgoRecienCreado.clasificacion}
              </span>
              <span className="rounded-full bg-white/5 px-3 py-1 text-slate-300">
                {hallazgoRecienCreado.prioridad}
              </span>
              <span className="text-slate-400">
                {hallazgoRecienCreado.area}
              </span>
            </div>

            <h2 className="mt-3 text-xl font-black">
              {hallazgoRecienCreado.titulo}
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Elige quÃ© quieres hacer antes de continuar con el siguiente hallazgo.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Link
                href={`/panel/inspecciones/${id}/evidencias?hallazgoId=${hallazgoRecienCreado.id}`}
                className="rounded-2xl bg-cyan-400 px-4 py-3 text-center font-black text-slate-950"
              >
                ðŸ“· Tomar / agregar evidencia
              </Link>

              <Link
                href={`/panel/inspecciones/${id}/captura#nuevo-hallazgo`}
                className="rounded-2xl border border-white/15 px-4 py-3 text-center font-black text-slate-200"
              >
                + Capturar siguiente hallazgo
              </Link>
            </div>
          </section>
        )}

        <header className="mt-5 rounded-3xl border border-white/10 bg-slate-900 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-black text-cyan-300">
              {inspeccion.folio}
            </p>
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-300">
              INSPECCIÃ“N {String(inspeccion.numeroInspeccion).padStart(2, "0")} Â· V{inspeccion.numeroInspeccion}
            </span>
          </div>

          <h1 className="mt-2 text-3xl font-black">
            Captura MÃ©todo CertezaÂ®
          </h1>

          <p className="mt-2 text-slate-400">
            {inspeccion.cliente.nombre} Â·{" "}
            {inspeccion.inmueble?.alias ?? inspeccion.tipoInmueble}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Resumen
              etiqueta="Hallazgos"
              valor={String(totalHallazgos)}
            />
            <Resumen
              etiqueta="Evidencias"
              valor={String(totalEvidencias)}
            />
          </div>
        </header>

        {hallazgosAntecedentesConImagenes.length > 0 && (
          <section className="mt-7 rounded-3xl border border-violet-400/20 bg-slate-900 p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
              Seguimiento de la inspecciÃ³n anterior
            </p>
            <h2 className="mt-2 text-2xl font-black">
              VerificaciÃ³n de hallazgos V{inspeccion.numeroInspeccion - 1}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Revisa cada antecedente y registra su evoluciÃ³n. El expediente anterior permanece intacto.
            </p>

            <div className="mt-6 space-y-4">
              {hallazgosAntecedentesConImagenes.map((anterior, index) => {
                const seguimiento = anterior.hallazgosSiguientes[0];

                return (
                  <article
                    key={anterior.id}
                    className="rounded-2xl border border-white/10 bg-slate-950 p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs font-black">
                      <span className="rounded-full bg-violet-400/10 px-3 py-1 text-violet-300">
                        V{inspeccion.numeroInspeccion - 1} Â· #{index + 1}
                      </span>
                      <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-cyan-300">
                        {anterior.clasificacion}
                      </span>
                      <span className="rounded-full bg-white/5 px-3 py-1 text-slate-300">
                        {anterior.prioridad}
                      </span>
                      <span className="text-slate-500">{anterior.area}</span>
                    </div>

                    <h3 className="mt-3 text-lg font-black">{anterior.titulo}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {anterior.descripcion}
                    </p>

                    {anterior.ubicacion && (
                      <p className="mt-2 text-sm text-slate-500">
                        UbicaciÃ³n: {anterior.ubicacion}
                      </p>
                    )}

                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      <EvidenciaComparativa
                        titulo={`ANTES Â· V${inspeccion.numeroInspeccion - 1}`}
                        subtitulo="Evidencia antecedente"
                        fotografias={anterior.fotografias}
                        vacio="Sin evidencia fotogrÃ¡fica antecedente"
                      />

                      <EvidenciaComparativa
                        titulo={`ACTUAL Â· V${inspeccion.numeroInspeccion}`}
                        subtitulo="Evidencia de seguimiento"
                        fotografias={seguimiento?.fotografias ?? []}
                        vacio={
                          seguimiento
                            ? "AÃºn no se ha agregado evidencia actual"
                            : "Registra primero el seguimiento para agregar evidencia actual"
                        }
                      />
                    </div>

                    {seguimiento ? (
                      <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                        <p className="font-black text-emerald-300">
                          {etiquetaSeguimiento(seguimiento.estadoSeguimiento)}
                        </p>
                        {seguimiento.observacionSeguimiento && (
                          <p className="mt-2 text-sm text-slate-300">
                            {seguimiento.observacionSeguimiento}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-3">
                          <Link
                            href={`/panel/inspecciones/${id}/evidencias?hallazgoId=${seguimiento.id}`}
                            className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950"
                          >
                            ðŸ“· Agregar / ver evidencia actual ({seguimiento.fotografias.length})
                          </Link>
                          <Link
                            href={`/panel/inspecciones/${id}/captura?editar=${seguimiento.id}#nuevo-hallazgo`}
                            className="rounded-full border border-white/15 px-4 py-2 text-sm font-black text-slate-300"
                          >
                            Editar seguimiento
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <form
                        action={registrarSeguimientoHallazgo}
                        className="mt-4 grid gap-3"
                      >
                        <input type="hidden" name="inspeccionId" value={id} />
                        <input type="hidden" name="hallazgoAnteriorId" value={anterior.id} />

                        <label className="block">
                          <span className="mb-2 block text-sm font-bold">
                            Resultado de la verificaciÃ³n *
                          </span>
                          <select
                            name="estadoSeguimiento"
                            required
                            defaultValue=""
                            className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
                          >
                            <option value="" disabled>Selecciona el resultado</option>
                            <option value="CORREGIDO">Corregido satisfactoriamente</option>
                            <option value="PARCIALMENTE_CORREGIDO">Parcialmente corregido</option>
                            <option value="NO_CORREGIDO">No corregido</option>
                            <option value="CORRECCION_NO_SATISFACTORIA">CorrecciÃ³n no satisfactoria</option>
                            <option value="NO_VERIFICABLE">No verificable</option>
                          </select>
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-sm font-bold">
                            ObservaciÃ³n de seguimiento
                          </span>
                          <textarea
                            name="observacionSeguimiento"
                            rows={3}
                            placeholder="Describe lo observado durante la reinspecciÃ³n."
                            className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
                          />
                        </label>

                        <button className="rounded-full bg-violet-300 px-5 py-3 font-black text-slate-950">
                          Registrar seguimiento
                        </button>
                      </form>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <section
          id="nuevo-hallazgo"
          className={`mt-7 scroll-mt-6 rounded-3xl border bg-slate-900 p-5 sm:p-6 ${
            hallazgoEnEdicion
              ? "border-amber-300/30"
              : "border-cyan-400/20"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p
                className={`text-xs font-black uppercase tracking-[0.18em] ${
                  hallazgoEnEdicion ? "text-amber-300" : "text-cyan-300"
                }`}
              >
                {editandoSeguimiento
                  ? "EdiciÃ³n de seguimiento"
                  : hallazgoEnEdicion
                    ? "CorrecciÃ³n del expediente"
                    : "Captura en campo"}
              </p>

              <h2 className="mt-2 text-2xl font-black">
                {editandoSeguimiento
                  ? "Editar seguimiento"
                  : hallazgoEnEdicion
                    ? "Editar hallazgo"
                    : "Nuevo hallazgo"}
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                {editandoSeguimiento
                  ? "Actualiza el resultado de la verificaciÃ³n y, si es necesario, corrige la informaciÃ³n tÃ©cnica del hallazgo. Las evidencias existentes se conservarÃ¡n."
                  : hallazgoEnEdicion
                    ? "Corrige la informaciÃ³n del hallazgo y guarda los cambios. Las evidencias existentes se conservarÃ¡n."
                    : "Guarda el hallazgo y decide inmediatamente si agregas evidencia o continÃºas con el siguiente."}
              </p>
            </div>

            <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-slate-400">
              {editandoSeguimiento
                ? "Seguimiento"
                : hallazgoEnEdicion
                  ? "EdiciÃ³n"
                  : `#${totalHallazgos + 1}`}
            </span>
          </div>

          <form
            key={
              hallazgoEnEdicion
                ? `editar-${hallazgoEnEdicion.id}`
                : "nuevo-hallazgo"
            }
            action={hallazgoEnEdicion ? actualizarHallazgo : crearHallazgo}
            className="mt-6 grid gap-4 md:grid-cols-2"
          >
            <input
              type="hidden"
              name="inspeccionId"
              value={id}
            />

            {hallazgoEnEdicion && (
              <input
                type="hidden"
                name="hallazgoId"
                value={hallazgoEnEdicion.id}
              />
            )}

            {editandoSeguimiento && hallazgoEnEdicion && (
              <>
                <div className="md:col-span-2 rounded-2xl border border-violet-400/20 bg-violet-400/5 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-300">
                    EvoluciÃ³n del hallazgo
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    Este hallazgo procede de la inspecciÃ³n anterior. La ediciÃ³n
                    conserva intacto el expediente histÃ³rico antecedente.
                  </p>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold">
                    Resultado de la verificaciÃ³n *
                  </span>
                  <select
                    name="estadoSeguimiento"
                    required
                    defaultValue={hallazgoEnEdicion.estadoSeguimiento ?? ""}
                    className="w-full rounded-2xl border border-violet-400/20 bg-slate-950 px-4 py-3 text-base"
                  >
                    <option value="" disabled>
                      Selecciona el resultado
                    </option>
                    <option value="CORREGIDO">Corregido satisfactoriamente</option>
                    <option value="PARCIALMENTE_CORREGIDO">Parcialmente corregido</option>
                    <option value="NO_CORREGIDO">No corregido</option>
                    <option value="CORRECCION_NO_SATISFACTORIA">CorrecciÃ³n no satisfactoria</option>
                    <option value="NO_VERIFICABLE">No verificable</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold">
                    ObservaciÃ³n de seguimiento
                  </span>
                  <textarea
                    name="observacionSeguimiento"
                    rows={3}
                    defaultValue={hallazgoEnEdicion.observacionSeguimiento ?? ""}
                    placeholder="Describe lo observado durante la reinspecciÃ³n."
                    className="w-full rounded-2xl border border-violet-400/20 bg-slate-950 px-4 py-3 text-base"
                  />
                </label>
              </>
            )}

            <Campo
              name="area"
              label="Ãrea *"
              placeholder="InstalaciÃ³n elÃ©ctrica"
              defaultValue={hallazgoEnEdicion?.area ?? ""}
            />

            <Campo
              name="titulo"
              label="TÃ­tulo *"
              placeholder="Contacto sin tierra fÃ­sica"
              defaultValue={hallazgoEnEdicion?.titulo ?? ""}
            />

            <Campo
              name="ubicacion"
              label="UbicaciÃ³n"
              placeholder="RecÃ¡mara principal"
              defaultValue={hallazgoEnEdicion?.ubicacion ?? ""}
            />

            <label className="block">
              <span className="mb-2 block text-sm font-bold">
                ClasificaciÃ³n
              </span>

              <select
                name="clasificacion"
                defaultValue={hallazgoEnEdicion?.clasificacion ?? "O"}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-base"
              >
                <option value="C">Conforme</option>
                <option value="O">ObservaciÃ³n</option>
                <option value="NC">No conforme</option>
                <option value="CR">CrÃ­tico</option>
                <option value="NA">No aplica</option>
              </select>
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-bold">
                DescripciÃ³n *
              </span>

              <textarea
                name="descripcion"
                required
                rows={4}
                placeholder="Describe de forma clara lo observado."
                defaultValue={hallazgoEnEdicion?.descripcion ?? ""}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-base"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold">
                Prioridad
              </span>

              <select
                name="prioridad"
                defaultValue={hallazgoEnEdicion?.prioridad ?? "P3"}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-base"
              >
                <option value="P1">P1 Inmediata</option>
                <option value="P2">P2 Alta</option>
                <option value="P3">P3 Media</option>
                <option value="P4">P4 Baja</option>
                <option value="P5">P5 Informativa</option>
              </select>
            </label>

            <Campo
              name="costoEstimado"
              label="Costo estimado (MXN)"
              type="number"
              inputMode="decimal"
              defaultValue={
                hallazgoEnEdicion?.costoEstimado == null
                  ? ""
                  : String(hallazgoEnEdicion.costoEstimado)
              }
            />

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-bold">
                RecomendaciÃ³n
              </span>

              <textarea
                name="recomendacion"
                rows={3}
                placeholder="AcciÃ³n correctiva o recomendaciÃ³n sugerida."
                defaultValue={hallazgoEnEdicion?.recomendacion ?? ""}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-base"
              />
            </label>

            <button
              className={`md:col-span-2 min-h-12 rounded-full px-5 py-3 font-black text-slate-950 ${
                hallazgoEnEdicion ? "bg-amber-300" : "bg-cyan-400"
              }`}
            >
              {editandoSeguimiento
                ? "Guardar cambios del seguimiento"
                : hallazgoEnEdicion
                  ? "Guardar cambios del hallazgo"
                  : "Guardar hallazgo"}
            </button>

            {hallazgoEnEdicion && (
              <Link
                href={`/panel/inspecciones/${id}/captura`}
                className="md:col-span-2 rounded-full border border-white/15 px-5 py-3 text-center font-black text-slate-300"
              >
                Cancelar ediciÃ³n
              </Link>
            )}
          </form>
        </section>

        <section className="mt-7 rounded-3xl border border-white/10 bg-slate-900 p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                Trabajo capturado
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Hallazgos ({totalHallazgos})
              </h2>
            </div>

            <Link
              href={`/panel/inspecciones/${id}/captura#nuevo-hallazgo`}
              className="rounded-full border border-cyan-400/30 px-4 py-2 text-sm font-black text-cyan-300"
            >
              + Nuevo hallazgo
            </Link>
          </div>

          {inspeccion.hallazgos.length === 0 ? (
            <div className="mt-6 rounded-2xl bg-slate-950 p-6 text-center text-slate-400">
              AÃºn no hay hallazgos registrados.
            </div>
          ) : (
            <div className="mt-5 divide-y divide-white/10">
              {inspeccion.hallazgos.map((hallazgo, index) => {
                const fotos = hallazgo.fotografias.length;

                return (
                  <article
                    key={hallazgo.id}
                    className="py-5 first:pt-0"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs font-black">
                      <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-cyan-300">
                        {hallazgo.clasificacion}
                      </span>

                      <span className="rounded-full bg-white/5 px-3 py-1 text-slate-300">
                        {hallazgo.prioridad}
                      </span>

                      {hallazgo.estadoSeguimiento && (
                        <span className="rounded-full bg-violet-400/10 px-3 py-1 text-violet-300">
                          {etiquetaSeguimiento(hallazgo.estadoSeguimiento)}
                        </span>
                      )}

                      <span className="px-1 py-1 text-slate-500">
                        {hallazgo.area}
                      </span>

                      <span className="ml-auto text-slate-600">
                        #{totalHallazgos - index}
                      </span>
                    </div>

                    <h3 className="mt-3 text-lg font-black">
                      {hallazgo.titulo}
                    </h3>

                    <p className="mt-1 leading-6 text-slate-300">
                      {hallazgo.descripcion}
                    </p>

                    {hallazgo.ubicacion && (
                      <p className="mt-2 text-sm text-slate-500">
                        UbicaciÃ³n: {hallazgo.ubicacion}
                      </p>
                    )}

                    {hallazgo.observacionSeguimiento && (
                      <div className="mt-3 rounded-2xl border border-violet-400/10 bg-violet-400/5 p-4">
                        <p className="text-xs font-black uppercase tracking-wider text-violet-300">
                          Seguimiento
                        </p>
                        <p className="mt-2 text-sm text-slate-300">
                          {hallazgo.observacionSeguimiento}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <Link
                        href={`/panel/inspecciones/${id}/captura?editar=${hallazgo.id}#nuevo-hallazgo`}
                        className="min-h-11 rounded-2xl border border-amber-300/30 px-4 py-3 text-center text-sm font-black text-amber-300"
                      >
                        {hallazgo.hallazgoAnteriorId
                          ? "Editar seguimiento"
                          : "Editar hallazgo"}
                      </Link>

                      <Link
                        href={`/panel/inspecciones/${id}/evidencias?hallazgoId=${hallazgo.id}`}
                        className="min-h-11 rounded-2xl bg-cyan-400 px-4 py-3 text-center text-sm font-black text-slate-950"
                      >
                        ðŸ“·{" "}
                        {fotos > 0
                          ? `Agregar otra evidencia (${fotos})`
                          : "Tomar / agregar evidencia"}
                      </Link>

                      {fotos > 0 ? (
                        <Link
                          href={`/panel/inspecciones/${id}/evidencias?hallazgoId=${hallazgo.id}`}
                          className="min-h-11 rounded-2xl border border-white/15 px-4 py-3 text-center text-sm font-black text-slate-300"
                        >
                          Ver {fotos} foto
                          {fotos === 1 ? "" : "s"}
                        </Link>
                      ) : (
                        <div className="min-h-11 rounded-2xl border border-white/10 px-4 py-3 text-center text-sm font-bold text-slate-600">
                          Sin fotografÃ­as
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Link
            href={`/panel/inspecciones/${id}/captura#nuevo-hallazgo`}
            className="rounded-full bg-cyan-400 px-5 py-3 text-center font-black text-slate-950"
          >
            + Capturar siguiente hallazgo
          </Link>

          <Link
            href={`/panel/inspecciones/${id}`}
            className="rounded-full border border-white/15 px-5 py-3 text-center font-black text-slate-300"
          >
            Terminar y volver al expediente
          </Link>
        </div>
      </div>
    </main>
  );
}

function etiquetaSeguimiento(valor: string | null) {
  if (!valor) return "Sin seguimiento";

  const etiquetas: Record<string, string> = {
    PENDIENTE_VERIFICAR: "Pendiente de verificar",
    CORREGIDO: "Corregido satisfactoriamente",
    PARCIALMENTE_CORREGIDO: "Parcialmente corregido",
    NO_CORREGIDO: "No corregido",
    CORRECCION_NO_SATISFACTORIA: "CorrecciÃ³n no satisfactoria",
    NO_VERIFICABLE: "No verificable",
    NUEVO_HALLAZGO: "Nuevo hallazgo",
  };

  return etiquetas[valor] ?? valor.replaceAll("_", " ");
}

function EvidenciaComparativa({
  titulo,
  subtitulo,
  fotografias,
  vacio,
}: {
  titulo: string;
  subtitulo: string;
  fotografias: FotoComparativa[];
  vacio: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70">
      <div className="border-b border-white/10 px-4 py-3">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-300">
          {titulo}
        </p>
        <p className="mt-1 text-xs text-slate-500">{subtitulo}</p>
      </div>

      {fotografias.length === 0 ? (
        <div className="grid min-h-48 place-items-center p-5 text-center text-sm text-slate-500">
          {vacio}
        </div>
      ) : (
        <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {fotografias.map((foto, index) => (
            <div
              key={foto.id}
              className="overflow-hidden rounded-xl border border-white/10 bg-slate-950"
            >
              {foto.imagenUrl ? (
                <a
                  href={foto.imagenUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block"
                  title="Abrir fotografÃ­a en tamaÃ±o completo"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={foto.imagenUrl}
                    alt={foto.descripcion ?? `${subtitulo} ${index + 1}`}
                    className="h-48 w-full object-cover transition hover:opacity-90"
                  />
                </a>
              ) : (
                <div className="grid h-48 place-items-center px-4 text-center text-sm text-slate-500">
                  No se pudo cargar la imagen
                </div>
              )}

              <div className="px-3 py-3">
                <p className="text-xs font-bold text-slate-300">
                  Foto {index + 1}
                </p>
                {foto.descripcion && (
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {foto.descripcion}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Resumen({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-950 p-4">
      <p className="text-xs font-black uppercase tracking-wider text-slate-500">
        {etiqueta}
      </p>
      <p className="mt-1 text-2xl font-black text-cyan-300">
        {valor}
      </p>
    </div>
  );
}

function Campo({
  name,
  label,
  type = "text",
  placeholder,
  inputMode,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  inputMode?:
    | "none"
    | "text"
    | "tel"
    | "url"
    | "email"
    | "numeric"
    | "decimal"
    | "search";
  defaultValue?: string | number;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold">
        {label}
      </span>

      <input
        name={name}
        type={type}
        required={label.includes("*")}
        placeholder={placeholder}
        step="any"
        inputMode={inputMode}
        defaultValue={defaultValue}
        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-base"
      />
    </label>
  );
}