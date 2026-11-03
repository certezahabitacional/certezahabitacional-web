import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const rolesLectura = new Set(["DIRECTOR","ADMINISTRADOR","GERENTE","COORDINADOR","INSPECTOR"]);
const rolesEdicion = new Set(["DIRECTOR","ADMINISTRADOR","GERENTE","COORDINADOR"]);

const avanceSchema = z.record(z.string(), z.number().min(0).max(100));

const payloadSchema = z.object({
  proyecto: z.string().trim().min(1).max(200),
  fechaCorte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  avanceReal: avanceSchema,
  resumen: z.object({
    programado: z.number().min(0).max(1),
    real: z.number().min(0).max(1),
    variacion: z.number().min(-1).max(1),
    eventosAtrasados: z.number().int().min(0),
  }).optional(),
});

export async function GET(request: Request) {
  const session = await auth();
  const role = String(session?.user?.role ?? "");
  if (!session?.user?.id || !rolesLectura.has(role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const proyecto = searchParams.get("proyecto")?.trim();
  if (!proyecto) {
    return NextResponse.json({ error: "Proyecto requerido" }, { status: 400 });
  }

  try {
    const row = await prisma.abacoProyecto.findFirst({
      where: { nombre: proyecto, creadoPorId: session.user.id, activo: true },
      select: {
        id: true,
        nombre: true,
        cortes: {
          orderBy: { fechaCorte: "desc" },
          select: { fechaCorte: true, avanceReal: true, resumen: true, actualizadoEn: true },
          take: 100,
        },
      },
    });

    return NextResponse.json({
      proyecto: row?.nombre ?? proyecto,
      cortes: (row?.cortes ?? []).map((corte) => ({
        fechaCorte: corte.fechaCorte.toISOString().slice(0,10),
        avanceReal: corte.avanceReal,
        resumen: corte.resumen,
        actualizadoEn: corte.actualizadoEn.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Error al consultar histórico ÁBACO:", error);
    return NextResponse.json({ error: "Histórico central temporalmente no disponible" }, { status: 503 });
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
    return NextResponse.json({ error: "Datos históricos inválidos" }, { status: 400 });
  }

  try {
    const project = await prisma.abacoProyecto.upsert({
      where: {
        creadoPorId_nombre: {
          creadoPorId: session.user.id,
          nombre: parsed.data.proyecto,
        },
      },
      create: {
        nombre: parsed.data.proyecto,
        creadoPorId: session.user.id,
      },
      update: { activo: true },
      select: { id: true },
    });

    const fechaCorte = new Date(parsed.data.fechaCorte + "T12:00:00.000Z");

    await prisma.abacoCorte.upsert({
      where: {
        proyectoId_fechaCorte: {
          proyectoId: project.id,
          fechaCorte,
        },
      },
      create: {
        proyectoId: project.id,
        fechaCorte,
        avanceReal: parsed.data.avanceReal,
        resumen: parsed.data.resumen,
        registradoPorId: session.user.id,
      },
      update: {
        avanceReal: parsed.data.avanceReal,
        resumen: parsed.data.resumen,
        registradoPorId: session.user.id,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error al guardar histórico ÁBACO:", error);
    return NextResponse.json({ error: "No fue posible guardar el histórico central" }, { status: 503 });
  }
}
