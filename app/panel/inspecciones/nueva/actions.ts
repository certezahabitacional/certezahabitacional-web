

import {
  EsquemaPago,
  EstadoCotizacion,
  EstadoInspeccion,
  EstadoPago,
  RolUsuario,
  TipoEvento,
} from "@prisma/client";
import { fromZonedTime } from "date-fns-tz";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

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

function errorNuevaInspeccion(
  mensaje: string,
  antecedenteId?: string,
): never {
  const parametros = new URLSearchParams({
    error: mensaje,
  });

  if (antecedenteId) {
    parametros.set("antecedenteId", antecedenteId);
  }

  redirect(
    `/panel/inspecciones/nueva?${parametros.toString()}`,
  );
}

export async function crearInspeccion(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  /*
   * La base de datos es la fuente de verdad para el rol y el alcance.
   * Solo GERENTE y DIRECTOR pueden crear/programar inspecciones.
   */
  const usuarioActual = await prisma.usuario.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      nombre: true,
      rol: true,
      activo: true,
      zonaId: true,
      zona: {
        select: {
          id: true,
          nombre: true,
          codigo: true,
          zonaHoraria: true,
          activa: true,
        },
      },
    },
  });

  if (!usuarioActual || !usuarioActual.activo) {
    redirect("/acceso");
  }

  const rol = usuarioActual.rol;

  if (
    rol !== RolUsuario.GERENTE &&
    rol !== RolUsuario.DIRECTOR
  ) {
    redirect("/acceso");
  }

  if (
    rol === RolUsuario.GERENTE &&
    (!usuarioActual.zonaId ||
      !usuarioActual.zona ||
      !usuarioActual.zona.activa)
  ) {
    errorNuevaInspeccion(
      "La Gerencia no tiene una zona activa asignada.",
    );
  }

  const antecedenteId = texto(
    formData,
    "antecedenteId",
  );
  const clienteId = texto(formData, "clienteId");
  const inmuebleId = texto(formData, "inmuebleId");
  const inspectorId = texto(
    formData,
    "inspectorId",
  );
  const tipoServicio = texto(
    formData,
    "tipoServicio",
  );
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
      antecedenteId || undefined,
    );
  }

  const tiposServicioPermitidos = new Set([
    "ENTREGA",
    "GARANTIA",
    "USADA",
    "PREVENTIVA",
    "DICTAMEN",
  ]);

  if (!tiposServicioPermitidos.has(tipoServicio)) {
    errorNuevaInspeccion(
      "El tipo de inspección seleccionado no es válido.",
      antecedenteId || undefined,
    );
  }

  const inmueble =
    await prisma.inmueble.findUnique({
      where: {
        id: inmuebleId,
      },
      select: {
        id: true,
        clienteId: true,
        alias: true,
        tipo: true,
        direccion: true,
        ciudad: true,
        estado: true,
        superficieConstruccionM2: true,
      },
    });

  if (
    !inmueble ||
    inmueble.clienteId !== clienteId
  ) {
    errorNuevaInspeccion(
      "El inmueble no corresponde al cliente.",
      antecedenteId || undefined,
    );
  }

  /*
   * Determinación de la zona.
   *
   * GERENTE:
   *   siempre opera dentro de su zona.
   *
   * DIRECTOR:
   *   - en V2/V3/V4 conserva la zona del antecedente;
   *   - si asigna Inspector, puede tomar la zona de ese Inspector;
   *   - si crea V1 sin Inspector, intenta resolver una zona activa
   *     por la ciudad del inmueble.
   */
  let zonaId: string | null = null;
  let zonaHoraria = "America/Ciudad_Juarez";

  let inspeccionAnterior: {
    id: string;
    folio: string;
    numeroInspeccion: number;
    zonaId: string | null;
  } | null = null;

  let numeroInspeccion = 1;

  if (antecedenteId) {
    const antecedente =
      await prisma.inspeccion.findUnique({
        where: {
          id: antecedenteId,
        },
        select: {
          id: true,
          folio: true,
          estado: true,
          clienteId: true,
          inmuebleId: true,
          numeroInspeccion: true,
          zonaId: true,
          zonaHoraria: true,
          inspector: {
            select: {
              usuario: {
                select: {
                  zonaId: true,
                  gerenteId: true,
                },
              },
            },
          },
        },
      });

    if (!antecedente) {
      errorNuevaInspeccion(
        "La inspección antecedente no existe.",
      );
    }

    if (
      antecedente.estado !==
      EstadoInspeccion.FINALIZADA
    ) {
      errorNuevaInspeccion(
        "Solo una inspección FINALIZADA puede generar una nueva inspección de seguimiento.",
        antecedente.id,
      );
    }

    if (
      antecedente.clienteId !== clienteId ||
      antecedente.inmuebleId !== inmuebleId
    ) {
      errorNuevaInspeccion(
        "El cliente o inmueble no coincide con la inspección antecedente.",
        antecedente.id,
      );
    }

    zonaId =
      antecedente.zonaId ??
      antecedente.inspector?.usuario.zonaId ??
      null;

    zonaHoraria =
      antecedente.zonaHoraria ||
      zonaHoraria;

    if (
      rol === RolUsuario.GERENTE &&
      antecedente.inspector?.usuario.gerenteId !== usuarioActual.id
    ) {
      errorNuevaInspeccion(
        "La inspección antecedente no pertenece a esta Gerencia.",
        antecedente.id,
      );
    }

    const ultimaInspeccion =
      await prisma.inspeccion.findFirst({
        where: {
          inmuebleId,
        },
        orderBy: [
          {
            numeroInspeccion: "desc",
          },
          {
            fechaProgramada: "desc",
          },
          {
            creadoEn: "desc",
          },
        ],
        select: {
          id: true,
          numeroInspeccion: true,
        },
      });

    if (
      !ultimaInspeccion ||
      ultimaInspeccion.id !== antecedente.id
    ) {
      errorNuevaInspeccion(
        "La inspección seleccionada ya no es la última versión del inmueble. Abre la versión más reciente para crear el siguiente seguimiento.",
        antecedente.id,
      );
    }

    const seguimientoExistente =
      await prisma.inspeccion.findFirst({
        where: {
          inspeccionAnteriorId: antecedente.id,
        },
        select: {
          id: true,
          folio: true,
          numeroInspeccion: true,
        },
      });

    if (seguimientoExistente) {
      redirect(
        `/panel/inspecciones/${seguimientoExistente.id}?ok=${encodeURIComponent(
          `Ya existe la inspección de seguimiento V${seguimientoExistente.numeroInspeccion} (${seguimientoExistente.folio}).`,
        )}`,
      );
    }

    inspeccionAnterior = {
      id: antecedente.id,
      folio: antecedente.folio,
      numeroInspeccion:
        antecedente.numeroInspeccion,
      zonaId,
    };

    numeroInspeccion =
      antecedente.numeroInspeccion + 1;
  }

  if (
    rol === RolUsuario.GERENTE &&
    !inspectorId
  ) {
    errorNuevaInspeccion(
      "Gerencia debe seleccionar un Inspector adscrito a su Gerencia para programar la inspección.",
      antecedenteId || undefined,
    );
  }

  /*
   * Validación del Inspector y su adscripción.
   */
  let inspectorSeleccionado: {
    id: string;
    usuario: {
      id: string;
      nombre: string;
      zonaId: string | null;
      gerenteId: string | null;
      zona: {
        id: string;
        nombre: string;
        codigo: string;
        zonaHoraria: string;
        activa: boolean;
      } | null;
    };
  } | null = null;

  if (inspectorId) {
    inspectorSeleccionado =
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
          usuario: {
            select: {
              id: true,
              nombre: true,
              zonaId: true,
              gerenteId: true,
              zona: {
                select: {
                  id: true,
                  nombre: true,
                  codigo: true,
                  zonaHoraria: true,
                  activa: true,
                },
              },
            },
          },
        },
      });

    if (!inspectorSeleccionado) {
      errorNuevaInspeccion(
        "El Inspector seleccionado no está disponible.",
        antecedenteId || undefined,
      );
    }

    if (
      !inspectorSeleccionado.usuario.zonaId ||
      !inspectorSeleccionado.usuario.zona ||
      !inspectorSeleccionado.usuario.zona.activa
    ) {
      errorNuevaInspeccion(
        "El Inspector seleccionado no tiene una zona activa asignada.",
        antecedenteId || undefined,
      );
    }

    if (
      rol === RolUsuario.GERENTE &&
      inspectorSeleccionado.usuario.gerenteId !== usuarioActual.id
    ) {
      errorNuevaInspeccion(
        "Gerencia solo puede asignar Inspectores adscritos a su propia Gerencia.",
        antecedenteId || undefined,
      );
    }

    if (
      zonaId &&
      inspectorSeleccionado.usuario.zonaId !==
        zonaId
    ) {
      errorNuevaInspeccion(
        "El Inspector seleccionado no pertenece a la zona de la inspección.",
        antecedenteId || undefined,
      );
    }

    if (!zonaId) {
      zonaId =
        inspectorSeleccionado.usuario.zonaId;
      zonaHoraria =
        inspectorSeleccionado.usuario.zona
          .zonaHoraria;
    }
  }

  /*
   * Si Dirección crea una V1 sin Inspector asignado, intentamos
   * resolver la zona por la ciudad del inmueble. Si no existe una
   * coincidencia inequívoca, se bloquea la creación en vez de
   * generar una inspección sin alcance territorial.
   */
  if (
    rol === RolUsuario.DIRECTOR &&
    !zonaId
  ) {
    const zonasCoincidentes =
      await prisma.zona.findMany({
        where: {
          activa: true,
          ciudad: {
            equals: inmueble.ciudad,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          nombre: true,
          codigo: true,
          zonaHoraria: true,
        },
        take: 2,
      });

    if (zonasCoincidentes.length !== 1) {
      errorNuevaInspeccion(
        "No fue posible determinar de forma única la zona de la inspección. Asigna un Inspector de la zona correspondiente antes de crearla.",
        antecedenteId || undefined,
      );
    }

    zonaId = zonasCoincidentes[0].id;
    zonaHoraria =
      zonasCoincidentes[0].zonaHoraria;
  }

  if (!zonaId) {
    errorNuevaInspeccion(
      "No fue posible determinar la zona de la inspección.",
      antecedenteId || undefined,
    );
  }

  /*
   * Puerta administrativa.
   *
   * Con el esquema actual, la evidencia disponible para acreditar
   * la liberación comercial previa es una cotización ACEPTADA,
   * correspondiente al mismo cliente/inmueble y que todavía no
   * esté vinculada a otra inspección.
   *
   * Esto impide que Gerencia cree V1/V2/V3/V4 sin una cotización
   * previamente procesada por Administración y aceptada por el Cliente.
   */
  const cotizacionDisponible =
    await prisma.cotizacion.findFirst({
      where: {
        clienteId,
        inmuebleId,
        estado: EstadoCotizacion.ACEPTADA,
        inspeccion: null,
      },
      orderBy: {
        creadoEn: "desc",
      },
      select: {
        id: true,
        folio: true,
        estado: true,
        estadoPago: true,
        esquemaPago: true,
        montoPagado: true,
        total: true,
      },
    });

  if (!cotizacionDisponible) {
    errorNuevaInspeccion(
      antecedenteId
        ? "No existe una cotización ACEPTADA y disponible para crear esta inspección de seguimiento. Administración debe completar primero el proceso correspondiente."
        : "No existe una cotización ACEPTADA y disponible para crear esta inspección. Administración debe completar primero el proceso correspondiente.",
      antecedenteId || undefined,
    );
  }

  /*
   * Condición administrativa de pago para programar:
   *
   * UNA_EXHIBICION:
   *   requiere pago total (PAGADO).
   *
   * DOS_EXHIBICIONES_50_50:
   *   puede programarse después del primer 50% (PARCIAL)
   *   o cuando ya se encuentre liquidada al 100% (PAGADO).
   */
  const cumpleCondicionPago =
    (
      cotizacionDisponible.esquemaPago ===
        EsquemaPago.UNA_EXHIBICION &&
      cotizacionDisponible.estadoPago ===
        EstadoPago.PAGADO
    ) ||
    (
      cotizacionDisponible.esquemaPago ===
        EsquemaPago.DOS_EXHIBICIONES_50_50 &&
      (
        cotizacionDisponible.estadoPago ===
          EstadoPago.PARCIAL ||
        cotizacionDisponible.estadoPago ===
          EstadoPago.PAGADO
      )
    );

  if (!cumpleCondicionPago) {
    const mensajePago =
      cotizacionDisponible.esquemaPago ===
        EsquemaPago.DOS_EXHIBICIONES_50_50
        ? "La cotización debe tener registrado al menos el primer 50% antes de que Gerencia o Dirección puedan programar la inspección."
        : "La cotización debe estar pagada al 100% antes de que Gerencia o Dirección puedan programar la inspección.";

    errorNuevaInspeccion(
      mensajePago,
      antecedenteId || undefined,
    );
  }

  /*
   * La fecha/hora local capturada se convierte usando la zona
   * horaria real de la inspección.
   */
  const fechaProgramada = fromZonedTime(
    fechaProgramadaTexto,
    zonaHoraria,
  );

  if (
    Number.isNaN(fechaProgramada.getTime())
  ) {
    errorNuevaInspeccion(
      "Selecciona una fecha y hora válidas.",
      antecedenteId || undefined,
    );
  }

  /*
   * Para V1 calculamos la secuencia histórica del inmueble.
   * Para V2/V3/V4 ya quedó establecida arriba a partir del antecedente.
   */
  if (!antecedenteId) {
    const [
      ultimaInspeccion,
      totalInspeccionesDelInmueble,
      maximoNumeroInspeccion,
    ] = await Promise.all([
      prisma.inspeccion.findFirst({
        where: {
          inmuebleId,
        },
        orderBy: [
          {
            numeroInspeccion: "desc",
          },
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
          zonaId: true,
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
     * Si ya existe historial, una nueva inspección del mismo inmueble
     * debe continuar esa cadena en lugar de reiniciar V1.
     */
    inspeccionAnterior =
      ultimaInspeccion
        ? {
            id: ultimaInspeccion.id,
            folio: ultimaInspeccion.folio,
            numeroInspeccion:
              ultimaInspeccion.numeroInspeccion,
            zonaId:
              ultimaInspeccion.zonaId,
          }
        : null;

    if (
      inspeccionAnterior?.zonaId &&
      inspeccionAnterior.zonaId !== zonaId
    ) {
      errorNuevaInspeccion(
        "El inmueble ya tiene historial en una zona distinta. Revisa la adscripción antes de continuar.",
      );
    }

    const siguientePorCantidad =
      totalInspeccionesDelInmueble + 1;

    const siguientePorMaximo =
      (maximoNumeroInspeccion._max
        .numeroInspeccion ?? 0) + 1;

    numeroInspeccion = Math.max(
      1,
      siguientePorCantidad,
      siguientePorMaximo,
    );
  }

  /*
   * Folio anual.
   */
  const year = fechaProgramada.getFullYear();
  const inicioYear = new Date(
    Date.UTC(year, 0, 1),
  );
  const inicioSiguienteYear = new Date(
    Date.UTC(year + 1, 0, 1),
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
      where: {
        folio,
      },
      select: {
        id: true,
      },
    })
  ) {
    consecutivo += 1;
    folio = `CH-${year}-${String(
      consecutivo,
    ).padStart(4, "0")}`;
  }

  const inspeccion =
    await prisma.inspeccion.create({
      data: {
        folio,
        zonaId,
        clienteId,
        inmuebleId,
        cotizacionId:
          cotizacionDisponible.id,
        numeroInspeccion,
        inspeccionAnteriorId:
          inspeccionAnterior?.id ?? null,
        inspectorId:
          inspectorSeleccionado?.id ?? null,
        agendadaPorId: session.user.id,
        tipoServicio,
        tipoInmueble: inmueble.tipo,
        direccion: inmueble.direccion,
        ciudad: inmueble.ciudad,
        superficieM2: decimalANumero(
          inmueble.superficieConstruccionM2,
        ),
        fechaProgramada,
        zonaHoraria,
        estado:
          EstadoInspeccion.PROGRAMADA,
        observaciones:
          observaciones || null,
      },
      select: {
        id: true,
        folio: true,
        numeroInspeccion: true,
        zona: {
          select: {
            nombre: true,
            codigo: true,
          },
        },
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
      `(Inspección No. ${String(
        numeroInspeccion,
      ).padStart(2, "0")} / V${numeroInspeccion}) ` +
      `en ${inspeccion.zona?.nombre ?? "zona sin nombre"} ` +
      `con cotización ${cotizacionDisponible.folio}` +
      `${
        inspeccionAnterior
          ? ` como seguimiento de ${inspeccionAnterior.folio}.`
          : " como primera inspección registrada del inmueble."
      }` +
      `${
        inspectorSeleccionado
          ? ` Inspector asignado: ${inspectorSeleccionado.usuario.nombre}.`
          : " Sin Inspector asignado."
      }`,
  });

  revalidatePath("/panel");
  revalidatePath("/panel/agenda");
  revalidatePath(
    "/panel/inspecciones",
  );
  revalidatePath("/panel/inmuebles");
  revalidatePath(
    "/portal/inspecciones",
  );

  if (inspeccionAnterior) {
    revalidatePath(
      `/panel/inspecciones/${inspeccionAnterior.id}`,
    );
  }

  revalidatePath(
    `/panel/inspecciones/${inspeccion.id}`,
  );

  redirect(
    `/panel/inspecciones/${inspeccion.id}?ok=${encodeURIComponent(
      inspeccionAnterior
        ? `Inspección de seguimiento V${numeroInspeccion} creada correctamente.`
        : "Inspección creada correctamente.",
    )}`,
  );
}
