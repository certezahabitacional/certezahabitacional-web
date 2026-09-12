"use server";

import { EstadoCotizacion, RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

function texto(formData: FormData, campo: string) {
  return String(formData.get(campo) ?? "").trim();
}

async function gestor() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, nombre: true, rol: true, activo: true },
  });
  if (
    !usuario?.activo ||
    (usuario.rol !== RolUsuario.DIRECTOR && usuario.rol !== RolUsuario.ADMINISTRADOR)
  ) {
    redirect("/acceso");
  }
  return usuario;
}

function volver(tipo: "ok" | "error", mensaje: string): never {
  redirect(`/panel/cotizaciones?${tipo}=${encodeURIComponent(mensaje)}`);
}

function estaVencida(vigenciaHasta: Date | null) {
  return Boolean(vigenciaHasta && vigenciaHasta < new Date());
}

export async function marcarListaParaCliente(formData: FormData) {
  const usuario = await gestor();
  const id = texto(formData, "id");
  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id },
    select: {
      id: true,
      folio: true,
      estado: true,
      vigenciaHasta: true,
      total: true,
      inmuebleId: true,
      cliente: { select: { usuarioId: true } },
      versiones: { orderBy: { version: "desc" }, take: 1, select: { id: true } },
    },
  });
  if (!cotizacion) volver("error", "La cotización no existe.");
  if (cotizacion.estado !== EstadoCotizacion.BORRADOR) {
    volver("error", "Solo una cotización formal en borrador puede quedar lista para aceptación del cliente.");
  }
  if (!cotizacion.cliente.usuarioId) {
    volver("error", "Asigna primero acceso al cliente para que pueda aceptar la cotización en el portal.");
  }
  if (!cotizacion.inmuebleId) {
    volver("error", "La cotización debe estar vinculada a un inmueble antes de enviarse al cliente.");
  }
  if (Number(cotizacion.total) <= 0) {
    volver("error", "La cotización debe tener un importe total mayor a cero.");
  }
  if (!cotizacion.versiones[0]) {
    volver("error", "La cotización debe tener un documento definitivo registrado antes de enviarse al cliente.");
  }
  if (estaVencida(cotizacion.vigenciaHasta)) {
    volver("error", "La cotización ya está vencida. Actualiza la vigencia antes de enviarla al cliente.");
  }

  await prisma.cotizacion.update({
    where: { id },
    data: { estado: EstadoCotizacion.ENVIADA },
  });
  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "Cotizacion",
    entidadId: id,
    usuarioId: usuario.id,
    descripcion: `${usuario.rol} dejó la cotización ${cotizacion.folio} lista para aceptación del cliente.`,
  });
  revalidatePath("/panel/cotizaciones");
  revalidatePath("/portal/cotizaciones");
  volver("ok", "Cotización lista para aceptación del cliente.");
}

export async function aceptarEnRepresentacionDelCliente(formData: FormData) {
  const usuario = await gestor();
  const id = texto(formData, "id");
  const motivo = texto(formData, "motivo");
  if (!motivo) volver("error", "La aceptación por excepción requiere registrar el motivo.");

  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id },
    select: { id: true, folio: true, estado: true, vigenciaHasta: true, total: true, inmuebleId: true, observacionesInternas: true },
  });
  if (!cotizacion) volver("error", "La cotización no existe.");
  if (cotizacion.estado !== EstadoCotizacion.ENVIADA) {
    volver("error", "La aceptación por representación solo procede cuando la cotización está pendiente de aceptación del cliente.");
  }
  if (estaVencida(cotizacion.vigenciaHasta)) {
    volver("error", "La cotización está vencida y debe actualizarse antes de aceptarse.");
  }
  if (!cotizacion.inmuebleId || Number(cotizacion.total) <= 0) {
    volver("error", "La cotización no está completa y no puede aceptarse por excepción.");
  }

  const ahora = new Date();
  const entradaExcepcion = `[${ahora.toISOString()}] ACEPTACIÓN POR EXCEPCIÓN EN REPRESENTACIÓN DEL CLIENTE. Registró: ${usuario.nombre} (${usuario.rol}). Motivo: ${motivo}`;
  const observacionesInternas = cotizacion.observacionesInternas?.trim()
    ? `${cotizacion.observacionesInternas.trim()}\n\n${entradaExcepcion}`
    : entradaExcepcion;

  await prisma.cotizacion.update({
    where: { id },
    data: {
      estado: EstadoCotizacion.ACEPTADA,
      aceptadaEn: ahora,
      solicitudAutorizacionEn: ahora,
      observacionesInternas,
    },
  });
  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "Cotizacion",
    entidadId: id,
    usuarioId: usuario.id,
    descripcion: `${usuario.rol} registró aceptación por excepción de la cotización ${cotizacion.folio} en representación del cliente. Motivo: ${motivo}`,
  });
  revalidatePath("/panel/cotizaciones");
  revalidatePath("/portal/cotizaciones");
  volver("ok", "Aceptación por excepción registrada. La cotización está pendiente de autorización interna.");
}

export async function autorizarCotizacionAceptada(formData: FormData) {
  const usuario = await gestor();
  const id = texto(formData, "id");
  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id },
    select: {
      id: true,
      folio: true,
      estado: true,
      aceptadaEn: true,
      vigenciaHasta: true,
      total: true,
      inmuebleId: true,
      clienteId: true,
      versiones: { orderBy: { version: "desc" }, take: 1, select: { id: true } },
    },
  });
  if (!cotizacion) volver("error", "La cotización no existe.");
  if (cotizacion.estado !== EstadoCotizacion.ACEPTADA || !cotizacion.aceptadaEn) {
    volver("error", "La cotización debe ser aceptada por el cliente antes de la autorización interna.");
  }
  if (estaVencida(cotizacion.vigenciaHasta)) {
    volver("error", "La cotización venció antes de su autorización. Actualiza su vigencia y repite el recorrido de aceptación.");
  }
  if (!cotizacion.clienteId || !cotizacion.inmuebleId || Number(cotizacion.total) <= 0 || !cotizacion.versiones[0]) {
    volver("error", "La cotización no está completa y no puede autorizarse.");
  }

  await prisma.cotizacion.update({
    where: { id },
    data: {
      estado: EstadoCotizacion.AUTORIZADA,
      autorizadaPorId: usuario.id,
      autorizadaEn: new Date(),
    },
  });
  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "Cotizacion",
    entidadId: id,
    usuarioId: usuario.id,
    descripcion: `${usuario.rol} autorizó la cotización aceptada ${cotizacion.folio}; queda incorporada a Caja.`,
  });
  revalidatePath("/panel/cotizaciones");
  revalidatePath("/panel/caja");
  revalidatePath("/panel/agenda");
  volver("ok", "Cotización autorizada. Ya forma parte de Caja.");
}
