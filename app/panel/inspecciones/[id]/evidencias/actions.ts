"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { TipoEvento } from "@prisma/client";
import { registrarAuditoria } from "@/lib/auditoria";

const texto = (formData: FormData, campo: string) =>
  String(formData.get(campo) ?? "").trim();

function obtenerSupabase() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

export async function registrarEvidencia(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const hallazgoId = texto(formData, "hallazgoId");
  const descripcion = texto(formData, "descripcion");
  const archivo = formData.get("archivo");

  if (!inspeccionId) {
    redirect(
      "/panel/inspecciones?error=No%20se%20identifico%20la%20inspeccion",
    );
  }

  if (!(archivo instanceof File) || archivo.size === 0) {
    redirect(
      urlEvidencias(
        inspeccionId,
        hallazgoId,
        "error",
        "Selecciona una fotografía",
      ),
    );
  }

  const tiposPermitidos = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (!tiposPermitidos.includes(archivo.type)) {
    redirect(
      urlEvidencias(
        inspeccionId,
        hallazgoId,
        "error",
        "Formato no permitido",
      ),
    );
  }

  const limiteBytes = 10 * 1024 * 1024;

  if (archivo.size > limiteBytes) {
    redirect(
      urlEvidencias(
        inspeccionId,
        hallazgoId,
        "error",
        "La imagen supera 10 MB",
      ),
    );
  }

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: { id: true },
  });

  if (!inspeccion) {
    redirect(
      urlEvidencias(
        inspeccionId,
        hallazgoId,
        "error",
        "Expediente no encontrado",
      ),
    );
  }

  if (hallazgoId) {
    const hallazgo = await prisma.hallazgo.findFirst({
      where: {
        id: hallazgoId,
        inspeccionId,
      },
      select: { id: true },
    });

    if (!hallazgo) {
      redirect(
        urlEvidencias(
          inspeccionId,
          hallazgoId,
          "error",
          "Hallazgo no válido",
        ),
      );
    }
  }

  const extension =
    archivo.name.split(".").pop()?.toLowerCase() ||
    archivo.type.split("/").pop() ||
    "jpg";

  const rutaStorage =
    `${inspeccionId}/${randomUUID()}.${extension}`;

  const buffer = Buffer.from(
    await archivo.arrayBuffer(),
  );

  const supabase = obtenerSupabase();
  const bucket =
    process.env.SUPABASE_STORAGE_BUCKET || "evidencias";

  const { error: errorSubida } =
    await supabase.storage
      .from(bucket)
      .upload(rutaStorage, buffer, {
        contentType: archivo.type,
        upsert: false,
      });

  if (errorSubida) {
    console.error(
      "Error al subir evidencia a Supabase:",
      errorSubida,
    );

    redirect(
      urlEvidencias(
        inspeccionId,
        hallazgoId,
        "error",
        "No se pudo subir la fotografía",
      ),
    );
  }

  try {
    const fotografia =
      await prisma.fotografia.create({
        data: {
          inspeccionId,
          hallazgoId: hallazgoId || null,
          url: rutaStorage,
          descripcion: descripcion || null,
        },
      });

    await registrarAuditoria({
      tipo: TipoEvento.SUBIR_EVIDENCIA,
      entidad: "Fotografia",
      entidadId: fotografia.id,
      inspeccionId,
      descripcion: descripcion
        ? `Se agregó una evidencia fotográfica: ${descripcion}.`
        : hallazgoId
          ? "Se agregó una evidencia fotográfica vinculada a un hallazgo."
          : "Se agregó una evidencia fotográfica del expediente.",
    });
  } catch (error) {
    await supabase.storage
      .from(bucket)
      .remove([rutaStorage]);

    console.error(
      "Error al registrar evidencia en Prisma:",
      error,
    );

    redirect(
      urlEvidencias(
        inspeccionId,
        hallazgoId,
        "error",
        "No se pudo registrar la evidencia",
      ),
    );
  }

  revalidatePath(
    `/panel/inspecciones/${inspeccionId}`,
  );

  revalidatePath(
    `/panel/inspecciones/${inspeccionId}/evidencias`,
  );

  redirect(
    urlEvidencias(
      inspeccionId,
      hallazgoId,
      "ok",
      "Evidencia guardada",
    ),
  );
}

export async function eliminarEvidencia(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const fotografiaId = texto(formData, "fotografiaId");
  const hallazgoIdContexto = texto(formData, "hallazgoId");

  if (!inspeccionId || !fotografiaId) {
    redirect(
      inspeccionId
        ? urlEvidencias(
            inspeccionId,
            hallazgoIdContexto,
            "error",
            "No se pudo identificar la evidencia",
          )
        : "/panel/inspecciones?error=No%20se%20identifico%20la%20inspeccion",
    );
  }

  const fotografia = await prisma.fotografia.findFirst({
    where: {
      id: fotografiaId,
      inspeccionId,
    },
    select: {
      id: true,
      url: true,
      hallazgoId: true,
    },
  });

  if (!fotografia) {
    redirect(
      urlEvidencias(
        inspeccionId,
        hallazgoIdContexto,
        "error",
        "Evidencia no encontrada",
      ),
    );
  }

  try {
    await prisma.fotografia.delete({
      where: {
        id: fotografia.id,
      },
    });
  } catch (error) {
    console.error(
      "Error al eliminar evidencia en Prisma:",
      error,
    );

    redirect(
      urlEvidencias(
        inspeccionId,
        hallazgoIdContexto || fotografia.hallazgoId || undefined,
        "error",
        "No se pudo eliminar la evidencia",
      ),
    );
  }

  if (
    !fotografia.url.startsWith("http://") &&
    !fotografia.url.startsWith("https://")
  ) {
    const supabase = obtenerSupabase();
    const bucket =
      process.env.SUPABASE_STORAGE_BUCKET || "evidencias";

    const { error: errorStorage } =
      await supabase.storage
        .from(bucket)
        .remove([fotografia.url]);

    if (errorStorage) {
      console.error(
        "La evidencia se eliminó de la base de datos, pero no se pudo borrar el archivo de Supabase:",
        errorStorage,
      );
    }
  }

  revalidatePath(
    `/panel/inspecciones/${inspeccionId}`,
  );

  revalidatePath(
    `/panel/inspecciones/${inspeccionId}/evidencias`,
  );

  redirect(
    urlEvidencias(
      inspeccionId,
      hallazgoIdContexto || fotografia.hallazgoId || undefined,
      "ok",
      "Evidencia eliminada",
    ),
  );
}