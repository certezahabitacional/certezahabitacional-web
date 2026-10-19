import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

type ConceptoPrevio = { nombre?: string; aplica?: boolean; adicional?: boolean };
type SubpartidaPrevia = { nombre?: string; conceptos?: ConceptoPrevio[] };
type PartidaPrevia = { subpartidas?: SubpartidaPrevia[] };

// Incorpora conceptos base y adicionales de un plan CONFIRMADO, incluidos los No aplica.
// No elimina ni edita filas ya existentes, y la operación es repetible.
export async function incorporarAdicionalesConfirmados(inspeccionId: string, usuarioId: string) {
  const [plan] = await prisma.$queryRaw<Array<{ partidas: unknown; confirmadoEn: Date | null }>>`
    SELECT "partidas","confirmadoEn" FROM "PlanPrevioInspeccion"
    WHERE "inspeccionId"=${inspeccionId} LIMIT 1
  `;
  if (!plan?.confirmadoEn || !Array.isArray(plan.partidas)) return 0;
  const nuevos: Array<{ area: string; concepto: string; aplica: boolean }> = [];
  for (const partida of plan.partidas as PartidaPrevia[]) {
    for (const sub of Array.isArray(partida?.subpartidas) ? partida.subpartidas : []) {
      const area = typeof sub.nombre === "string" ? sub.nombre.trim() : "";
      if (!area) continue;
      for (const concepto of Array.isArray(sub.conceptos) ? sub.conceptos : []) {
        const nombre = typeof concepto.nombre === "string" ? concepto.nombre.trim() : "";
        if (nombre) nuevos.push({ area, concepto: nombre, aplica: concepto.aplica !== false });
      }
    }
  }
  let insertados = 0;
  for (const item of nuevos) {
    // Conciliar solo elementos pendientes, sin mediciones ni observaciones.
    // Nunca cambiar conceptos revisados, cerrados o con hallazgos.
    if (!item.aplica) {
      await prisma.$executeRaw`
        UPDATE "GuiaInspeccionItem" AS g
        SET "estadoV3"='NO_APLICA',
            "motivoNoAplica"='No aplica según el plan previo confirmado',
            "obligatorio"=false,"completado"=true,"actualizadoEn"=NOW()
        WHERE g."inspeccionId"=${inspeccionId}
          AND g."area"=${item.area} AND g."concepto"=${item.concepto}
          AND g."estadoV3"='PENDIENTE' AND g."completado"=false
          AND g."observacion" IS NULL AND g."valorMedido" IS NULL
          AND g."cerradoEn" IS NULL
          AND g."origen"='PLAN_PREVIO'
      `;
    }
    insertados += await prisma.$executeRaw`
      INSERT INTO "GuiaInspeccionItem"
        ("id","inspeccionId","origen","area","concepto","orden","obligatorio","completado","creadoPorId","estadoV3","motivoNoAplica","origenV3","creadoEn","actualizadoEn")
      SELECT ${randomUUID()},${inspeccionId},'PLAN_PREVIO',${item.area},${item.concepto},
        COALESCE((SELECT MAX(g."orden")+10 FROM "GuiaInspeccionItem" g WHERE g."inspeccionId"=${inspeccionId}),100),
        ${item.aplica},${!item.aplica},${usuarioId},${item.aplica ? 'PENDIENTE' : 'NO_APLICA'},${item.aplica ? null : 'No aplica según el plan previo confirmado'},'PLAN_PREVIO',NOW(),NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM "GuiaInspeccionItem" g
        WHERE g."inspeccionId"=${inspeccionId} AND g."area"=${item.area} AND g."concepto"=${item.concepto}
      )
    `;
  }
  return insertados;
}
