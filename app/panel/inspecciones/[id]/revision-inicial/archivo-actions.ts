"use server";

import { randomUUID } from "node:crypto";
import { EstadoInspeccion, RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

function texto(fd: FormData, campo: string) {
  return String(fd.get(campo) ?? "").trim();
}

function volver(id: string, tipo: "ok" | "error", mensaje: string): never {
  redirect(`/panel/inspecciones/${id}/revision-inicial?${tipo}=${encodeURIComponent(mensaje)}`);
}

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan credenciales de almacenamiento.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function subirFotoExistenteComoFachada(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const archivo = formData.get("archivo");
  if (!inspeccionId) redirect("/panel/inspecciones");

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [usuario, inspeccion] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: { id: true, rol: true, activo: true, inspector: { select: { id: true, activo: true } } },
    }),
    prisma.inspeccion.findUnique({
      where: { id: inspeccionId },
      select: {
        id: true,
        folio: true,
        estado: true,
        inspectorId: true,
        inspector: { select: { usuarioId: true } },
      },
    }),
  ]);

  if (!usuario?.activo || !inspeccion) redirect("/acceso");
  if (inspeccion.estado !== EstadoInspeccion.PROGRAMADA) {
    volver(inspeccionId, "error", "La fachada solo puede definirse antes de iniciar la inspección.");
  }

  const inspectorAsignado =
    usuario.rol === RolUsuario.INSPECTOR &&
    Boolean(usuario.inspector?.activo) &&
    inspeccion.inspectorId === usuario.inspector?.id &&
    inspeccion.inspector?.usuarioId === usuario.id;
  const directorPorAusencia = usuario.rol === RolUsuario.DIRECTOR && !inspeccion.inspectorId;
  if (!inspectorAsignado && !directorPorAusencia) redirect("/acceso");

  if (!(archivo instanceof File) || archivo.size === 0) {
    volver(inspeccionId, "error", "Selecciona una fotografía existente.");
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) {
    volver(inspeccionId, "error", "La fotografía debe ser JPG, PNG o WEBP.");
  }
  if (archivo.size > 10 * 1024 * 1024) {
    volver(inspeccionId, "error", "La fotografía supera 10 MB.");
  }

  const existentes = await prisma.$queryRaw<Array<{ fotografiaId: string }>>`
    SELECT fa."fotografiaId"
    FROM "FotografiaArea" fa
    JOIN "AreaInspeccion" a ON a."id" = fa."areaId"
    WHERE a."inspeccionId" = ${inspeccionId} AND a."codigo" = 'FACHADA_PRINCIPAL'
  `;
  if (existentes.length > 0) {
    volver(inspeccionId, "error", "Ya existen fotografías de fachada. Si comenzaste la toma en sitio, completa las 4 y elige la mejor.");
  }

  const [area] = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "AreaInspeccion" ("inspeccionId","codigo","nombre","tipo","orden","origen","obligatoria")
    VALUES (${inspeccionId},'FACHADA_PRINCIPAL','Fachada principal','EXTERIOR',0,'ARCHIVO_EXISTENTE',true)
    ON CONFLICT ("inspeccionId","codigo") DO UPDATE SET "nombre"=EXCLUDED."nombre", "origen"=EXCLUDED."origen"
    RETURNING "id"::text
  `;
  if (!area?.id) volver(inspeccionId, "error", "No fue posible preparar la evidencia de fachada.");

  const extension = archivo.name.split(".").pop()?.toLowerCase() || archivo.type.split("/").pop() || "jpg";
  const ruta = `${inspeccionId}/areas/${area.id}/${randomUUID()}.${extension}`;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";
  const sb = supabaseAdmin();
  const { error } = await sb.storage.from(bucket).upload(ruta, Buffer.from(await archivo.arrayBuffer()), {
    contentType: archivo.type,
    upsert: false,
  });
  if (error) volver(inspeccionId, "error", "No se pudo guardar la fotografía existente.");

  try {
    await prisma.$transaction(async (tx) => {
      const foto = await tx.fotografia.create({
        data: {
          inspeccionId,
          hallazgoId: null,
          url: ruta,
          subidaPorId: usuario.id,
          descripcion: "Fachada principal definitiva · seleccionada desde galería/archivos",
        },
      });
      await tx.$executeRaw`
        INSERT INTO "FotografiaArea" ("fotografiaId","areaId","tipoEvidencia","orden","candidataReporte","candidataPortada")
        VALUES (${foto.id},${area.id}::uuid,'IDENTIFICACION',1,true,true)
      `;
    });
  } catch (errorDb) {
    await sb.storage.from(bucket).remove([ruta]);
    throw errorDb;
  }

  await registrarAuditoria({
    tipo: TipoEvento.SUBIR_EVIDENCIA,
    entidad: "Fotografia",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${usuario.rol} seleccionó una fotografía existente desde galería/archivos como fachada definitiva de ${inspeccion.folio}; no se requirieron cuatro tomas en sitio.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/revision-inicial`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
  volver(inspeccionId, "ok", "Fotografía existente establecida como fachada definitiva.");
}
