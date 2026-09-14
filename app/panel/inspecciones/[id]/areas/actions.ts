"use server";

import { randomUUID } from "node:crypto";
import { EstadoInspeccion, RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? "").trim();

function volver(id: string, tipo: "ok" | "error", mensaje: string): never {
  redirect(`/panel/inspecciones/${id}/areas?${tipo}=${encodeURIComponent(mensaje)}`);
}

function slug(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan credenciales de Supabase en el servidor.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function exigirInspectorV1(inspeccionId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, rol: true, activo: true, inspector: { select: { id: true, activo: true } } },
  });
  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: { id: true, folio: true, numeroInspeccion: true, estado: true, inspectorId: true },
  });

  if (!usuario?.activo || usuario.rol !== RolUsuario.INSPECTOR || !usuario.inspector?.activo) redirect("/acceso");
  if (!inspeccion || inspeccion.inspectorId !== usuario.inspector.id) redirect("/acceso");
  if (inspeccion.numeroInspeccion !== 1) volver(inspeccionId, "error", "La cobertura integral por áreas corresponde a V1.");
  if (inspeccion.estado !== EstadoInspeccion.EN_PROCESO) volver(inspeccionId, "error", "Las áreas solo pueden documentarse mientras la inspección está EN PROCESO.");

  return { session, usuario, inspeccion };
}

export async function confirmarProyectoV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const modalidad = texto(formData, "modalidad");
  if (!inspeccionId) redirect("/panel/inspecciones");
  const { usuario } = await exigirInspectorV1(inspeccionId);

  if (modalidad === "CON_PDF") {
    const [r] = await prisma.$queryRaw<Array<{ total: number }>>`
      SELECT COUNT(*)::int AS "total" FROM "DocumentoProyectoInspeccion" WHERE "inspeccionId"=${inspeccionId}
    `;
    if (Number(r?.total ?? 0) === 0) volver(inspeccionId, "error", "No hay PDF de proyecto cargado. Cárgalo en Guía técnica o declara formalmente que no existe proyecto disponible.");
  }
  if (!['CON_PDF','SIN_PDF'].includes(modalidad)) volver(inspeccionId, "error", "Selecciona una modalidad de proyecto válida.");

  await prisma.$executeRaw`
    INSERT INTO "InspeccionControlV2" ("inspeccionId","categoria","versionProtocolo","proyectoConfirmado")
    VALUES (${inspeccionId},'VIVIENDA',2,true)
    ON CONFLICT ("inspeccionId") DO UPDATE SET "proyectoConfirmado"=true,"actualizadoEn"=NOW()
  `;

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "InspeccionControlV2",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: modalidad === "CON_PDF" ? "Inspector confirmó proyecto PDF disponible para V1." : "Inspector declaró formalmente V1 SIN PROYECTO PDF disponible.",
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
  volver(inspeccionId, "ok", modalidad === "CON_PDF" ? "Proyecto PDF confirmado." : "Quedó documentado que la inspección se realizará sin proyecto PDF disponible.");
}

export async function generarAreasDesdeGuia(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  if (!inspeccionId) redirect("/panel/inspecciones");
  const { usuario } = await exigirInspectorV1(inspeccionId);

  const items = await prisma.$queryRaw<Array<{ area: string }>>`
    SELECT DISTINCT btrim("area") AS "area"
    FROM "GuiaInspeccionItem"
    WHERE "inspeccionId"=${inspeccionId} AND nullif(btrim("area"),'') IS NOT NULL
    ORDER BY 1
  `;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "InspeccionControlV2" ("inspeccionId","categoria","versionProtocolo")
      VALUES (${inspeccionId},'VIVIENDA',2)
      ON CONFLICT ("inspeccionId") DO NOTHING
    `;
    await tx.$executeRaw`
      INSERT INTO "AreaInspeccion" ("inspeccionId","codigo","nombre","tipo","orden","origen","obligatoria")
      VALUES (${inspeccionId},'FACHADA_PRINCIPAL','Fachada principal','EXTERIOR',0,'METODO_CERTEZA',true)
      ON CONFLICT ("inspeccionId","codigo") DO NOTHING
    `;
    let orden = 10;
    for (const item of items) {
      const nombre = item.area.trim();
      if (!nombre) continue;
      const codigoBase = slug(nombre) || `AREA_${orden}`;
      const codigo = codigoBase === 'FACHADA_PRINCIPAL' ? `AREA_${codigoBase}` : codigoBase;
      await tx.$executeRaw`
        INSERT INTO "AreaInspeccion" ("inspeccionId","codigo","nombre","tipo","orden","origen","obligatoria")
        VALUES (${inspeccionId},${codigo},${nombre},'INTERIOR',${orden},'GUIA_TECNICA',true)
        ON CONFLICT ("inspeccionId","codigo") DO NOTHING
      `;
      orden += 10;
    }
  });

  await registrarAuditoria({
    tipo: TipoEvento.CREAR,
    entidad: "AreaInspeccion",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `Inspector generó ecosistema V1 desde la guía técnica: fachada + ${items.length} área(s) fuente.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
  volver(inspeccionId, "ok", "Áreas generadas desde la guía técnica. Revísalas y agrega manualmente cualquier área física faltante antes de confirmar.");
}

