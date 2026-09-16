"use server";

import { EstadoInspeccion, RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? "").trim();

function volver(id: string, tipo: "ok" | "error", mensaje: string): never {
  redirect(`/panel/inspecciones/${id}/areas?${tipo}=${encodeURIComponent(mensaje)}`);
}

export async function seleccionarPortadaFachadaV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const fotografiaId = texto(formData, "fotografiaId");
  if (!inspeccionId || !fotografiaId) redirect("/panel/inspecciones");

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, rol: true, activo: true, inspector: { select: { id: true, activo: true } } },
  });
  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: { id: true, numeroInspeccion: true, estado: true, inspectorId: true },
  });

  if (!usuario?.activo || usuario.rol !== RolUsuario.INSPECTOR || !usuario.inspector?.activo) redirect("/acceso");
  if (!inspeccion || inspeccion.numeroInspeccion !== 1 || inspeccion.inspectorId !== usuario.inspector.id) redirect("/acceso");
  if (inspeccion.estado !== EstadoInspeccion.EN_PROCESO) volver(inspeccionId, "error", "La portada solo puede cambiarse mientras V1 está EN PROCESO.");

  const [foto] = await prisma.$queryRaw<Array<{ areaId: string; nombre: string }>>`
    SELECT a."id"::text AS "areaId",a."nombre"
    FROM "FotografiaArea" fa
    JOIN "AreaInspeccion" a ON a."id"=fa."areaId"
    WHERE fa."fotografiaId"=${fotografiaId}
      AND a."inspeccionId"=${inspeccionId}
      AND a."codigo"='FACHADA_PRINCIPAL'
    LIMIT 1
  `;
  if (!foto) volver(inspeccionId, "error", "La fotografía seleccionada no pertenece a la fachada principal de esta inspección.");

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "FotografiaArea" fa
      SET "candidataPortada"=false
      FROM "AreaInspeccion" a
      WHERE fa."areaId"=a."id"
        AND a."inspeccionId"=${inspeccionId}
        AND a."codigo"='FACHADA_PRINCIPAL'
    `;
    await tx.$executeRaw`
      UPDATE "FotografiaArea"
      SET "candidataPortada"=true
      WHERE "fotografiaId"=${fotografiaId} AND "areaId"=${foto.areaId}::uuid
    `;
  });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "FotografiaArea",
    entidadId: fotografiaId,
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `Inspector seleccionó explícitamente una fotografía de ${foto.nombre} como portada V1.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/cierre-v1`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/pre-reporte`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/reporte-v1`);
  volver(inspeccionId, "ok", "Portada V1 actualizada. Solo esta fotografía queda seleccionada como portada.");
}
