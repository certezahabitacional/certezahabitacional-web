import type { PrioridadHallazgo } from "@prisma/client";

export type NivelEvaluacionCerteza = PrioridadHallazgo | "SH";

export const ESCALA_EVALUACION_CERTEZA = [
  { nivel: "P1", minimo: 0, maximo: 49, referencia: 25, descripcion: "Condición crítica o de atención prioritaria." },
  { nivel: "P2", minimo: 50, maximo: 69, referencia: 60, descripcion: "Condición relevante de atención alta." },
  { nivel: "P3", minimo: 70, maximo: 79, referencia: 75, descripcion: "Condición de atención media." },
  { nivel: "P4", minimo: 80, maximo: 89, referencia: 85, descripcion: "Condición de atención baja." },
  { nivel: "P5", minimo: 90, maximo: 99, referencia: 95, descripcion: "Detalle menor o de mejora." },
  { nivel: "SH", minimo: 100, maximo: 100, referencia: 100, descripcion: "Sin hallazgo." },
] as const;

export function nivelDesdeCalificacionV1(valor: number): NivelEvaluacionCerteza {
  if (valor >= 100) return "SH";
  if (valor >= 90) return "P5";
  if (valor >= 80) return "P4";
  if (valor >= 70) return "P3";
  if (valor >= 50) return "P2";
  return "P1";
}

export function rangoNivelV1(nivel: NivelEvaluacionCerteza) {
  const item = ESCALA_EVALUACION_CERTEZA.find((x) => x.nivel === nivel);
  return item ? (item.minimo === item.maximo ? `${item.minimo}` : `${item.minimo}–${item.maximo}`) : "—";
}

export function referenciaNivelV1(nivel: NivelEvaluacionCerteza) {
  return ESCALA_EVALUACION_CERTEZA.find((x) => x.nivel === nivel)?.referencia ?? 100;
}

export function referenciaPrioridadV1(prioridad?: PrioridadHallazgo | null) {
  return prioridad ? referenciaNivelV1(prioridad) : 100;
}

export function evaluarPromedioV1(valores: number[]) {
  if (!valores.length) return { calificacion: 100, nivel: "SH" as NivelEvaluacionCerteza };
  const calificacion = Math.round((valores.reduce((a,b) => a+b, 0) / valores.length) * 100) / 100;
  return { calificacion, nivel: nivelDesdeCalificacionV1(calificacion) };
}
