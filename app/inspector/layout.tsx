import Link from "next/link";
import { signOut } from "@/auth";
import { obtenerInspectorActual } from "@/lib/inspector-actual";
import PlatformHeader from "@/components/branding/PlatformHeader";

export default async function InspectorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const inspector = await obtenerInspectorActual();

  const actions = (
    <>
      <Link href="/inspector" className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold transition hover:border-cyan-300 hover:text-cyan-300">Inicio</Link>
      <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
        <button type="submit" className="rounded-full bg-rose-400 px-4 py-2 text-sm font-black text-slate-950">Cerrar sesión</button>
      </form>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PlatformHeader
        area="Portal del inspector"
        subtitle={`Sesión iniciada como ${inspector.usuario.nombre}`}
        homeHref="/inspector"
        actions={actions}
      />
      {children}
    </div>
  );
}
