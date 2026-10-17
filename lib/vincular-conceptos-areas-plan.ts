import { prisma } from "@/lib/prisma";

/**
 * Relaciona únicamente conceptos de PLAN_PREVIO con áreas del mismo origen.
 * Exige coincidencia única por nombre para evitar asignaciones incorrectas.
 * No modifica hallazgos, medidas ni conceptos históricos.
 */
export async function vincularConceptosConAreasPlan(inspeccionId: string) {
  return prisma.$executeRaw`
    UPDATE "GuiaInspeccionItem" AS g
    SET "areaId"=a."id","actualizadoEn"=NOW()
    FROM "AreaInspeccion" AS a
    WHERE g."inspeccionId"=${inspeccionId}
      AND g."origen"='PLAN_PREVIO'
      AND g."areaId" IS NULL
      AND a."inspeccionId"=g."inspeccionId"
      AND a."origen"='PLAN_PREVIO'
      AND a."nombre"=g."area"
      AND 1=(
        SELECT COUNT(*) FROM "AreaInspeccion" AS otra
        WHERE otra."inspeccionId"=a."inspeccionId"
          AND otra."origen"='PLAN_PREVIO'
          AND otra."nombre"=a."nombre"
      )
  `;
}
