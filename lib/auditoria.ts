import { TipoEvento } from "@prisma/client";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

type RegistrarAuditoriaParams = {
  tipo: TipoEvento;
  entidad: string;
  descripcion: string;
  usuarioId?: string | null;
  inspeccionId?: string | null;
  entidadId?: string | null;
};

export async function registrarAuditoria({
  tipo,
  entidad,
  descripcion,
  usuarioId = null,
  inspeccionId = null,
  entidadId = null,
}: RegistrarAuditoriaParams) {
  try {
    const encabezados = await headers();

    const ip =
      encabezados.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      encabezados.get("x-real-ip") ??
      null;

    const navegador = encabezados.get("user-agent") ?? null;

    await prisma.eventoAuditoria.create({
      data: {
        usuarioId,
        inspeccionId,
        tipo,
        entidad,
        entidadId,
        descripcion,
        ip,
        navegador,
      },
    });
  } catch (error) {
    console.error("Error al registrar auditoría:", error);
  }
}