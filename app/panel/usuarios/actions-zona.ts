"use server";

import bcrypt from "bcryptjs";
import { RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { obtenerAdministradorActual } from "@/lib/administrador-actual";
import { registrarAuditoria } from "@/lib/auditoria";
import { puedeActivarDesactivarUsuario, puedeCambiarPasswordDeUsuario } from "@/lib/permisos";
import { prisma } from "@/lib/prisma";

function texto(formData: FormData, campo: string) { return String(formData.get(campo) ?? "").trim(); }
function error(mensaje: string): never { redirect(`/panel/usuarios?error=${encodeURIComponent(mensaje)}`); }
function exito(mensaje: string): never { redirect(`/panel/usuarios?ok=${encodeURIComponent(mensaje)}`); }

async function gestor() {
  const actual = await obtenerAdministradorActual();
  if (actual.rol !== RolUsuario.DIRECTOR && actual.rol !== RolUsuario.ADMINISTRADOR) error("Solo Dirección y Administración pueden gestionar usuarios.");
  return actual;
}

function validarZona(actual: Awaited<ReturnType<typeof gestor>>, objetivo: { zonaId: string | null; rol: RolUsuario }) {
  if (actual.rol === RolUsuario.DIRECTOR) return;
  if (!actual.zonaId || objetivo.rol === RolUsuario.DIRECTOR || !objetivo.zonaId || objetivo.zonaId !== actual.zonaId) {
    error("Administración solo puede operar cuentas de su propia zona.");
  }
}

export async function cambiarEstadoUsuarioZona(formData: FormData) {
  const actual = await gestor();
  const usuarioId = texto(formData, "usuarioId");
  const nuevoEstado = texto(formData, "activo") === "true";
  if (!usuarioId || usuarioId === actual.id) error("El usuario seleccionado no es válido para esta operación.");

  const objetivo = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { id: true, email: true, rol: true, zonaId: true } });
  if (!objetivo) error("El usuario no fue encontrado.");
  validarZona(actual, objetivo);
  if (!puedeActivarDesactivarUsuario(actual.rol, objetivo.rol)) error("No tienes facultad para activar o desactivar esa cuenta.");

  if (actual.rol === RolUsuario.DIRECTOR && objetivo.rol === RolUsuario.DIRECTOR && !nuevoEstado) {
    const directoresActivos = await prisma.usuario.count({ where: { rol: RolUsuario.DIRECTOR, activo: true } });
    if (directoresActivos <= 1) error("No puedes desactivar al único Director activo de la plataforma.");
  }

  await prisma.$transaction(async tx => {
    await tx.usuario.update({ where: { id: objetivo.id }, data: { activo: nuevoEstado } });
    if (objetivo.rol === RolUsuario.INSPECTOR) await tx.inspector.updateMany({ where: { usuarioId: objetivo.id }, data: { activo: nuevoEstado } });
  });
  await registrarAuditoria({ tipo: TipoEvento.EDITAR, entidad: "Usuario", entidadId: objetivo.id, usuarioId: actual.id, descripcion: nuevoEstado ? `${actual.rol} activó la cuenta ${objetivo.email}.` : `${actual.rol} desactivó la cuenta ${objetivo.email}.` });
  revalidatePath("/panel/usuarios"); revalidatePath("/panel/inspectores"); revalidatePath("/panel");
  exito(nuevoEstado ? "Usuario activado correctamente." : "Usuario desactivado correctamente.");
}

export async function cambiarPasswordUsuarioZona(formData: FormData) {
  const actual = await gestor();
  const usuarioId = texto(formData, "usuarioId");
  const password = texto(formData, "password");
  if (!usuarioId || password.length < 8) error("La nueva contraseña debe tener al menos 8 caracteres.");
  const objetivo = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { id: true, email: true, rol: true, zonaId: true } });
  if (!objetivo) error("El usuario no fue encontrado.");
  validarZona(actual, objetivo);
  if (!puedeCambiarPasswordDeUsuario(actual.rol, objetivo.rol)) error("No tienes facultad para restablecer la contraseña de esa cuenta.");

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.usuario.update({ where: { id: objetivo.id }, data: { passwordHash, requiereCambioPassword: true, intentosFallidos: 0, bloqueadoHasta: null, ultimoFalloLogin: null } });
  await registrarAuditoria({ tipo: TipoEvento.EDITAR, entidad: "Usuario", entidadId: objetivo.id, usuarioId: actual.id, descripcion: `${actual.rol} restableció la contraseña temporal de ${objetivo.email}. El usuario deberá cambiarla en su siguiente acceso.` });
  revalidatePath("/panel/usuarios");
  exito("Contraseña temporal actualizada. El usuario deberá cambiarla en su siguiente acceso.");
}
