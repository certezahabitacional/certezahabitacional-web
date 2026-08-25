"use server";

import bcrypt from "bcryptjs";
import {
  RolUsuario,
  TipoEvento,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { obtenerAdministradorActual } from "@/lib/administrador-actual";

const crearUsuarioSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(3, "El nombre debe tener al menos 3 caracteres."),

  email: z
    .string()
    .trim()
    .email("El correo electrónico no es válido."),

  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres."),

  rol: z.nativeEnum(RolUsuario),
});

const cambiarPasswordSchema = z.object({
  usuarioId: z.string().trim().min(1),

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
  const gestor = await obtenerAdministradorActual();

  if (
    gestor.rol !== RolUsuario.DIRECTOR &&
    gestor.rol !== RolUsuario.ADMINISTRADOR
  ) {
    regresarConError(
      "Solo Dirección y Administración pueden gestionar usuarios.",
    );
  }

  return gestor;
}

function validarRolCreable(
  rolGestor: RolUsuario,
  rolNuevo: RolUsuario,
) {
  if (rolGestor === RolUsuario.DIRECTOR) {
    return;
  }

  if (
    rolNuevo === RolUsuario.DIRECTOR ||
    rolNuevo === RolUsuario.ADMINISTRADOR
  ) {
    regresarConError(
      "Administración no puede crear cuentas de Director ni de Administrador. Esa facultad corresponde exclusivamente a Dirección.",
    );
  }
}

function validarUsuarioObjetivo(
  rolGestor: RolUsuario,
  usuarioObjetivo: {
    id: string;
    rol: RolUsuario;
  },
) {
  if (
    rolGestor === RolUsuario.ADMINISTRADOR &&
    usuarioObjetivo.rol === RolUsuario.DIRECTOR
  ) {
    regresarConError(
      "Administración no puede modificar, desactivar ni restablecer la contraseña de una cuenta de Dirección.",
    );
  }
}

export async function crearUsuario(
  formData: FormData,
) {
  const gestor = await obtenerGestorActual();

  const resultado =
    crearUsuarioSchema.safeParse({
      nombre: texto(formData, "nombre"),
      email: texto(
        formData,
        "email",
      ).toLowerCase(),
      password: texto(
        formData,
        "password",
      ),
      rol: texto(formData, "rol"),
    });

  if (!resultado.success) {
    regresarConError(
      resultado.error.issues[0]?.message ??
        "Los datos del usuario no son válidos.",
    );
  }

  const {
    nombre,
    email,
    password,
    rol,
  } = resultado.data;

  validarRolCreable(gestor.rol, rol);

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
    await bcrypt.hash(password, 12);

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
            rol === RolUsuario.CLIENTE
          ) {
            await tx.cliente.create({
              data: {
                usuarioId: creado.id,
                nombre,
                correo: email,
              },
            });
          }

          if (
            rol === RolUsuario.INSPECTOR
          ) {
            await tx.inspector.create({
              data: {
                usuarioId: creado.id,
                activo: true,
              },
            });
          }

          return creado;
        },
      );

    await registrarAuditoria({
      tipo: TipoEvento.CREAR,
      entidad: "Usuario",
      entidadId: usuario.id,
      usuarioId: gestor.id,
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

  revalidatePath("/panel/usuarios");
  revalidatePath("/panel/inspectores");
  revalidatePath("/panel");

  regresarConExito(
    "Usuario creado correctamente.",
  );
}

export async function cambiarEstadoUsuario(
  formData: FormData,
) {
  const gestor = await obtenerGestorActual();

  const usuarioId = texto(
    formData,
    "usuarioId",
  );

  const activoTexto = texto(
    formData,
    "activo",
  );

  if (!usuarioId) {
    regresarConError(
      "El usuario seleccionado no es válido.",
    );
  }

  if (
    usuarioId === gestor.id
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
        email: true,
        rol: true,
      },
    });

  if (!usuarioActual) {
    regresarConError(
      "El usuario no fue encontrado.",
    );
  }

  validarUsuarioObjetivo(
    gestor.rol,
    usuarioActual,
  );

  if (
    gestor.rol === RolUsuario.DIRECTOR &&
    usuarioActual.rol === RolUsuario.DIRECTOR &&
    !nuevoEstado
  ) {
    const directoresActivos =
      await prisma.usuario.count({
        where: {
          rol: RolUsuario.DIRECTOR,
          activo: true,
        },
      });

    if (directoresActivos <= 1) {
      regresarConError(
        "No puedes desactivar al único Director activo de la plataforma.",
      );
    }
  }

  const usuario =
    await prisma.usuario.update({
      where: {
        id: usuarioId,
      },
      data: {
        activo: nuevoEstado,
      },
      select: {
        id: true,
        email: true,
        rol: true,
        activo: true,
      },
    });

  if (
    usuario.rol ===
    RolUsuario.INSPECTOR
  ) {
    await prisma.inspector.updateMany({
      where: {
        usuarioId: usuario.id,
      },
      data: {
        activo: nuevoEstado,
      },
    });
  }

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "Usuario",
    entidadId: usuario.id,
    usuarioId: gestor.id,
    descripcion: nuevoEstado
      ? `${gestor.rol} activó la cuenta ${usuario.email}.`
      : `${gestor.rol} desactivó la cuenta ${usuario.email}.`,
  });

  revalidatePath("/panel/usuarios");
  revalidatePath("/panel/inspectores");
  revalidatePath("/panel");

  regresarConExito(
    nuevoEstado
      ? "Usuario activado correctamente."
      : "Usuario desactivado correctamente.",
  );
}

export async function cambiarPasswordUsuario(
  formData: FormData,
) {
  const gestor = await obtenerGestorActual();

  const resultado =
    cambiarPasswordSchema.safeParse({
      usuarioId: texto(
        formData,
        "usuarioId",
      ),
      password: texto(
        formData,
        "password",
      ),
    });

  if (!resultado.success) {
    regresarConError(
      resultado.error.issues[0]?.message ??
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
        id: usuarioId,
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

  validarUsuarioObjetivo(
    gestor.rol,
    usuario,
  );

  const passwordHash =
    await bcrypt.hash(password, 12);

  await prisma.usuario.update({
    where: {
      id: usuario.id,
    },
    data: {
      passwordHash,
    },
  });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "Usuario",
    entidadId: usuario.id,
    usuarioId: gestor.id,
    descripcion:
      `${gestor.rol} restableció la contraseña de ` +
      `${usuario.email}.`,
  });

  revalidatePath("/panel/usuarios");

  regresarConExito(
    "Contraseña actualizada correctamente.",
  );
}