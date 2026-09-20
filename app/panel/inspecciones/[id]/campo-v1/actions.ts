"use server";

import { randomUUID } from "node:crypto";
import { EstadoInspeccion, RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  HERRAMIENTAS_INSPECCION,
  obtenerHerramientasCotizadasDesdeCotizacion,
  type CodigoHerramienta,
} from "@/lib/herramientas-inspeccion";
import { prisma } from "@/lib/prisma";

const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? "").trim();

function volver(id: string, tipo: "ok" | "error", mensaje: string, areaId?: string): never {
  const params = new URLSearchParams();
  if (areaId) params.set("area", areaId);
  params.set(tipo, mensaje);
  redirect(`/panel/inspecciones/${id}/campo-v1?${params.toString()}`);
}

function normalizarAreaEquipo(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
}

function herramientaAplicaArea(codigo: CodigoHerramienta, areaCodigo: string, areaNombre: string) {
  const area = normalizarAreaEquipo(`${areaCodigo} ${areaNombre}`);

  if (["MANOMETRO_AGUA", "DETECTOR_GAS", "HERMETICIDAD_HIDRAULICA", "HERMETICIDAD_GAS"].includes(codigo)) {
    return false;
  }

  if (codigo === "CAMARA_TERMICA") {
    return /(BANO|COCINA|LAVADO|LAVADERO|AZOTEA|SOTANO|CUARTO_SERVICIO|INSTALACION|ELECTR|DUCTO)/.test(area);
  }

  if (codigo === "AUSCULTACION_PISOS") {
    return /(PISO|CERAM|LOSETA|PORCELAN|AZULEJO|RECUBRIMIENTO)/.test(area);
  }

  if (codigo === "NIVEL_LASER") {
    return /(PISO|MURO|PARED|AZOTEA|TERRAZA|PATIO|COCHERA|ESCALERA|FACHADA)/.test(area);
  }

  if (codigo === "MEDIDOR_LASER") {
    return /(RECÁMARA|RECAMARA|SALA|COMEDOR|COCINA|BANO|BAÑO|ESTANCIA|CUARTO|COCHERA|PATIO|JARDIN|TERRAZA|BALCON|BODEGA|FACHADA)/.test(area);
  }

  if (["PROBADOR_GFCI_RCD", "DETECTOR_VOLTAJE", "MULTIMETRO"].includes(codigo)) {
    // Las pruebas funcionales eléctricas pertenecen al Punto 7 · Instalación Eléctrica.
    // En las áreas sólo se conserva ubicación, altura, alineación, nivel y acabado visual.
    return false;
  }

  if (codigo === "LINTERNA") return true;

  return false;
}

