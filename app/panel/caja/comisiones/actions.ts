"use server";

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
        versionActual: true,
        versiones: {
          orderBy: { version: "desc" },
          take: 1,
          select: { id: true, datos: true, version: true },
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
