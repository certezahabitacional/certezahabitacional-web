import Link from "next/link";
import { redirect } from "next/navigation";
import {
  RolUsuario,
  TipoCliente,
} from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import {
  actualizarCliente,
  crearCliente,
  desvincularUsuarioCliente,
  eliminarCliente,
  vincularUsuarioCliente,
} from "./actions";

const etiquetas: Record<TipoCliente, string> = {
  PARTICULAR: "Particular",
  INMOBILIARIA: "Inmobiliaria",
  CONSTRUCTORA: "Constructora",
  INVERSIONISTA: "Inversionista",
};

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    ok?: string;
    error?: string;
  }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const usuarioActual = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: {
      rol: true,
      activo: true,
    },
  });

  if (!usuarioActual || !usuarioActual.activo) {
    redirect("/acceso");
  }

  if (
    usuarioActual.rol !== RolUsuario.ADMINISTRADOR &&
    usuarioActual.rol !== RolUsuario.DIRECTOR
  ) {
    redirect("/acceso");
  }

  const esDirector =
    usuarioActual.rol === RolUsuario.DIRECTOR;

  const params = await searchParams;
  const q = params.q?.trim() ?? "";

  const [clientes, usuariosCliente] =
    await Promise.all([
      prisma.cliente.findMany({
        where: q
          ? {
              OR: [
                {
                  nombre: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
                {
                  telefono: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
                {
                  correo: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
                {
                  ciudad: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : undefined,

        include: {
          usuario: {
            select: {
              id: true,
              nombre: true,
              email: true,
              activo: true,
            },
          },

          _count: {
            select: {
              inspecciones: true,
              inmuebles: true,
              cotizaciones: true,
            },
          },
        },

        orderBy: {
          creadoEn: "desc",
        },
      }),

      prisma.usuario.findMany({
        where: {
          rol: RolUsuario.CLIENTE,
        },

        select: {
          id: true,
          nombre: true,
          email: true,
          activo: true,

          cliente: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },

        orderBy: {
          nombre: "asc",
        },
      }),
    ]);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <Link
              href="/panel"
              className="text-sm font-bold text-cyan-300"
            >
              ← Panel
            </Link>

            <h1 className="mt-2 text-3xl font-black">
              Clientes
            </h1>

            <p className="mt-1 text-slate-400">
              Directorio administrativo, datos comerciales y acceso
              al portal del cliente.
            </p>
          </div>

          <form
            action="/panel/clientes"
            className="flex gap-2"
          >
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar cliente"
              className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 outline-none focus:border-cyan-300"
            />

            <button className="rounded-full border border-white/15 px-5 py-3 font-bold">
              Buscar
            </button>
          </form>
        </div>

        {(params.ok || params.error) && (
          <p
            className={`mt-6 rounded-2xl px-5 py-4 font-bold ${
              params.error
                ? "bg-rose-400/10 text-rose-300"
                : "bg-emerald-400/10 text-emerald-300"
            }`}
          >
            {params.error ?? params.ok}
          </p>
        )}

        <div className="mt-8 grid gap-8 xl:grid-cols-[380px_1fr]">
          <section className="h-fit rounded-3xl border border-white/10 bg-slate-900 p-6">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">
              Alta rápida
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Nuevo cliente
            </h2>

            <form
              action={crearCliente}
              className="mt-6 space-y-4"
            >
              <Campo
                name="nombre"
                label="Nombre o razón social *"
              />

              <Campo
                name="telefono"
                label="Teléfono o WhatsApp *"
              />

              <Campo
                name="correo"
                label="Correo"
                type="email"
              />

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-300">
                  Tipo
                </span>

                <select
                  name="tipo"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
                >
                  {Object.entries(etiquetas).map(
                    ([valor, etiqueta]) => (
                      <option
                        key={valor}
                        value={valor}
                      >
                        {etiqueta}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <Campo
                name="empresa"
                label="Empresa"
              />

              <Campo
                name="ciudad"
                label="Ciudad"
                defaultValue="Hermosillo, Sonora"
              />

              <Campo
                name="direccion"
                label="Dirección"
              />

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-300">
                  Notas
                </span>

                <textarea
                  name="notas"
                  rows={3}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
                />
              </label>

              <button className="w-full rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950">
                Guardar cliente
              </button>
            </form>
          </section>

          <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
            <div className="border-b border-white/10 p-6">
              <p className="text-sm text-slate-400">
                {clientes.length} registro(s)
              </p>
            </div>

            {clientes.length === 0 ? (
              <p className="p-12 text-center text-slate-400">
                No hay clientes registrados.
              </p>
            ) : (
              <div className="divide-y divide-white/10">
                {clientes.map((cliente) => (
                  <article
                    key={cliente.id}
                    className="p-6"
                  >
                    <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-center">
                      <div>
                        <p className="text-lg font-black text-cyan-300">
                          {cliente.nombre}
                        </p>

                        <p className="mt-1 text-sm text-slate-400">
                          {cliente.telefono ??
                            "Sin teléfono"}
                        </p>

                        <p className="text-sm text-slate-500">
                          {cliente.correo ??
                            "Sin correo"}
                        </p>
                      </div>

                      <div>
                        <span className="rounded-full bg-white/5 px-3 py-2 text-xs font-black">
                          {etiquetas[cliente.tipo]}
                        </span>

                        <p className="mt-3 text-sm text-slate-400">
                          {cliente.ciudad ??
                            "Sin ciudad"}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold">
                          <span className="text-emerald-300">
                            {cliente._count.inspecciones}{" "}
                            inspección(es)
                          </span>

                          <span className="text-cyan-300">
                            {cliente._count.inmuebles}{" "}
                            inmueble(s)
                          </span>

                          <span className="text-amber-300">
                            {cliente._count.cotizaciones}{" "}
                            cotización(es)
                          </span>
                        </div>
                      </div>

                      <div className="md:text-right">
                        {cliente.usuario ? (
                          <span className="inline-flex rounded-full bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-300">
                            Con acceso al portal
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-amber-400/10 px-3 py-2 text-xs font-black text-amber-300">
                            Sin acceso al portal
                          </span>
                        )}
                      </div>
                    </div>

                    {cliente.usuario && (
                      <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4 text-sm">
                        <p className="font-black text-emerald-300">
                          Usuario vinculado
                        </p>

                        <p className="mt-1 text-slate-300">
                          {cliente.usuario.nombre}{" "}
                          —{" "}
                          {cliente.usuario.email}
                        </p>

                        {!cliente.usuario.activo && (
                          <p className="mt-1 font-bold text-rose-300">
                            Usuario inactivo
                          </p>
                        )}
                      </div>
                    )}

                    <details className="mt-5 rounded-2xl border border-white/10 bg-slate-950/60">
                      <summary className="cursor-pointer px-5 py-4 font-black text-cyan-300">
                        Editar cliente y acceso
                      </summary>

                      <div className="border-t border-white/10 p-5">
                        <form
                          action={actualizarCliente}
                          className="grid gap-4 md:grid-cols-2"
                        >
                          <input
                            type="hidden"
                            name="id"
                            value={cliente.id}
                          />

                          <Campo
                            name="nombre"
                            label="Nombre o razón social *"
                            defaultValue={cliente.nombre}
                          />

                          <Campo
                            name="telefono"
                            label="Teléfono o WhatsApp *"
                            defaultValue={
                              cliente.telefono ?? ""
                            }
                          />

                          <Campo
                            name="correo"
                            label="Correo"
                            type="email"
                            defaultValue={
                              cliente.correo ?? ""
                            }
                          />

                          <label className="block">
                            <span className="mb-2 block text-sm font-bold text-slate-300">
                              Tipo
                            </span>

                            <select
                              name="tipo"
                              defaultValue={cliente.tipo}
                              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
                            >
                              {Object.entries(
                                etiquetas,
                              ).map(
                                ([valor, etiqueta]) => (
                                  <option
                                    key={valor}
                                    value={valor}
                                  >
                                    {etiqueta}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>

                          <Campo
                            name="empresa"
                            label="Empresa"
                            defaultValue={
                              cliente.empresa ?? ""
                            }
                          />

                          <Campo
                            name="ciudad"
                            label="Ciudad"
                            defaultValue={
                              cliente.ciudad ?? ""
                            }
                          />

                          <div className="md:col-span-2">
                            <Campo
                              name="direccion"
                              label="Dirección"
                              defaultValue={
                                cliente.direccion ?? ""
                              }
                            />
                          </div>

                          <label className="block md:col-span-2">
                            <span className="mb-2 block text-sm font-bold text-slate-300">
                              Notas
                            </span>

                            <textarea
                              name="notas"
                              rows={3}
                              defaultValue={
                                cliente.notas ?? ""
                              }
                              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
                            />
                          </label>

                          <div className="md:col-span-2">
                            <button className="rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950">
                              Guardar cambios
                            </button>
                          </div>
                        </form>

                        <div className="mt-7 border-t border-white/10 pt-6">
                          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
                            Acceso al portal
                          </p>

                          <p className="mt-2 text-sm text-slate-400">
                            Puedes vincular un usuario CLIENTE
                            existente. Si ese usuario está asociado
                            actualmente a otro registro de cliente,
                            el acceso se moverá a este cliente. Sus
                            inmuebles, cotizaciones e inspecciones
                            no se mueven.
                          </p>

                          <form
                            action={vincularUsuarioCliente}
                            className="mt-4 flex flex-col gap-3 lg:flex-row"
                          >
                            <input
                              type="hidden"
                              name="clienteId"
                              value={cliente.id}
                            />

                            <select
                              name="usuarioId"
                              defaultValue={
                                cliente.usuario?.id ?? ""
                              }
                              required
                              className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
                            >
                              <option value="">
                                Selecciona un usuario CLIENTE
                              </option>

                              {usuariosCliente.map(
                                (usuario) => (
                                  <option
                                    key={usuario.id}
                                    value={usuario.id}
                                    disabled={!usuario.activo}
                                  >
                                    {usuario.nombre}{" "}
                                    —{" "}
                                    {usuario.email}
                                    {usuario.cliente
                                      ? usuario.cliente.id ===
                                        cliente.id
                                        ? " — vinculado aquí"
                                        : ` — actualmente en ${usuario.cliente.nombre}`
                                      : " — disponible"}
                                    {!usuario.activo
                                      ? " — INACTIVO"
                                      : ""}
                                  </option>
                                ),
                              )}
                            </select>

                            <button className="rounded-full bg-emerald-300 px-5 py-3 font-black text-slate-950">
                              Vincular acceso
                            </button>
                          </form>

                          {cliente.usuario && (
                            <form
                              action={
                                desvincularUsuarioCliente
                              }
                              className="mt-3"
                            >
                              <input
                                type="hidden"
                                name="clienteId"
                                value={cliente.id}
                              />

                              <button className="rounded-full border border-amber-300/30 px-5 py-3 text-sm font-black text-amber-300">
                                Desvincular acceso
                              </button>
                            </form>
                          )}
                        </div>

                        {esDirector && (
                          <div className="mt-7 border-t border-white/10 pt-6">
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-300">
                              Eliminación
                            </p>

                            <p className="mt-2 text-sm text-slate-500">
                              Solo Dirección puede eliminar
                              físicamente un registro sin usuario,
                              inmuebles, cotizaciones, inspecciones
                              ni historial asociado.
                            </p>

                            <form
                              action={eliminarCliente}
                              className="mt-4"
                            >
                              <input
                                type="hidden"
                                name="id"
                                value={cliente.id}
                              />

                              <button className="rounded-full border border-rose-400/20 px-4 py-2 text-sm font-bold text-rose-300">
                                Eliminar cliente
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    </details>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Campo({
  name,
  label,
  type = "text",
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-300">
        {label}
      </span>

      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
      />
    </label>
  );
}