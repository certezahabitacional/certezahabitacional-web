import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const rolesLectura = new Set([
  "DIRECTOR",
  "ADMINISTRADOR",
  "GERENTE",
  "COORDINADOR",
  "INSPECTOR",
]);

const rolesEdicion = new Set([
  "DIRECTOR",
  "ADMINISTRADOR",
  "GERENTE",
  "COORDINADOR",
]);

const rendimientoSchema = z.object({
  clave: z.string().min(3).max(1200),
  descripcionNormalizada: z.string().min(1).max(1000),
  descripcionEjemplo: z.string().min(1).max(2000),
  unidad: z.string().min(1).max(50),
  cuadrilla: z.string().min(1).max(200),
  rendimiento: z.number().positive().max(1_000_000),
});

const payloadSchema = z.object({
  rendimientos: z.array(rendimientoSchema).min(1).max(1000),
});

export async function GET() {
  const session = await auth();
  const role = String(session?.user?.role ?? "");

  if (!session?.user?.id || !rolesLectura.has(role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const rows = await prisma.rendimientoAbaco.findMany({
      where: { activo: true },
      orderBy: [{ unidad: "asc" }, { descripcionNormalizada: "asc" }],
      select: {
        clave: true,
        descripcionNormalizada: true,
        descripcionEjemplo: true,
        unidad: true,
        cuadrilla: true,
        rendimiento: true,
        origen: true,
      },
    });

    return NextResponse.json({
      rendimientos: rows.map((row) => ({
        ...row,
        rendimiento: Number(row.rendimiento),
      })),
    });
  } catch (error) {
    console.error("Error al consultar biblioteca ÁBACO:", error);
    return NextResponse.json(
      { error: "Biblioteca central temporalmente no disponible" },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  const role = String(session?.user?.role ?? "");

  if (!session?.user?.id || !rolesEdicion.has(role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = payloadSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos de rendimiento inválidos" },
      { status: 400 },
    );
  }

  try {
    await prisma.$transaction(
      parsed.data.rendimientos.map((item) =>
        prisma.rendimientoAbaco.upsert({
          where: { clave: item.clave },
          create: {
            ...item,
            origen: "MANUAL",
            creadoPorId: session.user.id,
          },
          update: {
            descripcionNormalizada: item.descripcionNormalizada,
            descripcionEjemplo: item.descripcionEjemplo,
            unidad: item.unidad,
            cuadrilla: item.cuadrilla,
            rendimiento: item.rendimiento,
            activo: true,
            origen: "MANUAL",
          },
        }),
      ),
    );

    return NextResponse.json({
      ok: true,
      guardados: parsed.data.rendimientos.length,
    });
  } catch (error) {
    console.error("Error al guardar biblioteca ÁBACO:", error);
    return NextResponse.json(
      { error: "No fue posible guardar en la biblioteca central" },
      { status: 503 },
    );
  }
}
