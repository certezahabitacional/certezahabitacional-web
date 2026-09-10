import { EstadoCotizacion } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

type RecuperarRequest = {
  folio?: string;
  correo?: string;
};

const ESTADOS_EDITABLES = new Set<EstadoCotizacion>([
  EstadoCotizacion.BORRADOR,
  EstadoCotizacion.PENDIENTE_AUTORIZACION,
  EstadoCotizacion.ENVIADA,
]);

function texto(valor?: string) {
  return (valor ?? "").trim();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RecuperarRequest;
    const folio = texto(body.folio).toUpperCase();
    const correo = texto(body.correo).toLowerCase();

    if (!folio || !correo) {
      return NextResponse.json(
        { ok: false, error: "Captura el folio y el correo utilizado originalmente." },
        { status: 400 },
      );
    }

    const cotizacion = await prisma.cotizacion.findUnique({
      where: { folio },
      select: {
        id: true,
        folio: true,
        estado: true,
        origenPublico: true,
        editablePublica: true,
        versionActual: true,
        cliente: {
          select: { correo: true },
        },
        versiones: {
          orderBy: { version: "desc" },
          take: 1,
          select: {
            version: true,
            datos: true,
          },
        },
      },
    });

    // Mensaje intencionalmente genérico para no revelar si un folio existe.
    if (
      !cotizacion ||
      !cotizacion.origenPublico ||
      !cotizacion.cliente.correo ||
      cotizacion.cliente.correo.trim().toLowerCase() !== correo
    ) {
      return NextResponse.json(
        { ok: false, error: "No fue posible localizar una pre-cotización editable con esos datos." },
        { status: 404 },
      );
    }

    if (!cotizacion.editablePublica || !ESTADOS_EDITABLES.has(cotizacion.estado)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Esta cotización ya no puede modificarse desde la página. Contacta a Certeza Habitacional para cualquier ajuste.",
        },
        { status: 409 },
      );
    }

    const ultima = cotizacion.versiones[0];

    if (!ultima || !ultima.datos || typeof ultima.datos !== "object") {
      return NextResponse.json(
        { ok: false, error: "La pre-cotización no tiene información recuperable." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      cotizacion: {
        folio: cotizacion.folio,
        version: ultima.version,
        estado: cotizacion.estado,
        datos: ultima.datos,
      },
    });
  } catch (error) {
    console.error("Error al recuperar pre-cotización:", error);
    return NextResponse.json(
      { ok: false, error: "No fue posible recuperar la pre-cotización." },
      { status: 500 },
    );
  }
}
