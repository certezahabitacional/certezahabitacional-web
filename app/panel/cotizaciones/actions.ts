"use server";

import {
  EsquemaPago,
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

  if (!usuario || !usuario.activo) {
    redirect("/acceso");
  }

  if (
    usuario.rol !== "DIRECTOR" &&
    usuario.rol !== "ADMINISTRADOR"
  ) {
    redirect("/acceso");
  }

  return {
    session,
    usuario,
  };
}

function texto(
  formData: FormData,
  campo: string,
) {
  return String(
    formData.get(campo) ?? "",
  ).trim();
}

function numero(
  formData: FormData,
  campo: string,
  requerido = false,
) {
  const valor = texto(formData, campo);

  if (!valor) {
    if (requerido) {
      redirigirError(
        `${campo} es obligatorio.`,
      );
    }

    return 0;
  }

  const convertido = Number(valor);

  if (
    !Number.isFinite(convertido) ||
    convertido < 0
  ) {
    redirigirError(
      `${campo} no es válido.`,
    );
  }

  return convertido;
}

function redirigirError(
  mensaje: string,
): never {
  redirect(
    `/panel/cotizaciones?error=${encodeURIComponent(
      mensaje,
    )}`,
  );
}

function redirigirOk(
  mensaje: string,
): never {
  redirect(
    `/panel/cotizaciones?ok=${encodeURIComponent(
      mensaje,
    )}`,
  );
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

  if (
    tipoCalculo ===
    TipoCalculoPrecio.POR_M2
  ) {
    metrosAdicionales = superficieM2;

    cargoMetrosAdicionales =
      superficieM2 *
      precioM2Adicional;
  }

  if (
    tipoCalculo ===
    TipoCalculoPrecio.HIBRIDO
  ) {
    metrosAdicionales = Math.max(
      0,
      superficieM2 -
        superficieIncluidaM2,
    );

    cargoMetrosAdicionales =
      metrosAdicionales *
      precioM2Adicional;
  }

  const baseAplicable =
    tipoCalculo ===
    TipoCalculoPrecio.POR_M2
      ? 0
      : precioBase;

  const subtotal =
    baseAplicable +
    cargoMetrosAdicionales +
    cargosExtra;

  const total = Math.max(
    0,
    subtotal - descuento,
  );

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
  const {
    session,
    usuario,
  } = await verificarPermiso();

  const clienteId = texto(
    formData,
    "clienteId",
  );

  const inmuebleId =
    texto(
      formData,
      "inmuebleId",
    ) || null;

  const paqueteId = texto(
    formData,
    "paqueteId",
  );

  const esquemaPago = texto(
    formData,
    "esquemaPago",
  ) as EsquemaPago;

  if (!clienteId) {
    redirigirError(
      "Selecciona un cliente.",
    );
  }

  if (!paqueteId) {
    redirigirError(
      "Selecciona un paquete.",
    );
  }

  if (
    !Object.values(
      EsquemaPago,
    ).includes(esquemaPago)
  ) {
    redirigirError(
      "Selecciona un esquema de pago válido.",
    );
  }

  const paquete =
    await prisma.paqueteServicio.findUnique({
      where: {
        id: paqueteId,
      },
    });

  if (
    !paquete ||
    !paquete.activo
  ) {
    redirigirError(
      "El paquete seleccionado no está disponible.",
    );
  }

  const cliente =
    await prisma.cliente.findUnique({
      where: {
        id: clienteId,
      },
      select: {
        id: true,
      },
    });

  if (!cliente) {
    redirigirError(
      "El cliente no existe.",
    );
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
      redirigirError(
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

  const precioBase = Number(
    paquete.precioBase,
  );

  const superficieIncluidaM2 =
    Number(
      paquete.superficieIncluidaM2 ??
        0,
    );

  const precioM2Adicional =
    Number(
      paquete.precioM2Adicional ??
        0,
    );

  const calculo = calcularPrecio({
    tipoCalculo:
      paquete.tipoCalculo,
    superficieM2,
    precioBase,
    superficieIncluidaM2,
    precioM2Adicional,
    cargosExtra,
    descuento,
  });

  const vigenciaDias = 15;

  const vigenciaHasta =
    new Date();

  vigenciaHasta.setDate(
    vigenciaHasta.getDate() +
      vigenciaDias,
  );

  await prisma.cotizacion.create({
    data: {
      folio: generarFolio(),

      clienteId,
      inmuebleId,
      paqueteId,

      creadaPorId:
        usuario.id,

      superficieM2,

      precioBase:
        calculo.precioBase,

      metrosAdicionales:
        calculo.metrosAdicionales,

      cargoMetrosAdicionales:
        calculo.cargoMetrosAdicionales,

      cargosExtra,
      descuento,

      subtotal:
        calculo.subtotal,

      total:
        calculo.total,

      estado:
        EstadoCotizacion.BORRADOR,

      estadoPago:
        EstadoPago.PENDIENTE,

      esquemaPago,

      montoPagado: 0,

      vigenciaHasta,

      notas:
        texto(
          formData,
          "notas",
        ) || null,

      observacionesInternas:
        texto(
          formData,
          "observacionesInternas",
        ) || null,
    },
  });

  revalidatePath(
    "/panel/cotizaciones",
  );

  redirigirOk(
    "Cotización creada correctamente.",
  );
}

export async function cambiarEstadoCotizacion(
  formData: FormData,
) {
  const {
    usuario,
  } = await verificarPermiso();

  const id = texto(
    formData,
    "id",
  );

  const nuevoEstado = texto(
    formData,
    "estado",
  ) as EstadoCotizacion;

  if (
    !Object.values(
      EstadoCotizacion,
    ).includes(nuevoEstado)
  ) {
    redirigirError(
      "Estado de cotización inválido.",
    );
  }

  const cotizacion =
    await prisma.cotizacion.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        estado: true,
      },
    });

  if (!cotizacion) {
    redirigirError(
      "La cotización no existe.",
    );
  }

  const estadoActual =
    cotizacion.estado;

  if (
    estadoActual ===
    nuevoEstado
  ) {
    redirigirOk(
      "La cotización ya se encuentra en ese estado.",
    );
  }

  if (
    estadoActual ===
    EstadoCotizacion.BORRADOR
  ) {
    if (
      nuevoEstado !==
      EstadoCotizacion.PENDIENTE_AUTORIZACION
    ) {
      redirigirError(
        "Primero debes solicitar autorización de la cotización.",
      );
    }

    await prisma.cotizacion.update({
      where: {
        id,
      },
      data: {
        estado:
          EstadoCotizacion.PENDIENTE_AUTORIZACION,

        solicitudAutorizacionEn:
          new Date(),

        autorizadaPorId: null,
        autorizadaEn: null,

        rechazadaPorId: null,
        rechazadaEn: null,
        motivoRechazo: null,
      },
    });

    revalidatePath(
      "/panel/cotizaciones",
    );

    redirigirOk(
      "La cotización fue enviada a autorización.",
    );
  }

  if (
    estadoActual ===
    EstadoCotizacion.PENDIENTE_AUTORIZACION
  ) {
    if (
      nuevoEstado ===
      EstadoCotizacion.AUTORIZADA
    ) {
      await prisma.cotizacion.update({
        where: {
          id,
        },
        data: {
          estado:
            EstadoCotizacion.AUTORIZADA,

          autorizadaPorId:
            usuario.id,

          autorizadaEn:
            new Date(),

          rechazadaPorId: null,
          rechazadaEn: null,
          motivoRechazo: null,
        },
      });

      revalidatePath(
        "/panel/cotizaciones",
      );

      redirigirOk(
        "Cotización autorizada correctamente.",
      );
    }

    if (
      nuevoEstado ===
      EstadoCotizacion.RECHAZADA
    ) {
      const motivoRechazo =
        texto(
          formData,
          "motivoRechazo",
        ) || null;

      await prisma.cotizacion.update({
        where: {
          id,
        },
        data: {
          estado:
            EstadoCotizacion.RECHAZADA,

          rechazadaPorId:
            usuario.id,

          rechazadaEn:
            new Date(),

          motivoRechazo,
        },
      });

      revalidatePath(
        "/panel/cotizaciones",
      );

      redirigirOk(
        "Cotización rechazada.",
      );
    }

    redirigirError(
      "La cotización pendiente únicamente puede ser autorizada o rechazada por Administración o Dirección.",
    );
  }

  if (
    estadoActual ===
    EstadoCotizacion.AUTORIZADA
  ) {
    if (
      nuevoEstado !==
      EstadoCotizacion.ENVIADA
    ) {
      redirigirError(
        "Una cotización autorizada únicamente puede pasar a enviada.",
      );
    }

    await prisma.cotizacion.update({
      where: {
        id,
      },
      data: {
        estado:
          EstadoCotizacion.ENVIADA,
      },
    });

    revalidatePath(
      "/panel/cotizaciones",
    );

    revalidatePath(
      "/portal/cotizaciones",
    );

    redirigirOk(
      "Cotización marcada como enviada al cliente.",
    );
  }

  if (
    estadoActual ===
      EstadoCotizacion.ENVIADA &&
    nuevoEstado ===
      EstadoCotizacion.ACEPTADA
  ) {
    redirigirError(
      "La aceptación debe realizarla el cliente desde su portal.",
    );
  }

  redirigirError(
    `La transición ${estadoActual} → ${nuevoEstado} no está permitida en este momento.`,
  );
}

