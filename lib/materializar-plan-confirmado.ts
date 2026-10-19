import { exigirPersistenciaSeguraPlan } from "@/lib/seguridad-plan-confirmado";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { codigoAreaPlan } from "@/lib/estructura-plan-inspeccion";
import { obtenerPlanConfirmado, obtenerRecorridoConfirmado } from "@/lib/recorrido-plan-confirmado";
// ESTANDAR is an allowed persisted origin. origenV3 and areaId identify the confirmed plan.
// The caller locks Inspeccion first and commits the status transition in the SAME transaction.
// Recovery uses the same routine, explicitly, after checking and archiving the original state.
export async function materializarPlanConfirmado(tx: Prisma.TransactionClient, inspeccionId: string, usuarioId: string, recuperacion = false) {
  await exigirPersistenciaSeguraPlan(tx, true);
  const plan = await obtenerPlanConfirmado(inspeccionId, tx);
  if (!plan) throw new Error("Guarda y confirma el plan de partidas y conceptos antes de iniciar.");
  if (!recuperacion) {
    const [previo] = await tx.$queryRaw<Array<{ ajenas: number }>>`
      SELECT COUNT(*)::int AS "ajenas" FROM "AreaInspeccion"
      WHERE "inspeccionId"=${inspeccionId} AND "codigo"<>'FACHADA_PRINCIPAL' AND "origen"<>'PLAN_PREVIO'
    `;
    if (previo?.ajenas) throw new Error("Ya existe otro recorrido. Dirección debe revisar su recuperación; no se sobrescribirá.");
  }
  let areas = 0, conceptos = 0;
  for (const partida of plan) {
    for (const [indice, sub] of partida.subpartidas.entries()) {
      const codigo = codigoAreaPlan(partida.orden, indice);
      areas += await tx.$executeRaw`
        INSERT INTO "AreaInspeccion" ("inspeccionId","codigo","nombre","tipo","orden","origen","obligatoria")
        VALUES (${inspeccionId},${codigo},${sub.nombre},'INTERIOR',${partida.orden * 100 + indice},'PLAN_PREVIO',true)
        ON CONFLICT ("inspeccionId","codigo") DO NOTHING
      `;
      const [area] = await tx.$queryRaw<Array<{id: string; nombre: string; origen: string}>>`
        SELECT "id"::text,"nombre","origen" FROM "AreaInspeccion" WHERE "inspeccionId"=${inspeccionId} AND "codigo"=${codigo}
      `;
      if (!area || area.origen !== "PLAN_PREVIO" || area.nombre !== sub.nombre) throw new Error("Conflicto al vincular una subpartida del plan.");
      for (const [n, c] of sub.conceptos.entries()) {
        const medicion = partida.orden === 1 && ["Instalación hidráulica","Instalación de gas"].includes(sub.nombre) && ["Lectura inicial y foto","Lectura final y foto"].includes(c.nombre);
        conceptos += await tx.$executeRaw`
          INSERT INTO "GuiaInspeccionItem" ("id","inspeccionId","areaId","area","concepto","origen","origenV3","orden","obligatorio","completado","estadoV3","motivoNoAplica","creadoPorId","requiereMedicion","creadoEn","actualizadoEn")
          SELECT ${randomUUID()},${inspeccionId},${area.id}::uuid,${sub.nombre},${c.nombre},'ESTANDAR','PLAN_PREVIO',${partida.orden * 10000 + indice * 100 + n},${c.aplica},${!c.aplica},${c.aplica ? 'PENDIENTE' : 'NO_APLICA'},${c.aplica ? null : c.motivoNoAplica || 'No aplica según el plan previo confirmado'},${usuarioId},${medicion},NOW(),NOW()
          WHERE NOT EXISTS (SELECT 1 FROM "GuiaInspeccionItem" WHERE "inspeccionId"=${inspeccionId} AND "areaId"=${area.id}::uuid AND "concepto"=${c.nombre})
        `;
      }
    }
  }
  await obtenerRecorridoConfirmado(inspeccionId, tx); // Exact per-area coverage, not only total counts.
  await tx.$executeRaw`
    INSERT INTO "InspeccionControlV2" ("inspeccionId","proyectoConfirmado","areasConfirmadas")
    VALUES (${inspeccionId},false,true)
    ON CONFLICT ("inspeccionId") DO UPDATE SET "areasConfirmadas"=true,"actualizadoEn"=NOW()
  `;
  return { areas, conceptos };
}
