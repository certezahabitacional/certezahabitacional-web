"use server";

import { EstadoInspeccion } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const obtenerTexto = (formData: FormData, campo: string): string =>
  String(formData.get(campo) ?? "").trim();

function convertirDecimal(valor: FormDataEntryValue | null): number | null {
  if (valor === null) return null;

  const texto = String(valor).trim().replace(",", ".");

  if (!texto) return null;

  const numero = Number(texto);

  return Number.isFinite(numero) ? numero : null;
}

export async function crearInspeccion(formData: FormData) {
  const clienteId = obtenerTexto(formData, "clienteId");
  const inmuebleId = obtenerTexto(formData, "inmuebleId");
  const inspectorId = obtenerTexto(formData, "inspectorId");
  const tipoServicio = obtenerTexto(formData, "tipoServicio");
  const tipoInmueble = obtenerTexto(formData, "tipoInmueble");
  const direccion = obtenerTexto(formData, "direccion");
  const ciudad = obtenerTexto(formData, "ciudad");
  const fechaProgramadaTexto = obtenerTexto(
    formData,
    "fechaProgramada",
  );

  if (
    !clienteId ||
    !inmuebleId ||
    !tipoServicio ||
    !tipoInmueble ||
    !direccion ||
    !ciudad ||
    !fechaProgramadaTexto
  ) {
    redirect(
      "/panel/inspecciones/nueva?error=Completa%20los%20campos%20obligatorios",
    );
  }

  const fechaProgramada = new Date(fechaProgramadaTexto);

  if (Number.isNaN(fechaProgramada.getTime())) {
    redirect(
      "/panel/inspecciones/nueva?error=Fecha%20programada%20inválida",
    );
  }

  const year = new Date().getFullYear();

  const totalInspecciones = await prisma.inspeccion.count({
    where: {
      folio: {
        startsWith: `CH-${year}-`,
      },
    },
  });

  const folio = `CH-${year}-${String(totalInspecciones + 1).padStart(
    4,
    "0",
  )}`;

  const inspeccion = await prisma.inspeccion.create({
    data: {
      folio,
      clienteId,
      inmuebleId,
      inspectorId: inspectorId || null,
      tipoServicio,
      tipoInmueble,
      direccion,
      ciudad,
      superficieM2: convertirDecimal(formData.get("superficieM2")),
      fechaProgramada,
      estado: EstadoInspeccion.PROGRAMADA,
      observaciones:
        obtenerTexto(formData, "observaciones") || null,
    },
  });

  revalidatePath("/panel");
  revalidatePath("/panel/inspecciones");
  revalidatePath("/panel/agenda");

  redirect(`/panel/inspecciones/${inspeccion.id}`);
}