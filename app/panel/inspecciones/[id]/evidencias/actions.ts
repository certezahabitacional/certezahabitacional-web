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
      `/panel/inspecciones/${inspeccionId}/evidencias?error=Selecciona%20una%20fotografia`,
    );
  }

  const tiposPermitidos = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (!tiposPermitidos.includes(archivo.type)) {
    redirect(
      `/panel/inspecciones/${inspeccionId}/evidencias?error=Formato%20no%20permitido`,
    );
  }

  const limiteBytes = 10 * 1024 * 1024;

  if (archivo.size > limiteBytes) {
    redirect(
      `/panel/inspecciones/${inspeccionId}/evidencias?error=La%20imagen%20supera%2010%20MB`,
    );
  }

  const inspeccion = await prisma.inspeccion.findUnique({
    where: {
      id: inspeccionId,
    },
    select: {
      id: true,
    },
  });

  if (!inspeccion) {
    redirect(
      `/panel/inspecciones/${inspeccionId}/evidencias?error=Expediente%20no%20encontrado`,
    );
  }

  if (hallazgoId) {
    const hallazgo = await prisma.hallazgo.findFirst({
      where: {
        id: hallazgoId,
        inspeccionId,
      },
      select: {
        id: true,
      },
    });

    if (!hallazgo) {
      redirect(
        `/panel/inspecciones/${inspeccionId}/evidencias?error=Hallazgo%20no%20valido`,
      );
    }
  }

  const extension =
    archivo.name.split(".").pop()?.toLowerCase() ||
    archivo.type.split("/").pop() ||
    "jpg";

  const rutaStorage =
    `${inspeccionId}/${randomUUID()}.${extension}`;

  const buffer = Buffer.from(await archivo.arrayBuffer());

  const supabase = obtenerSupabase();
  const bucket =
    process.env.SUPABASE_STORAGE_BUCKET || "evidencias";

  const { error: errorSubida } = await supabase.storage
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
      `/panel/inspecciones/${inspeccionId}/evidencias?error=No%20se%20pudo%20subir%20la%20fotografia`,
    );
  }

  try {
   const fotografia = await prisma.fotografia.create({
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
      : "Se agregó una evidencia fotográfica.",
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
    `/panel/inspecciones/${inspeccionId}/evidencias?error=No%20se%20pudo%20registrar%20la%20evidencia`,
  );
}

  revalidatePath(
    `/panel/inspecciones/${inspeccionId}`,
  );

  revalidatePath(
    `/panel/inspecciones/${inspeccionId}/evidencias`,
  );

  redirect(
    `/panel/inspecciones/${inspeccionId}/evidencias?ok=Evidencia%20guardada`,
  );
}