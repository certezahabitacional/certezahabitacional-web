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

function prioridadRutaArea(nombre: string, codigo: string) {
  const n = slug(`${nombre} ${codigo}`);

  // El recorrido físico inicia por las cuatro caras de fachada.
  if (/FACHADA_(PRINCIPAL|FRONTAL)/.test(n)) return 10;
  if (/FACHADA_POSTERIOR/.test(n)) return 20;
  if (/FACHADA_LATERAL_IZQUIERDA/.test(n)) return 30;
  if (/FACHADA_LATERAL_DERECHA/.test(n)) return 40;

  // Después continúa el recorrido interior de planta baja.
  if (/RECIBIDOR|VESTIBULO/.test(n)) return 80;
  if (/(^|_)SALA(_|$)/.test(n)) return 100;
  if (/COMEDOR/.test(n)) return 110;
  if (/COCINA/.test(n)) return 120;
  if (/DESAYUNADOR/.test(n)) return 125;
  if (/MEDIO_BANO|1_2_BANO|BANO_VISITAS/.test(n)) return 130;
  if (/LAVANDERIA|CUARTO_DE_LAVADO|LAVADO/.test(n)) return 140;
  if (/CUARTO_SERVICIO/.test(n)) return 150;

  // Conexión entre niveles.
  if (/ESCALERA/.test(n)) return 190;

  // Planta alta: circulación, baño compartido y zona privada.
  if (/BANO_COMPARTIDO/.test(n)) return 210;
  if (/PASILLO|CIRCULACION/.test(n)) return 215;
  if (/ESTANCIA|FAMILY_ROOM/.test(n)) return 220;
  if (/BANO.*RECAMARA_PRINCIPAL|RECAMARA_PRINCIPAL.*BANO/.test(n)) return 240;
  if (/RECAMARA_PRINCIPAL/.test(n)) return 230;
  if (/VESTIDOR/.test(n)) return 250;
  if (/BALCON/.test(n)) return 260;

  const recamaraNumero = n.match(/RECAMARA_?(\d+)/);
  if (recamaraNumero) return 280 + Number(recamaraNumero[1]) * 10;
  if (/(^|_)RECAMARA(_|$)|ALCOBA/.test(n)) return 350;
  if (/BANO_COMPLETO|(^|_)BANO(_|$)/.test(n)) return 360;
  if (/CLOSET/.test(n)) return 370;
  if (/ESTUDIO|OFICINA/.test(n)) return 380;

  // Áreas secundarias interiores.
  if (/BODEGA|SOTANO/.test(n)) return 450;
  if (/CUARTO_MAQUINAS|CUARTO_INSTALACIONES/.test(n)) return 470;

  // Exteriores al final del recorrido interior.
  if (/COCHERA|ACCESO_VEHICULAR/.test(n)) return 600;
  if (/TERRAZA/.test(n)) return 610;
  if (/PATIO/.test(n)) return 620;
  if (/JARDIN/.test(n)) return 630;
  if (/ACCESO_PEATONAL/.test(n)) return 640;
  if (/FACHADA/.test(n)) return 40;
  if (/BARDA/.test(n)) return 670;
  if (/AZOTEA/.test(n)) return 700;
  if (/ROOF_GARDEN/.test(n)) return 710;

  return 500;
}

