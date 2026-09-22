"use server";

import {
  EstadoDecisionRevision,
  EstadoInspeccion,
  EstadoPago,
  RolUsuario,
  TipoDecisionRevision,
  TipoEvento,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { validarAjustesParaCertificado } from "@/lib/ajustes-comerciales";
import { usuarioAsignadoAInspeccion } from "@/lib/asignaciones-inspeccion";
import { registrarAuditoria } from "@/lib/auditoria";
import { prepararCertificadoV1 } from "@/lib/certificado-v1";
import { prisma } from "@/lib/prisma";
import { obtenerEstadoExpedienteRevision } from "@/lib/validacion-expediente-certeza";

function texto(formData: FormData, campo: string) {
  return String(formData.get(campo) ?? "").trim();
}

function error(inspeccionId: string, mensaje: string): never {
  redirect(`/panel/inspecciones/${inspeccionId}?error=${encodeURIComponent(mensaje)}`);
}

function ok(inspeccionId: string, mensaje: string): never {
  redirect(`/panel/inspecciones/${inspeccionId}?ok=${encodeURIComponent(mensaje)}`);
}

function revalidar(inspeccionId: string) {
  revalidatePath(`/panel/inspecciones/${inspeccionId}`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/certificado`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/reporte-v1`);
  revalidatePath(`/portal/inspecciones/${inspeccionId}`);
  revalidatePath("/portal/inspecciones");
  revalidatePath("/panel/inspecciones");
  revalidatePath("/panel");
}

async function cargarContexto(inspeccionId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [usuario, inspeccion, control] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: { id: true, rol: true, activo: true },
    }),
    prisma.inspeccion.findUnique({
      where: { id: inspeccionId },
      select: {
        id: true,
        folio: true,
        estado: true,
        liberacionBloqueada: true,
        requiereCoordinador: true,
        requiereGerenteZona: true,
        inicioLiberadoSinPago: true,
        cotizacion: {
          select: { total: true, montoPagado: true, estadoPago: true },
        },
      },
    }),
    prisma.$queryRaw<Array<{ existe: boolean }>>`
      SELECT EXISTS(
        SELECT 1 FROM "InspeccionControlV2" WHERE "inspeccionId" = ${inspeccionId}
      ) AS "existe"
    `,
  ]);

  if (!control[0]?.existe) return null;
  if (!usuario?.activo) redirect("/acceso");
  if (!inspeccion) error(inspeccionId, "La inspección no existe.");

  return { usuario, inspeccion };
}

async function exigirAlcance(
  inspeccionId: string,
  rolNecesario: RolUsuario,
  contexto: NonNullable<Awaited<ReturnType<typeof cargarContexto>>>,
) {
  const { usuario, inspeccion } = contexto;
  if (usuario.rol !== rolNecesario) redirect("/acceso");

  if (rolNecesario === RolUsuario.COORDINADOR) {
    if (!inspeccion.requiereCoordinador || !(await usuarioAsignadoAInspeccion(inspeccionId, usuario.id, "COORDINADOR"))) {
      error(inspeccionId, "Esta inspección no está asignada a esta Coordinación.");
    }
  }

  if (rolNecesario === RolUsuario.GERENTE) {
    if (!inspeccion.requiereGerenteZona || !(await usuarioAsignadoAInspeccion(inspeccionId, usuario.id, "GERENTE"))) {
      error(inspeccionId, "Esta inspección no está asignada a esta Gerencia.");
    }
  }
}

async function exigirExpedienteCompleto(inspeccionId: string) {
  const estado = await obtenerEstadoExpedienteRevision(inspeccionId);
  if (!estado) error(inspeccionId, "La inspección no existe.");
  if (!estado.completo) {
    error(inspeccionId, `El expediente todavía está incompleto. Faltan: ${estado.faltantes.join(", ")}.`);
  }
  return estado;
}

