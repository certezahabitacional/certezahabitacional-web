"use server";

import {
  ClasificacionHallazgo,
  EstadoDecisionRevision,
  EstadoInspeccion,
  EstadoPago,
  EstadoReasignacionInspector,
  EstadoSeguimientoHallazgo,
  PrioridadHallazgo,
  RolUsuario,
  TipoDecisionRevision,
  TipoEvento,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";

const texto = (formData: FormData, campo: string) =>
  String(formData.get(campo) ?? "").trim();

function redirigirError(id: string, mensaje: string): never {
  redirect(
    `/panel/inspecciones/${id}?error=${encodeURIComponent(mensaje)}`,
  );
}

function redirigirOk(id: string, mensaje: string): never {
  redirect(
    `/panel/inspecciones/${id}?ok=${encodeURIComponent(mensaje)}`,
  );
}

function exigirSesion(): never {
  redirect("/login");
}

function rolActual(session: Session | null): RolUsuario {
  if (!session?.user) {
    exigirSesion();
  }

  return session.user.role as RolUsuario;
}

function exigirRol(
  session: Session | null,
  rolesPermitidos: RolUsuario[],
  inspeccionId: string,
): RolUsuario {
  const rol = rolActual(session);

  if (!rolesPermitidos.includes(rol)) {
    redirigirError(
      inspeccionId,
      "No tienes autorización para realizar esta acción.",
    );
  }

  return rol;
}


type AlcanceAccion = "TECNICO" | "ADMINISTRATIVO" | "MIXTO";

async function exigirAlcanceInspeccion(
  session: Session | null,
  inspeccionId: string,
  alcance: AlcanceAccion = "TECNICO",
): Promise<RolUsuario> {
  if (!session?.user) exigirSesion();

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      rol: true,
      activo: true,
      zonaId: true,
      gerenteId: true,
      coordinadorId: true,
      inspector: { select: { id: true } },
    },
  });

  if (!usuario || !usuario.activo) {
    redirigirError(inspeccionId, "Tu usuario no está activo.");
  }

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      zonaId: true,
      inspectorId: true,
      inspector: {
        select: {
          usuarioId: true,
          usuario: {
            select: {
              zonaId: true,
              gerenteId: true,
              coordinadorId: true,
            },
          },
        },
      },
    },
  });

  if (!inspeccion) redirigirError(inspeccionId, "La inspección no existe.");

  if (usuario.rol === RolUsuario.CLIENTE) {
    redirigirError(inspeccionId, "El Cliente debe operar desde su portal.");
  }

  if (alcance === "ADMINISTRATIVO") {
    if (
      usuario.rol !== RolUsuario.ADMINISTRADOR &&
      usuario.rol !== RolUsuario.DIRECTOR
    ) {
      redirigirError(
        inspeccionId,
        "Esta acción administrativa está reservada para Administración o Dirección.",
      );
    }
    return usuario.rol;
  }

  if (alcance === "TECNICO" && usuario.rol === RolUsuario.ADMINISTRADOR) {
    redirigirError(
      inspeccionId,
      "Administración no tiene acceso al expediente técnico.",
    );
  }

  if (usuario.rol === RolUsuario.DIRECTOR) return usuario.rol;
  if (alcance === "MIXTO" && usuario.rol === RolUsuario.ADMINISTRADOR) {
    return usuario.rol;
  }

  if (usuario.rol === RolUsuario.GERENTE) {
    if (inspeccion.inspector?.usuario.gerenteId !== usuario.id) {
      redirigirError(
        inspeccionId,
        "La inspección no pertenece a un Inspector bajo esta Gerencia.",
      );
    }

    return usuario.rol;
  }

  if (usuario.rol === RolUsuario.COORDINADOR) {
    if (inspeccion.inspector?.usuario.coordinadorId !== usuario.id) {
      redirigirError(
        inspeccionId,
        "La inspección no pertenece a un Inspector bajo tu Coordinación.",
      );
    }
    return usuario.rol;
  }

  if (usuario.rol === RolUsuario.INSPECTOR) {
    if (
      !usuario.inspector?.id ||
      inspeccion.inspectorId !== usuario.inspector.id ||
      inspeccion.inspector?.usuarioId !== usuario.id
    ) {
      redirigirError(
        inspeccionId,
        "Esta inspección no está asignada a tu usuario.",
      );
    }
    return usuario.rol;
  }

  redirigirError(inspeccionId, "No tienes alcance sobre esta inspección.");
}

async function exigirRolYAlcance(
  session: Session | null,
  rolesPermitidos: RolUsuario[],
  inspeccionId: string,
  alcance: AlcanceAccion = "TECNICO",
): Promise<RolUsuario> {
  const rol = exigirRol(session, rolesPermitidos, inspeccionId);
  await exigirAlcanceInspeccion(session, inspeccionId, alcance);
  return rol;
}

async function exigirExpedienteEditable(inspeccionId: string) {
  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      estado: true,
      liberacionBloqueada: true,
      certificado: { select: { id: true } },
    },
  });

  if (!inspeccion) redirigirError(inspeccionId, "La inspección no existe.");

  if (inspeccion.certificado) {
    redirigirError(
      inspeccionId,
      "El certificado ya fue liberado. El expediente quedó cerrado.",
    );
  }

  if (
    inspeccion.estado === EstadoInspeccion.FINALIZADA ||
    inspeccion.estado === EstadoInspeccion.CANCELADA
  ) {
    redirigirError(
      inspeccionId,
      "El expediente está cerrado y no admite cambios ordinarios.",
    );
  }

  if (inspeccion.liberacionBloqueada) {
    redirigirError(
      inspeccionId,
      "La liberación está bloqueada por Dirección.",
    );
  }
}

