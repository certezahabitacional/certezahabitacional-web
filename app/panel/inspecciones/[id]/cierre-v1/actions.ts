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
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? "").trim();

function volver(id: string, tipo: "ok" | "error", mensaje: string): never {
  redirect(`/panel/inspecciones/${id}/cierre-v1?${tipo}=${encodeURIComponent(mensaje)}`);
}

async function exigirInspectorV1(inspeccionId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, rol: true, activo: true, inspector: { select: { id: true, activo: true } } },
  });
  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      id: true,
      folio: true,
      numeroInspeccion: true,
      estado: true,
      inspectorId: true,
      cotizacionId: true,
      firmas: { select: { tipo: true, firmadaEn: true } },
    },
  });

  if (!usuario?.activo || usuario.rol !== RolUsuario.INSPECTOR || !usuario.inspector?.activo) redirect("/acceso");
  if (!inspeccion || inspeccion.inspectorId !== usuario.inspector.id) redirect("/acceso");
  if (inspeccion.numeroInspeccion !== 1) volver(inspeccionId, "error", "Este cierre corresponde únicamente a la primera inspección integral V1.");
  if (inspeccion.estado !== EstadoInspeccion.EN_PROCESO) volver(inspeccionId, "error", "La V1 no se encuentra disponible para cierre de campo.");

  return { usuario, inspeccion };
}

async function validarCierreCampo(inspeccionId: string) {
  const [r] = await prisma.$queryRaw<Array<{
    areasTotal: number;
    areasCompletas: number;
    protocoloTotal: number;
    protocoloCompleto: number;
    fachadaFotos: number;
    fachadaPortadas: number;
    hallazgosIncompletos: number;
    syncPendientes: number;
  }>>`
    SELECT
      (SELECT COUNT(*)::int FROM "AreaInspeccion" a WHERE a."inspeccionId"=${inspeccionId} AND a."obligatoria"=true) AS "areasTotal",
      (SELECT COUNT(*)::int FROM "AreaInspeccion" a WHERE a."inspeccionId"=${inspeccionId} AND a."obligatoria"=true AND a."estado"='REVISADA' AND a."resultado" IN ('SIN_HALLAZGOS','CON_HALLAZGOS')) AS "areasCompletas",
      (SELECT COUNT(*)::int FROM "ProtocoloInspeccionPaso" p WHERE p."inspeccionId"=${inspeccionId} AND p."obligatorio"=true) AS "protocoloTotal",
      (SELECT COUNT(*)::int FROM "ProtocoloInspeccionPaso" p WHERE p."inspeccionId"=${inspeccionId} AND p."obligatorio"=true AND p."estado" IN ('COMPLETADO','NO_APLICA')) AS "protocoloCompleto",
      (SELECT COUNT(*)::int FROM "AreaInspeccion" a JOIN "FotografiaArea" fa ON fa."areaId"=a."id" WHERE a."inspeccionId"=${inspeccionId} AND a."codigo"='FACHADA_PRINCIPAL') AS "fachadaFotos",
      (SELECT COUNT(*)::int FROM "AreaInspeccion" a JOIN "FotografiaArea" fa ON fa."areaId"=a."id" WHERE a."inspeccionId"=${inspeccionId} AND a."codigo"='FACHADA_PRINCIPAL' AND fa."candidataPortada"=true) AS "fachadaPortadas",
      (SELECT COUNT(*)::int FROM "Hallazgo" h WHERE h."inspeccionId"=${inspeccionId} AND ((SELECT COUNT(*) FROM "Fotografia" f WHERE f."hallazgoId"=h."id") < 4 OR nullif(btrim(coalesce(h."descripcion",'')),'') IS NULL)) AS "hallazgosIncompletos",
      (SELECT COUNT(*)::int FROM "OperacionCampoSync" s WHERE s."inspeccionId"=${inspeccionId} AND s."estado" <> 'PROCESADA') AS "syncPendientes"
  `;
  const v = r;
  if (!v || v.areasTotal === 0) return "No existen áreas obligatorias configuradas para la V1.";
  if (v.areasCompletas !== v.areasTotal) return `Faltan ${v.areasTotal - v.areasCompletas} área(s) por cerrar.`;
  if (v.protocoloTotal === 0 || v.protocoloCompleto !== v.protocoloTotal) return "Faltan procesos técnicos obligatorios por completar.";
  if (v.fachadaFotos !== 1) return "La fachada principal debe conservar exactamente una fotografía definitiva elegida en la revisión inicial.";
  if (v.fachadaPortadas !== 1) return "Debes seleccionar exactamente una fotografía de fachada para la portada.";
  if (v.hallazgosIncompletos > 0) return `Existen ${v.hallazgosIncompletos} hallazgo(s) sin 4 evidencias o descripción completa.`;
  if (v.syncPendientes > 0) return `Existen ${v.syncPendientes} operación(es) pendientes de sincronizar.`;
  return null;
}

