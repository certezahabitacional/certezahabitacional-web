import { EstadoInspeccion, RolUsuario, TipoEvento } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  clientMutationId?: string;
  operation?: string;
  payload?: {
    inspectionId?: string;
    inspector?: string;
    cliente?: string;
  };
};

const TAMANO_MAXIMO_FIRMA = 5 * 1024 * 1024;

function esImagenFirma(valor: string) {
  return /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(valor);
}

function tamanoBase64Aproximado(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  const relleno = base64.match(/=*$/)?.[0].length ?? 0;
  return Math.floor((base64.length * 3) / 4 - relleno);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  if (body.operation !== "SIGNATURES_V1") {
    return NextResponse.json({ error: "Operación offline no soportada." }, { status: 400 });
  }

  const inspectionId = String(body.payload?.inspectionId ?? "").trim();
  const inspector = String(body.payload?.inspector ?? "").trim();
  const cliente = String(body.payload?.cliente ?? "").trim();

  if (!inspectionId || !inspector || !cliente) {
    return NextResponse.json({ error: "Faltan las dos firmas." }, { status: 400 });
  }
  if (!esImagenFirma(inspector) || !esImagenFirma(cliente)) {
    return NextResponse.json({ error: "Formato de firma no válido." }, { status: 400 });
  }
  if (
    tamanoBase64Aproximado(inspector) > TAMANO_MAXIMO_FIRMA ||
    tamanoBase64Aproximado(cliente) > TAMANO_MAXIMO_FIRMA
  ) {
    return NextResponse.json({ error: "Cada firma debe ocupar como máximo 5 MB." }, { status: 413 });
  }

  const [usuario, inspeccion] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: { id: true, activo: true, rol: true, inspector: { select: { id: true, activo: true } } },
    }),
    prisma.inspeccion.findUnique({
      where: { id: inspectionId },
      select: {
        id: true,
        folio: true,
        estado: true,
        numeroInspeccion: true,
        inspectorId: true,
        cliente: { select: { nombre: true } },
        inspector: { select: { usuario: { select: { nombre: true } } } },
      },
    }),
  ]);

  const permitido =
    usuario?.activo &&
    inspeccion?.numeroInspeccion === 1 &&
    inspeccion.estado === EstadoInspeccion.EN_PROCESO &&
    (
      usuario.rol === RolUsuario.DIRECTOR ||
      (
        usuario.rol === RolUsuario.INSPECTOR &&
        usuario.inspector?.activo &&
        usuario.inspector.id === inspeccion.inspectorId
      )
    );

  if (!permitido || !usuario || !inspeccion) {
    return NextResponse.json({ error: "No tienes acceso para registrar firmas." }, { status: 403 });
  }

  const [existentes] = await prisma.$queryRaw<Array<{ total: number }>>`
    SELECT COUNT(*)::int AS "total"
    FROM "Firma"
    WHERE "inspeccionId"=${inspectionId}
      AND "tipo" IN ('INSPECTOR','CLIENTE')
      AND "firmadaEn" > NOW() - interval '2 minutes'
  `;

  if (Number(existentes?.total ?? 0) >= 2) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const nombreInspector = inspeccion.inspector?.usuario.nombre ?? "Inspector sin asignar";
  const nombreCliente = inspeccion.cliente.nombre;

  await prisma.$transaction(async (tx) => {
    await tx.firma.create({
      data: {
        inspeccionId: inspectionId,
        tipo: "INSPECTOR",
        nombreFirmante: nombreInspector,
        imagenUrl: inspector,
      },
    });
    await tx.firma.create({
      data: {
        inspeccionId: inspectionId,
        tipo: "CLIENTE",
        nombreFirmante: nombreCliente,
        imagenUrl: cliente,
      },
    });
  });

  await registrarAuditoria({
    tipo: TipoEvento.FIRMAR,
    entidad: "Inspeccion",
    entidadId: inspectionId,
    inspeccionId: inspectionId,
    usuarioId: usuario.id,
    descripcion: `Firmas de Inspector y Cliente capturadas sin conexión y sincronizadas en ${inspeccion.folio}.`,
  });

  return NextResponse.json({ ok: true });
}
