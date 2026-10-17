import { prisma } from "@/lib/prisma";

type Subpartida = { nombre?: string; conceptos?: Array<{ nombre?: string; aplica?: boolean }> };
type Partida = { orden?: number; nombre?: string; subpartidas?: Subpartida[] };

/** Crea áreas para un plan confirmado únicamente si no hay recorrido ya formado.
 * Preserva las áreas históricas y la fotografía de fachada.
 */
export async function crearAreasDesdePlanConfirmado(inspeccionId: string) {
  return prisma.$transaction(async (tx) => {
    const [plan] = await tx.$queryRaw<Array<{ partidas: unknown; confirmadoEn: Date | null }>>`
      SELECT "partidas","confirmadoEn" FROM "PlanPrevioInspeccion"
      WHERE "inspeccionId"=${inspeccionId} LIMIT 1
    `;
    if (!plan?.confirmadoEn || !Array.isArray(plan.partidas)) return 0;
    const [existentes] = await tx.$queryRaw<Array<{ total: number }>>`
      SELECT COUNT(*)::int AS "total" FROM "AreaInspeccion"
      WHERE "inspeccionId"=${inspeccionId} AND "codigo"<>'FACHADA_PRINCIPAL'
    `;
    if (Number(existentes?.total ?? 0) > 0) return 0;
    let agregadas = 0;
    for (const partida of plan.partidas as Partida[]) {
      if (!Number.isInteger(partida?.orden) || !Array.isArray(partida.subpartidas)) continue;
      for (const [indice, sub] of partida.subpartidas.entries()) {
        const nombre = typeof sub?.nombre === "string" ? sub.nombre.trim() : "";
        if (!nombre || !Array.isArray(sub.conceptos) || sub.conceptos.length === 0) continue;
        const codigo = `PLAN_${String(partida.orden).padStart(2, "0")}_${String(indice + 1).padStart(2, "0")}`;
        agregadas += await tx.$executeRaw`
          INSERT INTO "AreaInspeccion"
            ("inspeccionId","codigo","nombre","tipo","orden","origen","obligatoria")
          VALUES (${inspeccionId},${codigo},${nombre},'INTERIOR',${Number(partida.orden) * 100 + indice},'PLAN_PREVIO',true)
          ON CONFLICT ("inspeccionId","codigo") DO NOTHING
        `;
      }
    }
    return agregadas;
  });
}
