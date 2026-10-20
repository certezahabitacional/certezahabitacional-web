import Link from "next/link";
import { RolUsuario } from "@prisma/client";
import { obtenerUsuarioConAlcanceZona } from "@/lib/alcance-zona";

export default async function CotizacionesLayout({ children }: { children: React.ReactNode }) {
  if (process.env.CH_VISITAS_CONTRATADAS !== "1") return <>{children}</>;
  const usuario = await obtenerUsuarioConAlcanceZona("/panel/cotizaciones");
  const gestiona = usuario.rol === RolUsuario.DIRECTOR || usuario.rol === RolUsuario.ADMINISTRADOR;
  return <>{gestiona && <nav aria-label="Visitas de cotizaciones" className="flex flex-wrap gap-4 border-b border-white/10 bg-slate-950 px-6 py-3 text-sm text-cyan-300"><Link href="/panel/cotizaciones">Cotizaciones</Link><Link href="/panel/cotizaciones/visitas" className="font-black">Habilitar V2 y visitas posteriores</Link></nav>}{children}</>;
}
