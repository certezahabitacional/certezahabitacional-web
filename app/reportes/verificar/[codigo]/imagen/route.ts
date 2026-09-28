import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { obtenerSupabaseAdmin } from "@/lib/supabase-admin";

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
      inspeccion: { select: { estado: true, numeroInspeccion: true } },
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

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";
  const sb = obtenerSupabaseAdmin();
  const { data, error } = await sb.storage.from(bucket).download(path);

  if (error || !data) {
    return NextResponse.json({ error: "Imagen no disponible." }, { status: 404 });
  }

  const bytes = Buffer.from(await data.arrayBuffer());
  const tipo = data.type || (
    path.toLowerCase().endsWith(".png") ? "image/png" :
    path.toLowerCase().endsWith(".webp") ? "image/webp" :
    "image/jpeg"
  );

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": tipo,
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
