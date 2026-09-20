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
export type NivelEvaluacionV1 = "P1" | "P2" | "P3" | "P4" | "P5" | "SH";

export function nivelEvaluacionV1(calificacion: number): NivelEvaluacionV1 {
  if (calificacion >= 100) return "SH";
  if (calificacion >= 90) return "P5";
  if (calificacion >= 80) return "P4";
  if (calificacion >= 70) return "P3";
  if (calificacion >= 50) return "P2";
  return "P1";
}

export function calcularCargaSeveridadV1(prioridades: PrioridadHallazgo[]) {
  return prioridades.reduce((total, prioridad) => total + PESOS_PRIORIDAD_V1[prioridad], 0);
}

/**
 * Calificacion Tecnica Certeza V1.
 *
 * Formula transitoria vigente mientras se incorpora calificacion individual
 * por concepto al modelo de datos:
 *   100 * 100 / (100 + carga de severidad)
 *
 * IMPORTANTE:
 * La escala P1/P2/P3/P4/P5/SH ya queda normalizada:
 * P1 0-49, P2 50-69, P3 70-79, P4 80-89, P5 90-99, SH 100.
 *
 * Cuando el modelo guarde calificacion final por concepto, esta funcion debera
 * sustituirse por el promedio de conceptos evaluables, excluyendo NO_APLICA.
 */
export function calcularCalificacionTecnicaV1(prioridades: PrioridadHallazgo[]) {
  const cargaSeveridad = calcularCargaSeveridadV1(prioridades);
  const calificacion = 10000 / (100 + cargaSeveridad);
  return Math.round(calificacion * 100) / 100;
}

export function semaforoTecnicoV1(calificacion: number) {
  const nivel = nivelEvaluacionV1(calificacion);
  if (nivel === "SH" || nivel === "P5") return "VERDE";
  if (nivel === "P4" || nivel === "P3") return "AMARILLO";
  if (nivel === "P2") return "NARANJA";
  return "ROJO";
}

export function dictamenTecnicoV1(calificacion: number, resumen: ResumenPrioridadesV1) {
  const p1 = resumen.P1;
  const p2 = resumen.P2;
  const nivel = nivelEvaluacionV1(calificacion);

  if (nivel === "SH") {
    return "Dentro del alcance inspeccionado no se identificaron hallazgos que reduzcan la evaluacion tecnica. El resultado SH corresponde exclusivamente a los conceptos efectivamente revisados y documentados.";
  }
  if (p1 === 0 && p2 === 0 && calificacion >= 90) {
    return "La inspeccion presenta una condicion tecnica favorable dentro del alcance revisado. Los detalles documentados, si existen, deben atenderse conforme a las recomendaciones del reporte.";
  }
  if (p1 === 0 && calificacion >= 75) {
    return "La inspeccion presenta condiciones tecnicas mayormente favorables, con hallazgos que requieren correccion o seguimiento conforme a su prioridad y a las recomendaciones del reporte.";
  }
  if (p1 > 0) {
    return "La inspeccion identifico uno o mas hallazgos de prioridad P1. Deben revisarse sus alcances, evidencia y recomendaciones tecnicas antes de definir acciones de correccion, recepcion o uso.";
  }
  return "La inspeccion identifico hallazgos relevantes que requieren acciones correctivas o seguimiento. Consulte la clasificacion, prioridad, evidencia y recomendaciones tecnicas de cada hallazgo.";
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
      COUNT(*) FILTER (WHERE "obligatoria" = true AND "resultado" <> 'NO_APLICA')::int AS "total",
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
  const nivel = nivelEvaluacionV1(calificacion);

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
    nivel,
    semaforo: semaforoTecnicoV1(calificacion),
    dictamen: dictamenTecnicoV1(calificacion, resumenPrioridades),
  };
}
