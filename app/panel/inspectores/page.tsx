import Link from "next/link";
import { RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import PasswordField from "@/components/forms/PasswordField";
import {
  puedeActivarDesactivarUsuario,
  puedeCrearUsuario,
} from "@/lib/permisos";
import { prisma } from "@/lib/prisma";

import {
  alternarInspector,
  crearInspector,
} from "./actions";

export default async function InspectoresPage({
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

  const usuarioActual = await prisma.usuario.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      rol: true,
      activo: true,
      zonaId: true,
    },
  });

  if (!usuarioActual || !usuarioActual.activo) {
    redirect("/acceso");
  }

  const rol = usuarioActual.rol;

  const puedeAdministrarInspectores =
    (rol === RolUsuario.DIRECTOR ||
      rol === RolUsuario.ADMINISTRADOR) &&
    puedeCrearUsuario(
      rol,
      RolUsuario.INSPECTOR,
    ) &&
    puedeActivarDesactivarUsuario(
      rol,
      RolUsuario.INSPECTOR,
    );

  const puedeConsultarInspectores =
    puedeAdministrarInspectores ||
    rol === RolUsuario.GERENTE ||
    rol === RolUsuario.COORDINADOR;

  if (!puedeConsultarInspectores) {
    redirect("/acceso");
  }

  const params = await searchParams;

  /*
   * Alcance del directorio:
   *
   * DIRECTOR / ADMINISTRADOR:
   *   plantilla completa.
   *
   * GERENTE:
   *   Inspectores adscritos a su Gerencia.
   *
   * COORDINADOR:
   *   Inspectores bajo su coordinación.
   */
  const whereInspector =
    rol === RolUsuario.GERENTE
      ? {
          usuario: {
            gerenteId:
              usuarioActual.id,
          },
        }
      : rol === RolUsuario.COORDINADOR
        ? {
            usuario: {
              coordinadorId:
                usuarioActual.id,
            },
          }
        : {};

  const [
    inspectores,
    zonas,
    coordinadores,
  ] = await Promise.all([
    prisma.inspector.findMany({
      where: whereInspector,
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            email: true,
            activo: true,
            zona: {
              select: {
                id: true,
                nombre: true,
                codigo: true,
              },
            },
            coordinador: {
              select: {
                id: true,
                nombre: true,
                email: true,
              },
            },
            gerente: {
              select: {
                id: true,
                nombre: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            inspecciones: true,
          },
        },
      },
      orderBy: {
        creadoEn: "desc",
      },
    }),

    puedeAdministrarInspectores
      ? prisma.zona.findMany({
          where: {
            activa: true,
          },
          orderBy: {
            nombre: "asc",
          },
          select: {
            id: true,
            nombre: true,
            codigo: true,
          },
        })
      : Promise.resolve([]),

    puedeAdministrarInspectores
      ? prisma.usuario.findMany({
          where: {
            rol: RolUsuario.COORDINADOR,
            activo: true,
          },
          orderBy: {
            nombre: "asc",
          },
          select: {
            id: true,
            nombre: true,
            email: true,
            zonaId: true,
            gerenteId: true,
            zona: {
              select: {
                nombre: true,
                codigo: true,
              },
            },
            gerente: {
              select: {
                id: true,
                nombre: true,
                email: true,
              },
            },
          },
        })
      : Promise.resolve([]),
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

        <div className="mt-2 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-3xl font-black">
              Inspectores
            </h1>

            <p className="mt-1 text-slate-400">
              Consulta de inspectores, adscripción
              organizacional y carga de trabajo.
            </p>
          </div>

          {rol === RolUsuario.GERENTE && (
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-300">
              Inspectores de tu Gerencia
            </span>
          )}

          {rol === RolUsuario.COORDINADOR && (
            <span className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-4 py-2 text-sm font-bold text-indigo-300">
              Inspectores bajo tu coordinación
            </span>
          )}
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

        <div
          className={`mt-8 grid gap-8 ${
            puedeAdministrarInspectores
              ? "xl:grid-cols-[380px_1fr]"
              : "xl:grid-cols-1"
          }`}
        >
          {puedeAdministrarInspectores && (
            <section className="h-fit rounded-3xl border border-white/10 bg-slate-900 p-6">
              <h2 className="text-2xl font-black">
                Nuevo inspector
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Dirección y Administración pueden
                generar el acceso y adscribir al
                Inspector a una zona y Coordinador.
              </p>

              <form
                action={crearInspector}
                className="mt-6 space-y-4"
              >
                <Campo
                  name="nombre"
                  label="Nombre completo *"
                />

                <Campo
                  name="email"
                  label="Correo de acceso *"
                  type="email"
                />

                <PasswordField
                  name="password"
                  label="Contraseña temporal *"
                  autoComplete="new-password"
                  minLength={8}
                  inputClassName="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 pr-24 outline-none focus:border-cyan-300"
                />

                <Campo
                  name="telefono"
                  label="Teléfono"
                />

                <Campo
                  name="especialidad"
                  label="Especialidad"
                />

                <Campo
                  name="cedula"
                  label="Cédula"
                />

                <Campo
                  name="ciudad"
                  label="Ciudad"
                />

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-300">
                    Zona *
                  </span>

                  <select
                    name="zonaId"
                    required
                    defaultValue=""
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
                  >
                    <option
                      value=""
                      disabled
                    >
                      Selecciona una zona
                    </option>

                    {zonas.map((zona) => (
                      <option
                        key={zona.id}
                        value={zona.id}
                      >
                        {zona.nombre} · {zona.codigo}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-300">
                    Coordinador *
                  </span>

                  <select
                    name="coordinadorId"
                    required
                    defaultValue=""
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
                  >
                    <option
                      value=""
                      disabled
                    >
                      Selecciona un Coordinador
                    </option>

                    {coordinadores.map(
                      (coordinador) => (
                        <option
                          key={coordinador.id}
                          value={coordinador.id}
                        >
                          {coordinador.nombre}
                          {coordinador.zona
                            ? ` · ${coordinador.zona.nombre}`
                            : ""}
                          {coordinador.gerente
                            ? ` · Gerencia: ${coordinador.gerente.nombre}`
                            : ""}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <button className="w-full rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950">
                  Crear acceso
                </button>
              </form>
            </section>
          )}

          <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
            <div className="border-b border-white/10 p-6">
              <h2 className="text-xl font-black">
                Plantilla de inspectores
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Estado, zona, Coordinador, Gerencia y
                carga acumulada de inspecciones.
              </p>
            </div>

            {inspectores.length === 0 ? (
              <p className="p-12 text-center text-slate-400">
                No hay inspectores registrados dentro
                de tu alcance.
              </p>
            ) : (
              <div className="divide-y divide-white/10">
                {inspectores.map((inspector) => (
                  <article
                    key={inspector.id}
                    className="grid gap-4 p-6 lg:grid-cols-[1.1fr_1fr_1fr_auto] lg:items-center"
                  >
                    <div>
                      <p className="text-lg font-black text-cyan-300">
                        {inspector.usuario.nombre}
                      </p>

                      <p className="mt-1 text-sm text-slate-400">
                        {inspector.usuario.email}
                      </p>

                      <p className="text-sm text-slate-500">
                        {inspector.telefono ??
                          "Sin teléfono"}
                      </p>
                    </div>

                    <div>
                      <p className="font-bold">
                        {inspector.especialidad ??
                          "Inspector general"}
                      </p>

                      <p className="mt-1 text-sm text-slate-400">
                        {inspector.ciudad ??
                          inspector.usuario.zona
                            ?.nombre ??
                          "Sin ciudad"}
                      </p>

                      <p className="mt-1 text-sm text-emerald-300">
                        {
                          inspector._count
                            .inspecciones
                        }{" "}
                        inspección(es)
                      </p>
                    </div>

                    <div className="text-sm">
                      <p className="font-bold text-slate-300">
                        {inspector.usuario.zona
                          ? `${inspector.usuario.zona.nombre} · ${inspector.usuario.zona.codigo}`
                          : "Sin zona"}
                      </p>

                      <p className="mt-1 text-slate-400">
                        Coordinador:{" "}
                        {inspector.usuario
                          .coordinador?.nombre ??
                          "Sin asignar"}
                      </p>

                      <p className="mt-1 text-slate-500">
                        Gerencia:{" "}
                        {inspector.usuario
                          .gerente?.nombre ??
                          "Sin asignar"}
                      </p>
                    </div>

                    {puedeAdministrarInspectores ? (
                      <form
                        action={alternarInspector}
                      >
                        <input
                          type="hidden"
                          name="id"
                          value={inspector.id}
                        />

                        <button
                          className={`rounded-full px-4 py-2 text-sm font-black ${
                            inspector.activo
                              ? "bg-emerald-400/10 text-emerald-300"
                              : "bg-slate-700 text-slate-300"
                          }`}
                        >
                          {inspector.activo
                            ? "Activo"
                            : "Inactivo"}
                        </button>
                      </form>
                    ) : (
                      <span
                        className={`rounded-full px-4 py-2 text-center text-sm font-black ${
                          inspector.activo
                            ? "bg-emerald-400/10 text-emerald-300"
                            : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {inspector.activo
                          ? "Activo"
                          : "Inactivo"}
                      </span>
                    )}
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
