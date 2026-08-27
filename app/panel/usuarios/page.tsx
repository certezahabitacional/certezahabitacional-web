import Link from "next/link";
import { RolUsuario } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obtenerAdministradorActual } from "@/lib/administrador-actual";
import {
  puedeAdministrarUsuario,
  puedeCrearUsuario,
} from "@/lib/permisos";
import PasswordField from "@/components/forms/PasswordField";
import {
  cambiarEstadoUsuario,
  cambiarPasswordUsuario,
  crearUsuario,
} from "./actions";

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
  const administrador = await obtenerAdministradorActual();
  const parametros = await searchParams;

  const busqueda = parametros.q?.trim() ?? "";
  const rolFiltro = parametros.rol?.trim() ?? "";

  const rolValido = Object.values(RolUsuario).includes(
    rolFiltro as RolUsuario,
  )
    ? (rolFiltro as RolUsuario)
    : undefined;

  const esDirector = administrador.rol === RolUsuario.DIRECTOR;
  const esAdministrador =
    administrador.rol === RolUsuario.ADMINISTRADOR;

  if (!esDirector && !esAdministrador) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-xl rounded-3xl border border-rose-400/20 bg-rose-400/5 p-8 text-center">
          <h1 className="text-2xl font-black text-rose-300">
            Acceso restringido
          </h1>
          <p className="mt-3 text-slate-300">
            Solo Dirección y Administración pueden gestionar usuarios.
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

  const usuarios = await prisma.usuario.findMany({
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
    include: {
      cliente: {
        select: {
          id: true,
        },
      },
      inspector: {
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      creadoEn: "desc",
    },
  });

  const rolesDisponibles = [
    RolUsuario.DIRECTOR,
    RolUsuario.ADMINISTRADOR,
    RolUsuario.GERENTE,
    RolUsuario.COORDINADOR,
    RolUsuario.CLIENTE,
  ];

  const rolesCreables =
    rolesDisponibles.filter(
      (rol) =>
        puedeCrearUsuario(
          administrador.rol,
          rol,
        ),
    );

  function puedeModificar(usuario: {
    id: string;
    rol: RolUsuario;
  }) {
    if (usuario.id === administrador.id) return false;

    return puedeAdministrarUsuario(
      administrador.rol,
      usuario.rol,
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
              {esDirector ? "Dirección" : "Administración"}
            </p>

            <h1 className="mt-2 text-4xl font-black">
              Usuarios
            </h1>

            <p className="mt-2 text-slate-400">
              Crea cuentas, asigna roles, restablece contraseñas y controla
              el acceso a la plataforma.
            </p>

            <p className="mt-2 text-sm text-slate-600">
              Usuario actual:{" "}
              <strong className="text-slate-300">
                {administrador.nombre}
              </strong>
            </p>
          </div>

          <Link
            href="/panel"
            className="rounded-full border border-white/10 px-5 py-3 text-sm font-bold transition hover:border-cyan-300 hover:text-cyan-300"
          >
            Volver al panel
          </Link>
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
              El perfil de Cliente se crea automáticamente al seleccionar ese rol.
              Los Inspectores deben darse de alta desde el módulo de Inspectores.
            </p>

            {!esDirector && (
              <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-6 text-amber-100">
                Administración puede crear Gerentes, Coordinadores y Clientes.
                Solo Dirección puede crear Administradores o Directores.
                Los Inspectores se crean desde el módulo de Inspectores.
              </div>
            )}

            <Link
              href="/panel/inspectores"
              className="mt-5 inline-flex rounded-full border border-cyan-300/30 px-4 py-2 text-sm font-black text-cyan-300 transition hover:bg-cyan-300/10"
            >
              Ir al módulo de Inspectores
            </Link>

            <form
              action={crearUsuario}
              className="mt-7 space-y-5"
            >
              <Campo
                nombre="nombre"
                etiqueta="Nombre completo"
                tipo="text"
                autocompletar="name"
              />

              <Campo
                nombre="email"
                etiqueta="Correo electrónico"
                tipo="email"
                autocompletar="email"
              />

              <PasswordField
                name="password"
                label="Contraseña inicial"
                autoComplete="new-password"
                minLength={8}
                inputClassName="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 pr-24 outline-none focus:border-cyan-300"
              />

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-300">
                  Rol
                </span>

                <select
                  name="rol"
                  required
                  defaultValue=""
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
                >
                  <option value="" disabled>
                    Selecciona un rol
                  </option>

                  {rolesCreables.map((rol) => (
                    <option key={rol} value={rol}>
                      {etiquetaRol(rol)}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                className="w-full rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950 transition hover:bg-cyan-300"
              >
                Crear usuario
              </button>
            </form>
          </article>

          <section>
            <form className="grid gap-4 rounded-3xl border border-white/10 bg-slate-900 p-5 md:grid-cols-[1fr_240px_auto]">
              <input
                type="search"
                name="q"
                defaultValue={busqueda}
                placeholder="Buscar por nombre o correo..."
                className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
              />

              <select
                name="rol"
                defaultValue={rolFiltro}
                className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
              >
                <option value="">Todos los roles</option>
                <option value="DIRECTOR">Directores</option>
                <option value="ADMINISTRADOR">Administradores</option>
                <option value="GERENTE">Gerentes</option>
                <option value="COORDINADOR">Coordinadores</option>
                <option value="INSPECTOR">Inspectores</option>
                <option value="CLIENTE">Clientes</option>
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
                    {usuarios.length} resultado(s)
                  </p>
                </div>
              </header>

              {usuarios.length === 0 ? (
                <p className="p-10 text-center text-slate-500">
                  No se encontraron usuarios.
                </p>
              ) : (
                <div className="divide-y divide-white/10">
                  {usuarios.map((usuario) => {
                    const modificable = puedeModificar(usuario);
                    const esCuentaActual = usuario.id === administrador.id;

                    return (
                      <article
                        key={usuario.id}
                        className="p-6"
                      >
                        <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-start">
                          <div>
                            <div className="flex flex-wrap items-center gap-3">
                              <h3 className="font-black">
                                {usuario.nombre}
                              </h3>

                              <Rol rol={usuario.rol} />
                              <Estado activo={usuario.activo} />

                              {esCuentaActual && (
                                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white">
                                  TU CUENTA
                                </span>
                              )}

                              {!esDirector &&
                                (
                                  usuario.rol === RolUsuario.DIRECTOR ||
                                  usuario.rol === RolUsuario.ADMINISTRADOR
                                ) && (
                                  <span className="rounded-full bg-rose-400/10 px-3 py-1 text-xs font-black text-rose-300">
                                    PROTEGIDA
                                  </span>
                                )}
                            </div>

                            <p className="mt-2 text-sm text-slate-400">
                              {usuario.email}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
                              <span>
                                Creado:{" "}
                                {usuario.creadoEn.toLocaleDateString("es-MX")}
                              </span>

                              <span>
                                Último acceso:{" "}
                                {usuario.ultimoAcceso
                                  ? usuario.ultimoAcceso.toLocaleString("es-MX")
                                  : "Nunca"}
                              </span>

                              {usuario.cliente && (
                                <span className="text-cyan-300">
                                  Perfil de cliente vinculado
                                </span>
                              )}

                              {usuario.inspector && (
                                <span className="text-cyan-300">
                                  Perfil de inspector vinculado
                                </span>
                              )}
                            </div>
                          </div>

                          {modificable && (
                            <form action={cambiarEstadoUsuario}>
                              <input
                                type="hidden"
                                name="usuarioId"
                                value={usuario.id}
                              />

                              <input
                                type="hidden"
                                name="activo"
                                value={usuario.activo ? "false" : "true"}
                              />

                              <button
                                type="submit"
                                className={
                                  usuario.activo
                                    ? "rounded-full border border-rose-400/30 px-4 py-2 text-sm font-black text-rose-300 transition hover:bg-rose-400/10"
                                    : "rounded-full border border-emerald-400/30 px-4 py-2 text-sm font-black text-emerald-300 transition hover:bg-emerald-400/10"
                                }
                              >
                                {usuario.activo ? "Desactivar" : "Activar"}
                              </button>
                            </form>
                          )}
                        </div>

                        {modificable ? (
                          <details className="mt-5 rounded-2xl bg-slate-950">
                            <summary className="cursor-pointer px-5 py-4 text-sm font-black text-cyan-300">
                              Cambiar contraseña
                            </summary>

                            <form
                              action={cambiarPasswordUsuario}
                              className="flex flex-col gap-3 border-t border-white/10 p-5 sm:flex-row"
                            >
                              <input
                                type="hidden"
                                name="usuarioId"
                                value={usuario.id}
                              />

                              <PasswordField
                                name="password"
                                label=""
                                autoComplete="new-password"
                                minLength={8}
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
                  })}
                </div>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function etiquetaRol(rol: RolUsuario) {
  switch (rol) {
    case RolUsuario.DIRECTOR:
      return "Director";
    case RolUsuario.ADMINISTRADOR:
      return "Administrador";
    case RolUsuario.GERENTE:
      return "Gerente";
    case RolUsuario.COORDINADOR:
      return "Coordinador";
    case RolUsuario.INSPECTOR:
      return "Inspector";
    case RolUsuario.CLIENTE:
      return "Cliente";
    default:
      return rol;
  }
}

function Campo({
  nombre,
  etiqueta,
  tipo,
  autocompletar,
  minimo,
}: {
  nombre: string;
  etiqueta: string;
  tipo: string;
  autocompletar: string;
  minimo?: number;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-300">
        {etiqueta}
      </span>

      <input
        type={tipo}
        name={nombre}
        required
        minLength={minimo}
        autoComplete={autocompletar}
        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
      />
    </label>
  );
}

function Rol({ rol }: { rol: string }) {
  const estilos: Record<string, string> = {
    DIRECTOR: "bg-rose-400/10 text-rose-300",
    ADMINISTRADOR: "bg-violet-400/10 text-violet-300",
    GERENTE: "bg-emerald-400/10 text-emerald-300",
    COORDINADOR: "bg-indigo-400/10 text-indigo-300",
    INSPECTOR: "bg-amber-400/10 text-amber-300",
    CLIENTE: "bg-cyan-400/10 text-cyan-300",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-black ${
        estilos[rol] ?? "bg-white/10 text-slate-300"
      }`}
    >
      {rol}
    </span>
  );
}

function Estado({ activo }: { activo: boolean }) {
  return (
    <span
      className={
        activo
          ? "rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-300"
          : "rounded-full bg-rose-400/10 px-3 py-1 text-xs font-black text-rose-300"
      }
    >
      {activo ? "ACTIVO" : "INACTIVO"}
    </span>
  );
}