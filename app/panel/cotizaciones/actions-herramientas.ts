"use server";

import { EstadoCotizacion } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  extraerConfiguracionHerramientas,
  normalizarHerramientas,
  serializarConfiguracionHerramientas,
} from "@/lib/herramientas-inspeccion";
import { prisma } from "@/lib/prisma";

function volver(mensaje: string, tipo: "ok" | "error"): never {
  redirect(
    `/panel/cotizaciones?${tipo}=${encodeURIComponent(mensaje)}`,
  );
}

export async function guardarHerramientasCotizacion(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { rol: true, activo: true },
  });

  if (
    !usuario?.activo ||
    (usuario.rol !== "DIRECTOR" && usuario.rol !== "ADMINISTRADOR")
  ) {
    redirect("/acceso");
  }

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    volver("Cotización inválida.", "error");
  }

  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id },
    select: {
      id: true,
      estado: true,
      observacionesInternas: true,
    },
  });

  if (!cotizacion) {
    volver("La cotización no existe.", "error");
  }

  if (cotizacion.estado !== EstadoCotizacion.BORRADOR) {
    volver(
      "Las herramientas solo pueden modificarse mientras la cotización está en borrador.",
      "error",
    );
  }

  const herramientas = normalizarHerramientas(
    formData
      .getAll("herramientas")
      .map((valor) => String(valor)),
  );

  const { textoLibre } = extraerConfiguracionHerramientas(
    cotizacion.observacionesInternas,
  );

  await prisma.cotizacion.update({
    where: { id },
    data: {
      observacionesInternas: serializarConfiguracionHerramientas(
        herramientas,
        textoLibre,
      ),
    },
  });

  revalidatePath("/panel/cotizaciones");
  revalidatePath("/portal/cotizaciones");

  volver("Herramientas y pruebas actualizadas.", "ok");
}