function revalidarInspeccion(inspeccionId: string) {
  revalidatePath(`/panel/inspecciones/${inspeccionId}`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/captura`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/evidencias`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/certificado`);
  revalidatePath("/panel/inspecciones");
  revalidatePath("/panel/agenda");
  revalidatePath("/panel");
}

function calcularIndice(clasificaciones: ClasificacionHallazgo[]) {
  const evaluables = clasificaciones.filter((valor) => valor !== "NA");
  if (evaluables.length === 0) return null;

  const ponderacion: Record<Exclude<ClasificacionHallazgo, "NA">, number> = {
    C: 100,
    O: 90,
    NC: 70,
    CR: 35,
  };

  return (
    evaluables.reduce((total, valor) => total + ponderacion[valor], 0) /
    evaluables.length
  );
}

function semaforoDesdeIndice(indice: number | null) {
  if (indice === null) return null;
  if (indice >= 90) return "VERDE";
  if (indice >= 75) return "AMARILLO";
  if (indice >= 60) return "NARANJA";
  return "ROJO";
}

async function validarPagoCompleto(inspeccionId: string) {
  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      id: true,
      estado: true,
      inicioLiberadoSinPago: true,
      cotizacion: {
        select: {
          total: true,
          montoPagado: true,
          estadoPago: true,
        },
      },
    },
  });

  if (!inspeccion) {
    redirigirError(inspeccionId, "La inspección no existe.");
  }

  /*
   * Inspecciones históricas sin cotización asociada
   * continúan operando normalmente.
   */
  if (!inspeccion.cotizacion) {
    return inspeccion;
  }

  if (inspeccion.inicioLiberadoSinPago) {
    return inspeccion;
  }

  const total = Number(inspeccion.cotizacion.total);
  const pagado = Number(inspeccion.cotizacion.montoPagado);
  const saldo = Math.max(0, total - pagado);

  const liquidada =
    inspeccion.cotizacion.estadoPago === EstadoPago.PAGADO && saldo <= 0.01;

  if (!liquidada) {
    const saldoFormateado = new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
    }).format(saldo);

    redirigirError(
      inspeccionId,
      `La inspección no puede iniciar mientras exista un saldo pendiente de ${saldoFormateado}. Liquida el 100% del servicio para continuar.`,
    );
  }

  return inspeccion;
}

/**
 * Regla financiera estricta para liberar el certificado.
 * A diferencia de validarPagoCompleto(), esta validación NO acepta la
 * excepción inicioLiberadoSinPago: esa excepción solo sirve para iniciar y
 * operar la inspección, nunca para emitir el certificado.
 */
async function validarLiquidacionParaCertificado(inspeccionId: string) {
  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      id: true,
      cotizacion: {
        select: {
          total: true,
          montoPagado: true,
          estadoPago: true,
        },
      },
    },
  });

  if (!inspeccion) {
    redirigirError(inspeccionId, "La inspección no existe.");
  }

  // Compatibilidad con expedientes históricos sin cotización asociada.
  if (!inspeccion.cotizacion) {
    return inspeccion;
  }

  const total = Number(inspeccion.cotizacion.total);
  const pagado = Number(inspeccion.cotizacion.montoPagado);
  const saldo = Math.max(0, total - pagado);

  const liquidada =
    inspeccion.cotizacion.estadoPago === EstadoPago.PAGADO && saldo <= 0.001;

  if (!liquidada) {
    const saldoFormateado = new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
    }).format(saldo);

    redirigirError(
      inspeccionId,
      `El certificado no puede emitirse mientras exista un saldo pendiente de ${saldoFormateado}. La excepción administrativa solo autoriza iniciar/operar la inspección; para certificar, el saldo debe ser $0.00.`,
    );
  }

  return inspeccion;
}


export async function asignarInspector(formData: FormData) {
  const session = await auth();
  const inspeccionId = texto(formData, "inspeccionId");
  const inspectorId = texto(formData, "inspectorId");
  const motivo = texto(formData, "motivo");

  if (!session?.user) {
    redirect("/login");
  }

  if (!inspeccionId) {
    redirect("/panel/inspecciones?error=Inspeccion%20no%20valida");
  }

  if (!inspectorId) {
    redirigirError(
      inspeccionId,
      "Selecciona un Inspector para continuar.",
    );
  }

  const rol = exigirRol(
    session,
    [RolUsuario.GERENTE, RolUsuario.DIRECTOR],
    inspeccionId,
  );

  const usuarioGestor = await prisma.usuario.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      rol: true,
      activo: true,
    },
  });

  if (!usuarioGestor || !usuarioGestor.activo) {
    redirigirError(
      inspeccionId,
      "Tu usuario no está activo.",
    );
  }

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      id: true,
      folio: true,
      estado: true,
      inspectorId: true,
      inspector: {
        select: {
          usuario: {
            select: {
              nombre: true,
              email: true,
              gerenteId: true,
            },
          },
        },
      },
    },
  });

  if (!inspeccion) {
    redirigirError(inspeccionId, "La inspección no existe.");
  }

  if (
    rol === RolUsuario.GERENTE &&
    inspeccion.inspectorId &&
    inspeccion.inspector?.usuario.gerenteId !== usuarioGestor.id
  ) {
    redirigirError(
      inspeccionId,
      "La inspección actual no pertenece a un Inspector bajo tu Gerencia.",
    );
  }

  if (
    inspeccion.estado === EstadoInspeccion.FINALIZADA ||
    inspeccion.estado === EstadoInspeccion.CANCELADA
  ) {
    redirigirError(
      inspeccionId,
      "Una inspección FINALIZADA o CANCELADA no puede asignarse o reasignarse por el flujo ordinario.",
    );
  }

  if (inspeccion.inspectorId === inspectorId) {
    redirigirOk(
      inspeccionId,
      "El Inspector seleccionado ya está asignado a esta inspección.",
    );
  }

  const inspectorNuevo = await prisma.inspector.findFirst({
    where: {
      id: inspectorId,
      activo: true,
      usuario: {
        activo: true,
        rol: RolUsuario.INSPECTOR,
        ...(rol === RolUsuario.GERENTE
          ? {
              gerenteId: session.user.id,
            }
          : {}),
      },
    },
    select: {
      id: true,
      usuario: {
        select: {
          nombre: true,
          email: true,
          gerenteId: true,
          coordinadorId: true,
        },
      },
    },
  });

  if (!inspectorNuevo) {
    redirigirError(
      inspeccionId,
      rol === RolUsuario.GERENTE
        ? "El Inspector seleccionado no pertenece a tu Gerencia o no está activo."
        : "El Inspector seleccionado no existe o no está activo.",
    );
  }

  const nombreAnterior =
    inspeccion.inspector?.usuario.nombre ?? "Sin asignar";
  const nombreNuevo = inspectorNuevo.usuario.nombre;

  /*
   * Primera asignación:
   * Gerencia o Dirección pueden asignar directamente.
   */
  if (!inspeccion.inspectorId) {
    await prisma.inspeccion.update({
      where: { id: inspeccionId },
      data: {
        inspectorId: inspectorNuevo.id,
      },
    });

    await registrarAuditoria({
      tipo: TipoEvento.EDITAR,
      entidad: "Inspeccion",
      entidadId: inspeccion.id,
      inspeccionId: inspeccion.id,
      usuarioId: session.user.id,
      descripcion:
        `${session.user.role} asignó la inspección ${inspeccion.folio} ` +
        `al Inspector ${nombreNuevo}${motivo ? `. Comentario: ${motivo}` : "."}`,
    });

    revalidarInspeccion(inspeccionId);
    revalidatePath("/panel/inspectores");

    redirigirOk(
      inspeccionId,
      `Inspector asignado correctamente: ${nombreNuevo}.`,
    );
  }

  /*
   * Reasignación:
   * GERENTE solicita y ADMINISTRADOR/DIRECTOR resuelven.
   * DIRECTOR, por facultad global, puede reasignar directamente,
   * dejando también trazabilidad formal en ReasignacionInspector.
   */
  if (motivo.length < 10) {
    redirigirError(
      inspeccionId,
      "Indica un motivo de al menos 10 caracteres para solicitar o realizar la reasignación.",
    );
  }

  const pendienteExistente =
    await prisma.reasignacionInspector.findFirst({
      where: {
        inspeccionId,
        estado: EstadoReasignacionInspector.PENDIENTE,
      },
      select: {
        id: true,
      },
    });

  if (pendienteExistente) {
    redirigirError(
      inspeccionId,
      "Ya existe una solicitud de reasignación pendiente para esta inspección.",
    );
  }

  if (rol === RolUsuario.DIRECTOR) {
    await prisma.$transaction(async (tx) => {
      await tx.reasignacionInspector.create({
        data: {
          inspeccionId,
          inspectorAnteriorId: inspeccion.inspectorId,
          inspectorPropuestoId: inspectorNuevo.id,
          solicitadaPorId: session.user.id,
          resueltaPorId: session.user.id,
          estado: EstadoReasignacionInspector.AUTORIZADA,
          motivo,
          comentarioResolucion:
            "Reasignación autorizada y ejecutada directamente por Dirección.",
          resueltaEn: new Date(),
        },
      });

      await tx.inspeccion.update({
        where: { id: inspeccionId },
        data: {
          inspectorId: inspectorNuevo.id,
        },
      });
    });

    await registrarAuditoria({
      tipo: TipoEvento.EDITAR,
      entidad: "Inspeccion",
      entidadId: inspeccion.id,
      inspeccionId: inspeccion.id,
      usuarioId: session.user.id,
      descripcion:
        `Dirección reasignó la inspección ${inspeccion.folio} ` +
        `de ${nombreAnterior} a ${nombreNuevo}. Motivo: ${motivo}`,
    });

    revalidarInspeccion(inspeccionId);
    revalidatePath("/panel/inspectores");

    redirigirOk(
      inspeccionId,
      `Inspector reasignado por Dirección: ${nombreNuevo}.`,
    );
  }

  const solicitud = await prisma.reasignacionInspector.create({
    data: {
      inspeccionId,
      inspectorAnteriorId: inspeccion.inspectorId,
      inspectorPropuestoId: inspectorNuevo.id,
      solicitadaPorId: session.user.id,
      estado: EstadoReasignacionInspector.PENDIENTE,
      motivo,
    },
  });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "ReasignacionInspector",
    entidadId: solicitud.id,
    inspeccionId,
    usuarioId: session.user.id,
    descripcion:
      `Gerencia solicitó reasignar la inspección ${inspeccion.folio} ` +
      `de ${nombreAnterior} a ${nombreNuevo}. Motivo: ${motivo}`,
  });

  revalidarInspeccion(inspeccionId);

  redirigirOk(
    inspeccionId,
    `Solicitud de reasignación enviada a Administración. El Inspector actual continúa asignado hasta que la solicitud sea autorizada.`,
  );
}

export async function autorizarReasignacionInspector(
  formData: FormData,
) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const inspeccionId = texto(formData, "inspeccionId");
  const reasignacionId = texto(formData, "reasignacionId");
  const comentarioResolucion = texto(
    formData,
    "comentarioResolucion",
  );

  if (!inspeccionId || !reasignacionId) {
    redirect("/panel/inspecciones?error=Reasignacion%20no%20valida");
  }

  await exigirRolYAlcance(
    session,
    [RolUsuario.ADMINISTRADOR, RolUsuario.DIRECTOR],
    inspeccionId,
    "ADMINISTRATIVO",
  );

  const solicitud = await prisma.reasignacionInspector.findFirst({
    where: {
      id: reasignacionId,
      inspeccionId,
      estado: EstadoReasignacionInspector.PENDIENTE,
    },
    select: {
      id: true,
      motivo: true,
      inspectorAnteriorId: true,
      inspectorPropuestoId: true,
      inspectorAnterior: {
        select: {
          usuario: {
            select: {
              nombre: true,
            },
          },
        },
      },
      inspectorPropuesto: {
        select: {
          id: true,
          activo: true,
          usuario: {
            select: {
              nombre: true,
              activo: true,
              rol: true,
            },
          },
        },
      },
      inspeccion: {
        select: {
          folio: true,
          estado: true,
          inspectorId: true,
        },
      },
    },
  });

  if (!solicitud) {
    redirigirError(
      inspeccionId,
      "La solicitud de reasignación no existe o ya fue resuelta.",
    );
  }

  if (
    solicitud.inspeccion.estado === EstadoInspeccion.FINALIZADA ||
    solicitud.inspeccion.estado === EstadoInspeccion.CANCELADA
  ) {
    redirigirError(
      inspeccionId,
      "La inspección ya está cerrada y no admite una reasignación ordinaria.",
    );
  }

  if (
    solicitud.inspeccion.inspectorId !== solicitud.inspectorAnteriorId
  ) {
    redirigirError(
      inspeccionId,
      "El Inspector actual cambió después de crear la solicitud. Rechaza esta solicitud y genera una nueva.",
    );
  }

  if (
    !solicitud.inspectorPropuesto.activo ||
    !solicitud.inspectorPropuesto.usuario.activo ||
    solicitud.inspectorPropuesto.usuario.rol !== RolUsuario.INSPECTOR
  ) {
    redirigirError(
      inspeccionId,
      "El Inspector propuesto ya no está activo o dejó de ser un usuario Inspector.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.reasignacionInspector.update({
      where: {
        id: solicitud.id,
      },
      data: {
        estado: EstadoReasignacionInspector.AUTORIZADA,
        resueltaPorId: session.user.id,
        resueltaEn: new Date(),
        comentarioResolucion:
          comentarioResolucion || "Reasignación autorizada.",
      },
    });

    await tx.inspeccion.update({
      where: {
        id: inspeccionId,
      },
      data: {
        inspectorId: solicitud.inspectorPropuestoId,
      },
    });
  });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "ReasignacionInspector",
    entidadId: solicitud.id,
    inspeccionId,
    usuarioId: session.user.id,
    descripcion:
      `${session.user.role} autorizó la reasignación de ${solicitud.inspeccion.folio} ` +
      `de ${solicitud.inspectorAnterior?.usuario.nombre ?? "Sin asignar"} ` +
      `a ${solicitud.inspectorPropuesto.usuario.nombre}. ` +
      `Motivo original: ${solicitud.motivo}${
        comentarioResolucion
          ? `. Comentario de resolución: ${comentarioResolucion}`
          : "."
      }`,
  });

  revalidarInspeccion(inspeccionId);
  revalidatePath("/panel/inspectores");

  redirigirOk(
    inspeccionId,
    `Reasignación autorizada. Nuevo Inspector: ${solicitud.inspectorPropuesto.usuario.nombre}.`,
  );
}

export async function rechazarReasignacionInspector(
  formData: FormData,
) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const inspeccionId = texto(formData, "inspeccionId");
  const reasignacionId = texto(formData, "reasignacionId");
  const comentarioResolucion = texto(
    formData,
    "comentarioResolucion",
  );

  if (!inspeccionId || !reasignacionId) {
    redirect("/panel/inspecciones?error=Reasignacion%20no%20valida");
  }

  await exigirRolYAlcance(
    session,
    [RolUsuario.ADMINISTRADOR, RolUsuario.DIRECTOR],
    inspeccionId,
    "ADMINISTRATIVO",
  );

  if (comentarioResolucion.length < 10) {
    redirigirError(
      inspeccionId,
      "Indica un motivo de al menos 10 caracteres para rechazar la reasignación.",
    );
  }

  const solicitud = await prisma.reasignacionInspector.findFirst({
    where: {
      id: reasignacionId,
      inspeccionId,
      estado: EstadoReasignacionInspector.PENDIENTE,
    },
    select: {
      id: true,
      motivo: true,
      inspeccion: {
        select: {
          folio: true,
        },
      },
      inspectorAnterior: {
        select: {
          usuario: {
            select: {
              nombre: true,
            },
          },
        },
      },
      inspectorPropuesto: {
        select: {
          usuario: {
            select: {
              nombre: true,
            },
          },
        },
      },
    },
  });

  if (!solicitud) {
    redirigirError(
      inspeccionId,
      "La solicitud de reasignación no existe o ya fue resuelta.",
    );
  }

  await prisma.reasignacionInspector.update({
    where: {
      id: solicitud.id,
    },
    data: {
      estado: EstadoReasignacionInspector.RECHAZADA,
      resueltaPorId: session.user.id,
      resueltaEn: new Date(),
      comentarioResolucion,
    },
  });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "ReasignacionInspector",
    entidadId: solicitud.id,
    inspeccionId,
    usuarioId: session.user.id,
    descripcion:
      `${session.user.role} rechazó la reasignación de ${solicitud.inspeccion.folio} ` +
      `de ${solicitud.inspectorAnterior?.usuario.nombre ?? "Sin asignar"} ` +
      `a ${solicitud.inspectorPropuesto.usuario.nombre}. ` +
      `Motivo original: ${solicitud.motivo}. ` +
      `Resolución: ${comentarioResolucion}`,
  });

  revalidarInspeccion(inspeccionId);

  redirigirOk(
    inspeccionId,
    "Solicitud de reasignación rechazada. Se conserva el Inspector actual.",
  );
}

export async function liberarInicioSinPago(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const id = texto(formData, "id");
  const motivo = texto(formData, "motivo");

  if (!id) {
    redirect("/panel/inspecciones?error=Inspeccion%20no%20valida");
  }

  await exigirRolYAlcance(
    session,
    [RolUsuario.DIRECTOR],
    id,
  );

  if (motivo.length < 10) {
    redirigirError(
      id,
      "Indica un motivo de al menos 10 caracteres para autorizar la excepción.",
    );
  }

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    select: {
      id: true,
      folio: true,
      estado: true,
      inicioLiberadoSinPago: true,
      cotizacion: {
        select: {
          total: true,
          montoPagado: true,
          estadoPago: true,
        },
      },
    },
  });

  if (!inspeccion) {
    redirigirError(id, "La inspección no existe.");
  }

  if (inspeccion.estado !== EstadoInspeccion.PROGRAMADA) {
    redirigirError(
      id,
      "La excepción solo puede autorizarse mientras la inspección esté PROGRAMADA.",
    );
  }

  if (!inspeccion.cotizacion) {
    redirigirError(
      id,
      "Esta inspección no requiere una excepción financiera porque no tiene cotización asociada.",
    );
  }

  const total = Number(inspeccion.cotizacion.total);
  const pagado = Number(inspeccion.cotizacion.montoPagado);
  const saldo = Math.max(0, total - pagado);

  if (
    inspeccion.cotizacion.estadoPago === EstadoPago.PAGADO &&
    saldo <= 0.01
  ) {
    redirigirOk(
      id,
      "La cotización ya está liquidada; no es necesario autorizar una excepción.",
    );
  }

  if (inspeccion.inicioLiberadoSinPago) {
    redirigirOk(
      id,
      "Esta inspección ya cuenta con una excepción administrativa para iniciar con saldo pendiente.",
    );
  }

  await prisma.inspeccion.update({
    where: { id },
    data: {
      inicioLiberadoSinPago: true,
      inicioLiberadoPorId: session.user.id,
      inicioLiberadoEn: new Date(),
      motivoLiberacionPago: motivo,
    },
  });

  const saldoFormateado = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(saldo);

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "Inspeccion",
    entidadId: inspeccion.id,
    inspeccionId: inspeccion.id,
    descripcion:
      `Excepción administrativa autorizada para iniciar la inspección ${inspeccion.folio} ` +
      `con saldo pendiente de ${saldoFormateado}. Motivo: ${motivo}`,
  });

  revalidatePath(`/panel/inspecciones/${id}`);
  revalidatePath("/panel/inspecciones");
  revalidatePath("/panel/agenda");
  revalidatePath("/panel");

  redirigirOk(
    id,
    "Excepción administrativa autorizada. La inspección ya puede iniciar aunque conserve saldo pendiente.",
  );
}

export async function crearHallazgo(formData: FormData) {
  const session = await auth();
  const inspeccionId = texto(formData, "inspeccionId");
  const area = texto(formData, "area");
  const titulo = texto(formData, "titulo");
  const descripcion = texto(formData, "descripcion");
  const clasificacionRecibida = texto(formData, "clasificacion");
  const prioridadRecibida = texto(formData, "prioridad");

  if (!inspeccionId) {
    redirect("/panel/inspecciones?error=Inspeccion%20no%20valida");
  }

  if (!session?.user) {
    redirect("/login");
  }

  const rol = await exigirRolYAlcance(
    session,
    [RolUsuario.INSPECTOR],
    inspeccionId,
  );

  if (!area || !titulo || !descripcion) {
    redirigirError(inspeccionId, "Completa los campos obligatorios.");
  }

  if (
    !Object.values(ClasificacionHallazgo).includes(
      clasificacionRecibida as ClasificacionHallazgo,
    )
  ) {
    redirigirError(
      inspeccionId,
      "La clasificación seleccionada no es válida.",
    );
  }

  if (
    !Object.values(PrioridadHallazgo).includes(
      prioridadRecibida as PrioridadHallazgo,
    )
  ) {
    redirigirError(
      inspeccionId,
      "La prioridad seleccionada no es válida.",
    );
  }

  await validarPagoCompleto(inspeccionId);

  const inspeccionActual = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      estado: true,
      numeroInspeccion: true,
      inspector: {
        select: { usuarioId: true },
      },
    },
  });

  if (!inspeccionActual) {
    redirigirError(inspeccionId, "La inspección no existe.");
  }

  if (
    rol === RolUsuario.INSPECTOR &&
    !inspeccionActual.inspector?.usuarioId
  ) {
    redirigirError(
      inspeccionId,
      "Esta inspección todavía no tiene un inspector asignado.",
    );
  }

  if (
    inspeccionActual.estado !== EstadoInspeccion.EN_PROCESO
  ) {
    redirigirError(
      inspeccionId,
      "Los hallazgos solo pueden registrarse mientras la inspección está EN PROCESO.",
    );
  }

  if (
    rol === RolUsuario.INSPECTOR &&
    inspeccionActual.inspector?.usuarioId &&
    inspeccionActual.inspector.usuarioId !== session.user.id
  ) {
    redirigirError(
      inspeccionId,
      "Esta inspección está asignada a otro inspector.",
    );
  }

  const costoTexto = texto(formData, "costoEstimado");
  const costoEstimado = costoTexto ? Number(costoTexto) : null;

  const nuevoHallazgo = await prisma.hallazgo.create({
    data: {
      inspeccionId,
      creadoPorId: session.user.id,
      area,
      titulo,
      descripcion,
      clasificacion: clasificacionRecibida as ClasificacionHallazgo,
      prioridad: prioridadRecibida as PrioridadHallazgo,
      recomendacion: texto(formData, "recomendacion") || null,
      ubicacion: texto(formData, "ubicacion") || null,
      costoEstimado:
        costoEstimado !== null && Number.isFinite(costoEstimado)
          ? costoEstimado
          : null,
      tiempoReparacion: texto(formData, "tiempoReparacion") || null,
      responsable: texto(formData, "responsable") || null,
      estadoSeguimiento:
        inspeccionActual.numeroInspeccion > 1
          ? EstadoSeguimientoHallazgo.NUEVO_HALLAZGO
          : null,
    },
  });

  const hallazgos = await prisma.hallazgo.findMany({
    where: { inspeccionId },
    select: { clasificacion: true },
  });

  const indice = calcularIndice(
    hallazgos.map((hallazgo) => hallazgo.clasificacion),
  );

  await prisma.inspeccion.update({
    where: { id: inspeccionId },
    data: {
      ish: indice,
      semaforo: semaforoDesdeIndice(indice),
    },
  });

  await registrarAuditoria({
    tipo: TipoEvento.CREAR,
    entidad: "Hallazgo",
    entidadId: nuevoHallazgo.id,
    inspeccionId,
    usuarioId: session.user.id,
    descripcion:
      `Se creó el hallazgo "${nuevoHallazgo.titulo}" ` +
      `en la inspección ${inspeccionId}.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/captura`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/evidencias`);
  revalidatePath("/panel/inspecciones");
  revalidatePath("/panel");

  redirect(
    `/panel/inspecciones/${inspeccionId}/captura?hallazgoId=${nuevoHallazgo.id}&ok=${encodeURIComponent(
      "Hallazgo registrado. Ahora puedes agregar su evidencia.",
    )}`,
  );
}



