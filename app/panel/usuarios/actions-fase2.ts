"use server";

import bcrypt from "bcryptjs";
import { RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { obtenerAdministradorActual } from "@/lib/administrador-actual";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

function texto(formData: FormData, campo: string) { return String(formData.get(campo) ?? "").trim(); }
function error(mensaje: string): never { redirect(`/panel/usuarios?error=${encodeURIComponent(mensaje)}`); }
function exito(mensaje: string): never { redirect(`/panel/usuarios?ok=${encodeURIComponent(mensaje)}`); }

async function gestor() {
  const actual = await obtenerAdministradorActual();
  if (actual.rol !== RolUsuario.DIRECTOR && actual.rol !== RolUsuario.ADMINISTRADOR) error("Solo Dirección y Administración pueden gestionar usuarios.");
  return actual;
}

async function validarZona(zonaId: string) {
  const zona = await prisma.zona.findUnique({ where: { id: zonaId }, select: { id: true, activa: true } });
  if (!zona?.activa) error("La zona seleccionada no existe o está inactiva.");
}

async function validarGerente(gerenteId: string, zonaId: string) {
  const gerente = await prisma.usuario.findUnique({ where: { id: gerenteId }, select: { rol: true, activo: true, zonaId: true } });
  if (!gerente || gerente.rol !== RolUsuario.GERENTE || !gerente.activo || gerente.zonaId !== zonaId) error("El Gerente seleccionado no es válido para la zona elegida.");
}

async function validarCoordinador(coordinadorId: string, zonaId: string, gerenteId: string) {
  const coordinador = await prisma.usuario.findUnique({ where: { id: coordinadorId }, select: { rol: true, activo: true, zonaId: true, gerenteId: true } });
  if (!coordinador || coordinador.rol !== RolUsuario.COORDINADOR || !coordinador.activo || coordinador.zonaId !== zonaId || coordinador.gerenteId !== gerenteId) error("El Coordinador seleccionado no pertenece a la zona y Gerencia indicadas.");
}

async function resolverJerarquia(rol: RolUsuario, zonaId: string, gerenteId: string, coordinadorId: string, alcanceAdministrador: string) {
  let zonaFinalId: string | null = null;
  let gerenteFinalId: string | null = null;
  let coordinadorFinalId: string | null = null;

  if (rol === RolUsuario.ADMINISTRADOR && alcanceAdministrador === "ZONA") {
    if (!zonaId) error("Selecciona la zona del Administrador.");
    await validarZona(zonaId); zonaFinalId = zonaId;
  }
  const rolesConZona: RolUsuario[] = [
    RolUsuario.VENDEDOR,
    RolUsuario.GERENTE,
    RolUsuario.COORDINADOR,
    RolUsuario.INSPECTOR,
  ];
  if (rolesConZona.includes(rol)) {
    if (!zonaId) error("Selecciona una zona para este usuario.");
    await validarZona(zonaId); zonaFinalId = zonaId;
  }
  if (rol === RolUsuario.COORDINADOR || rol === RolUsuario.INSPECTOR) {
    if (!gerenteId) error("Selecciona el Gerente responsable.");
    await validarGerente(gerenteId, zonaId); gerenteFinalId = gerenteId;
  }
  if (rol === RolUsuario.INSPECTOR) {
    if (!coordinadorId) error("Selecciona el Coordinador responsable del Inspector.");
    await validarCoordinador(coordinadorId, zonaId, gerenteId); coordinadorFinalId = coordinadorId;
  }
  return { zonaFinalId, gerenteFinalId, coordinadorFinalId };
}

function validarRolGestionable(gestorRol: RolUsuario, rol: RolUsuario) {
  if (rol === RolUsuario.CLIENTE) error("Los clientes no se administran manualmente desde Usuarios; sus datos nacen de Pre-cotizaciones.");
  if (gestorRol === RolUsuario.ADMINISTRADOR && (rol === RolUsuario.DIRECTOR || rol === RolUsuario.ADMINISTRADOR)) error("Administración no puede crear ni editar cuentas de Director o Administrador.");
}

export async function crearUsuarioFase2(formData: FormData) {
  const actual = await gestor();
  const nombre = texto(formData, "nombre"); const email = texto(formData, "email").toLowerCase(); const password = texto(formData, "password"); const rol = texto(formData, "rol") as RolUsuario;
  const zonaId = texto(formData, "zonaId"); const gerenteId = texto(formData, "gerenteId"); const coordinadorId = texto(formData, "coordinadorId"); const alcanceAdministrador = texto(formData, "alcanceAdministrador") || "GLOBAL";
  const telefono = texto(formData, "telefono"); const especialidad = texto(formData, "especialidad"); const cedula = texto(formData, "cedula"); const ciudad = texto(formData, "ciudad");

  if (nombre.length < 3) error("El nombre debe tener al menos 3 caracteres.");
  if (!email.includes("@")) error("El correo electrónico no es válido.");
  if (password.length < 8) error("La contraseña debe tener al menos 8 caracteres.");
  if (!Object.values(RolUsuario).includes(rol)) error("El rol seleccionado no es válido.");
  validarRolGestionable(actual.rol, rol);

  const { zonaFinalId, gerenteFinalId, coordinadorFinalId } = await resolverJerarquia(rol, zonaId, gerenteId, coordinadorId, alcanceAdministrador);
  if (await prisma.usuario.findUnique({ where: { email }, select: { id: true } })) error("Ya existe una cuenta registrada con ese correo.");
  const passwordHash = await bcrypt.hash(password, 12);

  const creado = await prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({ data: { nombre, email, telefono: telefono || null, ciudad: ciudad || null, passwordHash, rol, activo: true, requiereCambioPassword: true, zonaId: zonaFinalId, gerenteId: gerenteFinalId, coordinadorId: coordinadorFinalId } });
    if (rol === RolUsuario.INSPECTOR) await tx.inspector.create({ data: { usuarioId: usuario.id, telefono: telefono || null, especialidad: especialidad || null, cedula: cedula || null, ciudad: ciudad || null, activo: true } });
    return usuario;
  });

  await registrarAuditoria({ tipo: TipoEvento.CREAR, entidad: "Usuario", entidadId: creado.id, usuarioId: actual.id, descripcion: `${actual.rol} creó el usuario ${email} con rol ${rol}${rol === RolUsuario.INSPECTOR ? " y su perfil de Inspector" : ""}.` });
  revalidatePath("/panel/usuarios"); revalidatePath("/panel/inspectores"); revalidatePath("/panel/inspecciones"); revalidatePath("/panel/agenda");
  exito("Usuario creado correctamente. Deberá cambiar su contraseña en el primer acceso.");
}

