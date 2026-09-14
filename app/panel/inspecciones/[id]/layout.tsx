import Link from "next/link";
import { RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { obtenerUsuarioConAlcanceZona, puedeAccederZona } from "@/lib/alcance-zona";
import { prisma } from "@/lib/prisma";

export default async function InspeccionLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await obtenerUsuarioConAlcanceZona(`/panel/inspecciones/${id}`);
  if (usuario.rol === RolUsuario.CLIENTE) redirect(`/portal/inspecciones/${id}`);

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    select: {
      id: true, zonaId: true, inspectorId: true,
      inspector: { select: { usuarioId: true, usuario: { select: { gerenteId: true, coordinadorId: true, zonaId: true } } } },
    },
  });
  if (!inspeccion) notFound();
  if (!puedeAccederZona(usuario, inspeccion.zonaId)) redirect("/acceso");
  if (usuario.rol === RolUsuario.GERENTE && inspeccion.inspector?.usuario.gerenteId !== usuario.id) redirect("/acceso");
  if (usuario.rol === RolUsuario.COORDINADOR && inspeccion.inspector?.usuario.coordinadorId !== usuario.id) redirect("/acceso");
  if (usuario.rol === RolUsuario.INSPECTOR && (!usuario.inspector?.id || inspeccion.inspectorId !== usuario.inspector.id || inspeccion.inspector?.usuarioId !== usuario.id)) redirect("/acceso");

  const permitidos: RolUsuario[] = [RolUsuario.DIRECTOR,RolUsuario.ADMINISTRADOR,RolUsuario.VENDEDOR,RolUsuario.GERENTE,RolUsuario.COORDINADOR,RolUsuario.INSPECTOR];
  if (!permitidos.includes(usuario.rol)) redirect("/acceso");

  const rolesAjustes: RolUsuario[] = [RolUsuario.DIRECTOR, RolUsuario.ADMINISTRADOR, RolUsuario.INSPECTOR];
  const puedeVerAjustes = rolesAjustes.includes(usuario.rol);
  const rolesRevision: RolUsuario[] = [RolUsuario.DIRECTOR, RolUsuario.GERENTE, RolUsuario.COORDINADOR, RolUsuario.INSPECTOR];
  const puedeVerRevision = rolesRevision.includes(usuario.rol);

  const columnas = 5 + (puedeVerRevision ? 1 : 0) + (puedeVerAjustes ? 1 : 0);
  const columnasSm = columnas >= 7 ? "sm:grid-cols-7" : columnas === 6 ? "sm:grid-cols-6" : "sm:grid-cols-5";

  return <>
    {children}
    <nav className="print:hidden fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-7xl -translate-x-1/2 rounded-3xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl backdrop-blur">
      <div className={`grid grid-cols-2 gap-2 ${columnasSm}`}>
        <Link href={`/panel/inspecciones/${id}/flujo`} className="rounded-2xl bg-cyan-300 px-3 py-3 text-center text-xs font-black text-slate-950 sm:text-sm">Flujo de campo</Link>
        <Link href={`/panel/inspecciones/${id}/preparacion`} className="rounded-2xl border border-white/10 px-3 py-3 text-center text-xs font-black text-cyan-300 sm:text-sm">Guía técnica</Link>
        <Link href={`/panel/inspecciones/${id}/evidencia-control`} className="rounded-2xl border border-white/10 px-3 py-3 text-center text-xs font-black text-amber-300 sm:text-sm">Control 4 fotos</Link>
        <Link href={`/panel/inspecciones/${id}/reporte-evidencias`} className="rounded-2xl border border-white/10 px-3 py-3 text-center text-xs font-black text-violet-300 sm:text-sm">Evidencia reporte</Link>
        <Link href={`/panel/inspecciones/${id}/instrumentos`} className="rounded-2xl border border-white/10 px-3 py-3 text-center text-xs font-black text-emerald-300 sm:text-sm">Instrumentos</Link>
        {puedeVerRevision && <Link href={`/panel/inspecciones/${id}/revision`} className="rounded-2xl border border-white/10 px-3 py-3 text-center text-xs font-black text-fuchsia-300 sm:text-sm">Revisión</Link>}
        {puedeVerAjustes && <Link href={`/panel/inspecciones/${id}/ajustes`} className="rounded-2xl border border-white/10 px-3 py-3 text-center text-xs font-black text-orange-300 sm:text-sm">Ajustes</Link>}
      </div>
    </nav>
    <div className="print:hidden h-28" aria-hidden="true" />
  </>;
}
