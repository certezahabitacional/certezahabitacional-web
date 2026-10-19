"use server";

import { randomUUID } from "node:crypto";
import { EstadoInspeccion, RolUsuario, TipoEvento } from "@prisma/client";
import { PDFDocument } from "pdf-lib";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";
import { validarResultadoDocumentoProyectoV1 } from "@/lib/proyecto-v1-analisis";
import {
  CONCEPTOS_PROYECTO_V1,
  correlacionarAreasProyectoV1,
  normalizarProyectoV1,
} from "@/lib/proyecto-v1-matriz";
import { obtenerSupabaseAdmin } from "@/lib/supabase-admin";

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

async function exigirResponsableProyecto(inspeccionId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [usuario, inspeccion] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: { id: true, rol: true, activo: true, inspector: { select: { id: true, activo: true } } },
    }),
    prisma.inspeccion.findUnique({
      where: { id: inspeccionId },
      select: { id: true, numeroInspeccion: true, estado: true, inspectorId: true, folio: true, cotizacionId: true },
    }),
  ]);

  if (!usuario?.activo || !inspeccion) redirect("/acceso");
  const inspectorAsignado =
    usuario.rol === RolUsuario.INSPECTOR &&
    Boolean(usuario.inspector?.activo) &&
    inspeccion.inspectorId === usuario.inspector?.id;
  const director = usuario.rol === RolUsuario.DIRECTOR;
  if (!inspectorAsignado && !director) redirect("/acceso");
  if (inspeccion.numeroInspeccion !== 1) volver(inspeccionId, "error", "La carga de proyecto digital corresponde a la inspección inicial V1.");
  if (inspeccion.estado !== EstadoInspeccion.EN_PROCESO) volver(inspeccionId, "error", "El proyecto digital solo puede prepararse mientras la inspección está EN PROCESO.");

  const [control] = await prisma.$queryRaw<Array<{ proyectoConfirmado: boolean }>>`
    SELECT "proyectoConfirmado" FROM "InspeccionControlV2" WHERE "inspeccionId"=${inspeccionId} LIMIT 1
  `;
  if (control?.proyectoConfirmado) volver(inspeccionId, "error", "El alcance de proyecto ya fue confirmado. La trazabilidad quedó bloqueada.");

  return { session, usuario, inspeccion, responsable: director ? "Director" : "Inspector" };
}

function esquemaGeminiProyectoV1() {
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

async function analizarPdfConGemini(nombre: string, bytes: Blob) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("El análisis automático con Gemini no está configurado: falta GEMINI_API_KEY en el servidor.");
  }

  const modeloConfigurado = process.env.GEMINI_PROYECTO_MODEL || "gemini-3.5-flash-lite";
  const modelo = /gemini-2\.5-flash-lite/i.test(modeloConfigurado)
    ? "gemini-3.5-flash-lite"
    : modeloConfigurado;
  const pdfBase64 = Buffer.from(await bytes.arrayBuffer()).toString("base64");
  const instruccion = [
    "Analiza este plano o documento técnico para una inspección habitacional.",
    "Extrae únicamente información visible o explícitamente indicada en el PDF.",
    "No inventes elementos ocultos, dimensiones, materiales ni especificaciones faltantes.",
    "Identifica áreas, dimensiones, especificaciones, ubicaciones y elementos verificables en campo.",
    "Si una lectura es incierta, colócala en advertencias.",
    "Las referencias deben permitir al Inspector ubicar el dato dentro del documento.",
    "Devuelve exclusivamente el objeto JSON definido por el esquema de respuesta."
  ].join(" ");

  const respuesta = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: pdfBase64,
              },
            },
            { text: instruccion },
          ],
        }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: esquemaGeminiProyectoV1(),
          temperature: 0.1,
        },
      }),
      cache: "no-store",
    },
  );

  const cuerpo = await respuesta.json().catch(() => ({})) as {
    error?: { message?: string; status?: string; code?: number };
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: Array<{ text?: string }> };
    }>;
    promptFeedback?: { blockReason?: string };
  };

  if (!respuesta.ok) {
    const detalle = cuerpo.error?.message || "Gemini no pudo analizar el PDF.";
    if (respuesta.status === 429) {
      throw new Error("Se alcanzó temporalmente la cuota gratuita de Gemini. Intenta nuevamente más tarde.");
    }
    if (/api key not valid|api_key_invalid|invalid api key/i.test(detalle)) {
      throw new Error("La clave GEMINI_API_KEY configurada en Vercel no es válida. Revisa la clave de Google AI Studio.");
    }
    if (respuesta.status === 403) {
      throw new Error(`Gemini rechazó la solicitud por permisos: ${detalle}`);
    }
    throw new Error(`Gemini no pudo analizar el PDF: ${detalle}`);
  }

  const textoJson = cuerpo.candidates?.[0]?.content?.parts
    ?.map((parte) => parte.text || "")
    .filter(Boolean)
    .join("\n")
    .trim() || "";

  if (!textoJson) {
    const motivo = cuerpo.promptFeedback?.blockReason || cuerpo.candidates?.[0]?.finishReason || "sin contenido";
    throw new Error(`Gemini no devolvió un resultado estructurado (${motivo}).`);
  }

  try {
    return validarResultadoDocumentoProyectoV1(JSON.parse(textoJson));
  } catch {
    throw new Error(`Gemini devolvió un resultado que no cumple el formato técnico requerido para “${nombre}”.`);
  }
}

