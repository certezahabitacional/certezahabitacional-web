"use server";

import { randomUUID } from "node:crypto";
import { Prisma, RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

function texto(formData: FormData, campo: string) {
  return String(formData.get(campo) ?? "").trim();
}

function volver(tipo: "ok" | "error", mensaje: string): never {
  redirect(`/panel/caja/comisiones?${tipo}=${encodeURIComponent(mensaje)}`);
}

async function obtenerGestor() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, rol: true, activo: true },
  });

  if (
    !usuario?.activo ||
    (usuario.rol !== RolUsuario.DIRECTOR && usuario.rol !== RolUsuario.ADMINISTRADOR)
  ) {
    redirect("/acceso");
  }

  return usuario;
}

function vendedorDesdeJson(datos: Prisma.JsonValue | null) {
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) return null;
  const vendedor = (datos as Prisma.JsonObject).vendedor;
  if (!vendedor || typeof vendedor !== "object" || Array.isArray(vendedor)) return null;
  const objeto = vendedor as Prisma.JsonObject;
  return typeof objeto.id === "string" ? objeto.id : null;
}

export async function asignarVendedorCotizacion(formData: FormData) {
  const actor = await obtenerGestor();
  const cotizacionId = texto(formData, "cotizacionId");
  const vendedorId = texto(formData, "vendedorId");

  if (!cotizacionId || !vendedorId) volver("error", "Selecciona cotización y vendedor.");

  const [cotizacion, vendedor] = await Promise.all([
    prisma.cotizacion.findUnique({
      where: { id: cotizacionId },
      select: {
        id: true,
        folio: true,
        versiones: {
          orderBy: { version: "desc" },
          take: 1,
          select: { id: true, datos: true },
        },
      },
    }),
    prisma.usuario.findFirst({
      where: { id: vendedorId, rol: RolUsuario.VENDEDOR, activo: true },
      select: { id: true, nombre: true, email: true },
    }),
  ]);

  if (!cotizacion) volver("error", "La cotización no existe.");
  if (!vendedor) volver("error", "El vendedor seleccionado no es válido o está inactivo.");

  const version = cotizacion.versiones[0];
  if (!version) volver("error", "La cotización no tiene versión documental registrada.");

  const datosActuales =
    version.datos && typeof version.datos === "object" && !Array.isArray(version.datos)
      ? (version.datos as Prisma.JsonObject)
      : {};

  const datos: Prisma.InputJsonObject = {
    ...datosActuales,
    vendedor: {
      id: vendedor.id,
      nombre: vendedor.nombre,
      email: vendedor.email,
      porcentajeComision: 10,
    },
  };

  await prisma.cotizacionVersion.update({
    where: { id: version.id },
    data: { datos },
  });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "Cotizacion",
    entidadId: cotizacion.id,
    usuarioId: actor.id,
    descripcion: `${actor.rol} asignó a ${vendedor.nombre} como vendedor de la cotización ${cotizacion.folio}, con comisión contractual del 10%.`,
  });

  revalidatePath("/panel/caja");
  revalidatePath("/panel/caja/comisiones");
  revalidatePath("/panel/cotizaciones");
  volver("ok", `Vendedor asignado a ${cotizacion.folio}.`);
}

export async function registrarPagoComision(formData: FormData) {
  const actor = await obtenerGestor();
  const cotizacionId = texto(formData, "cotizacionId");
  const beneficiarioId = texto(formData, "beneficiarioId");
  const tipo = texto(formData, "tipo");
  const monto = Number(texto(formData, "monto"));
  const metodoPago = texto(formData, "metodoPago") || null;
  const referencia = texto(formData, "referencia") || null;
  const notas = texto(formData, "notas") || null;

  if (!cotizacionId || !beneficiarioId || (tipo !== "VENDEDOR" && tipo !== "INSPECTOR")) {
    volver("error", "Movimiento de comisión inválido.");
  }
  if (!Number.isFinite(monto) || monto <= 0) volver("error", "Captura un importe de pago válido.");

  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id: cotizacionId },
    select: {
      id: true,
      folio: true,
      total: true,
      versiones: {
        orderBy: { version: "desc" },
        take: 1,
        select: { datos: true },
      },
      inspeccion: {
        select: {
          inspector: { select: { usuarioId: true, usuario: { select: { nombre: true } } } },
        },
      },
    },
  });

  if (!cotizacion) volver("error", "La cotización no existe.");

  let beneficiarioValido = false;
  let nombreBeneficiario = "beneficiario";
  let porcentaje = 0;

  if (tipo === "VENDEDOR") {
    const vendedorId = vendedorDesdeJson(cotizacion.versiones[0]?.datos ?? null);
    beneficiarioValido = vendedorId === beneficiarioId;
    porcentaje = 0.1;
    const vendedor = beneficiarioValido
      ? await prisma.usuario.findUnique({ where: { id: beneficiarioId }, select: { nombre: true } })
      : null;
    nombreBeneficiario = vendedor?.nombre ?? "vendedor";
  } else {
    beneficiarioValido = cotizacion.inspeccion?.inspector?.usuarioId === beneficiarioId;
    porcentaje = 0.3;
    nombreBeneficiario = cotizacion.inspeccion?.inspector?.usuario.nombre ?? "inspector";
  }

  if (!beneficiarioValido) volver("error", "El beneficiario no corresponde a la cotización seleccionada.");

  const comisionGenerada = Number(cotizacion.total) * porcentaje;
  const pagos = await prisma.$queryRaw<Array<{ pagado: Prisma.Decimal | null }>>`
    SELECT COALESCE(SUM("monto"), 0) AS "pagado"
    FROM "PagoComision"
    WHERE "cotizacionId" = ${cotizacionId}
      AND "beneficiarioId" = ${beneficiarioId}
      AND "tipo" = ${tipo}
  `;
  const pagadoActual = Number(pagos[0]?.pagado ?? 0);
  const saldo = Math.max(0, comisionGenerada - pagadoActual);

  if (monto > saldo + 0.001) {
    volver("error", `El pago excede el saldo de comisión pendiente (${saldo.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}).`);
  }

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "PagoComision"
      ("id", "cotizacionId", "beneficiarioId", "tipo", "monto", "fechaPago", "metodoPago", "referencia", "notas", "registradoPorId")
    VALUES
      (${id}, ${cotizacionId}, ${beneficiarioId}, ${tipo}, ${monto}, NOW(), ${metodoPago}, ${referencia}, ${notas}, ${actor.id})
  `;

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "PagoComision",
    entidadId: id,
    usuarioId: actor.id,
    descripcion: `${actor.rol} registró pago de comisión ${tipo.toLowerCase()} por ${monto.toLocaleString("es-MX", { style: "currency", currency: "MXN" })} a ${nombreBeneficiario} en ${cotizacion.folio}.`,
  });

  revalidatePath("/panel/caja/comisiones");
  volver("ok", "Pago de comisión registrado correctamente.");
}
