import { EstadoInspeccion, RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Después de la autorización/finalización de V1, el Inspector asignado puede
 * seguir viendo el expediente general, pero no debe abrir contenido técnico.
 * Los roles de revisión conservan acceso de consulta.
 */
export async function bloquearContenidoTecnicoV1Finalizado(inspeccionId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { rol: true, activo: true, inspector: { select: { id: true } } },
  });
  if (!usuario?.activo) redirect("/acceso");
  if (usuario.rol !== RolUsuario.INSPECTOR) return;

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: { numeroInspeccion: true, estado: true, inspectorId: true },
  });
  if (!inspeccion) return;

  if (
    inspeccion.numeroInspeccion === 1 &&
    inspeccion.estado === EstadoInspeccion.FINALIZADA &&
    usuario.inspector?.id === inspeccion.inspectorId
  ) {
    redirect(`/panel/inspecciones/${inspeccionId}`);
  }
}
