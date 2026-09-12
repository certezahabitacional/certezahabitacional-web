"use server";

import bcrypt from "bcryptjs";
import { RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  clienteId: z.string().trim().min(1),
  email: z.string().trim().email("El correo electrónico no es válido."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

async function obtenerGestor() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const gestor = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, rol: true, activo: true },
  });

  if (
    !gestor ||
    !gestor.activo ||
    (gestor.rol !== RolUsuario.DIRECTOR && gestor.rol !== RolUsuario.ADMINISTRADOR)
  ) {
    redirect("/acceso");
  }

  return gestor;
}

function volver(tipo: "ok" | "error", mensaje: string): never {
  redirect(`/panel/clientes/accesos?${tipo}=${encodeURIComponent(mensaje)}`);
}

export async function asignarAccesoCliente(formData: FormData) {
  const gestor = await obtenerGestor();
  const resultado = schema.safeParse({
    clienteId: String(formData.get("clienteId") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });

  if (!resultado.success) {
    volver("error", resultado.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const { clienteId, email, password } = resultado.data;

  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: {
      id: true,
      nombre: true,
      usuarioId: true,
      usuario: { select: { id: true, email: true, rol: true } },
    },
  });

  if (!cliente) volver("error", "El cliente no existe.");

  const correoEnUso = await prisma.usuario.findUnique({
    where: { email },
    select: { id: true },
  });

  if (correoEnUso && correoEnUso.id !== cliente.usuarioId) {
    volver("error", "Ese correo ya pertenece a otro usuario del sistema.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  if (cliente.usuarioId) {
    await prisma.usuario.update({
      where: { id: cliente.usuarioId },
      data: {
        nombre: cliente.nombre,
        email,
        passwordHash,
        rol: RolUsuario.CLIENTE,
        activo: true,
        requiereCambioPassword: true,
        intentosFallidos: 0,
        bloqueadoHasta: null,
      },
    });
  } else {
    await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          nombre: cliente.nombre,
          email,
          passwordHash,
          rol: RolUsuario.CLIENTE,
          activo: true,
          requiereCambioPassword: true,
        },
      });

      await tx.cliente.update({
        where: { id: cliente.id },
        data: { usuarioId: usuario.id },
      });
    });
  }

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "Cliente",
    entidadId: cliente.id,
    usuarioId: gestor.id,
    descripcion: `${gestor.rol} asignó o restableció el acceso al sistema del cliente ${cliente.nombre}.`,
  });

  revalidatePath("/panel/clientes");
  revalidatePath("/panel/clientes/accesos");
  revalidatePath("/portal");

  volver("ok", "Acceso del cliente actualizado. Deberá cambiar su contraseña en el primer ingreso.");
}
