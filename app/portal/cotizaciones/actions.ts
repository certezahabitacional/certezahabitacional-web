"use server";

import {
  EstadoCotizacion,
  TipoEvento,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { obtenerClienteActual } from "@/lib/cliente-actual";
import { registrarAuditoria } from "@/lib/auditoria";
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
        folio: true,
        estado: true,
        vigenciaHasta: true,
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

  if (cotizacion.vigenciaHasta && cotizacion.vigenciaHasta < new Date()) {
    throw new Error("La vigencia de esta cotización terminó. Contacta a Certeza Habitacional para actualizarla.");
  }

  await prisma.cotizacion.update({
    where: {
      id,
    },
    data: {
      estado:
        EstadoCotizacion.ACEPTADA,
      aceptadaEn: new Date(),
      solicitudAutorizacionEn: new Date(),
    },
  });

  if (cliente.usuarioId) {
    await registrarAuditoria({
      tipo: TipoEvento.EDITAR,
      entidad: "Cotizacion",
      entidadId: id,
      usuarioId: cliente.usuarioId,
      descripcion: `El cliente aceptó la cotización ${cotizacion.folio} desde el portal.`,
    });
  }

  revalidatePath(
    "/portal",
  );

  revalidatePath(
    "/portal/cotizaciones",
  );

  revalidatePath(
    `/portal/cotizaciones/${id}`,
  );
  revalidatePath("/panel/cotizaciones");
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
        folio: true,
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

  if (cliente.usuarioId) {
    await registrarAuditoria({
      tipo: TipoEvento.EDITAR,
      entidad: "Cotizacion",
      entidadId: id,
      usuarioId: cliente.usuarioId,
      descripcion: `El cliente rechazó la cotización ${cotizacion.folio} desde el portal.${motivo ? ` Motivo: ${motivo}` : ""}`,
    });
  }

  revalidatePath(
    "/portal",
  );

  revalidatePath(
    "/portal/cotizaciones",
  );

  revalidatePath(
    `/portal/cotizaciones/${id}`,
  );
  revalidatePath("/panel/cotizaciones");
}