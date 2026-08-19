"use server";

import {
  EstadoCotizacion,
  EstadoPago,
  TipoCalculoPrecio,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function verificarPermiso() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (
    session.user.role !== "ADMINISTRADOR" &&
    session.user.role !== "COORDINADOR"
  ) {
    redirect("/acceso");
  }

  return session;
}

function texto(formData: FormData, campo: string) {
  return String(formData.get(campo) ?? "").trim();
}

function numero(
  formData: FormData,
  campo: string,
  requerido = false,
) {
  const valor = texto(formData, campo);

  if (!valor) {
    if (requerido) {
      throw new Error(`${campo} es obligatorio.`);
    }

    return 0;
  }

  const convertido = Number(valor);

  if (!Number.isFinite(convertido) || convertido < 0) {
    throw new Error(`${campo} no es válido.`);
  }

  return convertido;
}

function generarFolio() {
  const year = new Date().getFullYear();

  const codigo = randomUUID()
    .replaceAll("-", "")
    .slice(0, 8)
    .toUpperCase();

  return `CH-COT-${year}-${codigo}`;
}

function calcularPrecio({
  tipoCalculo,
  superficieM2,
  precioBase,
  superficieIncluidaM2,
  precioM2Adicional,
  cargosExtra,
  descuento,
}: {
  tipoCalculo: TipoCalculoPrecio;
  superficieM2: number;
  precioBase: number;
  superficieIncluidaM2: number;
  precioM2Adicional: number;
  cargosExtra: number;
  descuento: number;
}) {
  let metrosAdicionales = 0;
  let cargoMetrosAdicionales = 0;

  if (tipoCalculo === TipoCalculoPrecio.POR_M2) {
    metrosAdicionales = superficieM2;
    cargoMetrosAdicionales =
      superficieM2 * precioM2Adicional;
  }

  if (tipoCalculo === TipoCalculoPrecio.HIBRIDO) {
    metrosAdicionales = Math.max(
      0,
      superficieM2 - superficieIncluidaM2,
    );

    cargoMetrosAdicionales =
      metrosAdicionales * precioM2Adicional;
  }

  const baseAplicable =
    tipoCalculo === TipoCalculoPrecio.POR_M2
      ? 0
      : precioBase;

  const subtotal =
    baseAplicable +
    cargoMetrosAdicionales +
    cargosExtra;

  const total = Math.max(0, subtotal - descuento);

  return {
    precioBase: baseAplicable,
    metrosAdicionales,
    cargoMetrosAdicionales,
    subtotal,
    total,
  };
}

export async function crearCotizacion(
  formData: FormData,
) {
  const session = await verificarPermiso();

  const clienteId = texto(formData, "clienteId");
  const inmuebleId =
    texto(formData, "inmuebleId") || null;
  const paqueteId = texto(formData, "paqueteId");

  if (!clienteId) {
    throw new Error("Selecciona un cliente.");
  }

  if (!paqueteId) {
    throw new Error("Selecciona un paquete.");
  }

  const paquete =
    await prisma.paqueteServicio.findUnique({
      where: {
        id: paqueteId,
      },
    });

  if (!paquete || !paquete.activo) {
    throw new Error(
      "El paquete seleccionado no está disponible.",
    );
  }

  const cliente = await prisma.cliente.findUnique({
    where: {
      id: clienteId,
    },
    select: {
      id: true,
    },
  });

  if (!cliente) {
    throw new Error("El cliente no existe.");
  }

  if (inmuebleId) {
    const inmueble =
      await prisma.inmueble.findFirst({
        where: {
          id: inmuebleId,
          clienteId,
        },
        select: {
          id: true,
        },
      });

    if (!inmueble) {
      throw new Error(
        "El inmueble no pertenece al cliente seleccionado.",
      );
    }
  }

  const superficieM2 = numero(
    formData,
    "superficieM2",
    true,
  );

  const cargosExtra = numero(
    formData,
    "cargosExtra",
  );

  const descuento = numero(
    formData,
    "descuento",
  );

  const precioBase = Number(paquete.precioBase);

  const superficieIncluidaM2 = Number(
    paquete.superficieIncluidaM2 ?? 0,
  );

  const precioM2Adicional = Number(
    paquete.precioM2Adicional ?? 0,
  );

  const calculo = calcularPrecio({
    tipoCalculo: paquete.tipoCalculo,
    superficieM2,
    precioBase,
    superficieIncluidaM2,
    precioM2Adicional,
    cargosExtra,
    descuento,
  });

  const vigenciaDias = 15;

  const vigenciaHasta = new Date();

  vigenciaHasta.setDate(
    vigenciaHasta.getDate() + vigenciaDias,
  );

  await prisma.cotizacion.create({
    data: {
      folio: generarFolio(),

      clienteId,
      inmuebleId,
      paqueteId,

      creadaPorId: session.user.id,

      superficieM2,

      precioBase: calculo.precioBase,
      metrosAdicionales:
        calculo.metrosAdicionales,
      cargoMetrosAdicionales:
        calculo.cargoMetrosAdicionales,

      cargosExtra,
      descuento,

      subtotal: calculo.subtotal,
      total: calculo.total,

      estado: EstadoCotizacion.BORRADOR,
      estadoPago: EstadoPago.PENDIENTE,

      vigenciaHasta,

      notas:
        texto(formData, "notas") || null,

      observacionesInternas:
        texto(
          formData,
          "observacionesInternas",
        ) || null,
    },
  });

  revalidatePath("/panel/cotizaciones");
}

export async function cambiarEstadoCotizacion(
  formData: FormData,
) {
  await verificarPermiso();

  const id = texto(formData, "id");

  const estado = texto(
    formData,
    "estado",
  ) as EstadoCotizacion;

  if (
    !Object.values(EstadoCotizacion).includes(
      estado,
    )
  ) {
    throw new Error(
      "Estado de cotización inválido.",
    );
  }

  await prisma.cotizacion.update({
    where: {
      id,
    },
    data: {
      estado,
    },
  });

  revalidatePath("/panel/cotizaciones");
}

export async function cambiarEstadoPago(
  formData: FormData,
) {
  await verificarPermiso();

  const id = texto(formData, "id");

  const estadoPago = texto(
    formData,
    "estadoPago",
  ) as EstadoPago;

  if (!Object.values(EstadoPago).includes(estadoPago)) {
    throw new Error("Estado de pago inválido.");
  }

  await prisma.cotizacion.update({
    where: {
      id,
    },
    data: {
      estadoPago,
    },
  });

  revalidatePath("/panel/cotizaciones");
}