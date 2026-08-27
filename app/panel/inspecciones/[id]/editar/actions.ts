"use server";

import {
  EstadoInspeccion,
  RolUsuario,
  TipoEvento,
} from "@prisma/client";
import { fromZonedTime } from "date-fns-tz";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

const TIPOS_SERVICIO = new Set([
  "ENTREGA",
  "GARANTIA",
  "USADA",
  "PREVENTIVA",
  "DICTAMEN",
]);

const texto = (
  formData: FormData,
  campo: string,
) =>
  String(
    formData.get(campo) ?? "",
  ).trim();

function redirigirError(
  id: string,
  mensaje: string,
): never {
  redirect(
    `/panel/inspecciones/${id}/editar?error=${encodeURIComponent(
      mensaje,
    )}`,
  );
}

export async function actualizarInspeccion(
  formData: FormData,
) {
  const session =
    await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const id =
    texto(formData, "id");

  const tipoServicio =
    texto(
      formData,
      "tipoServicio",
    );

  const fechaTexto =
    texto(
      formData,
      "fechaProgramada",
    );

  const observaciones =
    texto(
      formData,
      "observaciones",
    );

  if (
    !id ||
    !tipoServicio ||
    !fechaTexto
  ) {
    redirigirError(
      id || "invalida",
      "Completa los campos obligatorios.",
    );
  }

  if (
    !TIPOS_SERVICIO.has(
      tipoServicio,
    )
  ) {
    redirigirError(
      id,
      "El tipo de inspección seleccionado no es válido.",
    );
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
    !usuario.activo
  ) {
    redirect("/acceso");
  }

  if (
    usuario.rol !==
      RolUsuario.GERENTE &&
    usuario.rol !==
      RolUsuario.DIRECTOR
  ) {
    redirect("/acceso");
  }

  const inspeccion =
    await prisma.inspeccion.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        folio: true,
        estado: true,
        tipoServicio: true,
        fechaProgramada: true,
        observaciones: true,
        zonaHoraria: true,
        inspectorId: true,
        certificado: {
          select: {
            vigente: true,
          },
        },
        inspector: {
          select: {
            usuario: {
              select: {
                gerenteId: true,
              },
            },
          },
        },
      },
    });

  if (!inspeccion) {
    redirigirError(
      id,
      "La inspección no existe.",
    );
  }

  if (
    usuario.rol ===
    RolUsuario.GERENTE
  ) {
    if (
      !inspeccion.inspectorId ||
      inspeccion.inspector?.usuario
        .gerenteId !==
        usuario.id
    ) {
      redirect("/acceso");
    }

    if (
      inspeccion.estado !==
      EstadoInspeccion.PROGRAMADA
    ) {
      redirigirError(
        id,
        "Gerencia solo puede editar los datos operativos mientras la inspección está PROGRAMADA.",
      );
    }
  }

  if (
    usuario.rol ===
      RolUsuario.DIRECTOR &&
    inspeccion.estado ===
      EstadoInspeccion.CANCELADA
  ) {
    redirigirError(
      id,
      "Una inspección CANCELADA no puede modificarse desde este flujo.",
    );
  }

  if (
    usuario.rol ===
      RolUsuario.DIRECTOR &&
    inspeccion.certificado?.vigente
  ) {
    redirigirError(
      id,
      "El expediente tiene un certificado vigente. Revoca el certificado antes de modificar datos estructurales.",
    );
  }

  let fechaProgramada: Date;

  try {
    fechaProgramada =
      fromZonedTime(
        fechaTexto,
        inspeccion.zonaHoraria,
      );
  } catch {
    redirigirError(
      id,
      "La fecha y hora no son válidas.",
    );
  }

  if (
    Number.isNaN(
      fechaProgramada.getTime(),
    )
  ) {
    redirigirError(
      id,
      "La fecha y hora no son válidas.",
    );
  }

  await prisma.inspeccion.update({
    where: {
      id,
    },
    data: {
      tipoServicio,
      fechaProgramada,
      observaciones:
        observaciones || null,
    },
  });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "Inspeccion",
    entidadId: inspeccion.id,
    inspeccionId:
      inspeccion.id,
    usuarioId:
      usuario.id,
    descripcion:
      `${usuario.rol} actualizó los datos operativos de la inspección ${inspeccion.folio}. ` +
      `Tipo: ${inspeccion.tipoServicio} → ${tipoServicio}. ` +
      `Fecha anterior: ${inspeccion.fechaProgramada.toISOString()}. ` +
      `Fecha nueva: ${fechaProgramada.toISOString()}.`,
  });

  revalidatePath(
    `/panel/inspecciones/${id}`,
  );

  revalidatePath(
    `/panel/inspecciones/${id}/editar`,
  );

  revalidatePath(
    "/panel/agenda",
  );

  revalidatePath(
    "/panel/inspecciones",
  );

  revalidatePath(
    "/panel",
  );

  redirect(
    `/panel/inspecciones/${id}?ok=${encodeURIComponent(
      "Expediente actualizado.",
    )}`,
  );
}
