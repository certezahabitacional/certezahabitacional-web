import Link from "next/link";
import { RolUsuario } from "@prisma/client";

import PasswordField from "@/components/forms/PasswordField";
import { obtenerAdministradorActual } from "@/lib/administrador-actual";
import { prisma } from "@/lib/prisma";

import {
  cambiarEstadoUsuario,
  cambiarPasswordUsuario,
} from "./actions";
import FormularioCrearUsuario from "./FormularioCrearUsuario";

type PageProps = {
  searchParams: Promise<{
    ok?: string;
    error?: string;
    q?: string;
    rol?: string;
  }>;
};

export default async function UsuariosPage({
  searchParams,
}: PageProps) {
  const administrador =
    await obtenerAdministradorActual();

  const parametros = await searchParams;

  const busqueda =
    parametros.q?.trim() ?? "";

  const rolFiltro =
    parametros.rol?.trim() ?? "";

  const rolValido =
    Object.values(RolUsuario).includes(
      rolFiltro as RolUsuario,
    )
      ? (rolFiltro as RolUsuario)
      : undefined;

  const esDirector =
    administrador.rol === RolUsuario.DIRECTOR;

  const esAdministrador =
    administrador.rol ===
    RolUsuario.ADMINISTRADOR;

  if (
    !esDirector &&
    !esAdministrador
  ) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-xl rounded-3xl border border-rose-400/20 bg-rose-400/5 p-8 text-center">
          <h1 className="text-2xl font-black text-rose-300">
            Acceso restringido
          </h1>

          <p className="mt-3 text-slate-300">
            Solo Dirección y Administración
            pueden gestionar usuarios.
          </p>

          <Link
            href="/panel"
            className="mt-6 inline-flex rounded-full border border-white/10 px-5 py-3 font-bold text-cyan-300"
          >
            Volver al panel
          </Link>
        </div>
      </main>
    );
  }

  const [
    usuariosBase,
    zonas,
    gerentes,
    perfilesCliente,
    perfilesInspector,
  ] = await Promise.all([
    prisma.usuario.findMany({
      where: {
        AND: [
          busqueda
            ? {
                OR: [
                  {
                    nombre: {
                      contains: busqueda,
                      mode: "insensitive",
                    },
                  },
                  {
                    email: {
                      contains: busqueda,
                      mode: "insensitive",
                    },
                  },
                ],
              }
            : {},
          rolValido
            ? {
                rol: rolValido,
              }
            : {},
        ],
      },

      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        creadoEn: true,
        ultimoAcceso: true,
        zonaId: true,
        gerenteId: true,
      },

      orderBy: {
        creadoEn: "desc",
      },
    }),

    prisma.zona.findMany({
      where: {
        activa: true,
      },

      select: {
        id: true,
        nombre: true,
      },

      orderBy: {
        nombre: "asc",
      },
    }),

    prisma.usuario.findMany({
      where: {
        rol: RolUsuario.GERENTE,
        activo: true,
        zonaId: {
          not: null,
        },
      },

      select: {
        id: true,
        nombre: true,
        email: true,
        zonaId: true,
      },

      orderBy: {
        nombre: "asc",
      },
    }),

    prisma.cliente.findMany({
      where: {
        usuarioId: {
          not: null,
        },
      },

      select: {
        usuarioId: true,
      },
    }),

    prisma.inspector.findMany({
      select: {
        usuarioId: true,
      },
    }),
  ]);

  const zonaPorId = new Map(
    zonas.map((zona) => [
      zona.id,
      zona,
    ]),
  );

  const gerentePorId = new Map(
    gerentes.map((gerente) => [
      gerente.id,
      gerente,
    ]),
  );

  const clientesPorUsuario =
    new Set(
      perfilesCliente
        .map(
          (perfil) =>
            perfil.usuarioId,
        )
        .filter(
          (
            usuarioId,
          ): usuarioId is string =>
            Boolean(usuarioId),
        ),
    );

  const inspectoresPorUsuario =
    new Set(
      perfilesInspector.map(
        (perfil) =>
          perfil.usuarioId,
      ),
    );

  const usuarios =
    usuariosBase.map(
      (usuario) => ({
        ...usuario,

        zona: usuario.zonaId
          ? zonaPorId.get(
              usuario.zonaId,
            ) ?? null
          : null,

        gerente:
          usuario.gerenteId
            ? gerentePorId.get(
                usuario.gerenteId,
              ) ?? null
            : null,

        cliente:
          clientesPorUsuario.has(
            usuario.id,
          )
            ? {
                id: usuario.id,
              }
            : null,

        inspector:
          inspectoresPorUsuario.has(
            usuario.id,
          )
            ? {
                id: usuario.id,
              }
            : null,
      }),
    );

  const rolesCreables =
    esDirector
      ? [
          RolUsuario.DIRECTOR,
          RolUsuario.ADMINISTRADOR,
          RolUsuario.GERENTE,
          RolUsuario.COORDINADOR,
          RolUsuario.CLIENTE,
        ]
      : [
          RolUsuario.GERENTE,
          RolUsuario.COORDINADOR,
          RolUsuario.CLIENTE,
        ];

  function puedeModificar(
    usuario: {
      id: string;
      rol: RolUsuario;
    },
  ) {
    if (
      usuario.id ===
      administrador.id
    ) {
      return false;
    }

    if (esDirector) {
      return true;
    }

    return (
      usuario.rol !==
        RolUsuario.DIRECTOR &&
      usuario.rol !==
        RolUsuario.ADMINISTRADOR
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
              {esDirector
                ? "Dirección"
                : "Administración"}
            </p>

            <h1 className="mt-2 text-4xl font-black">
              Usuarios
            </h1>

            <p className="mt-2 text-slate-400">
              Crea cuentas, asigna roles,
              zonas y jerarquías, restablece
              contraseñas y controla el
              acceso a la plataforma.
            </p>

            <p className="mt-2 text-sm text-slate-600">
              Usuario actual:{" "}
              <strong className="text-slate-300">
                {administrador.nombre}
              </strong>
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/panel/inspectores"
              className="rounded-full border border-amber-300/30 px-5 py-3 text-sm font-bold text-amber-300 transition hover:bg-amber-300/10"
            >
              Ir al módulo de Inspectores
            </Link>

            <Link
              href="/panel"
              className="rounded-full border border-white/10 px-5 py-3 text-sm font-bold transition hover:border-cyan-300 hover:text-cyan-300"
            >
              Volver al panel
            </Link>
          </div>
        </header>

        {parametros.ok && (
          <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-4 text-emerald-200">
            {parametros.ok}
          </div>
        )}

        {parametros.error && (
          <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-5 py-4 text-rose-200">
            {parametros.error}
          </div>
        )}

        <section className="mt-8 grid gap-8 xl:grid-cols-[390px_1fr]">
          <article className="h-fit rounded-3xl border border-white/10 bg-slate-900 p-7">
            <h2 className="text-xl font-black">
              Crear usuario
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Desde este módulo se crean las
              cuentas administrativas,
              directivas, de coordinación,
              gerencia y cliente que
              correspondan a las facultades
              del usuario actual.
            </p>

            <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4">
              <p className="text-sm font-black text-amber-300">
                Alta de Inspectores
              </p>

              <p className="mt-2 text-sm leading-6 text-amber-100/80">
                Los Inspectores no deben
                crearse como una cuenta
                genérica. Su alta requiere
                perfil operativo, zona,
                Coordinador, Gerencia y
                datos profesionales.
              </p>

              <p className="mt-2 text-sm leading-6 text-amber-100/80">
                Dirección y Administración
                deben realizar el alta desde
                el módulo de Inspectores.
              </p>

              <Link
                href="/panel/inspectores"
                className="mt-4 inline-flex rounded-full bg-amber-300 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:bg-amber-200"
              >
                Crear Inspector
              </Link>
            </div>

            {!esDirector && (
              <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4 text-sm leading-6 text-cyan-100">
                Administración puede crear
                Gerentes, Coordinadores y
                Clientes desde este módulo.
                Los Inspectores se crean
                desde el módulo de
                Inspectores. Solo Dirección
                puede crear Administradores
                o Directores.
              </div>
            )}

            {esDirector && (
              <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4 text-sm leading-6 text-cyan-100">
                Dirección puede crear
                Directores, Administradores,
                Gerentes, Coordinadores y
                Clientes desde este módulo.
                Los Inspectores se crean
                desde el módulo de
                Inspectores.
              </div>
            )}

            <FormularioCrearUsuario
              rolesCreables={
                rolesCreables
              }
              zonas={zonas}
              gerentes={gerentes}
            />
          </article>

          <section>
            <form className="grid gap-4 rounded-3xl border border-white/10 bg-slate-900 p-5 md:grid-cols-[1fr_240px_auto]">
              <input
                type="search"
                name="q"
                defaultValue={
                  busqueda
                }
                placeholder="Buscar por nombre o correo..."
                className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
              />

              <select
                name="rol"
                defaultValue={
                  rolFiltro
                }
                className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
              >
                <option value="">
                  Todos los roles
                </option>

                <option value="DIRECTOR">
                  Directores
                </option>

                <option value="ADMINISTRADOR">
                  Administradores
                </option>

                <option value="GERENTE">
                  Gerentes
                </option>

                <option value="COORDINADOR">
                  Coordinadores
                </option>

                <option value="INSPECTOR">
                  Inspectores
                </option>

                <option value="CLIENTE">
                  Clientes
                </option>
              </select>

              <button
                type="submit"
                className="rounded-full bg-cyan-400 px-6 py-3 font-black text-slate-950"
              >
                Filtrar
              </button>
            </form>

            <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
              <header className="flex items-center justify-between border-b border-white/10 p-6">
                <div>
                  <h2 className="text-xl font-black">
                    Cuentas registradas
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {usuarios.length}{" "}
                    resultado(s)
                  </p>
                </div>
              </header>

              {usuarios.length ===
              0 ? (
                <p className="p-10 text-center text-slate-500">
                  No se encontraron
                  usuarios.
                </p>
              ) : (
                <div className="divide-y divide-white/10">
                  {usuarios.map(
                    (usuario) => {
                      const modificable =
                        puedeModificar(
                          usuario,
                        );

                      const esCuentaActual =
                        usuario.id ===
                        administrador.id;

                      return (
                        <article
                          key={
                            usuario.id
                          }
                          className="p-6"
                        >
                          <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-start">
                            <div>
                              <div className="flex flex-wrap items-center gap-3">
                                <h3 className="font-black">
                                  {
                                    usuario.nombre
                                  }
                                </h3>

                                <Rol
                                  rol={
                                    usuario.rol
                                  }
                                />

                                <Estado
                                  activo={
                                    usuario.activo
                                  }
                                />

                                {esCuentaActual && (
                                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white">
                                    TU CUENTA
                                  </span>
                                )}

                                {!esDirector &&
                                  (usuario.rol ===
                                    RolUsuario.DIRECTOR ||
                                    usuario.rol ===
                                      RolUsuario.ADMINISTRADOR) && (
                                    <span className="rounded-full bg-rose-400/10 px-3 py-1 text-xs font-black text-rose-300">
                                      PROTEGIDA
                                    </span>
                                  )}
                              </div>

                              <p className="mt-2 text-sm text-slate-400">
                                {
                                  usuario.email
                                }
                              </p>

                              <InformacionOrganizacional
                                rol={
                                  usuario.rol
                                }
                                zona={
                                  usuario.zona
                                }
                                gerente={
                                  usuario.gerente
                                }
                              />

                              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
                                <span>
                                  Creado:{" "}
                                  {usuario.creadoEn.toLocaleDateString(
                                    "es-MX",
                                  )}
                                </span>

                                <span>
                                  Último acceso:{" "}
                                  {usuario.ultimoAcceso
                                    ? usuario.ultimoAcceso.toLocaleString(
                                        "es-MX",
                                      )
                                    : "Nunca"}
                                </span>

                                {usuario.cliente && (
                                  <span className="text-cyan-300">
                                    Perfil de
                                    cliente
                                    vinculado
                                  </span>
                                )}

                                {usuario.inspector && (
                                  <span className="text-amber-300">
                                    Perfil de
                                    Inspector
                                    vinculado
                                  </span>
                                )}
                              </div>

                              {usuario.rol ===
                                RolUsuario.INSPECTOR && (
                                <div className="mt-4">
                                  <Link
                                    href="/panel/inspectores"
                                    className="text-sm font-bold text-amber-300 transition hover:text-amber-200"
                                  >
                                    Administrar
                                    perfil de
                                    Inspector →
                                  </Link>
                                </div>
                              )}
                            </div>

                            {modificable && (
                              <form
                                action={
                                  cambiarEstadoUsuario
                                }
                              >
                                <input
                                  type="hidden"
                                  name="usuarioId"
                                  value={
                                    usuario.id
                                  }
                                />

                                <input
                                  type="hidden"
                                  name="activo"
                                  value={
                                    usuario.activo
                                      ? "false"
                                      : "true"
                                  }
                                />

                                <button
                                  type="submit"
                                  className={
                                    usuario.activo
                                      ? "rounded-full border border-rose-400/30 px-4 py-2 text-sm font-black text-rose-300 transition hover:bg-rose-400/10"
                                      : "rounded-full border border-emerald-400/30 px-4 py-2 text-sm font-black text-emerald-300 transition hover:bg-emerald-400/10"
                                  }
                                >
                                  {usuario.activo
                                    ? "Desactivar"
                                    : "Activar"}
                                </button>
                              </form>
                            )}
                          </div>

                          {modificable ? (
                            <details className="mt-5 rounded-2xl bg-slate-950">
                              <summary className="cursor-pointer px-5 py-4 text-sm font-black text-cyan-300">
                                Cambiar
                                contraseña
                              </summary>

                              <form
                                action={
                                  cambiarPasswordUsuario
                                }
                                className="flex flex-col gap-3 border-t border-white/10 p-5 sm:flex-row"
                              >
                                <input
                                  type="hidden"
                                  name="usuarioId"
                                  value={
                                    usuario.id
                                  }
                                />

                                <PasswordField
                                  name="password"
                                  label=""
                                  autoComplete="new-password"
                                  minLength={
                                    8
                                  }
                                  placeholder="Nueva contraseña"
                                  wrapperClassName="min-w-0 flex-1"
                                  inputClassName="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 pr-24 outline-none focus:border-cyan-300"
                                />

                                <button
                                  type="submit"
                                  className="rounded-full border border-cyan-300/30 px-5 py-3 text-sm font-black text-cyan-300 transition hover:bg-cyan-300/10"
                                >
                                  Actualizar
                                </button>
                              </form>
                            </details>
                          ) : (
                            <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950 px-5 py-4 text-sm text-slate-500">
                              {esCuentaActual
                                ? "Tu propia cuenta no puede desactivarse desde este módulo."
                                : "Esta cuenta está protegida y no puede ser modificada por Administración."}
                            </div>
                          )}
                        </article>
                      );
                    },
                  )}
                </div>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function InformacionOrganizacional({
  rol,
  zona,
  gerente,
}: {
  rol: RolUsuario;
  zona: {
    id: string;
    nombre: string;
  } | null;
  gerente: {
    id: string;
    nombre: string;
    email: string;
    zonaId: string | null;
  } | null;
}) {
  if (
    rol === RolUsuario.DIRECTOR
  ) {
    return (
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-rose-300/20 bg-rose-300/5 px-3 py-1 text-rose-200">
          Alcance global
        </span>
      </div>
    );
  }

  if (
    rol ===
    RolUsuario.ADMINISTRADOR
  ) {
    return (
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {zona ? (
          <>
            <span className="rounded-full border border-violet-300/20 bg-violet-300/5 px-3 py-1 text-violet-200">
              Alcance por zona
            </span>

            <span className="rounded-full border border-white/10 bg-slate-950 px-3 py-1 text-slate-300">
              Zona: {zona.nombre}
            </span>
          </>
        ) : (
          <span className="rounded-full border border-violet-300/20 bg-violet-300/5 px-3 py-1 text-violet-200">
            Alcance global
          </span>
        )}
      </div>
    );
  }

  if (
    rol ===
      RolUsuario.GERENTE ||
    rol ===
      RolUsuario.COORDINADOR ||
    rol ===
      RolUsuario.INSPECTOR
  ) {
    return (
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span
          className={
            zona
              ? "rounded-full border border-white/10 bg-slate-950 px-3 py-1 text-slate-300"
              : "rounded-full border border-amber-300/20 bg-amber-300/5 px-3 py-1 text-amber-300"
          }
        >
          {zona
            ? `Zona: ${zona.nombre}`
            : "Zona sin asignar"}
        </span>

        {rol ===
          RolUsuario.COORDINADOR && (
          <span
            className={
              gerente
                ? "rounded-full border border-indigo-300/20 bg-indigo-300/5 px-3 py-1 text-indigo-200"
                : "rounded-full border border-amber-300/20 bg-amber-300/5 px-3 py-1 text-amber-300"
            }
          >
            {gerente
              ? `Gerente: ${gerente.nombre}`
              : "Gerente sin asignar"}
          </span>
        )}
      </div>
    );
  }

  return null;
}

function Rol({
  rol,
}: {
  rol: string;
}) {
  const estilos: Record<
    string,
    string
  > = {
    DIRECTOR:
      "bg-rose-400/10 text-rose-300",
    ADMINISTRADOR:
      "bg-violet-400/10 text-violet-300",
    GERENTE:
      "bg-emerald-400/10 text-emerald-300",
    COORDINADOR:
      "bg-indigo-400/10 text-indigo-300",
    INSPECTOR:
      "bg-amber-400/10 text-amber-300",
    CLIENTE:
      "bg-cyan-400/10 text-cyan-300",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-black ${
        estilos[rol] ??
        "bg-white/10 text-slate-300"
      }`}
    >
      {rol}
    </span>
  );
}

function Estado({
  activo,
}: {
  activo: boolean;
}) {
  return (
    <span
      className={
        activo
          ? "rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-300"
          : "rounded-full bg-rose-400/10 px-3 py-1 text-xs font-black text-rose-300"
      }
    >
      {activo
        ? "ACTIVO"
        : "INACTIVO"}
    </span>
  );
}