"use server";

import {
  RolUsuario,
  TipoCalculoPrecio,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function verificarPermisoGestion() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const usuario = await prisma.usuario.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      rol: true,
      activo: true,
    },
  });

  if (!usuario || !usuario.activo) {
    redirect("/acceso");
  }

  if (
    usuario.rol !== RolUsuario.ADMINISTRADOR &&
    usuario.rol !== RolUsuario.DIRECTOR
  ) {
    redirect("/acceso");
  }

  return {
    session,
    usuario,
  };
}

function texto(
  formData: FormData,
  campo: string,
) {
  return String(
    formData.get(campo) ?? "",
  ).trim();
}

function numero(
  formData: FormData,
  campo: string,
  requerido = false,
) {
  const valor = texto(formData, campo);

  if (!valor) {
    if (requerido) {
      throw new Error(
        `El campo ${campo} es obligatorio.`,
      );
    }

    return null;
  }

  const convertido = Number(valor);

  if (
    !Number.isFinite(convertido) ||
    convertido < 0
  ) {
    throw new Error(
      `El campo ${campo} debe ser un número válido.`,
    );
  }

  return convertido;
}

function normalizarCodigo(valor: string) {
  return valor
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function crearPaquete(
  formData: FormData,
) {
  await verificarPermisoGestion();

  const nombre = texto(formData, "nombre");
  const codigo = normalizarCodigo(
    texto(formData, "codigo"),
  );

  const descripcion =
    texto(formData, "descripcion") || null;

  const tipoCalculo = texto(
    formData,
    "tipoCalculo",
  ) as TipoCalculoPrecio;

  if (!nombre) {
    throw new Error(
      "El nombre del paquete es obligatorio.",
    );
  }

  if (!codigo) {
    throw new Error(
      "El código del paquete es obligatorio.",
    );
  }

  if (
    !Object.values(TipoCalculoPrecio).includes(
      tipoCalculo,
    )
  ) {
    throw new Error(
      "El tipo de cálculo no es válido.",
    );
  }

  const precioBase =
    numero(formData, "precioBase", true) ?? 0;

  const superficieIncluidaM2 = numero(
    formData,
    "superficieIncluidaM2",
  );

  const precioM2Adicional = numero(
    formData,
    "precioM2Adicional",
  );

  const superficieMinimaM2 = numero(
    formData,
    "superficieMinimaM2",
  );

  const superficieMaximaM2 = numero(
    formData,
    "superficieMaximaM2",
  );

  if (
    superficieMinimaM2 !== null &&
    superficieMaximaM2 !== null &&
    superficieMaximaM2 < superficieMinimaM2
  ) {
    throw new Error(
      "La superficie máxima no puede ser menor que la mínima.",
    );
  }

  const ultimo =
    await prisma.paqueteServicio.findFirst({
      orderBy: {
        orden: "desc",
      },
      select: {
        orden: true,
      },
    });

  await prisma.paqueteServicio.create({
    data: {
      nombre,
      codigo,
      descripcion,
      tipoCalculo,
      precioBase,
      superficieIncluidaM2,
      precioM2Adicional,
      superficieMinimaM2,
      superficieMaximaM2,
      activo: true,
      orden: (ultimo?.orden ?? 0) + 1,
    },
  });

  revalidatePath("/panel/paquetes");
  revalidatePath("/panel/cotizaciones");
}

export async function actualizarPaquete(
  formData: FormData,
) {
  await verificarPermisoGestion();

  const id = texto(formData, "id");

  if (!id) {
    throw new Error(
      "No se recibió el identificador del paquete.",
    );
  }

  const nombre = texto(formData, "nombre");
  const codigo = normalizarCodigo(
    texto(formData, "codigo"),
  );

  const descripcion =
    texto(formData, "descripcion") || null;

  const tipoCalculo = texto(
    formData,
    "tipoCalculo",
  ) as TipoCalculoPrecio;

  if (!nombre || !codigo) {
    throw new Error(
      "Nombre y código son obligatorios.",
    );
  }

  if (
    !Object.values(TipoCalculoPrecio).includes(
      tipoCalculo,
    )
  ) {
    throw new Error(
      "El tipo de cálculo no es válido.",
    );
  }

  const superficieMinimaM2 = numero(
    formData,
    "superficieMinimaM2",
  );

  const superficieMaximaM2 = numero(
    formData,
    "superficieMaximaM2",
  );

  if (
    superficieMinimaM2 !== null &&
    superficieMaximaM2 !== null &&
    superficieMaximaM2 < superficieMinimaM2
  ) {
    throw new Error(
      "La superficie máxima no puede ser menor que la mínima.",
    );
  }

  await prisma.paqueteServicio.update({
    where: {
      id,
    },

    data: {
      nombre,
      codigo,
      descripcion,
      tipoCalculo,

      precioBase:
        numero(
          formData,
          "precioBase",
          true,
        ) ?? 0,

      superficieIncluidaM2: numero(
        formData,
        "superficieIncluidaM2",
      ),

      precioM2Adicional: numero(
        formData,
        "precioM2Adicional",
      ),

      superficieMinimaM2,

      superficieMaximaM2,
    },
  });

  revalidatePath("/panel/paquetes");
  revalidatePath("/panel/cotizaciones");
}

export async function cambiarEstadoPaquete(
  formData: FormData,
) {
  await verificarPermisoGestion();

  const id = texto(formData, "id");

  if (!id) {
    throw new Error(
      "No se recibió el identificador del paquete.",
    );
  }

  const paquete =
    await prisma.paqueteServicio.findUnique({
      where: {
        id,
      },
      select: {
        activo: true,
      },
    });

  if (!paquete) {
    throw new Error(
      "El paquete no existe.",
    );
  }

  await prisma.paqueteServicio.update({
    where: {
      id,
    },
    data: {
      activo: !paquete.activo,
    },
  });

  revalidatePath("/panel/paquetes");
  revalidatePath("/panel/cotizaciones");
}
