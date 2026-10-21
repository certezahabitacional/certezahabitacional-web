import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient, RolUsuario, EstadoCotizacion, EstadoInspeccion, TipoEvento } from "@prisma/client";
import { ErrorContratoVisita, folioDeVisita, validarContratacionVisita } from "./visitas-contrato";

type Conexion = Prisma.TransactionClient | PrismaClient;
type Gestor = { id: string; rol: RolUsuario; zonaId: string | null; activo: boolean };
export type VinculoVisita = {
  cotizacionOrigenId: string;
  cotizacionVisitaId: string;
  inspeccionAnteriorId: string;
  numeroVisita: number;
};

export async function esquemaVisitasDisponible(db: Conexion) {
  const filas = await db.$queryRaw<Array<{ existe: boolean }>>`SELECT to_regclass('public."CotizacionVisita"') IS NOT NULL AS existe`;
  return filas[0]?.existe === true;
}

function datosObjeto(datos: Prisma.JsonValue | undefined): Prisma.JsonObject {
  return datos && typeof datos === "object" && !Array.isArray(datos) ? datos : {};
}

/** Null significa cotizacion ordinaria, nunca una visita contratada averiada.
 * Se comprueba la version inicial (el contrato), no una version documental posterior.
 * No modifica registros ni hereda pagos. Los estados de autorizacion/pago se validan
 * por separado; la identidad tambien se puede comprobar sobre expedientes historicos.
 */
export async function consultarVinculoVisita(db: Conexion, cotizacionId: string): Promise<VinculoVisita | null> {
  if (!cotizacionId) return null;
  const cotizacion = await db.cotizacion.findUnique({
    where: { id: cotizacionId },
    select: {
      id: true, folio: true, clienteId: true, inmuebleId: true, zonaId: true,
      versiones: { where: { version: 1 }, select: { datos: true }, take: 1 },
      inspeccion: { select: { numeroInspeccion: true, inspeccionAnteriorId: true } },
    },
  });
  if (!cotizacion) throw new ErrorContratoVisita("La cotizacion seleccionada no existe.");
  const datos = datosObjeto(cotizacion.versiones[0]?.datos);
  const esVisitaContratada = datos.tipoRegistro === "VISITA_CONTRATADA" ||
    datos.cotizacionOrigenId !== undefined || / - V(?:[2-9]|\d{2,})$/i.test(cotizacion.folio);
  if (!await esquemaVisitasDisponible(db)) {
    if (esVisitaContratada) throw new ErrorContratoVisita("No se puede operar esta visita: falta su estructura de seguimiento. V1 y los pagos anteriores no se modificaron.");
    return null; // Compatibilidad con V1 antes de instalar la migracion aditiva.
  }
  const filas = await db.$queryRaw<VinculoVisita[]>`
    SELECT "cotizacionOrigenId", "cotizacionVisitaId", "inspeccionAnteriorId", "numeroVisita"
    FROM "CotizacionVisita" WHERE "cotizacionVisitaId" = ${cotizacionId}`;
  const vinculo = filas[0];
  if (!vinculo) {
    if (esVisitaContratada) throw new ErrorContratoVisita("No se puede operar esta visita: falta el vinculo con la inspeccion anterior. Solicita la revision del expediente.");
    return null;
  }
  const inconsistente = () => new ErrorContratoVisita("No se puede operar esta visita: su numero, cotizacion o antecedente no coincide con el expediente original. Solicita la revision del expediente.");
  if (filas.length !== 1 || vinculo.cotizacionVisitaId !== cotizacion.id ||
      vinculo.cotizacionOrigenId === cotizacion.id || !Number.isInteger(vinculo.numeroVisita) ||
      vinculo.numeroVisita < 2 || vinculo.numeroVisita > 2_147_483_647 ||
      datos.tipoRegistro !== "VISITA_CONTRATADA" || datos.cotizacionOrigenId !== vinculo.cotizacionOrigenId ||
      datos.numeroVisita !== vinculo.numeroVisita || datos.inspeccionAnteriorId !== vinculo.inspeccionAnteriorId) throw inconsistente();
  const [origen, anterior] = await Promise.all([
    db.cotizacion.findUnique({ where: { id: vinculo.cotizacionOrigenId }, select: {
      id: true, folio: true, clienteId: true, inmuebleId: true, zonaId: true,
      inspeccion: { select: { id: true, numeroInspeccion: true } },
    } }),
    db.inspeccion.findUnique({ where: { id: vinculo.inspeccionAnteriorId }, select: {
      id: true, numeroInspeccion: true, clienteId: true, inmuebleId: true, zonaId: true, cotizacionId: true,
    } }),
  ]);
  if (!origen || !anterior || !origen.inmuebleId || !origen.zonaId ||
      origen.inspeccion?.numeroInspeccion !== 1 || datos.folioOrigen !== origen.folio ||
      cotizacion.folio !== folioDeVisita(origen.folio, vinculo.numeroVisita) ||
      cotizacion.clienteId !== origen.clienteId || cotizacion.inmuebleId !== origen.inmuebleId || cotizacion.zonaId !== origen.zonaId ||
      anterior.clienteId !== origen.clienteId || anterior.inmuebleId !== origen.inmuebleId || anterior.zonaId !== origen.zonaId ||
      anterior.numeroInspeccion !== vinculo.numeroVisita - 1 || !anterior.cotizacionId) throw inconsistente();
  if (vinculo.numeroVisita === 2) {
    if (anterior.cotizacionId !== origen.id || anterior.id !== origen.inspeccion.id) throw inconsistente();
  } else {
    const previos = await db.$queryRaw<VinculoVisita[]>`
      SELECT "cotizacionOrigenId", "cotizacionVisitaId", "inspeccionAnteriorId", "numeroVisita"
      FROM "CotizacionVisita" WHERE "cotizacionVisitaId" = ${anterior.cotizacionId}`;
    if (previos.length !== 1 || previos[0].cotizacionOrigenId !== origen.id ||
        previos[0].numeroVisita !== vinculo.numeroVisita - 1) throw inconsistente();
  }
  if (cotizacion.inspeccion && (cotizacion.inspeccion.numeroInspeccion !== vinculo.numeroVisita ||
      cotizacion.inspeccion.inspeccionAnteriorId !== anterior.id)) throw inconsistente();
  return vinculo;
}

