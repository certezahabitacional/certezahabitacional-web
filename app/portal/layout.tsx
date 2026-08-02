import Link from "next/link";
import { signOut } from "@/auth";
import { obtenerClienteActual } from "@/lib/cliente-actual";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cliente = await obtenerClienteActual();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-900">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-6 py-5 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
              Certeza Habitacional
            </p>

            <p className="mt-1 text-lg font-black">
              Portal del cliente
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-3">
            <Link
              href="/portal"
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold hover:border-cyan-300 hover:text-cyan-300"
            >
              Inicio
            </Link>

            <Link
              href="/portal/inspecciones"
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold hover:border-cyan-300 hover:text-cyan-300"
            >
              Inspecciones
            </Link>

            <Link
              href="/portal/inmuebles"
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold hover:border-cyan-300 hover:text-cyan-300"
            >
              Inmuebles
            </Link>

            <Link
              href="/portal/perfil"
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold hover:border-cyan-300 hover:text-cyan-300"
            >
              Perfil
            </Link>

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
                className="rounded-full bg-rose-400 px-4 py-2 text-sm font-black text-slate-950"
              >
                Cerrar sesión
              </button>
            </form>
          </nav>
        </div>

        <div className="mx-auto max-w-7xl px-6 pb-4 text-sm text-slate-400">
          Sesión iniciada como{" "}
          <strong className="text-white">
            {cliente.nombre}
          </strong>
        </div>
      </header>

      {children}
    </div>
  );
}