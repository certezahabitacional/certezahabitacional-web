import { EstadoInspeccion } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

export default async function FlujoRetiradoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    select: { id: true, estado: true, numeroInspeccion: true },
  });
  if (!inspeccion) notFound();

  if (inspeccion.estado === EstadoInspeccion.PROGRAMADA) {
    redirect(`/panel/inspecciones/${id}/revision-inicial`);
  }

  redirect(inspeccion.numeroInspeccion === 1
    ? `/panel/inspecciones/${id}/areas`
    : `/panel/inspecciones/${id}/captura`);
}