export async function registrarSeguimientoHallazgo(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const inspeccionId = texto(formData, "inspeccionId");
  const hallazgoAnteriorId = texto(formData, "hallazgoAnteriorId");
  const estadoSeguimiento = texto(
    formData,
    "estadoSeguimiento",
  ) as EstadoSeguimientoHallazgo;
  const observacionSeguimiento = texto(
    formData,
    "observacionSeguimiento",
  );

  if (!inspeccionId || !hallazgoAnteriorId) {
    redirect(
      "/panel/inspecciones?error=Inspeccion%20o%20hallazgo%20no%20valido",
    );
  }

  const estadosPermitidos: EstadoSeguimientoHallazgo[] = [
    EstadoSeguimientoHallazgo.CORREGIDO,
    EstadoSeguimientoHallazgo.PARCIALMENTE_CORREGIDO,
    EstadoSeguimientoHallazgo.NO_CORREGIDO,
    EstadoSeguimientoHallazgo.CORRECCION_NO_SATISFACTORIA,
    EstadoSeguimientoHallazgo.NO_VERIFICABLE,
  ];

  if (!estadosPermitidos.includes(estadoSeguimiento)) {
    redirigirError(
      inspeccionId,
      "Selecciona un estado de seguimiento válido.",
    );
  }

  const rol = await exigirRolYAlcance(
    session,
    [RolUsuario.INSPECTOR],
    inspeccionId,
  );

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      id: true,
      folio: true,
      estado: true,
      numeroInspeccion: true,
      inspeccionAnteriorId: true,
      inspector: { select: { usuarioId: true } },
    },
  });

  if (!inspeccion) {
    redirigirError(inspeccionId, "La inspección no existe.");
  }

  if (inspeccion.numeroInspeccion <= 1 || !inspeccion.inspeccionAnteriorId) {
    redirigirError(
      inspeccionId,
      "Esta inspección no tiene un antecedente que requiera seguimiento.",
    );
  }

  if (inspeccion.estado !== EstadoInspeccion.EN_PROCESO) {
    redirigirError(
      inspeccionId,
      "El seguimiento solo puede registrarse mientras la inspección está EN PROCESO.",
    );
  }

  if (
    rol === RolUsuario.INSPECTOR &&
    !inspeccion.inspector?.usuarioId
  ) {
    redirigirError(
      inspeccionId,
      "Esta inspección todavía no tiene un inspector asignado.",
    );
  }

  if (
    rol === RolUsuario.INSPECTOR &&
    inspeccion.inspector?.usuarioId !== session.user.id
  ) {
    redirigirError(
      inspeccionId,
      "Esta inspección está asignada a otro inspector.",
    );
  }

  const hallazgoAnterior = await prisma.hallazgo.findFirst({
    where: {
      id: hallazgoAnteriorId,
      inspeccionId: inspeccion.inspeccionAnteriorId,
    },
  });

  if (!hallazgoAnterior) {
    redirigirError(
      inspeccionId,
      "El hallazgo antecedente no pertenece a la inspección anterior.",
    );
  }

  const yaRegistrado = await prisma.hallazgo.findFirst({
    where: {
      inspeccionId,
      hallazgoAnteriorId,
    },
    select: { id: true },
  });

  if (yaRegistrado) {
    redirigirError(
      inspeccionId,
      "Este hallazgo antecedente ya tiene seguimiento en la inspección actual.",
    );
  }

  const nuevoHallazgo = await prisma.hallazgo.create({
    data: {
      inspeccionId,
      creadoPorId: session.user.id,
      hallazgoAnteriorId,
      estadoSeguimiento,
      observacionSeguimiento: observacionSeguimiento || null,
      area: hallazgoAnterior.area,
      titulo: hallazgoAnterior.titulo,
      descripcion: hallazgoAnterior.descripcion,
      clasificacion: hallazgoAnterior.clasificacion,
      prioridad: hallazgoAnterior.prioridad,
      recomendacion: hallazgoAnterior.recomendacion,
      ubicacion: hallazgoAnterior.ubicacion,
      costoEstimado: hallazgoAnterior.costoEstimado,
      tiempoReparacion: hallazgoAnterior.tiempoReparacion,
      responsable: hallazgoAnterior.responsable,
      resuelto:
        estadoSeguimiento === EstadoSeguimientoHallazgo.CORREGIDO,
    },
  });

  const hallazgos = await prisma.hallazgo.findMany({
    where: { inspeccionId },
    select: { clasificacion: true },
  });

  const indice = calcularIndice(
    hallazgos.map((hallazgo) => hallazgo.clasificacion),
  );

  await prisma.inspeccion.update({
    where: { id: inspeccionId },
    data: {
      ish: indice,
      semaforo: semaforoDesdeIndice(indice),
    },
  });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "Hallazgo",
    entidadId: nuevoHallazgo.id,
    inspeccionId,
    usuarioId: session.user.id,
    descripcion:
      `Se registró seguimiento del hallazgo "${hallazgoAnterior.titulo}" ` +
      `en ${inspeccion.folio} con estado ${estadoSeguimiento}.`,
  });

  revalidarInspeccion(inspeccionId);

  redirect(
    `/panel/inspecciones/${inspeccionId}/captura?ok=${encodeURIComponent(
      "Seguimiento registrado. Agrega evidencia actual si corresponde.",
    )}`,
  );
}

