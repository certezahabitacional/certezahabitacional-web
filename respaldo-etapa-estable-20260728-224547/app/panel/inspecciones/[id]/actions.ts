"use server";

import {
  ClasificacionHallazgo,
  EstadoInspeccion,
  PrioridadHallazgo,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const texto = (formData: FormData, campo: string) =>
  String(formData.get(campo) ?? "").trim();

function calcularIndice(clasificaciones: ClasificacionHallazgo[]) {
  const evaluables = clasificaciones.filter((valor) => valor !== "NA");
  if (evaluables.length === 0) return null;

  const ponderacion: Record<Exclude<ClasificacionHallazgo, "NA">, number> = {
    C: 100,
    O: 90,
    NC: 70,
    CR: 35,
  };

  return (
    evaluables.reduce((total, valor) => total + ponderacion[valor], 0) /
    evaluables.length
  );
}

function semaforoDesdeIndice(indice: number | null) {
  if (indice === null) return null;
  if (indice >= 90) return "VERDE";
  if (indice >= 75) return "AMARILLO";
  if (indice >= 60) return "NARANJA";
  return "ROJO";
}

export async function crearHallazgo(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const area = texto(formData, "area");
  const titulo = texto(formData, "titulo");
  const descripcion = texto(formData, "descripcion");

  if (!inspeccionId || !area || !titulo || !descripcion) {
    redirect(
      `/panel/inspecciones/${inspeccionId}?error=Completa%20los%20campos%20obligatorios`,
    );
  }

  const costoTexto = texto(formData, "costoEstimado");
  const costoEstimado = costoTexto ? Number(costoTexto) : null;

  await prisma.hallazgo.create({
    data: {
      inspeccionId,
      area,
      titulo,
      descripcion,
      clasificacion: texto(
        formData,
        "clasificacion",
      ) as ClasificacionHallazgo,
      prioridad: texto(formData, "prioridad") as PrioridadHallazgo,
      recomendacion: texto(formData, "recomendacion") || null,
      ubicacion: texto(formData, "ubicacion") || null,
      costoEstimado:
        costoEstimado !== null && Number.isFinite(costoEstimado)
          ? costoEstimado
          : null,
      tiempoReparacion: texto(formData, "tiempoReparacion") || null,
      responsable: texto(formData, "responsable") || null,
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
      semaforo: semaforoDesdeIndice(indice),
    },
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}`);
  revalidatePath("/panel/inspecciones");
  revalidatePath("/panel");
  redirect(`/panel/inspecciones/${inspeccionId}?ok=Hallazgo%20registrado`);
}

export async function cambiarEstado(formData: FormData) {
  const id = texto(formData, "id");
  const estado = texto(formData, "estado") as EstadoInspeccion;

  if (!id || !Object.values(EstadoInspeccion).includes(estado)) {
    return;
  }

  await prisma.inspeccion.update({
    where: { id },
    data: { estado },
  });

  revalidatePath(`/panel/inspecciones/${id}`);
  revalidatePath("/panel/inspecciones");
  revalidatePath("/panel");
}

export async function iniciarInspeccion(formData: FormData) {
  const id = texto(formData, "id");
  if (!id) return;

  await prisma.inspeccion.update({
    where: { id },
    data: { estado: EstadoInspeccion.EN_PROCESO },
  });

  revalidatePath(`/panel/inspecciones/${id}`);
  revalidatePath("/panel");
  redirect(`/panel/inspecciones/${id}/captura`);
}

export async function cancelarInspeccion(formData: FormData) {
  const id = texto(formData, "id");
  if (!id) return;

  await prisma.inspeccion.update({
    where: { id },
    data: { estado: EstadoInspeccion.CANCELADA },
  });

  revalidatePath(`/panel/inspecciones/${id}`);
  revalidatePath("/panel/inspecciones");
  revalidatePath("/panel");
  redirect(`/panel/inspecciones/${id}?ok=Inspeccion%20cancelada`);
}
