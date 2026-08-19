"use server";

import {
  EstadoCotizacion,
  EstadoInspeccion,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function verificarPermiso() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (
    session.user.role !== "ADMINISTRADOR" &&
    session.user.role !== "COORDINADOR" &&
    session.user.role !== "SUPERVISOR"
  ) {
    redirect("/acceso");
  }

  return session;
}

function texto(
  formData: FormData,
  campo: string,
) {
  return String(
    formData.get(campo) ?? "",
  ).trim();
}

function generarFolioInspeccion() {
  const fecha = new Date();

  const year = fecha.getFullYear();

  const codigo = randomUUID()
    .replaceAll("-", "")
    .slice(0, 8)
    .toUpperCase();

  return `CH-INS-${year}-${codigo}`;
}

function convertirFechaHermosillo(
  valor: string,
) {
  if (!valor) {
    throw new Error(
      "Selecciona fecha y hora para la inspección.",
    );
  }

  /*
   * Hermosillo trabaja en UTC-7 durante todo el año.
   * datetime-local no incluye zona horaria,
   * por eso la agregamos explícitamente.
   */
  const fecha = new Date(
    `${valor}:00-07:00`,
  );

  if (Number.isNaN(fecha.getTime())) {
    throw new Error(
      "La fecha seleccionada no es válida.",
    );
  }

  return fecha;
}

export async function agendarCotizacion(
  formData: FormData,
) {
  const session = await verificarPermiso();

  const cotizacionId = texto(
    formData,
    "cotizacionId",
  );

  const inspectorId =
    texto(
      formData,
      "inspectorId",
    ) || null;

  const fechaHora = texto(
    formData,
    "fechaHora",
  );

  if (!cotizacionId) {
    throw new Error(
      "No se recibió la cotización.",
    );
  }

  const fechaProgramada =
    convertirFechaHermosillo(
      fechaHora,
    );

  if (
    fechaProgramada.getTime() <
    Date.now()
  ) {
    throw new Error(
      "La inspección no puede programarse en una fecha pasada.",
    );
  }

  const cotizacion =
    await prisma.cotizacion.findUnique({
      where: {
        id: cotizacionId,
      },

      include: {
        cliente: {
          select: {
            id: true,
            nombre: true,
          },
        },

        inmueble: {
          select: {
            id: true,
            tipo: true,
            direccion: true,
            ciudad: true,
            superficieConstruccionM2:
              true,
          },
        },

        paquete: {
          select: {
            nombre: true,
          },
        },
      },
    });

  if (!cotizacion) {
    throw new Error(
      "La cotización no existe.",
    );
  }

  if (
    cotizacion.estado !==
    EstadoCotizacion.ACEPTADA
  ) {
    throw new Error(
      "Solo se pueden agendar cotizaciones aceptadas.",
    );
  }

  if (!cotizacion.inmueble) {
    throw new Error(
      "La cotización debe tener un inmueble asociado antes de agendarse.",
    );
  }

  /*
   * Evita crear dos inspecciones
   * para la misma cotización.
   */
  const inspeccionExistente =
    await prisma.inspeccion.findFirst({
      where: {
        cotizacionId,
      },

      select: {
        id: true,
      },
    });

  if (inspeccionExistente) {
    throw new Error(
      "Esta cotización ya fue programada.",
    );
  }

  if (inspectorId) {
    const inspector =
      await prisma.inspector.findUnique({
        where: {
          id: inspectorId,
        },

        select: {
          id: true,
          activo: true,
        },
      });

    if (!inspector?.activo) {
      throw new Error(
        "El inspector seleccionado no está disponible.",
      );
    }
  }

  await prisma.inspeccion.create({
    data: {
      folio:
        generarFolioInspeccion(),

      clienteId:
        cotizacion.clienteId,

      inmuebleId:
        cotizacion.inmueble.id,

      inspectorId,

      cotizacionId:
        cotizacion.id,

      agendadaPorId:
        session.user.id,

      tipoServicio:
        cotizacion.paquete?.nombre ??
        "Inspección habitacional",

      tipoInmueble:
        cotizacion.inmueble.tipo,

      direccion:
        cotizacion.inmueble.direccion,

      ciudad:
        cotizacion.inmueble.ciudad,

      superficieM2:
        cotizacion.superficieM2 ??
        cotizacion.inmueble
          .superficieConstruccionM2,

      fechaProgramada,

      estado:
        EstadoInspeccion.PROGRAMADA,

      observaciones:
        cotizacion.notas ??
        null,
    },
  });

  revalidatePath(
    "/panel/agenda",
  );

  revalidatePath(
    "/panel/cotizaciones",
  );

  revalidatePath(
    "/panel",
  );
}