export async function actualizarHallazgo(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const inspeccionId = texto(formData, "inspeccionId");
  const hallazgoId = texto(formData, "hallazgoId");
  const area = texto(formData, "area");
  const titulo = texto(formData, "titulo");
  const descripcion = texto(formData, "descripcion");
  const clasificacion = texto(
    formData,
    "clasificacion",
  ) as ClasificacionHallazgo;
  const prioridad = texto(
    formData,
    "prioridad",
  ) as PrioridadHallazgo;
  const estadoSeguimientoTexto = texto(formData, "estadoSeguimiento");
  const observacionSeguimiento = texto(
    formData,
    "observacionSeguimiento",
  );
  const estadoSeguimiento = estadoSeguimientoTexto
    ? (estadoSeguimientoTexto as EstadoSeguimientoHallazgo)
    : null;

  if (!inspeccionId || !hallazgoId) {
    redirect(
      "/panel/inspecciones?error=Inspeccion%20o%20hallazgo%20no%20valido",
    );
  }

  const volverAEdicion = (mensaje: string): never => {
    redirect(
      `/panel/inspecciones/${inspeccionId}/captura?editar=${hallazgoId}&error=${encodeURIComponent(
        mensaje,
      )}`,
    );
  };

  if (!area || !titulo || !descripcion) {
    volverAEdicion("Completa los campos obligatorios.");
  }

  if (!Object.values(ClasificacionHallazgo).includes(clasificacion)) {
    volverAEdicion("La clasificación seleccionada no es válida.");
  }

  if (!Object.values(PrioridadHallazgo).includes(prioridad)) {
    volverAEdicion("La prioridad seleccionada no es válida.");
  }

  const rol = await exigirRolYAlcance(
    session,
    [RolUsuario.INSPECTOR],
    inspeccionId,
  );

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      id: true,
      folio: true,
      estado: true,
      inspector: {
        select: {
          usuarioId: true,
        },
      },
    },
  });

  if (!inspeccion) {
    redirigirError(inspeccionId, "La inspección no existe.");
  }

  if (
    inspeccion.estado !== EstadoInspeccion.EN_PROCESO
  ) {
    redirigirError(
      inspeccionId,
      "Los hallazgos solo pueden editarse mientras la inspección está EN PROCESO.",
    );
  }

  if (
    rol === RolUsuario.INSPECTOR &&
    inspeccion.inspector?.usuarioId &&
    inspeccion.inspector.usuarioId !== session.user.id
  ) {
    redirigirError(
      inspeccionId,
      "Esta inspección está asignada a otro inspector.",
    );
  }

  const hallazgo = await prisma.hallazgo.findFirst({
    where: {
      id: hallazgoId,
      inspeccionId,
    },
    select: {
      id: true,
      titulo: true,
      hallazgoAnteriorId: true,
      estadoSeguimiento: true,
    },
  });

  if (!hallazgo) {
    redirigirError(
      inspeccionId,
      "El hallazgo no existe o no pertenece a esta inspección.",
    );
  }

  if (hallazgo.hallazgoAnteriorId) {
    const estadosPermitidos: EstadoSeguimientoHallazgo[] = [
      EstadoSeguimientoHallazgo.CORREGIDO,
      EstadoSeguimientoHallazgo.PARCIALMENTE_CORREGIDO,
      EstadoSeguimientoHallazgo.NO_CORREGIDO,
      EstadoSeguimientoHallazgo.CORRECCION_NO_SATISFACTORIA,
      EstadoSeguimientoHallazgo.NO_VERIFICABLE,
    ];

    if (!estadoSeguimiento || !estadosPermitidos.includes(estadoSeguimiento)) {
      volverAEdicion("Selecciona un estado de seguimiento válido.");
    }
  }

  const costoTexto = texto(formData, "costoEstimado");
  const costoEstimado = costoTexto ? Number(costoTexto) : null;

  await prisma.hallazgo.update({
    where: { id: hallazgoId },
    data: {
      area,
      titulo,
      descripcion,
      clasificacion,
      prioridad,
      recomendacion: texto(formData, "recomendacion") || null,
      ubicacion: texto(formData, "ubicacion") || null,
      costoEstimado:
        costoEstimado !== null && Number.isFinite(costoEstimado)
          ? costoEstimado
          : null,
      tiempoReparacion: texto(formData, "tiempoReparacion") || null,
      responsable: texto(formData, "responsable") || null,
      ...(hallazgo.hallazgoAnteriorId
        ? {
            estadoSeguimiento,
            observacionSeguimiento: observacionSeguimiento || null,
            resuelto:
              estadoSeguimiento === EstadoSeguimientoHallazgo.CORREGIDO,
          }
        : {}),
    },
  });

  const hallazgos = await prisma.hallazgo.findMany({
    where: { inspeccionId },
    select: { clasificacion: true },
  });

  const indice = calcularIndice(
    hallazgos.map((item) => item.clasificacion),
  );

  await prisma.inspeccion.update({
    where: { id: inspeccionId },
    data: {
      ish: indice,
      semaforo: semaforoDesdeIndice(indice),
    },
  });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "Hallazgo",
    entidadId: hallazgoId,
    inspeccionId,
    descripcion: hallazgo.hallazgoAnteriorId
      ? `Se editó el seguimiento del hallazgo "${hallazgo.titulo}" de la inspección ${inspeccion.folio}.`
      : `Se editó el hallazgo "${hallazgo.titulo}" de la inspección ${inspeccion.folio}.`,
  });

  revalidarInspeccion(inspeccionId);

  redirect(
    `/panel/inspecciones/${inspeccionId}/captura?ok=${encodeURIComponent(
      hallazgo.hallazgoAnteriorId
        ? "Seguimiento actualizado correctamente."
        : "Hallazgo actualizado correctamente.",
    )}`,
  );
}


