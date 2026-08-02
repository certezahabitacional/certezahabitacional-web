"use server";

import bcrypt from "bcryptjs";
import { RolUsuario } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const valor = (f: FormData, n: string) => String(f.get(n) ?? "").trim();

export async function crearInspector(formData: FormData) {
  const nombre = valor(formData, "nombre");
  const email = valor(formData, "email").toLowerCase();
  const password = valor(formData, "password");
  if (!nombre || !email || password.length < 8) redirect("/panel/inspectores?error=Completa%20nombre,%20correo%20y%20contraseña%20de%208%20caracteres");

  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (existe) redirect("/panel/inspectores?error=Ese%20correo%20ya%20está%20registrado");

  await prisma.usuario.create({
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
  });
  revalidatePath("/panel/inspectores");
  redirect("/panel/inspectores?ok=Inspector%20registrado");
}

export async function alternarInspector(formData: FormData) {
  const id = valor(formData, "id");
  const inspector = await prisma.inspector.findUnique({ where: { id }, include: { usuario: true } });
  if (!inspector) return;
  await prisma.$transaction([
    prisma.inspector.update({ where: { id }, data: { activo: !inspector.activo } }),
    prisma.usuario.update({ where: { id: inspector.usuarioId }, data: { activo: !inspector.usuario.activo } }),
  ]);
  revalidatePath("/panel/inspectores");
}
