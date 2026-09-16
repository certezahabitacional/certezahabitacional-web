"use server";

import { randomUUID } from "node:crypto";
import { EstadoInspeccion, RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? "").trim();

function volver(id: string, tipo: "ok" | "error", mensaje: string): never {
  redirect(`/panel/inspecciones/${id}/campo-v1?${tipo}=${encodeURIComponent(mensaje)}`);
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
    select: { id: true, numeroInspeccion: true, estado: true, inspectorId: true },
  });
  if (!usuario?.activo || usuario.rol !== RolUsuario.INSPECTOR || !usuario.inspector?.activo) redirect("/acceso");
  if (!inspeccion || inspeccion.inspectorId !== usuario.inspector.id) redirect("/acceso");
  if (inspeccion.numeroInspeccion !== 1) volver(inspeccionId, "error", "Este recorrido guiado corresponde únicamente a V1.");
  if (inspeccion.estado !== EstadoInspeccion.EN_PROCESO) volver(inspeccionId, "error", "La captura técnica solo está disponible mientras V1 está EN PROCESO.");
  return usuario;
}

export async function inicializarPlanAreasV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  if (!inspeccionId) redirect("/panel/inspecciones");
  const usuario = await exigirInspectorV1(inspeccionId);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "AreaInspeccion" a
      SET "bibliotecaAreaId" = b."id"
      FROM "BibliotecaAreaCerteza" b
      WHERE a."inspeccionId"=${inspeccionId} AND a."bibliotecaAreaId" IS NULL
        AND (b."codigo"=a."codigo" OR b."codigo"=regexp_replace(upper(unaccent(a."nombre")), '[^A-Z0-9]+', '_', 'g'))
    `;
    const areas = await tx.$queryRaw<Array<{ id: string; nombre: string; bibliotecaAreaId: string | null }>>`
      SELECT "id"::text,"nombre","bibliotecaAreaId"::text FROM "AreaInspeccion" WHERE "inspeccionId"=${inspeccionId} ORDER BY "orden"
    `;
    for (const area of areas) {
      if (!area.bibliotecaAreaId) continue;
      const puntos = await tx.$queryRaw<Array<{ puntoId:string; nombre:string; descripcion:string|null; orden:number; obligatorio:boolean; requiereMedicion:boolean; requiereComparacionProyecto:boolean; herramientaSugerida:string|null }>>`
        SELECT p."id"::text "puntoId",p."nombre",p."descripcion",ap."orden",ap."obligatorio",p."requiereMedicion",p."requiereComparacionProyecto",p."herramientaSugerida"
        FROM "BibliotecaAreaPuntoCerteza" ap JOIN "BibliotecaPuntoCerteza" p ON p."id"=ap."puntoBibliotecaId"
        WHERE ap."areaBibliotecaId"=${area.bibliotecaAreaId}::uuid AND p."activa"=true ORDER BY ap."orden"
      `;
      for (const p of puntos) {
        await tx.$executeRaw`
          INSERT INTO "GuiaInspeccionItem" ("id","inspeccionId","origen","area","concepto","especificacion","orden","obligatorio","completado","creadoPorId","areaId","bibliotecaPuntoId","estadoV3","origenV3","requiereMedicion","requiereComparacionProyecto","herramientaSugerida","creadoEn","actualizadoEn")
          SELECT ${randomUUID()},${inspeccionId},'BIBLIOTECA_CERTEZA',${area.nombre},${p.nombre},${p.descripcion},${p.orden},${p.obligatorio},false,${usuario.id},${area.id}::uuid,${p.puntoId}::uuid,'PENDIENTE','BIBLIOTECA',${p.requiereMedicion},${p.requiereComparacionProyecto},${p.herramientaSugerida},NOW(),NOW()
          WHERE NOT EXISTS (SELECT 1 FROM "GuiaInspeccionItem" g WHERE g."inspeccionId"=${inspeccionId} AND g."areaId"=${area.id}::uuid AND g."bibliotecaPuntoId"=${p.puntoId}::uuid)
        `;
      }
    }
  });
  await registrarAuditoria({ tipo: TipoEvento.CREAR, entidad: "GuiaInspeccionItem", inspeccionId, usuarioId: usuario.id, descripcion: "Se inicializó el plan V1 desde la Biblioteca Certeza." });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/campo-v1`);
  volver(inspeccionId, "ok", "Plan técnico V1 preparado con los puntos mínimos aplicables.");
}

