"use server";

import bcrypt from "bcryptjs";
import {
  RolUsuario,
  TipoEvento,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { obtenerAdministradorActual } from "@/lib/administrador-actual";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  puedeActivarDesactivarUsuario,
  puedeCambiarPasswordDeUsuario,
  puedeCrearUsuario,
} from "@/lib/permisos";
import { prisma } from "@/lib/prisma";

const crearUsuarioSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(
      3,
      "El nombre debe tener al menos 3 caracteres.",
    ),

  email: z
    .string()
    .trim()
    .email(
      "El correo electrónico no es válido.",
    ),

  password: z
    .string()
    .min(
      8,
      "La contraseña debe tener al menos 8 caracteres.",
    ),

  rol: z.nativeEnum(RolUsuario),
});

const cambiarPasswordSchema = z.object({
  usuarioId:
    z.string().trim().min(1),

  password: z
    .string()
    .min(
      8,
      "La nueva contraseña debe tener al menos 8 caracteres.",
    ),
});

function texto(
  formData: FormData,
  campo: string,
) {
  return String(
    formData.get(campo) ?? "",
  ).trim();
}

function regresarConError(
  mensaje: string,
): never {
  redirect(
    `/panel/usuarios?error=${encodeURIComponent(
      mensaje,
    )}`,
  );
}

function regresarConExito(
  mensaje: string,
): never {
  redirect(
    `/panel/usuarios?ok=${encodeURIComponent(
      mensaje,
    )}`,
  );
}

async function obtenerGestorActual() {
  const gestor =
    await obtenerAdministradorActual();

  if (
    gestor.rol !==
      RolUsuario.DIRECTOR &&
    gestor.rol !==
      RolUsuario.ADMINISTRADOR
  ) {
    regresarConError(
      "Solo Dirección y Administración pueden gestionar usuarios.",
    );
  }

  return gestor;
}

/**
 * Reglas:
 *
 * DIRECTOR:
 * - puede crear y gestionar todos los roles, excepto que INSPECTOR
 *   se crea exclusivamente desde /panel/inspectores.
 *
 * ADMINISTRADOR:
 * - puede crear y gestionar GERENTE, COORDINADOR, INSPECTOR y CLIENTE,
 *   pero INSPECTOR también se crea exclusivamente desde /panel/inspectores.
 * - no puede crear ni modificar DIRECTOR o ADMINISTRADOR.
 *
 * Nadie puede ver contraseñas existentes; únicamente se permite
 * establecer o restablecer una nueva contraseña.
 */
function validarRolCreable(
  rolGestor: RolUsuario,
  rolNuevo: RolUsuario,
) {
  if (
    rolNuevo ===
    RolUsuario.INSPECTOR
  ) {
    regresarConError(
      "Las cuentas de Inspector deben crearse desde el módulo de Inspectores para garantizar su zona, Coordinación y Gerencia.",
    );
  }

  if (
    !puedeCrearUsuario(
      rolGestor,
      rolNuevo,
    )
  ) {
    regresarConError(
      "No tienes facultad para crear un usuario con ese rol.",
    );
  }
}

function validarUsuarioObjetivoParaEstado(
  rolGestor: RolUsuario,
  rolObjetivo: RolUsuario,
) {
  if (
    !puedeActivarDesactivarUsuario(
      rolGestor,
      rolObjetivo,
    )
  ) {
    regresarConError(
      "No tienes facultad para activar o desactivar esa cuenta.",
    );
  }
}

function validarUsuarioObjetivoParaPassword(
  rolGestor: RolUsuario,
  rolObjetivo: RolUsuario,
) {
  if (
    !puedeCambiarPasswordDeUsuario(
      rolGestor,
      rolObjetivo,
    )
  ) {
    regresarConError(
      "No tienes facultad para restablecer la contraseña de esa cuenta.",
    );
  }
}

export async function crearUsuario(
  formData: FormData,
) {
  const gestor =
    await obtenerGestorActual();

  const resultado =
    crearUsuarioSchema.safeParse({
      nombre:
        texto(
          formData,
          "nombre",
        ),
      email:
        texto(
          formData,
          "email",
        ).toLowerCase(),
      password:
        texto(
          formData,
          "password",
        ),
      rol:
        texto(
          formData,
          "rol",
        ),
    });

  if (!resultado.success) {
    regresarConError(
      resultado.error
        .issues[0]?.message ??
        "Los datos del usuario no son válidos.",
    );
  }

  const {
    nombre,
    email,
    password,
    rol,
  } = resultado.data;

  validarRolCreable(
    gestor.rol,
    rol,
  );

  const usuarioExistente =
    await prisma.usuario.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

  if (usuarioExistente) {
    regresarConError(
      "Ya existe una cuenta registrada con ese correo.",
    );
  }

  const passwordHash =
    await bcrypt.hash(
      password,
      12,
    );

  try {
    const usuario =
      await prisma.$transaction(
        async (tx) => {
          const creado =
            await tx.usuario.create({
              data: {
                nombre,
                email,
                passwordHash,
                rol,
                activo: true,
              },
            });

          if (
            rol ===
            RolUsuario.CLIENTE
          ) {
            await tx.cliente.create({
              data: {
                usuarioId:
                  creado.id,
                nombre,
                correo:
                  email,
              },
            });
          }

          return creado;
        },
      );

    await registrarAuditoria({
      tipo:
        TipoEvento.CREAR,
      entidad:
        "Usuario",
      entidadId:
        usuario.id,
      usuarioId:
        gestor.id,
      descripcion:
        `${gestor.rol} creó el usuario ${usuario.email} ` +
        `con rol ${usuario.rol}.`,
    });
  } catch (error) {
    console.error(
      "Error al crear usuario:",
      error,
    );

    regresarConError(
      "No fue posible crear el usuario.",
    );
  }

  revalidatePath(
    "/panel/usuarios",
  );
  revalidatePath(
    "/panel/inspectores",
  );
  revalidatePath(
    "/panel/clientes",
  );
  revalidatePath(
    "/panel",
  );

  regresarConExito(
    "Usuario creado correctamente.",
  );
}

