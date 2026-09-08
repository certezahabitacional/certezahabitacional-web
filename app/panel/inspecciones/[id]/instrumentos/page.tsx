import Link from "next/link";
import { EstadoInspeccion, RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  extraerConfiguracionHerramientas,
  obtenerHerramientas,
} from "@/lib/herramientas-inspeccion";
import { extraerResultadosInstrumentales } from "@/lib/resultados-instrumentales";
import { prisma } from "@/lib/prisma";
import { guardarResultadosInstrumentales } from "./actions";

type SearchParams = Promise<{ ok?: string; error?: string }>;

export default async function InstrumentosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await auth();

  if (!session?.user) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      rol: true,
      activo: true,
      inspector: { select: { id: true, activo: true } },
    },
  });

  if (!usuario?.activo) redirect("/acceso");

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    include: {
      cliente: { select: { nombre: true } },
      inmueble: { select: { alias: true } },
      cotizacion: {
        select: {
          folio: true,
          observacionesInternas: true,
        },
      },
    },
  });

  if (!inspeccion) notFound();

  const esInspectorAsignado =
    usuario.rol === RolUsuario.INSPECTOR &&
    Boolean(usuario.inspector?.activo) &&
    inspeccion.inspectorId === usuario.inspector?.id;

  const puedeConsultar =
    esInspectorAsignado ||
    usuario.rol === RolUsuario.DIRECTOR ||
    usuario.rol === RolUsuario.GERENTE ||
    usuario.rol === RolUsuario.COORDINADOR;

  if (!puedeConsultar) redirect("/acceso");

  const puedeEditar =
    (esInspectorAsignado || usuario.rol === RolUsuario.DIRECTOR) &&
    inspeccion.estado === EstadoInspeccion.EN_PROCESO;

  const configuracion = extraerConfiguracionHerramientas(
    inspeccion.cotizacion?.observacionesInternas,
  );
  const herramientas = obtenerHerramientas(configuracion.herramientas);
  const { resultados } = extraerResultadosInstrumentales(
    inspeccion.observaciones,
  );

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/panel/inspecciones/${id}`}
            className="text-sm font-black text-cyan-300"
          >
            ← Volver al expediente
          </Link>

          <Link
            href={`/panel/inspecciones/${id}/captura`}
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-black text-slate-300"
          >
            Captura de hallazgos
          </Link>
        </div>

        <header className="mt-5 rounded-3xl border border-white/10 bg-slate-900 p-6">
          <p className="font-mono text-xs font-bold text-cyan-300">
            {inspeccion.folio}
            {inspeccion.cotizacion?.folio
              ? ` · ${inspeccion.cotizacion.folio}`
              : ""}
          </p>
          <h1 className="mt-2 text-3xl font-black">
            Verificaciones instrumentales
          </h1>
          <p className="mt-2 text-slate-400">
            {inspeccion.cliente.nombre} ·{" "}
            {inspeccion.inmueble?.alias ?? inspeccion.tipoInmueble}
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400">
            Aquí se muestran exclusivamente las herramientas y pruebas incluidas en la cotización autorizada. Si una prueba no puede ejecutarse, registra el motivo; no sustituyas ni agregues herramientas fuera del alcance contratado.
          </p>
        </header>

        {(query.ok || query.error) && (
          <div
            className={`mt-5 rounded-2xl border p-4 ${
              query.error
                ? "border-rose-400/20 bg-rose-400/5 text-rose-200"
                : "border-emerald-400/20 bg-emerald-400/5 text-emerald-200"
            }`}
          >
            {query.error ?? query.ok}
          </div>
        )}

        {herramientas.length === 0 ? (
          <section className="mt-7 rounded-3xl border border-dashed border-white/15 bg-slate-900/50 p-8 text-center">
            <h2 className="text-xl font-black">
              Sin verificaciones instrumentales contratadas
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              La cotización vinculada no contiene herramientas o pruebas seleccionadas.
            </p>
          </section>
        ) : (
          <form
            action={guardarResultadosInstrumentales}
            className="mt-7 space-y-5"
          >
            <input type="hidden" name="id" value={inspeccion.id} />

            {herramientas.map((herramienta, indice) => {
              const resultado = resultados[herramienta.codigo];
              const estado = resultado?.estado ?? "REALIZADA";

              return (
                <section
                  key={herramienta.codigo}
                  className="rounded-3xl border border-white/10 bg-slate-900 p-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                        Verificación {String(indice + 1).padStart(2, "0")}
                      </p>
                      <h2 className="mt-2 text-xl font-black">
                        {herramienta.nombre}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {herramienta.aplicacionCotizacion}
                      </p>
                    </div>

                    <select
                      name={`estado__${herramienta.codigo}`}
                      defaultValue={estado}
                      disabled={!puedeEditar}
                      className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold"
                    >
                      <option value="REALIZADA">Realizada</option>
                      <option value="NO_EJECUTADA">No ejecutada</option>
                    </select>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {herramienta.campos.map((campo) => (
                      <label
                        key={campo.clave}
                        className={campo.tipo === "textarea" ? "md:col-span-2" : ""}
                      >
                        <span className="text-sm font-bold text-slate-300">
                          {campo.etiqueta}
                        </span>

                        {campo.tipo === "textarea" ? (
                          <textarea
                            name={`${herramienta.codigo}__${campo.clave}`}
                            defaultValue={resultado?.valores[campo.clave] ?? ""}
                            disabled={!puedeEditar}
                            rows={3}
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm"
                          />
                        ) : (
                          <input
                            name={`${herramienta.codigo}__${campo.clave}`}
                            defaultValue={resultado?.valores[campo.clave] ?? ""}
                            disabled={!puedeEditar}
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm"
                          />
                        )}
                      </label>
                    ))}

                    <label className="md:col-span-2">
                      <span className="text-sm font-bold text-amber-200">
                        Motivo si no se ejecutó
                      </span>
                      <textarea
                        name={`motivo__${herramienta.codigo}`}
                        defaultValue={resultado?.motivoNoEjecutada ?? ""}
                        disabled={!puedeEditar}
                        rows={2}
                        placeholder="Ejemplo: instalación sin suministro, condición insegura o acceso no disponible."
                        className="mt-2 w-full rounded-xl border border-amber-300/20 bg-slate-950 px-4 py-3 text-sm"
                      />
                    </label>
                  </div>
                </section>
              );
            })}

            {puedeEditar ? (
              <div className="sticky bottom-4 rounded-2xl border border-cyan-300/20 bg-slate-950/95 p-4 shadow-2xl backdrop-blur">
                <button
                  type="submit"
                  className="w-full rounded-full bg-cyan-300 px-6 py-4 font-black text-slate-950 sm:w-auto"
                >
                  Guardar verificaciones instrumentales
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-slate-900 p-5 text-sm text-slate-400">
                Vista de solo lectura. La captura instrumental únicamente se habilita durante una inspección EN PROCESO para el Inspector asignado o Dirección.
              </div>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
