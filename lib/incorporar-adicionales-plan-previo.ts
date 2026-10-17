import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

type ConceptoPrevio = { nombre?: string; aplica?: boolean; adicional?: boolean };
type SubpartidaPrevia = { nombre?: string; conceptos?: ConceptoPrevio[] };
type PartidaPrevia = { subpartidas?: SubpartidaPrevia[] };

// Solo incorpora conceptos explícitamente añadidos en un plan CONFIRMADO.
// No elimina ni edita filas ya existentes, y la operación es repetible.
export async function incorporarAdicionalesConfirmados(inspeccionId: string, usuarioId: string) {
  const [plan] = await prisma.$queryRaw<Array<{ partidas: unknown; confirmadoEn: Date | null }>>`
    SELECT "partidas","confirmadoEn" FROM "PlanPrevioInspeccion"
    WHERE "inspeccionId"=${inspeccionId} LIMIT 1
  `;
  if (!plan?.confirmadoEn || !Array.isArray(plan.partidas)) return 0;
  const nuevos: Array<{ area: string; concepto: string }> = [];
  for (const partida of plan.partidas as PartidaPrevia[]) {
    for (const sub of Array.isArray(partida?.subpartidas) ? partida.subpartidas : []) {
      const area = typeof sub.nombre === "string" ? sub.nombre.trim() : "";
      if (!area) continue;
      for (const concepto of Array.isArray(sub.conceptos) ? sub.conceptos : []) {
        const nombre = typeof concepto.nombre === "string" ? concepto.nombre.trim() : "";
        if (nombre && concepto.adicional === true && concepto.aplica !== false) nuevos.push({ area, concepto: nombre });
      }
    }
  }
  let insertados = 0;
  for (const item of nuevos) {
    insertados += await prisma.$executeRaw`
      INSERT INTO "GuiaInspeccionItem"
        ("id","inspeccionId","origen","area","concepto","orden","obligatorio","completado","creadoPorId","estadoV3","origenV3","creadoEn","actualizadoEn")
      SELECT ${randomUUID()},${inspeccionId},'PLAN_PREVIO',${item.area},${item.concepto},
        COALESCE((SELECT MAX(g."orden")+10 FROM "GuiaInspeccionItem" g WHERE g."inspeccionId"=${inspeccionId}),100),
        true,false,${usuarioId},'PENDIENTE','PLAN_PREVIO',NOW(),NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM "GuiaInspeccionItem" g
        WHERE g."inspeccionId"=${inspeccionId} AND g."area"=${item.area} AND g."concepto"=${item.concepto}
      )
    `;
  }
  return insertados;
}
