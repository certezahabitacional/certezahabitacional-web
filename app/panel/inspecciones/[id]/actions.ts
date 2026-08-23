"use server";

import {
  ClasificacionHallazgo,
  EstadoInspeccion,
  EstadoPago,
  PrioridadHallazgo,
  TipoEvento,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
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

  const rolesAutorizados = [
    "DIRECTOR",
    "GERENTE",
    "ADMINISTRADOR",
  ];

  if (!rolesAutorizados.includes(session.user.role)) {
    redirigirError(
      id,
      "Solo Dirección, Gerencia o Administración pueden autorizar el inicio con saldo pendiente.",
    );
  }

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
  const inspeccionId = texto(formData, "inspeccionId");
  const area = texto(formData, "area");
  const titulo = texto(formData, "titulo");
  const descripcion = texto(formData, "descripcion");

  if (!inspeccionId) {
    redirect("/panel/inspecciones?error=Inspeccion%20no%20valida");
  }

  if (!area || !titulo || !descripcion) {
    redirigirError(inspeccionId, "Completa los campos obligatorios.");
  }

  await validarPagoCompleto(inspeccionId);

  const inspeccionActual = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: { estado: true },
  });

  if (!inspeccionActual) {
    redirigirError(inspeccionId, "La inspección no existe.");
  }

  if (
    inspeccionActual.estado !== EstadoInspeccion.EN_PROCESO &&
    inspeccionActual.estado !== EstadoInspeccion.REPORTE_PENDIENTE
  ) {
    redirigirError(
      inspeccionId,
      "Primero debes iniciar la inspección antes de registrar hallazgos.",
    );
  }

  const costoTexto = texto(formData, "costoEstimado");
  const costoEstimado = costoTexto ? Number(costoTexto) : null;

  await prisma.hallazgo.create({
    data: {
      inspeccionId,
      area,
      titulo,
      descripcion,
      clasificacion: texto(
        formData,
        "clasificacion",
      ) as ClasificacionHallazgo,
      prioridad: texto(formData, "prioridad") as PrioridadHallazgo,
      recomendacion: texto(formData, "recomendacion") || null,
      ubicacion: texto(formData, "ubicacion") || null,
      costoEstimado:
        costoEstimado !== null && Number.isFinite(costoEstimado)
          ? costoEstimado
          : null,
      tiempoReparacion: texto(formData, "tiempoReparacion") || null,
      responsable: texto(formData, "responsable") || null,
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

  revalidatePath(`/panel/inspecciones/${inspeccionId}`);
  revalidatePath("/panel/inspecciones");
  revalidatePath("/panel");

  redirigirOk(inspeccionId, "Hallazgo registrado correctamente.");
}

export async function cambiarEstado(formData: FormData) {
  const id = texto(formData, "id");
  const estado = texto(formData, "estado") as EstadoInspeccion;

  if (!id) {
    redirect("/panel/inspecciones?error=Inspeccion%20no%20valida");
  }

  if (!Object.values(EstadoInspeccion).includes(estado)) {
    redirigirError(id, "El estado seleccionado no es válido.");
  }

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    select: { estado: true },
  });

  if (!inspeccion) {
    redirigirError(id, "La inspección no existe.");
  }

  if (inspeccion.estado === estado) {
    redirigirOk(id, "La inspección ya se encuentra en ese estado.");
  }

  if (
    estado === EstadoInspeccion.EN_PROCESO ||
    estado === EstadoInspeccion.REPORTE_PENDIENTE ||
    estado === EstadoInspeccion.FINALIZADA
  ) {
    await validarPagoCompleto(id);
  }

  if (
    inspeccion.estado === EstadoInspeccion.PROGRAMADA &&
    estado !== EstadoInspeccion.EN_PROCESO &&
    estado !== EstadoInspeccion.CANCELADA
  ) {
    redirigirError(
      id,
      "Una inspección programada debe iniciar antes de avanzar a etapas posteriores.",
    );
  }

  if (
    inspeccion.estado === EstadoInspeccion.EN_PROCESO &&
    estado === EstadoInspeccion.FINALIZADA
  ) {
    redirigirError(
      id,
      "Primero cambia la inspección a REPORTE PENDIENTE antes de finalizarla.",
    );
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
  const id = texto(formData, "id");

  if (!id) {
    redirect("/panel/inspecciones?error=Inspeccion%20no%20valida");
  }

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    select: { estado: true },
  });

  if (!inspeccion) {
    redirigirError(id, "La inspección no existe.");
  }

  if (inspeccion.estado === EstadoInspeccion.CANCELADA) {
    redirigirError(id, "Una inspección cancelada no puede iniciarse.");
  }

  if (inspeccion.estado === EstadoInspeccion.FINALIZADA) {
    redirigirError(id, "La inspección ya se encuentra finalizada.");
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
  const id = texto(formData, "id");

  if (!id) {
    redirect("/panel/inspecciones?error=Inspeccion%20no%20valida");
  }

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    select: { estado: true },
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
  const inspeccionId = texto(formData, "inspeccionId");

  if (!inspeccionId) {
    redirect("/panel/inspecciones?error=Inspeccion%20no%20valida");
  }

  await validarPagoCompleto(inspeccionId);

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    include: {
      hallazgos: {
        select: {
          clasificacion: true,
        },
      },
      certificado: true,
    },
  });

  if (!inspeccion) {
    redirigirError(inspeccionId, "Inspección no encontrada.");
  }

  if (inspeccion.estado !== EstadoInspeccion.REPORTE_PENDIENTE &&
      inspeccion.estado !== EstadoInspeccion.FINALIZADA) {
    redirigirError(
      inspeccionId,
      "El certificado solo puede emitirse cuando la inspección llegó a la etapa de reporte.",
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
        estado: EstadoInspeccion.FINALIZADA,
      },
    });

    return certificadoCreado;
  });

  await registrarAuditoria({
    tipo: TipoEvento.EMITIR_CERTIFICADO,
    entidad: "Certificado",
    entidadId: certificado.id,
    inspeccionId,
    descripcion: `Se emitió el certificado ${certificado.folio} para la inspección ${inspeccion.folio}.`,
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