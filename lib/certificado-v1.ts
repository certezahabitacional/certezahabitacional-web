import { EstadoPago } from "@prisma/client";
import { redirect } from "next/navigation";

import { obtenerMetricasV1 } from "@/lib/calificacion-v1";
import { prisma } from "@/lib/prisma";

function error(inspeccionId: string, mensaje: string): never {
  redirect(`/panel/inspecciones/${inspeccionId}?error=${encodeURIComponent(mensaje)}`);
}

function crearCodigoValidacionV1() {
  const bloque = crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase();
  return `CH-${bloque}`;
}

export async function prepararCertificadoV1(inspeccionId: string) {
  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      id: true,
      folio: true,
      numeroInspeccion: true,
      certificado: { select: { id: true, vigente: true } },
      cotizacion: {
        select: {
          total: true,
          montoPagado: true,
          estadoPago: true,
        },
      },
    },
  });

  if (!inspeccion) error(inspeccionId, "La inspección no existe.");
  if (inspeccion.numeroInspeccion !== 1) return null;

  // Toda autorización o reautorización V1 vuelve a validar liquidación completa.
  // Una excepción administrativa puede liberar el trabajo de campo, pero nunca
  // la emisión/reactivación del certificado final.
  if (inspeccion.cotizacion) {
    const total = Number(inspeccion.cotizacion.total);
    const pagado = Number(inspeccion.cotizacion.montoPagado);
    const saldo = Math.max(0, total - pagado);
    const liquidada = inspeccion.cotizacion.estadoPago === EstadoPago.PAGADO && saldo <= 0.001;

    if (!liquidada) {
      const saldoFormateado = new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        minimumFractionDigits: 2,
      }).format(saldo);
      error(
        inspeccionId,
        `La autorización final V1 no puede liberar el certificado mientras exista un saldo pendiente de ${saldoFormateado}. La excepción administrativa solo permite iniciar y operar la inspección.`,
      );
    }
  }

  // La cobertura y la calificación se recalculan en cada autorización. Esto es
  // indispensable cuando un certificado previo fue revocado y el expediente se
  // corrigió antes de someterlo otra vez a Dirección.
  const metricas = await obtenerMetricasV1(inspeccionId);
  if (metricas.aplicables <= 0) error(inspeccionId, "No existen puntos aplicables para calcular la cobertura V1.");
  if (metricas.cobertura < 100) error(inspeccionId, `La cobertura V1 debe ser 100% antes de la autorización final. Cobertura actual: ${metricas.cobertura}%.`);

  if (inspeccion.certificado) {
    return {
      existente: true as const,
      vigente: inspeccion.certificado.vigente,
      certificadoId: inspeccion.certificado.id,
      metricas,
      certificadoActualizado: {
        dictamen: metricas.dictamen,
        ish: metricas.calificacion,
      },
    };
  }

  const year = new Date().getFullYear();
  const folio = `CERT-${year}-${inspeccion.folio.replaceAll("CH-", "")}`;

  return {
    existente: false as const,
    metricas,
    certificado: {
      folio,
      codigoValidacion: crearCodigoValidacionV1(),
      dictamen: metricas.dictamen,
      ish: metricas.calificacion,
    },
  };
}
