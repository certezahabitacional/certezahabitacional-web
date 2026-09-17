import { EstadoInspeccion } from "@prisma/client";

import { obtenerAsignacionesInspeccion } from "@/lib/asignaciones-inspeccion";
import { validarAperturaDesdeCaja } from "@/lib/caja-validaciones";
import { prisma } from "@/lib/prisma";

export async function validarCotizacionParaNuevaInspeccion({
  cotizacionId,
  clienteId,
  inmuebleId,
}: {
  cotizacionId: string;
  clienteId: string;
  inmuebleId: string;
}) {
  const validacion = await validarAperturaDesdeCaja(cotizacionId);
  if (!validacion.ok) return validacion;

  const { cotizacion, financiero } = validacion;

  if (cotizacion.clienteId !== clienteId || cotizacion.inmuebleId !== inmuebleId) {
    return {
      ok: false as const,
      error: "El cliente y el inmueble deben corresponder exactamente a la cotización seleccionada.",
    };
  }

  if (!cotizacion.inspeccion) {
    return {
      ok: true as const,
      modo: "NUEVA" as const,
      cotizacion,
      resumenFinanciero: financiero,
    };
  }

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: cotizacion.inspeccion.id },
    select: {
      id: true,
      folio: true,
      estado: true,
      inspectorId: true,
      plantillaId: true,
      zonaId: true,
      fechaProgramada: true,
      observaciones: true,
      requiereGerenteZona: true,
      requiereCoordinador: true,
      inspeccionAnteriorId: true,
      numeroInspeccion: true,
      plantilla: {
        select: {
          requiereGerenteZona: true,
          requiereCoordinador: true,
        },
      },
    },
  });

  if (!inspeccion || inspeccion.estado !== EstadoInspeccion.PROGRAMADA) {
    return {
      ok: false as const,
      error: `La cotización ${cotizacion.folio} ya está vinculada a la inspección ${cotizacion.inspeccion.folio} y ya no puede retomarse desde Agendar Inspección.`,
    };
  }

  const asignaciones = await obtenerAsignacionesInspeccion(inspeccion.id);
  const requiereGerente =
    inspeccion.requiereGerenteZona ||
    Boolean(inspeccion.plantilla?.requiereGerenteZona);
  const requiereCoordinador =
    inspeccion.requiereCoordinador ||
    Boolean(inspeccion.plantilla?.requiereCoordinador);

  const faltantes: string[] = [];
  if (!inspeccion.inspectorId || !asignaciones.inspectorUsuarioId) {
    faltantes.push("Inspector");
  }
  if (requiereGerente && !asignaciones.gerenteId) {
    faltantes.push("Gerente");
  }
  if (requiereCoordinador && !asignaciones.coordinadorId) {
    faltantes.push("Coordinador");
  }

  if (faltantes.length === 0) {
    return {
      ok: false as const,
      error: `La cotización ${cotizacion.folio} ya está vinculada a la inspección ${inspeccion.folio} y su programación ya tiene completas las asignaciones requeridas.`,
    };
  }

  return {
    ok: true as const,
    modo: "RETOMAR" as const,
    cotizacion,
    resumenFinanciero: financiero,
    inspeccionExistente: {
      ...inspeccion,
      requiereGerenteZona: requiereGerente,
      requiereCoordinador,
      asignaciones,
      faltantes,
    },
  };
}
