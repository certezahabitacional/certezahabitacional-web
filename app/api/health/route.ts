import {
  ClasificacionHallazgo,
  RolUsuario,
} from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { puede } from "@/lib/permisos";
import { prisma } from "@/lib/prisma";

type ResultadoPaso = {
  paso: string;
  ok: boolean;
  detalle?: unknown;
  error?: string;
};

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      {
        ok: false,
        error: "No autorizado.",
      },
      {
        status: 401,
      },
    );
  }

  const usuario = await prisma.usuario.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      rol: true,
      activo: true,
    },
  });

  if (
    !usuario ||
    !usuario.activo ||
    usuario.rol !== RolUsuario.DIRECTOR ||
    !puede(usuario.rol, "CONFIGURACION_TOTAL")
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "Acceso denegado.",
      },
      {
        status: 403,
      },
    );
  }

  const resultados: ResultadoPaso[] = [];

  async function ejecutarPaso<T>(
    paso: string,
    fn: () => Promise<T>,
  ) {
    try {
      const resultado = await fn();

      resultados.push({
        paso,
        ok: true,
        detalle: resultado,
      });

      return true;
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : String(error);

      console.error(
        `[HEALTH DIAGNOSTICO] Fallo en ${paso}`,
        error,
      );

      resultados.push({
        paso,
        ok: false,
        error: mensaje,
      });

      return false;
    }
  }

  const paso1 = await ejecutarPaso(
    "01_SELECT_1",
    async () => {
      await prisma.$queryRaw`SELECT 1`;
      return "conectada";
    },
  );

  if (!paso1) {
    return NextResponse.json(
      {
        ok: false,
        servicio: "Certeza Habitacional",
        pasoFallido: "01_SELECT_1",
        resultados,
        fecha: new Date().toISOString(),
      },
      {
        status: 503,
      },
    );
  }

  const paso2 = await ejecutarPaso(
    "02_USUARIO_COUNT",
    () => prisma.usuario.count(),
  );

  if (!paso2) {
    return respuestaFallo(
      "02_USUARIO_COUNT",
      resultados,
    );
  }

  const paso3 = await ejecutarPaso(
    "03_INSPECCION_GROUP_BY_ESTADO",
    () =>
      prisma.inspeccion.groupBy({
        by: ["estado"],
        _count: {
          _all: true,
        },
      }),
  );

  if (!paso3) {
    return respuestaFallo(
      "03_INSPECCION_GROUP_BY_ESTADO",
      resultados,
    );
  }

  const paso4 = await ejecutarPaso(
    "04_CLIENTE_COUNT",
    () => prisma.cliente.count(),
  );

  if (!paso4) {
    return respuestaFallo(
      "04_CLIENTE_COUNT",
      resultados,
    );
  }

  const paso5 = await ejecutarPaso(
    "05_HALLAZGO_COUNT_CR_NO_RESUELTO",
    () =>
      prisma.hallazgo.count({
        where: {
          clasificacion:
            ClasificacionHallazgo.CR,
          resuelto: false,
        },
      }),
  );

  if (!paso5) {
    return respuestaFallo(
      "05_HALLAZGO_COUNT_CR_NO_RESUELTO",
      resultados,
    );
  }

  const paso6 = await ejecutarPaso(
    "06_CERTIFICADO_GROUP_BY_VIGENTE",
    () =>
      prisma.certificado.groupBy({
        by: ["vigente"],
        _count: {
          _all: true,
        },
      }),
  );

  if (!paso6) {
    return respuestaFallo(
      "06_CERTIFICADO_GROUP_BY_VIGENTE",
      resultados,
    );
  }

  const paso7 = await ejecutarPaso(
    "07_INSPECCION_AVG_ISH",
    () =>
      prisma.inspeccion.aggregate({
        _avg: {
          ish: true,
        },
        where: {
          ish: {
            not: null,
          },
        },
      }),
  );

  if (!paso7) {
    return respuestaFallo(
      "07_INSPECCION_AVG_ISH",
      resultados,
    );
  }

  const paso8 = await ejecutarPaso(
    "08_HALLAZGO_GROUP_BY_CLASIFICACION",
    () =>
      prisma.hallazgo.groupBy({
        by: ["clasificacion"],
        _count: {
          _all: true,
        },
      }),
  );

  if (!paso8) {
    return respuestaFallo(
      "08_HALLAZGO_GROUP_BY_CLASIFICACION",
      resultados,
    );
  }

  const paso9 = await ejecutarPaso(
    "09_INSPECCION_GROUP_BY_SEMAFORO",
    () =>
      prisma.inspeccion.groupBy({
        by: ["semaforo"],
        where: {
          semaforo: {
            not: null,
          },
        },
        _count: {
          _all: true,
        },
      }),
  );

  if (!paso9) {
    return respuestaFallo(
      "09_INSPECCION_GROUP_BY_SEMAFORO",
      resultados,
    );
  }

  return NextResponse.json({
    ok: true,
    servicio: "Certeza Habitacional",
    baseDeDatos: "conectada",
    diagnostico: "completo",
    resultados,
    fecha: new Date().toISOString(),
  });
}

function respuestaFallo(
  pasoFallido: string,
  resultados: ResultadoPaso[],
) {
  return NextResponse.json(
    {
      ok: false,
      servicio: "Certeza Habitacional",
      baseDeDatos: "conexión parcial",
      pasoFallido,
      resultados,
      fecha: new Date().toISOString(),
    },
    {
      status: 503,
    },
  );
}