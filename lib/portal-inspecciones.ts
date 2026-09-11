import {
  EstadoDecisionRevision,
  EstadoInspeccion,
  Prisma,
  TipoDecisionRevision,
} from "@prisma/client";

/**
 * Regla única de publicación al Portal del Cliente.
 * Una inspección solo es visible cuando el expediente está cerrado,
 * no tiene bloqueo directivo, cuenta con una aprobación vigente y
 * tiene certificado vigente.
 */
export function inspeccionLiberadaParaCliente(
  clienteId: string,
): Prisma.InspeccionWhereInput {
  return {
    clienteId,
    estado: EstadoInspeccion.FINALIZADA,
    liberacionBloqueada: false,
    revisiones: {
      some: {
        decision: TipoDecisionRevision.APROBADO,
        estado: EstadoDecisionRevision.VIGENTE,
      },
    },
    certificado: {
      is: {
        vigente: true,
      },
    },
  };
}
