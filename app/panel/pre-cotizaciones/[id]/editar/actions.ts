"use server";

import { EstadoCotizacion, Prisma, RolUsuario, TipoCliente, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

function texto(formData: FormData, campo: string) {
  return String(formData.get(campo) ?? "").trim();
}

function numero(formData: FormData, campo: string) {
  const valor = Number(texto(formData, campo).replace(",", "."));
  return Number.isFinite(valor) ? valor : NaN;
}

async function gestor() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, nombre: true, rol: true, activo: true },
  });
  if (!usuario?.activo || (usuario.rol !== RolUsuario.DIRECTOR && usuario.rol !== RolUsuario.ADMINISTRADOR)) {
    redirect("/acceso");
  }
  return usuario;
}

function volver(id: string, tipo: "ok" | "error", mensaje: string): never {
  redirect(`/panel/pre-cotizaciones/${id}/editar?${tipo}=${encodeURIComponent(mensaje)}`);
}

export async function guardarPreCotizacion(formData: FormData) {
  const usuario = await gestor();
  const id = texto(formData, "id");
  if (!id) redirect("/panel/pre-cotizaciones");

  const nombre = texto(formData, "nombre");
  const telefono = texto(formData, "telefono");
  const correo = texto(formData, "correo");
  const tipo = texto(formData, "tipo") as TipoCliente;
  const empresa = texto(formData, "empresa") || null;
  const direccionCliente = texto(formData, "direccionCliente") || null;
  const coloniaCliente = texto(formData, "coloniaCliente") || null;
  const ciudadCliente = texto(formData, "ciudadCliente") || null;
  const estadoCliente = texto(formData, "estadoCliente") || null;
  const codigoPostalCliente = texto(formData, "codigoPostalCliente") || null;

  const alias = texto(formData, "alias");
  const direccionInmueble = texto(formData, "direccionInmueble");
  const coloniaInmueble = texto(formData, "coloniaInmueble") || null;
  const ciudadInmueble = texto(formData, "ciudadInmueble");
  const estadoInmueble = texto(formData, "estadoInmueble");
  const codigoPostalInmueble = texto(formData, "codigoPostalInmueble") || null;
  const m2Terreno = numero(formData, "m2Terreno");
  const m2Construccion = numero(formData, "m2Construccion");
  const total = numero(formData, "total");
  const vigencia = texto(formData, "vigenciaHasta");
  const motivo = texto(formData, "motivo");

  if (!nombre || !correo || !alias || !direccionInmueble || !ciudadInmueble || !estadoInmueble) {
    volver(id, "error", "Completa los datos obligatorios de Cliente e Inmueble.");
  }
  if (!Object.values(TipoCliente).includes(tipo)) volver(id, "error", "Tipo de cliente inválido.");
  if (!Number.isFinite(m2Terreno) || m2Terreno < 0) volver(id, "error", "M2 de terreno inválidos.");
  if (!Number.isFinite(m2Construccion) || m2Construccion <= 0) volver(id, "error", "M2 de construcción inválidos.");
  if (!Number.isFinite(total) || total <= 0) volver(id, "error", "El importe debe ser mayor a cero.");
  if (!motivo) volver(id, "error", "Registra el motivo de la modificación.");

  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id },
    select: {
      id: true,
      folio: true,
      estado: true,
      clienteId: true,
      inmuebleId: true,
      versionActual: true,
      montoPagado: true,
    },
  });

  if (!cotizacion) volver(id, "error", "La pre-cotización no existe.");
  const estadosEditables: EstadoCotizacion[] = [
    EstadoCotizacion.BORRADOR,
    EstadoCotizacion.ENVIADA,
    EstadoCotizacion.ACEPTADA,
  ];
  if (!estadosEditables.includes(cotizacion.estado)) {
    volver(id, "error", "Solo se pueden editar registros que estén en Pre-cotizaciones.");
  }
  if (!cotizacion.inmuebleId) volver(id, "error", "La pre-cotización no tiene inmueble asociado.");

  const nuevaVersion = cotizacion.versionActual + 1;
  const vigenciaHasta = vigencia ? new Date(`${vigencia}T23:59:59`) : null;
  if (vigenciaHasta && Number.isNaN(vigenciaHasta.getTime())) volver(id, "error", "La vigencia capturada no es válida.");

  const snapshot: Prisma.InputJsonObject = {
    origen: "EDICION_PRE_COTIZACION",
    estadoCambios: "PENDIENTES_AUTORIZACION",
    motivo,
    editadoPor: usuario.nombre,
    editadoPorRol: usuario.rol,
    cliente: {
      nombre,
      telefono,
      correo,
      tipo,
      empresa: empresa ?? "",
      direccion: direccionCliente ?? "",
      colonia: coloniaCliente ?? "",
      ciudad: ciudadCliente ?? "",
      estado: estadoCliente ?? "",
      codigoPostal: codigoPostalCliente ?? "",
    },
    inmueble: {
      alias,
      direccion: direccionInmueble,
      colonia: coloniaInmueble ?? "",
      ciudad: ciudadInmueble,
      estado: estadoInmueble,
      codigoPostal: codigoPostalInmueble ?? "",
      m2Terreno,
      m2Construccion,
    },
    total,
  };

  await prisma.$transaction(async (tx) => {
    await tx.cotizacion.update({
      where: { id },
      data: {
        versionActual: nuevaVersion,
        superficieM2: new Prisma.Decimal(m2Construccion),
        subtotal: new Prisma.Decimal(total),
        total: new Prisma.Decimal(total),
        vigenciaHasta,
        estado: EstadoCotizacion.BORRADOR,
        aceptadaEn: null,
        solicitudAutorizacionEn: null,
        autorizadaPorId: null,
        autorizadaEn: null,
        editablePublica: true,
      },
    });

    await tx.cotizacionVersion.create({
      data: {
        cotizacionId: id,
        version: nuevaVersion,
        datos: snapshot,
        total: new Prisma.Decimal(total),
      },
    });
  });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "Cotizacion",
    entidadId: id,
    usuarioId: usuario.id,
    descripcion: `${usuario.rol} propuso cambios de Cliente/Inmueble en ${cotizacion.folio}, versión ${nuevaVersion}. Motivo: ${motivo}. Los datos maestros permanecen sin cambios hasta nueva aceptación y autorización. Pagos históricos preservados: ${Number(cotizacion.montoPagado).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}.`,
  });

  revalidatePath("/panel/pre-cotizaciones");
  revalidatePath("/panel/cotizaciones");
  revalidatePath("/panel/caja");
  revalidatePath("/portal/cotizaciones");
  volver(id, "ok", `Cambios guardados como propuesta versión ${nuevaVersion}. Cliente e Inmueble se actualizarán únicamente después de la nueva aceptación y autorización.`);
}
