import {
  ClasificacionHallazgo,
  PrioridadHallazgo,
  RolUsuario,
  TipoEvento,
} from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { calificarPuntoConIaV1 } from "@/lib/calificacion-ia-v1";
import { PUNTOS_CRITICOS_V1 } from "@/lib/puntos-criticos-v1";
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
    descripcionFinal?: string;
    clasificacion?: string;
    prioridad?: string;
    valorMedido?: string;
    valorProyecto?: string;
    unidadMedida?: string;
  };
};

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

async function recalcularIndice(inspeccionId: string) {
  const hallazgos = await prisma.hallazgo.findMany({
    where: { inspeccionId },
    select: { clasificacion: true },
  });

  if (hallazgos.length === 0) {
    await prisma.inspeccion.update({
      where: { id: inspeccionId },
      data: { ish: 100, semaforo: "VERDE" },
    });
    return;
  }

  const pesos: Record<string, number> = { C: 100, O: 90, NC: 70, CR: 35 };
  const indice = hallazgos.reduce((s, h) => s + (pesos[h.clasificacion] ?? 0), 0) / hallazgos.length;
  const semaforo =
    indice >= 90 ? "VERDE" :
    indice >= 75 ? "AMARILLO" :
    indice >= 60 ? "NARANJA" : "ROJO";

  await prisma.inspeccion.update({
    where: { id: inspeccionId },
    data: { ish: indice, semaforo },
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  if (body.operation !== "RESULT_CRITICAL_CONCEPT_V1") {
    return NextResponse.json({ error: "Operación offline no soportada." }, { status: 400 });
  }

  const inspectionId = String(body.payload?.inspectionId ?? "").trim();
  const codigo = String(body.payload?.codigo ?? "").trim().toUpperCase();
  const itemId = String(body.payload?.itemId ?? "").trim();
  const descripcionFinal = String(body.payload?.descripcionFinal ?? "").trim();
  const clasificacionTexto = String(body.payload?.clasificacion ?? "").trim().toUpperCase();
  const prioridadTexto = String(body.payload?.prioridad ?? "").trim().toUpperCase();
  const valorMedido = String(body.payload?.valorMedido ?? "").trim();
  const valorProyecto = String(body.payload?.valorProyecto ?? "").trim();
  const unidadMedida = String(body.payload?.unidadMedida ?? "").trim();

  const punto = PUNTOS_CRITICOS_V1.find((p) => p.codigo === codigo);
  if (!inspectionId || !itemId || !punto || descripcionFinal.length < 10) {
    return NextResponse.json({ error: "Datos offline incompletos." }, { status: 400 });
  }

  if (!["C", "O", "NC", "CR"].includes(clasificacionTexto)) {
    return NextResponse.json({ error: "Clasificación inválida." }, { status: 400 });
  }
  if (clasificacionTexto !== "C" && !["P1", "P2", "P3", "P4", "P5"].includes(prioridadTexto)) {
    return NextResponse.json({ error: "Prioridad inválida." }, { status: 400 });
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
    especificacion: string | null;
    observacion: string | null;
    estadoV3: string;
    origenV3: string;
    requiereMedicion: boolean;
    requiereComparacionProyecto: boolean;
    fotos: number;
  }>>`
    SELECT g."concepto",g."especificacion",g."observacion",g."estadoV3",g."origenV3",
      g."requiereMedicion",g."requiereComparacionProyecto",
      (SELECT COUNT(*)::int FROM "FotografiaArea" fa WHERE fa."guiaItemId"=g."id") AS "fotos"
    FROM "GuiaInspeccionItem" g
    WHERE g."id"=${itemId}
      AND g."inspeccionId"=${inspectionId}
      AND g."area"=${`__PUNTO_CRITICO__:${codigo}`}
    LIMIT 1
  `;

  if (!item) {
    return NextResponse.json({ error: "Concepto crítico no encontrado." }, { status: 404 });
  }

  if (item.estadoV3 !== "PENDIENTE") {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  if (Number(item.fotos) < 1) {
    return NextResponse.json({ error: "Falta sincronizar la evidencia fotográfica del concepto." }, { status: 409 });
  }
  if (item.requiereMedicion && (!valorMedido || !unidadMedida)) {
    return NextResponse.json({ error: "Falta valor medido o unidad." }, { status: 409 });
  }
  if (item.requiereComparacionProyecto && item.origenV3 === "PROYECTO" && !valorProyecto) {
    return NextResponse.json({ error: "Falta valor de proyecto." }, { status: 409 });
  }

  const rutasEvidencia = await prisma.$queryRaw<Array<{ url: string }>>`
    SELECT f."url"
    FROM "FotografiaArea" fa
    JOIN "Fotografia" f ON f."id"=fa."fotografiaId"
    WHERE fa."guiaItemId"=${itemId}
    ORDER BY fa."orden",fa."creadoEn"
  `;

  let calificacionFinal = 100;
  let justificacionCalificacionIa = "Sin hallazgo: SH = 100.";

  if (clasificacionTexto !== "C") {
    const evaluacion = await calificarPuntoConIaV1({
      prioridad: prioridadTexto as PrioridadHallazgo,
      partida: punto.etiqueta,
      concepto: item.concepto,
      descripcionFinal,
      especificacion: item.especificacion,
      valorMedido: valorMedido || null,
      valorProyecto: valorProyecto || null,
      unidadMedida: unidadMedida || null,
      rutasEvidencia: rutasEvidencia.map((foto) => foto.url),
    });

    calificacionFinal = evaluacion.calificacion;
    justificacionCalificacionIa = evaluacion.justificacion;
  }

  const anterior = observacionObjeto(item.observacion);
  const observacion = {
    ...anterior,
    descripcionFinal,
    clasificacionFinal: clasificacionTexto,
    prioridadFinal: clasificacionTexto === "C" ? undefined : prioridadTexto,
    calificacionFinal,
    justificacionCalificacionIa,
    prioridadEvaluadaIa: clasificacionTexto === "C" ? "SH" : prioridadTexto,
    actualizadoEn: new Date().toISOString(),
  };

  const clasificacion = clasificacionTexto as ClasificacionHallazgo;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "GuiaInspeccionItem"
      SET "observacion"=${JSON.stringify(observacion)},
          "estadoV3"='REVISADO',
          "valorMedido"=${valorMedido || null},
          "valorProyecto"=${valorProyecto || null},
          "unidadMedida"=${unidadMedida || null},
          "completado"=true,
          "cerradoEn"=NOW(),
          "actualizadoEn"=NOW()
      WHERE "id"=${itemId}
        AND "inspeccionId"=${inspectionId}
        AND "estadoV3"='PENDIENTE'
    `;

    const existente = await tx.hallazgo.findFirst({
      where: { inspeccionId: inspectionId, guiaItemId: itemId },
      select: { id: true },
    });

    if (clasificacion !== ClasificacionHallazgo.C) {
      const hallazgo = existente
        ? await tx.hallazgo.update({
            where: { id: existente.id },
            data: {
              titulo: `${punto.etiqueta} · ${item.concepto}`,
              area: punto.etiqueta,
              descripcion: descripcionFinal,
              clasificacion,
              prioridad: prioridadTexto as PrioridadHallazgo,
              textoIaOriginal: null,
              textoInspectorFinal: descripcionFinal,
            },
          })
        : await tx.hallazgo.create({
            data: {
              inspeccionId: inspectionId,
              creadoPorId: usuario.id,
              area: punto.etiqueta,
              titulo: `${punto.etiqueta} · ${item.concepto}`,
              descripcion: descripcionFinal,
              clasificacion,
              prioridad: prioridadTexto as PrioridadHallazgo,
              guiaItemId: itemId,
              textoIaOriginal: null,
              textoInspectorFinal: descripcionFinal,
            },
          });

      await tx.$executeRaw`
        UPDATE "Fotografia"
        SET "hallazgoId"=${hallazgo.id}
        WHERE "id" IN (
          SELECT fa."fotografiaId"
          FROM "FotografiaArea" fa
          WHERE fa."guiaItemId"=${itemId}
        )
      `;
    } else if (existente) {
      await tx.fotografia.updateMany({
        where: { hallazgoId: existente.id },
        data: { hallazgoId: null },
      });
      await tx.hallazgo.delete({ where: { id: existente.id } });
    }

    if (/lectura final/i.test(item.concepto) && valorMedido) {
      await tx.$executeRaw`
        UPDATE "ProtocoloInspeccionPaso"
        SET "lecturaFinal"=${valorMedido},
            "unidad"=COALESCE(NULLIF(${unidadMedida},''),"unidad"),
            "actualizadoEn"=NOW()
        WHERE "inspeccionId"=${inspectionId}
          AND "clave"=${`PC_${codigo}`}
      `;
    }
  });

  await recalcularIndice(inspectionId);

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "GuiaInspeccionItem",
    entidadId: itemId,
    inspeccionId: inspectionId,
    usuarioId: usuario.id,
    descripcion: `Resultado crítico capturado sin conexión y sincronizado para “${item.concepto}”: clasificación ${clasificacionTexto}, evaluación ${calificacionFinal}/100.`,
  });

  return NextResponse.json({ ok: true, calificacionFinal });
}
