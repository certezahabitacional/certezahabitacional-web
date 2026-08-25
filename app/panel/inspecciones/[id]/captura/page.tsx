import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { actualizarHallazgo, crearHallazgo, registrarSeguimientoHallazgo } from "../actions";

type SearchParams = Promise<{
  hallazgoId?: string;
  editar?: string;
  ok?: string;
  error?: string;
}>;

export default async function CapturaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const query = await searchParams;

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
              select: { id: true },
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
                  select: { id: true },
                },
              },
              take: 1,
            },
          },
        })
      : [];

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

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/panel/inspecciones/${id}`}
            className="text-sm font-bold text-cyan-300"
          >
            ← Volver al expediente
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
              Elige qué quieres hacer antes de continuar con el siguiente hallazgo.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Link
                href={`/panel/inspecciones/${id}/evidencias?hallazgoId=${hallazgoRecienCreado.id}`}
                className="rounded-2xl bg-cyan-400 px-4 py-3 text-center font-black text-slate-950"
              >
                📷 Tomar / agregar evidencia
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
              INSPECCIÓN {String(inspeccion.numeroInspeccion).padStart(2, "0")} · V{inspeccion.numeroInspeccion}
            </span>
          </div>

          <h1 className="mt-2 text-3xl font-black">
            Captura Método Certeza®
          </h1>

          <p className="mt-2 text-slate-400">
            {inspeccion.cliente.nombre} ·{" "}
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

        {hallazgosAntecedentes.length > 0 && (
          <section className="mt-7 rounded-3xl border border-violet-400/20 bg-slate-900 p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
              Seguimiento de la inspección anterior
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Verificación de hallazgos V{inspeccion.numeroInspeccion - 1}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Revisa cada antecedente y registra su evolución. El expediente anterior permanece intacto.
            </p>

            <div className="mt-6 space-y-4">
              {hallazgosAntecedentes.map((anterior, index) => {
                const seguimiento = anterior.hallazgosSiguientes[0];

                return (
                  <article
                    key={anterior.id}
                    className="rounded-2xl border border-white/10 bg-slate-950 p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs font-black">
                      <span className="rounded-full bg-violet-400/10 px-3 py-1 text-violet-300">
                        V{inspeccion.numeroInspeccion - 1} · #{index + 1}
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
                        Ubicación: {anterior.ubicacion}
                      </p>
                    )}

                    <p className="mt-2 text-xs text-slate-500">
                      Evidencia anterior: {anterior.fotografias.length} foto(s)
                    </p>

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
                            📷 Evidencia actual ({seguimiento.fotografias.length})
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
                            Resultado de la verificación *
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
                            <option value="CORRECCION_NO_SATISFACTORIA">Corrección no satisfactoria</option>
                            <option value="NO_VERIFICABLE">No verificable</option>
                          </select>
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-sm font-bold">
                            Observación de seguimiento
                          </span>
                          <textarea
                            name="observacionSeguimiento"
                            rows={3}
                            placeholder="Describe lo observado durante la reinspección."
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
                {hallazgoEnEdicion ? "Corrección del expediente" : "Captura en campo"}
              </p>

              <h2 className="mt-2 text-2xl font-black">
                {hallazgoEnEdicion ? "Editar hallazgo" : "Nuevo hallazgo"}
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                {hallazgoEnEdicion
                  ? "Corrige la información del hallazgo y guarda los cambios. Las evidencias existentes se conservarán."
                  : "Guarda el hallazgo y decide inmediatamente si agregas evidencia o continúas con el siguiente."}
              </p>
            </div>

            <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-slate-400">
              {hallazgoEnEdicion
                ? "Edición"
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

            <Campo
              name="area"
              label="Área *"
              placeholder="Instalación eléctrica"
              defaultValue={hallazgoEnEdicion?.area ?? ""}
            />

            <Campo
              name="titulo"
              label="Título *"
              placeholder="Contacto sin tierra física"
              defaultValue={hallazgoEnEdicion?.titulo ?? ""}
            />

            <Campo
              name="ubicacion"
              label="Ubicación"
              placeholder="Recámara principal"
              defaultValue={hallazgoEnEdicion?.ubicacion ?? ""}
            />

            <label className="block">
              <span className="mb-2 block text-sm font-bold">
                Clasificación
              </span>

              <select
                name="clasificacion"
                defaultValue={hallazgoEnEdicion?.clasificacion ?? "O"}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-base"
              >
                <option value="C">Conforme</option>
                <option value="O">Observación</option>
                <option value="NC">No conforme</option>
                <option value="CR">Crítico</option>
                <option value="NA">No aplica</option>
              </select>
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-bold">
                Descripción *
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
                Recomendación
              </span>

              <textarea
                name="recomendacion"
                rows={3}
                placeholder="Acción correctiva o recomendación sugerida."
                defaultValue={hallazgoEnEdicion?.recomendacion ?? ""}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-base"
              />
            </label>

            <button
              className={`md:col-span-2 min-h-12 rounded-full px-5 py-3 font-black text-slate-950 ${
                hallazgoEnEdicion ? "bg-amber-300" : "bg-cyan-400"
              }`}
            >
              {hallazgoEnEdicion
                ? "Guardar cambios del hallazgo"
                : "Guardar hallazgo"}
            </button>

            {hallazgoEnEdicion && (
              <Link
                href={`/panel/inspecciones/${id}/captura`}
                className="md:col-span-2 rounded-full border border-white/15 px-5 py-3 text-center font-black text-slate-300"
              >
                Cancelar edición
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
              Aún no hay hallazgos registrados.
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
                        Ubicación: {hallazgo.ubicacion}
                      </p>
                    )}

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <Link
                        href={`/panel/inspecciones/${id}/captura?editar=${hallazgo.id}#nuevo-hallazgo`}
                        className="min-h-11 rounded-2xl border border-amber-300/30 px-4 py-3 text-center text-sm font-black text-amber-300"
                      >
                        Editar hallazgo
                      </Link>

                      <Link
                        href={`/panel/inspecciones/${id}/evidencias?hallazgoId=${hallazgo.id}`}
                        className="min-h-11 rounded-2xl bg-cyan-400 px-4 py-3 text-center text-sm font-black text-slate-950"
                      >
                        📷{" "}
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
                          Sin fotografías
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
    CORRECCION_NO_SATISFACTORIA: "Corrección no satisfactoria",
    NO_VERIFICABLE: "No verificable",
    NUEVO_HALLAZGO: "Nuevo hallazgo",
  };

  return etiquetas[valor] ?? valor.replaceAll("_", " ");
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