async function ordenarAreasLogicamente(inspeccionId: string) {
  const areas = await prisma.$queryRaw<Array<{ id: string; nombre: string; codigo: string; orden: number }>>`
    SELECT "id"::text,"nombre","codigo","orden"
    FROM "AreaInspeccion"
    WHERE "inspeccionId"=${inspeccionId} AND "tipo" <> 'PUNTO_CRITICO'
    ORDER BY "orden","nombre"
  `;

  const ordenadas = [...areas].sort((a, b) => {
    const pa = prioridadRutaArea(a.nombre, a.codigo);
    const pb = prioridadRutaArea(b.nombre, b.codigo);
    if (pa !== pb) return pa - pb;
    if (a.orden !== b.orden) return a.orden - b.orden;
    return a.nombre.localeCompare(b.nombre, "es");
  });

  await prisma.$transaction(
    ordenadas.map((area, index) =>
      prisma.$executeRaw`
        UPDATE "AreaInspeccion"
        SET "orden"=${(index + 1) * 10},"actualizadoEn"=NOW()
        WHERE "id"=${area.id}::uuid AND "inspeccionId"=${inspeccionId}
      `,
    ),
  );
}

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan credenciales de Supabase en el servidor.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function exigirResponsableV1(inspeccionId: string) {
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

  if (!usuario?.activo || !inspeccion) redirect("/acceso");
  const inspectorAsignado = usuario.rol === RolUsuario.INSPECTOR && Boolean(usuario.inspector?.activo) && inspeccion.inspectorId === usuario.inspector?.id;
  const directorPorAusencia = usuario.rol === RolUsuario.DIRECTOR && !inspeccion.inspectorId;
  if (!inspectorAsignado && !directorPorAusencia) redirect("/acceso");
  if (inspeccion.numeroInspeccion !== 1) volver(inspeccionId, "error", "La cobertura integral por áreas corresponde a V1.");
  if (inspeccion.estado !== EstadoInspeccion.EN_PROCESO) volver(inspeccionId, "error", "Las áreas solo pueden documentarse mientras la inspección está EN PROCESO.");

  return { session, usuario, inspeccion, responsable: directorPorAusencia ? "Director por ausencia" : "Inspector" };
}

async function exigirAreaActivaV1(inspeccionId: string, areaId: string) {
  const areas = await prisma.$queryRaw<Array<{ id: string; nombre: string; estado: string }>>`
    SELECT "id"::text,"nombre","estado"
    FROM "AreaInspeccion"
    WHERE "inspeccionId"=${inspeccionId} AND "tipo" <> 'PUNTO_CRITICO'
    ORDER BY "orden","nombre"
  `;
  const indiceSolicitado = areas.findIndex((area) => area.id === areaId);
  if (indiceSolicitado < 0) volver(inspeccionId, "error", "El punto de área no pertenece a esta inspección.");
  const indiceActivo = areas.findIndex((area) => area.estado !== "REVISADA");
  if (indiceActivo < 0) volver(inspeccionId, "error", "Todos los puntos de área ya están cerrados al 100%.");
  const activa = areas[indiceActivo];
  if (activa.id !== areaId) {
    volver(inspeccionId, "error", `Debes concluir al 100% el Punto ${9 + indiceActivo} · ${activa.nombre} antes de avanzar.`);
  }
}

export async function confirmarProyectoV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const modalidad = texto(formData, "modalidad");
  if (!inspeccionId) redirect("/panel/inspecciones");
  const { usuario, responsable } = await exigirResponsableV1(inspeccionId);

  if (!["CON_PDF", "SIN_PDF"].includes(modalidad)) volver(inspeccionId, "error", "Selecciona una modalidad de proyecto válida.");

  const [estado] = await prisma.$queryRaw<Array<{
    total: number;
    pendientes: number;
    sinDatos: number;
    puntosProyecto: number;
  }>>`
    SELECT
      (SELECT COUNT(*)::int FROM "DocumentoProyectoInspeccion" d WHERE d."inspeccionId"=${inspeccionId}) AS "total",
      (SELECT COUNT(*)::int FROM "DocumentoProyectoInspeccion" d WHERE d."inspeccionId"=${inspeccionId} AND d."estadoAnalisis" <> 'COMPLETADO') AS "pendientes",
      (SELECT COUNT(*)::int FROM "DocumentoProyectoInspeccion" d WHERE d."inspeccionId"=${inspeccionId} AND d."datosExtraidos" IS NULL) AS "sinDatos",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."inspeccionId"=${inspeccionId} AND g."origen"='PROYECTO') AS "puntosProyecto"
  `;

  const totalDocumentos = Number(estado?.total ?? 0);

  if (modalidad === "SIN_PDF" && totalDocumentos > 0) {
    volver(inspeccionId, "error", `No puedes declarar SIN PROYECTO PDF porque existen ${totalDocumentos} documento(s) cargado(s). Elimínalos antes de declarar ausencia de proyecto o completa su análisis y confirma CON PDF.`);
  }

  if (modalidad === "CON_PDF") {
    if (totalDocumentos === 0) volver(inspeccionId, "error", "No hay PDF de proyecto cargado. Abre Proyecto PDF · IA para cargarlo o declara formalmente que no existe proyecto disponible.");
    if (Number(estado?.pendientes ?? 0) > 0) volver(inspeccionId, "error", `Falta completar el análisis de ${estado.pendientes} PDF(s). Abre Proyecto PDF · IA y analiza todos los documentos antes de confirmar.`);
    if (Number(estado?.sinDatos ?? 0) > 0) volver(inspeccionId, "error", `Hay ${estado.sinDatos} PDF(s) sin datos estructurados válidos. Reanalízalos antes de confirmar el proyecto.`);
    if (Number(estado?.puntosProyecto ?? 0) === 0) volver(inspeccionId, "error", "Los PDF ya fueron analizados, pero todavía no se ha generado la guía desde el proyecto. Abre Proyecto PDF · IA y usa «Generar guía desde análisis».");
  }

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
    descripcion: modalidad === "CON_PDF" ? `${responsable} confirmó proyecto PDF analizado y convertido a guía para V1.` : `${responsable} declaró formalmente V1 SIN PROYECTO PDF disponible.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/proyecto-v1`);
  volver(inspeccionId, "ok", modalidad === "CON_PDF" ? "Proyecto PDF analizado y guía técnica confirmados." : "Quedó documentado que la inspección se realizará sin proyecto PDF disponible.");
}

