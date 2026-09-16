"use server";

import {
  EstadoDecisionRevision,
  EstadoInspeccion,
  RolUsuario,
  TipoDecisionRevision,
  TipoEvento,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { usuarioAsignadoAInspeccion } from "@/lib/asignaciones-inspeccion";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";
import { obtenerEstadoExpedienteRevision } from "@/lib/validacion-expediente-certeza";

function texto(formData: FormData, campo: string) {
  return String(formData.get(campo) ?? "").trim();
}

function error(inspeccionId: string, mensaje: string): never {
  redirect(`/panel/inspecciones/${inspeccionId}?error=${encodeURIComponent(mensaje)}`);
}

export async function aprobarGerenciaV1SinFinalizar(formData: FormData): Promise<boolean> {
  const inspeccionId = texto(formData, "inspeccionId");
  if (!inspeccionId) return false;

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      id: true,
      folio: true,
      numeroInspeccion: true,
      estado: true,
      requiereCoordinador: true,
      requiereGerenteZona: true,
      liberacionBloqueada: true,
    },
  });
  if (!inspeccion || inspeccion.numeroInspeccion !== 1) return false;

  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, rol: true, activo: true },
  });
  if (!usuario?.activo || usuario.rol !== RolUsuario.GERENTE) redirect("/acceso");
  if (!inspeccion.requiereGerenteZona || !(await usuarioAsignadoAInspeccion(inspeccionId, usuario.id, "GERENTE"))) redirect("/acceso");
  if (inspeccion.estado !== EstadoInspeccion.REPORTE_PENDIENTE) error(inspeccionId, "Gerencia solo puede revisar una V1 en REPORTE PENDIENTE.");
  if (inspeccion.liberacionBloqueada) error(inspeccionId, "La liberación está bloqueada por Dirección.");

  const expediente = await obtenerEstadoExpedienteRevision(inspeccionId);
  if (!expediente?.completo) {
    error(inspeccionId, `El expediente todavía está incompleto. Faltan: ${expediente?.faltantes.join(", ") ?? "requisitos de revisión"}.`);
  }

  if (inspeccion.requiereCoordinador) {
    const vistoBueno = await prisma.revisionInspeccion.findFirst({
      where: {
        inspeccionId,
        rol: RolUsuario.COORDINADOR,
        decision: TipoDecisionRevision.VISTO_BUENO,
        estado: EstadoDecisionRevision.VIGENTE,
      },
      select: { id: true },
    });
    if (!vistoBueno) error(inspeccionId, "Esta V1 requiere visto bueno técnico vigente de Coordinación.");
  }

  const comentario = texto(formData, "comentario");
  await prisma.$transaction(async (tx) => {
    await tx.revisionInspeccion.updateMany({
      where: { inspeccionId, rol: RolUsuario.GERENTE, estado: EstadoDecisionRevision.VIGENTE },
      data: { estado: EstadoDecisionRevision.SUPERADA },
    });
    await tx.revisionInspeccion.create({
      data: {
        inspeccionId,
        usuarioId: usuario.id,
        rol: RolUsuario.GERENTE,
        decision: TipoDecisionRevision.APROBADO,
        comentario: comentario || null,
      },
    });
  });

  await registrarAuditoria({
    tipo: TipoEvento.REVISION_INSPECCION,
    entidad: "RevisionInspeccion",
    inspeccionId,
    usuarioId: usuario.id,
    origen: "METODO_CERTEZA_V1",
    descripcion: `Gerencia aprobó la revisión previa de ${inspeccion.folio}. La V1 permanece pendiente de autorización final de Dirección; la liquidación total se valida en esa autorización final.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/revision`);
  redirect(`/panel/inspecciones/${inspeccionId}/revision?ok=${encodeURIComponent("Gerencia aprobó la revisión previa. La V1 permanece pendiente de autorización final de Dirección.")}`);
}
