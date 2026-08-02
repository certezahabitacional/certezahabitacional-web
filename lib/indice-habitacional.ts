import { ClasificacionHallazgo } from "@prisma/client";

const PONDERACION: Record<Exclude<ClasificacionHallazgo, "NA">, number> = {
  C: 100,
  O: 90,
  NC: 70,
  CR: 35,
};

export function calcularIndiceHabitacional(
  clasificaciones: ClasificacionHallazgo[],
): number | null {
  const evaluables = clasificaciones.filter(
    (clasificacion): clasificacion is Exclude<ClasificacionHallazgo, "NA"> =>
      clasificacion !== "NA",
  );

  if (evaluables.length === 0) return null;

  const total = evaluables.reduce(
    (acumulado, clasificacion) => acumulado + PONDERACION[clasificacion],
    0,
  );

  return Number((total / evaluables.length).toFixed(2));
}

export function obtenerSemaforoHabitacional(indice: number | null) {
  if (indice === null) return null;
  if (indice >= 90) return "VERDE";
  if (indice >= 75) return "AMARILLO";
  if (indice >= 60) return "NARANJA";
  return "ROJO";
}
