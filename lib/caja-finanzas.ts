export type EstadoOperativoCotizacion =
  | "SIN_AGENDAR"
  | "AGENDADA"
  | "SIN_LIBERAR"
  | "LIBERADA";

export type ResumenFinancieroCaja = {
  importe: number;
  pagado: number;
  saldo: number;
  porcentajePagado: number;
  cumpleApertura50: boolean;
  cumpleLiberacion100: boolean;
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
  const puedeAgendar = cumpleApertura50 || excepcionApertura;
  const puedeLiberarCampo = cumpleLiberacion100 || excepcionInicio;
  const agendada = Boolean(fechaAgendada) || tieneInspeccion;

  let estadoOperativo: EstadoOperativoCotizacion = "SIN_AGENDAR";
  if (agendada && !puedeLiberarCampo) estadoOperativo = "SIN_LIBERAR";
  if (agendada && puedeLiberarCampo) estadoOperativo = "LIBERADA";
  if (!agendada && puedeAgendar) estadoOperativo = "AGENDADA";

  return {
    importe: totalSeguro,
    pagado: pagadoSeguro,
    saldo,
    porcentajePagado,
    cumpleApertura50,
    cumpleLiberacion100,
    puedeAgendar,
    puedeLiberarCampo,
    estadoOperativo,
    alertaSobrepago: pagadoSeguro > totalSeguro + 0.001,
  };
}