export async function agregarAreaManual(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const nombre = texto(formData, "nombre");
  const tipo = texto(formData, "tipo") || "INTERIOR";
  if (!inspeccionId || !nombre) redirect("/panel/inspecciones");
  const { usuario } = await exigirInspectorV1(inspeccionId);

  const codigo = `${slug(nombre) || 'AREA'}_${randomUUID().slice(0, 6).toUpperCase()}`;
  const [r] = await prisma.$queryRaw<Array<{ siguiente: number }>>`
    SELECT COALESCE(MAX("orden"),0)::int + 10 AS "siguiente" FROM "AreaInspeccion" WHERE "inspeccionId"=${inspeccionId}
  `;
  await prisma.$executeRaw`
    INSERT INTO "AreaInspeccion" ("inspeccionId","codigo","nombre","tipo","orden","origen","obligatoria")
    VALUES (${inspeccionId},${codigo},${nombre},${tipo},${Number(r?.siguiente ?? 10)},'MANUAL',true)
  `;

  await registrarAuditoria({ tipo: TipoEvento.CREAR, entidad: "AreaInspeccion", inspeccionId, usuarioId: usuario.id, descripcion: `Inspector agregó manualmente el área obligatoria “${nombre}”.` });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
  volver(inspeccionId, "ok", `Área “${nombre}” agregada.`);
}

export async function confirmarAreasV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  if (!inspeccionId) redirect("/panel/inspecciones");
  const { usuario } = await exigirInspectorV1(inspeccionId);

  const [r] = await prisma.$queryRaw<Array<{ total: number; fachada: number }>>`
    SELECT COUNT(*) FILTER (WHERE "obligatoria")::int AS "total",
           COUNT(*) FILTER (WHERE "codigo"='FACHADA_PRINCIPAL')::int AS "fachada"
    FROM "AreaInspeccion" WHERE "inspeccionId"=${inspeccionId}
  `;
  if (Number(r?.total ?? 0) === 0 || Number(r?.fachada ?? 0) === 0) volver(inspeccionId, "error", "Antes de confirmar deben existir la fachada principal y todas las áreas físicas obligatorias.");

  await prisma.$executeRaw`
    UPDATE "InspeccionControlV2" SET "areasConfirmadas"=true,"actualizadoEn"=NOW() WHERE "inspeccionId"=${inspeccionId}
  `;
  await registrarAuditoria({ tipo: TipoEvento.EDITAR, entidad: "InspeccionControlV2", inspeccionId, usuarioId: usuario.id, descripcion: `Inspector confirmó el ecosistema de ${Number(r.total)} área(s) obligatoria(s) de V1.` });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
  volver(inspeccionId, "ok", "Ecosistema de áreas confirmado. A partir de ahora documenta todas las áreas antes del cierre.");
}

