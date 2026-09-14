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

function texto(formData: FormData, campo: string) {
  return String(formData.get(campo) ?? "").trim();
}

function error(inspeccionId: string, mensaje: string): never {
  redirect(`/panel/inspecciones/${inspeccionId}?error=${encodeURIComponent(mensaje)}`);
}

function ok(inspeccionId: string, mensaje: string): never {
  redirect(`/panel/inspecciones/${inspeccionId}?ok=${encodeURIComponent(mensaje)}`);
}

function revalidar(inspeccionId: string) {
  revalidatePath(`/panel/inspecciones/${inspeccionId}`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/revision`);
  revalidatePath("/panel/inspecciones");
  revalidatePath("/panel");
}

async function usaAsignacionesPorInspeccion(inspeccionId: string) {
  const filas = await prisma.$queryRaw<Array<{ existe: boolean }>>`
    SELECT EXISTS(
      SELECT 1 FROM "AsignacionRolInspeccion" WHERE "inspeccionId" = ${inspeccionId}
    ) AS "existe"
  `;
  return Boolean(filas[0]?.existe);
}

export async function devolverAInspectorPorAsignacion(formData: FormData): Promise<boolean> {
  const inspeccionId = texto(formData, "inspeccionId");
  if (!inspeccionId || !(await usaAsignacionesPorInspeccion(inspeccionId))) return false;

  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const comentario = texto(formData, "comentario");
  if (comentario.length < 10) error(inspeccionId, "Indica un motivo de al menos 10 caracteres para devolver la inspección al Inspector.");

  const usuario = await prisma.usuario.findUnique({ where: { id: session.user.id }, select: { id: true, rol: true, activo: true } });
  if (!usuario?.activo || usuario.rol !== RolUsuario.COORDINADOR) redirect("/acceso");
  if (!(await usuarioAsignadoAInspeccion(inspeccionId, usuario.id, "COORDINADOR"))) error(inspeccionId, "Esta inspección no está asignada a esta Coordinación.");

  const inspeccion = await prisma.inspeccion.findUnique({ where: { id: inspeccionId }, select: { id: true, folio: true, estado: true, liberacionBloqueada: true, inspectorId: true, requiereCoordinador: true } });
  if (!inspeccion) error(inspeccionId, "La inspección no existe.");
  if (!inspeccion.requiereCoordinador) error(inspeccionId, "Esta inspección no requiere Coordinación.");
  if (inspeccion.estado !== EstadoInspeccion.REPORTE_PENDIENTE) error(inspeccionId, "Coordinación solo puede devolver al Inspector una inspección en REPORTE PENDIENTE.");
  if (inspeccion.liberacionBloqueada) error(inspeccionId, "La liberación está bloqueada por Dirección.");
  if (!inspeccion.inspectorId) error(inspeccionId, "La inspección no tiene un Inspector asignado.");

  await prisma.$transaction(async (tx) => {
    await tx.revisionInspeccion.updateMany({ where: { inspeccionId, estado: EstadoDecisionRevision.VIGENTE }, data: { estado: EstadoDecisionRevision.SUPERADA } });
    await tx.revisionInspeccion.create({ data: { inspeccionId, usuarioId: usuario.id, rol: RolUsuario.COORDINADOR, decision: TipoDecisionRevision.DEVUELTO_INSPECTOR, comentario } });
    await tx.inspeccion.update({ where: { id: inspeccionId }, data: { estado: EstadoInspeccion.EN_PROCESO } });
  });

  await registrarAuditoria({ tipo: TipoEvento.REVISION_INSPECCION, entidad: "RevisionInspeccion", inspeccionId, usuarioId: usuario.id, origen: "ASIGNACION_POR_INSPECCION", descripcion: `Coordinación devolvió ${inspeccion.folio} al Inspector. Motivo: ${comentario}` });
  revalidar(inspeccionId);
  ok(inspeccionId, "Coordinación devolvió la inspección al Inspector para corrección.");
}

export async function devolverACoordinacionPorAsignacion(formData: FormData): Promise<boolean> {
  const inspeccionId = texto(formData, "inspeccionId");
  if (!inspeccionId || !(await usaAsignacionesPorInspeccion(inspeccionId))) return false;

  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const comentario = texto(formData, "comentario");
  if (comentario.length < 10) error(inspeccionId, "Indica un motivo de al menos 10 caracteres para devolver la inspección a Coordinación.");

  const usuario = await prisma.usuario.findUnique({ where: { id: session.user.id }, select: { id: true, rol: true, activo: true } });
  if (!usuario?.activo || usuario.rol !== RolUsuario.GERENTE) redirect("/acceso");
  if (!(await usuarioAsignadoAInspeccion(inspeccionId, usuario.id, "GERENTE"))) error(inspeccionId, "Esta inspección no está asignada a esta Gerencia.");

  const inspeccion = await prisma.inspeccion.findUnique({ where: { id: inspeccionId }, select: { id: true, folio: true, estado: true, liberacionBloqueada: true, requiereCoordinador: true } });
  if (!inspeccion) error(inspeccionId, "La inspección no existe.");
  if (!inspeccion.requiereCoordinador) error(inspeccionId, "Esta inspección no tiene Coordinación asignada.");
  if (inspeccion.estado !== EstadoInspeccion.REPORTE_PENDIENTE) error(inspeccionId, "Gerencia solo puede devolver a Coordinación una inspección en REPORTE PENDIENTE.");
  if (inspeccion.liberacionBloqueada) error(inspeccionId, "La liberación está bloqueada por Dirección.");

  const vistoBueno = await prisma.revisionInspeccion.findFirst({ where: { inspeccionId, rol: RolUsuario.COORDINADOR, decision: TipoDecisionRevision.VISTO_BUENO, estado: EstadoDecisionRevision.VIGENTE }, select: { id: true } });
  if (!vistoBueno) error(inspeccionId, "No existe un visto bueno técnico vigente de Coordinación que pueda devolverse.");

  await prisma.$transaction(async (tx) => {
    await tx.revisionInspeccion.updateMany({ where: { inspeccionId, rol: RolUsuario.COORDINADOR, decision: TipoDecisionRevision.VISTO_BUENO, estado: EstadoDecisionRevision.VIGENTE }, data: { estado: EstadoDecisionRevision.INVALIDADA } });
    await tx.revisionInspeccion.updateMany({ where: { inspeccionId, rol: RolUsuario.GERENTE, estado: EstadoDecisionRevision.VIGENTE }, data: { estado: EstadoDecisionRevision.SUPERADA } });
    await tx.revisionInspeccion.create({ data: { inspeccionId, usuarioId: usuario.id, rol: RolUsuario.GERENTE, decision: TipoDecisionRevision.DEVUELTO_COORDINACION, comentario } });
    await tx.inspeccion.update({ where: { id: inspeccionId }, data: { estado: EstadoInspeccion.REPORTE_PENDIENTE } });
  });

  await registrarAuditoria({ tipo: TipoEvento.REVISION_INSPECCION, entidad: "RevisionInspeccion", inspeccionId, usuarioId: usuario.id, origen: "ASIGNACION_POR_INSPECCION", descripcion: `Gerencia devolvió ${inspeccion.folio} a Coordinación. Motivo: ${comentario}` });
  revalidar(inspeccionId);
  ok(inspeccionId, "Gerencia devolvió la inspección a Coordinación. El visto bueno anterior quedó invalidado.");
}
