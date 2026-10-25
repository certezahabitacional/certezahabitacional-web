"use server";

import { RolUsuario } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { obtenerUsuarioConAlcanceZona } from "@/lib/alcance-zona";
import { prisma } from "@/lib/prisma";

function texto(formData: FormData, campo: string): string {
  return String(formData.get(campo) ?? "").trim();
}

function numeroOpcional(valor: string): number | null {
  if (!valor) return null;
  const numero = Number(valor.replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
}

export async function crearProyectoGeneradores(formData: FormData) {
  const usuarioActual = await obtenerUsuarioConAlcanceZona("/panel/certeza-tecnica/generadores/nuevo");
  const puedeCrear =
    usuarioActual.rol === RolUsuario.DIRECTOR ||
    usuarioActual.rol === RolUsuario.ADMINISTRADOR;

  if (!puedeCrear) redirect("/acceso");

  const nombre = texto(formData, "nombre");
  const clienteNombre = texto(formData, "clienteNombre");
  if (!nombre || !clienteNombre) {
    redirect("/panel/certeza-tecnica/generadores/nuevo?error=Nombre%20del%20proyecto%20y%20cliente%20son%20obligatorios");
  }

  const ahora = new Date();
  const anio = ahora.getFullYear();
  const consecutivoTemporal = String(ahora.getTime()).slice(-7);
  const codigo = `CT-GC-${anio}-${consecutivoTemporal}`;

  await prisma.proyectoGeneradores.create({
    data: {
      codigo,
      nombre,
      clienteNombre,
      ubicacion: texto(formData, "ubicacion") || null,
      tipoEdificacion: texto(formData, "tipoEdificacion") || null,
      superficieM2: numeroOpcional(texto(formData, "superficieM2")),
      niveles: numeroOpcional(texto(formData, "niveles")),
      alcance: texto(formData, "alcance") || null,
      observaciones: texto(formData, "observaciones") || null,
      creadoPorId: usuarioActual.id,
      responsableId: usuarioActual.id,
    },
  });

  revalidatePath("/panel/certeza-tecnica/generadores");
  redirect("/panel/certeza-tecnica/generadores");
}
