import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { agruparRecorridoPlan, validarEstructuraPlan, type AreaPlan, type ItemPlan } from "@/lib/estructura-plan-inspeccion";
export type LectorPlan = Pick<Prisma.TransactionClient, "$queryRaw">;
export async function obtenerPlanConfirmado(inspeccionId: string, db: LectorPlan = prisma) {
  const [plan] = await db.$queryRaw<Array<{ partidas: unknown; confirmadoEn: Date | null }>>`
    SELECT "partidas","confirmadoEn" FROM "PlanPrevioInspeccion" WHERE "inspeccionId"=${inspeccionId} LIMIT 1
  `;
  if (!plan?.confirmadoEn) return null;
  // Never fall back to the legacy catalog when a confirmed plan is malformed.
  return validarEstructuraPlan(plan.partidas);
}
export async function obtenerRecorridoConfirmado(inspeccionId: string, db: LectorPlan = prisma) {
  const plan = await obtenerPlanConfirmado(inspeccionId, db);
  if (!plan) return null;
  const [areas, items] = await Promise.all([
    db.$queryRaw<AreaPlan[]>`SELECT "id"::text,"codigo","nombre","estado","resultado" FROM "AreaInspeccion" WHERE "inspeccionId"=${inspeccionId} AND "origen"='PLAN_PREVIO' ORDER BY "orden"`,
    db.$queryRaw<ItemPlan[]>`SELECT g."id",g."areaId"::text,g."concepto",g."estadoV3" FROM "GuiaInspeccionItem" g LEFT JOIN "AreaInspeccion" a ON a."id"=g."areaId" WHERE g."inspeccionId"=${inspeccionId} AND (g."origenV3"='PLAN_PREVIO' OR a."origen"='PLAN_PREVIO') ORDER BY g."orden",g."creadoEn"`,
  ]);
  return agruparRecorridoPlan(plan, areas, items);
}
export async function validarCierrePlanConfirmado(inspeccionId: string) {
  let recorrido;
  try { recorrido = await obtenerRecorridoConfirmado(inspeccionId); }
  catch (e) { return e instanceof Error ? e.message : "El plan no está completo."; }
  if (!recorrido) return "No existe un plan confirmado.";
  const faltantes = recorrido.flatMap(p => p.subpartidas).filter(s => !s.cerrada);
  if (faltantes.length) return `Faltan ${faltantes.length} subpartida(s) por revisar y cerrar explícitamente.`;
  const [estado] = await prisma.$queryRaw<Array<{ portadas: number; hallazgosIncompletos: number; conceptosIncompletos: number; sincronizaciones: number }>>`
    SELECT
      (SELECT COUNT(*)::int FROM "FotografiaArea" fa JOIN "AreaInspeccion" a ON a."id"=fa."areaId" WHERE a."inspeccionId"=${inspeccionId} AND a."codigo" IN ('FACHADA_PRINCIPAL','FACHADA_FRONTAL') AND fa."candidataPortada"=true) AS "portadas",
      (SELECT COUNT(*)::int FROM "Hallazgo" h WHERE h."inspeccionId"=${inspeccionId} AND (nullif(btrim(coalesce(h."descripcion",'')),'') IS NULL OR (SELECT COUNT(*) FROM "Fotografia" f WHERE f."hallazgoId"=h."id") NOT BETWEEN 1 AND 4)) AS "hallazgosIncompletos",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g JOIN "AreaInspeccion" a ON a."id"=g."areaId"
       WHERE g."inspeccionId"=${inspeccionId} AND a."origen"='PLAN_PREVIO' AND (
         (g."estadoV3"='NO_APLICA' AND nullif(btrim(g."motivoNoAplica"),'') IS NULL)
         OR (g."estadoV3" IN ('REVISADO','CON_HALLAZGO') AND (
           nullif(btrim(g."observacion"),'') IS NULL
           OR (SELECT COUNT(*) FROM "FotografiaArea" fa WHERE fa."guiaItemId"=g."id") NOT BETWEEN 1 AND 4
           OR (g."requiereMedicion" AND (nullif(btrim(g."valorMedido"),'') IS NULL OR nullif(btrim(g."unidadMedida"),'') IS NULL))
         ))
       )) AS "conceptosIncompletos",
      (SELECT COUNT(*)::int FROM "OperacionCampoSync" WHERE "inspeccionId"=${inspeccionId} AND "estado"<>'PROCESADA') AS "sincronizaciones"
  `;
  if (!estado || estado.portadas !== 1) return "Debes conservar una fotografía de portada seleccionada.";
  if (estado.conceptosIncompletos) return "Existen conceptos con resultado, motivo No aplica, lectura o evidencias incompletas.";
  if (estado.hallazgosIncompletos) return "Existen hallazgos sin descripción final o evidencia completa.";
  if (estado.sincronizaciones) return "Hay operaciones de campo pendientes de sincronizar.";
  return null;
}
