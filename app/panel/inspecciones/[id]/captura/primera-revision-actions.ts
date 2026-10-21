"use server";

import { randomUUID } from "node:crypto";
import { EstadoInspeccion, RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? "").trim();

function volver(inspeccionId: string, tipo: "ok" | "error", mensaje: string): never {
  redirect(`/panel/inspecciones/${inspeccionId}/captura?${tipo}=${encodeURIComponent(mensaje)}`);
}

async function asegurarAreaSeguimiento(
  inspeccionId: string,
  areaNombre: string,
  orden: number,
): Promise<string> {
  const [existente] = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"::text
    FROM "AreaInspeccion"
    WHERE "inspeccionId"=${inspeccionId}
      AND "nombre"=${areaNombre}
      AND "tipo"='SEGUIMIENTO'
    ORDER BY "creadoEn"
    LIMIT 1
  `;
  if (existente?.id) return existente.id;

  const areaId = randomUUID();
  const codigo = `SEG_${String(Math.max(0, orden)).padStart(3, "0")}_${areaId.slice(0, 8)}`;
  await prisma.$executeRaw`
    INSERT INTO "AreaInspeccion"
      ("id","inspeccionId","codigo","nombre","tipo","orden","origen","obligatoria",
       "estado","creadoEn","actualizadoEn","excluirReporte")
    VALUES
      (${areaId}::uuid,${inspeccionId},${codigo},${areaNombre},'SEGUIMIENTO',${orden},
       'INSPECTOR',false,'PENDIENTE',NOW(),NOW(),false)
  `;
  return areaId;
}

export async function registrarPrimeraRevisionV2(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const inspeccionId = texto(formData, "inspeccionId");
  const antecedenteItemId = texto(formData, "antecedenteItemId");
  const resultado = texto(formData, "resultado");
  const observacion = texto(formData, "observacion");

  if (!inspeccionId || !antecedenteItemId) redirect("/panel/inspecciones");
  if (!["SIN_HALLAZGO", "CON_HALLAZGO"].includes(resultado)) {
    volver(inspeccionId, "error", "Selecciona un resultado válido para la primera revisión.");
  }
  if (observacion.length < 3) {
    volver(inspeccionId, "error", "Describe brevemente lo observado en la primera revisión de V2.");
  }

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
        numeroInspeccion: true,
        inspeccionAnteriorId: true,
        estado: true,
        inspectorId: true,
      },
    }),
  ]);

  if (!usuario?.activo) redirect("/acceso");
  const esDirector = usuario.rol === RolUsuario.DIRECTOR;
  const esInspectorOperativo =
    usuario.rol === RolUsuario.INSPECTOR && Boolean(usuario.inspector?.activo);
  if (!esDirector && !esInspectorOperativo) redirect("/acceso");
  if (!inspeccion || inspeccion.numeroInspeccion <= 1 || !inspeccion.inspeccionAnteriorId) {
    volver(inspeccionId, "error", "Esta opción solo está disponible en V2 y visitas posteriores.");
  }
  if (inspeccion.estado !== EstadoInspeccion.EN_PROCESO) {
    volver(inspeccionId, "error", "La primera revisión solo puede registrarse mientras la visita está EN PROCESO.");
  }
  if (
    usuario.rol === RolUsuario.INSPECTOR &&
    inspeccion.inspectorId !== usuario.inspector?.id
  ) redirect("/acceso");

  const [antecedente] = await prisma.$queryRaw<Array<{
    id: string;
    area: string;
    concepto: string;
    especificacion: string | null;
    orden: number;
    motivoNoAplica: string | null;
    estadoV3: string;
    tuvoHallazgo: boolean;
    requiereMedicion: boolean;
    requiereComparacionProyecto: boolean;
    herramientaSugerida: string | null;
    valorProyecto: string | null;
    unidadMedida: string | null;
  }>>`
    SELECT g."id",g."area",g."concepto",g."especificacion",g."orden",g."motivoNoAplica",g."estadoV3",
           g."requiereMedicion",g."requiereComparacionProyecto",g."herramientaSugerida",g."valorProyecto",g."unidadMedida",
           EXISTS (
             SELECT 1 FROM "Hallazgo" h
             WHERE h."inspeccionId"=g."inspeccionId"
               AND h."guiaItemId"=g."id"
           ) AS "tuvoHallazgo"
    FROM "GuiaInspeccionItem" g
    WHERE g."id"=${antecedenteItemId}
      AND g."inspeccionId"=${inspeccion.inspeccionAnteriorId}
    LIMIT 1
  `;

  if (!antecedente) {
    volver(inspeccionId, "error", "El concepto no pertenece a la inspección anterior.");
  }
  if (antecedente.tuvoHallazgo) {
    volver(inspeccionId, "error", "Este concepto tiene un hallazgo antecedente. Atiéndelo desde Seguimiento de pendientes.");
  }

  const patron = `%"antecedenteItemId":"${antecedenteItemId}"%`;
  const existentes = await prisma.$queryRaw<Array<{ id: string; areaId: string | null }>>`
    SELECT "id","areaId"::text AS "areaId"
    FROM "GuiaInspeccionItem"
    WHERE "inspeccionId"=${inspeccionId}
      AND COALESCE("observacion",'') LIKE ${patron}
    LIMIT 1
  `;

  if (existentes[0]) {
    if (resultado === "CON_HALLAZGO") {
      const areaIdExistente =
        existentes[0].areaId ??
        await asegurarAreaSeguimiento(inspeccionId, antecedente.area, antecedente.orden);
      if (!existentes[0].areaId) {
        await prisma.$executeRaw`
          UPDATE "GuiaInspeccionItem"
          SET "areaId"=${areaIdExistente}::uuid,"actualizadoEn"=NOW()
          WHERE "id"=${existentes[0].id} AND "inspeccionId"=${inspeccionId}
        `;
      }
      redirect(`/panel/inspecciones/${inspeccionId}/captura?primeraRevisionItemId=${encodeURIComponent(existentes[0].id)}#item-${existentes[0].id}`);
    }
    volver(inspeccionId, "error", "Este concepto ya tiene una revisión registrada en la visita actual.");
  }

  const itemId = randomUUID();
  const areaIdSeguimiento =
    resultado === "CON_HALLAZGO"
      ? await asegurarAreaSeguimiento(inspeccionId, antecedente.area, antecedente.orden)
      : null;
  const metadata = JSON.stringify({
    tipo: antecedente.estadoV3 === "NO_APLICA" ? "PRIMERA_REVISION_V2" : "REVISION_CONCEPTO_V2",
    antecedenteItemId,
    visita: inspeccion.numeroInspeccion,
    resultado,
    observacion,
  });

  await prisma.$executeRaw`
    INSERT INTO "GuiaInspeccionItem"
      ("id","inspeccionId","origen","area","concepto","especificacion","orden","obligatorio",
       "completado","creadoPorId","areaId","estadoV3","origenV3","observacion","cerradoEn",
       "requiereMedicion","requiereComparacionProyecto","herramientaSugerida","valorProyecto","unidadMedida",
       "creadoEn","actualizadoEn")
    VALUES
      (${itemId},${inspeccionId},'INSPECTOR',${antecedente.area},${antecedente.concepto},
       ${antecedente.especificacion},${antecedente.orden},true,
       ${resultado === "SIN_HALLAZGO"},${usuario.id},${areaIdSeguimiento}::uuid,
       ${resultado === "SIN_HALLAZGO" ? "REVISADO" : "PENDIENTE"},
       'INSPECTOR',${metadata},${resultado === "SIN_HALLAZGO" ? new Date() : null},
       ${antecedente.requiereMedicion},${antecedente.requiereComparacionProyecto},
       ${antecedente.herramientaSugerida},${antecedente.valorProyecto},${antecedente.unidadMedida},
       NOW(),NOW())
  `;

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "GuiaInspeccionItem",
    entidadId: itemId,
    inspeccionId,
    usuarioId: usuario.id,
    descripcion:
      resultado === "SIN_HALLAZGO"
        ? `${antecedente.estadoV3 === "NO_APLICA" ? "Primera revisión" : "Revisión"} en V${inspeccion.numeroInspeccion} del concepto “${antecedente.concepto}”. Resultado: sin hallazgo. Observación: ${observacion}`
        : `${antecedente.estadoV3 === "NO_APLICA" ? "Primera revisión" : "Revisión"} en V${inspeccion.numeroInspeccion} del concepto “${antecedente.concepto}”. Se requiere documentar hallazgo nuevo. Observación: ${observacion}`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/captura`);

  if (resultado === "CON_HALLAZGO") {
    redirect(
      `/panel/inspecciones/${inspeccionId}/captura?primeraRevisionItemId=${encodeURIComponent(itemId)}#item-${itemId}`,
    );
  }

  volver(inspeccionId, "ok", `Primera revisión en V${inspeccion.numeroInspeccion} registrada sin hallazgo.`);
}
