"use server";

import { randomUUID } from "node:crypto";
import { RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

function texto(fd: FormData, campo: string) {
  return String(fd.get(campo) ?? "").trim();
}

function volver(id: string, tipo: "ok" | "error", mensaje: string): never {
  redirect(`/panel/inspecciones/${id}/reporte-evidencias?${tipo}=${encodeURIComponent(mensaje)}`);
}

async function obtenerEditor(inspeccionId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      rol: true,
      activo: true,
      gerenteId: true,
      coordinadorId: true,
    },
  });
  if (!usuario?.activo) redirect("/acceso");

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      id: true,
      inspector: {
        select: {
          usuario: {
            select: {
              gerenteId: true,
              coordinadorId: true,
            },
          },
        },
      },
    },
  });
  if (!inspeccion) volver(inspeccionId, "error", "La inspección no existe.");

  const permitido =
    usuario.rol === RolUsuario.DIRECTOR ||
    (usuario.rol === RolUsuario.GERENTE && inspeccion.inspector?.usuario.gerenteId === usuario.id) ||
    (usuario.rol === RolUsuario.COORDINADOR && inspeccion.inspector?.usuario.coordinadorId === usuario.id);

  if (!permitido) redirect("/acceso");
  return usuario;
}

async function tablaDisponible() {
  try {
    const r = await prisma.$queryRaw<Array<{ tabla: string | null }>>`
      SELECT to_regclass('public."SeleccionEvidenciaReporte"')::text AS "tabla"
    `;
    return Boolean(r[0]?.tabla);
  } catch {
    return false;
  }
}

export async function cambiarSeleccionEvidencia(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const fotografiaId = texto(formData, "fotografiaId");
  const seleccionada = texto(formData, "seleccionada") === "true";
  const notaEditorial = texto(formData, "notaEditorial") || null;
  if (!inspeccionId || !fotografiaId) redirect("/panel/inspecciones?error=Datos%20no%20validos");

  const usuario = await obtenerEditor(inspeccionId);
  if (!(await tablaDisponible())) volver(inspeccionId, "error", "La selección editorial aún no está habilitada en esta base de datos.");

  const foto = await prisma.fotografia.findFirst({
    where: { id: fotografiaId, inspeccionId, hallazgoId: { not: null } },
    select: { id: true },
  });
  if (!foto) volver(inspeccionId, "error", "La fotografía no pertenece a un hallazgo de esta inspección.");

  const existente = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "SeleccionEvidenciaReporte" WHERE "fotografiaId"=${fotografiaId} LIMIT 1
  `;

  if (existente[0]?.id) {
    await prisma.$executeRaw`
      UPDATE "SeleccionEvidenciaReporte"
      SET "seleccionada"=${seleccionada},
          "notaEditorial"=${notaEditorial},
          "seleccionadaPorId"=${usuario.id},
          "actualizadaEn"=NOW()
      WHERE "id"=${existente[0].id}
    `;
  } else {
    const [orden] = await prisma.$queryRaw<Array<{ siguiente: number }>>`
      SELECT COALESCE(MAX("orden"),0)::int + 1 AS "siguiente"
      FROM "SeleccionEvidenciaReporte"
      WHERE "inspeccionId"=${inspeccionId}
    `;
    await prisma.$executeRaw`
      INSERT INTO "SeleccionEvidenciaReporte"
        ("id","inspeccionId","fotografiaId","seleccionada","orden","notaEditorial","seleccionadaPorId")
      VALUES
        (${randomUUID()},${inspeccionId},${fotografiaId},${seleccionada},${Number(orden?.siguiente ?? 1)},${notaEditorial},${usuario.id})
    `;
  }

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "SeleccionEvidenciaReporte",
    entidadId: fotografiaId,
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${usuario.rol} ${seleccionada ? "seleccionó" : "descartó"} una fotografía para el reporte final.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/reporte-evidencias`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/reporte`);
  volver(inspeccionId, "ok", seleccionada ? "Fotografía seleccionada para el reporte." : "Fotografía retirada de la selección del reporte.");
}

export async function actualizarOrdenEvidencia(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const seleccionId = texto(formData, "seleccionId");
  const direccion = texto(formData, "direccion");
  if (!inspeccionId || !seleccionId || (direccion !== "SUBIR" && direccion !== "BAJAR")) {
    redirect("/panel/inspecciones?error=Datos%20no%20validos");
  }

  await obtenerEditor(inspeccionId);
  if (!(await tablaDisponible())) volver(inspeccionId, "error", "La selección editorial aún no está habilitada en esta base de datos.");

  const actual = await prisma.$queryRaw<Array<{ id: string; orden: number }>>`
    SELECT "id","orden" FROM "SeleccionEvidenciaReporte"
    WHERE "id"=${seleccionId} AND "inspeccionId"=${inspeccionId} AND "seleccionada"=TRUE
    LIMIT 1
  `;
  if (!actual[0]) volver(inspeccionId, "error", "La evidencia seleccionada ya no existe.");

  const vecino = direccion === "SUBIR"
    ? await prisma.$queryRaw<Array<{ id: string; orden: number }>>`
        SELECT "id","orden" FROM "SeleccionEvidenciaReporte"
        WHERE "inspeccionId"=${inspeccionId} AND "seleccionada"=TRUE AND "orden" < ${actual[0].orden}
        ORDER BY "orden" DESC LIMIT 1`
    : await prisma.$queryRaw<Array<{ id: string; orden: number }>>`
        SELECT "id","orden" FROM "SeleccionEvidenciaReporte"
        WHERE "inspeccionId"=${inspeccionId} AND "seleccionada"=TRUE AND "orden" > ${actual[0].orden}
        ORDER BY "orden" ASC LIMIT 1`;

  if (vecino[0]) {
    await prisma.$transaction([
      prisma.$executeRaw`UPDATE "SeleccionEvidenciaReporte" SET "orden"=${vecino[0].orden},"actualizadaEn"=NOW() WHERE "id"=${actual[0].id}`,
      prisma.$executeRaw`UPDATE "SeleccionEvidenciaReporte" SET "orden"=${actual[0].orden},"actualizadaEn"=NOW() WHERE "id"=${vecino[0].id}`,
    ]);
  }

  revalidatePath(`/panel/inspecciones/${inspeccionId}/reporte-evidencias`);
  redirect(`/panel/inspecciones/${inspeccionId}/reporte-evidencias`);
}
