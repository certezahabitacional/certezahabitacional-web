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
import { validarResultadoDocumentoProyectoV1 } from "@/lib/proyecto-v1-analisis";

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

function esquemaOpenAIProyectoV1() {
  const dimension = {
    type: "object",
    additionalProperties: false,
    required: ["nombre", "valor", "unidad", "referencia"],
    properties: {
      nombre: { type: "string" },
      valor: { type: "string" },
      unidad: { type: ["string", "null"] },
      referencia: { type: ["string", "null"] },
    },
  };
  const elemento = {
    type: "object",
    additionalProperties: false,
    required: ["nombre", "tipo", "ubicacion", "especificacion", "cantidad", "unidad", "referencia"],
    properties: {
      nombre: { type: "string" },
      tipo: { type: ["string", "null"] },
      ubicacion: { type: ["string", "null"] },
      especificacion: { type: ["string", "null"] },
      cantidad: { type: ["number", "null"] },
      unidad: { type: ["string", "null"] },
      referencia: { type: ["string", "null"] },
    },
  };
  const area = {
    type: "object",
    additionalProperties: false,
    required: ["nombre", "nivel", "ubicacion", "dimensiones", "especificaciones", "elementos", "referencias"],
    properties: {
      nombre: { type: "string" },
      nivel: { type: ["string", "null"] },
      ubicacion: { type: ["string", "null"] },
      dimensiones: { type: "array", items: dimension },
      especificaciones: { type: "array", items: { type: "string" } },
      elementos: { type: "array", items: elemento },
      referencias: { type: "array", items: { type: "string" } },
    },
  };
  return {
    type: "object",
    additionalProperties: false,
    required: ["version", "resumen", "tipoProyectoDetectado", "areas", "especificacionesGenerales", "elementosSinArea", "advertencias", "referencias"],
    properties: {
      version: { type: "integer", enum: [1] },
      resumen: { type: "string" },
      tipoProyectoDetectado: { type: ["string", "null"] },
      areas: { type: "array", items: area },
      especificacionesGenerales: { type: "array", items: { type: "string" } },
      elementosSinArea: { type: "array", items: elemento },
      advertencias: { type: "array", items: { type: "string" } },
      referencias: { type: "array", items: { type: "string" } },
    },
  };
}

function extraerTextoRespuestaOpenAI(respuesta: unknown) {
  if (!respuesta || typeof respuesta !== "object") return "";
  const salida = (respuesta as { output?: unknown[] }).output;
  if (!Array.isArray(salida)) return "";
  for (const item of salida) {
    if (!item || typeof item !== "object") continue;
    const contenidos = (item as { content?: unknown[] }).content;
    if (!Array.isArray(contenidos)) continue;
    for (const contenido of contenidos) {
      if (!contenido || typeof contenido !== "object") continue;
      const bloque = contenido as { type?: string; text?: string };
      if (bloque.type === "output_text" && typeof bloque.text === "string") return bloque.text;
    }
  }
  return "";
}

