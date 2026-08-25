import type { ReactNode } from "react";
import { signOut } from "@/auth";
import { auth } from "@/auth";
import PlatformHeader from "@/components/branding/PlatformHeader";

export default async function PanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  const rol = session?.user?.role ?? "";
  const nombreUsuario =
    session?.user?.name?.trim() || "Usuario";

  const area =
    rol === "DIRECTOR"
      ? "Dirección"
      : rol === "ADMINISTRADOR"
        ? "Administración"
        : rol === "GERENTE"
          ? "Gerencia"
          : rol === "COORDINADOR"
            ? "Coordinación"
            : rol === "SUPERVISOR"
              ? "Supervisión"
              : rol === "INSPECTOR"
                ? "Portal del inspector"
                : "Plataforma operativa";

  const subtitle =
    rol === "DIRECTOR"
      ? `Sesión iniciada como ${nombreUsuario} · Control ejecutivo, auditoría y liberación`
      : rol === "ADMINISTRADOR"
        ? `Sesión iniciada como ${nombreUsuario} · Operación administrativa y comercial`
        : rol === "GERENTE"
          ? `Sesión iniciada como ${nombreUsuario} · Aprobación y control operativo`
          : rol === "COORDINADOR"
            ? `Sesión iniciada como ${nombreUsuario} · Revisión técnica y visto bueno`
            : rol === "SUPERVISOR"
              ? `Sesión iniciada como ${nombreUsuario} · Seguimiento de campo`
              : rol === "INSPECTOR"
                ? `Sesión iniciada como ${nombreUsuario}`
                : `Sesión iniciada como ${nombreUsuario} · Control, operación y trazabilidad`;

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