function codigoBibliotecaPorArea(codigo: string, nombre: string) {
  const area = normalizarAreaEquipo(`${codigo} ${nombre}`);

  if (/BANO.*RECAMARA_PRINCIPAL|RECAMARA_PRINCIPAL.*BANO|BANO_COMPARTIDO|BANO_COMPLETO/.test(area)) return "BANO_COMPLETO";
  if (/MEDIO_BANO|1_2_BANO|BANO_VISITAS/.test(area)) return "MEDIO_BANO";
  if (/RECAMARA_PRINCIPAL/.test(area) && !/BANO/.test(area)) return "RECAMARA_PRINCIPAL";
  if (/RECAMARA|ALCOBA/.test(area)) return "RECAMARA";
  if (/COCINA/.test(area)) return "COCINA";
  if (/DESAYUNADOR/.test(area)) return "DESAYUNADOR";
  if (/(^|_)SALA(_|$)/.test(area)) return "SALA";
  if (/COMEDOR/.test(area)) return "COMEDOR";
  if (/ESTANCIA|FAMILY_ROOM/.test(area)) return "ESTANCIA";
  if (/RECIBIDOR|VESTIBULO/.test(area)) return "RECIBIDOR";
  if (/PASILLO|CIRCULACION/.test(area)) return "PASILLO";
  if (/ESCALERA/.test(area)) return "ESCALERA";
  if (/VESTIDOR/.test(area)) return "VESTIDOR";
  if (/CLOSET/.test(area)) return "CLOSET";
  if (/LAVANDERIA|CUARTO_DE_LAVADO|LAVADO/.test(area)) return "LAVANDERIA";
  if (/CUARTO_SERVICIO/.test(area)) return "CUARTO_SERVICIO";
  if (/ESTUDIO|OFICINA/.test(area)) return "ESTUDIO";
  if (/BODEGA/.test(area)) return "BODEGA";
  if (/BALCON/.test(area)) return "BALCON";
  if (/TERRAZA/.test(area)) return "TERRAZA";
  if (/COCHERA|ACCESO_VEHICULAR/.test(area)) return "COCHERA";
  if (/PATIO/.test(area)) return "PATIO";
  if (/JARDIN/.test(area)) return "JARDIN";
  if (/AZOTEA/.test(area)) return "AZOTEA";
  if (/ROOF_GARDEN/.test(area)) return "ROOF_GARDEN";
  if (/SOTANO/.test(area)) return "SOTANO";
  if (/CUARTO_MAQUINAS/.test(area)) return "CUARTO_MAQUINAS";
  if (/CUARTO_INSTALACIONES/.test(area)) return "CUARTO_INSTALACIONES";
  if (/FACHADA_(POSTERIOR|LATERAL_IZQUIERDA|LATERAL_DERECHA|LATERAL)/.test(area)) return "FACHADA_LATERAL";
  if (/FACHADA_(PRINCIPAL|FRONTAL)/.test(area)) return "FACHADA_PRINCIPAL";
  if (/ACCESO_PEATONAL/.test(area)) return "ACCESO_PEATONAL";
  if (/BARDA/.test(area)) return "BARDA";

  return "OTRA_AREA";
}

async function herramientasCotizadas(inspeccionId: string) {
  const [fila] = await prisma.$queryRaw<Array<{ observacionesInternas: string | null }>>`
    SELECT c."observacionesInternas"
    FROM "Inspeccion" i
    LEFT JOIN "Cotizacion" c ON c."id"=i."cotizacionId"
    WHERE i."id"=${inspeccionId}
    LIMIT 1
  `;
  return obtenerHerramientasCotizadasDesdeCotizacion(fila?.observacionesInternas);
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
    select: { id: true, numeroInspeccion: true, estado: true, inspectorId: true },
  });
  if (!usuario?.activo || !inspeccion) redirect("/acceso");
  const inspectorAsignado =
    usuario.rol === RolUsuario.INSPECTOR &&
    Boolean(usuario.inspector?.activo) &&
    inspeccion.inspectorId === usuario.inspector?.id;
  const director = usuario.rol === RolUsuario.DIRECTOR;
  if (!inspectorAsignado && !director) redirect("/acceso");
  if (inspeccion.numeroInspeccion !== 1) volver(inspeccionId, "error", "Este recorrido guiado corresponde únicamente a V1.");
  if (inspeccion.estado !== EstadoInspeccion.EN_PROCESO) volver(inspeccionId, "error", "La captura técnica solo está disponible mientras V1 está EN PROCESO.");
  return { usuario, responsable: director ? "Director" : "Inspector" };
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
    volver(
      inspeccionId,
      "error",
      `Debes concluir al 100% el Punto ${9 + indiceActivo} · ${activa.nombre} antes de avanzar.`,
      activa.id,
    );
  }
  return { area: activa, numero: 9 + indiceActivo, totalRecorrido: 8 + areas.length };
}

