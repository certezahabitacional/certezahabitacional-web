"use server";

import { randomUUID } from "node:crypto";
import {
  EstadoInspeccion,
  RolUsuario,
  TipoEvento,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  PUNTOS_CRITICOS_V1,
  type CodigoPuntoCriticoV1,
} from "@/lib/puntos-criticos-v1";
import { prisma } from "@/lib/prisma";

const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? "").trim();
const CODIGOS = new Set(PUNTOS_CRITICOS_V1.map((p) => p.codigo));

type DatosPasoCritico = {
  configurado?: boolean;
  aplica?: boolean | null;
  pruebaProlongada?: boolean;
  pruebaProlongadaNoAplica?: boolean;
};

function esCodigo(valor: string): valor is CodigoPuntoCriticoV1 {
  return CODIGOS.has(valor as CodigoPuntoCriticoV1);
}

function datosObjeto(valor: unknown): DatosPasoCritico {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as DatosPasoCritico)
    : {};
}

function ruta(
  id: string,
  punto?: string,
  tipo?: "ok" | "error",
  mensaje?: string,
  foco?: string,
) {
  const params = new URLSearchParams();
  if (punto) params.set("punto", punto);
  if (tipo && mensaje) params.set(tipo, mensaje);
  if (foco) params.set("foco", foco);
  const query = params.toString();
  return `/panel/inspecciones/${id}/puntos-criticos${query ? `?${query}` : ""}`;
}

function volver(
  id: string,
  punto: string | undefined,
  tipo: "ok" | "error",
  mensaje: string,
  foco?: string,
): never {
  redirect(ruta(id, punto, tipo, mensaje, foco));
}

function puntoPorCodigo(codigo: CodigoPuntoCriticoV1) {
  const punto = PUNTOS_CRITICOS_V1.find((item) => item.codigo === codigo);
  if (!punto) throw new Error("Punto crítico no reconocido.");
  return punto;
}

async function exigirResponsable(inspeccionId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [usuario, inspeccion] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        rol: true,
        activo: true,
        inspector: { select: { id: true, activo: true } },
      },
    }),
    prisma.inspeccion.findUnique({
      where: { id: inspeccionId },
      select: {
        id: true,
        estado: true,
        numeroInspeccion: true,
        inspectorId: true,
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
  if (inspeccion.numeroInspeccion !== 1) {
    volver(inspeccionId, undefined, "error", "Los puntos críticos corresponden a la inspección V1.");
  }
  if (inspeccion.estado !== EstadoInspeccion.EN_PROCESO) {
    volver(inspeccionId, undefined, "error", "Los puntos críticos sólo pueden modificarse mientras la inspección está EN PROCESO.");
  }

  return {
    usuario,
    responsable: director ? "Dirección" : "Inspector",
  };
}

export async function marcarConceptoNoAplicaV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const codigoTexto = texto(formData, "codigo");
  const itemId = texto(formData, "itemId");

  if (!inspeccionId || !esCodigo(codigoTexto) || !itemId) {
    redirect("/panel/inspecciones");
  }

  const codigo = codigoTexto;
  const { usuario, responsable } = await exigirResponsable(inspeccionId);

  const [item] = await prisma.$queryRaw<Array<{
    concepto: string;
    estadoV3: string;
  }>>`
    SELECT "concepto","estadoV3"
    FROM "GuiaInspeccionItem"
    WHERE "id"=${itemId}
      AND "inspeccionId"=${inspeccionId}
      AND "area"=${`__PUNTO_CRITICO__:${codigo}`}
    LIMIT 1
  `;

  if (!item) volver(inspeccionId, codigo, "error", "Concepto no encontrado.");
  if (item.estadoV3 !== "PENDIENTE") {
    volver(
      inspeccionId,
      codigo,
      "error",
      "El concepto ya está resuelto. Reactívalo antes de modificarlo.",
      itemId,
    );
  }

  await prisma.$executeRaw`
    UPDATE "GuiaInspeccionItem"
    SET "estadoV3"='NO_APLICA',
        "completado"=true,
        "motivoNoAplica"='Marcado como NO APLICA por el Inspector.',
        "valorMedido"=NULL,
        "valorProyecto"=NULL,
        "unidadMedida"=NULL,
        "cerradoEn"=NOW(),
        "actualizadoEn"=NOW()
    WHERE "id"=${itemId} AND "inspeccionId"=${inspeccionId}
  `;

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "GuiaInspeccionItem",
    entidadId: itemId,
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${responsable} marcó el concepto crítico “${item.concepto}” como NO APLICA.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos`);
  volver(inspeccionId, codigo, "ok", "Concepto marcado como NO APLICA.", itemId);
}

export async function reactivarConceptoPuntoCriticoV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const codigoTexto = texto(formData, "codigo");
  const itemId = texto(formData, "itemId");

  if (!inspeccionId || !esCodigo(codigoTexto) || !itemId) {
    redirect("/panel/inspecciones");
  }

  const codigo = codigoTexto;
  const { usuario, responsable } = await exigirResponsable(inspeccionId);

  const [item] = await prisma.$queryRaw<Array<{
    concepto: string;
    estadoV3: string;
  }>>`
    SELECT "concepto","estadoV3"
    FROM "GuiaInspeccionItem"
    WHERE "id"=${itemId}
      AND "inspeccionId"=${inspeccionId}
      AND "area"=${`__PUNTO_CRITICO__:${codigo}`}
    LIMIT 1
  `;

  if (!item) volver(inspeccionId, codigo, "error", "Concepto no encontrado.");
  if (item.estadoV3 !== "NO_APLICA") {
    volver(
      inspeccionId,
      codigo,
      "error",
      "Sólo se puede reactivar un concepto marcado como NO APLICA.",
      itemId,
    );
  }

  await prisma.$executeRaw`
    UPDATE "GuiaInspeccionItem"
    SET "estadoV3"='PENDIENTE',
        "completado"=false,
        "motivoNoAplica"=NULL,
        "cerradoEn"=NULL,
        "actualizadoEn"=NOW()
    WHERE "id"=${itemId} AND "inspeccionId"=${inspeccionId}
  `;

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "GuiaInspeccionItem",
    entidadId: itemId,
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${responsable} reactivó el concepto crítico “${item.concepto}”.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos`);
  volver(inspeccionId, codigo, "ok", "Concepto reactivado.", itemId);
}

