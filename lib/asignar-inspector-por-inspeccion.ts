"use server";

import { EstadoInspeccion, EstadoReasignacionInspector, RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { usuarioAsignadoAInspeccion } from "@/lib/asignaciones-inspeccion";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

function texto(formData: FormData, campo: string) { return String(formData.get(campo) ?? "").trim(); }
function error(id: string, mensaje: string): never { redirect(`/panel/inspecciones/${id}?error=${encodeURIComponent(mensaje)}`); }
function ok(id: string, mensaje: string): never { redirect(`/panel/inspecciones/${id}?ok=${encodeURIComponent(mensaje)}`); }
function revalidar(id: string) { revalidatePath(`/panel/inspecciones/${id}`); revalidatePath("/panel/inspecciones"); revalidatePath("/panel/agenda"); revalidatePath("/panel/inspectores"); revalidatePath("/panel"); }

async function usaModeloNuevo(inspeccionId: string) {
  const filas = await prisma.$queryRaw<Array<{ existe: boolean }>>`
    SELECT EXISTS(SELECT 1 FROM "AsignacionRolInspeccion" WHERE "inspeccionId" = ${inspeccionId}) AS "existe"
  `;
  return Boolean(filas[0]?.existe);
}

export async function asignarInspectorPorInspeccion(formData: FormData): Promise<boolean> {
  const inspeccionId = texto(formData, "inspeccionId");
  if (!inspeccionId || !(await usaModeloNuevo(inspeccionId))) return false;

  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const inspectorId = texto(formData, "inspectorId");
  const motivo = texto(formData, "motivo");
  if (!inspectorId) error(inspeccionId, "Selecciona un Inspector para continuar.");

  const usuarioGestor = await prisma.usuario.findUnique({ where: { id: session.user.id }, select: { id: true, rol: true, activo: true } });
  if (!usuarioGestor?.activo) redirect("/acceso");
  const rolPermitido = usuarioGestor.rol === RolUsuario.GERENTE || usuarioGestor.rol === RolUsuario.ADMINISTRADOR || usuarioGestor.rol === RolUsuario.DIRECTOR;
  if (!rolPermitido) redirect("/acceso");
  if (usuarioGestor.rol === RolUsuario.GERENTE && !(await usuarioAsignadoAInspeccion(inspeccionId, usuarioGestor.id, "GERENTE"))) error(inspeccionId, "Esta inspección no está asignada a tu Gerencia.");

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: { id: true, folio: true, estado: true, inspectorId: true, zonaId: true, inspector: { select: { usuario: { select: { nombre: true } } } } },
  });
  if (!inspeccion) error(inspeccionId, "La inspección no existe.");
  if (inspeccion.estado === EstadoInspeccion.FINALIZADA || inspeccion.estado === EstadoInspeccion.CANCELADA) error(inspeccionId, "Una inspección FINALIZADA o CANCELADA no puede reasignarse por el flujo ordinario.");
  if (inspeccion.inspectorId === inspectorId) ok(inspeccionId, "El Inspector seleccionado ya está asignado a esta inspección.");

  const inspectorNuevo = await prisma.inspector.findFirst({
    where: { id: inspectorId, activo: true, usuario: { activo: true, rol: RolUsuario.INSPECTOR, zonaId: inspeccion.zonaId } },
    select: { id: true, usuario: { select: { id: true, nombre: true } } },
  });
  if (!inspectorNuevo) error(inspeccionId, "El Inspector seleccionado no está activo o no pertenece a la zona de la inspección.");

  const nombreAnterior = inspeccion.inspector?.usuario.nombre ?? "Sin asignar";
  const nombreNuevo = inspectorNuevo.usuario.nombre;

  if (!inspeccion.inspectorId) {
    await prisma.inspeccion.update({ where: { id: inspeccionId }, data: { inspectorId: inspectorNuevo.id } });
    await registrarAuditoria({ tipo: TipoEvento.EDITAR, entidad: "Inspeccion", entidadId: inspeccion.id, inspeccionId, usuarioId: usuarioGestor.id, origen: "ASIGNACION_POR_INSPECCION", descripcion: `${usuarioGestor.rol} asignó ${inspeccion.folio} al Inspector ${nombreNuevo}${motivo ? `. Comentario: ${motivo}` : "."}` });
    revalidar(inspeccionId);
    ok(inspeccionId, `Inspector asignado correctamente: ${nombreNuevo}.`);
  }

  const inspectorAnteriorId = inspeccion.inspectorId;
  if (motivo.length < 10) error(inspeccionId, "Indica un motivo de al menos 10 caracteres para solicitar o realizar la reasignación.");
  const pendiente = await prisma.reasignacionInspector.findFirst({ where: { inspeccionId, estado: EstadoReasignacionInspector.PENDIENTE }, select: { id: true } });
  if (pendiente) error(inspeccionId, "Ya existe una solicitud de reasignación pendiente para esta inspección.");

  if (usuarioGestor.rol === RolUsuario.DIRECTOR || usuarioGestor.rol === RolUsuario.ADMINISTRADOR) {
    await prisma.$transaction(async (tx) => {
      await tx.reasignacionInspector.create({ data: { inspeccionId, inspectorAnteriorId, inspectorPropuestoId: inspectorNuevo.id, solicitadaPorId: usuarioGestor.id, resueltaPorId: usuarioGestor.id, estado: EstadoReasignacionInspector.AUTORIZADA, motivo, comentarioResolucion: `Reasignación autorizada y ejecutada directamente por ${usuarioGestor.rol}.`, resueltaEn: new Date() } });
      await tx.inspeccion.update({ where: { id: inspeccionId }, data: { inspectorId: inspectorNuevo.id } });
    });
    await registrarAuditoria({ tipo: TipoEvento.EDITAR, entidad: "Inspeccion", entidadId: inspeccion.id, inspeccionId, usuarioId: usuarioGestor.id, origen: "ASIGNACION_POR_INSPECCION", descripcion: `${usuarioGestor.rol} reasignó ${inspeccion.folio} de ${nombreAnterior} a ${nombreNuevo}. Motivo: ${motivo}` });
    revalidar(inspeccionId);
    ok(inspeccionId, `Inspector reasignado: ${nombreNuevo}.`);
  }

  const solicitud = await prisma.reasignacionInspector.create({ data: { inspeccionId, inspectorAnteriorId, inspectorPropuestoId: inspectorNuevo.id, solicitadaPorId: usuarioGestor.id, estado: EstadoReasignacionInspector.PENDIENTE, motivo } });
  await registrarAuditoria({ tipo: TipoEvento.EDITAR, entidad: "ReasignacionInspector", entidadId: solicitud.id, inspeccionId, usuarioId: usuarioGestor.id, origen: "ASIGNACION_POR_INSPECCION", descripcion: `Gerencia solicitó reasignar ${inspeccion.folio} de ${nombreAnterior} a ${nombreNuevo}. Motivo: ${motivo}` });
  revalidar(inspeccionId);
  ok(inspeccionId, "Solicitud de reasignación enviada a Administración. El Inspector actual continúa asignado hasta que sea autorizada.");
}