async function siguienteAreaPendienteV1(inspeccionId: string) {
  const [area] = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"::text
    FROM "AreaInspeccion"
    WHERE "inspeccionId"=${inspeccionId}
      AND "tipo" <> 'PUNTO_CRITICO'
      AND "estado" <> 'REVISADA'
    ORDER BY "orden","nombre"
    LIMIT 1
  `;
  return area?.id ?? null;
}

export async function inicializarPlanAreasV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  if (!inspeccionId) redirect("/panel/inspecciones");
  const { usuario, responsable } = await exigirResponsableV1(inspeccionId);
  const equipoCotizado = await herramientasCotizadas(inspeccionId);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "AreaInspeccion" a
      SET "bibliotecaAreaId" = b."id"
      FROM "BibliotecaAreaCerteza" b
      WHERE a."inspeccionId"=${inspeccionId} AND a."bibliotecaAreaId" IS NULL
        AND (b."codigo"=a."codigo" OR b."codigo"=regexp_replace(upper(unaccent(a."nombre")), '[^A-Z0-9]+', '_', 'g'))
    `;
    const areas = await tx.$queryRaw<Array<{ id: string; codigo: string; nombre: string; bibliotecaAreaId: string | null }>>`
      SELECT "id"::text,"codigo","nombre","bibliotecaAreaId"::text
      FROM "AreaInspeccion"
      WHERE "inspeccionId"=${inspeccionId} AND "tipo" <> 'PUNTO_CRITICO'
      ORDER BY "orden"
    `;
    for (const area of areas) {
      let bibliotecaAreaId = area.bibliotecaAreaId;
      if (!bibliotecaAreaId) {
        const codigoBiblioteca = codigoBibliotecaPorArea(area.codigo, area.nombre);
        const [biblioteca] = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id"::text
          FROM "BibliotecaAreaCerteza"
          WHERE "codigo"=${codigoBiblioteca} AND "activa"=true
          LIMIT 1
        `;
        bibliotecaAreaId = biblioteca?.id ?? null;
        if (bibliotecaAreaId) {
          await tx.$executeRaw`
            UPDATE "AreaInspeccion"
            SET "bibliotecaAreaId"=${bibliotecaAreaId}::uuid,"actualizadoEn"=NOW()
            WHERE "id"=${area.id}::uuid AND "inspeccionId"=${inspeccionId}
          `;
        }
      }

      const puntos = bibliotecaAreaId
        ? await tx.$queryRaw<Array<{ puntoId:string; nombre:string; descripcion:string|null; orden:number; obligatorio:boolean; requiereMedicion:boolean; requiereComparacionProyecto:boolean; herramientaSugerida:string|null }>>`
            SELECT p."id"::text "puntoId",p."nombre",p."descripcion",ap."orden",ap."obligatorio",p."requiereMedicion",p."requiereComparacionProyecto",p."herramientaSugerida"
            FROM "BibliotecaAreaPuntoCerteza" ap JOIN "BibliotecaPuntoCerteza" p ON p."id"=ap."puntoBibliotecaId"
            WHERE ap."areaBibliotecaId"=${bibliotecaAreaId}::uuid AND p."activa"=true ORDER BY ap."orden"
          `
        : [];
      for (const p of puntos) {
        await tx.$executeRaw`
          INSERT INTO "GuiaInspeccionItem" ("id","inspeccionId","origen","area","concepto","especificacion","orden","obligatorio","completado","creadoPorId","areaId","bibliotecaPuntoId","estadoV3","origenV3","requiereMedicion","requiereComparacionProyecto","herramientaSugerida","creadoEn","actualizadoEn")
          SELECT ${randomUUID()},${inspeccionId},'BIBLIOTECA_CERTEZA',${area.nombre},${p.nombre},${p.descripcion},${p.orden},${p.obligatorio},false,${usuario.id},${area.id}::uuid,${p.puntoId}::uuid,'PENDIENTE','BIBLIOTECA',${p.requiereMedicion},${p.requiereComparacionProyecto},${p.herramientaSugerida},NOW(),NOW()
          WHERE NOT EXISTS (SELECT 1 FROM "GuiaInspeccionItem" g WHERE g."inspeccionId"=${inspeccionId} AND g."areaId"=${area.id}::uuid AND g."bibliotecaPuntoId"=${p.puntoId}::uuid)
        `;
      }

      let ordenEquipo = 500;
      for (const codigoHerramienta of equipoCotizado) {
        if (!herramientaAplicaArea(codigoHerramienta, area.codigo, area.nombre)) continue;
        const herramienta = HERRAMIENTAS_INSPECCION.find((item) => item.codigo === codigoHerramienta);
        if (!herramienta) continue;
        const requiereMedicion = herramienta.campos.some((campo) =>
          /(lectura|presion|medicion|voltaje|dimension)/i.test(campo.clave),
        );
        await tx.$executeRaw`
          INSERT INTO "GuiaInspeccionItem"
            ("id","inspeccionId","origen","area","concepto","especificacion","orden","obligatorio",
             "completado","creadoPorId","areaId","estadoV3","origenV3","requiereMedicion",
             "requiereComparacionProyecto","herramientaSugerida","creadoEn","actualizadoEn")
          SELECT
            ${randomUUID()},${inspeccionId},'EQUIPO_COTIZADO',${area.nombre},
            ${`Uso de ${herramienta.nombre}`},${herramienta.aplicacionCotizacion},
            ${ordenEquipo},true,false,${usuario.id},${area.id}::uuid,'PENDIENTE','COTIZACION_P4',
            ${requiereMedicion},false,${herramienta.nombre},NOW(),NOW()
          WHERE NOT EXISTS (
            SELECT 1 FROM "GuiaInspeccionItem" g
            WHERE g."inspeccionId"=${inspeccionId} AND g."areaId"=${area.id}::uuid
              AND g."origen"='EQUIPO_COTIZADO' AND g."herramientaSugerida"=${herramienta.nombre}
          )
        `;
        ordenEquipo += 10;
      }
    }
  });
  await registrarAuditoria({ tipo: TipoEvento.CREAR, entidad: "GuiaInspeccionItem", inspeccionId, usuarioId: usuario.id, descripcion: `${responsable} inicializó el plan V1 desde la Biblioteca Certeza e incorporó ${equipoCotizado.length} herramienta(s)/prueba(s) del punto 4 de la cotización donde aplican.` });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/campo-v1`);
  volver(inspeccionId, "ok", "Plan técnico V1 preparado con los puntos mínimos aplicables.");
}

export async function marcarPuntoNoAplicaV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const itemId = texto(formData, "itemId");
  const motivo = texto(formData, "motivo");
  if (!inspeccionId || !itemId) redirect("/panel/inspecciones");
  const { usuario, responsable } = await exigirResponsableV1(inspeccionId);
  if (motivo.length < 3) volver(inspeccionId, "error", "Indica brevemente por qué el concepto no aplica.");

  const [item] = await prisma.$queryRaw<Array<{ areaId: string; concepto: string; estadoV3: string }>>`
    SELECT "areaId"::text AS "areaId","concepto","estadoV3"
    FROM "GuiaInspeccionItem"
    WHERE "id"=${itemId} AND "inspeccionId"=${inspeccionId}
    LIMIT 1
  `;
  if (!item?.areaId) volver(inspeccionId, "error", "El concepto no pertenece a un punto de área válido.");
  await exigirAreaActivaV1(inspeccionId, item.areaId);
  if (item.estadoV3 !== "PENDIENTE") volver(inspeccionId, "error", "El concepto ya fue resuelto.", item.areaId);

  const n = await prisma.$executeRaw`
    UPDATE "GuiaInspeccionItem"
    SET "estadoV3"='NO_APLICA',"motivoNoAplica"=${motivo},"completado"=true,
        "cerradoEn"=NOW(),"actualizadoEn"=NOW()
    WHERE "id"=${itemId} AND "inspeccionId"=${inspeccionId} AND "estadoV3"='PENDIENTE'
  `;
  if (!n) volver(inspeccionId, "error", "El concepto ya fue atendido o no pertenece a esta inspección.", item.areaId);

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "GuiaInspeccionItem",
    entidadId: itemId,
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${responsable} marcó el concepto “${item.concepto}” como NO APLICA. Motivo: ${motivo}`,
  });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/campo-v1`);
  volver(inspeccionId, "ok", "Concepto marcado como NO APLICA.", item.areaId);
}