async function obtenerCotizacionPago(
  id: string,
) {
  if (!id) {
    redirigirError(
      "Cotización inválida.",
    );
  }

  const cotizacion =
    await prisma.cotizacion.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        estado: true,
        estadoPago: true,
        esquemaPago: true,
        total: true,
        montoPagado: true,
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
      "Primero el cliente debe aceptar la cotización antes de registrar un pago.",
    );
  }

  return cotizacion;
}

export async function registrarPrimerPago50(
  formData: FormData,
) {
  await verificarPermiso();

  const id = texto(
    formData,
    "id",
  );

  const cotizacion =
    await obtenerCotizacionPago(id);

  if (
    cotizacion.esquemaPago !==
    EsquemaPago.DOS_EXHIBICIONES_50_50
  ) {
    redirigirError(
      "Esta cotización no está configurada para pago en dos exhibiciones 50/50.",
    );
  }

  if (
    cotizacion.estadoPago !==
    EstadoPago.PENDIENTE
  ) {
    redirigirError(
      "El primer 50% ya fue registrado o la cotización ya está liquidada.",
    );
  }

  const total = Number(
    cotizacion.total,
  );

  const primerPago =
    total / 2;

  await prisma.cotizacion.update({
    where: {
      id,
    },
    data: {
      estadoPago:
        EstadoPago.PARCIAL,
      montoPagado:
        primerPago,
    },
  });

  revalidatePath(
    "/panel/cotizaciones",
  );

  revalidatePath(
    "/panel/agenda",
  );

  redirigirOk(
    `Primer 50% registrado correctamente: ${primerPago.toLocaleString(
      "es-MX",
      {
        style: "currency",
        currency: "MXN",
      },
    )}. La cotización ya cumple la condición de pago para que Gerencia o Dirección puedan programar la inspecciÃ³n mediante el flujo vigente.`,
  );
}

