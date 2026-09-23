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
import { obtenerMetricasV1 } from "@/lib/calificacion-v1";
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

  const esDirector = usuario?.activo && usuario.rol === RolUsuario.DIRECTOR;
  const esInspectorAsignado =
    usuario?.activo &&
    usuario.rol === RolUsuario.INSPECTOR &&
    Boolean(usuario.inspector?.activo) &&
    Boolean(inspeccion) &&
    inspeccion!.inspectorId === usuario.inspector?.id;
  if (!esDirector && !esInspectorAsignado) redirect("/acceso");
  if (!inspeccion) redirect("/acceso");
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
    fachadaPortadas: number;
    hallazgosIncompletos: number;
    syncPendientes: number;
  }>>`
    SELECT
      (SELECT COUNT(*)::int FROM "AreaInspeccion" a WHERE a."inspeccionId"=${inspeccionId} AND a."obligatoria"=true) AS "areasTotal",
      (SELECT COUNT(*)::int FROM "AreaInspeccion" a WHERE a."inspeccionId"=${inspeccionId} AND a."obligatoria"=true AND a."estado"='REVISADA' AND a."resultado" IN ('SIN_HALLAZGOS','CON_HALLAZGOS','NO_APLICA')) AS "areasCompletas",
      (SELECT COUNT(*)::int FROM "ProtocoloInspeccionPaso" p WHERE p."inspeccionId"=${inspeccionId} AND p."obligatorio"=true) AS "protocoloTotal",
      (SELECT COUNT(*)::int FROM "ProtocoloInspeccionPaso" p WHERE p."inspeccionId"=${inspeccionId} AND p."obligatorio"=true AND p."estado" IN ('COMPLETADO','NO_APLICA')) AS "protocoloCompleto",
      (SELECT COUNT(*)::int
       FROM "AreaInspeccion" a
       JOIN "FotografiaArea" fa ON fa."areaId"=a."id"
       WHERE a."inspeccionId"=${inspeccionId}
         AND a."codigo" IN ('FACHADA_FRONTAL','FACHADA_PRINCIPAL')
         AND fa."candidataPortada"=true) AS "fachadaPortadas",
      (SELECT COUNT(*)::int FROM "Hallazgo" h WHERE h."inspeccionId"=${inspeccionId} AND (((SELECT COUNT(*) FROM "Fotografia" f WHERE f."hallazgoId"=h."id") NOT BETWEEN 1 AND 4) OR nullif(btrim(coalesce(h."descripcion",'')),'') IS NULL)) AS "hallazgosIncompletos",
      (SELECT COUNT(*)::int FROM "OperacionCampoSync" s WHERE s."inspeccionId"=${inspeccionId} AND s."estado" <> 'PROCESADA') AS "syncPendientes"
  `;
  const v = r;
  if (!v || v.areasTotal === 0) return "No existen áreas obligatorias configuradas para la V1.";
  if (v.areasCompletas !== v.areasTotal) return `Faltan ${v.areasTotal - v.areasCompletas} área(s) por cerrar.`;
  if (v.protocoloTotal === 0 || v.protocoloCompleto !== v.protocoloTotal) return "Faltan procesos técnicos obligatorios por completar.";
  const [fachadaFrontal] = await prisma.$queryRaw<Array<{ resultado: string | null }>>`
    SELECT "resultado"
    FROM "AreaInspeccion"
    WHERE "inspeccionId"=${inspeccionId}
      AND "codigo" IN ('FACHADA_FRONTAL','FACHADA_PRINCIPAL')
    ORDER BY CASE WHEN "codigo"='FACHADA_FRONTAL' THEN 0 ELSE 1 END
    LIMIT 1
  `;
  if (fachadaFrontal?.resultado !== "NO_APLICA" && v.fachadaPortadas !== 1) return "Debes seleccionar exactamente una fotografía de fachada frontal para la portada.";
  if (v.hallazgosIncompletos > 0) return `Existen ${v.hallazgosIncompletos} hallazgo(s) sin una descripción final o fuera del rango de 1 a 4 fotografías.`;
  if (v.syncPendientes > 0) return `Existen ${v.syncPendientes} operación(es) pendientes de sincronizar.`;
  return null;
}

