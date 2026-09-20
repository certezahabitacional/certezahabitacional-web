import { prisma } from "@/lib/prisma";

/**
 * Cualquier cambio técnico/editorial posterior a un pre-reporte obliga a
 * revisar una nueva versión antes de que el Inspector pueda confirmar su
 * revisión final y enviarla a Dirección.
 */
export async function invalidarPreReportePorAjusteV1(inspeccionId: string) {
  await prisma.$executeRaw`
    UPDATE "InspeccionControlV2"
    SET "preReporteGeneradoEn"=NULL,
        "revisionInspectorFinalEn"=NULL,
        "revisionInspectorFinalPorId"=NULL,
        "actualizadoEn"=NOW()
    WHERE "inspeccionId"=${inspeccionId}
  `;
}
