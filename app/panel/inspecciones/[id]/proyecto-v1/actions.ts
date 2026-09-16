"use server";

import { randomUUID } from "node:crypto";
import { EstadoInspeccion, RolUsuario, TipoEvento } from "@prisma/client";
import { PDFDocument } from "pdf-lib";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

const TIPOS_PROYECTO = new Set([
  "ARQUITECTONICO",
  "FACHADAS",
  "HIDRAULICA",
  "SANITARIA",
  "GAS",
  "ELECTRICA",
  "PUERTAS_VENTANAS",
  "ACABADOS",
  "AIRE_ACONDICIONADO",
  "VOZ_DATOS",
  "OTROS",
]);

const LIMITE_LOTE = 11 * 1024 * 1024;
const LIMITE_ARCHIVO = 10 * 1024 * 1024;

const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? "").trim();

function volver(id: string, tipo: "ok" | "error", mensaje: string): never {
  redirect(`/panel/inspecciones/${id}/proyecto-v1?${tipo}=${encodeURIComponent(mensaje)}`);
}

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan credenciales de Supabase en el servidor.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function exigirInspectorEditable(inspeccionId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, rol: true, activo: true, inspector: { select: { id: true, activo: true } } },
  });
  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: { id: true, numeroInspeccion: true, estado: true, inspectorId: true, folio: true },
  });
  if (!usuario?.activo || usuario.rol !== RolUsuario.INSPECTOR || !usuario.inspector?.activo) redirect("/acceso");
  if (!inspeccion || inspeccion.inspectorId !== usuario.inspector.id) redirect("/acceso");
  if (inspeccion.numeroInspeccion !== 1) volver(inspeccionId, "error", "Los documentos de proyecto de esta pantalla corresponden únicamente a V1.");
  if (inspeccion.estado !== EstadoInspeccion.EN_PROCESO) volver(inspeccionId, "error", "Los documentos solo pueden modificarse mientras V1 está EN PROCESO.");

  const [control] = await prisma.$queryRaw<Array<{ proyectoConfirmado: boolean }>>`
    SELECT "proyectoConfirmado" FROM "InspeccionControlV2" WHERE "inspeccionId"=${inspeccionId} LIMIT 1
  `;
  if (control?.proyectoConfirmado) volver(inspeccionId, "error", "El proyecto ya fue confirmado. Los documentos quedaron bloqueados para conservar la trazabilidad del expediente.");

  return { session, usuario, inspeccion };
}

export async function subirProyectosV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const tipo = texto(formData, "tipo");
  if (!inspeccionId) redirect("/panel/inspecciones");
  if (!TIPOS_PROYECTO.has(tipo)) volver(inspeccionId, "error", "Selecciona un tipo de proyecto válido.");

  const { usuario, inspeccion } = await exigirInspectorEditable(inspeccionId);
  const archivos = formData
    .getAll("archivos")
    .filter((valor): valor is File => valor instanceof File && valor.size > 0);

  if (archivos.length === 0) volver(inspeccionId, "error", "Selecciona al menos un archivo PDF.");
  const totalBytes = archivos.reduce((suma, archivo) => suma + archivo.size, 0);
  if (totalBytes > LIMITE_LOTE) volver(inspeccionId, "error", "El lote supera 11 MB. Divide los planos en dos o más cargas.");

  for (const archivo of archivos) {
    const pdfValido = archivo.type === "application/pdf" || archivo.name.toLowerCase().endsWith(".pdf");
    if (!pdfValido) volver(inspeccionId, "error", `“${archivo.name}” no es un archivo PDF.`);
    if (archivo.size > LIMITE_ARCHIVO) volver(inspeccionId, "error", `“${archivo.name}” supera el límite de 10 MB por archivo.`);
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";
  const sb = supabaseAdmin();
  const creados: Array<{ id: string; ruta: string }> = [];

  try {
    for (const archivo of archivos) {
      const bytes = Buffer.from(await archivo.arrayBuffer());
      let paginas = 0;
      try {
        const pdf = await PDFDocument.load(bytes);
        paginas = pdf.getPageCount();
      } catch {
        throw new Error(`No fue posible leer “${archivo.name}”. Verifica que sea un PDF válido y no esté protegido.`);
      }

      const id = randomUUID();
      const ruta = `${inspeccionId}/proyecto-v1/${id}.pdf`;
      const { error } = await sb.storage.from(bucket).upload(ruta, bytes, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (error) throw new Error(`No fue posible almacenar “${archivo.name}”.`);

      await prisma.$executeRaw`
        INSERT INTO "DocumentoProyectoInspeccion"
          ("id","inspeccionId","tipo","nombreOriginal","bucket","ruta","mimeType","bytes","subidoPorId","estadoAnalisis","numeroPaginas","creadoEn")
        VALUES
          (${id},${inspeccionId},${tipo},${archivo.name},${bucket},${ruta},'application/pdf',${archivo.size},${usuario.id},'PENDIENTE',${paginas},NOW())
      `;
      creados.push({ id, ruta });
    }
  } catch (error) {
    if (creados.length > 0) {
      await sb.storage.from(bucket).remove(creados.map((item) => item.ruta));
      await prisma.$executeRaw`
        DELETE FROM "DocumentoProyectoInspeccion"
        WHERE "id" = ANY(${creados.map((item) => item.id)}::text[])
      `;
    }
    const mensaje = error instanceof Error ? error.message : "No fue posible cargar los documentos de proyecto.";
    volver(inspeccionId, "error", mensaje);
  }

  await registrarAuditoria({
    tipo: TipoEvento.SUBIR_EVIDENCIA,
    entidad: "DocumentoProyectoInspeccion",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `Inspector cargó ${archivos.length} PDF(s) de proyecto (${tipo}) en ${inspeccion.folio}. Quedaron pendientes de análisis automático.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/proyecto-v1`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
  volver(inspeccionId, "ok", `${archivos.length} PDF(s) cargados correctamente. Quedaron pendientes de análisis automático.`);
}

export async function eliminarProyectoV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const documentoId = texto(formData, "documentoId");
  if (!inspeccionId || !documentoId) redirect("/panel/inspecciones");
  const { usuario } = await exigirInspectorEditable(inspeccionId);

  const [documento] = await prisma.$queryRaw<Array<{ id: string; bucket: string; ruta: string; nombreOriginal: string }>>`
    SELECT "id","bucket","ruta","nombreOriginal"
    FROM "DocumentoProyectoInspeccion"
    WHERE "id"=${documentoId} AND "inspeccionId"=${inspeccionId}
    LIMIT 1
  `;
  if (!documento) volver(inspeccionId, "error", "El documento no existe o no pertenece a esta inspección.");

  const sb = supabaseAdmin();
  const { error } = await sb.storage.from(documento.bucket).remove([documento.ruta]);
  if (error) volver(inspeccionId, "error", "No fue posible eliminar el archivo del almacenamiento. No se modificó el expediente.");

  await prisma.$executeRaw`
    DELETE FROM "DocumentoProyectoInspeccion"
    WHERE "id"=${documentoId} AND "inspeccionId"=${inspeccionId}
  `;

  await registrarAuditoria({
    tipo: TipoEvento.ELIMINAR,
    entidad: "DocumentoProyectoInspeccion",
    entidadId: documentoId,
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `Inspector eliminó el PDF de proyecto “${documento.nombreOriginal}” antes de confirmar el proyecto V1.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/proyecto-v1`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
  volver(inspeccionId, "ok", `Documento “${documento.nombreOriginal}” eliminado.`);
}
