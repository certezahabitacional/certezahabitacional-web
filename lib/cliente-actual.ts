import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function obtenerClienteActual() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/portal");
  }

  const usuarioId = session.user.id || null;
  const email = session.user.email?.toLowerCase() || null;

  if (!usuarioId && !email) {
    redirect("/login?callbackUrl=/portal");
  }

  const usuario = await prisma.usuario.findFirst({
    where: usuarioId
      ? {
          id: usuarioId,
        }
      : {
          email: email!,
        },
    include: {
      cliente: true,
    },
  });

  if (!usuario || !usuario.activo) {
    redirect("/login?error=Usuario%20no%20disponible");
  }

  if (usuario.rol !== "CLIENTE") {
    redirect("/panel");
  }

  if (!usuario.cliente) {
    redirect(
      "/login?error=Cliente%20sin%20perfil%20asociado",
    );
  }

  return usuario.cliente;
}