export async function terminarTrabajoCampoV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  if (!inspeccionId) redirect("/panel/inspecciones");
  const { usuario, inspeccion } = await exigirInspectorV1(inspeccionId);

  const firmaInspector = inspeccion.firmas.some((f) => f.tipo.toLowerCase().includes("inspector"));
  const firmaCliente = inspeccion.firmas.some((f) => f.tipo.toLowerCase().includes("cliente"));
  if (!firmaInspector || !firmaCliente) volver(inspeccionId, "error", "Antes de terminar el trabajo de campo deben estar registradas las firmas del Inspector y del cliente.");

  const error = await validarCierreCampo(inspeccionId);
  if (error) volver(inspeccionId, "error", error);

  const [ya] = await prisma.$queryRaw<Array<{ campoFinalizadoEn: Date | null }>>`
    SELECT "campoFinalizadoEn" FROM "InspeccionControlV2" WHERE "inspeccionId"=${inspeccionId} LIMIT 1
  `;
  if (ya?.campoFinalizadoEn) volver(inspeccionId, "error", "El trabajo de campo ya fue terminado y la ventana de edición ya está activa.");

  await prisma.$executeRaw`
    UPDATE "InspeccionControlV2"
    SET "campoFinalizadoEn"=NOW(),
        "reporteLimiteEn"=NOW() + interval '12 hours',
        "actualizadoEn"=NOW()
    WHERE "inspeccionId"=${inspeccionId}
  `;

  await registrarAuditoria({
    tipo: TipoEvento.FINALIZAR_CAPTURA,
    entidad: "InspeccionControlV2",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `Inspector terminó el trabajo de campo de ${inspeccion.folio}. Inicia ventana máxima de 12 horas para edición y envío del reporte a Dirección.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/cierre-v1`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
  volver(inspeccionId, "ok", "Trabajo de campo terminado. Ya corre la ventana de 12 horas para revisar el reporte y enviarlo a Dirección.");
}

export async function enviarReporteDireccionV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  if (!inspeccionId) redirect("/panel/inspecciones");
  const { usuario, inspeccion } = await exigirInspectorV1(inspeccionId);

  const [control] = await prisma.$queryRaw<Array<{
    campoFinalizadoEn: Date | null;
    reporteLimiteEn: Date | null;
    reabiertaEn: Date | null;
  }>>`
    SELECT "campoFinalizadoEn","reporteLimiteEn","reabiertaEn"
    FROM "InspeccionControlV2"
    WHERE "inspeccionId"=${inspeccionId}
    LIMIT 1
  `;
  if (!control?.campoFinalizadoEn) volver(inspeccionId, "error", "Primero debes terminar formalmente el trabajo de campo.");

  const reabiertaEn = control.reabiertaEn ? new Date(control.reabiertaEn) : null;
  const firmasVigentes = inspeccion.firmas.filter(
    (firma) => !reabiertaEn || new Date(firma.firmadaEn) >= reabiertaEn,
  );
  const firmaInspector = firmasVigentes.some((firma) => firma.tipo.toLowerCase().includes("inspector"));
  const firmaCliente = firmasVigentes.some((firma) => firma.tipo.toLowerCase().includes("cliente"));
  if (!firmaInspector || !firmaCliente) {
    volver(
      inspeccionId,
      "error",
      reabiertaEn
        ? "Después de una reapertura técnica de Dirección, el Inspector y el cliente deben registrar nuevas firmas antes de reenviar el reporte."
        : "Antes de enviar el reporte a Dirección deben estar registradas las firmas del Inspector y del cliente.",
    );
  }

  const fueraDePlazo = Boolean(control.reporteLimiteEn && new Date() > new Date(control.reporteLimiteEn));

  try {
    await prisma.$transaction(async (tx) => {
      await tx.inspeccion.update({ where: { id: inspeccionId }, data: { estado: EstadoInspeccion.REPORTE_PENDIENTE } });
      await tx.$executeRaw`
        UPDATE "InspeccionControlV2"
        SET "capturaCerrada"=true,
            "capturaCerradaEn"=NOW(),
            "capturaCerradaPorId"=${usuario.id},
            "actualizadoEn"=NOW()
        WHERE "inspeccionId"=${inspeccionId}
      `;
    });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "";
    const idx = mensaje.indexOf("No se puede finalizar");
    volver(inspeccionId, "error", idx >= 0 ? mensaje.slice(idx).split("\n")[0] : "No fue posible enviar el reporte a Dirección. Revisa los requisitos pendientes.");
  }

  await registrarAuditoria({
    tipo: TipoEvento.FINALIZAR_CAPTURA,
    entidad: "Inspeccion",
    entidadId: inspeccionId,
    inspeccionId,
    cotizacionId: inspeccion.cotizacionId,
    usuarioId: usuario.id,
    descripcion: fueraDePlazo
      ? `Reporte V1 enviado a Dirección fuera de la ventana objetivo de 12 horas.`
      : `Reporte V1 enviado a Dirección dentro de la ventana de 12 horas.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/revision`);
  redirect(`/panel/inspecciones/${inspeccionId}?ok=${encodeURIComponent("Reporte enviado a Dirección. El Inspector queda en modo de solo lectura hasta nueva indicación.")}`);
}

export async function devolverReporteInspectorV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const comentario = texto(formData, "comentario");
  const tipoCorreccion = texto(formData, "tipoCorreccion").toUpperCase();
  if (!inspeccionId) redirect("/panel/inspecciones");
  if (!['DOCUMENTAL','TECNICA'].includes(tipoCorreccion)) {
    redirect(`/panel/inspecciones/${inspeccionId}/revision?error=${encodeURIComponent("Selecciona si la devolución requiere corrección documental o reapertura técnica.")}`);
  }
  if (comentario.length < 10) {
    redirect(`/panel/inspecciones/${inspeccionId}/revision?error=${encodeURIComponent("Indica un motivo de al menos 10 caracteres para devolver el reporte al Inspector.")}`);
  }

  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, rol: true, activo: true },
  });
  if (!usuario?.activo || usuario.rol !== RolUsuario.DIRECTOR) redirect("/acceso");

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: { id: true, folio: true, numeroInspeccion: true, estado: true, inspectorId: true },
  });
  if (!inspeccion || inspeccion.numeroInspeccion !== 1) {
    redirect(`/panel/inspecciones/${inspeccionId}/revision?error=${encodeURIComponent("La devolución directa de Dirección corresponde únicamente a V1.")}`);
  }
  if (inspeccion.estado !== EstadoInspeccion.REPORTE_PENDIENTE) {
    redirect(`/panel/inspecciones/${inspeccionId}/revision?error=${encodeURIComponent("Dirección solo puede devolver una V1 que esté pendiente de revisión.")}`);
  }
  if (!inspeccion.inspectorId) {
    redirect(`/panel/inspecciones/${inspeccionId}/revision?error=${encodeURIComponent("La inspección no tiene Inspector asignado.")}`);
  }

  const reaperturaTecnica = tipoCorreccion === 'TECNICA';
  const comentarioRevision = `${reaperturaTecnica ? '[REAPERTURA TÉCNICA]' : '[CORRECCIÓN DOCUMENTAL]'} ${comentario}`;

  await prisma.$transaction(async (tx) => {
    await tx.revisionInspeccion.updateMany({
      where: { inspeccionId, estado: EstadoDecisionRevision.VIGENTE },
      data: { estado: EstadoDecisionRevision.SUPERADA },
    });
    await tx.revisionInspeccion.create({
      data: {
        inspeccionId,
        usuarioId: usuario.id,
        rol: RolUsuario.DIRECTOR,
        decision: TipoDecisionRevision.DEVUELTO_INSPECTOR,
        comentario: comentarioRevision,
      },
    });
    await tx.inspeccion.update({
      where: { id: inspeccionId },
      data: { estado: EstadoInspeccion.EN_PROCESO },
    });

    if (reaperturaTecnica) {
      await tx.$executeRaw`
        UPDATE "InspeccionControlV2"
        SET "capturaCerrada"=false,
            "capturaCerradaEn"=NULL,
            "capturaCerradaPorId"=NULL,
            "reabiertaEn"=NOW(),
            "reabiertaPorId"=${usuario.id},
            "motivoReapertura"=${comentario},
            "actualizadoEn"=NOW()
        WHERE "inspeccionId"=${inspeccionId}
      `;
    } else {
      await tx.$executeRaw`
        UPDATE "InspeccionControlV2"
        SET "capturaCerrada"=false,
            "capturaCerradaEn"=NULL,
            "capturaCerradaPorId"=NULL,
            "motivoReapertura"=${`Corrección documental: ${comentario}`},
            "actualizadoEn"=NOW()
        WHERE "inspeccionId"=${inspeccionId}
      `;
    }
  });

  await registrarAuditoria({
    tipo: TipoEvento.REVISION_INSPECCION,
    entidad: "RevisionInspeccion",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: reaperturaTecnica
      ? `Dirección devolvió el reporte V1 ${inspeccion.folio} como REAPERTURA TÉCNICA. Las firmas previas dejan de ser vigentes. Motivo: ${comentario}`
      : `Dirección devolvió el reporte V1 ${inspeccion.folio} para CORRECCIÓN DOCUMENTAL. Se conservan las firmas vigentes. Motivo: ${comentario}`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/revision`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/campo-v1`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/cierre-v1`);
  redirect(`/panel/inspecciones/${inspeccionId}/revision?ok=${encodeURIComponent(
    reaperturaTecnica
      ? "Reporte V1 devuelto como reapertura técnica. Se requerirán nuevas firmas antes del reenvío."
      : "Reporte V1 devuelto para corrección documental. Las firmas vigentes se conservaron."
  )}`);
}
