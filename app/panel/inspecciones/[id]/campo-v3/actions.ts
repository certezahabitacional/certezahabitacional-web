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
  redirect(`/panel/inspecciones/${id}/campo-v3?${tipo}=${encodeURIComponent(mensaje)}`);
}

function slug(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
}

async function exigirInspector(inspeccionId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, rol: true, activo: true, inspector: { select: { id: true, activo: true } } },
  });
  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: { id: true, estado: true, inspectorId: true },
  });
  if (!usuario?.activo || usuario.rol !== RolUsuario.INSPECTOR || !usuario.inspector?.activo) redirect("/acceso");
  if (!inspeccion || inspeccion.inspectorId !== usuario.inspector.id) redirect("/acceso");
  if (inspeccion.estado !== EstadoInspeccion.EN_PROCESO) volver(inspeccionId, "error", "La captura técnica solo está disponible mientras la inspección está EN PROCESO.");
  return usuario;
}

export async function inicializarPlanAreasV3(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  if (!inspeccionId) redirect("/panel/inspecciones");
  const usuario = await exigirInspector(inspeccionId);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "AreaInspeccion" a
      SET "bibliotecaAreaId" = b."id"
      FROM "BibliotecaAreaCerteza" b
      WHERE a."inspeccionId"=${inspeccionId}
        AND a."bibliotecaAreaId" IS NULL
        AND (
          b."codigo" = a."codigo"
          OR b."codigo" = regexp_replace(upper(unaccent(a."nombre")), '[^A-Z0-9]+', '_', 'g')
        )
    `;

    const areas = await tx.$queryRaw<Array<{ id: string; nombre: string; bibliotecaAreaId: string | null }>>`
      SELECT "id"::text,"nombre","bibliotecaAreaId"::text FROM "AreaInspeccion"
      WHERE "inspeccionId"=${inspeccionId} ORDER BY "orden"
    `;

    for (const area of areas) {
      if (!area.bibliotecaAreaId) continue;
      const puntos = await tx.$queryRaw<Array<{
        puntoId: string; grupo: string; nombre: string; descripcion: string | null; orden: number;
        obligatorio: boolean; requiereMedicion: boolean; requiereComparacionProyecto: boolean; herramientaSugerida: string | null;
      }>>`
        SELECT p."id"::text AS "puntoId",p."grupo",p."nombre",p."descripcion",ap."orden",ap."obligatorio",
               p."requiereMedicion",p."requiereComparacionProyecto",p."herramientaSugerida"
        FROM "BibliotecaAreaPuntoCerteza" ap
        JOIN "BibliotecaPuntoCerteza" p ON p."id"=ap."puntoBibliotecaId"
        WHERE ap."areaBibliotecaId"=${area.bibliotecaAreaId}::uuid AND p."activa"=true
        ORDER BY ap."orden"
      `;
      for (const punto of puntos) {
        await tx.$executeRaw`
          INSERT INTO "GuiaInspeccionItem"
            ("id","inspeccionId","origen","area","concepto","especificacion","orden","obligatorio","completado","creadoPorId","areaId",
             "bibliotecaPuntoId","estadoV3","origenV3","requiereMedicion","requiereComparacionProyecto","herramientaSugerida","creadoEn","actualizadoEn")
          SELECT ${randomUUID()},${inspeccionId},'BIBLIOTECA_CERTEZA',${area.nombre},${punto.nombre},${punto.descripcion},${punto.orden},${punto.obligatorio},false,${usuario.id},${area.id}::uuid,
                 ${punto.puntoId}::uuid,'PENDIENTE','BIBLIOTECA',${punto.requiereMedicion},${punto.requiereComparacionProyecto},${punto.herramientaSugerida},NOW(),NOW()
          WHERE NOT EXISTS (
            SELECT 1 FROM "GuiaInspeccionItem" g WHERE g."inspeccionId"=${inspeccionId} AND g."areaId"=${area.id}::uuid AND g."bibliotecaPuntoId"=${punto.puntoId}::uuid
          )
        `;
      }
    }
  });

  await registrarAuditoria({ tipo: TipoEvento.CREAR, entidad: "GuiaInspeccionItem", inspeccionId, usuarioId: usuario.id, descripcion: "Se inicializó el plan V3 desde la Biblioteca Certeza para las áreas reconocidas." });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/campo-v3`);
  volver(inspeccionId, "ok", "Plan técnico V3 generado. Los puntos mínimos ya están listos para revisión.");
}

