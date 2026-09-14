export type LecturaPrueba = {
  clave: string;
  estado: string;
  lecturaInicial: number | null;
  lecturaFinal: number | null;
  unidad: string | null;
};

export type ResultadoPrueba = {
  sistema: "HIDRAULICA" | "GAS";
  disponible: boolean;
  noAplica: boolean;
  lecturaInicial: number | null;
  lecturaFinal: number | null;
  unidad: string | null;
  diferencia: number | null;
  variacionPorcentual: number | null;
  resultado: "SIN_CAIDA_DETECTADA" | "CAIDA_DETECTADA" | "NO_EVALUABLE" | "NO_APLICA";
};

function redondear(valor: number, decimales = 4) {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

export function compararPrueba(
  pasos: LecturaPrueba[],
  sistema: "HIDRAULICA" | "GAS",
): ResultadoPrueba {
  const inicio = pasos.find((paso) => paso.clave === `${sistema}_INICIO`);
  const cierre = pasos.find((paso) => paso.clave === `${sistema}_CIERRE`);

  const noAplica = inicio?.estado === "NO_APLICA" || cierre?.estado === "NO_APLICA";
  if (noAplica) {
    return {
      sistema,
      disponible: true,
      noAplica: true,
      lecturaInicial: null,
      lecturaFinal: null,
      unidad: inicio?.unidad ?? cierre?.unidad ?? null,
      diferencia: null,
      variacionPorcentual: null,
      resultado: "NO_APLICA",
    };
  }

  const lecturaInicial = inicio?.lecturaInicial ?? null;
  const lecturaFinal = cierre?.lecturaFinal ?? null;
  const unidad = cierre?.unidad ?? inicio?.unidad ?? null;

  if (lecturaInicial === null || lecturaFinal === null) {
    return {
      sistema,
      disponible: false,
      noAplica: false,
      lecturaInicial,
      lecturaFinal,
      unidad,
      diferencia: null,
      variacionPorcentual: null,
      resultado: "NO_EVALUABLE",
    };
  }

  const diferencia = redondear(lecturaFinal - lecturaInicial);
  const variacionPorcentual = lecturaInicial === 0
    ? null
    : redondear(((lecturaFinal - lecturaInicial) / lecturaInicial) * 100, 2);

  return {
    sistema,
    disponible: true,
    noAplica: false,
    lecturaInicial,
    lecturaFinal,
    unidad,
    diferencia,
    variacionPorcentual,
    resultado: diferencia < 0 ? "CAIDA_DETECTADA" : "SIN_CAIDA_DETECTADA",
  };
}

export function obtenerResultadosPruebas(pasos: LecturaPrueba[]) {
  return {
    hidraulica: compararPrueba(pasos, "HIDRAULICA"),
    gas: compararPrueba(pasos, "GAS"),
  };
}
