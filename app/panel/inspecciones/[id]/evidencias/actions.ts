"use server";

import { randomUUID } from "node:crypto";
import {
  EstadoInspeccion,
  RolUsuario,
  TipoEvento,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

const texto = (formData: FormData, campo: string) =>
  String(formData.get(campo) ?? "").trim();

function obtenerSupabase() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function urlEvidencias(
  inspeccionId: string,
  hallazgoId?: string,
  tipo?: "ok" | "error",
  mensaje?: string,
) {
  const params = new URLSearchParams();

  if (hallazgoId) {
    params.set("hallazgoId", hallazgoId);
  }

  if (tipo && mensaje) {
    params.set(tipo, mensaje);
  }

  const query = params.toString();

  return `/panel/inspecciones/${inspeccionId}/evidencias${
    query ? `?${query}` : ""
  }`;
}

function redirigirError(
  inspeccionId: string,
  hallazgoId: string | undefined,
  mensaje: string,
): never {
  redirect(
    urlEvidencias(
      inspeccionId,
      hallazgoId,
      "error",
      mensaje,
    ),
  );
}

async function exigirPermisoEvidencias(
  inspeccionId: string,
  modo: "CONSULTAR" | "MODIFICAR",
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
        zonaId: true,
        gerenteId: true,
        inspector: {
          select: {
            id: true,
            activo: true,
          },
        },
      },
    });

  if (!usuario || !usuario.activo) {
    redirect("/acceso");
  }

  if (usuario.rol === RolUsuario.CLIENTE) {
    redirect("/portal");
  }

  if (usuario.rol === RolUsuario.ADMINISTRADOR) {
    redirect("/acceso");
  }

  const inspeccion =
    await prisma.inspeccion.findUnique({
      where: {
        id: inspeccionId,
      },
      select: {
        id: true,
        estado: true,
        zonaId: true,
        inspectorId: true,
        inspector: {
          select: {
            usuarioId: true,
            usuario: {
              select: {
                zonaId: true,
                gerenteId: true,
                coordinadorId: true,
              },
            },
          },
        },
      },
    });

  if (!inspeccion) {
    redirigirError(
      inspeccionId,
      undefined,
      "La inspección no existe.",
    );
  }

  if (usuario.rol === RolUsuario.DIRECTOR) {
    return {
      session,
      usuario,
      inspeccion,
    };
  }

  if (usuario.rol === RolUsuario.GERENTE) {
    if (
      inspeccion.inspector?.usuario.gerenteId !== usuario.id
    ) {
      redirect("/acceso");
    }

    if (modo === "MODIFICAR") {
      redirigirError(
        inspeccionId,
        undefined,
        "Gerencia puede consultar evidencias, pero no modificarlas.",
      );
    }

    return {
      session,
      usuario,
      inspeccion,
    };
  }

  if (usuario.rol === RolUsuario.COORDINADOR) {
    if (
      inspeccion.inspector?.usuario
        .coordinadorId !== usuario.id
    ) {
      redirect("/acceso");
    }

    if (modo === "MODIFICAR") {
      redirigirError(
        inspeccionId,
        undefined,
        "Coordinación puede consultar evidencias, pero no modificarlas.",
      );
    }

    return {
      session,
      usuario,
      inspeccion,
    };
  }

  if (usuario.rol === RolUsuario.INSPECTOR) {
    if (
      !usuario.inspector ||
      !usuario.inspector.activo ||
      inspeccion.inspectorId !==
        usuario.inspector.id ||
      inspeccion.inspector?.usuarioId !==
        usuario.id
    ) {
      redirect("/acceso");
    }

    if (
      modo === "MODIFICAR" &&
      inspeccion.estado !==
        EstadoInspeccion.EN_PROCESO
    ) {
      redirigirError(
        inspeccionId,
        undefined,
        "Las evidencias solo pueden modificarse mientras la inspección está EN PROCESO.",
      );
    }

    return {
      session,
      usuario,
      inspeccion,
    };
  }

  redirect("/acceso");
}

