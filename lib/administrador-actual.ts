import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function obtenerAdministradorActual() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/panel/usuarios");
  }

  const administrador = await prisma.usuario.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      activo: true,
    },
  });

  if (!administrador?.activo) {
    redirect("/login");
  }

  if (administrador.rol !== "ADMINISTRADOR") {
    redirect("/panel");
  }

  return administrador;
}