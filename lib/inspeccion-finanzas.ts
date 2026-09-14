import { validarLiberacionCampoDesdeCaja } from "@/lib/caja-validaciones";
import { prisma } from "@/lib/prisma";

export async function validarInicioCampoPorCaja(inspeccionId: string) {
  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      id: true,
      folio: true,
      cotizacionId: true,
      inicioLiberadoSinPago: true,
    },
  });

  if (!inspeccion) {
    return { ok: false as const, error: "La inspección no existe." };
  }

  // Compatibilidad con expedientes históricos que no nacieron de una cotización.
  if (!inspeccion.cotizacionId) {
    return { ok: true as const, inspeccion, historica: true as const };
  }

  const validacion = await validarLiberacionCampoDesdeCaja(inspeccion.cotizacionId);
  if (!validacion.ok) {
    return {
      ok: false as const,
      error: validacion.error,
      inspeccion,
      financiero: "financiero" in validacion ? validacion.financiero : undefined,
    };
  }

  return {
    ok: true as const,
    inspeccion,
    financiero: validacion.financiero,
    liberadaPorExcepcion: validacion.financiero.liberacionPorExcepcion,
    liberadaPorPago: validacion.financiero.cumpleLiberacion100,
  };
}
