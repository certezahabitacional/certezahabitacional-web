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
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = {
  inspectionId?: string;
  areaId?: string;
  itemId?: string;
  descripcionFinal?: string;
  clasificacion?: string;
  prioridad?: string;
  valorMedido?: string;
  valorProyecto?: string;
  unidadMedida?: string;
};

type Body = {
  clientMutationId?: string;
  operation?: string;
  payload?: Payload;
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
  const indice =
    hallazgos.reduce((s, h) => s + (pesos[h.clasificacion] ?? 0), 0) /
    hallazgos.length;
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
  if (body.operation !== "RESULT_AREA_CONCEPT_V1") {
    return NextResponse.json({ error: "Operación offline no soportada." }, { status: 400 });
  }

  const inspectionId = String(body.payload?.inspectionId ?? "").trim();
  const areaId = String(body.payload?.areaId ?? "").trim();
  const itemId = String(body.payload?.itemId ?? "").trim();
  const descripcionFinal = String(body.payload?.descripcionFinal ?? "").trim();
  const clasificacionTexto = String(body.payload?.clasificacion ?? "").trim().toUpperCase();
  const prioridadTexto = String(body.payload?.prioridad ?? "").trim().toUpperCase();
  const valorMedido = String(body.payload?.valorMedido ?? "").trim();
  const valorProyecto = String(body.payload?.valorProyecto ?? "").trim();
  const unidadMedida = String(body.payload?.unidadMedida ?? "").trim();

  if (!inspectionId || !areaId || !itemId || descripcionFinal.length < 10) {
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
    areaNombre: string;
    fotos: number;
  }>>`
    SELECT g."concepto",g."especificacion",g."observacion",g."estadoV3",g."origenV3",
      g."requiereMedicion",g."requiereComparacionProyecto",a."nombre" AS "areaNombre",
      (SELECT COUNT(*)::int FROM "FotografiaArea" fa WHERE fa."guiaItemId"=g."id") AS "fotos"
    FROM "GuiaInspeccionItem" g
    JOIN "AreaInspeccion" a ON a."id"=g."areaId"
    WHERE g."id"=${itemId}
      AND g."inspeccionId"=${inspectionId}
      AND g."areaId"=${areaId}::uuid
    LIMIT 1
  `;

  if (!item) {
    return NextResponse.json({ error: "Concepto no encontrado." }, { status: 404 });
  }

  if (item.estadoV3 !== "PENDIENTE") {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  if (Number(item.fotos) < 1 || Number(item.fotos) > 4) {
    return NextResponse.json({ error: "El concepto requiere entre 1 y 4 fotografías sincronizadas." }, { status: 409 });
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
      partida: item.areaNombre,
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

    if ([ClasificacionHallazgo.O, ClasificacionHallazgo.NC, ClasificacionHallazgo.CR].includes(clasificacion)) {
      const hallazgo = existente
        ? await tx.hallazgo.update({
            where: { id: existente.id },
            data: {
              area: item.areaNombre,
              areaId,
              titulo: `${item.areaNombre} · ${item.concepto}`,
              descripcion: descripcionFinal,
              clasificacion,
              prioridad: prioridadTexto as PrioridadHallazgo,
              textoIaOriginal: null,
              textoInspectorFinal: null,
            },
          })
        : await tx.hallazgo.create({
            data: {
              inspeccionId: inspectionId,
              creadoPorId: usuario.id,
              area: item.areaNombre,
              areaId,
              titulo: `${item.areaNombre} · ${item.concepto}`,
              descripcion: descripcionFinal,
              clasificacion,
              prioridad: prioridadTexto as PrioridadHallazgo,
              guiaItemId: itemId,
              textoIaOriginal: null,
              textoInspectorFinal: null,
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
  });

  const [estadoArea] = await prisma.$queryRaw<Array<{ pendientes: number; hallazgos: number }>>`
    SELECT
      (SELECT COUNT(*)::int
       FROM "GuiaInspeccionItem" g
       WHERE g."areaId"=${areaId}::uuid
         AND g."estadoV3" NOT IN ('REVISADO','CON_HALLAZGO','NO_APLICA')) AS "pendientes",
      (SELECT COUNT(*)::int
       FROM "Hallazgo" h
       WHERE h."inspeccionId"=${inspectionId}
         AND h."areaId"=${areaId}::uuid) AS "hallazgos"
  `;

  if (Number(estadoArea?.pendientes ?? 1) === 0) {
    const hallazgosArea = Number(estadoArea?.hallazgos ?? 0);
    const resultadoArea = hallazgosArea > 0 ? "CON_HALLAZGOS" : "SIN_HALLAZGOS";
    const comentarioArea = hallazgosArea > 0
      ? `Se registraron ${hallazgosArea} hallazgo(s) en ${item.areaNombre}.`
      : `Se realizó la inspección de ${item.areaNombre}. Todos los puntos aplicables quedaron resueltos sin hallazgos.`;

    await prisma.$executeRaw`
      UPDATE "AreaInspeccion"
      SET "estado"='REVISADA',
          "resultado"=${resultadoArea},
          "comentarioFinal"=COALESCE(NULLIF(BTRIM("comentarioFinal"),''),${comentarioArea}),
          "revisadaEn"=COALESCE("revisadaEn",NOW()),
          "cerradaEn"=COALESCE("cerradaEn",NOW()),
          "cerradaPorId"=COALESCE("cerradaPorId",${usuario.id}),
          "actualizadoEn"=NOW()
      WHERE "id"=${areaId}::uuid
        AND "inspeccionId"=${inspectionId}
    `;
  }

  await recalcularIndice(inspectionId);

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "GuiaInspeccionItem",
    entidadId: itemId,
    inspeccionId: inspectionId,
    usuarioId: usuario.id,
    descripcion: `Resultado capturado sin conexión y sincronizado para “${item.concepto}”: clasificación ${clasificacionTexto}, evaluación ${calificacionFinal}/100.`,
  });

  return NextResponse.json({ ok: true, calificacionFinal });
}
