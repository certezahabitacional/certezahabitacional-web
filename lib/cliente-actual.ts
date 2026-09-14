import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Fuente única de identidad para el portal del cliente.
 * Nunca resuelve el cliente por parámetros de URL ni por datos enviados desde el navegador.
 * El cliente siempre se obtiene a partir del usuario autenticado y de su zona asignada.
 */
const cargarClienteActual = cache(async () => {
  const session = await auth();

  if (!session?.user?.id) {
    return { autenticado: false as const, usuario: null };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      activo: true,
      rol: true,
      zonaId: true,
      cliente: true,
    },
  });

  return { autenticado: true as const, usuario };
});

export async function obtenerClienteActual() {
  const { autenticado, usuario } = await cargarClienteActual();

  if (!autenticado) {
    redirect("/login?callbackUrl=/portal");
  }

  if (!usuario || !usuario.activo) {
    redirect("/login?error=Usuario%20no%20disponible");
  }

  if (usuario.rol !== "CLIENTE") {
    redirect("/panel");
  }

  if (!usuario.zonaId) {
    redirect("/login?error=Cliente%20sin%20zona%20asignada");
  }

  if (!usuario.cliente || usuario.cliente.usuarioId !== usuario.id) {
    redirect("/login?error=Cliente%20sin%20perfil%20asociado");
  }

  return {
    ...usuario.cliente,
    zonaId: usuario.zonaId,
  };
}
