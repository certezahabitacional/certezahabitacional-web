"use server";

import { RolUsuario, TipoCliente, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

function texto(formData: FormData, campo: string) {
  return String(formData.get(campo) ?? "").trim();
}

function volver(tipo: "ok" | "error", mensaje: string): never {
  redirect(`/panel/clientes?${tipo}=${encodeURIComponent(mensaje)}`);
}

async function obtenerDirector() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, rol: true, activo: true },
  });

  if (!usuario?.activo || usuario.rol !== RolUsuario.DIRECTOR) redirect("/acceso");
  return usuario;
}

export async function actualizarClienteDirector(formData: FormData) {
  const usuario = await obtenerDirector();
  const id = texto(formData, "id");
  const nombre = texto(formData, "nombre");
  const telefono = texto(formData, "telefono");
  const correo = texto(formData, "correo").toLowerCase();
  const tipoTexto = texto(formData, "tipo");
  const tipo = Object.values(TipoCliente).includes(tipoTexto as TipoCliente)
    ? (tipoTexto as TipoCliente)
    : TipoCliente.PARTICULAR;

  if (!id) volver("error", "Cliente inválido.");
  if (!nombre || !telefono) volver("error", "Completa nombre y teléfono.");

  const existente = await prisma.cliente.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existente) volver("error", "El cliente no existe.");

  const duplicado = await prisma.cliente.findFirst({
    where: {
      id: { not: id },
      OR: [
        { telefono },
        ...(correo ? [{ correo }] : []),
      ],
    },
    select: { id: true },
  });
  if (duplicado) volver("error", "Otro cliente ya usa ese teléfono o correo.");

  const cliente = await prisma.cliente.update({
    where: { id },
    data: {
      nombre,
      telefono,
      correo: correo || null,
      tipo,
      empresa: texto(formData, "empresa") || null,
      rfc: texto(formData, "rfc").toUpperCase() || null,
      curp: texto(formData, "curp").toUpperCase() || null,
      direccion: texto(formData, "direccion") || null,
      colonia: texto(formData, "colonia") || null,
      ciudad: texto(formData, "ciudad") || null,
      estado: texto(formData, "estado") || null,
      codigoPostal: texto(formData, "codigoPostal") || null,
      notas: texto(formData, "notas") || null,
    },
    select: { id: true, nombre: true },
  });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "Cliente",
    entidadId: cliente.id,
    usuarioId: usuario.id,
    descripcion: `Dirección actualizó los datos del cliente ${cliente.nombre}.`,
  });

  revalidatePath("/panel/clientes");
  revalidatePath("/portal");
  volver("ok", "Datos del cliente actualizados.");
}