export async function finalizarCaptura(formData: FormData) {
  const session = await auth();
  const inspeccionId = texto(formData, "inspeccionId");

  if (!session?.user) {
    redirect("/login");
  }

  if (!inspeccionId) {
    redirect("/panel/inspecciones?error=Inspeccion%20no%20valida");
  }

  const rol = await exigirRolYAlcance(
    session,
    [RolUsuario.INSPECTOR],
    inspeccionId,
  );

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      id: true,
      folio: true,
      estado: true,
      inspector: {
        select: {
          usuarioId: true,
        },
      },
      hallazgos: {
        select: {
          id: true,
          fotografias: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  if (!inspeccion) {
    redirigirError(inspeccionId, "La inspección no existe.");
  }

  if (inspeccion.estado !== EstadoInspeccion.EN_PROCESO) {
    redirigirError(
      inspeccionId,
      "Solo una inspección EN PROCESO puede finalizar su captura.",
    );
  }

  if (
    rol === RolUsuario.INSPECTOR &&
    inspeccion.inspector?.usuarioId &&
    inspeccion.inspector.usuarioId !== session.user.id
  ) {
    redirigirError(
      inspeccionId,
      "Esta inspección está asignada a otro inspector.",
    );
  }

  if (inspeccion.hallazgos.length === 0) {
    redirigirError(
      inspeccionId,
      "Registra al menos un hallazgo antes de finalizar la captura.",
    );
  }

  await validarPagoCompleto(inspeccionId);

  const sinEvidencia = inspeccion.hallazgos.filter(
    (hallazgo) => hallazgo.fotografias.length === 0,
  ).length;

  await prisma.$transaction(async (tx) => {
    await tx.inspeccion.update({
      where: { id: inspeccionId },
      data: {
        estado: EstadoInspeccion.REPORTE_PENDIENTE,
      },
    });

    await tx.revisionInspeccion.updateMany({
      where: {
        inspeccionId,
        decision: TipoDecisionRevision.DEVUELTO_INSPECTOR,
        estado: EstadoDecisionRevision.VIGENTE,
      },
      data: {
        estado: EstadoDecisionRevision.SUPERADA,
      },
    });
  });

  await registrarAuditoria({
    tipo: TipoEvento.FINALIZAR_CAPTURA,
    entidad: "Inspeccion",
    entidadId: inspeccion.id,
    inspeccionId,
    descripcion:
      `Captura finalizada para ${inspeccion.folio}. ` +
      `${inspeccion.hallazgos.length} hallazgo(s), ` +
      `${sinEvidencia} hallazgo(s) sin evidencia fotográfica.`,
  });

  revalidarInspeccion(inspeccionId);

  redirigirOk(
    inspeccionId,
    sinEvidencia > 0
      ? `Captura finalizada. Hay ${sinEvidencia} hallazgo(s) sin evidencia; revisa el expediente antes de aprobar.`
      : "Captura finalizada. La inspección quedó pendiente de revisión y aprobación.",
  );
}

type EstadoExpedienteRevision = {
  completo: boolean;
  faltantes: string[];
};

async function validarExpedienteParaRevision(
  inspeccionId: string,
): Promise<EstadoExpedienteRevision> {
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
        },
      },
    },
  });

  if (!inspeccion) {
    redirigirError(inspeccionId, "La inspección no existe.");
  }

  const faltantes: string[] = [];

  if (inspeccion.hallazgos.length === 0) {
    faltantes.push("al menos un hallazgo registrado");
  }

  const hallazgosSinEvidencia = inspeccion.hallazgos.filter(
    (hallazgo) => hallazgo.fotografias.length === 0,
  ).length;

  if (hallazgosSinEvidencia > 0) {
    faltantes.push(
      `${hallazgosSinEvidencia} hallazgo(s) sin evidencia fotográfica`,
    );
  }

  const firmaInspector = inspeccion.firmas.some((firma) =>
    firma.tipo.toLowerCase().includes("inspector"),
  );

  const firmaCliente = inspeccion.firmas.some((firma) =>
    firma.tipo.toLowerCase().includes("cliente"),
  );

  if (!firmaInspector) {
    faltantes.push("firma del inspector");
  }

  if (!firmaCliente) {
    faltantes.push("firma del cliente");
  }

  return {
    completo: faltantes.length === 0,
    faltantes,
  };
}

