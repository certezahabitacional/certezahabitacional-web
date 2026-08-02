import Link from "next/link";
import { auth } from "@/auth";

export default async function ConfiguracionPage() {
  const session = await auth();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-5xl">
        <Link href="/panel" className="text-sm font-bold text-cyan-300 hover:text-cyan-200">
          ← Regresar al panel
        </Link>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-8">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
            Infraestructura Sprint 7
          </p>
          <h1 className="mt-3 text-4xl font-black">Nube y seguridad</h1>
          <p className="mt-3 max-w-2xl text-slate-300">
            Sesión activa para {session?.user?.name ?? session?.user?.email}. Rol: {session?.user?.role ?? "sin asignar"}.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ["Autenticación", "Activa", "Auth.js con sesión JWT"],
              ["Base de datos", "Configurable", "PostgreSQL mediante Prisma"],
              ["Rutas privadas", "Activas", "Protección del área /panel"],
            ].map(([titulo, estado, detalle]) => (
              <article key={titulo} className="rounded-2xl border border-white/10 bg-slate-900 p-5">
                <p className="text-sm font-bold text-slate-400">{titulo}</p>
                <p className="mt-2 text-xl font-black text-emerald-300">{estado}</p>
                <p className="mt-2 text-sm text-slate-400">{detalle}</p>
              </article>
            ))}
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
