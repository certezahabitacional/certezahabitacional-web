import Link from "next/link";
import {
  EstadoInspeccion,
  RolUsuario,
} from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  eliminarEvidencia,
  registrarEvidencia,
} from "./actions";
import EvidenciaSelector from "./EvidenciaSelector";

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

export default async function EvidenciasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    ok?: string;
    error?: string;
    hallazgoId?: string;
  }>;
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
      zonaId: true,
      gerenteId: true,
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

  if (usuarioActual.rol === RolUsuario.CLIENTE) {
    redirect("/portal");
  }

  if (usuarioActual.rol === RolUsuario.ADMINISTRADOR) {
    redirect("/acceso");
  }

  const alcance = await prisma.inspeccion.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      estado: true,
      zonaId: true,
      inspectorId: true,
      inspector: {
        select: {
          usuarioId: true,
          usuario: {
            select: {
              zonaId: true,
              gerenteId: true,
              coordinadorId: true,
            },
          },
        },
      },
    },
  });

  if (!alcance) {
    notFound();
  }

  if (usuarioActual.rol === RolUsuario.GERENTE) {
    if (
      alcance.inspector?.usuario.gerenteId !== usuarioActual.id
    ) {
      redirect("/acceso");
    }
  }

  if (usuarioActual.rol === RolUsuario.COORDINADOR) {
    if (
      alcance.inspector?.usuario.coordinadorId !== usuarioActual.id
    ) {
      redirect("/acceso");
    }
  }

  if (usuarioActual.rol === RolUsuario.INSPECTOR) {
    if (
      !usuarioActual.inspector ||
      !usuarioActual.inspector.activo ||
      alcance.inspectorId !== usuarioActual.inspector.id ||
      alcance.inspector?.usuarioId !== usuarioActual.id
    ) {
      redirect("/acceso");
    }
  }

  const puedeModificar =
    usuarioActual.rol === RolUsuario.DIRECTOR ||
    (usuarioActual.rol === RolUsuario.INSPECTOR &&
      alcance.estado === EstadoInspeccion.EN_PROCESO);

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    include: {
      hallazgos: {
        orderBy: { creadoEn: "desc" },
        select: {
          id: true,
          titulo: true,
          area: true,
          clasificacion: true,
          prioridad: true,
        },
      },
      fotografias: {
        orderBy: { creadaEn: "desc" },
        include: {
          hallazgo: {
            select: {
              id: true,
              titulo: true,
              area: true,
            },
          },
        },
      },
    },
  });

  if (!inspeccion) {
    notFound();
  }

  const hallazgoSeleccionado = query.hallazgoId
    ? inspeccion.hallazgos.find(
        (hallazgo) => hallazgo.id === query.hallazgoId,
      )
    : undefined;

  const supabase = obtenerSupabase();
  const bucket =
    process.env.SUPABASE_STORAGE_BUCKET || "evidencias";

  const fotografias = await Promise.all(
    inspeccion.fotografias.map(async (foto) => {
      if (
        foto.url.startsWith("http://") ||
        foto.url.startsWith("https://")
      ) {
        return {
          ...foto,
          imagenUrl: foto.url,
        };
      }

      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(foto.url, 60 * 60);

      return {
        ...foto,
        imagenUrl: error ? null : data.signedUrl,
      };
    }),
  );

  const fotografiasMostradas = hallazgoSeleccionado
    ? fotografias.filter(
        (foto) =>
          foto.hallazgo?.id === hallazgoSeleccionado.id,
      )
    : fotografias;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/panel/inspecciones/${id}`}
          className="text-sm font-bold text-cyan-300"
        >
          ← Volver al expediente
        </Link>

        <p className="mt-5 font-black text-cyan-300">
          {inspeccion.folio}
        </p>

        <h1 className="mt-2 text-3xl font-black">
          Evidencias fotográficas
        </h1>

        <p className="mt-2 text-slate-400">
          Agrega evidencia general de la inspección o vincúlala a un hallazgo
          específico ya capturado.
        </p>

        {query.ok && (
          <p className="mt-5 rounded-2xl bg-emerald-400/10 px-5 py-4 font-bold text-emerald-300">
            {query.ok}
          </p>
        )}

        {query.error && (
          <p className="mt-5 rounded-2xl bg-rose-400/10 px-5 py-4 font-bold text-rose-300">
            {query.error}
          </p>
        )}

        {hallazgoSeleccionado && (
          <section className="mt-6 rounded-3xl border border-cyan-400/25 bg-cyan-400/5 p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
              Evidencias del hallazgo
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-xs font-black text-cyan-300">
                {hallazgoSeleccionado.clasificacion}
              </span>

              <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-black text-slate-300">
                {hallazgoSeleccionado.prioridad}
              </span>

              <span className="text-sm font-bold text-slate-300">
                {hallazgoSeleccionado.area}
              </span>
            </div>

            <h2 className="mt-3 text-xl font-black">
              {hallazgoSeleccionado.titulo}
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              {fotografiasMostradas.length} evidencia(s) vinculada(s) a este
              hallazgo.
            </p>

            <Link
              href={`/panel/inspecciones/${id}/evidencias`}
              className="mt-4 inline-flex rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-slate-300 hover:border-cyan-300/40 hover:text-cyan-300"
            >
              Ver todas las evidencias
            </Link>
          </section>
        )}

        {puedeModificar ? (
        <form
          action={registrarEvidencia}
          className="mt-7 grid gap-4 rounded-3xl border border-white/10 bg-slate-900 p-6 md:grid-cols-2"
        >
          <input
            type="hidden"
            name="inspeccionId"
            value={id}
          />

          <div className="md:col-span-2">
            <EvidenciaSelector />
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-bold">
              Vincular a hallazgo
            </span>

            <select
              name="hallazgoId"
              defaultValue={
                hallazgoSeleccionado?.id ?? ""
              }
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
            >
              <option value="">
                Evidencia general
              </option>

              {inspeccion.hallazgos.map(
                (hallazgo) => (
                  <option
                    key={hallazgo.id}
                    value={hallazgo.id}
                  >
                    {hallazgo.area}:{" "}
                    {hallazgo.titulo}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold">
              Descripción
            </span>

            <input
              name="descripcion"
              placeholder="Ejemplo: humedad debajo de la ventana"
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
            />
          </label>

          <button className="rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950 md:col-span-2">
            Subir y registrar evidencia
          </button>
        </form>

        ) : (
          <div className="mt-7 rounded-3xl border border-white/10 bg-slate-900 p-5 text-sm text-slate-400">
            Evidencias en modo solo lectura para tu rol o para el estado actual del expediente.
          </div>
        )}

        {fotografiasMostradas.length === 0 ? (
          <div className="mt-7 rounded-3xl border border-white/10 bg-slate-900 p-10 text-center text-slate-400">
            {hallazgoSeleccionado
              ? "Este hallazgo todavía no tiene evidencias fotográficas."
              : "Todavía no hay evidencias fotográficas registradas."}
          </div>
        ) : (
          <section className="mt-7">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                  {hallazgoSeleccionado
                    ? "Galería del hallazgo"
                    : "Galería del expediente"}
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Evidencias registradas (
                  {fotografiasMostradas.length})
                </h2>
              </div>

              {hallazgoSeleccionado && (
                <Link
                  href={`/panel/inspecciones/${id}/evidencias`}
                  className="text-sm font-bold text-cyan-300 hover:text-cyan-200"
                >
                  Ver galería completa →
                </Link>
              )}
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {fotografiasMostradas.map(
                (foto) => (
                  <article
                    key={foto.id}
                    className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900"
                  >
                    {foto.imagenUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a
                        href={foto.imagenUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block"
                        title="Abrir fotografía en tamaño completo"
                      >
                        <img
                          src={foto.imagenUrl}
                          alt={
                            foto.descripcion ??
                            "Evidencia"
                          }
                          className="h-56 w-full object-cover transition hover:opacity-90"
                        />
                      </a>
                    ) : (
                      <div className="grid h-56 place-items-center bg-slate-950 text-sm text-slate-500">
                        No se pudo cargar la imagen
                      </div>
                    )}

                    <div className="p-5">
                      {foto.hallazgo ? (
                        <>
                          <p className="text-xs font-bold text-cyan-300">
                            {foto.hallazgo.area}
                          </p>
                          <p className="mt-1 font-black">
                            {foto.hallazgo.titulo}
                          </p>
                        </>
                      ) : (
                        <p className="font-black">
                          Evidencia general
                        </p>
                      )}

                      <p className="mt-2 text-sm text-slate-400">
                        {foto.descripcion ??
                          "Sin descripción"}
                      </p>

                      {foto.imagenUrl && (
                        <a
                          href={foto.imagenUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex text-sm font-black text-cyan-300 hover:text-cyan-200"
                        >
                          Ver en grande ↗
                        </a>
                      )}

                      {puedeModificar && (
                      <details className="mt-4 border-t border-white/10 pt-4">
                        <summary className="cursor-pointer text-sm font-bold text-rose-300">
                          Eliminar evidencia
                        </summary>

                        <div className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-400/5 p-3">
                          <p className="text-xs leading-5 text-slate-400">
                            Esta acción quitará la fotografía del expediente.
                            Úsala solamente si la evidencia es incorrecta,
                            duplicada o no corresponde al hallazgo.
                          </p>

                          <form
                            action={
                              eliminarEvidencia
                            }
                            className="mt-3"
                          >
                            <input
                              type="hidden"
                              name="inspeccionId"
                              value={id}
                            />
                            <input
                              type="hidden"
                              name="fotografiaId"
                              value={foto.id}
                            />
                            <input
                              type="hidden"
                              name="hallazgoId"
                              value={
                                hallazgoSeleccionado?.id ??
                                foto.hallazgo?.id ??
                                ""
                              }
                            />

                            <button
                              type="submit"
                              className="w-full rounded-full border border-rose-400/40 px-4 py-2 text-sm font-black text-rose-300 transition hover:bg-rose-400 hover:text-slate-950"
                            >
                              Confirmar eliminación
                            </button>
                          </form>
                        </div>
                      </details>
                      )}
                    </div>
                  </article>
                ),
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}