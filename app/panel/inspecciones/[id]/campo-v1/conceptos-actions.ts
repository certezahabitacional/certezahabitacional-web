"use server";

import { randomUUID } from "node:crypto";
import {
  ClasificacionHallazgo,
  EstadoInspeccion,
  PrioridadHallazgo,
  RolUsuario,
  TipoEvento,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { calificarPuntoConIaV1 } from "@/lib/calificacion-ia-v1";
import { prisma } from "@/lib/prisma";
import { obtenerSupabaseAdmin } from "@/lib/supabase-admin";

const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? "").trim();

type OrigenEvidencia = "CAMARA" | "GALERIA";

type ObservacionConcepto = {
  descripcionIa?: string;
  clasificacionSugerida?: string;
  justificacionIa?: string;
  descripcionFinal?: string;
  clasificacionFinal?: string;
  prioridadFinal?: string;
  calificacionFinal?: number;
  justificacionCalificacionIa?: string;
  prioridadEvaluadaIa?: string;
  actualizadoEn?: string;
};

function observacionObjeto(valor: string | null): ObservacionConcepto {
  if (!valor) return {};
  try {
    const parsed = JSON.parse(valor);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as ObservacionConcepto)
      : {};
  } catch {
    return { descripcionFinal: valor };
  }
}

const MIN_FOTOS_CONCEPTO = 1;
const MAX_FOTOS_CONCEPTO = 4;

function volver(
  inspeccionId: string,
  areaId: string,
  tipo: "ok" | "error",
  mensaje: string,
  itemId?: string,
): never {
  const params = new URLSearchParams({ area: areaId, [tipo]: mensaje });
  redirect(
    `/panel/inspecciones/${inspeccionId}/campo-v1?${params.toString()}${itemId ? `#item-${itemId}` : ""}`,
  );
}

async function exigirResponsable(inspeccionId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      rol: true,
      activo: true,
      inspector: { select: { id: true, activo: true } },
    },
  });
  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: { id: true, numeroInspeccion: true, estado: true, inspectorId: true },
  });
  if (!usuario?.activo || !inspeccion) redirect("/acceso");

  const inspectorAsignado =
    usuario.rol === RolUsuario.INSPECTOR &&
    Boolean(usuario.inspector?.activo) &&
    inspeccion.inspectorId === usuario.inspector?.id;
  const director = usuario.rol === RolUsuario.DIRECTOR;
  if (!inspectorAsignado && !director) redirect("/acceso");
  if (inspeccion.numeroInspeccion !== 1) redirect(`/panel/inspecciones/${inspeccionId}/flujo`);
  if (
    inspeccion.estado !== EstadoInspeccion.EN_PROCESO &&
    !(director && inspeccion.estado === EstadoInspeccion.REPORTE_PENDIENTE)
  ) redirect(`/panel/inspecciones/${inspeccionId}`);

  return { usuario, responsable: director ? "Director" : "Inspector" };
}

async function exigirAreaActiva(inspeccionId: string, areaId: string) {
  const areas = await prisma.$queryRaw<Array<{ id: string; nombre: string; estado: string }>>`
    SELECT "id"::text,"nombre","estado"
    FROM "AreaInspeccion"
    WHERE "inspeccionId"=${inspeccionId} AND "tipo" <> 'PUNTO_CRITICO'
    ORDER BY "orden","nombre"
  `;
  const indice = areas.findIndex((area) => area.estado !== "REVISADA");
  const solicitada = areas.find((area) => area.id === areaId);
  if (!solicitada) redirect(`/panel/inspecciones/${inspeccionId}/campo-v1?error=${encodeURIComponent("El punto de área no pertenece a esta inspección.")}`);
  if (indice < 0) redirect(`/panel/inspecciones/${inspeccionId}/campo-v1?ok=${encodeURIComponent("Todos los puntos de área están cerrados al 100%.")}`);
  const activa = areas[indice];
  if (activa.id !== areaId) {
    volver(
      inspeccionId,
      activa.id,
      "error",
      `Debes concluir al 100% el Punto ${9 + indice} · ${activa.nombre} antes de avanzar.`,
    );
  }
  return { area: activa, numero: 9 + indice };
}

