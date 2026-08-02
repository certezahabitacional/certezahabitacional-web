import Link from "next/link";
import { signOut } from "@/auth";
import { obtenerClienteActual } from "@/lib/cliente-actual";
import PlatformHeader from "@/components/branding/PlatformHeader";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cliente = await obtenerClienteActual();

  const actions = (
    <>
      <Link href="/portal" className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold hover:border-cyan-300 hover:text-cyan-300">Inicio</Link>
      <Link href="/portal/inspecciones" className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold hover:border-cyan-300 hover:text-cyan-300">Inspecciones</Link>
      <Link href="/portal/inmuebles" className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold hover:border-cyan-300 hover:text-cyan-300">Inmuebles</Link>
      <Link href="/portal/perfil" className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold hover:border-cyan-300 hover:text-cyan-300">Perfil</Link>
      <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
        <button type="submit" className="rounded-full bg-rose-400 px-4 py-2 text-sm font-black text-slate-950">Cerrar sesión</button>
      </form>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PlatformHeader
        area="Portal del cliente"
        subtitle={`Sesión iniciada como ${cliente.nombre}`}
        homeHref="/portal"
        actions={actions}
      />
      {children}
    </div>
  );
}