export async function registrarEvidencia(
  formData: FormData,
) {
  const inspeccionId = texto(
    formData,
    "inspeccionId",
  );

  const hallazgoId = texto(
    formData,
    "hallazgoId",
  );

  const descripcion = texto(
    formData,
    "descripcion",
  );

  const archivo =
    formData.get("archivo");

  if (!inspeccionId) {
    redirect(
      "/panel/inspecciones?error=No%20se%20identifico%20la%20inspeccion",
    );
  }

  const {
    session,
    usuario,
  } = await exigirPermisoEvidencias(
    inspeccionId,
    "MODIFICAR",
  );

  if (
    !(archivo instanceof File) ||
    archivo.size === 0
  ) {
    redirigirError(
      inspeccionId,
      hallazgoId || undefined,
      "Selecciona una fotografía.",
    );
  }

  const tiposPermitidos = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (
    !tiposPermitidos.includes(
      archivo.type,
    )
  ) {
    redirigirError(
      inspeccionId,
      hallazgoId || undefined,
      "Formato no permitido.",
    );
  }

  const limiteBytes =
    10 * 1024 * 1024;

  if (
    archivo.size >
    limiteBytes
  ) {
    redirigirError(
      inspeccionId,
      hallazgoId || undefined,
      "La imagen supera 10 MB.",
    );
  }

  if (hallazgoId) {
    const hallazgo =
      await prisma.hallazgo.findFirst({
        where: {
          id: hallazgoId,
          inspeccionId,
        },
        select: {
          id: true,
        },
      });

    if (!hallazgo) {
      redirigirError(
        inspeccionId,
        hallazgoId,
        "El hallazgo no pertenece a esta inspección.",
      );
    }
  }

  const extension =
    archivo.name
      .split(".")
      .pop()
      ?.toLowerCase() ||
    archivo.type
      .split("/")
      .pop() ||
    "jpg";

  const rutaStorage =
    `${inspeccionId}/${randomUUID()}.${extension}`;

  const buffer = Buffer.from(
    await archivo.arrayBuffer(),
  );

  const supabase =
    obtenerSupabase();

  const bucket =
    process.env
      .SUPABASE_STORAGE_BUCKET ||
    "evidencias";

  const {
    error: errorSubida,
  } = await supabase.storage
    .from(bucket)
    .upload(
      rutaStorage,
      buffer,
      {
        contentType:
          archivo.type,
        upsert: false,
      },
    );

  if (errorSubida) {
    console.error(
      "Error al subir evidencia a Supabase:",
      errorSubida,
    );

    redirigirError(
      inspeccionId,
      hallazgoId || undefined,
      "No se pudo subir la fotografía.",
    );
  }

  try {
    const fotografia =
      await prisma.fotografia.create({
        data: {
          inspeccionId,
          hallazgoId:
            hallazgoId || null,
          url: rutaStorage,
          subidaPorId: session.user.id,
          descripcion:
            descripcion || null,
        },
      });

    await registrarAuditoria({
      tipo:
        TipoEvento.SUBIR_EVIDENCIA,
      entidad: "Fotografia",
      entidadId:
        fotografia.id,
      inspeccionId,
      usuarioId:
        session.user.id,
      descripcion:
        descripcion
          ? `${usuario.rol} agregó una evidencia fotográfica: ${descripcion}.`
          : hallazgoId
            ? `${usuario.rol} agregó una evidencia fotográfica vinculada a un hallazgo.`
            : `${usuario.rol} agregó una evidencia fotográfica general del expediente.`,
    });
  } catch (error) {
    await supabase.storage
      .from(bucket)
      .remove([
        rutaStorage,
      ]);

    console.error(
      "Error al registrar evidencia en Prisma:",
      error,
    );

    redirigirError(
      inspeccionId,
      hallazgoId || undefined,
      "No se pudo registrar la evidencia.",
    );
  }

  revalidatePath(
    `/panel/inspecciones/${inspeccionId}`,
  );

  revalidatePath(
    `/panel/inspecciones/${inspeccionId}/captura`,
  );

  revalidatePath(
    `/panel/inspecciones/${inspeccionId}/evidencias`,
  );

  redirect(
    urlEvidencias(
      inspeccionId,
      hallazgoId || undefined,
      "ok",
      "Evidencia guardada.",
    ),
  );
}

