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

function volver(id: string, tipo: "ok" | "error", mensaje: string): never {
  redirect(`/panel/inspecciones/${id}/campo-v1?${tipo}=${encodeURIComponent(mensaje)}`);
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
  if (["MANOMETRO_AGUA", "DETECTOR_GAS", "HERMETICIDAD_HIDRAULICA", "HERMETICIDAD_GAS"].includes(codigo)) return false;
  if (codigo === "CAMARA_TERMICA") return /(BANO|COCINA|LAVADO|LAVADERO|AZOTEA|SOTANO|CUARTO_SERVICIO)/.test(area);
  if (["PROBADOR_GFCI_RCD", "DETECTOR_VOLTAJE", "MULTIMETRO"].includes(codigo)) return !/(JARDIN|PATIO|AZOTEA)/.test(area);
  return true;
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
  const inspectorAsignado = usuario.rol === RolUsuario.INSPECTOR && Boolean(usuario.inspector?.activo) && inspeccion.inspectorId === usuario.inspector?.id;
  const directorPorAusencia = usuario.rol === RolUsuario.DIRECTOR && !inspeccion.inspectorId;
  if (!inspectorAsignado && !directorPorAusencia) redirect("/acceso");
  if (inspeccion.numeroInspeccion !== 1) volver(inspeccionId, "error", "Este recorrido guiado corresponde únicamente a V1.");
  if (inspeccion.estado !== EstadoInspeccion.EN_PROCESO) volver(inspeccionId, "error", "La captura técnica solo está disponible mientras V1 está EN PROCESO.");
  return { usuario, responsable: directorPorAusencia ? "Director por ausencia" : "Inspector" };
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
      const puntos = area.bibliotecaAreaId
        ? await tx.$queryRaw<Array<{ puntoId:string; nombre:string; descripcion:string|null; orden:number; obligatorio:boolean; requiereMedicion:boolean; requiereComparacionProyecto:boolean; herramientaSugerida:string|null }>>`
            SELECT p."id"::text "puntoId",p."nombre",p."descripcion",ap."orden",ap."obligatorio",p."requiereMedicion",p."requiereComparacionProyecto",p."herramientaSugerida"
            FROM "BibliotecaAreaPuntoCerteza" ap JOIN "BibliotecaPuntoCerteza" p ON p."id"=ap."puntoBibliotecaId"
            WHERE ap."areaBibliotecaId"=${area.bibliotecaAreaId}::uuid AND p."activa"=true ORDER BY ap."orden"
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
  if (motivo.length < 3) volver(inspeccionId, "error", "Indica brevemente por qué el punto no aplica.");
  const n = await prisma.$executeRaw`UPDATE "GuiaInspeccionItem" SET "estadoV3"='NO_APLICA',"motivoNoAplica"=${motivo},"completado"=true,"cerradoEn"=NOW(),"actualizadoEn"=NOW() WHERE "id"=${itemId} AND "inspeccionId"=${inspeccionId} AND "estadoV3"='PENDIENTE'`;
  if (!n) volver(inspeccionId, "error", "El punto ya fue atendido o no pertenece a esta inspección.");
  await registrarAuditoria({ tipo: TipoEvento.EDITAR, entidad: "GuiaInspeccionItem", entidadId: itemId, inspeccionId, usuarioId: usuario.id, descripcion: `${responsable} marcó punto V1 NO APLICA. Motivo: ${motivo}` });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/campo-v1`);
  volver(inspeccionId, "ok", "Punto excluido justificadamente del alcance efectivo.");
}

