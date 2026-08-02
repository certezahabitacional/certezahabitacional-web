"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const texto = (formData: FormData, campo: string) =>
  String(formData.get(campo) ?? "").trim();

export async function actualizarInspeccion(formData: FormData) {
  const id = texto(formData, "id");
  const inspectorId = texto(formData, "inspectorId");
  const tipoServicio = texto(formData, "tipoServicio");
  const fechaTexto = texto(formData, "fechaProgramada");
  const observaciones = texto(formData, "observaciones");

  if (!id || !tipoServicio || !fechaTexto) {
    redirect(
      `/panel/inspecciones/${id}/editar?error=Completa%20los%20campos%20obligatorios`,
    );
  }

  const fechaProgramada = new Date(fechaTexto);
  if (Number.isNaN(fechaProgramada.getTime())) {
    redirect(
      `/panel/inspecciones/${id}/editar?error=La%20fecha%20no%20es%20valida`,
    );
  }

  if (inspectorId) {
    const inspector = await prisma.inspector.findFirst({
      where: { id: inspectorId, activo: true },
      select: { id: true },
    });

    if (!inspector) {
      redirect(
        `/panel/inspecciones/${id}/editar?error=Inspector%20no%20disponible`,
      );
    }
  }

  await prisma.inspeccion.update({
    where: { id },
    data: {
      inspectorId: inspectorId || null,
      tipoServicio,
      fechaProgramada,
      observaciones: observaciones || null,
    },
  });

  revalidatePath(`/panel/inspecciones/${id}`);
  revalidatePath(`/panel/inspecciones/${id}/editar`);
  revalidatePath("/panel/agenda");
  revalidatePath("/panel");
  redirect(`/panel/inspecciones/${id}?ok=Expediente%20actualizado`);
}