function exigirPagoOperativo(
  inspeccionId: string,
  inspeccion: NonNullable<Awaited<ReturnType<typeof cargarContexto>>>["inspeccion"],
) {
  if (!inspeccion.cotizacion || inspeccion.inicioLiberadoSinPago) return;
  const total = Number(inspeccion.cotizacion.total);
  const pagado = Number(inspeccion.cotizacion.montoPagado);
  const saldo = Math.max(0, total - pagado);
  const liquidada = inspeccion.cotizacion.estadoPago === EstadoPago.PAGADO && saldo <= 0.01;
  if (!liquidada) {
    const saldoFormateado = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(saldo);
    error(inspeccionId, `Existe un saldo pendiente de ${saldoFormateado}.`);
  }
}

export async function darVistoBuenoCoordinadorMetodoCerteza(formData: FormData): Promise<boolean> {
  const inspeccionId = texto(formData, "inspeccionId");
  if (!inspeccionId) return false;
  const contexto = await cargarContexto(inspeccionId);
  if (!contexto) return false;
  await exigirAlcance(inspeccionId, RolUsuario.COORDINADOR, contexto);

  const { usuario, inspeccion } = contexto;
  if (inspeccion.estado !== EstadoInspeccion.REPORTE_PENDIENTE) error(inspeccionId, "El visto bueno técnico requiere una inspección en REPORTE PENDIENTE.");
  if (inspeccion.liberacionBloqueada) error(inspeccionId, "La liberación está bloqueada por Dirección.");
  await exigirExpedienteCompleto(inspeccionId);

  const existente = await prisma.revisionInspeccion.findFirst({ where: { inspeccionId, rol: RolUsuario.COORDINADOR, decision: TipoDecisionRevision.VISTO_BUENO, estado: EstadoDecisionRevision.VIGENTE }, select: { id: true } });
  if (existente) error(inspeccionId, "Coordinación ya tiene un visto bueno técnico vigente.");
  const comentario = texto(formData, "comentario");

  await prisma.$transaction(async (tx) => {
    await tx.revisionInspeccion.updateMany({ where: { inspeccionId, rol: RolUsuario.COORDINADOR, estado: EstadoDecisionRevision.VIGENTE }, data: { estado: EstadoDecisionRevision.SUPERADA } });
    await tx.revisionInspeccion.create({ data: { inspeccionId, usuarioId: usuario.id, rol: RolUsuario.COORDINADOR, decision: TipoDecisionRevision.VISTO_BUENO, comentario: comentario || null } });
  });

  await registrarAuditoria({ tipo: TipoEvento.REVISION_INSPECCION, entidad: "RevisionInspeccion", inspeccionId, usuarioId: usuario.id, origen: "METODO_CERTEZA", descripcion: `Coordinación otorgó visto bueno técnico a ${inspeccion.folio}.` });
  revalidar(inspeccionId);
  ok(inspeccionId, "Visto bueno técnico de Coordinación registrado.");
}

