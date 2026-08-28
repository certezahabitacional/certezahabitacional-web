"use server";

import {
  RolUsuario,
  TipoCliente,
  TipoEvento,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { puede } from "@/lib/permisos";
import { prisma } from "@/lib/prisma";

type AccionClientes =
  | "CLIENTE_CREAR"
  | "CLIENTE_EDITAR_ADMIN"
  | "REGISTRO_ELIMINAR_FISICO";

async function verificarPermisoAdministrativo(
  accion: AccionClientes,
) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const usuario =
    await prisma.usuario.findUnique({
      where: {
        id: session.user.id,
      },
      select: {
        id: true,
        rol: true,
        activo: true,
      },
    });

  if (
    !usuario ||
    !usuario.activo
  ) {
    redirect("/acceso");
  }

  if (
    usuario.rol !==
      RolUsuario.ADMINISTRADOR &&
    usuario.rol !==
      RolUsuario.DIRECTOR
  ) {
    redirect("/acceso");
  }

  if (
    !puede(
      usuario.rol,
      accion,
    )
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

function tipoClienteValido(
  valor: string,
) {
  return Object.values(
    TipoCliente,
  ).includes(
    valor as TipoCliente,
  )
    ? (valor as TipoCliente)
    : TipoCliente.PARTICULAR;
}

function regresarConError(
  mensaje: string,
): never {
  redirect(
    `/panel/clientes?error=${encodeURIComponent(
      mensaje,
    )}`,
  );
}

function regresarConExito(
  mensaje: string,
): never {
  redirect(
    `/panel/clientes?ok=${encodeURIComponent(
      mensaje,
    )}`,
  );
}

export async function crearCliente(
  formData: FormData,
) {
  const {
    usuario,
  } =
    await verificarPermisoAdministrativo(
      "CLIENTE_CREAR",
    );

  const nombre =
    texto(
      formData,
      "nombre",
    );

  const telefono =
    texto(
      formData,
      "telefono",
    );

  const correo =
    texto(
      formData,
      "correo",
    ).toLowerCase();

  const tipo =
    tipoClienteValido(
      texto(
        formData,
        "tipo",
      ),
    );

  if (
    !nombre ||
    !telefono
  ) {
    regresarConError(
      "Completa nombre y teléfono.",
    );
  }

  const duplicado =
    await prisma.cliente.findFirst({
      where: {
        OR: [
          {
            telefono,
          },
          ...(correo
            ? [
                {
                  correo,
                },
              ]
            : []),
        ],
      },
      select: {
        id: true,
      },
    });

  if (duplicado) {
    regresarConError(
      "Ya existe un cliente con ese teléfono o correo.",
    );
  }

  const cliente =
    await prisma.cliente.create({
      data: {
        nombre,
        telefono,
        correo:
          correo || null,
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
      select: {
        id: true,
        nombre: true,
      },
    });

  await registrarAuditoria({
    tipo: TipoEvento.CREAR,
    entidad: "Cliente",
    entidadId:
      cliente.id,
    usuarioId:
      usuario.id,
    descripcion:
      `${usuario.rol} creó el cliente ${cliente.nombre}.`,
  });

  revalidatePath("/panel");
  revalidatePath(
    "/panel/clientes",
  );

  regresarConExito(
    "Cliente registrado.",
  );
}

export async function actualizarCliente(
  formData: FormData,
) {
  const {
    usuario,
  } =
    await verificarPermisoAdministrativo(
      "CLIENTE_EDITAR_ADMIN",
    );

  const id =
    texto(
      formData,
      "id",
    );

  const nombre =
    texto(
      formData,
      "nombre",
    );

  const telefono =
    texto(
      formData,
      "telefono",
    );

  const correo =
    texto(
      formData,
      "correo",
    ).toLowerCase();

  const tipo =
    tipoClienteValido(
      texto(
        formData,
        "tipo",
      ),
    );

  if (!id) {
    regresarConError(
      "Cliente inválido.",
    );
  }

  if (
    !nombre ||
    !telefono
  ) {
    regresarConError(
      "Completa nombre y teléfono.",
    );
  }

  const existente =
    await prisma.cliente.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        nombre: true,
      },
    });

  if (!existente) {
    regresarConError(
      "El cliente no existe.",
    );
  }

  const duplicado =
    await prisma.cliente.findFirst({
      where: {
        id: {
          not: id,
        },
        OR: [
          {
            telefono,
          },
          ...(correo
            ? [
                {
                  correo,
                },
              ]
            : []),
        ],
      },
      select: {
        id: true,
      },
    });

  if (duplicado) {
    regresarConError(
      "Otro cliente ya usa ese teléfono o correo.",
    );
  }

  const cliente =
    await prisma.cliente.update({
      where: {
        id,
      },
      data: {
        nombre,
        telefono,
        correo:
          correo || null,
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
      select: {
        id: true,
        nombre: true,
      },
    });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "Cliente",
    entidadId:
      cliente.id,
    usuarioId:
      usuario.id,
    descripcion:
      `${usuario.rol} actualizó los datos administrativos del cliente ${cliente.nombre}.`,
  });

  revalidatePath("/panel");
  revalidatePath(
    "/panel/clientes",
  );
  revalidatePath("/portal");

  regresarConExito(
    "Datos del cliente actualizados.",
  );
}

