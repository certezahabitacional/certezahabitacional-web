import {
  EstadoDecisionRevision,
  EstadoInspeccion,
  EstadoPago,
  Prisma,
  RolUsuario,
  TipoDecisionRevision,
  TipoEvento,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

function volverError(inspeccionId: string, mensaje: string): never {
  redirect(`/panel/inspecciones/${inspeccionId}?error=${encodeURIComponent(mensaje)}`);
}

function volverOk(inspeccionId: string, mensaje: string): never {
  redirect(`/panel/inspecciones/${inspeccionId}?ok=${encodeURIComponent(mensaje)}`);
}

function mensajeValidacionBase(error: unknown) {
  if (!(error instanceof Error)) return null;

  const mensaje = error.message;
  const inicio = mensaje.indexOf("No se puede finalizar");
  if (inicio === -1) return null;

  const resto = mensaje.slice(inicio);
  const fin = resto.search(/[\n\r"]/);
  return (fin === -1 ? resto : resto.slice(0, fin)).trim();
}

/**
 * Finaliza una inspección que ya está incorporada al nuevo Método Certeza.
 * Devuelve false únicamente cuando el expediente es histórico y debe seguir
 * usando el flujo legado. En expedientes del método nuevo, éxito y errores
 * terminan mediante redirect para conservar el comportamiento de Server Action.
 */
export async function finalizarCapturaMetodoCerteza(
  formData: FormData,
): Promise<boolean> {
  const inspeccionId = String(formData.get("inspeccionId") ?? "").trim();
  if (!inspeccionId) return false;

  const control = await prisma.$queryRaw<Array<{ existe: boolean }>>`
    SELECT EXISTS(
      SELECT 1 FROM "InspeccionControlV2" WHERE "inspeccionId" = ${inspeccionId}
    ) AS "existe"
  `;

  if (!control[0]?.existe) return false;

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      rol: true,
      activo: true,
      inspector: { select: { id: true, activo: true } },
    },
  });

  if (
    !usuario ||
    !usuario.activo ||
    usuario.rol !== RolUsuario.INSPECTOR ||
    !usuario.inspector?.activo
  ) {
    redirect("/acceso");
  }

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      id: true,
      folio: true,
      estado: true,
      numeroInspeccion: true,
      inspectorId: true,
      cotizacionId: true,
      cotizacion: {
        select: {
          total: true,
          montoPagado: true,
          estadoPago: true,
        },
      },
      hallazgos: {
        select: {
          id: true,
          fotografias: { select: { id: true } },
        },
      },
    },
  });

  if (!inspeccion) volverError(inspeccionId, "La inspección no existe.");

  if (inspeccion.estado !== EstadoInspeccion.EN_PROCESO) {
    volverError(
      inspeccionId,
      "La captura solo puede finalizarse mientras la inspección está EN PROCESO.",
    );
  }

  if (inspeccion.inspectorId !== usuario.inspector.id) {
    volverError(inspeccionId, "Esta inspección está asignada a otro inspector.");
  }

  if (inspeccion.cotizacion) {
    const total = Number(inspeccion.cotizacion.total);
    const pagado = Number(inspeccion.cotizacion.montoPagado);
    const liquidada =
      inspeccion.cotizacion.estadoPago === EstadoPago.PAGADO &&
      pagado >= total - 0.01;

    if (!liquidada) {
      volverError(
        inspeccionId,
        "No se puede finalizar la captura mientras exista saldo pendiente de pago.",
      );
    }
  }

  const operacionesPendientes = await prisma.$queryRaw<Array<{ total: bigint }>>`
    SELECT COUNT(*)::bigint AS "total"
    FROM "OperacionCampoSync"
    WHERE "inspeccionId" = ${inspeccionId}
      AND "estado" <> 'PROCESADA'
  `;

  if (Number(operacionesPendientes[0]?.total ?? 0) > 0) {
    volverError(
      inspeccionId,
      "Hay información de campo pendiente de sincronizar. Conecta el equipo y completa la sincronización antes de cerrar la captura.",
    );
  }

  const totalHallazgos = inspeccion.hallazgos.length;
  const hallazgosConMenosDeCuatroFotos = inspeccion.hallazgos.filter(
    (hallazgo) => hallazgo.fotografias.length < 4,
  ).length;

  try {
    await prisma.$transaction(async (tx) => {
      // El trigger validar_evidencia_minima_cierre_inspeccion es la autoridad
      // final y distingue V1 integral de V2+ de seguimiento.
      await tx.inspeccion.update({
        where: { id: inspeccionId },
        data: { estado: EstadoInspeccion.REPORTE_PENDIENTE },
      });

      await tx.revisionInspeccion.updateMany({
        where: {
          inspeccionId,
          decision: TipoDecisionRevision.DEVUELTO_INSPECTOR,
          estado: EstadoDecisionRevision.VIGENTE,
        },
        data: { estado: EstadoDecisionRevision.SUPERADA },
      });

      await tx.$executeRaw`
        UPDATE "InspeccionControlV2"
        SET
          "capturaCerrada" = true,
          "capturaCerradaEn" = NOW(),
          "capturaCerradaPorId" = ${usuario.id},
          "actualizadoEn" = NOW()
        WHERE "inspeccionId" = ${inspeccionId}
      `;
    });
  } catch (error) {
    const validacion = mensajeValidacionBase(error);
    if (validacion) volverError(inspeccionId, validacion);

    console.error("Error al finalizar captura Método Certeza:", error);
    volverError(
      inspeccionId,
      "No fue posible cerrar la captura. Revisa los requisitos de la visita e inténtalo nuevamente.",
    );
  }

  await registrarAuditoria({
    tipo: TipoEvento.FINALIZAR_CAPTURA,
    entidad: "Inspeccion",
    entidadId: inspeccionId,
    inspeccionId,
    cotizacionId: inspeccion.cotizacionId,
    usuarioId: usuario.id,
    origen: "METODO_CERTEZA",
    motivo: `Cierre técnico de V${inspeccion.numeroInspeccion}`,
    descripcion:
      `Inspector cerró la captura de ${inspeccion.folio} como V${inspeccion.numeroInspeccion}. ` +
      `${totalHallazgos} hallazgo(s) registrados.`,
    valorAnterior: {
      estado: EstadoInspeccion.EN_PROCESO,
      capturaCerrada: false,
    },
    valorNuevo: {
      estado: EstadoInspeccion.REPORTE_PENDIENTE,
      capturaCerrada: true,
      numeroInspeccion: inspeccion.numeroInspeccion,
      totalHallazgos,
      hallazgosConMenosDeCuatroFotos,
    },
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/captura`);
  revalidatePath("/panel/inspecciones");

  volverOk(
    inspeccionId,
    `Captura V${inspeccion.numeroInspeccion} finalizada. El expediente quedó pendiente de revisión y liberación.`,
  );
}
