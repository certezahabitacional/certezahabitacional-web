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

export async function consultarVinculoVisita(db: Conexion, cotizacionId: string): Promise<VinculoVisita | null> {
  if (!cotizacionId || !await esquemaVisitasDisponible(db)) return null;
  const filas = await db.$queryRaw<VinculoVisita[]>`
    SELECT "cotizacionOrigenId", "cotizacionVisitaId", "inspeccionAnteriorId", "numeroVisita"
    FROM "CotizacionVisita" WHERE "cotizacionVisitaId" = ${cotizacionId}`;
  return filas[0] ?? null;
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
    // Un unico candado por expediente serializa las activaciones concurrentes.
    await tx.$queryRaw`SELECT "id" FROM "Cotizacion" WHERE "id" = ${origenId} FOR UPDATE`;
    const origenBasico = await tx.cotizacion.findUnique({ where: { id: origenId }, select: { zonaId: true } });
    if (!origenBasico) throw new ErrorContratoVisita("La cotizacion de origen no existe.");
    exigirZona(usuario, origenBasico.zonaId);
    const repetidas = await tx.$queryRaw<Array<{ cotizacionVisitaId: string; numeroVisita: number }>>`
      SELECT "cotizacionVisitaId", "numeroVisita" FROM "CotizacionVisita"
      WHERE "cotizacionOrigenId" = ${origenId} AND "inspeccionAnteriorId" = ${entrada.inspeccionAnteriorId}`;
    if (repetidas[0]) {
      const existente = await tx.cotizacion.findUniqueOrThrow({ where: { id: repetidas[0].cotizacionVisitaId }, select: { id: true, folio: true, total: true } });
      if (!existente.total.equals(contrato.importe)) throw new ErrorContratoVisita("Esta visita ya fue contratada por otro importe. No se modifico el registro existente.");
      return { id: existente.id, folio: existente.folio, numeroVisita: repetidas[0].numeroVisita, yaExistia: true };
    }
    const contexto = await obtenerContextoVisitas(tx, usuario, origenId);
    if (contexto.bloqueo) throw new ErrorContratoVisita(contexto.bloqueo);
    if (!contexto.antecedente || contexto.antecedente.id !== entrada.inspeccionAnteriorId) {
      throw new ErrorContratoVisita("El expediente cambio. Actualiza la pantalla antes de contratar la siguiente visita.");
    }
    const { origen, numeroVisita } = contexto;
    const ahora = new Date();
    const importe = new Prisma.Decimal(contrato.importe);
    const datosOrigen = origen.versiones[0]?.datos;
    const datos: Record<string, Prisma.InputJsonValue | null> = {
      tipoRegistro: "VISITA_CONTRATADA", cotizacionOrigenId: origen.id, folioOrigen: origen.folio,
      numeroVisita, inspeccionAnteriorId: contexto.antecedente.id, importeContratado: contrato.importe,
      alcanceVisita: contrato.motivo,
    };
    // Solo datos tecnicos y descriptivos. No copiar aceptaciones, autorizaciones,
    // importes, pagos, excepciones ni el estado de una revision documental anterior.
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
