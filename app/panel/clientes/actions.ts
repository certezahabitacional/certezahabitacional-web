"use server";

import {
  RolUsuario,
  TipoCliente,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function verificarPermiso() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (
    session.user.role !== "ADMINISTRADOR" &&
    session.user.role !== "COORDINADOR"
  ) {
    redirect("/acceso");
  }

  return session;
}

function texto(
  formData: FormData,
  campo: string,
) {
  return String(
    formData.get(campo) ?? "",
  ).trim();
}

function tipoClienteValido(valor: string) {
  return Object.values(TipoCliente).includes(
    valor as TipoCliente,
  )
    ? (valor as TipoCliente)
    : TipoCliente.PARTICULAR;
}

export async function crearCliente(
  formData: FormData,
) {
  await verificarPermiso();

  const nombre = texto(
    formData,
    "nombre",
  );

  const telefono = texto(
    formData,
    "telefono",
  );

  const correo = texto(
    formData,
    "correo",
  ).toLowerCase();

  const tipo = tipoClienteValido(
    texto(formData, "tipo"),
  );

  if (!nombre || !telefono) {
    redirect(
      "/panel/clientes?error=Completa%20nombre%20y%20tel%C3%A9fono",
    );
  }

  const duplicado =
    await prisma.cliente.findFirst({
      where: {
        OR: [
          { telefono },
          ...(correo
            ? [{ correo }]
            : []),
        ],
      },
      select: {
        id: true,
      },
    });

  if (duplicado) {
    redirect(
      "/panel/clientes?error=Ya%20existe%20un%20cliente%20con%20ese%20tel%C3%A9fono%20o%20correo",
    );
  }

  await prisma.cliente.create({
    data: {
      nombre,
      telefono,
      correo: correo || null,
      tipo,
      empresa:
        texto(
          formData,
          "empresa",
        ) || null,
      direccion:
        texto(
          formData,
          "direccion",
        ) || null,
      ciudad:
        texto(
          formData,
          "ciudad",
        ) || null,
      notas:
        texto(
          formData,
          "notas",
        ) || null,
    },
  });

  revalidatePath("/panel");
  revalidatePath("/panel/clientes");

  redirect(
    "/panel/clientes?ok=Cliente%20registrado",
  );
}

export async function actualizarCliente(
  formData: FormData,
) {
  await verificarPermiso();

  const id = texto(
    formData,
    "id",
  );

  const nombre = texto(
    formData,
    "nombre",
  );

  const telefono = texto(
    formData,
    "telefono",
  );

  const correo = texto(
    formData,
    "correo",
  ).toLowerCase();

  const tipo = tipoClienteValido(
    texto(formData, "tipo"),
  );

  if (!id) {
    redirect(
      "/panel/clientes?error=Cliente%20inv%C3%A1lido",
    );
  }

  if (!nombre || !telefono) {
    redirect(
      "/panel/clientes?error=Completa%20nombre%20y%20tel%C3%A9fono",
    );
  }

  const existente =
    await prisma.cliente.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
      },
    });

  if (!existente) {
    redirect(
      "/panel/clientes?error=El%20cliente%20no%20existe",
    );
  }

  const duplicado =
    await prisma.cliente.findFirst({
      where: {
        id: {
          not: id,
        },
        OR: [
          { telefono },
          ...(correo
            ? [{ correo }]
            : []),
        ],
      },
      select: {
        id: true,
      },
    });

  if (duplicado) {
    redirect(
      "/panel/clientes?error=Otro%20cliente%20ya%20usa%20ese%20tel%C3%A9fono%20o%20correo",
    );
  }

  await prisma.cliente.update({
    where: {
      id,
    },
    data: {
      nombre,
      telefono,
      correo: correo || null,
      tipo,
      empresa:
        texto(
          formData,
          "empresa",
        ) || null,
      ciudad:
        texto(
          formData,
          "ciudad",
        ) || null,
      direccion:
        texto(
          formData,
          "direccion",
        ) || null,
      notas:
        texto(
          formData,
          "notas",
        ) || null,
    },
  });

  revalidatePath("/panel");
  revalidatePath("/panel/clientes");
  revalidatePath("/portal");

  redirect(
    "/panel/clientes?ok=Datos%20del%20cliente%20actualizados",
  );
}

