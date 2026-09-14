import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

type AjustePendienteCertificado = {
  id: string;
  tipo: string;
  concepto: string;
  estado: string;
  requiereAceptacionCliente: boolean;
  aceptadoCliente: boolean;
  aplicadoEn: Date | null;
};

export async function validarAjustesParaCertificado(inspeccionId: string) {
  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: { id: true, folio: true, cotizacionId: true },
  });

  if (!inspeccion?.cotizacionId) return;

  const ajustes = await prisma.$queryRaw<AjustePendienteCertificado[]>`
    SELECT
      "id"::text,
      "tipo",
      "concepto",
      "estado",
      "requiereAceptacionCliente",
      "aceptadoCliente",
      "aplicadoEn"
    FROM "AjusteComercial"
    WHERE "cotizacionId" = ${inspeccion.cotizacionId}
      AND "estado" IN ('PENDIENTE','AUTORIZADO')
      AND "aplicadoEn" IS NULL
    ORDER BY "creadoEn" ASC
  `;

  if (ajustes.length === 0) return;

  const pendientesAceptacion = ajustes.filter(
    (ajuste) =>
      ajuste.estado === "AUTORIZADO" &&
      ajuste.requiereAceptacionCliente &&
      !ajuste.aceptadoCliente,
  );

  const resumen = ajustes
    .slice(0, 3)
    .map((ajuste) => `${ajuste.tipo}: ${ajuste.concepto}`)
    .join("; ");

  const detalle = pendientesAceptacion.length > 0
    ? ` Existen ${pendientesAceptacion.length} ajuste(s) autorizado(s) todavía pendientes de aceptación del cliente.`
    : "";

  redirect(
    `/panel/inspecciones/${inspeccionId}?error=${encodeURIComponent(
      `No se puede liberar el certificado: existen ${ajustes.length} ajuste(s) comercial(es) pendientes de resolver/aplicar. ${resumen}.${detalle}`,
    )}`,
  );
}

export async function listarAjustesDeInspeccion(inspeccionId: string) {
  return prisma.$queryRaw<
    Array<{
      id: string;
      tipo: string;
      origen: string;
      concepto: string;
      motivo: string;
      monto: Prisma.Decimal;
      estado: string;
      requiereAceptacionCliente: boolean;
      aceptadoCliente: boolean;
      aplicadoEn: Date | null;
      propuestoEn: Date;
    }>
  >`
    SELECT
      "id"::text,
      "tipo",
      "origen",
      "concepto",
      "motivo",
      "monto",
      "estado",
      "requiereAceptacionCliente",
      "aceptadoCliente",
      "aplicadoEn",
      "propuestoEn"
    FROM "AjusteComercial"
    WHERE "inspeccionId" = ${inspeccionId}
    ORDER BY "propuestoEn" DESC
  `;
}
