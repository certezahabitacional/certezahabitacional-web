"use server";

import bcrypt from "bcryptjs";
import { RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { obtenerAdministradorActual } from "@/lib/administrador-actual";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

function texto(formData: FormData, campo: string) {
  return String(formData.get(campo) ?? "").trim();
}

function error(mensaje: string): never {
  redirect(`/panel/usuarios?error=${encodeURIComponent(mensaje)}`);
}

function exito(mensaje: string): never {
  redirect(`/panel/usuarios?ok=${encodeURIComponent(mensaje)}`);
}

async function gestor() {
  const actual = await obtenerAdministradorActual();
  if (actual.rol !== RolUsuario.DIRECTOR && actual.rol !== RolUsuario.ADMINISTRADOR) {
    error("Solo Dirección y Administración pueden gestionar usuarios.");
  }
  return actual;
}

async function validarZona(zonaId: string) {
  const zona = await prisma.zona.findUnique({ where: { id: zonaId }, select: { id: true, activa: true } });
  if (!zona?.activa) error("La zona seleccionada no existe o está inactiva.");
}

async function validarGerente(gerenteId: string, zonaId: string) {
  const gerente = await prisma.usuario.findUnique({ where: { id: gerenteId }, select: { rol: true, activo: true, zonaId: true } });
  if (!gerente || gerente.rol !== RolUsuario.GERENTE || !gerente.activo || gerente.zonaId !== zonaId) {
    error("El Gerente seleccionado no es válido para la zona elegida.");
  }
}

async function validarCoordinador(coordinadorId: string, zonaId: string, gerenteId: string) {
  const coordinador = await prisma.usuario.findUnique({ where: { id: coordinadorId }, select: { rol: true, activo: true, zonaId: true, gerenteId: true } });
  if (!coordinador || coordinador.rol !== RolUsuario.COORDINADOR || !coordinador.activo || coordinador.zonaId !== zonaId || coordinador.gerenteId !== gerenteId) {
    error("El Coordinador seleccionado no pertenece a la zona y Gerencia indicadas.");
  }
}

export async function crearUsuarioFase2(formData: FormData) {
  const actual = await gestor();
  const nombre = texto(formData, "nombre");
  const email = texto(formData, "email").toLowerCase();
  const password = texto(formData, "password");
  const rol = texto(formData, "rol") as RolUsuario;
  const zonaId = texto(formData, "zonaId");
  const gerenteId = texto(formData, "gerenteId");
  const coordinadorId = texto(formData, "coordinadorId");
  const alcanceAdministrador = texto(formData, "alcanceAdministrador") || "GLOBAL";
  const telefono = texto(formData, "telefono");
  const especialidad = texto(formData, "especialidad");
  const cedula = texto(formData, "cedula");
  const ciudad = texto(formData, "ciudad");

  if (nombre.length < 3) error("El nombre debe tener al menos 3 caracteres.");
  if (!email.includes("@")) error("El correo electrónico no es válido.");
  if (password.length < 8) error("La contraseña debe tener al menos 8 caracteres.");
  if (!Object.values(RolUsuario).includes(rol)) error("El rol seleccionado no es válido.");
  if (rol === RolUsuario.CLIENTE) error("Los clientes no se crean manualmente en Usuarios; se originan desde Pre-cotizaciones.");

  if (actual.rol === RolUsuario.ADMINISTRADOR && (rol === RolUsuario.DIRECTOR || rol === RolUsuario.ADMINISTRADOR)) {
    error("Administración no puede crear cuentas de Director ni Administrador.");
  }

  let zonaFinalId: string | null = null;
  let gerenteFinalId: string | null = null;
  let coordinadorFinalId: string | null = null;

  if (rol === RolUsuario.ADMINISTRADOR && alcanceAdministrador === "ZONA") {
    if (!zonaId) error("Selecciona la zona del Administrador.");
    await validarZona(zonaId);
    zonaFinalId = zonaId;
  }

  if ([RolUsuario.VENDEDOR, RolUsuario.GERENTE, RolUsuario.COORDINADOR, RolUsuario.INSPECTOR].includes(rol)) {
    if (!zonaId) error("Selecciona una zona para este usuario.");
    await validarZona(zonaId);
    zonaFinalId = zonaId;
  }

  if (rol === RolUsuario.COORDINADOR || rol === RolUsuario.INSPECTOR) {
    if (!gerenteId) error("Selecciona el Gerente responsable.");
    await validarGerente(gerenteId, zonaId);
    gerenteFinalId = gerenteId;
  }

  if (rol === RolUsuario.INSPECTOR) {
    if (!coordinadorId) error("Selecciona el Coordinador responsable del Inspector.");
    await validarCoordinador(coordinadorId, zonaId, gerenteId);
    coordinadorFinalId = coordinadorId;
  }

  const existente = await prisma.usuario.findUnique({ where: { email }, select: { id: true } });
  if (existente) error("Ya existe una cuenta registrada con ese correo.");

  const passwordHash = await bcrypt.hash(password, 12);

  const creado = await prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: {
        nombre,
        email,
        passwordHash,
        rol,
        activo: true,
        requiereCambioPassword: true,
        zonaId: zonaFinalId,
        gerenteId: gerenteFinalId,
        coordinadorId: coordinadorFinalId,
      },
    });

    if (rol === RolUsuario.INSPECTOR) {
      await tx.inspector.create({
        data: {
          usuarioId: usuario.id,
          telefono: telefono || null,
          especialidad: especialidad || null,
          cedula: cedula || null,
          ciudad: ciudad || null,
          activo: true,
        },
      });
    }

    return usuario;
  });

  await registrarAuditoria({
    tipo: TipoEvento.CREAR,
    entidad: "Usuario",
    entidadId: creado.id,
    usuarioId: actual.id,
    descripcion: `${actual.rol} creó el usuario ${email} con rol ${rol}${rol === RolUsuario.INSPECTOR ? " y su perfil de Inspector" : ""}.`,
  });

  revalidatePath("/panel/usuarios");
  revalidatePath("/panel/inspectores");
  revalidatePath("/panel/inspecciones");
  revalidatePath("/panel/agenda");
  exito("Usuario creado correctamente. Deberá cambiar su contraseña en el primer acceso.");
}
