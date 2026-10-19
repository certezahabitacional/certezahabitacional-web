import { RolUsuario, TipoEvento } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  clientMutationId?: string;
  operation?: string;
  payload?: {
    inspectionId?: string;
    itemId?: string;
    motivo?: string;
  };
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  if (body.operation !== "NO_APLICA_CONCEPT_V1") {
    return NextResponse.json({ error: "Operación offline no soportada." }, { status: 400 });
  }

  const inspectionId = String(body.payload?.inspectionId ?? "").trim();
  const itemId = String(body.payload?.itemId ?? "").trim();
  const motivo = String(body.payload?.motivo ?? "").trim();

  if (!inspectionId || !itemId || motivo.length < 3) {
    return NextResponse.json({ error: "Datos offline incompletos." }, { status: 400 });
  }

  const [usuario, inspeccion] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        activo: true,
        rol: true,
        inspector: { select: { id: true, activo: true } },
      },
    }),
    prisma.inspeccion.findUnique({
      where: { id: inspectionId },
      select: { inspectorId: true, numeroInspeccion: true },
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

  if (!permitido || !usuario) {
    return NextResponse.json({ error: "No tienes acceso a esta inspección." }, { status: 403 });
  }

  const [item] = await prisma.$queryRaw<Array<{
    concepto: string;
    estadoV3: string;
  }>>`
    SELECT "concepto","estadoV3"
    FROM "GuiaInspeccionItem"
    WHERE "id"=${itemId} AND "inspeccionId"=${inspectionId}
    LIMIT 1
  `;

  if (!item) {
    return NextResponse.json({ error: "Concepto no encontrado." }, { status: 404 });
  }

  if (item.estadoV3 === "NO_APLICA") {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  if (item.estadoV3 !== "PENDIENTE") {
    return NextResponse.json({ error: "El concepto ya fue resuelto en otro dispositivo." }, { status: 409 });
  }

  await prisma.$executeRaw`
    UPDATE "GuiaInspeccionItem"
    SET "estadoV3"='NO_APLICA',
        "motivoNoAplica"=${motivo},
        "completado"=true,
        "cerradoEn"=NOW(),
        "actualizadoEn"=NOW()
    WHERE "id"=${itemId}
      AND "inspeccionId"=${inspectionId}
      AND "estadoV3"='PENDIENTE'
  `;

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "GuiaInspeccionItem",
    entidadId: itemId,
    inspeccionId: inspectionId,
    usuarioId: usuario.id,
    descripcion: `Cambio capturado sin conexión y sincronizado: “${item.concepto}” marcado NO APLICA. Motivo: ${motivo}`,
  });

  return NextResponse.json({ ok: true });
}