export async function marcarPuntoRevisadoV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const itemId = texto(formData, "itemId");
  if (!inspeccionId || !itemId) redirect("/panel/inspecciones");
  const { usuario, responsable } = await exigirResponsableV1(inspeccionId);

  const [item] = await prisma.$queryRaw<Array<{ areaId: string; concepto: string; estadoV3: string }>>`
    SELECT "areaId"::text AS "areaId","concepto","estadoV3"
    FROM "GuiaInspeccionItem"
    WHERE "id"=${itemId} AND "inspeccionId"=${inspeccionId}
    LIMIT 1
  `;
  if (!item?.areaId) volver(inspeccionId, "error", "El concepto no pertenece a un punto de área válido.");
  await exigirAreaActivaV1(inspeccionId, item.areaId);
  if (item.estadoV3 !== "PENDIENTE") volver(inspeccionId, "error", "El concepto ya fue resuelto.", item.areaId);

  await prisma.$executeRaw`
    UPDATE "GuiaInspeccionItem"
    SET "estadoV3"='REVISADO',"completado"=true,"motivoNoAplica"=NULL,
        "cerradoEn"=NOW(),"actualizadoEn"=NOW()
    WHERE "id"=${itemId} AND "inspeccionId"=${inspeccionId} AND "estadoV3"='PENDIENTE'
  `;

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "GuiaInspeccionItem",
    entidadId: itemId,
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${responsable} confirmó como REVISADO/CONFORME el concepto “${item.concepto}”.`,
  });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/campo-v1`);
  volver(inspeccionId, "ok", "Concepto revisado y confirmado.", item.areaId);
}