export async function concluirInspeccionTecnicaV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const retorno = texto(formData, "retorno");
  if (!inspeccionId) redirect("/panel/inspecciones");
  const { usuario, inspeccion } = await exigirInspectorV1(inspeccionId);

  const error = await validarCierreCampo(inspeccionId);
  if (error) volver(inspeccionId, "error", error);

  const [control] = await prisma.$queryRaw<Array<{
    inspeccionTecnicaConcluidaEn: Date | null;
    campoFinalizadoEn: Date | null;
  }>>`
    SELECT "inspeccionTecnicaConcluidaEn","campoFinalizadoEn"
    FROM "InspeccionControlV2"
    WHERE "inspeccionId"=${inspeccionId}
    LIMIT 1
  `;

  if (control?.campoFinalizadoEn) {
    volver(inspeccionId, "error", "La visita ya fue cerrada.");
  }
  if (control?.inspeccionTecnicaConcluidaEn) {
    volver(inspeccionId, "error", "La inspección técnica ya fue concluida por el Inspector.");
  }

  const metricas = await obtenerMetricasV1(inspeccionId);
  const [versionActual] = await prisma.$queryRaw<Array<{ version: number }>>`
    SELECT COALESCE(MAX("version"),0)::int AS "version"
    FROM "PreReporteInspeccion"
    WHERE "inspeccionId"=${inspeccionId}
  `;
  const version = Number(versionActual?.version ?? 0) + 1;
  const resumen = {
    etapa: "REVISION_CON_CLIENTE_EN_SITIO",
    definidos: metricas.definidos,
    noAplica: metricas.noAplica,
    aplicables: metricas.aplicables,
    revisados: metricas.revisados,
    totalHallazgos: metricas.totalHallazgos,
    prioridades: metricas.resumenPrioridades,
    semaforo: metricas.semaforo,
  };

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "InspeccionControlV2"
      SET "inspeccionTecnicaConcluidaEn"=NOW(),
          "inspeccionTecnicaConcluidaPorId"=${usuario.id},
          "preReporteGeneradoEn"=NOW(),
          "calificacionPreliminar"=${metricas.calificacion},
          "coberturaPorcentaje"=${metricas.cobertura},
          "resumenEstadistico"=${JSON.stringify(resumen)}::jsonb,
          "actualizadoEn"=NOW()
      WHERE "inspeccionId"=${inspeccionId}
    `;

    await tx.$executeRaw`
      INSERT INTO "PreReporteInspeccion"
        ("inspeccionId","version","generadoPorId","calificacionPreliminar","coberturaPorcentaje","resumen","leyenda")
      VALUES (
        ${inspeccionId},${version},${usuario.id},${metricas.calificacion},${metricas.cobertura},
        ${JSON.stringify(resumen)}::jsonb,
        'PRELIMINAR - GENERADO AL CONCLUIR EL RECORRIDO - PENDIENTE DE REVISION CON CLIENTE'
      )
    `;
  });

  await registrarAuditoria({
    tipo: TipoEvento.FINALIZAR_CAPTURA,
    entidad: "InspeccionControlV2",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `Inspector concluyó la inspección técnica V1 ${inspeccion.folio} y generó el PRE REPORTE versión ${version} para revisión con el cliente en sitio.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/cierre-v1`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/pre-reporte`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/reporte-v1`);
  if (retorno === "PRE_REPORTE") {
    redirect(`/panel/inspecciones/${inspeccionId}/reporte-v1?ok=${encodeURIComponent("Inspección concluida al 100%. PRE REPORTE generado para revisión con el cliente antes de retirarse del inmueble.")}`);
  }
  redirect(`/panel/inspecciones/${inspeccionId}/reporte-v1?ok=${encodeURIComponent("PRE REPORTE generado. Revísalo con el cliente y realiza los ajustes que procedan antes de firmas.")}`);
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

  const [ya] = await prisma.$queryRaw<Array<{
    inspeccionTecnicaConcluidaEn: Date | null;
    campoFinalizadoEn: Date | null;
    preReporteGeneradoEn: Date | null;
  }>>`
    SELECT "inspeccionTecnicaConcluidaEn","campoFinalizadoEn","preReporteGeneradoEn"
    FROM "InspeccionControlV2"
    WHERE "inspeccionId"=${inspeccionId}
    LIMIT 1
  `;
  if (!ya?.inspeccionTecnicaConcluidaEn) {
    volver(inspeccionId, "error", "Primero debes concluir formalmente la inspección técnica.");
  }
  if (!ya.preReporteGeneradoEn) {
    volver(inspeccionId, "error", "Después de concluir la inspección, revisa y confirma el reporte preliminar antes de cerrar la visita.");
  }
  if (ya.campoFinalizadoEn) volver(inspeccionId, "error", "El trabajo de campo ya fue terminado y la ventana de edición ya está activa.");

  await prisma.$executeRaw`
    UPDATE "InspeccionControlV2"
    SET "campoFinalizadoEn"=NOW(),
        "reporteLimiteEn"=NOW() + interval '12 hours',
        "revisionInspectorFinalEn"=NULL,
        "revisionInspectorFinalPorId"=NULL,
        "actualizadoEn"=NOW()
    WHERE "inspeccionId"=${inspeccionId}
  `;

  await registrarAuditoria({
    tipo: TipoEvento.FINALIZAR_CAPTURA,
    entidad: "InspeccionControlV2",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `Inspector terminó el trabajo de campo de ${inspeccion.folio} después de revisar el pre-reporte en sitio. Inicia la última revisión y ajuste del Inspector antes del envío a Dirección.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/cierre-v1`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
  volver(inspeccionId, "ok", "Visita cerrada. Ahora realiza la última revisión y ajuste del Inspector antes de solicitar la autorización del PRE REPORTE a Dirección.");
}

export async function confirmarRevisionFinalInspectorV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  if (!inspeccionId) redirect("/panel/inspecciones");
  const { usuario, inspeccion } = await exigirInspectorV1(inspeccionId);

  const [control] = await prisma.$queryRaw<Array<{
    campoFinalizadoEn: Date | null;
    preReporteGeneradoEn: Date | null;
    revisionInspectorFinalEn: Date | null;
  }>>`
    SELECT "campoFinalizadoEn","preReporteGeneradoEn","revisionInspectorFinalEn"
    FROM "InspeccionControlV2"
    WHERE "inspeccionId"=${inspeccionId}
    LIMIT 1
  `;

  if (!control?.preReporteGeneradoEn) volver(inspeccionId, "error", "Primero debes revisar el pre-reporte en sitio.");
  if (!control.campoFinalizadoEn) volver(inspeccionId, "error", "Primero debes cerrar formalmente la visita en el inmueble.");
  if (control.revisionInspectorFinalEn) volver(inspeccionId, "error", "La revisión final del Inspector ya fue confirmada.");

  const error = await validarCierreCampo(inspeccionId);
  if (error) volver(inspeccionId, "error", error);

  const reabiertaEn = await prisma.$queryRaw<Array<{ reabiertaEn: Date | null }>>`
    SELECT "reabiertaEn" FROM "InspeccionControlV2" WHERE "inspeccionId"=${inspeccionId} LIMIT 1
  `;
  const desde = reabiertaEn[0]?.reabiertaEn ? new Date(reabiertaEn[0].reabiertaEn as Date) : null;
  const firmasVigentes = inspeccion.firmas.filter(
    (firma) => !desde || new Date(firma.firmadaEn) >= desde,
  );
  const firmaInspector = firmasVigentes.some((firma) => firma.tipo.toLowerCase().includes("inspector"));
  const firmaCliente = firmasVigentes.some((firma) => firma.tipo.toLowerCase().includes("cliente"));
  if (!firmaInspector || !firmaCliente) {
    volver(inspeccionId, "error", "Antes de confirmar la revisión final deben estar vigentes las firmas del Inspector y del cliente.");
  }

  await prisma.$executeRaw`
    UPDATE "InspeccionControlV2"
    SET "revisionInspectorFinalEn"=NOW(),
        "revisionInspectorFinalPorId"=${usuario.id},
        "actualizadoEn"=NOW()
    WHERE "inspeccionId"=${inspeccionId}
  `;

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "InspeccionControlV2",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `Inspector confirmó la última revisión y ajuste del reporte V1 ${inspeccion.folio}. El expediente queda listo para envío a Dirección.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/cierre-v1`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/reporte-v1`);
  volver(inspeccionId, "ok", "Revisión final del Inspector confirmada. Ya puedes solicitar la autorización del PRE REPORTE a Dirección.");
}