export async function subirFotoArea(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const areaId = texto(formData, "areaId");
  const descripcion = texto(formData, "descripcion");
  const archivo = formData.get("archivo");
  if (!inspeccionId || !areaId) redirect("/panel/inspecciones");
  const { session, usuario } = await exigirInspectorV1(inspeccionId);

  const [area] = await prisma.$queryRaw<Array<{ id: string; codigo: string; nombre: string }>>`
    SELECT "id","codigo","nombre" FROM "AreaInspeccion" WHERE "id"=${areaId}::uuid AND "inspeccionId"=${inspeccionId}
  `;
  if (!area) volver(inspeccionId, "error", "El área no pertenece a esta inspección.");
  if (!(archivo instanceof File) || archivo.size === 0) volver(inspeccionId, "error", "Selecciona una fotografía.");
  if (!['image/jpeg','image/png','image/webp'].includes(archivo.type)) volver(inspeccionId, "error", "La evidencia debe ser JPG, PNG o WEBP.");
  if (archivo.size > 10 * 1024 * 1024) volver(inspeccionId, "error", "La imagen supera 10 MB.");

  const extension = archivo.name.split('.').pop()?.toLowerCase() || archivo.type.split('/').pop() || 'jpg';
  const ruta = `${inspeccionId}/areas/${areaId}/${randomUUID()}.${extension}`;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'evidencias';
  const sb = supabaseAdmin();
  const { error } = await sb.storage.from(bucket).upload(ruta, Buffer.from(await archivo.arrayBuffer()), { contentType: archivo.type, upsert: false });
  if (error) volver(inspeccionId, "error", "No se pudo subir la fotografía del área.");

  try {
    await prisma.$transaction(async (tx) => {
      const foto = await tx.fotografia.create({
        data: { inspeccionId, hallazgoId: null, url: ruta, subidaPorId: session.user.id, descripcion: descripcion || `${area.nombre} · evidencia de recorrido` },
      });
      const [portada] = area.codigo === 'FACHADA_PRINCIPAL'
        ? await tx.$queryRaw<Array<{ existe: boolean }>>`SELECT EXISTS(SELECT 1 FROM "FotografiaArea" fa JOIN "AreaInspeccion" a ON a."id"=fa."areaId" WHERE a."inspeccionId"=${inspeccionId} AND fa."candidataPortada"=true) AS "existe"`
        : [{ existe: true }];
      await tx.$executeRaw`
        INSERT INTO "FotografiaArea" ("fotografiaId","areaId","tipoEvidencia","orden","candidataReporte","candidataPortada")
        VALUES (${foto.id},${areaId}::uuid,${area.codigo === 'FACHADA_PRINCIPAL' ? 'IDENTIFICACION' : 'RECORRIDO'},0,true,${area.codigo === 'FACHADA_PRINCIPAL' && !portada?.existe})
      `;
    });
  } catch (e) {
    await sb.storage.from(bucket).remove([ruta]);
    throw e;
  }

  await registrarAuditoria({ tipo: TipoEvento.SUBIR_EVIDENCIA, entidad: "FotografiaArea", inspeccionId, usuarioId: usuario.id, descripcion: `Inspector agregó evidencia del área “${area.nombre}”${area.codigo === 'FACHADA_PRINCIPAL' ? ' (fachada/identificación)' : ''}.` });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/flujo`);
  volver(inspeccionId, "ok", `Fotografía agregada a ${area.nombre}.`);
}

export async function cerrarAreaV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const areaId = texto(formData, "areaId");
  const comentario = texto(formData, "comentarioFinal");
  if (!inspeccionId || !areaId) redirect("/panel/inspecciones");
  const { usuario } = await exigirInspectorV1(inspeccionId);
  if (comentario.length < 5) volver(inspeccionId, "error", "Registra un comentario final del área, incluso cuando todo esté aparentemente en orden.");

  const [r] = await prisma.$queryRaw<Array<{ nombre: string; fotos: number }>>`
    SELECT a."nombre", COUNT(fa."id")::int AS "fotos"
    FROM "AreaInspeccion" a LEFT JOIN "FotografiaArea" fa ON fa."areaId"=a."id"
    WHERE a."id"=${areaId}::uuid AND a."inspeccionId"=${inspeccionId}
    GROUP BY a."id",a."nombre"
  `;
  if (!r) volver(inspeccionId, "error", "Área no encontrada.");
  if (Number(r.fotos) < 4) volver(inspeccionId, "error", `${r.nombre} tiene ${r.fotos}/4 fotografías. Completa la evidencia antes de cerrar el área.`);

  await prisma.$executeRaw`
    UPDATE "AreaInspeccion" SET "estado"='REVISADA',"comentarioFinal"=${comentario},"revisadaEn"=NOW(),"actualizadoEn"=NOW()
    WHERE "id"=${areaId}::uuid AND "inspeccionId"=${inspeccionId}
  `;
  await registrarAuditoria({ tipo: TipoEvento.EDITAR, entidad: "AreaInspeccion", entidadId: areaId, inspeccionId, usuarioId: usuario.id, descripcion: `Inspector cerró el área “${r.nombre}” con ${r.fotos} fotografías. Comentario final: ${comentario}` });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/flujo`);
  volver(inspeccionId, "ok", `${r.nombre} quedó revisada y documentada.`);
}
