import { RolUsuario } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type RolAsignableInspeccion = "GERENTE" | "COORDINADOR" | "INSPECTOR";

export function rolAsignableDesdeUsuario(rol: RolUsuario): RolAsignableInspeccion | null {
  if (rol === RolUsuario.GERENTE) return "GERENTE";
  if (rol === RolUsuario.COORDINADOR) return "COORDINADOR";
  if (rol === RolUsuario.INSPECTOR) return "INSPECTOR";
  return null;
}

export async function usuarioAsignadoAInspeccion(
  inspeccionId: string,
  usuarioId: string,
  rol: RolAsignableInspeccion,
) {
  const filas = await prisma.$queryRaw<Array<{ existe: boolean }>>`
    SELECT EXISTS(
      SELECT 1
      FROM "AsignacionRolInspeccion"
      WHERE "inspeccionId" = ${inspeccionId}
        AND "usuarioId" = ${usuarioId}
        AND "rol" = ${rol}
    ) AS "existe"
  `;
  return Boolean(filas[0]?.existe);
}

export async function idsInspeccionesAsignadas(
  usuarioId: string,
  rol: RolAsignableInspeccion,
) {
  const filas = await prisma.$queryRaw<Array<{ inspeccionId: string }>>`
    SELECT "inspeccionId"
    FROM "AsignacionRolInspeccion"
    WHERE "usuarioId" = ${usuarioId}
      AND "rol" = ${rol}
  `;
  return filas.map((fila) => fila.inspeccionId);
}

export async function obtenerAsignacionesInspeccion(inspeccionId: string) {
  const filas = await prisma.$queryRaw<Array<{ usuarioId: string; rol: RolAsignableInspeccion }>>`
    SELECT "usuarioId", "rol"
    FROM "AsignacionRolInspeccion"
    WHERE "inspeccionId" = ${inspeccionId}
  `;

  return {
    gerenteId: filas.find((fila) => fila.rol === "GERENTE")?.usuarioId ?? null,
    coordinadorId: filas.find((fila) => fila.rol === "COORDINADOR")?.usuarioId ?? null,
    inspectorUsuarioId: filas.find((fila) => fila.rol === "INSPECTOR")?.usuarioId ?? null,
  };
}

export async function establecerAsignacionInspeccion(
  inspeccionId: string,
  rol: RolAsignableInspeccion,
  usuarioId: string | null,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      DELETE FROM "AsignacionRolInspeccion"
      WHERE "inspeccionId" = ${inspeccionId}
        AND "rol" = ${rol}
    `;

    if (usuarioId) {
      await tx.$executeRaw`
        INSERT INTO "AsignacionRolInspeccion" ("inspeccionId", "usuarioId", "rol")
        VALUES (${inspeccionId}, ${usuarioId}, ${rol})
      `;
    }
  });
}
