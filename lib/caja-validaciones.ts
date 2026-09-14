import { EstadoCotizacion } from "@prisma/client";

import { calcularResumenFinancieroCaja } from "@/lib/caja-finanzas";
import { prisma } from "@/lib/prisma";

export async function obtenerValidacionFinancieraCotizacion(cotizacionId: string) {
  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id: cotizacionId },
    select: {
      id: true,
      folio: true,
      estado: true,
      clienteId: true,
      inmuebleId: true,
      total: true,
      montoPagado: true,
      excepcionApertura: true,
      excepcionInicio: true,
      inspeccion: {
        select: {
          id: true,
          folio: true,
          fechaProgramada: true,
          estado: true,
        },
      },
    },
  });

  if (!cotizacion) {
    return { ok: false as const, error: "La cotización no existe." };
  }

  if (cotizacion.estado !== EstadoCotizacion.AUTORIZADA) {
    return {
      ok: false as const,
      error: "La cotización debe estar aceptada y autorizada para continuar con el proceso operativo.",
      cotizacion,
    };
  }

  const financiero = calcularResumenFinancieroCaja({
    importe: Number(cotizacion.total),
    pagado: Number(cotizacion.montoPagado),
    excepcionApertura: cotizacion.excepcionApertura,
    excepcionInicio: cotizacion.excepcionInicio,
    tieneInspeccion: Boolean(cotizacion.inspeccion),
    fechaAgendada: cotizacion.inspeccion?.fechaProgramada ?? null,
  });

  return { ok: true as const, cotizacion, financiero };
}

export async function validarAperturaDesdeCaja(cotizacionId: string) {
  const resultado = await obtenerValidacionFinancieraCotizacion(cotizacionId);
  if (!resultado.ok) return resultado;

  if (!resultado.financiero.puedeAgendar) {
    return {
      ok: false as const,
      error: "Caja no autoriza la apertura/agendamiento: se requiere al menos 50% pagado o una excepción vigente autorizada por Director o Administrador.",
      cotizacion: resultado.cotizacion,
      financiero: resultado.financiero,
    };
  }

  return resultado;
}

export async function validarLiberacionCampoDesdeCaja(cotizacionId: string) {
  const resultado = await obtenerValidacionFinancieraCotizacion(cotizacionId);
  if (!resultado.ok) return resultado;

  if (!resultado.financiero.puedeLiberarCampo) {
    return {
      ok: false as const,
      error: "Caja no autoriza el inicio en campo: se requiere el 100% pagado o una excepción vigente autorizada por Director o Administrador.",
      cotizacion: resultado.cotizacion,
      financiero: resultado.financiero,
    };
  }

  return resultado;
}
