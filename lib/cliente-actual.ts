import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Fuente única de identidad para el portal del cliente.
 * Nunca resuelve el cliente por parámetros de URL ni por datos enviados desde el navegador.
 * El cliente siempre se obtiene a partir del usuario autenticado.
 */
export async function obtenerClienteActual() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/portal");
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      activo: true,
      rol: true,
      cliente: true,
    },
  });

  if (!usuario || !usuario.activo) {
    redirect("/login?error=Usuario%20no%20disponible");
  }

  if (usuario.rol !== "CLIENTE") {
    redirect("/panel");
  }

  if (!usuario.cliente || usuario.cliente.usuarioId !== usuario.id) {
    redirect("/login?error=Cliente%20sin%20perfil%20asociado");
  }

  return usuario.cliente;
}
