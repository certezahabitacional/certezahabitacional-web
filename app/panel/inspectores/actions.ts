"use server";

import bcrypt from "bcryptjs";
import {
  RolUsuario,
  TipoEvento,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  puedeActivarDesactivarUsuario,
  puedeCrearUsuario,
} from "@/lib/permisos";
import { prisma } from "@/lib/prisma";

const valor = (
  formData: FormData,
  campo: string,
) =>
  String(
    formData.get(campo) ?? "",
  ).trim();

function redirigirError(
  mensaje: string,
): never {
  redirect(
    `/panel/inspectores?error=${encodeURIComponent(
      mensaje,
    )}`,
  );
}

function redirigirOk(
  mensaje: string,
): never {
  redirect(
    `/panel/inspectores?ok=${encodeURIComponent(
      mensaje,
    )}`,
  );
}

async function exigirAdministradorODirector() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const usuarioActual =
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
    !usuarioActual ||
    !usuarioActual.activo
  ) {
    redirect("/acceso");
  }

  if (
    usuarioActual.rol !==
      RolUsuario.DIRECTOR &&
    usuarioActual.rol !==
      RolUsuario.ADMINISTRADOR
  ) {
    redirect("/acceso");
  }

  return {
    session,
    usuarioActual,
  };
}

export async function crearInspector(
  formData: FormData,
) {
  const {
    usuarioActual,
  } =
    await exigirAdministradorODirector();

  if (
    !puedeCrearUsuario(
      usuarioActual.rol,
      RolUsuario.INSPECTOR,
    )
  ) {
    redirigirError(
      "No tienes facultad para crear usuarios Inspector.",
    );
  }

  const nombre =
    valor(
      formData,
      "nombre",
    );

  const email =
    valor(
      formData,
      "email",
    ).toLowerCase();

  const password =
    valor(
      formData,
      "password",
    );

  const zonaId =
    valor(
      formData,
      "zonaId",
    );

  const coordinadorId =
    valor(
      formData,
      "coordinadorId",
    );

  if (
    !nombre ||
    !email ||
    password.length < 8
  ) {
    redirigirError(
      "Completa nombre, correo y contraseña de al menos 8 caracteres.",
    );
  }

  if (
    !zonaId ||
    !coordinadorId
  ) {
    redirigirError(
      "Selecciona la zona y el Coordinador del Inspector.",
    );
  }

  const existe =
    await prisma.usuario.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

  if (existe) {
    redirigirError(
      "Ese correo ya está registrado.",
    );
  }

  const [
    zona,
    coordinador,
  ] = await Promise.all([
    prisma.zona.findFirst({
      where: {
        id: zonaId,
        activa: true,
      },
      select: {
        id: true,
        nombre: true,
        codigo: true,
      },
    }),

    prisma.usuario.findFirst({
      where: {
        id: coordinadorId,
        rol:
          RolUsuario.COORDINADOR,
        activo: true,
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        zonaId: true,
        gerenteId: true,
        gerente: {
          select: {
            id: true,
            nombre: true,
            email: true,
            zonaId: true,
          },
        },
      },
    }),
  ]);

  if (!zona) {
    redirigirError(
      "La zona seleccionada no existe o está inactiva.",
    );
  }

  if (!coordinador) {
    redirigirError(
      "El Coordinador seleccionado no existe o está inactivo.",
    );
  }

  if (
    !coordinador.zonaId ||
    coordinador.zonaId !==
      zona.id
  ) {
    redirigirError(
      "El Coordinador seleccionado no pertenece a la zona indicada.",
    );
  }

  if (
    !coordinador.gerenteId ||
    !coordinador.gerente
  ) {
    redirigirError(
      "El Coordinador seleccionado no tiene una Gerencia asignada.",
    );
  }

  if (
    coordinador.gerente.zonaId &&
    coordinador.gerente.zonaId !==
      zona.id
  ) {
    redirigirError(
      "La Gerencia del Coordinador no corresponde a la misma zona.",
    );
  }

  const passwordHash =
    await bcrypt.hash(
      password,
      12,
    );

  const usuario =
    await prisma.usuario.create({
      data: {
        nombre,
        email,
        passwordHash,
        rol:
          RolUsuario.INSPECTOR,
        activo: true,
        zonaId:
          zona.id,
        gerenteId:
          coordinador.gerenteId,
        coordinadorId:
          coordinador.id,
        inspector: {
          create: {
            telefono:
              valor(
                formData,
                "telefono",
              ) || null,
            especialidad:
              valor(
                formData,
                "especialidad",
              ) || null,
            cedula:
              valor(
                formData,
                "cedula",
              ) || null,
            ciudad:
              valor(
                formData,
                "ciudad",
              ) || zona.nombre,
            activo:
              true,
          },
        },
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        zona: {
          select: {
            nombre: true,
            codigo: true,
          },
        },
        coordinador: {
          select: {
            nombre: true,
            email: true,
          },
        },
        gerente: {
          select: {
            nombre: true,
            email: true,
          },
        },
        inspector: {
          select: {
            id: true,
          },
        },
      },
    });

  await registrarAuditoria({
    tipo:
      TipoEvento.CREAR,
    entidad:
      "Usuario",
    entidadId:
      usuario.id,
    usuarioId:
      usuarioActual.id,
    descripcion:
      `${usuarioActual.rol} creó el acceso del Inspector ` +
      `${usuario.nombre} (${usuario.email}) en ` +
      `${usuario.zona?.nombre ?? zona.nombre}, ` +
      `bajo Coordinación de ${
        usuario.coordinador?.nombre ??
        coordinador.nombre
      } y Gerencia de ${
        usuario.gerente?.nombre ??
        coordinador.gerente.nombre
      }.`,
  });

  revalidatePath(
    "/panel/inspectores",
  );

  revalidatePath(
    "/panel/usuarios",
  );

  revalidatePath(
    "/panel",
  );

  redirigirOk(
    "Inspector registrado correctamente.",
  );
}

