"use server";

import { EstadoInspeccion } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

function texto(formData: FormData, campo: string): string {
  return String(formData.get(campo) ?? "").trim();
}

function decimalANumero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;

  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

export async function crearInspeccion(formData: FormData) {
  const clienteId = texto(formData, "clienteId");
  const inmuebleId = texto(formData, "inmuebleId");
  const inspectorId = texto(formData, "inspectorId");
  const tipoServicio = texto(formData, "tipoServicio");
  const fechaProgramadaTexto = texto(formData, "fechaProgramada");
  const observaciones = texto(formData, "observaciones");

  if (!clienteId || !inmuebleId || !tipoServicio || !fechaProgramadaTexto) {
    redirect(
      "/panel/inspecciones/nueva?error=Completa%20los%20campos%20obligatorios",
    );
  }

  const fechaProgramada = new Date(fechaProgramadaTexto);

  if (Number.isNaN(fechaProgramada.getTime())) {
    redirect(
      "/panel/inspecciones/nueva?error=Selecciona%20una%20fecha%20y%20hora%20validas",
    );
  }

  const inmueble = await prisma.inmueble.findUnique({
    where: { id: inmuebleId },
  });

  if (!inmueble || inmueble.clienteId !== clienteId) {
    redirect(
      "/panel/inspecciones/nueva?error=El%20inmueble%20no%20corresponde%20al%20cliente",
    );
  }

  if (inspectorId) {
    const inspector = await prisma.inspector.findFirst({
      where: { id: inspectorId, activo: true },
      select: { id: true },
    });

    if (!inspector) {
      redirect(
        "/panel/inspecciones/nueva?error=El%20inspector%20seleccionado%20no%20esta%20disponible",
      );
    }
  }

  const year = fechaProgramada.getFullYear();
  const inicioYear = new Date(year, 0, 1);
  const inicioSiguienteYear = new Date(year + 1, 0, 1);

  const totalDelYear = await prisma.inspeccion.count({
    where: {
      creadoEn: {
        gte: inicioYear,
        lt: inicioSiguienteYear,
      },
    },
  });

  let consecutivo = totalDelYear + 1;
  let folio = `CH-${year}-${String(consecutivo).padStart(4, "0")}`;

  while (await prisma.inspeccion.findUnique({ where: { folio } })) {
    consecutivo += 1;
    folio = `CH-${year}-${String(consecutivo).padStart(4, "0")}`;
  }

  const inspeccion = await prisma.inspeccion.create({
    data: {
      folio,
      clienteId,
      inmuebleId,
      inspectorId: inspectorId || null,
      tipoServicio,
      tipoInmueble: inmueble.tipo,
      direccion: inmueble.direccion,
      ciudad: inmueble.ciudad,
      superficieM2: decimalANumero(inmueble.superficieConstruccionM2),
      fechaProgramada,
      estado: EstadoInspeccion.PROGRAMADA,
      observaciones: observaciones || null,
    },
  });

  revalidatePath("/panel");
  revalidatePath("/panel/agenda");
  revalidatePath("/panel/inspecciones");

  redirect(`/panel/inspecciones/${inspeccion.id}`);
}
