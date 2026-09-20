import { EstadoInspeccion } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Cualquier cambio del Inspector mientras la V1 sigue EN_PROCESO invalida la
 * confirmación previa del pre-reporte y obliga a revisar la versión actualizada.
 *
 * Cuando el expediente ya fue enviado a Dirección (REPORTE_PENDIENTE), los
 * ajustes directos de Dirección no reabren el ciclo del Inspector: el reporte
 * sigue esperando autorización y la corrección queda trazada en auditoría.
 */
export async function invalidarPreReportePorAjusteV1(inspeccionId: string) {
  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: { estado: true },
  });

  if (!inspeccion || inspeccion.estado !== EstadoInspeccion.EN_PROCESO) return;

  await prisma.$executeRaw`
    UPDATE "InspeccionControlV2"
    SET "preReporteGeneradoEn"=NULL,
        "revisionInspectorFinalEn"=NULL,
        "revisionInspectorFinalPorId"=NULL,
        "actualizadoEn"=NOW()
    WHERE "inspeccionId"=${inspeccionId}
  `;
}
