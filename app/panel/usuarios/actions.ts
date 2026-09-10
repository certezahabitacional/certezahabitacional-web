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
    .min(3, "El nombre debe tener al menos 3 caracteres."),

  email: z
    .string()
    .trim()
    .email("El correo electrónico no es válido."),

  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres."),

  rol: z.nativeEnum(RolUsuario),

  zonaId: z
    .string()
    .trim()
    .optional(),

  alcanceAdministrador: z
    .enum(["GLOBAL", "ZONA"])
    .optional(),

  gerenteId: z
    .string()
    .trim()
    .optional(),
});

const actualizarUsuarioSchema = z.object({
  usuarioId: z.string().trim().min(1),

  nombre: z
    .string()
    .trim()
    .min(3, "El nombre debe tener al menos 3 caracteres."),

  email: z
    .string()
    .trim()
    .email("El correo electrónico no es válido."),

  rol: z.nativeEnum(RolUsuario),

  zonaId: z
    .string()
    .trim()
    .optional(),

  alcanceAdministrador: z
    .enum(["GLOBAL", "ZONA"])
    .optional(),

  gerenteId: z
    .string()
    .trim()
    .optional(),
});

const cambiarPasswordSchema = z.object({
  usuarioId: z.string().trim().min(1),

  password: z
    .string()
    .min(8, "La nueva contraseña debe tener al menos 8 caracteres."),
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

function validarRolCreable(
  rolGestor: RolUsuario,
  rolNuevo: RolUsuario,
) {
  if (
    rolNuevo ===
    RolUsuario.INSPECTOR
  ) {
    regresarConError(
      "Las cuentas de Inspector deben crearse desde el módulo de Inspectores para garantizar su zona, Coordinación, Gerencia y perfil operativo.",
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

function validarUsuarioObjetivoParaEdicion(
  gestor: {
    id: string;
    rol: RolUsuario;
  },
  objetivo: {
    id: string;
    rol: RolUsuario;
  },
  nuevoRol: RolUsuario,
) {
  if (objetivo.id === gestor.id) {
    regresarConError(
      "Tu propia cuenta no puede editarse desde este módulo.",
    );
  }

  if (
    objetivo.rol === RolUsuario.INSPECTOR ||
    nuevoRol === RolUsuario.INSPECTOR
  ) {
    regresarConError(
      "Los Inspectores deben editarse desde el módulo de Inspectores para mantener sincronizado su perfil operativo.",
    );
  }

  if (gestor.rol === RolUsuario.DIRECTOR) {
    return;
  }

  if (
    objetivo.rol === RolUsuario.DIRECTOR ||
    objetivo.rol === RolUsuario.ADMINISTRADOR
  ) {
    regresarConError(
      "Administración no puede modificar cuentas de Dirección ni de otros Administradores.",
    );
  }

  if (
    nuevoRol === RolUsuario.DIRECTOR ||
    nuevoRol === RolUsuario.ADMINISTRADOR
  ) {
    regresarConError(
      "Administración no puede asignar roles de Director o Administrador.",
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

async function validarZona(
  zonaId: string,
) {
  const zona =
    await prisma.zona.findUnique({
      where: {
        id: zonaId,
      },
      select: {
        id: true,
        nombre: true,
        activa: true,
      },
    });

  if (
    !zona ||
    !zona.activa
  ) {
    regresarConError(
      "La zona seleccionada no existe o está inactiva.",
    );
  }

  return zona;
}

async function validarGerenteDeZona(
  gerenteId: string,
  zonaId: string,
) {
  const gerente =
    await prisma.usuario.findUnique({
      where: {
        id: gerenteId,
      },
      select: {
        id: true,
        nombre: true,
        rol: true,
        activo: true,
        zonaId: true,
      },
    });

  if (!gerente) {
    regresarConError(
      "El Gerente seleccionado no existe.",
    );
  }

  if (
    gerente.rol !==
    RolUsuario.GERENTE
  ) {
    regresarConError(
      "El usuario seleccionado no tiene rol de Gerente.",
    );
  }

  if (!gerente.activo) {
    regresarConError(
      "El Gerente seleccionado está inactivo.",
    );
  }

  if (
    gerente.zonaId !==
    zonaId
  ) {
    regresarConError(
      "El Gerente seleccionado no pertenece a la misma zona del Coordinador.",
    );
  }

  return gerente;
}

async function resolverJerarquia({
  rol,
  zonaId,
  alcanceAdministrador,
  gerenteId,
}: {
  rol: RolUsuario;
  zonaId?: string;
  alcanceAdministrador?: "GLOBAL" | "ZONA";
  gerenteId?: string;
}) {
  let zonaFinalId: string | null = null;
  let gerenteFinalId: string | null = null;

  if (
    rol ===
    RolUsuario.DIRECTOR
  ) {
    return {
      zonaFinalId,
      gerenteFinalId,
    };
  }

  if (
    rol ===
    RolUsuario.ADMINISTRADOR
  ) {
    const alcance =
      alcanceAdministrador ??
      "GLOBAL";

    if (
      alcance === "ZONA"
    ) {
      if (!zonaId) {
        regresarConError(
          "Debes seleccionar una zona para el Administrador con alcance por zona.",
        );
      }

      await validarZona(
        zonaId,
      );

      zonaFinalId =
        zonaId;
    }

    return {
      zonaFinalId,
      gerenteFinalId,
    };
  }

  if (
    rol ===
    RolUsuario.GERENTE
  ) {
    if (!zonaId) {
      regresarConError(
        "Debes seleccionar una zona para el Gerente.",
      );
    }

    await validarZona(
      zonaId,
    );

    zonaFinalId =
      zonaId;

    return {
      zonaFinalId,
      gerenteFinalId,
    };
  }

  if (
    rol ===
    RolUsuario.COORDINADOR
  ) {
    if (!zonaId) {
      regresarConError(
        "Debes seleccionar una zona para el Coordinador.",
      );
    }

    if (!gerenteId) {
      regresarConError(
        "Debes seleccionar el Gerente responsable del Coordinador.",
      );
    }

    await validarZona(
      zonaId,
    );

    await validarGerenteDeZona(
      gerenteId,
      zonaId,
    );

    zonaFinalId =
      zonaId;

    gerenteFinalId =
      gerenteId;

    return {
      zonaFinalId,
      gerenteFinalId,
    };
  }

  if (
    rol ===
    RolUsuario.CLIENTE
  ) {
    return {
      zonaFinalId,
      gerenteFinalId,
    };
  }

  regresarConError(
    "El rol seleccionado no puede administrarse desde este módulo.",
  );
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

      zonaId:
        texto(
          formData,
          "zonaId",
        ) || undefined,

      alcanceAdministrador:
        texto(
          formData,
          "alcanceAdministrador",
        ) || undefined,

      gerenteId:
        texto(
          formData,
          "gerenteId",
        ) || undefined,
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
    zonaId,
    alcanceAdministrador,
    gerenteId,
  } = resultado.data;

  validarRolCreable(
    gestor.rol,
    rol,
  );

  const {
    zonaFinalId,
    gerenteFinalId,
  } = await resolverJerarquia({
    rol,
    zonaId,
    alcanceAdministrador,
    gerenteId,
  });

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
                requiereCambioPassword: true,

                zonaId:
                  zonaFinalId,

                gerenteId:
                  gerenteFinalId,

                coordinadorId:
                  null,
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

    const descripcionZona =
      zonaFinalId
        ? ` Zona asignada: ${zonaFinalId}.`
        : rol ===
            RolUsuario.ADMINISTRADOR
          ? " Alcance administrativo: GLOBAL."
          : "";

    const descripcionGerente =
      gerenteFinalId
        ? ` Gerente responsable: ${gerenteFinalId}.`
        : "";

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
        `con rol ${usuario.rol}. Contraseña temporal: sí.` +
        descripcionZona +
        descripcionGerente,
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
    "Usuario creado correctamente. Deberá cambiar su contraseña en el primer acceso.",
  );
}

export async function actualizarUsuario(
  formData: FormData,
) {
  const gestor =
    await obtenerGestorActual();

  const resultado =
    actualizarUsuarioSchema.safeParse({
      usuarioId:
        texto(
          formData,
          "usuarioId",
        ),

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

      rol:
        texto(
          formData,
          "rol",
        ),

      zonaId:
        texto(
          formData,
          "zonaId",
        ) || undefined,

      alcanceAdministrador:
        texto(
          formData,
          "alcanceAdministrador",
        ) || undefined,

      gerenteId:
        texto(
          formData,
          "gerenteId",
        ) || undefined,
    });

  if (!resultado.success) {
    regresarConError(
      resultado.error
        .issues[0]?.message ??
        "Los datos del usuario no son válidos.",
    );
  }

  const {
    usuarioId,
    nombre,
    email,
    rol,
    zonaId,
    alcanceAdministrador,
    gerenteId,
  } = resultado.data;

  const objetivo =
    await prisma.usuario.findUnique({
      where: {
        id: usuarioId,
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        zonaId: true,
        gerenteId: true,
        coordinadorId: true,
        coordinadoresACargo: {
          select: {
            id: true,
          },
          take: 1,
        },
        inspectoresACargo: {
          select: {
            id: true,
          },
          take: 1,
        },
      },
    });

  if (!objetivo) {
    regresarConError(
      "El usuario no fue encontrado.",
    );
  }

  validarUsuarioObjetivoParaEdicion(
    gestor,
    objetivo,
    rol,
  );

  if (
    objetivo.rol === RolUsuario.GERENTE &&
    rol !== RolUsuario.GERENTE &&
    objetivo.coordinadoresACargo.length > 0
  ) {
    regresarConError(
      "No puedes cambiar el rol de este Gerente mientras tenga Coordinadores asignados. Reasigna primero su estructura.",
    );
  }

  if (
    objetivo.rol === RolUsuario.COORDINADOR &&
    rol !== RolUsuario.COORDINADOR &&
    objetivo.inspectoresACargo.length > 0
  ) {
    regresarConError(
      "No puedes cambiar el rol de este Coordinador mientras tenga Inspectores asignados. Reasigna primero su estructura.",
    );
  }

  const correoDuplicado =
    await prisma.usuario.findFirst({
      where: {
        email,
        id: {
          not: usuarioId,
        },
      },
      select: {
        id: true,
      },
    });

  if (correoDuplicado) {
    regresarConError(
      "Ya existe otra cuenta registrada con ese correo.",
    );
  }

  const {
    zonaFinalId,
    gerenteFinalId,
  } = await resolverJerarquia({
    rol,
    zonaId,
    alcanceAdministrador,
    gerenteId,
  });

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.usuario.update({
          where: {
            id: usuarioId,
          },
          data: {
            nombre,
            email,
            rol,
            zonaId:
              zonaFinalId,
            gerenteId:
              gerenteFinalId,
            coordinadorId:
              null,
          },
        });

        const clienteVinculado =
          await tx.cliente.findUnique({
            where: {
              usuarioId,
            },
            select: {
              id: true,
            },
          });

        if (
          rol === RolUsuario.CLIENTE
        ) {
          if (
            clienteVinculado
          ) {
            await tx.cliente.update({
              where: {
                id:
                  clienteVinculado.id,
              },
              data: {
                nombre,
                correo:
                  email,
              },
            });
          } else {
            await tx.cliente.create({
              data: {
                usuarioId,
                nombre,
                correo:
                  email,
              },
            });
          }
        } else if (
          clienteVinculado
        ) {
          await tx.cliente.update({
            where: {
              id:
                clienteVinculado.id,
            },
            data: {
              usuarioId:
                null,
            },
          });
        }
      },
    );
  } catch (error) {
    console.error(
      "Error al actualizar usuario:",
      error,
    );

    regresarConError(
      "No fue posible actualizar el usuario.",
    );
  }

  await registrarAuditoria({
    tipo:
      TipoEvento.EDITAR,

    entidad:
      "Usuario",

    entidadId:
      usuarioId,

    usuarioId:
      gestor.id,

    descripcion:
      `${gestor.rol} actualizó la cuenta ${objetivo.email}. ` +
      `Nombre: ${objetivo.nombre} → ${nombre}. ` +
      `Correo: ${objetivo.email} → ${email}. ` +
      `Rol: ${objetivo.rol} → ${rol}. ` +
      `Zona: ${objetivo.zonaId ?? "sin zona"} → ${zonaFinalId ?? "sin zona"}. ` +
      `Gerente: ${objetivo.gerenteId ?? "sin gerente"} → ${gerenteFinalId ?? "sin gerente"}.`,
  });

  revalidatePath(
    "/panel/usuarios",
  );

  revalidatePath(
    "/panel/clientes",
  );

  revalidatePath(
    "/panel/inspectores",
  );

  revalidatePath(
    "/panel",
  );

  regresarConExito(
    "Usuario actualizado correctamente.",
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
      requiereCambioPassword: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
      ultimoFalloLogin: null,
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
      `${gestor.rol} restableció la contraseña temporal de ${usuario.email}. ` +
      "El usuario deberá cambiarla en su siguiente acceso.",
  });

  revalidatePath(
    "/panel/usuarios",
  );

  regresarConExito(
    "Contraseña temporal actualizada. El usuario deberá cambiarla en su siguiente acceso.",
  );
}
