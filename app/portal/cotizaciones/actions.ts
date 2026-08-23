"use server";

import {
  EstadoCotizacion,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { obtenerClienteActual } from "@/lib/cliente-actual";
import { prisma } from "@/lib/prisma";

function texto(
  formData: FormData,
  campo: string,
) {
  return String(
    formData.get(campo) ?? "",
  ).trim();
}

export async function aceptarCotizacionCliente(
  formData: FormData,
) {
  const cliente =
    await obtenerClienteActual();

  const id = texto(
    formData,
    "id",
  );

  if (!id) {
    throw new Error(
      "Cotización inválida.",
    );
  }

  const cotizacion =
    await prisma.cotizacion.findFirst({
      where: {
        id,
        clienteId: cliente.id,
      },
      select: {
        id: true,
        estado: true,
      },
    });

  if (!cotizacion) {
    throw new Error(
      "La cotización no existe o no pertenece a tu cuenta.",
    );
  }

  if (
    cotizacion.estado !==
    EstadoCotizacion.ENVIADA
  ) {
    throw new Error(
      "Esta cotización ya no está disponible para aceptación.",
    );
  }

  await prisma.cotizacion.update({
    where: {
      id,
    },
    data: {
      estado:
        EstadoCotizacion.ACEPTADA,
    },
  });

  revalidatePath(
    "/portal",
  );

  revalidatePath(
    "/portal/cotizaciones",
  );

  revalidatePath(
    `/portal/cotizaciones/${id}`,
  );
}

export async function rechazarCotizacionCliente(
  formData: FormData,
) {
  const cliente =
    await obtenerClienteActual();

  const id = texto(
    formData,
    "id",
  );

  const motivo =
    texto(
      formData,
      "motivo",
    ) || null;

  if (!id) {
    throw new Error(
      "Cotización inválida.",
    );
  }

  const cotizacion =
    await prisma.cotizacion.findFirst({
      where: {
        id,
        clienteId: cliente.id,
      },
      select: {
        id: true,
        estado: true,
      },
    });

  if (!cotizacion) {
    throw new Error(
      "La cotización no existe o no pertenece a tu cuenta.",
    );
  }

  if (
    cotizacion.estado !==
    EstadoCotizacion.ENVIADA
  ) {
    throw new Error(
      "Esta cotización ya no está disponible para rechazo.",
    );
  }

  await prisma.cotizacion.update({
    where: {
      id,
    },
    data: {
      estado:
        EstadoCotizacion.RECHAZADA,
      motivoRechazo:
        motivo,
    },
  });

  revalidatePath(
    "/portal",
  );

  revalidatePath(
    "/portal/cotizaciones",
  );

  revalidatePath(
    `/portal/cotizaciones/${id}`,
  );
}