export async function alternarInspector(
  formData: FormData,
) {
  const {
    usuarioActual,
  } =
    await exigirAdministradorODirector();

  if (
    !puedeActivarDesactivarUsuario(
      usuarioActual.rol,
      RolUsuario.INSPECTOR,
    )
  ) {
    redirigirError(
      "No tienes facultad para activar o desactivar Inspectores.",
    );
  }

  const id =
    valor(
      formData,
      "id",
    );

  if (!id) {
    redirigirError(
      "Inspector no válido.",
    );
  }

  const inspector =
    await prisma.inspector.findUnique({
      where: {
        id,
      },
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            email: true,
            rol: true,
            activo: true,
          },
        },
      },
    });

  if (!inspector) {
    redirigirError(
      "El Inspector no existe.",
    );
  }

  if (
    inspector.usuario.rol !==
    RolUsuario.INSPECTOR
  ) {
    redirigirError(
      "El perfil seleccionado no corresponde a un usuario Inspector.",
    );
  }

  const nuevoEstado =
    !inspector.activo;

  await prisma.$transaction([
    prisma.inspector.update({
      where: {
        id,
      },
      data: {
        activo:
          nuevoEstado,
      },
    }),

    prisma.usuario.update({
      where: {
        id:
          inspector.usuarioId,
      },
      data: {
        activo:
          nuevoEstado,
      },
    }),
  ]);

  await registrarAuditoria({
    tipo:
      TipoEvento.EDITAR,
    entidad:
      "Inspector",
    entidadId:
      inspector.id,
    usuarioId:
      usuarioActual.id,
    descripcion:
      `${usuarioActual.rol} ${
        nuevoEstado
          ? "activó"
          : "desactivó"
      } al Inspector ` +
      `${inspector.usuario.nombre} (${inspector.usuario.email}).`,
  });

  revalidatePath(
    "/panel/inspectores",
  );

  revalidatePath(
    "/panel/usuarios",
  );

  revalidatePath(
    "/panel",
  );

  redirigirOk(
    `Inspector ${
      nuevoEstado
        ? "activado"
        : "desactivado"
    } correctamente.`,
  );
}