export async function marcarPuntoNoAplicaV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const itemId = texto(formData, "itemId");
  const motivo = texto(formData, "motivo");
  if (!inspeccionId || !itemId) redirect("/panel/inspecciones");
  const usuario = await exigirInspectorV1(inspeccionId);
  if (motivo.length < 3) volver(inspeccionId, "error", "Indica brevemente por qué el punto no aplica.");
  const n = await prisma.$executeRaw`UPDATE "GuiaInspeccionItem" SET "estadoV3"='NO_APLICA',"motivoNoAplica"=${motivo},"completado"=true,"cerradoEn"=NOW(),"actualizadoEn"=NOW() WHERE "id"=${itemId} AND "inspeccionId"=${inspeccionId} AND "estadoV3"='PENDIENTE'`;
  if (!n) volver(inspeccionId, "error", "El punto ya fue atendido o no pertenece a esta inspección.");
  await registrarAuditoria({ tipo: TipoEvento.EDITAR, entidad: "GuiaInspeccionItem", entidadId: itemId, inspeccionId, usuarioId: usuario.id, descripcion: `Punto V1 marcado NO APLICA. Motivo: ${motivo}` });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/campo-v1`);
  volver(inspeccionId, "ok", "Punto excluido justificadamente del alcance efectivo.");
}

export async function agregarPuntoInspectorV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const areaId = texto(formData, "areaId");
  const concepto = texto(formData, "concepto");
  if (!inspeccionId || !areaId || !concepto) redirect("/panel/inspecciones");
  const usuario = await exigirInspectorV1(inspeccionId);
  const [area] = await prisma.$queryRaw<Array<{ nombre:string; siguiente:number }>>`
    SELECT a."nombre",COALESCE(MAX(g."orden"),0)::int+10 "siguiente" FROM "AreaInspeccion" a LEFT JOIN "GuiaInspeccionItem" g ON g."areaId"=a."id" WHERE a."id"=${areaId}::uuid AND a."inspeccionId"=${inspeccionId} GROUP BY a."id",a."nombre"
  `;
  if (!area) volver(inspeccionId, "error", "Área no encontrada.");
  const id = randomUUID();
  await prisma.$executeRaw`INSERT INTO "GuiaInspeccionItem" ("id","inspeccionId","origen","area","concepto","orden","obligatorio","completado","creadoPorId","areaId","estadoV3","origenV3","creadoEn","actualizadoEn") VALUES (${id},${inspeccionId},'INSPECTOR',${area.nombre},${concepto},${area.siguiente},true,false,${usuario.id},${areaId}::uuid,'PENDIENTE','INSPECTOR',NOW(),NOW())`;
  await registrarAuditoria({ tipo: TipoEvento.CREAR, entidad: "GuiaInspeccionItem", entidadId: id, inspeccionId, usuarioId: usuario.id, descripcion: `Inspector agregó el punto adicional “${concepto}” en ${area.nombre}.` });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/campo-v1`);
  volver(inspeccionId, "ok", "Punto adicional incorporado al plan V1.");
}

export async function cerrarAreaSinHallazgosV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const areaId = texto(formData, "areaId");
  if (!inspeccionId || !areaId) redirect("/panel/inspecciones");
  const usuario = await exigirInspectorV1(inspeccionId);
  const [area] = await prisma.$queryRaw<Array<{ nombre:string; fotos:number; seleccionadas:number; pendientes:number; hallazgos:number }>>`
    SELECT a."nombre",
      (SELECT COUNT(*)::int FROM "FotografiaArea" fa WHERE fa."areaId"=a."id") "fotos",
      (SELECT COUNT(*)::int FROM "FotografiaArea" fa WHERE fa."areaId"=a."id" AND fa."seleccionadaReporte"=true) "seleccionadas",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id" AND g."obligatorio"=true AND g."estadoV3"='PENDIENTE') "pendientes",
      (SELECT COUNT(*)::int FROM "Hallazgo" h WHERE h."areaId"=a."id") "hallazgos"
    FROM "AreaInspeccion" a WHERE a."id"=${areaId}::uuid AND a."inspeccionId"=${inspeccionId}
  `;
  if (!area) volver(inspeccionId, "error", "Área no encontrada.");
  if (area.hallazgos > 0) volver(inspeccionId, "error", "El área contiene hallazgos y debe cerrarse por el flujo correspondiente.");
  if (area.pendientes > 0) volver(inspeccionId, "error", `Faltan ${area.pendientes} punto(s) por revisar o marcar No aplica.`);
  if (area.fotos < 1) volver(inspeccionId, "error", "Toma al menos una fotografía representativa del área.");
  if (area.seleccionadas === 0) await prisma.$executeRaw`UPDATE "FotografiaArea" SET "seleccionadaReporte"=true WHERE "id" IN (SELECT "id" FROM "FotografiaArea" WHERE "areaId"=${areaId}::uuid ORDER BY "orden","creadoEn" LIMIT 4)`;
  const [auto] = await prisma.$queryRaw<Array<{ texto:string }>>`
    SELECT 'Se realizó la inspección de '||a."nombre"||' conforme al plan establecido y a los puntos mínimos aplicables. No se identificaron anomalías relevantes en los elementos revisados, de acuerdo con el alcance de la inspección y el criterio técnico del Inspector.' "texto" FROM "AreaInspeccion" a WHERE a."id"=${areaId}::uuid
  `;
  await prisma.$executeRaw`UPDATE "AreaInspeccion" SET "resultado"='SIN_HALLAZGOS',"estado"='REVISADA',"textoSinHallazgo"=${auto?.texto ?? ''},"comentarioFinal"=${auto?.texto ?? ''},"revisadaEn"=NOW(),"cerradaEn"=NOW(),"cerradaPorId"=${usuario.id},"actualizadoEn"=NOW() WHERE "id"=${areaId}::uuid AND "inspeccionId"=${inspeccionId}`;
  await registrarAuditoria({ tipo: TipoEvento.EDITAR, entidad: "AreaInspeccion", entidadId: areaId, inspeccionId, usuarioId: usuario.id, descripcion: `Área “${area.nombre}” cerrada SIN HALLAZGOS mediante cierre rápido V1.` });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/campo-v1`);
  volver(inspeccionId, "ok", `${area.nombre} cerrada sin hallazgos.`);
}
