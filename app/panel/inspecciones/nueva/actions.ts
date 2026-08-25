"use server";

import {
  EstadoInspeccion,
  RolUsuario,
  TipoEvento,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";

function texto(formData: FormData, campo: string): string {
  return String(formData.get(campo) ?? "").trim();
}

function decimalANumero(valor: unknown): number | null {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return null;
  }

  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function errorNuevaInspeccion(mensaje: string): never {
  redirect(
    `/panel/inspecciones/nueva?error=${encodeURIComponent(
      mensaje,
    )}`,
  );
}

export async function crearInspeccion(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const rol = session.user.role as RolUsuario;

  if (
    rol !== RolUsuario.ADMINISTRADOR &&
    rol !== RolUsuario.DIRECTOR
  ) {
    redirect("/acceso");
  }

  const clienteId = texto(formData, "clienteId");
  const inmuebleId = texto(formData, "inmuebleId");
  const inspectorId = texto(formData, "inspectorId");
  const tipoServicio = texto(formData, "tipoServicio");
  const fechaProgramadaTexto = texto(
    formData,
    "fechaProgramada",
  );
  const observaciones = texto(
    formData,
    "observaciones",
  );

  if (
    !clienteId ||
    !inmuebleId ||
    !tipoServicio ||
    !fechaProgramadaTexto
  ) {
    errorNuevaInspeccion(
      "Completa los campos obligatorios.",
    );
  }

  const fechaProgramada = new Date(
    fechaProgramadaTexto,
  );

  if (Number.isNaN(fechaProgramada.getTime())) {
    errorNuevaInspeccion(
      "Selecciona una fecha y hora válidas.",
    );
  }

  const inmueble = await prisma.inmueble.findUnique({
    where: { id: inmuebleId },
  });

  if (
    !inmueble ||
    inmueble.clienteId !== clienteId
  ) {
    errorNuevaInspeccion(
      "El inmueble no corresponde al cliente.",
    );
  }

  if (inspectorId) {
    const inspector =
      await prisma.inspector.findFirst({
        where: {
          id: inspectorId,
          activo: true,
          usuario: {
            activo: true,
          },
        },
        select: {
          id: true,
        },
      });

    if (!inspector) {
      errorNuevaInspeccion(
        "El inspector seleccionado no está disponible.",
      );
    }
  }

  const year = fechaProgramada.getFullYear();
  const inicioYear = new Date(year, 0, 1);
  const inicioSiguienteYear = new Date(
    year + 1,
    0,
    1,
  );

  const totalDelYear =
    await prisma.inspeccion.count({
      where: {
        creadoEn: {
          gte: inicioYear,
          lt: inicioSiguienteYear,
        },
      },
    });

  let consecutivo = totalDelYear + 1;
  let folio = `CH-${year}-${String(
    consecutivo,
  ).padStart(4, "0")}`;

  while (
    await prisma.inspeccion.findUnique({
      where: { folio },
    })
  ) {
    consecutivo += 1;
    folio = `CH-${year}-${String(
      consecutivo,
    ).padStart(4, "0")}`;
  }

  /*
   * HISTORIAL DEL INMUEBLE
   *
   * La numeración de inspecciones pertenece al inmueble, no al cliente.
   * Esto permite conservar una secuencia como:
   * Inspección 01 / V1 -> Inspección 02 / V2 -> Inspección 03 / V3.
   *
   * También se conserva la referencia directa a la inspección anterior.
   */
  const [
    inspeccionAnterior,
    totalInspeccionesDelInmueble,
    maximoNumeroInspeccion,
  ] = await Promise.all([
    prisma.inspeccion.findFirst({
      where: {
        inmuebleId,
      },
      orderBy: [
        {
          fechaProgramada: "desc",
        },
        {
          creadoEn: "desc",
        },
      ],
      select: {
        id: true,
        folio: true,
        numeroInspeccion: true,
      },
    }),
    prisma.inspeccion.count({
      where: {
        inmuebleId,
      },
    }),
    prisma.inspeccion.aggregate({
      where: {
        inmuebleId,
      },
      _max: {
        numeroInspeccion: true,
      },
    }),
  ]);

  /*
   * Usamos tanto el total histórico como el máximo existente.
   *
   * Esto protege la numeración de los expedientes que ya existían antes
   * de incorporar el campo numeroInspeccion y que pudieron quedar con
   * valor inicial 1 por la migración.
   */
  const siguientePorCantidad =
    totalInspeccionesDelInmueble + 1;

  const siguientePorMaximo =
    (maximoNumeroInspeccion._max.numeroInspeccion ?? 0) + 1;

  const numeroInspeccion = Math.max(
    1,
    siguientePorCantidad,
    siguientePorMaximo,
  );

  const inspeccion =
    await prisma.inspeccion.create({
      data: {
        folio,
        clienteId,
        inmuebleId,
        numeroInspeccion,
        inspeccionAnteriorId:
          inspeccionAnterior?.id ?? null,
        inspectorId: inspectorId || null,
        agendadaPorId: session.user.id,
        tipoServicio,
        tipoInmueble: inmueble.tipo,
        direccion: inmueble.direccion,
        ciudad: inmueble.ciudad,
        superficieM2: decimalANumero(
          inmueble.superficieConstruccionM2,
        ),
        fechaProgramada,
        estado: EstadoInspeccion.PROGRAMADA,
        observaciones:
          observaciones || null,
      },
    });

  await registrarAuditoria({
    tipo: TipoEvento.CREAR,
    entidad: "Inspeccion",
    entidadId: inspeccion.id,
    inspeccionId: inspeccion.id,
    usuarioId: session.user.id,
    descripcion:
      `${rol} creó y programó la inspección ${inspeccion.folio} ` +
      `(Inspección No. ${String(numeroInspeccion).padStart(2, "0")} / V${numeroInspeccion})` +
      `${
        inspeccionAnterior
          ? ` como seguimiento de ${inspeccionAnterior.folio}.`
          : " como primera inspección registrada del inmueble."
      }` +
      `${inspectorId ? " Con inspector asignado." : " Sin inspector asignado."}`,
  });

  revalidatePath("/panel");
  revalidatePath("/panel/agenda");
  revalidatePath("/panel/inspecciones");
  revalidatePath("/panel/inmuebles");
  revalidatePath("/portal/inspecciones");

  redirect(
    `/panel/inspecciones/${inspeccion.id}`,
  );
}