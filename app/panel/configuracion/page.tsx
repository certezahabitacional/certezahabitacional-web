import Link from "next/link";
import { RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { puede } from "@/lib/permisos";
import { prisma } from "@/lib/prisma";

export default async function ConfiguracionPage() {
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
        id: true,
        nombre: true,
        email: true,
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

  /*
   * MATRIZ MAESTRA DE FACULTADES
   *
   * Configuración / infraestructura / seguridad:
   * DIRECTOR       -> acceso total
   * ADMINISTRADOR  -> sin acceso
   * GERENTE        -> sin acceso
   * COORDINADOR    -> sin acceso
   * INSPECTOR      -> sin acceso
   * CLIENTE        -> sin acceso
   *
   * Además del rol, se valida CONFIGURACION_TOTAL para mantener
   * esta pantalla alineada con lib/permisos.ts.
   */
  if (
    usuarioActual.rol !==
      RolUsuario.DIRECTOR ||
    !puede(
      usuarioActual.rol,
      "CONFIGURACION_TOTAL",
    )
  ) {
    redirect("/acceso");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-5xl">
        <Link
          href="/panel"
          className="text-sm font-bold text-cyan-300 hover:text-cyan-200"
        >
          ← Regresar al panel
        </Link>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-8">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
            Configuración del sistema
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Nube y seguridad
          </h1>

          <p className="mt-3 max-w-2xl text-slate-300">
            Sesión activa para{" "}
            {usuarioActual.nombre ||
              usuarioActual.email}
            . Rol: {usuarioActual.rol}.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              [
                "Autenticación",
                "Activa",
                "Auth.js con sesión JWT",
              ],
              [
                "Base de datos",
                "Configurable",
                "PostgreSQL mediante Prisma",
              ],
              [
                "Rutas privadas",
                "Activas",
                "Protección del área /panel",
              ],
            ].map(
              ([titulo, estado, detalle]) => (
                <article
                  key={titulo}
                  className="rounded-2xl border border-white/10 bg-slate-900 p-5"
                >
                  <p className="text-sm font-bold text-slate-400">
                    {titulo}
                  </p>

                  <p className="mt-2 text-xl font-black text-emerald-300">
                    {estado}
                  </p>

                  <p className="mt-2 text-sm text-slate-400">
                    {detalle}
                  </p>
                </article>
              ),
            )}
          </div>

          <div className="mt-8 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
            <p className="font-black text-amber-300">
              Área restringida
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-300">
              Esta sección contiene información de
              infraestructura, autenticación, seguridad y
              conectividad de la plataforma. Su acceso está
              reservado exclusivamente a Dirección.
            </p>
          </div>

          <a
            href="/api/health"
            className="mt-8 inline-flex rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950 hover:bg-cyan-300"
          >
            Revisar conexión de base de datos
          </a>
        </div>
      </section>
    </main>
  );
}
