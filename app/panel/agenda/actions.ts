"use server";

import {
  EsquemaPago,
  EstadoCotizacion,
  EstadoInspeccion,
  EstadoPago,
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

function redirigirError(
  mensaje: string,
): never {
  redirect(
    `/panel/agenda?error=${encodeURIComponent(
      mensaje,
    )}`,
  );
}

function redirigirOk(
  mensaje: string,
): never {
  redirect(
    `/panel/agenda?ok=${encodeURIComponent(
      mensaje,
    )}`,
  );
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
    redirigirError(
      "Selecciona fecha y hora para la inspección.",
    );
  }

  const fecha = new Date(
    `${valor}:00-07:00`,
  );

  if (Number.isNaN(fecha.getTime())) {
    redirigirError(
      "La fecha seleccionada no es válida.",
    );
  }

  return fecha;
}

function puedeAgendarCotizacion({
  estado,
  estadoPago,
  esquemaPago,
}: {
  estado: EstadoCotizacion;
  estadoPago: EstadoPago;
  esquemaPago: EsquemaPago;
}) {
  if (
    estado !==
    EstadoCotizacion.ACEPTADA
  ) {
    return false;
  }

  if (
    estadoPago ===
    EstadoPago.PAGADO
  ) {
    return true;
  }

  return (
    esquemaPago ===
      EsquemaPago.DOS_EXHIBICIONES_50_50 &&
    estadoPago ===
      EstadoPago.PARCIAL
  );
}

export async function agendarCotizacion(
  formData: FormData,
) {
  const session =
    await verificarPermiso();

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
    redirigirError(
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
    redirigirError(
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
    redirigirError(
      "La cotización no existe.",
    );
  }

  if (
    cotizacion.estado !==
    EstadoCotizacion.ACEPTADA
  ) {
    redirigirError(
      "Primero el cliente debe aceptar la cotización antes de programarla.",
    );
  }

  if (
    !puedeAgendarCotizacion({
      estado:
        cotizacion.estado,
      estadoPago:
        cotizacion.estadoPago,
      esquemaPago:
        cotizacion.esquemaPago,
    })
  ) {
    if (
      cotizacion.esquemaPago ===
      EsquemaPago.DOS_EXHIBICIONES_50_50
    ) {
      redirigirError(
        "Para agendar esta cotización debes registrar primero el 50% del pago.",
      );
    }

    redirigirError(
      "Esta cotización debe estar pagada al 100% antes de poder agendarla.",
    );
  }

  if (!cotizacion.inmueble) {
    redirigirError(
      "La cotización debe tener un inmueble asociado antes de agendarse.",
    );
  }

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
    redirigirError(
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
      redirigirError(
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

  redirigirOk(
    "Inspección programada correctamente.",
  );
}