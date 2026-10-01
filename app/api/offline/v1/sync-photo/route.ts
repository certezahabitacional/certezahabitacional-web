import { randomUUID } from "node:crypto";
import { RolUsuario, TipoEvento } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
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
  const areaId = String(form.get("areaId") ?? "").trim();
  const itemId = String(form.get("itemId") ?? "").trim();
  const origin = String(form.get("origin") ?? "CAMARA").trim().toUpperCase();
  const file = form.get("file");

  if (!clientMutationId || !inspectionId || !areaId || !itemId || !(file instanceof File) || file.size === 0) {
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
      select: { id: true, inspectorId: true, numeroInspeccion: true, estado: true },
    }),
  ]);

  if (!usuario?.activo || !inspeccion || inspeccion.numeroInspeccion !== 1) {
    return NextResponse.json({ error: "Inspección no disponible." }, { status: 403 });
  }

  const permitido =
    usuario.rol === RolUsuario.DIRECTOR ||
    (
      usuario.rol === RolUsuario.INSPECTOR &&
      usuario.inspector?.activo &&
      usuario.inspector.id === inspeccion.inspectorId
    );

  if (!permitido) {
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
    areaNombre: string;
    estadoV3: string;
    fotos: number;
  }>>`
    SELECT g."concepto",a."nombre" AS "areaNombre",g."estadoV3",
      (SELECT COUNT(*)::int FROM "FotografiaArea" fa WHERE fa."guiaItemId"=g."id") AS "fotos"
    FROM "GuiaInspeccionItem" g
    JOIN "AreaInspeccion" a ON a."id"=g."areaId"
    WHERE g."id"=${itemId}
      AND g."inspeccionId"=${inspectionId}
      AND a."id"=${areaId}::uuid
    LIMIT 1
  `;

  if (!item || item.estadoV3 !== "PENDIENTE") {
    return NextResponse.json({ error: "El concepto ya no está disponible para captura." }, { status: 409 });
  }

  if (Number(item.fotos) >= 4) {
    return NextResponse.json({ error: "El concepto ya tiene 4 fotografías." }, { status: 409 });
  }

  const extension =
    file.name.split(".").pop()?.toLowerCase() ||
    file.type.split("/").pop() ||
    "jpg";
  const ruta = `${inspectionId}/areas/${areaId}/conceptos/${itemId}/${randomUUID()}.${extension}`;

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
        descripcion: `[OFFLINE:${clientMutationId}] [ORIGEN:${origin === "GALERIA" ? "GALERIA" : "CAMARA"}] ${item.areaNombre} · ${item.concepto} · evidencia ${orden}/4`,
      },
    });

    await tx.$executeRaw`
      INSERT INTO "FotografiaArea"
        ("fotografiaId","areaId","guiaItemId","tipoEvidencia","orden","candidataReporte","candidataPortada","seleccionadaReporte")
      VALUES
        (${creada.id},${areaId}::uuid,${itemId},'CONCEPTO_AREA',${orden},true,false,true)
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
    descripcion: `Evidencia capturada sin conexión y sincronizada posteriormente para “${item.concepto}”.`,
  });

  return NextResponse.json({ ok: true, fotografiaId: foto.id });
}
