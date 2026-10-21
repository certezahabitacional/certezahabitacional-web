import { EstadoCotizacion, EstadoPago, Prisma, PrismaClient, RolUsuario, TipoEvento } from "@prisma/client";
import { centavosAImporte, ErrorContratoVisita, importeACentavos } from "./visitas-contrato";
import { consultarVinculoVisita } from "./visitas-cotizacion";

export class ErrorOperacionCaja extends Error {
  constructor(message: string) { super(message); this.name = "ErrorOperacionCaja"; }
}

type Contexto = { usuarioId: string; cotizacionId: string };
type Pago = Contexto & { monto: unknown; operacionId: string; referencia?: string | null; metodoPago?: string | null; notas?: string | null };
const opciones = { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5000, timeout: 15000 };

function textoOpcional(valor: string | null | undefined, maximo: number): string | null {
  const texto = valor?.trim() || null;
  if (texto && texto.length > maximo) throw new ErrorOperacionCaja(`El texto excede ${maximo} caracteres.`);
  return texto;
}

async function prepararOperacion(tx: Prisma.TransactionClient, entrada: Contexto, soloDirector = false) {
  const usuario = await tx.usuario.findUnique({ where: { id: entrada.usuarioId }, select: { id: true, activo: true, rol: true, zonaId: true } });
  if (!usuario?.activo || (usuario.rol !== RolUsuario.DIRECTOR && usuario.rol !== RolUsuario.ADMINISTRADOR)) throw new ErrorOperacionCaja("No tienes permiso vigente para operar Caja.");
  if (soloDirector && usuario.rol !== RolUsuario.DIRECTOR) throw new ErrorOperacionCaja("Solo Dirección puede autorizar excepciones de pago.");
  if (!entrada.cotizacionId.trim()) throw new ErrorOperacionCaja("Selecciona una cotización válida.");
  await tx.$queryRaw`SELECT "id" FROM "Cotizacion" WHERE "id" = ${entrada.cotizacionId} FOR UPDATE`;
  const cotizacion = await tx.cotizacion.findUnique({ where: { id: entrada.cotizacionId }, select: {
    id: true, folio: true, estado: true, zonaId: true, total: true, montoPagado: true,
    excepcionApertura: true, excepcionInicio: true, inspeccion: { select: { id: true } },
  } });
  if (!cotizacion) throw new ErrorOperacionCaja("La cotización no existe.");
  if (usuario.rol !== RolUsuario.DIRECTOR && (!usuario.zonaId || usuario.zonaId !== cotizacion.zonaId)) throw new ErrorOperacionCaja("No tienes acceso para operar una cotización de otra zona.");
  if (cotizacion.estado !== EstadoCotizacion.AUTORIZADA) throw new ErrorOperacionCaja("Caja solo permite operar cotizaciones autorizadas y activas.");
  try { await consultarVinculoVisita(tx, cotizacion.id); }
  catch (error) {
    if (error instanceof ErrorContratoVisita) throw new ErrorOperacionCaja(error.message);
    throw error;
  }
  return { usuario, cotizacion };
}