async function analizarPdfConOpenAI(nombre: string, bytes: Blob) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("El análisis automático aún no está configurado: falta OPENAI_API_KEY en el servidor.");

  const modelo = process.env.OPENAI_PROYECTO_MODEL || "gpt-5.6-luna";
  const form = new FormData();
  form.append("purpose", "user_data");
  form.append("file", bytes, nombre);

  const carga = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const archivoOpenAI = await carga.json() as { id?: string; error?: { message?: string } };
  if (!carga.ok || !archivoOpenAI.id) throw new Error(archivoOpenAI.error?.message || "OpenAI no pudo recibir el PDF.");

  try {
    const respuesta = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelo,
        store: false,
        input: [{
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Analiza este plano o documento técnico para una inspección habitacional. Extrae únicamente información visible o explícitamente indicada. No inventes elementos ocultos ni dimensiones faltantes. Identifica áreas, dimensiones, especificaciones, ubicaciones y elementos verificables en campo. Si una lectura es incierta, colócala en advertencias. Las referencias deben permitir al Inspector ubicar el dato en el documento. Devuelve exclusivamente el JSON solicitado.",
            },
            { type: "input_file", file_id: archivoOpenAI.id },
          ],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "proyecto_habitacional_v1",
            strict: true,
            schema: esquemaOpenAIProyectoV1(),
          },
        },
      }),
    });
    const cuerpo = await respuesta.json() as { error?: { message?: string }; output?: unknown[] };
    if (!respuesta.ok) throw new Error(cuerpo.error?.message || "El motor de IA no pudo analizar el PDF.");
    const textoJson = extraerTextoRespuestaOpenAI(cuerpo);
    if (!textoJson) throw new Error("El motor de IA no devolvió un resultado estructurado.");
    return validarResultadoDocumentoProyectoV1(JSON.parse(textoJson));
  } finally {
    await fetch(`https://api.openai.com/v1/files/${archivoOpenAI.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    }).catch(() => undefined);
  }
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
      for (const creado of creados) {
        await prisma.$executeRaw`DELETE FROM "DocumentoProyectoInspeccion" WHERE "id"=${creado.id}`;
      }
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

export async function analizarProyectoV1(formData: FormData) {
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

  await prisma.$executeRaw`
    UPDATE "DocumentoProyectoInspeccion"
    SET "estadoAnalisis"='ANALIZANDO',"observaciones"=NULL
    WHERE "id"=${documentoId}
  `;

  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb.storage.from(documento.bucket).download(documento.ruta);
    if (error || !data) throw new Error("No fue posible recuperar el PDF desde el almacenamiento.");
    const resultado = await analizarPdfConOpenAI(documento.nombreOriginal, data);
    const observaciones = resultado.advertencias.length > 0
      ? `${resultado.advertencias.length} advertencia(s): ${resultado.advertencias.slice(0, 3).join(" · ")}`
      : "Análisis automático completado sin advertencias declaradas.";
    await prisma.$executeRaw`
      UPDATE "DocumentoProyectoInspeccion"
      SET "estadoAnalisis"='COMPLETADO',
          "datosExtraidos"=${JSON.stringify(resultado)}::jsonb,
          "observaciones"=${observaciones}
      WHERE "id"=${documentoId} AND "inspeccionId"=${inspeccionId}
    `;
    await registrarAuditoria({
      tipo: TipoEvento.EDITAR,
      entidad: "DocumentoProyectoInspeccion",
      entidadId: documentoId,
      inspeccionId,
      usuarioId: usuario.id,
      descripcion: `Análisis automático completado para “${documento.nombreOriginal}”: ${resultado.areas.length} área(s) identificada(s) y ${resultado.advertencias.length} advertencia(s).`,
    });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "No fue posible analizar el documento.";
    await prisma.$executeRaw`
      UPDATE "DocumentoProyectoInspeccion"
      SET "estadoAnalisis"='ERROR',"observaciones"=${mensaje},"datosExtraidos"=NULL
      WHERE "id"=${documentoId} AND "inspeccionId"=${inspeccionId}
    `;
    revalidatePath(`/panel/inspecciones/${inspeccionId}/proyecto-v1`);
    volver(inspeccionId, "error", mensaje);
  }

  revalidatePath(`/panel/inspecciones/${inspeccionId}/proyecto-v1`);
  volver(inspeccionId, "ok", `Análisis de “${documento.nombreOriginal}” completado. Revisa el resultado antes de generar la guía.`);
}

export async function generarGuiaDesdeProyectoV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  if (!inspeccionId) redirect("/panel/inspecciones");
  const { usuario } = await exigirInspectorEditable(inspeccionId);

  const documentos = await prisma.$queryRaw<Array<{ id: string; nombreOriginal: string; estadoAnalisis: string; datosExtraidos: unknown }>>`
    SELECT "id","nombreOriginal","estadoAnalisis","datosExtraidos"
    FROM "DocumentoProyectoInspeccion"
    WHERE "inspeccionId"=${inspeccionId}
    ORDER BY "creadoEn"
  `;
  if (documentos.length === 0) volver(inspeccionId, "error", "Carga y analiza al menos un PDF antes de generar la guía de proyecto.");
  const incompletos = documentos.filter((documento) => documento.estadoAnalisis !== "COMPLETADO" || !documento.datosExtraidos);
  if (incompletos.length > 0) volver(inspeccionId, "error", `Faltan ${incompletos.length} documento(s) por analizar correctamente.`);

  const resultados = documentos.map((documento) => ({
    documento,
    resultado: validarResultadoDocumentoProyectoV1(documento.datosExtraidos),
  }));

  const totalPuntosEsperados = resultados.reduce((total, { resultado }) => (
    total + resultado.areas.reduce((subtotal, area) => {
      const puntosArea = area.dimensiones.length + area.especificaciones.length + area.elementos.length;
      return subtotal + (puntosArea > 0 ? puntosArea : 1);
    }, 0)
  ), 0);

  if (totalPuntosEsperados === 0) {
    volver(inspeccionId, "error", "El análisis no produjo áreas o elementos utilizables para la guía. Se conserva la guía de proyecto anterior, si existe. Revisa las advertencias de los documentos.");
  }

  let orden = 100;
  let totalPuntos = 0;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      DELETE FROM "GuiaInspeccionItem"
      WHERE "inspeccionId"=${inspeccionId} AND "origen"='PROYECTO'
    `;

    for (const { documento, resultado } of resultados) {
      for (const area of resultado.areas) {
        const referenciasArea = area.referencias.join(" · ");
        for (const dimension of area.dimensiones) {
          const id = randomUUID();
          const especificacion = [
            `Proyecto: ${dimension.valor}${dimension.unidad ? ` ${dimension.unidad}` : ""}`,
            dimension.referencia || referenciasArea || null,
          ].filter(Boolean).join(" · ");
          await tx.$executeRaw`
            INSERT INTO "GuiaInspeccionItem"
              ("id","inspeccionId","origen","tipoProyecto","area","concepto","especificacion","orden","obligatorio","completado","creadoPorId","estadoV3","origenV3","requiereMedicion","requiereComparacionProyecto","valorProyecto","unidadMedida","creadoEn","actualizadoEn")
            VALUES
              (${id},${inspeccionId},'PROYECTO',${resultado.tipoProyectoDetectado || null},${area.nombre},${`Verificar dimensión: ${dimension.nombre}`},${especificacion},${orden},true,false,${usuario.id},'PENDIENTE','PROYECTO',true,true,${dimension.valor},${dimension.unidad || null},NOW(),NOW())
          `;
          orden += 10;
          totalPuntos += 1;
        }
        for (const especificacion of area.especificaciones) {
          const id = randomUUID();
          await tx.$executeRaw`
            INSERT INTO "GuiaInspeccionItem"
              ("id","inspeccionId","origen","tipoProyecto","area","concepto","especificacion","orden","obligatorio","completado","creadoPorId","estadoV3","origenV3","requiereComparacionProyecto","creadoEn","actualizadoEn")
            VALUES
              (${id},${inspeccionId},'PROYECTO',${resultado.tipoProyectoDetectado || null},${area.nombre},'Verificar especificación de proyecto',${especificacion},${orden},true,false,${usuario.id},'PENDIENTE','PROYECTO',true,NOW(),NOW())
          `;
          orden += 10;
          totalPuntos += 1;
        }
        for (const elemento of area.elementos) {
          const id = randomUUID();
          const especificacion = [elemento.especificacion, elemento.ubicacion, elemento.referencia].filter(Boolean).join(" · ") || null;
          await tx.$executeRaw`
            INSERT INTO "GuiaInspeccionItem"
              ("id","inspeccionId","origen","tipoProyecto","area","concepto","especificacion","orden","obligatorio","completado","creadoPorId","estadoV3","origenV3","requiereComparacionProyecto","valorProyecto","unidadMedida","creadoEn","actualizadoEn")
            VALUES
              (${id},${inspeccionId},'PROYECTO',${resultado.tipoProyectoDetectado || null},${area.nombre},${`Verificar elemento: ${elemento.nombre}`},${especificacion},${orden},true,false,${usuario.id},'PENDIENTE','PROYECTO',true,${elemento.cantidad !== null && elemento.cantidad !== undefined ? String(elemento.cantidad) : null},${elemento.unidad || null},NOW(),NOW())
          `;
          orden += 10;
          totalPuntos += 1;
        }
        if (area.dimensiones.length === 0 && area.especificaciones.length === 0 && area.elementos.length === 0) {
          const id = randomUUID();
          await tx.$executeRaw`
            INSERT INTO "GuiaInspeccionItem"
              ("id","inspeccionId","origen","tipoProyecto","area","concepto","especificacion","orden","obligatorio","completado","creadoPorId","estadoV3","origenV3","requiereComparacionProyecto","creadoEn","actualizadoEn")
            VALUES
              (${id},${inspeccionId},'PROYECTO',${resultado.tipoProyectoDetectado || null},${area.nombre},'Verificar correspondencia con proyecto',${`Fuente: ${documento.nombreOriginal}${referenciasArea ? ` · ${referenciasArea}` : ""}`},${orden},true,false,${usuario.id},'PENDIENTE','PROYECTO',true,NOW(),NOW())
          `;
          orden += 10;
          totalPuntos += 1;
        }
      }
    }
  });

  if (totalPuntos === 0) volver(inspeccionId, "error", "El análisis no produjo áreas o elementos utilizables para la guía. Revisa las advertencias de los documentos.");

  await registrarAuditoria({
    tipo: TipoEvento.CREAR,
    entidad: "GuiaInspeccionItem",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `Inspector generó ${totalPuntos} punto(s) de guía V1 a partir de ${documentos.length} documento(s) de proyecto analizados. La Biblioteca Certeza complementará el plan.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/proyecto-v1`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
  volver(inspeccionId, "ok", `Guía de proyecto generada con ${totalPuntos} punto(s). Ahora revisa y confirma las áreas; la Biblioteca Certeza complementará el plan mínimo.`);
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
