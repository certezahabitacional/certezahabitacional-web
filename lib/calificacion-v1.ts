import { PrioridadHallazgo } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const PESOS_PRIORIDAD_V1: Record<PrioridadHallazgo, number> = {
  P1: 35,
  P2: 18,
  P3: 8,
  P4: 3,
  P5: 1,
};

export type ResumenPrioridadesV1 = Record<PrioridadHallazgo, number>;

export function calcularCargaSeveridadV1(prioridades: PrioridadHallazgo[]) {
  return prioridades.reduce((total, prioridad) => total + PESOS_PRIORIDAD_V1[prioridad], 0);
}

/**
 * Calificacion Tecnica Certeza V1.
 *
 * Formula aprobada:
 *   100 * 100 / (100 + carga de severidad)
 *
 * La cobertura se calcula y se comunica por separado. NO_APLICA se excluye
 * del denominador de cobertura y los puntos CON_HALLAZGO cuentan como
 * revisados, igual que REVISADO.
 */
export function calcularCalificacionTecnicaV1(prioridades: PrioridadHallazgo[]) {
  const cargaSeveridad = calcularCargaSeveridadV1(prioridades);
  const calificacion = 10000 / (100 + cargaSeveridad);
  return Math.round(calificacion * 100) / 100;
}

export function semaforoTecnicoV1(calificacion: number) {
  if (calificacion >= 90) return "VERDE";
  if (calificacion >= 75) return "AMARILLO";
  if (calificacion >= 60) return "NARANJA";
  return "ROJO";
}

export function dictamenTecnicoV1(calificacion: number, resumen: ResumenPrioridadesV1) {
  const p1 = resumen.P1;
  const p2 = resumen.P2;

  if (p1 === 0 && p2 === 0 && calificacion >= 90) {
    return "La inspeccion presenta una condicion tecnica favorable dentro del alcance revisado. Los detalles de menor prioridad, si existen, deben atenderse conforme a las recomendaciones del reporte.";
  }
  if (p1 === 0 && calificacion >= 75) {
    return "La inspeccion presenta condiciones tecnicas mayormente favorables, con hallazgos que requieren correccion o seguimiento conforme a su prioridad y a las recomendaciones del reporte.";
  }
  if (p1 > 0) {
    return "La inspeccion identifico uno o mas hallazgos de prioridad P1. Se recomienda atenderlos con caracter prioritario y revisar las recomendaciones tecnicas antes de tomar decisiones sobre recepcion, uso o correccion del inmueble.";
  }
  return "La inspeccion identifico hallazgos relevantes que requieren acciones correctivas y seguimiento. Consulte la prioridad de cada hallazgo y las recomendaciones tecnicas del reporte.";
}

type ConteoPuntos = {
  definidos: number;
  noAplica: number;
  aplicables: number;
  revisados: number;
};

type ConteoAreas = {
  total: number;
  sinHallazgos: number;
};

export async function obtenerMetricasV1(inspeccionId: string) {
  const [conteoPuntos] = await prisma.$queryRaw<ConteoPuntos[]>`
    SELECT
      COUNT(*)::int AS "definidos",
      COUNT(*) FILTER (WHERE "estadoV3" = 'NO_APLICA')::int AS "noAplica",
      COUNT(*) FILTER (WHERE "estadoV3" <> 'NO_APLICA')::int AS "aplicables",
      COUNT(*) FILTER (WHERE "estadoV3" IN ('REVISADO','CON_HALLAZGO'))::int AS "revisados"
    FROM "GuiaInspeccionItem"
    WHERE "inspeccionId" = ${inspeccionId}
  `;

  const [conteoAreas] = await prisma.$queryRaw<ConteoAreas[]>`
    SELECT
      COUNT(*) FILTER (WHERE "obligatoria" = true)::int AS "total",
      COUNT(*) FILTER (WHERE "obligatoria" = true AND "resultado" = 'SIN_HALLAZGOS')::int AS "sinHallazgos"
    FROM "AreaInspeccion"
    WHERE "inspeccionId" = ${inspeccionId}
  `;

  const grupos = await prisma.hallazgo.groupBy({
    by: ["prioridad"],
    where: { inspeccionId },
    _count: { _all: true },
  });

  const resumenPrioridades: ResumenPrioridadesV1 = {
    P1: 0,
    P2: 0,
    P3: 0,
    P4: 0,
    P5: 0,
  };

  const prioridades: PrioridadHallazgo[] = [];
  for (const grupo of grupos) {
    const total = grupo._count._all;
    resumenPrioridades[grupo.prioridad] = total;
    for (let i = 0; i < total; i += 1) prioridades.push(grupo.prioridad);
  }

  const definidos = Number(conteoPuntos?.definidos ?? 0);
  const noAplica = Number(conteoPuntos?.noAplica ?? 0);
  const aplicables = Number(conteoPuntos?.aplicables ?? 0);
  const revisados = Number(conteoPuntos?.revisados ?? 0);
  const cobertura = aplicables > 0 ? Math.round((revisados / aplicables) * 10000) / 100 : 0;
  const cargaSeveridad = calcularCargaSeveridadV1(prioridades);
  const calificacion = calcularCalificacionTecnicaV1(prioridades);

  return {
    definidos,
    noAplica,
    aplicables,
    revisados,
    cobertura,
    areas: Number(conteoAreas?.total ?? 0),
    areasSinHallazgos: Number(conteoAreas?.sinHallazgos ?? 0),
    resumenPrioridades,
    totalHallazgos: prioridades.length,
    cargaSeveridad,
    calificacion,
    semaforo: semaforoTecnicoV1(calificacion),
    dictamen: dictamenTecnicoV1(calificacion, resumenPrioridades),
  };
}
