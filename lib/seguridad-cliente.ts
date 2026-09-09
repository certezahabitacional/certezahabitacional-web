import { prisma } from "@/lib/prisma";

/**
 * Defensa en profundidad para rutas con ID directo.
 * Estas funciones obligan a incluir clienteId en la consulta y evitan
 * que un ID válido de otro cliente pueda resolverse por accidente.
 */
export async function clientePoseeInspeccion(clienteId: string, inspeccionId: string) {
  return Boolean(
    await prisma.inspeccion.findFirst({
      where: { id: inspeccionId, clienteId },
      select: { id: true },
    }),
  );
}

export async function clientePoseeInmueble(clienteId: string, inmuebleId: string) {
  return Boolean(
    await prisma.inmueble.findFirst({
      where: { id: inmuebleId, clienteId },
      select: { id: true },
    }),
  );
}

export async function clientePoseeCotizacion(clienteId: string, cotizacionId: string) {
  return Boolean(
    await prisma.cotizacion.findFirst({
      where: { id: cotizacionId, clienteId },
      select: { id: true },
    }),
  );
}
