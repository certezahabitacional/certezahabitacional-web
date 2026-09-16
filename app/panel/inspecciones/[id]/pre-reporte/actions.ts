"use server";

import { EstadoInspeccion, RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

const DECISIONES = [
  "RECIBO_LA_VIVIENDA",
  "NO_RECIBO_LA_VIVIENDA",
  "PREFIERO_ESPERAR_EL_REPORTE_FINAL",
  "NO_DESEO_REGISTRAR_DECISION",
] as const;

type DecisionCliente = (typeof DECISIONES)[number];

export async function registrarDecisionClienteSitioV1(formData: FormData) {
  const inspeccionId = String(formData.get("inspeccionId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim() as DecisionCliente;
  if (!inspeccionId) redirect("/panel/inspecciones");
  if (!DECISIONES.includes(decision)) {
    redirect(`/panel/inspecciones/${inspeccionId}/pre-reporte?error=${encodeURIComponent("Selecciona una opción válida.")}`);
  }

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
  if (!inspeccion || inspeccion.numeroInspeccion !== 1 || inspeccion.inspectorId !== usuario.inspector.id) redirect("/acceso");
  if (inspeccion.estado !== EstadoInspeccion.EN_PROCESO) {
    redirect(`/panel/inspecciones/${inspeccionId}/pre-reporte?error=${encodeURIComponent("La decisión en sitio solo puede registrarse antes de enviar el reporte a Dirección.")}`);
  }

  const [control] = await prisma.$queryRaw<Array<{ campoFinalizadoEn: Date | null }>>`
    SELECT "campoFinalizadoEn" FROM "InspeccionControlV2" WHERE "inspeccionId"=${inspeccionId} LIMIT 1
  `;
  if (!control?.campoFinalizadoEn) {
    redirect(`/panel/inspecciones/${inspeccionId}/pre-reporte?error=${encodeURIComponent("Primero debes terminar formalmente el trabajo de campo.")}`);
  }

  const [existente] = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"::text FROM "PreReporteInspeccion"
    WHERE "inspeccionId"=${inspeccionId}
    ORDER BY "generadoEn" DESC
    LIMIT 1
  `;

  if (existente) {
    await prisma.$executeRaw`
      UPDATE "PreReporteInspeccion"
      SET "decisionCliente"=${decision},"decisionRegistradaEn"=NOW()
      WHERE "id"=${existente.id}::uuid
    `;
  } else {
    await prisma.$executeRaw`
      INSERT INTO "PreReporteInspeccion" ("inspeccionId","version","generadoPorId","resumen","decisionCliente","decisionRegistradaEn")
      VALUES (${inspeccionId},1,${usuario.id},'{}'::jsonb,${decision},NOW())
    `;
  }

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "PreReporteInspeccion",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `Durante la presentación del pre-reporte V1 se registró la decisión opcional del cliente: ${decision}.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/pre-reporte`);
  redirect(`/panel/inspecciones/${inspeccionId}/pre-reporte?ok=${encodeURIComponent("Decisión del cliente registrada en el pre-reporte.")}`);
}
