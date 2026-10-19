import { randomUUID } from "node:crypto";
import { RolUsuario, TipoEvento } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { PUNTOS_CRITICOS_V1 } from "@/lib/puntos-criticos-v1";
import { prisma } from "@/lib/prisma";
import { subirArchivoStorage } from "@/lib/storage-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  }

  const form = await request.formData();
  const clientMutationId = String(form.get("clientMutationId") ?? "").trim();
  const inspectionId = String(form.get("inspectionId") ?? "").trim();
  const codigo = String(form.get("codigo") ?? "").trim().toUpperCase();
  const itemId = String(form.get("itemId") ?? "").trim();
  const origin = String(form.get("origin") ?? "CAMARA").trim().toUpperCase();
  const file = form.get("file");

  const punto = PUNTOS_CRITICOS_V1.find((p) => p.codigo === codigo);

  if (!clientMutationId || !inspectionId || !itemId || !punto || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Datos offline incompletos." }, { status: 400 });
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return NextResponse.json({ error: "Formato de imagen no permitido." }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "La imagen supera 10 MB." }, { status: 400 });
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

  const existente = await prisma.fotografia.findFirst({
    where: {
      inspeccionId: inspectionId,
      descripcion: { contains: `[OFFLINE:${clientMutationId}]` },
    },
    select: { id: true },
  });

  if (existente) {
    return NextResponse.json({ ok: true, duplicate: true, fotografiaId: existente.id });
  }

  const [item] = await prisma.$queryRaw<Array<{
    concepto: string;
    estadoV3: string;
    fotos: number;
  }>>`
    SELECT g."concepto",g."estadoV3",
      (SELECT COUNT(*)::int FROM "FotografiaArea" fa WHERE fa."guiaItemId"=g."id") AS "fotos"
    FROM "GuiaInspeccionItem" g
    WHERE g."id"=${itemId}
      AND g."inspeccionId"=${inspectionId}
      AND g."area"=${`__PUNTO_CRITICO__:${codigo}`}
    LIMIT 1
  `;

  if (!item || item.estadoV3 !== "PENDIENTE") {
    return NextResponse.json({ error: "El concepto crítico ya no está disponible para captura." }, { status: 409 });
  }

  const limite = origin === "GALERIA" ? 1 : 4;
  if (Number(item.fotos) >= limite) {
    return NextResponse.json({ error: `El concepto ya tiene el máximo de ${limite} fotografía(s) para esta modalidad.` }, { status: 409 });
  }

  const extension =
    file.name.split(".").pop()?.toLowerCase() ||
    file.type.split("/").pop() ||
    "jpg";
  const ruta = `${inspectionId}/puntos-criticos/${codigo}/${itemId}/${randomUUID()}.${extension}`;

  await subirArchivoStorage({
    usuarioId: usuario.id,
    inspeccionId: inspectionId,
    bucket: "evidencias",
    ruta,
    archivo: file,
  });

  const orden = Number(item.fotos) + 1;

  const foto = await prisma.$transaction(async (tx) => {
    const creada = await tx.fotografia.create({
      data: {
        inspeccionId: inspectionId,
        hallazgoId: null,
        url: ruta,
        subidaPorId: usuario.id,
        descripcion: `[OFFLINE:${clientMutationId}] [ORIGEN:${origin === "GALERIA" ? "GALERIA" : "CAMARA"}] ${punto.etiqueta} · ${item.concepto} · evidencia ${orden}/${limite}`,
      },
    });

    await tx.$executeRaw`
      INSERT INTO "FotografiaArea"
        ("fotografiaId","areaId","guiaItemId","tipoEvidencia","orden","candidataReporte","candidataPortada","seleccionadaReporte")
      SELECT
        ${creada.id},a."id",${itemId},'PUNTO_CRITICO',${orden},true,false,true
      FROM "AreaInspeccion" a
      WHERE a."inspeccionId"=${inspectionId}
        AND a."codigo"=${`PC_${codigo}`}
      LIMIT 1
    `;

    await tx.$executeRaw`
      UPDATE "GuiaInspeccionItem"
      SET "observacion"=NULL,"actualizadoEn"=NOW()
      WHERE "id"=${itemId} AND "inspeccionId"=${inspectionId}
    `;

    return creada;
  });

  await registrarAuditoria({
    tipo: TipoEvento.SUBIR_EVIDENCIA,
    entidad: "FotografiaArea",
    inspeccionId: inspectionId,
    usuarioId: usuario.id,
    descripcion: `Evidencia crítica capturada sin conexión y sincronizada para “${item.concepto}”.`,
  });

  return NextResponse.json({ ok: true, fotografiaId: foto.id });
}
