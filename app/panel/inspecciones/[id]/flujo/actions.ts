"use server";

import { EstadoDecisionRevision, EstadoInspeccion, RolUsuario, TipoDecisionRevision, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { validarInicioCampoPorCaja } from "@/lib/inspeccion-finanzas";
import { prisma } from "@/lib/prisma";

const MINIMO_EVIDENCIAS = 4;

function volver(id: string, tipo: "ok" | "error", mensaje: string): never {
  redirect(`/panel/inspecciones/${id}/flujo?${tipo}=${encodeURIComponent(mensaje)}`);
}

async function guiaCompleta(inspeccionId: string) {
  try {
    const tabla = await prisma.$queryRaw<Array<{ tabla: string | null }>>`
      SELECT to_regclass('public."GuiaInspeccionItem"')::text AS "tabla"
    `;
    if (!tabla[0]?.tabla) return { habilitada: false, total: 0, pendientes: 0 };

    const [resultado] = await prisma.$queryRaw<Array<{ total: number; pendientes: number }>>`
      SELECT COUNT(*)::int AS "total",
             COUNT(*) FILTER (WHERE NOT "completado")::int AS "pendientes"
      FROM "GuiaInspeccionItem"
      WHERE "inspeccionId" = ${inspeccionId}
    `;
    return {
      habilitada: true,
      total: Number(resultado?.total ?? 0),
      pendientes: Number(resultado?.pendientes ?? 0),
    };
  } catch {
    return { habilitada: false, total: 0, pendientes: 0 };
  }
}

export async function iniciarInspeccionDesdeFlujo(formData: FormData) {
  const session = await auth();
  const inspeccionId = String(formData.get("inspeccionId") ?? "").trim();
  if (!session?.user?.id) redirect("/login");
  if (!inspeccionId) redirect("/panel/inspecciones?error=Inspeccion%20no%20valida");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, rol: true, activo: true, inspector: { select: { id: true, activo: true } } },
  });
  if (!usuario?.activo || usuario.rol !== RolUsuario.INSPECTOR || !usuario.inspector?.id || !usuario.inspector.activo) {
    volver(inspeccionId, "error", "Solo el Inspector activo asignado puede iniciar el trabajo de campo.");
  }

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: { id: true, folio: true, estado: true, inspectorId: true, cotizacionId: true },
  });
  if (!inspeccion) volver(inspeccionId, "error", "La inspección no existe.");
  if (inspeccion.inspectorId !== usuario.inspector.id) volver(inspeccionId, "error", "La inspección está asignada a otro Inspector.");
  if (inspeccion.estado !== EstadoInspeccion.PROGRAMADA) volver(inspeccionId, "error", "Solo una inspección PROGRAMADA puede iniciar trabajo de campo.");

  const validacion = await validarInicioCampoPorCaja(inspeccionId);
  if (!validacion.ok) volver(inspeccionId, "error", validacion.error);

  await prisma.inspeccion.update({
    where: { id: inspeccionId },
    data: {
      estado: EstadoInspeccion.EN_PROCESO,
      inicioLiberadoSinPago: validacion.liberadaPorExcepcion ?? false,
    },
  });

  await registrarAuditoria({
    tipo: TipoEvento.INICIAR,
    entidad: "Inspeccion",
    entidadId: inspeccionId,
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${inspeccion.folio} inició trabajo de campo con liberación financiera de Caja: ${validacion.liberadaPorExcepcion ? "excepción autorizada de 100%" : validacion.liberadaPorPago ? "100% pagado" : "expediente histórico sin cotización"}.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/flujo`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/captura`);
  revalidatePath("/panel/inspecciones");
  revalidatePath("/panel/agenda");
  revalidatePath("/panel/cotizaciones");
  revalidatePath("/panel/caja");
  volver(inspeccionId, "ok", "Caja liberó el inicio. La inspección quedó EN PROCESO.");
}

