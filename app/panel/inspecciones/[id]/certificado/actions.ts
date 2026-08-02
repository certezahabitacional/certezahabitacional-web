"use server";
import { TipoEvento } from "@prisma/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

function texto(formData: FormData, campo: string) {
  return String(formData.get(campo) ?? "").trim();
}

export async function revocarCertificado(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const motivo = texto(formData, "motivo");

  if (!inspeccionId) {
    throw new Error(
      "No se recibió el identificador de la inspección.",
    );
  }

  if (motivo.length < 10) {
    redirect(
      `/panel/inspecciones/${inspeccionId}/certificado?error=${encodeURIComponent(
        "Escribe un motivo de revocación de al menos 10 caracteres.",
      )}`,
    );
  }

  const certificado = await prisma.certificado.update({
    where: {
      inspeccionId,
    },
    data: {
      vigente: false,
      motivoRevocacion: motivo,
      revocadoEn: new Date(),
    },
  });
  await registrarAuditoria({
    tipo: TipoEvento.REVOCAR_CERTIFICADO,
    entidad: "Certificado",
    entidadId: certificado.id,
    descripcion: `Se revocó el certificado ${certificado.folio}. Motivo: ${motivo}`,
  });

  revalidatePath(
    `/panel/inspecciones/${inspeccionId}/certificado`,
  );

  revalidatePath(
    `/certificados/verificar/${certificado.codigoValidacion}`,
  );

  revalidatePath("/certificados");

  redirect(
    `/panel/inspecciones/${inspeccionId}/certificado?ok=${encodeURIComponent(
      "Certificado revocado correctamente.",
    )}`,
  );
}

export async function reactivarCertificado(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");

  if (!inspeccionId) {
    throw new Error(
      "No se recibió el identificador de la inspección.",
    );
  }

  const certificado = await prisma.certificado.update({
    where: {
      inspeccionId,
    },
    data: {
      vigente: true,
      motivoRevocacion: null,
      revocadoEn: null,
    },
  });
  
  await registrarAuditoria({
   tipo: TipoEvento.REACTIVAR_CERTIFICADO,
   entidad: "Certificado",
   entidadId: certificado.id,
   descripcion: `Se reactivó el certificado ${certificado.folio}.`,
  });

  revalidatePath(
    `/panel/inspecciones/${inspeccionId}/certificado`,
  );

  revalidatePath(
    `/certificados/verificar/${certificado.codigoValidacion}`,
  );

  revalidatePath("/certificados");

  redirect(
    `/panel/inspecciones/${inspeccionId}/certificado?ok=${encodeURIComponent(
      "Certificado reactivado correctamente.",
    )}`,
  );
}