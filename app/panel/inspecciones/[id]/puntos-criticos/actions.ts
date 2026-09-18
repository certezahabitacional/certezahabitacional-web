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
import {
  HERRAMIENTAS_INSPECCION,
  obtenerHerramientasCotizadasDesdeCotizacion,
  type CodigoHerramienta,
} from "@/lib/herramientas-inspeccion";
import {
  PUNTOS_CRITICOS_V1,
  plantillaAplicablePuntoCritico,
  proyectoDisponibleParaPuntoCritico,
  tienePruebaProlongadaCotizada,
  type CodigoPuntoCriticoV1,
} from "@/lib/puntos-criticos-v1";
import { prisma } from "@/lib/prisma";
import { obtenerSupabaseAdmin } from "@/lib/supabase-admin";

const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? "").trim();
const CODIGOS = new Set(PUNTOS_CRITICOS_V1.map((p) => p.codigo));

type DatosPasoCritico = {
  configurado?: boolean;
  aplica?: boolean | null;
  fuente?: "PROYECTO" | "PLANTILLA" | null;
  proyectoDisponible?: boolean;
  pruebaProlongada?: boolean;
  herramientas?: CodigoHerramienta[];
};

type ObservacionItemCritico = {
  descripcionIa?: string;
  clasificacionSugerida?: string;
  justificacionIa?: string;
  descripcionFinal?: string;
  clasificacionFinal?: string;
  actualizadoEn?: string;
};

function esCodigo(valor: string): valor is CodigoPuntoCriticoV1 {
  return CODIGOS.has(valor as CodigoPuntoCriticoV1);
}

function datosObjeto(valor: unknown): DatosPasoCritico {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as DatosPasoCritico)
    : {};
}

function observacionObjeto(valor: string | null): ObservacionItemCritico {
  if (!valor) return {};
  try {
    const parsed = JSON.parse(valor);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as ObservacionItemCritico)
      : {};
  } catch {
    return { descripcionFinal: valor };
  }
}

function ruta(id: string, punto?: string, tipo?: "ok" | "error", mensaje?: string) {
  const params = new URLSearchParams();
  if (punto) params.set("punto", punto);
  if (tipo && mensaje) params.set(tipo, mensaje);
  const query = params.toString();
  return `/panel/inspecciones/${id}/puntos-criticos${query ? `?${query}` : ""}`;
}

function volver(id: string, punto: string | undefined, tipo: "ok" | "error", mensaje: string): never {
  redirect(ruta(id, punto, tipo, mensaje));
}

function puntoPorCodigo(codigo: CodigoPuntoCriticoV1) {
  const punto = PUNTOS_CRITICOS_V1.find((item) => item.codigo === codigo);
  if (!punto) throw new Error("Punto crítico no reconocido.");
  return punto;
}

function siguienteCodigo(codigo: CodigoPuntoCriticoV1) {
  const indice = PUNTOS_CRITICOS_V1.findIndex((item) => item.codigo === codigo);
  return PUNTOS_CRITICOS_V1[indice + 1]?.codigo ?? null;
}

async function exigirResponsable(inspeccionId: string) {
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
        numeroInspeccion: true,
        inspectorId: true,
        cotizacionId: true,
        cotizacion: { select: { observacionesInternas: true } },
      },
    }),
  ]);

  if (!usuario?.activo || !inspeccion) redirect("/acceso");
  const inspectorAsignado =
    usuario.rol === RolUsuario.INSPECTOR &&
    Boolean(usuario.inspector?.activo) &&
    inspeccion.inspectorId === usuario.inspector?.id;
  const director = usuario.rol === RolUsuario.DIRECTOR;
  if (!inspectorAsignado && !director) redirect("/acceso");
  if (inspeccion.numeroInspeccion !== 1) volver(inspeccionId, undefined, "error", "Los puntos críticos corresponden a la inspección V1.");
  if (inspeccion.estado !== EstadoInspeccion.EN_PROCESO) volver(inspeccionId, undefined, "error", "Los puntos críticos sólo pueden capturarse mientras la inspección está EN PROCESO.");

  return {
    session,
    usuario,
    inspeccion,
    responsable: director ? "Dirección" : "Inspector",
  };
}