function exigirGestor(usuario: Gestor | null): asserts usuario is Gestor {
  if (!usuario?.activo || (usuario.rol !== RolUsuario.DIRECTOR && usuario.rol !== RolUsuario.ADMINISTRADOR)) {
    throw new ErrorContratoVisita("Solo Direccion y Administracion pueden contratar visitas.");
  }
}
function exigirZona(usuario: Gestor, zonaId: string | null) {
  if (usuario.rol !== RolUsuario.DIRECTOR && (!usuario.zonaId || usuario.zonaId !== zonaId)) {
    throw new ErrorContratoVisita("No puedes gestionar visitas de otra zona.");
  }
}

export async function obtenerContextoVisitas(db: Conexion, usuario: Gestor, cotizacionId: string) {
  exigirGestor(usuario);
  if (!await esquemaVisitasDisponible(db)) throw new ErrorContratoVisita("La habilitacion de visitas requiere completar la migracion en desarrollo.");
  const vinculo = await consultarVinculoVisita(db, cotizacionId);
  const origenId = vinculo?.cotizacionOrigenId ?? cotizacionId;
  const origen = await db.cotizacion.findUnique({
    where: { id: origenId },
    include: {
      cliente: { select: { nombre: true } },
      inmueble: { select: { alias: true, direccion: true } },
      versiones: { orderBy: { version: "desc" }, take: 1 },
      inspeccion: { select: { id: true, numeroInspeccion: true } },
    },
  });
  if (!origen) throw new ErrorContratoVisita("La cotizacion de origen no existe.");
  exigirZona(usuario, origen.zonaId);
  if (origen.estado !== EstadoCotizacion.AUTORIZADA || !origen.inmuebleId || !origen.zonaId) {
    throw new ErrorContratoVisita("La cotizacion de origen debe estar autorizada y tener inmueble y zona.");
  }
  if (!origen.inspeccion || origen.inspeccion.numeroInspeccion !== 1) {
    throw new ErrorContratoVisita("Selecciona la cotizacion que origino V1. No se puede crear un seguimiento sin V1.");
  }
  const vinculos = await db.$queryRaw<VinculoVisita[]>`
    SELECT "cotizacionOrigenId", "cotizacionVisitaId", "inspeccionAnteriorId", "numeroVisita"
    FROM "CotizacionVisita" WHERE "cotizacionOrigenId" = ${origenId} ORDER BY "numeroVisita" DESC`;
  const visitas = await db.cotizacion.findMany({
    where: { id: { in: [origenId, ...vinculos.map(v => v.cotizacionVisitaId)] } },
    select: { id: true, folio: true, total: true, montoPagado: true, estado: true, inspeccion: { select: { id: true, numeroInspeccion: true, estado: true } } },
  });
  const ultima = vinculos[0];
  if (ultima) await consultarVinculoVisita(db, ultima.cotizacionVisitaId);
  const registroAnterior = visitas.find(v => v.id === (ultima?.cotizacionVisitaId ?? origenId));
  const antecedente = registroAnterior?.inspeccion ? await db.inspeccion.findUnique({
    where: { id: registroAnterior.inspeccion.id },
    select: {
      id: true, folio: true, numeroInspeccion: true, estado: true, clienteId: true, inmuebleId: true, zonaId: true,
      liberacionBloqueada: true,
      revisiones: { where: { rol: RolUsuario.DIRECTOR, decision: "APROBADO", estado: "VIGENTE" }, select: { id: true }, take: 1 },
      inspeccionesSiguientes: { select: { id: true }, take: 1 },
    },
  }) : null;
  const numeroVisita = (ultima?.numeroVisita ?? 1) + 1;
  let bloqueo: string | null = null;
  if (!antecedente) bloqueo = "La visita anterior todavia no ha sido agendada.";
  else if (antecedente.numeroInspeccion !== numeroVisita - 1) bloqueo = "La numeracion del expediente requiere revision administrativa.";
  else if (antecedente.clienteId !== origen.clienteId || antecedente.inmuebleId !== origen.inmuebleId || antecedente.zonaId !== origen.zonaId) bloqueo = "El antecedente no coincide con el cliente, inmueble o zona de origen.";
  else if (antecedente.estado !== EstadoInspeccion.FINALIZADA || !antecedente.revisiones.length || antecedente.liberacionBloqueada) bloqueo = "La visita anterior debe estar finalizada, autorizada por Direccion y sin bloqueo de liberacion.";
  else if (antecedente.inspeccionesSiguientes.length) bloqueo = "Ya existe un seguimiento de esta inspeccion. Retoma ese expediente; no generes otra cadena.";
  return { origen, vinculos, visitas, antecedente, numeroVisita, bloqueo };
}

