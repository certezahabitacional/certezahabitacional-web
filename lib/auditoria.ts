import { Prisma, TipoEvento } from "@prisma/client";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

type ValorAuditoria = Prisma.InputJsonValue | null;

type RegistrarAuditoriaParams = {
  tipo: TipoEvento;
  entidad: string;
  descripcion: string;
  usuarioId?: string | null;
  inspeccionId?: string | null;
  cotizacionId?: string | null;
  entidadId?: string | null;
  origen?: string;
  motivo?: string | null;
  valorAnterior?: ValorAuditoria;
  valorNuevo?: ValorAuditoria;
  metadatos?: ValorAuditoria;
};

function jsonParaSql(valor: ValorAuditoria | undefined) {
  if (valor === undefined || valor === null) return null;
  return JSON.stringify(valor);
}

export async function registrarAuditoria({
  tipo,
  entidad,
  descripcion,
  usuarioId = null,
  inspeccionId = null,
  cotizacionId = null,
  entidadId = null,
  origen = "SISTEMA",
  motivo = null,
  valorAnterior,
  valorNuevo,
  metadatos,
}: RegistrarAuditoriaParams) {
  try {
    const encabezados = await headers();

    const ip =
      encabezados.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      encabezados.get("x-real-ip") ??
      null;

    const navegador = encabezados.get("user-agent") ?? null;

    const evento = await prisma.eventoAuditoria.create({
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
      select: { id: true },
    });

    /*
     * HistorialCambioSistema es una segunda capa, estructurada e inmutable.
     * Se escribe mediante SQL para mantener compatibilidad mientras el modelo
     * Prisma se actualiza formalmente. Si una base histórica todavía no tiene
     * la tabla, la auditoría narrativa de EventoAuditoria sigue funcionando.
     */
    try {
      const anteriorJson = jsonParaSql(valorAnterior);
      const nuevoJson = jsonParaSql(valorNuevo);
      const metadataBase =
        metadatos && typeof metadatos === "object" && !Array.isArray(metadatos)
          ? { ...(metadatos as Prisma.InputJsonObject), eventoAuditoriaId: evento.id }
          : { eventoAuditoriaId: evento.id };
      const metadataJson = JSON.stringify(metadataBase);

      await prisma.$executeRaw`
        INSERT INTO "HistorialCambioSistema"
          ("usuarioId","inspeccionId","cotizacionId","entidad","entidadId","accion","origen","motivo","valorAnterior","valorNuevo","metadatos","ip","navegador")
        VALUES
          (${usuarioId},${inspeccionId},${cotizacionId},${entidad},${entidadId},${String(tipo)},${origen},${motivo ?? descripcion},
           CAST(${anteriorJson} AS jsonb),CAST(${nuevoJson} AS jsonb),CAST(${metadataJson} AS jsonb),${ip},${navegador})
      `;
    } catch (errorHistorial) {
      console.error("Error al registrar historial estructurado:", errorHistorial);
    }
  } catch (error) {
    console.error("Error al registrar auditoría:", error);
  }
}
