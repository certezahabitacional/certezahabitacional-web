"use server";

import bcrypt from "bcryptjs";
import {
  RolUsuario,
  TipoEvento,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";

const valor = (f: FormData, n: string) =>
  String(f.get(n) ?? "").trim();

function redirigirError(mensaje: string): never {
  redirect(
    `/panel/inspectores?error=${encodeURIComponent(mensaje)}`,
  );
}

function redirigirOk(mensaje: string): never {
  redirect(
    `/panel/inspectores?ok=${encodeURIComponent(mensaje)}`,
  );
}

async function exigirAdministradorODirector() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const rol = session.user.role as RolUsuario;

  if (
    rol !== RolUsuario.DIRECTOR &&
    rol !== RolUsuario.ADMINISTRADOR
  ) {
    redirigirError(
      "Solo Dirección o Administración pueden crear accesos o modificar el estado de los inspectores.",
    );
  }

  return session;
}

export async function crearInspector(formData: FormData) {
  const session = await exigirAdministradorODirector();

  const nombre = valor(formData, "nombre");
  const email = valor(formData, "email").toLowerCase();
  const password = valor(formData, "password");

  if (!nombre || !email || password.length < 8) {
    redirigirError(
      "Completa nombre, correo y contraseña de al menos 8 caracteres.",
    );
  }

  const existe = await prisma.usuario.findUnique({
    where: { email },
  });

  if (existe) {
    redirigirError("Ese correo ya está registrado.");
  }

  const usuario = await prisma.usuario.create({
    data: {
      nombre,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      rol: RolUsuario.INSPECTOR,
      inspector: {
        create: {
          telefono: valor(formData, "telefono") || null,
          especialidad: valor(formData, "especialidad") || null,
          cedula: valor(formData, "cedula") || null,
          ciudad: valor(formData, "ciudad") || null,
        },
      },
    },
    select: {
      id: true,
      nombre: true,
      email: true,
      inspector: {
        select: {
          id: true,
        },
      },
    },
  });

  await registrarAuditoria({
    tipo: TipoEvento.CREAR,
    entidad: "Usuario",
    entidadId: usuario.id,
    descripcion:
      `${session.user.role} creó el acceso del inspector ` +
      `${usuario.nombre} (${usuario.email}).`,
  });

  revalidatePath("/panel/inspectores");
  revalidatePath("/panel/usuarios");
  revalidatePath("/panel");

  redirigirOk("Inspector registrado correctamente.");
}

export async function alternarInspector(formData: FormData) {
  const session = await exigirAdministradorODirector();
  const id = valor(formData, "id");

  if (!id) {
    redirigirError("Inspector no válido.");
  }

  const inspector = await prisma.inspector.findUnique({
    where: { id },
    include: {
      usuario: true,
    },
  });

  if (!inspector) {
    redirigirError("El inspector no existe.");
  }

  const nuevoEstado = !inspector.activo;

  await prisma.$transaction([
    prisma.inspector.update({
      where: { id },
      data: {
        activo: nuevoEstado,
      },
    }),
    prisma.usuario.update({
      where: { id: inspector.usuarioId },
      data: {
        activo: nuevoEstado,
      },
    }),
  ]);

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "Inspector",
    entidadId: inspector.id,
    descripcion:
      `${session.user.role} ${nuevoEstado ? "activó" : "desactivó"} ` +
      `al inspector ${inspector.usuario.nombre} (${inspector.usuario.email}).`,
  });

  revalidatePath("/panel/inspectores");
  revalidatePath("/panel/usuarios");
  revalidatePath("/panel");

  redirigirOk(
    `Inspector ${nuevoEstado ? "activado" : "desactivado"} correctamente.`,
  );
}