export async function marcarPuntoNoAplicaV3(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const itemId = texto(formData, "itemId");
  const motivo = texto(formData, "motivo");
  if (!inspeccionId || !itemId) redirect("/panel/inspecciones");
  const usuario = await exigirInspector(inspeccionId);
  if (motivo.length < 3) volver(inspeccionId, "error", "Indica brevemente por qué el punto no aplica.");

  const updated = await prisma.$executeRaw`
    UPDATE "GuiaInspeccionItem" SET "estadoV3"='NO_APLICA',"motivoNoAplica"=${motivo},"completado"=true,"cerradoEn"=NOW(),"actualizadoEn"=NOW()
    WHERE "id"=${itemId} AND "inspeccionId"=${inspeccionId} AND "estadoV3"='PENDIENTE'
  `;
  if (!updated) volver(inspeccionId, "error", "El punto ya fue atendido o no pertenece a esta inspección.");
  await registrarAuditoria({ tipo: TipoEvento.EDITAR, entidad: "GuiaInspeccionItem", entidadId: itemId, inspeccionId, usuarioId: usuario.id, descripcion: `Punto marcado NO APLICA. Motivo: ${motivo}` });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/campo-v3`);
  volver(inspeccionId, "ok", "Punto excluido justificadamente del alcance efectivo.");
}

export async function agregarPuntoInspectorV3(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const areaId = texto(formData, "areaId");
  const concepto = texto(formData, "concepto");
  if (!inspeccionId || !areaId || !concepto) redirect("/panel/inspecciones");
  const usuario = await exigirInspector(inspeccionId);

  const [area] = await prisma.$queryRaw<Array<{ nombre: string; siguiente: number }>>`
    SELECT a."nombre",COALESCE(MAX(g."orden"),0)::int+10 AS "siguiente"
    FROM "AreaInspeccion" a LEFT JOIN "GuiaInspeccionItem" g ON g."areaId"=a."id"
    WHERE a."id"=${areaId}::uuid AND a."inspeccionId"=${inspeccionId}
    GROUP BY a."id",a."nombre"
  `;
  if (!area) volver(inspeccionId, "error", "Área no encontrada.");
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "GuiaInspeccionItem"
      ("id","inspeccionId","origen","area","concepto","orden","obligatorio","completado","creadoPorId","areaId","estadoV3","origenV3","creadoEn","actualizadoEn")
    VALUES (${id},${inspeccionId},'INSPECTOR',${area.nombre},${concepto},${area.siguiente},true,false,${usuario.id},${areaId}::uuid,'PENDIENTE','INSPECTOR',NOW(),NOW())
  `;
  await registrarAuditoria({ tipo: TipoEvento.CREAR, entidad: "GuiaInspeccionItem", entidadId: id, inspeccionId, usuarioId: usuario.id, descripcion: `Inspector agregó el punto adicional “${concepto}” en ${area.nombre}.` });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/campo-v3`);
  volver(inspeccionId, "ok", "Punto adicional incorporado al plan y sujeto al mismo protocolo de evidencia.");
}

export async function cerrarAreaSinHallazgosV3(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const areaId = texto(formData, "areaId");
  if (!inspeccionId || !areaId) redirect("/panel/inspecciones");
  const usuario = await exigirInspector(inspeccionId);

  const [area] = await prisma.$queryRaw<Array<{ nombre: string; fotos: number; seleccionadas: number; pendientes: number; hallazgos: number }>>`
    SELECT a."nombre",
      (SELECT COUNT(*)::int FROM "FotografiaArea" fa WHERE fa."areaId"=a."id") AS "fotos",
      (SELECT COUNT(*)::int FROM "FotografiaArea" fa WHERE fa."areaId"=a."id" AND fa."seleccionadaReporte"=true) AS "seleccionadas",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id" AND g."obligatorio"=true AND g."estadoV3"='PENDIENTE') AS "pendientes",
      (SELECT COUNT(*)::int FROM "Hallazgo" h WHERE h."areaId"=a."id") AS "hallazgos"
    FROM "AreaInspeccion" a WHERE a."id"=${areaId}::uuid AND a."inspeccionId"=${inspeccionId}
  `;
  if (!area) volver(inspeccionId, "error", "Área no encontrada.");
  if (Number(area.hallazgos) > 0) volver(inspeccionId, "error", "Esta área ya tiene hallazgos; debe cerrarse por el flujo con hallazgos.");
  if (Number(area.pendientes) > 0) volver(inspeccionId, "error", `Faltan ${area.pendientes} punto(s) por revisar o marcar No aplica.`);
  if (Number(area.fotos) < 1) volver(inspeccionId, "error", "Toma al menos una fotografía que acredite la revisión del área.");

  if (Number(area.seleccionadas) === 0) {
    await prisma.$executeRaw`
      UPDATE "FotografiaArea" SET "seleccionadaReporte"=true
      WHERE "id" IN (SELECT "id" FROM "FotografiaArea" WHERE "areaId"=${areaId}::uuid ORDER BY "orden","creadoEn" LIMIT 4)
    `;
  }

  const [textoAuto] = await prisma.$queryRaw<Array<{ texto: string }>>`
    SELECT 'Se realizó la inspección de ' || a."nombre" || ' conforme al plan establecido, incluyendo los puntos mínimos aplicables. No se identificaron anomalías relevantes en los elementos revisados y el área se considera en condiciones aceptables conforme al alcance de la inspección y al criterio técnico del Inspector.' AS texto
    FROM "AreaInspeccion" a WHERE a."id"=${areaId}::uuid
  `;

  await prisma.$executeRaw`
    UPDATE "AreaInspeccion" SET "resultado"='SIN_HALLAZGOS',"estado"='REVISADA',"textoSinHallazgo"=${textoAuto?.texto ?? ''},
      "comentarioFinal"=${textoAuto?.texto ?? ''},"revisadaEn"=NOW(),"cerradaEn"=NOW(),"cerradaPorId"=${usuario.id},"actualizadoEn"=NOW()
    WHERE "id"=${areaId}::uuid AND "inspeccionId"=${inspeccionId}
  `;
  await registrarAuditoria({ tipo: TipoEvento.EDITAR, entidad: "AreaInspeccion", entidadId: areaId, inspeccionId, usuarioId: usuario.id, descripcion: `Área “${area.nombre}” cerrada SIN HALLAZGOS mediante cierre rápido V3.` });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/campo-v3`);
  volver(inspeccionId, "ok", `${area.nombre} cerrada sin hallazgos. El texto del reporte fue generado automáticamente.`);
}
