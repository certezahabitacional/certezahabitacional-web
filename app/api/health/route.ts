import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      servicio: "Certeza Habitacional",
      baseDeDatos: "conectada",
      fecha: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Fallo de salud de base de datos", error);
    return NextResponse.json(
      {
        ok: false,
        servicio: "Certeza Habitacional",
        baseDeDatos: "sin conexión",
      },
      { status: 503 },
    );
  }
}
