import { EstadoCotizacion } from "@prisma/client";

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
      inspeccion: { select: { id: true, folio: true } },
    },
  });

  if (!cotizacion) return { ok: false as const, error: "La cotización seleccionada no existe." };
  if (cotizacion.estado !== EstadoCotizacion.AUTORIZADA) {
    return { ok: false as const, error: "La cotización debe estar aceptada y autorizada antes de abrir una inspección." };
  }
  if (cotizacion.clienteId !== clienteId || cotizacion.inmuebleId !== inmuebleId) {
    return { ok: false as const, error: "El cliente y el inmueble deben corresponder exactamente a la cotización seleccionada." };
  }
  if (cotizacion.inspeccion) {
    return { ok: false as const, error: `La cotización ${cotizacion.folio} ya está vinculada a la inspección ${cotizacion.inspeccion.folio}.` };
  }

  const total = Number(cotizacion.total);
  const pagado = Number(cotizacion.montoPagado);
  const porcentaje = total > 0 ? pagado / total : 0;
  if (porcentaje < 0.5 && !cotizacion.excepcionApertura) {
    return { ok: false as const, error: "Se requiere al menos 50% de pago para abrir Nueva Inspección, salvo excepción autorizada por Dirección." };
  }

  return { ok: true as const, cotizacion };
}