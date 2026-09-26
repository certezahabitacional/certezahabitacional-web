"use server";

import { RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function revocarCertificadoV1(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const inspeccionId = String(formData.get("inspeccionId") ?? "").trim();
  const motivo = String(formData.get("motivo") ?? "").trim();

  if (!inspeccionId) redirect("/panel/inspecciones?error=" + encodeURIComponent("Inspección no identificada."));
  if (motivo.length < 10) {
    redirect(`/panel/inspecciones/${inspeccionId}/reporte-v1?error=${encodeURIComponent("Indica un motivo de revocación de al menos 10 caracteres.")}`);
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { rol: true, activo: true, nombre: true },
  });

  if (!usuario?.activo || usuario.rol !== RolUsuario.DIRECTOR) {
    redirect(`/panel/inspecciones/${inspeccionId}/reporte-v1?error=${encodeURIComponent("Solo Dirección puede revocar un certificado.")}`);
  }

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      id: true,
      folio: true,
      estado: true,
      numeroInspeccion: true,
      certificado: {
        select: {
          id: true,
          folio: true,
          vigente: true,
        },
      },
    },
  });

  if (!inspeccion || inspeccion.numeroInspeccion !== 1 || !inspeccion.certificado) {
    redirect(`/panel/inspecciones/${inspeccionId}/reporte-v1?error=${encodeURIComponent("No existe un certificado V1 para revocar.")}`);
  }

  if (!inspeccion.certificado.vigente) {
    redirect(`/panel/inspecciones/${inspeccionId}/revision?ok=${encodeURIComponent("El certificado ya se encuentra revocado.")}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.certificado.update({
      where: { id: inspeccion.certificado!.id },
      data: {
        vigente: false,
        motivoRevocacion: motivo,
        revocadoEn: new Date(),
      },
    });

    await tx.inspeccion.update({
      where: { id: inspeccionId },
      data: { estado: "REPORTE_PENDIENTE" },
    });

    await tx.revisionInspeccion.updateMany({
      where: {
        inspeccionId,
        rol: RolUsuario.DIRECTOR,
        decision: "APROBADO",
        estado: "VIGENTE",
      },
      data: { estado: "INVALIDADA" },
    });

    await tx.eventoAuditoria.create({
      data: {
        usuarioId: session.user.id,
        inspeccionId,
        tipo: TipoEvento.REVOCAR_CERTIFICADO,
        entidad: "Certificado",
        entidadId: inspeccion.certificado!.id,
        descripcion: `Dirección revocó el certificado ${inspeccion.certificado!.folio}. Motivo: ${motivo}`,
      },
    });
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/reporte-v1`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/revision`);
  revalidatePath("/panel/inspecciones");

  redirect(`/panel/inspecciones/${inspeccionId}/revision?ok=${encodeURIComponent("Certificado revocado. El reporte quedó nuevamente en revisión de Dirección para corrección documental o reapertura técnica.")}`);
}
