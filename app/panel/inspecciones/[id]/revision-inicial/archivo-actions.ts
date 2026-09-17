"use server";

import { randomUUID } from "node:crypto";
import { EstadoInspeccion, RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";
import { eliminarArchivoStorage, subirArchivoStorage } from "@/lib/storage-gateway";

function texto(fd: FormData, campo: string) {
  return String(fd.get(campo) ?? "").trim();
}

function volver(id: string, tipo: "ok" | "error", mensaje: string): never {
  redirect(`/panel/inspecciones/${id}/revision-inicial?${tipo}=${encodeURIComponent(mensaje)}`);
}

async function contextoTecnico(inspeccionId: string) {
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
    volver(inspeccionId, "error", "La fotografía de fachada solo puede modificarse antes de iniciar la inspección.");
  }

  const inspectorAsignado =
    usuario.rol === RolUsuario.INSPECTOR &&
    Boolean(usuario.inspector?.activo) &&
    inspeccion.inspectorId === usuario.inspector?.id &&
    inspeccion.inspector?.usuarioId === usuario.id;
  const director = usuario.rol === RolUsuario.DIRECTOR;
  if (!inspectorAsignado && !director) redirect("/acceso");

  return { session, usuario, inspeccion };
}

export async function subirFotoExistenteComoFachada(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const archivo = formData.get("archivo");
  if (!inspeccionId) redirect("/panel/inspecciones");

  const { usuario, inspeccion } = await contextoTecnico(inspeccionId);

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
    volver(inspeccionId, "error", "Ya existe evidencia de fachada. Si comenzaste la toma en sitio, completa las 4 y elige la mejor; si cargaste una foto de galería, elimínala primero para cambiarla.");
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
  try {
    await subirArchivoStorage({ usuarioId: usuario.id, inspeccionId, ruta, archivo });
  } catch (error) {
    console.error("Error de Storage al cargar fachada desde galería:", error instanceof Error ? error.message : error);
    volver(inspeccionId, "error", "No se pudo guardar la fotografía seleccionada. Intenta nuevamente.");
  }

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
    await eliminarArchivoStorage({ usuarioId: usuario.id, inspeccionId, ruta }).catch(() => undefined);
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
  volver(inspeccionId, "ok", "Fotografía de galería establecida como fachada definitiva. Puedes quitarla y cargar otra mientras la inspección siga PROGRAMADA.");
}

export async function eliminarFotoGaleriaFachada(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const fotografiaId = texto(formData, "fotografiaId");
  if (!inspeccionId || !fotografiaId) redirect("/panel/inspecciones");

  const { usuario, inspeccion } = await contextoTecnico(inspeccionId);

  const [foto] = await prisma.$queryRaw<Array<{ fotografiaId: string; ruta: string; areaId: string; origen: string | null }>>`
    SELECT fa."fotografiaId", f."url" AS "ruta", a."id"::text AS "areaId", a."origen"::text AS "origen"
    FROM "FotografiaArea" fa
    JOIN "AreaInspeccion" a ON a."id" = fa."areaId"
    JOIN "Fotografia" f ON f."id" = fa."fotografiaId"
    WHERE a."inspeccionId" = ${inspeccionId}
      AND a."codigo" = 'FACHADA_PRINCIPAL'
      AND fa."fotografiaId" = ${fotografiaId}
      AND fa."candidataPortada" = true
    LIMIT 1
  `;

  if (!foto) volver(inspeccionId, "error", "No se encontró la fotografía definitiva que intentas quitar.");
  if (foto.origen !== "ARCHIVO_EXISTENTE") {
    volver(inspeccionId, "error", "Esta opción sólo elimina la fotografía definitiva cargada desde galería/archivos.");
  }

  try {
    await eliminarArchivoStorage({ usuarioId: usuario.id, inspeccionId, ruta: foto.ruta });
  } catch (error) {
    console.error("Error de Storage al quitar fachada de galería:", error instanceof Error ? error.message : error);
    volver(inspeccionId, "error", "No fue posible quitar la fotografía del almacenamiento. Intenta nuevamente.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`DELETE FROM "FotografiaArea" WHERE "fotografiaId" = ${foto.fotografiaId}`;
      await tx.fotografia.delete({ where: { id: foto.fotografiaId } });
    });
  } catch (errorDb) {
    console.error("La fotografía se borró de Storage pero falló el registro de base de datos:", errorDb);
    volver(inspeccionId, "error", "La fotografía se quitó del almacenamiento, pero no fue posible actualizar el expediente. Revisa la bitácora antes de continuar.");
  }

  await registrarAuditoria({
    tipo: TipoEvento.ELIMINAR_EVIDENCIA,
    entidad: "Fotografia",
    entidadId: foto.fotografiaId,
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${usuario.rol} quitó la fotografía de fachada cargada desde galería/archivos de ${inspeccion.folio} para permitir sustituirla antes del inicio físico.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/revision-inicial`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
  volver(inspeccionId, "ok", "Fotografía de galería eliminada. Ya puedes seleccionar otra o cambiar de ruta de evidencia.");
}
