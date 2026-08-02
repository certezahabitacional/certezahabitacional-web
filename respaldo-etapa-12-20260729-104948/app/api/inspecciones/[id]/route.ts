import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    include: {
      cliente: {
        select: {
          nombre: true,
        },
      },
      inspector: {
        include: {
          usuario: {
            select: {
              nombre: true,
            },
          },
        },
      },
    },
  });

  if (!inspeccion) {
    return NextResponse.json(
      { error: "Expediente no encontrado" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: inspeccion.id,
    folio: inspeccion.folio,
    cliente: inspeccion.cliente.nombre,
    inspector: inspeccion.inspector?.usuario.nombre ?? "Sin asignar",
    direccion: inspeccion.direccion,
    ciudad: inspeccion.ciudad,
  });
}