async function exigirAreaEditable(inspeccionId: string, areaId: string) {
  const areas = await prisma.$queryRaw<Array<{ id: string; nombre: string; estado: string }>>`
    SELECT "id"::text,"nombre","estado"
    FROM "AreaInspeccion"
    WHERE "inspeccionId"=${inspeccionId} AND "tipo" <> 'PUNTO_CRITICO'
    ORDER BY "orden","nombre"
  `;
  const solicitadaIndex = areas.findIndex((area) => area.id === areaId);
  if (solicitadaIndex < 0) {
    redirect(`/panel/inspecciones/${inspeccionId}/campo-v1?error=${encodeURIComponent("El punto de área no pertenece a esta inspección.")}`);
  }
  const activaIndex = areas.findIndex((area) => area.estado !== "REVISADA");
  const solicitada = areas[solicitadaIndex];

  // Se permite volver a cualquier área ya cerrada y al área activa actual.
  // No se permite saltar hacia un área futura todavía bloqueada.
  if (solicitada.estado !== "REVISADA" && activaIndex >= 0 && solicitadaIndex !== activaIndex) {
    volver(
      inspeccionId,
      areas[activaIndex].id,
      "error",
      `El Punto ${9 + solicitadaIndex} todavía está bloqueado. Concluye primero el punto activo.`,
    );
  }
  return { area: solicitada, indice: solicitadaIndex };
}

async function itemArea(inspeccionId: string, areaId: string, itemId: string) {
  const [item] = await prisma.$queryRaw<Array<{
    id: string;
    areaId: string;
    areaNombre: string;
    concepto: string;
    especificacion: string | null;
    herramientaSugerida: string | null;
    observacion: string | null;
    estadoV3: string;
    origenV3: string;
    requiereMedicion: boolean;
    requiereComparacionProyecto: boolean;
    valorMedido: string | null;
    valorProyecto: string | null;
    unidadMedida: string | null;
    fotos: number;
    descripcionPrimera: string | null;
  }>>`
    SELECT g."id",g."areaId"::text AS "areaId",a."nombre" AS "areaNombre",
      g."concepto",g."especificacion",g."herramientaSugerida",g."observacion",
      g."estadoV3",g."origenV3",g."requiereMedicion",g."requiereComparacionProyecto",
      g."valorMedido",g."valorProyecto",g."unidadMedida",
      (SELECT COUNT(*)::int FROM "FotografiaArea" fa WHERE fa."guiaItemId"=g."id") AS "fotos",
      (
        SELECT f."descripcion"
        FROM "FotografiaArea" fa
        JOIN "Fotografia" f ON f."id"=fa."fotografiaId"
        WHERE fa."guiaItemId"=g."id"
        ORDER BY fa."orden"
        LIMIT 1
      ) AS "descripcionPrimera"
    FROM "GuiaInspeccionItem" g
    JOIN "AreaInspeccion" a ON a."id"=g."areaId"
    WHERE g."id"=${itemId}
      AND g."inspeccionId"=${inspeccionId}
      AND g."areaId"=${areaId}::uuid
    LIMIT 1
  `;
  if (!item) volver(inspeccionId, areaId, "error", "Concepto no encontrado.");
  return item;
}

async function recalcularIndice(inspeccionId: string) {
  const hallazgos = await prisma.hallazgo.findMany({
    where: { inspeccionId },
    select: { clasificacion: true },
  });
  const evaluables = hallazgos
    .map((hallazgo) => hallazgo.clasificacion)
    .filter((valor) => valor !== ClasificacionHallazgo.NA);
  if (!evaluables.length) {
    await prisma.inspeccion.update({
      where: { id: inspeccionId },
      data: { ish: null, semaforo: null },
    });
    return;
  }
  const pesos: Record<string, number> = { C: 100, O: 90, NC: 70, CR: 35 };
  const indice = evaluables.reduce((suma, valor) => suma + (pesos[valor] ?? 0), 0) / evaluables.length;
  const semaforo = indice >= 90 ? "VERDE" : indice >= 75 ? "AMARILLO" : indice >= 60 ? "NARANJA" : "ROJO";
  await prisma.inspeccion.update({ where: { id: inspeccionId }, data: { ish: indice, semaforo } });
}

