"use server";

import { randomUUID } from "node:crypto";
import { EstadoCotizacion, EstadoPago, Prisma, RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

function texto(fd: FormData, campo: string) { return String(fd.get(campo) ?? "").trim(); }
function numero(fd: FormData, campo: string) { const n = Number(texto(fd, campo).replace(",", ".")); return Number.isFinite(n) ? n : NaN; }
function volver(destino: string, tipo: "ok" | "error", mensaje: string): never { redirect(`${destino}${destino.includes("?") ? "&" : "?"}${tipo}=${encodeURIComponent(mensaje)}`); }

async function usuarioActual() {
  const sesion = await auth();
  if (!sesion?.user?.id) redirect("/login");
  const usuario = await prisma.usuario.findUnique({
    where: { id: sesion.user.id },
    select: { id: true, nombre: true, rol: true, activo: true, inspector: { select: { id: true } } },
  });
  if (!usuario?.activo) redirect("/acceso");
  return usuario;
}

async function obtenerAjuste(id: string) {
  const filas = await prisma.$queryRaw<Array<{
    id: string; cotizacionId: string; inspeccionId: string | null; tipo: string; origen: string; concepto: string; motivo: string;
    monto: Prisma.Decimal; estado: string; requiereAceptacionCliente: boolean; aceptadoCliente: boolean; aplicadoEn: Date | null;
  }>>`SELECT "id","cotizacionId","inspeccionId","tipo","origen","concepto","motivo","monto","estado","requiereAceptacionCliente","aceptadoCliente","aplicadoEn" FROM "AjusteComercial" WHERE "id"=${id}`;
  return filas[0] ?? null;
}

export async function proponerAjusteComercial(formData: FormData) {
  const usuario = await usuarioActual();
  const cotizacionId = texto(formData, "cotizacionId");
  const inspeccionId = texto(formData, "inspeccionId") || null;
  const tipo = texto(formData, "tipo");
  const origen = texto(formData, "origen") || (inspeccionId ? "INSPECCION" : "PRE_COTIZACION");
  const concepto = texto(formData, "concepto");
  const motivo = texto(formData, "motivo");
  const monto = numero(formData, "monto");
  const destino = texto(formData, "destino") || (inspeccionId ? `/panel/inspecciones/${inspeccionId}` : "/panel/pre-cotizaciones");

  if (!cotizacionId || !["CARGO", "DESCUENTO"].includes(tipo) || !concepto || !motivo || !Number.isFinite(monto) || monto <= 0) {
    volver(destino, "error", "Completa tipo, concepto, motivo y un monto mayor a cero.");
  }

  if (![RolUsuario.DIRECTOR, RolUsuario.ADMINISTRADOR, RolUsuario.INSPECTOR].includes(usuario.rol)) redirect("/acceso");

  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id: cotizacionId },
    select: { id: true, folio: true, estado: true, versionActual: true, total: true, montoPagado: true, inspeccion: { select: { id: true, inspectorId: true } } },
  });
  if (!cotizacion) volver(destino, "error", "La cotización no existe.");

  if (usuario.rol === RolUsuario.INSPECTOR) {
    if (!inspeccionId || cotizacion.inspeccion?.id !== inspeccionId || !usuario.inspector?.id || cotizacion.inspeccion.inspectorId !== usuario.inspector.id) {
      volver(destino, "error", "El Inspector solo puede proponer ajustes de su propia inspección.");
    }
  }

  const requiereAceptacion = [EstadoCotizacion.ACEPTADA, EstadoCotizacion.AUTORIZADA].includes(cotizacion.estado) || Boolean(cotizacion.inspeccion);
  const ajusteId = randomUUID();

  await prisma.$executeRaw`
    INSERT INTO "AjusteComercial" ("id","cotizacionId","inspeccionId","tipo","origen","concepto","motivo","monto","estado","propuestoPorId","requiereAceptacionCliente","versionCotizacionOrigen")
    VALUES (${ajusteId}::uuid,${cotizacionId},${inspeccionId},${tipo},${origen},${concepto},${motivo},${new Prisma.Decimal(monto)},'PENDIENTE',${usuario.id},${requiereAceptacion},${cotizacion.versionActual})
  `;

  await registrarAuditoria({
    tipo: TipoEvento.CREAR,
    entidad: "AjusteComercial",
    entidadId: ajusteId,
    usuarioId: usuario.id,
    inspeccionId,
    cotizacionId,
    origen,
    motivo,
    descripcion: `${usuario.rol} propuso ${tipo === "CARGO" ? "cargo adicional" : "descuento"} por ${monto.toLocaleString("es-MX", { style: "currency", currency: "MXN" })} en ${cotizacion.folio}. Concepto: ${concepto}.`,
    valorAnterior: { total: Number(cotizacion.total), montoPagado: Number(cotizacion.montoPagado), version: cotizacion.versionActual },
    valorNuevo: { ajusteId, tipo, concepto, monto, estado: "PENDIENTE", requiereAceptacionCliente: requiereAceptacion },
  });

  revalidatePath(destino.split("?")[0]);
  revalidatePath("/panel/cotizaciones");
  revalidatePath("/panel/caja");
  volver(destino, "ok", "Ajuste registrado y documentado. Quedó pendiente de autorización.");
}

