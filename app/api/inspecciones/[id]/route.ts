import {
  RolUsuario,
} from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      {
        error: "No autorizado",
      },
      {
        status: 401,
      },
    );
  }

  const { id } = await context.params;

  const usuarioActual =
    await prisma.usuario.findUnique({
      where: {
        id: session.user.id,
      },
      select: {
        id: true,
        rol: true,
        activo: true,
        zonaId: true,

        inspector: {
          select: {
            id: true,
            activo: true,
          },
        },
      },
    });

  if (
    !usuarioActual ||
    !usuarioActual.activo
  ) {
    return NextResponse.json(
      {
        error:
          "Usuario inactivo o no autorizado.",
      },
      {
        status: 403,
      },
    );
  }

  /*
   * CLIENTE
   *
   * El Cliente utiliza su propio Portal.
   * No debe consultar el expediente técnico
   * mediante esta API interna.
   */
  if (
    usuarioActual.rol ===
    RolUsuario.CLIENTE
  ) {
    return NextResponse.json(
      {
        error:
          "No tienes acceso al expediente técnico.",
      },
      {
        status: 403,
      },
    );
  }

  /*
   * ADMINISTRADOR
   *
   * Según la matriz de facultades,
   * Administración no tiene acceso
   * al expediente técnico.
   */
  if (
    usuarioActual.rol ===
    RolUsuario.ADMINISTRADOR
  ) {
    return NextResponse.json(
      {
        error:
          "Administración no tiene acceso al expediente técnico.",
      },
      {
        status: 403,
      },
    );
  }

  const inspeccion =
    await prisma.inspeccion.findUnique({
      where: {
        id,
      },

      select: {
        id: true,
        folio: true,
        direccion: true,
        ciudad: true,
        zonaId: true,
        inspectorId: true,

        cliente: {
          select: {
            nombre: true,
          },
        },

        inspector: {
          select: {
            usuarioId: true,

            usuario: {
              select: {
                nombre: true,
                zonaId: true,
                coordinadorId: true,
              },
            },
          },
        },
      },
    });

  if (!inspeccion) {
    return NextResponse.json(
      {
        error:
          "Expediente no encontrado",
      },
      {
        status: 404,
      },
    );
  }

  let tieneAcceso = false;

  /*
   * DIRECTOR
   *
   * Acceso global.
   */
  if (
    usuarioActual.rol ===
    RolUsuario.DIRECTOR
  ) {
    tieneAcceso = true;
  }

  /*
   * GERENTE
   *
   * Solo inspecciones dentro
   * de su zona.
   */
  if (
    usuarioActual.rol ===
    RolUsuario.GERENTE
  ) {
    tieneAcceso =
      Boolean(
        usuarioActual.zonaId,
      ) &&
      (
        inspeccion.zonaId ===
          usuarioActual.zonaId ||
        (
          inspeccion.zonaId === null &&
          inspeccion.inspector?.usuario
            .zonaId ===
            usuarioActual.zonaId
        )
      );
  }

  /*
   * COORDINADOR
   *
   * Solo inspecciones cuyo Inspector
   * pertenezca a su coordinación.
   */
  if (
    usuarioActual.rol ===
    RolUsuario.COORDINADOR
  ) {
    tieneAcceso =
      inspeccion.inspector?.usuario
        .coordinadorId ===
      usuarioActual.id;
  }

  /*
   * INSPECTOR
   *
   * Solo su propia inspección asignada.
   */
  if (
    usuarioActual.rol ===
    RolUsuario.INSPECTOR
  ) {
    tieneAcceso =
      Boolean(
        usuarioActual.inspector?.id &&
        usuarioActual.inspector.activo,
      ) &&
      inspeccion.inspectorId ===
        usuarioActual.inspector?.id &&
      inspeccion.inspector
        ?.usuarioId ===
        usuarioActual.id;
  }

  if (!tieneAcceso) {
    return NextResponse.json(
      {
        error:
          "No tienes acceso a esta inspección.",
      },
      {
        status: 403,
      },
    );
  }

  return NextResponse.json({
    id:
      inspeccion.id,

    folio:
      inspeccion.folio,

    cliente:
      inspeccion.cliente.nombre,

    inspector:
      inspeccion.inspector?.usuario
        .nombre ??
      "Sin asignar",

    direccion:
      inspeccion.direccion,

    ciudad:
      inspeccion.ciudad,
  });
}