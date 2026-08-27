import {
  EstadoInspeccion,
  RolUsuario,
  TipoEvento,
} from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

const TIPOS = [
  "INSPECTOR",
  "CLIENTE",
] as const;

type TipoFirma =
  (typeof TIPOS)[number];

type FirmaEntrada = {
  imagen?: unknown;
};

type SolicitudFirmas = {
  inspector?: FirmaEntrada;
  cliente?: FirmaEntrada;
};

const TAMANO_MAXIMO_FIRMA =
  5 * 1024 * 1024;

function texto(
  valor: unknown,
): string {
  return typeof valor === "string"
    ? valor.trim()
    : "";
}

function esImagenFirma(
  valor: string,
): boolean {
  return (
    valor === "" ||
    /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(
      valor,
    )
  );
}

function tamanoBase64Aproximado(
  dataUrl: string,
): number {
  if (!dataUrl) return 0;

  const base64 =
    dataUrl.split(",")[1] ?? "";

  const relleno =
    (base64.match(/=*$/)?.[0]
      .length ?? 0);

  return Math.floor(
    (base64.length * 3) / 4 -
      relleno,
  );
}

async function obtenerAcceso(
  inspeccionId: string,
) {
  const session = await auth();

  if (!session?.user) {
    return {
      error: NextResponse.json(
        {
          error: "No autorizado",
        },
        {
          status: 401,
        },
      ),
    };
  }

  const usuario =
    await prisma.usuario.findUnique({
      where: {
        id: session.user.id,
      },
      select: {
        id: true,
        rol: true,
        activo: true,
        gerenteId: true,
        coordinadorId: true,
        inspector: {
          select: {
            id: true,
            activo: true,
          },
        },
      },
    });

  if (!usuario || !usuario.activo) {
    return {
      error: NextResponse.json(
        {
          error:
            "Usuario inactivo o no autorizado.",
        },
        {
          status: 403,
        },
      ),
    };
  }

  if (
    usuario.rol ===
      RolUsuario.ADMINISTRADOR ||
    usuario.rol ===
      RolUsuario.CLIENTE
  ) {
    return {
      error: NextResponse.json(
        {
          error:
            "No tienes acceso al expediente técnico.",
        },
        {
          status: 403,
        },
      ),
    };
  }

  const inspeccion =
    await prisma.inspeccion.findUnique({
      where: {
        id: inspeccionId,
      },
      select: {
        id: true,
        folio: true,
        estado: true,
        inspectorId: true,
        cliente: {
          select: {
            nombre: true,
          },
        },
        inspector: {
          select: {
            usuarioId: true,
            usuario: {
              select: {
                nombre: true,
                gerenteId: true,
                coordinadorId: true,
              },
            },
          },
        },
      },
    });

  if (!inspeccion) {
    return {
      error: NextResponse.json(
        {
          error:
            "Expediente no encontrado",
        },
        {
          status: 404,
        },
      ),
    };
  }

  let puedeConsultar = false;

  if (
    usuario.rol ===
    RolUsuario.DIRECTOR
  ) {
    puedeConsultar = true;
  }

  if (
    usuario.rol ===
    RolUsuario.GERENTE
  ) {
    puedeConsultar =
      inspeccion.inspector?.usuario
        .gerenteId === usuario.id;
  }

  if (
    usuario.rol ===
    RolUsuario.COORDINADOR
  ) {
    puedeConsultar =
      inspeccion.inspector?.usuario
        .coordinadorId ===
      usuario.id;
  }

  if (
    usuario.rol ===
    RolUsuario.INSPECTOR
  ) {
    puedeConsultar =
      Boolean(
        usuario.inspector?.id &&
          usuario.inspector.activo,
      ) &&
      inspeccion.inspectorId ===
        usuario.inspector?.id &&
      inspeccion.inspector
        ?.usuarioId === usuario.id;
  }

  if (!puedeConsultar) {
    return {
      error: NextResponse.json(
        {
          error:
            "No tienes acceso a las firmas de esta inspección.",
        },
        {
          status: 403,
        },
      ),
    };
  }

  const puedeModificar =
    usuario.rol ===
      RolUsuario.INSPECTOR &&
    inspeccion.estado ===
      EstadoInspeccion.EN_PROCESO &&
    inspeccion.inspectorId ===
      usuario.inspector?.id &&
    inspeccion.inspector
      ?.usuarioId === usuario.id;

  let motivoSoloLectura = "";

  if (!puedeModificar) {
    if (
      usuario.rol ===
        RolUsuario.COORDINADOR
    ) {
      motivoSoloLectura =
        "Coordinación puede consultar las firmas, pero no modificarlas.";
    } else if (
      usuario.rol ===
        RolUsuario.GERENTE
    ) {
      motivoSoloLectura =
        "Gerencia puede consultar las firmas, pero no modificarlas.";
    } else if (
      usuario.rol ===
        RolUsuario.DIRECTOR
    ) {
      motivoSoloLectura =
        "Dirección puede auditar las firmas, pero no sustituirlas.";
    } else if (
      inspeccion.estado !==
        EstadoInspeccion.EN_PROCESO
    ) {
      motivoSoloLectura =
        "Las firmas solo pueden modificarse mientras la inspección está EN PROCESO.";
    }
  }

  return {
    session,
    usuario,
    inspeccion,
    puedeModificar,
    motivoSoloLectura,
  };
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  const {
    id,
  } = await context.params;

  const acceso =
    await obtenerAcceso(id);

  if ("error" in acceso) {
    return acceso.error;
  }

  const registros =
    await prisma.firma.findMany({
      where: {
        inspeccionId: id,
        tipo: {
          in: [...TIPOS],
        },
      },
      orderBy: {
        firmadaEn: "desc",
      },
    });

  const porTipo =
    new Map<
      TipoFirma,
      (typeof registros)[number]
    >();

  for (const registro of registros) {
    const tipo =
      registro.tipo as TipoFirma;

    if (
      TIPOS.includes(tipo) &&
      !porTipo.has(tipo)
    ) {
      porTipo.set(
        tipo,
        registro,
      );
    }
  }

  const inspector =
    porTipo.get("INSPECTOR");

  const cliente =
    porTipo.get("CLIENTE");

  return NextResponse.json({
    inspector:
      inspector?.imagenUrl ?? "",
    cliente:
      cliente?.imagenUrl ?? "",
    fechaInspector:
      inspector?.firmadaEn.toISOString() ??
      "",
    fechaCliente:
      cliente?.firmadaEn.toISOString() ??
      "",
    puedeModificar:
      acceso.puedeModificar,
    motivoSoloLectura:
      acceso.motivoSoloLectura,
  });
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  const {
    id,
  } = await context.params;

  const acceso =
    await obtenerAcceso(id);

  if ("error" in acceso) {
    return acceso.error;
  }

  if (!acceso.puedeModificar) {
    return NextResponse.json(
      {
        error:
          "No tienes autorización para modificar las firmas de esta inspección.",
      },
      {
        status: 403,
      },
    );
  }

  let body: SolicitudFirmas;

  try {
    body =
      (await request.json()) as SolicitudFirmas;
  } catch {
    return NextResponse.json(
      {
        error:
          "La solicitud de firmas no es válida.",
      },
      {
        status: 400,
      },
    );
  }

  const imagenInspector =
    texto(
      body.inspector?.imagen,
    );

  const imagenCliente =
    texto(
      body.cliente?.imagen,
    );

  if (
    !imagenInspector ||
    !imagenCliente
  ) {
    return NextResponse.json(
      {
        error:
          "Debes registrar la firma del Inspector y la firma del Cliente.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !esImagenFirma(
      imagenInspector,
    ) ||
    !esImagenFirma(
      imagenCliente,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Formato de firma no válido.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    tamanoBase64Aproximado(
      imagenInspector,
    ) >
      TAMANO_MAXIMO_FIRMA ||
    tamanoBase64Aproximado(
      imagenCliente,
    ) >
      TAMANO_MAXIMO_FIRMA
  ) {
    return NextResponse.json(
      {
        error:
          "Cada firma debe ocupar como máximo 5 MB.",
      },
      {
        status: 413,
      },
    );
  }

  const nombreInspector =
    acceso.inspeccion.inspector
      ?.usuario.nombre ??
    "Inspector sin asignar";

  const nombreCliente =
    acceso.inspeccion.cliente
      .nombre;

  await prisma.$transaction(
    async (tx) => {
      await tx.firma.deleteMany({
        where: {
          inspeccionId: id,
          tipo: {
            in: [...TIPOS],
          },
        },
      });

      await tx.firma.create({
        data: {
          inspeccionId: id,
          tipo: "INSPECTOR",
          nombreFirmante:
            nombreInspector,
          imagenUrl:
            imagenInspector,
        },
      });

      await tx.firma.create({
        data: {
          inspeccionId: id,
          tipo: "CLIENTE",
          nombreFirmante:
            nombreCliente,
          imagenUrl:
            imagenCliente,
        },
      });
    },
  );

  await registrarAuditoria({
    tipo: TipoEvento.FIRMAR,
    entidad: "Inspeccion",
    entidadId:
      acceso.inspeccion.id,
    inspeccionId:
      acceso.inspeccion.id,
    usuarioId:
      acceso.usuario.id,
    descripcion:
      `Inspector ${nombreInspector} registró las firmas del Inspector y del Cliente en la inspección ${acceso.inspeccion.folio}.`,
  });

  return NextResponse.json({
    ok: true,
  });
}