export async function resolverAjusteComercial(formData: FormData) {
  const usuario = await usuarioActual();
  const ajusteId = texto(formData, "ajusteId");
  const decision = texto(formData, "decision");
  const motivoResolucion = texto(formData, "motivoResolucion");
  const destino = texto(formData, "destino") || "/panel/cotizaciones";
  if (!ajusteId || !["AUTORIZAR", "RECHAZAR"].includes(decision)) volver(destino, "error", "Resolución de ajuste inválida.");
  if (!motivoResolucion) volver(destino, "error", "La resolución debe quedar documentada con un motivo.");

  const ajuste = await obtenerAjuste(ajusteId);
  if (!ajuste || ajuste.estado !== "PENDIENTE") volver(destino, "error", "El ajuste no existe o ya fue resuelto.");

  if (decision === "AUTORIZAR") {
    if (ajuste.tipo === "DESCUENTO" && usuario.rol !== RolUsuario.DIRECTOR) volver(destino, "error", "Los descuentos solo pueden ser autorizados por Dirección.");
    if (ajuste.tipo === "CARGO" && ![RolUsuario.DIRECTOR, RolUsuario.ADMINISTRADOR].includes(usuario.rol)) volver(destino, "error", "Los cargos solo pueden ser autorizados por Administración o Dirección.");
    await prisma.$executeRaw`UPDATE "AjusteComercial" SET "estado"='AUTORIZADO',"autorizadoPorId"=${usuario.id},"autorizadoEn"=NOW(),"motivoResolucion"=${motivoResolucion} WHERE "id"=${ajusteId}::uuid AND "estado"='PENDIENTE'`;
  } else {
    if (![RolUsuario.DIRECTOR, RolUsuario.ADMINISTRADOR].includes(usuario.rol)) redirect("/acceso");
    await prisma.$executeRaw`UPDATE "AjusteComercial" SET "estado"='RECHAZADO',"rechazadoPorId"=${usuario.id},"rechazadoEn"=NOW(),"motivoResolucion"=${motivoResolucion} WHERE "id"=${ajusteId}::uuid AND "estado"='PENDIENTE'`;
  }

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "AjusteComercial",
    entidadId: ajusteId,
    usuarioId: usuario.id,
    inspeccionId: ajuste.inspeccionId,
    cotizacionId: ajuste.cotizacionId,
    origen: "RESOLUCION_COMERCIAL",
    motivo: motivoResolucion,
    descripcion: `${usuario.rol} ${decision === "AUTORIZAR" ? "autorizó" : "rechazó"} el ajuste comercial ${ajusteId}.`,
    valorAnterior: { estado: "PENDIENTE" },
    valorNuevo: { estado: decision === "AUTORIZAR" ? "AUTORIZADO" : "RECHAZADO", motivoResolucion },
  });

  revalidatePath(destino.split("?")[0]);
  volver(destino, "ok", decision === "AUTORIZAR" ? "Ajuste autorizado y documentado." : "Ajuste rechazado y documentado.");
}

export async function registrarAceptacionAjuste(formData: FormData) {
  const usuario = await usuarioActual();
  if (![RolUsuario.DIRECTOR, RolUsuario.ADMINISTRADOR].includes(usuario.rol)) redirect("/acceso");
  const ajusteId = texto(formData, "ajusteId");
  const motivo = texto(formData, "motivo");
  const destino = texto(formData, "destino") || "/panel/cotizaciones";
  const ajuste = await obtenerAjuste(ajusteId);
  if (!ajuste || ajuste.estado !== "AUTORIZADO" || !ajuste.requiereAceptacionCliente || ajuste.aceptadoCliente) volver(destino, "error", "El ajuste no está pendiente de aceptación del cliente.");
  if (!motivo) volver(destino, "error", "Documenta cómo y por qué se registró la aceptación del cliente.");

  await prisma.$executeRaw`UPDATE "AjusteComercial" SET "aceptadoCliente"=true,"aceptadoClienteEn"=NOW() WHERE "id"=${ajusteId}::uuid`;
  await registrarAuditoria({
    tipo: TipoEvento.EDITAR, entidad: "AjusteComercial", entidadId: ajusteId, usuarioId: usuario.id,
    inspeccionId: ajuste.inspeccionId, cotizacionId: ajuste.cotizacionId, origen: "ACEPTACION_CLIENTE", motivo,
    descripcion: `${usuario.rol} documentó la aceptación del cliente para el ajuste ${ajusteId}. Motivo/medio: ${motivo}`,
    valorAnterior: { aceptadoCliente: false }, valorNuevo: { aceptadoCliente: true },
  });
  revalidatePath(destino.split("?")[0]);
  volver(destino, "ok", "Aceptación del cliente registrada y documentada.");
}

