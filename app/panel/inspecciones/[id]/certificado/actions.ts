"use server";

import {
  RolUsuario,
  TipoEvento,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { puede } from "@/lib/permisos";
import { prisma } from "@/lib/prisma";

function texto(
  formData: FormData,
  campo: string,
) {
  return String(
    formData.get(campo) ?? "",
  ).trim();
}

function urlCertificado(
  inspeccionId: string,
  tipo?: "ok" | "error",
  mensaje?: string,
) {
  const params = new URLSearchParams();

  if (tipo && mensaje) {
    params.set(tipo, mensaje);
  }

  const query = params.toString();

  return `/panel/inspecciones/${inspeccionId}/certificado${
    query ? `?${query}` : ""
  }`;
}

async function exigirDirector(
  accion:
    | "CERTIFICADO_REVOCAR"
    | "CERTIFICADO_REACTIVAR",
) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const usuario =
    await prisma.usuario.findUnique({
      where: {
        id: session.user.id,
      },
      select: {
        id: true,
        rol: true,
        activo: true,
      },
    });

  if (
    !usuario ||
    !usuario.activo ||
    usuario.rol !== RolUsuario.DIRECTOR ||
    !puede(usuario.rol, accion)
  ) {
    redirect("/acceso");
  }

  return {
    session,
    usuario,
  };
}

export async function revocarCertificado(
  formData: FormData,
) {
  const {
    usuario,
  } = await exigirDirector(
    "CERTIFICADO_REVOCAR",
  );

  const inspeccionId = texto(
    formData,
    "inspeccionId",
  );

  const motivo = texto(
    formData,
    "motivo",
  );

  if (!inspeccionId) {
    throw new Error(
      "No se recibió el identificador de la inspección.",
    );
  }

  if (motivo.length < 10) {
    redirect(
      urlCertificado(
        inspeccionId,
        "error",
        "Escribe un motivo de revocación de al menos 10 caracteres.",
      ),
    );
  }

  const existente =
    await prisma.certificado.findUnique({
      where: {
        inspeccionId,
      },
      select: {
        id: true,
        folio: true,
        codigoValidacion: true,
        vigente: true,
      },
    });

  if (!existente) {
    redirect(
      urlCertificado(
        inspeccionId,
        "error",
        "El certificado no existe.",
      ),
    );
  }

  if (!existente.vigente) {
    redirect(
      urlCertificado(
        inspeccionId,
        "ok",
        "El certificado ya se encuentra revocado.",
      ),
    );
  }

  const certificado =
    await prisma.certificado.update({
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
    tipo:
      TipoEvento.REVOCAR_CERTIFICADO,
    entidad: "Certificado",
    entidadId:
      certificado.id,
    inspeccionId,
    usuarioId:
      usuario.id,
    descripcion:
      `Dirección revocó el certificado ${certificado.folio}. ` +
      `Motivo: ${motivo}`,
  });

  revalidatePath(
    `/panel/inspecciones/${inspeccionId}`,
  );

  revalidatePath(
    `/panel/inspecciones/${inspeccionId}/certificado`,
  );

  revalidatePath(
    `/certificados/verificar/${certificado.codigoValidacion}`,
  );

  revalidatePath(
    "/certificados",
  );

  redirect(
    urlCertificado(
      inspeccionId,
      "ok",
      "Certificado revocado correctamente.",
    ),
  );
}

export async function reactivarCertificado(
  formData: FormData,
) {
  const {
    usuario,
  } = await exigirDirector(
    "CERTIFICADO_REACTIVAR",
  );

  const inspeccionId = texto(
    formData,
    "inspeccionId",
  );

  if (!inspeccionId) {
    throw new Error(
      "No se recibió el identificador de la inspección.",
    );
  }

  const existente =
    await prisma.certificado.findUnique({
      where: {
        inspeccionId,
      },
      select: {
        id: true,
        folio: true,
        codigoValidacion: true,
        vigente: true,
      },
    });

  if (!existente) {
    redirect(
      urlCertificado(
        inspeccionId,
        "error",
        "El certificado no existe.",
      ),
    );
  }

  if (existente.vigente) {
    redirect(
      urlCertificado(
        inspeccionId,
        "ok",
        "El certificado ya se encuentra vigente.",
      ),
    );
  }

  const certificado =
    await prisma.certificado.update({
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
    tipo:
      TipoEvento.REACTIVAR_CERTIFICADO,
    entidad: "Certificado",
    entidadId:
      certificado.id,
    inspeccionId,
    usuarioId:
      usuario.id,
    descripcion:
      `Dirección reactivó el certificado ${certificado.folio}.`,
  });

  revalidatePath(
    `/panel/inspecciones/${inspeccionId}`,
  );

  revalidatePath(
    `/panel/inspecciones/${inspeccionId}/certificado`,
  );

  revalidatePath(
    `/certificados/verificar/${certificado.codigoValidacion}`,
  );

  revalidatePath(
    "/certificados",
  );

  redirect(
    urlCertificado(
      inspeccionId,
      "ok",
      "Certificado reactivado correctamente.",
    ),
  );
}