export async function subirProyectosV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const tipo = texto(formData, "tipo");
  if (!inspeccionId) redirect("/panel/inspecciones");
  if (!TIPOS_PROYECTO.has(tipo)) volver(inspeccionId, "error", "Selecciona un tipo de proyecto válido.");
  const { usuario, inspeccion, responsable } = await exigirResponsableProyecto(inspeccionId);
  const archivos = formData.getAll("archivos").filter((valor): valor is File => valor instanceof File && valor.size > 0);
  if (archivos.length === 0) volver(inspeccionId, "error", "Selecciona al menos un archivo PDF.");
  if (archivos.reduce((suma, archivo) => suma + archivo.size, 0) > LIMITE_LOTE) volver(inspeccionId, "error", "El lote supera 11 MB. Divide los planos en dos o más cargas.");

  for (const archivo of archivos) {
    if (!(archivo.type === "application/pdf" || archivo.name.toLowerCase().endsWith(".pdf"))) volver(inspeccionId, "error", `“${archivo.name}” no es un archivo PDF.`);
    if (archivo.size > LIMITE_ARCHIVO) volver(inspeccionId, "error", `“${archivo.name}” supera 10 MB.`);
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";
  const sb = obtenerSupabaseAdmin();
  const creados: Array<{ id: string; ruta: string }> = [];
  try {
    for (const archivo of archivos) {
      const bytes = Buffer.from(await archivo.arrayBuffer());
      let paginas = 0;
      try {
        paginas = (await PDFDocument.load(bytes)).getPageCount();
      } catch {
        throw new Error(`No fue posible leer “${archivo.name}”. Verifica que sea un PDF válido y no esté protegido.`);
      }
      const id = randomUUID();
      const ruta = `${inspeccionId}/proyecto-v1/${id}.pdf`;
      const { error } = await sb.storage.from(bucket).upload(ruta, bytes, { contentType: "application/pdf", upsert: false });
      if (error) throw new Error(`No fue posible almacenar “${archivo.name}”.`);
      await prisma.$executeRaw`
        INSERT INTO "DocumentoProyectoInspeccion"
          ("id","inspeccionId","tipo","nombreOriginal","bucket","ruta","mimeType","bytes","subidoPorId","estadoAnalisis","numeroPaginas","creadoEn")
        VALUES (${id},${inspeccionId},${tipo},${archivo.name},${bucket},${ruta},'application/pdf',${archivo.size},${usuario.id},'PENDIENTE',${paginas},NOW())
      `;
      creados.push({ id, ruta });
    }
  } catch (error) {
    if (creados.length > 0) {
      await sb.storage.from(bucket).remove(creados.map((item) => item.ruta));
      for (const creado of creados) await prisma.$executeRaw`DELETE FROM "DocumentoProyectoInspeccion" WHERE "id"=${creado.id}`;
    }
    volver(inspeccionId, "error", error instanceof Error ? error.message : "No fue posible cargar los PDF.");
  }

  await registrarAuditoria({
    tipo: TipoEvento.SUBIR_EVIDENCIA,
    entidad: "DocumentoProyectoInspeccion",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${responsable} cargó ${archivos.length} PDF(s) de proyecto (${tipo}) en ${inspeccion.folio}.`,
  });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/proyecto-v1`);
  volver(inspeccionId, "ok", `${archivos.length} PDF(s) cargados. Analiza cada documento antes de confirmar el alcance.`);
}

export async function analizarProyectoV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const documentoId = texto(formData, "documentoId");
  if (!inspeccionId || !documentoId) redirect("/panel/inspecciones");
  const { usuario, responsable } = await exigirResponsableProyecto(inspeccionId);
  const [documento] = await prisma.$queryRaw<Array<{ id: string; bucket: string; ruta: string; nombreOriginal: string }>>`
    SELECT "id","bucket","ruta","nombreOriginal" FROM "DocumentoProyectoInspeccion"
    WHERE "id"=${documentoId} AND "inspeccionId"=${inspeccionId} LIMIT 1
  `;
  if (!documento) volver(inspeccionId, "error", "El documento no existe o no pertenece a esta inspección.");

  await prisma.$executeRaw`UPDATE "DocumentoProyectoInspeccion" SET "estadoAnalisis"='ANALIZANDO',"observaciones"=NULL WHERE "id"=${documentoId}`;
  try {
    const sb = obtenerSupabaseAdmin();
    const { data, error } = await sb.storage.from(documento.bucket).download(documento.ruta);
    if (error || !data) throw new Error("No fue posible recuperar el PDF desde el almacenamiento.");
    const resultado = await analizarPdfConGemini(documento.nombreOriginal, data);
    const observaciones = resultado.advertencias.length > 0
      ? `${resultado.advertencias.length} advertencia(s): ${resultado.advertencias.slice(0, 3).join(" · ")}`
      : "Análisis automático completado sin advertencias declaradas.";
    await prisma.$executeRaw`
      UPDATE "DocumentoProyectoInspeccion" SET "estadoAnalisis"='COMPLETADO',"datosExtraidos"=${JSON.stringify(resultado)}::jsonb,"observaciones"=${observaciones}
      WHERE "id"=${documentoId} AND "inspeccionId"=${inspeccionId}
    `;
    await registrarAuditoria({
      tipo: TipoEvento.EDITAR,
      entidad: "DocumentoProyectoInspeccion",
      entidadId: documentoId,
      inspeccionId,
      usuarioId: usuario.id,
      descripcion: `${responsable} completó el análisis de “${documento.nombreOriginal}”: ${resultado.areas.length} área(s) identificada(s).`,
    });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "No fue posible analizar el documento.";
    await prisma.$executeRaw`UPDATE "DocumentoProyectoInspeccion" SET "estadoAnalisis"='ERROR',"observaciones"=${mensaje},"datosExtraidos"=NULL WHERE "id"=${documentoId}`;
    revalidatePath(`/panel/inspecciones/${inspeccionId}/proyecto-v1`);
    volver(inspeccionId, "error", mensaje);
  }
  revalidatePath(`/panel/inspecciones/${inspeccionId}/proyecto-v1`);
  volver(inspeccionId, "ok", `Análisis de “${documento.nombreOriginal}” completado. Revisa la correlación de áreas.`);
}

