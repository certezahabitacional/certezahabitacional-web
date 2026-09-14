import { prisma } from "@/lib/prisma";

export type EstadoExpedienteRevision = {
  completo: boolean;
  faltantes: string[];
  usaMetodoCerteza: boolean;
  capturaTecnicaCompleta: boolean;
  firmaInspector: boolean;
  firmaCliente: boolean;
};

/**
 * Fuente única para saber si un expediente puede entrar a revisión/aprobación.
 *
 * Para el Método Certeza no volvemos a duplicar en TypeScript todas las reglas
 * de V1/V2+: `capturaCerrada = true` solo se escribe después de que PostgreSQL
 * acepta el cambio a REPORTE_PENDIENTE y su trigger valida el protocolo técnico.
 * Así una V1 sin defectos es válida y una V2+ se mide por sus pendientes reales.
 *
 * Cuando Dirección reabre una inspección, las firmas anteriores se conservan
 * como historial, pero dejan de ser válidas para la nueva aprobación. Solo
 * cuentan firmas capturadas a partir de `reabiertaEn`.
 *
 * Los expedientes históricos conservan la regla previa para no alterar su flujo.
 */
export async function obtenerEstadoExpedienteRevision(
  inspeccionId: string,
): Promise<EstadoExpedienteRevision | null> {
  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      hallazgos: {
        select: {
          id: true,
          fotografias: {
            select: { id: true },
            take: 1,
          },
        },
      },
      firmas: {
        select: {
          tipo: true,
          firmadaEn: true,
        },
      },
    },
  });

  if (!inspeccion) return null;

  const control = await prisma.$queryRaw<
    Array<{
      capturaCerrada: boolean;
      reabiertaEn: Date | null;
    }>
  >`
    SELECT "capturaCerrada", "reabiertaEn"
    FROM "InspeccionControlV2"
    WHERE "inspeccionId" = ${inspeccionId}
    LIMIT 1
  `;

  const usaMetodoCerteza = control.length > 0;
  const capturaTecnicaCompleta = usaMetodoCerteza
    ? Boolean(control[0]?.capturaCerrada)
    : inspeccion.hallazgos.length > 0 &&
      inspeccion.hallazgos.every((hallazgo) => hallazgo.fotografias.length > 0);

  const reabiertaEn = control[0]?.reabiertaEn ?? null;
  const firmasVigentes = inspeccion.firmas.filter(
    (firma) => !reabiertaEn || firma.firmadaEn >= reabiertaEn,
  );

  const firmaInspector = firmasVigentes.some((firma) =>
    firma.tipo.toLowerCase().includes("inspector"),
  );
  const firmaCliente = firmasVigentes.some((firma) =>
    firma.tipo.toLowerCase().includes("cliente"),
  );

  const faltantes: string[] = [];

  if (!capturaTecnicaCompleta) {
    if (usaMetodoCerteza) {
      faltantes.push("cierre técnico completo del Método Certeza");
    } else if (inspeccion.hallazgos.length === 0) {
      faltantes.push("al menos un hallazgo registrado");
    } else {
      const hallazgosSinEvidencia = inspeccion.hallazgos.filter(
        (hallazgo) => hallazgo.fotografias.length === 0,
      ).length;
      if (hallazgosSinEvidencia > 0) {
        faltantes.push(
          `${hallazgosSinEvidencia} hallazgo(s) sin evidencia fotográfica`,
        );
      }
    }
  }

  if (!firmaInspector) {
    faltantes.push(
      reabiertaEn
        ? "nueva firma del inspector posterior a la reapertura"
        : "firma del inspector",
    );
  }
  if (!firmaCliente) {
    faltantes.push(
      reabiertaEn
        ? "nueva firma del cliente posterior a la reapertura"
        : "firma del cliente",
    );
  }

  return {
    completo: faltantes.length === 0,
    faltantes,
    usaMetodoCerteza,
    capturaTecnicaCompleta,
    firmaInspector,
    firmaCliente,
  };
}