export async function agregarPuntoInspectorV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const areaId = texto(formData, "areaId");
  const concepto = texto(formData, "concepto");
  if (!inspeccionId || !areaId || !concepto) redirect("/panel/inspecciones");
  const { usuario, responsable } = await exigirResponsableV1(inspeccionId);
  const [area] = await prisma.$queryRaw<Array<{ nombre:string; siguiente:number }>>`
    SELECT a."nombre",COALESCE(MAX(g."orden"),0)::int+10 "siguiente" FROM "AreaInspeccion" a LEFT JOIN "GuiaInspeccionItem" g ON g."areaId"=a."id" WHERE a."id"=${areaId}::uuid AND a."inspeccionId"=${inspeccionId} GROUP BY a."id",a."nombre"
  `;
  if (!area) volver(inspeccionId, "error", "Área no encontrada.");
  const id = randomUUID();
  await prisma.$executeRaw`INSERT INTO "GuiaInspeccionItem" ("id","inspeccionId","origen","area","concepto","orden","obligatorio","completado","creadoPorId","areaId","estadoV3","origenV3","creadoEn","actualizadoEn") VALUES (${id},${inspeccionId},'INSPECTOR',${area.nombre},${concepto},${area.siguiente},true,false,${usuario.id},${areaId}::uuid,'PENDIENTE','INSPECTOR',NOW(),NOW())`;
  await registrarAuditoria({ tipo: TipoEvento.CREAR, entidad: "GuiaInspeccionItem", entidadId: id, inspeccionId, usuarioId: usuario.id, descripcion: `${responsable} agregó el punto adicional “${concepto}” en ${area.nombre}.` });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/campo-v1`);
  volver(inspeccionId, "ok", "Punto adicional incorporado al plan V1.");
}

export async function cerrarAreaSinHallazgosV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const areaId = texto(formData, "areaId");
  if (!inspeccionId || !areaId) redirect("/panel/inspecciones");
  const { usuario, responsable } = await exigirResponsableV1(inspeccionId);
  const [area] = await prisma.$queryRaw<Array<{ nombre:string; fotos:number; seleccionadas:number; pendientes:number; hallazgos:number }>>`
    SELECT a."nombre",
      (SELECT COUNT(*)::int FROM "FotografiaArea" fa WHERE fa."areaId"=a."id") "fotos",
      (SELECT COUNT(*)::int FROM "FotografiaArea" fa WHERE fa."areaId"=a."id" AND fa."seleccionadaReporte"=true) "seleccionadas",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id" AND g."obligatorio"=true AND g."estadoV3"='PENDIENTE') "pendientes",
      (SELECT COUNT(*)::int FROM "Hallazgo" h WHERE h."inspeccionId"=a."inspeccionId" AND h."area"=a."nombre") "hallazgos"
    FROM "AreaInspeccion" a WHERE a."id"=${areaId}::uuid AND a."inspeccionId"=${inspeccionId}
  `;
  if (!area) volver(inspeccionId, "error", "Área no encontrada.");
  if (area.hallazgos > 0) volver(inspeccionId, "error", "El área contiene hallazgos y debe cerrarse por el flujo correspondiente.");
  if (area.fotos < 1) volver(inspeccionId, "error", "Toma al menos una fotografía representativa del área.");

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "GuiaInspeccionItem"
      SET "estadoV3"='REVISADO',"completado"=true,"cerradoEn"=NOW(),"actualizadoEn"=NOW()
      WHERE "areaId"=${areaId}::uuid AND "inspeccionId"=${inspeccionId} AND "estadoV3"='PENDIENTE'
    `;
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

  await registrarAuditoria({ tipo: TipoEvento.EDITAR, entidad: "AreaInspeccion", entidadId: areaId, inspeccionId, usuarioId: usuario.id, descripcion: `${responsable} cerró el área “${area.nombre}” SIN HALLAZGOS; los puntos aplicables pendientes quedaron confirmados como revisados.` });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/campo-v1`);
  volver(inspeccionId, "ok", `${area.nombre} cerrada sin hallazgos.`);
}

export async function cerrarAreaConHallazgosV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const areaId = texto(formData, "areaId");
  if (!inspeccionId || !areaId) redirect("/panel/inspecciones");
  const { usuario, responsable } = await exigirResponsableV1(inspeccionId);

  const [area] = await prisma.$queryRaw<Array<{ nombre:string; hallazgos:number; completos:number }>>`
    SELECT a."nombre",
      (SELECT COUNT(*)::int FROM "Hallazgo" h
       WHERE h."inspeccionId"=a."inspeccionId" AND h."area"=a."nombre") "hallazgos",
      (SELECT COUNT(*)::int FROM "Hallazgo" h
       WHERE h."inspeccionId"=a."inspeccionId" AND h."area"=a."nombre"
         AND nullif(btrim(coalesce(h."descripcion",'')),'') IS NOT NULL
         AND (SELECT COUNT(*) FROM "Fotografia" f WHERE f."hallazgoId"=h."id" AND f."inspeccionId"=a."inspeccionId") >= 4) "completos"
    FROM "AreaInspeccion" a
    WHERE a."id"=${areaId}::uuid AND a."inspeccionId"=${inspeccionId}
  `;
  if (!area) volver(inspeccionId, "error", "Área no encontrada.");
  if (area.hallazgos < 1) volver(inspeccionId, "error", "Registra al menos un hallazgo antes de cerrar el área con hallazgos.");
  if (area.completos !== area.hallazgos) {
    volver(inspeccionId, "error", `Completa los hallazgos del área: ${area.completos}/${area.hallazgos} tienen descripción y mínimo 4 evidencias.`);
  }

  const resumen = `Se registraron ${area.hallazgos} hallazgo(s) en ${area.nombre}. Los puntos aplicables fueron revisados y los hallazgos cuentan con la evidencia mínima requerida para su documentación.`;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "GuiaInspeccionItem"
      SET "estadoV3"='REVISADO',"completado"=true,"cerradoEn"=NOW(),"actualizadoEn"=NOW()
      WHERE "areaId"=${areaId}::uuid AND "inspeccionId"=${inspeccionId} AND "estadoV3"='PENDIENTE'
    `;
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
  volver(inspeccionId, "ok", `${area.nombre} cerrada con ${area.hallazgos} hallazgo(s).`);
}
