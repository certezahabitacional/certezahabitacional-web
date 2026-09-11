"use server";

import { EstadoCotizacion, EstadoPago, RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

function texto(formData: FormData, campo: string) {
  return String(formData.get(campo) ?? "").trim();
}

function volver(tipo: "ok" | "error", mensaje: string): never {
  redirect(`/panel/caja?${tipo}=${encodeURIComponent(mensaje)}`);
}

async function obtenerUsuarioCaja() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, rol: true, activo: true },
  });
  if (!usuario?.activo || (usuario.rol !== RolUsuario.DIRECTOR && usuario.rol !== RolUsuario.ADMINISTRADOR)) {
    redirect("/acceso");
  }
  return usuario;
}

export async function registrarPagoLibre(formData: FormData) {
  const usuario = await obtenerUsuarioCaja();
  const cotizacionId = texto(formData, "cotizacionId");
  const monto = Number(texto(formData, "monto"));
  const referencia = texto(formData, "referencia") || null;
  const metodoPago = texto(formData, "metodoPago") || null;
  const notas = texto(formData, "notas") || null;

  if (!cotizacionId) volver("error", "Cotización inválida.");
  if (!Number.isFinite(monto) || monto <= 0) volver("error", "Captura un importe de pago válido.");

  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id: cotizacionId },
    select: { id: true, folio: true, estado: true, total: true, montoPagado: true },
  });

  if (!cotizacion) volver("error", "La cotización no existe.");
  if (cotizacion.estado !== EstadoCotizacion.AUTORIZADA) {
    volver("error", "Solo pueden registrarse pagos en cotizaciones aceptadas y autorizadas.");
  }

  const total = Number(cotizacion.total);
  const pagadoActual = Number(cotizacion.montoPagado);
  const nuevoPagado = pagadoActual + monto;
  if (nuevoPagado > total + 0.001) {
    volver("error", `El pago excede el saldo pendiente de ${(total - pagadoActual).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}.`);
  }

  const nuevoEstado = nuevoPagado >= total - 0.001
    ? EstadoPago.PAGADO
    : nuevoPagado > 0
      ? EstadoPago.PARCIAL
      : EstadoPago.PENDIENTE;

  await prisma.$transaction(async (tx) => {
    await tx.pagoCotizacion.create({
      data: {
        cotizacionId,
        monto,
        fechaPago: new Date(),
        referencia,
        metodoPago,
        notas,
        registradoPorId: usuario.id,
      },
    });
    await tx.cotizacion.update({
      where: { id: cotizacionId },
      data: { montoPagado: nuevoPagado, estadoPago: nuevoEstado },
    });
  });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "PagoCotizacion",
    entidadId: cotizacionId,
    usuarioId: usuario.id,
    descripcion: `${usuario.rol} registró un pago de ${monto.toLocaleString("es-MX", { style: "currency", currency: "MXN" })} en ${cotizacion.folio}.`,
  });

  revalidatePath("/panel/caja");
  revalidatePath("/panel/cotizaciones");
  revalidatePath("/panel/inspecciones/nueva");
  volver("ok", "Pago registrado correctamente.");
}

export async function autorizarExcepcionApertura(formData: FormData) {
  const usuario = await obtenerUsuarioCaja();
  if (usuario.rol !== RolUsuario.DIRECTOR) volver("error", "Solo Dirección puede autorizar esta excepción.");
  const cotizacionId = texto(formData, "cotizacionId");
  const motivo = texto(formData, "motivo");
  if (!motivo) volver("error", "Registra el motivo de la excepción.");

  await prisma.cotizacion.update({
    where: { id: cotizacionId },
    data: {
      excepcionApertura: true,
      excepcionAperturaPorId: usuario.id,
      excepcionAperturaEn: new Date(),
      motivoExcepcionApertura: motivo,
    },
  });
  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "Cotizacion",
    entidadId: cotizacionId,
    usuarioId: usuario.id,
    descripcion: `Dirección autorizó excepción de pago mínimo del 50% para apertura de Nueva Inspección. Motivo: ${motivo}`,
  });
  revalidatePath("/panel/caja");
  revalidatePath("/panel/inspecciones/nueva");
  volver("ok", "Excepción de apertura autorizada.");
}

export async function autorizarExcepcionInicio(formData: FormData) {
  const usuario = await obtenerUsuarioCaja();
  if (usuario.rol !== RolUsuario.DIRECTOR) volver("error", "Solo Dirección puede autorizar esta excepción.");
  const cotizacionId = texto(formData, "cotizacionId");
  const motivo = texto(formData, "motivo");
  if (!motivo) volver("error", "Registra el motivo de la excepción.");

  await prisma.cotizacion.update({
    where: { id: cotizacionId },
    data: {
      excepcionInicio: true,
      excepcionInicioPorId: usuario.id,
      excepcionInicioEn: new Date(),
      motivoExcepcionInicio: motivo,
    },
  });
  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "Cotizacion",
    entidadId: cotizacionId,
    usuarioId: usuario.id,
    descripcion: `Dirección autorizó excepción de pago total para inicio de inspección en campo. Motivo: ${motivo}`,
  });
  revalidatePath("/panel/caja");
  revalidatePath("/panel/inspecciones");
  volver("ok", "Excepción de inicio autorizada.");
}