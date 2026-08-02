"use server";

import { TipoCliente } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

function texto(formData: FormData, campo: string) {
  return String(formData.get(campo) ?? "").trim();
}

export async function crearCliente(formData: FormData) {
  const nombre = texto(formData, "nombre");
  const telefono = texto(formData, "telefono");
  const correo = texto(formData, "correo").toLowerCase();
  const tipo = texto(formData, "tipo") as TipoCliente;

  if (!nombre || !telefono) {
    redirect("/panel/clientes?error=Completa%20nombre%20y%20teléfono");
  }

  const duplicado = await prisma.cliente.findFirst({
    where: {
      OR: [
        { telefono },
        ...(correo ? [{ correo }] : []),
      ],
    },
    select: { id: true },
  });

  if (duplicado) {
    redirect("/panel/clientes?error=Ya%20existe%20un%20cliente%20con%20ese%20teléfono%20o%20correo");
  }

  await prisma.cliente.create({
    data: {
      nombre,
      telefono,
      correo: correo || null,
      tipo: Object.values(TipoCliente).includes(tipo) ? tipo : TipoCliente.PARTICULAR,
      empresa: texto(formData, "empresa") || null,
      direccion: texto(formData, "direccion") || null,
      ciudad: texto(formData, "ciudad") || null,
      notas: texto(formData, "notas") || null,
    },
  });

  revalidatePath("/panel");
  revalidatePath("/panel/clientes");
  redirect("/panel/clientes?ok=Cliente%20registrado");
}

export async function eliminarCliente(formData: FormData) {
  const id = texto(formData, "id");
  if (!id) return;

  const inspecciones = await prisma.inspeccion.count({ where: { clienteId: id } });
  if (inspecciones > 0) {
    redirect("/panel/clientes?error=No%20se%20puede%20eliminar%20un%20cliente%20con%20inspecciones");
  }

  await prisma.cliente.delete({ where: { id } });
  revalidatePath("/panel");
  revalidatePath("/panel/clientes");
}
