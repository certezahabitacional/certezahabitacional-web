"use server";

import { RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function redirigirError(mensaje: string): never {
  redirect(
    `/panel/agenda?error=${encodeURIComponent(mensaje)}`,
  );
}

/**
 * Acción heredada.
 *
 * La programación de inspecciones ya no se realiza directamente
 * desde Agenda. El flujo oficial es:
 *
 * Administración:
 *   cotización / requisitos / liberación administrativa
 *
 * Gerencia o Dirección:
 *   /panel/inspecciones/nueva
 *
 * Mantener esta Server Action exportada evita romper referencias
 * antiguas durante la transición, pero bloquea cualquier intento de
 * usarla como puerta trasera para crear una inspección.
 */
export async function agendarCotizacion(
  _formData: FormData,
): Promise<never> {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const usuario = await prisma.usuario.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      rol: true,
      activo: true,
    },
  });

  if (!usuario || !usuario.activo) {
    redirect("/acceso");
  }

  if (
    usuario.rol !== RolUsuario.GERENTE &&
    usuario.rol !== RolUsuario.DIRECTOR
  ) {
    redirigirError(
      "No tienes facultad para programar inspecciones.",
    );
  }

  redirigirError(
    "La programación directa desde Agenda fue deshabilitada. Usa «Nueva inspección» para programar el servicio mediante el flujo vigente.",
  );
}