export async function agregarConceptoManualPuntoCriticoV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const codigoTexto = texto(formData, "codigo");
  const concepto = texto(formData, "concepto");
  const especificacion = texto(formData, "especificacion");

  if (!inspeccionId || !esCodigo(codigoTexto)) {
    redirect("/panel/inspecciones");
  }

  const codigo = codigoTexto;
  if (concepto.length < 3) {
    volver(inspeccionId, codigo, "error", "Escribe el concepto adicional que deseas inspeccionar.");
  }
  if (concepto.length > 180) {
    volver(inspeccionId, codigo, "error", "El concepto manual es demasiado largo.");
  }

  const { usuario, responsable } = await exigirResponsable(inspeccionId);

  const [paso] = await prisma.$queryRaw<Array<{
    estado: string;
    datos: unknown;
  }>>`
    SELECT "estado","datos"
    FROM "ProtocoloInspeccionPaso"
    WHERE "inspeccionId"=${inspeccionId}
      AND "clave"=${`PC_${codigo}`}
    LIMIT 1
  `;

  const datos = datosObjeto(paso?.datos);
  if (!paso || !datos.configurado || datos.aplica !== true) {
    volver(inspeccionId, codigo, "error", "Primero configura esta partida como SI APLICA.");
  }
  if (paso.estado === "COMPLETADO" || paso.estado === "NO_APLICA") {
    volver(inspeccionId, codigo, "error", "La partida ya está cerrada y no admite conceptos adicionales.");
  }

  const [area] = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"::text
    FROM "AreaInspeccion"
    WHERE "inspeccionId"=${inspeccionId}
      AND "codigo"=${`PC_${codigo}`}
    LIMIT 1
  `;

  if (!area) volver(inspeccionId, codigo, "error", "No se encontró el área técnica de esta partida.");

  const [orden] = await prisma.$queryRaw<Array<{ siguiente: number }>>`
    SELECT COALESCE(MAX("orden"),0)::int + 10 AS "siguiente"
    FROM "GuiaInspeccionItem"
    WHERE "inspeccionId"=${inspeccionId}
      AND "area"=${`__PUNTO_CRITICO__:${codigo}`}
  `;

  const itemId = randomUUID();

  await prisma.$executeRaw`
    INSERT INTO "GuiaInspeccionItem"
      ("id","inspeccionId","origen","area","concepto","especificacion","orden",
       "obligatorio","completado","creadoPorId","areaId","estadoV3","origenV3",
       "requiereMedicion","requiereComparacionProyecto","creadoEn","actualizadoEn")
    VALUES
      (${itemId},${inspeccionId},'INSPECTOR',${`__PUNTO_CRITICO__:${codigo}`},${concepto},
       ${especificacion || "Concepto agregado manualmente durante la inspección."},
       ${Number(orden?.siguiente ?? 10)},true,false,${usuario.id},${area.id}::uuid,
       'PENDIENTE','INSPECTOR',false,false,NOW(),NOW())
  `;

  await registrarAuditoria({
    tipo: TipoEvento.CREAR,
    entidad: "GuiaInspeccionItem",
    entidadId: itemId,
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${responsable} agregó manualmente el concepto crítico “${concepto}” en ${puntoPorCodigo(codigo).etiqueta}.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos`);
  volver(inspeccionId, codigo, "ok", "Concepto agregado a la partida.", itemId);
}

