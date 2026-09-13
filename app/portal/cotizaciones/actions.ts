"use server";

import { EstadoCotizacion, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { obtenerClienteActual } from "@/lib/cliente-actual";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

function texto(formData: FormData, campo: string) { return String(formData.get(campo) ?? "").trim(); }
function versionFormulario(formData: FormData) { const v = Number(texto(formData, "version")); return Number.isInteger(v) && v > 0 ? v : null; }

async function cotizacionClienteVigente(clienteId: string, id: string) {
  return prisma.cotizacion.findFirst({
    where: { id, clienteId },
    select: {
      id: true,
      folio: true,
      estado: true,
      vigenciaHasta: true,
      versionActual: true,
      versiones: { orderBy: { version: "desc" }, take: 1, select: { version: true, creadaEn: true } },
    },
  });
}

function validarVersionVista(cotizacion: Awaited<ReturnType<typeof cotizacionClienteVigente>>, versionVista: number | null) {
  if (!cotizacion) throw new Error("La cotización no existe o no pertenece a tu cuenta.");
  const ultima = cotizacion.versiones[0];
  if (!ultima || ultima.version !== cotizacion.versionActual) {
    throw new Error("La cotización fue actualizada y requiere recargarse antes de responder.");
  }
  if (!versionVista || versionVista !== cotizacion.versionActual) {
    throw new Error(`Estás viendo una versión anterior. Recarga la cotización para revisar y responder la V${cotizacion.versionActual}.`);
  }
  return ultima;
}

export async function aceptarCotizacionCliente(formData: FormData) {
  const cliente = await obtenerClienteActual();
  const id = texto(formData, "id");
  const versionVista = versionFormulario(formData);
  const aceptaTerminos = texto(formData, "aceptaTerminos");
  if (!id) throw new Error("Cotización inválida.");
  if (!aceptaTerminos) throw new Error("Debes confirmar que revisaste la cotización antes de aceptarla.");

  const cotizacion = await cotizacionClienteVigente(cliente.id, id);
  validarVersionVista(cotizacion, versionVista);
  if (!cotizacion) throw new Error("La cotización no existe o no pertenece a tu cuenta.");
  if (cotizacion.estado !== EstadoCotizacion.ENVIADA) throw new Error("Esta cotización ya no está disponible para aceptación.");
  if (cotizacion.vigenciaHasta && cotizacion.vigenciaHasta < new Date()) throw new Error("La vigencia de esta cotización terminó. Contacta a Certeza Habitacional para actualizarla.");

  const ahora = new Date();
  await prisma.cotizacion.update({ where: { id }, data: { estado: EstadoCotizacion.ACEPTADA, aceptadaEn: ahora, solicitudAutorizacionEn: ahora } });

  if (cliente.usuarioId) {
    await registrarAuditoria({
      tipo: TipoEvento.EDITAR,
      entidad: "Cotizacion",
      entidadId: id,
      usuarioId: cliente.usuarioId,
      descripcion: `El cliente aceptó ${cotizacion.folio} V${cotizacion.versionActual} desde el portal.`,
    });
  }

  revalidatePath("/portal");
  revalidatePath("/portal/cotizaciones");
  revalidatePath(`/portal/cotizaciones/${id}`);
  revalidatePath("/panel/pre-cotizaciones");
  revalidatePath("/panel/cotizaciones");
}

export async function rechazarCotizacionCliente(formData: FormData) {
  const cliente = await obtenerClienteActual();
  const id = texto(formData, "id");
  const versionVista = versionFormulario(formData);
  const motivo = texto(formData, "motivo") || null;
  if (!id) throw new Error("Cotización inválida.");

  const cotizacion = await cotizacionClienteVigente(cliente.id, id);
  validarVersionVista(cotizacion, versionVista);
  if (!cotizacion) throw new Error("La cotización no existe o no pertenece a tu cuenta.");
  if (cotizacion.estado !== EstadoCotizacion.ENVIADA) throw new Error("Esta cotización ya no está disponible para rechazo.");

  await prisma.cotizacion.update({ where: { id }, data: { estado: EstadoCotizacion.RECHAZADA, motivoRechazo: motivo } });

  if (cliente.usuarioId) {
    await registrarAuditoria({
      tipo: TipoEvento.EDITAR,
      entidad: "Cotizacion",
      entidadId: id,
      usuarioId: cliente.usuarioId,
      descripcion: `El cliente rechazó ${cotizacion.folio} V${cotizacion.versionActual} desde el portal.${motivo ? ` Motivo: ${motivo}` : ""}`,
    });
  }

  revalidatePath("/portal");
  revalidatePath("/portal/cotizaciones");
  revalidatePath(`/portal/cotizaciones/${id}`);
  revalidatePath("/panel/pre-cotizaciones");
  revalidatePath("/panel/cotizaciones");
}
