"use server";

import { EstadoCotizacion, TipoEvento } from "@prisma/client";
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
    select: { id: true, rol: true, activo: true },
  });
  if (!usuario?.activo || (usuario.rol !== "DIRECTOR" && usuario.rol !== "ADMINISTRADOR")) {
    redirect("/acceso");
  }
  return usuario;
}

function volver(tipo: "ok" | "error", mensaje: string): never {
  redirect(`/panel/cotizaciones?${tipo}=${encodeURIComponent(mensaje)}`);
}

export async function marcarListaParaCliente(formData: FormData) {
  const usuario = await gestor();
  const id = texto(formData, "id");
  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id },
    select: { id: true, folio: true, estado: true, cliente: { select: { usuarioId: true } } },
  });
  if (!cotizacion) volver("error", "La cotización no existe.");
  if (cotizacion.estado !== EstadoCotizacion.BORRADOR) {
    volver("error", "Solo una cotización formal en borrador puede quedar lista para aceptación del cliente.");
  }
  if (!cotizacion.cliente.usuarioId) {
    volver("error", "Asigna primero acceso al cliente para que pueda aceptar la cotización en el portal.");
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
    select: { id: true, folio: true, estado: true, vigenciaHasta: true },
  });
  if (!cotizacion) volver("error", "La cotización no existe.");
  if (cotizacion.estado !== EstadoCotizacion.ENVIADA) {
    volver("error", "La aceptación por representación solo procede cuando la cotización está pendiente de aceptación del cliente.");
  }
  if (cotizacion.vigenciaHasta && cotizacion.vigenciaHasta < new Date()) {
    volver("error", "La cotización está vencida y debe actualizarse antes de aceptarse.");
  }

  const ahora = new Date();
  await prisma.cotizacion.update({
    where: { id },
    data: {
      estado: EstadoCotizacion.ACEPTADA,
      aceptadaEn: ahora,
      solicitudAutorizacionEn: ahora,
      observacionesInternas: `ACEPTACIÓN POR EXCEPCIÓN EN REPRESENTACIÓN DEL CLIENTE. Motivo: ${motivo}`,
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
    select: { id: true, folio: true, estado: true, aceptadaEn: true },
  });
  if (!cotizacion) volver("error", "La cotización no existe.");
  if (cotizacion.estado !== EstadoCotizacion.ACEPTADA || !cotizacion.aceptadaEn) {
    volver("error", "La cotización debe ser aceptada por el cliente antes de la autorización interna.");
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