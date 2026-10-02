import { NextResponse } from "next/server";
import { RolUsuario } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PUNTOS_CRITICOS_V1 } from "@/lib/puntos-criticos-v1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  }

  const [usuario, inspeccion] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: {
        activo: true,
        rol: true,
        inspector: { select: { id: true, activo: true } },
      },
    }),
    prisma.inspeccion.findUnique({
      where: { id },
      select: { numeroInspeccion: true, inspectorId: true },
    }),
  ]);

  const permitido =
    usuario?.activo &&
    inspeccion?.numeroInspeccion === 1 &&
    (
      usuario.rol === RolUsuario.DIRECTOR ||
      (
        usuario.rol === RolUsuario.INSPECTOR &&
        usuario.inspector?.activo &&
        usuario.inspector.id === inspeccion.inspectorId
      )
    );

  if (!permitido) {
    return NextResponse.json({ error: "No tienes acceso a esta inspección." }, { status: 403 });
  }

  const [control] = await prisma.$queryRaw<Array<{
    proyectoConfirmado: boolean;
    areasConfirmadas: boolean;
  }>>`
    SELECT "proyectoConfirmado","areasConfirmadas"
    FROM "InspeccionControlV2"
    WHERE "inspeccionId"=${id}
    LIMIT 1
  `;

  const pasos = await prisma.$queryRaw<Array<{
    clave: string;
    datos: unknown;
  }>>`
    SELECT "clave","datos"
    FROM "ProtocoloInspeccionPaso"
    WHERE "inspeccionId"=${id}
      AND "tipo"='PUNTO_CRITICO'
    ORDER BY "orden"
  `;

  const [areas] = await prisma.$queryRaw<Array<{ total: number; sinGuia: number }>>`
    SELECT
      COUNT(*)::int AS "total",
      COUNT(*) FILTER (
        WHERE NOT EXISTS (
          SELECT 1
          FROM "GuiaInspeccionItem" g
          WHERE g."inspeccionId"=${id}
            AND g."areaId"=a."id"
        )
      )::int AS "sinGuia"
    FROM "AreaInspeccion" a
    WHERE a."inspeccionId"=${id}
      AND a."tipo" <> 'PUNTO_CRITICO'
  `;

  const faltantesCriticos: string[] = [];

  for (const punto of PUNTOS_CRITICOS_V1) {
    const paso = pasos.find((p) => p.clave === `PC_${punto.codigo}`);
    const datos =
      paso?.datos && typeof paso.datos === "object" && !Array.isArray(paso.datos)
        ? paso.datos as Record<string, unknown>
        : {};

    const configurado = datos.configurado === true;
    const aplica = datos.aplica === true;
    const noAplica = datos.aplica === false;

    if (!configurado) {
      faltantesCriticos.push(`${punto.etiqueta}: falta definir alcance/fuente`);
      continue;
    }

    if (aplica) {
      const [conteo] = await prisma.$queryRaw<Array<{ total: number }>>`
        SELECT COUNT(*)::int AS "total"
        FROM "GuiaInspeccionItem"
        WHERE "inspeccionId"=${id}
          AND "area"=${`__PUNTO_CRITICO__:${punto.codigo}`}
      `;
      if (Number(conteo?.total ?? 0) === 0) {
        faltantesCriticos.push(`${punto.etiqueta}: falta generar plantilla técnica`);
      }
    } else if (!noAplica) {
      faltantesCriticos.push(`${punto.etiqueta}: configuración incompleta`);
    }
  }

  const bloqueos: string[] = [];
  if (!control?.proyectoConfirmado) bloqueos.push("Falta confirmar Proyecto/Plantilla.");
  if (!control?.areasConfirmadas) bloqueos.push("Falta confirmar las áreas del inmueble.");
  if (Number(areas?.total ?? 0) === 0) bloqueos.push("No hay áreas físicas preparadas.");
  if (Number(areas?.sinGuia ?? 0) > 0) {
    bloqueos.push(`${areas?.sinGuia} área(s) todavía no tienen guía de inspección preparada.`);
  }
  bloqueos.push(...faltantesCriticos);

  return NextResponse.json({
    ok: bloqueos.length === 0,
    bloqueos,
    resumen: {
      proyectoConfirmado: Boolean(control?.proyectoConfirmado),
      areasConfirmadas: Boolean(control?.areasConfirmadas),
      puntosCriticosConfigurados: PUNTOS_CRITICOS_V1.length - faltantesCriticos.length,
      puntosCriticosTotal: PUNTOS_CRITICOS_V1.length,
      areasTotal: Number(areas?.total ?? 0),
      areasSinGuia: Number(areas?.sinGuia ?? 0),
    },
  });
}