export async function darVistoBuenoCoordinador(formData: FormData) {
  const session = await auth();
  const inspeccionId = texto(formData, "inspeccionId");
  const comentario = texto(formData, "comentario");

  if (!session?.user) {
    redirect("/login");
  }

  if (!inspeccionId) {
    redirect("/panel/inspecciones?error=Inspeccion%20no%20valida");
  }

  await exigirRolYAlcance(
    session,
    [RolUsuario.COORDINADOR],
    inspeccionId,
  );

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      id: true,
      folio: true,
      estado: true,
      liberacionBloqueada: true,
      revisiones: {
        where: {
          rol: RolUsuario.COORDINADOR,
          decision: TipoDecisionRevision.VISTO_BUENO,
          estado: EstadoDecisionRevision.VIGENTE,
        },
        select: {
          id: true,
        },
        take: 1,
      },
    },
  });

  if (!inspeccion) {
    redirigirError(inspeccionId, "La inspección no existe.");
  }

  if (inspeccion.estado !== EstadoInspeccion.REPORTE_PENDIENTE) {
    redirigirError(
      inspeccionId,
      "El visto bueno técnico solo puede registrarse cuando la inspección está en REPORTE PENDIENTE.",
    );
  }

  if (inspeccion.liberacionBloqueada) {
    redirigirError(
      inspeccionId,
      "La liberación está bloqueada por Dirección. Solo Dirección puede levantar el bloqueo.",
    );
  }

  if (inspeccion.revisiones.length > 0) {
    redirigirError(
      inspeccionId,
      "Coordinación ya cuenta con un visto bueno técnico vigente. Solo podrá emitir uno nuevo si Gerencia o Dirección devuelve o invalida la revisión actual.",
    );
  }

  const estadoExpediente = await validarExpedienteParaRevision(inspeccionId);

  if (!estadoExpediente.completo) {
    redirigirError(
      inspeccionId,
      `El expediente todavía no puede recibir visto bueno de Coordinación. Faltan: ${estadoExpediente.faltantes.join(", ")}.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.revisionInspeccion.updateMany({
      where: {
        inspeccionId,
        rol: RolUsuario.COORDINADOR,
        estado: EstadoDecisionRevision.VIGENTE,
      },
      data: {
        estado: EstadoDecisionRevision.SUPERADA,
      },
    });

    await tx.revisionInspeccion.create({
      data: {
        inspeccionId,
        usuarioId: session.user.id,
        rol: RolUsuario.COORDINADOR,
        decision: TipoDecisionRevision.VISTO_BUENO,
        comentario: comentario || null,
      },
    });
  });

  await registrarAuditoria({
    tipo: TipoEvento.REVISION_INSPECCION,
    entidad: "RevisionInspeccion",
    inspeccionId,
    descripcion: `Coordinación otorgó visto bueno técnico a ${inspeccion.folio}${
      comentario ? `. Comentario: ${comentario}` : "."
    }`,
  });

  revalidarInspeccion(inspeccionId);

  redirigirOk(
    inspeccionId,
    "Visto bueno técnico de Coordinación registrado. La inspección continúa pendiente de aprobación.",
  );
}

export async function devolverAInspector(formData: FormData) {
  const session = await auth();
  const inspeccionId = texto(formData, "inspeccionId");
  const comentario = texto(formData, "comentario");

  if (!session?.user) {
    redirect("/login");
  }

  if (!inspeccionId) {
    redirect("/panel/inspecciones?error=Inspeccion%20no%20valida");
  }

  await exigirRolYAlcance(
    session,
    [RolUsuario.COORDINADOR],
    inspeccionId,
  );

  if (comentario.length < 10) {
    redirigirError(
      inspeccionId,
      "Indica un motivo de al menos 10 caracteres para devolver la inspección al Inspector.",
    );
  }

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      id: true,
      folio: true,
      estado: true,
      liberacionBloqueada: true,
      inspectorId: true,
    },
  });

  if (!inspeccion) {
    redirigirError(inspeccionId, "La inspección no existe.");
  }

  if (inspeccion.estado !== EstadoInspeccion.REPORTE_PENDIENTE) {
    redirigirError(
      inspeccionId,
      "Coordinación solo puede devolver al Inspector una inspección en REPORTE PENDIENTE.",
    );
  }

  if (inspeccion.liberacionBloqueada) {
    redirigirError(
      inspeccionId,
      "La liberación está bloqueada por Dirección. Coordinación no puede devolver el expediente mientras exista ese bloqueo.",
    );
  }

  if (!inspeccion.inspectorId) {
    redirigirError(
      inspeccionId,
      "La inspección no tiene un inspector asignado. Asigna un inspector antes de devolverla para corrección.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.revisionInspeccion.updateMany({
      where: {
        inspeccionId,
        estado: EstadoDecisionRevision.VIGENTE,
      },
      data: {
        estado: EstadoDecisionRevision.SUPERADA,
      },
    });

    await tx.revisionInspeccion.create({
      data: {
        inspeccionId,
        usuarioId: session.user.id,
        rol: RolUsuario.COORDINADOR,
        decision: TipoDecisionRevision.DEVUELTO_INSPECTOR,
        comentario,
      },
    });

    await tx.inspeccion.update({
      where: { id: inspeccionId },
      data: {
        estado: EstadoInspeccion.EN_PROCESO,
      },
    });
  });

  await registrarAuditoria({
    tipo: TipoEvento.REVISION_INSPECCION,
    entidad: "RevisionInspeccion",
    inspeccionId,
    descripcion:
      `Coordinación devolvió al Inspector la inspección ${inspeccion.folio}. ` +
      `El expediente regresó a EN PROCESO para corrección. Motivo: ${comentario}`,
  });

  revalidarInspeccion(inspeccionId);

  redirigirOk(
    inspeccionId,
    "Coordinación devolvió la inspección al Inspector. El expediente regresó a EN PROCESO para completar o corregir los requisitos pendientes.",
  );
}

export async function aprobarGerencia(formData: FormData) {
  const session = await auth();
  const inspeccionId = texto(formData, "inspeccionId");
  const comentario = texto(formData, "comentario");

  if (!session?.user) {
    redirect("/login");
  }

  if (!inspeccionId) {
    redirect("/panel/inspecciones?error=Inspeccion%20no%20valida");
  }

  await exigirRolYAlcance(
    session,
    [RolUsuario.GERENTE],
    inspeccionId,
  );

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      id: true,
      folio: true,
      estado: true,
      liberacionBloqueada: true,
      revisiones: {
        where: {
          rol: RolUsuario.COORDINADOR,
          decision: TipoDecisionRevision.VISTO_BUENO,
          estado: EstadoDecisionRevision.VIGENTE,
        },
        select: {
          id: true,
        },
        take: 1,
      },
    },
  });

  if (!inspeccion) {
    redirigirError(inspeccionId, "La inspección no existe.");
  }

  if (inspeccion.estado !== EstadoInspeccion.REPORTE_PENDIENTE) {
    redirigirError(
      inspeccionId,
      "Gerencia solo puede aprobar una inspección en REPORTE PENDIENTE.",
    );
  }

  if (inspeccion.liberacionBloqueada) {
    redirigirError(
      inspeccionId,
      "La liberación está bloqueada por Dirección. La aprobación de Gerencia no puede cerrar esta inspección.",
    );
  }

  if (inspeccion.revisiones.length === 0) {
    redirigirError(
      inspeccionId,
      "Gerencia requiere un visto bueno técnico vigente de Coordinación antes de aprobar y finalizar la inspección.",
    );
  }

  const estadoExpediente = await validarExpedienteParaRevision(inspeccionId);

  if (!estadoExpediente.completo) {
    redirigirError(
      inspeccionId,
      `Gerencia no puede finalizar un expediente incompleto. Faltan: ${estadoExpediente.faltantes.join(", ")}.`,
    );
  }

  await validarPagoCompleto(inspeccionId);

  await prisma.$transaction(async (tx) => {
    await tx.revisionInspeccion.updateMany({
      where: {
        inspeccionId,
        rol: RolUsuario.GERENTE,
        estado: EstadoDecisionRevision.VIGENTE,
      },
      data: {
        estado: EstadoDecisionRevision.SUPERADA,
      },
    });

    await tx.revisionInspeccion.create({
      data: {
        inspeccionId,
        usuarioId: session.user.id,
        rol: RolUsuario.GERENTE,
        decision: TipoDecisionRevision.APROBADO,
        comentario: comentario || null,
      },
    });

    await tx.inspeccion.update({
      where: { id: inspeccionId },
      data: {
        estado: EstadoInspeccion.FINALIZADA,
      },
    });
  });

  await registrarAuditoria({
    tipo: TipoEvento.REVISION_INSPECCION,
    entidad: "RevisionInspeccion",
    inspeccionId,
    descripcion: `Gerencia aprobó y cerró la inspección ${inspeccion.folio}${
      comentario ? `. Comentario: ${comentario}` : "."
    }`,
  });

  revalidarInspeccion(inspeccionId);

  redirigirOk(
    inspeccionId,
    "Gerencia aprobó la inspección. El expediente quedó FINALIZADO, sujeto a cualquier auditoría o veto posterior de Dirección.",
  );
}


export async function devolverACoordinacion(formData: FormData) {
  const session = await auth();
  const inspeccionId = texto(formData, "inspeccionId");
  const comentario = texto(formData, "comentario");

  if (!session?.user) {
    redirect("/login");
  }

  if (!inspeccionId) {
    redirect("/panel/inspecciones?error=Inspeccion%20no%20valida");
  }

  await exigirRolYAlcance(
    session,
    [RolUsuario.GERENTE],
    inspeccionId,
  );

  if (comentario.length < 10) {
    redirigirError(
      inspeccionId,
      "Indica un motivo de al menos 10 caracteres para devolver la inspección a Coordinación.",
    );
  }

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      id: true,
      folio: true,
      estado: true,
      liberacionBloqueada: true,
      revisiones: {
        where: {
          rol: RolUsuario.COORDINADOR,
          decision: TipoDecisionRevision.VISTO_BUENO,
          estado: EstadoDecisionRevision.VIGENTE,
        },
        select: {
          id: true,
        },
        take: 1,
      },
    },
  });

  if (!inspeccion) {
    redirigirError(inspeccionId, "La inspección no existe.");
  }

  if (inspeccion.estado !== EstadoInspeccion.REPORTE_PENDIENTE) {
    redirigirError(
      inspeccionId,
      "Gerencia solo puede devolver a Coordinación una inspección en REPORTE PENDIENTE.",
    );
  }

  if (inspeccion.liberacionBloqueada) {
    redirigirError(
      inspeccionId,
      "La liberación está bloqueada por Dirección. Gerencia no puede devolver el expediente mientras exista ese bloqueo.",
    );
  }

  if (inspeccion.revisiones.length === 0) {
    redirigirError(
      inspeccionId,
      "No existe un visto bueno técnico vigente de Coordinación que pueda devolverse.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.revisionInspeccion.updateMany({
      where: {
        inspeccionId,
        rol: RolUsuario.COORDINADOR,
        decision: TipoDecisionRevision.VISTO_BUENO,
        estado: EstadoDecisionRevision.VIGENTE,
      },
      data: {
        estado: EstadoDecisionRevision.INVALIDADA,
      },
    });

    await tx.revisionInspeccion.updateMany({
      where: {
        inspeccionId,
        rol: RolUsuario.GERENTE,
        estado: EstadoDecisionRevision.VIGENTE,
      },
      data: {
        estado: EstadoDecisionRevision.SUPERADA,
      },
    });

    await tx.revisionInspeccion.create({
      data: {
        inspeccionId,
        usuarioId: session.user.id,
        rol: RolUsuario.GERENTE,
        decision: TipoDecisionRevision.DEVUELTO_COORDINACION,
        comentario,
      },
    });

    await tx.inspeccion.update({
      where: { id: inspeccionId },
      data: {
        estado: EstadoInspeccion.REPORTE_PENDIENTE,
      },
    });
  });

  await registrarAuditoria({
    tipo: TipoEvento.REVISION_INSPECCION,
    entidad: "RevisionInspeccion",
    inspeccionId,
    descripcion:
      `Gerencia devolvió a Coordinación la inspección ${inspeccion.folio}. ` +
      `El visto bueno técnico vigente de Coordinación quedó invalidado. Motivo: ${comentario}`,
  });

  revalidarInspeccion(inspeccionId);

  redirigirOk(
    inspeccionId,
    "Gerencia devolvió la inspección a Coordinación. El visto bueno anterior quedó invalidado y Coordinación puede realizar una nueva revisión.",
  );
}

export async function aprobarDireccion(formData: FormData) {
  const session = await auth();
  const inspeccionId = texto(formData, "inspeccionId");
  const comentario = texto(formData, "comentario");

  if (!session?.user) {
    redirect("/login");
  }

  if (!inspeccionId) {
    redirect("/panel/inspecciones?error=Inspeccion%20no%20valida");
  }

  await exigirRolYAlcance(
    session,
    [RolUsuario.DIRECTOR],
    inspeccionId,
  );

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      id: true,
      folio: true,
      estado: true,
      liberacionBloqueada: true,
    },
  });

  if (!inspeccion) {
    redirigirError(inspeccionId, "La inspección no existe.");
  }

  if (
    inspeccion.estado !== EstadoInspeccion.REPORTE_PENDIENTE &&
    inspeccion.estado !== EstadoInspeccion.FINALIZADA
  ) {
    redirigirError(
      inspeccionId,
      "Dirección solo puede aprobar una inspección pendiente de reporte o ya finalizada.",
    );
  }

  if (inspeccion.liberacionBloqueada) {
    redirigirError(
      inspeccionId,
      "La inspección tiene un bloqueo directivo vigente. Usa la opción «Levantar bloqueo y aprobar».",
    );
  }

  const estadoExpediente = await validarExpedienteParaRevision(inspeccionId);
  if (!estadoExpediente.completo) {
    redirigirError(
      inspeccionId,
      `Dirección no puede aprobar un expediente incompleto. Faltan: ${estadoExpediente.faltantes.join(", ")}.`,
    );
  }

  await validarPagoCompleto(inspeccionId);

  await prisma.$transaction(async (tx) => {
    await tx.revisionInspeccion.updateMany({
      where: {
        inspeccionId,
        rol: RolUsuario.DIRECTOR,
        estado: EstadoDecisionRevision.VIGENTE,
      },
      data: {
        estado: EstadoDecisionRevision.SUPERADA,
      },
    });

    await tx.revisionInspeccion.create({
      data: {
        inspeccionId,
        usuarioId: session.user.id,
        rol: RolUsuario.DIRECTOR,
        decision: TipoDecisionRevision.APROBADO,
        comentario: comentario || null,
      },
    });

    await tx.inspeccion.update({
      where: { id: inspeccionId },
      data: {
        estado: EstadoInspeccion.FINALIZADA,
      },
    });
  });

  await registrarAuditoria({
    tipo: TipoEvento.REVISION_INSPECCION,
    entidad: "RevisionInspeccion",
    inspeccionId,
    descripcion: `Dirección aprobó y cerró la inspección ${inspeccion.folio}${
      comentario ? `. Comentario: ${comentario}` : "."
    }`,
  });

  revalidarInspeccion(inspeccionId);

  redirigirOk(
    inspeccionId,
    "Dirección aprobó la inspección. Su aprobación es suficiente para considerar el expediente FINALIZADO.",
  );
}

export async function noAprobarDireccion(formData: FormData) {
  const session = await auth();
  const inspeccionId = texto(formData, "inspeccionId");
  const comentario = texto(formData, "comentario");

  if (!session?.user) {
    redirect("/login");
  }

  if (!inspeccionId) {
    redirect("/panel/inspecciones?error=Inspeccion%20no%20valida");
  }

  await exigirRolYAlcance(
    session,
    [RolUsuario.DIRECTOR],
    inspeccionId,
  );

  if (comentario.length < 10) {
    redirigirError(
      inspeccionId,
      "Indica un motivo de al menos 10 caracteres para no aprobar la inspección.",
    );
  }

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      id: true,
      folio: true,
      estado: true,
    },
  });

  if (!inspeccion) {
    redirigirError(inspeccionId, "La inspección no existe.");
  }

  if (
    inspeccion.estado !== EstadoInspeccion.REPORTE_PENDIENTE &&
    inspeccion.estado !== EstadoInspeccion.FINALIZADA
  ) {
    redirigirError(
      inspeccionId,
      "Dirección solo puede no aprobar una inspección pendiente de revisión o ya finalizada.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.revisionInspeccion.updateMany({
      where: {
        inspeccionId,
        estado: EstadoDecisionRevision.VIGENTE,
      },
      data: {
        estado: EstadoDecisionRevision.INVALIDADA,
      },
    });

    await tx.revisionInspeccion.create({
      data: {
        inspeccionId,
        usuarioId: session.user.id,
        rol: RolUsuario.DIRECTOR,
        decision: TipoDecisionRevision.NO_APROBADO,
        comentario,
      },
    });

    await tx.inspeccion.update({
      where: { id: inspeccionId },
      data: {
        estado: EstadoInspeccion.REPORTE_PENDIENTE,
        liberacionBloqueada: true,
        bloqueadaPorId: session.user.id,
        bloqueadaEn: new Date(),
        motivoBloqueoLiberacion: comentario,
      },
    });
  });

  await registrarAuditoria({
    tipo: TipoEvento.BLOQUEAR_LIBERACION,
    entidad: "Inspeccion",
    entidadId: inspeccion.id,
    inspeccionId,
    descripcion:
      `Dirección NO APROBÓ la inspección ${inspeccion.folio}. ` +
      `Todas las aprobaciones vigentes anteriores quedaron invalidadas. Motivo: ${comentario}`,
  });

  revalidarInspeccion(inspeccionId);

  redirigirOk(
    inspeccionId,
    "Dirección no aprobó la inspección. La liberación quedó bloqueada y las aprobaciones anteriores fueron invalidadas.",
  );
}

export async function retenerParaAuditoria(formData: FormData) {
  const session = await auth();
  const inspeccionId = texto(formData, "inspeccionId");
  const comentario = texto(formData, "comentario");

  if (!session?.user) {
    redirect("/login");
  }

  if (!inspeccionId) {
    redirect("/panel/inspecciones?error=Inspeccion%20no%20valida");
  }

  await exigirRolYAlcance(
    session,
    [RolUsuario.DIRECTOR],
    inspeccionId,
  );

  if (comentario.length < 10) {
    redirigirError(
      inspeccionId,
      "Indica un motivo de al menos 10 caracteres para retener la inspección en auditoría.",
    );
  }

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      id: true,
      folio: true,
      estado: true,
      liberacionBloqueada: true,
    },
  });

  if (!inspeccion) {
    redirigirError(inspeccionId, "La inspección no existe.");
  }

  if (
    inspeccion.estado !== EstadoInspeccion.REPORTE_PENDIENTE &&
    inspeccion.estado !== EstadoInspeccion.FINALIZADA
  ) {
    redirigirError(
      inspeccionId,
      "La auditoría directiva solo puede retener una inspección que ya terminó su captura.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.revisionInspeccion.updateMany({
      where: {
        inspeccionId,
        estado: EstadoDecisionRevision.VIGENTE,
      },
      data: {
        estado: EstadoDecisionRevision.INVALIDADA,
      },
    });

    await tx.revisionInspeccion.create({
      data: {
        inspeccionId,
        usuarioId: session.user.id,
        rol: RolUsuario.DIRECTOR,
        decision: TipoDecisionRevision.RETENIDO_AUDITORIA,
        comentario,
      },
    });

    await tx.inspeccion.update({
      where: { id: inspeccionId },
      data: {
        liberacionBloqueada: true,
        bloqueadaPorId: session.user.id,
        bloqueadaEn: new Date(),
        motivoBloqueoLiberacion: comentario,
      },
    });
  });

  await registrarAuditoria({
    tipo: TipoEvento.BLOQUEAR_LIBERACION,
    entidad: "Inspeccion",
    entidadId: inspeccion.id,
    inspeccionId,
    descripcion:
      `Dirección retuvo para auditoría la inspección ${inspeccion.folio}. ` +
      `Todas las aprobaciones vigentes anteriores quedaron invalidadas. Motivo: ${comentario}`,
  });

  revalidarInspeccion(inspeccionId);

  redirigirOk(
    inspeccionId,
    "Inspección retenida para auditoría directiva. La liberación quedó bloqueada.",
  );
}

export async function levantarBloqueoYAprobar(formData: FormData) {
  const session = await auth();
  const inspeccionId = texto(formData, "inspeccionId");
  const comentario = texto(formData, "comentario");

  if (!session?.user) {
    redirect("/login");
  }

  if (!inspeccionId) {
    redirect("/panel/inspecciones?error=Inspeccion%20no%20valida");
  }

  await exigirRolYAlcance(
    session,
    [RolUsuario.DIRECTOR],
    inspeccionId,
  );

  if (comentario.length < 10) {
    redirigirError(
      inspeccionId,
      "Indica un comentario de al menos 10 caracteres para levantar el bloqueo y aprobar.",
    );
  }

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: {
      id: true,
      folio: true,
      estado: true,
      liberacionBloqueada: true,
    },
  });

  if (!inspeccion) {
    redirigirError(inspeccionId, "La inspección no existe.");
  }

  if (!inspeccion.liberacionBloqueada) {
    redirigirError(
      inspeccionId,
      "Esta inspección no tiene un bloqueo directivo vigente.",
    );
  }

  await validarPagoCompleto(inspeccionId);

  await prisma.$transaction(async (tx) => {
    await tx.revisionInspeccion.updateMany({
      where: {
        inspeccionId,
        estado: EstadoDecisionRevision.VIGENTE,
      },
      data: {
        estado: EstadoDecisionRevision.SUPERADA,
      },
    });

    await tx.revisionInspeccion.create({
      data: {
        inspeccionId,
        usuarioId: session.user.id,
        rol: RolUsuario.DIRECTOR,
        decision: TipoDecisionRevision.LEVANTAR_BLOQUEO,
        comentario,
        estado: EstadoDecisionRevision.SUPERADA,
      },
    });

    await tx.revisionInspeccion.create({
      data: {
        inspeccionId,
        usuarioId: session.user.id,
        rol: RolUsuario.DIRECTOR,
        decision: TipoDecisionRevision.APROBADO,
        comentario: `Bloqueo levantado. ${comentario}`,
      },
    });

    await tx.inspeccion.update({
      where: { id: inspeccionId },
      data: {
        estado: EstadoInspeccion.FINALIZADA,
        liberacionBloqueada: false,
        bloqueadaPorId: null,
        bloqueadaEn: null,
        motivoBloqueoLiberacion: null,
      },
    });
  });

  await registrarAuditoria({
    tipo: TipoEvento.DESBLOQUEAR_LIBERACION,
    entidad: "Inspeccion",
    entidadId: inspeccion.id,
    inspeccionId,
    descripcion:
      `Dirección levantó el bloqueo y aprobó la inspección ${inspeccion.folio}. ` +
      `Comentario: ${comentario}`,
  });

  revalidarInspeccion(inspeccionId);

  redirigirOk(
    inspeccionId,
    "Dirección levantó el bloqueo y aprobó la inspección. El expediente quedó FINALIZADO.",
  );
}

export async function cambiarEstado(formData: FormData) {
  const session = await auth();
  const id = texto(formData, "id");
  const estado = texto(formData, "estado") as EstadoInspeccion;

  if (!id) {
    redirect("/panel/inspecciones?error=Inspeccion%20no%20valida");
  }

  if (!session?.user) {
    redirect("/login");
  }

  await exigirRolYAlcance(
    session,
    [RolUsuario.DIRECTOR],
    id,
  );

  if (!Object.values(EstadoInspeccion).includes(estado)) {
    redirigirError(id, "El estado seleccionado no es válido.");
  }

  if (estado === EstadoInspeccion.FINALIZADA) {
    redirigirError(
      id,
      "La inspección solo puede pasar a FINALIZADA mediante aprobación de Gerencia o Dirección.",
    );
  }

  if (
    estado === EstadoInspeccion.EN_PROCESO ||
    estado === EstadoInspeccion.CANCELADA
  ) {
    redirigirError(
      id,
      "Usa el flujo específico de inicio o cancelación; el estado no puede forzarse manualmente.",
    );
  }

  if (estado === EstadoInspeccion.REPORTE_PENDIENTE) {
    redirigirError(
      id,
      "Usa la acción «Finalizar captura» para pasar la inspección a REPORTE PENDIENTE.",
    );
  }

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    select: { estado: true },
  });

  if (!inspeccion) {
    redirigirError(id, "La inspección no existe.");
  }

  if (inspeccion.estado === EstadoInspeccion.FINALIZADA) {
    redirigirError(
      id,
      "Una inspección FINALIZADA está en modo solo lectura y no puede cambiar de estado.",
    );
  }

  if (inspeccion.estado === estado) {
    redirigirOk(id, "La inspección ya se encuentra en ese estado.");
  }

  await prisma.inspeccion.update({
    where: { id },
    data: { estado },
  });

  revalidatePath(`/panel/inspecciones/${id}`);
  revalidatePath("/panel/inspecciones");
  revalidatePath("/panel");

  redirigirOk(id, `Estado actualizado a ${estado.replaceAll("_", " ")}.`);
}

export async function iniciarInspeccion(formData: FormData) {
  const session = await auth();
  const id = texto(formData, "id");

  if (!id) {
    redirect("/panel/inspecciones?error=Inspeccion%20no%20valida");
  }

  if (!session?.user) {
    redirect("/login");
  }

  const rol = await exigirRolYAlcance(
    session,
    [RolUsuario.INSPECTOR],
    id,
  );

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    select: {
      estado: true,
      inspector: { select: { usuarioId: true } },
    },
  });

  if (!inspeccion) {
    redirigirError(id, "La inspección no existe.");
  }

  if (inspeccion.estado === EstadoInspeccion.CANCELADA) {
    redirigirError(id, "Una inspección cancelada no puede iniciarse.");
  }

  if (inspeccion.estado === EstadoInspeccion.FINALIZADA) {
    redirigirError(id, "La inspección ya se encuentra finalizada y está en modo solo lectura.");
  }

  if (
    rol === RolUsuario.INSPECTOR &&
    inspeccion.inspector?.usuarioId &&
    inspeccion.inspector.usuarioId !== session.user.id
  ) {
    redirigirError(id, "Esta inspección está asignada a otro inspector.");
  }

  await validarPagoCompleto(id);

  if (inspeccion.estado === EstadoInspeccion.PROGRAMADA) {
    await prisma.inspeccion.update({
      where: { id },
      data: { estado: EstadoInspeccion.EN_PROCESO },
    });
  }

  revalidatePath(`/panel/inspecciones/${id}`);
  revalidatePath("/panel");

  redirect(`/panel/inspecciones/${id}/captura`);
}

export async function cancelarInspeccion(formData: FormData) {
  const session = await auth();
  const id = texto(formData, "id");
  const motivo = texto(formData, "motivo");

  if (!id) {
    redirect("/panel/inspecciones?error=Inspeccion%20no%20valida");
  }

  if (!session?.user) {
    redirect("/login");
  }

  await exigirRolYAlcance(
    session,
    [RolUsuario.GERENTE, RolUsuario.DIRECTOR],
    id,
    "TECNICO",
  );

  if (motivo.length < 10) {
    redirigirError(
      id,
      "Documenta el motivo de la cancelación con al menos 10 caracteres.",
    );
  }

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    select: { id: true, folio: true, estado: true },
  });

  if (!inspeccion) {
    redirigirError(id, "La inspección no existe.");
  }

  if (inspeccion.estado === EstadoInspeccion.FINALIZADA) {
    redirigirError(id, "Una inspección finalizada no puede cancelarse.");
  }

  await prisma.inspeccion.update({
    where: { id },
    data: { estado: EstadoInspeccion.CANCELADA },
  });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "Inspeccion",
    entidadId: inspeccion.id,
    inspeccionId: id,
    usuarioId: session.user.id,
    descripcion: `${session.user.role} canceló la inspección ${inspeccion.folio}. Motivo: ${motivo}`,
  });

  revalidatePath(`/panel/inspecciones/${id}`);
  revalidatePath("/panel/inspecciones");
  revalidatePath("/panel");

  redirigirOk(id, "Inspección cancelada.");
}

function crearCodigoValidacion() {
  const bloque = crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase();
  return `CH-${bloque}`;
}

function dictamenDesdeIndice(indice: number) {
  if (indice >= 90) {
    return "El inmueble presenta una condición habitacional favorable, sin hallazgos críticos que impidan su uso ordinario, sujeto a las recomendaciones del reporte técnico.";
  }
  if (indice >= 75) {
    return "El inmueble presenta una condición habitacional aceptable, con observaciones y acciones correctivas recomendadas para conservar su desempeño y seguridad.";
  }
  if (indice >= 60) {
    return "El inmueble requiere atención correctiva prioritaria. Se recomienda atender los hallazgos no conformes antes de su recepción, ocupación o inversión.";
  }
  return "El inmueble presenta condiciones críticas o deficiencias relevantes. Se recomienda no cerrar la recepción o adquisición hasta contar con correcciones y evaluaciones especializadas.";
}

export async function emitirCertificado(formData: FormData) {
  const session = await auth();
  const inspeccionId = texto(formData, "inspeccionId");

  if (!inspeccionId) {
    redirect("/panel/inspecciones?error=Inspeccion%20no%20valida");
  }

  if (!session?.user) {
    redirect("/login");
  }

  await exigirRolYAlcance(
    session,
    [RolUsuario.GERENTE, RolUsuario.DIRECTOR],
    inspeccionId,
  );

  await validarLiquidacionParaCertificado(inspeccionId);

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    include: {
      hallazgos: {
        select: {
          clasificacion: true,
        },
      },
      certificado: true,
      revisiones: {
        where: {
          estado: EstadoDecisionRevision.VIGENTE,
          decision: TipoDecisionRevision.APROBADO,
          rol: {
            in: [RolUsuario.GERENTE, RolUsuario.DIRECTOR],
          },
        },
        select: {
          id: true,
          rol: true,
        },
      },
    },
  });

  if (!inspeccion) {
    redirigirError(inspeccionId, "Inspección no encontrada.");
  }

  if (inspeccion.estado !== EstadoInspeccion.FINALIZADA) {
    redirigirError(
      inspeccionId,
      "El certificado solo puede emitirse después de que Gerencia o Dirección aprueben y finalicen la inspección.",
    );
  }

  if (inspeccion.liberacionBloqueada) {
    redirigirError(
      inspeccionId,
      "La liberación de esta inspección está bloqueada por Dirección. No puede emitirse el certificado.",
    );
  }

  if (inspeccion.revisiones.length === 0) {
    redirigirError(
      inspeccionId,
      "No existe una aprobación vigente de Gerencia o Dirección para emitir el certificado.",
    );
  }

  if (inspeccion.certificado) {
    redirect(`/panel/inspecciones/${inspeccionId}/certificado`);
  }

  const indiceCalculado = calcularIndice(
    inspeccion.hallazgos.map(
      (hallazgo) => hallazgo.clasificacion,
    ),
  );

  const indice =
    indiceCalculado ?? Number(inspeccion.ish ?? 100);

  const year = new Date().getFullYear();

  const baseFolio =
    `CERT-${year}-${inspeccion.folio.replaceAll("CH-", "")}`;

  const certificado = await prisma.$transaction(async (tx) => {
    const certificadoCreado = await tx.certificado.create({
      data: {
        inspeccionId,
        folio: baseFolio,
        codigoValidacion: crearCodigoValidacion(),
        dictamen: dictamenDesdeIndice(indice),
        ish: indice,
      },
    });

    await tx.inspeccion.update({
      where: {
        id: inspeccionId,
      },
      data: {
        ish: indice,
        semaforo: semaforoDesdeIndice(indice),
      },
    });

    return certificadoCreado;
  });

  await registrarAuditoria({
    tipo: TipoEvento.EMITIR_CERTIFICADO,
    entidad: "Certificado",
    entidadId: certificado.id,
    inspeccionId,
    usuarioId: session.user.id,
    descripcion:
      `${session.user.role} emitió el certificado ${certificado.folio} ` +
      `para la inspección ${inspeccion.folio}.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}`);
  revalidatePath(
    `/panel/inspecciones/${inspeccionId}/certificado`,
  );
  revalidatePath("/panel/inspecciones");
  revalidatePath("/panel");

  redirect(
    `/panel/inspecciones/${inspeccionId}/certificado`,
  );
}