export async function subirFotoConceptoAreaV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const areaId = texto(formData, "areaId");
  const itemId = texto(formData, "itemId");
  const archivo = formData.get("archivo");
  const origenTexto = texto(formData, "origenEvidencia").toUpperCase();
  const origenEvidencia: OrigenEvidencia = origenTexto === "GALERIA" ? "GALERIA" : "CAMARA";
  if (!inspeccionId || !areaId || !itemId) redirect("/panel/inspecciones");

  const { usuario, responsable } = await exigirResponsable(inspeccionId);
  await exigirAreaActiva(inspeccionId, areaId);
  const item = await itemArea(inspeccionId, areaId, itemId);
  if (item.estadoV3 !== "PENDIENTE") volver(inspeccionId, areaId, "error", "Este concepto ya está cerrado.", itemId);

  const fotos = await prisma.$queryRaw<Array<{ orden: number; descripcion: string | null }>>`
    SELECT fa."orden",f."descripcion"
    FROM "FotografiaArea" fa
    JOIN "Fotografia" f ON f."id"=fa."fotografiaId"
    WHERE fa."guiaItemId"=${itemId}
    ORDER BY fa."orden"
  `;
  if (fotos.length >= MAX_FOTOS_CONCEPTO) {
    volver(inspeccionId, areaId, "error", "Este concepto ya tiene el máximo de 4 fotografías.", itemId);
  }

  if (!(archivo instanceof File) || archivo.size === 0) volver(inspeccionId, areaId, "error", "Selecciona una fotografía.", itemId);
  if (!["image/jpeg","image/png","image/webp"].includes(archivo.type)) volver(inspeccionId, areaId, "error", "La evidencia debe ser JPG, PNG o WEBP.", itemId);
  if (archivo.size > 10 * 1024 * 1024) volver(inspeccionId, areaId, "error", "La imagen supera 10 MB.", itemId);

  const usados = new Set(fotos.map((foto) => Number(foto.orden)));
  const ordenFoto = Array.from({ length: MAX_FOTOS_CONCEPTO }, (_, index) => index + 1).find((orden) => !usados.has(orden));
  if (!ordenFoto) volver(inspeccionId, areaId, "error", "No hay espacio disponible para otra fotografía.", itemId);

  const extension = archivo.name.split(".").pop()?.toLowerCase() || "jpg";
  const rutaStorage = `${inspeccionId}/areas/${areaId}/conceptos/${itemId}/${randomUUID()}.${extension}`;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";
  const sb = obtenerSupabaseAdmin();
  const { error } = await sb.storage.from(bucket).upload(
    rutaStorage,
    Buffer.from(await archivo.arrayBuffer()),
    { contentType: archivo.type, upsert: false },
  );
  if (error) volver(inspeccionId, areaId, "error", "No fue posible guardar la fotografía.", itemId);

  try {
    await prisma.$transaction(async (tx) => {
      const foto = await tx.fotografia.create({
        data: {
          inspeccionId,
          hallazgoId: null,
          url: rutaStorage,
          subidaPorId: usuario.id,
          descripcion: `[ORIGEN:${origenEvidencia}] ${item.areaNombre} · ${item.concepto} · evidencia ${ordenFoto}/${MAX_FOTOS_CONCEPTO}`,
        },
      });
      await tx.$executeRaw`
        INSERT INTO "FotografiaArea"
          ("fotografiaId","areaId","guiaItemId","tipoEvidencia","orden","candidataReporte","candidataPortada","seleccionadaReporte")
        VALUES
          (${foto.id},${areaId}::uuid,${itemId},'CONCEPTO_AREA',${ordenFoto},true,false,true)
      `;
      await tx.$executeRaw`
        UPDATE "GuiaInspeccionItem"
        SET "observacion"=NULL,"actualizadoEn"=NOW()
        WHERE "id"=${itemId} AND "inspeccionId"=${inspeccionId}
      `;
    });
  } catch (registroError) {
    await sb.storage.from(bucket).remove([rutaStorage]);
    throw registroError;
  }

  await registrarAuditoria({
    tipo: TipoEvento.SUBIR_EVIDENCIA,
    entidad: "FotografiaArea",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${responsable} agregó evidencia ${ordenFoto}/${MAX_FOTOS_CONCEPTO} (${origenEvidencia}) al concepto “${item.concepto}” en ${item.areaNombre}.`,
  });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/campo-v1`);
  volver(inspeccionId, areaId, "ok", "Fotografía registrada.", itemId);
}