export async function registrarSegundoPago50(
  formData: FormData,
) {
  await verificarPermiso();

  const id = texto(
    formData,
    "id",
  );

  const cotizacion =
    await obtenerCotizacionPago(id);

  if (
    cotizacion.esquemaPago !==
    EsquemaPago.DOS_EXHIBICIONES_50_50
  ) {
    redirigirError(
      "Esta cotización no está configurada para pago en dos exhibiciones 50/50.",
    );
  }

  if (
    cotizacion.estadoPago ===
    EstadoPago.PENDIENTE
  ) {
    redirigirError(
      "Primero debes registrar el primer 50% antes de registrar el segundo.",
    );
  }

  if (
    cotizacion.estadoPago ===
    EstadoPago.PAGADO
  ) {
    redirigirOk(
      "La cotización ya se encuentra liquidada al 100%.",
    );
  }

  if (
    cotizacion.estadoPago !==
    EstadoPago.PARCIAL
  ) {
    redirigirError(
      "El segundo 50% no puede registrarse en el estado actual.",
    );
  }

  const total = Number(
    cotizacion.total,
  );

  await prisma.cotizacion.update({
    where: {
      id,
    },
    data: {
      estadoPago:
        EstadoPago.PAGADO,
      montoPagado:
        total,
    },
  });

  revalidatePath(
    "/panel/cotizaciones",
  );

  revalidatePath(
    "/panel/agenda",
  );

  redirigirOk(
    "Segundo 50% registrado. La cotización quedÃ³ liquidada al 100%.",
  );
}

export async function registrarPagoTotal(
  formData: FormData,
) {
  await verificarPermiso();

  const id = texto(
    formData,
    "id",
  );

  const cotizacion =
    await obtenerCotizacionPago(id);

  if (
    cotizacion.esquemaPago !==
    EsquemaPago.UNA_EXHIBICION
  ) {
    redirigirError(
      "Esta cotización está configurada para pago en dos exhibiciones 50/50.",
    );
  }

  if (
    cotizacion.estadoPago ===
    EstadoPago.PAGADO
  ) {
    redirigirOk(
      "La cotización ya se encuentra liquidada al 100%.",
    );
  }

  if (
    cotizacion.estadoPago !==
    EstadoPago.PENDIENTE
  ) {
    redirigirError(
      "El pago total no puede registrarse en el estado actual.",
    );
  }

  const total = Number(
    cotizacion.total,
  );

  await prisma.cotizacion.update({
    where: {
      id,
    },
    data: {
      estadoPago:
        EstadoPago.PAGADO,
      montoPagado:
        total,
    },
  });

  revalidatePath(
    "/panel/cotizaciones",
  );

  revalidatePath(
    "/panel/agenda",
  );

  redirigirOk(
    "Pago total registrado. La cotización quedÃ³ liquidada al 100%.",
  );
}
