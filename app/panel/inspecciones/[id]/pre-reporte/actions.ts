"use server";

import { EstadoInspeccion, RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { obtenerMetricasV1 } from "@/lib/calificacion-v1";
import { prisma } from "@/lib/prisma";

const DECISIONES = [
  "RECIBO_LA_VIVIENDA",
  "NO_RECIBO_LA_VIVIENDA",
  "PREFIERO_ESPERAR_EL_REPORTE_FINAL",
  "NO_DESEO_REGISTRAR_DECISION",
] as const;

type DecisionCliente = (typeof DECISIONES)[number];

async function exigirInspectorV1(inspeccionId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, rol: true, activo: true, inspector: { select: { id: true, activo: true } } },
  });
  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: { id: true, folio: true, numeroInspeccion: true, estado: true, inspectorId: true },
  });

  if (!usuario?.activo || usuario.rol !== RolUsuario.INSPECTOR || !usuario.inspector?.activo) redirect("/acceso");
  if (!inspeccion || inspeccion.numeroInspeccion !== 1 || inspeccion.inspectorId !== usuario.inspector.id) redirect("/acceso");
  if (inspeccion.estado !== EstadoInspeccion.EN_PROCESO) {
    redirect(`/panel/inspecciones/${inspeccionId}/pre-reporte?error=${encodeURIComponent("El pre-reporte en sitio sólo puede confirmarse mientras la V1 está EN PROCESO.")}`);
  }
  return { usuario, inspeccion };
}

async function validarTecnicoListoPreReporte(inspeccionId: string) {
  const [r] = await prisma.$queryRaw<Array<{
    areasTotal: number;
    areasCompletas: number;
    protocoloTotal: number;
    protocoloCompleto: number;
    hallazgosIncompletos: number;
    syncPendientes: number;
    portadaFachada: number;
  }>>`
    SELECT
      (SELECT COUNT(*)::int
       FROM "AreaInspeccion" a
       WHERE a."inspeccionId"=${inspeccionId}
         AND a."obligatoria"=true
         AND a."tipo" <> 'PUNTO_CRITICO') AS "areasTotal",
      (SELECT COUNT(*)::int
       FROM "AreaInspeccion" a
       WHERE a."inspeccionId"=${inspeccionId}
         AND a."obligatoria"=true
         AND a."tipo" <> 'PUNTO_CRITICO'
         AND a."estado"='REVISADA'
         AND a."resultado" IN ('SIN_HALLAZGOS','CON_HALLAZGOS')) AS "areasCompletas",
      (SELECT COUNT(*)::int
       FROM "ProtocoloInspeccionPaso" p
       WHERE p."inspeccionId"=${inspeccionId}
         AND p."obligatorio"=true) AS "protocoloTotal",
      (SELECT COUNT(*)::int
       FROM "ProtocoloInspeccionPaso" p
       WHERE p."inspeccionId"=${inspeccionId}
         AND p."obligatorio"=true
         AND p."estado" IN ('COMPLETADO','NO_APLICA')) AS "protocoloCompleto",
      (SELECT COUNT(*)::int
       FROM "Hallazgo" h
       WHERE h."inspeccionId"=${inspeccionId}
         AND (
           (SELECT COUNT(*) FROM "Fotografia" f WHERE f."hallazgoId"=h."id") < 4
           OR nullif(btrim(coalesce(h."descripcion",'')),'') IS NULL
         )) AS "hallazgosIncompletos",
      (SELECT COUNT(*)::int
       FROM "OperacionCampoSync" s
       WHERE s."inspeccionId"=${inspeccionId}
         AND s."estado" <> 'PROCESADA') AS "syncPendientes",
      (SELECT COUNT(*)::int
       FROM "AreaInspeccion" a
       JOIN "FotografiaArea" fa ON fa."areaId"=a."id"
       WHERE a."inspeccionId"=${inspeccionId}
         AND a."codigo" IN ('FACHADA_FRONTAL','FACHADA_PRINCIPAL')
         AND fa."candidataPortada"=true) AS "portadaFachada"
  `;

  if (!r || r.areasTotal === 0) return "No existen áreas obligatorias configuradas.";
  if (r.areasCompletas !== r.areasTotal) return `Faltan ${r.areasTotal - r.areasCompletas} área(s) por concluir al 100%.`;
  if (r.protocoloTotal === 0 || r.protocoloCompleto !== r.protocoloTotal) return "Faltan procesos técnicos obligatorios por completar, incluyendo las lecturas finales que correspondan.";
  if (r.hallazgosIncompletos > 0) return `Existen ${r.hallazgosIncompletos} hallazgo(s) con evidencia o descripción incompleta.`;
  if (r.syncPendientes > 0) return `Existen ${r.syncPendientes} operación(es) pendientes de sincronizar.`;
  if (r.portadaFachada !== 1) return "Debes seleccionar exactamente una fotografía de fachada frontal para la portada.";
  return null;
}

