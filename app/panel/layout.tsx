import type { ReactNode } from "react";
import { signOut } from "@/auth";

export default function PanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {children}

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
        className="fixed bottom-6 right-6 z-50"
      >
        <button
          type="submit"
          className="rounded-full border border-white/20 bg-slate-900 px-5 py-3 font-bold text-white shadow-xl transition hover:border-cyan-300 hover:text-cyan-300"
        >
          Cerrar sesión
        </button>
      </form>
    </>
  );
}