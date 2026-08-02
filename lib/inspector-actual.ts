import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function obtenerInspectorActual() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect(
      "/login?callbackUrl=/inspector",
    );
  }

  if (
    session.user.role !== "INSPECTOR"
  ) {
    if (
      session.user.role === "CLIENTE"
    ) {
      redirect("/portal");
    }

    redirect("/panel");
  }

  const inspector =
    await prisma.inspector.findUnique({
      where: {
        usuarioId: session.user.id,
      },

      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            email: true,
            activo: true,
            rol: true,
          },
        },
      },
    });

  if (
    !inspector ||
    !inspector.activo ||
    !inspector.usuario.activo
  ) {
    redirect(
      "/login?error=Inspector%20inactivo%20o%20sin%20perfil",
    );
  }

  return inspector;
}