export async function agregarPuntoInspectorV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const areaId = texto(formData, "areaId");
  const concepto = texto(formData, "concepto");
  const especificacion = texto(formData, "especificacion");
  if (!inspeccionId || !areaId || !concepto) redirect("/panel/inspecciones");
  const { usuario, responsable } = await exigirResponsableV1(inspeccionId);
  await exigirAreaActivaV1(inspeccionId, areaId);
  const [area] = await prisma.$queryRaw<Array<{ nombre:string; siguiente:number }>>`
    SELECT a."nombre",COALESCE(MAX(g."orden"),0)::int+10 "siguiente" FROM "AreaInspeccion" a LEFT JOIN "GuiaInspeccionItem" g ON g."areaId"=a."id" WHERE a."id"=${areaId}::uuid AND a."inspeccionId"=${inspeccionId} GROUP BY a."id",a."nombre"
  `;
  if (!area) volver(inspeccionId, "error", "Área no encontrada.");
  const id = randomUUID();
  await prisma.$executeRaw`INSERT INTO "GuiaInspeccionItem" ("id","inspeccionId","origen","area","concepto","especificacion","orden","obligatorio","completado","creadoPorId","areaId","estadoV3","origenV3","creadoEn","actualizadoEn") VALUES (${id},${inspeccionId},'INSPECTOR',${area.nombre},${concepto},${especificacion || null},${area.siguiente},true,false,${usuario.id},${areaId}::uuid,'PENDIENTE','INSPECTOR',NOW(),NOW())`;
  await registrarAuditoria({ tipo: TipoEvento.CREAR, entidad: "GuiaInspeccionItem", entidadId: id, inspeccionId, usuarioId: usuario.id, descripcion: `${responsable} agregó el punto adicional “${concepto}” en ${area.nombre}.` });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/campo-v1`);
  volver(inspeccionId, "ok", "Punto adicional incorporado al plan V1.");
}

export async function cerrarAreaSinHallazgosV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const areaId = texto(formData, "areaId");
  if (!inspeccionId || !areaId) redirect("/panel/inspecciones");
  const { usuario, responsable } = await exigirResponsableV1(inspeccionId);
  await exigirAreaActivaV1(inspeccionId, areaId);
  const [area] = await prisma.$queryRaw<Array<{ nombre:string; fotos:number; seleccionadas:number; pendientes:number; hallazgos:number }>>`
    SELECT a."nombre",
      (SELECT COUNT(*)::int FROM "FotografiaArea" fa WHERE fa."areaId"=a."id") "fotos",
      (SELECT COUNT(*)::int FROM "FotografiaArea" fa WHERE fa."areaId"=a."id" AND fa."seleccionadaReporte"=true) "seleccionadas",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id" AND g."obligatorio"=true AND g."estadoV3"='PENDIENTE') "pendientes",
      (SELECT COUNT(*)::int FROM "Hallazgo" h WHERE h."inspeccionId"=a."inspeccionId" AND h."area"=a."nombre") "hallazgos"
    FROM "AreaInspeccion" a WHERE a."id"=${areaId}::uuid AND a."inspeccionId"=${inspeccionId}
  `;
  if (!area) volver(inspeccionId, "error", "Área no encontrada.");
  if (area.hallazgos > 0) volver(inspeccionId, "error", "El punto contiene hallazgos y debe cerrarse por el flujo correspondiente.", areaId);
  if (Number(area.pendientes) > 0) volver(inspeccionId, "error", `Faltan ${area.pendientes} concepto(s) por resolver. El punto debe llegar al 100% antes de cerrarse.`, areaId);
  if (area.fotos < 1) volver(inspeccionId, "error", "Toma al menos una fotografía representativa del punto.", areaId);

  await prisma.$transaction(async (tx) => {
    if (area.seleccionadas === 0) {
      await tx.$executeRaw`
        UPDATE "FotografiaArea" SET "seleccionadaReporte"=true
        WHERE "id" IN (SELECT "id" FROM "FotografiaArea" WHERE "areaId"=${areaId}::uuid ORDER BY "orden","creadoEn" LIMIT 4)
      `;
    }
    const textoResponsable = responsable === "Director por ausencia" ? "criterio técnico de Dirección por ausencia" : "criterio técnico del Inspector";
    const [auto] = await tx.$queryRaw<Array<{ texto:string }>>`
      SELECT 'Se realizó la inspección de '||a."nombre"||' conforme al plan establecido y a los puntos mínimos aplicables. No se identificaron anomalías relevantes en los elementos revisados, de acuerdo con el alcance de la inspección y el '||${textoResponsable}||'.' "texto" FROM "AreaInspeccion" a WHERE a."id"=${areaId}::uuid
    `;
    await tx.$executeRaw`
      UPDATE "AreaInspeccion"
      SET "resultado"='SIN_HALLAZGOS',"estado"='REVISADA',"textoSinHallazgo"=${auto?.texto ?? ''},"comentarioFinal"=${auto?.texto ?? ''},"revisadaEn"=NOW(),"cerradaEn"=NOW(),"cerradaPorId"=${usuario.id},"actualizadoEn"=NOW()
      WHERE "id"=${areaId}::uuid AND "inspeccionId"=${inspeccionId}
    `;
  });

  await registrarAuditoria({ tipo: TipoEvento.EDITAR, entidad: "AreaInspeccion", entidadId: areaId, inspeccionId, usuarioId: usuario.id, descripcion: `${responsable} cerró el punto de área “${area.nombre}” al 100% SIN HALLAZGOS; todos sus conceptos ya estaban resueltos.` });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/campo-v1`);
  const siguiente = await siguienteAreaPendienteV1(inspeccionId);
  if (siguiente) volver(inspeccionId, "ok", `${area.nombre} cerrada al 100%. Continúa con el siguiente punto.`, siguiente);
  volver(inspeccionId, "ok", `${area.nombre} cerrada. Todas las áreas quedaron concluidas.`);
}