export async function eliminarFotoConceptoAreaV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const areaId = texto(formData, "areaId");
  const itemId = texto(formData, "itemId");
  const fotografiaId = texto(formData, "fotografiaId");
  if (!inspeccionId || !areaId || !itemId || !fotografiaId) redirect("/panel/inspecciones");

  const { usuario } = await exigirResponsable(inspeccionId);
  await exigirAreaActiva(inspeccionId, areaId);
  const item = await itemArea(inspeccionId, areaId, itemId);
  if (item.estadoV3 !== "PENDIENTE") volver(inspeccionId, areaId, "error", "El concepto ya está cerrado.", itemId);

  const [foto] = await prisma.$queryRaw<Array<{ url: string }>>`
    SELECT f."url"
    FROM "Fotografia" f
    JOIN "FotografiaArea" fa ON fa."fotografiaId"=f."id"
    WHERE f."id"=${fotografiaId}
      AND f."inspeccionId"=${inspeccionId}
      AND fa."areaId"=${areaId}::uuid
      AND fa."guiaItemId"=${itemId}
    LIMIT 1
  `;
  if (!foto) volver(inspeccionId, areaId, "error", "Fotografía no encontrada.", itemId);

  await prisma.fotografia.delete({ where: { id: fotografiaId } });
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";
  await obtenerSupabaseAdmin().storage.from(bucket).remove([foto.url]);
  await prisma.$executeRaw`
    UPDATE "GuiaInspeccionItem"
    SET "observacion"=NULL,"actualizadoEn"=NOW()
    WHERE "id"=${itemId} AND "inspeccionId"=${inspeccionId}
  `;

  await registrarAuditoria({
    tipo: TipoEvento.ELIMINAR,
    entidad: "Fotografia",
    entidadId: fotografiaId,
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `Se retiró evidencia del concepto “${item.concepto}” para permitir repetir la fotografía.`,
  });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/campo-v1`);
  volver(inspeccionId, areaId, "ok", "Fotografía retirada.", itemId);
}

export async function generarDescripcionIaConceptoAreaV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const areaId = texto(formData, "areaId");
  const itemId = texto(formData, "itemId");
  if (!inspeccionId || !areaId || !itemId) redirect("/panel/inspecciones");

  await exigirResponsable(inspeccionId);
  await exigirAreaActiva(inspeccionId, areaId);
  const item = await itemArea(inspeccionId, areaId, itemId);
  if (item.estadoV3 !== "PENDIENTE") volver(inspeccionId, areaId, "error", "El concepto ya está cerrado.", itemId);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) volver(inspeccionId, areaId, "error", "Falta GEMINI_API_KEY para generar la interpretación.", itemId);

  const fotos = await prisma.$queryRaw<Array<{ url: string; descripcion: string | null }>>`
    SELECT f."url",f."descripcion"
    FROM "FotografiaArea" fa
    JOIN "Fotografia" f ON f."id"=fa."fotografiaId"
    WHERE fa."guiaItemId"=${itemId}
    ORDER BY fa."orden",fa."creadoEn"
  `;
  if (fotos.length < MIN_FOTOS_CONCEPTO || fotos.length > MAX_FOTOS_CONCEPTO) {
    volver(
      inspeccionId,
      areaId,
      "error",
      "El análisis con IA requiere entre 1 y 4 fotografías del mismo concepto.",
      itemId,
    );
  }

  const sb = obtenerSupabaseAdmin();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";
  const partes: Array<Record<string, unknown>> = [];
  for (const foto of fotos) {
    const { data, error } = await sb.storage.from(bucket).download(foto.url);
    if (error || !data) volver(inspeccionId, areaId, "error", "No fue posible recuperar una de las fotografías.", itemId);
    const mime = data.type || "image/jpeg";
    const base64 = Buffer.from(await data.arrayBuffer()).toString("base64");
    partes.push({ inlineData: { mimeType: mime, data: base64 } });
  }

  partes.push({
    text: [
      "Actúa como asistente técnico de una inspección habitacional.",
      `Partida / área de la vivienda: ${item.areaNombre}.`,
      `Concepto específico: ${item.concepto}.`,
      `Se adjuntan ${fotos.length} fotografía(s) que constituyen un solo grupo de evidencia para este concepto.`,
      "Interpreta todas las fotografías de manera conjunta y correlacionada; no redactes conclusiones independientes por foto.",
      item.especificacion ? `Criterio de revisión: ${item.especificacion}.` : "",
      item.herramientaSugerida ? `Herramienta sugerida: ${item.herramientaSugerida}.` : "",
      "Analiza exclusivamente lo visible en las fotografías y el criterio indicado.",
      "No inventes daños ocultos, causas, cumplimiento normativo ni mediciones que no puedan comprobarse.",
      "Describe nivelación, alineación, uniformidad, funcionamiento, sellados, remates, acabado o condición únicamente cuando corresponda al concepto evaluado.",
      "Redacta una interpretación técnica breve, objetiva y útil para el expediente.",
      "Sugiere clasificación C, O, NC o CR; la decisión final siempre será del Inspector.",
      "Devuelve únicamente JSON con: descripcion, clasificacionSugerida, justificacion.",
    ].filter(Boolean).join(" "),
  });

  const modelo = process.env.GEMINI_PROYECTO_MODEL || "gemini-3.5-flash-lite";
  const respuesta = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: partes }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
      }),
      cache: "no-store",
    },
  );
  const cuerpo = (await respuesta.json().catch(() => ({}))) as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  if (!respuesta.ok) volver(inspeccionId, areaId, "error", `Gemini no pudo analizar las fotografías: ${cuerpo.error?.message || "error no identificado"}`, itemId);
  const salida = cuerpo.candidates?.[0]?.content?.parts?.map((parte) => parte.text || "").join("").trim();
  if (!salida) volver(inspeccionId, areaId, "error", "Gemini no devolvió una interpretación.", itemId);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(salida);
  } catch {
    volver(inspeccionId, areaId, "error", "Gemini devolvió una respuesta que no pudo estructurarse.", itemId);
  }

  const descripcionIa = String(parsed.descripcion ?? "").trim();
  const sugerida = String(parsed.clasificacionSugerida ?? "").trim().toUpperCase();
  const justificacionIa = String(parsed.justificacion ?? "").trim();
  if (!descripcionIa) volver(inspeccionId, areaId, "error", "Gemini no generó una interpretación técnica válida.", itemId);

  const anterior = observacionObjeto(item.observacion);
  const observacion: ObservacionConcepto = {
    ...anterior,
    descripcionIa,
    descripcionFinal: descripcionIa,
    clasificacionSugerida: ["C","O","NC","CR"].includes(sugerida) ? sugerida : "O",
    justificacionIa,
    actualizadoEn: new Date().toISOString(),
  };
  await prisma.$executeRaw`
    UPDATE "GuiaInspeccionItem"
    SET "observacion"=${JSON.stringify(observacion)},"actualizadoEn"=NOW()
    WHERE "id"=${itemId} AND "inspeccionId"=${inspeccionId}
  `;
  revalidatePath(`/panel/inspecciones/${inspeccionId}/campo-v1`);
  volver(inspeccionId, areaId, "ok", "Interpretación IA generada. Revísala antes de cerrar el concepto.", itemId);
}

export async function guardarResultadoConceptoAreaV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const areaId = texto(formData, "areaId");
  const itemId = texto(formData, "itemId");
  const descripcionFinal = texto(formData, "descripcionFinal");
  const clasificacionTexto = texto(formData, "clasificacion").toUpperCase();
  const prioridadTexto = texto(formData, "prioridad").toUpperCase();
  const valorMedido = texto(formData, "valorMedido");
  const valorProyecto = texto(formData, "valorProyecto");
  const unidadMedida = texto(formData, "unidadMedida");
  if (!inspeccionId || !areaId || !itemId) redirect("/panel/inspecciones");

  const { usuario, responsable } = await exigirResponsable(inspeccionId);
  await exigirAreaActiva(inspeccionId, areaId);
  const item = await itemArea(inspeccionId, areaId, itemId);
  if (item.estadoV3 !== "PENDIENTE") volver(inspeccionId, areaId, "error", "El concepto ya está cerrado.", itemId);
  if (!["C","O","NC","CR"].includes(clasificacionTexto)) volver(inspeccionId, areaId, "error", "Selecciona una clasificación válida.", itemId);
  if (clasificacionTexto !== "C" && !["P1","P2","P3","P4","P5"].includes(prioridadTexto)) volver(inspeccionId, areaId, "error", "Selecciona una prioridad válida para el hallazgo.", itemId);
  if (descripcionFinal.length < 10) volver(inspeccionId, areaId, "error", "Registra una interpretación técnica de al menos 10 caracteres.", itemId);

  if (Number(item.fotos) < MIN_FOTOS_CONCEPTO || Number(item.fotos) > MAX_FOTOS_CONCEPTO) {
    volver(inspeccionId, areaId, "error", `${item.concepto} requiere entre 1 y 4 fotografías antes de cerrarse.`, itemId);
  }
  if (item.requiereMedicion && !valorMedido) volver(inspeccionId, areaId, "error", `${item.concepto} requiere registrar el valor medido.`, itemId);
  if (item.requiereMedicion && !unidadMedida) volver(inspeccionId, areaId, "error", `${item.concepto} requiere indicar la unidad de medición.`, itemId);
  if (item.requiereComparacionProyecto && item.origenV3 === "PROYECTO" && !valorProyecto) {
    volver(inspeccionId, areaId, "error", `${item.concepto} requiere registrar el valor de proyecto para la comparación.`, itemId);
  }

  const anterior = observacionObjeto(item.observacion);
  const rutasEvidencia = await prisma.$queryRaw<Array<{ url:string }>>`
    SELECT f."url"
    FROM "FotografiaArea" fa
    JOIN "Fotografia" f ON f."id"=fa."fotografiaId"
    WHERE fa."guiaItemId"=${itemId}
    ORDER BY fa."orden",fa."creadoEn"
  `;
  let calificacionFinal = 100;
  let justificacionCalificacionIa = "Sin hallazgo: SH = 100.";
  if (clasificacionTexto !== "C") {
    try {
      const evaluacionIa = await calificarPuntoConIaV1({
        prioridad: prioridadTexto as PrioridadHallazgo,
        partida: item.areaNombre,
        concepto: item.concepto,
        descripcionFinal,
        especificacion: item.especificacion,
        valorMedido: valorMedido || null,
        valorProyecto: valorProyecto || null,
        unidadMedida: unidadMedida || null,
        rutasEvidencia: rutasEvidencia.map((foto)=>foto.url),
      });
      calificacionFinal = evaluacionIa.calificacion;
      justificacionCalificacionIa = evaluacionIa.justificacion;
    } catch (error) {
      volver(inspeccionId, areaId, "error", error instanceof Error ? error.message : "No fue posible calcular la evaluación con IA.", itemId);
    }
  }
  if (!anterior.descripcionIa && !anterior.descripcionFinal) {
    volver(inspeccionId, areaId, "error", "Primero genera la interpretación de IA para este grupo de evidencias.", itemId);
  }
  // Al cierre se conserva una sola descripción: la versión final confirmada por el Inspector.
  const observacion: ObservacionConcepto = {
    descripcionFinal,
    clasificacionFinal: clasificacionTexto,
    prioridadFinal: clasificacionTexto === "C" ? undefined : prioridadTexto,
    calificacionFinal,
    justificacionCalificacionIa,
    prioridadEvaluadaIa: clasificacionTexto === "C" ? "SH" : prioridadTexto,
    actualizadoEn: new Date().toISOString(),
  };
  const clasificacion = clasificacionTexto as ClasificacionHallazgo;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "GuiaInspeccionItem"
      SET "observacion"=${JSON.stringify(observacion)},
          "estadoV3"='REVISADO',
          "valorMedido"=${valorMedido || null},
          "valorProyecto"=${valorProyecto || null},
          "unidadMedida"=${unidadMedida || null},
          "completado"=true,
          "cerradoEn"=NOW(),
          "actualizadoEn"=NOW()
      WHERE "id"=${itemId} AND "inspeccionId"=${inspeccionId}
    `;

    if (
      clasificacion === ClasificacionHallazgo.O ||
      clasificacion === ClasificacionHallazgo.NC ||
      clasificacion === ClasificacionHallazgo.CR
    ) {
      const existente = await tx.hallazgo.findFirst({
        where: { inspeccionId, guiaItemId: itemId },
        select: { id: true },
      });
      const hallazgo = existente
        ? await tx.hallazgo.update({
            where: { id: existente.id },
            data: {
              area: item.areaNombre,
              areaId,
              titulo: `${item.areaNombre} · ${item.concepto}`,
              descripcion: descripcionFinal,
              clasificacion,
              prioridad: prioridadTexto as PrioridadHallazgo,
              textoIaOriginal: null,
              textoInspectorFinal: null,
            },
          })
        : await tx.hallazgo.create({
            data: {
              inspeccionId,
              creadoPorId: usuario.id,
              area: item.areaNombre,
              areaId,
              titulo: `${item.areaNombre} · ${item.concepto}`,
              descripcion: descripcionFinal,
              clasificacion,
              prioridad: prioridadTexto as PrioridadHallazgo,
              guiaItemId: itemId,
              textoIaOriginal: null,
              textoInspectorFinal: null,
            },
          });

      await tx.$executeRaw`
        UPDATE "Fotografia"
        SET "hallazgoId"=${hallazgo.id}
        WHERE "id" IN (
          SELECT fa."fotografiaId"
          FROM "FotografiaArea" fa
          WHERE fa."guiaItemId"=${itemId}
        )
      `;
    } else {
      const existente = await tx.hallazgo.findFirst({
        where: { inspeccionId, guiaItemId: itemId },
        select: { id: true },
      });
      if (existente) {
        await tx.fotografia.updateMany({
          where: { hallazgoId: existente.id },
          data: { hallazgoId: null },
        });
        await tx.hallazgo.delete({ where: { id: existente.id } });
      }
    }
  });

  const [estadoArea] = await prisma.$queryRaw<Array<{ pendientes:number; hallazgos:number }>>`
    SELECT
      (SELECT COUNT(*)::int
       FROM "GuiaInspeccionItem" g
       WHERE g."areaId"=${areaId}::uuid
         AND g."estadoV3" NOT IN ('REVISADO','CON_HALLAZGO','NO_APLICA')) AS "pendientes",
      (SELECT COUNT(*)::int
       FROM "Hallazgo" h
       WHERE h."inspeccionId"=${inspeccionId}
         AND h."areaId"=${areaId}::uuid) AS "hallazgos"
  `;

  if (Number(estadoArea?.pendientes ?? 1) === 0) {
    const hallazgosArea = Number(estadoArea?.hallazgos ?? 0);
    const resultadoArea = hallazgosArea > 0 ? "CON_HALLAZGOS" : "SIN_HALLAZGOS";
    const comentarioArea = hallazgosArea > 0
      ? `Se registraron ${hallazgosArea} hallazgo(s) en ${item.areaNombre}. Los puntos aplicables fueron revisados y los hallazgos cuentan con la evidencia mínima requerida para su documentación.`
      : `Se realizó la inspección de ${item.areaNombre} conforme al plan establecido. Todos los puntos aplicables quedaron resueltos y no se identificaron hallazgos que impidan el cierre de la partida.`;
    await prisma.$executeRaw`
      UPDATE "AreaInspeccion"
      SET "estado"='REVISADA',
          "resultado"=${resultadoArea},
          "comentarioFinal"=COALESCE(NULLIF(BTRIM("comentarioFinal"),''),${comentarioArea}),
          "textoSinHallazgo"=CASE
            WHEN ${resultadoArea}='SIN_HALLAZGOS'
            THEN COALESCE(NULLIF(BTRIM("textoSinHallazgo"),''),${comentarioArea})
            ELSE "textoSinHallazgo"
          END,
          "revisadaEn"=COALESCE("revisadaEn",NOW()),
          "cerradaEn"=COALESCE("cerradaEn",NOW()),
          "cerradaPorId"=COALESCE("cerradaPorId",${usuario.id}),
          "actualizadoEn"=NOW()
      WHERE "id"=${areaId}::uuid
        AND "inspeccionId"=${inspeccionId}
        AND "estado" <> 'REVISADA'
    `;
  }

  await recalcularIndice(inspeccionId);
  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "GuiaInspeccionItem",
    entidadId: itemId,
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${responsable} cerró “${item.concepto}” en ${item.areaNombre} con clasificación ${clasificacionTexto}, evaluación ${calificacionFinal}/100${clasificacionTexto === "C" ? "" : `, prioridad ${prioridadTexto}`} y ${item.fotos} evidencia(s). Se conservó una sola descripción final.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/campo-v1`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/captura`);
  volver(inspeccionId, areaId, "ok", "Concepto cerrado y clasificado.", itemId);
}

