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
  }>>`
    SELECT "id","area","concepto","especificacion","orden","motivoNoAplica"
    FROM "GuiaInspeccionItem"
    WHERE "id"=${antecedenteItemId}
      AND "inspeccionId"=${inspeccion.inspeccionAnteriorId}
      AND "estadoV3"='NO_APLICA'
      AND COALESCE("motivoNoAplica",'') LIKE '[PARTIDA_COMPLETA:%'
    LIMIT 1
  `;

  if (!antecedente) {
    volver(inspeccionId, "error", "El concepto no corresponde a un punto pendiente de primera revisión.");
  }

  const patron = `%"antecedenteItemId":"${antecedenteItemId}"%`;
  const existentes = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "GuiaInspeccionItem"
    WHERE "inspeccionId"=${inspeccionId}
      AND COALESCE("observacion",'') LIKE ${patron}
    LIMIT 1
  `;

  if (existentes[0]) {
    volver(inspeccionId, "error", "Este concepto ya tiene una primera revisión registrada en la visita actual.");
  }

  const itemId = randomUUID();
  const metadata = JSON.stringify({
    tipo: "PRIMERA_REVISION_V2",
    antecedenteItemId,
    visita: inspeccion.numeroInspeccion,
    resultado,
    observacion,
  });

  await prisma.$executeRaw`
    INSERT INTO "GuiaInspeccionItem"
      ("id","inspeccionId","origen","area","concepto","especificacion","orden","obligatorio",
       "completado","creadoPorId","areaId","estadoV3","origenV3","observacion","cerradoEn","creadoEn","actualizadoEn")
    VALUES
      (${itemId},${inspeccionId},'INSPECTOR',${antecedente.area},${antecedente.concepto},
       ${antecedente.especificacion},${antecedente.orden},true,
       ${resultado === "SIN_HALLAZGO"},${usuario.id},NULL,
       ${resultado === "SIN_HALLAZGO" ? "REVISADO" : "PENDIENTE"},
       'INSPECTOR',${metadata},${resultado === "SIN_HALLAZGO" ? new Date() : null},NOW(),NOW())
  `;

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "GuiaInspeccionItem",
    entidadId: itemId,
    inspeccionId,
    usuarioId: usuario.id,
    descripcion:
      resultado === "SIN_HALLAZGO"
        ? `Primera revisión en V${inspeccion.numeroInspeccion} del concepto “${antecedente.concepto}”, no inspeccionado en la visita anterior. Resultado: sin hallazgo. Observación: ${observacion}`
        : `Primera revisión en V${inspeccion.numeroInspeccion} del concepto “${antecedente.concepto}”, no inspeccionado en la visita anterior. Se requiere documentar hallazgo nuevo. Observación: ${observacion}`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/captura`);

  if (resultado === "CON_HALLAZGO") {
    redirect(
      `/panel/inspecciones/${inspeccionId}/captura?primeraRevisionItemId=${encodeURIComponent(itemId)}#nuevo-hallazgo`,
    );
  }

  volver(inspeccionId, "ok", `Primera revisión en V${inspeccion.numeroInspeccion} registrada sin hallazgo.`);
}