async function herramientasDeCotizacion(inspeccionId: string) {
  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: { cotizacion: { select: { observacionesInternas: true } } },
  });
  return obtenerHerramientasCotizadasDesdeCotizacion(inspeccion?.cotizacion?.observacionesInternas);
}

async function verificarSecuencia(inspeccionId: string, codigo: CodigoPuntoCriticoV1) {
  const indice = PUNTOS_CRITICOS_V1.findIndex((item) => item.codigo === codigo);
  const anteriores = PUNTOS_CRITICOS_V1.slice(0, indice).map((item) => `PC_${item.codigo}`);
  if (!anteriores.length) return;

  const pasos = await prisma.$queryRaw<Array<{ clave: string; estado: string; datos: unknown }>>`
    SELECT "clave","estado","datos" FROM "ProtocoloInspeccionPaso"
    WHERE "inspeccionId"=${inspeccionId} AND "clave"=ANY(${anteriores}::text[])
    ORDER BY "orden"
  `;

  for (const paso of pasos) {
    if (paso.estado === "COMPLETADO" || paso.estado === "NO_APLICA") continue;
    const datos = datosObjeto(paso.datos);
    if (paso.estado === "EN_PROCESO" && datos.pruebaProlongada) {
      const [inicio] = await prisma.$queryRaw<Array<{ total: number }>>`
        SELECT COUNT(*)::int AS "total"
        FROM "GuiaInspeccionItem"
        WHERE "inspeccionId"=${inspeccionId}
          AND "area"=concat('__PUNTO_CRITICO__:',replace(${paso.clave},'PC_',''))
          AND "concepto" ILIKE '%manómetro%'
          AND "estadoV3" <> 'PENDIENTE'
      `;
      if (Number(inicio?.total ?? 0) > 0) continue;
    }
    throw new Error("Debes cerrar al 100% el punto crítico anterior antes de continuar.");
  }
}

async function asegurarPasos(inspeccionId: string, usuarioId: string) {
  const herramientas = await herramientasDeCotizacion(inspeccionId);
  const documentos = await prisma.$queryRaw<Array<{ tipo: string; datosExtraidos: unknown }>>`
    SELECT "tipo","datosExtraidos" FROM "DocumentoProyectoInspeccion"
    WHERE "inspeccionId"=${inspeccionId} AND "estadoAnalisis"='COMPLETADO'
  `;

  let orden = 100;
  for (const punto of PUNTOS_CRITICOS_V1) {
    const proyectoDisponible = proyectoDisponibleParaPuntoCritico(punto, documentos);
    const pruebaProlongada = tienePruebaProlongadaCotizada(punto, herramientas);
    const datos: DatosPasoCritico = {
      configurado: false,
      aplica: null,
      fuente: proyectoDisponible ? "PROYECTO" : "PLANTILLA",
      proyectoDisponible,
      pruebaProlongada,
      herramientas,
    };
    await prisma.$executeRaw`
      INSERT INTO "ProtocoloInspeccionPaso"
        ("inspeccionId","clave","nombre","tipo","orden","obligatorio","estado","datos","actualizadoEn")
      VALUES
        (${inspeccionId},${`PC_${punto.codigo}`},${punto.etiqueta},'PUNTO_CRITICO',${orden},true,'PENDIENTE',${JSON.stringify(datos)}::jsonb,NOW())
      ON CONFLICT ("inspeccionId","clave") DO NOTHING
    `;
    orden += 10;
  }

  await registrarAuditoria({
    tipo: TipoEvento.CREAR,
    entidad: "ProtocoloInspeccionPaso",
    inspeccionId,
    usuarioId,
    descripcion: "Se inicializó la secuencia de 7 puntos críticos V1 desde Proyecto/Plantilla y el punto 4 de la cotización.",
  });
}