export async function marcarPruebaProlongadaNoAplicaV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const codigoTexto = texto(formData, "codigo");

  if (!inspeccionId || !esCodigo(codigoTexto)) {
    redirect("/panel/inspecciones");
  }

  const codigo = codigoTexto;
  if (!["HIDRAULICA", "GAS"].includes(codigo)) {
    volver(
      inspeccionId,
      codigo,
      "error",
      "La prueba de hermeticidad con manómetro sólo corresponde a Hidráulica o Gas.",
    );
  }

  const { usuario, responsable } = await exigirResponsable(inspeccionId);

  const [paso] = await prisma.$queryRaw<Array<{
    lecturaInicial: string | null;
    datos: unknown;
  }>>`
    SELECT "lecturaInicial","datos"
    FROM "ProtocoloInspeccionPaso"
    WHERE "inspeccionId"=${inspeccionId}
      AND "clave"=${`PC_${codigo}`}
    LIMIT 1
  `;

  if (!paso || !datosObjeto(paso.datos).pruebaProlongada) {
    volver(inspeccionId, codigo, "error", "Esta partida no tiene una prueba de hermeticidad activa.");
  }
  if (paso.lecturaInicial) {
    volver(
      inspeccionId,
      codigo,
      "error",
      "La prueba ya fue iniciada. No puede marcarse NO APLICA después de registrar la lectura inicial.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "GuiaInspeccionItem"
      SET "estadoV3"='NO_APLICA',
          "completado"=true,
          "motivoNoAplica"='Prueba de hermeticidad con manómetro marcada como NO APLICA.',
          "valorMedido"=NULL,
          "unidadMedida"=NULL,
          "cerradoEn"=NOW(),
          "actualizadoEn"=NOW()
      WHERE "inspeccionId"=${inspeccionId}
        AND "area"=${`__PUNTO_CRITICO__:${codigo}`}
        AND ("concepto" ILIKE '%manómetro%' OR "concepto" ILIKE '%lectura final%')
    `;

    await tx.$executeRaw`
      UPDATE "ProtocoloInspeccionPaso"
      SET "datos"=COALESCE("datos",'{}'::jsonb)
          || '{"pruebaProlongada":false,"pruebaProlongadaNoAplica":true}'::jsonb,
          "lecturaInicial"=NULL,
          "lecturaFinal"=NULL,
          "unidad"=NULL,
          "actualizadoEn"=NOW()
      WHERE "inspeccionId"=${inspeccionId}
        AND "clave"=${`PC_${codigo}`}
    `;
  });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "ProtocoloInspeccionPaso",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${responsable} marcó la prueba de hermeticidad con manómetro de ${puntoPorCodigo(codigo).etiqueta} como NO APLICA.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos`);
  volver(inspeccionId, codigo, "ok", "Prueba de hermeticidad marcada como NO APLICA.");
}

export async function reactivarPruebaProlongadaV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const codigoTexto = texto(formData, "codigo");

  if (!inspeccionId || !esCodigo(codigoTexto)) {
    redirect("/panel/inspecciones");
  }

  const codigo = codigoTexto;
  if (!["HIDRAULICA", "GAS"].includes(codigo)) {
    volver(
      inspeccionId,
      codigo,
      "error",
      "La prueba de hermeticidad con manómetro sólo corresponde a Hidráulica o Gas.",
    );
  }

  const { usuario, responsable } = await exigirResponsable(inspeccionId);

  const [paso] = await prisma.$queryRaw<Array<{ datos: unknown }>>`
    SELECT "datos"
    FROM "ProtocoloInspeccionPaso"
    WHERE "inspeccionId"=${inspeccionId}
      AND "clave"=${`PC_${codigo}`}
    LIMIT 1
  `;

  if (!paso || !datosObjeto(paso.datos).pruebaProlongadaNoAplica) {
    volver(inspeccionId, codigo, "error", "La prueba no está marcada como NO APLICA.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "GuiaInspeccionItem"
      SET "estadoV3"='PENDIENTE',
          "completado"=false,
          "motivoNoAplica"=NULL,
          "cerradoEn"=NULL,
          "actualizadoEn"=NOW()
      WHERE "inspeccionId"=${inspeccionId}
        AND "area"=${`__PUNTO_CRITICO__:${codigo}`}
        AND ("concepto" ILIKE '%manómetro%' OR "concepto" ILIKE '%lectura final%')
    `;

    await tx.$executeRaw`
      UPDATE "ProtocoloInspeccionPaso"
      SET "datos"=COALESCE("datos",'{}'::jsonb)
          || '{"pruebaProlongada":true,"pruebaProlongadaNoAplica":false}'::jsonb,
          "actualizadoEn"=NOW()
      WHERE "inspeccionId"=${inspeccionId}
        AND "clave"=${`PC_${codigo}`}
    `;
  });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "ProtocoloInspeccionPaso",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${responsable} reactivó la prueba de hermeticidad con manómetro de ${puntoPorCodigo(codigo).etiqueta}.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos`);
  volver(inspeccionId, codigo, "ok", "Prueba de hermeticidad reactivada.");
}
