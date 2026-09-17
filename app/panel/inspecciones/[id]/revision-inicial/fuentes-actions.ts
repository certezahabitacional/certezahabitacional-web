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

export async function importarFotoFachadaDesdeBase(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const fotografiaOrigenId = texto(formData, "fotografiaOrigenId");
  if (!inspeccionId || !fotografiaOrigenId) redirect("/panel/inspecciones");

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
        inmuebleId: true,
        inspectorId: true,
        inspector: { select: { usuarioId: true } },
      },
    }),
  ]);

  if (!usuario?.activo || !inspeccion) redirect("/acceso");
  if (inspeccion.estado !== EstadoInspeccion.PROGRAMADA) {
    volver(inspeccionId, "error", "La fachada solo puede completarse antes de iniciar la inspección.");
  }

  const inspectorAsignado =
    usuario.rol === RolUsuario.INSPECTOR &&
    Boolean(usuario.inspector?.activo) &&
    inspeccion.inspectorId === usuario.inspector?.id &&
    inspeccion.inspector?.usuarioId === usuario.id;
  const directorPorAusencia = usuario.rol === RolUsuario.DIRECTOR && !inspeccion.inspectorId;
  if (!inspectorAsignado && !directorPorAusencia) redirect("/acceso");
  if (!inspeccion.inmuebleId) volver(inspeccionId, "error", "La inspección no tiene un inmueble vinculado para consultar evidencias históricas.");

  const [conteo] = await prisma.$queryRaw<Array<{ total: number; portada: number }>>`
    SELECT COUNT(*)::int AS "total", COUNT(*) FILTER (WHERE fa."candidataPortada"=true)::int AS "portada"
    FROM "FotografiaArea" fa
    JOIN "AreaInspeccion" a ON a."id" = fa."areaId"
    WHERE a."inspeccionId" = ${inspeccionId} AND a."codigo" = 'FACHADA_PRINCIPAL'
  `;
  if (Number(conteo?.portada ?? 0) === 1) volver(inspeccionId, "error", "La fotografía definitiva de fachada ya fue seleccionada.");
  if (Number(conteo?.total ?? 0) >= 4) volver(inspeccionId, "error", "Ya están registradas las 4 fotografías de fachada. Selecciona la mejor.");

  const [origen] = await prisma.$queryRaw<Array<{ ruta: string; folio: string; inmuebleId: string | null }>>`
    SELECT f."url" AS "ruta", i."folio", i."inmuebleId"
    FROM "Fotografia" f
    JOIN "Inspeccion" i ON i."id" = f."inspeccionId"
    JOIN "FotografiaArea" fa ON fa."fotografiaId" = f."id"
    JOIN "AreaInspeccion" a ON a."id" = fa."areaId"
    WHERE f."id" = ${fotografiaOrigenId}
      AND i."id" <> ${inspeccionId}
      AND a."codigo" = 'FACHADA_PRINCIPAL'
    LIMIT 1
  `;
  if (!origen || origen.inmuebleId !== inspeccion.inmuebleId) {
    volver(inspeccionId, "error", "La fotografía seleccionada no pertenece al historial de este inmueble.");
  }

  const [area] = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "AreaInspeccion" ("inspeccionId","codigo","nombre","tipo","orden","origen","obligatoria")
    VALUES (${inspeccionId},'FACHADA_PRINCIPAL','Fachada principal','EXTERIOR',0,'REVISION_CLIENTE',true)
    ON CONFLICT ("inspeccionId","codigo") DO UPDATE SET "nombre" = EXCLUDED."nombre"
    RETURNING "id"::text
  `;
  if (!area?.id) volver(inspeccionId, "error", "No fue posible preparar la evidencia de fachada.");

  const extension = origen.ruta.split(".").pop()?.toLowerCase() || "jpg";
  const rutaNueva = `${inspeccionId}/areas/${area.id}/${randomUUID()}.${extension}`;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";
  const sb = supabaseAdmin();
  const { data: archivoOrigen, error: errorDescarga } = await sb.storage.from(bucket).download(origen.ruta);
  if (errorDescarga || !archivoOrigen) volver(inspeccionId, "error", "No fue posible recuperar la fotografía histórica.");

  const contenido = Buffer.from(await archivoOrigen.arrayBuffer());
  const { error: errorSubida } = await sb.storage.from(bucket).upload(rutaNueva, contenido, {
    contentType: archivoOrigen.type || "image/jpeg",
    upsert: false,
  });
  if (errorSubida) volver(inspeccionId, "error", "No fue posible copiar la fotografía al expediente actual.");

  try {
    await prisma.$transaction(async (tx) => {
      const foto = await tx.fotografia.create({
        data: {
          inspeccionId,
          hallazgoId: null,
          url: rutaNueva,
          subidaPorId: usuario.id,
          descripcion: `Fachada principal · reutilizada de ${origen.folio} durante revisión final`,
        },
      });
      const [orden] = await tx.$queryRaw<Array<{ siguiente: number }>>`
        SELECT COALESCE(MAX("orden"),0)::int + 1 AS "siguiente"
        FROM "FotografiaArea"
        WHERE "areaId" = ${area.id}::uuid
      `;
      await tx.$executeRaw`
        INSERT INTO "FotografiaArea" ("fotografiaId","areaId","tipoEvidencia","orden","candidataReporte","candidataPortada")
        VALUES (${foto.id},${area.id}::uuid,'IDENTIFICACION',${Number(orden?.siguiente ?? 1)},true,false)
      `;
    });
  } catch (errorDb) {
    await sb.storage.from(bucket).remove([rutaNueva]);
    throw errorDb;
  }

  await registrarAuditoria({
    tipo: TipoEvento.SUBIR_EVIDENCIA,
    entidad: "Fotografia",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${usuario.rol} reutilizó una fotografía histórica de fachada proveniente de ${origen.folio}; se creó una copia independiente en ${inspeccion.folio}.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/revision-inicial`);
  volver(inspeccionId, "ok", `Fotografía histórica de ${origen.folio} agregada como candidata de fachada.`);
}
