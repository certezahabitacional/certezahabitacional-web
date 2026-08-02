"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const obtenerTexto = (formData: FormData, campo: string): string =>
  String(formData.get(campo) ?? "").trim();

const obtenerDecimal = (valor: string): number | null => {
  if (!valor) return null;

  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
};

export async function crearInmueble(formData: FormData) {
  const clienteId = obtenerTexto(formData, "clienteId");
  const alias = obtenerTexto(formData, "alias");
  const tipo = obtenerTexto(formData, "tipo");
  const direccion = obtenerTexto(formData, "direccion");
  const ciudad = obtenerTexto(formData, "ciudad");
  const estado = obtenerTexto(formData, "estado");

  if (!clienteId || !alias || !tipo || !direccion || !ciudad || !estado) {
    redirect(
      "/panel/inmuebles?error=Completa%20los%20campos%20obligatorios",
    );
  }

  const anioConstruccionTexto = obtenerTexto(
    formData,
    "anioConstruccion",
  );

  await prisma.inmueble.create({
    data: {
      clienteId,
      alias,
      tipo,
      direccion,
      ciudad,
      estado,
      colonia: obtenerTexto(formData, "colonia") || null,
      codigoPostal: obtenerTexto(formData, "codigoPostal") || null,
      latitud: obtenerDecimal(obtenerTexto(formData, "latitud")),
      longitud: obtenerDecimal(obtenerTexto(formData, "longitud")),
      superficieTerrenoM2: obtenerDecimal(
        obtenerTexto(formData, "superficieTerrenoM2"),
      ),
      superficieConstruccionM2: obtenerDecimal(
        obtenerTexto(formData, "superficieConstruccionM2"),
      ),
      anioConstruccion: anioConstruccionTexto
        ? Number(anioConstruccionTexto)
        : null,
      desarrollo: obtenerTexto(formData, "desarrollo") || null,
      numeroEscritura:
        obtenerTexto(formData, "numeroEscritura") || null,
      notas: obtenerTexto(formData, "notas") || null,
    },
  });

  revalidatePath("/panel/inmuebles");
  redirect("/panel/inmuebles?ok=Inmueble%20registrado");
}