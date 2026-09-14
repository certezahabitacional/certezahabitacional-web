"use server";

import {
  EstadoDecisionRevision,
  EstadoInspeccion,
  RolUsuario,
  TipoEvento,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { puede } from "@/lib/permisos";
import { prisma } from "@/lib/prisma";

function texto(formData: FormData, campo: string) {
  return String(formData.get(campo) ?? "").trim();
}

function urlCertificado(
  inspeccionId: string,
  tipo?: "ok" | "error",
  mensaje?: string,
) {
  const params = new URLSearchParams();
  if (tipo && mensaje) params.set(tipo, mensaje);
  const query = params.toString();
  return `/panel/inspecciones/${inspeccionId}/certificado${query ? `?${query}` : ""}`;
}

async function exigirDirector(
  accion: "CERTIFICADO_REVOCAR" | "CERTIFICADO_REACTIVAR",
) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, rol: true, activo: true },
  });

  if (
    !usuario ||
    !usuario.activo ||
    usuario.rol !== RolUsuario.DIRECTOR ||
    !puede(usuario.rol, accion)
  ) {
    redirect("/acceso");
  }

  return { session, usuario };
}

export async function revocarCertificado(formData: FormData) {
  const { usuario } = await exigirDirector("CERTIFICADO_REVOCAR");
  const inspeccionId = texto(formData, "inspeccionId");
  const motivo = texto(formData, "motivo");

  if (!inspeccionId) throw new Error("No se recibió el identificador de la inspección.");

  if (motivo.length < 10) {
    redirect(
      urlCertificado(
        inspeccionId,
        "error",
        "Escribe un motivo de revocación de al menos 10 caracteres.",
      ),
    );
  }

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      id: true,
      folio: true,
      estado: true,
      inspectorId: true,
      numeroInspeccion: true,
      cotizacionId: true,
      certificado: {
        select: {
          id: true,
          folio: true,
          codigoValidacion: true,
          vigente: true,
          motivoRevocacion: true,
          revocadoEn: true,
        },
      },
    },
  });

  if (!inspeccion?.certificado) {
    redirect(urlCertificado(inspeccionId, "error", "El certificado no existe."));
  }

  if (!inspeccion.certificado.vigente) {
    redirect(
      urlCertificado(
        inspeccionId,
        "ok",
        "El certificado ya se encuentra revocado.",
      ),
    );
  }

  if (!inspeccion.inspectorId) {
    redirect(
      urlCertificado(
        inspeccionId,
        "error",
        "No se puede reabrir el expediente porque no tiene Inspector asignado.",
      ),
    );
  }

  const estadoAnterior = inspeccion.estado;
  const revocadoEn = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.certificado.update({
      where: { inspeccionId },
      data: {
        vigente: false,
        motivoRevocacion: motivo,
        revocadoEn,
      },
    });

    await tx.inspeccion.update({
      where: { id: inspeccionId },
      data: {
        estado: EstadoInspeccion.EN_PROCESO,
        liberacionBloqueada: false,
        bloqueadaPorId: null,
        bloqueadaEn: null,
        motivoBloqueoLiberacion: null,
      },
    });

    await tx.revisionInspeccion.updateMany({
      where: {
        inspeccionId,
        estado: EstadoDecisionRevision.VIGENTE,
      },
      data: { estado: EstadoDecisionRevision.INVALIDADA },
    });

    await tx.$executeRaw`
      UPDATE "InspeccionControlV2"
      SET
        "capturaCerrada" = false,
        "reabiertaEn" = NOW(),
        "reabiertaPorId" = ${usuario.id},
        "motivoReapertura" = ${motivo},
        "actualizadoEn" = NOW()
      WHERE "inspeccionId" = ${inspeccionId}
    `;
  });

  await registrarAuditoria({
    tipo: TipoEvento.REVOCAR_CERTIFICADO,
    entidad: "Certificado",
    entidadId: inspeccion.certificado.id,
    inspeccionId,
    cotizacionId: inspeccion.cotizacionId,
    usuarioId: usuario.id,
    origen: "REAPERTURA_DIRECCION",
    motivo,
    descripcion:
      `Dirección revocó el certificado ${inspeccion.certificado.folio} y reabrió ` +
      `${inspeccion.folio} para corrección por el Inspector. Motivo: ${motivo}`,
    valorAnterior: {
      certificadoVigente: true,
      estadoInspeccion: estadoAnterior,
      capturaCerrada: true,
    },
    valorNuevo: {
      certificadoVigente: false,
      estadoInspeccion: EstadoInspeccion.EN_PROCESO,
      capturaCerrada: false,
      numeroInspeccion: inspeccion.numeroInspeccion,
      motivoReapertura: motivo,
    },
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/captura`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/certificado`);
  revalidatePath(`/certificados/verificar/${inspeccion.certificado.codigoValidacion}`);
  revalidatePath("/certificados");

  redirect(
    `/panel/inspecciones/${inspeccionId}?ok=${encodeURIComponent(
      "Certificado revocado. La inspección volvió a EN PROCESO y quedó disponible para corrección por el Inspector asignado.",
    )}`,
  );
}

export async function reactivarCertificado(formData: FormData) {
  const { usuario } = await exigirDirector("CERTIFICADO_REACTIVAR");
  const inspeccionId = texto(formData, "inspeccionId");

  if (!inspeccionId) throw new Error("No se recibió el identificador de la inspección.");

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      id: true,
      estado: true,
      cotizacionId: true,
      certificado: {
        select: {
          id: true,
          folio: true,
          codigoValidacion: true,
          vigente: true,
          motivoRevocacion: true,
          revocadoEn: true,
        },
      },
    },
  });

  if (!inspeccion?.certificado) {
    redirect(urlCertificado(inspeccionId, "error", "El certificado no existe."));
  }

  if (inspeccion.certificado.vigente) {
    redirect(
      urlCertificado(
        inspeccionId,
        "ok",
        "El certificado ya se encuentra vigente.",
      ),
    );
  }

  if (inspeccion.estado !== EstadoInspeccion.FINALIZADA) {
    redirect(
      urlCertificado(
        inspeccionId,
        "error",
        "El certificado no puede reactivarse mientras la inspección esté reabierta. Primero debe completarse nuevamente el flujo de captura, revisión y aprobación.",
      ),
    );
  }

  const certificado = await prisma.certificado.update({
    where: { inspeccionId },
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
    inspeccionId,
    cotizacionId: inspeccion.cotizacionId,
    usuarioId: usuario.id,
    origen: "REACTIVACION_DIRECCION",
    motivo: "Reactivación posterior a nuevo cierre y aprobación del expediente",
    descripcion: `Dirección reactivó el certificado ${certificado.folio} después de que la inspección volvió a estado FINALIZADA.`,
    valorAnterior: {
      certificadoVigente: false,
      motivoRevocacion: inspeccion.certificado.motivoRevocacion,
      revocadoEn: inspeccion.certificado.revocadoEn?.toISOString() ?? null,
    },
    valorNuevo: {
      certificadoVigente: true,
      motivoRevocacion: null,
      revocadoEn: null,
    },
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/certificado`);
  revalidatePath(`/certificados/verificar/${certificado.codigoValidacion}`);
  revalidatePath("/certificados");

  redirect(
    urlCertificado(
      inspeccionId,
      "ok",
      "Certificado reactivado correctamente después del nuevo cierre y aprobación.",
    ),
  );
}
