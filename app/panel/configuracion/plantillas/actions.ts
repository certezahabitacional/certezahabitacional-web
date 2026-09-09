"use server";

import { RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

const TIPOS = new Set(["ENTREGA", "GARANTIA", "USADA", "PREVENTIVA", "DICTAMEN"]);

function texto(formData: FormData, campo: string) {
  return String(formData.get(campo) ?? "").trim();
}

function marcado(formData: FormData, campo: string) {
  return formData.has(campo);
}

async function exigirGestor() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, rol: true, activo: true },
  });

  if (!usuario || !usuario.activo) redirect("/acceso");

  if (
    usuario.rol !== RolUsuario.DIRECTOR &&
    usuario.rol !== RolUsuario.ADMINISTRADOR
  ) {
    redirect("/acceso");
  }

  return usuario;
}

function volver(tipo: "ok" | "error", mensaje: string): never {
  redirect(
    `/panel/configuracion/plantillas?${tipo}=${encodeURIComponent(mensaje)}`
  );
}

export async function crearPlantilla(formData: FormData) {
  const usuario = await exigirGestor();

  const nombre = texto(formData, "nombre");
  const codigo = texto(formData, "codigo").toUpperCase();
  const tipoServicio = texto(formData, "tipoServicio").toUpperCase();
  const descripcion = texto(formData, "descripcion");

  const requiereGerenteZona = marcado(formData, "requiereGerenteZona");
  const requiereCoordinador = marcado(formData, "requiereCoordinador");

  if (!nombre || !codigo || !TIPOS.has(tipoServicio)) {
    volver("error", "Completa nombre, código y tipo de servicio válido.");
  }

  const existente = await prisma.plantillaInspeccion.findUnique({
    where: { codigo },
    select: { id: true },
  });

  if (existente) {
    volver("error", "Ya existe una plantilla con ese código.");
  }

  const plantilla = await prisma.plantillaInspeccion.create({
    data: {
      nombre,
      codigo,
      tipoServicio,
      descripcion: descripcion || null,
      requiereGerenteZona,
      requiereCoordinador,
      activa: true,
    },
  });

  await registrarAuditoria({
    tipo: TipoEvento.CREAR,
    entidad: "PlantillaInspeccion",
    entidadId: plantilla.id,
    usuarioId: usuario.id,
    descripcion:
      `${usuario.rol} creó la plantilla ${plantilla.nombre}. ` +
      `Gerente: ${requiereGerenteZona ? "Sí" : "No"}. ` +
      `Coordinador: ${requiereCoordinador ? "Sí" : "No"}.`,
  });

  revalidatePath("/panel/configuracion/plantillas");
  revalidatePath("/panel/inspecciones/nueva");

  volver("ok", "Plantilla creada correctamente.");
}

export async function actualizarPlantilla(formData: FormData) {
  const usuario = await exigirGestor();

  const id = texto(formData, "id");
  const nombre = texto(formData, "nombre");
  const descripcion = texto(formData, "descripcion");

  const activa = marcado(formData, "activa");
  const requiereGerenteZona = marcado(formData, "requiereGerenteZona");
  const requiereCoordinador = marcado(formData, "requiereCoordinador");

  if (!id || !nombre) {
    volver("error", "Plantilla inválida.");
  }

  const actual = await prisma.plantillaInspeccion.findUnique({
    where: { id },
    select: {
      id: true,
      codigo: true,
      nombre: true,
    },
  });

  if (!actual) {
    volver("error", "La plantilla no existe.");
  }

  const plantilla = await prisma.plantillaInspeccion.update({
    where: { id },
    data: {
      nombre,
      descripcion: descripcion || null,
      activa,
      requiereGerenteZona,
      requiereCoordinador,
    },
  });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "PlantillaInspeccion",
    entidadId: plantilla.id,
    usuarioId: usuario.id,
    descripcion:
      `${usuario.rol} actualizó la plantilla ${plantilla.nombre}. ` +
      `Gerente: ${plantilla.requiereGerenteZona ? "Sí" : "No"}. ` +
      `Coordinador: ${plantilla.requiereCoordinador ? "Sí" : "No"}. ` +
      `Activa: ${plantilla.activa ? "Sí" : "No"}.`,
  });

  revalidatePath("/panel/configuracion/plantillas");
  revalidatePath("/panel/inspecciones/nueva");

  volver("ok", "Plantilla actualizada correctamente.");
}