export async function reabrirConceptoAreaV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const areaId = texto(formData, "areaId");
  const itemId = texto(formData, "itemId");
  if (!inspeccionId || !areaId || !itemId) redirect("/panel/inspecciones");

  const { usuario, responsable } = await exigirResponsable(inspeccionId);
  await exigirAreaEditable(inspeccionId, areaId);
  const item = await itemArea(inspeccionId, areaId, itemId);
  if (item.estadoV3 !== "REVISADO") {
    volver(inspeccionId, areaId, "error", "Sólo un concepto ya cerrado puede abrirse para edición.", itemId);
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "GuiaInspeccionItem"
      SET "estadoV3"='PENDIENTE',"completado"=false,"cerradoEn"=NULL,"actualizadoEn"=NOW()
      WHERE "id"=${itemId} AND "inspeccionId"=${inspeccionId}
    `;
    await tx.$executeRaw`
      UPDATE "AreaInspeccion"
      SET "estado"='PENDIENTE',"resultado"=NULL,"cerradaEn"=NULL,"revisadaEn"=NULL,
          "comentarioFinal"=NULL,"actualizadoEn"=NOW()
      WHERE "id"=${areaId}::uuid AND "inspeccionId"=${inspeccionId}
    `;
    await tx.$executeRaw`
      UPDATE "InspeccionControlV2"
      SET "preReporteGeneradoEn"=NULL,
          "revisionInspectorFinalEn"=NULL,
          "revisionInspectorFinalPorId"=NULL,
          "actualizadoEn"=NOW()
      WHERE "inspeccionId"=${inspeccionId}
        AND EXISTS (
          SELECT 1 FROM "Inspeccion" i
          WHERE i."id"=${inspeccionId} AND i."estado"='EN_PROCESO'
        )
    `;
  });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "GuiaInspeccionItem",
    entidadId: itemId,
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${responsable} reabrió el concepto “${item.concepto}” de ${item.areaNombre} para editarlo. El área volvió a quedar activa hasta su nuevo cierre.`,
  });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/campo-v1`);
  volver(inspeccionId, areaId, "ok", "Concepto abierto para edición. Revisa evidencia, IA y descripción final antes de volver a cerrarlo.", itemId);
}

export async function reactivarConceptoAreaV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const areaId = texto(formData, "areaId");
  const itemId = texto(formData, "itemId");
  if (!inspeccionId || !areaId || !itemId) redirect("/panel/inspecciones");

  const { usuario, responsable } = await exigirResponsable(inspeccionId);
  await exigirAreaEditable(inspeccionId, areaId);
  const item = await itemArea(inspeccionId, areaId, itemId);
  if (item.estadoV3 !== "NO_APLICA") volver(inspeccionId, areaId, "error", "Sólo un concepto marcado NO APLICA puede reactivarse.", itemId);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "GuiaInspeccionItem"
      SET "estadoV3"='PENDIENTE',"motivoNoAplica"=NULL,"completado"=false,"cerradoEn"=NULL,"actualizadoEn"=NOW()
      WHERE "id"=${itemId} AND "inspeccionId"=${inspeccionId}
    `;
    await tx.$executeRaw`
      UPDATE "AreaInspeccion"
      SET "estado"='PENDIENTE',"resultado"=NULL,"cerradaEn"=NULL,"revisadaEn"=NULL,
          "comentarioFinal"=NULL,"actualizadoEn"=NOW()
      WHERE "id"=${areaId}::uuid AND "inspeccionId"=${inspeccionId}
    `;
    await tx.$executeRaw`
      UPDATE "InspeccionControlV2"
      SET "preReporteGeneradoEn"=NULL,
          "revisionInspectorFinalEn"=NULL,
          "revisionInspectorFinalPorId"=NULL,
          "actualizadoEn"=NOW()
      WHERE "inspeccionId"=${inspeccionId}
        AND EXISTS (
          SELECT 1 FROM "Inspeccion" i
          WHERE i."id"=${inspeccionId} AND i."estado"='EN_PROCESO'
        )
    `;
  });
  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "GuiaInspeccionItem",
    entidadId: itemId,
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${responsable} reactivó el concepto “${item.concepto}” en ${item.areaNombre}.`,
  });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/campo-v1`);
  volver(inspeccionId, areaId, "ok", "Concepto reactivado.", itemId);
}