export async function generarAreasDesdeGuia(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  if (!inspeccionId) redirect("/panel/inspecciones");
  const { usuario, responsable } = await exigirResponsableV1(inspeccionId);

  const items = await prisma.$queryRaw<Array<{ area: string }>>`
    SELECT DISTINCT btrim("area") AS "area"
    FROM "GuiaInspeccionItem"
    WHERE "inspeccionId"=${inspeccionId}
      AND "origen" <> 'PUNTO_CRITICO'
      AND nullif(btrim("area"),'') IS NOT NULL
    ORDER BY 1
  `;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "InspeccionControlV2" ("inspeccionId","categoria","versionProtocolo")
      VALUES (${inspeccionId},'VIVIENDA',2)
      ON CONFLICT ("inspeccionId") DO NOTHING
    `;
    const fachadas = [
      { codigo: "FACHADA_FRONTAL", nombre: "Fachada frontal", orden: 10 },
      { codigo: "FACHADA_POSTERIOR", nombre: "Fachada posterior", orden: 20 },
      { codigo: "FACHADA_LATERAL_IZQUIERDA", nombre: "Fachada lateral izquierda", orden: 30 },
      { codigo: "FACHADA_LATERAL_DERECHA", nombre: "Fachada lateral derecha", orden: 40 },
    ];
    for (const fachada of fachadas) {
      await tx.$executeRaw`
        INSERT INTO "AreaInspeccion" ("inspeccionId","codigo","nombre","tipo","orden","origen","obligatoria")
        VALUES (${inspeccionId},${fachada.codigo},${fachada.nombre},'EXTERIOR',${fachada.orden},'METODO_CERTEZA',true)
        ON CONFLICT ("inspeccionId","codigo") DO NOTHING
      `;
    }
    let orden = 100;
    for (const item of items) {
      const nombre = item.area.trim();
      if (!nombre) continue;
      const codigoBase = slug(nombre) || `AREA_${orden}`;
      if (/^FACHADA(_|$)/.test(codigoBase)) continue;
      const codigo = codigoBase;
      await tx.$executeRaw`
        INSERT INTO "AreaInspeccion" ("inspeccionId","codigo","nombre","tipo","orden","origen","obligatoria")
        VALUES (${inspeccionId},${codigo},${nombre},'INTERIOR',${orden},'GUIA_TECNICA',true)
        ON CONFLICT ("inspeccionId","codigo") DO NOTHING
      `;
      orden += 10;
    }
  });

  await ordenarAreasLogicamente(inspeccionId);

  await registrarAuditoria({
    tipo: TipoEvento.CREAR,
    entidad: "AreaInspeccion",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${responsable} generó las áreas V1 desde la guía técnica y aplicó el orden lógico sugerido del recorrido.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
  volver(inspeccionId, "ok", "Áreas generadas desde la guía técnica. Revísalas y agrega manualmente cualquier área física faltante antes de confirmar.");
}

export async function agregarAreaManual(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const nombre = texto(formData, "nombre");
  const tipo = texto(formData, "tipo") || "INTERIOR";
  if (!inspeccionId || !nombre) redirect("/panel/inspecciones");
  const { usuario, responsable } = await exigirResponsableV1(inspeccionId);

  const codigo = `${slug(nombre) || 'AREA'}_${randomUUID().slice(0, 6).toUpperCase()}`;
  const [r] = await prisma.$queryRaw<Array<{ siguiente: number }>>`
    SELECT COALESCE(MAX("orden"),0)::int + 10 AS "siguiente" FROM "AreaInspeccion" WHERE "inspeccionId"=${inspeccionId}
  `;
  await prisma.$executeRaw`
    INSERT INTO "AreaInspeccion" ("inspeccionId","codigo","nombre","tipo","orden","origen","obligatoria")
    VALUES (${inspeccionId},${codigo},${nombre},${tipo},${Number(r?.siguiente ?? 10)},'MANUAL',true)
  `;
  await ordenarAreasLogicamente(inspeccionId);

  await registrarAuditoria({ tipo: TipoEvento.CREAR, entidad: "AreaInspeccion", inspeccionId, usuarioId: usuario.id, descripcion: `${responsable} agregó manualmente el área obligatoria “${nombre}”.` });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
  volver(inspeccionId, "ok", `Área “${nombre}” agregada.`);
}

export async function aplicarOrdenLogicoAreasV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  if (!inspeccionId) redirect("/panel/inspecciones");
  const { usuario, responsable } = await exigirResponsableV1(inspeccionId);

  const [control] = await prisma.$queryRaw<Array<{ areasConfirmadas: boolean }>>`
    SELECT "areasConfirmadas"
    FROM "InspeccionControlV2"
    WHERE "inspeccionId"=${inspeccionId}
    LIMIT 1
  `;
  if (control?.areasConfirmadas) {
    volver(inspeccionId, "error", "La ruta ya fue confirmada y no puede reordenarse durante la inspección.");
  }

  await ordenarAreasLogicamente(inspeccionId);
  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "AreaInspeccion",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${responsable} aplicó el orden lógico sugerido: planta baja, escalera, planta alta/zona privada y exteriores.`,
  });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
  volver(inspeccionId, "ok", "Orden lógico sugerido aplicado. Puedes ajustarlo antes de confirmar.");
}