export async function aplicarAjusteComercial(formData: FormData) {
  const usuario = await usuarioActual();
  if (![RolUsuario.DIRECTOR, RolUsuario.ADMINISTRADOR].includes(usuario.rol)) redirect("/acceso");
  const ajusteId = texto(formData, "ajusteId");
  const destino = texto(formData, "destino") || "/panel/cotizaciones";
  const ajuste = await obtenerAjuste(ajusteId);
  if (!ajuste || ajuste.estado !== "AUTORIZADO" || ajuste.aplicadoEn) volver(destino, "error", "El ajuste no está disponible para aplicación.");
  if (ajuste.requiereAceptacionCliente && !ajuste.aceptadoCliente) volver(destino, "error", "El cliente debe aceptar el ajuste antes de aplicarlo.");

  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id: ajuste.cotizacionId },
    select: { id: true, folio: true, versionActual: true, total: true, subtotal: true, cargosExtra: true, descuento: true, montoPagado: true, estadoPago: true },
  });
  if (!cotizacion) volver(destino, "error", "La cotización relacionada ya no existe.");

  const monto = Number(ajuste.monto);
  const totalAnterior = Number(cotizacion.total);
  const subtotalAnterior = Number(cotizacion.subtotal);
  const cargosAnterior = Number(cotizacion.cargosExtra);
  const descuentoAnterior = Number(cotizacion.descuento);
  const totalNuevo = Math.max(0, totalAnterior + (ajuste.tipo === "CARGO" ? monto : -monto));
  const subtotalNuevo = Math.max(0, subtotalAnterior + (ajuste.tipo === "CARGO" ? monto : 0));
  const cargosNuevos = cargosAnterior + (ajuste.tipo === "CARGO" ? monto : 0);
  const descuentoNuevo = descuentoAnterior + (ajuste.tipo === "DESCUENTO" ? monto : 0);
  const versionNueva = cotizacion.versionActual + 1;
  const pagado = Number(cotizacion.montoPagado);
  const estadoPagoNuevo = pagado >= totalNuevo - 0.001 ? EstadoPago.PAGADO : pagado > 0 ? EstadoPago.PARCIAL : EstadoPago.PENDIENTE;

  const snapshot: Prisma.InputJsonObject = {
    origen: "AJUSTE_COMERCIAL",
    ajusteId,
    tipo: ajuste.tipo,
    concepto: ajuste.concepto,
    motivo: ajuste.motivo,
    monto,
    totalAnterior,
    totalNuevo,
    pagosHistoricosPreservados: pagado,
    aplicadoPor: usuario.nombre,
    aplicadoPorRol: usuario.rol,
  };

  await prisma.$transaction(async (tx) => {
    await tx.cotizacion.update({
      where: { id: cotizacion.id },
      data: {
        versionActual: versionNueva,
        cargosExtra: new Prisma.Decimal(cargosNuevos),
        descuento: new Prisma.Decimal(descuentoNuevo),
        subtotal: new Prisma.Decimal(subtotalNuevo),
        total: new Prisma.Decimal(totalNuevo),
        estadoPago: estadoPagoNuevo,
      },
    });
    await tx.cotizacionVersion.create({ data: { cotizacionId: cotizacion.id, version: versionNueva, datos: snapshot, total: new Prisma.Decimal(totalNuevo) } });
    await tx.$executeRaw`UPDATE "AjusteComercial" SET "aplicadoPorId"=${usuario.id},"aplicadoEn"=NOW(),"versionCotizacionAplicada"=${versionNueva} WHERE "id"=${ajusteId}::uuid AND "aplicadoEn" IS NULL`;
  });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR, entidad: "Cotizacion", entidadId: cotizacion.id, usuarioId: usuario.id,
    inspeccionId: ajuste.inspeccionId, cotizacionId: cotizacion.id, origen: "AJUSTE_COMERCIAL", motivo: ajuste.motivo,
    descripcion: `${usuario.rol} aplicó ${ajuste.tipo === "CARGO" ? "cargo" : "descuento"} de ${monto.toLocaleString("es-MX", { style: "currency", currency: "MXN" })} a ${cotizacion.folio}. Nueva versión V${versionNueva}.`,
    valorAnterior: { version: cotizacion.versionActual, total: totalAnterior, subtotal: subtotalAnterior, cargosExtra: cargosAnterior, descuento: descuentoAnterior, montoPagado: pagado, estadoPago: cotizacion.estadoPago },
    valorNuevo: { version: versionNueva, total: totalNuevo, subtotal: subtotalNuevo, cargosExtra: cargosNuevos, descuento: descuentoNuevo, montoPagado: pagado, estadoPago: estadoPagoNuevo, ajusteId },
  });

  revalidatePath("/panel/pre-cotizaciones"); revalidatePath("/panel/cotizaciones"); revalidatePath("/panel/caja");
  if (ajuste.inspeccionId) revalidatePath(`/panel/inspecciones/${ajuste.inspeccionId}`);
  volver(destino, "ok", `Ajuste aplicado. La cotización quedó en V${versionNueva}; los pagos históricos se conservaron.`);
}