export async function iniciarPuntosCriticosV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  if (!inspeccionId) redirect("/panel/inspecciones");
  const { usuario } = await exigirResponsable(inspeccionId);

  const [control] = await prisma.$queryRaw<Array<{ proyectoConfirmado: boolean }>>`
    SELECT "proyectoConfirmado" FROM "InspeccionControlV2"
    WHERE "inspeccionId"=${inspeccionId} LIMIT 1
  `;
  if (!control?.proyectoConfirmado) volver(inspeccionId, undefined, "error", "Primero confirma Proyecto/Plantilla.");

  await asegurarPasos(inspeccionId, usuario.id);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos`);
  redirect(ruta(inspeccionId, "HIDRAULICA"));
}

export async function configurarPuntoCriticoV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const codigoTexto = texto(formData, "codigo");
  const aplicaTexto = texto(formData, "aplica");
  const fuenteTexto = texto(formData, "fuente");
  if (!inspeccionId || !esCodigo(codigoTexto)) redirect("/panel/inspecciones");
  const codigo = codigoTexto;
  const { usuario, responsable } = await exigirResponsable(inspeccionId);

  try {
    await verificarSecuencia(inspeccionId, codigo);
  } catch (error) {
    volver(inspeccionId, codigo, "error", error instanceof Error ? error.message : "No puedes continuar todavía.");
  }

  if (!["SI", "NO"].includes(aplicaTexto)) volver(inspeccionId, codigo, "error", "Selecciona SI APLICA o NO APLICA.");
  if (!["PROYECTO", "PLANTILLA"].includes(fuenteTexto)) volver(inspeccionId, codigo, "error", "Selecciona PROYECTO o PLANTILLA PRECARGADA.");

  const punto = puntoPorCodigo(codigo);
  const herramientas = await herramientasDeCotizacion(inspeccionId);
  const documentos = await prisma.$queryRaw<Array<{ tipo: string; datosExtraidos: unknown }>>`
    SELECT "tipo","datosExtraidos" FROM "DocumentoProyectoInspeccion"
    WHERE "inspeccionId"=${inspeccionId} AND "estadoAnalisis"='COMPLETADO'
  `;
  const proyectoDisponible = proyectoDisponibleParaPuntoCritico(punto, documentos);
  if (fuenteTexto === "PROYECTO" && !proyectoDisponible) {
    volver(inspeccionId, codigo, "error", "No se detectó información de proyecto para este punto crítico. Usa la plantilla precargada.");
  }

  const pruebaProlongada = tienePruebaProlongadaCotizada(punto, herramientas);
  const datos: DatosPasoCritico = {
    configurado: true,
    aplica: aplicaTexto === "SI",
    fuente: fuenteTexto as "PROYECTO" | "PLANTILLA",
    proyectoDisponible,
    pruebaProlongada,
    herramientas,
  };

  if (aplicaTexto === "NO") {
    await prisma.$executeRaw`
      UPDATE "ProtocoloInspeccionPaso"
      SET "estado"='NO_APLICA',"datos"=${JSON.stringify(datos)}::jsonb,
          "comentario"='Declarado NO APLICA',"completadoEn"=NOW(),"actualizadoEn"=NOW()
      WHERE "inspeccionId"=${inspeccionId} AND "clave"=${`PC_${codigo}`}
    `;
    await registrarAuditoria({
      tipo: TipoEvento.EDITAR,
      entidad: "ProtocoloInspeccionPaso",
      inspeccionId,
      usuarioId: usuario.id,
      descripcion: `${responsable} declaró ${punto.etiqueta} como NO APLICA.`,
    });
    const siguiente = siguienteCodigo(codigo);
    revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos`);
    if (siguiente) redirect(ruta(inspeccionId, siguiente, "ok", `${punto.etiqueta} quedó NO APLICA.`));
    redirect(ruta(inspeccionId, codigo, "ok", "Secuencia de puntos críticos terminada."));
  }

  const plantilla = plantillaAplicablePuntoCritico(punto, herramientas);
  const areaCodigo = `PC_${codigo}`;
  const areaMarcador = `__PUNTO_CRITICO__:${codigo}`;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "AreaInspeccion"
        ("inspeccionId","codigo","nombre","tipo","orden","origen","obligatoria","estado")
      VALUES
        (${inspeccionId},${areaCodigo},${punto.etiqueta},'PUNTO_CRITICO',
         ${900 + PUNTOS_CRITICOS_V1.findIndex((item) => item.codigo === codigo) * 10},
         ${fuenteTexto},false,'PENDIENTE')
      ON CONFLICT ("inspeccionId","codigo") DO UPDATE
      SET "origen"=EXCLUDED."origen","actualizadoEn"=NOW()
    `;
    const [area] = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"::text FROM "AreaInspeccion"
      WHERE "inspeccionId"=${inspeccionId} AND "codigo"=${areaCodigo}
      LIMIT 1
    `;
    if (!area) throw new Error("No fue posible preparar el punto crítico.");

    let orden = 10;
    for (const item of plantilla) {
      await tx.$executeRaw`
        INSERT INTO "GuiaInspeccionItem"
          ("id","inspeccionId","origen","tipoProyecto","area","concepto","especificacion",
           "orden","obligatorio","completado","creadoPorId","areaId","estadoV3","origenV3",
           "requiereMedicion","requiereComparacionProyecto","herramientaSugerida","creadoEn","actualizadoEn")
        SELECT
          ${randomUUID()},${inspeccionId},'PUNTO_CRITICO',${codigo},${areaMarcador},
          ${item.nombre},${item.descripcion},${orden},true,false,${usuario.id},
          ${area.id}::uuid,'PENDIENTE',${fuenteTexto},${item.requiereMedicion},
          ${item.requiereComparacionProyecto},${item.herramientaSugerida},NOW(),NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM "GuiaInspeccionItem"
          WHERE "inspeccionId"=${inspeccionId} AND "area"=${areaMarcador} AND "concepto"=${item.nombre}
        )
      `;
      orden += 10;
    }

    await tx.$executeRaw`
      UPDATE "ProtocoloInspeccionPaso"
      SET "estado"='EN_PROCESO',"datos"=${JSON.stringify(datos)}::jsonb,
          "iniciadoEn"=COALESCE("iniciadoEn",NOW()),"actualizadoEn"=NOW()
      WHERE "inspeccionId"=${inspeccionId} AND "clave"=${`PC_${codigo}`}
    `;
  });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "ProtocoloInspeccionPaso",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${responsable} inició ${punto.etiqueta} con fuente ${fuenteTexto} y ${plantilla.length} concepto(s) aplicables al equipo cotizado.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos`);
  volver(inspeccionId, codigo, "ok", `${punto.etiqueta} lista para inspección.`);
}

export async function subirFotoPuntoCriticoV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const codigoTexto = texto(formData, "codigo");
  const itemId = texto(formData, "itemId");
  const archivo = formData.get("archivo");
  if (!inspeccionId || !esCodigo(codigoTexto) || !itemId) redirect("/panel/inspecciones");
  const codigo = codigoTexto;
  const { session, usuario, responsable } = await exigirResponsable(inspeccionId);

  const [item] = await prisma.$queryRaw<Array<{ id: string; areaId: string; concepto: string; fotos: number }>>`
    SELECT g."id",g."areaId"::text,g."concepto",
      (SELECT COUNT(*)::int FROM "FotografiaArea" fa WHERE fa."guiaItemId"=g."id") AS "fotos"
    FROM "GuiaInspeccionItem" g
    WHERE g."id"=${itemId} AND g."inspeccionId"=${inspeccionId}
      AND g."area"=${`__PUNTO_CRITICO__:${codigo}`}
    LIMIT 1
  `;
  if (!item?.areaId) volver(inspeccionId, codigo, "error", "El concepto no pertenece a este punto crítico.");
  if (Number(item.fotos) >= 4) volver(inspeccionId, codigo, "error", "Este concepto ya tiene sus 4 fotografías. Elimina una si necesitas repetirla.");
  if (!(archivo instanceof File) || archivo.size === 0) volver(inspeccionId, codigo, "error", "Selecciona una fotografía.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) volver(inspeccionId, codigo, "error", "La evidencia debe ser JPG, PNG o WEBP.");
  if (archivo.size > 10 * 1024 * 1024) volver(inspeccionId, codigo, "error", "La imagen supera 10 MB.");

  const extension = archivo.name.split(".").pop()?.toLowerCase() || "jpg";
  const rutaStorage = `${inspeccionId}/puntos-criticos/${codigo}/${itemId}/${randomUUID()}.${extension}`;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";
  const sb = obtenerSupabaseAdmin();
  const { error } = await sb.storage.from(bucket).upload(
    rutaStorage,
    Buffer.from(await archivo.arrayBuffer()),
    { contentType: archivo.type, upsert: false },
  );
  if (error) volver(inspeccionId, codigo, "error", "No fue posible guardar la fotografía.");

  try {
    await prisma.$transaction(async (tx) => {
      const foto = await tx.fotografia.create({
        data: {
          inspeccionId,
          hallazgoId: null,
          url: rutaStorage,
          subidaPorId: session.user.id,
          descripcion: `${puntoPorCodigo(codigo).etiqueta} · ${item.concepto} · foto ${Number(item.fotos) + 1}/4`,
        },
      });
      await tx.$executeRaw`
        INSERT INTO "FotografiaArea"
          ("fotografiaId","areaId","guiaItemId","tipoEvidencia","orden","candidataReporte","candidataPortada","seleccionadaReporte")
        VALUES
          (${foto.id},${item.areaId}::uuid,${itemId},'PUNTO_CRITICO',${Number(item.fotos) + 1},true,false,true)
      `;
    });
  } catch (errorRegistro) {
    await sb.storage.from(bucket).remove([rutaStorage]);
    throw errorRegistro;
  }

  await registrarAuditoria({
    tipo: TipoEvento.SUBIR_EVIDENCIA,
    entidad: "FotografiaArea",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${responsable} agregó evidencia ${Number(item.fotos) + 1}/4 a ${item.concepto} en ${puntoPorCodigo(codigo).etiqueta}.`,
  });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos`);
  volver(inspeccionId, codigo, "ok", "Fotografía registrada.");
}

export async function eliminarFotoPuntoCriticoV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const codigoTexto = texto(formData, "codigo");
  const fotografiaId = texto(formData, "fotografiaId");
  if (!inspeccionId || !esCodigo(codigoTexto) || !fotografiaId) redirect("/panel/inspecciones");
  const codigo = codigoTexto;
  const { usuario } = await exigirResponsable(inspeccionId);

  const [foto] = await prisma.$queryRaw<Array<{ url: string }>>`
    SELECT f."url" FROM "Fotografia" f
    JOIN "FotografiaArea" fa ON fa."fotografiaId"=f."id"
    JOIN "GuiaInspeccionItem" g ON g."id"=fa."guiaItemId"
    WHERE f."id"=${fotografiaId} AND f."inspeccionId"=${inspeccionId}
      AND g."area"=${`__PUNTO_CRITICO__:${codigo}`}
    LIMIT 1
  `;
  if (!foto) volver(inspeccionId, codigo, "error", "Fotografía no encontrada.");

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";
  const sb = obtenerSupabaseAdmin();
  const { error } = await sb.storage.from(bucket).remove([foto.url]);
  if (error) volver(inspeccionId, codigo, "error", "No fue posible eliminar el archivo.");
  await prisma.fotografia.delete({ where: { id: fotografiaId } });
  await registrarAuditoria({
    tipo: TipoEvento.ELIMINAR,
    entidad: "Fotografia",
    entidadId: fotografiaId,
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: "Se retiró una evidencia de punto crítico para permitir repetir la fotografía.",
  });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos`);
  volver(inspeccionId, codigo, "ok", "Fotografía retirada. Ya puedes repetirla.");
}

