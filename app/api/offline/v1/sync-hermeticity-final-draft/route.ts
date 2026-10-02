import { RolUsuario, TipoEvento } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  operation?: string;
  payload?: {
    inspectionId?: string;
    codigo?: string;
    lecturaFinal?: string;
    unidad?: string;
    descripcionFinal?: string;
    clasificacion?: string;
    prioridad?: string;
  };
};

function numero(valor: string) {
  const match = valor.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

function observacionObjeto(valor: string | null) {
  if (!valor) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(valor);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Body;
  if (body.operation !== "HERMETICITY_FINAL_DRAFT_V1") {
    return NextResponse.json({ error: "Operación offline no soportada." }, { status: 400 });
  }

  const inspectionId = String(body.payload?.inspectionId ?? "").trim();
  const codigo = String(body.payload?.codigo ?? "").trim().toUpperCase();
  const lecturaFinal = String(body.payload?.lecturaFinal ?? "").trim();
  const unidad = String(body.payload?.unidad ?? "").trim();
  const descripcionFinal = String(body.payload?.descripcionFinal ?? "").trim();
  const clasificacion = String(body.payload?.clasificacion ?? "").trim().toUpperCase();
  const prioridad = String(body.payload?.prioridad ?? "").trim().toUpperCase();

  if (!inspectionId || !["HIDRAULICA","GAS"].includes(codigo) || numero(lecturaFinal) === null || !unidad) {
    return NextResponse.json({ error: "Datos de lectura final incompletos." }, { status: 400 });
  }
  if (descripcionFinal.length < 10 || !["C","O","NC","CR"].includes(clasificacion)) {
    return NextResponse.json({ error: "Interpretación o clasificación inválida." }, { status: 400 });
  }
  if (clasificacion !== "C" && !["P1","P2","P3","P4","P5"].includes(prioridad)) {
    return NextResponse.json({ error: "Prioridad inválida." }, { status: 400 });
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

  const [paso] = await prisma.$queryRaw<Array<{ lecturaInicial: string | null; lecturaFinal: string | null }>>`
    SELECT "lecturaInicial","lecturaFinal"
    FROM "ProtocoloInspeccionPaso"
    WHERE "inspeccionId"=${inspectionId} AND "clave"=${`PC_${codigo}`}
    LIMIT 1
  `;
  if (!paso?.lecturaInicial) return NextResponse.json({ error: "Falta la lectura inicial de la prueba." }, { status: 409 });
  if (paso.lecturaFinal) return NextResponse.json({ ok: true, duplicate: true });

  const [final] = await prisma.$queryRaw<Array<{ id: string; observacion: string | null; fotos: number }>>`
    SELECT g."id",g."observacion",
      (SELECT COUNT(*)::int FROM "FotografiaArea" fa WHERE fa."guiaItemId"=g."id") AS "fotos"
    FROM "GuiaInspeccionItem" g
    WHERE g."inspeccionId"=${inspectionId}
      AND g."area"=${`__PUNTO_CRITICO__:${codigo}`}
      AND g."concepto" ILIKE '%lectura final%'
    LIMIT 1
  `;
  if (!final || Number(final.fotos) < 1) {
    return NextResponse.json({ error: "Falta sincronizar la fotografía final del manómetro." }, { status: 409 });
  }

  const anterior = observacionObjeto(final.observacion);
  const observacion = {
    ...anterior,
    lecturaFinalPropuesta: lecturaFinal,
    unidadFinalPropuesta: unidad,
    descripcionFinal,
    clasificacionFinal: clasificacion,
    prioridadFinal: clasificacion === "C" ? "SH" : prioridad,
    offlinePendienteIa: true,
    offlineSincronizadoEn: new Date().toISOString(),
  };

  await prisma.$executeRaw`
    UPDATE "GuiaInspeccionItem"
    SET "observacion"=${JSON.stringify(observacion)},
        "valorMedido"=${lecturaFinal},
        "unidadMedida"=${unidad},
        "actualizadoEn"=NOW()
    WHERE "id"=${final.id} AND "inspeccionId"=${inspectionId}
  `;

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "GuiaInspeccionItem",
    entidadId: final.id,
    inspeccionId: inspectionId,
    usuarioId: usuario.id,
    descripcion: `Lectura final de hermeticidad ${codigo} capturada sin conexión y sincronizada como borrador pendiente de interpretación IA.`,
  });

  return NextResponse.json({ ok: true, pendingAi: true });
}