export async function finalizarCapturaGuiada(formData: FormData) {
  const session = await auth();
  const inspeccionId = String(formData.get("inspeccionId") ?? "").trim();
  if (!session?.user?.id) redirect("/login");
  if (!inspeccionId) redirect("/panel/inspecciones?error=Inspeccion%20no%20valida");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, rol: true, activo: true, inspector: { select: { id: true } } },
  });
  if (!usuario?.activo || usuario.rol !== RolUsuario.INSPECTOR || !usuario.inspector?.id) {
    volver(inspeccionId, "error", "Solo el Inspector asignado puede entregar la captura a revisión.");
  }

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      id: true,
      folio: true,
      estado: true,
      inspectorId: true,
      hallazgos: {
        select: {
          id: true,
          titulo: true,
          fotografias: { select: { id: true } },
        },
      },
      firmas: { select: { tipo: true } },
    },
  });
  if (!inspeccion) volver(inspeccionId, "error", "La inspección no existe.");
  if (inspeccion.inspectorId !== usuario.inspector.id) volver(inspeccionId, "error", "La inspección está asignada a otro Inspector.");
  if (inspeccion.estado !== EstadoInspeccion.EN_PROCESO) volver(inspeccionId, "error", "Solo una inspección EN PROCESO puede entregarse a revisión.");
  if (inspeccion.hallazgos.length === 0) volver(inspeccionId, "error", "Registra al menos un hallazgo antes de finalizar la captura.");

  const incompletos = inspeccion.hallazgos.filter((h) => h.fotografias.length < MINIMO_EVIDENCIAS);
  if (incompletos.length > 0) {
    const ejemplos = incompletos.slice(0, 3).map((h) => `“${h.titulo}” (${h.fotografias.length}/4)`).join(", ");
    volver(inspeccionId, "error", `${incompletos.length} hallazgo(s) todavía no tienen 4 evidencias. ${ejemplos}${incompletos.length > 3 ? "…" : ""}`);
  }

  const guia = await guiaCompleta(inspeccionId);
  if (guia.habilitada && (guia.total === 0 || guia.pendientes > 0)) {
    volver(inspeccionId, "error", guia.total === 0
      ? "La guía técnica está habilitada pero todavía no ha sido generada."
      : `La guía técnica tiene ${guia.pendientes} concepto(s) pendientes de revisar.`);
  }

  const firmaInspector = inspeccion.firmas.some((f) => f.tipo.toLowerCase().includes("inspector"));
  const firmaCliente = inspeccion.firmas.some((f) => f.tipo.toLowerCase().includes("cliente"));
  if (!firmaInspector || !firmaCliente) {
    volver(inspeccionId, "error", `Falta ${!firmaInspector && !firmaCliente ? "la firma del Inspector y la firma del Cliente" : !firmaInspector ? "la firma del Inspector" : "la firma del Cliente"}.`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.inspeccion.update({
      where: { id: inspeccionId },
      data: { estado: EstadoInspeccion.REPORTE_PENDIENTE },
    });
    await tx.revisionInspeccion.updateMany({
      where: {
        inspeccionId,
        decision: TipoDecisionRevision.DEVUELTO_INSPECTOR,
        estado: EstadoDecisionRevision.VIGENTE,
      },
      data: { estado: EstadoDecisionRevision.SUPERADA },
    });
  });

  await registrarAuditoria({
    tipo: TipoEvento.FINALIZAR_CAPTURA,
    entidad: "Inspeccion",
    entidadId: inspeccion.id,
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `Captura guiada finalizada para ${inspeccion.folio}: guía técnica completa, ${inspeccion.hallazgos.length} hallazgo(s) con mínimo 4 evidencias y firmas requeridas registradas.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/flujo`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/captura`);
  revalidatePath("/panel/inspecciones");
  volver(inspeccionId, "ok", "Captura entregada a revisión. El expediente quedó en REPORTE PENDIENTE.");
}