export async function generarDescripcionIaPuntoCriticoV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const codigoTexto = texto(formData, "codigo");
  const itemId = texto(formData, "itemId");
  if (!inspeccionId || !esCodigo(codigoTexto) || !itemId) redirect("/panel/inspecciones");
  const codigo = codigoTexto;
  await exigirResponsable(inspeccionId);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) volver(inspeccionId, codigo, "error", "Falta GEMINI_API_KEY para generar la descripción.");

  const [item] = await prisma.$queryRaw<Array<{
    concepto: string;
    especificacion: string | null;
    herramientaSugerida: string | null;
    observacion: string | null;
  }>>`
    SELECT "concepto","especificacion","herramientaSugerida","observacion"
    FROM "GuiaInspeccionItem"
    WHERE "id"=${itemId} AND "inspeccionId"=${inspeccionId}
      AND "area"=${`__PUNTO_CRITICO__:${codigo}`}
    LIMIT 1
  `;
  if (!item) volver(inspeccionId, codigo, "error", "Concepto no encontrado.");

  const fotos = await prisma.$queryRaw<Array<{ url: string }>>`
    SELECT f."url" FROM "FotografiaArea" fa
    JOIN "Fotografia" f ON f."id"=fa."fotografiaId"
    WHERE fa."guiaItemId"=${itemId}
    ORDER BY fa."orden",fa."creadoEn"
  `;
  if (fotos.length !== 4) volver(inspeccionId, codigo, "error", "Completa exactamente las 4 fotografías antes de generar la descripción con IA.");

  const sb = obtenerSupabaseAdmin();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";
  const partes: Array<Record<string, unknown>> = [];
  for (const foto of fotos) {
    const { data, error } = await sb.storage.from(bucket).download(foto.url);
    if (error || !data) volver(inspeccionId, codigo, "error", "No fue posible recuperar una de las fotografías.");
    const mime = data.type || "image/jpeg";
    const base64 = Buffer.from(await data.arrayBuffer()).toString("base64");
    partes.push({ inlineData: { mimeType: mime, data: base64 } });
  }

  partes.push({
    text: [
      "Actúa como asistente técnico de una inspección habitacional.",
      `Punto crítico: ${puntoPorCodigo(codigo).etiqueta}.`,
      `Concepto: ${item.concepto}.`,
      item.especificacion ? `Criterio de revisión: ${item.especificacion}.` : "",
      item.herramientaSugerida ? `Herramienta asociada: ${item.herramientaSugerida}.` : "",
      "Analiza exclusivamente lo visible en las cuatro fotografías. No inventes causas ocultas ni cumplimiento normativo que no pueda comprobarse.",
      "Redacta una descripción técnica breve, objetiva y útil para expediente.",
      "Sugiere una clasificación C, O, NC, CR o NA; la decisión final siempre será del Inspector.",
      "Devuelve únicamente JSON con: descripcion, clasificacionSugerida, justificacion."
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
  const cuerpo = await respuesta.json().catch(() => ({})) as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  if (!respuesta.ok) volver(inspeccionId, codigo, "error", `Gemini no pudo analizar las fotografías: ${cuerpo.error?.message || "error no identificado"}`);
  const salida = cuerpo.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim();
  if (!salida) volver(inspeccionId, codigo, "error", "Gemini no devolvió una descripción.");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(salida);
  } catch {
    volver(inspeccionId, codigo, "error", "Gemini devolvió una respuesta que no pudo estructurarse.");
  }
  const descripcionIa = String(parsed.descripcion ?? "").trim();
  const sugerida = String(parsed.clasificacionSugerida ?? "").trim().toUpperCase();
  const justificacionIa = String(parsed.justificacion ?? "").trim();
  if (!descripcionIa) volver(inspeccionId, codigo, "error", "Gemini no generó una descripción técnica válida.");

  const anterior = observacionObjeto(item.observacion);
  const observacion: ObservacionItemCritico = {
    ...anterior,
    descripcionIa,
    clasificacionSugerida: ["C", "O", "NC", "CR", "NA"].includes(sugerida) ? sugerida : "O",
    justificacionIa,
    actualizadoEn: new Date().toISOString(),
  };
  await prisma.$executeRaw`
    UPDATE "GuiaInspeccionItem"
    SET "observacion"=${JSON.stringify(observacion)},"actualizadoEn"=NOW()
    WHERE "id"=${itemId} AND "inspeccionId"=${inspeccionId}
  `;
  revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos`);
  volver(inspeccionId, codigo, "ok", "Descripción IA generada. Revísala y confirma la clasificación.");
}

function prioridadClasificacion(clasificacion: ClasificacionHallazgo): PrioridadHallazgo {
  if (clasificacion === ClasificacionHallazgo.CR) return PrioridadHallazgo.P1;
  if (clasificacion === ClasificacionHallazgo.NC) return PrioridadHallazgo.P3;
  return PrioridadHallazgo.P4;
}

async function recalcularIndice(inspeccionId: string) {
  const hallazgos = await prisma.hallazgo.findMany({
    where: { inspeccionId },
    select: { clasificacion: true },
  });
  const evaluables = hallazgos.map((h) => h.clasificacion).filter((v) => v !== ClasificacionHallazgo.NA);
  if (!evaluables.length) {
    await prisma.inspeccion.update({ where: { id: inspeccionId }, data: { ish: null, semaforo: null } });
    return;
  }
  const pesos: Record<string, number> = { C: 100, O: 90, NC: 70, CR: 35 };
  const indice = evaluables.reduce((s, v) => s + (pesos[v] ?? 0), 0) / evaluables.length;
  const semaforo = indice >= 90 ? "VERDE" : indice >= 75 ? "AMARILLO" : indice >= 60 ? "NARANJA" : "ROJO";
  await prisma.inspeccion.update({ where: { id: inspeccionId }, data: { ish: indice, semaforo } });
}

export async function guardarResultadoPuntoCriticoV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const codigoTexto = texto(formData, "codigo");
  const itemId = texto(formData, "itemId");
  const descripcionFinal = texto(formData, "descripcionFinal");
  const clasificacionTexto = texto(formData, "clasificacion").toUpperCase();
  if (!inspeccionId || !esCodigo(codigoTexto) || !itemId) redirect("/panel/inspecciones");
  const codigo = codigoTexto;
  const { usuario, responsable } = await exigirResponsable(inspeccionId);
  if (!["C", "O", "NC", "CR", "NA"].includes(clasificacionTexto)) volver(inspeccionId, codigo, "error", "Selecciona una clasificación válida.");
  if (descripcionFinal.length < 10) volver(inspeccionId, codigo, "error", "Confirma una descripción técnica de al menos 10 caracteres.");

  const [item] = await prisma.$queryRaw<Array<{ concepto: string; observacion: string | null; fotos: number }>>`
    SELECT g."concepto",g."observacion",
      (SELECT COUNT(*)::int FROM "FotografiaArea" fa WHERE fa."guiaItemId"=g."id") AS "fotos"
    FROM "GuiaInspeccionItem" g
    WHERE g."id"=${itemId} AND g."inspeccionId"=${inspeccionId}
      AND g."area"=${`__PUNTO_CRITICO__:${codigo}`}
    LIMIT 1
  `;
  if (!item) volver(inspeccionId, codigo, "error", "Concepto no encontrado.");
  if (Number(item.fotos) !== 4) volver(inspeccionId, codigo, "error", `${item.concepto} requiere exactamente 4 fotografías antes de cerrarse.`);

  const anterior = observacionObjeto(item.observacion);
  const observacion: ObservacionItemCritico = {
    ...anterior,
    descripcionFinal,
    clasificacionFinal: clasificacionTexto,
    actualizadoEn: new Date().toISOString(),
  };

  const clasificacion = clasificacionTexto as ClasificacionHallazgo;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "GuiaInspeccionItem"
      SET "observacion"=${JSON.stringify(observacion)},"estadoV3"='REVISADO',
          "completado"=true,"cerradoEn"=NOW(),"actualizadoEn"=NOW()
      WHERE "id"=${itemId} AND "inspeccionId"=${inspeccionId}
    `;

    if ([ClasificacionHallazgo.O, ClasificacionHallazgo.NC, ClasificacionHallazgo.CR].includes(clasificacion)) {
      const existente = await tx.hallazgo.findFirst({
        where: { inspeccionId, guiaItemId: itemId },
        select: { id: true },
      });
      const hallazgo = existente
        ? await tx.hallazgo.update({
            where: { id: existente.id },
            data: {
              titulo: `${puntoPorCodigo(codigo).etiqueta} · ${item.concepto}`,
              area: puntoPorCodigo(codigo).etiqueta,
              descripcion: descripcionFinal,
              clasificacion,
              prioridad: prioridadClasificacion(clasificacion),
              textoIaOriginal: anterior.descripcionIa || null,
              textoInspectorFinal: descripcionFinal,
            },
          })
        : await tx.hallazgo.create({
            data: {
              inspeccionId,
              creadoPorId: usuario.id,
              area: puntoPorCodigo(codigo).etiqueta,
              titulo: `${puntoPorCodigo(codigo).etiqueta} · ${item.concepto}`,
              descripcion: descripcionFinal,
              clasificacion,
              prioridad: prioridadClasificacion(clasificacion),
              guiaItemId: itemId,
              textoIaOriginal: anterior.descripcionIa || null,
              textoInspectorFinal: descripcionFinal,
            },
          });
      await tx.$executeRaw`
        UPDATE "Fotografia" f SET "hallazgoId"=${hallazgo.id}
        WHERE f."id" IN (SELECT fa."fotografiaId" FROM "FotografiaArea" fa WHERE fa."guiaItemId"=${itemId})
      `;
    }
  });

  await recalcularIndice(inspeccionId);
  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "GuiaInspeccionItem",
    entidadId: itemId,
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${responsable} cerró el concepto crítico “${item.concepto}” con clasificación ${clasificacionTexto} y 4 evidencias.`,
  });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/captura`);
  volver(inspeccionId, codigo, "ok", "Concepto cerrado y clasificado.");
}