export async function eliminarEvidencia(
  formData: FormData,
) {
  const inspeccionId = texto(
    formData,
    "inspeccionId",
  );

  const fotografiaId = texto(
    formData,
    "fotografiaId",
  );

  const hallazgoIdContexto =
    texto(
      formData,
      "hallazgoId",
    );

  if (
    !inspeccionId ||
    !fotografiaId
  ) {
    redirect(
      inspeccionId
        ? urlEvidencias(
            inspeccionId,
            hallazgoIdContexto ||
              undefined,
            "error",
            "No se pudo identificar la evidencia.",
          )
        : "/panel/inspecciones?error=No%20se%20identifico%20la%20inspeccion",
    );
  }

  const {
    session,
    usuario,
  } = await exigirPermisoEvidencias(
    inspeccionId,
    "MODIFICAR",
  );

  const fotografia =
    await prisma.fotografia.findFirst({
      where: {
        id: fotografiaId,
        inspeccionId,
      },
      select: {
        id: true,
        url: true,
        hallazgoId: true,
        descripcion: true,
      },
    });

  if (!fotografia) {
    redirigirError(
      inspeccionId,
      hallazgoIdContexto ||
        undefined,
      "Evidencia no encontrada.",
    );
  }

  if (
    !fotografia.url.startsWith(
      "http://",
    ) &&
    !fotografia.url.startsWith(
      "https://",
    )
  ) {
    const supabase =
      obtenerSupabase();

    const bucket =
      process.env
        .SUPABASE_STORAGE_BUCKET ||
      "evidencias";

    const {
      error: errorStorage,
    } = await supabase.storage
      .from(bucket)
      .remove([
        fotografia.url,
      ]);

    if (errorStorage) {
      console.error(
        "No se pudo borrar el archivo de Supabase:",
        errorStorage,
      );

      redirigirError(
        inspeccionId,
        hallazgoIdContexto ||
          fotografia.hallazgoId ||
          undefined,
        "No se pudo eliminar el archivo de evidencia. Intenta nuevamente.",
      );
    }
  }

  try {
    await prisma.fotografia.delete({
      where: {
        id: fotografia.id,
      },
    });
  } catch (error) {
    console.error(
      "El archivo se eliminó de Storage, pero falló la eliminación del registro en Prisma:",
      error,
    );

    redirigirError(
      inspeccionId,
      hallazgoIdContexto ||
        fotografia.hallazgoId ||
        undefined,
      "El archivo fue eliminado, pero no se pudo actualizar el registro de evidencia. Revisa la bitácora.",
    );
  }

  await registrarAuditoria({
    tipo:
      TipoEvento.ELIMINAR_EVIDENCIA,
    entidad: "Fotografia",
    entidadId:
      fotografia.id,
    inspeccionId,
    usuarioId:
      session.user.id,
    descripcion:
      `${usuario.rol} eliminó una evidencia fotográfica` +
      `${
        fotografia.descripcion
          ? `: ${fotografia.descripcion}`
          : "."
      }`,
  });

  revalidatePath(
    `/panel/inspecciones/${inspeccionId}`,
  );

  revalidatePath(
    `/panel/inspecciones/${inspeccionId}/captura`,
  );

  revalidatePath(
    `/panel/inspecciones/${inspeccionId}/evidencias`,
  );

  redirect(
    urlEvidencias(
      inspeccionId,
      hallazgoIdContexto ||
        fotografia.hallazgoId ||
        undefined,
      "ok",
      "Evidencia eliminada.",
    ),
  );
}
