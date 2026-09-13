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
};

export function calcularResumenFinancieroCaja({
  importe,
  pagado,
  excepcionApertura = false,
  excepcionInicio = false,
  tieneInspeccion = false,
  fechaAgendada = null,
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
  const agendada = Boolean(fechaAgendada) || tieneInspeccion;

  const estadoPago: EstadoPagoCaja =
    pagadoSeguro <= 0.001 ? "PENDIENTE" : cumpleLiberacion100 ? "PAGADO" : "PARCIAL";

  // Estado operativo: antes de existir agenda/inspección permanece SIN AGENDAR, aunque ya tenga
  // suficiencia financiera. AGENDADA significa que sí existe programación y ya está liberada al 100%.
  let estadoOperativo: EstadoOperativoCotizacion = "SIN_AGENDAR";
  if (agendada && !puedeLiberarCampo) estadoOperativo = "SIN_LIBERAR";
  if (agendada && puedeLiberarCampo) estadoOperativo = "LIBERADA";

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