export async function generarGuiaDesdeProyectoV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  if (!inspeccionId) redirect("/panel/inspecciones");
  const { usuario, responsable } = await exigirResponsableProyecto(inspeccionId);
  const documentos = await prisma.$queryRaw<Array<{ id: string; nombreOriginal: string; estadoAnalisis: string; datosExtraidos: unknown }>>`
    SELECT "id","nombreOriginal","estadoAnalisis","datosExtraidos" FROM "DocumentoProyectoInspeccion"
    WHERE "inspeccionId"=${inspeccionId} ORDER BY "creadoEn"
  `;
  if (documentos.length === 0) volver(inspeccionId, "error", "Carga y analiza al menos un PDF antes de generar la guía de proyecto.");
  const incompletos = documentos.filter((documento) => documento.estadoAnalisis !== "COMPLETADO" || !documento.datosExtraidos);
  if (incompletos.length > 0) volver(inspeccionId, "error", `Faltan ${incompletos.length} documento(s) por analizar correctamente.`);

  const resultados = documentos.map((documento) => ({ documento, resultado: validarResultadoDocumentoProyectoV1(documento.datosExtraidos) }));
  let orden = 100;
  let totalPuntos = 0;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`DELETE FROM "GuiaInspeccionItem" WHERE "inspeccionId"=${inspeccionId} AND "origen"='PROYECTO'`;
    for (const { documento, resultado } of resultados) {
      for (const area of resultado.areas) {
        const referenciasArea = area.referencias.join(" · ");
        for (const dimension of area.dimensiones) {
          const especificacion = [`Proyecto: ${dimension.valor}${dimension.unidad ? ` ${dimension.unidad}` : ""}`, dimension.referencia || referenciasArea || null].filter(Boolean).join(" · ");
          await tx.$executeRaw`
            INSERT INTO "GuiaInspeccionItem"
              ("id","inspeccionId","origen","tipoProyecto","area","concepto","especificacion","orden","obligatorio","completado","creadoPorId","estadoV3","origenV3","requiereMedicion","requiereComparacionProyecto","valorProyecto","unidadMedida","creadoEn","actualizadoEn")
            VALUES (${randomUUID()},${inspeccionId},'PROYECTO',${resultado.tipoProyectoDetectado || null},${area.nombre},${`Verificar dimensión: ${dimension.nombre}`},${especificacion},${orden},true,false,${usuario.id},'PENDIENTE','PROYECTO',true,true,${dimension.valor},${dimension.unidad || null},NOW(),NOW())
          `;
          orden += 10; totalPuntos += 1;
        }
        for (const especificacion of area.especificaciones) {
          await tx.$executeRaw`
            INSERT INTO "GuiaInspeccionItem"
              ("id","inspeccionId","origen","tipoProyecto","area","concepto","especificacion","orden","obligatorio","completado","creadoPorId","estadoV3","origenV3","requiereComparacionProyecto","creadoEn","actualizadoEn")
            VALUES (${randomUUID()},${inspeccionId},'PROYECTO',${resultado.tipoProyectoDetectado || null},${area.nombre},'Verificar especificación de proyecto',${especificacion},${orden},true,false,${usuario.id},'PENDIENTE','PROYECTO',true,NOW(),NOW())
          `;
          orden += 10; totalPuntos += 1;
        }
        for (const elemento of area.elementos) {
          const especificacion = [elemento.especificacion, elemento.ubicacion, elemento.referencia].filter(Boolean).join(" · ") || null;
          await tx.$executeRaw`
            INSERT INTO "GuiaInspeccionItem"
              ("id","inspeccionId","origen","tipoProyecto","area","concepto","especificacion","orden","obligatorio","completado","creadoPorId","estadoV3","origenV3","requiereComparacionProyecto","valorProyecto","unidadMedida","creadoEn","actualizadoEn")
            VALUES (${randomUUID()},${inspeccionId},'PROYECTO',${resultado.tipoProyectoDetectado || null},${area.nombre},${`Verificar elemento: ${elemento.nombre}`},${especificacion},${orden},true,false,${usuario.id},'PENDIENTE','PROYECTO',true,${elemento.cantidad !== null && elemento.cantidad !== undefined ? String(elemento.cantidad) : null},${elemento.unidad || null},NOW(),NOW())
          `;
          orden += 10; totalPuntos += 1;
        }
        if (area.dimensiones.length === 0 && area.especificaciones.length === 0 && area.elementos.length === 0) {
          await tx.$executeRaw`
            INSERT INTO "GuiaInspeccionItem"
              ("id","inspeccionId","origen","tipoProyecto","area","concepto","especificacion","orden","obligatorio","completado","creadoPorId","estadoV3","origenV3","requiereComparacionProyecto","creadoEn","actualizadoEn")
            VALUES (${randomUUID()},${inspeccionId},'PROYECTO',${resultado.tipoProyectoDetectado || null},${area.nombre},'Verificar correspondencia con proyecto',${`Fuente: ${documento.nombreOriginal}${referenciasArea ? ` · ${referenciasArea}` : ""}`},${orden},true,false,${usuario.id},'PENDIENTE','PROYECTO',true,NOW(),NOW())
          `;
          orden += 10; totalPuntos += 1;
        }
      }
    }
  });
  if (totalPuntos === 0) volver(inspeccionId, "error", "El análisis no produjo puntos utilizables. Revisa las advertencias de los PDF.");
  await registrarAuditoria({ tipo: TipoEvento.CREAR, entidad: "GuiaInspeccionItem", inspeccionId, usuarioId: usuario.id, descripcion: `${responsable} generó ${totalPuntos} punto(s) de guía a partir del proyecto digital.` });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/proyecto-v1`);
  volver(inspeccionId, "ok", `Guía de proyecto actualizada con ${totalPuntos} punto(s). Ya puedes confirmar la matriz de alcance.`);
}

export async function eliminarProyectoV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const documentoId = texto(formData, "documentoId");
  if (!inspeccionId || !documentoId) redirect("/panel/inspecciones");
  const { usuario, responsable } = await exigirResponsableProyecto(inspeccionId);
  const [documento] = await prisma.$queryRaw<Array<{ id: string; bucket: string; ruta: string; nombreOriginal: string }>>`
    SELECT "id","bucket","ruta","nombreOriginal" FROM "DocumentoProyectoInspeccion"
    WHERE "id"=${documentoId} AND "inspeccionId"=${inspeccionId} LIMIT 1
  `;
  if (!documento) volver(inspeccionId, "error", "El documento no existe o no pertenece a esta inspección.");
  const sb = obtenerSupabaseAdmin();
  const { error } = await sb.storage.from(documento.bucket).remove([documento.ruta]);
  if (error) volver(inspeccionId, "error", "No fue posible eliminar el PDF del almacenamiento.");
  await prisma.$executeRaw`DELETE FROM "DocumentoProyectoInspeccion" WHERE "id"=${documentoId} AND "inspeccionId"=${inspeccionId}`;
  await registrarAuditoria({ tipo: TipoEvento.ELIMINAR, entidad: "DocumentoProyectoInspeccion", entidadId: documentoId, inspeccionId, usuarioId: usuario.id, descripcion: `${responsable} eliminó el PDF “${documento.nombreOriginal}” antes de confirmar el alcance.` });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/proyecto-v1`);
  volver(inspeccionId, "ok", `Documento “${documento.nombreOriginal}” eliminado.`);
}

