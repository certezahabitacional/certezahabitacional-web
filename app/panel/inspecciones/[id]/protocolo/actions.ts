"use server";

import { EstadoInspeccion, RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

function texto(fd: FormData, campo: string) {
  return String(fd.get(campo) ?? "").trim();
}

function numeroOpcional(fd: FormData, campo: string) {
  const valor = texto(fd, campo).replace(",", ".");
  if (!valor) return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function volver(id: string, tipo: "ok" | "error", mensaje: string): never {
  redirect(`/panel/inspecciones/${id}/protocolo?${tipo}=${encodeURIComponent(mensaje)}`);
}

async function exigirInspectorAsignado(inspeccionId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, activo: true, rol: true, inspector: { select: { id: true } } },
  });

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: { id: true, folio: true, numeroInspeccion: true, estado: true, inspectorId: true },
  });

  if (!usuario?.activo || usuario.rol !== RolUsuario.INSPECTOR || !usuario.inspector?.id) {
    redirect("/acceso");
  }
  if (!inspeccion || inspeccion.inspectorId !== usuario.inspector.id) redirect("/acceso");
  if (inspeccion.numeroInspeccion !== 1) volver(inspeccionId, "error", "El protocolo integral corresponde a la inspección inicial V1.");
  if (inspeccion.estado !== EstadoInspeccion.EN_PROCESO) volver(inspeccionId, "error", "El protocolo solo puede capturarse con la inspección EN PROCESO.");

  return { usuario, inspeccion };
}

export async function inicializarProtocoloV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  if (!inspeccionId) redirect("/panel/inspecciones");
  const { usuario, inspeccion } = await exigirInspectorAsignado(inspeccionId);

  const pasos = [
    ["FACHADA_PRINCIPAL", "Fachada principal e identificación", "FACHADA", 10, true],
    ["HIDRAULICA_INICIO", "Abrir prueba hidráulica", "PRUEBA_INICIAL", 20, true],
    ["GAS_INICIO", "Abrir prueba de hermeticidad de gas", "PRUEBA_INICIAL", 30, true],
    ["RECORRIDO_AREAS", "Recorrido completo por áreas", "RECORRIDO", 40, true],
    ["HIDRAULICA_CIERRE", "Cerrar y comparar prueba hidráulica", "PRUEBA_FINAL", 50, true],
    ["GAS_CIERRE", "Cerrar y comparar prueba de gas", "PRUEBA_FINAL", 60, true],
    ["CIERRE_CAMPO", "Comprobación final de campo", "CIERRE", 70, true],
  ] as const;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "InspeccionControlV2" ("inspeccionId","categoria","versionProtocolo")
      VALUES (${inspeccionId}, 'VIVIENDA', 2)
      ON CONFLICT ("inspeccionId") DO NOTHING
    `;

    for (const [clave, nombre, tipo, orden, obligatorio] of pasos) {
      await tx.$executeRaw`
        INSERT INTO "ProtocoloInspeccionPaso"
          ("inspeccionId","clave","nombre","tipo","orden","obligatorio")
        VALUES (${inspeccionId},${clave},${nombre},${tipo},${orden},${obligatorio})
        ON CONFLICT ("inspeccionId","clave") DO NOTHING
      `;
    }
  });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "ProtocoloInspeccionPaso",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `Inspector inicializó el protocolo secuencial V1 para ${inspeccion.folio}.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/protocolo`);
  volver(inspeccionId, "ok", "Protocolo V1 preparado. Inicia por la fachada principal.");
}

export async function actualizarPasoProtocolo(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const pasoId = texto(formData, "pasoId");
  const accion = texto(formData, "accion");
  const comentario = texto(formData, "comentario");
  const lectura = numeroOpcional(formData, "lectura");
  const unidad = texto(formData, "unidad") || null;

  if (!inspeccionId || !pasoId) redirect("/panel/inspecciones");
  const { usuario, inspeccion } = await exigirInspectorAsignado(inspeccionId);

  const pasos = await prisma.$queryRaw<Array<{
    id: string; clave: string; nombre: string; tipo: string; orden: number; obligatorio: boolean; estado: string;
  }>>`
    SELECT "id","clave","nombre","tipo","orden","obligatorio","estado"
    FROM "ProtocoloInspeccionPaso"
    WHERE "inspeccionId"=${inspeccionId}
    ORDER BY "orden" ASC
  `;
  const paso = pasos.find((p) => p.id === pasoId);
  if (!paso) volver(inspeccionId, "error", "El paso seleccionado no existe.");

  const previosPendientes = pasos.filter(
    (p) => p.orden < paso.orden && p.obligatorio && !["COMPLETADO", "NO_APLICA"].includes(p.estado),
  );
  if (previosPendientes.length > 0) {
    volver(inspeccionId, "error", `Primero completa: ${previosPendientes[0].nombre}.`);
  }

  if (accion === "NO_APLICA") {
    await prisma.$executeRaw`
      UPDATE "ProtocoloInspeccionPaso"
      SET "estado"='NO_APLICA', "comentario"=${comentario || "No aplica"}, "completadoEn"=NOW(), "actualizadoEn"=NOW()
      WHERE "id"=${pasoId}::uuid AND "inspeccionId"=${inspeccionId}
    `;
  } else if (accion === "INICIAR") {
    if (paso.tipo === "PRUEBA_INICIAL" && lectura === null) {
      volver(inspeccionId, "error", "Registra la lectura inicial antes de abrir la prueba.");
    }
    await prisma.$executeRaw`
      UPDATE "ProtocoloInspeccionPaso"
      SET "estado"='EN_PROCESO',
          "lecturaInicial"=COALESCE(${lectura},"lecturaInicial"),
          "unidad"=COALESCE(${unidad},"unidad"),
          "comentario"=COALESCE(${comentario || null},"comentario"),
          "iniciadoEn"=COALESCE("iniciadoEn",NOW()),
          "actualizadoEn"=NOW()
      WHERE "id"=${pasoId}::uuid AND "inspeccionId"=${inspeccionId}
    `;
  } else if (accion === "COMPLETAR") {
    if (paso.tipo === "PRUEBA_FINAL" && lectura === null) {
      volver(inspeccionId, "error", "Registra la lectura final de la prueba antes de cerrarla.");
    }
    await prisma.$executeRaw`
      UPDATE "ProtocoloInspeccionPaso"
      SET "estado"='COMPLETADO',
          "lecturaFinal"=CASE WHEN ${paso.tipo}='PRUEBA_FINAL' THEN COALESCE(${lectura},"lecturaFinal") ELSE "lecturaFinal" END,
          "unidad"=COALESCE(${unidad},"unidad"),
          "comentario"=COALESCE(${comentario || null},"comentario"),
          "iniciadoEn"=COALESCE("iniciadoEn",NOW()),
          "completadoEn"=NOW(),
          "actualizadoEn"=NOW()
      WHERE "id"=${pasoId}::uuid AND "inspeccionId"=${inspeccionId}
    `;
  } else {
    volver(inspeccionId, "error", "Acción de protocolo no válida.");
  }

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "ProtocoloInspeccionPaso",
    entidadId: pasoId,
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${accion} · ${paso.nombre} · ${inspeccion.folio}${lectura === null ? "" : ` · lectura ${lectura}${unidad ? ` ${unidad}` : ""}`}${comentario ? ` · ${comentario}` : ""}`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/protocolo`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/flujo`);
  volver(inspeccionId, "ok", `${paso.nombre}: actualización registrada.`);
}