export async function cerrarAreaConHallazgosV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const areaId = texto(formData, "areaId");
  if (!inspeccionId || !areaId) redirect("/panel/inspecciones");
  const { usuario, responsable } = await exigirResponsableV1(inspeccionId);
  await exigirAreaActivaV1(inspeccionId, areaId);

  const [area] = await prisma.$queryRaw<Array<{ nombre:string; hallazgos:number; completos:number; pendientes:number }>>`
    SELECT a."nombre",
      (SELECT COUNT(*)::int FROM "Hallazgo" h
       WHERE h."inspeccionId"=a."inspeccionId" AND h."area"=a."nombre") "hallazgos",
      (SELECT COUNT(*)::int FROM "Hallazgo" h
       WHERE h."inspeccionId"=a."inspeccionId" AND h."area"=a."nombre"
         AND nullif(btrim(coalesce(h."descripcion",'')),'') IS NOT NULL
         AND (SELECT COUNT(*) FROM "Fotografia" f WHERE f."hallazgoId"=h."id" AND f."inspeccionId"=a."inspeccionId") BETWEEN 1 AND 4) "completos",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g
       WHERE g."areaId"=a."id" AND g."obligatorio"=true AND g."estadoV3"='PENDIENTE') "pendientes"
    FROM "AreaInspeccion" a
    WHERE a."id"=${areaId}::uuid AND a."inspeccionId"=${inspeccionId}
  `;
  if (!area) volver(inspeccionId, "error", "Área no encontrada.");
  if (area.hallazgos < 1) volver(inspeccionId, "error", "Registra al menos un hallazgo antes de cerrar el punto con hallazgos.", areaId);
  if (Number(area.pendientes) > 0) volver(inspeccionId, "error", `Faltan ${area.pendientes} concepto(s) por resolver. El punto debe llegar al 100% antes de cerrarse.`, areaId);
  if (area.completos !== area.hallazgos) {
    volver(inspeccionId, "error", `Completa los hallazgos del punto: ${area.completos}/${area.hallazgos} tienen una descripción final y entre 1 y 4 evidencias.`, areaId);
  }

  const resumen = `Se registraron ${area.hallazgos} hallazgo(s) en ${area.nombre}. Los puntos aplicables fueron revisados y los hallazgos cuentan con la evidencia mínima requerida para su documentación.`;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "AreaInspeccion"
      SET "resultado"='CON_HALLAZGOS',"estado"='REVISADA',"comentarioFinal"=${resumen},"revisadaEn"=NOW(),"cerradaEn"=NOW(),"cerradaPorId"=${usuario.id},"actualizadoEn"=NOW()
      WHERE "id"=${areaId}::uuid AND "inspeccionId"=${inspeccionId}
    `;
  });

  await registrarAuditoria({ tipo: TipoEvento.EDITAR, entidad: "AreaInspeccion", entidadId: areaId, inspeccionId, usuarioId: usuario.id, descripcion: `${responsable} cerró el área “${area.nombre}” CON HALLAZGOS. Hallazgos documentados: ${area.hallazgos}.` });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/campo-v1`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/flujo`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/cierre-v1`);
  const siguiente = await siguienteAreaPendienteV1(inspeccionId);
  if (siguiente) volver(inspeccionId, "ok", `${area.nombre} cerrada al 100% con ${area.hallazgos} hallazgo(s). Continúa con el siguiente punto.`, siguiente);
  volver(inspeccionId, "ok", `${area.nombre} cerrada con ${area.hallazgos} hallazgo(s). Todas las áreas quedaron concluidas.`);
}
