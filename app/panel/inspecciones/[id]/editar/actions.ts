"use server";

import { fromZonedTime } from "date-fns-tz";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

const texto = (
  formData: FormData,
  campo: string,
) =>
  String(
    formData.get(campo) ?? "",
  ).trim();

function zonaHorariaValida(
  zonaHoraria: string,
) {
  if (!zonaHoraria) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("es-MX", {
      timeZone: zonaHoraria,
    }).format(new Date());

    return true;
  } catch {
    return false;
  }
}

export async function actualizarInspeccion(
  formData: FormData,
) {
  const id = texto(
    formData,
    "id",
  );

  const inspectorId = texto(
    formData,
    "inspectorId",
  );

  const tipoServicio = texto(
    formData,
    "tipoServicio",
  );

  const fechaTexto = texto(
    formData,
    "fechaProgramada",
  );

  const zonaHoraria = texto(
    formData,
    "zonaHoraria",
  );

  const observaciones = texto(
    formData,
    "observaciones",
  );

  if (
    !id ||
    !tipoServicio ||
    !fechaTexto ||
    !zonaHoraria
  ) {
    redirect(
      `/panel/inspecciones/${id}/editar?error=Completa%20los%20campos%20obligatorios`,
    );
  }

  if (!zonaHorariaValida(zonaHoraria)) {
    redirect(
      `/panel/inspecciones/${id}/editar?error=La%20zona%20horaria%20no%20es%20valida`,
    );
  }

  const fechaProgramada =
    fromZonedTime(
      fechaTexto,
      zonaHoraria,
    );

  if (
    Number.isNaN(
      fechaProgramada.getTime(),
    )
  ) {
    redirect(
      `/panel/inspecciones/${id}/editar?error=La%20fecha%20no%20es%20valida`,
    );
  }

  if (inspectorId) {
    const inspector =
      await prisma.inspector.findFirst({
        where: {
          id: inspectorId,
          activo: true,
          usuario: {
            activo: true,
          },
        },

        select: {
          id: true,
        },
      });

    if (!inspector) {
      redirect(
        `/panel/inspecciones/${id}/editar?error=Inspector%20no%20disponible`,
      );
    }
  }

  await prisma.inspeccion.update({
    where: {
      id,
    },

    data: {
      inspectorId:
        inspectorId || null,

      tipoServicio,

      fechaProgramada,

      zonaHoraria,

      observaciones:
        observaciones || null,
    },
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
    `/panel/inspecciones/${id}?ok=Expediente%20actualizado`,
  );
}