export async function cerrarPuntoCriticoV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const codigoTexto = texto(formData, "codigo");
  if (!inspeccionId || !esCodigo(codigoTexto)) redirect("/panel/inspecciones");
  const codigo = codigoTexto;
  const { usuario, responsable } = await exigirResponsable(inspeccionId);
  const punto = puntoPorCodigo(codigo);

  const [estado] = await prisma.$queryRaw<Array<{ total: number; pendientes: number; incompletosFotos: number }>>`
    SELECT
      COUNT(*)::int AS "total",
      COUNT(*) FILTER (WHERE g."estadoV3"='PENDIENTE')::int AS "pendientes",
      COUNT(*) FILTER (
        WHERE (SELECT COUNT(*) FROM "FotografiaArea" fa WHERE fa."guiaItemId"=g."id") <> 4
      )::int AS "incompletosFotos"
    FROM "GuiaInspeccionItem" g
    WHERE g."inspeccionId"=${inspeccionId} AND g."area"=${`__PUNTO_CRITICO__:${codigo}`}
  `;
  if (Number(estado?.total ?? 0) === 0) volver(inspeccionId, codigo, "error", "Primero configura este punto como SI APLICA.");
  if (Number(estado?.pendientes ?? 0) > 0) volver(inspeccionId, codigo, "error", `Faltan ${estado.pendientes} concepto(s) por cerrar.`);
  if (Number(estado?.incompletosFotos ?? 0) > 0) volver(inspeccionId, codigo, "error", "Todos los conceptos requieren exactamente 4 fotografías.");

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "ProtocoloInspeccionPaso"
      SET "estado"='COMPLETADO',"completadoEn"=NOW(),"actualizadoEn"=NOW()
      WHERE "inspeccionId"=${inspeccionId} AND "clave"=${`PC_${codigo}`}
    `;
    await tx.$executeRaw`
      UPDATE "AreaInspeccion"
      SET "estado"='REVISADA',"resultado"='PUNTO_CRITICO_COMPLETADO',
          "comentarioFinal"=${`${punto.etiqueta} completada al 100%.`},
          "revisadaEn"=NOW(),"cerradaEn"=NOW(),"cerradaPorId"=${usuario.id},"actualizadoEn"=NOW()
      WHERE "inspeccionId"=${inspeccionId} AND "codigo"=${`PC_${codigo}`}
    `;
  });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "ProtocoloInspeccionPaso",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${responsable} cerró al 100% el punto crítico ${punto.etiqueta}.`,
  });

  const siguiente = siguienteCodigo(codigo);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
  if (siguiente) redirect(ruta(inspeccionId, siguiente, "ok", `${punto.etiqueta} cerrada al 100%.`));
  redirect(`/panel/inspecciones/${inspeccionId}/areas?ok=${encodeURIComponent("Puntos críticos completos. Continúa con las áreas de la vivienda.")}`);
}