/** Pago, saldo y auditoria son atomicos. Una clave de formulario identifica un abono. */
export async function registrarPagoCaja(db: PrismaClient, entrada: Pago) {
  let centavos: number;
  try { centavos = importeACentavos(entrada.monto); }
  catch { throw new ErrorOperacionCaja("Captura un pago positivo, sin separadores de miles y con hasta dos decimales."); }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entrada.operacionId)) throw new ErrorOperacionCaja("Actualiza Caja antes de registrar el pago; el formulario no tiene una clave válida.");
  const id = `caja-${entrada.operacionId.toLowerCase()}`;
  const monto = new Prisma.Decimal(centavosAImporte(centavos));
  const referencia = textoOpcional(entrada.referencia, 500);
  const metodoPago = textoOpcional(entrada.metodoPago, 100);
  const notas = textoOpcional(entrada.notas, 2000);
  try {
    return await db.$transaction(async tx => {
      const { usuario, cotizacion } = await prepararOperacion(tx, entrada);
      const previo = await tx.pagoCotizacion.findUnique({ where: { id } });
      if (previo) {
        if (previo.cotizacionId !== cotizacion.id || previo.registradoPorId !== usuario.id || !previo.monto.equals(monto) || previo.referencia !== referencia || previo.metodoPago !== metodoPago || previo.notas !== notas) throw new ErrorOperacionCaja("La clave de esta operación ya fue utilizada con otros datos. No se registró otro pago.");
        return { cotizacionId: cotizacion.id, inspeccionId: cotizacion.inspeccion?.id ?? null, pagoId: id, repetido: true };
      }
      const total = importeACentavos(cotizacion.total.toFixed(2));
      const pagado = importeACentavos(cotizacion.montoPagado.toFixed(2), true);
      const nuevoPagado = pagado + centavos;
      if (nuevoPagado > total) throw new ErrorOperacionCaja(`El pago excede el saldo pendiente de $${centavosAImporte(Math.max(0, total - pagado))} MXN.`);
      await tx.pagoCotizacion.create({ data: { id, cotizacionId: cotizacion.id, monto, fechaPago: new Date(), referencia, metodoPago, notas, registradoPorId: usuario.id } });
      await tx.cotizacion.update({ where: { id: cotizacion.id }, data: { montoPagado: new Prisma.Decimal(centavosAImporte(nuevoPagado)), estadoPago: nuevoPagado === total ? EstadoPago.PAGADO : EstadoPago.PARCIAL } });
      await tx.eventoAuditoria.create({ data: { tipo: TipoEvento.EDITAR, entidad: "PagoCotizacion", entidadId: id, usuarioId: usuario.id, descripcion: `${usuario.rol} registró un pago de ${monto.toFixed(2)} MXN en ${cotizacion.folio}. Cotización: ${cotizacion.id}. Operación: ${entrada.operacionId}.` } });
      return { cotizacionId: cotizacion.id, inspeccionId: cotizacion.inspeccion?.id ?? null, pagoId: id, repetido: false };
    }, opciones);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ErrorOperacionCaja("La clave de pago ya fue utilizada. Consulta los movimientos antes de generar otra operación.");
    throw error;
  }
}

export async function autorizarExcepcionCaja(db: PrismaClient, entrada: Contexto & { tipo: "APERTURA" | "INICIO"; motivo: string }) {
  if (entrada.tipo !== "APERTURA" && entrada.tipo !== "INICIO") throw new ErrorOperacionCaja("Tipo de excepción inválido.");
  const motivo = textoOpcional(entrada.motivo, 1000);
  if (!motivo) throw new ErrorOperacionCaja("Registra el motivo de la excepción.");
  return db.$transaction(async tx => {
    const { usuario, cotizacion } = await prepararOperacion(tx, entrada, true);
    const apertura = entrada.tipo === "APERTURA";
    if (apertura ? cotizacion.excepcionApertura : cotizacion.excepcionInicio) return { cotizacionId: cotizacion.id, inspeccionId: cotizacion.inspeccion?.id ?? null, repetido: true };
    const ahora = new Date();
    await tx.cotizacion.update({ where: { id: cotizacion.id }, data: apertura ? {
      excepcionApertura: true, excepcionAperturaPorId: usuario.id, excepcionAperturaEn: ahora, motivoExcepcionApertura: motivo,
    } : {
      excepcionInicio: true, excepcionInicioPorId: usuario.id, excepcionInicioEn: ahora, motivoExcepcionInicio: motivo,
    } });
    if (!apertura && cotizacion.inspeccion) await tx.inspeccion.update({ where: { id: cotizacion.inspeccion.id }, data: {
      inicioLiberadoSinPago: true, inicioLiberadoPorId: usuario.id, inicioLiberadoEn: ahora, motivoLiberacionPago: motivo,
    } });
    await tx.eventoAuditoria.create({ data: { tipo: TipoEvento.EDITAR, entidad: "Cotizacion", entidadId: cotizacion.id, usuarioId: usuario.id, descripcion: `DIRECTOR autorizó excepción ${apertura ? "50% para agendar" : "100% para iniciar"} en ${cotizacion.folio}. Motivo: ${motivo}` } });
    return { cotizacionId: cotizacion.id, inspeccionId: cotizacion.inspeccion?.id ?? null, repetido: false };
  }, opciones);
}