export async function aprobarGerenciaMetodoCerteza(formData: FormData): Promise<boolean> {
  const inspeccionId = texto(formData, "inspeccionId");
  if (!inspeccionId) return false;
  const contexto = await cargarContexto(inspeccionId);
  if (!contexto) return false;
  await exigirAlcance(inspeccionId, RolUsuario.GERENTE, contexto);

  const { usuario, inspeccion } = contexto;
  if (inspeccion.estado !== EstadoInspeccion.REPORTE_PENDIENTE) error(inspeccionId, "Gerencia solo puede aprobar una inspección en REPORTE PENDIENTE.");
  if (inspeccion.liberacionBloqueada) error(inspeccionId, "La liberación está bloqueada por Dirección.");
  await exigirExpedienteCompleto(inspeccionId);

  if (inspeccion.requiereCoordinador) {
    const vistoBueno = await prisma.revisionInspeccion.findFirst({ where: { inspeccionId, rol: RolUsuario.COORDINADOR, decision: TipoDecisionRevision.VISTO_BUENO, estado: EstadoDecisionRevision.VIGENTE }, select: { id: true } });
    if (!vistoBueno) error(inspeccionId, "Esta inspección requiere visto bueno técnico vigente de Coordinación.");
  }

  exigirPagoOperativo(inspeccionId, inspeccion);
  const comentario = texto(formData, "comentario");
  await prisma.$transaction(async (tx) => {
    await tx.revisionInspeccion.updateMany({ where: { inspeccionId, rol: RolUsuario.GERENTE, estado: EstadoDecisionRevision.VIGENTE }, data: { estado: EstadoDecisionRevision.SUPERADA } });
    await tx.revisionInspeccion.create({ data: { inspeccionId, usuarioId: usuario.id, rol: RolUsuario.GERENTE, decision: TipoDecisionRevision.APROBADO, comentario: comentario || null } });
    await tx.inspeccion.update({ where: { id: inspeccionId }, data: { estado: EstadoInspeccion.FINALIZADA } });
  });

  await registrarAuditoria({ tipo: TipoEvento.REVISION_INSPECCION, entidad: "RevisionInspeccion", inspeccionId, usuarioId: usuario.id, origen: "METODO_CERTEZA", descripcion: `Gerencia aprobó y cerró la inspección ${inspeccion.folio}.` });
  revalidar(inspeccionId);
  ok(inspeccionId, "Gerencia aprobó la inspección. El expediente quedó FINALIZADO.");
}