export async function confirmarMatrizProyectoV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const modalidad = texto(formData, "modalidad");
  if (!inspeccionId) redirect("/panel/inspecciones");
  if (!new Set(["CON_PDF", "SIN_PDF"]).has(modalidad)) volver(inspeccionId, "error", "Selecciona si la inspección cuenta o no con proyecto PDF.");
  const { usuario, inspeccion, responsable } = await exigirResponsableProyecto(inspeccionId);

  const documentos = await prisma.$queryRaw<Array<{ tipo: string; estadoAnalisis: string; datosExtraidos: unknown }>>`
    SELECT "tipo","estadoAnalisis","datosExtraidos" FROM "DocumentoProyectoInspeccion"
    WHERE "inspeccionId"=${inspeccionId} ORDER BY "creadoEn"
  `;
  if (modalidad === "SIN_PDF" && documentos.length > 0) volver(inspeccionId, "error", "Hay PDF cargados. Elimínalos antes de declarar SIN PROYECTO PDF.");
  if (modalidad === "CON_PDF") {
    if (documentos.length === 0) volver(inspeccionId, "error", "Carga al menos un PDF de proyecto.");
    const incompletos = documentos.filter((d) => d.estadoAnalisis !== "COMPLETADO" || !d.datosExtraidos);
    if (incompletos.length > 0) volver(inspeccionId, "error", `Faltan ${incompletos.length} PDF(s) por analizar correctamente.`);
    const [guia] = await prisma.$queryRaw<Array<{ total: number }>>`
      SELECT COUNT(*)::int AS "total" FROM "GuiaInspeccionItem" WHERE "inspeccionId"=${inspeccionId} AND "origen"='PROYECTO'
    `;
    if (Number(guia?.total ?? 0) === 0) volver(inspeccionId, "error", "Genera la guía desde el análisis antes de confirmar la matriz.");
  }

  const estados = CONCEPTOS_PROYECTO_V1.map((concepto) => {
    const valor = texto(formData, `aplica_${concepto.codigo}`);
    if (!new Set(["SI", "NO"]).has(valor)) volver(inspeccionId, "error", `Define SI APLICA o NO APLICA para “${concepto.etiqueta}”.`);
    return { codigo: concepto.codigo, etiqueta: concepto.etiqueta, aplica: valor === "SI" };
  });

  let snapshot: Record<string, unknown> = {};
  if (inspeccion.cotizacionId) {
    const version = await prisma.cotizacionVersion.findFirst({
      where: { cotizacionId: inspeccion.cotizacionId },
      orderBy: { version: "desc" },
      select: { datos: true },
    });
    if (version?.datos && typeof version.datos === "object" && !Array.isArray(version.datos)) snapshot = version.datos as Record<string, unknown>;
  }

  const areasProyecto = documentos.flatMap((documento) => {
    if (!documento.datosExtraidos) return [];
    try { return validarResultadoDocumentoProyectoV1(documento.datosExtraidos).areas; } catch { return []; }
  });
  const correlacion = correlacionarAreasProyectoV1(snapshot, areasProyecto);
  const tipos = new Set(documentos.map((d) => normalizarProyectoV1(d.tipo)));
  const matriz = CONCEPTOS_PROYECTO_V1.map((concepto) => ({
    ...estados.find((estado) => estado.codigo === concepto.codigo)!,
    proyecto: concepto.tiposProyecto.some((tipo) => tipos.has(tipo)),
    plantilla: true,
  }));

  const resumen = {
    proyectoDigitalV1: {
      version: 1,
      modalidad,
      confirmadoEn: new Date().toISOString(),
      confirmadoPorId: usuario.id,
      matriz,
      areasCorrelacionadas: correlacion,
    },
  };

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "InspeccionControlV2" ("inspeccionId","categoria","versionProtocolo","proyectoConfirmado","resumenEstadistico")
      VALUES (${inspeccionId},'VIVIENDA',2,true,${JSON.stringify(resumen)}::jsonb)
      ON CONFLICT ("inspeccionId") DO UPDATE
      SET "proyectoConfirmado"=true,
          "resumenEstadistico"=COALESCE("InspeccionControlV2"."resumenEstadistico",'{}'::jsonb) || EXCLUDED."resumenEstadistico",
          "actualizadoEn"=NOW()
    `;

    let orden = 10;
    for (const area of correlacion) {
      if (area.clave === "FACHADA_PRINCIPAL") continue;
      await tx.$executeRaw`
        INSERT INTO "AreaInspeccion" ("inspeccionId","codigo","nombre","tipo","orden","origen","obligatoria","ubicacion","dimensiones","especificaciones")
        VALUES (${inspeccionId},${area.clave},${area.nombre},'INTERIOR',${orden},${area.enProyecto && area.enPlantilla ? 'PROYECTO_Y_PLANTILLA' : area.enProyecto ? 'PROYECTO' : 'PLANTILLA'},true,${area.ubicacion},${JSON.stringify(area.dimensiones)}::jsonb,${JSON.stringify(area.especificaciones)}::jsonb)
        ON CONFLICT ("inspeccionId","codigo") DO UPDATE SET
          "nombre"=EXCLUDED."nombre",
          "origen"=EXCLUDED."origen",
          "ubicacion"=COALESCE(EXCLUDED."ubicacion","AreaInspeccion"."ubicacion"),
          "dimensiones"=CASE WHEN EXCLUDED."dimensiones" <> '[]'::jsonb THEN EXCLUDED."dimensiones" ELSE "AreaInspeccion"."dimensiones" END,
          "especificaciones"=CASE WHEN EXCLUDED."especificaciones" <> '[]'::jsonb THEN EXCLUDED."especificaciones" ELSE "AreaInspeccion"."especificaciones" END,
          "actualizadoEn"=NOW()
      `;
      orden += 10;
    }
  });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "InspeccionControlV2",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${responsable} confirmó la matriz Proyecto/Plantilla de ${inspeccion.folio} (${modalidad}), con ${matriz.filter((item) => item.aplica).length} de 7 conceptos marcados SI APLICA y ${correlacion.length} área(s) correlacionada(s).`,
  });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/proyecto-v1`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
  redirect(`/panel/inspecciones/${inspeccionId}/areas?ok=${encodeURIComponent("Proyecto/Plantilla confirmado. Revisa y confirma el ecosistema físico de áreas antes del recorrido.")}`);
}