export async function enviarReporteDireccionV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  if (!inspeccionId) redirect("/panel/inspecciones");
  const { usuario, inspeccion } = await exigirInspectorV1(inspeccionId);

  const [control] = await prisma.$queryRaw<Array<{
    campoFinalizadoEn: Date | null;
    preReporteGeneradoEn: Date | null;
    reporteLimiteEn: Date | null;
    reabiertaEn: Date | null;
    revisionInspectorFinalEn: Date | null;
  }>>`
    SELECT "campoFinalizadoEn","preReporteGeneradoEn","reporteLimiteEn","reabiertaEn","revisionInspectorFinalEn"
    FROM "InspeccionControlV2"
    WHERE "inspeccionId"=${inspeccionId}
    LIMIT 1
  `;
  if (!control?.preReporteGeneradoEn) {
    const metricas = await obtenerMetricasV1(inspeccionId);
    const [versionActual] = await prisma.$queryRaw<Array<{ version: number }>>`
      SELECT COALESCE(MAX("version"),0)::int AS "version"
      FROM "PreReporteInspeccion"
      WHERE "inspeccionId"=${inspeccionId}
    `;
    const version = Number(versionActual?.version ?? 0) + 1;
    const resumen = {
      etapa: "LISTO_PARA_DIRECCION",
      definidos: metricas.definidos,
      noAplica: metricas.noAplica,
      aplicables: metricas.aplicables,
      revisados: metricas.revisados,
      totalHallazgos: metricas.totalHallazgos,
      prioridades: metricas.resumenPrioridades,
      semaforo: metricas.semaforo,
    };
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "InspeccionControlV2"
        SET "preReporteGeneradoEn"=NOW(),
            "calificacionPreliminar"=${metricas.calificacion},
            "coberturaPorcentaje"=${metricas.cobertura},
            "resumenEstadistico"=${JSON.stringify(resumen)}::jsonb,
            "actualizadoEn"=NOW()
        WHERE "inspeccionId"=${inspeccionId}
      `;
      await tx.$executeRaw`
        INSERT INTO "PreReporteInspeccion"
          ("inspeccionId","version","generadoPorId","calificacionPreliminar","coberturaPorcentaje","resumen","leyenda")
        VALUES (
          ${inspeccionId},${version},${usuario.id},${metricas.calificacion},${metricas.cobertura},
          ${JSON.stringify(resumen)}::jsonb,
          'PRELIMINAR - REGENERADO AUTOMATICAMENTE ANTES DE SOLICITAR AUTORIZACION'
        )
      `;
    });
  }

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
        : "Antes de solicitar la autorización del PRE REPORTE a Dirección deben estar registradas las firmas del Inspector y del cliente.",
    );
  }

  const fueraDePlazo = Boolean(control.reporteLimiteEn && new Date() > new Date(control.reporteLimiteEn));

  try {
    await prisma.$transaction(async (tx) => {
      await tx.inspeccion.update({ where: { id: inspeccionId }, data: { estado: EstadoInspeccion.REPORTE_PENDIENTE } });
      await tx.revisionInspeccion.updateMany({
        where: {
          inspeccionId,
          rol: RolUsuario.DIRECTOR,
          decision: TipoDecisionRevision.DEVUELTO_INSPECTOR,
          estado: EstadoDecisionRevision.VIGENTE,
        },
        data: { estado: EstadoDecisionRevision.SUPERADA },
      });
      await tx.$executeRaw`
        UPDATE "InspeccionControlV2"
        SET "campoFinalizadoEn"=COALESCE("campoFinalizadoEn",NOW()),
            "reporteLimiteEn"=COALESCE("reporteLimiteEn",NOW() + interval '12 hours'),
            "revisionInspectorFinalEn"=COALESCE("revisionInspectorFinalEn",NOW()),
            "revisionInspectorFinalPorId"=COALESCE("revisionInspectorFinalPorId",${usuario.id}),
            "capturaCerrada"=true,
            "capturaCerradaEn"=NOW(),
            "capturaCerradaPorId"=${usuario.id},
            "actualizadoEn"=NOW()
        WHERE "inspeccionId"=${inspeccionId}
      `;
    });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "";
    const idx = mensaje.indexOf("No se puede finalizar");
    volver(inspeccionId, "error", idx >= 0 ? mensaje.slice(idx).split("\n")[0] : "No fue posible solicitar la autorización del PRE REPORTE a Dirección. Revisa los requisitos pendientes.");
  }

  await registrarAuditoria({
    tipo: TipoEvento.FINALIZAR_CAPTURA,
    entidad: "Inspeccion",
    entidadId: inspeccionId,
    inspeccionId,
    cotizacionId: inspeccion.cotizacionId,
    usuarioId: usuario.id,
    descripcion: fueraDePlazo
      ? `PRE REPORTE V1 enviado o reenviado a Dirección fuera de la ventana objetivo de 12 horas, después de la revisión final del Inspector.`
      : `PRE REPORTE V1 enviado o reenviado a Dirección después de la revisión final del Inspector.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/revision`);
  redirect(`/panel/inspecciones/${inspeccionId}?ok=${encodeURIComponent("PRE REPORTE enviado a Dirección. El Inspector queda en modo de solo lectura hasta autorización o devolución con observaciones.")}`);
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
            "inspeccionTecnicaConcluidaEn"=NULL,
            "inspeccionTecnicaConcluidaPorId"=NULL,
            "preReporteGeneradoEn"=NULL,
            "revisionInspectorFinalEn"=NULL,
            "revisionInspectorFinalPorId"=NULL,
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
            "revisionInspectorFinalEn"=NULL,
            "revisionInspectorFinalPorId"=NULL,
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