export async function aprobarDireccionMetodoCerteza(formData: FormData): Promise<boolean> {
  const inspeccionId = texto(formData, "inspeccionId");
  if (!inspeccionId) return false;
  const contexto = await cargarContexto(inspeccionId);
  if (!contexto) return false;
  await exigirAlcance(inspeccionId, RolUsuario.DIRECTOR, contexto);

  const { usuario, inspeccion } = contexto;
  if (inspeccion.estado !== EstadoInspeccion.REPORTE_PENDIENTE && inspeccion.estado !== EstadoInspeccion.FINALIZADA) error(inspeccionId, "Dirección solo puede aprobar una inspección con captura terminada.");
  if (inspeccion.liberacionBloqueada) error(inspeccionId, "Existe un bloqueo directivo; usa «Levantar bloqueo y aprobar».");
  await exigirExpedienteCompleto(inspeccionId);
  exigirPagoOperativo(inspeccionId, inspeccion);
  await validarAjustesParaCertificado(inspeccionId);
  const preparado = await prepararCertificadoV1(inspeccionId);
  const comentario = texto(formData, "comentario");
  const reactivarCertificado = Boolean(preparado?.existente && !preparado.vigente);

  await prisma.$transaction(async (tx) => {
    await tx.revisionInspeccion.updateMany({ where: { inspeccionId, rol: RolUsuario.DIRECTOR, estado: EstadoDecisionRevision.VIGENTE }, data: { estado: EstadoDecisionRevision.SUPERADA } });
    await tx.revisionInspeccion.create({ data: { inspeccionId, usuarioId: usuario.id, rol: RolUsuario.DIRECTOR, decision: TipoDecisionRevision.APROBADO, comentario: comentario || null } });

    if (preparado && !preparado.existente) {
      await tx.certificado.create({ data: { inspeccionId, ...preparado.certificado } });
    } else if (preparado?.existente) {
      await tx.certificado.update({
        where: { id: preparado.certificadoId },
        data: {
          ...preparado.certificadoActualizado,
          ...(preparado.vigente ? {} : { vigente: true, motivoRevocacion: null, revocadoEn: null }),
        },
      });
    }

    await tx.inspeccion.update({
      where: { id: inspeccionId },
      data: {
        estado: EstadoInspeccion.FINALIZADA,
        ...(preparado ? { ish: preparado.metricas.calificacion, semaforo: preparado.metricas.semaforo } : {}),
      },
    });

    if (preparado) {
      await tx.$executeRaw`
        UPDATE "InspeccionControlV2"
        SET "calificacionFinal"=${preparado.metricas.calificacion},
            "coberturaPorcentaje"=${preparado.metricas.cobertura},
            "resumenEstadistico"=${JSON.stringify({
              prioridades: preparado.metricas.resumenPrioridades,
              hallazgos: preparado.metricas.totalHallazgos,
              cargaSeveridad: preparado.metricas.cargaSeveridad,
              areas: preparado.metricas.areas,
              areasSinHallazgos: preparado.metricas.areasSinHallazgos,
              puntosDefinidos: preparado.metricas.definidos,
              puntosNoAplica: preparado.metricas.noAplica,
              puntosAplicables: preparado.metricas.aplicables,
              puntosRevisados: preparado.metricas.revisados,
            })}::jsonb,
            "actualizadoEn"=now()
        WHERE "inspeccionId"=${inspeccionId}
      `;
    }
  });

  await registrarAuditoria({ tipo: TipoEvento.REVISION_INSPECCION, entidad: "RevisionInspeccion", inspeccionId, usuarioId: usuario.id, origen: "METODO_CERTEZA", descripcion: `Dirección autorizó el PRE REPORTE ${inspeccion.folio}; desde este momento queda convertido en REPORTE LIBERADO y el CERTIFICADO queda LIBERADO.` });
  if (preparado && !preparado.existente) {
    await registrarAuditoria({ tipo: TipoEvento.EMITIR_CERTIFICADO, entidad: "Certificado", inspeccionId, usuarioId: usuario.id, origen: "METODO_CERTEZA_V1", descripcion: `Dirección autorizó y emitió automáticamente el Certificado V1 de ${inspeccion.folio} con calificación técnica ${preparado.metricas.calificacion}/100 y cobertura ${preparado.metricas.cobertura}%.` });
  } else if (preparado?.existente && reactivarCertificado) {
    await registrarAuditoria({ tipo: TipoEvento.REACTIVAR_CERTIFICADO, entidad: "Certificado", entidadId: preparado.certificadoId, inspeccionId, usuarioId: usuario.id, origen: "REAUTORIZACION_DIRECCION_V1", descripcion: `Dirección reautorizó V1 y reactivó el certificado existente de ${inspeccion.folio} con calificación técnica ${preparado.metricas.calificacion}/100 y cobertura ${preparado.metricas.cobertura}%.` });
  }
  revalidar(inspeccionId);
  ok(inspeccionId, preparado ? "Dirección autorizó V1. El PRE REPORTE quedó convertido en REPORTE LIBERADO y el CERTIFICADO quedó LIBERADO para el cliente." : "Dirección aprobó la inspección. El expediente quedó FINALIZADO.");
}

