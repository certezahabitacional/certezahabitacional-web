import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { urlFirmadaStorage } from "@/lib/storage-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const { codigo } = await params;
  const path = request.nextUrl.searchParams.get("path")?.trim();

  if (!path) {
    return NextResponse.json({ error: "Imagen no identificada." }, { status: 400 });
  }

  const certificado = await prisma.certificado.findUnique({
    where: { codigoValidacion: codigo },
    select: {
      vigente: true,
      inspeccionId: true,
      inspeccion: {
        select: {
          estado: true,
          numeroInspeccion: true,
          inspector: { select: { usuarioId: true } },
        },
      },
    },
  });

  if (
    !certificado?.vigente ||
    certificado.inspeccion.estado !== "FINALIZADA" ||
    certificado.inspeccion.numeroInspeccion !== 1 ||
    !path.startsWith(`${certificado.inspeccionId}/`)
  ) {
    return NextResponse.json({ error: "Imagen no disponible." }, { status: 404 });
  }

  const usuarioId = certificado.inspeccion.inspector?.usuarioId;
  if (!usuarioId) {
    console.error("No existe usuario técnico para firmar evidencia pública", {
      codigo,
      path,
      inspeccionId: certificado.inspeccionId,
    });
    return NextResponse.json({ error: "Imagen no disponible." }, { status: 404 });
  }

  let signedUrl: string | null = null;

  try {
    signedUrl = await urlFirmadaStorage(
      {
        usuarioId,
        inspeccionId: certificado.inspeccionId,
        bucket: "evidencias",
        ruta: path,
      },
      60 * 5,
    );
  } catch (error) {
    console.error("No fue posible firmar evidencia pública por gateway", {
      codigo,
      path,
      inspeccionId: certificado.inspeccionId,
      error,
    });
  }

  if (!signedUrl) {
    return NextResponse.json({ error: "Imagen no disponible." }, { status: 404 });
  }

  const respuesta = await fetch(signedUrl, { cache: "no-store" });

  if (!respuesta.ok) {
    console.error("Storage rechazó evidencia pública firmada", {
      codigo,
      path,
      status: respuesta.status,
    });
    return NextResponse.json({ error: "Imagen no disponible." }, { status: 404 });
  }

  const bytes = Buffer.from(await respuesta.arrayBuffer());
  const tipo =
    respuesta.headers.get("content-type") ||
    (path.toLowerCase().endsWith(".png")
      ? "image/png"
      : path.toLowerCase().endsWith(".webp")
        ? "image/webp"
        : "image/jpeg");

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": tipo,
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
