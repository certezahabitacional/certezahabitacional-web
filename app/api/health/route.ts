import { RolUsuario } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { puede } from "@/lib/permisos";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      {
        ok: false,
        error: "No autorizado.",
      },
      {
        status: 401,
      },
    );
  }

  const usuario = await prisma.usuario.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      rol: true,
      activo: true,
    },
  });

  if (
    !usuario ||
    !usuario.activo ||
    usuario.rol !== RolUsuario.DIRECTOR ||
    !puede(usuario.rol, "CONFIGURACION_TOTAL")
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "Acceso denegado.",
      },
      {
        status: 403,
      },
    );
  }

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      ok: true,
      servicio: "Certeza Habitacional",
      baseDeDatos: "conectada",
      fecha: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "Fallo de salud de base de datos",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        servicio: "Certeza Habitacional",
        baseDeDatos: "sin conexión",
      },
      {
        status: 503,
      },
    );
  }
}
