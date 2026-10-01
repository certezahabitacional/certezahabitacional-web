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
    codigo?: string;
    itemId?: string;
    lecturaInicial?: string;
    unidad?: string;
  };
};

function numero(valor: string) {
  const match = valor.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Body;
  if (body.operation !== "HERMETICITY_START_V1") {
    return NextResponse.json({ error: "Operación offline no soportada." }, { status: 400 });
  }

  const inspectionId = String(body.payload?.inspectionId ?? "").trim();
  const codigo = String(body.payload?.codigo ?? "").trim().toUpperCase();
  const itemId = String(body.payload?.itemId ?? "").trim();
  const lecturaTexto = String(body.payload?.lecturaInicial ?? "").trim();
  const unidad = String(body.payload?.unidad ?? "").trim();
  const lectura = numero(lecturaTexto);

  if (!inspectionId || !itemId || !["HIDRAULICA","GAS"].includes(codigo) || lectura === null || !unidad) {
    return NextResponse.json({ error: "Datos de hermeticidad incompletos." }, { status: 400 });
  }

  const [usuario, inspeccion] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: { id: true, activo: true, rol: true, inspector: { select: { id: true, activo: true } } },
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
      (usuario.rol === RolUsuario.INSPECTOR && usuario.inspector?.activo && usuario.inspector.id === inspeccion.inspectorId)
    );

  if (!permitido || !usuario) return NextResponse.json({ error: "No tienes acceso a esta inspección." }, { status: 403 });

  const [paso] = await prisma.$queryRaw<Array<{ lecturaInicial: string | null }>>`
    SELECT "lecturaInicial"
    FROM "ProtocoloInspeccionPaso"
    WHERE "inspeccionId"=${inspectionId} AND "clave"=${`PC_${codigo}`}
    LIMIT 1
  `;
  if (!paso) return NextResponse.json({ error: "Prueba de hermeticidad no encontrada." }, { status: 404 });
  if (paso.lecturaInicial) return NextResponse.json({ ok: true, duplicate: true });

  const [item] = await prisma.$queryRaw<Array<{ fotos: number }>>`
    SELECT (SELECT COUNT(*)::int FROM "FotografiaArea" fa WHERE fa."guiaItemId"=g."id") AS "fotos"
    FROM "GuiaInspeccionItem" g
    WHERE g."id"=${itemId}
      AND g."inspeccionId"=${inspectionId}
      AND g."area"=${`__PUNTO_CRITICO__:${codigo}`}
      AND g."concepto" ILIKE '%manómetro%'
    LIMIT 1
  `;
  if (!item || Number(item.fotos) < 1) {
    return NextResponse.json({ error: "Falta sincronizar la fotografía inicial del manómetro." }, { status: 409 });
  }

  await prisma.$executeRaw`
    UPDATE "ProtocoloInspeccionPaso"
    SET "lecturaInicial"=CAST(${lectura} AS numeric),
        "unidad"=${unidad},
        "iniciadoEn"=COALESCE("iniciadoEn",NOW()),
        "actualizadoEn"=NOW()
    WHERE "inspeccionId"=${inspectionId}
      AND "clave"=${`PC_${codigo}`}
      AND "lecturaInicial" IS NULL
  `;

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "ProtocoloInspeccionPaso",
    inspeccionId: inspectionId,
    usuarioId: usuario.id,
    descripcion: `Lectura inicial de hermeticidad ${codigo} capturada sin conexión y sincronizada: ${lecturaTexto} ${unidad}.`,
  });

  return NextResponse.json({ ok: true });
}