export async function vincularUsuarioCliente(
  formData: FormData,
) {
  await verificarPermiso();

  const clienteId = texto(
    formData,
    "clienteId",
  );

  const usuarioId = texto(
    formData,
    "usuarioId",
  );

  if (!clienteId || !usuarioId) {
    redirect(
      "/panel/clientes?error=Selecciona%20un%20usuario%20de%20cliente",
    );
  }

  const [cliente, usuario] =
    await Promise.all([
      prisma.cliente.findUnique({
        where: {
          id: clienteId,
        },
        select: {
          id: true,
          nombre: true,
        },
      }),

      prisma.usuario.findUnique({
        where: {
          id: usuarioId,
        },
        select: {
          id: true,
          nombre: true,
          email: true,
          rol: true,
          activo: true,
          cliente: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
      }),
    ]);

  if (!cliente) {
    redirect(
      "/panel/clientes?error=El%20cliente%20no%20existe",
    );
  }

  if (
    !usuario ||
    usuario.rol !== RolUsuario.CLIENTE
  ) {
    redirect(
      "/panel/clientes?error=El%20usuario%20seleccionado%20no%20es%20un%20usuario%20CLIENTE",
    );
  }

  if (!usuario.activo) {
    redirect(
      "/panel/clientes?error=El%20usuario%20seleccionado%20est%C3%A1%20inactivo",
    );
  }

  await prisma.$transaction(
    async (tx) => {
      if (
        usuario.cliente &&
        usuario.cliente.id !==
          clienteId
      ) {
        await tx.cliente.update({
          where: {
            id: usuario.cliente.id,
          },
          data: {
            usuarioId: null,
          },
        });
      }

      await tx.cliente.update({
        where: {
          id: clienteId,
        },
        data: {
          usuarioId,
        },
      });
    },
  );

  revalidatePath("/panel/clientes");
  revalidatePath("/portal");
  revalidatePath("/portal/cotizaciones");

  redirect(
    "/panel/clientes?ok=Acceso%20al%20portal%20vinculado%20correctamente",
  );
}

export async function desvincularUsuarioCliente(
  formData: FormData,
) {
  await verificarPermiso();

  const clienteId = texto(
    formData,
    "clienteId",
  );

  if (!clienteId) {
    redirect(
      "/panel/clientes?error=Cliente%20inv%C3%A1lido",
    );
  }

  await prisma.cliente.update({
    where: {
      id: clienteId,
    },
    data: {
      usuarioId: null,
    },
  });

  revalidatePath("/panel/clientes");
  revalidatePath("/portal");
  revalidatePath("/portal/cotizaciones");

  redirect(
    "/panel/clientes?ok=Acceso%20al%20portal%20desvinculado",
  );
}

export async function eliminarCliente(
  formData: FormData,
) {
  await verificarPermiso();

  const id = texto(
    formData,
    "id",
  );

  if (!id) {
    return;
  }

  const cliente =
    await prisma.cliente.findUnique({
      where: {
        id,
      },
      select: {
        usuarioId: true,
        _count: {
          select: {
            inspecciones: true,
            inmuebles: true,
            cotizaciones: true,
          },
        },
      },
    });

  if (!cliente) {
    redirect(
      "/panel/clientes?error=El%20cliente%20no%20existe",
    );
  }

  if (cliente.usuarioId) {
    redirect(
      "/panel/clientes?error=Desvincula%20primero%20el%20acceso%20al%20portal%20antes%20de%20eliminar",
    );
  }

  if (
    cliente._count.inspecciones > 0 ||
    cliente._count.inmuebles > 0 ||
    cliente._count.cotizaciones > 0
  ) {
    redirect(
      "/panel/clientes?error=No%20se%20puede%20eliminar%20un%20cliente%20con%20inmuebles%2C%20cotizaciones%20o%20inspecciones",
    );
  }

  await prisma.cliente.delete({
    where: {
      id,
    },
  });

  revalidatePath("/panel");
  revalidatePath("/panel/clientes");

  redirect(
    "/panel/clientes?ok=Cliente%20eliminado",
  );
}