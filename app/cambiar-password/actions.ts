"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function texto(formData: FormData, campo: string) {
  return String(formData.get(campo) ?? "").trim();
}

function destinoSeguro(valor: string) {
  return valor.startsWith("/") && !valor.startsWith("//") ? valor : "/panel";
}

export async function cambiarPasswordTemporal(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const actual = texto(formData, "passwordActual");
  const nueva = texto(formData, "passwordNueva");
  const confirmar = texto(formData, "passwordConfirmar");
  const callbackUrl = destinoSeguro(texto(formData, "callbackUrl") || "/panel");

  if (nueva.length < 8) {
    redirect(`/cambiar-password?error=${encodeURIComponent("La nueva contraseña debe tener al menos 8 caracteres.")}&callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  if (nueva !== confirmar) {
    redirect(`/cambiar-password?error=${encodeURIComponent("La confirmación de contraseña no coincide.")}&callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  if (actual === nueva) {
    redirect(`/cambiar-password?error=${encodeURIComponent("La nueva contraseña debe ser diferente a la contraseña temporal.")}&callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, passwordHash: true, activo: true, requiereCambioPassword: true },
  });

  if (!usuario?.activo) redirect("/acceso");
  if (!usuario.requiereCambioPassword) redirect(callbackUrl);

  const actualValida = await bcrypt.compare(actual, usuario.passwordHash);
  if (!actualValida) {
    redirect(`/cambiar-password?error=${encodeURIComponent("La contraseña temporal actual no es correcta.")}&callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const passwordHash = await bcrypt.hash(nueva, 12);
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      passwordHash,
      requiereCambioPassword: false,
      intentosFallidos: 0,
      bloqueadoHasta: null,
      ultimoFalloLogin: null,
    },
  });

  redirect(`${callbackUrl}${callbackUrl.includes("?") ? "&" : "?"}ok=${encodeURIComponent("Contraseña personal establecida correctamente.")}`);
}