export async function confirmarPreReporteSitioV1(formData: FormData) {
  const inspeccionId = String(formData.get("inspeccionId") ?? "").trim();
  if (!inspeccionId) redirect("/panel/inspecciones");

  const { usuario, inspeccion } = await exigirInspectorV1(inspeccionId);
  const error = await validarTecnicoListoPreReporte(inspeccionId);
  if (error) {
    redirect(`/panel/inspecciones/${inspeccionId}/pre-reporte?error=${encodeURIComponent(error)}`);
  }

  const [control] = await prisma.$queryRaw<Array<{ campoFinalizadoEn: Date | null }>>`
    SELECT "campoFinalizadoEn"
    FROM "InspeccionControlV2"
    WHERE "inspeccionId"=${inspeccionId}
    LIMIT 1
  `;
  if (control?.campoFinalizadoEn) {
    redirect(`/panel/inspecciones/${inspeccionId}/pre-reporte?error=${encodeURIComponent("La visita ya fue cerrada en sitio. La revisión preliminar debía confirmarse antes de que el Inspector se retirara del inmueble.")}`);
  }

  const metricas = await obtenerMetricasV1(inspeccionId);
  const [versionActual] = await prisma.$queryRaw<Array<{ version: number }>>`
    SELECT COALESCE(MAX("version"),0)::int AS "version"
    FROM "PreReporteInspeccion"
    WHERE "inspeccionId"=${inspeccionId}
  `;
  const version = Number(versionActual?.version ?? 0) + 1;
  const resumen = {
    etapa: "REVISION_PRELIMINAR_EN_SITIO",
    definidos: metricas.definidos,
    noAplica: metricas.noAplica,
    aplicables: metricas.aplicables,
    revisados: metricas.revisados,
    areas: metricas.areas,
    areasSinHallazgos: metricas.areasSinHallazgos,
    totalHallazgos: metricas.totalHallazgos,
    prioridades: metricas.resumenPrioridades,
    semaforo: metricas.semaforo,
  };

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "PreReporteInspeccion"
        ("inspeccionId","version","generadoPorId","calificacionPreliminar","coberturaPorcentaje","resumen","leyenda")
      VALUES (
        ${inspeccionId},${version},${usuario.id},${metricas.calificacion},${metricas.cobertura},
        ${JSON.stringify(resumen)}::jsonb,
        'PRELIMINAR - REVISADO EN SITIO - PENDIENTE DE AJUSTE DEL INSPECTOR Y AUTORIZACION DE DIRECCION'
      )
    `;

    await tx.$executeRaw`
      UPDATE "InspeccionControlV2"
      SET "preReporteGeneradoEn"=NOW(),
          "calificacionPreliminar"=${metricas.calificacion},
          "coberturaPorcentaje"=${metricas.cobertura},
          "resumenEstadistico"=${JSON.stringify(resumen)}::jsonb,
          "actualizadoEn"=NOW()
      WHERE "inspeccionId"=${inspeccionId}
    `;
  });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "PreReporteInspeccion",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `Inspector confirmó la revisión preliminar en sitio del reporte V1 ${inspeccion.folio}, antes de retirarse del inmueble. Se generó versión ${version}.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/pre-reporte`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/cierre-v1`);
  redirect(`/panel/inspecciones/${inspeccionId}/pre-reporte?ok=${encodeURIComponent("Pre-reporte revisado en sitio. Si detectas algo por ajustar, corrígelo antes de terminar la visita y salir del inmueble.")}`);
}

export async function registrarDecisionClienteSitioV1(formData: FormData) {
  const inspeccionId = String(formData.get("inspeccionId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim() as DecisionCliente;
  if (!inspeccionId) redirect("/panel/inspecciones");
  if (!DECISIONES.includes(decision)) {
    redirect(`/panel/inspecciones/${inspeccionId}/pre-reporte?error=${encodeURIComponent("Selecciona una opción válida.")}`);
  }

  const { usuario, inspeccion } = await exigirInspectorV1(inspeccionId);

  const [control] = await prisma.$queryRaw<Array<{ preReporteGeneradoEn: Date | null }>>`
    SELECT "preReporteGeneradoEn"
    FROM "InspeccionControlV2"
    WHERE "inspeccionId"=${inspeccionId}
    LIMIT 1
  `;
  if (!control?.preReporteGeneradoEn) {
    redirect(`/panel/inspecciones/${inspeccionId}/pre-reporte?error=${encodeURIComponent("Primero confirma la revisión preliminar del reporte en sitio.")}`);
  }

  const [existente] = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"::text FROM "PreReporteInspeccion"
    WHERE "inspeccionId"=${inspeccionId}
    ORDER BY "generadoEn" DESC
    LIMIT 1
  `;

  if (existente) {
    await prisma.$executeRaw`
      UPDATE "PreReporteInspeccion"
      SET "decisionCliente"=${decision},"decisionRegistradaEn"=NOW()
      WHERE "id"=${existente.id}::uuid
    `;
  } else {
    await prisma.$executeRaw`
      INSERT INTO "PreReporteInspeccion" ("inspeccionId","version","generadoPorId","resumen","decisionCliente","decisionRegistradaEn")
      VALUES (${inspeccionId},1,${usuario.id},'{}'::jsonb,${decision},NOW())
    `;
  }

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "PreReporteInspeccion",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `Durante la presentación del pre-reporte V1 ${inspeccion.folio} se registró la decisión opcional del cliente: ${decision}.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/pre-reporte`);
  redirect(`/panel/inspecciones/${inspeccionId}/pre-reporte?ok=${encodeURIComponent("Decisión del cliente registrada en el pre-reporte.")}`);
}
