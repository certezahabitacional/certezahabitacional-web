import { validarAperturaDesdeCaja } from "@/lib/caja-validaciones";

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

  if (cotizacion.inspeccion) {
    return {
      ok: false as const,
      error: `La cotización ${cotizacion.folio} ya está vinculada a la inspección ${cotizacion.inspeccion.folio}.`,
    };
  }

  return { ok: true as const, cotizacion, resumenFinanciero: financiero };
}
