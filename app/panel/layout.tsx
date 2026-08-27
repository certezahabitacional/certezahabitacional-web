import type { ReactNode } from "react";

import { RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import PlatformHeader from "@/components/branding/PlatformHeader";
import { prisma } from "@/lib/prisma";

export default async function PanelLayout({
  children,
}: {
  children: ReactNode;
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
   * CLIENTE
   *
   * El Cliente utiliza exclusivamente
   * su portal.
   */
  if (
    usuarioActual.rol ===
    RolUsuario.CLIENTE
  ) {
    redirect("/portal");
  }

  /*
   * Acceso general al árbol /panel.
   *
   * IMPORTANTE:
   * INSPECTOR necesita entrar aquí porque
   * sus expedientes técnicos viven bajo:
   *
   * /panel/inspecciones/[id]
   * /panel/inspecciones/[id]/captura
   * /panel/inspecciones/[id]/evidencias
   * /panel/inspecciones/[id]/firmas
   * /panel/inspecciones/[id]/reporte
   * /panel/inspecciones/[id]/certificado
   *
   * Cada módulo debe aplicar además
   * su propia validación de rol y alcance.
   */
  const accesoPanel =
    usuarioActual.rol ===
      RolUsuario.DIRECTOR ||
    usuarioActual.rol ===
      RolUsuario.ADMINISTRADOR ||
    usuarioActual.rol ===
      RolUsuario.GERENTE ||
    usuarioActual.rol ===
      RolUsuario.COORDINADOR ||
    usuarioActual.rol ===
      RolUsuario.INSPECTOR;

  if (!accesoPanel) {
    redirect("/acceso");
  }

  const nombreUsuario =
    usuarioActual.nombre?.trim() ||
    usuarioActual.email ||
    "Usuario";

  const area =
    usuarioActual.rol ===
    RolUsuario.DIRECTOR
      ? "Dirección"
      : usuarioActual.rol ===
          RolUsuario.ADMINISTRADOR
        ? "Administración"
        : usuarioActual.rol ===
            RolUsuario.GERENTE
          ? "Gerencia"
          : usuarioActual.rol ===
              RolUsuario.COORDINADOR
            ? "Coordinación"
            : "Portal del Inspector";

  const subtitle =
    usuarioActual.rol ===
    RolUsuario.DIRECTOR
      ? `Sesión iniciada como ${nombreUsuario} · Control ejecutivo, auditoría y liberación`
      : usuarioActual.rol ===
          RolUsuario.ADMINISTRADOR
        ? `Sesión iniciada como ${nombreUsuario} · Operación administrativa y comercial`
        : usuarioActual.rol ===
            RolUsuario.GERENTE
          ? `Sesión iniciada como ${nombreUsuario} · Control operativo, asignación y aprobación`
          : usuarioActual.rol ===
              RolUsuario.COORDINADOR
            ? `Sesión iniciada como ${nombreUsuario} · Revisión técnica y seguimiento de Inspectores`
            : `Sesión iniciada como ${nombreUsuario} · Captura y seguimiento de tus inspecciones asignadas`;

  const logout = (
    <form
      action={async () => {
        "use server";

        await signOut({
          redirectTo: "/login",
        });
      }}
    >
      <button
        type="submit"
        className="rounded-full border border-amber-300/40 px-5 py-3 font-black text-amber-200 transition hover:bg-amber-300/10"
      >
        Cerrar sesión
      </button>
    </form>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PlatformHeader
        area={area}
        subtitle={subtitle}
        actions={logout}
      />

      {children}
    </div>
  );
}