export async function moverAreaRutaV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const areaId = texto(formData, "areaId");
  const direccion = texto(formData, "direccion").toUpperCase();
  if (!inspeccionId || !areaId || !["ARRIBA","ABAJO"].includes(direccion)) redirect("/panel/inspecciones");
  const { usuario, responsable } = await exigirResponsableV1(inspeccionId);

  const [control] = await prisma.$queryRaw<Array<{ areasConfirmadas: boolean }>>`
    SELECT "areasConfirmadas"
    FROM "InspeccionControlV2"
    WHERE "inspeccionId"=${inspeccionId}
    LIMIT 1
  `;
  if (control?.areasConfirmadas) {
    volver(inspeccionId, "error", "La ruta ya fue confirmada y no puede reordenarse durante la inspección.");
  }

  const areas = await prisma.$queryRaw<Array<{ id: string; nombre: string; orden: number }>>`
    SELECT "id"::text,"nombre","orden"
    FROM "AreaInspeccion"
    WHERE "inspeccionId"=${inspeccionId} AND "tipo" <> 'PUNTO_CRITICO'
    ORDER BY "orden","nombre"
  `;
  const indice = areas.findIndex((area) => area.id === areaId);
  if (indice < 0) volver(inspeccionId, "error", "Área no encontrada.");
  const destino = direccion === "ARRIBA" ? indice - 1 : indice + 1;
  if (destino < 0 || destino >= areas.length) volver(inspeccionId, "error", "El área ya está en el extremo del recorrido.");

  const actual = areas[indice];
  const vecina = areas[destino];
  await prisma.$transaction([
    prisma.$executeRaw`UPDATE "AreaInspeccion" SET "orden"=${vecina.orden},"actualizadoEn"=NOW() WHERE "id"=${actual.id}::uuid`,
    prisma.$executeRaw`UPDATE "AreaInspeccion" SET "orden"=${actual.orden},"actualizadoEn"=NOW() WHERE "id"=${vecina.id}::uuid`,
  ]);

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "AreaInspeccion",
    entidadId: actual.id,
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${responsable} movió “${actual.nombre}” ${direccion === "ARRIBA" ? "hacia arriba" : "hacia abajo"} en la ruta de inspección.`,
  });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
  volver(inspeccionId, "ok", "Orden del recorrido actualizado.");
}

export async function confirmarAreasV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  if (!inspeccionId) redirect("/panel/inspecciones");
  const { usuario, responsable } = await exigirResponsableV1(inspeccionId);

  const [r] = await prisma.$queryRaw<Array<{ total: number; fachadas: number }>>`
    SELECT COUNT(*) FILTER (WHERE "obligatoria")::int AS "total",
           COUNT(*) FILTER (
             WHERE "codigo" IN (
               'FACHADA_FRONTAL','FACHADA_POSTERIOR',
               'FACHADA_LATERAL_IZQUIERDA','FACHADA_LATERAL_DERECHA'
             )
           )::int AS "fachadas"
    FROM "AreaInspeccion" WHERE "inspeccionId"=${inspeccionId}
  `;
  if (Number(r?.total ?? 0) === 0 || Number(r?.fachadas ?? 0) < 4) {
    volver(inspeccionId, "error", "Antes de confirmar deben existir las cuatro fachadas: frontal, posterior, lateral izquierda y lateral derecha, además de todas las áreas físicas obligatorias.");
  }

  await prisma.$executeRaw`
    UPDATE "InspeccionControlV2" SET "areasConfirmadas"=true,"actualizadoEn"=NOW() WHERE "inspeccionId"=${inspeccionId}
  `;
  await registrarAuditoria({ tipo: TipoEvento.EDITAR, entidad: "InspeccionControlV2", inspeccionId, usuarioId: usuario.id, descripcion: `${responsable} confirmó el ecosistema de ${Number(r.total)} área(s) obligatoria(s) de V1.` });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
  volver(inspeccionId, "ok", "Ecosistema de áreas confirmado. A partir de ahora documenta todas las áreas antes del cierre.");
}

export async function subirFotoArea(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const areaId = texto(formData, "areaId");
  const descripcion = texto(formData, "descripcion");
  const archivo = formData.get("archivo");
  if (!inspeccionId || !areaId) redirect("/panel/inspecciones");
  const { session, usuario, responsable } = await exigirResponsableV1(inspeccionId);
  await exigirAreaActivaV1(inspeccionId, areaId);

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
      await tx.$executeRaw`
        INSERT INTO "FotografiaArea" ("fotografiaId","areaId","tipoEvidencia","orden","candidataReporte","candidataPortada")
        VALUES (${foto.id},${areaId}::uuid,${area.codigo === 'FACHADA_PRINCIPAL' ? 'IDENTIFICACION' : 'RECORRIDO'},0,true,false)
      `;
    });
  } catch (e) {
    await sb.storage.from(bucket).remove([ruta]);
    throw e;
  }

  await registrarAuditoria({ tipo: TipoEvento.SUBIR_EVIDENCIA, entidad: "FotografiaArea", inspeccionId, usuarioId: usuario.id, descripcion: `${responsable} agregó evidencia del área “${area.nombre}”${area.codigo === 'FACHADA_PRINCIPAL' ? ' (fachada/identificación; portada pendiente de selección explícita)' : ''}.` });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/flujo`);
  volver(inspeccionId, "ok", area.codigo === 'FACHADA_PRINCIPAL' ? "Fotografía de fachada agregada. Selecciona explícitamente una de las fotos como portada antes del cierre." : `Fotografía agregada a ${area.nombre}.`);
}

export async function cerrarAreaV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const areaId = texto(formData, "areaId");
  const comentario = texto(formData, "comentarioFinal");
  if (!inspeccionId || !areaId) redirect("/panel/inspecciones");
  const { usuario, responsable } = await exigirResponsableV1(inspeccionId);
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
  await registrarAuditoria({ tipo: TipoEvento.EDITAR, entidad: "AreaInspeccion", entidadId: areaId, inspeccionId, usuarioId: usuario.id, descripcion: `${responsable} cerró el área “${r.nombre}” con ${r.fotos} fotografías. Comentario final: ${comentario}` });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/flujo`);
  volver(inspeccionId, "ok", `${r.nombre} quedó revisada y documentada.`);
}