export async function cambiarEstadoUsuario(
  formData: FormData,
) {
  const gestor =
    await obtenerGestorActual();

  const usuarioId =
    texto(
      formData,
      "usuarioId",
    );

  const activoTexto =
    texto(
      formData,
      "activo",
    );

  if (!usuarioId) {
    regresarConError(
      "El usuario seleccionado no es válido.",
    );
  }

  if (
    usuarioId ===
    gestor.id
  ) {
    regresarConError(
      "No puedes desactivar tu propia cuenta.",
    );
  }

  const nuevoEstado =
    activoTexto === "true";

  const usuarioActual =
    await prisma.usuario.findUnique({
      where: {
        id: usuarioId,
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
      },
    });

  if (!usuarioActual) {
    regresarConError(
      "El usuario no fue encontrado.",
    );
  }

  validarUsuarioObjetivoParaEstado(
    gestor.rol,
    usuarioActual.rol,
  );

  if (
    gestor.rol ===
      RolUsuario.DIRECTOR &&
    usuarioActual.rol ===
      RolUsuario.DIRECTOR &&
    !nuevoEstado
  ) {
    const directoresActivos =
      await prisma.usuario.count({
        where: {
          rol:
            RolUsuario.DIRECTOR,
          activo:
            true,
        },
      });

    if (
      directoresActivos <= 1
    ) {
      regresarConError(
        "No puedes desactivar al único Director activo de la plataforma.",
      );
    }
  }

  const usuario =
    await prisma.$transaction(
      async (tx) => {
        const actualizado =
          await tx.usuario.update({
            where: {
              id:
                usuarioId,
            },
            data: {
              activo:
                nuevoEstado,
            },
            select: {
              id: true,
              email: true,
              rol: true,
              activo: true,
            },
          });

        if (
          actualizado.rol ===
          RolUsuario.INSPECTOR
        ) {
          await tx.inspector.updateMany({
            where: {
              usuarioId:
                actualizado.id,
            },
            data: {
              activo:
                nuevoEstado,
            },
          });
        }

        return actualizado;
      },
    );

  await registrarAuditoria({
    tipo:
      TipoEvento.EDITAR,
    entidad:
      "Usuario",
    entidadId:
      usuario.id,
    usuarioId:
      gestor.id,
    descripcion:
      nuevoEstado
        ? `${gestor.rol} activó la cuenta ${usuario.email}.`
        : `${gestor.rol} desactivó la cuenta ${usuario.email}.`,
  });

  revalidatePath(
    "/panel/usuarios",
  );
  revalidatePath(
    "/panel/inspectores",
  );
  revalidatePath(
    "/panel",
  );

  regresarConExito(
    nuevoEstado
      ? "Usuario activado correctamente."
      : "Usuario desactivado correctamente.",
  );
}

export async function cambiarPasswordUsuario(
  formData: FormData,
) {
  const gestor =
    await obtenerGestorActual();

  const resultado =
    cambiarPasswordSchema.safeParse({
      usuarioId:
        texto(
          formData,
          "usuarioId",
        ),
      password:
        texto(
          formData,
          "password",
        ),
    });

  if (!resultado.success) {
    regresarConError(
      resultado.error
        .issues[0]?.message ??
        "La nueva contraseña no es válida.",
    );
  }

  const {
    usuarioId,
    password,
  } = resultado.data;

  const usuario =
    await prisma.usuario.findUnique({
      where: {
        id:
          usuarioId,
      },
      select: {
        id: true,
        email: true,
        rol: true,
      },
    });

  if (!usuario) {
    regresarConError(
      "El usuario no fue encontrado.",
    );
  }

  validarUsuarioObjetivoParaPassword(
    gestor.rol,
    usuario.rol,
  );

  const passwordHash =
    await bcrypt.hash(
      password,
      12,
    );

  await prisma.usuario.update({
    where: {
      id:
        usuario.id,
    },
    data: {
      passwordHash,
    },
  });

  await registrarAuditoria({
    tipo:
      TipoEvento.EDITAR,
    entidad:
      "Usuario",
    entidadId:
      usuario.id,
    usuarioId:
      gestor.id,
    descripcion:
      `${gestor.rol} restableció la contraseña de ${usuario.email}.`,
  });

  revalidatePath(
    "/panel/usuarios",
  );

  regresarConExito(
    "Contraseña actualizada correctamente.",
  );
}