export async function levantarBloqueoYAprobarMetodoCerteza(formData: FormData): Promise<boolean> {
  const inspeccionId = texto(formData, "inspeccionId");
  if (!inspeccionId) return false;
  const contexto = await cargarContexto(inspeccionId);
  if (!contexto) return false;
  await exigirAlcance(inspeccionId, RolUsuario.DIRECTOR, contexto);

  const { usuario, inspeccion } = contexto;
  const comentario = texto(formData, "comentario");
  if (comentario.length < 10) error(inspeccionId, "Indica un comentario de al menos 10 caracteres para levantar el bloqueo.");
  if (!inspeccion.liberacionBloqueada) error(inspeccionId, "Esta inspección no tiene un bloqueo directivo vigente.");
  await exigirExpedienteCompleto(inspeccionId);
  exigirPagoOperativo(inspeccionId, inspeccion);
  await validarAjustesParaCertificado(inspeccionId);
  const preparado = await prepararCertificadoV1(inspeccionId);
  const reactivarCertificado = Boolean(preparado?.existente && !preparado.vigente);

  await prisma.$transaction(async (tx) => {
    await tx.revisionInspeccion.updateMany({ where: { inspeccionId, estado: EstadoDecisionRevision.VIGENTE }, data: { estado: EstadoDecisionRevision.SUPERADA } });
    await tx.revisionInspeccion.create({ data: { inspeccionId, usuarioId: usuario.id, rol: RolUsuario.DIRECTOR, decision: TipoDecisionRevision.LEVANTAR_BLOQUEO, comentario, estado: EstadoDecisionRevision.SUPERADA } });
    await tx.revisionInspeccion.create({ data: { inspeccionId, usuarioId: usuario.id, rol: RolUsuario.DIRECTOR, decision: TipoDecisionRevision.APROBADO, comentario: `Bloqueo levantado. ${comentario}` } });

    if (preparado && !preparado.existente) {
      await tx.certificado.create({ data: { inspeccionId, ...preparado.certificado } });
    } else if (preparado?.existente) {
      await tx.certificado.update({
        where: { id: preparado.certificadoId },
        data: {
          ...preparado.certificadoActualizado,
          ...(preparado.vigente ? {} : { vigente: true, motivoRevocacion: null, revocadoEn: null }),
        },
      });
    }

    await tx.inspeccion.update({
      where: { id: inspeccionId },
      data: {
        estado: EstadoInspeccion.FINALIZADA,
        liberacionBloqueada: false,
        bloqueadaPorId: null,
        bloqueadaEn: null,
        motivoBloqueoLiberacion: null,
        ...(preparado ? { ish: preparado.metricas.calificacion, semaforo: preparado.metricas.semaforo } : {}),
      },
    });

    if (preparado) {
      await tx.$executeRaw`
        UPDATE "InspeccionControlV2"
        SET "calificacionFinal"=${preparado.metricas.calificacion},
            "coberturaPorcentaje"=${preparado.metricas.cobertura},
            "resumenEstadistico"=${JSON.stringify({
              prioridades: preparado.metricas.resumenPrioridades,
              hallazgos: preparado.metricas.totalHallazgos,
              cargaSeveridad: preparado.metricas.cargaSeveridad,
              areas: preparado.metricas.areas,
              areasSinHallazgos: preparado.metricas.areasSinHallazgos,
              puntosDefinidos: preparado.metricas.definidos,
              puntosNoAplica: preparado.metricas.noAplica,
              puntosAplicables: preparado.metricas.aplicables,
              puntosRevisados: preparado.metricas.revisados,
            })}::jsonb,
            "actualizadoEn"=now()
        WHERE "inspeccionId"=${inspeccionId}
      `;
    }
  });

  await registrarAuditoria({ tipo: TipoEvento.DESBLOQUEAR_LIBERACION, entidad: "Inspeccion", entidadId: inspeccion.id, inspeccionId, usuarioId: usuario.id, origen: "METODO_CERTEZA", descripcion: `Dirección levantó el bloqueo y aprobó ${inspeccion.folio}. Motivo: ${comentario}` });
  if (preparado && !preparado.existente) {
    await registrarAuditoria({ tipo: TipoEvento.EMITIR_CERTIFICADO, entidad: "Certificado", inspeccionId, usuarioId: usuario.id, origen: "METODO_CERTEZA_V1", descripcion: `Dirección levantó el bloqueo, autorizó V1 y emitió automáticamente el certificado con calificación técnica ${preparado.metricas.calificacion}/100.` });
  } else if (preparado?.existente && reactivarCertificado) {
    await registrarAuditoria({ tipo: TipoEvento.REACTIVAR_CERTIFICADO, entidad: "Certificado", entidadId: preparado.certificadoId, inspeccionId, usuarioId: usuario.id, origen: "REAUTORIZACION_DIRECCION_V1", descripcion: `Dirección levantó el bloqueo, reautorizó V1 y reactivó el certificado existente con calificación técnica ${preparado.metricas.calificacion}/100.` });
  }
  revalidar(inspeccionId);
  ok(inspeccionId, preparado ? "Dirección levantó el bloqueo, autorizó V1 y liberó el certificado al cliente." : "Dirección levantó el bloqueo y aprobó la inspección.");
}
