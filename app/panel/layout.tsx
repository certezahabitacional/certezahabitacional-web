import type { ReactNode } from "react";
import { signOut } from "@/auth";
import PlatformHeader from "@/components/branding/PlatformHeader";

export default function PanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const logout = (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button
        type="submit"
        className="rounded-full border border-amber-300/40 bg-amber-300/10 px-5 py-3 text-sm font-black text-amber-200 transition hover:bg-amber-300 hover:text-slate-950"
      >
        Cerrar sesión
      </button>
    </form>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PlatformHeader
        area="Administración"
        subtitle="Control, operación y trazabilidad"
        actions={logout}
      />
      {children}
    </div>
  );
}