export async function vincularUsuarioCliente(
  formData: FormData,
) {
  const {
    usuario: gestor,
  } =
    await verificarPermisoAdministrativo(
      "CLIENTE_EDITAR_ADMIN",
    );

  const clienteId =
    texto(
      formData,
      "clienteId",
    );

  const usuarioId =
    texto(
      formData,
      "usuarioId",
    );

  if (
    !clienteId ||
    !usuarioId
  ) {
    regresarConError(
      "Selecciona un usuario de cliente.",
    );
  }

  const [
    cliente,
    usuario,
  ] = await Promise.all([
    prisma.cliente.findUnique({
      where: {
        id: clienteId,
      },
      select: {
        id: true,
        nombre: true,
        usuarioId: true,
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
    regresarConError(
      "El cliente no existe.",
    );
  }

  if (
    !usuario ||
    usuario.rol !==
      RolUsuario.CLIENTE
  ) {
    regresarConError(
      "El usuario seleccionado no es un usuario CLIENTE.",
    );
  }

  if (!usuario.activo) {
    regresarConError(
      "El usuario seleccionado está inactivo.",
    );
  }

  if (
    cliente.usuarioId ===
    usuario.id
  ) {
    regresarConExito(
      "Ese usuario ya está vinculado al cliente.",
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
            id:
              usuario.cliente.id,
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

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "Cliente",
    entidadId:
      cliente.id,
    usuarioId:
      gestor.id,
    descripcion:
      `${gestor.rol} vinculó el usuario ${usuario.email} al cliente ${cliente.nombre}.`,
  });

  revalidatePath(
    "/panel/clientes",
  );
  revalidatePath("/portal");
  revalidatePath(
    "/portal/cotizaciones",
  );

  regresarConExito(
    "Acceso al portal vinculado correctamente.",
  );
}

export async function desvincularUsuarioCliente(
  formData: FormData,
) {
  const {
    usuario: gestor,
  } =
    await verificarPermisoAdministrativo(
      "CLIENTE_EDITAR_ADMIN",
    );

  const clienteId =
    texto(
      formData,
      "clienteId",
    );

  if (!clienteId) {
    regresarConError(
      "Cliente inválido.",
    );
  }

  const cliente =
    await prisma.cliente.findUnique({
      where: {
        id: clienteId,
      },
      select: {
        id: true,
        nombre: true,
        usuario: {
          select: {
            email: true,
          },
        },
      },
    });

  if (!cliente) {
    regresarConError(
      "El cliente no existe.",
    );
  }

  if (!cliente.usuario) {
    regresarConExito(
      "El cliente ya se encuentra sin usuario vinculado.",
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

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "Cliente",
    entidadId:
      cliente.id,
    usuarioId:
      gestor.id,
    descripcion:
      `${gestor.rol} desvinculó el usuario ${cliente.usuario.email} del cliente ${cliente.nombre}.`,
  });

  revalidatePath(
    "/panel/clientes",
  );
  revalidatePath("/portal");
  revalidatePath(
    "/portal/cotizaciones",
  );

  regresarConExito(
    "Acceso al portal desvinculado.",
  );
}

export async function eliminarCliente(
  formData: FormData,
) {
  const {
    usuario,
  } =
    await verificarPermisoAdministrativo(
      "REGISTRO_ELIMINAR_FISICO",
    );

  if (
    usuario.rol !==
    RolUsuario.DIRECTOR
  ) {
    redirect("/acceso");
  }

  const id =
    texto(
      formData,
      "id",
    );

  if (!id) {
    regresarConError(
      "Cliente inválido.",
    );
  }

  const cliente =
    await prisma.cliente.findUnique({
      where: {
        id,
      },
      select: {
        nombre: true,
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
    regresarConError(
      "El cliente no existe.",
    );
  }

  if (cliente.usuarioId) {
    regresarConError(
      "No puede eliminarse un cliente con usuario vinculado.",
    );
  }

  if (
    cliente._count.inspecciones >
      0 ||
    cliente._count.inmuebles >
      0 ||
    cliente._count.cotizaciones >
      0
  ) {
    regresarConError(
      "No puede eliminarse un cliente con historial o relaciones existentes.",
    );
  }

  await prisma.cliente.delete({
    where: {
      id,
    },
  });

  await registrarAuditoria({
    tipo: TipoEvento.ELIMINAR,
    entidad: "Cliente",
    entidadId: id,
    usuarioId:
      usuario.id,
    descripcion:
      `Dirección eliminó físicamente el registro vacío del cliente ${cliente.nombre}.`,
  });

  revalidatePath("/panel");
  revalidatePath(
    "/panel/clientes",
  );

  regresarConExito(
    "Registro vacío eliminado por Dirección.",
  );
}
