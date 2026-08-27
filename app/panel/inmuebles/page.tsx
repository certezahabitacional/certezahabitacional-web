import Link from "next/link";
import { RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { puede } from "@/lib/permisos";
import { prisma } from "@/lib/prisma";

import {
  actualizarInmueble,
  crearInmueble,
  eliminarInmueble,
} from "./actions";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    ok?: string;
    error?: string;
  }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const usuarioActual =
    await prisma.usuario.findUnique({
      where: {
        id: session.user.id,
      },
      select: {
        rol: true,
        activo: true,
      },
    });

  if (
    !usuarioActual ||
    !usuarioActual.activo
  ) {
    redirect("/acceso");
  }

  if (
    usuarioActual.rol !==
      RolUsuario.ADMINISTRADOR &&
    usuarioActual.rol !==
      RolUsuario.DIRECTOR
  ) {
    redirect("/acceso");
  }

  if (
    !puede(
      usuarioActual.rol,
      "INMUEBLE_CREAR",
    ) ||
    !puede(
      usuarioActual.rol,
      "INMUEBLE_EDITAR_ADMIN",
    )
  ) {
    redirect("/acceso");
  }

  const esDirector =
    usuarioActual.rol ===
      RolUsuario.DIRECTOR &&
    puede(
      usuarioActual.rol,
      "REGISTRO_ELIMINAR_FISICO",
    );

  const p =
    await searchParams;

  const [
    clientes,
    inmuebles,
  ] = await Promise.all([
    prisma.cliente.findMany({
      orderBy: {
        nombre: "asc",
      },
      select: {
        id: true,
        nombre: true,
      },
    }),

    prisma.inmueble.findMany({
      include: {
        cliente: {
          select: {
            id: true,
            nombre: true,
          },
        },

        _count: {
          select: {
            inspecciones: true,
            cotizaciones: true,
          },
        },
      },

      orderBy: {
        creadoEn: "desc",
      },
    }),
  ]);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/panel"
          className="text-sm font-bold text-cyan-300"
        >
          ← Panel
        </Link>

        <h1 className="mt-2 text-3xl font-black">
          Inmuebles
        </h1>

        <p className="mt-1 text-slate-400">
          Directorio administrativo de propiedades.
        </p>

        {(p.ok || p.error) && (
          <p
            className={`mt-6 rounded-2xl px-5 py-4 font-bold ${
              p.error
                ? "bg-rose-400/10 text-rose-300"
                : "bg-emerald-400/10 text-emerald-300"
            }`}
          >
            {p.error ?? p.ok}
          </p>
        )}

        <div className="mt-8 grid gap-8 xl:grid-cols-[420px_1fr]">
          <section className="h-fit rounded-3xl border border-white/10 bg-slate-900 p-6">
            <h2 className="text-2xl font-black">
              Nuevo inmueble
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Registra los datos administrativos y técnicos básicos
              de la propiedad.
            </p>

            {clientes.length === 0 ? (
              <p className="mt-5 text-slate-400">
                Primero registra un cliente.
              </p>
            ) : (
              <form
                action={crearInmueble}
                className="mt-6 space-y-4"
              >
                <Sel
                  n="clienteId"
                  l="Cliente *"
                  ops={clientes.map(
                    (cliente) => [
                      cliente.id,
                      cliente.nombre,
                    ],
                  )}
                />

                <Inp
                  n="alias"
                  l="Alias *"
                  ph="Casa Altares"
                />

                <Inp
                  n="tipo"
                  l="Tipo *"
                  ph="Vivienda residencial"
                />

                <Inp
                  n="direccion"
                  l="Dirección *"
                />

                <Inp
                  n="colonia"
                  l="Colonia"
                />

                <Inp
                  n="ciudad"
                  l="Ciudad *"
                  dv="Hermosillo"
                />

                <Inp
                  n="estado"
                  l="Estado *"
                  dv="Sonora"
                />

                <Inp
                  n="codigoPostal"
                  l="Código postal"
                />

                <div className="grid grid-cols-2 gap-3">
                  <Inp
                    n="superficieTerrenoM2"
                    l="Terreno m²"
                    t="number"
                  />

                  <Inp
                    n="superficieConstruccionM2"
                    l="Construcción m²"
                    t="number"
                  />
                </div>

                <Inp
                  n="anioConstruccion"
                  l="Año de construcción"
                  t="number"
                />

                <Inp
                  n="constructor"
                  l="Constructor"
                />

                <Inp
                  n="desarrollo"
                  l="Desarrollo"
                />

                <Inp
                  n="numeroEscritura"
                  l="Número de escritura"
                />

                <div className="grid grid-cols-2 gap-3">
                  <Inp
                    n="latitud"
                    l="Latitud"
                    t="number"
                  />

                  <Inp
                    n="longitud"
                    l="Longitud"
                    t="number"
                  />
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-300">
                    Notas
                  </span>

                  <textarea
                    name="notas"
                    rows={4}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
                  />
                </label>

                <button className="w-full rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950 hover:bg-cyan-300">
                  Guardar inmueble
                </button>
              </form>
            )}
          </section>

          <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
            <div className="border-b border-white/10 p-6">
              <h2 className="text-xl font-black">
                Propiedades registradas
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {inmuebles.length} inmueble
                {inmuebles.length === 1 ? "" : "s"} registrado
                {inmuebles.length === 1 ? "" : "s"}
              </p>
            </div>

            {inmuebles.length === 0 ? (
              <p className="p-12 text-center text-slate-400">
                No hay inmuebles registrados.
              </p>
            ) : (
              <div className="divide-y divide-white/10">
                {inmuebles.map(
                  (inmueble) => (
                    <article
                      key={inmueble.id}
                      className="p-6"
                    >
                      <div className="grid gap-5 md:grid-cols-[1fr_1fr_auto] md:items-start">
                        <div>
                          <p className="text-lg font-black text-cyan-300">
                            {inmueble.alias}
                          </p>

                          <p className="mt-1 text-sm text-slate-400">
                            {inmueble.cliente.nombre}
                          </p>

                          <p className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                            {inmueble.tipo}
                          </p>
                        </div>

                        <div>
                          <p className="font-bold">
                            {inmueble.direccion}
                          </p>

                          <p className="mt-1 text-sm text-slate-400">
                            {inmueble.colonia
                              ? `${inmueble.colonia} · `
                              : ""}
                            {inmueble.ciudad},{" "}
                            {inmueble.estado}
                          </p>

                          {inmueble.codigoPostal && (
                            <p className="mt-1 text-xs text-slate-500">
                              C.P.{" "}
                              {inmueble.codigoPostal}
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                            {inmueble.superficieTerrenoM2 !==
                              null && (
                              <span className="rounded-full bg-white/5 px-3 py-1">
                                Terreno:{" "}
                                {Number(
                                  inmueble.superficieTerrenoM2,
                                )}{" "}
                                m²
                              </span>
                            )}

                            {inmueble.superficieConstruccionM2 !==
                              null && (
                              <span className="rounded-full bg-white/5 px-3 py-1">
                                Construcción:{" "}
                                {Number(
                                  inmueble.superficieConstruccionM2,
                                )}{" "}
                                m²
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2 md:text-right">
                          <span className="inline-flex rounded-full bg-white/5 px-3 py-2 text-xs font-black">
                            {inmueble._count.inspecciones} inspección
                            {inmueble._count.inspecciones === 1
                              ? ""
                              : "es"}
                          </span>

                          <br />

                          <span className="inline-flex rounded-full bg-white/5 px-3 py-2 text-xs font-black">
                            {inmueble._count.cotizaciones} cotización
                            {inmueble._count.cotizaciones === 1
                              ? ""
                              : "es"}
                          </span>
                        </div>
                      </div>

                      <details className="mt-5 rounded-2xl border border-white/10 bg-slate-950/60">
                        <summary className="cursor-pointer px-5 py-4 font-black text-cyan-300">
                          Editar inmueble
                        </summary>

                        <div className="border-t border-white/10 p-5">
                          <form
                            action={
                              actualizarInmueble
                            }
                            className="grid gap-4 md:grid-cols-2"
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={
                                inmueble.id
                              }
                            />

                            <div className="md:col-span-2">
                              <CampoSoloLectura
                                label="Cliente"
                                value={
                                  inmueble
                                    .cliente
                                    .nombre
                                }
                              />
                            </div>

                            <Inp
                              n="alias"
                              l="Alias *"
                              dv={
                                inmueble.alias
                              }
                            />

                            <Inp
                              n="tipo"
                              l="Tipo *"
                              dv={
                                inmueble.tipo
                              }
                            />

                            <div className="md:col-span-2">
                              <Inp
                                n="direccion"
                                l="Dirección *"
                                dv={
                                  inmueble.direccion
                                }
                              />
                            </div>

                            <Inp
                              n="colonia"
                              l="Colonia"
                              dv={
                                inmueble.colonia ??
                                ""
                              }
                            />

                            <Inp
                              n="codigoPostal"
                              l="Código postal"
                              dv={
                                inmueble.codigoPostal ??
                                ""
                              }
                            />

                            <Inp
                              n="ciudad"
                              l="Ciudad *"
                              dv={
                                inmueble.ciudad
                              }
                            />

                            <Inp
                              n="estado"
                              l="Estado *"
                              dv={
                                inmueble.estado
                              }
                            />

                            <Inp
                              n="superficieTerrenoM2"
                              l="Terreno m²"
                              t="number"
                              dv={
                                inmueble.superficieTerrenoM2 !==
                                null
                                  ? String(
                                      inmueble.superficieTerrenoM2,
                                    )
                                  : ""
                              }
                            />

                            <Inp
                              n="superficieConstruccionM2"
                              l="Construcción m²"
                              t="number"
                              dv={
                                inmueble.superficieConstruccionM2 !==
                                null
                                  ? String(
                                      inmueble.superficieConstruccionM2,
                                    )
                                  : ""
                              }
                            />

                            <Inp
                              n="anioConstruccion"
                              l="Año de construcción"
                              t="number"
                              dv={
                                inmueble.anioConstruccion !==
                                null
                                  ? String(
                                      inmueble.anioConstruccion,
                                    )
                                  : ""
                              }
                            />

                            <Inp
                              n="constructor"
                              l="Constructor"
                              dv={
                                inmueble.nombreConstructor ??
                                ""
                              }
                            />

                            <Inp
                              n="desarrollo"
                              l="Desarrollo"
                              dv={
                                inmueble.desarrollo ??
                                ""
                              }
                            />

                            <Inp
                              n="numeroEscritura"
                              l="Número de escritura"
                              dv={
                                inmueble.numeroEscritura ??
                                ""
                              }
                            />

                            <Inp
                              n="latitud"
                              l="Latitud"
                              t="number"
                              dv={
                                inmueble.latitud !==
                                null
                                  ? String(
                                      inmueble.latitud,
                                    )
                                  : ""
                              }
                            />

                            <Inp
                              n="longitud"
                              l="Longitud"
                              t="number"
                              dv={
                                inmueble.longitud !==
                                null
                                  ? String(
                                      inmueble.longitud,
                                    )
                                  : ""
                              }
                            />

                            <label className="block md:col-span-2">
                              <span className="mb-2 block text-sm font-bold text-slate-300">
                                Notas
                              </span>

                              <textarea
                                name="notas"
                                rows={4}
                                defaultValue={
                                  inmueble.notas ??
                                  ""
                                }
                                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
                              />
                            </label>

                            <div className="md:col-span-2">
                              <button className="rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950 hover:bg-cyan-300">
                                Guardar cambios
                              </button>
                            </div>
                          </form>

                          {esDirector && (
                            <div className="mt-7 border-t border-white/10 pt-6">
                              <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-300">
                                Eliminación
                              </p>

                              <p className="mt-2 text-sm leading-6 text-slate-500">
                                Dirección solo puede eliminar físicamente un
                                inmueble vacío, sin inspecciones ni cotizaciones.
                              </p>

                              <form
                                action={
                                  eliminarInmueble
                                }
                                className="mt-4"
                              >
                                <input
                                  type="hidden"
                                  name="id"
                                  value={
                                    inmueble.id
                                  }
                                />

                                <button className="rounded-full border border-rose-400/20 px-4 py-2 text-sm font-bold text-rose-300">
                                  Eliminar inmueble
                                </button>
                              </form>
                            </div>
                          )}
                        </div>
                      </details>
                    </article>
                  ),
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Inp({
  n,
  l,
  t = "text",
  ph,
  dv,
}: {
  n: string;
  l: string;
  t?: string;
  ph?: string;
  dv?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-300">
        {l}
      </span>

      <input
        name={n}
        type={t}
        placeholder={ph}
        defaultValue={dv}
        step={
          t === "number"
            ? "any"
            : undefined
        }
        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
      />
    </label>
  );
}

function Sel({
  n,
  l,
  ops,
}: {
  n: string;
  l: string;
  ops: string[][];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-300">
        {l}
      </span>

      <select
        name={n}
        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
      >
        {ops.map(
          (opcion) => (
            <option
              key={opcion[0]}
              value={opcion[0]}
            >
              {opcion[1]}
            </option>
          ),
        )}
      </select>
    </label>
  );
}

function CampoSoloLectura({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-bold text-slate-300">
        {label}
      </p>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-slate-300">
        {value}
      </div>
    </div>
  );
}
