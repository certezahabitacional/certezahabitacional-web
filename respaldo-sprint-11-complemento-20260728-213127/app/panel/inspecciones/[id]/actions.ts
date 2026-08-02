"use server";

import {
  ClasificacionHallazgo,
  EstadoInspeccion,
  PrioridadHallazgo,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const value = (formData: FormData, name: string) =>
  String(formData.get(name) ?? "").trim();

function calcularIndice(clasificaciones: ClasificacionHallazgo[]) {
  if (!clasificaciones.length) return null;

  const ponderacion: Record<ClasificacionHallazgo, number> = {
    C: 100,
    O: 90,
    NC: 70,
    CR: 35,
    NA: 100,
  };

  return (
    clasificaciones.reduce(
      (acumulado, clasificacion) => acumulado + ponderacion[clasificacion],
      0,
    ) / clasificaciones.length
  );
}

function obtenerSemaforo(indice: number | null) {
  if (indice === null) return null;
  if (indice >= 90) return "VERDE";
  if (indice >= 75) return "AMARILLO";
  if (indice >= 60) return "NARANJA";
  return "ROJO";
}

function obtenerDictamen(indice: number) {
  if (indice >= 90) {
    return "La vivienda presenta una condición habitacional favorable, sin perjuicio de las observaciones puntuales contenidas en el reporte técnico.";
  }

  if (indice >= 75) {
    return "La vivienda presenta una condición habitacional aceptable, con partidas que requieren atención y seguimiento correctivo.";
  }

  if (indice >= 60) {
    return "La vivienda requiere acciones correctivas relevantes antes de considerarse en condición habitacional favorable.";
  }

  return "La vivienda presenta condiciones críticas que requieren valoración especializada y atención prioritaria.";
}

export async function crearHallazgo(formData: FormData) {
  const inspeccionId = value(formData, "inspeccionId");
  const area = value(formData, "area");
  const titulo = value(formData, "titulo");
  const descripcion = value(formData, "descripcion");

  if (!inspeccionId || !area || !titulo || !descripcion) {
    throw new Error("Faltan datos obligatorios para registrar el hallazgo.");
  }

  await prisma.hallazgo.create({
    data: {
      inspeccionId,
      area,
      titulo,
      descripcion,
      clasificacion: value(
        formData,
        "clasificacion",
      ) as ClasificacionHallazgo,
      prioridad: value(formData, "prioridad") as PrioridadHallazgo,
      recomendacion: value(formData, "recomendacion") || null,
      ubicacion: value(formData, "ubicacion") || null,
      costoEstimado: value(formData, "costoEstimado")
        ? Number(value(formData, "costoEstimado"))
        : null,
      tiempoReparacion: value(formData, "tiempoReparacion") || null,
      responsable: value(formData, "responsable") || null,
    },
  });

  const hallazgos = await prisma.hallazgo.findMany({
    where: { inspeccionId },
    select: { clasificacion: true },
  });

  const indice = calcularIndice(
    hallazgos.map((hallazgo) => hallazgo.clasificacion),
  );

  await prisma.inspeccion.update({
    where: { id: inspeccionId },
    data: {
      estado: EstadoInspeccion.EN_PROCESO,
      ish: indice,
      semaforo: obtenerSemaforo(indice),
    },
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/reporte`);
  revalidatePath("/panel");
}

export async function cambiarEstado(formData: FormData) {
  const id = value(formData, "id");
  const estado = value(formData, "estado") as EstadoInspeccion;

  await prisma.inspeccion.update({
    where: { id },
    data: { estado },
  });

  revalidatePath(`/panel/inspecciones/${id}`);
  revalidatePath(`/panel/inspecciones/${id}/reporte`);
  revalidatePath("/panel");
}

export async function emitirCertificado(formData: FormData) {
  const inspeccionId = value(formData, "inspeccionId");

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    include: {
      certificado: true,
      hallazgos: { select: { clasificacion: true } },
    },
  });

  if (!inspeccion) {
    throw new Error("No se encontró la inspección.");
  }

  if (inspeccion.certificado) {
    redirect(`/panel/inspecciones/${inspeccionId}/certificado`);
  }

  const indiceCalculado = calcularIndice(
    inspeccion.hallazgos.map((hallazgo) => hallazgo.clasificacion),
  );
  const indice = Number(inspeccion.ish ?? indiceCalculado ?? 100);
  const folioCertificado = `CERT-${inspeccion.folio}`;
  const codigoValidacion = randomUUID().replaceAll("-", "").toUpperCase();

  await prisma.$transaction([
    prisma.certificado.create({
      data: {
        inspeccionId,
        folio: folioCertificado,
        codigoValidacion,
        dictamen: obtenerDictamen(indice),
        ish: indice,
      },
    }),
    prisma.inspeccion.update({
      where: { id: inspeccionId },
      data: {
        estado: EstadoInspeccion.FINALIZADA,
        ish: indice,
        semaforo: obtenerSemaforo(indice),
      },
    }),
  ]);

  revalidatePath(`/panel/inspecciones/${inspeccionId}`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/reporte`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/certificado`);
  revalidatePath("/panel");
  redirect(`/panel/inspecciones/${inspeccionId}/certificado`);
}
