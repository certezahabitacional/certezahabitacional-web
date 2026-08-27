"use server";

import {
  RolUsuario,
  TipoEvento,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { puede } from "@/lib/permisos";
import { prisma } from "@/lib/prisma";

type AccionInmueble =
  | "INMUEBLE_CREAR"
  | "INMUEBLE_EDITAR_ADMIN"
  | "REGISTRO_ELIMINAR_FISICO";

async function verificarPermisoAdministrativo(
  accion: AccionInmueble,
) {
  const session =
    await auth();

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

function regresarConError(
  mensaje: string,
): never {
  redirect(
    `/panel/inmuebles?error=${encodeURIComponent(
      mensaje,
    )}`,
  );
}

function regresarConExito(
  mensaje: string,
): never {
  redirect(
    `/panel/inmuebles?ok=${encodeURIComponent(
      mensaje,
    )}`,
  );
}

function decimalOpcional(
  formData: FormData,
  campo: string,
  etiqueta: string,
  minimo?: number,
  maximo?: number,
): number | null {
  const valor =
    texto(
      formData,
      campo,
    );

  if (!valor) {
    return null;
  }

  const numero =
    Number(valor);

  if (
    !Number.isFinite(numero)
  ) {
    regresarConError(
      `${etiqueta} no es un número válido.`,
    );
  }

  if (
    minimo !== undefined &&
    numero < minimo
  ) {
    regresarConError(
      `${etiqueta} no puede ser menor que ${minimo}.`,
    );
  }

  if (
    maximo !== undefined &&
    numero > maximo
  ) {
    regresarConError(
      `${etiqueta} no puede ser mayor que ${maximo}.`,
    );
  }

  return numero;
}

function anioConstruccion(
  formData: FormData,
): number | null {
  const valor =
    texto(
      formData,
      "anioConstruccion",
    );

  if (!valor) {
    return null;
  }

  const anio =
    Number(valor);

  if (
    !Number.isInteger(anio) ||
    anio < 1800 ||
    anio >
      new Date().getFullYear() + 1
  ) {
    regresarConError(
      "El año de construcción no es válido.",
    );
  }

  return anio;
}

function datosInmueble(
  formData: FormData,
) {
  const alias =
    texto(
      formData,
      "alias",
    );

  const tipo =
    texto(
      formData,
      "tipo",
    );

  const direccion =
    texto(
      formData,
      "direccion",
    );

  const ciudad =
    texto(
      formData,
      "ciudad",
    );

  const estado =
    texto(
      formData,
      "estado",
    );

  if (
    !alias ||
    !tipo ||
    !direccion ||
    !ciudad ||
    !estado
  ) {
    regresarConError(
      "Completa los campos obligatorios.",
    );
  }

  return {
    alias,
    tipo,
    direccion,
    ciudad,
    estado,

    colonia:
      texto(
        formData,
        "colonia",
      ) || null,

    codigoPostal:
      texto(
        formData,
        "codigoPostal",
      ) || null,

    latitud:
      decimalOpcional(
        formData,
        "latitud",
        "La latitud",
        -90,
        90,
      ),

    longitud:
      decimalOpcional(
        formData,
        "longitud",
        "La longitud",
        -180,
        180,
      ),

    superficieTerrenoM2:
      decimalOpcional(
        formData,
        "superficieTerrenoM2",
        "La superficie de terreno",
        0,
      ),

    superficieConstruccionM2:
      decimalOpcional(
        formData,
        "superficieConstruccionM2",
        "La superficie de construcción",
        0,
      ),

    anioConstruccion:
      anioConstruccion(
        formData,
      ),

    nombreConstructor:
      texto(
        formData,
        "constructor",
      ) || null,

    desarrollo:
      texto(
        formData,
        "desarrollo",
      ) || null,

    numeroEscritura:
      texto(
        formData,
        "numeroEscritura",
      ) || null,

    notas:
      texto(
        formData,
        "notas",
      ) || null,
  };
}

export async function crearInmueble(
  formData: FormData,
) {
  const {
    usuario,
  } =
    await verificarPermisoAdministrativo(
      "INMUEBLE_CREAR",
    );

  const clienteId =
    texto(
      formData,
      "clienteId",
    );

  if (!clienteId) {
    regresarConError(
      "Selecciona un cliente.",
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
      },
    });

  if (!cliente) {
    regresarConError(
      "El cliente seleccionado no existe.",
    );
  }

  const data =
    datosInmueble(
      formData,
    );

  const inmueble =
    await prisma.inmueble.create({
      data: {
        clienteId,
        ...data,
      },
      select: {
        id: true,
        alias: true,
      },
    });

  await registrarAuditoria({
    tipo: TipoEvento.CREAR,
    entidad: "Inmueble",
    entidadId:
      inmueble.id,
    usuarioId:
      usuario.id,
    descripcion:
      `${usuario.rol} creó el inmueble ${inmueble.alias} para el cliente ${cliente.nombre}.`,
  });

  revalidatePath(
    "/panel/inmuebles",
  );

  revalidatePath(
    "/panel/cotizaciones",
  );

  revalidatePath(
    "/panel",
  );

  regresarConExito(
    "Inmueble registrado.",
  );
}

export async function actualizarInmueble(
  formData: FormData,
) {
  const {
    usuario,
  } =
    await verificarPermisoAdministrativo(
      "INMUEBLE_EDITAR_ADMIN",
    );

  const id =
    texto(
      formData,
      "id",
    );

  if (!id) {
    regresarConError(
      "Inmueble inválido.",
    );
  }

  const existente =
    await prisma.inmueble.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        alias: true,
        clienteId: true,
      },
    });

  if (!existente) {
    regresarConError(
      "El inmueble no existe.",
    );
  }

  const data =
    datosInmueble(
      formData,
    );

  const inmueble =
    await prisma.inmueble.update({
      where: {
        id,
      },
      data,
      select: {
        id: true,
        alias: true,
      },
    });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "Inmueble",
    entidadId:
      inmueble.id,
    usuarioId:
      usuario.id,
    descripcion:
      `${usuario.rol} actualizó los datos administrativos del inmueble ${inmueble.alias}.`,
  });

  revalidatePath(
    "/panel/inmuebles",
  );

  revalidatePath(
    "/panel/cotizaciones",
  );

  revalidatePath(
    "/panel/inspecciones",
  );

  revalidatePath(
    "/portal/inmuebles",
  );

  regresarConExito(
    "Inmueble actualizado.",
  );
}

export async function eliminarInmueble(
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
      "Inmueble inválido.",
    );
  }

  const inmueble =
    await prisma.inmueble.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        alias: true,
        _count: {
          select: {
            inspecciones: true,
            cotizaciones: true,
          },
        },
      },
    });

  if (!inmueble) {
    regresarConError(
      "El inmueble no existe.",
    );
  }

  if (
    inmueble._count.inspecciones >
      0 ||
    inmueble._count.cotizaciones >
      0
  ) {
    regresarConError(
      "No puede eliminarse un inmueble con inspecciones o cotizaciones asociadas.",
    );
  }

  await prisma.inmueble.delete({
    where: {
      id,
    },
  });

  await registrarAuditoria({
    tipo: TipoEvento.ELIMINAR,
    entidad: "Inmueble",
    entidadId:
      inmueble.id,
    usuarioId:
      usuario.id,
    descripcion:
      `Dirección eliminó físicamente el inmueble vacío ${inmueble.alias}.`,
  });

  revalidatePath(
    "/panel/inmuebles",
  );

  revalidatePath(
    "/panel/cotizaciones",
  );

  revalidatePath(
    "/panel",
  );

  regresarConExito(
    "Registro vacío eliminado por Dirección.",
  );
}
