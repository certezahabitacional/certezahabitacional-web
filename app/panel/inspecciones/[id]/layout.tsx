import Link from "next/link";
import { RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { obtenerUsuarioConAlcanceZona, puedeAccederZona } from "@/lib/alcance-zona";
import { rolAsignableDesdeUsuario, usuarioAsignadoAInspeccion } from "@/lib/asignaciones-inspeccion";
import { prisma } from "@/lib/prisma";
import RevisionCanonicaNotice from "./RevisionCanonicaNotice";

export default async function InspeccionLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await obtenerUsuarioConAlcanceZona(`/panel/inspecciones/${id}`);
  if (usuario.rol === RolUsuario.CLIENTE) redirect(`/portal/inspecciones/${id}`);

  const inspeccion = await prisma.inspeccion.findUnique({ where: { id }, select: { id: true, zonaId: true, numeroInspeccion: true } });
  if (!inspeccion) notFound();
  if (!puedeAccederZona(usuario, inspeccion.zonaId)) redirect("/acceso");

  const rolAsignable = rolAsignableDesdeUsuario(usuario.rol);
  if (rolAsignable && !(await usuarioAsignadoAInspeccion(id, usuario.id, rolAsignable))) redirect("/acceso");

  const permitidos: RolUsuario[] = [RolUsuario.DIRECTOR,RolUsuario.ADMINISTRADOR,RolUsuario.VENDEDOR,RolUsuario.GERENTE,RolUsuario.COORDINADOR,RolUsuario.INSPECTOR];
  if (!permitidos.includes(usuario.rol)) redirect("/acceso");

  const rolesAjustes: RolUsuario[] = [RolUsuario.DIRECTOR, RolUsuario.ADMINISTRADOR, RolUsuario.INSPECTOR];
  const puedeVerAjustes = rolesAjustes.includes(usuario.rol);
  const rolesRevision: RolUsuario[] = [RolUsuario.DIRECTOR, RolUsuario.GERENTE, RolUsuario.COORDINADOR, RolUsuario.INSPECTOR];
  const puedeVerRevision = rolesRevision.includes(usuario.rol);
  const esV1 = inspeccion.numeroInspeccion === 1;

  return <>
    <RevisionCanonicaNotice inspeccionId={id} visible={puedeVerRevision} />
    <div className="expediente-metodo-certeza">{children}</div>
    <nav className="print:hidden fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-[980px] -translate-x-1/2 rounded-3xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl backdrop-blur">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {!esV1 && (
          <>
            <Link href={`/panel/inspecciones/${id}/captura`} className="rounded-2xl border border-white/10 px-3 py-3 text-center text-xs font-black text-violet-300 sm:text-sm">
              Seguimiento V{inspeccion.numeroInspeccion}
            </Link>
            <Link href={`/panel/inspecciones/${id}/evidencia-control`} className="rounded-2xl border border-white/10 px-3 py-3 text-center text-xs font-black text-amber-300 sm:text-sm">
              Evidencia 4+
            </Link>
          </>
        )}
        {puedeVerRevision ? (
          <Link href={`/panel/inspecciones/${id}/revision`} className="rounded-2xl border border-white/10 px-3 py-3 text-center text-xs font-black text-fuchsia-300 sm:text-sm">
            Revisión
          </Link>
        ) : null}
        {puedeVerAjustes ? (
          <Link href={`/panel/inspecciones/${id}/ajustes`} className="rounded-2xl border border-white/10 px-3 py-3 text-center text-xs font-black text-orange-300 sm:text-sm">
            Ajustes
          </Link>
        ) : null}
      </div>
    </nav>
    <div className="print:hidden h-32" aria-hidden="true" />
  </>;
}
