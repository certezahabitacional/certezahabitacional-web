import { EstadoInspeccion } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

// Mantener compatibilidad con enlaces existentes sin saltar la revision inicial.
export default async function PlanInspeccionRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    select: { estado: true, numeroInspeccion: true },
  });
  if (!inspeccion) notFound();
  if (inspeccion.estado === EstadoInspeccion.PROGRAMADA) {
    redirect(`/panel/inspecciones/${id}/revision-inicial`);
  }
  if (inspeccion.numeroInspeccion !== 1) {
    redirect(`/panel/inspecciones/${id}/captura`);
  }
  redirect(`/panel/inspecciones/${id}/flujo`);
}
