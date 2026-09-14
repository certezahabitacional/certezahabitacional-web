export type EstadoOperativoCotizacion =
  | "SIN_AGENDAR"
  | "AGENDADA"
  | "SIN_LIBERAR"
  | "LIBERADA";

export type EstadoPagoCaja = "PENDIENTE" | "PARCIAL" | "PAGADO";

export type ResumenFinancieroCaja = {
  importe: number;
  pagado: number;
  saldo: number;
  porcentajePagado: number;
  estadoPago: EstadoPagoCaja;
  cumpleApertura50: boolean;
  cumpleLiberacion100: boolean;
  aperturaPorExcepcion: boolean;
  liberacionPorExcepcion: boolean;
  puedeAgendar: boolean;
  puedeLiberarCampo: boolean;
  estadoOperativo: EstadoOperativoCotizacion;
  alertaSobrepago: boolean;
};

type EntradaFinancieraCaja = {
  importe: number;
  pagado: number;
  excepcionApertura?: boolean;
  excepcionInicio?: boolean;
  tieneInspeccion?: boolean;
  fechaAgendada?: Date | string | null;
  ahora?: Date | string;
};

function fechaValida(valor: Date | string | null | undefined): Date | null {
  if (!valor) return null;
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function calcularResumenFinancieroCaja({
  importe,
  pagado,
  excepcionApertura = false,
  excepcionInicio = false,
  tieneInspeccion = false,
  fechaAgendada = null,
  ahora = new Date(),
}: EntradaFinancieraCaja): ResumenFinancieroCaja {
  const totalSeguro = Math.max(0, Number.isFinite(importe) ? importe : 0);
  const pagadoSeguro = Math.max(0, Number.isFinite(pagado) ? pagado : 0);
  const saldo = Math.max(0, totalSeguro - pagadoSeguro);
  const porcentajePagado = totalSeguro > 0 ? (pagadoSeguro / totalSeguro) * 100 : 0;
  const cumpleApertura50 = totalSeguro > 0 && pagadoSeguro + 0.001 >= totalSeguro * 0.5;
  const cumpleLiberacion100 = totalSeguro > 0 && pagadoSeguro + 0.001 >= totalSeguro;
  const aperturaPorExcepcion = !cumpleApertura50 && excepcionApertura;
  const liberacionPorExcepcion = !cumpleLiberacion100 && excepcionInicio;
  const puedeAgendar = cumpleApertura50 || excepcionApertura;
  const puedeLiberarCampo = cumpleLiberacion100 || excepcionInicio;

  const fechaAgenda = fechaValida(fechaAgendada);
  const fechaReferencia = fechaValida(ahora) ?? new Date();
  const existeAgenda = Boolean(tieneInspeccion || fechaAgenda);

  const estadoPago: EstadoPagoCaja =
    pagadoSeguro <= 0.001 ? "PENDIENTE" : cumpleLiberacion100 ? "PAGADO" : "PARCIAL";

  /*
   * Estado operativo visible en COTIZACIONES:
   * - SIN_AGENDAR: todavía no existe una inspección/fecha programada.
   * - AGENDADA: ya existe agenda y la fecha aún es futura, pero todavía no está liberada al 100%.
   * - SIN_LIBERAR: la fecha programada llegó o venció y Caja todavía no autoriza el inicio.
   * - LIBERADA: Caja autoriza el inicio por 100% pagado o por excepción vigente.
   *
   * Con esto el estado no se captura manualmente: se deriva de Caja + Agenda.
   */
  let estadoOperativo: EstadoOperativoCotizacion = "SIN_AGENDAR";
  if (existeAgenda && puedeLiberarCampo) {
    estadoOperativo = "LIBERADA";
  } else if (existeAgenda && fechaAgenda && fechaAgenda.getTime() > fechaReferencia.getTime()) {
    estadoOperativo = "AGENDADA";
  } else if (existeAgenda) {
    estadoOperativo = "SIN_LIBERAR";
  }

  return {
    importe: totalSeguro,
    pagado: pagadoSeguro,
    saldo,
    porcentajePagado,
    estadoPago,
    cumpleApertura50,
    cumpleLiberacion100,
    aperturaPorExcepcion,
    liberacionPorExcepcion,
    puedeAgendar,
    puedeLiberarCampo,
    estadoOperativo,
    alertaSobrepago: pagadoSeguro > totalSeguro + 0.001,
  };
}