export async function actualizarUsuarioFase2(formData: FormData) {
  const actual = await gestor();
  const usuarioId = texto(formData, "usuarioId"); const nombre = texto(formData, "nombre"); const email = texto(formData, "email").toLowerCase(); const rol = texto(formData, "rol") as RolUsuario;
  const telefono = texto(formData, "telefono"); const ciudad = texto(formData, "ciudad"); const zonaId = texto(formData, "zonaId"); const gerenteId = texto(formData, "gerenteId"); const coordinadorId = texto(formData, "coordinadorId"); const alcanceAdministrador = texto(formData, "alcanceAdministrador") || "GLOBAL";
  const especialidad = texto(formData, "especialidad"); const cedula = texto(formData, "cedula");

  if (!usuarioId || nombre.length < 3 || !email.includes("@") || !Object.values(RolUsuario).includes(rol)) error("Los datos del usuario no son válidos.");
  if (usuarioId === actual.id) error("Tu propia cuenta no puede editarse desde este módulo.");

  const objetivo = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true, nombre: true, email: true, rol: true, inspector: { select: { id: true, _count: { select: { inspecciones: true } } } }, coordinadoresACargo: { select: { id: true }, take: 1 }, inspectoresACargo: { select: { id: true }, take: 1 } },
  });
  if (!objetivo) error("El usuario no existe.");
  validarRolGestionable(actual.rol, objetivo.rol); validarRolGestionable(actual.rol, rol);

  if (objetivo.rol === RolUsuario.GERENTE && rol !== RolUsuario.GERENTE && objetivo.coordinadoresACargo.length) error("Reasigna primero los Coordinadores de este Gerente.");
  if (objetivo.rol === RolUsuario.COORDINADOR && rol !== RolUsuario.COORDINADOR && objetivo.inspectoresACargo.length) error("Reasigna primero los Inspectores de este Coordinador.");
  if (objetivo.rol === RolUsuario.INSPECTOR && rol !== RolUsuario.INSPECTOR && (objetivo.inspector?._count.inspecciones ?? 0) > 0) error("No puedes cambiar el rol de un Inspector con inspecciones asociadas.");
  const duplicado = await prisma.usuario.findFirst({ where: { email, id: { not: usuarioId } }, select: { id: true } });
  if (duplicado) error("Ya existe otra cuenta con ese correo.");

  const { zonaFinalId, gerenteFinalId, coordinadorFinalId } = await resolverJerarquia(rol, zonaId, gerenteId, coordinadorId, alcanceAdministrador);

  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id: usuarioId }, data: { nombre, email, telefono: telefono || null, ciudad: ciudad || null, rol, zonaId: zonaFinalId, gerenteId: gerenteFinalId, coordinadorId: coordinadorFinalId } });
    if (rol === RolUsuario.INSPECTOR) {
      await tx.inspector.upsert({ where: { usuarioId }, create: { usuarioId, telefono: telefono || null, especialidad: especialidad || null, cedula: cedula || null, ciudad: ciudad || null, activo: true }, update: { telefono: telefono || null, especialidad: especialidad || null, cedula: cedula || null, ciudad: ciudad || null } });
    } else if (objetivo.inspector) {
      await tx.inspector.delete({ where: { usuarioId } });
    }
  });

  await registrarAuditoria({ tipo: TipoEvento.EDITAR, entidad: "Usuario", entidadId: usuarioId, usuarioId: actual.id, descripcion: `${actual.rol} actualizó ${objetivo.email}: nombre ${objetivo.nombre} → ${nombre}; correo ${objetivo.email} → ${email}; rol ${objetivo.rol} → ${rol}.` });
  revalidatePath("/panel/usuarios"); revalidatePath("/panel/inspectores"); revalidatePath("/panel/inspecciones"); revalidatePath("/panel/agenda");
  exito("Usuario actualizado correctamente.");
}
