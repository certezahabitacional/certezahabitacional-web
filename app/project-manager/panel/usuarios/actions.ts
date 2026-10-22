"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAdmin, PM_INTERNAL_ROLES } from "@/lib/project-manager/access";

const crearSchema = z.object({
  nombre: z.string().trim().min(3).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  rol: z.enum(PM_INTERNAL_ROLES),
});

const resetSchema = z.object({
  usuarioId: z.string().min(1),
  password: z.string().min(8).max(128),
});

export async function crearUsuarioProjectManager(formData: FormData) {
  await requireProjectManagerAdmin();
  const parsed = crearSchema.safeParse({
    nombre: formData.get("nombre"),
    email: String(formData.get("email") ?? "").toLowerCase(),
    password: formData.get("password"),
    rol: formData.get("rol"),
  });
  if (!parsed.success) return;
  const existe = await prisma.usuario.findUnique({ where: { email: parsed.data.email } });
  if (existe) return;

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.usuario.create({
    data: {
      nombre: parsed.data.nombre,
      email: parsed.data.email,
      passwordHash,
      rol: parsed.data.rol,
      activo: true,
      requiereCambioPassword: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    },
  });
  revalidatePath("/project-manager/panel/usuarios");
}

export async function restablecerPasswordProjectManager(formData: FormData) {
  await requireProjectManagerAdmin();
  const parsed = resetSchema.safeParse({
    usuarioId: formData.get("usuarioId"),
    password: formData.get("password"),
  });
  if (!parsed.success) return;

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.usuario.update({
    where: { id: parsed.data.usuarioId },
    data: {
      passwordHash,
      requiereCambioPassword: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
      ultimoFalloLogin: null,
    },
  });
  revalidatePath("/project-manager/panel/usuarios");
}

export async function alternarEstadoUsuarioProjectManager(formData: FormData) {
  const { session } = await requireProjectManagerAdmin();
  const usuarioId = String(formData.get("usuarioId") ?? "");
  if (!usuarioId || usuarioId === String((session.user as { id?: string }).id ?? "")) return;

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { activo: true, rol: true },
  });
  if (!usuario || !PM_INTERNAL_ROLES.includes(usuario.rol as (typeof PM_INTERNAL_ROLES)[number])) return;

  await prisma.usuario.update({
    where: { id: usuarioId },
    data: {
      activo: !usuario.activo,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    },
  });
  revalidatePath("/project-manager/panel/usuarios");
}