/** Registro de cobro separado en Cotizacion; el folio comercial base NO se renumera.
 * Mantiene el modelo financiero existente: todos los pagos y validaciones usan el ID
 * de la visita. CotizacionVisita conserva la familia y el antecedente con FK y unicidad.
 */
export async function contratarVisita(db: PrismaClient, entrada: {
  usuarioId: string; cotizacionId: string; inspeccionAnteriorId: string;
  importeContratado: unknown; motivo: unknown; confirmada: boolean;
}) {
  const contrato = validarContratacionVisita(entrada.importeContratado, entrada.motivo, entrada.confirmada);
  if (!await esquemaVisitasDisponible(db)) throw new ErrorContratoVisita("La habilitacion de visitas requiere completar la migracion en desarrollo.");
  return db.$transaction(async tx => {
    const usuario = await tx.usuario.findUnique({ where: { id: entrada.usuarioId }, select: { id: true, rol: true, zonaId: true, activo: true } });
    exigirGestor(usuario);
    const enlace = await consultarVinculoVisita(tx, entrada.cotizacionId);
    const origenId = enlace?.cotizacionOrigenId ?? entrada.cotizacionId;
    await tx.$queryRaw`SELECT "id" FROM "Cotizacion" WHERE "id" = ${origenId} FOR UPDATE`;
    const origenBasico = await tx.cotizacion.findUnique({ where: { id: origenId }, select: { zonaId: true } });
    if (!origenBasico) throw new ErrorContratoVisita("La cotizacion de origen no existe.");
    exigirZona(usuario, origenBasico.zonaId);
    const repetidas = await tx.$queryRaw<Array<{ cotizacionVisitaId: string; numeroVisita: number }>>`
      SELECT "cotizacionVisitaId", "numeroVisita" FROM "CotizacionVisita"
      WHERE "cotizacionOrigenId" = ${origenId} AND "inspeccionAnteriorId" = ${entrada.inspeccionAnteriorId}`;
    if (repetidas[0]) {
      await consultarVinculoVisita(tx, repetidas[0].cotizacionVisitaId);
      const existente = await tx.cotizacion.findUniqueOrThrow({ where: { id: repetidas[0].cotizacionVisitaId }, select: { id: true, folio: true, total: true } });
      if (!existente.total.equals(contrato.importe)) throw new ErrorContratoVisita("Esta visita ya fue contratada por otro importe. No se modifico el registro existente.");
      return { id: existente.id, folio: existente.folio, numeroVisita: repetidas[0].numeroVisita, yaExistia: true };
    }
    const contexto = await obtenerContextoVisitas(tx, usuario, origenId);
    if (contexto.bloqueo) throw new ErrorContratoVisita(contexto.bloqueo);
    if (!contexto.antecedente || contexto.antecedente.id !== entrada.inspeccionAnteriorId) throw new ErrorContratoVisita("El expediente cambio. Actualiza la pantalla antes de contratar la siguiente visita.");
    const { origen, numeroVisita } = contexto;
    const ahora = new Date();
    const importe = new Prisma.Decimal(contrato.importe);
    const datosOrigen = origen.versiones[0]?.datos;
    const datos: Record<string, Prisma.InputJsonValue | null> = {
      tipoRegistro: "VISITA_CONTRATADA", cotizacionOrigenId: origen.id, folioOrigen: origen.folio,
      numeroVisita, inspeccionAnteriorId: contexto.antecedente.id, importeContratado: contrato.importe,
      alcanceVisita: contrato.motivo,
    };
    if (datosOrigen && typeof datosOrigen === "object" && !Array.isArray(datosOrigen)) {
      for (const clave of ["cliente", "inmueble", "vendedor", "areas", "alcance", "herramientas", "proyectos"]) {
        if (datosOrigen[clave] !== undefined) datos[clave] = datosOrigen[clave];
      }
    }
    const visita = await tx.cotizacion.create({
      data: {
        folio: folioDeVisita(origen.folio, numeroVisita), clienteId: origen.clienteId,
        inmuebleId: origen.inmuebleId, zonaId: origen.zonaId, paqueteId: origen.paqueteId,
        creadaPorId: usuario.id, origenPublico: false, editablePublica: false, versionActual: 1,
        estado: EstadoCotizacion.AUTORIZADA, aceptadaEn: ahora, autorizadaEn: ahora,
        autorizadaPorId: usuario.id, solicitudAutorizacionEn: ahora,
        zonaHoraria: origen.zonaHoraria, superficieM2: origen.superficieM2,
        precioBase: importe, subtotal: importe, total: importe, montoPagado: 0,
        estadoPago: "PENDIENTE", esquemaPago: "DOS_EXHIBICIONES_50_50",
        excepcionApertura: false, excepcionInicio: false,
        notas: `Seguimiento V${numeroVisita} de ${origen.folio}. ${contrato.motivo}`,
        observacionesInternas: `Contratacion de visita confirmada por ${usuario.id}. ${contrato.motivo}`,
        versiones: { create: { version: 1, total: importe, datos } },
      },
      select: { id: true, folio: true },
    });
    await tx.$executeRaw`
      INSERT INTO "CotizacionVisita" ("id", "cotizacionOrigenId", "cotizacionVisitaId", "inspeccionAnteriorId", "numeroVisita", "creadaPorId", "motivo", "creadoEn")
      VALUES (${randomUUID()}, ${origen.id}, ${visita.id}, ${contexto.antecedente.id}, ${numeroVisita}, ${usuario.id}, ${contrato.motivo}, ${ahora})`;
    await tx.eventoAuditoria.createMany({ data: [
      { tipo: TipoEvento.CREAR, entidad: "Cotizacion", entidadId: visita.id, usuarioId: usuario.id, descripcion: `Habilito ${visita.folio} por ${contrato.importe} MXN. Origen ${origen.id}; antecedente ${contexto.antecedente.id}. Sin heredar pagos ni excepciones.` },
      { tipo: TipoEvento.EDITAR, entidad: "Cotizacion", entidadId: visita.id, usuarioId: usuario.id, descripcion: `Aceptacion de contratacion registrada en representacion del cliente para ${visita.folio}. Motivo y respaldo: ${contrato.motivo}` },
      { tipo: TipoEvento.EDITAR, entidad: "Cotizacion", entidadId: visita.id, usuarioId: usuario.id, descripcion: `Autorizacion interna de ${visita.folio} por ${contrato.importe} MXN. No modifica la autorizacion de V1.` },
    ] });
    return { id: visita.id, folio: visita.folio, numeroVisita, yaExistia: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5000, timeout: 15000 });
}
