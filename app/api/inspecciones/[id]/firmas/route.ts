import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const TIPOS = ["INSPECTOR", "CLIENTE"] as const;
type TipoFirma = (typeof TIPOS)[number];

type FirmaEntrada = {
  imagen?: unknown;
  nombre?: unknown;
};

type SolicitudFirmas = {
  inspector?: FirmaEntrada;
  cliente?: FirmaEntrada;
};

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function esImagenFirma(valor: string): boolean {
  return valor === "" || valor.startsWith("data:image/png;base64,");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await context.params;

  const existe = await prisma.inspeccion.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existe) {
    return NextResponse.json(
      { error: "Expediente no encontrado" },
      { status: 404 },
    );
  }

  const registros = await prisma.firma.findMany({
    where: {
      inspeccionId: id,
      tipo: { in: [...TIPOS] },
    },
    orderBy: { firmadaEn: "desc" },
  });

  const porTipo = new Map<TipoFirma, (typeof registros)[number]>();

  for (const registro of registros) {
    const tipo = registro.tipo as TipoFirma;
    if (TIPOS.includes(tipo) && !porTipo.has(tipo)) {
      porTipo.set(tipo, registro);
    }
  }

  const inspector = porTipo.get("INSPECTOR");
  const cliente = porTipo.get("CLIENTE");

  return NextResponse.json({
    inspector: inspector?.imagenUrl ?? "",
    cliente: cliente?.imagenUrl ?? "",
    fechaInspector: inspector?.firmadaEn.toISOString() ?? "",
    fechaCliente: cliente?.firmadaEn.toISOString() ?? "",
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as SolicitudFirmas;

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    include: {
      cliente: { select: { nombre: true } },
      inspector: {
        include: {
          usuario: { select: { nombre: true } },
        },
      },
    },
  });

  if (!inspeccion) {
    return NextResponse.json(
      { error: "Expediente no encontrado" },
      { status: 404 },
    );
  }

  const imagenInspector = texto(body.inspector?.imagen);
  const imagenCliente = texto(body.cliente?.imagen);

  if (!esImagenFirma(imagenInspector) || !esImagenFirma(imagenCliente)) {
    return NextResponse.json(
      { error: "Formato de firma no válido" },
      { status: 400 },
    );
  }

  const operaciones = [];

  operaciones.push(
    prisma.firma.deleteMany({
      where: {
        inspeccionId: id,
        tipo: { in: [...TIPOS] },
      },
    }),
  );

  if (imagenInspector) {
    operaciones.push(
      prisma.firma.create({
        data: {
          inspeccionId: id,
          tipo: "INSPECTOR",
          nombreFirmante:
            texto(body.inspector?.nombre) ||
            inspeccion.inspector?.usuario.nombre ||
            "Inspector sin asignar",
          imagenUrl: imagenInspector,
        },
      }),
    );
  }

  if (imagenCliente) {
    operaciones.push(
      prisma.firma.create({
        data: {
          inspeccionId: id,
          tipo: "CLIENTE",
          nombreFirmante:
            texto(body.cliente?.nombre) || inspeccion.cliente.nombre,
          imagenUrl: imagenCliente,
        },
      }),
    );
  }

  await prisma.$transaction(operaciones);

  return NextResponse.json({ ok: true });
}
