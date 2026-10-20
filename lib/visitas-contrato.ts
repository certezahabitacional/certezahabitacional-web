/** Reglas monetarias compartidas por formulario y servidor. Nunca usar float para los umbrales. */
export const MAX_CENTAVOS_VISITA = 999_999_999_999;

export class ErrorContratoVisita extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErrorContratoVisita";
  }
}

export function importeACentavos(valor: unknown, permitirCero = false): number {
  if (typeof valor !== "string" || !/^\d{1,10}(?:\.\d{1,2})?$/.test(valor.trim())) {
    throw new ErrorContratoVisita("Captura un importe valido, sin separadores de miles y con hasta dos decimales.");
  }
  const [entero, decimales = ""] = valor.trim().split(".");
  const centavos = Number(BigInt(entero) * BigInt(100) + BigInt(decimales.padEnd(2, "0")));
  if (!Number.isSafeInteger(centavos) || centavos > MAX_CENTAVOS_VISITA || centavos < (permitirCero ? 0 : 1)) {
    throw new ErrorContratoVisita("El importe contratado debe ser mayor a cero y no exceder 9,999,999,999.99.");
  }
  return centavos;
}

export function centavosAImporte(centavos: number): string {
  if (!Number.isSafeInteger(centavos) || centavos < 0 || centavos > MAX_CENTAVOS_VISITA) {
    throw new ErrorContratoVisita("Importe fuera de rango.");
  }
  return `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, "0")}`;
}

export function resumenContratoVisita(importe: string, pagado = "0") {
  const total = importeACentavos(importe);
  const abonos = importeACentavos(pagado, true);
  const anticipo = Math.ceil(total / 2);
  return {
    importeContratado: centavosAImporte(total),
    anticipoMinimo: centavosAImporte(anticipo),
    pagado: centavosAImporte(abonos),
    saldo: centavosAImporte(Math.max(0, total - abonos)),
    puedeAgendar: abonos >= anticipo,
    puedeIniciar: abonos >= total,
    sobrepago: abonos > total,
  };
}

export function folioDeVisita(folioOrigen: string, numeroVisita: number): string {
  if (!folioOrigen.trim() || !Number.isInteger(numeroVisita) || numeroVisita < 2 || numeroVisita > 2_147_483_647) {
    throw new ErrorContratoVisita("El folio de origen y el numero de visita no son validos.");
  }
  return `${folioOrigen.trim()} - V${numeroVisita}`;
}

export function validarContratacionVisita(importe: unknown, motivo: unknown, confirmada: boolean) {
  const centavos = importeACentavos(importe);
  if (typeof motivo !== "string" || motivo.trim().length < 5 || motivo.trim().length > 1000) {
    throw new ErrorContratoVisita("Describe el alcance y el antecedente de contratacion de la visita (5 a 1000 caracteres).");
  }
  if (!confirmada) throw new ErrorContratoVisita("Confirma la contratacion de esta visita por el importe indicado.");
  return { importe: centavosAImporte(centavos), motivo: motivo.trim() };
}
